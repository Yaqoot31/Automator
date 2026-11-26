import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  AppSettings,
  AutomationFramework,
  AutomationProject,
  ProjectConfig,
  ProjectFile,
  TestCase,
  TestRunItemResult,
  TestRunLogEntry,
  TestRunRecord,
  TestingApproach,
  UserProfile,
  WorkspaceView,
} from '@/types';
import {
  analyzeWebsiteApi,
  cancelTestRunApi,
  createProjectApi,
  deleteProjectApi,
  duplicateProjectApi,
  enhanceAiTestsApi,
  listProjectsApi,
  listTestRunsApi,
  regenerateProjectApi,
  saveProjectSecretsApi,
  startTestRunApi,
  updateProjectApi,
} from '@/lib/api';
import { AuthGate } from '@/components/AuthGate';
import { TopNavAndSidebar } from '@/components/TopNavAndSidebar';
import { AnalyzerView, type LiveAnalysisLog } from '@/views/AnalyzerView';
import { TestCasesView } from '@/views/TestCasesView';
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
  defaultFramework: 'cypress-ts',
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

  const [activeView, setActiveView] = useState<WorkspaceView>('analyzer');
  const [projects, setProjects] = useState<AutomationProject[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [runs, setRuns] = useState<TestRunRecord[]>([]);
  const [activeRun, setActiveRun] = useState<TestRunRecord | null>(null);

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
    const [projRes, runsRes] = await Promise.all([
      listProjectsApi(authToken),
      listTestRunsApi(authToken),
    ]);
    setProjects(projRes.projects);
    setRuns(runsRes.runs);
    setActiveProjectId((prev) => {
      if (prev && projRes.projects.some((p) => p.id === prev)) return prev;
      return projRes.projects[0]?.id || null;
    });
  }, []);

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
        ...params,
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

  const handleSaveFiles = async (files: ProjectFile[]) => {
    if (!token || !activeProject) return;
    const res = await updateProjectApi(token, activeProject.id, { files });
    upsertProjectInState(res.project);
  };

  const handleRegenerate = async (
    framework: AutomationFramework,
    approach: TestingApproach
  ) => {
    if (!token || !activeProject) return;
    const res = await regenerateProjectApi(token, activeProject.id, framework, approach);
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

  const handleSignOut = () => {
    setUser(null);
    setToken(null);
    setProjects([]);
    setRuns([]);
    setActiveProjectId(null);
    setActiveRun(null);
  };

  if (!user || !token) {
    return (
      <AuthGate
        theme={settings.theme}
        onToggleTheme={toggleDarkLight}
        onAuthenticated={(u, t) => {
          setUser(u);
          setToken(t);
          refreshWorkspaceData(t).catch(() => {});
        }}
      />
    );
  }

  const isRunning = activeRun?.status === 'running' || activeRun?.status === 'queued';
  const densityPadding =
    settings.density === 'compact'
      ? 'py-2'
      : settings.density === 'spacious'
        ? 'py-8'
        : 'py-4';

  const viewTitles: Record<WorkspaceView, string> = {
    analyzer: 'AI Website Analyzer',
    tests: 'Test Cases & Coverage',
    studio: 'Script Studio & IDE',
    runner: 'Live Test Runner',
    reports: 'Reports & Analytics',
    projects: 'Projects & Credentials Vault',
    settings: 'Platform Settings',
  };

  return (
    <div className="min-h-screen bg-[var(--surface-canvas)] text-[var(--text-main)] flex flex-col">
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
        isRunning={isRunning}
      />

      <div
        className={`flex-1 flex flex-col min-w-0 pt-14 lg:pt-16 transition-all duration-200 ${
          settings.sidebarCollapsed ? 'lg:pl-[72px]' : 'lg:pl-[240px]'
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
                <span className="shrink-0">{activeProject.framework}</span>
              </div>
            )}
          </div>
        </div>

        <main className={`flex-1 min-w-0 ${densityPadding}`}>
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
              onRunTests={handleStartRun}
              onEnhanceWithAi={handleEnhanceWithAi}
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
              onNavigate={setActiveView}
            />
          )}

          {activeView === 'reports' && (
            <ReportsView
              token={token}
              projects={projects}
              runs={runs}
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
              onNavigate={setActiveView}
            />
          )}

          {activeView === 'settings' && (
            <SettingsView
              settings={settings}
              user={user}
              onUpdateSettings={updateSettings}
              onResetSettings={() => setSettings(DEFAULT_SETTINGS)}
            />
          )}
        </main>

        <footer className="border-t py-4 px-4 sm:px-6 lg:px-8 text-xs text-[var(--text-muted)]">
          <div className="max-w-[1440px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
            <span>Automator AI — Website Automation Engineering Platform</span>
            <span>Selenium &amp; Cypress · Java · JavaScript · TypeScript · Python</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
