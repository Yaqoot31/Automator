import fs from 'node:fs';
import path from 'node:path';
import initSqlJs, { type Database } from 'sql.js';
import type {
  AiMessage,
  AutomationFramework,
  AutomationProject,
  ProjectConfig,
  ProjectFile,
  ProjectSecretMeta,
  ProgrammingLanguage,
  TestCase,
  TestRunRecord,
  TestingApproach,
  TestingTool,
  UserProfile,
  WebsiteAnalysisReport,
} from '../src/types/index.js';
import { decryptSecrets, encryptSecrets, maskSecretValue } from './security.js';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'automator.db');
export const SCREENSHOTS_DIR = path.join(DATA_DIR, 'screenshots');

let dbInstance: Database | null = null;

function ensureDirs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

function persistDb() {
  if (!dbInstance) return;
  ensureDirs();
  const data = dbInstance.export();
  const tmpPath = `${DB_PATH}.tmp`;
  fs.writeFileSync(tmpPath, Buffer.from(data));
  fs.renameSync(tmpPath, DB_PATH);
}

export async function getDb(): Promise<Database> {
  if (dbInstance) return dbInstance;
  ensureDirs();
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    const fileBuf = fs.readFileSync(DB_PATH);
    dbInstance = new SQL.Database(fileBuf);
  } else {
    dbInstance = new SQL.Database();
  }

  dbInstance.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'engineer',
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      created_at TEXT NOT NULL
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
      approach TEXT NOT NULL DEFAULT 'pom',
      analysis_json TEXT,
      test_cases_json TEXT NOT NULL DEFAULT '[]',
      files_json TEXT NOT NULL DEFAULT '[]',
      config_json TEXT NOT NULL,
      secrets_enc TEXT NOT NULL DEFAULT '',
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
  `);

  persistDb();
  return dbInstance;
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
  role: 'admin' | 'engineer';
  passwordHash: string;
  passwordSalt: string;
  createdAt: string;
} | null> {
  const db = await getDb();
  const row = queryOne<{
    id: string;
    email: string;
    name: string;
    role: 'admin' | 'engineer';
    password_hash: string;
    password_salt: string;
    created_at: string;
  }>(db, 'SELECT * FROM users WHERE lower(email) = lower(?)', [email]);
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
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
    role: 'admin' | 'engineer';
    created_at: string;
  }>(db, 'SELECT id, email, name, role, created_at FROM users WHERE id = ?', [id]);
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    createdAt: row.created_at,
  };
}

export async function createUser(input: {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'engineer';
  passwordHash: string;
  passwordSalt: string;
}): Promise<UserProfile> {
  const db = await getDb();
  const createdAt = new Date().toISOString();
  db.run(
    `INSERT INTO users (id, email, name, role, password_hash, password_salt, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [input.id, input.email, input.name, input.role, input.passwordHash, input.passwordSalt, createdAt]
  );
  persistDb();
  return {
    id: input.id,
    email: input.email,
    name: input.name,
    role: input.role,
    createdAt,
  };
}

function rowToProject(row: Record<string, unknown>): AutomationProject {
  const secretsRaw = typeof row.secrets_enc === 'string' ? row.secrets_enc : '';
  const decrypted = decryptSecrets(secretsRaw);
  const secretsMeta: ProjectSecretMeta[] = Object.entries(decrypted).map(([key, value]) => ({
    key,
    maskedValue: maskSecretValue(value),
    updatedAt: String(row.updated_at),
  }));

  return {
    id: String(row.id),
    userId: String(row.user_id),
    name: String(row.name),
    description: String(row.description || ''),
    url: String(row.url),
    tool: row.tool as TestingTool,
    language: row.language as ProgrammingLanguage,
    framework: row.framework as AutomationFramework,
    approach: (row.approach as TestingApproach) || 'pom',
    analysis: row.analysis_json
      ? (JSON.parse(String(row.analysis_json)) as WebsiteAnalysisReport)
      : null,
    testCases: JSON.parse(String(row.test_cases_json || '[]')) as TestCase[],
    files: JSON.parse(String(row.files_json || '[]')) as ProjectFile[],
    config: JSON.parse(String(row.config_json)) as ProjectConfig,
    secretsMeta,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export async function listProjectsForUser(userId: string): Promise<AutomationProject[]> {
  const db = await getDb();
  const rows = queryAll(
    db,
    'SELECT * FROM projects WHERE user_id = ? ORDER BY updated_at DESC',
    [userId]
  );
  return rows.map(rowToProject);
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

export async function saveProject(project: AutomationProject, plainSecrets?: Record<string, string>): Promise<AutomationProject> {
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

  if (existing) {
    db.run(
      `UPDATE projects SET
        name = ?, description = ?, url = ?, tool = ?, language = ?, framework = ?,
        approach = ?, analysis_json = ?, test_cases_json = ?, files_json = ?,
        config_json = ?, secrets_enc = ?, updated_at = ?
      WHERE id = ?`,
      [
        project.name,
        project.description,
        project.url,
        project.tool,
        project.language,
        project.framework,
        project.approach,
        project.analysis ? JSON.stringify(project.analysis) : null,
        JSON.stringify(project.testCases),
        JSON.stringify(project.files),
        JSON.stringify(project.config),
        secretsEnc,
        project.updatedAt,
        project.id,
      ]
    );
  } else {
    db.run(
      `INSERT INTO projects (
        id, user_id, name, description, url, tool, language, framework, approach,
        analysis_json, test_cases_json, files_json, config_json, secrets_enc, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        project.id,
        project.userId,
        project.name,
        project.description,
        project.url,
        project.tool,
        project.language,
        project.framework,
        project.approach,
        project.analysis ? JSON.stringify(project.analysis) : null,
        JSON.stringify(project.testCases),
        JSON.stringify(project.files),
        JSON.stringify(project.config),
        secretsEnc,
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
    results: JSON.parse(String(row.results_json || '[]')),
    logs: JSON.parse(String(row.logs_json || '[]')),
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
        'SELECT * FROM test_runs WHERE user_id = ? AND project_id = ? ORDER BY started_at DESC LIMIT 50',
        [userId, projectId]
      )
    : queryAll(
        db,
        'SELECT * FROM test_runs WHERE user_id = ? ORDER BY started_at DESC LIMIT 50',
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
  return JSON.parse(row.messages_json || '[]') as AiMessage[];
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
