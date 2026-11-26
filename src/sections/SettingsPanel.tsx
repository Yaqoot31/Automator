import { RotateCcw, Sun, Moon, Monitor, Sparkles } from 'lucide-react';
import type {
  AccentColor,
  AppSettings,
  Framework,
  LayoutDensity,
  ThemeMode,
} from '@/types';

interface SettingsPanelProps {
  settings: AppSettings;
  onUpdateSettings: (patch: Partial<AppSettings>) => void;
  onResetSettings: () => void;
}

const THEMES: { id: ThemeMode; label: string; description: string; previewBg: string; previewText: string }[] = [
  {
    id: 'obsidian',
    label: '2050 Obsidian',
    description: 'Deep obsidian canvas with subtle glass elevation',
    previewBg: '#08090c',
    previewText: '#f3f4f6',
  },
  {
    id: 'daylight',
    label: 'Arctic Daylight',
    description: 'High-clarity daylight canvas for bright studios',
    previewBg: '#f8fafc',
    previewText: '#0f172a',
  },
  {
    id: 'slate',
    label: 'Titanium Slate',
    description: 'Cool architectural graphite surfaces',
    previewBg: '#0f141c',
    previewText: '#f1f5f9',
  },
  {
    id: 'cobalt',
    label: 'Deep Cobalt',
    description: 'Midnight blue workspace palette',
    previewBg: '#070b17',
    previewText: '#eff6ff',
  },
];

const ACCENTS: { id: AccentColor; label: string; swatch: string }[] = [
  { id: 'amber', label: 'Amber Gold', swatch: '#d4a017' },
  { id: 'teal', label: 'Horizon Teal', swatch: '#0d9488' },
  { id: 'cobalt', label: 'Cobalt Blue', swatch: '#2563eb' },
  { id: 'emerald', label: 'Signal Emerald', swatch: '#059669' },
];

const DENSITIES: { id: LayoutDensity; label: string; detail: string }[] = [
  { id: 'compact', label: 'Compact', detail: 'Higher row density for power sessions' },
  { id: 'comfortable', label: 'Comfortable', detail: 'Balanced editorial workspace rhythm' },
  { id: 'spacious', label: 'Spacious', detail: 'Generous breathing room across cards' },
];

const FRAMEWORKS: { id: Framework; label: string }[] = [
  { id: 'playwright-ts', label: 'Playwright (TypeScript)' },
  { id: 'playwright-js', label: 'Playwright (JavaScript)' },
  { id: 'cypress-ts', label: 'Cypress (TypeScript)' },
  { id: 'cypress-js', label: 'Cypress (JavaScript)' },
  { id: 'selenium-ts', label: 'Selenium (TypeScript)' },
  { id: 'selenium-js', label: 'Selenium (JavaScript)' },
];

