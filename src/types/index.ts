export type TestingTool = 'selenium' | 'cypress';

export type ProgrammingLanguage = 'java' | 'javascript' | 'typescript' | 'python';

export type AutomationFramework =
  | 'selenium-java-testng'
  | 'selenium-java-junit'
  | 'cypress-js'
  | 'selenium-js'
  | 'cypress-ts'
  | 'selenium-ts'
  | 'selenium-python-pytest';

export type TestingApproach = 'pom' | 'data-driven' | 'bdd-style' | 'hybrid';

export type BrowserTarget = 'chrome' | 'firefox' | 'edge';

export type ViewportPreset = 'desktop' | 'laptop' | 'tablet' | 'mobile' | 'custom';

export type ThemeMode = 'obsidian' | 'daylight' | 'slate' | 'cobalt';

export type AccentColor = 'amber' | 'teal' | 'cobalt' | 'emerald';

export type LayoutDensity = 'compact' | 'comfortable' | 'spacious';

export type WorkspaceView =
  | 'analyzer'
  | 'tests'
  | 'studio'
  | 'runner'
  | 'reports'
  | 'projects'
  | 'settings';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'engineer';
  createdAt: string;
}

export interface DomElementInfo {
  id: string;
  tag: string;
  category:
    | 'button'
    | 'link'
    | 'input'
    | 'form'
    | 'dropdown'
    | 'menu'
    | 'table'
    | 'image'
    | 'upload'
    | 'dynamic';
  role?: string;
  text: string;
  type?: string;
  name?: string;
  placeholder?: string;
  href?: string;
  src?: string;
  alt?: string;
  locator: string;
  locatorStrategy: 'data-testid' | 'id' | 'aria-label' | 'name' | 'css' | 'role';
  options?: string[];
  required?: boolean;
}

export type PageArchetype =
  | 'Homepage'
  | 'Login'
  | 'Registration'
  | 'Dashboard'
  | 'Search'
  | 'Form'
  | 'Table'
  | 'Catalog'
  | 'Article'
  | 'Other';

export interface AnalyzedPage {
  id: string;
  url: string;
  path: string;
  title: string;
  statusCode: number;
  loadTimeMs: number;
  archetype: PageArchetype;
  metaDescription: string;
  lang: string;
  headings: string[];
  elementCounts: {
    buttons: number;
    links: number;
    forms: number;
    inputs: number;
    dropdowns: number;
    menus: number;
    tables: number;
    images: number;
    uploads: number;
    dynamicWidgets: number;
  };
  elements: DomElementInfo[];
  internalLinks: string[];
  brokenLinks: { url: string; status: number | string }[];
  accessibilityIssues: {
    severity: 'warning' | 'error';
    rule: string;
    detail: string;
  }[];
  responsiveCheck: {
    desktopOverflow: boolean;
    mobileOverflow: boolean;
  };
  hasLoginForm: boolean;
  hasSearchForm: boolean;
  hasFileUpload: boolean;
  antiBotDetected?: string;
}

export interface WebsiteAnalysisReport {
  id: string;
  url: string;
  finalUrl: string;
  accessible: boolean;
  robotsAllowed: boolean;
  robotsSummary: string;
  antiBotDetected?: string;
  analyzedAt: string;
  durationMs: number;
  pages: AnalyzedPage[];
  summary: {
    totalPages: number;
    totalElements: number;
    totalForms: number;
    totalLinks: number;
    brokenLinksCount: number;
    accessibilityIssuesCount: number;
    avgLoadTimeMs: number;
    responsiveReady: boolean;
  };
  aiInsights?: string;
}

export type TestCaseCategory =
  | 'homepage'
  | 'navigation'
  | 'buttons'
  | 'forms'
  | 'validation'
  | 'search'
  | 'dropdowns'
  | 'auth'
  | 'responsive'
  | 'broken-links'
  | 'performance'
  | 'error-messages'
  | 'file-upload'
  | 'redirects'
  | 'accessibility'
  | 'browser-compat';

export interface TestStep {
  stepNumber: number;
  action:
    | 'navigate'
    | 'click'
    | 'type'
    | 'select'
    | 'assert_visible'
    | 'assert_text'
    | 'assert_url'
    | 'assert_status'
    | 'check_links'
    | 'check_responsive'
    | 'check_a11y'
    | 'check_perf'
    | 'wait';
  target: string;
  value?: string;
  expected: string;
}

export interface TestCase {
  id: string;
  code: string;
  title: string;
  category: TestCaseCategory;
  scenarioType: 'positive' | 'negative' | 'boundary' | 'exploratory';
  pagePath: string;
  scenario: string;
  preconditions: string;
  steps: TestStep[];
  expectedResult: string;
  actualResult?: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
  durationMs?: number;
  screenshotUrl?: string;
  enabled: boolean;
}

export interface ProjectFile {
  path: string;
  name: string;
  folder: string;
  language:
    | 'java'
    | 'javascript'
    | 'typescript'
    | 'python'
    | 'json'
    | 'xml'
    | 'markdown'
    | 'properties'
    | 'text';
  content: string;
  isModified?: boolean;
}

export interface ProjectConfig {
  browser: BrowserTarget;
  browserVersion: string;
  viewport: ViewportPreset;
  customWidth: number;
  customHeight: number;
  timeoutMs: number;
  retries: number;
  parallelWorkers: number;
  headless: boolean;
  environment: 'development' | 'staging' | 'production';
  baseUrl: string;
  captureScreenshots: boolean;
  recordVideo: boolean;
  customTestData: Record<string, string>;
}

export interface ProjectSecretMeta {
  key: string;
  maskedValue: string;
  updatedAt: string;
}

export interface AutomationProject {
  id: string;
  userId: string;
  name: string;
  description: string;
  url: string;
  tool: TestingTool;
  language: ProgrammingLanguage;
  framework: AutomationFramework;
  approach: TestingApproach;
  analysis: WebsiteAnalysisReport | null;
  testCases: TestCase[];
  files: ProjectFile[];
  config: ProjectConfig;
  secretsMeta: ProjectSecretMeta[];
  createdAt: string;
  updatedAt: string;
}

export interface TestRunItemResult {
  testCaseId: string;
  code: string;
  title: string;
  category: TestCaseCategory;
  status: 'passed' | 'failed' | 'skipped';
  durationMs: number;
  actualResult: string;
  screenshotUrl?: string;
  errorMessage?: string;
}

export interface TestRunLogEntry {
  timestamp: string;
  level: 'info' | 'success' | 'warn' | 'error';
  message: string;
}

export interface TestRunRecord {
  id: string;
  projectId: string;
  userId: string;
  projectName: string;
  browser: BrowserTarget;
  viewport: string;
  headless: boolean;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  durationMs: number;
  results: TestRunItemResult[];
  logs: TestRunLogEntry[];
  startedAt: string;
  completedAt?: string;
}

export interface AiMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  codeBlocks?: { language: string; filename?: string; code: string }[];
}

export interface CodeDiagnostic {
  line: number;
  severity: 'error' | 'warning';
  message: string;
}

export interface AppSettings {
  theme: ThemeMode;
  accent: AccentColor;
  density: LayoutDensity;
  reducedMotion: boolean;
  defaultFramework: AutomationFramework;
  sidebarCollapsed: boolean;
  fontScale: number;
}
