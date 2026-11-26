import { useState } from 'react';
import {
  Globe,
  ArrowRight,
  Loader2,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Code2,
  ListChecks,
  Play,
  SlidersHorizontal,
} from 'lucide-react';
import type {
  AnalyzedPage,
  AutomationFramework,
  AutomationProject,
  DomElementInfo,
  TestingApproach,
  WebsiteAnalysisReport,
  WorkspaceView,
} from '@/types';
import { APPROACH_OPTIONS, FRAMEWORK_OPTIONS } from '@/lib/frameworks';

export interface LiveAnalysisLog {
  stage: string;
  progress: number;
  message: string;
  level: 'info' | 'success' | 'warn' | 'error';
  timestamp: string;
}

interface AnalyzerViewProps {
  project: AutomationProject | null;
  analyzing: boolean;
  progress: number;
  liveLogs: LiveAnalysisLog[];
  error: string | null;
  defaultFramework: AutomationFramework;
  onRunAnalysis: (params: {
    url: string;
    framework: AutomationFramework;
    approach: TestingApproach;
    maxPages: number;
    maxDepth: number;
    respectRobots: boolean;
    followSubdomains: boolean;
  }) => Promise<void>;
  onNavigate: (view: WorkspaceView) => void;
}

const ELEMENT_CATEGORIES: { id: 'all' | DomElementInfo['category']; label: string }[] = [
  { id: 'all', label: 'All Elements' },
  { id: 'button', label: 'Buttons' },
  { id: 'link', label: 'Links' },
  { id: 'input', label: 'Inputs' },
  { id: 'form', label: 'Forms' },
  { id: 'dropdown', label: 'Dropdowns' },
  { id: 'menu', label: 'Menus' },
  { id: 'table', label: 'Tables' },
  { id: 'upload', label: 'Uploads' },
  { id: 'dynamic', label: 'Dynamic' },
  { id: 'image', label: 'Images' },
];