export default function SettingsPanel({
  settings,
  onUpdateSettings,
  onResetSettings,
}: SettingsPanelProps) {
  return (
    <section className="max-w-[1120px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b">
        <div>
          <h1 className="font-display font-bold text-2xl sm:text-3xl text-[var(--text-main)]">
            Workspace &amp; Engine Settings
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Personalize appearance, interface density, accessibility motion, and default crawler behavior. Changes persist automatically.
          </p>
        </div>

        <button
          type="button"
          onClick={onResetSettings}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium surface-panel hover:bg-[var(--surface-hover)] text-[var(--text-main)] transition-colors whitespace-nowrap shrink-0 min-h-[40px]"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Reset Defaults</span>
        </button>
      </div>

      {/* Appearance & Themes */}
      <div className="space-y-4">
        <div>
          <h2 className="font-display font-semibold text-lg text-[var(--text-main)]">
            Interface Theme
          </h2>
          <p className="text-sm text-[var(--text-secondary)]">
            Choose a calibrated surface palette for your environment.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {THEMES.map((theme) => {
            const active = settings.theme === theme.id;
            return (
              <button
                key={theme.id}
                type="button"
                onClick={() => onUpdateSettings({ theme: theme.id })}
                className={`text-left p-4 rounded-xl border transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] ${
                  active
                    ? 'surface-elevated border-[var(--accent-primary)]'
                    : 'surface-panel hover:border-[var(--border-strong)]'
                }`}
              >
                <div
                  className="h-16 rounded-lg border mb-3 p-2.5 flex items-end justify-between"
                  style={{
                    backgroundColor: theme.previewBg,
                    color: theme.previewText,
                  }}
                >
                  <span className="font-display text-xs font-semibold">Aa</span>
                  {theme.id === 'daylight' ? (
                    <Sun className="w-4 h-4 opacity-80" />
                  ) : theme.id === 'obsidian' ? (
                    <Moon className="w-4 h-4 opacity-80" />
                  ) : (
                    <Monitor className="w-4 h-4 opacity-80" />
                  )}
                </div>
                <div className="font-display font-semibold text-sm text-[var(--text-main)]">
                  {theme.label}
                </div>
                <div className="text-xs text-[var(--text-secondary)] mt-1">
                  {theme.description}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Accent Color & Layout Density */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="surface-panel rounded-xl p-6 space-y-4">
          <div>
            <h2 className="font-display font-semibold text-base text-[var(--text-main)]">
              Primary Accent
            </h2>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Applied to primary actions, active navigation indicators, and progress tracks.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {ACCENTS.map((acc) => {
              const active = settings.accent === acc.id;
              return (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => onUpdateSettings({ accent: acc.id })}
                  className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-colors min-h-[44px] ${
                    active
                      ? 'surface-elevated border-[var(--accent-primary)]'
                      : 'hover:bg-[var(--surface-hover)]'
                  }`}
                >
                  <span
                    className="w-4 h-4 rounded-full shrink-0"
                    style={{ backgroundColor: acc.swatch }}
                  />
                  <span className="text-sm font-medium text-[var(--text-main)]">
                    {acc.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="surface-panel rounded-xl p-6 space-y-4">
          <div>
            <h2 className="font-display font-semibold text-base text-[var(--text-main)]">
              Layout Density &amp; Typography Scale
            </h2>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Adjust vertical spacing and base text sizing across tables and consoles.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {DENSITIES.map((d) => {
              const active = settings.density === d.id;
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => onUpdateSettings({ density: d.id })}
                  className={`p-3 rounded-lg border text-left transition-colors ${
                    active
                      ? 'surface-elevated border-[var(--accent-primary)]'
                      : 'hover:bg-[var(--surface-hover)]'
                  }`}
                >
                  <div className="text-sm font-medium text-[var(--text-main)]">
                    {d.label}
                  </div>
                  <div className="text-[11px] text-[var(--text-muted)] mt-0.5 leading-snug">
                    {d.detail}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="pt-2 flex items-center justify-between gap-4">
            <label
              htmlFor="global-font-scale"
              className="text-sm font-medium text-[var(--text-main)]"
            >
              Interface Scale
            </label>
            <div className="flex items-center gap-3">
              <input
                id="global-font-scale"
                type="range"
                min={90}
                max={110}
                step={5}
                value={settings.fontScale}
                onChange={(e) =>
                  onUpdateSettings({ fontScale: Number(e.target.value) })
                }
                className="w-32 accent-[var(--accent-primary)]"
              />
              <span className="font-mono text-xs text-[var(--text-secondary)] w-10 text-right tabular-nums">
                {settings.fontScale}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Motion, Backdrop & Crawler Defaults */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="surface-panel rounded-xl p-6 space-y-5">
          <h2 className="font-display font-semibold text-base text-[var(--text-main)]">
            Accessibility &amp; Visual Atmosphere
          </h2>

          <label className="flex items-center justify-between gap-4 cursor-pointer min-h-[44px]">
            <div>
              <div className="text-sm font-medium text-[var(--text-main)]">
                Reduced Motion
              </div>
              <div className="text-xs text-[var(--text-secondary)]">
                Minimize transition distances and disable decorative motion
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.reducedMotion}
              onChange={(e) =>
                onUpdateSettings({ reducedMotion: e.target.checked })
              }
              className="w-5 h-5 accent-[var(--accent-primary)] rounded cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between gap-4 cursor-pointer pt-4 border-t min-h-[44px]">
            <div>
              <div className="text-sm font-medium text-[var(--text-main)] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                <span>Ambient Architectural Backdrop</span>
              </div>
              <div className="text-xs text-[var(--text-secondary)]">
                Display subtle brushed titanium atmosphere behind glass workspace shells
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.wallpaperEnabled}
              onChange={(e) =>
                onUpdateSettings({ wallpaperEnabled: e.target.checked })
              }
              className="w-5 h-5 accent-[var(--accent-primary)] rounded cursor-pointer"
            />
          </label>
        </div>

        <div className="surface-panel rounded-xl p-6 space-y-5">
          <h2 className="font-display font-semibold text-base text-[var(--text-main)]">
            Default Crawler &amp; Export Preferences
          </h2>

          <div className="flex items-center justify-between gap-4">
            <div>
              <label
                htmlFor="default-max-pages"
                className="text-sm font-medium text-[var(--text-main)]"
              >
                Default Max Pages
              </label>
              <div className="text-xs text-[var(--text-secondary)]">
                Initial page cap for new crawl configurations
              </div>
            </div>
            <input
              id="default-max-pages"
              type="number"
              min={1}
              max={1000}
              value={settings.defaultMaxPages}
              onChange={(e) =>
                onUpdateSettings({
                  defaultMaxPages: Math.min(
                    1000,
                    Math.max(1, parseInt(e.target.value, 10) || 100)
                  ),
                })
              }
              className="w-24 h-10 px-3 rounded-lg surface-elevated font-mono text-sm text-[var(--text-main)] text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
            />
          </div>

          <div className="flex items-center justify-between gap-4 pt-4 border-t">
            <div>
              <label
                htmlFor="default-framework"
                className="text-sm font-medium text-[var(--text-main)]"
              >
                Default Test Framework
              </label>
              <div className="text-xs text-[var(--text-secondary)]">
                Preferred target for single-page code inspection
              </div>
            </div>
            <select
              id="default-framework"
              value={settings.defaultFramework}
              onChange={(e) =>
                onUpdateSettings({
                  defaultFramework: e.target.value as Framework,
                })
              }
              className="h-10 px-3 rounded-lg surface-elevated text-sm text-[var(--text-main)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
            >
              {FRAMEWORKS.map((fw) => (
                <option key={fw.id} value={fw.id}>
                  {fw.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </section>
  );
}
