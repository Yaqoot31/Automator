import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js';
import type {
  AiMessage,
  AutomationFramework,
  AutomationProject,
  ProjectConfig,
  ProjectFile,
  ProjectSecretMeta,
  ProjectTeamMember,
  ProgrammingLanguage,
  SqaDefect,
  SqaRelease,
  SqaRequirement,
  SqaTestPlan,
  SqaTestSuite,
  TestCase,
  TestRunRecord,
  TestingApproach,
  TestingTool,
  UserProfile,
  UserRole,
  WebsiteAnalysisReport,
} from '../src/types/index.js';
import { decryptSecrets, encryptSecrets, maskSecretValue } from './security.js';

const require = createRequire(import.meta.url);

const BUNDLED_DATA_DIR = path.resolve(process.cwd(), 'data');
const DATA_DIR =
  process.env.VERCEL || process.env.VERCEL_ENV
    ? path.join(os.tmpdir(), 'automator-data')
    : BUNDLED_DATA_DIR;
const DB_PATH = path.join(DATA_DIR, 'automator.db');
export const SCREENSHOTS_DIR = path.join(DATA_DIR, 'screenshots');

let dbInstance: Database | null = null;
let dbInitPromise: Promise<Database> | null = null;

function ensureDirs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

function persistDb() {
  if (!dbInstance) return;
  try {
    ensureDirs();
    const data = dbInstance.export();
    const tmpPath = `${DB_PATH}.tmp`;
    fs.writeFileSync(tmpPath, Buffer.from(data));
    fs.renameSync(tmpPath, DB_PATH);
  } catch (err) {
    console.warn('[db] Non-fatal persistDb warning:', err instanceof Error ? err.message : err);
  }
}

function safeAddColumn(db: Database, sql: string) {
  try {
    db.run(sql);
  } catch {
    // Column already exists
  }
}

function resolveSqlWasmPath(): string | null {
  const candidates: string[] = [];
  try {
    candidates.push(require.resolve('sql.js/dist/sql-wasm.wasm'));
  } catch {
    // ignore
  }
  candidates.push(
    path.resolve(process.cwd(), 'node_modules/sql.js/dist/sql-wasm.wasm'),
    path.resolve(path.dirname(new URL(import.meta.url).pathname), '../node_modules/sql.js/dist/sql-wasm.wasm')
  );
  for (const p of candidates) {
    try {
      if (p && fs.existsSync(p)) return p;
    } catch {
      // continue
    }
  }
  return null;
}

async function initSqlEngine(): Promise<SqlJsStatic> {
  const wasmPath = resolveSqlWasmPath();
  if (wasmPath) {
    try {
      const wasmBytes = fs.readFileSync(wasmPath);
      const wasmBinary = wasmBytes.buffer.slice(
        wasmBytes.byteOffset,
        wasmBytes.byteOffset + wasmBytes.byteLength
      );
      return await initSqlJs({ wasmBinary });
    } catch (wasmErr) {
      console.warn('[db] wasmBinary load failed, trying locateFile:', wasmErr instanceof Error ? wasmErr.message : wasmErr);
    }
    try {
      return await initSqlJs({ locateFile: () => wasmPath });
    } catch (locErr) {
      console.warn('[db] locateFile initSqlJs failed, falling back to asm.js:', locErr instanceof Error ? locErr.message : locErr);
    }
  } else {
    try {
      return await initSqlJs();
    } catch (defaultErr) {
      console.warn('[db] default initSqlJs failed, falling back to asm.js:', defaultErr instanceof Error ? defaultErr.message : defaultErr);
    }
  }

  // Pure JS asm fallback so serverless initialization never fails even if WASM cannot be loaded
  const asmInit = require('sql.js/dist/sql-asm.js') as () => Promise<SqlJsStatic>;
  return asmInit();
}

function openDatabaseBuffer(SQL: SqlJsStatic, filePath: string): Database | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    const fileBuf = fs.readFileSync(filePath);
    if (!fileBuf || fileBuf.length === 0) return null;
    return new SQL.Database(fileBuf);
  } catch (err) {
    console.warn(`[db] Failed to open ${filePath}:`, err instanceof Error ? err.message : err);
    return null;
  }
}