export function AnalyzerView({
  project,
  analyzing,
  progress,
  liveLogs,
  error,
  defaultFramework,
  onRunAnalysis,
  onNavigate,
}: AnalyzerViewProps) {
  const [urlInput, setUrlInput] = useState(project?.url || 'https://example.com');
  const [framework, setFramework] = useState<AutomationFramework>(
    project?.framework || defaultFramework
  );
  const [approach, setApproach] = useState<TestingApproach>(project?.approach || 'pom');
  const [maxPages, setMaxPages] = useState(5);
  const [maxDepth, setMaxDepth] = useState(2);
  const [respectRobots, setRespectRobots] = useState(true);
  const [followSubdomains, setFollowSubdomains] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [selectedPageIdx, setSelectedPageIdx] = useState(0);
  const [elementFilter, setElementFilter] = useState<'all' | DomElementInfo['category']>('all');

  const analysis: WebsiteAnalysisReport | null = project?.analysis || null;
  const activePage: AnalyzedPage | undefined = analysis?.pages[selectedPageIdx] || analysis?.pages[0];

  const filteredElements =
    activePage?.elements.filter((el) =>
      elementFilter === 'all' ? true : el.category === elementFilter
    ) || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim() || analyzing) return;
    setSelectedPageIdx(0);
    await onRunAnalysis({
      url: urlInput.trim(),
      framework,
      approach,
      maxPages,
      maxDepth,
      respectRobots,
      followSubdomains,
    });
  };

  return (
    <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-5 sm:space-y-6">
      {/* Analyzer Intake Panel */}
      <section className="surface-panel rounded-2xl p-4 sm:p-6 lg:p-7 space-y-5">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 sm:gap-4">
          <div className="min-w-0">
            <h1 className="font-display font-bold text-xl sm:text-2xl lg:text-3xl tracking-tight text-[var(--text-main)]">
              AI Website Analyzer
            </h1>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1 max-w-2xl leading-relaxed">
              Submit any publicly accessible website URL to launch an isolated Chromium browser session, inspect live DOM structures, and synthesize a complete Selenium or Cypress automation project.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-medium surface-elevated hover:bg-[var(--surface-hover)] text-[var(--text-main)] w-full sm:w-auto min-h-[44px] shrink-0"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>{showAdvanced ? 'Hide Crawl Options' : 'Crawl Options'}</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-12 lg:col-span-6 relative flex items-center">
              <Globe
                className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 pointer-events-none"
                aria-hidden="true"
              />
              <label htmlFor="analyzer-url" className="sr-only">
                Target Website URL
              </label>
              <input
                id="analyzer-url"
                type="text"
                required
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://example.com"
                className="w-full h-12 pl-10 pr-4 rounded-xl surface-elevated font-mono text-sm text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
              />
            </div>

            <div className="md:col-span-6 lg:col-span-3">
              <label htmlFor="analyzer-framework" className="sr-only">
                Target Automation Stack
              </label>
              <select
                id="analyzer-framework"
                value={framework}
                onChange={(e) => setFramework(e.target.value as AutomationFramework)}
                className="w-full h-12 px-3.5 rounded-xl surface-elevated text-sm text-[var(--text-main)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
              >
                {FRAMEWORK_OPTIONS.map((fw) => (
                  <option key={fw.id} value={fw.id}>
                    {fw.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-6 lg:col-span-3">
              <button
                type="submit"
                disabled={analyzing || !urlInput.trim()}
                className="w-full h-12 px-5 rounded-xl font-display font-semibold text-sm inline-flex items-center justify-center gap-2 transition-transform active:scale-[0.99] disabled:opacity-50"
                style={{
                  backgroundColor: 'var(--accent-primary)',
                  color: 'var(--accent-contrast)',
                }}
              >
                {analyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Analyzing ({progress}%)</span>
                  </>
                ) : (
                  <>
                    <span>Analyze Website</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>

          {showAdvanced && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-3 border-t">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--text-secondary)]">
                  Testing Architecture
                </label>
                <select
                  value={approach}
                  onChange={(e) => setApproach(e.target.value as TestingApproach)}
                  className="w-full min-h-[44px] px-3 rounded-lg surface-elevated text-xs text-[var(--text-main)]"
                >
                  {APPROACH_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--text-secondary)]">
                  Max Pages ({maxPages})
                </label>
                <input
                  type="range"
                  min={1}
                  max={12}
                  value={maxPages}
                  onChange={(e) => setMaxPages(Number(e.target.value))}
                  className="w-full accent-[var(--accent-primary)] h-11"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--text-secondary)]">
                  Link Depth ({maxDepth})
                </label>
                <input
                  type="range"
                  min={1}
                  max={3}
                  value={maxDepth}
                  onChange={(e) => setMaxDepth(Number(e.target.value))}
                  className="w-full accent-[var(--accent-primary)] h-11"
                />
              </div>

              <div className="flex flex-col justify-center gap-1 text-xs">
                <label className="inline-flex items-center gap-2.5 cursor-pointer min-h-[44px]">
                  <input
                    type="checkbox"
                    checked={respectRobots}
                    onChange={(e) => setRespectRobots(e.target.checked)}
                    className="w-4 h-4 rounded accent-[var(--accent-primary)]"
                  />
                  <span>Respect robots.txt policies</span>
                </label>
                <label className="inline-flex items-center gap-2.5 cursor-pointer min-h-[44px]">
                  <input
                    type="checkbox"
                    checked={followSubdomains}
                    onChange={(e) => setFollowSubdomains(e.target.checked)}
                    className="w-4 h-4 rounded accent-[var(--accent-primary)]"
                  />
                  <span>Follow same-root subdomains</span>
                </label>
              </div>
            </div>
          )}
        </form>

        {error && (
          <div
            role="alert"
            className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 flex items-start gap-3 text-sm text-red-500"
          >
            <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="space-y-1 min-w-0">
              <div className="font-semibold">Analysis could not complete</div>
              <div className="text-xs opacity-90 break-words">{error}</div>
              <div className="text-xs opacity-80">
                Troubleshooting: Verify the domain is publicly reachable over HTTP/HTTPS, does not block automated traffic, and is not a private/internal network address.
              </div>
            </div>
          </div>
        )}

        {/* Real-time WebSocket Progress & Logs */}
        {(analyzing || liveLogs.length > 0) && (
          <div className="rounded-xl surface-elevated p-4 space-y-3">
            <div className="flex items-center justify-between text-xs gap-2">
              <span className="font-medium text-[var(--text-main)] truncate">
                {analyzing ? 'Live Browser Inspection Progress' : 'Latest Inspection Log'}
              </span>
              <span className="font-mono text-[var(--accent-primary)] tabular-nums shrink-0">
                {progress}%
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-[var(--surface-canvas)] overflow-hidden">
              <div
                className="h-full transition-all duration-200"
                style={{
                  width: `${progress}%`,
                  backgroundColor: 'var(--accent-primary)',
                }}
              />
            </div>
            <div className="max-h-36 overflow-y-auto space-y-1 font-mono text-[11px] sm:text-xs">
              {liveLogs.slice(-8).map((log, i) => (
                <div
                  key={`${log.timestamp}-${i}`}
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
        )}
      </section>

      {/* Structured Website Analysis Report */}
      {analysis && (
        <section className="space-y-5 sm:space-y-6">
          {(analysis.antiBotDetected || !analysis.robotsAllowed) && (
            <div className="surface-panel rounded-xl p-4 flex items-start gap-3 border-amber-500/40 bg-amber-500/5 text-sm">
              <AlertTriangle className="w-5 h-5 text-[var(--status-warning)] shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="font-semibold text-[var(--text-main)]">
                  Access Policy Notice
                </div>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5 break-words">
                  {analysis.antiBotDetected || analysis.robotsSummary}
                </p>
              </div>
            </div>
          )}

          {/* KPI Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
            <div className="surface-panel rounded-xl p-3.5 sm:p-4 min-w-0">
              <div className="text-xs text-[var(--text-muted)] truncate">Pages Analyzed</div>
              <div className="font-mono font-bold text-xl sm:text-2xl mt-1 tabular-nums">
                {analysis.summary.totalPages}
              </div>
            </div>
            <div className="surface-panel rounded-xl p-3.5 sm:p-4 min-w-0">
              <div className="text-xs text-[var(--text-muted)] truncate">DOM Elements</div>
              <div className="font-mono font-bold text-xl sm:text-2xl mt-1 tabular-nums">
                {analysis.summary.totalElements}
              </div>
            </div>
            <div className="surface-panel rounded-xl p-3.5 sm:p-4 min-w-0">
              <div className="text-xs text-[var(--text-muted)] truncate">Forms</div>
              <div className="font-mono font-bold text-xl sm:text-2xl mt-1 tabular-nums">
                {analysis.summary.totalForms}
              </div>
            </div>
            <div className="surface-panel rounded-xl p-3.5 sm:p-4 min-w-0">
              <div className="text-xs text-[var(--text-muted)] truncate">Avg Load Time</div>
              <div className="font-mono font-bold text-xl sm:text-2xl mt-1 tabular-nums">
                {analysis.summary.avgLoadTimeMs}ms
              </div>
            </div>
            <div className="surface-panel rounded-xl p-3.5 sm:p-4 min-w-0">
              <div className="text-xs text-[var(--text-muted)] truncate">Broken Links</div>
              <div
                className="font-mono font-bold text-xl sm:text-2xl mt-1 tabular-nums"
                style={{
                  color:
                    analysis.summary.brokenLinksCount > 0
                      ? 'var(--status-error)'
                      : 'var(--status-success)',
                }}
              >
                {analysis.summary.brokenLinksCount}
              </div>
            </div>
            <div className="surface-panel rounded-xl p-3.5 sm:p-4 min-w-0">
              <div className="text-xs text-[var(--text-muted)] truncate">A11y Alerts</div>
              <div
                className="font-mono font-bold text-xl sm:text-2xl mt-1 tabular-nums"
                style={{
                  color:
                    analysis.summary.accessibilityIssuesCount > 0
                      ? 'var(--status-warning)'
                      : 'var(--status-success)',
                }}
              >
                {analysis.summary.accessibilityIssuesCount}
              </div>
            </div>
          </div>

          {/* Action Bar */}
          <div className="surface-panel rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="text-xs text-[var(--text-secondary)] space-y-0.5 min-w-0">
              <div className="font-semibold text-sm text-[var(--text-main)]">
                Analysis Complete · {analysis.robotsSummary}
              </div>
              <div className="font-mono break-all sm:truncate sm:max-w-xl">
                Final URL: {analysis.finalUrl} · Duration: {analysis.durationMs}ms
              </div>
            </div>

            <div className="grid grid-cols-1 sm:flex sm:flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => onNavigate('tests')}
                className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium surface-elevated hover:bg-[var(--surface-hover)] min-h-[44px]"
              >
                <ListChecks className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                <span>View Test Cases ({project?.testCases.length || 0})</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('studio')}
                className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium surface-elevated hover:bg-[var(--surface-hover)] min-h-[44px]"
              >
                <Code2 className="w-3.5 h-3.5 text-[var(--accent-secondary)]" />
                <span>Open Script Studio ({project?.files.length || 0} files)</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('runner')}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold min-h-[44px]"
                style={{
                  backgroundColor: 'var(--accent-primary)',
                  color: 'var(--accent-contrast)',
                }}
              >
                <Play className="w-3.5 h-3.5" />
                <span>Execute Suite</span>
              </button>
            </div>
          </div>

          {/* Discovered Pages + DOM Inspector */}
          {analysis.pages.length > 0 && activePage && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
              {/* Page List */}
              <div className="lg:col-span-4 surface-panel rounded-xl p-4 space-y-3 min-w-0">
                <div className="text-xs font-semibold text-[var(--text-secondary)]">
                  Discovered Routes ({analysis.pages.length})
                </div>
                <div className="space-y-2">
                  {analysis.pages.map((p, idx) => {
                    const active = idx === selectedPageIdx;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setSelectedPageIdx(idx)}
                        className={`w-full text-left p-3 rounded-xl transition-colors border min-h-[44px] ${
                          active
                            ? 'bg-[var(--accent-soft)] border-[var(--accent-primary)]'
                            : 'surface-elevated border-transparent hover:border-[var(--border-strong)]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-xs font-semibold truncate">
                            {p.path}
                          </span>
                          <span className="font-mono text-[11px] text-[var(--text-muted)] tabular-nums shrink-0">
                            HTTP {p.statusCode}
                          </span>
                        </div>
                        <div className="text-xs text-[var(--text-secondary)] truncate mt-1">
                          {p.title}
                        </div>
                        <div className="text-[11px] text-[var(--text-muted)] mt-1">
                          {p.archetype} · {p.elements.length} elements · {p.loadTimeMs}ms
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Active Page Details & Responsive Element Inspector */}
              <div className="lg:col-span-8 surface-panel rounded-xl p-4 sm:p-5 space-y-5 min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-4 border-b">
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
                      <span>{activePage.archetype}</span>
                      <span aria-hidden="true">·</span>
                      <span>HTTP {activePage.statusCode}</span>
                      <span aria-hidden="true">·</span>
                      <span>{activePage.loadTimeMs}ms</span>
                    </div>
                    <h2 className="font-display font-bold text-lg text-[var(--text-main)] break-words sm:truncate">
                      {activePage.title}
                    </h2>
                    <a
                      href={activePage.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-mono text-xs text-[var(--accent-primary)] hover:underline break-all"
                    >
                      <span>{activePage.url}</span>
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  </div>

                  <div className="text-xs space-y-1.5 shrink-0 text-[var(--text-secondary)]">
                    <div className="flex items-center gap-1.5">
                      {activePage.responsiveCheck.mobileOverflow ? (
                        <AlertTriangle className="w-3.5 h-3.5 text-[var(--status-warning)] shrink-0" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5 text-[var(--status-success)] shrink-0" />
                      )}
                      <span>
                        Mobile 390px: {activePage.responsiveCheck.mobileOverflow ? 'Overflow' : 'Clean'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {activePage.hasLoginForm ? (
                        <ShieldAlert className="w-3.5 h-3.5 text-[var(--accent-primary)] shrink-0" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
                      )}
                      <span>
                        Login Form: {activePage.hasLoginForm ? 'Detected (Vault ready)' : 'None'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Category Filter Bar (Horizontal scroll on mobile, wrapped on sm+) */}
                <div className="flex sm:flex-wrap gap-1.5 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
                  {ELEMENT_CATEGORIES.map((cat) => {
                    const active = elementFilter === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setElementFilter(cat.id)}
                        className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 min-h-[40px] ${
                          active
                            ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)]'
                            : 'surface-elevated text-[var(--text-secondary)] hover:text-[var(--text-main)]'
                        }`}
                      >
                        {cat.label}
                      </button>
                    );
                  })}
                </div>

                {/* Mobile Element Cards (< md) */}
                <div className="md:hidden border rounded-xl divide-y">
                  {filteredElements.slice(0, 40).map((el) => (
                    <div key={el.id} className="p-3.5 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between gap-2 text-[var(--text-muted)] font-mono">
                        <span>{el.category}</span>
                        <span>{el.locatorStrategy}</span>
                      </div>
                      <div className="font-medium text-[var(--text-main)] break-words">
                        {el.text || el.name || el.tag}
                      </div>
                      <div className="font-mono text-[11px] text-[var(--accent-secondary)] break-all bg-[var(--surface-elevated)] px-2.5 py-1.5 rounded-lg">
                        {el.locator}
                      </div>
                    </div>
                  ))}
                  {filteredElements.length === 0 && (
                    <div className="py-8 px-4 text-center text-xs text-[var(--text-muted)]">
                      No DOM elements matched this category filter on {activePage.path}.
                    </div>
                  )}
                </div>

                {/* Desktop DOM Elements Table (md+) */}
                <div className="hidden md:block overflow-x-auto border rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="surface-elevated text-[var(--text-secondary)] border-b">
                      <tr>
                        <th className="py-2.5 px-3 font-semibold">Category</th>
                        <th className="py-2.5 px-3 font-semibold">Label / Text</th>
                        <th className="py-2.5 px-3 font-semibold">Strategy</th>
                        <th className="py-2.5 px-3 font-semibold">Resilient Locator</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filteredElements.slice(0, 40).map((el) => (
                        <tr key={el.id} className="hover:bg-[var(--surface-hover)]">
                          <td className="py-2.5 px-3 font-mono text-[var(--text-secondary)]">
                            {el.category}
                          </td>
                          <td className="py-2.5 px-3 max-w-[200px] truncate text-[var(--text-main)]">
                            {el.text || el.name || el.tag}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[var(--text-muted)]">
                            {el.locatorStrategy}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[var(--accent-secondary)] max-w-[260px] truncate">
                            {el.locator}
                          </td>
                        </tr>
                      ))}
                      {filteredElements.length === 0 && (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-[var(--text-muted)]">
                            No DOM elements matched this category filter on {activePage.path}.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Accessibility & Broken Links */}
                {(activePage.accessibilityIssues.length > 0 || activePage.brokenLinks.length > 0) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    {activePage.accessibilityIssues.length > 0 && (
                      <div className="rounded-xl surface-elevated p-4 space-y-2 min-w-0">
                        <div className="text-xs font-semibold text-[var(--text-main)]">
                          Accessibility Audit Findings
                        </div>
                        {activePage.accessibilityIssues.map((issue, idx) => (
                          <div key={idx} className="text-xs text-[var(--text-secondary)] break-words">
                            <span className="font-mono text-[var(--status-warning)]">
                              [{issue.rule}]
                            </span>{' '}
                            {issue.detail}
                          </div>
                        ))}
                      </div>
                    )}
                    {activePage.brokenLinks.length > 0 && (
                      <div className="rounded-xl surface-elevated p-4 space-y-2 min-w-0">
                        <div className="text-xs font-semibold text-[var(--status-error)]">
                          Broken Links Detected
                        </div>
                        {activePage.brokenLinks.map((lnk, idx) => (
                          <div key={idx} className="text-xs font-mono text-[var(--text-secondary)] break-all">
                            HTTP {lnk.status}: {lnk.url}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
