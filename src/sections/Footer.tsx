import type { AppView } from '@/types';

interface FooterProps {
  onNavigate: (view: AppView) => void;
}

export default function Footer({ onNavigate }: FooterProps) {
  return (
    <footer className="mt-16 border-t bg-[var(--surface-panel)]">
      <div className="max-w-[1200px] mx-auto px-6 py-8 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div className="space-y-1">
          <div className="font-display font-semibold text-sm text-[var(--text-main)]">
            WebCrawler Pro
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            Automated web crawling, resilient locator synthesis, and multi-framework test suite generation.
          </p>
        </div>

        <nav aria-label="Footer navigation" className="flex flex-wrap items-center gap-5 text-xs font-medium text-[var(--text-secondary)]">
          <button
            type="button"
            onClick={() => onNavigate('overview')}
            className="hover:text-[var(--text-main)] transition-colors"
          >
            Overview
          </button>
          <button
            type="button"
            onClick={() => onNavigate('crawler')}
            className="hover:text-[var(--text-main)] transition-colors"
          >
            Crawler Studio
          </button>
          <button
            type="button"
            onClick={() => onNavigate('results')}
            className="hover:text-[var(--text-main)] transition-colors"
          >
            Results &amp; Code
          </button>
          <button
            type="button"
            onClick={() => onNavigate('demos')}
            className="hover:text-[var(--text-main)] transition-colors"
          >
            Interactive Product Demos
          </button>
          <button
            type="button"
            onClick={() => onNavigate('settings')}
            className="hover:text-[var(--text-main)] transition-colors"
          >
            Settings
          </button>
        </nav>

        <div className="text-xs text-[var(--text-muted)] whitespace-nowrap">
          WebCrawler Pro · Yaqoot Nawab
        </div>
      </div>
    </footer>
  );
}
