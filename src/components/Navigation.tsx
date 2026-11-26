import { useState } from 'react';
import {
  LayoutGrid,
  Compass,
  Code2,
  PlaySquare,
  SlidersHorizontal,
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  ArrowUpRight,
} from 'lucide-react';
import type { AppState, AppView } from '@/types';

interface NavigationProps {
  appState: AppState;
  activeView: AppView;
  onNavigate: (view: AppView) => void;
  onStartQuickCrawl: () => void;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  discoveredCount: number;
  progress: number;
}

const NAV_ITEMS: { id: AppView; label: string; icon: typeof LayoutGrid }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid },
  { id: 'crawler', label: 'Crawler', icon: Compass },
  { id: 'results', label: 'Results & Code', icon: Code2 },
  { id: 'demos', label: 'Product Demos', icon: PlaySquare },
  { id: 'settings', label: 'Settings', icon: SlidersHorizontal },
];

export function Navigation({
  appState,
  activeView,
  onNavigate,
  onStartQuickCrawl,
  sidebarCollapsed,
  onToggleSidebar,
  discoveredCount,
  progress,
}: NavigationProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSelect = (view: AppView) => {
    onNavigate(view);
    setMobileMenuOpen(false);
  };

  return (
    <>
      {/* Top Bar — Strict 3-Zone Contract: Brand Wordmark — 5 Nav Links — 1 Primary Action */}
      <header className="fixed top-0 left-0 right-0 z-50 h-16 surface-glass border-b">
        <div className="h-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-8">
          {/* Zone 1: Single-element Brand Wordmark */}
          <button
            type="button"
            onClick={() => handleSelect('overview')}
            className="font-display font-bold text-lg tracking-tight whitespace-nowrap shrink-0 text-[var(--text-main)] hover:opacity-85 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] rounded-md px-1 py-0.5"
          >
            WebCrawler Pro
          </button>

          {/* Zone 2: 5 concise single-line text nav links */}
          <nav
            aria-label="Primary navigation"
            className="hidden md:flex items-center gap-6 lg:gap-7"
          >
            {NAV_ITEMS.map((item) => {
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelect(item.id)}
                  className={`relative py-1 text-sm font-medium whitespace-nowrap shrink-0 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] rounded-sm ${
                    isActive
                      ? 'text-[var(--text-main)]'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-main)]'
                  }`}
                >
                  {item.label}
                  <span
                    aria-hidden="true"
                    className={`absolute left-0 right-0 -bottom-1 h-0.5 rounded-full transition-opacity duration-150 ${
                      isActive ? 'opacity-100' : 'opacity-0'
                    }`}
                    style={{ backgroundColor: 'var(--accent-primary)' }}
                  />
                </button>
              );
            })}
          </nav>

          {/* Zone 3: 1 Primary Action (+ mobile drawer toggle on small screens) */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={
                appState === 'crawling'
                  ? () => handleSelect('crawler')
                  : onStartQuickCrawl
              }
              className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap shrink-0 transition-transform duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--accent-primary)]"
              style={{
                backgroundColor: 'var(--accent-primary)',
                color: 'var(--accent-contrast)',
              }}
            >
              <span>
                {appState === 'crawling'
                  ? `Running (${Math.round(progress)}%)`
                  : 'New Crawl'}
              </span>
              <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileMenuOpen}
              className="md:hidden inline-flex items-center justify-center w-11 h-11 rounded-lg surface-elevated text-[var(--text-main)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Mobile navigation"
        >
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="fixed top-16 left-0 right-0 surface-panel border-b p-4 space-y-1 shadow-2xl">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelect(item.id)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
                    isActive
                      ? 'bg-[var(--accent-soft)] text-[var(--text-main)]'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-main)]'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <Icon className="w-4 h-4" aria-hidden="true" />
                    <span>{item.label}</span>
                  </span>
                  {item.id === 'results' && discoveredCount > 0 && (
                    <span className="font-mono text-xs text-[var(--text-muted)]">
                      {discoveredCount}
                    </span>
                  )}
                </button>
              );
            })}
            <div className="pt-2 border-t">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  if (appState === 'crawling') {
                    handleSelect('crawler');
                  } else {
                    onStartQuickCrawl();
                  }
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold min-h-[44px]"
                style={{
                  backgroundColor: 'var(--accent-primary)',
                  color: 'var(--accent-contrast)',
                }}
              >
                {appState === 'crawling'
                  ? `View Live Crawl (${Math.round(progress)}%)`
                  : 'New Crawl'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Desktop Left Workspace Sidebar Rail */}
      <aside
        aria-label="Workspace sidebar"
        className={`hidden lg:flex flex-col fixed top-16 bottom-0 left-0 z-30 surface-panel border-r transition-all duration-200 ${
          sidebarCollapsed ? 'w-[72px]' : 'w-[240px]'
        }`}
      >
        <div className="flex-1 py-5 px-3 space-y-1 overflow-y-auto">
          {!sidebarCollapsed && (
            <div className="px-3 pb-2 text-xs font-medium text-[var(--text-muted)]">
              Workspace
            </div>
          )}
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                title={sidebarCollapsed ? item.label : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 min-h-[40px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] ${
                  sidebarCollapsed ? 'justify-center' : 'justify-between'
                } ${
                  isActive
                    ? 'bg-[var(--accent-soft)] text-[var(--text-main)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-main)]'
                }`}
              >
                <span className="flex items-center gap-3 min-w-0">
                  <Icon
                    className="w-4 h-4 shrink-0"
                    style={{
                      color: isActive ? 'var(--accent-primary)' : undefined,
                    }}
                    aria-hidden="true"
                  />
                  {!sidebarCollapsed && (
                    <span className="truncate">{item.label}</span>
                  )}
                </span>
                {!sidebarCollapsed && item.id === 'results' && discoveredCount > 0 && (
                  <span className="font-mono text-xs text-[var(--text-muted)] tabular-nums">
                    {discoveredCount}
                  </span>
                )}
              </button>
            );
          })}

          {!sidebarCollapsed && (
            <div className="pt-6 px-3">
              <div className="pt-5 border-t space-y-2">
                <div className="text-xs font-medium text-[var(--text-muted)]">
                  Session Status
                </div>
                <div className="text-xs text-[var(--text-secondary)] space-y-1">
                  <div className="flex items-center justify-between">
                    <span>Crawler</span>
                    <span className="font-mono text-[var(--text-main)]">
                      {appState === 'crawling'
                        ? `${Math.round(progress)}%`
                        : appState === 'complete'
                          ? 'Complete'
                          : 'Standby'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Discovered</span>
                    <span className="font-mono text-[var(--text-main)] tabular-nums">
                      {discoveredCount}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-3 border-t">
          <button
            type="button"
            onClick={onToggleSidebar}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-main)] transition-colors min-h-[40px] ${
              sidebarCollapsed ? 'justify-center' : ''
            }`}
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen className="w-4 h-4" />
            ) : (
              <>
                <PanelLeftClose className="w-4 h-4" />
                <span>Collapse Sidebar</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}