export async function getDb(): Promise<Database> {
  if (dbInstance) return dbInstance;
  if (dbInitPromise) return dbInitPromise;

  dbInitPromise = (async () => {
    ensureDirs();
    const SQL = await initSqlEngine();
    const bundledDbPath = path.join(BUNDLED_DATA_DIR, 'automator.db');

    let instance = openDatabaseBuffer(SQL, DB_PATH);
    if (!instance && DATA_DIR !== BUNDLED_DATA_DIR) {
      instance = openDatabaseBuffer(SQL, bundledDbPath);
    }
    if (!instance) {
      instance = new SQL.Database();
    }
    dbInstance = instance;

  dbInstance.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'sqa_engineer',
      email_verified INTEGER NOT NULL DEFAULT 0,
      job_title TEXT NOT NULL DEFAULT '',
      organization TEXT NOT NULL DEFAULT '',
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS auth_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      purpose TEXT NOT NULL,
      token_hash TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS revoked_tokens (
      jti TEXT PRIMARY KEY,
      expires_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      url TEXT NOT NULL,
      tool TEXT NOT NULL,
      language TEXT NOT NULL,
      framework TEXT NOT NULL,
      selected_frameworks_json TEXT NOT NULL DEFAULT '[]',
      approach TEXT NOT NULL DEFAULT 'pom',
      analysis_json TEXT,
      test_cases_json TEXT NOT NULL DEFAULT '[]',
      files_json TEXT NOT NULL DEFAULT '[]',
      config_json TEXT NOT NULL,
      secrets_enc TEXT NOT NULL DEFAULT '',
      team_members_json TEXT NOT NULL DEFAULT '[]',
      google_sheet_id TEXT NOT NULL DEFAULT '',
      google_sheet_url TEXT NOT NULL DEFAULT '',
      google_sheet_title TEXT NOT NULL DEFAULT '',
      google_sheet_last_sync TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS test_runs (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      project_name TEXT NOT NULL,
      browser TEXT NOT NULL,
      viewport TEXT NOT NULL,
      headless INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL,
      total_tests INTEGER NOT NULL DEFAULT 0,
      passed INTEGER NOT NULL DEFAULT 0,
      failed INTEGER NOT NULL DEFAULT 0,
      skipped INTEGER NOT NULL DEFAULT 0,
      duration_ms INTEGER NOT NULL DEFAULT 0,
      results_json TEXT NOT NULL DEFAULT '[]',
      logs_json TEXT NOT NULL DEFAULT '[]',
      started_at TEXT NOT NULL,
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS ai_conversations (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      messages_json TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sqa_plans (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      strategy TEXT NOT NULL DEFAULT '',
      scope TEXT NOT NULL DEFAULT '',
      objectives TEXT NOT NULL DEFAULT '',
      resources TEXT NOT NULL DEFAULT '',
      schedule_start TEXT NOT NULL DEFAULT '',
      schedule_end TEXT NOT NULL DEFAULT '',
      release_target TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'Draft',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sqa_suites (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      suite_type TEXT NOT NULL DEFAULT 'Regression',
      description TEXT NOT NULL DEFAULT '',
      test_case_ids_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sqa_defects (
      id TEXT PRIMARY KEY,
      bug_code TEXT NOT NULL,
      project_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      steps_to_reproduce TEXT NOT NULL DEFAULT '',
      expected_result TEXT NOT NULL DEFAULT '',
      actual_result TEXT NOT NULL DEFAULT '',
      severity TEXT NOT NULL DEFAULT 'Major',
      priority TEXT NOT NULL DEFAULT 'High',
      assigned_developer TEXT NOT NULL DEFAULT '',
      reported_by TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'New',
      linked_test_case_id TEXT NOT NULL DEFAULT '',
      linked_requirement_id TEXT NOT NULL DEFAULT '',
      screenshot_url TEXT NOT NULL DEFAULT '',
      attachment_name TEXT NOT NULL DEFAULT '',
      resolution_notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sqa_requirements (
      id TEXT PRIMARY KEY,
      req_code TEXT NOT NULL,
      project_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'Functional',
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      module TEXT NOT NULL DEFAULT '',
      priority TEXT NOT NULL DEFAULT 'High',
      linked_test_case_ids_json TEXT NOT NULL DEFAULT '[]',
      linked_defect_ids_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sqa_releases (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      version TEXT NOT NULL,
      name TEXT NOT NULL,
      build_number TEXT NOT NULL DEFAULT '',
      environment TEXT NOT NULL DEFAULT 'staging',
      target_date TEXT NOT NULL DEFAULT '',
      build_verified INTEGER NOT NULL DEFAULT 0,
      readiness_status TEXT NOT NULL DEFAULT 'Pending',
      approval_status TEXT NOT NULL DEFAULT 'Pending',
      approved_by TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // Backward-compatible migrations for existing databases
  safeAddColumn(dbInstance, 'ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0');
  safeAddColumn(dbInstance, "ALTER TABLE users ADD COLUMN job_title TEXT NOT NULL DEFAULT ''");
  safeAddColumn(dbInstance, "ALTER TABLE users ADD COLUMN organization TEXT NOT NULL DEFAULT ''");
  safeAddColumn(dbInstance, "ALTER TABLE projects ADD COLUMN selected_frameworks_json TEXT NOT NULL DEFAULT '[]'");
  safeAddColumn(dbInstance, "ALTER TABLE projects ADD COLUMN team_members_json TEXT NOT NULL DEFAULT '[]'");
  safeAddColumn(dbInstance, "ALTER TABLE projects ADD COLUMN google_sheet_id TEXT NOT NULL DEFAULT ''");
  safeAddColumn(dbInstance, "ALTER TABLE projects ADD COLUMN google_sheet_url TEXT NOT NULL DEFAULT ''");
  safeAddColumn(dbInstance, "ALTER TABLE projects ADD COLUMN google_sheet_title TEXT NOT NULL DEFAULT ''");
  safeAddColumn(dbInstance, "ALTER TABLE projects ADD COLUMN google_sheet_last_sync TEXT NOT NULL DEFAULT ''");

  persistDb();
  return dbInstance;
  })().catch((err) => {
    dbInitPromise = null;
    dbInstance = null;
    throw err;
  });

  return dbInitPromise;
}

function queryAll<T = Record<string, unknown>>(
  db: Database,
  sql: string,
  params: (string | number | null)[] = []
): T[] {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows: T[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return rows;
}

function queryOne<T = Record<string, unknown>>(
  db: Database,
  sql: string,
  params: (string | number | null)[] = []
): T | null {
  const rows = queryAll<T>(db, sql, params);
  return rows[0] ?? null;
}

export async function countUsers(): Promise<number> {
  const db = await getDb();
  const row = queryOne<{ cnt: number }>(db, 'SELECT COUNT(*) as cnt FROM users');
  return Number(row?.cnt || 0);
}

export async function findUserByEmail(email: string): Promise<{
  id: string;
  email: string;
  name: string;
  role: UserRole;
  emailVerified: boolean;
  jobTitle: string;
  organization: string;
  passwordHash: string;
  passwordSalt: string;
  createdAt: string;
} | null> {
  const db = await getDb();
  const row = queryOne<{
    id: string;
    email: string;
    name: string;
    role: string;
    email_verified: number;
    job_title: string;
    organization: string;
    password_hash: string;
    password_salt: string;
    created_at: string;
  }>(db, 'SELECT * FROM users WHERE lower(email) = lower(?)', [email]);
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: (row.role as UserRole) || 'sqa_engineer',
    emailVerified: Boolean(row.email_verified),
    jobTitle: row.job_title || '',
    organization: row.organization || '',
    passwordHash: row.password_hash,
    passwordSalt: row.password_salt,
    createdAt: row.created_at,
  };
}

export async function findUserById(id: string): Promise<UserProfile | null> {
  const db = await getDb();
  const row = queryOne<{
    id: string;
    email: string;
    name: string;
    role: string;
    email_verified: number;
    job_title: string;
    organization: string;
    created_at: string;
  }>(
    db,
    'SELECT id, email, name, role, email_verified, job_title, organization, created_at FROM users WHERE id = ?',
    [id]
  );
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: (row.role as UserRole) || 'sqa_engineer',
    emailVerified: Boolean(row.email_verified),
    jobTitle: row.job_title || '',
    organization: row.organization || '',
    createdAt: row.created_at,
  };
}

export async function createUser(input: {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  passwordHash: string;
  passwordSalt: string;
}): Promise<UserProfile> {
  const db = await getDb();
  const createdAt = new Date().toISOString();
  db.run(
    `INSERT INTO users (id, email, name, role, email_verified, job_title, organization, password_hash, password_salt, created_at)
     VALUES (?, ?, ?, ?, 0, '', '', ?, ?, ?)`,
    [input.id, input.email, input.name, input.role, input.passwordHash, input.passwordSalt, createdAt]
  );
  persistDb();
  return {
    id: input.id,
    email: input.email,
    name: input.name,
    role: input.role,
    emailVerified: false,
    jobTitle: '',
    organization: '',
    createdAt,
  };
}

export async function updateUserProfile(
  userId: string,
  patch: { name?: string; role?: UserRole; jobTitle?: string; organization?: string }
): Promise<UserProfile | null> {
  const db = await getDb();
  const current = await findUserById(userId);
  if (!current) return null;
  db.run(
    `UPDATE users SET name = ?, role = ?, job_title = ?, organization = ? WHERE id = ?`,
    [
      patch.name ?? current.name,
      patch.role ?? current.role,
      patch.jobTitle ?? current.jobTitle ?? '',
      patch.organization ?? current.organization ?? '',
      userId,
    ]
  );
  persistDb();
  return findUserById(userId);
}

export async function markUserEmailVerified(userId: string): Promise<UserProfile | null> {
  const db = await getDb();
  db.run('UPDATE users SET email_verified = 1 WHERE id = ?', [userId]);
  persistDb();
  return findUserById(userId);
}

export async function updateUserPassword(
  userId: string,
  passwordHash: string,
  passwordSalt: string
): Promise<void> {
  const db = await getDb();
  db.run('UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?', [
    passwordHash,
    passwordSalt,
    userId,
  ]);
  persistDb();
}

export async function createAuthOneTimeToken(input: {
  id: string;
  userId: string;
  purpose: 'email_verify' | 'password_reset';
  tokenHash: string;
  expiresAt: number;
}): Promise<void> {
  const db = await getDb();
  db.run('DELETE FROM auth_tokens WHERE user_id = ? AND purpose = ? AND used_at IS NULL', [
    input.userId,
    input.purpose,
  ]);
  db.run(
    `INSERT INTO auth_tokens (id, user_id, purpose, token_hash, expires_at, used_at, created_at)
     VALUES (?, ?, ?, ?, ?, NULL, ?)`,
    [input.id, input.userId, input.purpose, input.tokenHash, input.expiresAt, new Date().toISOString()]
  );
  persistDb();
}

export async function consumeAuthOneTimeToken(
  userId: string,
  purpose: 'email_verify' | 'password_reset',
  tokenHash: string
): Promise<boolean> {
  const db = await getDb();
  const row = queryOne<{ id: string; expires_at: number }>(
    db,
    `SELECT id, expires_at FROM auth_tokens
     WHERE user_id = ? AND purpose = ? AND token_hash = ? AND used_at IS NULL`,
    [userId, purpose, tokenHash]
  );
  if (!row || row.expires_at < Date.now()) {
    return false;
  }
  db.run('UPDATE auth_tokens SET used_at = ? WHERE id = ?', [new Date().toISOString(), row.id]);
  persistDb();
  return true;
}

export async function revokeSessionToken(jti: string, expiresAt: number): Promise<void> {
  const db = await getDb();
  db.run('DELETE FROM revoked_tokens WHERE expires_at < ?', [Date.now()]);
  db.run('INSERT OR REPLACE INTO revoked_tokens (jti, expires_at) VALUES (?, ?)', [jti, expiresAt]);
  persistDb();
}

export async function isTokenRevoked(jti: string): Promise<boolean> {
  const db = await getDb();
  const row = queryOne<{ jti: string }>(db, 'SELECT jti FROM revoked_tokens WHERE jti = ?', [jti]);
  return Boolean(row);
}

function safeJsonParse<T>(raw: unknown, fallback: T): T {
  try {
    if (typeof raw !== 'string' || !raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function rowToProject(row: Record<string, unknown>): AutomationProject {
  const secretsRaw = typeof row.secrets_enc === 'string' ? row.secrets_enc : '';
  const decrypted = decryptSecrets(secretsRaw);
  const secretsMeta: ProjectSecretMeta[] = Object.entries(decrypted).map(([key, value]) => ({
    key,
    maskedValue: maskSecretValue(value),
    updatedAt: String(row.updated_at),
  }));

  const framework = row.framework as AutomationFramework;
  const parsedSelected = safeJsonParse<AutomationFramework[]>(row.selected_frameworks_json, []);

  return {
    id: String(row.id),
    userId: String(row.user_id),
    name: String(row.name),
    description: String(row.description || ''),
    url: String(row.url),
    tool: row.tool as TestingTool,
    language: row.language as ProgrammingLanguage,
    framework,
    selectedFrameworks: parsedSelected.length > 0 ? parsedSelected : [framework],
    approach: (row.approach as TestingApproach) || 'pom',
    analysis: row.analysis_json
      ? safeJsonParse<WebsiteAnalysisReport | null>(row.analysis_json, null)
      : null,
    testCases: safeJsonParse<TestCase[]>(row.test_cases_json, []),
    files: safeJsonParse<ProjectFile[]>(row.files_json, []),
    config: safeJsonParse<ProjectConfig>(row.config_json, {
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
      baseUrl: String(row.url),
      captureScreenshots: true,
      recordVideo: false,
      customTestData: {},
    }),
    secretsMeta,
    teamMembers: safeJsonParse<ProjectTeamMember[]>(row.team_members_json, []),
    googleSheetId: String(row.google_sheet_id || '') || undefined,
    googleSheetUrl: String(row.google_sheet_url || '') || undefined,
    googleSheetTitle: String(row.google_sheet_title || '') || undefined,
    googleSheetLastSync: String(row.google_sheet_last_sync || '') || undefined,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export async function listProjectsForUser(
  userId: string,
  userEmail?: string,
  userRole?: UserRole
): Promise<AutomationProject[]> {
  const db = await getDb();
  if (userRole === 'admin') {
    const rows = queryAll(db, 'SELECT * FROM projects ORDER BY updated_at DESC');
    return rows.map(rowToProject);
  }
  const rows = queryAll(db, 'SELECT * FROM projects ORDER BY updated_at DESC');
  const all = rows.map(rowToProject);
  const lowerEmail = (userEmail || '').toLowerCase();
  return all.filter(
    (p) =>
      p.userId === userId ||
      (lowerEmail && (p.teamMembers || []).some((m) => m.email.toLowerCase() === lowerEmail))
  );
}

export function canAccessProject(
  project: AutomationProject,
  user: UserProfile,
  requireWrite = false
): boolean {
  if (user.role === 'admin' || project.userId === user.id) return true;
  const member = (project.teamMembers || []).find(
    (m) => m.email.toLowerCase() === user.email.toLowerCase()
  );
  if (!member) return false;
  if (requireWrite && member.role === 'viewer') return false;
  return true;
}

export async function getProjectById(id: string): Promise<AutomationProject | null> {
  const db = await getDb();
  const row = queryOne(db, 'SELECT * FROM projects WHERE id = ?', [id]);
  if (!row) return null;
  return rowToProject(row);
}

export async function getProjectDecryptedSecrets(id: string): Promise<Record<string, string>> {
  const db = await getDb();
  const row = queryOne<{ secrets_enc: string }>(
    db,
    'SELECT secrets_enc FROM projects WHERE id = ?',
    [id]
  );
  if (!row) return {};
  return decryptSecrets(row.secrets_enc || '');
}

export async function saveProject(
  project: AutomationProject,
  plainSecrets?: Record<string, string>
): Promise<AutomationProject> {
  const db = await getDb();
  const existing = queryOne<{ id: string; secrets_enc: string }>(
    db,
    'SELECT id, secrets_enc FROM projects WHERE id = ?',
    [project.id]
  );

  const secretsEnc =
    plainSecrets !== undefined
      ? encryptSecrets(plainSecrets)
      : existing?.secrets_enc || '';

  const selectedFwJson = JSON.stringify(
    project.selectedFrameworks && project.selectedFrameworks.length > 0
      ? project.selectedFrameworks
      : [project.framework]
  );
  const teamMembersJson = JSON.stringify(project.teamMembers || []);

  if (existing) {
    db.run(
      `UPDATE projects SET
        name = ?, description = ?, url = ?, tool = ?, language = ?, framework = ?,
        selected_frameworks_json = ?, approach = ?, analysis_json = ?, test_cases_json = ?,
        files_json = ?, config_json = ?, secrets_enc = ?, team_members_json = ?,
        google_sheet_id = ?, google_sheet_url = ?, google_sheet_title = ?, google_sheet_last_sync = ?,
        updated_at = ?
      WHERE id = ?`,
      [
        project.name,
        project.description,
        project.url,
        project.tool,
        project.language,
        project.framework,
        selectedFwJson,
        project.approach,
        project.analysis ? JSON.stringify(project.analysis) : null,
        JSON.stringify(project.testCases),
        JSON.stringify(project.files),
        JSON.stringify(project.config),
        secretsEnc,
        teamMembersJson,
        project.googleSheetId || '',
        project.googleSheetUrl || '',
        project.googleSheetTitle || '',
        project.googleSheetLastSync || '',
        project.updatedAt,
        project.id,
      ]
    );
  } else {
    db.run(
      `INSERT INTO projects (
        id, user_id, name, description, url, tool, language, framework, selected_frameworks_json,
        approach, analysis_json, test_cases_json, files_json, config_json, secrets_enc,
        team_members_json, google_sheet_id, google_sheet_url, google_sheet_title, google_sheet_last_sync,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        project.id,
        project.userId,
        project.name,
        project.description,
        project.url,
        project.tool,
        project.language,
        project.framework,
        selectedFwJson,
        project.approach,
        project.analysis ? JSON.stringify(project.analysis) : null,
        JSON.stringify(project.testCases),
        JSON.stringify(project.files),
        JSON.stringify(project.config),
        secretsEnc,
        teamMembersJson,
        project.googleSheetId || '',
        project.googleSheetUrl || '',
        project.googleSheetTitle || '',
        project.googleSheetLastSync || '',
        project.createdAt,
        project.updatedAt,
      ]
    );
  }
  persistDb();
  const saved = await getProjectById(project.id);
  return saved!;
}

export async function deleteProject(id: string): Promise<void> {
  const db = await getDb();
  db.run('DELETE FROM projects WHERE id = ?', [id]);
  db.run('DELETE FROM test_runs WHERE project_id = ?', [id]);
  db.run('DELETE FROM ai_conversations WHERE project_id = ?', [id]);
  db.run('DELETE FROM sqa_plans WHERE project_id = ?', [id]);
  db.run('DELETE FROM sqa_suites WHERE project_id = ?', [id]);
  db.run('DELETE FROM sqa_defects WHERE project_id = ?', [id]);
  db.run('DELETE FROM sqa_requirements WHERE project_id = ?', [id]);
  db.run('DELETE FROM sqa_releases WHERE project_id = ?', [id]);
  persistDb();
}

function rowToTestRun(row: Record<string, unknown>): TestRunRecord {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    userId: String(row.user_id),
    projectName: String(row.project_name),
    browser: row.browser as TestRunRecord['browser'],
    viewport: String(row.viewport),
    headless: Boolean(row.headless),
    status: row.status as TestRunRecord['status'],
    totalTests: Number(row.total_tests || 0),
    passed: Number(row.passed || 0),
    failed: Number(row.failed || 0),
    skipped: Number(row.skipped || 0),
    durationMs: Number(row.duration_ms || 0),
    results: safeJsonParse(row.results_json, []),
    logs: safeJsonParse(row.logs_json, []),
    startedAt: String(row.started_at),
    completedAt: row.completed_at ? String(row.completed_at) : undefined,
  };
}

export async function saveTestRun(run: TestRunRecord): Promise<void> {
  const db = await getDb();
  const existing = queryOne<{ id: string }>(db, 'SELECT id FROM test_runs WHERE id = ?', [run.id]);
  if (existing) {
    db.run(
      `UPDATE test_runs SET
        status = ?, total_tests = ?, passed = ?, failed = ?, skipped = ?,
        duration_ms = ?, results_json = ?, logs_json = ?, completed_at = ?
      WHERE id = ?`,
      [
        run.status,
        run.totalTests,
        run.passed,
        run.failed,
        run.skipped,
        run.durationMs,
        JSON.stringify(run.results),
        JSON.stringify(run.logs),
        run.completedAt ?? null,
        run.id,
      ]
    );
  } else {
    db.run(
      `INSERT INTO test_runs (
        id, project_id, user_id, project_name, browser, viewport, headless, status,
        total_tests, passed, failed, skipped, duration_ms, results_json, logs_json,
        started_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        run.id,
        run.projectId,
        run.userId,
        run.projectName,
        run.browser,
        run.viewport,
        run.headless ? 1 : 0,
        run.status,
        run.totalTests,
        run.passed,
        run.failed,
        run.skipped,
        run.durationMs,
        JSON.stringify(run.results),
        JSON.stringify(run.logs),
        run.startedAt,
        run.completedAt ?? null,
      ]
    );
  }
  persistDb();
}

export async function listTestRuns(userId: string, projectId?: string): Promise<TestRunRecord[]> {
  const db = await getDb();
  const rows = projectId
    ? queryAll(
        db,
        'SELECT * FROM test_runs WHERE user_id = ? AND project_id = ? ORDER BY started_at DESC LIMIT 80',
        [userId, projectId]
      )
    : queryAll(
        db,
        'SELECT * FROM test_runs WHERE user_id = ? ORDER BY started_at DESC LIMIT 80',
        [userId]
      );
  return rows.map(rowToTestRun);
}

export async function getTestRunById(runId: string): Promise<TestRunRecord | null> {
  const db = await getDb();
  const row = queryOne(db, 'SELECT * FROM test_runs WHERE id = ?', [runId]);
  if (!row) return null;
  return rowToTestRun(row);
}

export async function getAiConversation(projectId: string, userId: string): Promise<AiMessage[]> {
  const db = await getDb();
  const row = queryOne<{ messages_json: string }>(
    db,
    'SELECT messages_json FROM ai_conversations WHERE project_id = ? AND user_id = ?',
    [projectId, userId]
  );
  if (!row) return [];
  return safeJsonParse<AiMessage[]>(row.messages_json, []);
}

export async function saveAiConversation(
  projectId: string,
  userId: string,
  messages: AiMessage[]
): Promise<void> {
  const db = await getDb();
  const id = `${userId}:${projectId}`;
  const updatedAt = new Date().toISOString();
  const existing = queryOne<{ id: string }>(db, 'SELECT id FROM ai_conversations WHERE id = ?', [id]);
  if (existing) {
    db.run(
      'UPDATE ai_conversations SET messages_json = ?, updated_at = ? WHERE id = ?',
      [JSON.stringify(messages.slice(-40)), updatedAt, id]
    );
  } else {
    db.run(
      'INSERT INTO ai_conversations (id, project_id, user_id, messages_json, updated_at) VALUES (?, ?, ?, ?, ?)',
      [id, projectId, userId, JSON.stringify(messages.slice(-40)), updatedAt]
    );
  }
  persistDb();
}

// ---------- SQA Management CRUD ----------

export async function listSqaPlans(userId: string, projectId?: string): Promise<SqaTestPlan[]> {
  const db = await getDb();
  const rows = projectId
    ? queryAll(db, 'SELECT * FROM sqa_plans WHERE user_id = ? AND project_id = ? ORDER BY updated_at DESC', [
        userId,
        projectId,
      ])
    : queryAll(db, 'SELECT * FROM sqa_plans WHERE user_id = ? ORDER BY updated_at DESC', [userId]);
  return rows.map((r) => ({
    id: String(r.id),
    projectId: String(r.project_id),
    userId: String(r.user_id),
    title: String(r.title),
    strategy: String(r.strategy || ''),
    scope: String(r.scope || ''),
    objectives: String(r.objectives || ''),
    resources: String(r.resources || ''),
    scheduleStart: String(r.schedule_start || ''),
    scheduleEnd: String(r.schedule_end || ''),
    releaseTarget: String(r.release_target || ''),
    status: (r.status as SqaTestPlan['status']) || 'Draft',
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  }));
}

export async function saveSqaPlan(plan: SqaTestPlan): Promise<SqaTestPlan> {
  const db = await getDb();
  const existing = queryOne<{ id: string }>(db, 'SELECT id FROM sqa_plans WHERE id = ?', [plan.id]);
  if (existing) {
    db.run(
      `UPDATE sqa_plans SET title = ?, strategy = ?, scope = ?, objectives = ?, resources = ?,
       schedule_start = ?, schedule_end = ?, release_target = ?, status = ?, updated_at = ? WHERE id = ?`,
      [
        plan.title,
        plan.strategy,
        plan.scope,
        plan.objectives,
        plan.resources,
        plan.scheduleStart,
        plan.scheduleEnd,
        plan.releaseTarget,
        plan.status,
        plan.updatedAt,
        plan.id,
      ]
    );
  } else {
    db.run(
      `INSERT INTO sqa_plans (id, project_id, user_id, title, strategy, scope, objectives, resources,
       schedule_start, schedule_end, release_target, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        plan.id,
        plan.projectId,
        plan.userId,
        plan.title,
        plan.strategy,
        plan.scope,
        plan.objectives,
        plan.resources,
        plan.scheduleStart,
        plan.scheduleEnd,
        plan.releaseTarget,
        plan.status,
        plan.createdAt,
        plan.updatedAt,
      ]
    );
  }
  persistDb();
  return plan;
}

export async function deleteSqaPlan(id: string, userId: string): Promise<void> {
  const db = await getDb();
  db.run('DELETE FROM sqa_plans WHERE id = ? AND user_id = ?', [id, userId]);
  persistDb();
}

export async function listSqaSuites(userId: string, projectId?: string): Promise<SqaTestSuite[]> {
  const db = await getDb();
  const rows = projectId
    ? queryAll(db, 'SELECT * FROM sqa_suites WHERE user_id = ? AND project_id = ? ORDER BY updated_at DESC', [
        userId,
        projectId,
      ])
    : queryAll(db, 'SELECT * FROM sqa_suites WHERE user_id = ? ORDER BY updated_at DESC', [userId]);
  return rows.map((r) => ({
    id: String(r.id),
    projectId: String(r.project_id),
    userId: String(r.user_id),
    name: String(r.name),
    suiteType: (r.suite_type as SqaTestSuite['suiteType']) || 'Regression',
    description: String(r.description || ''),
    testCaseIds: safeJsonParse<string[]>(r.test_case_ids_json, []),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  }));
}

export async function saveSqaSuite(suite: SqaTestSuite): Promise<SqaTestSuite> {
  const db = await getDb();
  const existing = queryOne<{ id: string }>(db, 'SELECT id FROM sqa_suites WHERE id = ?', [suite.id]);
  if (existing) {
    db.run(
      `UPDATE sqa_suites SET name = ?, suite_type = ?, description = ?, test_case_ids_json = ?, updated_at = ? WHERE id = ?`,
      [suite.name, suite.suiteType, suite.description, JSON.stringify(suite.testCaseIds), suite.updatedAt, suite.id]
    );
  } else {
    db.run(
      `INSERT INTO sqa_suites (id, project_id, user_id, name, suite_type, description, test_case_ids_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        suite.id,
        suite.projectId,
        suite.userId,
        suite.name,
        suite.suiteType,
        suite.description,
        JSON.stringify(suite.testCaseIds),
        suite.createdAt,
        suite.updatedAt,
      ]
    );
  }
  persistDb();
  return suite;
}

export async function deleteSqaSuite(id: string, userId: string): Promise<void> {
  const db = await getDb();
  db.run('DELETE FROM sqa_suites WHERE id = ? AND user_id = ?', [id, userId]);
  persistDb();
}

export async function listSqaDefects(userId: string, projectId?: string): Promise<SqaDefect[]> {
  const db = await getDb();
  const rows = projectId
    ? queryAll(db, 'SELECT * FROM sqa_defects WHERE user_id = ? AND project_id = ? ORDER BY updated_at DESC', [
        userId,
        projectId,
      ])
    : queryAll(db, 'SELECT * FROM sqa_defects WHERE user_id = ? ORDER BY updated_at DESC', [userId]);
  return rows.map((r) => ({
    id: String(r.id),
    bugCode: String(r.bug_code),
    projectId: String(r.project_id),
    userId: String(r.user_id),
    title: String(r.title),
    description: String(r.description || ''),
    stepsToReproduce: String(r.steps_to_reproduce || ''),
    expectedResult: String(r.expected_result || ''),
    actualResult: String(r.actual_result || ''),
    severity: (r.severity as SqaDefect['severity']) || 'Major',
    priority: (r.priority as SqaDefect['priority']) || 'High',
    assignedDeveloper: String(r.assigned_developer || ''),
    reportedBy: String(r.reported_by || ''),
    status: (r.status as SqaDefect['status']) || 'New',
    linkedTestCaseId: String(r.linked_test_case_id || '') || undefined,
    linkedRequirementId: String(r.linked_requirement_id || '') || undefined,
    screenshotUrl: String(r.screenshot_url || '') || undefined,
    attachmentName: String(r.attachment_name || '') || undefined,
    resolutionNotes: String(r.resolution_notes || '') || undefined,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  }));
}

export async function saveSqaDefect(defect: SqaDefect): Promise<SqaDefect> {
  const db = await getDb();
  const existing = queryOne<{ id: string }>(db, 'SELECT id FROM sqa_defects WHERE id = ?', [defect.id]);
  if (existing) {
    db.run(
      `UPDATE sqa_defects SET title = ?, description = ?, steps_to_reproduce = ?, expected_result = ?,
       actual_result = ?, severity = ?, priority = ?, assigned_developer = ?, reported_by = ?,
       status = ?, linked_test_case_id = ?, linked_requirement_id = ?, screenshot_url = ?,
       attachment_name = ?, resolution_notes = ?, updated_at = ? WHERE id = ?`,
      [
        defect.title,
        defect.description,
        defect.stepsToReproduce,
        defect.expectedResult,
        defect.actualResult,
        defect.severity,
        defect.priority,
        defect.assignedDeveloper,
        defect.reportedBy,
        defect.status,
        defect.linkedTestCaseId || '',
        defect.linkedRequirementId || '',
        defect.screenshotUrl || '',
        defect.attachmentName || '',
        defect.resolutionNotes || '',
        defect.updatedAt,
        defect.id,
      ]
    );
  } else {
    db.run(
      `INSERT INTO sqa_defects (id, bug_code, project_id, user_id, title, description, steps_to_reproduce,
       expected_result, actual_result, severity, priority, assigned_developer, reported_by, status,
       linked_test_case_id, linked_requirement_id, screenshot_url, attachment_name, resolution_notes,
       created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        defect.id,
        defect.bugCode,
        defect.projectId,
        defect.userId,
        defect.title,
        defect.description,
        defect.stepsToReproduce,
        defect.expectedResult,
        defect.actualResult,
        defect.severity,
        defect.priority,
        defect.assignedDeveloper,
        defect.reportedBy,
        defect.status,
        defect.linkedTestCaseId || '',
        defect.linkedRequirementId || '',
        defect.screenshotUrl || '',
        defect.attachmentName || '',
        defect.resolutionNotes || '',
        defect.createdAt,
        defect.updatedAt,
      ]
    );
  }
  persistDb();
  return defect;
}

export async function deleteSqaDefect(id: string, userId: string): Promise<void> {
  const db = await getDb();
  db.run('DELETE FROM sqa_defects WHERE id = ? AND user_id = ?', [id, userId]);
  persistDb();
}

export async function listSqaRequirements(
  userId: string,
  projectId?: string
): Promise<SqaRequirement[]> {
  const db = await getDb();
  const rows = projectId
    ? queryAll(
        db,
        'SELECT * FROM sqa_requirements WHERE user_id = ? AND project_id = ? ORDER BY updated_at DESC',
        [userId, projectId]
      )
    : queryAll(db, 'SELECT * FROM sqa_requirements WHERE user_id = ? ORDER BY updated_at DESC', [
        userId,
      ]);
  return rows.map((r) => ({
    id: String(r.id),
    reqCode: String(r.req_code),
    projectId: String(r.project_id),
    userId: String(r.user_id),
    type: (r.type as SqaRequirement['type']) || 'Functional',
    title: String(r.title),
    description: String(r.description || ''),
    module: String(r.module || ''),
    priority: (r.priority as SqaRequirement['priority']) || 'High',
    linkedTestCaseIds: safeJsonParse<string[]>(r.linked_test_case_ids_json, []),
    linkedDefectIds: safeJsonParse<string[]>(r.linked_defect_ids_json, []),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  }));
}

export async function saveSqaRequirement(reqItem: SqaRequirement): Promise<SqaRequirement> {
  const db = await getDb();
  const existing = queryOne<{ id: string }>(db, 'SELECT id FROM sqa_requirements WHERE id = ?', [
    reqItem.id,
  ]);
  if (existing) {
    db.run(
      `UPDATE sqa_requirements SET type = ?, title = ?, description = ?, module = ?, priority = ?,
       linked_test_case_ids_json = ?, linked_defect_ids_json = ?, updated_at = ? WHERE id = ?`,
      [
        reqItem.type,
        reqItem.title,
        reqItem.description,
        reqItem.module,
        reqItem.priority,
        JSON.stringify(reqItem.linkedTestCaseIds),
        JSON.stringify(reqItem.linkedDefectIds),
        reqItem.updatedAt,
        reqItem.id,
      ]
    );
  } else {
    db.run(
      `INSERT INTO sqa_requirements (id, req_code, project_id, user_id, type, title, description, module,
       priority, linked_test_case_ids_json, linked_defect_ids_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        reqItem.id,
        reqItem.reqCode,
        reqItem.projectId,
        reqItem.userId,
        reqItem.type,
        reqItem.title,
        reqItem.description,
        reqItem.module,
        reqItem.priority,
        JSON.stringify(reqItem.linkedTestCaseIds),
        JSON.stringify(reqItem.linkedDefectIds),
        reqItem.createdAt,
        reqItem.updatedAt,
      ]
    );
  }
  persistDb();
  return reqItem;
}

export async function deleteSqaRequirement(id: string, userId: string): Promise<void> {
  const db = await getDb();
  db.run('DELETE FROM sqa_requirements WHERE id = ? AND user_id = ?', [id, userId]);
  persistDb();
}

export async function listSqaReleases(userId: string, projectId?: string): Promise<SqaRelease[]> {
  const db = await getDb();
  const rows = projectId
    ? queryAll(
        db,
        'SELECT * FROM sqa_releases WHERE user_id = ? AND project_id = ? ORDER BY updated_at DESC',
        [userId, projectId]
      )
    : queryAll(db, 'SELECT * FROM sqa_releases WHERE user_id = ? ORDER BY updated_at DESC', [
        userId,
      ]);
  return rows.map((r) => ({
    id: String(r.id),
    projectId: String(r.project_id),
    userId: String(r.user_id),
    version: String(r.version),
    name: String(r.name),
    buildNumber: String(r.build_number || ''),
    environment: (r.environment as SqaRelease['environment']) || 'staging',
    targetDate: String(r.target_date || ''),
    buildVerified: Boolean(r.build_verified),
    readinessStatus: (r.readiness_status as SqaRelease['readinessStatus']) || 'Pending',
    approvalStatus: (r.approval_status as SqaRelease['approvalStatus']) || 'Pending',
    approvedBy: String(r.approved_by || '') || undefined,
    notes: String(r.notes || ''),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  }));
}

export async function saveSqaRelease(release: SqaRelease): Promise<SqaRelease> {
  const db = await getDb();
  const existing = queryOne<{ id: string }>(db, 'SELECT id FROM sqa_releases WHERE id = ?', [
    release.id,
  ]);
  if (existing) {
    db.run(
      `UPDATE sqa_releases SET version = ?, name = ?, build_number = ?, environment = ?, target_date = ?,
       build_verified = ?, readiness_status = ?, approval_status = ?, approved_by = ?, notes = ?, updated_at = ? WHERE id = ?`,
      [
        release.version,
        release.name,
        release.buildNumber,
        release.environment,
        release.targetDate,
        release.buildVerified ? 1 : 0,
        release.readinessStatus,
        release.approvalStatus,
        release.approvedBy || '',
        release.notes,
        release.updatedAt,
        release.id,
      ]
    );
  } else {
    db.run(
      `INSERT INTO sqa_releases (id, project_id, user_id, version, name, build_number, environment, target_date,
       build_verified, readiness_status, approval_status, approved_by, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        release.id,
        release.projectId,
        release.userId,
        release.version,
        release.name,
        release.buildNumber,
        release.environment,
        release.targetDate,
        release.buildVerified ? 1 : 0,
        release.readinessStatus,
        release.approvalStatus,
        release.approvedBy || '',
        release.notes,
        release.createdAt,
        release.updatedAt,
      ]
    );
  }
  persistDb();
  return release;
}

export async function deleteSqaRelease(id: string, userId: string): Promise<void> {
  const db = await getDb();
  db.run('DELETE FROM sqa_releases WHERE id = ? AND user_id = ?', [id, userId]);
  persistDb();
}
