import { useState } from 'react';
import { Globe, Settings2, Play, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';

interface CrawlConfigurationProps {
  url: string;
  onUrlChange: (url: string) => void;
  respectRobots: boolean;
  onRespectRobotsChange: (v: boolean) => void;
  followSubdomains: boolean;
  onFollowSubdomainsChange: (v: boolean) => void;
  maxPages: number;
  onMaxPagesChange: (v: number) => void;
  crawlDelayMs: number;
  onCrawlDelayMsChange: (v: number) => void;
  maxDepth: number;
  onMaxDepthChange: (v: number) => void;
  userAgent: string;
  onUserAgentChange: (v: string) => void;
  onStartCrawl: () => void;
  onResetCrawl: () => void;
  hasResults: boolean;
  disabled: boolean;
}

const PRESET_TARGETS = [
  { label: 'Example Store', url: 'https://example.com' },
  { label: 'SaaS Portal', url: 'https://app.acme-workspace.io' },
  { label: 'Commerce Suite', url: 'https://shop.northstar-retail.com' },
];

export default function CrawlConfiguration({
  url,
  onUrlChange,
  respectRobots,
  onRespectRobotsChange,
  followSubdomains,
  onFollowSubdomainsChange,
  maxPages,
  onMaxPagesChange,
  crawlDelayMs,
  onCrawlDelayMsChange,
  maxDepth,
  onMaxDepthChange,
  userAgent,
  onUserAgentChange,
  onStartCrawl,
  onResetCrawl,
  hasResults,
  disabled,
}: CrawlConfigurationProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <section className="surface-panel rounded-2xl p-6 sm:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-2xl text-[var(--text-main)]">
            Crawler Studio
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Configure target scope, traversal limits, and browser extraction policies before starting a crawl.
          </p>
        </div>

        {/* Preset quick-fill buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-[var(--text-muted)]">Presets:</span>
          {PRESET_TARGETS.map((preset) => (
            <button
              key={preset.url}
              type="button"
              disabled={disabled}
              onClick={() => onUrlChange(preset.url)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap disabled:opacity-40 ${
                url === preset.url
                  ? 'bg-[var(--accent-soft)] text-[var(--text-main)] border border-[var(--accent-primary)]'
                  : 'surface-elevated text-[var(--text-secondary)] hover:text-[var(--text-main)]'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Target URL Input */}
      <div className="space-y-2">
        <label
          htmlFor="crawler-url-input"
          className="block text-xs font-medium text-[var(--text-secondary)]"
        >
          Target Root URL
        </label>
        <div className="relative">
          <Globe
            className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)] pointer-events-none"
            aria-hidden="true"
          />
          <input
            id="crawler-url-input"
            type="url"
            value={url}
            onChange={(e) => onUrlChange(e.target.value)}
            placeholder="https://example.com"
            disabled={disabled}
            className="w-full h-13 py-3 pl-12 pr-4 rounded-xl surface-elevated font-mono text-sm sm:text-base text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] transition-shadow disabled:opacity-50"
          />
        </div>
      </div>

      {/* Primary Rules Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <label className="flex items-center justify-between gap-3 p-4 rounded-xl surface-elevated cursor-pointer min-h-[56px]">
          <div className="min-w-0">
            <div className="text-sm font-medium text-[var(--text-main)]">
              Respect robots.txt
            </div>
            <div className="text-xs text-[var(--text-muted)]">
              Honor disallowed paths
            </div>
          </div>
          <input
            type="checkbox"
            checked={respectRobots}
            onChange={(e) => onRespectRobotsChange(e.target.checked)}
            disabled={disabled}
            className="w-5 h-5 accent-[var(--accent-primary)] rounded cursor-pointer shrink-0"
          />
        </label>

        <label className="flex items-center justify-between gap-3 p-4 rounded-xl surface-elevated cursor-pointer min-h-[56px]">
          <div className="min-w-0">
            <div className="text-sm font-medium text-[var(--text-main)]">
              Follow subdomains
            </div>
            <div className="text-xs text-[var(--text-muted)]">
              Include app &amp; portal hosts
            </div>
          </div>
          <input
            type="checkbox"
            checked={followSubdomains}
            onChange={(e) => onFollowSubdomainsChange(e.target.checked)}
            disabled={disabled}
            className="w-5 h-5 accent-[var(--accent-primary)] rounded cursor-pointer shrink-0"
          />
        </label>

        <div className="flex items-center justify-between gap-3 p-4 rounded-xl surface-elevated min-h-[56px]">
          <label
            htmlFor="crawler-max-pages"
            className="min-w-0 cursor-pointer"
          >
            <div className="text-sm font-medium text-[var(--text-main)]">
              Max Pages
            </div>
            <div className="text-xs text-[var(--text-muted)]">
              Range 1–1000
            </div>
          </label>
          <input
            id="crawler-max-pages"
            type="number"
            value={maxPages}
            onChange={(e) =>
              onMaxPagesChange(
                Math.min(1000, Math.max(1, parseInt(e.target.value, 10) || 1))
              )
            }
            min={1}
            max={1000}
            disabled={disabled}
            className="w-20 h-9 px-2 rounded-lg surface-panel font-mono text-sm text-[var(--text-main)] text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
          />
        </div>
      </div>

      {/* Advanced Settings Drawer */}
      {showAdvanced && (
        <div className="p-5 rounded-xl surface-elevated grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label
              htmlFor="crawl-delay-input"
              className="block text-xs font-medium text-[var(--text-secondary)]"
            >
              Crawl delay (ms)
            </label>
            <input
              id="crawl-delay-input"
              type="number"
              value={crawlDelayMs}
              onChange={(e) =>
                onCrawlDelayMsChange(Math.max(0, parseInt(e.target.value, 10) || 0))
              }
              min={0}
              max={10000}
              disabled={disabled}
              className="w-full h-10 px-3 rounded-lg surface-panel font-mono text-sm text-[var(--text-main)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="crawl-depth-input"
              className="block text-xs font-medium text-[var(--text-secondary)]"
            >
              Max traversal depth
            </label>
            <input
              id="crawl-depth-input"
              type="number"
              value={maxDepth}
              onChange={(e) =>
                onMaxDepthChange(
                  Math.min(10, Math.max(1, parseInt(e.target.value, 10) || 1))
                )
              }
              min={1}
              max={10}
              disabled={disabled}
              className="w-full h-10 px-3 rounded-lg surface-panel font-mono text-sm text-[var(--text-main)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="crawl-ua-input"
              className="block text-xs font-medium text-[var(--text-secondary)]"
            >
              User-Agent string
            </label>
            <input
              id="crawl-ua-input"
              type="text"
              value={userAgent}
              onChange={(e) => onUserAgentChange(e.target.value)}
              disabled={disabled}
              className="w-full h-10 px-3 rounded-lg surface-panel font-mono text-sm text-[var(--text-main)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
            />
          </div>
        </div>
      )}

      {/* Action Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onStartCrawl}
            disabled={disabled || !url.trim()}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-display font-semibold text-sm transition-transform duration-150 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px]"
            style={{
              backgroundColor: 'var(--accent-primary)',
              color: 'var(--accent-contrast)',
            }}
          >
            <Play className="w-4 h-4" />
            <span>{disabled ? 'Crawl Running...' : 'Start Crawl'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowAdvanced((prev) => !prev)}
            disabled={disabled}
            aria-expanded={showAdvanced}
            className="inline-flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium surface-elevated hover:bg-[var(--surface-hover)] text-[var(--text-main)] transition-colors disabled:opacity-40 min-h-[44px]"
          >
            <Settings2 className="w-4 h-4" />
            <span>Advanced Rules</span>
            {showAdvanced ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        </div>

        {hasResults && !disabled && (
          <button
            type="button"
            onClick={onResetCrawl}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-[var(--surface-hover)] transition-colors min-h-[40px]"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Clear Session</span>
          </button>
        )}
      </div>
    </section>
  );
}
