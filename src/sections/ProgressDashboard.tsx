import { useEffect, useRef, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Square, CheckCircle2, ArrowRight } from 'lucide-react';
import { AnimatedCounter } from '@/components/AnimatedCounter';
import type { CrawlStats, LogEntry, DiscoveredPage } from '@/types';
import { getTypeDistribution, TYPE_COLORS } from '@/lib/crawlSimulator';

interface ProgressDashboardProps {
  stats: CrawlStats;
  progress: number;
  logs: LogEntry[];
  pages: DiscoveredPage[];
  currentStatus: string;
  isComplete: boolean;
  onStopCrawl: () => void;
  onViewResults: () => void;
}

export default function ProgressDashboard({
  stats,
  progress,
  logs,
  pages,
  currentStatus,
  isComplete,
  onStopCrawl,
  onViewResults,
}: ProgressDashboardProps) {
  const logContainerRef = useRef<HTMLDivElement>(null);
  const [logFilter, setLogFilter] = useState<'all' | LogEntry['type']>('all');

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const typeDist = getTypeDistribution(pages);
  const chartData = (Object.entries(typeDist) as [keyof typeof typeDist, number][]).map(
    ([name, count]) => ({
      name,
      count,
      color: TYPE_COLORS[name],
    })
  );

  const filteredLogs =
    logFilter === 'all' ? logs : logs.filter((l) => l.type === logFilter);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <section className="space-y-6">
      {/* 4-Column KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="surface-panel rounded-xl p-5">
          <div className="text-xs font-medium text-[var(--text-muted)] mb-1">
            Pages Found
          </div>
          <AnimatedCounter
            value={stats.pagesFound}
            className="font-display font-bold text-3xl text-[var(--text-main)] tabular-nums"
          />
        </div>
        <div className="surface-panel rounded-xl p-5">
          <div className="text-xs font-medium text-[var(--text-muted)] mb-1">
            Pages Crawled
          </div>
          <AnimatedCounter
            value={stats.pagesCrawled}
            className="font-display font-bold text-3xl text-[var(--text-main)] tabular-nums"
          />
        </div>
        <div className="surface-panel rounded-xl p-5">
          <div className="text-xs font-medium text-[var(--text-muted)] mb-1">
            Tests Generated
          </div>
          <AnimatedCounter
            value={stats.testsGenerated}
            className="font-display font-bold text-3xl text-[var(--text-main)] tabular-nums"
          />
        </div>
        <div className="surface-panel rounded-xl p-5">
          <div className="text-xs font-medium text-[var(--text-muted)] mb-1">
            Time Elapsed
          </div>
          <span className="font-mono font-bold text-3xl text-[var(--text-main)] tabular-nums">
            {formatTime(stats.timeElapsed)}
          </span>
        </div>
      </div>

      {/* Progress Bar & Control */}
      <div className="surface-panel rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            {isComplete && (
              <CheckCircle2
                className="w-4 h-4 text-[var(--status-success)] shrink-0"
                aria-hidden="true"
              />
            )}
            <span className="text-sm font-medium text-[var(--text-main)]">
              {currentStatus}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="font-mono text-sm font-semibold text-[var(--text-main)] tabular-nums">
              {Math.round(progress)}%
            </span>
            {!isComplete ? (
              <button
                type="button"
                onClick={onStopCrawl}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium surface-elevated hover:bg-[var(--surface-hover)] text-[var(--text-main)] transition-colors"
              >
                <Square className="w-3.5 h-3.5" />
                <span>Stop Crawl</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onViewResults}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-colors"
                style={{
                  backgroundColor: 'var(--accent-primary)',
                  color: 'var(--accent-contrast)',
                }}
              >
                <span>Open Results &amp; Code</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <div
          className="w-full h-2.5 rounded-full overflow-hidden bg-[var(--surface-elevated)]"
          role="progressbar"
          aria-valuenow={Math.round(progress)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full transition-transform duration-200 origin-left"
            style={{
              transform: `scaleX(${Math.max(0.01, progress / 100)})`,
              background:
                'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))',
            }}
          />
        </div>
      </div>

      {/* Classification Chart & Live Log Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-5 surface-panel rounded-xl p-5 flex flex-col justify-between space-y-4">
          <div>
            <h2 className="font-display font-semibold text-base text-[var(--text-main)]">
              Page Classification Mix
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Distribution of discovered routes by interface pattern
            </p>
          </div>
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
              >
                <XAxis
                  dataKey="name"
                  tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: 'var(--surface-hover)' }}
                  contentStyle={{
                    backgroundColor: 'var(--surface-panel)',
                    borderColor: 'var(--border-hairline)',
                    borderRadius: '0.5rem',
                    fontSize: '12px',
                    color: 'var(--text-main)',
                  }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {chartData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-7 surface-panel rounded-xl p-5 flex flex-col space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display font-semibold text-base text-[var(--text-main)]">
              Crawler Event Log
            </h2>
            <div className="flex items-center gap-1 p-1 rounded-lg surface-elevated">
              {(['all', 'success', 'info', 'warning'] as const).map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setLogFilter(level)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium capitalize transition-colors ${
                    logFilter === level
                      ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)]'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-main)]'
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          <div
            ref={logContainerRef}
            className="flex-1 min-h-[200px] max-h-[240px] overflow-y-auto rounded-lg bg-[var(--surface-canvas)] border p-3.5 space-y-1.5 font-mono text-xs"
          >
            {filteredLogs.length === 0 ? (
              <div className="text-[var(--text-muted)] py-8 text-center">
                No log entries match this filter yet.
              </div>
            ) : (
              filteredLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-2.5">
                  <span className="text-[var(--text-muted)] shrink-0 tabular-nums">
                    {log.timestamp}
                  </span>
                  <span
                    className={
                      log.type === 'success'
                        ? 'text-[var(--status-success)]'
                        : log.type === 'warning'
                          ? 'text-[var(--status-warning)]'
                          : log.type === 'error'
                            ? 'text-[var(--status-error)]'
                            : 'text-[var(--text-secondary)]'
                    }
                  >
                    {log.message}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
