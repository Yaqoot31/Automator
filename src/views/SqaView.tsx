import { useState, useMemo } from 'react';
import {
  ClipboardCheck,
  Plus,
  Trash2,
  Bug,
  Layers,
  GitBranch,
  Rocket,
  PlayCircle,
  CheckCircle2,
  AlertTriangle,
  Globe,
  FileText,
} from 'lucide-react';
import type {
  AutomationProject,
  DefectStatus,
  SqaDefect,
  SqaExecutionStatus,
  SqaRelease,
  SqaRequirement,
  SqaTestPlan,
  SqaTestSuite,
  TestCase,
  TestingType,
  TestPriority,
  TestSeverity,
  WorkspaceView,
} from '@/types';

export type SqaTab = 'plan' | 'cases' | 'execution' | 'defects' | 'suites' | 'rtm' | 'releases';

interface SqaViewProps {
  project: AutomationProject | null;
  userName: string;
  plans: SqaTestPlan[];
  suites: SqaTestSuite[];
  defects: SqaDefect[];
  requirements: SqaRequirement[];
  releases: SqaRelease[];
  initialTab?: SqaTab;
  prefillDefectFromCase?: TestCase | null;
  onSavePlan: (plan: Partial<SqaTestPlan>) => Promise<void>;
  onDeletePlan: (id: string) => Promise<void>;
  onSaveSuite: (suite: Partial<SqaTestSuite>) => Promise<void>;
  onDeleteSuite: (id: string) => Promise<void>;
  onSaveDefect: (defect: Partial<SqaDefect>) => Promise<void>;
  onDeleteDefect: (id: string) => Promise<void>;
  onSaveRequirement: (req: Partial<SqaRequirement>) => Promise<void>;
  onDeleteRequirement: (id: string) => Promise<void>;
  onSaveRelease: (rel: Partial<SqaRelease>) => Promise<void>;
  onDeleteRelease: (id: string) => Promise<void>;
  onUpdateTestCases: (testCases: TestCase[]) => Promise<void>;
  onNavigate: (view: WorkspaceView) => void;
}

const DEFECT_STATUSES: DefectStatus[] = [
  'New',
  'Assigned',
  'In Progress',
  'Fixed',
  'Retest',
  'Reopened',
  'Closed',
];

const TESTING_TYPES: TestingType[] = [
  'Automated',
  'Manual',
  'Regression',
  'Smoke',
  'Sanity',
  'Functional',
  'Integration',
  'Responsive',
  'Cross-Browser',
];

const TABS: { id: SqaTab; label: string; icon: typeof FileText }[] = [
  { id: 'plan', label: 'Test Plan', icon: FileText },
  { id: 'cases', label: 'Test Cases', icon: ClipboardCheck },
  { id: 'execution', label: 'Execution', icon: PlayCircle },
  { id: 'defects', label: 'Defects', icon: Bug },
  { id: 'suites', label: 'Suites', icon: Layers },
  { id: 'rtm', label: 'RTM Matrix', icon: GitBranch },
  { id: 'releases', label: 'Releases', icon: Rocket },
];

