import { useState, useMemo } from 'react';
import {
  Search,
  Play,
  Plus,
  Sparkles,
  Loader2,
  Globe,
  FileSpreadsheet,
  FileDown,
  Upload,
  ExternalLink,
  RefreshCw,
  Share2,
  Trash2,
  Bug,
  X,
  LogOut,
  CheckCircle2,
} from 'lucide-react';
import type {
  AutomationProject,
  AutomationStatus,
  SqaExecutionStatus,
  TestCase,
  TestCaseCategory,
  TestPriority,
  TestSeverity,
  WorkspaceView,
} from '@/types';
import {
  downloadTestCasesCsv,
  downloadTestCasesExcel,
} from '@/lib/exportUtils';
import {
  connectGoogleWorkspace,
  createTestCasesSpreadsheet,
  disconnectGoogleWorkspace,
  getGoogleWorkspaceStatus,
  shareSpreadsheetPermission,
  syncTestCasesToSpreadsheet,
} from '@/lib/googleSheets';

interface TestCasesViewProps {
  project: AutomationProject | null;
  onUpdateTestCases: (testCases: TestCase[]) => Promise<void>;
  onUpdateProjectSheet?: (projectId: string, patch: Partial<AutomationProject>) => Promise<void>;
  onRunTests: (testCaseIds: string[]) => Promise<void>;
  onEnhanceWithAi: (focus?: string) => Promise<void>;
  onLogDefectFromCase?: (tc: TestCase) => void;
  onNavigate: (view: WorkspaceView) => void;
}

const SCENARIO_TYPES: { id: 'all' | TestCase['scenarioType']; label: string }[] = [
  { id: 'all', label: 'All Types' },
  { id: 'positive', label: 'Positive' },
  { id: 'negative', label: 'Negative' },
  { id: 'boundary', label: 'Boundary' },
  { id: 'exploratory', label: 'Exploratory' },
];

type GoogleConfirmAction =
  | { kind: 'create' }
  | { kind: 'sync' }
  | { kind: 'share'; email: string; role: 'reader' | 'writer'; anyoneWithLink: boolean };

