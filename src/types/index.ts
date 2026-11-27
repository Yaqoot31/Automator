export type TestingTool = 'selenium' | 'cypress' | 'playwright';

export type ProgrammingLanguage = 'java' | 'javascript' | 'typescript' | 'python';

export type AutomationFramework =
  | 'selenium-java-testng'
  | 'selenium-java-junit'
  | 'cypress-js'
  | 'selenium-js'
  | 'cypress-ts'
  | 'selenium-ts'
  | 'playwright-ts'
  | 'selenium-python-pytest'
  | 'playwright-python';

export type TestingApproach = 'pom' | 'data-driven' | 'bdd-style' | 'hybrid';

export type BrowserTarget = 'chrome' | 'firefox' | 'edge';

export type ViewportPreset = 'desktop' | 'laptop' | 'tablet' | 'mobile' | 'custom';

export type ThemeMode = 'obsidian' | 'daylight' | 'slate' | 'cobalt';

export type AccentColor = 'amber' | 'teal' | 'cobalt' | 'emerald';

export type LayoutDensity = 'compact' | 'comfortable' | 'spacious';

export type WorkspaceView =
  | 'dashboard'
  | 'analyzer'
  | 'tests'
  | 'sqa'
  | 'studio'
  | 'runner'
  | 'reports'
  | 'projects'
  | 'settings';

export type UserRole =
  | 'admin'
  | 'project_manager'
  | 'qa_lead'
  | 'sqa_engineer'
  | 'developer'
  | 'viewer'
  | 'engineer';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  emailVerified: boolean;
  jobTitle?: string;
  organization?: string;
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

export interface SkippedPageInfo {
  url: string;
  reason: string;
}

export interface UnsupportedElementInfo {
  pagePath: string;
  category: string;
  detail: string;
  manualReason: string;
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
  discoveredUrls?: string[];
  skippedPages?: SkippedPageInfo[];
  unsupportedElements?: UnsupportedElementInfo[];
  coverageScope?: 'single-page' | 'partial-crawl' | 'full-discovered';
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

export type TestPriority = 'Critical' | 'High' | 'Medium' | 'Low';
export type TestSeverity = 'Critical' | 'Major' | 'Minor';
export type SqaExecutionStatus = 'Pass' | 'Fail' | 'Blocked' | 'Not Run';
export type AutomationStatus = 'Automated' | 'Manual';
export type TestingType =
  | 'Automated'
  | 'Manual'
  | 'Regression'
  | 'Smoke'
  | 'Sanity'
  | 'Functional'
  | 'Integration'
  | 'Responsive'
  | 'Cross-Browser';

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
  module?: string;
  category: TestCaseCategory;
  scenarioType: 'positive' | 'negative' | 'boundary' | 'exploratory';
  pagePath: string;
  scenario: string;
  preconditions: string;
  testData?: string;
  steps: TestStep[];
  expectedResult: string;
  actualResult?: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped' | 'blocked';
  sqaStatus?: SqaExecutionStatus;
  priority?: TestPriority;
  severity?: TestSeverity;
  automationStatus?: AutomationStatus;
  testingType?: TestingType;
  assignee?: string;
  suiteId?: string;
  requirementId?: string;
  executionDate?: string;
  comments?: string;
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

export interface ProjectTeamMember {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  addedAt: string;
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
  selectedFrameworks?: AutomationFramework[];
  approach: TestingApproach;
  analysis: WebsiteAnalysisReport | null;
  testCases: TestCase[];
  files: ProjectFile[];
  config: ProjectConfig;
  secretsMeta: ProjectSecretMeta[];
  teamMembers?: ProjectTeamMember[];
  googleSheetId?: string;
  googleSheetUrl?: string;
  googleSheetTitle?: string;
  googleSheetLastSync?: string;
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

// SQA Management System Models

export interface SqaTestPlan {
  id: string;
  projectId: string;
  userId: string;
  title: string;
  strategy: string;
  scope: string;
  objectives: string;
  resources: string;
  scheduleStart: string;
  scheduleEnd: string;
  releaseTarget: string;
  status: 'Draft' | 'Active' | 'Approved' | 'Completed';
  createdAt: string;
  updatedAt: string;
}

export interface SqaTestSuite {
  id: string;
  projectId: string;
  userId: string;
  name: string;
  suiteType: 'Regression' | 'Smoke' | 'Sanity' | 'Release' | 'Functional' | 'Integration';
  description: string;
  testCaseIds: string[];
  createdAt: string;
  updatedAt: string;
}

export type DefectStatus =
  | 'New'
  | 'Assigned'
  | 'In Progress'
  | 'Fixed'
  | 'Retest'
  | 'Reopened'
  | 'Closed';

export interface SqaDefect {
  id: string;
  bugCode: string;
  projectId: string;
  userId: string;
  title: string;
  description: string;
  stepsToReproduce: string;
  expectedResult: string;
  actualResult: string;
  severity: TestSeverity;
  priority: TestPriority;
  assignedDeveloper: string;
  reportedBy: string;
  status: DefectStatus;
  linkedTestCaseId?: string;
  linkedRequirementId?: string;
  screenshotUrl?: string;
  attachmentName?: string;
  resolutionNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SqaRequirement {
  id: string;
  reqCode: string;
  projectId: string;
  userId: string;
  type: 'Business' | 'Functional';
  title: string;
  description: string;
  module: string;
  priority: TestPriority;
  linkedTestCaseIds: string[];
  linkedDefectIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SqaRelease {
  id: string;
  projectId: string;
  userId: string;
  version: string;
  name: string;
  buildNumber: string;
  environment: 'staging' | 'production' | 'qa';
  targetDate: string;
  buildVerified: boolean;
  readinessStatus: 'Pending' | 'Ready' | 'At Risk' | 'Blocked';
  approvalStatus: 'Pending' | 'Approved' | 'Rejected';
  approvedBy?: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
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