export function SqaView({
  project,
  userName,
  plans,
  suites,
  defects,
  requirements,
  releases,
  initialTab = 'plan',
  prefillDefectFromCase,
  onSavePlan,
  onDeletePlan,
  onSaveSuite,
  onDeleteSuite,
  onSaveDefect,
  onDeleteDefect,
  onSaveRequirement,
  onDeleteRequirement,
  onSaveRelease,
  onDeleteRelease,
  onUpdateTestCases,
  onNavigate,
}: SqaViewProps) {
  const [activeTab, setActiveTab] = useState<SqaTab>(() =>
    prefillDefectFromCase ? 'defects' : initialTab
  );
  const [saving, setSaving] = useState(false);

  // Plan form
  const [planTitle, setPlanTitle] = useState('');
  const [planStrategy, setPlanStrategy] = useState('');
  const [planScope, setPlanScope] = useState('');
  const [planObjectives, setPlanObjectives] = useState('');
  const [planResources, setPlanResources] = useState('');
  const [planReleaseTarget, setPlanReleaseTarget] = useState('v1.0.0');
  const [planStatus, setPlanStatus] = useState<SqaTestPlan['status']>('Active');

  // Execution filter
  const [execTypeFilter, setExecTypeFilter] = useState<'all' | TestingType>('all');

  // Defect form
  const [bugTitle, setBugTitle] = useState(() =>
    prefillDefectFromCase
      ? `Failure in ${prefillDefectFromCase.code}: ${prefillDefectFromCase.title}`
      : ''
  );
  const [bugDesc, setBugDesc] = useState(() => prefillDefectFromCase?.scenario || '');
  const [bugSteps, setBugSteps] = useState(() =>
    prefillDefectFromCase
      ? prefillDefectFromCase.steps
          .map((s) => `${s.stepNumber}. ${s.action} ${s.target}`)
          .join('\n')
      : ''
  );
  const [bugExpected, setBugExpected] = useState(
    () => prefillDefectFromCase?.expectedResult || ''
  );
  const [bugActual, setBugActual] = useState(() =>
    prefillDefectFromCase
      ? prefillDefectFromCase.actualResult || 'Assertion failed during test run'
      : ''
  );
  const [bugSeverity, setBugSeverity] = useState<TestSeverity>(
    () => prefillDefectFromCase?.severity || 'Major'
  );
  const [bugPriority, setBugPriority] = useState<TestPriority>(
    () => prefillDefectFromCase?.priority || 'High'
  );
  const [bugAssignee, setBugAssignee] = useState('');
  const [bugLinkedCaseId, setBugLinkedCaseId] = useState(
    () => prefillDefectFromCase?.id || ''
  );
  const [defectStatusFilter, setDefectStatusFilter] = useState<'all' | DefectStatus>('all');

  // Suite form
  const [suiteName, setSuiteName] = useState('');
  const [suiteType, setSuiteType] = useState<SqaTestSuite['suiteType']>('Regression');
  const [suiteDesc, setSuiteDesc] = useState('');
  const [suiteSelectedIds, setSuiteSelectedIds] = useState<string[]>([]);

  // RTM form
  const [reqType, setReqType] = useState<'Business' | 'Functional'>('Functional');
  const [reqModule, setReqModule] = useState('Core');
  const [reqTitle, setReqTitle] = useState('');
  const [reqDesc, setReqDesc] = useState('');
  const [reqPriority, setReqPriority] = useState<TestPriority>('High');
  const [reqLinkedCases, setReqLinkedCases] = useState<string[]>([]);

  // Release form
  const [relVersion, setRelVersion] = useState('v1.0.0');
  const [relName, setRelName] = useState('');
  const [relBuild, setRelBuild] = useState('');
  const [relEnv, setRelEnv] = useState<SqaRelease['environment']>('staging');
  const [relTargetDate, setRelTargetDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [relNotes, setRelNotes] = useState('');

  const projectPlans = useMemo(
    () => plans.filter((p) => !project || p.projectId === project.id),
    [plans, project]
  );
  const projectSuites = useMemo(
    () => suites.filter((s) => !project || s.projectId === project.id),
    [suites, project]
  );
  const projectDefects = useMemo(
    () => defects.filter((d) => !project || d.projectId === project.id),
    [defects, project]
  );
  const projectRequirements = useMemo(
    () => requirements.filter((r) => !project || r.projectId === project.id),
    [requirements, project]
  );
  const projectReleases = useMemo(
    () => releases.filter((r) => !project || r.projectId === project.id),
    [releases, project]
  );

  const testCases = useMemo(() => project?.testCases || [], [project?.testCases]);

  const rtmStats = useMemo(() => {
    const total = projectRequirements.length;
    const covered = projectRequirements.filter((r) => r.linkedTestCaseIds.length > 0).length;
    const pct = total > 0 ? Math.round((covered / total) * 100) : 0;
    return { total, covered, gaps: total - covered, pct };
  }, [projectRequirements]);

  if (!project) {
    return (
      <div className="max-w-[960px] mx-auto px-4 py-16 text-center">
        <div className="surface-panel rounded-2xl p-10 space-y-4">
          <Globe className="w-10 h-10 mx-auto text-[var(--accent-primary)]" />
          <h2 className="font-display font-bold text-xl">Select or Analyze a Project First</h2>
          <p className="text-sm text-[var(--text-secondary)] max-w-md mx-auto">
            SQA Test Plans, Executions, Defects, Suites, RTM Traceability, and Releases are organized per automation project.
          </p>
          <button
            type="button"
            onClick={() => onNavigate('analyzer')}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold"
            style={{ backgroundColor: 'var(--accent-primary)', color: 'var(--accent-contrast)' }}
          >
            Analyze Website URL
          </button>
        </div>
      </div>
    );
  }

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planTitle.trim()) return;
    setSaving(true);
    try {
      await onSavePlan({
        projectId: project.id,
        title: planTitle.trim(),
        strategy: planStrategy.trim(),
        scope: planScope.trim(),
        objectives: planObjectives.trim(),
        resources: planResources.trim(),
        releaseTarget: planReleaseTarget.trim(),
        status: planStatus,
      });
      setPlanTitle('');
      setPlanStrategy('');
      setPlanScope('');
      setPlanObjectives('');
      setPlanResources('');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateDefect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bugTitle.trim()) return;
    setSaving(true);
    try {
      await onSaveDefect({
        projectId: project.id,
        title: bugTitle.trim(),
        description: bugDesc.trim(),
        stepsToReproduce: bugSteps.trim(),
        expectedResult: bugExpected.trim(),
        actualResult: bugActual.trim(),
        severity: bugSeverity,
        priority: bugPriority,
        assignedDeveloper: bugAssignee.trim() || 'Unassigned',
        reportedBy: userName,
        status: 'New',
        linkedTestCaseId: bugLinkedCaseId || undefined,
      });
      setBugTitle('');
      setBugDesc('');
      setBugSteps('');
      setBugExpected('');
      setBugActual('');
      setBugAssignee('');
      setBugLinkedCaseId('');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateSuite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!suiteName.trim()) return;
    setSaving(true);
    try {
      await onSaveSuite({
        projectId: project.id,
        name: suiteName.trim(),
        suiteType,
        description: suiteDesc.trim(),
        testCaseIds: suiteSelectedIds,
      });
      setSuiteName('');
      setSuiteDesc('');
      setSuiteSelectedIds([]);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateRequirement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqTitle.trim()) return;
    setSaving(true);
    try {
      await onSaveRequirement({
        projectId: project.id,
        type: reqType,
        module: reqModule.trim() || 'Core',
        title: reqTitle.trim(),
        description: reqDesc.trim(),
        priority: reqPriority,
        linkedTestCaseIds: reqLinkedCases,
        linkedDefectIds: [],
      });
      setReqTitle('');
      setReqDesc('');
      setReqLinkedCases([]);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateRelease = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!relName.trim()) return;
    setSaving(true);
    try {
      await onSaveRelease({
        projectId: project.id,
        version: relVersion.trim(),
        name: relName.trim(),
        buildNumber: relBuild.trim() || `build-${Date.now().toString().slice(-5)}`,
        environment: relEnv,
        targetDate: relTargetDate,
        buildVerified: false,
        readinessStatus: 'Pending',
        approvalStatus: 'Pending',
        notes: relNotes.trim(),
      });
      setRelName('');
      setRelBuild('');
      setRelNotes('');
    } finally {
      setSaving(false);
    }
  };

  const updateCaseSqa = async (tcId: string, patch: Partial<TestCase>) => {
    await onUpdateTestCases(
      testCases.map((t) => (t.id === tcId ? { ...t, ...patch } : t))
    );
  };

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-5 animate-view-enter">
      {/* Header */}
      <div className="surface-panel rounded-2xl p-4 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <div className="text-xs font-medium text-[var(--text-muted)]">
            Software Quality Assurance Lifecycle · {project.name}
          </div>
          <h1 className="font-display font-bold text-xl sm:text-2xl text-[var(--text-main)]">
            SQA Management Console
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
            Plans ({projectPlans.length}) · Suites ({projectSuites.length}) · Open Defects ({projectDefects.filter((d) => d.status !== 'Closed').length}) · RTM Coverage ({rtmStats.pct}%) · Releases ({projectReleases.length})
          </p>
        </div>

        {/* Scrollable 7-Tab Bar */}
        <div className="flex items-center gap-1 p-1 rounded-xl surface-elevated overflow-x-auto no-scrollbar max-w-full">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 min-h-[40px] transition-colors ${
                  active
                    ? 'bg-[var(--surface-panel)] text-[var(--text-main)] shadow-xs'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-main)]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB 1: TEST PLAN */}
      {activeTab === 'plan' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <form onSubmit={handleCreatePlan} className="lg:col-span-5 surface-panel rounded-2xl p-4 sm:p-5 space-y-3 text-xs h-fit">
            <div className="text-sm font-semibold">Create Test Plan</div>
            <input
              type="text"
              required
              value={planTitle}
              onChange={(e) => setPlanTitle(e.target.value)}
              placeholder="Plan Title (e.g. Q4 Checkout Regression Plan)"
              className="w-full min-h-[42px] px-3 rounded-lg surface-elevated"
            />
            <textarea
              rows={2}
              value={planStrategy}
              onChange={(e) => setPlanStrategy(e.target.value)}
              placeholder="Testing Strategy (Automated Playwright + Manual Exploratory)..."
              className="w-full p-3 rounded-lg surface-elevated"
            />
            <textarea
              rows={2}
              value={planScope}
              onChange={(e) => setPlanScope(e.target.value)}
              placeholder="In-Scope & Out-of-Scope modules..."
              className="w-full p-3 rounded-lg surface-elevated"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={planObjectives}
                onChange={(e) => setPlanObjectives(e.target.value)}
                placeholder="Objectives (e.g. 95% pass)"
                className="min-h-[42px] px-3 rounded-lg surface-elevated"
              />
              <input
                type="text"
                value={planResources}
                onChange={(e) => setPlanResources(e.target.value)}
                placeholder="Assigned SQA Engineers"
                className="min-h-[42px] px-3 rounded-lg surface-elevated"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={planReleaseTarget}
                onChange={(e) => setPlanReleaseTarget(e.target.value)}
                placeholder="Release Target (v1.0.0)"
                className="min-h-[42px] px-3 rounded-lg surface-elevated font-mono"
              />
              <select
                value={planStatus}
                onChange={(e) => setPlanStatus(e.target.value as SqaTestPlan['status'])}
                className="min-h-[42px] px-3 rounded-lg surface-elevated"
              >
                <option value="Draft">Draft</option>
                <option value="Active">Active</option>
                <option value="Approved">Approved</option>
                <option value="Completed">Completed</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="w-full min-h-[44px] rounded-xl font-semibold inline-flex items-center justify-center gap-1.5"
              style={{ backgroundColor: 'var(--accent-primary)', color: 'var(--accent-contrast)' }}
            >
              <Plus className="w-4 h-4" />
              <span>Save Test Plan</span>
            </button>
          </form>

          <div className="lg:col-span-7 space-y-3">
            {projectPlans.map((plan) => (
              <div key={plan.id} className="surface-panel rounded-2xl p-4 sm:p-5 space-y-2.5 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-mono text-[11px] text-[var(--text-muted)]">
                      {plan.releaseTarget} · {plan.status}
                    </div>
                    <h3 className="font-display font-bold text-base text-[var(--text-main)]">
                      {plan.title}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={plan.status}
                      onChange={(e) =>
                        onSavePlan({ ...plan, status: e.target.value as SqaTestPlan['status'] })
                      }
                      className="min-h-[36px] px-2 rounded-lg surface-elevated text-[11px]"
                    >
                      <option value="Draft">Draft</option>
                      <option value="Active">Active</option>
                      <option value="Approved">Approved</option>
                      <option value="Completed">Completed</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => onDeletePlan(plan.id)}
                      aria-label="Delete plan"
                      className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg surface-elevated text-[var(--status-error)]"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                {plan.strategy && (
                  <p className="text-[var(--text-secondary)]">
                    <strong className="text-[var(--text-main)]">Strategy:</strong> {plan.strategy}
                  </p>
                )}
                {plan.scope && (
                  <p className="text-[var(--text-secondary)]">
                    <strong className="text-[var(--text-main)]">Scope:</strong> {plan.scope}
                  </p>
                )}
                {(plan.objectives || plan.resources) && (
                  <div className="text-[var(--text-muted)]">
                    {plan.objectives && `Objectives: ${plan.objectives}`}
                    {plan.objectives && plan.resources && ' · '}
                    {plan.resources && `Team: ${plan.resources}`}
                  </div>
                )}
              </div>
            ))}
            {projectPlans.length === 0 && (
              <div className="surface-panel rounded-2xl p-8 text-center text-xs text-[var(--text-muted)]">
                No SQA Test Plans created for this project yet.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: CASES OVERVIEW */}
      {activeTab === 'cases' && (
        <div className="surface-panel rounded-2xl p-4 sm:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="font-display font-bold text-base">Project Test Case Inventory ({testCases.length})</h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Use the 14-Column Test Cases Matrix for Google Sheets sync, Excel export, and bulk creation.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('tests')}
              className="px-4 min-h-[42px] rounded-xl text-xs font-semibold"
              style={{ backgroundColor: 'var(--accent-primary)', color: 'var(--accent-contrast)' }}
            >
              Open Full 14-Column Matrix
            </button>
          </div>
          <div className="divide-y">
            {testCases.slice(0, 30).map((tc) => (
              <div key={tc.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="min-w-0">
                  <span className="font-mono font-semibold text-[var(--accent-primary)]">{tc.code}</span>{' '}
                  · <span className="text-[var(--text-muted)]">{tc.module || tc.category}</span> ·{' '}
                  <span className="font-medium text-[var(--text-main)]">{tc.title}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <select
                    value={tc.testingType || 'Automated'}
                    onChange={(e) => updateCaseSqa(tc.id, { testingType: e.target.value as TestingType })}
                    className="min-h-[36px] px-2 rounded-lg surface-elevated text-[11px]"
                  >
                    {TESTING_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <span className="font-mono text-[11px] text-[var(--text-secondary)]">
                    {tc.sqaStatus || tc.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: TEST EXECUTION BOARD */}
      {activeTab === 'execution' && (
        <div className="surface-panel rounded-2xl p-4 sm:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-display font-bold text-base">Manual &amp; Typed Test Execution</h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Execute Manual, Regression, Smoke, Sanity, Functional, Integration, Responsive, and Cross-Browser test passes.
              </p>
            </div>
            <select
              value={execTypeFilter}
              onChange={(e) => setExecTypeFilter(e.target.value as 'all' | TestingType)}
              className="min-h-[42px] px-3 rounded-xl surface-elevated text-xs"
            >
              <option value="all">All Testing Types</option>
              {TESTING_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="divide-y">
            {testCases
              .filter((tc) => execTypeFilter === 'all' || (tc.testingType || 'Automated') === execTypeFilter)
              .map((tc) => {
                const sqa = tc.sqaStatus || 'Not Run';
                return (
                  <div key={tc.id} className="py-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="font-mono text-[11px] text-[var(--text-muted)]">
                        <span className="text-[var(--accent-primary)] font-semibold">{tc.code}</span> ·{' '}
                        {tc.testingType || 'Automated'} · {tc.module || tc.category}
                      </div>
                      <div className="font-semibold text-sm text-[var(--text-main)]">{tc.title}</div>
                      <div className="text-[var(--text-secondary)]">Expected: {tc.expectedResult}</div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <input
                        type="text"
                        value={tc.actualResult || ''}
                        onChange={(e) => updateCaseSqa(tc.id, { actualResult: e.target.value })}
                        placeholder="Actual result note..."
                        className="min-h-[38px] px-2.5 rounded-lg surface-elevated text-xs w-48"
                      />
                      {(['Pass', 'Fail', 'Blocked', 'Not Run'] as SqaExecutionStatus[]).map((st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() =>
                            updateCaseSqa(tc.id, {
                              sqaStatus: st,
                              status:
                                st === 'Pass'
                                  ? 'passed'
                                  : st === 'Fail'
                                    ? 'failed'
                                    : st === 'Blocked'
                                      ? 'blocked'
                                      : 'pending',
                              executionDate: new Date().toISOString().slice(0, 10),
                            })
                          }
                          className={`px-3 min-h-[38px] rounded-lg font-semibold border transition-colors ${
                            sqa === st
                              ? 'border-[var(--accent-primary)] bg-[var(--accent-soft)] text-[var(--text-main)]'
                              : 'surface-elevated border-transparent text-[var(--text-secondary)]'
                          }`}
                        >
                          {st}
                        </button>
                      ))}
                      {sqa === 'Fail' && (
                        <button
                          type="button"
                          onClick={() => {
                            setBugTitle(`Failure in ${tc.code}: ${tc.title}`);
                            setBugExpected(tc.expectedResult);
                            setBugActual(tc.actualResult || 'Manual execution marked Fail');
                            setBugLinkedCaseId(tc.id);
                            setActiveTab('defects');
                          }}
                          className="px-3 min-h-[38px] rounded-lg bg-red-500/15 text-red-400 font-semibold inline-flex items-center gap-1"
                        >
                          <Bug className="w-3.5 h-3.5" />
                          <span>Log Bug</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* TAB 4: DEFECT / BUG MANAGEMENT */}
      {activeTab === 'defects' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <form onSubmit={handleCreateDefect} className="lg:col-span-5 surface-panel rounded-2xl p-4 sm:p-5 space-y-3 text-xs h-fit">
            <div className="text-sm font-semibold flex items-center gap-2">
              <Bug className="w-4 h-4 text-[var(--status-error)]" />
              <span>Report New Defect</span>
            </div>
            <input
              type="text"
              required
              value={bugTitle}
              onChange={(e) => setBugTitle(e.target.value)}
              placeholder="Defect title"
              className="w-full min-h-[42px] px-3 rounded-lg surface-elevated"
            />
            <textarea
              rows={2}
              value={bugDesc}
              onChange={(e) => setBugDesc(e.target.value)}
              placeholder="Description & impact"
              className="w-full p-3 rounded-lg surface-elevated"
            />
            <textarea
              rows={2}
              value={bugSteps}
              onChange={(e) => setBugSteps(e.target.value)}
              placeholder="Steps to reproduce..."
              className="w-full p-3 rounded-lg surface-elevated"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={bugExpected}
                onChange={(e) => setBugExpected(e.target.value)}
                placeholder="Expected behavior"
                className="min-h-[42px] px-3 rounded-lg surface-elevated"
              />
              <input
                type="text"
                value={bugActual}
                onChange={(e) => setBugActual(e.target.value)}
                placeholder="Actual behavior"
                className="min-h-[42px] px-3 rounded-lg surface-elevated"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={bugSeverity}
                onChange={(e) => setBugSeverity(e.target.value as TestSeverity)}
                className="min-h-[42px] px-3 rounded-lg surface-elevated"
              >
                <option value="Critical">Severity: Critical</option>
                <option value="Major">Severity: Major</option>
                <option value="Minor">Severity: Minor</option>
              </select>
              <select
                value={bugPriority}
                onChange={(e) => setBugPriority(e.target.value as TestPriority)}
                className="min-h-[42px] px-3 rounded-lg surface-elevated"
              >
                <option value="Critical">Priority: Critical</option>
                <option value="High">Priority: High</option>
                <option value="Medium">Priority: Medium</option>
                <option value="Low">Priority: Low</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={bugAssignee}
                onChange={(e) => setBugAssignee(e.target.value)}
                placeholder="Assigned developer"
                className="min-h-[42px] px-3 rounded-lg surface-elevated"
              />
              <select
                value={bugLinkedCaseId}
                onChange={(e) => setBugLinkedCaseId(e.target.value)}
                className="min-h-[42px] px-3 rounded-lg surface-elevated"
              >
                <option value="">Link Test Case (optional)</option>
                {testCases.map((tc) => (
                  <option key={tc.id} value={tc.id}>
                    {tc.code} — {tc.title.slice(0, 28)}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="w-full min-h-[44px] rounded-xl font-semibold"
              style={{ backgroundColor: 'var(--accent-primary)', color: 'var(--accent-contrast)' }}
            >
              Log Defect
            </button>
          </form>

          <div className="lg:col-span-7 space-y-3">
            <div className="surface-panel rounded-xl p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-semibold">Defect Tracker ({projectDefects.length})</span>
              <select
                value={defectStatusFilter}
                onChange={(e) => setDefectStatusFilter(e.target.value as 'all' | DefectStatus)}
                className="min-h-[38px] px-2.5 rounded-lg surface-elevated"
              >
                <option value="all">All 7 Lifecycle Statuses</option>
                {DEFECT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {projectDefects
              .filter((d) => defectStatusFilter === 'all' || d.status === defectStatusFilter)
              .map((defect) => (
                <div key={defect.id} className="surface-panel rounded-2xl p-4 space-y-2.5 text-xs">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-mono text-[11px] text-[var(--text-muted)]">
                        <span className="text-[var(--status-error)] font-semibold">{defect.bugCode}</span> ·{' '}
                        {defect.severity} · {defect.priority} · Assigned: {defect.assignedDeveloper}
                      </div>
                      <h3 className="font-display font-bold text-sm text-[var(--text-main)] mt-0.5">
                        {defect.title}
                      </h3>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <select
                        value={defect.status}
                        onChange={(e) =>
                          onSaveDefect({ ...defect, status: e.target.value as DefectStatus })
                        }
                        className="min-h-[36px] px-2.5 rounded-lg surface-elevated font-semibold"
                      >
                        {DEFECT_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => onDeleteDefect(defect.id)}
                        className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg surface-elevated text-[var(--status-error)]"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  {defect.description && (
                    <p className="text-[var(--text-secondary)]">{defect.description}</p>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-[var(--text-secondary)]">
                    <div>
                      <strong>Expected:</strong> {defect.expectedResult || '—'}
                    </div>
                    <div>
                      <strong>Actual:</strong> {defect.actualResult || '—'}
                    </div>
                  </div>
                </div>
              ))}
            {projectDefects.length === 0 && (
              <div className="surface-panel rounded-2xl p-8 text-center text-xs text-[var(--text-muted)]">
                Zero defects reported for this project.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: TEST SUITES */}
      {activeTab === 'suites' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <form onSubmit={handleCreateSuite} className="lg:col-span-5 surface-panel rounded-2xl p-4 sm:p-5 space-y-3 text-xs h-fit">
            <div className="text-sm font-semibold">Create Test Suite</div>
            <input
              type="text"
              required
              value={suiteName}
              onChange={(e) => setSuiteName(e.target.value)}
              placeholder="Suite Name (e.g. Core Smoke Suite)"
              className="w-full min-h-[42px] px-3 rounded-lg surface-elevated"
            />
            <select
              value={suiteType}
              onChange={(e) => setSuiteType(e.target.value as SqaTestSuite['suiteType'])}
              className="w-full min-h-[42px] px-3 rounded-lg surface-elevated"
            >
              <option value="Regression">Regression</option>
              <option value="Smoke">Smoke</option>
              <option value="Sanity">Sanity</option>
              <option value="Release">Release</option>
              <option value="Functional">Functional</option>
              <option value="Integration">Integration</option>
            </select>
            <input
              type="text"
              value={suiteDesc}
              onChange={(e) => setSuiteDesc(e.target.value)}
              placeholder="Suite purpose & trigger criteria"
              className="w-full min-h-[42px] px-3 rounded-lg surface-elevated"
            />
            <div className="space-y-1.5">
              <div className="font-medium text-[var(--text-secondary)]">
                Include Test Cases ({suiteSelectedIds.length} selected)
              </div>
              <div className="max-h-44 overflow-y-auto border rounded-lg p-2 space-y-1">
                {testCases.map((tc) => (
                  <label key={tc.id} className="flex items-center gap-2 py-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={suiteSelectedIds.includes(tc.id)}
                      onChange={() =>
                        setSuiteSelectedIds((prev) =>
                          prev.includes(tc.id) ? prev.filter((id) => id !== tc.id) : [...prev, tc.id]
                        )
                      }
                      className="w-4 h-4 rounded accent-[var(--accent-primary)]"
                    />
                    <span className="font-mono text-[var(--accent-primary)]">{tc.code}</span>
                    <span className="truncate">{tc.title}</span>
                  </label>
                ))}
              </div>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="w-full min-h-[44px] rounded-xl font-semibold"
              style={{ backgroundColor: 'var(--accent-primary)', color: 'var(--accent-contrast)' }}
            >
              Save Test Suite
            </button>
          </form>

          <div className="lg:col-span-7 space-y-3">
            {projectSuites.map((s) => (
              <div key={s.id} className="surface-panel rounded-2xl p-4 space-y-2 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-mono text-[11px] text-[var(--text-muted)]">
                      {s.suiteType} · {s.testCaseIds.length} test case(s)
                    </div>
                    <h3 className="font-display font-bold text-base text-[var(--text-main)]">{s.name}</h3>
                    {s.description && <p className="text-[var(--text-secondary)] mt-1">{s.description}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => onDeleteSuite(s.id)}
                    className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg surface-elevated text-[var(--status-error)]"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
            {projectSuites.length === 0 && (
              <div className="surface-panel rounded-2xl p-8 text-center text-xs text-[var(--text-muted)]">
                No test suites created yet.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 6: RTM TRACEABILITY MATRIX */}
      {activeTab === 'rtm' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="surface-panel rounded-xl p-4">
              <div className="text-xs text-[var(--text-muted)]">Total Requirements</div>
              <div className="font-mono font-bold text-2xl tabular-nums mt-1">{rtmStats.total}</div>
            </div>
            <div className="surface-panel rounded-xl p-4">
              <div className="text-xs text-[var(--text-muted)]">Covered Requirements</div>
              <div className="font-mono font-bold text-2xl tabular-nums mt-1 text-[var(--status-success)]">
                {rtmStats.covered}
              </div>
            </div>
            <div className="surface-panel rounded-xl p-4">
              <div className="text-xs text-[var(--text-muted)]">Uncovered Gaps</div>
              <div className="font-mono font-bold text-2xl tabular-nums mt-1 text-[var(--status-warning)]">
                {rtmStats.gaps}
              </div>
            </div>
            <div className="surface-panel rounded-xl p-4">
              <div className="text-xs text-[var(--text-muted)]">RTM Coverage</div>
              <div className="font-mono font-bold text-2xl tabular-nums mt-1 text-[var(--accent-primary)]">
                {rtmStats.pct}%
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <form onSubmit={handleCreateRequirement} className="lg:col-span-4 surface-panel rounded-2xl p-4 sm:p-5 space-y-3 text-xs h-fit">
              <div className="text-sm font-semibold">Add Requirement to RTM</div>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={reqType}
                  onChange={(e) => setReqType(e.target.value as 'Business' | 'Functional')}
                  className="min-h-[42px] px-3 rounded-lg surface-elevated"
                >
                  <option value="Functional">Functional</option>
                  <option value="Business">Business</option>
                </select>
                <input
                  type="text"
                  value={reqModule}
                  onChange={(e) => setReqModule(e.target.value)}
                  placeholder="Module"
                  className="min-h-[42px] px-3 rounded-lg surface-elevated"
                />
              </div>
              <input
                type="text"
                required
                value={reqTitle}
                onChange={(e) => setReqTitle(e.target.value)}
                placeholder="Requirement Title"
                className="w-full min-h-[42px] px-3 rounded-lg surface-elevated"
              />
              <textarea
                rows={2}
                value={reqDesc}
                onChange={(e) => setReqDesc(e.target.value)}
                placeholder="Acceptance criteria..."
                className="w-full p-3 rounded-lg surface-elevated"
              />
              <select
                value={reqPriority}
                onChange={(e) => setReqPriority(e.target.value as TestPriority)}
                className="w-full min-h-[42px] px-3 rounded-lg surface-elevated"
              >
                <option value="Critical">Critical</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
              <div className="space-y-1">
                <div className="font-medium text-[var(--text-secondary)]">
                  Link Test Cases ({reqLinkedCases.length})
                </div>
                <div className="max-h-36 overflow-y-auto border rounded-lg p-2 space-y-1">
                  {testCases.map((tc) => (
                    <label key={tc.id} className="flex items-center gap-2 py-0.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={reqLinkedCases.includes(tc.id)}
                        onChange={() =>
                          setReqLinkedCases((prev) =>
                            prev.includes(tc.id) ? prev.filter((id) => id !== tc.id) : [...prev, tc.id]
                          )
                        }
                        className="w-4 h-4 rounded accent-[var(--accent-primary)]"
                      />
                      <span className="font-mono">{tc.code}</span>
                      <span className="truncate">{tc.title}</span>
                    </label>
                  ))}
                </div>
              </div>
              <button
                type="submit"
                disabled={saving}
                className="w-full min-h-[44px] rounded-xl font-semibold"
                style={{ backgroundColor: 'var(--accent-primary)', color: 'var(--accent-contrast)' }}
              >
                Save Requirement
              </button>
            </form>

            <div className="lg:col-span-8 surface-panel rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="surface-elevated text-[var(--text-secondary)] border-b">
                    <tr>
                      <th className="py-3 px-3 font-semibold">Req ID</th>
                      <th className="py-3 px-3 font-semibold">Module · Type</th>
                      <th className="py-3 px-3 font-semibold">Requirement</th>
                      <th className="py-3 px-3 font-semibold">Linked Cases</th>
                      <th className="py-3 px-3 font-semibold">Status</th>
                      <th className="py-3 px-3 font-semibold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {projectRequirements.map((r) => {
                      const covered = r.linkedTestCaseIds.length > 0;
                      return (
                        <tr key={r.id} className="hover:bg-[var(--surface-hover)]">
                          <td className="py-3 px-3 font-mono font-semibold text-[var(--accent-primary)]">
                            {r.reqCode}
                          </td>
                          <td className="py-3 px-3 text-[var(--text-secondary)]">
                            {r.module} · {r.type}
                          </td>
                          <td className="py-3 px-3 font-medium text-[var(--text-main)]">{r.title}</td>
                          <td className="py-3 px-3 font-mono tabular-nums">
                            {r.linkedTestCaseIds.length} test(s)
                          </td>
                          <td className="py-3 px-3">
                            {covered ? (
                              <span className="inline-flex items-center gap-1 text-[var(--status-success)] font-semibold">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Covered
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[var(--status-warning)] font-semibold">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                Uncovered Gap
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => onDeleteRequirement(r.id)}
                              className="min-h-[34px] min-w-[34px] inline-flex items-center justify-center rounded-lg surface-elevated text-[var(--status-error)]"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {projectRequirements.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-10 text-center text-[var(--text-muted)]">
                          No requirements mapped in RTM yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: RELEASES & QUALITY GATE */}
      {activeTab === 'releases' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <form onSubmit={handleCreateRelease} className="lg:col-span-5 surface-panel rounded-2xl p-4 sm:p-5 space-y-3 text-xs h-fit">
            <div className="text-sm font-semibold">Register Release Candidate</div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                required
                value={relVersion}
                onChange={(e) => setRelVersion(e.target.value)}
                placeholder="Version (v1.2.0)"
                className="min-h-[42px] px-3 rounded-lg surface-elevated font-mono"
              />
              <input
                type="text"
                value={relBuild}
                onChange={(e) => setRelBuild(e.target.value)}
                placeholder="Build # (auto if blank)"
                className="min-h-[42px] px-3 rounded-lg surface-elevated font-mono"
              />
            </div>
            <input
              type="text"
              required
              value={relName}
              onChange={(e) => setRelName(e.target.value)}
              placeholder="Release Name (e.g. Autumn Quality Milestone)"
              className="w-full min-h-[42px] px-3 rounded-lg surface-elevated"
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                value={relEnv}
                onChange={(e) => setRelEnv(e.target.value as SqaRelease['environment'])}
                className="min-h-[42px] px-3 rounded-lg surface-elevated"
              >
                <option value="qa">QA</option>
                <option value="staging">Staging</option>
                <option value="production">Production</option>
              </select>
              <input
                type="date"
                value={relTargetDate}
                onChange={(e) => setRelTargetDate(e.target.value)}
                className="min-h-[42px] px-3 rounded-lg surface-elevated font-mono"
              />
            </div>
            <textarea
              rows={2}
              value={relNotes}
              onChange={(e) => setRelNotes(e.target.value)}
              placeholder="Release verification & QA sign-off notes..."
              className="w-full p-3 rounded-lg surface-elevated"
            />
            <button
              type="submit"
              disabled={saving}
              className="w-full min-h-[44px] rounded-xl font-semibold"
              style={{ backgroundColor: 'var(--accent-primary)', color: 'var(--accent-contrast)' }}
            >
              Create Release Gate
            </button>
          </form>

          <div className="lg:col-span-7 space-y-3">
            {projectReleases.map((rel) => (
              <div key={rel.id} className="surface-panel rounded-2xl p-4 sm:p-5 space-y-3 text-xs">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                  <div>
                    <div className="font-mono text-[11px] text-[var(--text-muted)]">
                      {rel.version} · Build {rel.buildNumber} · {rel.environment.toUpperCase()} · Target {rel.targetDate}
                    </div>
                    <h3 className="font-display font-bold text-base text-[var(--text-main)] mt-0.5">
                      {rel.name}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDeleteRelease(rel.id)}
                    className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg surface-elevated text-[var(--status-error)] self-end sm:self-start"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <label className="inline-flex items-center gap-2 px-3 min-h-[40px] rounded-lg surface-elevated cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rel.buildVerified}
                      onChange={(e) => onSaveRelease({ ...rel, buildVerified: e.target.checked })}
                      className="w-4 h-4 rounded accent-[var(--accent-primary)]"
                    />
                    <span>Build Verified</span>
                  </label>

                  <select
                    value={rel.readinessStatus}
                    onChange={(e) =>
                      onSaveRelease({
                        ...rel,
                        readinessStatus: e.target.value as SqaRelease['readinessStatus'],
                      })
                    }
                    className="min-h-[40px] px-2.5 rounded-lg surface-elevated font-semibold"
                  >
                    <option value="Pending">Readiness: Pending</option>
                    <option value="Ready">Readiness: Ready</option>
                    <option value="At Risk">Readiness: At Risk</option>
                    <option value="Blocked">Readiness: Blocked</option>
                  </select>

                  <select
                    value={rel.approvalStatus}
                    onChange={(e) =>
                      onSaveRelease({
                        ...rel,
                        approvalStatus: e.target.value as SqaRelease['approvalStatus'],
                        approvedBy: e.target.value === 'Approved' ? userName : rel.approvedBy,
                      })
                    }
                    className="min-h-[40px] px-2.5 rounded-lg surface-elevated font-semibold"
                  >
                    <option value="Pending">Sign-off: Pending</option>
                    <option value="Approved">Sign-off: Approved</option>
                    <option value="Rejected">Sign-off: Rejected</option>
                  </select>
                </div>
                {rel.approvedBy && (
                  <div className="text-[11px] text-[var(--status-success)]">
                    Approved by {rel.approvedBy}
                  </div>
                )}
              </div>
            ))}
            {projectReleases.length === 0 && (
              <div className="surface-panel rounded-2xl p-8 text-center text-xs text-[var(--text-muted)]">
                No releases registered yet.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
