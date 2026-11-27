import { useState } from 'react';
import {
  Play,
  Square,
  CheckCircle2,
  XCircle,
  Clock,
  Image as ImageIcon,
  Globe,
  X,
  SlidersHorizontal,
  Bug,
} from 'lucide-react';
import type {
  AutomationProject,
  BrowserTarget,
  ProjectConfig,
  TestRunItemResult,
  TestRunRecord,
  ViewportPreset,
  WorkspaceView,
} from '@/types';
import { fetchAuthorizedScreenshotUrl } from '@/lib/api';

interface RunnerViewProps {
  token: string;
  project: AutomationProject | null;
  activeRun: TestRunRecord | null;
  runs: TestRunRecord[];
  onSaveConfig: (config: ProjectConfig) => Promise<void>;
  onStartRun: (testCaseIds?: string[]) => Promise<void>;
  onCancelRun: (runId: string) => Promise<void>;
  onLogBugFromResult?: (result: TestRunItemResult) => void;
  onNavigate: (view: WorkspaceView) => void;
}

export function RunnerView({
  token,
  project,
  activeRun,
  runs,
  onSaveConfig,
  onStartRun,
  onCancelRun,
  onLogBugFromResult,
  onNavigate,
}: RunnerViewProps) {
  const [draftConfig, setDraftConfig] = useState<{ projectId: string; cfg: ProjectConfig } | null>(null);
  const [showConfig, setShowConfig] = useState(true);
  const [screenshotModalUrl, setScreenshotModalUrl] = useState<string | null>(null);
  const [screenshotTitle, setScreenshotTitle] = useState('');

  const config =
    project && draftConfig?.projectId === project.id
      ? draftConfig.cfg
      : project?.config || null;

  const currentRun =
    activeRun || runs.find((r) => r.projectId === project?.id) || runs[0] || null;

  if (!project || !config) {
    return (
      <div className="max-w-[960px] mx-auto px-4 py-16 text-center">
        <div className="surface-panel rounded-2xl p-10 space-y-4">
          <Globe className="w-10 h-10 mx-auto text-[var(--accent-primary)]" />
          <h2 className="font-display font-bold text-xl">No Project Ready to Execute</h2>
          <p className="text-sm text-[var(--text-secondary)] max-w-md mx-auto">
            Analyze a website URL first so the isolated browser runner can execute generated test scenarios.
          </p>
          <button
            type="button"
            onClick={() => onNavigate('analyzer')}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold"
            style={{ backgroundColor: 'var(--accent-primary)', color: 'var(--accent-contrast)' }}
          >
            Open Website Analyzer
          </button>
        </div>
      </div>
    );
  }

  const updateField = async <K extends keyof ProjectConfig>(key: K, val: ProjectConfig[K]) => {
    const next = { ...config, [key]: val };
    if (key === 'viewport') {
      if (val === 'desktop') {
        next.customWidth = 1440;
        next.customHeight = 900;
      } else if (val === 'laptop') {
        next.customWidth = 1280;
        next.customHeight = 800;
      } else if (val === 'tablet') {
        next.customWidth = 768;
        next.customHeight = 1024;
      } else if (val === 'mobile') {
        next.customWidth = 390;
        next.customHeight = 844;
      }
    }
    setDraftConfig({ projectId: project.id, cfg: next });
    await onSaveConfig(next);
  };

  const openScreenshot = async (path: string, title: string) => {
    try {
      const objectUrl = await fetchAuthorizedScreenshotUrl(token, path);
      setScreenshotTitle(title);
      setScreenshotModalUrl(objectUrl);
    } catch {
      // Ignore unavailable screenshot
    }
  };

  const closeScreenshotModal = () => {
    if (screenshotModalUrl) URL.revokeObjectURL(screenshotModalUrl);
    setScreenshotModalUrl(null);
  };

  const isRunning = currentRun?.status === 'running' || currentRun?.status === 'queued';
  const completedCount =
    (currentRun?.passed || 0) + (currentRun?.failed || 0) + (currentRun?.skipped || 0);
  const progressPct =
    currentRun && currentRun.totalTests > 0
      ? Math.round((completedCount / currentRun.totalTests) * 100)
      : 0;

  return (
    <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-5 sm:space-y-6 animate-view-enter">
      {/* Execution Header */}
      <div className="surface-panel rounded-2xl p-4 sm:p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-display font-bold text-xl sm:text-2xl text-[var(--text-main)]">
              Live Isolated Test Runner
            </h1>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1 leading-relaxed">
              Executes supported scenarios inside a sandboxed Playwright browser context with network filtering and failure screenshot capture.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:flex sm:flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowConfig((v) => !v)}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium surface-elevated hover:bg-[var(--surface-hover)] min-h-[44px]"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Environment Config</span>
            </button>

            {isRunning && currentRun ? (
              <button
                type="button"
                onClick={() => onCancelRun(currentRun.id)}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-red-600 text-white min-h-[44px]"
              >
                <Square className="w-3.5 h-3.5" />
                <span>Stop Run</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onStartRun()}
                className="inline-flex items-center justify-center gap-1.5 px-5 py-2 rounded-xl text-xs font-semibold min-h-[44px]"
                style={{ backgroundColor: 'var(--accent-primary)', color: 'var(--accent-contrast)' }}
              >
                <Play className="w-3.5 h-3.5" />
                <span>Run Complete Suite ({project.testCases.filter((t) => t.enabled).length})</span>
              </button>
            )}
          </div>
        </div>

        {/* Advanced Configuration Controls */}
        {showConfig && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-4 border-t text-xs">
            <div className="space-y-1">
              <label className="text-[var(--text-secondary)] font-medium">Browser Engine</label>
              <select
                value={config.browser}
                onChange={(e) => updateField('browser', e.target.value as BrowserTarget)}
                className="w-full min-h-[44px] px-3 rounded-lg surface-elevated"
              >
                <option value="chrome">Chrome / Chromium</option>
                <option value="firefox">Firefox Profile</option>
                <option value="edge">Microsoft Edge Profile</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[var(--text-secondary)] font-medium">Viewport Preset</label>
              <select
                value={config.viewport}
                onChange={(e) => updateField('viewport', e.target.value as ViewportPreset)}
                className="w-full min-h-[44px] px-3 rounded-lg surface-elevated"
              >
                <option value="desktop">Desktop (1440×900)</option>
                <option value="laptop">Laptop (1280×800)</option>
                <option value="tablet">Tablet (768×1024)</option>
                <option value="mobile">Mobile (390×844)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[var(--text-secondary)] font-medium">Timeout (ms)</label>
              <input
                type="number"
                min={3000}
                max={30000}
                step={1000}
                value={config.timeoutMs}
                onChange={(e) => updateField('timeoutMs', Number(e.target.value))}
                className="w-full min-h-[44px] px-3 rounded-lg surface-elevated font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[var(--text-secondary)] font-medium">Retries on Failure</label>
              <select
                value={config.retries}
                onChange={(e) => updateField('retries', Number(e.target.value))}
                className="w-full min-h-[44px] px-3 rounded-lg surface-elevated font-mono"
              >
                <option value={0}>0 retries</option>
                <option value={1}>1 retry</option>
                <option value={2}>2 retries</option>
              </select>
            </div>

            <div className="flex flex-col justify-end gap-1 sm:col-span-2 lg:col-span-1">
              <label className="inline-flex items-center gap-2.5 cursor-pointer min-h-[40px]">
                <input
                  type="checkbox"
                  checked={config.captureScreenshots}
                  onChange={(e) => updateField('captureScreenshots', e.target.checked)}
                  className="w-4 h-4 rounded accent-[var(--accent-primary)]"
                />
                <span>Capture Failure Screenshots</span>
              </label>
              <label className="inline-flex items-center gap-2.5 cursor-pointer min-h-[40px]">
                <input
                  type="checkbox"
                  checked={config.headless}
                  onChange={(e) => updateField('headless', e.target.checked)}
                  className="w-4 h-4 rounded accent-[var(--accent-primary)]"
                />
                <span>Headless Mode</span>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Live Execution Telemetry */}
      {currentRun && (
        <div className="space-y-5 sm:space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3">
            <div className="surface-panel rounded-xl p-3.5 sm:p-4 min-w-0">
              <div className="text-xs text-[var(--text-muted)]">Status</div>
              <div className="font-mono font-bold text-base sm:text-lg mt-1 uppercase truncate">
                {currentRun.status}
              </div>
            </div>
            <div className="surface-panel rounded-xl p-3.5 sm:p-4 min-w-0">
              <div className="text-xs text-[var(--text-muted)]">Passed</div>
              <div className="font-mono font-bold text-xl sm:text-2xl mt-1 tabular-nums text-[var(--status-success)]">
                {currentRun.passed}
              </div>
            </div>
            <div className="surface-panel rounded-xl p-3.5 sm:p-4 min-w-0">
              <div className="text-xs text-[var(--text-muted)]">Failed</div>
              <div className="font-mono font-bold text-xl sm:text-2xl mt-1 tabular-nums text-[var(--status-error)]">
                {currentRun.failed}
              </div>
            </div>
            <div className="surface-panel rounded-xl p-3.5 sm:p-4 min-w-0">
              <div className="text-xs text-[var(--text-muted)]">Skipped</div>
              <div className="font-mono font-bold text-xl sm:text-2xl mt-1 tabular-nums text-[var(--status-warning)]">
                {currentRun.skipped}
              </div>
            </div>
            <div className="surface-panel rounded-xl p-3.5 sm:p-4 col-span-2 sm:col-span-2 lg:col-span-1 min-w-0">
              <div className="text-xs text-[var(--text-muted)]">Duration</div>
              <div className="font-mono font-bold text-xl sm:text-2xl mt-1 tabular-nums">
                {(currentRun.durationMs / 1000).toFixed(2)}s
              </div>
            </div>
          </div>

          <div className="surface-panel rounded-xl p-4 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-medium truncate">
                {currentRun.browser} · {currentRun.viewport}
              </span>
              <span className="font-mono tabular-nums shrink-0">
                {completedCount} / {currentRun.totalTests} ({progressPct}%)
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-[var(--surface-elevated)] overflow-hidden">
              <div
                className="h-full transition-all duration-200"
                style={{
                  width: `${progressPct}%`,
                  backgroundColor:
                    currentRun.failed > 0 ? 'var(--status-warning)' : 'var(--status-success)',
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
            <div className="lg:col-span-7 surface-panel rounded-xl overflow-hidden min-w-0">
              <div className="px-4 py-3 border-b text-xs font-semibold text-[var(--text-secondary)]">
                Executed Test Cases
              </div>
              <div className="divide-y max-h-[340px] sm:max-h-[420px] overflow-y-auto">
                {currentRun.results.map((r) => (
                  <div
                    key={r.testCaseId}
                    className="p-3.5 flex flex-col sm:flex-row sm:items-start justify-between gap-2.5 text-xs"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-start gap-2">
                        {r.status === 'passed' ? (
                          <CheckCircle2 className="w-4 h-4 text-[var(--status-success)] shrink-0 mt-0.5" />
                        ) : r.status === 'failed' ? (
                          <XCircle className="w-4 h-4 text-[var(--status-error)] shrink-0 mt-0.5" />
                        ) : (
                          <Clock className="w-4 h-4 text-[var(--status-warning)] shrink-0 mt-0.5" />
                        )}
                        <span className="font-mono font-semibold shrink-0">{r.code}</span>
                        <span className="font-medium break-words sm:truncate">{r.title}</span>
                      </div>
                      <div className="text-[var(--text-secondary)] pl-6 break-words">
                        {r.actualResult}
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pl-6 sm:pl-0">
                      <span className="font-mono text-[var(--text-muted)] tabular-nums">
                        {r.durationMs}ms
                      </span>
                      {r.status === 'failed' && onLogBugFromResult && (
                        <button
                          type="button"
                          onClick={() => onLogBugFromResult(r)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-500/15 text-red-400 font-semibold min-h-[36px]"
                        >
                          <Bug className="w-3.5 h-3.5" />
                          <span>Log Bug</span>
                        </button>
                      )}
                      {r.screenshotUrl && (
                        <button
                          type="button"
                          onClick={() => openScreenshot(r.screenshotUrl!, `${r.code} Failure`)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg surface-elevated hover:bg-[var(--accent-soft)] text-[var(--accent-primary)] min-h-[36px]"
                        >
                          <ImageIcon className="w-3.5 h-3.5" />
                          <span>Screenshot</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {currentRun.results.length === 0 && (
                  <div className="py-10 text-center text-xs text-[var(--text-muted)]">
                    Waiting for first test result...
                  </div>
                )}
              </div>
            </div>

            <div className="lg:col-span-5 surface-panel rounded-xl overflow-hidden flex flex-col min-w-0">
              <div className="px-4 py-3 border-b text-xs font-semibold text-[var(--text-secondary)]">
                Execution Console Stream
              </div>
              <div className="p-3.5 bg-[var(--surface-canvas)] font-mono text-[11px] leading-relaxed space-y-1.5 flex-1 max-h-[320px] sm:max-h-[420px] overflow-y-auto">
                {currentRun.logs.map((log, i) => (
                  <div
                    key={i}
                    className={`break-words ${
                      log.level === 'error'
                        ? 'text-[var(--status-error)]'
                        : log.level === 'warn'
                          ? 'text-[var(--status-warning)]'
                          : log.level === 'success'
                            ? 'text-[var(--status-success)]'
                            : 'text-[var(--text-secondary)]'
                    }`}
                  >
                    [{new Date(log.timestamp).toLocaleTimeString()}] {log.message}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {screenshotModalUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="surface-panel rounded-2xl max-w-4xl w-full max-h-[92dvh] flex flex-col overflow-hidden">
            <div className="px-4 sm:px-5 py-3 border-b flex items-center justify-between gap-2 shrink-0">
              <span className="font-display font-semibold text-sm truncate">
                {screenshotTitle}
              </span>
              <button
                type="button"
                onClick={closeScreenshotModal}
                aria-label="Close screenshot"
                className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg hover:bg-[var(--surface-hover)] shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 sm:p-4 bg-black/40 overflow-auto flex-1">
              <img
                src={screenshotModalUrl}
                alt={screenshotTitle}
                className="w-full h-auto rounded-lg border"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
