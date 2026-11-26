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
  ProjectConfig,
  ProgrammingLanguage,
  TestingApproach,
  TestingTool,
  UserProfile,
} from './src/types/index.js';
import { analyzeWebsite } from './server/analyzer.js';
import { askAiAutomationAssistant, generateAiExtraTestCases } from './server/aiAssistant.js';
import { validateProjectCode } from './server/codeValidator.js';
import {
  SCREENSHOTS_DIR,
  countUsers,
  createUser,
  deleteProject,
  findUserByEmail,
  findUserById,
  getAiConversation,
  getDb,
  getProjectById,
  getTestRunById,
  listProjectsForUser,
  listTestRuns,
  saveAiConversation,
  saveProject,
} from './server/db.js';
import { generateAutomationProject } from './server/projectGenerator.js';
import { buildHtmlReport, buildJsonReport, buildPdfReport } from './server/reports.js';
import {
  createRateLimiter,
  hashPassword,
  resolveSafePath,
  sanitizeText,
  signAuthToken,
  validatePublicUrl,
  verifyAuthToken,
  verifyPassword,
} from './server/security.js';
import { generateTestCasesFromAnalysis } from './server/testCaseGenerator.js';
import { cancelTestRun, startIsolatedTestRun } from './server/testRunner.js';

interface AuthedRequest extends Request {
  user?: UserProfile;
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
    case 'selenium-python-pytest':
      return { tool: 'selenium', language: 'python' };
  }
}

async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }
  const payload = verifyAuthToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Invalid or expired session token. Please sign in again.' });
    return;
  }
  const user = await findUserById(payload.userId);
  if (!user) {
    res.status(401).json({ error: 'Account no longer exists.' });
    return;
  }
  req.user = user;
  next();
}

