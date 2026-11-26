import { RotateCcw } from 'lucide-react';
import type {
  AccentColor,
  AppSettings,
  AutomationFramework,
  LayoutDensity,
  ThemeMode,
  UserProfile,
} from '@/types';
import { FRAMEWORK_OPTIONS } from '@/lib/frameworks';

interface SettingsViewProps {
  settings: AppSettings;
  user: UserProfile;
  onUpdateSettings: (patch: Partial<AppSettings>) => void;
  onResetSettings: () => void;
}

const THEMES: { id: ThemeMode; label: string; swatch: string }[] = [
  { id: 'obsidian', label: 'Obsidian Dark', swatch: '#08090c' },
  { id: 'daylight', label: 'Daylight Light', swatch: '#f8fafc' },
  { id: 'slate', label: 'Slate Studio', swatch: '#0f141c' },
  { id: 'cobalt', label: 'Cobalt Night', swatch: '#070b17' },
];

const ACCENTS: { id: AccentColor; label: string; color: string }[] = [
  { id: 'amber', label: 'Amber', color: '#d4a017' },
  { id: 'teal', label: 'Teal', color: '#0d9488' },
  { id: 'cobalt', label: 'Cobalt', color: '#2563eb' },
  { id: 'emerald', label: 'Emerald', color: '#059669' },
];

export function SettingsView({
  settings,
  user,
  onUpdateSettings,
  onResetSettings,
}: SettingsViewProps) {
  return (
    <div className="max-w-[960px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-5 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-xl sm:text-2xl text-[var(--text-main)]">
            Platform Settings
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
            Customize appearance themes, workspace density, accessibility motion, and default code generation targets.
          </p>
        </div>
        <button
          type="button"
          onClick={onResetSettings}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-medium surface-panel hover:bg-[var(--surface-hover)] min-h-[44px] w-full sm:w-auto shrink-0"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Defaults</span>
        </button>
      </div>

      {/* Theme Mode */}
      <section className="surface-panel rounded-2xl p-4 sm:p-6 space-y-4">
        <div className="text-sm font-semibold">Color Mode &amp; Surface Theme</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
          {THEMES.map((t) => {
            const active = settings.theme === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onUpdateSettings({ theme: t.id })}
                className={`p-3 sm:p-3.5 rounded-xl border text-left space-y-2 transition-colors min-h-[44px] ${
                  active
                    ? 'border-[var(--accent-primary)] bg-[var(--accent-soft)]'
                    : 'surface-elevated'
                }`}
              >
                <div
                  className="w-full h-8 rounded-lg border"
                  style={{ backgroundColor: t.swatch }}
                />
                <div className="text-xs font-semibold truncate">{t.label}</div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Accent & Typography */}
      <section className="surface-panel rounded-2xl p-4 sm:p-6 space-y-5">
        <div className="space-y-2.5">
          <div className="text-sm font-semibold">Accent Color</div>
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2.5">
            {ACCENTS.map((a) => {
              const active = settings.accent === a.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => onUpdateSettings({ accent: a.id })}
                  className={`inline-flex items-center justify-center sm:justify-start gap-2 px-4 py-2.5 rounded-xl text-xs font-medium border min-h-[44px] ${
                    active
                      ? 'border-[var(--accent-primary)] bg-[var(--accent-soft)]'
                      : 'surface-elevated'
                  }`}
                >
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: a.color }}
                  />
                  <span>{a.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--text-secondary)]">
              Workspace Density
            </label>
            <select
              value={settings.density}
              onChange={(e) => onUpdateSettings({ density: e.target.value as LayoutDensity })}
              className="w-full min-h-[44px] px-3 rounded-lg surface-elevated text-xs"
            >
              <option value="compact">Compact</option>
              <option value="comfortable">Comfortable</option>
              <option value="spacious">Spacious</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--text-secondary)]">
              Default Automation Stack
            </label>
            <select
              value={settings.defaultFramework}
              onChange={(e) =>
                onUpdateSettings({ defaultFramework: e.target.value as AutomationFramework })
              }
              className="w-full min-h-[44px] px-3 rounded-lg surface-elevated text-xs"
            >
              {FRAMEWORK_OPTIONS.map((fw) => (
                <option key={fw.id} value={fw.id}>
                  {fw.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--text-secondary)]">
              Interface Scale ({settings.fontScale}%)
            </label>
            <input
              type="range"
              min={90}
              max={115}
              step={5}
              value={settings.fontScale}
              onChange={(e) => onUpdateSettings({ fontScale: Number(e.target.value) })}
              className="w-full h-11 accent-[var(--accent-primary)]"
            />
          </div>
        </div>

        <div className="pt-1">
          <label className="inline-flex items-center gap-2.5 text-xs cursor-pointer min-h-[44px]">
            <input
              type="checkbox"
              checked={settings.reducedMotion}
              onChange={(e) => onUpdateSettings({ reducedMotion: e.target.checked })}
              className="w-4 h-4 rounded accent-[var(--accent-primary)]"
            />
            <span>Reduce animations and transition motion</span>
          </label>
        </div>
      </section>

      {/* Account Info */}
      <section className="surface-panel rounded-2xl p-4 sm:p-6 space-y-2 text-xs">
        <div className="text-sm font-semibold text-[var(--text-main)]">Signed-in Account</div>
        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-1.5 sm:gap-3 text-[var(--text-secondary)]">
          <span>
            Name: <span className="text-[var(--text-main)] font-medium">{user.name}</span>
          </span>
          <span className="break-all">
            Email: <span className="font-mono text-[var(--text-main)]">{user.email}</span>
          </span>
          <span>
            Role: <span className="font-mono uppercase">{user.role}</span>
          </span>
        </div>
      </section>
    </div>
  );
}
