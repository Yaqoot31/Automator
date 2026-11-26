import { useMemo } from 'react';
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
import { FileDown, BarChart3 } from 'lucide-react';
import type { AutomationProject, TestRunRecord, WorkspaceView } from '@/types';
import { downloadReportApi } from '@/lib/api';

interface ReportsViewProps {
  token: string;
  projects: AutomationProject[];
  runs: TestRunRecord[];
  onNavigate: (view: WorkspaceView) => void;
}

export function ReportsView({ token, projects, runs, onNavigate }: ReportsViewProps) {
  const metrics = useMemo(() => {
    const totalGenerated = projects.reduce((sum, p) => sum + p.testCases.length, 0);
    const totalExecuted = runs.reduce((sum, r) => sum + r.totalTests, 0);
    const passed = runs.reduce((sum, r) => sum + r.passed, 0);
    const failed = runs.reduce((sum, r) => sum + r.failed, 0);
    const skipped = runs.reduce((sum, r) => sum + r.skipped, 0);
    const successPct = totalExecuted > 0 ? Math.round((passed / totalExecuted) * 100) : 0;
    const avgDurationMs =
      runs.length > 0
        ? Math.round(runs.reduce((sum, r) => sum + r.durationMs, 0) / runs.length)
        : 0;
    return { totalGenerated, totalExecuted, passed, failed, skipped, successPct, avgDurationMs };
  }, [projects, runs]);

  const trendData = useMemo(() => {
    return runs
      .slice(0, 10)
      .reverse()
      .map((r, i) => ({
        name: `Run ${i + 1}`,
        passed: r.passed,
        failed: r.failed,
        skipped: r.skipped,
      }));
  }, [runs]);

  const browserData = useMemo(() => {
    const map = new Map<string, { browser: string; passed: number; failed: number }>();
    for (const r of runs) {
      const entry = map.get(r.browser) || { browser: r.browser, passed: 0, failed: 0 };
      entry.passed += r.passed;
      entry.failed += r.failed;
      map.set(r.browser, entry);
    }
    return Array.from(map.values());
  }, [runs]);

  const pieData = [
    { name: 'Passed', value: metrics.passed, color: '#22c55e' },
    { name: 'Failed', value: metrics.failed, color: '#ef4444' },
    { name: 'Skipped', value: metrics.skipped, color: '#f59e0b' },
  ].filter((d) => d.value > 0);

  if (runs.length === 0) {
    return (
      <div className="max-w-[960px] mx-auto px-4 py-16 text-center">
        <div className="surface-panel rounded-2xl p-10 space-y-4">
          <BarChart3 className="w-10 h-10 mx-auto text-[var(--accent-primary)]" />
          <h2 className="font-display font-bold text-xl">No Execution Reports Recorded Yet</h2>
          <p className="text-sm text-[var(--text-secondary)] max-w-md mx-auto">
            Execute a test suite in the Live Test Runner to populate real execution analytics, browser breakdowns, and downloadable PDF/HTML/JSON reports.
          </p>
          <button
            type="button"
            onClick={() => onNavigate(projects.length > 0 ? 'runner' : 'analyzer')}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold"
            style={{ backgroundColor: 'var(--accent-primary)', color: 'var(--accent-contrast)' }}
          >
            {projects.length > 0 ? 'Open Live Runner' : 'Analyze First Website'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-5 sm:space-y-6">
      <div>
        <h1 className="font-display font-bold text-xl sm:text-2xl text-[var(--text-main)]">
          Automation Reports &amp; Analytics
        </h1>
        <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
          Aggregated test execution telemetry across {runs.length} recorded run(s) and {projects.length} project(s).
        </p>
      </div>

      {/* KPI Strip */}
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

      {/* Visual Charts */}
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

      {/* Historical Execution Records */}
      <div className="surface-panel rounded-xl overflow-hidden">
        <div className="px-4 sm:px-5 py-3.5 border-b text-sm font-semibold">
          Historical Execution Records
        </div>

        {/* Mobile Cards (< md) */}
        <div className="md:hidden divide-y">
          {runs.map((run) => (
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
                <span
                  className="font-mono font-semibold uppercase shrink-0"
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
                </span>
              </div>

              <div className="flex items-center justify-between font-mono tabular-nums text-[var(--text-secondary)]">
                <span>{run.passed}/{run.totalTests} passed</span>
                <span>{(run.durationMs / 1000).toFixed(2)}s</span>
              </div>

              <div className="font-mono text-[11px] text-[var(--text-muted)]">
                {new Date(run.startedAt).toLocaleString()}
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1">
                {(['pdf', 'html', 'json'] as const).map((fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => downloadReportApi(token, run.id, fmt)}
                    className="inline-flex items-center justify-center gap-1.5 min-h-[42px] rounded-lg surface-elevated hover:bg-[var(--accent-soft)] font-mono text-xs uppercase"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    <span>{fmt}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Desktop Table (md+) */}
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
                <th className="py-3 px-4 font-semibold text-right">Export Report</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {runs.map((run) => (
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
                      {(['pdf', 'html', 'json'] as const).map((fmt) => (
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
    </div>
  );
}
