import { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2, ShieldAlert } from 'lucide-react';
import type {
  AppSettings,
  AutomationFramework,
  AutomationProject,
  ProjectConfig,
  ProjectFile,
  SqaDefect,
  SqaRelease,
  SqaRequirement,
  SqaTestPlan,
  SqaTestSuite,
  TestCase,
  TestRunItemResult,
  TestRunLogEntry,
  TestRunRecord,
  TestingApproach,
  UserProfile,
  UserRole,
  WorkspaceView,
} from '@/types';
import {
  addProjectMemberApi,
  analyzeWebsiteApi,
  cancelTestRunApi,
  createProjectApi,
  deleteProjectApi,
  deleteSqaDefectApi,
  deleteSqaPlanApi,
  deleteSqaReleaseApi,
  deleteSqaRequirementApi,
  deleteSqaSuiteApi,
  duplicateProjectApi,
  enhanceAiTestsApi,
  getSessionApi,
  getSqaOverviewApi,
  listProjectsApi,
  listTestRunsApi,
  logoutApi,
  regenerateProjectApi,
  removeProjectMemberApi,
  saveProjectSecretsApi,
  saveSqaDefectApi,
  saveSqaPlanApi,
  saveSqaReleaseApi,
  saveSqaRequirementApi,
  saveSqaSuiteApi,
  startTestRunApi,
  updateProjectApi,
} from '@/lib/api';
import { AuthGate } from '@/components/AuthGate';
import { TopNavAndSidebar } from '@/components/TopNavAndSidebar';
import { AnalyticsDashboardView } from '@/views/AnalyticsDashboardView';
import { AnalyzerView, type LiveAnalysisLog } from '@/views/AnalyzerView';
import { TestCasesView } from '@/views/TestCasesView';
import { SqaView, type SqaTab } from '@/views/SqaView';
import { StudioEditorView } from '@/views/StudioEditorView';
import { RunnerView } from '@/views/RunnerView';
import { ReportsView } from '@/views/ReportsView';
import { ProjectsView } from '@/views/ProjectsView';
import { SettingsView } from '@/views/SettingsView';

