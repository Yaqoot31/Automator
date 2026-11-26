import { useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  LayoutGrid,
  Compass,
  Code2,
  SlidersHorizontal,
  Search,
  PanelLeft,
  ArrowUp,
  ArrowDown,
  Check,
  Play,
  Sun,
  Moon,
  Monitor,
} from 'lucide-react';
import { MEDIA_ASSETS } from '@/lib/mediaAssets';
import type { AccentColor, AppSettings, ThemeMode } from '@/types';

/* -------------------------------------------------------------------------- */
/* 1. Interactive Dashboard Demo                                              */
/* -------------------------------------------------------------------------- */
const DASHBOARD_SERIES = {
  '24h': [
    { label: '00:00', pages: 42, tests: 168, locators: 310 },
    { label: '04:00', pages: 68, tests: 272, locators: 495 },
    { label: '08:00', pages: 124, tests: 496, locators: 890 },
    { label: '12:00', pages: 190, tests: 760, locators: 1320 },
    { label: '16:00', pages: 238, tests: 952, locators: 1690 },
    { label: '20:00', pages: 284, tests: 1136, locators: 1980 },
  ],
  '7d': [
    { label: 'Mon', pages: 310, tests: 1240, locators: 2150 },
    { label: 'Tue', pages: 420, tests: 1680, locators: 2940 },
    { label: 'Wed', pages: 390, tests: 1560, locators: 2710 },
    { label: 'Thu', pages: 540, tests: 2160, locators: 3820 },
    { label: 'Fri', pages: 615, tests: 2460, locators: 4290 },
    { label: 'Sat', pages: 480, tests: 1920, locators: 3350 },
    { label: 'Sun', pages: 512, tests: 2048, locators: 3600 },
  ],
  '30d': [
    { label: 'W1', pages: 1450, tests: 5800, locators: 10200 },
    { label: 'W2', pages: 1890, tests: 7560, locators: 13100 },
    { label: 'W3', pages: 2340, tests: 9360, locators: 16400 },
    { label: 'W4', pages: 2810, tests: 11240, locators: 19850 },
  ],
};

export function InteractiveDashboardDemo() {
  const [range, setRange] = useState<'24h' | '7d' | '30d'>('7d');
  const [metric, setMetric] = useState<'pages' | 'tests' | 'locators'>('tests');
  const [burstOffset, setBurstOffset] = useState(0);

  const data = DASHBOARD_SERIES[range].map((point) => ({
    ...point,
    pages: point.pages + burstOffset,
    tests: point.tests + burstOffset * 4,
    locators: point.locators + burstOffset * 7,
  }));

  const latest = data[data.length - 1];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 rounded-lg surface-elevated">
          {(['24h', '7d', '30d'] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                range === r
                  ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-main)]'
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setBurstOffset((prev) => prev + 36)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold min-h-[38px]"
          style={{
            backgroundColor: 'var(--accent-primary)',
            color: 'var(--accent-contrast)',
          }}
        >
          <Play className="w-3.5 h-3.5" />
          <span>Simulate Burst Run</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {(
          [
            { key: 'pages', label: 'Pages Discovered', val: latest.pages },
            { key: 'tests', label: 'Tests Synthesized', val: latest.tests },
            { key: 'locators', label: 'Resilient Locators', val: latest.locators },
          ] as const
        ).map((kpi) => {
          const active = metric === kpi.key;
          return (
            <button
              key={kpi.key}
              type="button"
              onClick={() => setMetric(kpi.key)}
              className={`p-4 rounded-xl border text-left transition-colors ${
                active
                  ? 'surface-elevated border-[var(--accent-primary)]'
                  : 'surface-panel hover:bg-[var(--surface-hover)]'
              }`}
            >
              <div className="text-xs text-[var(--text-muted)]">{kpi.label}</div>
              <div className="font-display font-bold text-2xl text-[var(--text-main)] mt-1 tabular-nums">
                {kpi.val.toLocaleString()}
              </div>
              <div className="text-[11px] text-[var(--text-secondary)] mt-1">
                {active ? 'Focused on chart' : 'Click to inspect series'}
              </div>
            </button>
          );
        })}
      </div>

      <div className="rounded-xl surface-panel p-4">
        <div className="text-xs font-medium text-[var(--text-secondary)] mb-3 capitalize">
          {metric} velocity ({range})
        </div>
        <div className="h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 10, left: -16, bottom: 0 }}>
              <XAxis
                dataKey="label"
                tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--surface-panel)',
                  borderColor: 'var(--border-hairline)',
                  borderRadius: '0.5rem',
                  fontSize: '12px',
                  color: 'var(--text-main)',
                }}
              />
              <Area
                type="monotone"
                dataKey={metric}
                stroke="var(--accent-primary)"
                fill="var(--accent-soft)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 2. Navigation & Menu Demo                                                  */
