import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import express, { type Request, type Response, type NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import { WebSocketServer, WebSocket } from 'ws';
import type {
  AutomationFramework,
  AutomationProject,
  DefectStatus,
  ProjectConfig,
  ProgrammingLanguage,
  SqaDefect,
  SqaRelease,
  SqaRequirement,
  SqaTestPlan,
  SqaTestSuite,
  TestingApproach,
  TestingTool,
  UserProfile,
  UserRole,
} from './src/types/index.js';
import { analyzeWebsite } from './server/analyzer.js';
import { askAiAutomationAssistant, generateAiExtraTestCases } from './server/aiAssistant.js';
import { validateProjectCode } from './server/codeValidator.js';
import { verifyFirebaseIdToken } from './server/firebaseAuth.js';
import {
  SCREENSHOTS_DIR,
  canAccessProject,
  consumeAuthOneTimeToken,
  countUsers,
  createAuthOneTimeToken,
  createUser,
  deleteProject,
  deleteSqaDefect,
  deleteSqaPlan,
  deleteSqaRelease,
  deleteSqaRequirement,
  deleteSqaSuite,
  findUserByEmail,
  findUserById,
  getAiConversation,
  getDb,
  getProjectById,
  getTestRunById,
  isTokenRevoked,
  listProjectsForUser,
  listSqaDefects,
  listSqaPlans,
  listSqaReleases,
  listSqaRequirements,
  listSqaSuites,
  listTestRuns,
  markUserEmailVerified,
  revokeSessionToken,
  saveAiConversation,
  saveProject,
  saveSqaDefect,
  saveSqaPlan,
  saveSqaRelease,
  saveSqaRequirement,
  saveSqaSuite,
  updateUserPassword,
  updateUserProfile,
} from './server/db.js';
import { generateMultiFrameworkProject } from './server/projectGenerator.js';
import {
  buildCsvReport,
  buildHtmlReport,
  buildJsonReport,
  buildPdfReport,
  buildSqaReportCsv,
  buildSqaReportHtml,
  buildSqaReportJson,
  buildSqaReportPdf,
  type SqaReportType,
} from './server/reports.js';
import {
  SESSION_COOKIE_NAME,
  checkLoginLockout,
  clearLoginFailures,
  clearSessionCookie,
  createRateLimiter,
  generateOneTimeCode,
  hashPassword,
  hashToken,
  isSameOriginStateChange,
  parseCookies,
  recordLoginFailure,
  resolveSafePath,
  sanitizeText,
  setSessionCookie,
  signAuthToken,
  validatePublicUrl,
  verifyAuthToken,
  verifyPassword,
} from './server/security.js';
import { generateTestCasesFromAnalysis } from './server/testCaseGenerator.js';
import { cancelTestRun, startIsolatedTestRun } from './server/testRunner.js';

interface AuthedRequest extends Request {
  user?: UserProfile;
  authToken?: string;
  authJti?: string;
  authExp?: number;
}

function paramStr(val: string | string[] | undefined): string {
  return Array.isArray(val) ? val[0] || '' : val || '';
}

const DEFAULT_CONFIG = (baseUrl: string): ProjectConfig => ({
  browser: 'chrome',
  browserVersion: 'latest',
  viewport: 'desktop',
  customWidth: 1440,
  customHeight: 900,
  timeoutMs: 15000,
  retries: 1,
  parallelWorkers: 1,
  headless: true,
  environment: 'staging',
  baseUrl,
  captureScreenshots: true,
  recordVideo: false,
  customTestData: {},
});

function deriveToolAndLanguage(framework: AutomationFramework): {
  tool: TestingTool;
  language: ProgrammingLanguage;
} {
  switch (framework) {
    case 'selenium-java-testng':
    case 'selenium-java-junit':
      return { tool: 'selenium', language: 'java' };
    case 'cypress-js':
      return { tool: 'cypress', language: 'javascript' };
    case 'selenium-js':
      return { tool: 'selenium', language: 'javascript' };
    case 'cypress-ts':
      return { tool: 'cypress', language: 'typescript' };
    case 'selenium-ts':
      return { tool: 'selenium', language: 'typescript' };
    case 'playwright-ts':
      return { tool: 'playwright', language: 'typescript' };
    case 'selenium-python-pytest':
      return { tool: 'selenium', language: 'python' };
    case 'playwright-python':
      return { tool: 'playwright', language: 'python' };
    default:
      return { tool: 'playwright', language: 'typescript' };
  }
}

function canWriteRole(role: UserRole): boolean {
  return role !== 'viewer';
}

function extractRequestToken(req: Request): { token: string; viaCookieOnly: boolean } {
  const authHeader = req.headers.authorization || '';
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (bearer) return { token: bearer, viaCookieOnly: false };
  const cookies = parseCookies(req.headers.cookie);
  const cookieToken = cookies[SESSION_COOKIE_NAME] || '';
  return { token: cookieToken, viaCookieOnly: Boolean(cookieToken) };
}

async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const { token, viaCookieOnly } = extractRequestToken(req);
  if (!token) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }
  if (viaCookieOnly && !isSameOriginStateChange(req)) {
    res.status(403).json({ error: 'Cross-origin state-changing request rejected.' });
    return;
  }
  const payload = verifyAuthToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Invalid or expired session token. Please sign in again.' });
    return;
  }
  if (await isTokenRevoked(payload.jti)) {
    clearSessionCookie(res);
    res.status(401).json({ error: 'Session has been signed out. Please sign in again.' });
    return;
  }
  const user = await findUserById(payload.userId);
  if (!user) {
    res.status(401).json({ error: 'Account no longer exists.' });
    return;
  }
  req.user = user;
  req.authToken = token;
  req.authJti = payload.jti;
  req.authExp = payload.exp;
  next();
}

export type BroadcastFn = (userId: string | null, event: Record<string, unknown>) => void;

