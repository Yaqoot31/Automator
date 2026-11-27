import { useState } from 'react';
import {
  LayoutDashboard,
  Globe,
  ListChecks,
  ClipboardCheck,
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
  MoreHorizontal,
  ShieldAlert,
  CheckCircle2,
} from 'lucide-react';
import type { ThemeMode, UserProfile, WorkspaceView } from '@/types';
import { MEDIA_ASSETS } from '@/lib/mediaAssets';
import { BrandMark } from '@/components/BrandMark';

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
  openDefectCount: number;
  isRunning: boolean;
}

const TOP_NAV_ITEMS: { id: WorkspaceView; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'analyzer', label: 'Analyzer' },
  { id: 'tests', label: 'Test Cases' },
  { id: 'sqa', label: 'SQA' },
  { id: 'reports', label: 'Reports' },
];

const SIDEBAR_ITEMS: { id: WorkspaceView; label: string; icon: typeof Globe }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'analyzer', label: 'Website Analyzer', icon: Globe },
  { id: 'tests', label: 'Test Cases', icon: ListChecks },
  { id: 'sqa', label: 'SQA Management', icon: ClipboardCheck },
  { id: 'studio', label: 'Script Studio', icon: Code2 },
  { id: 'runner', label: 'Live Runner', icon: Play },
  { id: 'reports', label: 'Reports & Analytics', icon: BarChart3 },
  { id: 'projects', label: 'Projects & Team', icon: FolderKanban },
  { id: 'settings', label: 'Settings & Profile', icon: SlidersHorizontal },
];

const MOBILE_BOTTOM_TABS: { id: WorkspaceView; label: string; icon: typeof Globe }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'analyzer', label: 'Analyze', icon: Globe },
  { id: 'tests', label: 'Tests', icon: ListChecks },
  { id: 'sqa', label: 'SQA', icon: ClipboardCheck },
];

