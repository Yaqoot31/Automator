import { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LineChart,
  Line,
  AreaChart,
  Area,
  Legend,
} from 'recharts';
import {
  Globe,
  ClipboardCheck,
  ListChecks,
  FileDown,
  ArrowRight,
  FolderKanban,
  ShieldCheck,
} from 'lucide-react';
import type {
  AutomationProject,
  SqaDefect,
  SqaRelease,
  SqaRequirement,
  SqaTestPlan,
  SqaTestSuite,
  TestRunRecord,
  WorkspaceView,
} from '@/types';

interface AnalyticsDashboardViewProps {
  userName: string;
  projects: AutomationProject[];
  runs: TestRunRecord[];
  plans: SqaTestPlan[];
  suites: SqaTestSuite[];
  defects: SqaDefect[];
  requirements: SqaRequirement[];
  releases: SqaRelease[];
  onNavigate: (view: WorkspaceView) => void;
}

type DateRangeKey = '7d' | '30d' | '90d' | 'all';

const CHART_TOOLTIP_STYLE = {
  backgroundColor: 'var(--surface-panel)',
  border: '1px solid var(--border-strong)',
  borderRadius: '10px',
  fontSize: '12px',
  color: 'var(--text-main)',
};

export function AnalyticsDashboardView({
  userName,
  projects,
  runs,
  defects,
  releases,
  onNavigate,
}: AnalyticsDashboardViewProps) {
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [dateRange, setDateRange] = useState<DateRangeKey>('all');

  const [nowMs] = useState(() => Date.now());
  const cutoffMs = useMemo(() => {
    if (dateRange === '7d') return nowMs - 7 * 86400_000;
    if (dateRange === '30d') return nowMs - 30 * 86400_000;
    if (dateRange === '90d') return nowMs - 90 * 86400_000;
    return 0;
  }, [dateRange, nowMs]);

  const scopedProjects = useMemo(
    () =>
      selectedProjectId === 'all'
        ? projects
        : projects.filter((p) => p.id === selectedProjectId),
    [projects, selectedProjectId]
  );

  const scopedRuns = useMemo(
    () =>
      runs.filter((r) => {
        if (selectedProjectId !== 'all' && r.projectId !== selectedProjectId) return false;
        if (cutoffMs && new Date(r.startedAt).getTime() < cutoffMs) return false;
        return true;
      }),
    [runs, selectedProjectId, cutoffMs]
  );

  const scopedDefects = useMemo(
    () =>
      defects.filter((d) => {
        if (selectedProjectId !== 'all' && d.projectId !== selectedProjectId) return false;
        if (cutoffMs && new Date(d.createdAt).getTime() < cutoffMs) return false;
        return true;
      }),
    [defects, selectedProjectId, cutoffMs]
  );

  const scopedReleases = useMemo(
    () =>
      releases.filter((rel) =>
        selectedProjectId === 'all' ? true : rel.projectId === selectedProjectId
      ),
    [releases, selectedProjectId]
  );

  const allCases = useMemo(
    () => scopedProjects.flatMap((p) => p.testCases),
    [scopedProjects]
  );

  const kpis = useMemo(() => {
    const totalProjects = scopedProjects.length;
    const totalCases = allCases.length;
    const passed = allCases.filter((t) => t.status === 'passed' || t.sqaStatus === 'Pass').length;
    const failed = allCases.filter((t) => t.status === 'failed' || t.sqaStatus === 'Fail').length;
    const blocked = allCases.filter((t) => t.status === 'blocked' || t.sqaStatus === 'Blocked').length;
    const pending = Math.max(0, totalCases - passed - failed - blocked);
    const executed = passed + failed + blocked;
    const passRate = executed > 0 ? Math.round((passed / executed) * 100) : 0;

    const automatedCases = allCases.filter((t) => t.automationStatus !== 'Manual').length;
    const automationCoverage = totalCases > 0 ? Math.round((automatedCases / totalCases) * 100) : 0;

    const totalDefects = scopedDefects.length;
    const closedDefects = scopedDefects.filter((d) => d.status === 'Closed').length;
    const openDefects = totalDefects - closedDefects;
    const readyReleases = scopedReleases.filter((r) => r.readinessStatus === 'Ready').length;

    return {
      totalProjects,
      totalCases,
      passed,
      failed,
      blocked,
      pending,
      passRate,
      automatedCases,
      manualCases: totalCases - automatedCases,
      automationCoverage,
      totalDefects,
      openDefects,
      closedDefects,
      readyReleases,
      totalReleases: scopedReleases.length,
    };
  }, [scopedProjects, allCases, scopedDefects, scopedReleases]);

  // 1. Test Case Execution Status (Pie)
  const statusPieData = useMemo(
    () =>
      [
        { name: 'Passed', value: kpis.passed, color: '#22c55e' },
        { name: 'Failed', value: kpis.failed, color: '#ef4444' },
        { name: 'Blocked', value: kpis.blocked, color: '#f59e0b' },
        { name: 'Pending', value: kpis.pending, color: '#64748b' },
      ].filter((d) => d.value > 0),
    [kpis]
  );

  // 2. Pass vs Fail Results (Bar)
  const passFailBarData = useMemo(
    () => [
      { metric: 'Passed', count: kpis.passed },
      { metric: 'Failed', count: kpis.failed },
      { metric: 'Blocked', count: kpis.blocked },
      { metric: 'Pending', count: kpis.pending },
    ],
    [kpis]
  );

  // 3. Execution Progress Over Time (Line)
  const executionTrendData = useMemo(() => {
    const sorted = [...scopedRuns]
      .sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime())
      .slice(-12);
    return sorted.map((r, i) => ({
      label: new Date(r.startedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) || `Run ${i + 1}`,
      passed: r.passed,
      failed: r.failed,
      passRate: r.totalTests > 0 ? Math.round((r.passed / r.totalTests) * 100) : 0,
    }));
  }, [scopedRuns]);

  // 4. Automation vs Manual Coverage (Doughnut)
  const automationDoughnutData = useMemo(
    () =>
      [
        { name: 'Automated', value: kpis.automatedCases, color: '#14b8a6' },
        { name: 'Manual', value: kpis.manualCases, color: '#d4a017' },
      ].filter((d) => d.value > 0),
    [kpis]
  );

  // 5. Defect Severity Distribution (Bar)
  const defectSeverityData = useMemo(() => {
    const counts = { Critical: 0, Major: 0, Minor: 0 };
    for (const d of scopedDefects) {
      counts[d.severity] = (counts[d.severity] || 0) + 1;
    }
    return [
      { severity: 'Critical', count: counts.Critical },
      { severity: 'Major', count: counts.Major },
      { severity: 'Minor', count: counts.Minor },
    ];
  }, [scopedDefects]);

  // 6. Defect Resolution Trend (Area)
  const defectTrendData = useMemo(() => {
    const byDate = new Map<string, { date: string; opened: number; closed: number }>();
    const sorted = [...scopedDefects].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    for (const d of sorted) {
      const day = new Date(d.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      const entry = byDate.get(day) || { date: day, opened: 0, closed: 0 };
      entry.opened += 1;
      if (d.status === 'Closed' || d.status === 'Fixed') entry.closed += 1;
      byDate.set(day, entry);
    }
    return Array.from(byDate.values()).slice(-12);
  }, [scopedDefects]);

  // 7. Module-Wise Coverage (Horizontal Bar)
  const moduleCoverageData = useMemo(() => {
    const map = new Map<string, { module: string; passed: number; total: number }>();
    for (const tc of allCases) {
      const mod = (tc.module || tc.category || 'General').slice(0, 18);
      const entry = map.get(mod) || { module: mod, passed: 0, total: 0 };
      entry.total += 1;
      if (tc.status === 'passed' || tc.sqaStatus === 'Pass') entry.passed += 1;
      map.set(mod, entry);
    }
    return Array.from(map.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [allCases]);

  // 8. Release Quality Metrics (Bar)
  const releaseQualityData = useMemo(() => {
    return scopedReleases.slice(0, 8).map((r) => ({
      release: r.version || r.name.slice(0, 14),
      verified: r.buildVerified ? 100 : 35,
      readinessScore:
        r.readinessStatus === 'Ready'
          ? 100
          : r.readinessStatus === 'Pending'
            ? 60
            : r.readinessStatus === 'At Risk'
              ? 35
              : 15,
    }));
  }, [scopedReleases]);

  // 9. Language / Framework Generation Stats (Bar)
  const frameworkStatsData = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of scopedProjects) {
      const fws = p.selectedFrameworks && p.selectedFrameworks.length > 0 ? p.selectedFrameworks : [p.framework];
      for (const fw of fws) {
        map.set(fw, (map.get(fw) || 0) + 1);
      }
    }
    return Array.from(map.entries()).map(([framework, count]) => ({ framework, count }));
  }, [scopedProjects]);

  // 10. Project Performance Comparison (Bar)
  const projectComparisonData = useMemo(() => {
    return scopedProjects.slice(0, 8).map((p) => {
      const total = p.testCases.length;
      const passed = p.testCases.filter((t) => t.status === 'passed' || t.sqaStatus === 'Pass').length;
      const failed = p.testCases.filter((t) => t.status === 'failed' || t.sqaStatus === 'Fail').length;
      return {
        name: p.name.slice(0, 16),
        passed,
        failed,
        total,
      };
    });
  }, [scopedProjects]);

  const hasAnyData = projects.length > 0 || runs.length > 0 || defects.length > 0;

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-6 animate-view-enter">
      {/* Executive Header & Filters */}
      <div className="surface-panel rounded-2xl p-4 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <div className="text-xs font-medium text-[var(--text-muted)]">
            Executive Quality Overview · {userName}
          </div>
          <h1 className="font-display font-bold text-xl sm:text-2xl lg:text-3xl tracking-tight text-[var(--text-main)]">
            Automation &amp; SQA Analytics Command
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
            Live metrics aggregated directly from your analyzed projects, test runs, defects, and release records.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
          <select
            aria-label="Filter dashboard by project"
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="min-h-[44px] px-3 rounded-xl surface-elevated text-xs font-medium text-[var(--text-main)]"
          >
            <option value="all">All Projects ({projects.length})</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1 p-1 rounded-xl surface-elevated">
            {(['7d', '30d', '90d', 'all'] as DateRangeKey[]).map((range) => (
              <button
                key={range}
                type="button"
                onClick={() => setDateRange(range)}
                className={`px-3 py-2 rounded-lg text-xs font-semibold min-h-[36px] uppercase whitespace-nowrap transition-colors ${
                  dateRange === range
                    ? 'bg-[var(--surface-panel)] text-[var(--text-main)] shadow-xs'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-main)]'
                }`}
              >
                {range}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => onNavigate('analyzer')}
            className="inline-flex items-center justify-center gap-2 px-4 min-h-[44px] rounded-xl text-xs font-semibold whitespace-nowrap"
            style={{ backgroundColor: 'var(--accent-primary)', color: 'var(--accent-contrast)' }}
          >
            <Globe className="w-4 h-4" />
            <span>Test Website URL</span>
          </button>
        </div>
      </div>

      {/* 12 Live KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total Projects', value: kpis.totalProjects, accent: 'var(--text-main)' },
          { label: 'Total Test Cases', value: kpis.totalCases, accent: 'var(--text-main)' },
          { label: 'Passed Tests', value: kpis.passed, accent: 'var(--status-success)' },
          { label: 'Failed Tests', value: kpis.failed, accent: 'var(--status-error)' },
          { label: 'Blocked Tests', value: kpis.blocked, accent: 'var(--status-warning)' },
          { label: 'Pending / Not Run', value: kpis.pending, accent: 'var(--text-secondary)' },
          { label: 'Pass Rate', value: `${kpis.passRate}%`, accent: 'var(--status-success)' },
          { label: 'Automation Coverage', value: `${kpis.automationCoverage}%`, accent: 'var(--accent-secondary)' },
          { label: 'Total Defects', value: kpis.totalDefects, accent: 'var(--text-main)' },
          { label: 'Open Defects', value: kpis.openDefects, accent: 'var(--status-error)' },
          { label: 'Closed Defects', value: kpis.closedDefects, accent: 'var(--status-success)' },
          {
            label: 'Ready Releases',
            value: `${kpis.readyReleases}/${kpis.totalReleases}`,
            accent: 'var(--accent-primary)',
          },
        ].map((kpi) => (
          <div key={kpi.label} className="surface-panel rounded-xl p-3.5 sm:p-4 min-w-0">
            <div className="text-xs text-[var(--text-muted)] truncate">{kpi.label}</div>
            <div
              className="font-mono font-bold text-xl sm:text-2xl mt-1 tabular-nums"
              style={{ color: kpi.accent }}
            >
              {kpi.value}
            </div>
          </div>
        ))}
      </div>

      {/* Empty State Onboarding Callout if Database Has No Records */}
      {!hasAnyData ? (
        <div className="surface-panel rounded-2xl p-8 sm:p-12 text-center space-y-5">
          <ShieldCheck className="w-11 h-11 mx-auto text-[var(--accent-primary)]" />
          <div className="space-y-2 max-w-xl mx-auto">
            <h2 className="font-display font-bold text-xl">
              Your SQA &amp; Automation Workspace is Ready
            </h2>
            <p className="text-sm text-[var(--text-secondary)]">
              No synthetic or placeholder numbers are shown here. Analyze a live website URL, generate multi-language test projects, or log SQA records to populate all 10 interactive charts with real data.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate('analyzer')}
              className="inline-flex items-center gap-2 px-5 min-h-[44px] rounded-xl text-sm font-semibold"
              style={{ backgroundColor: 'var(--accent-primary)', color: 'var(--accent-contrast)' }}
            >
              <Globe className="w-4 h-4" />
              <span>Analyze First Website</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate('sqa')}
              className="inline-flex items-center gap-2 px-5 min-h-[44px] rounded-xl text-sm font-medium surface-elevated hover:bg-[var(--surface-hover)]"
            >
              <ClipboardCheck className="w-4 h-4 text-[var(--accent-secondary)]" />
              <span>Open SQA Management</span>
            </button>
          </div>
        </div>
      ) : (
        /* 10 Real-Data Interactive Charts */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-5">
          {/* 1. Test Case Execution Status (Pie) */}
          <div className="xl:col-span-4 surface-panel rounded-2xl p-4 sm:p-5 space-y-3 min-w-0">
            <div className="text-sm font-semibold">1. Test Case Execution Status</div>
            <div className="h-[220px] w-full">
              {statusPieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusPieData} dataKey="value" nameKey="name" outerRadius={78}>
                      {statusPieData.map((e, i) => (
                        <Cell key={i} fill={e.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChartNote message="No test cases in current filter." />
              )}
            </div>
          </div>

          {/* 2. Pass vs Fail Results (Bar) */}
          <div className="xl:col-span-4 surface-panel rounded-2xl p-4 sm:p-5 space-y-3 min-w-0">
            <div className="text-sm font-semibold">2. Pass vs Fail Breakdown</div>
            <div className="h-[220px] w-full">
              {allCases.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={passFailBarData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.14)" />
                    <XAxis dataKey="metric" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                    <Bar dataKey="count" fill="#d4a017" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChartNote message="Run or create test cases to inspect pass/fail metrics." />
              )}
            </div>
          </div>

          {/* 3. Automation vs Manual Coverage (Doughnut) */}
          <div className="xl:col-span-4 surface-panel rounded-2xl p-4 sm:p-5 space-y-3 min-w-0">
            <div className="text-sm font-semibold">3. Automation vs Manual Coverage</div>
            <div className="h-[220px] w-full">
              {automationDoughnutData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={automationDoughnutData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={48}
                      outerRadius={78}
                    >
                      {automationDoughnutData.map((e, i) => (
                        <Cell key={i} fill={e.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChartNote message="No test cases recorded yet." />
              )}
            </div>
          </div>

          {/* 4. Execution Progress Over Time (Line) */}
          <div className="xl:col-span-6 surface-panel rounded-2xl p-4 sm:p-5 space-y-3 min-w-0">
            <div className="text-sm font-semibold">4. Execution Progress Over Time</div>
            <div className="h-[240px] w-full">
              {executionTrendData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={executionTrendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.14)" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Line type="monotone" dataKey="passed" stroke="#22c55e" strokeWidth={2} />
                    <Line type="monotone" dataKey="failed" stroke="#ef4444" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChartNote message="Execute tests in Live Runner to chart trends." />
              )}
            </div>
          </div>

          {/* 5. Defect Resolution Trend (Area) */}
          <div className="xl:col-span-6 surface-panel rounded-2xl p-4 sm:p-5 space-y-3 min-w-0">
            <div className="text-sm font-semibold">5. Defect Discovery &amp; Resolution Trend</div>
            <div className="h-[240px] w-full">
              {defectTrendData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={defectTrendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.14)" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Area
                      type="monotone"
                      dataKey="opened"
                      stroke="#ef4444"
                      fill="rgba(239,68,68,0.18)"
                    />
                    <Area
                      type="monotone"
                      dataKey="closed"
                      stroke="#22c55e"
                      fill="rgba(34,197,94,0.18)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChartNote message="Log defects in SQA Management to chart resolution velocity." />
              )}
            </div>
          </div>

          {/* 6. Defect Severity Distribution */}
          <div className="xl:col-span-4 surface-panel rounded-2xl p-4 sm:p-5 space-y-3 min-w-0">
            <div className="text-sm font-semibold">6. Defect Severity Distribution</div>
            <div className="h-[220px] w-full">
              {scopedDefects.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={defectSeverityData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.14)" />
                    <XAxis dataKey="severity" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                    <Bar dataKey="count" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChartNote message="Zero defects logged for this scope." />
              )}
            </div>
          </div>

          {/* 7. Module-Wise Coverage (Horizontal Bar) */}
          <div className="xl:col-span-4 surface-panel rounded-2xl p-4 sm:p-5 space-y-3 min-w-0">
            <div className="text-sm font-semibold">7. Module-Wise Coverage</div>
            <div className="h-[220px] w-full">
              {moduleCoverageData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={moduleCoverageData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.14)" />
                    <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                    <YAxis dataKey="module" type="category" width={92} tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                    <Bar dataKey="total" fill="#38bdf8" radius={[0, 4, 4, 0]} name="Total" />
                    <Bar dataKey="passed" fill="#22c55e" radius={[0, 4, 4, 0]} name="Passed" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChartNote message="No test modules present yet." />
              )}
            </div>
          </div>

          {/* 8. Release Quality Metrics */}
          <div className="xl:col-span-4 surface-panel rounded-2xl p-4 sm:p-5 space-y-3 min-w-0">
            <div className="text-sm font-semibold">8. Release Readiness &amp; Quality</div>
            <div className="h-[220px] w-full">
              {releaseQualityData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={releaseQualityData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.14)" />
                    <XAxis dataKey="release" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                    <Bar dataKey="readinessScore" fill="#14b8a6" radius={[4, 4, 0, 0]} name="Readiness %" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChartNote message="Create release records in SQA Management." />
              )}
            </div>
          </div>

          {/* 9. Language / Framework Generation Stats */}
          <div className="xl:col-span-6 surface-panel rounded-2xl p-4 sm:p-5 space-y-3 min-w-0">
            <div className="text-sm font-semibold">9. Language &amp; Framework Adoption</div>
            <div className="h-[220px] w-full">
              {frameworkStatsData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={frameworkStatsData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.14)" />
                    <XAxis dataKey="framework" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                    <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Projects" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChartNote message="Generate a project to view framework breakdown." />
              )}
            </div>
          </div>

          {/* 10. Project Performance Comparison */}
          <div className="xl:col-span-6 surface-panel rounded-2xl p-4 sm:p-5 space-y-3 min-w-0">
            <div className="text-sm font-semibold">10. Project Performance Comparison</div>
            <div className="h-[220px] w-full">
              {projectComparisonData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={projectComparisonData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.14)" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Bar dataKey="passed" stackId="p" fill="#22c55e" name="Passed" />
                    <Bar dataKey="failed" stackId="p" fill="#ef4444" name="Failed" />
                    <Bar dataKey="total" fill="rgba(148,163,184,0.28)" name="Total Cases" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChartNote message="Add multiple projects to compare quality scores." />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Quick Action Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            title: 'Website URL Analyzer',
            desc: 'Crawl live DOM & export multi-language ZIP',
            icon: Globe,
            view: 'analyzer' as WorkspaceView,
          },
          {
            title: '14-Column Test Cases',
            desc: 'Sync Google Sheets, Excel & CSV matrices',
            icon: ListChecks,
            view: 'tests' as WorkspaceView,
          },
          {
            title: 'SQA Lifecycle Hub',
            desc: 'Plans, 7-status bugs, RTM & Releases',
            icon: ClipboardCheck,
            view: 'sqa' as WorkspaceView,
          },
          {
            title: 'Reports Center',
            desc: '10 downloadable PDF, XLSX, CSV & JSON reports',
            icon: FileDown,
            view: 'reports' as WorkspaceView,
          },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.view}
              type="button"
              onClick={() => onNavigate(item.view)}
              className="interactive-card rounded-xl p-4 text-left flex items-start gap-3 min-h-[44px]"
            >
              <Icon className="w-5 h-5 text-[var(--accent-primary)] shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="text-sm font-semibold text-[var(--text-main)] truncate">
                  {item.title}
                </div>
                <div className="text-xs text-[var(--text-secondary)] mt-0.5">{item.desc}</div>
              </div>
            </button>
          );
        })}
      </div>

      {projects.length > 0 && (
        <div className="surface-panel rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <FolderKanban className="w-5 h-5 text-[var(--accent-secondary)] shrink-0" />
            <div className="text-xs text-[var(--text-secondary)]">
              Managing <span className="font-semibold text-[var(--text-main)]">{projects.length}</span> active project(s) and{' '}
              <span className="font-semibold text-[var(--text-main)]">{runs.length}</span> execution record(s).
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('projects')}
            className="px-4 min-h-[40px] rounded-lg text-xs font-medium surface-elevated hover:bg-[var(--surface-hover)] shrink-0"
          >
            Manage Projects &amp; Team
          </button>
        </div>
      )}
    </div>
  );
}

function EmptyChartNote({ message }: { message: string }) {
  return (
    <div className="h-full flex items-center justify-center text-center px-4 text-xs text-[var(--text-muted)]">
      {message}
    </div>
  );
}