export async function createExpressApp(options?: {
  onReadyBroadcast?: (setter: (fn: BroadcastFn) => void) => void;
}): Promise<express.Express> {
  await getDb();

  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '6mb' }));

  let broadcastImpl: BroadcastFn = () => {};
  options?.onReadyBroadcast?.((fn) => {
    broadcastImpl = fn;
  });
  const broadcastToUser: BroadcastFn = (userId, event) => {
    broadcastImpl(userId, event);
  };

  const authLimiter = createRateLimiter(20, 60_000);
  const analyzeLimiter = createRateLimiter(12, 60_000);
  const runLimiter = createRateLimiter(15, 60_000);
  const aiLimiter = createRateLimiter(25, 60_000);

  // Health
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, timestamp: new Date().toISOString() });
  });

  // Auth routes (supports Gmail, Outlook, Hotmail, and all valid personal email providers)
  app.post('/api/auth/register', authLimiter, async (req, res) => {
    try {
      const email = sanitizeText(req.body?.email, 160).toLowerCase();
      const name = sanitizeText(req.body?.name, 100);
      const password = typeof req.body?.password === 'string' ? req.body.password : '';
      const confirmPassword =
        typeof req.body?.confirmPassword === 'string' ? req.body.confirmPassword : password;
      const termsAccepted = req.body?.termsAccepted !== false;

      if (!email || !/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(email)) {
        res.status(400).json({ error: 'Please enter a valid personal or work email address (e.g., name@gmail.com).' });
        return;
      }
      if (!name || name.length < 2) {
        res.status(400).json({ error: 'Full name must be at least 2 characters.' });
        return;
      }
      if (password.length < 8) {
        res.status(400).json({ error: 'Password must be at least 8 characters.' });
        return;
      }
      if (password !== confirmPassword) {
        res.status(400).json({ error: 'Passwords do not match.' });
        return;
      }
      if (!termsAccepted) {
        res.status(400).json({ error: 'Please accept the Terms of Service and Privacy Policy to continue.' });
        return;
      }

      const existing = await findUserByEmail(email);
      if (existing) {
        res.status(409).json({ error: 'An account with this email already exists.' });
        return;
      }

      const total = await countUsers();
      const requestedRole = sanitizeText(req.body?.role, 32) as UserRole;
      const allowedPublicRoles: UserRole[] = ['sqa_engineer', 'qa_lead', 'project_manager', 'developer'];
      const role: UserRole =
        total === 0
          ? 'admin'
          : allowedPublicRoles.includes(requestedRole)
            ? requestedRole
            : 'sqa_engineer';

      const { hash, salt } = hashPassword(password);
      const user = await createUser({
        id: crypto.randomUUID(),
        email,
        name,
        role,
        passwordHash: hash,
        passwordSalt: salt,
      });

      // Generate one-time email verification code
      const verificationCode = generateOneTimeCode();
      await createAuthOneTimeToken({
        id: crypto.randomUUID(),
        userId: user.id,
        purpose: 'email_verify',
        tokenHash: hashToken(verificationCode),
        expiresAt: Date.now() + 1000 * 60 * 60 * 24,
      });

      const token = signAuthToken(
        {
          userId: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        false
      );
      setSessionCookie(res, token, false);

      res.status(201).json({
        user,
        token,
        verificationRequired: true,
        verificationPreviewCode: verificationCode,
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Registration failed.' });
    }
  });

  app.post('/api/auth/login', authLimiter, async (req, res) => {
    try {
      const email = sanitizeText(req.body?.email, 160).toLowerCase();
      const password = typeof req.body?.password === 'string' ? req.body.password : '';
      const rememberMe = Boolean(req.body?.rememberMe);
      const ip = req.ip || req.socket.remoteAddress || 'unknown';

      if (!email || !password) {
        res.status(400).json({ error: 'Email and password are required.' });
        return;
      }

      const lockout = checkLoginLockout(email, ip);
      if (lockout.locked) {
        res.status(429).json({
          error: `Too many failed sign-in attempts. Try again in ${Math.ceil(lockout.retryAfterSec / 60)} minute(s).`,
        });
        return;
      }

      const record = await findUserByEmail(email);
      if (!record || !verifyPassword(password, record.passwordHash, record.passwordSalt)) {
        recordLoginFailure(email, ip);
        res.status(401).json({ error: 'Invalid email or password.' });
        return;
      }

      clearLoginFailures(email, ip);

      const user: UserProfile = {
        id: record.id,
        email: record.email,
        name: record.name,
        role: record.role,
        emailVerified: record.emailVerified,
        jobTitle: record.jobTitle,
        organization: record.organization,
        createdAt: record.createdAt,
      };
      const token = signAuthToken(
        {
          userId: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        rememberMe
      );
      setSessionCookie(res, token, rememberMe);
      res.json({ user, token });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Sign-in failed.' });
    }
  });

  app.post('/api/auth/firebase-google', authLimiter, async (req, res) => {
    try {
      const idToken = typeof req.body?.idToken === 'string' ? req.body.idToken.trim() : '';
      if (!idToken) {
        res.status(400).json({ error: 'Firebase ID token is required.' });
        return;
      }
      const decoded = await verifyFirebaseIdToken(idToken);
      const email = sanitizeText(decoded.email, 160).toLowerCase();
      if (!email || decoded.email_verified !== true) {
        res.status(401).json({ error: 'A verified Google email address is required.' });
        return;
      }

      const record = await findUserByEmail(email);
      let user: UserProfile;

      if (!record) {
        const existingTotal = await countUsers();
        const role: UserRole =
          existingTotal === 0 || email === 'rajpoot311210@gmail.com' ? 'admin' : 'sqa_engineer';
        const { hash, salt } = hashPassword(crypto.randomBytes(32).toString('hex'));
        const created = await createUser({
          id: crypto.randomUUID(),
          email,
          name: sanitizeText(decoded.name, 100) || email.split('@')[0] || 'QA Engineer',
          role,
          passwordHash: hash,
          passwordSalt: salt,
        });
        await markUserEmailVerified(created.id);
        user = { ...created, emailVerified: true };
      } else {
        if (!record.emailVerified) {
          await markUserEmailVerified(record.id);
        }
        user = {
          id: record.id,
          email: record.email,
          name: record.name,
          role: record.role,
          emailVerified: true,
          jobTitle: record.jobTitle,
          organization: record.organization,
          createdAt: record.createdAt,
        };
      }

      const token = signAuthToken(
        {
          userId: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        true
      );
      setSessionCookie(res, token, true);
      res.json({ user, token });
    } catch (err) {
      res.status(401).json({
        error: err instanceof Error ? err.message : 'Firebase Google sign-in verification failed.',
      });
    }
  });

  app.get('/api/auth/session', async (req, res) => {
    const { token } = extractRequestToken(req);
    if (!token) {
      res.json({ user: null, token: null });
      return;
    }
    const payload = verifyAuthToken(token);
    if (!payload || (await isTokenRevoked(payload.jti))) {
      clearSessionCookie(res);
      res.json({ user: null, token: null });
      return;
    }
    const user = await findUserById(payload.userId);
    if (!user) {
      clearSessionCookie(res);
      res.json({ user: null, token: null });
      return;
    }
    res.json({ user, token });
  });

  app.post('/api/auth/logout', async (req, res) => {
    const { token } = extractRequestToken(req);
    if (token) {
      const payload = verifyAuthToken(token);
      if (payload) {
        await revokeSessionToken(payload.jti, payload.exp);
      }
    }
    clearSessionCookie(res);
    res.json({ ok: true });
  });

  app.get('/api/auth/me', requireAuth, (req: AuthedRequest, res) => {
    res.json({ user: req.user });
  });

  app.post('/api/auth/verify-email', authLimiter, async (req, res) => {
    const email = sanitizeText(req.body?.email, 160).toLowerCase();
    const code = sanitizeText(req.body?.code, 32).toUpperCase();
    if (!email || !code) {
      res.status(400).json({ error: 'Email and verification code are required.' });
      return;
    }
    const record = await findUserByEmail(email);
    if (!record) {
      res.status(404).json({ error: 'Account not found.' });
      return;
    }
    const valid = await consumeAuthOneTimeToken(record.id, 'email_verify', hashToken(code));
    if (!valid) {
      res.status(400).json({ error: 'Invalid or expired verification code.' });
      return;
    }
    const updatedUser = await markUserEmailVerified(record.id);
    res.json({ ok: true, user: updatedUser });
  });

  app.post('/api/auth/resend-verification', requireAuth, authLimiter, async (req: AuthedRequest, res) => {
    const code = generateOneTimeCode();
    await createAuthOneTimeToken({
      id: crypto.randomUUID(),
      userId: req.user!.id,
      purpose: 'email_verify',
      tokenHash: hashToken(code),
      expiresAt: Date.now() + 1000 * 60 * 60 * 24,
    });
    res.json({ ok: true, verificationPreviewCode: code });
  });

  app.post('/api/auth/forgot-password', authLimiter, async (req, res) => {
    const email = sanitizeText(req.body?.email, 160).toLowerCase();
    if (!email) {
      res.status(400).json({ error: 'Please enter your registered email address.' });
      return;
    }
    const record = await findUserByEmail(email);
    if (!record) {
      // Do not leak email existence to unauthenticated caller if ambiguous, or return safe confirmation
      res.json({
        ok: true,
        message: 'If an account matches this email, a verification reset code has been issued.',
      });
      return;
    }
    const resetCode = generateOneTimeCode();
    await createAuthOneTimeToken({
      id: crypto.randomUUID(),
      userId: record.id,
      purpose: 'password_reset',
      tokenHash: hashToken(resetCode),
      expiresAt: Date.now() + 1000 * 60 * 30,
    });
    res.json({
      ok: true,
      message: 'Password reset code generated for verified recovery.',
      resetPreviewCode: resetCode,
    });
  });

  app.post('/api/auth/reset-password', authLimiter, async (req, res) => {
    const email = sanitizeText(req.body?.email, 160).toLowerCase();
    const code = sanitizeText(req.body?.code, 32).toUpperCase();
    const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
    if (!email || !code || newPassword.length < 8) {
      res.status(400).json({ error: 'Email, reset code, and new password (8+ chars) are required.' });
      return;
    }
    const record = await findUserByEmail(email);
    if (!record) {
      res.status(400).json({ error: 'Invalid reset code or email.' });
      return;
    }
    const valid = await consumeAuthOneTimeToken(record.id, 'password_reset', hashToken(code));
    if (!valid) {
      res.status(400).json({ error: 'Invalid or expired reset code.' });
      return;
    }
    const { hash, salt } = hashPassword(newPassword);
    await updateUserPassword(record.id, hash, salt);
    await markUserEmailVerified(record.id);
    res.json({ ok: true });
  });

  app.patch('/api/auth/profile', requireAuth, async (req: AuthedRequest, res) => {
    const name = req.body?.name !== undefined ? sanitizeText(req.body.name, 100) : undefined;
    const jobTitle = req.body?.jobTitle !== undefined ? sanitizeText(req.body.jobTitle, 100) : undefined;
    const organization =
      req.body?.organization !== undefined ? sanitizeText(req.body.organization, 120) : undefined;
    if (name !== undefined && name.length < 2) {
      res.status(400).json({ error: 'Name must be at least 2 characters.' });
      return;
    }
    const updated = await updateUserProfile(req.user!.id, { name, jobTitle, organization });
    res.json({ user: updated });
  });

  app.post('/api/auth/change-password', requireAuth, async (req: AuthedRequest, res) => {
    const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
    const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
    if (!currentPassword || newPassword.length < 8) {
      res.status(400).json({ error: 'Current password and a new password (8+ chars) are required.' });
      return;
    }
    const record = await findUserByEmail(req.user!.email);
    if (!record || !verifyPassword(currentPassword, record.passwordHash, record.passwordSalt)) {
      res.status(401).json({ error: 'Current password is incorrect.' });
      return;
    }
    const { hash, salt } = hashPassword(newPassword);
    await updateUserPassword(record.id, hash, salt);
    res.json({ ok: true });
  });

  // Website Analyzer API (authenticated so results stream directly to user's WS session)
  app.post('/api/analyze', requireAuth, analyzeLimiter, async (req: AuthedRequest, res) => {
    try {
      const rawUrl = sanitizeText(req.body?.url, 2048);
      const maxPages = Number(req.body?.maxPages) || 6;
      const maxDepth = Number(req.body?.maxDepth) || 2;
      const respectRobots = req.body?.respectRobots !== false;
      const followSubdomains = Boolean(req.body?.followSubdomains);
      const jobId = sanitizeText(req.body?.jobId, 64) || crypto.randomUUID();

      const report = await analyzeWebsite({
        jobId,
        rawUrl,
        maxPages,
        maxDepth,
        respectRobots,
        followSubdomains,
        onProgress: (ev) => {
          broadcastToUser(req.user!.id, { type: 'analysis:progress', ...ev });
        },
      });

      const testCases = generateTestCasesFromAnalysis(report);
      res.json({ analysis: report, testCases });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Website analysis failed.',
      });
    }
  });

  // Projects CRUD
  app.get('/api/projects', requireAuth, async (req: AuthedRequest, res) => {
    const projects = await listProjectsForUser(req.user!.id, req.user!.email, req.user!.role);
    res.json({ projects });
  });

  app.post('/api/projects', requireAuth, async (req: AuthedRequest, res) => {
    try {
      if (!canWriteRole(req.user!.role)) {
        res.status(403).json({ error: 'Viewer role cannot create projects.' });
        return;
      }
      const urlRaw = sanitizeText(req.body?.url, 2048);
      const urlCheck = await validatePublicUrl(urlRaw);
      if (!urlCheck.valid || !urlCheck.url) {
        res.status(400).json({ error: urlCheck.error || 'Invalid URL' });
        return;
      }

      const selectedFrameworks: AutomationFramework[] =
        Array.isArray(req.body?.selectedFrameworks) && req.body.selectedFrameworks.length > 0
          ? req.body.selectedFrameworks
          : [(req.body?.framework || 'playwright-ts') as AutomationFramework];

      const framework = selectedFrameworks[0];
      const approach = (req.body?.approach || 'pom') as TestingApproach;
      const { tool, language } = deriveToolAndLanguage(framework);
      const name =
        sanitizeText(req.body?.name, 120) ||
        `${urlCheck.url.hostname.replace(/^www\./, '')} Automation`;
      const description = sanitizeText(req.body?.description, 400);
      const analysis = req.body?.analysis ?? null;
      const testCases = Array.isArray(req.body?.testCases) ? req.body.testCases : [];
      const config: ProjectConfig = {
        ...DEFAULT_CONFIG(urlCheck.url.toString()),
        ...(req.body?.config || {}),
        baseUrl: urlCheck.url.toString(),
      };

      const files =
        Array.isArray(req.body?.files) && req.body.files.length > 0
          ? req.body.files
          : analysis
            ? generateMultiFrameworkProject({
                projectName: name,
                frameworks: selectedFrameworks,
                approach,
                analysis,
                testCases,
                config,
              })
            : [];

      const now = new Date().toISOString();
      const project: AutomationProject = {
        id: crypto.randomUUID(),
        userId: req.user!.id,
        name,
        description,
        url: urlCheck.url.toString(),
        tool,
        language,
        framework,
        selectedFrameworks,
        approach,
        analysis,
        testCases,
        files,
        config,
        secretsMeta: [],
        teamMembers: [],
        createdAt: now,
        updatedAt: now,
      };

      const saved = await saveProject(project);
      res.status(201).json({ project: saved });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to create project' });
    }
  });

  app.get('/api/projects/:id', requireAuth, async (req: AuthedRequest, res) => {
    const project = await getProjectById(paramStr(req.params.id));
    if (!project) {
      res.status(404).json({ error: 'Project not found.' });
      return;
    }
    if (!canAccessProject(project, req.user!, false)) {
      res.status(403).json({ error: 'Access denied.' });
      return;
    }
    res.json({ project });
  });

  app.patch('/api/projects/:id', requireAuth, async (req: AuthedRequest, res) => {
    const existing = await getProjectById(paramStr(req.params.id));
    if (!existing) {
      res.status(404).json({ error: 'Project not found.' });
      return;
    }
    if (!canAccessProject(existing, req.user!, true) || !canWriteRole(req.user!.role)) {
      res.status(403).json({ error: 'Read-only access: cannot modify project.' });
      return;
    }

    let nextFramework = existing.framework;
    let nextSelected = existing.selectedFrameworks || [existing.framework];
    let nextTool = existing.tool;
    let nextLanguage = existing.language;

    if (Array.isArray(req.body?.selectedFrameworks) && req.body.selectedFrameworks.length > 0) {
      nextSelected = req.body.selectedFrameworks as AutomationFramework[];
      nextFramework = nextSelected[0];
      const derived = deriveToolAndLanguage(nextFramework);
      nextTool = derived.tool;
      nextLanguage = derived.language;
    } else if (req.body?.framework) {
      nextFramework = req.body.framework as AutomationFramework;
      if (!nextSelected.includes(nextFramework)) {
        nextSelected = [nextFramework];
      }
      const derived = deriveToolAndLanguage(nextFramework);
      nextTool = derived.tool;
      nextLanguage = derived.language;
    }

    const updated: AutomationProject = {
      ...existing,
      name: req.body?.name !== undefined ? sanitizeText(req.body.name, 120) : existing.name,
      description:
        req.body?.description !== undefined
          ? sanitizeText(req.body.description, 400)
          : existing.description,
      framework: nextFramework,
      selectedFrameworks: nextSelected,
      tool: nextTool,
      language: nextLanguage,
      approach: req.body?.approach ?? existing.approach,
      analysis: req.body?.analysis !== undefined ? req.body.analysis : existing.analysis,
      testCases: Array.isArray(req.body?.testCases) ? req.body.testCases : existing.testCases,
      files: Array.isArray(req.body?.files) ? req.body.files : existing.files,
      config: req.body?.config ? { ...existing.config, ...req.body.config } : existing.config,
      teamMembers: Array.isArray(req.body?.teamMembers) ? req.body.teamMembers : existing.teamMembers,
      googleSheetId: req.body?.googleSheetId !== undefined ? sanitizeText(req.body.googleSheetId, 200) : existing.googleSheetId,
      googleSheetUrl: req.body?.googleSheetUrl !== undefined ? sanitizeText(req.body.googleSheetUrl, 500) : existing.googleSheetUrl,
      googleSheetTitle: req.body?.googleSheetTitle !== undefined ? sanitizeText(req.body.googleSheetTitle, 200) : existing.googleSheetTitle,
      googleSheetLastSync:
        req.body?.googleSheetLastSync !== undefined
          ? sanitizeText(req.body.googleSheetLastSync, 80)
          : existing.googleSheetLastSync,
      updatedAt: new Date().toISOString(),
    };

    const saved = await saveProject(updated);
    res.json({ project: saved });
  });

  app.post('/api/projects/:id/regenerate', requireAuth, async (req: AuthedRequest, res) => {
    const existing = await getProjectById(paramStr(req.params.id));
    if (!existing) {
      res.status(404).json({ error: 'Project not found.' });
      return;
    }
    if (!canAccessProject(existing, req.user!, true) || !canWriteRole(req.user!.role)) {
      res.status(403).json({ error: 'Access denied.' });
      return;
    }
    if (!existing.analysis) {
      res.status(400).json({ error: 'Analyze a website URL before generating scripts.' });
      return;
    }

    const selectedFrameworks: AutomationFramework[] =
      Array.isArray(req.body?.selectedFrameworks) && req.body.selectedFrameworks.length > 0
        ? req.body.selectedFrameworks
        : req.body?.framework
          ? [req.body.framework as AutomationFramework]
          : existing.selectedFrameworks || [existing.framework];

    const framework = selectedFrameworks[0];
    const approach = (req.body?.approach || existing.approach) as TestingApproach;
    const { tool, language } = deriveToolAndLanguage(framework);
    const files = generateMultiFrameworkProject({
      projectName: existing.name,
      frameworks: selectedFrameworks,
      approach,
      analysis: existing.analysis,
      testCases: existing.testCases,
      config: existing.config,
    });

    const saved = await saveProject({
      ...existing,
      framework,
      selectedFrameworks,
      tool,
      language,
      approach,
      files,
      updatedAt: new Date().toISOString(),
    });
    res.json({ project: saved });
  });

  app.post('/api/projects/:id/members', requireAuth, async (req: AuthedRequest, res) => {
    const existing = await getProjectById(paramStr(req.params.id));
    if (!existing) {
      res.status(404).json({ error: 'Project not found.' });
      return;
    }
    if (existing.userId !== req.user!.id && req.user!.role !== 'admin') {
      res.status(403).json({ error: 'Only project owner or admin can manage team members.' });
      return;
    }
    const email = sanitizeText(req.body?.email, 160).toLowerCase();
    const name = sanitizeText(req.body?.name, 100) || email.split('@')[0];
    const role = (sanitizeText(req.body?.role, 32) || 'sqa_engineer') as UserRole;
    if (!email || !email.includes('@')) {
      res.status(400).json({ error: 'Valid team member email is required.' });
      return;
    }
    const current = existing.teamMembers || [];
    const nextMembers = [
      ...current.filter((m) => m.email.toLowerCase() !== email),
      {
        id: crypto.randomUUID(),
        name,
        email,
        role,
        addedAt: new Date().toISOString(),
      },
    ];
    const saved = await saveProject({
      ...existing,
      teamMembers: nextMembers,
      updatedAt: new Date().toISOString(),
    });
    res.json({ project: saved });
  });

  app.delete('/api/projects/:id/members/:memberId', requireAuth, async (req: AuthedRequest, res) => {
    const existing = await getProjectById(paramStr(req.params.id));
    if (!existing) {
      res.status(404).json({ error: 'Project not found.' });
      return;
    }
    if (existing.userId !== req.user!.id && req.user!.role !== 'admin') {
      res.status(403).json({ error: 'Only project owner or admin can remove team members.' });
      return;
    }
    const memberId = paramStr(req.params.memberId);
    const saved = await saveProject({
      ...existing,
      teamMembers: (existing.teamMembers || []).filter((m) => m.id !== memberId),
      updatedAt: new Date().toISOString(),
    });
    res.json({ project: saved });
  });

  app.post('/api/projects/:id/duplicate', requireAuth, async (req: AuthedRequest, res) => {
    const existing = await getProjectById(paramStr(req.params.id));
    if (!existing) {
      res.status(404).json({ error: 'Project not found.' });
      return;
    }
    if (!canAccessProject(existing, req.user!, false) || !canWriteRole(req.user!.role)) {
      res.status(403).json({ error: 'Access denied.' });
      return;
    }
    const now = new Date().toISOString();
    const copy: AutomationProject = {
      ...existing,
      id: crypto.randomUUID(),
      userId: req.user!.id,
      name: `${existing.name} (Copy)`,
      secretsMeta: [],
      googleSheetId: undefined,
      googleSheetUrl: undefined,
      googleSheetTitle: undefined,
      googleSheetLastSync: undefined,
      createdAt: now,
      updatedAt: now,
    };
    const saved = await saveProject(copy, {});
    res.status(201).json({ project: saved });
  });

  app.delete('/api/projects/:id', requireAuth, async (req: AuthedRequest, res) => {
    const existing = await getProjectById(paramStr(req.params.id));
    if (!existing) {
      res.status(404).json({ error: 'Project not found.' });
      return;
    }
    if (existing.userId !== req.user!.id && req.user!.role !== 'admin') {
      res.status(403).json({ error: 'Only project owner or admin can delete projects.' });
      return;
    }
    await deleteProject(existing.id);
    res.json({ ok: true });
  });

  // Encrypted Secrets Vault for authorized test credentials
  app.put('/api/projects/:id/secrets', requireAuth, async (req: AuthedRequest, res) => {
    const existing = await getProjectById(paramStr(req.params.id));
    if (!existing) {
      res.status(404).json({ error: 'Project not found.' });
      return;
    }
    if (!canAccessProject(existing, req.user!, true) || !canWriteRole(req.user!.role)) {
      res.status(403).json({ error: 'Access denied.' });
      return;
    }
    const rawSecrets = req.body?.secrets;
    if (!rawSecrets || typeof rawSecrets !== 'object') {
      res.status(400).json({ error: 'Secrets object required.' });
      return;
    }
    const cleanSecrets: Record<string, string> = {};
    for (const [k, v] of Object.entries(rawSecrets)) {
      const key = sanitizeText(k, 64).replace(/[^a-zA-Z0-9_]/g, '_');
      if (key && typeof v === 'string' && v.length > 0) {
        cleanSecrets[key] = v.slice(0, 512);
      }
    }
    const saved = await saveProject({ ...existing, updatedAt: new Date().toISOString() }, cleanSecrets);
    res.json({ project: saved });
  });

  // Live Isolated Test Execution
  app.post('/api/projects/:id/runs', requireAuth, runLimiter, async (req: AuthedRequest, res) => {
    try {
      const project = await getProjectById(paramStr(req.params.id));
      if (!project) {
        res.status(404).json({ error: 'Project not found.' });
        return;
      }
      if (!canAccessProject(project, req.user!, true) || !canWriteRole(req.user!.role)) {
        res.status(403).json({ error: 'Access denied.' });
        return;
      }
      const testCaseIds = Array.isArray(req.body?.testCaseIds)
        ? (req.body.testCaseIds as string[])
        : undefined;

      const run = await startIsolatedTestRun({
        project,
        testCaseIds,
        broadcast: (ev) => broadcastToUser(req.user!.id, ev),
      });

      res.status(202).json({ run });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to start test run.' });
    }
  });

  app.get('/api/runs', requireAuth, async (req: AuthedRequest, res) => {
    const projectId = typeof req.query.projectId === 'string' ? req.query.projectId : undefined;
    const runs = await listTestRuns(req.user!.id, projectId);
    res.json({ runs });
  });

  app.get('/api/runs/:runId', requireAuth, async (req: AuthedRequest, res) => {
    const run = await getTestRunById(paramStr(req.params.runId));
    if (!run) {
      res.status(404).json({ error: 'Test run not found.' });
      return;
    }
    if (run.userId !== req.user!.id && req.user!.role !== 'admin') {
      res.status(403).json({ error: 'Access denied.' });
      return;
    }
    res.json({ run });
  });

  app.post('/api/runs/:runId/cancel', requireAuth, async (req: AuthedRequest, res) => {
    const run = await getTestRunById(paramStr(req.params.runId));
    if (!run) {
      res.status(404).json({ error: 'Test run not found.' });
      return;
    }
    if (run.userId !== req.user!.id && req.user!.role !== 'admin') {
      res.status(403).json({ error: 'Access denied.' });
      return;
    }
    const cancelled = cancelTestRun(run.id);
    res.json({ cancelled });
  });

  // Failure Screenshot serving (auth-checked + strict path traversal guard)
  app.get('/api/screenshots/:runId/:filename', requireAuth, async (req: AuthedRequest, res) => {
    const run = await getTestRunById(paramStr(req.params.runId));
    if (!run || (run.userId !== req.user!.id && req.user!.role !== 'admin')) {
      res.status(403).json({ error: 'Access denied.' });
      return;
    }
    const safePath = resolveSafePath(
      SCREENSHOTS_DIR,
      path.join(paramStr(req.params.runId), paramStr(req.params.filename))
    );
    if (!safePath || !fs.existsSync(safePath)) {
      res.status(404).json({ error: 'Screenshot not found.' });
      return;
    }
    res.sendFile(safePath);
  });

  // Code Syntax Diagnostics API
  app.post('/api/code/validate', requireAuth, async (req, res) => {
    try {
      const language = req.body?.language || 'typescript';
      const code = typeof req.body?.code === 'string' ? req.body.code : '';
      const result = await validateProjectCode(language, code);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Validation failed.' });
    }
  });

  // AI Automation Assistant Routes
  app.get('/api/projects/:id/ai/history', requireAuth, async (req: AuthedRequest, res) => {
    const project = await getProjectById(paramStr(req.params.id));
    if (!project || !canAccessProject(project, req.user!, false)) {
      res.status(404).json({ error: 'Project not found.' });
      return;
    }
    const messages = await getAiConversation(project.id, req.user!.id);
    res.json({ messages });
  });

  app.post('/api/projects/:id/ai/chat', requireAuth, aiLimiter, async (req: AuthedRequest, res) => {
    try {
      const project = await getProjectById(paramStr(req.params.id));
      if (!project || !canAccessProject(project, req.user!, false)) {
        res.status(404).json({ error: 'Project not found.' });
        return;
      }
      const prompt = sanitizeText(req.body?.prompt, 2000);
      if (!prompt) {
        res.status(400).json({ error: 'Prompt is required.' });
        return;
      }
      const history = await getAiConversation(project.id, req.user!.id);
      const runs = await listTestRuns(req.user!.id, project.id);
      const latestRun = runs[0] ?? null;

      const aiResp = await askAiAutomationAssistant({
        project,
        prompt,
        history,
        activeFilePath: sanitizeText(req.body?.activeFilePath, 260) || undefined,
        activeFileContent:
          typeof req.body?.activeFileContent === 'string'
            ? req.body.activeFileContent.slice(0, 8000)
            : undefined,
        latestRun,
      });

      const userMsg = {
        id: crypto.randomUUID(),
        role: 'user' as const,
        content: prompt,
        createdAt: new Date().toISOString(),
      };
      const assistantMsg = {
        id: crypto.randomUUID(),
        role: 'assistant' as const,
        content: aiResp.reply,
        codeBlocks: aiResp.codeBlocks,
        createdAt: new Date().toISOString(),
      };

      const nextHistory = [...history, userMsg, assistantMsg];
      await saveAiConversation(project.id, req.user!.id, nextHistory);
      res.json({ message: assistantMsg, messages: nextHistory });
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : 'AI Assistant request failed.',
      });
    }
  });

  app.post('/api/projects/:id/ai/enhance-tests', requireAuth, aiLimiter, async (req: AuthedRequest, res) => {
    try {
      const project = await getProjectById(paramStr(req.params.id));
      if (!project || !canAccessProject(project, req.user!, true) || !canWriteRole(req.user!.role)) {
        res.status(404).json({ error: 'Project not found or read-only.' });
        return;
      }
      const extra = await generateAiExtraTestCases(
        project,
        sanitizeText(req.body?.focus, 300) || undefined
      );
      let nextSeq = project.testCases.length + 1;
      const appended = extra.map((item) => ({
        ...item,
        id: crypto.randomUUID(),
        code: `TC-${String(nextSeq++).padStart(3, '0')}`,
        status: 'pending' as const,
        sqaStatus: 'Not Run' as const,
        priority: item.priority || ('Medium' as const),
        severity: item.severity || ('Major' as const),
        automationStatus: item.automationStatus || ('Automated' as const),
        enabled: true,
      }));
      const saved = await saveProject({
        ...project,
        testCases: [...project.testCases, ...appended],
        updatedAt: new Date().toISOString(),
      });
      res.json({ addedCount: appended.length, project: saved });
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : 'Failed to synthesize extra test cases.',
      });
    }
  });

  // ---------- SQA Management System Routes ----------

  app.get('/api/sqa/overview', requireAuth, async (req: AuthedRequest, res) => {
    const projectId = typeof req.query.projectId === 'string' ? req.query.projectId : undefined;
    const [plans, suites, defects, requirements, releases] = await Promise.all([
      listSqaPlans(req.user!.id, projectId),
      listSqaSuites(req.user!.id, projectId),
      listSqaDefects(req.user!.id, projectId),
      listSqaRequirements(req.user!.id, projectId),
      listSqaReleases(req.user!.id, projectId),
    ]);
    res.json({ plans, suites, defects, requirements, releases });
  });

  // Test Plans
  app.post('/api/sqa/plans', requireAuth, async (req: AuthedRequest, res) => {
    if (!canWriteRole(req.user!.role)) {
      res.status(403).json({ error: 'Read-only role cannot create test plans.' });
      return;
    }
    const title = sanitizeText(req.body?.title, 160);
    const projectId = sanitizeText(req.body?.projectId, 80);
    if (!title || !projectId) {
      res.status(400).json({ error: 'Project ID and plan title are required.' });
      return;
    }
    const now = new Date().toISOString();
    const plan: SqaTestPlan = {
      id: sanitizeText(req.body?.id, 80) || crypto.randomUUID(),
      projectId,
      userId: req.user!.id,
      title,
      strategy: sanitizeText(req.body?.strategy, 2000),
      scope: sanitizeText(req.body?.scope, 2000),
      objectives: sanitizeText(req.body?.objectives, 2000),
      resources: sanitizeText(req.body?.resources, 1000),
      scheduleStart: sanitizeText(req.body?.scheduleStart, 40),
      scheduleEnd: sanitizeText(req.body?.scheduleEnd, 40),
      releaseTarget: sanitizeText(req.body?.releaseTarget, 80),
      status: (req.body?.status || 'Draft') as SqaTestPlan['status'],
      createdAt: sanitizeText(req.body?.createdAt, 40) || now,
      updatedAt: now,
    };
    const saved = await saveSqaPlan(plan);
    res.status(201).json({ plan: saved });
  });

  app.delete('/api/sqa/plans/:id', requireAuth, async (req: AuthedRequest, res) => {
    if (!canWriteRole(req.user!.role)) {
      res.status(403).json({ error: 'Read-only role cannot delete test plans.' });
      return;
    }
    await deleteSqaPlan(paramStr(req.params.id), req.user!.id);
    res.json({ ok: true });
  });

  // Test Suites
  app.post('/api/sqa/suites', requireAuth, async (req: AuthedRequest, res) => {
    if (!canWriteRole(req.user!.role)) {
      res.status(403).json({ error: 'Read-only role cannot create test suites.' });
      return;
    }
    const name = sanitizeText(req.body?.name, 140);
    const projectId = sanitizeText(req.body?.projectId, 80);
    if (!name || !projectId) {
      res.status(400).json({ error: 'Project ID and suite name are required.' });
      return;
    }
    const now = new Date().toISOString();
    const suite: SqaTestSuite = {
      id: sanitizeText(req.body?.id, 80) || crypto.randomUUID(),
      projectId,
      userId: req.user!.id,
      name,
      suiteType: (req.body?.suiteType || 'Regression') as SqaTestSuite['suiteType'],
      description: sanitizeText(req.body?.description, 1000),
      testCaseIds: Array.isArray(req.body?.testCaseIds) ? req.body.testCaseIds : [],
      createdAt: sanitizeText(req.body?.createdAt, 40) || now,
      updatedAt: now,
    };
    const saved = await saveSqaSuite(suite);
    res.status(201).json({ suite: saved });
  });

  app.delete('/api/sqa/suites/:id', requireAuth, async (req: AuthedRequest, res) => {
    if (!canWriteRole(req.user!.role)) {
      res.status(403).json({ error: 'Read-only role cannot delete test suites.' });
      return;
    }
    await deleteSqaSuite(paramStr(req.params.id), req.user!.id);
    res.json({ ok: true });
  });

  // Defects
  app.post('/api/sqa/defects', requireAuth, async (req: AuthedRequest, res) => {
    if (!canWriteRole(req.user!.role)) {
      res.status(403).json({ error: 'Read-only role cannot log or update defects.' });
      return;
    }
    const title = sanitizeText(req.body?.title, 200);
    const projectId = sanitizeText(req.body?.projectId, 80);
    if (!title || !projectId) {
      res.status(400).json({ error: 'Project ID and bug title are required.' });
      return;
    }
    const existingList = await listSqaDefects(req.user!.id, projectId);
    const now = new Date().toISOString();
    const defect: SqaDefect = {
      id: sanitizeText(req.body?.id, 80) || crypto.randomUUID(),
      bugCode: sanitizeText(req.body?.bugCode, 24) || `BUG-${String(existingList.length + 1).padStart(3, '0')}`,
      projectId,
      userId: req.user!.id,
      title,
      description: sanitizeText(req.body?.description, 2000),
      stepsToReproduce: sanitizeText(req.body?.stepsToReproduce, 2000),
      expectedResult: sanitizeText(req.body?.expectedResult, 1000),
      actualResult: sanitizeText(req.body?.actualResult, 1000),
      severity: (req.body?.severity || 'Major') as SqaDefect['severity'],
      priority: (req.body?.priority || 'High') as SqaDefect['priority'],
      assignedDeveloper: sanitizeText(req.body?.assignedDeveloper, 120),
      reportedBy: sanitizeText(req.body?.reportedBy, 120) || req.user!.name,
      status: (req.body?.status || 'New') as DefectStatus,
      linkedTestCaseId: sanitizeText(req.body?.linkedTestCaseId, 80) || undefined,
      linkedRequirementId: sanitizeText(req.body?.linkedRequirementId, 80) || undefined,
      screenshotUrl: sanitizeText(req.body?.screenshotUrl, 400) || undefined,
      attachmentName: sanitizeText(req.body?.attachmentName, 160) || undefined,
      resolutionNotes: sanitizeText(req.body?.resolutionNotes, 1000) || undefined,
      createdAt: sanitizeText(req.body?.createdAt, 40) || now,
      updatedAt: now,
    };
    const saved = await saveSqaDefect(defect);
    res.status(201).json({ defect: saved });
  });

  app.delete('/api/sqa/defects/:id', requireAuth, async (req: AuthedRequest, res) => {
    if (!canWriteRole(req.user!.role)) {
      res.status(403).json({ error: 'Read-only role cannot delete defects.' });
      return;
    }
    await deleteSqaDefect(paramStr(req.params.id), req.user!.id);
    res.json({ ok: true });
  });

  // Requirements Traceability Matrix (RTM)
  app.post('/api/sqa/requirements', requireAuth, async (req: AuthedRequest, res) => {
    if (!canWriteRole(req.user!.role)) {
      res.status(403).json({ error: 'Read-only role cannot edit requirements.' });
      return;
    }
    const title = sanitizeText(req.body?.title, 200);
    const projectId = sanitizeText(req.body?.projectId, 80);
    if (!title || !projectId) {
      res.status(400).json({ error: 'Project ID and requirement title are required.' });
      return;
    }
    const existingList = await listSqaRequirements(req.user!.id, projectId);
    const now = new Date().toISOString();
    const item: SqaRequirement = {
      id: sanitizeText(req.body?.id, 80) || crypto.randomUUID(),
      reqCode: sanitizeText(req.body?.reqCode, 24) || `REQ-${String(existingList.length + 1).padStart(3, '0')}`,
      projectId,
      userId: req.user!.id,
      type: (req.body?.type || 'Functional') as SqaRequirement['type'],
      title,
      description: sanitizeText(req.body?.description, 2000),
      module: sanitizeText(req.body?.module, 120) || 'Core',
      priority: (req.body?.priority || 'High') as SqaRequirement['priority'],
      linkedTestCaseIds: Array.isArray(req.body?.linkedTestCaseIds) ? req.body.linkedTestCaseIds : [],
      linkedDefectIds: Array.isArray(req.body?.linkedDefectIds) ? req.body.linkedDefectIds : [],
      createdAt: sanitizeText(req.body?.createdAt, 40) || now,
      updatedAt: now,
    };
    const saved = await saveSqaRequirement(item);
    res.status(201).json({ requirement: saved });
  });

  app.delete('/api/sqa/requirements/:id', requireAuth, async (req: AuthedRequest, res) => {
    if (!canWriteRole(req.user!.role)) {
      res.status(403).json({ error: 'Read-only role cannot delete requirements.' });
      return;
    }
    await deleteSqaRequirement(paramStr(req.params.id), req.user!.id);
    res.json({ ok: true });
  });

  // Releases & Sign-off
  app.post('/api/sqa/releases', requireAuth, async (req: AuthedRequest, res) => {
    if (!canWriteRole(req.user!.role)) {
      res.status(403).json({ error: 'Read-only role cannot manage releases.' });
      return;
    }
    const version = sanitizeText(req.body?.version, 40);
    const name = sanitizeText(req.body?.name, 140);
    const projectId = sanitizeText(req.body?.projectId, 80);
    if (!version || !name || !projectId) {
      res.status(400).json({ error: 'Project ID, version, and release name are required.' });
      return;
    }
    const now = new Date().toISOString();
    const release: SqaRelease = {
      id: sanitizeText(req.body?.id, 80) || crypto.randomUUID(),
      projectId,
      userId: req.user!.id,
      version,
      name,
      buildNumber: sanitizeText(req.body?.buildNumber, 60),
      environment: (req.body?.environment || 'staging') as SqaRelease['environment'],
      targetDate: sanitizeText(req.body?.targetDate, 40),
      buildVerified: Boolean(req.body?.buildVerified),
      readinessStatus: (req.body?.readinessStatus || 'Pending') as SqaRelease['readinessStatus'],
      approvalStatus: (req.body?.approvalStatus || 'Pending') as SqaRelease['approvalStatus'],
      approvedBy:
        req.body?.approvalStatus === 'Approved'
          ? sanitizeText(req.body?.approvedBy, 120) || req.user!.name
          : sanitizeText(req.body?.approvedBy, 120) || undefined,
      notes: sanitizeText(req.body?.notes, 2000),
      createdAt: sanitizeText(req.body?.createdAt, 40) || now,
      updatedAt: now,
    };
    const saved = await saveSqaRelease(release);
    res.status(201).json({ release: saved });
  });

  app.delete('/api/sqa/releases/:id', requireAuth, async (req: AuthedRequest, res) => {
    if (!canWriteRole(req.user!.role)) {
      res.status(403).json({ error: 'Read-only role cannot delete releases.' });
      return;
    }
    await deleteSqaRelease(paramStr(req.params.id), req.user!.id);
    res.json({ ok: true });
  });

  // Reports & Export
  app.get('/api/reports/sqa/download', requireAuth, async (req: AuthedRequest, res) => {
    const reportType = (String(req.query.type || 'summary') as SqaReportType) || 'summary';
    const format = String(req.query.format || 'pdf').toLowerCase();
    const projectId =
      typeof req.query.projectId === 'string' && req.query.projectId !== 'all'
        ? req.query.projectId
        : undefined;

    const allProjects = await listProjectsForUser(req.user!.id, req.user!.email, req.user!.role);
    const projects = projectId ? allProjects.filter((p) => p.id === projectId) : allProjects;
    const [runs, defects, plans, suites, requirements, releases] = await Promise.all([
      listTestRuns(req.user!.id, projectId),
      listSqaDefects(req.user!.id, projectId),
      listSqaPlans(req.user!.id, projectId),
      listSqaSuites(req.user!.id, projectId),
      listSqaRequirements(req.user!.id, projectId),
      listSqaReleases(req.user!.id, projectId),
    ]);

    const bundle = { reportType, projects, runs, defects, plans, suites, requirements, releases };

    if (format === 'pdf') {
      const buf = await buildSqaReportPdf(bundle);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="sqa-${reportType}-report.pdf"`);
      res.send(buf);
      return;
    }
    if (format === 'csv') {
      const csv = buildSqaReportCsv(bundle);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="sqa-${reportType}-report.csv"`);
      res.send(csv);
      return;
    }
    if (format === 'html') {
      const html = buildSqaReportHtml(bundle);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="sqa-${reportType}-report.html"`);
      res.send(html);
      return;
    }

    const json = buildSqaReportJson(bundle);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="sqa-${reportType}-report.json"`);
    res.send(json);
  });

  app.get('/api/reports/:runId/download', requireAuth, async (req: AuthedRequest, res) => {
    const run = await getTestRunById(paramStr(req.params.runId));
    if (!run || (run.userId !== req.user!.id && req.user!.role !== 'admin')) {
      res.status(404).json({ error: 'Test run not found.' });
      return;
    }
    const project = await getProjectById(run.projectId);
    const format = String(req.query.format || 'json').toLowerCase();

    if (format === 'pdf') {
      const pdfBuf = await buildPdfReport(run, project);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="report-${run.id.slice(0, 8)}.pdf"`);
      res.send(pdfBuf);
      return;
    }

    if (format === 'html') {
      const html = buildHtmlReport(run, project);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="report-${run.id.slice(0, 8)}.html"`);
      res.send(html);
      return;
    }

    if (format === 'csv') {
      const csv = buildCsvReport(run);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="report-${run.id.slice(0, 8)}.csv"`);
      res.send(csv);
      return;
    }

    const json = buildJsonReport(run, project);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="report-${run.id.slice(0, 8)}.json"`);
    res.send(json);
  });

  // Explicit JSON 404 for unmatched /api/* routes
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  return app;
}