const SETTINGS_STORAGE_KEY = 'automator_ai_settings_v1';

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'obsidian',
  accent: 'amber',
  density: 'comfortable',
  reducedMotion: false,
  defaultFramework: 'playwright-ts',
  sidebarCollapsed: false,
  fontScale: 100,
};

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export default function App() {
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [hydratingSession, setHydratingSession] = useState(true);

  const [activeView, setActiveView] = useState<WorkspaceView>('dashboard');
  const [projects, setProjects] = useState<AutomationProject[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [runs, setRuns] = useState<TestRunRecord[]>([]);
  const [activeRun, setActiveRun] = useState<TestRunRecord | null>(null);

  // SQA State
  const [sqaPlans, setSqaPlans] = useState<SqaTestPlan[]>([]);
  const [sqaSuites, setSqaSuites] = useState<SqaTestSuite[]>([]);
  const [sqaDefects, setSqaDefects] = useState<SqaDefect[]>([]);
  const [sqaRequirements, setSqaRequirements] = useState<SqaRequirement[]>([]);
  const [sqaReleases, setSqaReleases] = useState<SqaRelease[]>([]);
  const [sqaInitialTab, setSqaInitialTab] = useState<SqaTab>('plan');
  const [prefillDefectCase, setPrefillDefectCase] = useState<TestCase | null>(null);

  // Analysis live state
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisLogs, setAnalysisLogs] = useState<LiveAnalysisLog[]>([]);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const activeJobIdRef = useRef<string | null>(null);

  // Sync theme, accent, reducedMotion, fontScale
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', settings.theme);
    root.setAttribute('data-accent', settings.accent);
    if (settings.theme === 'daylight') {
      root.classList.remove('dark');
    } else {
      root.classList.add('dark');
    }
    if (settings.reducedMotion) {
      root.classList.add('reduce-motion');
    } else {
      root.classList.remove('reduce-motion');
    }
    root.style.fontSize = `${settings.fontScale}%`;

    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Ignore storage quota issues
    }
  }, [settings]);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const toggleDarkLight = useCallback(() => {
    setSettings((prev) => ({
      ...prev,
      theme: prev.theme === 'daylight' ? 'obsidian' : 'daylight',
    }));
  }, []);

  const refreshWorkspaceData = useCallback(async (authToken: string) => {
    const [projRes, runsRes, sqaRes] = await Promise.all([
      listProjectsApi(authToken),
      listTestRunsApi(authToken),
      getSqaOverviewApi(authToken),
    ]);
    setProjects(projRes.projects);
    setRuns(runsRes.runs);
    setSqaPlans(sqaRes.plans);
    setSqaSuites(sqaRes.suites);
    setSqaDefects(sqaRes.defects);
    setSqaRequirements(sqaRes.requirements);
    setSqaReleases(sqaRes.releases);
    setActiveProjectId((prev) => {
      if (prev && projRes.projects.some((p) => p.id === prev)) return prev;
      return projRes.projects[0]?.id || null;
    });
  }, []);

  // Restore HttpOnly cookie session on initial load
  useEffect(() => {
    let mounted = true;
    getSessionApi()
      .then((res) => {
        if (!mounted) return;
        if (res.user && res.token) {
          setUser(res.user);
          setToken(res.token);
          refreshWorkspaceData(res.token).catch(() => {});
        }
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setHydratingSession(false);
      });
    return () => {
      mounted = false;
    };
  }, [refreshWorkspaceData]);

  // Real-time WebSocket subscription for analysis & test execution
  useEffect(() => {
    if (!token) return;
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${proto}//${window.location.host}/ws`);

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'auth', token }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as Record<string, unknown>;
        if (data.type === 'analysis:progress') {
          if (activeJobIdRef.current && data.jobId !== activeJobIdRef.current) return;
          setAnalysisProgress(Number(data.progress || 0));
          setAnalysisLogs((prev) => [
            ...prev.slice(-49),
            {
              stage: String(data.stage || ''),
              progress: Number(data.progress || 0),
              message: String(data.message || ''),
              level: (data.level as LiveAnalysisLog['level']) || 'info',
              timestamp: new Date().toISOString(),
            },
          ]);
        } else if (data.type === 'run:started') {
          const run = data.payload as TestRunRecord;
          setActiveRun(run);
          setRuns((prev) => [run, ...prev.filter((r) => r.id !== run.id)]);
        } else if (data.type === 'run:log') {
          const entry = data.payload as TestRunLogEntry;
          const runId = String(data.runId);
          setActiveRun((prev) =>
            prev && prev.id === runId ? { ...prev, logs: [...prev.logs, entry] } : prev
          );
        } else if (data.type === 'run:test_complete') {
          const runId = String(data.runId);
          const payload = data.payload as {
            result: TestRunItemResult;
            runSummary: {
              passed: number;
              failed: number;
              skipped: number;
              totalTests: number;
              durationMs: number;
            };
          };
          setActiveRun((prev) =>
            prev && prev.id === runId
              ? {
                  ...prev,
                  ...payload.runSummary,
                  results: [...prev.results, payload.result],
                }
              : prev
          );
        } else if (data.type === 'run:finished') {
          const finished = data.payload as TestRunRecord;
          setActiveRun(finished);
          setRuns((prev) => [finished, ...prev.filter((r) => r.id !== finished.id)]);
          refreshWorkspaceData(token).catch(() => {});
        }
      } catch {
        // Ignore malformed WS frames
      }
    };

    return () => ws.close();
  }, [token, refreshWorkspaceData]);

  const activeProject = projects.find((p) => p.id === activeProjectId) || null;

  const upsertProjectInState = (proj: AutomationProject) => {
    setProjects((prev) => [proj, ...prev.filter((p) => p.id !== proj.id)]);
    setActiveProjectId(proj.id);
  };

  const handleRunAnalysis = async (params: {
    url: string;
    framework: AutomationFramework;
    selectedFrameworks: AutomationFramework[];
    approach: TestingApproach;
    maxPages: number;
    maxDepth: number;
    respectRobots: boolean;
    followSubdomains: boolean;
  }) => {
    if (!token) return;
    const jobId = crypto.randomUUID();
    activeJobIdRef.current = jobId;
    setAnalyzing(true);
    setAnalysisProgress(2);
    setAnalysisLogs([]);
    setAnalysisError(null);

    try {
      const { analysis, testCases } = await analyzeWebsiteApi(token, {
        url: params.url,
        maxPages: params.maxPages,
        maxDepth: params.maxDepth,
        respectRobots: params.respectRobots,
        followSubdomains: params.followSubdomains,
        jobId,
      });

      const hostName = (() => {
        try {
          return new URL(analysis.url).hostname.replace(/^www\./, '');
        } catch {
          return 'Website';
        }
      })();

      const created = await createProjectApi(token, {
        name: `${hostName} Automation`,
        url: analysis.url,
        framework: params.framework,
        selectedFrameworks: params.selectedFrameworks,
        approach: params.approach,
        analysis,
        testCases,
      });

      upsertProjectInState(created.project);
      setAnalysisProgress(100);
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : 'Website analysis failed.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleUpdateTestCases = async (testCases: TestCase[]) => {
    if (!token || !activeProject) return;
    const res = await updateProjectApi(token, activeProject.id, { testCases });
    upsertProjectInState(res.project);
  };

  const handleUpdateProjectPatch = async (
    projectId: string,
    patch: Partial<AutomationProject>
  ) => {
    if (!token) return;
    const res = await updateProjectApi(token, projectId, patch);
    upsertProjectInState(res.project);
  };

  const handleSaveFiles = async (files: ProjectFile[]) => {
    if (!token || !activeProject) return;
    const res = await updateProjectApi(token, activeProject.id, { files });
    upsertProjectInState(res.project);
  };

  const handleRegenerate = async (
    framework: AutomationFramework,
    approach: TestingApproach,
    selectedFrameworks?: AutomationFramework[]
  ) => {
    if (!token || !activeProject) return;
    const res = await regenerateProjectApi(
      token,
      activeProject.id,
      framework,
      approach,
      selectedFrameworks
    );
    upsertProjectInState(res.project);
  };

  const handleSaveConfig = async (config: ProjectConfig) => {
    if (!token || !activeProject) return;
    const res = await updateProjectApi(token, activeProject.id, { config });
    upsertProjectInState(res.project);
  };

  const handleStartRun = async (testCaseIds?: string[]) => {
    if (!token || !activeProject) return;
    const res = await startTestRunApi(token, activeProject.id, testCaseIds);
    setActiveRun(res.run);
    setActiveView('runner');
  };

  const handleCancelRun = async (runId: string) => {
    if (!token) return;
    await cancelTestRunApi(token, runId);
  };

  const handleEnhanceWithAi = async (focus?: string) => {
    if (!token || !activeProject) return;
    const res = await enhanceAiTestsApi(token, activeProject.id, focus);
    upsertProjectInState(res.project);
  };

  const handleLogDefectFromCase = (tc: TestCase) => {
    setPrefillDefectCase(tc);
    setSqaInitialTab('defects');
    setActiveView('sqa');
  };

  const handleLogDefectFromRunResult = (result: TestRunItemResult) => {
    const matched = activeProject?.testCases.find((t) => t.id === result.testCaseId);
    const syntheticCase: TestCase = matched
      ? { ...matched, actualResult: result.actualResult }
      : {
          id: result.testCaseId,
          code: result.code,
          title: result.title,
          category: result.category,
          scenarioType: 'positive',
          pagePath: '/',
          scenario: result.title,
          preconditions: '',
          steps: [],
          expectedResult: 'Assertions pass cleanly',
          actualResult: result.actualResult,
          status: 'failed',
          enabled: true,
        };
    handleLogDefectFromCase(syntheticCase);
  };

  const handleSignOut = async () => {
    await logoutApi(token).catch(() => {});
    setUser(null);
    setToken(null);
    setProjects([]);
    setRuns([]);
    setSqaPlans([]);
    setSqaSuites([]);
    setSqaDefects([]);
    setSqaRequirements([]);
    setSqaReleases([]);
    setActiveProjectId(null);
    setActiveRun(null);
  };

  if (hydratingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--surface-canvas)] text-[var(--text-main)]">
        <div className="flex items-center gap-3 text-sm text-[var(--text-secondary)]">
          <Loader2 className="w-5 h-5 animate-spin text-[var(--accent-primary)]" />
          <span>Restoring secure workspace session...</span>
        </div>
      </div>
    );
  }

  if (!user || !token) {
    return (
      <AuthGate
        theme={settings.theme}
        onToggleTheme={toggleDarkLight}
        onAuthenticated={(u, t) => {
          setUser(u);
          setToken(t);
          setActiveView('dashboard');
          refreshWorkspaceData(t).catch(() => {});
        }}
      />
    );
  }

  const isRunning = activeRun?.status === 'running' || activeRun?.status === 'queued';
  const openDefectCount = sqaDefects.filter((d) => d.status !== 'Closed').length;
  const densityPadding =
    settings.density === 'compact'
      ? 'py-2'
      : settings.density === 'spacious'
        ? 'py-8'
        : 'py-4';

  const viewTitles: Record<WorkspaceView, string> = {
    dashboard: 'Executive Analytics Dashboard',
    analyzer: 'Website URL Analyzer',
    tests: 'Test Cases & Google Sheets',
    sqa: 'SQA Lifecycle Management',
    studio: 'Script Studio & IDE',
    runner: 'Live Test Runner',
    reports: 'Reports & Export Center',
    projects: 'Projects, Team & Vault',
    settings: 'Profile & Platform Settings',
  };

  return (
    <div className="min-h-screen text-[var(--text-main)] flex flex-col">
      <TopNavAndSidebar
        activeView={activeView}
        onNavigate={(v) => {
          setActiveView(v);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        sidebarCollapsed={settings.sidebarCollapsed}
        onToggleSidebar={() =>
          updateSettings({ sidebarCollapsed: !settings.sidebarCollapsed })
        }
        theme={settings.theme}
        onToggleTheme={toggleDarkLight}
        user={user}
        onSignOut={handleSignOut}
        activeProjectName={activeProject?.name}
        testCount={activeProject?.testCases.length || 0}
        openDefectCount={openDefectCount}
        isRunning={isRunning}
      />

      <div
        className={`flex-1 flex flex-col min-w-0 pt-[52px] lg:pt-16 pb-mobile-nav transition-all duration-200 ${
          settings.sidebarCollapsed ? 'lg:pl-[72px]' : 'lg:pl-[244px]'
        }`}
      >
        {/* Contextual Breadcrumb Sub-bar */}
        <div className="border-b bg-[var(--surface-panel)]/75">
          <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-secondary)]">
            <div className="flex items-center gap-2 min-w-0">
              <span className="shrink-0">Automator AI</span>
              <span aria-hidden="true">/</span>
              <span className="font-medium text-[var(--text-main)] truncate">
                {viewTitles[activeView]}
              </span>
            </div>
            {activeProject && (
              <div className="hidden sm:flex items-center gap-3 font-mono text-[11px] text-[var(--text-muted)] min-w-0">
                <span className="truncate max-w-[260px]">{activeProject.url}</span>
                <span aria-hidden="true">·</span>
                <span className="shrink-0">
                  {activeProject.selectedFrameworks?.join(', ') || activeProject.framework}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Unverified Email Banner */}
        {!user.emailVerified && (
          <div className="border-b bg-amber-500/10 px-4 sm:px-6 lg:px-8 py-2 text-xs flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[var(--status-warning)]">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>
                Email verification pending for <span className="font-mono">{user.email}</span>.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setActiveView('settings')}
              className="font-semibold underline text-[var(--text-main)]"
            >
              Verify Email in Settings
            </button>
          </div>
        )}

        <main className={`flex-1 min-w-0 ${densityPadding}`}>
          {activeView === 'dashboard' && (
            <AnalyticsDashboardView
              userName={user.name}
              projects={projects}
              runs={runs}
              plans={sqaPlans}
              suites={sqaSuites}
              defects={sqaDefects}
              requirements={sqaRequirements}
              releases={sqaReleases}
              onNavigate={setActiveView}
            />
          )}

          {activeView === 'analyzer' && (
            <AnalyzerView
              project={activeProject}
              analyzing={analyzing}
              progress={analysisProgress}
              liveLogs={analysisLogs}
              error={analysisError}
              defaultFramework={settings.defaultFramework}
              onRunAnalysis={handleRunAnalysis}
              onNavigate={setActiveView}
            />
          )}

          {activeView === 'tests' && (
            <TestCasesView
              project={activeProject}
              onUpdateTestCases={handleUpdateTestCases}
              onUpdateProjectSheet={handleUpdateProjectPatch}
              onRunTests={handleStartRun}
              onEnhanceWithAi={handleEnhanceWithAi}
              onLogDefectFromCase={handleLogDefectFromCase}
              onNavigate={setActiveView}
            />
          )}

          {activeView === 'sqa' && (
            <SqaView
              key={prefillDefectCase ? `prefill-${prefillDefectCase.id}` : 'sqa-default'}
              project={activeProject}
              userName={user.name}
              plans={sqaPlans}
              suites={sqaSuites}
              defects={sqaDefects}
              requirements={sqaRequirements}
              releases={sqaReleases}
              initialTab={sqaInitialTab}
              prefillDefectFromCase={prefillDefectCase}
              onSavePlan={async (plan) => {
                const res = await saveSqaPlanApi(token, plan);
                setSqaPlans((prev) => [res.plan, ...prev.filter((p) => p.id !== res.plan.id)]);
              }}
              onDeletePlan={async (id) => {
                await deleteSqaPlanApi(token, id);
                setSqaPlans((prev) => prev.filter((p) => p.id !== id));
              }}
              onSaveSuite={async (suite) => {
                const res = await saveSqaSuiteApi(token, suite);
                setSqaSuites((prev) => [res.suite, ...prev.filter((s) => s.id !== res.suite.id)]);
              }}
              onDeleteSuite={async (id) => {
                await deleteSqaSuiteApi(token, id);
                setSqaSuites((prev) => prev.filter((s) => s.id !== id));
              }}
              onSaveDefect={async (defect) => {
                const res = await saveSqaDefectApi(token, defect);
                setSqaDefects((prev) => [res.defect, ...prev.filter((d) => d.id !== res.defect.id)]);
                setPrefillDefectCase(null);
              }}
              onDeleteDefect={async (id) => {
                await deleteSqaDefectApi(token, id);
                setSqaDefects((prev) => prev.filter((d) => d.id !== id));
              }}
              onSaveRequirement={async (req) => {
                const res = await saveSqaRequirementApi(token, req);
                setSqaRequirements((prev) => [
                  res.requirement,
                  ...prev.filter((r) => r.id !== res.requirement.id),
                ]);
              }}
              onDeleteRequirement={async (id) => {
                await deleteSqaRequirementApi(token, id);
                setSqaRequirements((prev) => prev.filter((r) => r.id !== id));
              }}
              onSaveRelease={async (rel) => {
                const res = await saveSqaReleaseApi(token, rel);
                setSqaReleases((prev) => [
                  res.release,
                  ...prev.filter((r) => r.id !== res.release.id),
                ]);
              }}
              onDeleteRelease={async (id) => {
                await deleteSqaReleaseApi(token, id);
                setSqaReleases((prev) => prev.filter((r) => r.id !== id));
              }}
              onUpdateTestCases={handleUpdateTestCases}
              onNavigate={setActiveView}
            />
          )}

          {activeView === 'studio' && (
            <StudioEditorView
              key={`${activeProject?.id || 'none'}:${activeProject?.updatedAt || ''}`}
              token={token}
              project={activeProject}
              onSaveFiles={handleSaveFiles}
              onRegenerate={handleRegenerate}
              onRunSuite={() => handleStartRun()}
              onNavigate={setActiveView}
            />
          )}

          {activeView === 'runner' && (
            <RunnerView
              token={token}
              project={activeProject}
              activeRun={activeRun}
              runs={runs}
              onSaveConfig={handleSaveConfig}
              onStartRun={handleStartRun}
              onCancelRun={handleCancelRun}
              onLogBugFromResult={handleLogDefectFromRunResult}
              onNavigate={setActiveView}
            />
          )}

          {activeView === 'reports' && (
            <ReportsView
              token={token}
              projects={projects}
              runs={runs}
              defects={sqaDefects}
              requirements={sqaRequirements}
              onNavigate={setActiveView}
            />
          )}

          {activeView === 'projects' && (
            <ProjectsView
              projects={projects}
              activeProjectId={activeProjectId}
              onSelectProject={(p) => setActiveProjectId(p.id)}
              onCreateProject={async (params) => {
                const res = await createProjectApi(token, {
                  ...params,
                  approach: 'pom',
                });
                upsertProjectInState(res.project);
              }}
              onRenameProject={async (id, name, description) => {
                const res = await updateProjectApi(token, id, { name, description });
                upsertProjectInState(res.project);
              }}
              onDuplicateProject={async (id) => {
                const res = await duplicateProjectApi(token, id);
                upsertProjectInState(res.project);
              }}
              onDeleteProject={async (id) => {
                await deleteProjectApi(token, id);
                setProjects((prev) => {
                  const next = prev.filter((p) => p.id !== id);
                  if (activeProjectId === id) {
                    setActiveProjectId(next[0]?.id || null);
                  }
                  return next;
                });
              }}
              onSaveSecrets={async (id, secrets) => {
                const res = await saveProjectSecretsApi(token, id, secrets);
                upsertProjectInState(res.project);
              }}
              onAddTeamMember={async (id, payload: { email: string; name?: string; role: UserRole }) => {
                const res = await addProjectMemberApi(token, id, payload);
                upsertProjectInState(res.project);
              }}
              onRemoveTeamMember={async (id, memberId) => {
                const res = await removeProjectMemberApi(token, id, memberId);
                upsertProjectInState(res.project);
              }}
              onNavigate={setActiveView}
            />
          )}

          {activeView === 'settings' && (
            <SettingsView
              token={token}
              settings={settings}
              user={user}
              onUserUpdated={setUser}
              onUpdateSettings={updateSettings}
              onResetSettings={() => setSettings(DEFAULT_SETTINGS)}
            />
          )}
        </main>

        <footer className="border-t py-4 px-4 sm:px-6 lg:px-8 text-xs text-[var(--text-muted)]">
          <div className="max-w-[1440px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
            <span>Automator AI — Website Automation, SQA &amp; Analytics Platform</span>
            <span>Playwright · Cypress · Selenium · Java · JavaScript · TypeScript · Python</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