const VIEW_LABELS: Record<WorkspaceView, string> = {
  dashboard: 'Dashboard',
  analyzer: 'Website Analyzer',
  tests: 'Test Cases',
  sqa: 'SQA Management',
  studio: 'Script Studio',
  runner: 'Live Runner',
  reports: 'Reports',
  projects: 'Projects & Team',
  settings: 'Settings & Profile',
};

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
  openDefectCount,
  isRunning,
}: TopNavAndSidebarProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const selectView = (view: WorkspaceView) => {
    onNavigate(view);
    setDrawerOpen(false);
  };

  const isMoreTabActive =
    activeView === 'studio' ||
    activeView === 'runner' ||
    activeView === 'reports' ||
    activeView === 'projects' ||
    activeView === 'settings';

  return (
    <>
      {/* Desktop Top Bar (>= lg) — Strict 3-Zone Contract */}
      <header className="hidden lg:block fixed top-0 left-0 right-0 z-50 h-16 surface-glass border-b">
        <div className="h-full max-w-[1440px] mx-auto px-8 flex items-center justify-between gap-8">
          <button
            type="button"
            onClick={() => selectView('dashboard')}
            className="inline-flex items-center gap-2.5 font-display font-bold text-lg tracking-tight whitespace-nowrap shrink-0 text-[var(--text-main)] hover:opacity-85 transition-opacity rounded-md px-1 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
          >
            <BrandMark size={30} />
            <span>Automator AI</span>
          </button>

          <nav aria-label="Primary navigation" className="flex items-center gap-7">
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

          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => selectView(isRunning ? 'runner' : 'studio')}
              className="inline-flex items-center gap-1.5 px-4 min-h-[42px] rounded-lg text-sm font-semibold whitespace-nowrap shrink-0 transition-transform active:scale-[0.98]"
              style={{
                backgroundColor: 'var(--accent-primary)',
                color: 'var(--accent-contrast)',
              }}
            >
              <span>{isRunning ? 'Live Run Active' : 'Script Studio'}</span>
              <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile & Tablet Compact Top App Bar (< lg, 52px height) */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 h-[52px] surface-glass border-b">
        <div className="h-full px-3 sm:px-5 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => selectView('dashboard')}
            className="inline-flex items-center gap-2 min-h-[44px] min-w-[44px] shrink-0"
            aria-label="Go to Dashboard"
          >
            <BrandMark size={28} />
          </button>

          <div className="font-display font-semibold text-sm text-[var(--text-main)] truncate px-1">
            {VIEW_LABELS[activeView]}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={theme === 'daylight' ? 'Switch to dark mode' : 'Switch to light mode'}
              className="inline-flex items-center justify-center w-11 h-11 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-main)]"
            >
              {theme === 'daylight' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={() => setDrawerOpen((p) => !p)}
              aria-label={drawerOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={drawerOpen}
              className="inline-flex items-center justify-center w-11 h-11 rounded-lg text-[var(--text-main)]"
            >
              {drawerOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile & Tablet App Bottom Navigation Bar (< lg, 56px height + safe area) */}
      <nav
        aria-label="Mobile app navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 surface-glass border-t pb-[env(safe-area-inset-bottom,0px)]"
      >
        <div className="grid grid-cols-5 items-center h-[56px]">
          {MOBILE_BOTTOM_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeView === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => selectView(tab.id)}
                className={`h-full min-h-[44px] flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${
                  active ? 'text-[var(--accent-primary)]' : 'text-[var(--text-secondary)]'
                }`}
              >
                <Icon className="w-[19px] h-[19px]" aria-hidden="true" />
                <span className="truncate max-w-[64px]">{tab.label}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setDrawerOpen((v) => !v)}
            className={`h-full min-h-[44px] flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${
              isMoreTabActive || drawerOpen
                ? 'text-[var(--accent-primary)]'
                : 'text-[var(--text-secondary)]'
            }`}
          >
            <MoreHorizontal className="w-[19px] h-[19px]" aria-hidden="true" />
            <span>More</span>
          </button>
        </div>
      </nav>

      {/* Mobile & Tablet Full App Sheet / Drawer (< lg) */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Workspace navigation sheet"
        >
          <div
            className="fixed inset-0 bg-black/65 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="fixed bottom-0 left-0 right-0 sm:left-auto sm:top-0 sm:w-80 surface-panel rounded-t-3xl sm:rounded-none sm:border-l p-4 space-y-2 max-h-[86dvh] sm:max-h-none overflow-y-auto shadow-2xl safe-pb flex flex-col justify-between">
            <div className="space-y-1.5">
              <div className="sm:hidden w-10 h-1 bg-[var(--border-strong)] rounded-full mx-auto mb-3" />
              <div className="flex items-center justify-between px-2 pb-2 border-b">
                <div className="flex items-center gap-2">
                  <BrandMark size={24} />
                  <span className="font-display font-bold text-sm">Automator AI</span>
                </div>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  aria-label="Close navigation sheet"
                  className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-lg hover:bg-[var(--surface-hover)]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {activeProjectName && (
                <div className="px-3 py-2.5 rounded-xl surface-elevated">
                  <div className="text-[11px] text-[var(--text-muted)]">Active Project</div>
                  <div className="text-xs font-semibold text-[var(--text-main)] truncate mt-0.5">
                    {activeProjectName}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-1 pt-1">
                {SIDEBAR_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const active = activeView === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => selectView(item.id)}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium min-h-[44px] ${
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
                      {item.id === 'sqa' && openDefectCount > 0 && (
                        <span className="font-mono text-xs text-[var(--status-warning)] tabular-nums shrink-0">
                          {openDefectCount} open
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-3 mt-3 border-t space-y-2.5">
              <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl surface-elevated">
                <img
                  src={MEDIA_ASSETS.avatarQaEngineer}
                  alt={user.name}
                  referrerPolicy="no-referrer"
                  className="w-8 h-8 rounded-full object-cover shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold truncate">{user.name}</div>
                  <div className="text-[11px] text-[var(--text-muted)] truncate">
                    {user.email} · {user.role.replace('_', ' ')}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={onSignOut}
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl surface-elevated text-xs font-medium text-[var(--status-error)] min-h-[44px]"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Desktop Left Workspace Sidebar (>= 1024px) */}
      <aside
        aria-label="Workspace sidebar"
        className={`hidden lg:flex flex-col fixed top-16 bottom-0 left-0 z-30 surface-panel border-r transition-all duration-200 ${
          sidebarCollapsed ? 'w-[72px]' : 'w-[244px]'
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
                {!sidebarCollapsed && item.id === 'sqa' && openDefectCount > 0 && (
                  <span className="font-mono text-xs text-[var(--status-warning)] tabular-nums">
                    {openDefectCount}
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
              <button
                type="button"
                onClick={() => selectView('settings')}
                className="flex items-center gap-2.5 min-w-0 text-left flex-1"
              >
                <img
                  src={MEDIA_ASSETS.avatarQaEngineer}
                  alt={user.name}
                  referrerPolicy="no-referrer"
                  className="w-7 h-7 rounded-full object-cover shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold truncate flex items-center gap-1">
                    <span className="truncate">{user.name}</span>
                    {user.emailVerified ? (
                      <CheckCircle2 className="w-3 h-3 text-[var(--status-success)] shrink-0" />
                    ) : (
                      <ShieldAlert className="w-3 h-3 text-[var(--status-warning)] shrink-0" />
                    )}
                  </div>
                  <div className="text-[11px] text-[var(--text-muted)] truncate">
                    {user.role.replace('_', ' ')}
                  </div>
                </div>
              </button>
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