async function startStandaloneServer() {
  let setBroadcast: (fn: BroadcastFn) => void = () => {};
  const app = await createExpressApp({
    onReadyBroadcast: (setter) => {
      setBroadcast = setter;
    },
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });
  const wsClients = new Map<WebSocket, { userId?: string }>();

  wss.on('connection', (ws, req) => {
    const cookies = parseCookies(req.headers.cookie);
    const cookieTok = cookies[SESSION_COOKIE_NAME];
    const verifiedCookie = cookieTok ? verifyAuthToken(cookieTok) : null;
    wsClients.set(ws, verifiedCookie ? { userId: verifiedCookie.userId } : {});
    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(String(raw)) as { type?: string; token?: string };
        if (msg.type === 'auth' && msg.token) {
          const verified = verifyAuthToken(msg.token);
          if (verified) {
            wsClients.set(ws, { userId: verified.userId });
          }
        }
      } catch {
        // Ignore malformed WS payloads
      }
    });
    ws.on('close', () => wsClients.delete(ws));
  });

  setBroadcast((userId, event) => {
    const data = JSON.stringify(event);
    for (const [client, meta] of wsClients.entries()) {
      if (client.readyState !== WebSocket.OPEN) continue;
      if (!userId || meta.userId === userId) {
        client.send(data);
      }
    }
  });

  // Vite dev middleware or static production build
  const distDir = path.resolve(process.cwd(), 'dist');
  const distIndex = path.join(distDir, 'index.html');
  const useProdStatic = process.env.NODE_ENV === 'production' && fs.existsSync(distIndex);

  if (!useProdStatic) {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distDir));
    app.use((_req, res) => {
      res.sendFile(distIndex);
    });
  }

  const port = Number(process.env.PORT) || 3000;
  server.listen(port, '0.0.0.0', () => {
    console.log(`Automator AI Studio server listening on http://0.0.0.0:${port}`);
  });
}

if (!process.env.VERCEL && !process.env.VERCEL_ENV) {
  startStandaloneServer().catch((err) => {
    console.error('Fatal startup error:', err);
    process.exit(1);
  });
}
