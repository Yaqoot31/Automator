import { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { FileDown, BarChart3, FileSpreadsheet, Download } from 'lucide-react';
import type {
  AutomationProject,
  SqaDefect,
  SqaRequirement,
  TestRunRecord,
  WorkspaceView,
} from '@/types';
import { downloadReportApi, downloadSqaReportApi } from '@/lib/api';
import { downloadSqaWorkbookExcel } from '@/lib/exportUtils';
import { downloadCompleteProjectZip } from '@/lib/projectZip';

interface ReportsViewProps {
  token: string;
  projects: AutomationProject[];
  runs: TestRunRecord[];
  defects: SqaDefect[];
  requirements: SqaRequirement[];
  onNavigate: (view: WorkspaceView) => void;
}

const SQA_REPORT_CATEGORIES = [
  {
    id: 'execution',
    title: 'Test Execution Report',
    desc: 'Aggregated pass/fail/skipped counts, durations, and browser run breakdowns.',
  },
  {
    id: 'summary',
    title: 'Test Summary Report',
    desc: 'Executive SQA readiness overview across projects, suites, and defect density.',
  },
  {
    id: 'test-cases',
    title: 'Test Case Report',
    desc: 'Complete 14-column test inventory including priorities, modules, and expected results.',
  },
  {
    id: 'defects',
    title: 'Defect / Bug Report',
    desc: 'Open and resolved defects with severity, priority, assignee, and status lifecycle.',
  },
  {
    id: 'automation',
    title: 'Automation Coverage Report',
    desc: 'Automated vs manual test ratio, multi-language stack adoption, and locator readiness.',
  },
  {
    id: 'regression',
    title: 'Regression Test Report',
    desc: 'Regression suite stability, historical run comparisons, and failure regression checks.',
  },
  {
    id: 'browser-compat',
    title: 'Browser Compatibility Report',
    desc: 'Cross-browser execution metrics across Chrome, Firefox, and Edge profiles.',
  },
  {
    id: 'responsive',
    title: 'Responsive UI Report',
    desc: 'Desktop (1440px) vs Mobile (390px) overflow audits and layout verification.',
  },
  {
    id: 'release-readiness',
    title: 'Release Readiness Report',
    desc: 'Build verification checks, RTM coverage gaps, and QA sign-off statuses.',
  },
  {
    id: 'project-quality',
    title: 'Project Quality Report',
    desc: 'Project-level health benchmark combining pass rates, links, a11y, and open bugs.',
  },
];

export function ReportsView({
  token,
  projects,
  runs,
  defects,
  requirements,
  onNavigate,
}: ReportsViewProps) {
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const scopedProjects = useMemo(
    () =>
      selectedProjectId === 'all'
        ? projects
        : projects.filter((p) => p.id === selectedProjectId),
    [projects, selectedProjectId]
  );

  const scopedRuns = useMemo(
    () =>
      selectedProjectId === 'all'
        ? runs
        : runs.filter((r) => r.projectId === selectedProjectId),
    [runs, selectedProjectId]
  );

  const metrics = useMemo(() => {
    const totalGenerated = scopedProjects.reduce((sum, p) => sum + p.testCases.length, 0);
    const totalExecuted = scopedRuns.reduce((sum, r) => sum + r.totalTests, 0);
    const passed = scopedRuns.reduce((sum, r) => sum + r.passed, 0);
    const failed = scopedRuns.reduce((sum, r) => sum + r.failed, 0);
    const skipped = scopedRuns.reduce((sum, r) => sum + r.skipped, 0);
    const successPct = totalExecuted > 0 ? Math.round((passed / totalExecuted) * 100) : 0;
    const avgDurationMs =
      scopedRuns.length > 0
        ? Math.round(scopedRuns.reduce((sum, r) => sum + r.durationMs, 0) / scopedRuns.length)
        : 0;
    return { totalGenerated, totalExecuted, passed, failed, skipped, successPct, avgDurationMs };
  }, [scopedProjects, scopedRuns]);

  const trendData = useMemo(() => {
    return scopedRuns
      .slice(0, 10)
      .reverse()
      .map((r, i) => ({
        name: `Run ${i + 1}`,
        passed: r.passed,
        failed: r.failed,
        skipped: r.skipped,
      }));
  }, [scopedRuns]);

  const browserData = useMemo(() => {
    const map = new Map<string, { browser: string; passed: number; failed: number }>();
    for (const r of scopedRuns) {
      const entry = map.get(r.browser) || { browser: r.browser, passed: 0, failed: 0 };
      entry.passed += r.passed;
      entry.failed += r.failed;
      map.set(r.browser, entry);
    }
    return Array.from(map.values());
  }, [scopedRuns]);

  const pieData = [
    { name: 'Passed', value: metrics.passed, color: '#22c55e' },
    { name: 'Failed', value: metrics.failed, color: '#ef4444' },
    { name: 'Skipped', value: metrics.skipped, color: '#f59e0b' },
  ].filter((d) => d.value > 0);

  const handleSqaDownload = async (
    reportType: string,
    fmt: 'pdf' | 'html' | 'json' | 'csv'
  ) => {
    const key = `${reportType}:${fmt}`;
    setDownloadingKey(key);
    setDownloadError(null);
    try {
      await downloadSqaReportApi(token, reportType, fmt, selectedProjectId);
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : 'Report export failed.');
    } finally {
      setDownloadingKey(null);
    }
  };

  const selectedProject =
    selectedProjectId !== 'all' ? projects.find((p) => p.id === selectedProjectId) || null : null;

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-6 animate-view-enter">
      {/* Header & Project Scope */}
      <div className="surface-panel rounded-2xl p-4 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-xl sm:text-2xl text-[var(--text-main)]">
            SQA Reports &amp; Export Center
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
            Generate and export 10 SQA &amp; automation report categories in PDF, Excel (.xlsx), CSV, HTML, and JSON across {scopedRuns.length} run(s) and {scopedProjects.length} project(s).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <select
            aria-label="Scope reports to project"
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="min-h-[42px] px-3 rounded-xl surface-elevated text-xs font-medium"
          >
            <option value="all">All Projects ({projects.length})</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() =>
              downloadSqaWorkbookExcel({
                projectName: selectedProject ? selectedProject.name : 'All-Projects',
                projects: scopedProjects,
                defects:
                  selectedProjectId === 'all'
                    ? defects
                    : defects.filter((d) => d.projectId === selectedProjectId),
                requirements:
                  selectedProjectId === 'all'
                    ? requirements
                    : requirements.filter((r) => r.projectId === selectedProjectId),
              })
            }
            className="inline-flex items-center gap-1.5 px-3.5 min-h-[42px] rounded-xl text-xs font-semibold"
            style={{ backgroundColor: 'var(--accent-primary)', color: 'var(--accent-contrast)' }}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Master Excel (.xlsx)</span>
          </button>

          {selectedProject && (
            <button
              type="button"
              onClick={() => downloadCompleteProjectZip(selectedProject)}
              className="inline-flex items-center gap-1.5 px-3.5 min-h-[42px] rounded-xl text-xs font-medium surface-elevated hover:bg-[var(--surface-hover)]"
            >
              <Download className="w-4 h-4" />
              <span>Project ZIP</span>
            </button>
          )}
        </div>
      </div>

      {downloadError && (
        <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 text-xs text-red-500">
          {downloadError}
        </div>
      )}

      {/* 10 Downloadable SQA Report Categories */}
      <section className="space-y-3">
        <h2 className="font-display font-bold text-base sm:text-lg">
          10 Specialized SQA Report Exports
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {SQA_REPORT_CATEGORIES.map((cat) => (
            <div key={cat.id} className="surface-panel rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-4">
              <div className="space-y-1">
                <div className="font-display font-bold text-sm text-[var(--text-main)]">
                  {cat.title}
                </div>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  {cat.desc}
                </p>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {(['pdf', 'csv', 'html', 'json'] as const).map((fmt) => {
                  const busy = downloadingKey === `${cat.id}:${fmt}`;
                  return (
                    <button
                      key={fmt}
                      type="button"
                      disabled={busy}
                      onClick={() => handleSqaDownload(cat.id, fmt)}
                      className="inline-flex items-center justify-center gap-1 min-h-[38px] rounded-lg surface-elevated hover:bg-[var(--accent-soft)] font-mono text-[11px] uppercase font-semibold disabled:opacity-50"
                    >
                      <FileDown className="w-3 h-3" />
                      <span>{busy ? '...' : fmt}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Run Telemetry Section */}
      {scopedRuns.length === 0 ? (
        <div className="surface-panel rounded-2xl p-8 sm:p-10 text-center space-y-4">
          <BarChart3 className="w-9 h-9 mx-auto text-[var(--accent-primary)]" />
          <h3 className="font-display font-bold text-lg">No Test Runs Recorded Yet</h3>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] max-w-md mx-auto">
            You can export Test Case, Defect, and Summary reports above at any time. Execute a suite in the Live Runner to also chart run history below.
          </p>
          <button
            type="button"
            onClick={() => onNavigate(projects.length > 0 ? 'runner' : 'analyzer')}
            className="px-5 py-2.5 rounded-xl text-xs font-semibold"
            style={{ backgroundColor: 'var(--accent-primary)', color: 'var(--accent-contrast)' }}
          >
            {projects.length > 0 ? 'Open Live Runner' : 'Analyze First Website'}
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 sm:gap-3">
            <div className="surface-panel rounded-xl p-3.5 sm:p-4 min-w-0">
              <div className="text-xs text-[var(--text-muted)]">Generated</div>
              <div className="font-mono font-bold text-xl mt-1 tabular-nums">{metrics.totalGenerated}</div>
            </div>
            <div className="surface-panel rounded-xl p-3.5 sm:p-4 min-w-0">
              <div className="text-xs text-[var(--text-muted)]">Executed</div>
              <div className="font-mono font-bold text-xl mt-1 tabular-nums">{metrics.totalExecuted}</div>
            </div>
            <div className="surface-panel rounded-xl p-3.5 sm:p-4 min-w-0">
              <div className="text-xs text-[var(--text-muted)]">Passed</div>
              <div className="font-mono font-bold text-xl mt-1 tabular-nums text-[var(--status-success)]">
                {metrics.passed}
              </div>
            </div>
            <div className="surface-panel rounded-xl p-3.5 sm:p-4 min-w-0">
              <div className="text-xs text-[var(--text-muted)]">Failed</div>
              <div className="font-mono font-bold text-xl mt-1 tabular-nums text-[var(--status-error)]">
                {metrics.failed}
              </div>
            </div>
            <div className="surface-panel rounded-xl p-3.5 sm:p-4 min-w-0">
              <div className="text-xs text-[var(--text-muted)]">Skipped</div>
              <div className="font-mono font-bold text-xl mt-1 tabular-nums text-[var(--status-warning)]">
                {metrics.skipped}
              </div>
            </div>
            <div className="surface-panel rounded-xl p-3.5 sm:p-4 min-w-0">
              <div className="text-xs text-[var(--text-muted)]">Success Rate</div>
              <div className="font-mono font-bold text-xl mt-1 tabular-nums">{metrics.successPct}%</div>
            </div>
            <div className="surface-panel rounded-xl p-3.5 sm:p-4 col-span-2 lg:col-span-1 min-w-0">
              <div className="text-xs text-[var(--text-muted)]">Avg Duration</div>
              <div className="font-mono font-bold text-xl mt-1 tabular-nums">
                {(metrics.avgDurationMs / 1000).toFixed(1)}s
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-5 sm:gap-6">
            <div className="md:col-span-2 lg:col-span-6 surface-panel rounded-xl p-4 sm:p-5 space-y-4 min-w-0">
              <div className="text-sm font-semibold">Historical Execution Trend</div>
              <div className="h-[220px] sm:h-[240px] w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.16)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="passed" stackId="a" fill="#22c55e" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="failed" stackId="a" fill="#ef4444" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="skipped" stackId="a" fill="#f59e0b" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="lg:col-span-3 surface-panel rounded-xl p-4 sm:p-5 space-y-4 min-w-0">
              <div className="text-sm font-semibold">Pass / Fail Ratio</div>
              <div className="h-[220px] sm:h-[240px] w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80}>
                      {pieData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="lg:col-span-3 surface-panel rounded-xl p-4 sm:p-5 space-y-4 min-w-0">
              <div className="text-sm font-semibold">Browser-Wise Results</div>
              <div className="space-y-3 pt-1">
                {browserData.map((b) => (
                  <div key={b.browser} className="surface-elevated rounded-lg p-3 text-xs space-y-1">
                    <div className="font-semibold uppercase">{b.browser}</div>
                    <div className="flex items-center justify-between font-mono tabular-nums">
                      <span className="text-[var(--status-success)]">{b.passed} passed</span>
                      <span className="text-[var(--status-error)]">{b.failed} failed</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="surface-panel rounded-xl overflow-hidden">
            <div className="px-4 sm:px-5 py-3.5 border-b text-sm font-semibold">
              Historical Execution Records
            </div>

            <div className="md:hidden divide-y">
              {scopedRuns.map((run) => (
                <div key={run.id} className="p-4 space-y-3 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-sm text-[var(--text-main)] truncate">
                        {run.projectName}
                      </div>
                      <div className="font-mono text-[var(--text-secondary)] mt-0.5">
                        {run.browser} · {run.viewport}
                      </div>
                    </div>
                    <span className="font-mono font-semibold uppercase shrink-0">
                      {run.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5 pt-1">
                    {(['pdf', 'csv', 'html', 'json'] as const).map((fmt) => (
                      <button
                        key={fmt}
                        type="button"
                        onClick={() => downloadReportApi(token, run.id, fmt)}
                        className="inline-flex items-center justify-center gap-1 min-h-[40px] rounded-lg surface-elevated hover:bg-[var(--accent-soft)] font-mono text-[11px] uppercase"
                      >
                        <FileDown className="w-3 h-3" />
                        <span>{fmt}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="surface-elevated text-[var(--text-secondary)] border-b">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Project</th>
                    <th className="py-3 px-4 font-semibold">Environment</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    <th className="py-3 px-4 font-semibold text-right">Results</th>
                    <th className="py-3 px-4 font-semibold text-right">Duration</th>
                    <th className="py-3 px-4 font-semibold">Timestamp</th>
                    <th className="py-3 px-4 font-semibold text-right">Export Run</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {scopedRuns.map((run) => (
                    <tr key={run.id} className="hover:bg-[var(--surface-hover)]">
                      <td className="py-3 px-4 font-medium">{run.projectName}</td>
                      <td className="py-3 px-4 font-mono text-[var(--text-secondary)]">
                        {run.browser} · {run.viewport}
                      </td>
                      <td
                        className="py-3 px-4 font-mono font-semibold uppercase"
                        style={{
                          color:
                            run.status === 'completed'
                              ? 'var(--status-success)'
                              : run.status === 'failed'
                                ? 'var(--status-error)'
                                : 'var(--status-warning)',
                        }}
                      >
                        {run.status}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">
                        {run.passed}/{run.totalTests} passed
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">
                        {(run.durationMs / 1000).toFixed(2)}s
                      </td>
                      <td className="py-3 px-4 font-mono text-[var(--text-muted)]">
                        {new Date(run.startedAt).toLocaleString()}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-1.5">
                          {(['pdf', 'csv', 'html', 'json'] as const).map((fmt) => (
                            <button
                              key={fmt}
                              type="button"
                              onClick={() => downloadReportApi(token, run.id, fmt)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md surface-elevated hover:bg-[var(--accent-soft)] font-mono text-[11px] uppercase min-h-[34px]"
                            >
                              <FileDown className="w-3 h-3" />
                              <span>{fmt}</span>
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
