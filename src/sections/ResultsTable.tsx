import { useState } from 'react';
import {
  Eye,
  Code2,
  ChevronLeft,
  ChevronRight,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  Compass,
} from 'lucide-react';
import type { DiscoveredPage, Framework, PageType } from '@/types';
import { CodePreviewModal } from '@/components/CodePreviewModal';

interface ResultsTableProps {
  pages: DiscoveredPage[];
  defaultFramework?: Framework;
  onStartSampleCrawl?: () => void;
}

const FILTER_OPTIONS: ('All' | PageType)[] = [
  'All',
  'Login',
  'Dashboard',
  'Product',
  'Form',
  'Table',
  'Other',
];

const STATUS_META = {
  pending: { label: 'Pending', icon: Clock, color: 'var(--text-muted)' },
  crawling: { label: 'Crawling', icon: Loader2, color: 'var(--accent-primary)' },
  completed: { label: 'Completed', icon: CheckCircle2, color: 'var(--status-success)' },
  skipped: { label: 'Skipped', icon: AlertCircle, color: 'var(--status-error)' },
};

export default function ResultsTable({
  pages,
  defaultFramework = 'playwright-ts',
  onStartSampleCrawl,
}: ResultsTableProps) {
  const [activeFilter, setActiveFilter] = useState<'All' | PageType>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(0);
  const [previewPage, setPreviewPage] = useState<DiscoveredPage | null>(null);

  const itemsPerPage = 8;

  const filteredPages = pages.filter((p) => {
    const matchesType = activeFilter === 'All' || p.type === activeFilter;
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      p.path.toLowerCase().includes(q) ||
      p.url.toLowerCase().includes(q) ||
      p.type.toLowerCase().includes(q);
    return matchesType && matchesSearch;
  });

  const totalPages = Math.max(1, Math.ceil(filteredPages.length / itemsPerPage));
  const safePage = Math.min(currentPage, totalPages - 1);
  const paginatedPages = filteredPages.slice(
    safePage * itemsPerPage,
    (safePage + 1) * itemsPerPage
  );

  if (pages.length === 0) {
    return (
      <section className="surface-panel rounded-2xl p-10 text-center space-y-4">
        <div className="w-12 h-12 rounded-xl surface-elevated mx-auto flex items-center justify-center">
          <Compass className="w-6 h-6 text-[var(--accent-primary)]" />
        </div>
        <div className="space-y-1 max-w-md mx-auto">
          <h2 className="font-display font-semibold text-lg text-[var(--text-main)]">
            No Discovered Pages Yet
          </h2>
          <p className="text-sm text-[var(--text-secondary)]">
            Run a crawl in Crawler Studio to discover routes, classify page patterns, and inspect generated test code.
          </p>
        </div>
        {onStartSampleCrawl && (
          <button
            type="button"
            onClick={onStartSampleCrawl}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold min-h-[42px]"
            style={{
              backgroundColor: 'var(--accent-primary)',
              color: 'var(--accent-contrast)',
            }}
          >
            Run Instant Crawl
          </button>
        )}
      </section>
    );
  }

  return (
    <>
      <section className="surface-panel rounded-2xl p-5 sm:p-6 space-y-5">
        {/* Header & Search */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h2 className="font-display font-semibold text-xl text-[var(--text-main)]">
              Discovered Pages
            </h2>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5 tabular-nums">
              {filteredPages.length} of {pages.length} routes shown
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative">
              <Search
                className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <label htmlFor="results-search" className="sr-only">
                Filter routes by path or URL
              </label>
              <input
                id="results-search"
                type="search"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(0);
                }}
                placeholder="Search routes..."
                className="w-full sm:w-56 h-9 pl-9 pr-3 rounded-lg surface-elevated text-sm text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
              />
            </div>

            <div className="flex flex-wrap gap-1 p-1 rounded-lg surface-elevated">
              {FILTER_OPTIONS.map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => {
                    setActiveFilter(filter);
                    setCurrentPage(0);
                  }}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                    activeFilter === filter
                      ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)]'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-main)]'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* High-Density Data Table */}
        <div className="overflow-x-auto border rounded-xl">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b bg-[var(--surface-elevated)] text-xs font-medium text-[var(--text-secondary)]">
                <th className="py-3 px-4">Route Path</th>
                <th className="py-3 px-4">Archetype</th>
                <th className="py-3 px-4 text-right">Elements</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Test Spec</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {paginatedPages.map((page) => {
                const status = STATUS_META[page.status];
                const StatusIcon = status.icon;
                return (
                  <tr
                    key={page.id}
                    className="hover:bg-[var(--surface-hover)] transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="font-mono text-xs sm:text-sm text-[var(--text-main)] truncate max-w-[260px] sm:max-w-[340px]">
                        {page.path}
                      </div>
                      <div className="font-mono text-[11px] text-[var(--text-muted)] truncate max-w-[260px] sm:max-w-[340px]">
                        {page.locators.slice(0, 2).join(' · ')}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-[var(--text-secondary)] whitespace-nowrap">
                      {page.type}
                    </td>
                    <td className="py-3 px-4 font-mono text-sm text-[var(--text-main)] text-right tabular-nums whitespace-nowrap">
                      {page.elements}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className="inline-flex items-center gap-1.5 text-xs font-medium"
                        style={{ color: status.color }}
                      >
                        <StatusIcon
                          className={`w-3.5 h-3.5 ${
                            page.status === 'crawling' ? 'animate-spin' : ''
                          }`}
                          aria-hidden="true"
                        />
                        <span>{status.label}</span>
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setPreviewPage(page)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium surface-elevated hover:bg-[var(--accent-soft)] text-[var(--text-main)] transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Inspect</span>
                        <Code2 className="w-3.5 h-3.5 text-[var(--accent-primary)]" aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {paginatedPages.length === 0 && (
            <div className="py-10 text-center text-sm text-[var(--text-secondary)]">
              No discovered pages match your current filter.
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--text-secondary)]">
            <span className="tabular-nums">
              Showing {safePage * itemsPerPage + 1}–
              {Math.min((safePage + 1) * itemsPerPage, filteredPages.length)} of{' '}
              {filteredPages.length}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                disabled={safePage === 0}
                aria-label="Previous page"
                className="p-2 rounded-lg surface-elevated disabled:opacity-40 min-w-[36px] min-h-[36px] flex items-center justify-center"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setCurrentPage(i)}
                  className={`min-w-[36px] min-h-[36px] px-2.5 rounded-lg font-mono text-xs tabular-nums ${
                    safePage === i
                      ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)] font-semibold'
                      : 'surface-elevated text-[var(--text-secondary)] hover:text-[var(--text-main)]'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={safePage === totalPages - 1}
                aria-label="Next page"
                className="p-2 rounded-lg surface-elevated disabled:opacity-40 min-w-[36px] min-h-[36px] flex items-center justify-center"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </section>

      {previewPage && (
        <CodePreviewModal
          page={previewPage}
          initialFramework={defaultFramework}
          onClose={() => setPreviewPage(null)}
        />
      )}
    </>
  );
}