/* -------------------------------------------------------------------------- */
const NAV_ROUTES = [
  { id: 'overview', group: 'Workspace', label: 'Overview', path: '/workspace/overview', icon: LayoutGrid },
  { id: 'crawler', group: 'Engine', label: 'Crawler Studio', path: '/engine/crawler', icon: Compass },
  { id: 'locators', group: 'Engine', label: 'Locator Matrix', path: '/engine/locators', icon: Code2 },
  { id: 'settings', group: 'System', label: 'Preferences', path: '/system/settings', icon: SlidersHorizontal },
];

export function NavigationMenuDemo() {
  const [collapsed, setCollapsed] = useState(false);
  const [activeId, setActiveId] = useState('crawler');
  const [query, setQuery] = useState('');
  const [drawerPreview, setDrawerPreview] = useState(false);

  const filtered = NAV_ROUTES.filter(
    (r) =>
      r.label.toLowerCase().includes(query.trim().toLowerCase()) ||
      r.group.toLowerCase().includes(query.trim().toLowerCase())
  );
  const current = NAV_ROUTES.find((r) => r.id === activeId) ?? NAV_ROUTES[0];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter navigation routes..."
            className="w-full h-9 pl-9 pr-3 rounded-lg surface-elevated text-xs text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCollapsed((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium surface-elevated hover:bg-[var(--surface-hover)] text-[var(--text-main)]"
          >
            <PanelLeft className="w-3.5 h-3.5" />
            <span>{collapsed ? 'Expand Rail' : 'Collapse Rail'}</span>
          </button>
          <button
            type="button"
            onClick={() => setDrawerPreview((prev) => !prev)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium surface-elevated hover:bg-[var(--surface-hover)] text-[var(--text-main)]"
          >
            {drawerPreview ? 'Close Drawer' : 'Mobile Drawer'}
          </button>
        </div>
      </div>

      <div className="rounded-xl border surface-panel overflow-hidden flex min-h-[250px] relative">
        {/* Sandbox Sidebar */}
        <div
          className={`border-r bg-[var(--surface-elevated)] p-2.5 flex flex-col gap-1 transition-all duration-200 ${
            collapsed ? 'w-14' : 'w-48'
          }`}
        >
          {filtered.map((item) => {
            const Icon = item.icon;
            const active = item.id === activeId;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveId(item.id)}
                title={collapsed ? item.label : undefined}
                className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors ${
                  collapsed ? 'justify-center' : ''
                } ${
                  active
                    ? 'bg-[var(--accent-soft)] text-[var(--text-main)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-main)]'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0 text-[var(--accent-primary)]" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}
          {filtered.length === 0 && (
            <div className="text-[11px] text-[var(--text-muted)] p-2">No matches</div>
          )}
        </div>

        {/* Sandbox Main Viewport */}
        <div className="flex-1 p-5 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="text-xs text-[var(--text-muted)] flex items-center gap-1.5">
              <span>WebCrawler Pro</span>
              <span>/</span>
              <span>{current.group}</span>
              <span>/</span>
              <span className="text-[var(--text-main)] font-medium">{current.label}</span>
            </div>
            <h3 className="font-display font-semibold text-lg text-[var(--text-main)]">
              {current.label}
            </h3>
            <p className="text-xs text-[var(--text-secondary)]">
              Active route mounted at <span className="font-mono">{current.path}</span>. Use the left rail or quick filter to switch contexts without losing crawler state.
            </p>
          </div>

          <div className="pt-4 border-t flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span>Rail state: {collapsed ? 'Compact (56px)' : 'Expanded (192px)'}</span>
            <span>Keyboard shortcut: ⌘K</span>
          </div>
        </div>

        {drawerPreview && (
          <div className="absolute inset-0 bg-black/50 flex justify-end">
            <div className="w-56 h-full surface-panel border-l p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-display font-semibold text-xs text-[var(--text-main)]">
                  Mobile Drawer
                </span>
                <button
                  type="button"
                  onClick={() => setDrawerPreview(false)}
                  className="text-xs text-[var(--accent-primary)]"
                >
                  Done
                </button>
              </div>
              {NAV_ROUTES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveId(item.id);
                    setDrawerPreview(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs surface-elevated text-[var(--text-main)]"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 3. Theme Customization Demo                                                */
/* -------------------------------------------------------------------------- */
const DEMO_THEMES: Record<
  ThemeMode,
  { label: string; bg: string; panel: string; text: string; muted: string; icon: typeof Moon }
> = {
  obsidian: {
    label: '2050 Obsidian',
    bg: '#08090c',
    panel: '#12151d',
    text: '#f3f4f6',
    muted: '#9ca3af',
    icon: Moon,
  },
  daylight: {
    label: 'Arctic Daylight',
    bg: '#f8fafc',
    panel: '#ffffff',
    text: '#0f172a',
    muted: '#475569',
    icon: Sun,
  },
  slate: {
    label: 'Titanium Slate',
    bg: '#0f141c',
    panel: '#18202c',
    text: '#f1f5f9',
    muted: '#94a3b8',
    icon: Monitor,
  },
  cobalt: {
    label: 'Deep Cobalt',
    bg: '#070b17',
    panel: '#0f172a',
    text: '#eff6ff',
    muted: '#93c5fd',
    icon: Moon,
  },
};

const DEMO_ACCENTS: { id: AccentColor; label: string; hex: string }[] = [
  { id: 'amber', label: 'Amber Gold', hex: '#d4a017' },
  { id: 'teal', label: 'Horizon Teal', hex: '#0d9488' },
  { id: 'cobalt', label: 'Cobalt Blue', hex: '#2563eb' },
  { id: 'emerald', label: 'Signal Emerald', hex: '#059669' },
];

export function ThemeCustomizationDemo({
  currentSettings,
  onApplyGlobal,
}: {
  currentSettings: AppSettings;
  onApplyGlobal: (patch: Partial<AppSettings>) => void;
}) {
  const [theme, setTheme] = useState<ThemeMode>(currentSettings.theme);
  const [accent, setAccent] = useState<AccentColor>(currentSettings.accent);
  const [wallpaper, setWallpaper] = useState<'aurora' | 'architecture' | 'none'>('aurora');
  const [applied, setApplied] = useState(false);

  const t = DEMO_THEMES[theme];
  const accentHex = DEMO_ACCENTS.find((a) => a.id === accent)?.hex ?? '#d4a017';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {(Object.keys(DEMO_THEMES) as ThemeMode[]).map((key) => {
          const item = DEMO_THEMES[key];
          const Icon = item.icon;
          const active = theme === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => {
                setTheme(key);
                setApplied(false);
              }}
              className={`p-2.5 rounded-lg border text-left text-xs transition-colors flex items-center gap-2 ${
                active
                  ? 'surface-elevated border-[var(--accent-primary)] text-[var(--text-main)]'
                  : 'surface-panel text-[var(--text-secondary)]'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-[var(--text-muted)]">Accent:</span>
          {DEMO_ACCENTS.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => {
                setAccent(a.id);
                setApplied(false);
              }}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs ${
                accent === a.id
                  ? 'border-[var(--accent-primary)] surface-elevated text-[var(--text-main)]'
                  : 'surface-panel text-[var(--text-secondary)]'
              }`}
            >
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: a.hex }} />
              <span>{a.label}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          {(['aurora', 'architecture', 'none'] as const).map((wp) => (
            <button
              key={wp}
              type="button"
              onClick={() => setWallpaper(wp)}
              className={`px-2.5 py-1.5 rounded-lg text-xs capitalize ${
                wallpaper === wp
                  ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)] font-medium'
                  : 'surface-elevated text-[var(--text-secondary)]'
              }`}
            >
              {wp === 'none' ? 'Solid' : wp}
            </button>
          ))}
        </div>
      </div>

      {/* Live Preview Canvas */}
      <div
        className="relative rounded-xl border overflow-hidden p-5 min-h-[210px] flex flex-col justify-between transition-colors duration-200"
        style={{ backgroundColor: t.bg, color: t.text }}
      >
        {wallpaper !== 'none' && (
          <img
            src={
              wallpaper === 'aurora'
                ? MEDIA_ASSETS.demoAurora
                : MEDIA_ASSETS.heroBackdrop
            }
            alt="Theme backdrop preview"
            referrerPolicy="no-referrer"
            className="absolute inset-0 w-full h-full object-cover opacity-35 pointer-events-none"
          />
        )}

        <div className="relative z-10 flex items-center justify-between">
          <span className="font-display font-semibold text-sm">{t.label}</span>
          <span
            className="px-3 py-1 rounded-lg text-xs font-semibold"
            style={{ backgroundColor: accentHex, color: '#ffffff' }}
          >
            Primary Action
          </span>
        </div>

        <div
          className="relative z-10 rounded-lg p-4 border backdrop-blur-md space-y-1.5"
          style={{
            backgroundColor: theme === 'daylight' ? 'rgba(255,255,255,0.88)' : 'rgba(16,18,24,0.82)',
            borderColor: theme === 'daylight' ? 'rgba(15,23,42,0.12)' : 'rgba(255,255,255,0.12)',
          }}
        >
          <div className="font-display font-semibold text-sm">
            Glass Surface Elevation
          </div>
          <div className="text-xs" style={{ color: t.muted }}>
            Contrast-checked typography and calibrated accent highlights across cards, tables, and modals.
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => {
            onApplyGlobal({
              theme,
              accent,
              wallpaperEnabled: wallpaper !== 'none',
            });
            setApplied(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold"
          style={{
            backgroundColor: 'var(--accent-primary)',
            color: 'var(--accent-contrast)',
          }}
        >
          {applied ? <Check className="w-3.5 h-3.5" /> : null}
          <span>{applied ? 'Applied to Live App' : 'Apply to Live App'}</span>
        </button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 4. Settings Interface Demo                                                 */
/* -------------------------------------------------------------------------- */
export function SettingsInterfaceDemo() {
  const [tab, setTab] = useState<'general' | 'engine' | 'locators' | 'alerts'>('locators');
  const [concurrency, setConcurrency] = useState(4);
  const [retries, setRetries] = useState(2);
  const [headless, setHeadless] = useState(true);
  const [notifyComplete, setNotifyComplete] = useState(true);
  const [locators, setLocators] = useState([
    'data-testid',
    'aria-label',
    'role + accessible name',
    'semantic CSS selector',
  ]);
  const [saved, setSaved] = useState(false);

  const moveLocator = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= locators.length) return;
    const copy = [...locators];
    [copy[index], copy[target]] = [copy[target], copy[index]];
    setLocators(copy);
    setSaved(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1 p-1 rounded-lg surface-elevated">
          {(
            [
              { id: 'general', label: 'General' },
              { id: 'engine', label: 'Crawler Engine' },
              { id: 'locators', label: 'Locator Priority' },
              { id: 'alerts', label: 'Notifications' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                tab === t.id
                  ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-main)]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setSaved(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold"
          style={{
            backgroundColor: 'var(--accent-primary)',
            color: 'var(--accent-contrast)',
          }}
        >
          {saved && <Check className="w-3.5 h-3.5" />}
          <span>{saved ? 'Saved' : 'Save Configuration'}</span>
        </button>
      </div>

      <div className="rounded-xl surface-panel p-5 space-y-4">
        {tab === 'general' && (
          <div className="space-y-3">
            <label className="flex items-center justify-between text-sm">
              <span className="text-[var(--text-main)]">Run browser in headless mode</span>
              <input
                type="checkbox"
                checked={headless}
                onChange={(e) => {
                  setHeadless(e.target.checked);
                  setSaved(false);
                }}
                className="w-4 h-4 accent-[var(--accent-primary)]"
              />
            </label>
            <div className="text-xs text-[var(--text-secondary)]">
              Headless execution reduces memory overhead across parallel page extraction workers.
            </div>
          </div>
        )}

        {tab === 'engine' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-[var(--text-main)]">Worker Concurrency</span>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={1}
                  max={12}
                  value={concurrency}
                  onChange={(e) => {
                    setConcurrency(Number(e.target.value));
                    setSaved(false);
                  }}
                  className="w-32 accent-[var(--accent-primary)]"
                />
                <span className="font-mono text-xs w-14 text-right text-[var(--text-main)] tabular-nums">
                  {concurrency} tabs
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-[var(--text-main)]">Automatic Retries</span>
              <div className="flex items-center gap-2">
                {[0, 1, 2, 3].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => {
                      setRetries(n);
                      setSaved(false);
                    }}
                    className={`w-8 h-8 rounded-lg font-mono text-xs ${
                      retries === n
                        ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)] font-semibold'
                        : 'surface-elevated text-[var(--text-secondary)]'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'locators' && (
          <div className="space-y-2">
            <div className="text-xs text-[var(--text-secondary)] mb-2">
              Dragless accessible ranking — adjust selector fallback order:
            </div>
            {locators.map((loc, idx) => (
              <div
                key={loc}
                className="flex items-center justify-between p-2.5 rounded-lg surface-elevated"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-[var(--text-muted)] w-5 tabular-nums">
                    {idx + 1}.
                  </span>
                  <span className="font-mono text-xs text-[var(--text-main)]">{loc}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => moveLocator(idx, -1)}
                    disabled={idx === 0}
                    aria-label={`Move ${loc} up`}
                    className="p-1.5 rounded surface-panel disabled:opacity-30"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveLocator(idx, 1)}
                    disabled={idx === locators.length - 1}
                    aria-label={`Move ${loc} down`}
                    className="p-1.5 rounded surface-panel disabled:opacity-30"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'alerts' && (
          <label className="flex items-center justify-between text-sm">
            <span className="text-[var(--text-main)]">Notify when ZIP test suite finishes building</span>
            <input
              type="checkbox"
              checked={notifyComplete}
              onChange={(e) => {
                setNotifyComplete(e.target.checked);
                setSaved(false);
              }}
              className="w-4 h-4 accent-[var(--accent-primary)]"
            />
          </label>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 5. Animation & Transition Demo                                             */
/* -------------------------------------------------------------------------- */
export function AnimationTransitionDemo() {
  const [curve, setCurve] = useState<'settling' | 'spring' | 'blur' | 'cascade'>('settling');
  const [durationMs, setDurationMs] = useState(300);
  const [reduced, setReduced] = useState(false);
  const [activeState, setActiveState] = useState(false);

  const easing =
    curve === 'spring'
      ? 'cubic-bezier(0.34, 1.56, 0.64, 1)'
      : 'cubic-bezier(0.16, 1, 0.3, 1)';

  const effectiveMs = reduced ? 1 : durationMs;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1 p-1 rounded-lg surface-elevated">
          {(
            [
              { id: 'settling', label: 'Smooth Settling' },
              { id: 'spring', label: 'Spring Snap' },
              { id: 'blur', label: 'Blur Focus' },
              { id: 'cascade', label: 'Stagger Cascade' },
            ] as const
          ).map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCurve(c.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                curve === c.id
                  ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-main)]'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setActiveState((prev) => !prev)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold"
          style={{
            backgroundColor: 'var(--accent-primary)',
            color: 'var(--accent-contrast)',
          }}
        >
          <Play className="w-3.5 h-3.5" />
          <span>Play Transition</span>
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 p-3 rounded-xl surface-elevated text-xs">
        <div className="flex items-center gap-2">
          <span className="text-[var(--text-muted)]">Duration:</span>
          {[150, 300, 600].map((ms) => (
            <button
              key={ms}
              type="button"
              onClick={() => setDurationMs(ms)}
              className={`px-2.5 py-1 rounded font-mono ${
                durationMs === ms
                  ? 'bg-[var(--accent-soft)] text-[var(--text-main)]'
                  : 'text-[var(--text-secondary)]'
              }`}
            >
              {ms}ms
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2 cursor-pointer text-[var(--text-main)]">
          <input
            type="checkbox"
            checked={reduced}
            onChange={(e) => setReduced(e.target.checked)}
            className="accent-[var(--accent-primary)]"
          />
          <span>Simulate Reduced Motion</span>
        </label>
      </div>

      <div className="rounded-xl surface-panel p-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[0, 1, 2].map((idx) => (
          <div
            key={idx}
            className="rounded-lg surface-elevated p-4 border"
            style={{
              transitionProperty: 'transform, opacity, filter',
              transitionDuration: `${effectiveMs}ms`,
              transitionDelay: curve === 'cascade' && !reduced ? `${idx * 70}ms` : '0ms',
              transitionTimingFunction: easing,
              transform: activeState
                ? 'translateY(-6px) scale(1.02)'
                : 'translateY(0) scale(1)',
              filter:
                curve === 'blur' && !activeState && !reduced ? 'blur(2px)' : 'blur(0px)',
              opacity: curve === 'blur' && !activeState ? 0.65 : 1,
            }}
          >
            <div className="font-mono text-xs text-[var(--accent-primary)]">
              Node 0{idx + 1}
            </div>
            <div className="font-display font-semibold text-sm text-[var(--text-main)] mt-1">
              {activeState ? 'Settled State' : 'Initial State'}
            </div>
            <div className="text-xs text-[var(--text-secondary)] mt-1">
              Compositor-only GPU properties
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
