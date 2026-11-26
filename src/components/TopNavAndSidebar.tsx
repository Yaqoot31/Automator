import { useState } from 'react';
import {
  Globe,
  ListChecks,
  Code2,
  Play,
  BarChart3,
  FolderKanban,
  SlidersHorizontal,
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  Sun,
  Moon,
  LogOut,
  ArrowUpRight,
} from 'lucide-react';
import type { ThemeMode, UserProfile, WorkspaceView } from '@/types';
import { MEDIA_ASSETS } from '@/lib/mediaAssets';

interface TopNavAndSidebarProps {
  activeView: WorkspaceView;
  onNavigate: (view: WorkspaceView) => void;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
  user: UserProfile;
  onSignOut: () => void;
  activeProjectName?: string;
  testCount: number;
  isRunning: boolean;
}

const TOP_NAV_ITEMS: { id: WorkspaceView; label: string }[] = [
  { id: 'analyzer', label: 'Analyzer' },
  { id: 'tests', label: 'Test Cases' },
  { id: 'studio', label: 'Script Studio' },
  { id: 'runner', label: 'Test Runner' },
  { id: 'reports', label: 'Reports' },
];

const SIDEBAR_ITEMS: { id: WorkspaceView; label: string; icon: typeof Globe }[] = [
  { id: 'analyzer', label: 'Website Analyzer', icon: Globe },
  { id: 'tests', label: 'Test Cases', icon: ListChecks },
  { id: 'studio', label: 'Script Studio', icon: Code2 },
  { id: 'runner', label: 'Live Runner', icon: Play },
  { id: 'reports', label: 'Reports & Analytics', icon: BarChart3 },
  { id: 'projects', label: 'Projects & Vault', icon: FolderKanban },
  { id: 'settings', label: 'Settings', icon: SlidersHorizontal },
];