export function TestCasesView({
  project,
  onUpdateTestCases,
  onUpdateProjectSheet,
  onRunTests,
  onEnhanceWithAi,
  onLogDefectFromCase,
  onNavigate,
}: TestCasesViewProps) {
  const [search, setSearch] = useState('');
  const [scenarioFilter, setScenarioFilter] = useState<'all' | TestCase['scenarioType']>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | TestCaseCategory>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | SqaExecutionStatus>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [enhancing, setEnhancing] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // Add form state
  const [newTitle, setNewTitle] = useState('');
  const [newModule, setNewModule] = useState('Core');
  const [newScenario, setNewScenario] = useState('');
  const [newTestData, setNewTestData] = useState('');
  const [newExpected, setNewExpected] = useState('');
  const [newTargetSelector, setNewTargetSelector] = useState('body');
  const [newType, setNewType] = useState<TestCase['scenarioType']>('positive');
  const [newPriority, setNewPriority] = useState<TestPriority>('Medium');
  const [newSeverity, setNewSeverity] = useState<TestSeverity>('Major');
  const [newAutoStatus, setNewAutoStatus] = useState<AutomationStatus>('Automated');

  // Google Sheets state
  const [googleStatus, setGoogleStatus] = useState(() => getGoogleWorkspaceStatus());
  const [googleBusy, setGoogleBusy] = useState(false);
  const [googleMessage, setGoogleMessage] = useState<string | null>(null);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<GoogleConfirmAction | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareEmail, setShareEmail] = useState('');
  const [shareRole, setShareRole] = useState<'reader' | 'writer'>('reader');
  const [shareAnyone, setShareAnyone] = useState(false);

  const testCases = useMemo(() => project?.testCases || [], [project?.testCases]);

  const categoriesPresent = useMemo(() => {
    const set = new Set<TestCaseCategory>();
    testCases.forEach((tc) => set.add(tc.category));
    return Array.from(set);
  }, [testCases]);

  const filtered = useMemo(() => {
    return testCases.filter((tc) => {
      if (scenarioFilter !== 'all' && tc.scenarioType !== scenarioFilter) return false;
      if (categoryFilter !== 'all' && tc.category !== categoryFilter) return false;
      const effectiveSqa =
        tc.sqaStatus ||
        (tc.status === 'passed'
          ? 'Pass'
          : tc.status === 'failed'
            ? 'Fail'
            : tc.status === 'blocked'
              ? 'Blocked'
              : 'Not Run');
      if (statusFilter !== 'all' && effectiveSqa !== statusFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          tc.code.toLowerCase().includes(q) ||
          tc.title.toLowerCase().includes(q) ||
          (tc.module || '').toLowerCase().includes(q) ||
          tc.scenario.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [testCases, scenarioFilter, categoryFilter, statusFilter, search]);

  if (!project) {
    return (
      <div className="max-w-[960px] mx-auto px-4 py-16 text-center space-y-4">
        <div className="surface-panel rounded-2xl p-10 space-y-4">
          <Globe className="w-10 h-10 mx-auto text-[var(--accent-primary)]" />
          <h2 className="font-display font-bold text-xl">No Active Project Selected</h2>
          <p className="text-sm text-[var(--text-secondary)] max-w-md mx-auto">
            Analyze a website URL first to automatically generate positive, negative, boundary, and accessibility test cases.
          </p>
          <button
            type="button"
            onClick={() => onNavigate('analyzer')}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold"
            style={{ backgroundColor: 'var(--accent-primary)', color: 'var(--accent-contrast)' }}
          >
            Go to Website Analyzer
          </button>
        </div>
      </div>
    );
  }

  const toggleEnabled = async (id: string) => {
    const next = testCases.map((tc) =>
      tc.id === id ? { ...tc, enabled: !tc.enabled } : tc
    );
    await onUpdateTestCases(next);
  };

  const updateCaseField = async (id: string, patch: Partial<TestCase>) => {
    const next = testCases.map((tc) => (tc.id === id ? { ...tc, ...patch } : tc));
    await onUpdateTestCases(next);
  };

  const deleteTestCase = async (id: string) => {
    await onUpdateTestCases(testCases.filter((tc) => tc.id !== id));
  };

  const handleAddCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const code = `TC-${String(testCases.length + 1).padStart(3, '0')}`;
    const custom: TestCase = {
      id: crypto.randomUUID(),
      code,
      title: newTitle.trim(),
      module: newModule.trim() || 'Core',
      category: 'homepage',
      scenarioType: newType,
      pagePath: '/',
      scenario: newScenario.trim() || 'Custom QA automation & SQA verification scenario.',
      preconditions: `Target URL ${project.url} is accessible.`,
      testData: newTestData.trim() || 'Standard valid payload',
      steps: [
        { stepNumber: 1, action: 'navigate', target: project.url, expected: 'Page loads' },
        {
          stepNumber: 2,
          action: 'assert_visible',
          target: newTargetSelector.trim() || 'body',
          expected: 'Target locator is visible',
        },
      ],
      expectedResult: newExpected.trim() || 'Target element renders cleanly and passes assertions.',
      actualResult: '',
      status: 'pending',
      sqaStatus: 'Not Run',
      priority: newPriority,
      severity: newSeverity,
      automationStatus: newAutoStatus,
      testingType: newAutoStatus === 'Manual' ? 'Manual' : 'Automated',
      comments: '',
      enabled: true,
    };
    await onUpdateTestCases([...testCases, custom]);
    setNewTitle('');
    setNewScenario('');
    setNewTestData('');
    setNewExpected('');
    setNewTargetSelector('body');
    setShowAddForm(false);
  };

  const handleImportCases = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      let imported: TestCase[] = [];
      if (file.name.endsWith('.json')) {
        const parsed = JSON.parse(text) as Partial<TestCase>[];
        imported = (Array.isArray(parsed) ? parsed : []).map((item, idx) => ({
          id: crypto.randomUUID(),
          code: item.code || `TC-${String(testCases.length + idx + 1).padStart(3, '0')}`,
          title: item.title || 'Imported Test Case',
          module: item.module || 'Imported',
          category: item.category || 'homepage',
          scenarioType: item.scenarioType || 'positive',
          pagePath: item.pagePath || '/',
          scenario: item.scenario || '',
          preconditions: item.preconditions || `Target ${project.url} reachable`,
          testData: item.testData || 'N/A',
          steps: item.steps || [{ stepNumber: 1, action: 'navigate', target: project.url, expected: 'Loaded' }],
          expectedResult: item.expectedResult || 'Expected condition met',
          actualResult: item.actualResult || '',
          status: 'pending',
          sqaStatus: item.sqaStatus || 'Not Run',
          priority: item.priority || 'Medium',
          severity: item.severity || 'Major',
          automationStatus: item.automationStatus || 'Manual',
          enabled: true,
        }));
      } else {
        const lines = text.split(/\r?\n/).filter((l) => l.trim());
        imported = lines.slice(1).map((line, idx) => {
          const cols = line.split(',').map((c) => c.replace(/^"|"$/g, '').trim());
          return {
            id: crypto.randomUUID(),
            code: cols[0] || `TC-${String(testCases.length + idx + 1).padStart(3, '0')}`,
            module: cols[1] || 'Imported',
            title: cols[2] || 'Imported CSV Test Case',
            category: 'homepage',
            scenarioType: 'positive',
            pagePath: '/',
            scenario: cols[2] || '',
            preconditions: `Target ${project.url} reachable`,
            testData: cols[4] || 'N/A',
            steps: [{ stepNumber: 1, action: 'navigate', target: project.url, expected: cols[3] || 'Verify steps' }],
            expectedResult: cols[5] || 'Expected result verified',
            actualResult: cols[6] || '',
            status: 'pending',
            sqaStatus: (['Pass', 'Fail', 'Blocked', 'Not Run'].includes(cols[7]) ? cols[7] : 'Not Run') as SqaExecutionStatus,
            priority: (['Critical', 'High', 'Medium', 'Low'].includes(cols[8]) ? cols[8] : 'Medium') as TestPriority,
            severity: (['Critical', 'Major', 'Minor'].includes(cols[9]) ? cols[9] : 'Major') as TestSeverity,
            automationStatus: cols[10] === 'Manual' ? 'Manual' : 'Automated',
            comments: cols[13] || '',
            enabled: true,
          };
        });
      }
      if (imported.length > 0) {
        await onUpdateTestCases([...testCases, ...imported]);
      }
    } catch {
      setAiError('Could not parse imported JSON or CSV test case file.');
    }
    e.target.value = '';
  };

  const handleAiEnhance = async () => {
    setEnhancing(true);
    setAiError(null);
    try {
      await onEnhanceWithAi();
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'AI generation failed.');
    } finally {
      setEnhancing(false);
    }
  };

  // Google Workspace Handlers (Explicit confirmation modal enforced before mutating Google Sheets / Drive)
  const handleConnectGoogle = async () => {
    setGoogleError(null);
    setGoogleBusy(true);
    try {
      await connectGoogleWorkspace();
      setGoogleStatus(getGoogleWorkspaceStatus());
      setGoogleMessage('Connected to Google Workspace. You can now create or sync test sheets.');
    } catch (err) {
      setGoogleError(err instanceof Error ? err.message : 'Google Workspace sign-in failed.');
    } finally {
      setGoogleBusy(false);
    }
  };

  const handleDisconnectGoogle = async () => {
    await disconnectGoogleWorkspace();
    setGoogleStatus(getGoogleWorkspaceStatus());
    setGoogleMessage(null);
  };

  const executeConfirmedGoogleAction = async () => {
    if (!pendingConfirm || !project) return;
    const action = pendingConfirm;
    setPendingConfirm(null);
    setGoogleBusy(true);
    setGoogleError(null);
    setGoogleMessage(null);

    try {
      if (action.kind === 'create') {
        const res = await createTestCasesSpreadsheet(project);
        if (onUpdateProjectSheet) {
          await onUpdateProjectSheet(project.id, {
            googleSheetId: res.spreadsheetId,
            googleSheetUrl: res.spreadsheetUrl,
            googleSheetTitle: res.title,
            googleSheetLastSync: new Date().toISOString(),
          });
        }
        setGoogleMessage(`Created Google Sheet "${res.title}" with 14 QA columns & Summary Report tab.`);
      } else if (action.kind === 'sync' && project.googleSheetId) {
        const res = await syncTestCasesToSpreadsheet(project.googleSheetId, project);
        if (onUpdateProjectSheet) {
          await onUpdateProjectSheet(project.id, {
            googleSheetLastSync: res.syncedAt,
          });
        }
        setGoogleMessage(`Synced ${res.updatedRows} test cases and Summary Report to Google Sheets.`);
      } else if (action.kind === 'share' && project.googleSheetId) {
        await shareSpreadsheetPermission(project.googleSheetId, {
          email: action.email,
          role: action.role,
          anyoneWithLink: action.anyoneWithLink,
        });
        setShowShareModal(false);
        setShareEmail('');
        setGoogleMessage(
          action.anyoneWithLink
            ? `Enabled link sharing (${action.role}) on Google Sheet.`
            : `Shared Google Sheet with ${action.email} as ${action.role}.`
        );
      }
    } catch (err) {
      setGoogleError(err instanceof Error ? err.message : 'Google Sheets operation failed.');
    } finally {
      setGoogleBusy(false);
    }
  };

  const enabledCount = testCases.filter((tc) => tc.enabled).length;
  const frameworksLabel =
    project.selectedFrameworks && project.selectedFrameworks.length > 0
      ? project.selectedFrameworks.join(', ')
      : project.framework;

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-5 animate-view-enter">
      {/* Header & Exports */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display font-bold text-xl sm:text-2xl text-[var(--text-main)]">
            14-Column Test Cases &amp; Google Sheets Sync
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1 break-words">
            {testCases.length} scenarios for <span className="font-mono break-all">{project.url}</span> · {enabledCount} enabled · {frameworksLabel}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => downloadTestCasesExcel(project)}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium surface-panel hover:bg-[var(--surface-hover)] min-h-[42px]"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-[var(--status-success)]" />
            <span>Export Excel (.xlsx)</span>
          </button>

          <button
            type="button"
            onClick={() => downloadTestCasesCsv(project)}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium surface-panel hover:bg-[var(--surface-hover)] min-h-[42px]"
          >
            <FileDown className="w-3.5 h-3.5 text-[var(--accent-secondary)]" />
            <span>Export CSV</span>
          </button>

          <label className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium surface-panel hover:bg-[var(--surface-hover)] min-h-[42px] cursor-pointer">
            <Upload className="w-3.5 h-3.5" />
            <span>Import JSON/CSV</span>
            <input type="file" accept=".json,.csv" onChange={handleImportCases} className="sr-only" />
          </label>

          <button
            type="button"
            onClick={() => setShowAddForm((v) => !v)}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium surface-panel hover:bg-[var(--surface-hover)] min-h-[42px]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Test Case</span>
          </button>

          <button
            type="button"
            onClick={handleAiEnhance}
            disabled={enhancing}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium surface-panel hover:bg-[var(--surface-hover)] min-h-[42px] disabled:opacity-50"
          >
            {enhancing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
            )}
            <span>{enhancing ? 'Synthesizing...' : 'AI Edge Cases'}</span>
          </button>

          <button
            type="button"
            onClick={() => onRunTests(testCases.filter((t) => t.enabled).map((t) => t.id))}
            disabled={enabledCount === 0}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold min-h-[42px] disabled:opacity-50"
            style={{ backgroundColor: 'var(--accent-primary)', color: 'var(--accent-contrast)' }}
          >
            <Play className="w-3.5 h-3.5" />
            <span>Run Enabled ({enabledCount})</span>
          </button>
        </div>
      </div>

      {/* Google Sheets Workspace Integration Bar */}
      <div className="surface-panel rounded-2xl p-4 sm:p-5 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <div className="text-sm font-semibold flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-[var(--status-success)]" />
              <span>Google Sheets Test Case Sync</span>
            </div>
            <div className="text-xs text-[var(--text-secondary)]">
              {googleStatus.connected
                ? `Signed in as ${googleStatus.email || 'Google User'} · Exports all 14 QA columns + Summary Report tab.`
                : 'Sign in with Google to create a live spreadsheet, sync manual/automated results, and manage Drive sharing permissions.'}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {!googleStatus.connected ? (
              <button
                type="button"
                onClick={handleConnectGoogle}
                disabled={googleBusy}
                className="inline-flex items-center gap-2.5 px-4 min-h-[42px] rounded-lg bg-white text-neutral-900 border border-neutral-300 hover:bg-neutral-100 text-xs font-semibold shadow-xs transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 48 48" aria-hidden="true">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                </svg>
                <span>{googleBusy ? 'Connecting...' : 'Sign in with Google'}</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  disabled={googleBusy}
                  onClick={() => setPendingConfirm({ kind: 'create' })}
                  className="inline-flex items-center gap-1.5 px-3.5 min-h-[42px] rounded-xl text-xs font-semibold"
                  style={{ backgroundColor: 'var(--accent-primary)', color: 'var(--accent-contrast)' }}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Google Sheet</span>
                </button>

                {project.googleSheetId && (
                  <>
                    <button
                      type="button"
                      disabled={googleBusy}
                      onClick={() => setPendingConfirm({ kind: 'sync' })}
                      className="inline-flex items-center gap-1.5 px-3.5 min-h-[42px] rounded-xl text-xs font-medium surface-elevated hover:bg-[var(--surface-hover)]"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${googleBusy ? 'animate-spin' : ''}`} />
                      <span>Sync Rows</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowShareModal(true)}
                      className="inline-flex items-center gap-1.5 px-3.5 min-h-[42px] rounded-xl text-xs font-medium surface-elevated hover:bg-[var(--surface-hover)]"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>Share</span>
                    </button>

                    {project.googleSheetUrl && (
                      <a
                        href={project.googleSheetUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3.5 min-h-[42px] rounded-xl text-xs font-medium surface-elevated hover:bg-[var(--surface-hover)] text-[var(--accent-secondary)]"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Open Sheet</span>
                      </a>
                    )}
                  </>
                )}

                <button
                  type="button"
                  onClick={handleDisconnectGoogle}
                  className="inline-flex items-center gap-1.5 px-3 min-h-[42px] rounded-xl text-xs font-medium surface-elevated text-[var(--text-secondary)]"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Disconnect</span>
                </button>
              </>
            )}
          </div>
        </div>

        {project.googleSheetLastSync && (
          <div className="text-[11px] font-mono text-[var(--text-muted)]">
            Linked Sheet: {project.googleSheetTitle || project.googleSheetId} · Last Synced:{' '}
            {new Date(project.googleSheetLastSync).toLocaleString()}
          </div>
        )}

        {googleMessage && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2 text-xs text-[var(--status-success)] flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{googleMessage}</span>
          </div>
        )}
        {googleError && (
          <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2 text-xs text-red-500">
            {googleError}
          </div>
        )}
      </div>

      {aiError && (
        <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 text-xs text-red-500">
          {aiError}
        </div>
      )}

      {showAddForm && (
        <form onSubmit={handleAddCustom} className="surface-panel rounded-xl p-4 sm:p-5 space-y-4">
          <div className="text-sm font-semibold">Create New QA Test Case</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <input
              type="text"
              required
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Test case title"
              className="sm:col-span-2 min-h-[44px] px-3 rounded-lg surface-elevated text-xs"
            />
            <input
              type="text"
              value={newModule}
              onChange={(e) => setNewModule(e.target.value)}
              placeholder="Module (e.g. Authentication)"
              className="min-h-[44px] px-3 rounded-lg surface-elevated text-xs"
            />
            <input
              type="text"
              value={newTargetSelector}
              onChange={(e) => setNewTargetSelector(e.target.value)}
              placeholder="CSS selector (e.g. #submit-btn)"
              className="min-h-[44px] px-3 rounded-lg surface-elevated font-mono text-xs"
            />
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value as TestCase['scenarioType'])}
              className="min-h-[44px] px-3 rounded-lg surface-elevated text-xs"
            >
              <option value="positive">Positive</option>
              <option value="negative">Negative</option>
              <option value="boundary">Boundary</option>
              <option value="exploratory">Exploratory</option>
            </select>
            <select
              value={newPriority}
              onChange={(e) => setNewPriority(e.target.value as TestPriority)}
              className="min-h-[44px] px-3 rounded-lg surface-elevated text-xs"
            >
              <option value="Critical">Priority: Critical</option>
              <option value="High">Priority: High</option>
              <option value="Medium">Priority: Medium</option>
              <option value="Low">Priority: Low</option>
            </select>
            <select
              value={newSeverity}
              onChange={(e) => setNewSeverity(e.target.value as TestSeverity)}
              className="min-h-[44px] px-3 rounded-lg surface-elevated text-xs"
            >
              <option value="Critical">Severity: Critical</option>
              <option value="Major">Severity: Major</option>
              <option value="Minor">Severity: Minor</option>
            </select>
            <select
              value={newAutoStatus}
              onChange={(e) => setNewAutoStatus(e.target.value as AutomationStatus)}
              className="min-h-[44px] px-3 rounded-lg surface-elevated text-xs"
            >
              <option value="Automated">Automated</option>
              <option value="Manual">Manual</option>
            </select>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              type="text"
              value={newScenario}
              onChange={(e) => setNewScenario(e.target.value)}
              placeholder="Test scenario summary"
              className="min-h-[44px] px-3 rounded-lg surface-elevated text-xs"
            />
            <input
              type="text"
              value={newTestData}
              onChange={(e) => setNewTestData(e.target.value)}
              placeholder="Test data inputs"
              className="min-h-[44px] px-3 rounded-lg surface-elevated text-xs"
            />
            <input
              type="text"
              value={newExpected}
              onChange={(e) => setNewExpected(e.target.value)}
              placeholder="Expected result"
              className="min-h-[44px] px-3 rounded-lg surface-elevated text-xs"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-4 min-h-[44px] rounded-lg text-xs surface-elevated"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 min-h-[44px] rounded-lg text-xs font-semibold"
              style={{ backgroundColor: 'var(--accent-primary)', color: 'var(--accent-contrast)' }}
            >
              Save Test Case
            </button>
          </div>
        </form>
      )}

      {/* Search & Filter Controls */}
      <div className="surface-panel rounded-xl p-3.5 sm:p-4 flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3">
        <div className="relative flex-1 xl:max-w-sm">
          <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ID, module, scenario..."
            className="w-full min-h-[44px] pl-9 pr-3 rounded-lg surface-elevated text-xs text-[var(--text-main)]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <div className="flex items-center gap-1 p-1 rounded-lg surface-elevated overflow-x-auto no-scrollbar max-w-full">
            {SCENARIO_TYPES.map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setScenarioFilter(st.id)}
                className={`px-3 py-2 rounded-md text-xs font-medium whitespace-nowrap shrink-0 min-h-[38px] transition-colors ${
                  scenarioFilter === st.id
                    ? 'bg-[var(--surface-panel)] text-[var(--text-main)] shadow-xs'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-main)]'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as 'all' | TestCaseCategory)}
            aria-label="Filter by category"
            className="min-h-[44px] px-3 rounded-lg surface-elevated text-xs text-[var(--text-main)]"
          >
            <option value="all">All Categories</option>
            {categoriesPresent.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | SqaExecutionStatus)}
            aria-label="Filter by execution status"
            className="min-h-[44px] px-3 rounded-lg surface-elevated text-xs text-[var(--text-main)]"
          >
            <option value="all">All Statuses</option>
            <option value="Pass">Pass</option>
            <option value="Fail">Fail</option>
            <option value="Blocked">Blocked</option>
            <option value="Not Run">Not Run</option>
          </select>
        </div>
      </div>

      {/* Mobile Cards (< lg) */}
      <div className="lg:hidden space-y-3">
        {filtered.map((tc) => {
          const sqaStatus =
            tc.sqaStatus ||
            (tc.status === 'passed'
              ? 'Pass'
              : tc.status === 'failed'
                ? 'Fail'
                : tc.status === 'blocked'
                  ? 'Blocked'
                  : 'Not Run');
          return (
            <div key={tc.id} className="surface-panel rounded-2xl p-4 space-y-3 text-xs">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[11px] font-mono text-[var(--text-muted)]">
                    <span className="text-[var(--accent-primary)] font-semibold">{tc.code}</span> ·{' '}
                    {tc.module || tc.category} · {tc.priority || 'Medium'} · {tc.automationStatus || 'Automated'}
                  </div>
                  <div className="text-sm font-semibold text-[var(--text-main)] mt-1 break-words">
                    {tc.title}
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={tc.enabled}
                  onChange={() => toggleEnabled(tc.id)}
                  aria-label={`Enable ${tc.code}`}
                  className="w-5 h-5 rounded accent-[var(--accent-primary)] shrink-0"
                />
              </div>

              <div className="text-[var(--text-secondary)] space-y-1">
                <div>
                  <span className="font-semibold">Expected:</span> {tc.expectedResult}
                </div>
                <div>
                  <span className="font-semibold">Test Data:</span> {tc.testData || 'N/A'}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <select
                  value={sqaStatus}
                  onChange={(e) => {
                    const nextSqa = e.target.value as SqaExecutionStatus;
                    const mappedStatus =
                      nextSqa === 'Pass'
                        ? 'passed'
                        : nextSqa === 'Fail'
                          ? 'failed'
                          : nextSqa === 'Blocked'
                            ? 'blocked'
                            : 'pending';
                    updateCaseField(tc.id, {
                      sqaStatus: nextSqa,
                      status: mappedStatus,
                      executionDate: new Date().toISOString().slice(0, 10),
                    });
                  }}
                  className="min-h-[42px] px-2.5 rounded-lg surface-elevated text-xs font-semibold"
                >
                  <option value="Not Run">Not Run</option>
                  <option value="Pass">Pass</option>
                  <option value="Fail">Fail</option>
                  <option value="Blocked">Blocked</option>
                </select>
                <button
                  type="button"
                  onClick={() => onRunTests([tc.id])}
                  className="min-h-[42px] px-3 rounded-lg surface-elevated font-semibold inline-flex items-center justify-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Run Test</span>
                </button>
              </div>
              {sqaStatus === 'Fail' && onLogDefectFromCase && (
                <button
                  type="button"
                  onClick={() => onLogDefectFromCase(tc)}
                  className="w-full min-h-[42px] rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 font-semibold inline-flex items-center justify-center gap-1.5"
                >
                  <Bug className="w-3.5 h-3.5" />
                  <span>Log Defect from Failure</span>
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Desktop 14-Column QA Matrix Table (lg+) */}
      <div className="hidden lg:block surface-panel rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[1320px]">
            <thead className="surface-elevated text-[var(--text-secondary)] border-b">
              <tr>
                <th className="py-3 px-2.5">Run</th>
                <th className="py-3 px-2.5 font-semibold">Test Case ID</th>
                <th className="py-3 px-2.5 font-semibold">Module</th>
                <th className="py-3 px-2.5 font-semibold">Test Scenario</th>
                <th className="py-3 px-2.5 font-semibold">Test Steps</th>
                <th className="py-3 px-2.5 font-semibold">Test Data</th>
                <th className="py-3 px-2.5 font-semibold">Expected Result</th>
                <th className="py-3 px-2.5 font-semibold">Actual Result</th>
                <th className="py-3 px-2.5 font-semibold">Status</th>
                <th className="py-3 px-2.5 font-semibold">Priority</th>
                <th className="py-3 px-2.5 font-semibold">Severity</th>
                <th className="py-3 px-2.5 font-semibold">Automation</th>
                <th className="py-3 px-2.5 font-semibold">Framework</th>
                <th className="py-3 px-2.5 font-semibold">Exec Date</th>
                <th className="py-3 px-2.5 font-semibold">Comments / Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((tc) => {
                const expanded = expandedId === tc.id;
                const sqaStatus: SqaExecutionStatus =
                  tc.sqaStatus ||
                  (tc.status === 'passed'
                    ? 'Pass'
                    : tc.status === 'failed'
                      ? 'Fail'
                      : tc.status === 'blocked'
                        ? 'Blocked'
                        : 'Not Run');
                return (
                  <tr
                    key={tc.id}
                    className="hover:bg-[var(--surface-hover)] align-top"
                  >
                    <td className="py-2.5 px-2.5">
                      <input
                        type="checkbox"
                        checked={tc.enabled}
                        onChange={() => toggleEnabled(tc.id)}
                        aria-label={`Enable ${tc.code}`}
                        className="w-4 h-4 rounded accent-[var(--accent-primary)] mt-1"
                      />
                    </td>
                    <td className="py-2.5 px-2.5 font-mono font-semibold text-[var(--accent-primary)] whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setExpandedId(expanded ? null : tc.id)}
                        className="hover:underline"
                      >
                        {tc.code}
                      </button>
                    </td>
                    <td className="py-2.5 px-2.5 whitespace-nowrap text-[var(--text-secondary)]">
                      {tc.module || tc.category}
                    </td>
                    <td className="py-2.5 px-2.5 max-w-[220px]">
                      <div className="font-medium text-[var(--text-main)]">{tc.title}</div>
                      <div className="text-[11px] text-[var(--text-muted)] line-clamp-2">
                        {tc.scenario}
                      </div>
                    </td>
                    <td className="py-2.5 px-2.5 max-w-[200px] text-[11px] text-[var(--text-secondary)]">
                      {tc.steps.length} step(s): {tc.steps[0]?.action} {tc.steps[0]?.target}
                    </td>
                    <td className="py-2.5 px-2.5 max-w-[140px] font-mono text-[11px] text-[var(--text-muted)]">
                      {tc.testData || 'N/A'}
                    </td>
                    <td className="py-2.5 px-2.5 max-w-[180px] text-[var(--text-secondary)]">
                      {tc.expectedResult}
                    </td>
                    <td className="py-2.5 px-2.5 min-w-[140px]">
                      <input
                        type="text"
                        value={tc.actualResult || ''}
                        onChange={(e) => updateCaseField(tc.id, { actualResult: e.target.value })}
                        placeholder="Record actual..."
                        className="w-full min-h-[34px] px-2 rounded surface-elevated text-[11px]"
                      />
                    </td>
                    <td className="py-2.5 px-2.5">
                      <select
                        value={sqaStatus}
                        onChange={(e) => {
                          const nextSqa = e.target.value as SqaExecutionStatus;
                          const mappedStatus =
                            nextSqa === 'Pass'
                              ? 'passed'
                              : nextSqa === 'Fail'
                                ? 'failed'
                                : nextSqa === 'Blocked'
                                  ? 'blocked'
                                  : 'pending';
                          updateCaseField(tc.id, {
                            sqaStatus: nextSqa,
                            status: mappedStatus,
                            executionDate: new Date().toISOString().slice(0, 10),
                          });
                        }}
                        className="min-h-[34px] px-2 rounded surface-elevated text-[11px] font-semibold"
                        style={{
                          color:
                            sqaStatus === 'Pass'
                              ? 'var(--status-success)'
                              : sqaStatus === 'Fail'
                                ? 'var(--status-error)'
                                : sqaStatus === 'Blocked'
                                  ? 'var(--status-warning)'
                                  : 'var(--text-muted)',
                        }}
                      >
                        <option value="Not Run">Not Run</option>
                        <option value="Pass">Pass</option>
                        <option value="Fail">Fail</option>
                        <option value="Blocked">Blocked</option>
                      </select>
                    </td>
                    <td className="py-2.5 px-2.5 whitespace-nowrap">{tc.priority || 'Medium'}</td>
                    <td className="py-2.5 px-2.5 whitespace-nowrap">{tc.severity || 'Major'}</td>
                    <td className="py-2.5 px-2.5 whitespace-nowrap">
                      {tc.automationStatus || 'Automated'}
                    </td>
                    <td className="py-2.5 px-2.5 font-mono text-[11px] max-w-[120px] truncate">
                      {frameworksLabel}
                    </td>
                    <td className="py-2.5 px-2.5 font-mono text-[11px] whitespace-nowrap">
                      {tc.executionDate || '—'}
                    </td>
                    <td className="py-2.5 px-2.5 min-w-[180px]">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={tc.comments || ''}
                          onChange={(e) => updateCaseField(tc.id, { comments: e.target.value })}
                          placeholder="Notes..."
                          className="flex-1 min-w-[90px] min-h-[34px] px-2 rounded surface-elevated text-[11px]"
                        />
                        <button
                          type="button"
                          onClick={() => onRunTests([tc.id])}
                          title="Run single test"
                          className="min-h-[34px] min-w-[34px] inline-flex items-center justify-center rounded surface-elevated hover:bg-[var(--accent-soft)]"
                        >
                          <Play className="w-3.5 h-3.5" />
                        </button>
                        {sqaStatus === 'Fail' && onLogDefectFromCase && (
                          <button
                            type="button"
                            onClick={() => onLogDefectFromCase(tc)}
                            title="Log defect from failed test"
                            className="min-h-[34px] min-w-[34px] inline-flex items-center justify-center rounded surface-elevated text-[var(--status-error)] hover:bg-red-500/10"
                          >
                            <Bug className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => deleteTestCase(tc.id)}
                          title="Delete test case"
                          className="min-h-[34px] min-w-[34px] inline-flex items-center justify-center rounded surface-elevated text-[var(--text-muted)] hover:text-[var(--status-error)]"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className="py-12 text-center text-sm text-[var(--text-muted)]">
            No test cases match your current filters.
          </div>
        )}
      </div>

      {/* Explicit Confirmation Modal for Google Sheets / Drive Mutations */}
      {pendingConfirm && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="surface-panel rounded-2xl max-w-md w-full p-5 sm:p-6 space-y-4">
            <h3 className="font-display font-bold text-lg">Confirm Google Workspace Action</h3>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
              {pendingConfirm.kind === 'create'
                ? `Create a new Google Spreadsheet in your Google Drive containing ${project.testCases.length} test case row(s) across 14 QA columns plus a "Summary Report" tab?`
                : pendingConfirm.kind === 'sync'
                  ? `Overwrite and update the "Test Cases" and "Summary Report" tabs in "${project.googleSheetTitle || project.googleSheetId}" with ${project.testCases.length} current test case row(s)?`
                  : pendingConfirm.anyoneWithLink
                    ? `Grant "${pendingConfirm.role}" link-sharing access to anyone with the URL on Google Sheet "${project.googleSheetTitle || project.googleSheetId}"?`
                    : `Share Google Sheet "${project.googleSheetTitle || project.googleSheetId}" with ${pendingConfirm.email} (${pendingConfirm.role} permission)?`}
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPendingConfirm(null)}
                className="px-4 min-h-[42px] rounded-xl text-xs font-medium surface-elevated"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeConfirmedGoogleAction}
                className="px-4 min-h-[42px] rounded-xl text-xs font-semibold"
                style={{ backgroundColor: 'var(--accent-primary)', color: 'var(--accent-contrast)' }}
              >
                Confirm &amp; Execute
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Sheet Dialog */}
      {showShareModal && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="surface-panel rounded-2xl max-w-md w-full p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-lg">Share Google Sheet</h3>
              <button
                type="button"
                onClick={() => setShowShareModal(false)}
                className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center rounded-lg hover:bg-[var(--surface-hover)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <label className="flex items-center gap-2 cursor-pointer min-h-[38px]">
                <input
                  type="checkbox"
                  checked={shareAnyone}
                  onChange={(e) => setShareAnyone(e.target.checked)}
                  className="w-4 h-4 rounded accent-[var(--accent-primary)]"
                />
                <span>Allow anyone with the Google Sheets link</span>
              </label>
              {!shareAnyone && (
                <div className="space-y-1">
                  <label className="text-[var(--text-secondary)]">Collaborator Email</label>
                  <input
                    type="email"
                    value={shareEmail}
                    onChange={(e) => setShareEmail(e.target.value)}
                    placeholder="teammate@gmail.com"
                    className="w-full min-h-[42px] px-3 rounded-lg surface-elevated"
                  />
                </div>
              )}
              <div className="space-y-1">
                <label className="text-[var(--text-secondary)]">Access Level</label>
                <select
                  value={shareRole}
                  onChange={(e) => setShareRole(e.target.value as 'reader' | 'writer')}
                  className="w-full min-h-[42px] px-3 rounded-lg surface-elevated"
                >
                  <option value="reader">Viewer (Read-only)</option>
                  <option value="writer">Editor (Can edit rows)</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowShareModal(false)}
                className="px-4 min-h-[42px] rounded-xl text-xs surface-elevated"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!shareAnyone && !shareEmail.includes('@')}
                onClick={() => {
                  setShowShareModal(false);
                  setPendingConfirm({
                    kind: 'share',
                    email: shareEmail,
                    role: shareRole,
                    anyoneWithLink: shareAnyone,
                  });
                }}
                className="px-4 min-h-[42px] rounded-xl text-xs font-semibold disabled:opacity-40"
                style={{ backgroundColor: 'var(--accent-primary)', color: 'var(--accent-contrast)' }}
              >
                Review &amp; Share
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