async function main() {
  await getDb();

  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '4mb' }));

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });
  const wsClients = new Map<WebSocket, { userId?: string }>();

  wss.on('connection', (ws) => {
    wsClients.set(ws, {});
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

  const broadcastToUser = (userId: string | null, event: Record<string, unknown>) => {
    const data = JSON.stringify(event);
    for (const [client, meta] of wsClients.entries()) {
      if (client.readyState !== WebSocket.OPEN) continue;
      if (!userId || meta.userId === userId) {
        client.send(data);
      }
    }
  };

  const analyzeLimiter = createRateLimiter(12, 60_000);
  const runLimiter = createRateLimiter(15, 60_000);
  const aiLimiter = createRateLimiter(25, 60_000);

  // Health
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, timestamp: new Date().toISOString() });
  });

  // Auth routes
  app.post('/api/auth/register', async (req, res) => {
    try {
      const email = sanitizeText(req.body?.email, 160).toLowerCase();
      const name = sanitizeText(req.body?.name, 100);
      const password = typeof req.body?.password === 'string' ? req.body.password : '';

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        res.status(400).json({ error: 'Please enter a valid email address.' });
        return;
      }
      if (!name || name.length < 2) {
        res.status(400).json({ error: 'Name must be at least 2 characters.' });
        return;
      }
      if (password.length < 8) {
        res.status(400).json({ error: 'Password must be at least 8 characters.' });
        return;
      }

      const existing = await findUserByEmail(email);
      if (existing) {
        res.status(409).json({ error: 'An account with this email already exists.' });
        return;
      }

      const total = await countUsers();
      const role: 'admin' | 'engineer' = total === 0 ? 'admin' : 'engineer';
      const { hash, salt } = hashPassword(password);
      const user = await createUser({
        id: crypto.randomUUID(),
        email,
        name,
        role,
        passwordHash: hash,
        passwordSalt: salt,
      });

      const token = signAuthToken({
        userId: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      });

      res.status(201).json({ user, token });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Registration failed.' });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const email = sanitizeText(req.body?.email, 160).toLowerCase();
      const password = typeof req.body?.password === 'string' ? req.body.password : '';
      if (!email || !password) {
        res.status(400).json({ error: 'Email and password are required.' });
        return;
      }

      const record = await findUserByEmail(email);
      if (!record || !verifyPassword(password, record.passwordHash, record.passwordSalt)) {
        res.status(401).json({ error: 'Invalid email or password.' });
        return;
      }

      const user: UserProfile = {
        id: record.id,
        email: record.email,
        name: record.name,
        role: record.role,
        createdAt: record.createdAt,
      };
      const token = signAuthToken({
        userId: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      });
      res.json({ user, token });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Sign-in failed.' });
    }
  });

  app.get('/api/auth/me', requireAuth, (req: AuthedRequest, res) => {
    res.json({ user: req.user });
  });

  // Website Analyzer API (authenticated so results can stream directly to user's WS session)
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
    const projects = await listProjectsForUser(req.user!.id);
    res.json({ projects });
  });

  app.post('/api/projects', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const urlRaw = sanitizeText(req.body?.url, 2048);
      const urlCheck = await validatePublicUrl(urlRaw);
      if (!urlCheck.valid || !urlCheck.url) {
        res.status(400).json({ error: urlCheck.error || 'Invalid URL' });
        return;
      }

      const framework = (req.body?.framework || 'cypress-ts') as AutomationFramework;
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
            ? generateAutomationProject({
                projectName: name,
                framework,
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
        approach,
        analysis,
        testCases,
        files,
        config,
        secretsMeta: [],
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
    if (project.userId !== req.user!.id && req.user!.role !== 'admin') {
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
    if (existing.userId !== req.user!.id && req.user!.role !== 'admin') {
      res.status(403).json({ error: 'Access denied.' });
      return;
    }

    let nextFramework = existing.framework;
    let nextTool = existing.tool;
    let nextLanguage = existing.language;
    if (req.body?.framework) {
      nextFramework = req.body.framework as AutomationFramework;
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
      tool: nextTool,
      language: nextLanguage,
      approach: req.body?.approach ?? existing.approach,
      analysis: req.body?.analysis !== undefined ? req.body.analysis : existing.analysis,
      testCases: Array.isArray(req.body?.testCases) ? req.body.testCases : existing.testCases,
      files: Array.isArray(req.body?.files) ? req.body.files : existing.files,
      config: req.body?.config ? { ...existing.config, ...req.body.config } : existing.config,
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
    if (existing.userId !== req.user!.id && req.user!.role !== 'admin') {
      res.status(403).json({ error: 'Access denied.' });
      return;
    }
    if (!existing.analysis) {
      res.status(400).json({ error: 'Analyze a website URL before generating scripts.' });
      return;
    }

    const framework = (req.body?.framework || existing.framework) as AutomationFramework;
    const approach = (req.body?.approach || existing.approach) as TestingApproach;
    const { tool, language } = deriveToolAndLanguage(framework);
    const files = generateAutomationProject({
      projectName: existing.name,
      framework,
      approach,
      analysis: existing.analysis,
      testCases: existing.testCases,
      config: existing.config,
    });

    const saved = await saveProject({
      ...existing,
      framework,
      tool,
      language,
      approach,
      files,
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
    if (existing.userId !== req.user!.id && req.user!.role !== 'admin') {
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
      res.status(403).json({ error: 'Access denied.' });
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
    if (existing.userId !== req.user!.id && req.user!.role !== 'admin') {
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
      if (project.userId !== req.user!.id && req.user!.role !== 'admin') {
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
    if (!project || (project.userId !== req.user!.id && req.user!.role !== 'admin')) {
      res.status(404).json({ error: 'Project not found.' });
      return;
    }
    const messages = await getAiConversation(project.id, req.user!.id);
    res.json({ messages });
  });

  app.post('/api/projects/:id/ai/chat', requireAuth, aiLimiter, async (req: AuthedRequest, res) => {
    try {
      const project = await getProjectById(paramStr(req.params.id));
      if (!project || (project.userId !== req.user!.id && req.user!.role !== 'admin')) {
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
      if (!project || (project.userId !== req.user!.id && req.user!.role !== 'admin')) {
        res.status(404).json({ error: 'Project not found.' });
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

  // Reports & Export
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

    const json = buildJsonReport(run, project);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="report-${run.id.slice(0, 8)}.json"`);
    res.send(json);
  });

  // Vite dev middleware or static production build
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  server.listen(port, '0.0.0.0', () => {
    console.log(`Automator AI Studio server listening on http://0.0.0.0:${port}`);
  });
}

main().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