export function TopNavAndSidebar({
  activeView,
  onNavigate,
  sidebarCollapsed,
  onToggleSidebar,
  theme,
  onToggleTheme,
  user,
  onSignOut,
  activeProjectName,
  testCount,
  isRunning,
}: TopNavAndSidebarProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const selectView = (view: WorkspaceView) => {
    onNavigate(view);
    setDrawerOpen(false);
  };

  return (
    <>
      {/* Strict 3-Zone Top Bar (56px mobile/tablet, 64px desktop) */}
      <header className="fixed top-0 left-0 right-0 z-50 h-14 lg:h-16 surface-glass border-b">
        <div className="h-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4 lg:gap-8">
          {/* Zone 1: Single-line Brand Wordmark */}
          <button
            type="button"
            onClick={() => selectView('analyzer')}
            className="font-display font-bold text-base sm:text-lg tracking-tight whitespace-nowrap shrink-0 text-[var(--text-main)] hover:opacity-85 transition-opacity rounded-md px-1 min-h-[44px] inline-flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
          >
            Automator AI
          </button>

          {/* Zone 2: 5 concise single-line nav links (Desktop & Tablet md+) */}
          <nav aria-label="Primary navigation" className="hidden md:flex items-center gap-5 lg:gap-7">
            {TOP_NAV_ITEMS.map((item) => {
              const active = activeView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectView(item.id)}
                  className={`relative py-2 text-sm font-medium whitespace-nowrap shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] rounded-sm ${
                    active
                      ? 'text-[var(--text-main)]'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-main)]'
                  }`}
                >
                  {item.label}
                  <span
                    aria-hidden="true"
                    className={`absolute left-0 right-0 bottom-0.5 h-0.5 rounded-full transition-opacity ${
                      active ? 'opacity-100' : 'opacity-0'
                    }`}
                    style={{ backgroundColor: 'var(--accent-primary)' }}
                  />
                </button>
              );
            })}
          </nav>

          {/* Zone 3: 1 Primary CTA + Mobile/Tablet Drawer Trigger (< lg) */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={() => selectView(isRunning ? 'runner' : 'projects')}
              className="hidden sm:inline-flex items-center gap-1.5 px-4 min-h-[40px] lg:min-h-[42px] rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 transition-transform active:scale-[0.98]"
              style={{
                backgroundColor: 'var(--accent-primary)',
                color: 'var(--accent-contrast)',
              }}
            >
              <span>{isRunning ? 'Live Run Active' : 'Projects'}</span>
              <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={() => setDrawerOpen((p) => !p)}
              aria-label={drawerOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={drawerOpen}
              className="lg:hidden inline-flex items-center justify-center w-11 h-11 rounded-lg surface-elevated text-[var(--text-main)]"
            >
              {drawerOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile & Tablet Navigation Drawer (< lg: covers 320px–1023px) */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Workspace navigation"
        >
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="fixed top-14 left-0 right-0 sm:left-auto sm:w-80 sm:bottom-0 sm:border-l surface-panel border-b p-4 space-y-1.5 max-h-[calc(100dvh-3.5rem)] sm:max-h-none overflow-y-auto shadow-2xl safe-pb flex flex-col justify-between">
            <div className="space-y-1">
              {activeProjectName && (
                <div className="px-3 py-2.5 mb-2 rounded-xl surface-elevated">
                  <div className="text-[11px] text-[var(--text-muted)]">Active Project</div>
                  <div className="text-xs font-semibold text-[var(--text-main)] truncate mt-0.5">
                    {activeProjectName}
                  </div>
                </div>
              )}

              {SIDEBAR_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = activeView === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectView(item.id)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium min-h-[44px] ${
                      active
                        ? 'bg-[var(--accent-soft)] text-[var(--text-main)]'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-main)]'
                    }`}
                  >
                    <span className="flex items-center gap-3 min-w-0">
                      <Icon
                        className="w-4 h-4 shrink-0"
                        style={{ color: active ? 'var(--accent-primary)' : undefined }}
                        aria-hidden="true"
                      />
                      <span className="truncate">{item.label}</span>
                    </span>
                    {item.id === 'tests' && testCount > 0 && (
                      <span className="font-mono text-xs text-[var(--text-muted)] tabular-nums shrink-0">
                        {testCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="pt-3 mt-3 border-t space-y-2.5">
              <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl surface-elevated">
                <img
                  src={MEDIA_ASSETS.avatarQaEngineer}
                  alt={user.name}
                  referrerPolicy="no-referrer"
                  className="w-8 h-8 rounded-full object-cover shrink-0"
                />
                <div className="min-w-0">
                  <div className="text-xs font-semibold truncate">{user.name}</div>
                  <div className="text-[11px] text-[var(--text-muted)] truncate">{user.email}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={onToggleTheme}
                  className="inline-flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl surface-elevated text-xs font-medium min-h-[44px]"
                >
                  {theme === 'daylight' ? (
                    <Moon className="w-4 h-4" />
                  ) : (
                    <Sun className="w-4 h-4" />
                  )}
                  <span>{theme === 'daylight' ? 'Dark' : 'Light'}</span>
                </button>
                <button
                  type="button"
                  onClick={onSignOut}
                  className="inline-flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl surface-elevated text-xs font-medium text-[var(--status-error)] min-h-[44px]"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Desktop Left Workspace Sidebar (>= 1024px) */}
      <aside
        aria-label="Workspace sidebar"
        className={`hidden lg:flex flex-col fixed top-16 bottom-0 left-0 z-30 surface-panel border-r transition-all duration-200 ${
          sidebarCollapsed ? 'w-[72px]' : 'w-[240px]'
        }`}
      >
        <div className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {!sidebarCollapsed && activeProjectName && (
            <div className="px-3 pb-3 mb-2 border-b">
              <div className="text-[11px] font-medium text-[var(--text-muted)]">Active Project</div>
              <div className="text-xs font-semibold text-[var(--text-main)] truncate mt-0.5">
                {activeProjectName}
              </div>
            </div>
          )}

          {SIDEBAR_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => selectView(item.id)}
                title={sidebarCollapsed ? item.label : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors min-h-[42px] ${
                  sidebarCollapsed ? 'justify-center' : 'justify-between'
                } ${
                  active
                    ? 'bg-[var(--accent-soft)] text-[var(--text-main)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-main)]'
                }`}
              >
                <span className="flex items-center gap-3 min-w-0">
                  <Icon
                    className="w-4 h-4 shrink-0"
                    style={{ color: active ? 'var(--accent-primary)' : undefined }}
                    aria-hidden="true"
                  />
                  {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                </span>
                {!sidebarCollapsed && item.id === 'tests' && testCount > 0 && (
                  <span className="font-mono text-xs text-[var(--text-muted)] tabular-nums">
                    {testCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="p-3 border-t space-y-2">
          <button
            type="button"
            onClick={onToggleTheme}
            title={theme === 'daylight' ? 'Switch to dark mode' : 'Switch to light mode'}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-main)] min-h-[40px] ${
              sidebarCollapsed ? 'justify-center' : ''
            }`}
          >
            {theme === 'daylight' ? (
              <Moon className="w-4 h-4 shrink-0" />
            ) : (
              <Sun className="w-4 h-4 shrink-0" />
            )}
            {!sidebarCollapsed && (
              <span>{theme === 'daylight' ? 'Dark Mode' : 'Light Mode'}</span>
            )}
          </button>

          {!sidebarCollapsed && (
            <div className="flex items-center justify-between gap-2 px-2 py-2 rounded-lg surface-elevated">
              <div className="flex items-center gap-2.5 min-w-0">
                <img
                  src={MEDIA_ASSETS.avatarQaEngineer}
                  alt={user.name}
                  referrerPolicy="no-referrer"
                  className="w-7 h-7 rounded-full object-cover shrink-0"
                />
                <div className="min-w-0">
                  <div className="text-xs font-semibold truncate">{user.name}</div>
                  <div className="text-[11px] text-[var(--text-muted)] truncate">{user.email}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={onSignOut}
                title="Sign out"
                aria-label="Sign out"
                className="p-2 rounded-md text-[var(--text-secondary)] hover:text-[var(--status-error)] hover:bg-[var(--surface-hover)] shrink-0 min-h-[36px] min-w-[36px] inline-flex items-center justify-center"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={onToggleSidebar}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-main)] min-h-[40px] ${
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
