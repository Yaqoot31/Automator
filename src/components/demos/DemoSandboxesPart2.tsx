import { useState } from 'react';
import {
  Home,
  Compass,
  Layers,
  SlidersHorizontal,
  Play,
  Maximize2,
  Minimize2,
  CheckCircle2,
  ArrowRight,
  Check,
  Columns,
} from 'lucide-react';
import type { AppSettings, Framework, LayoutDensity } from '@/types';

/* -------------------------------------------------------------------------- */
/* 6. Mobile Interface Demo                                                   */
/* -------------------------------------------------------------------------- */
const MOBILE_PAGES = [
  { path: '/login', type: 'Login', elements: 9, locator: '[data-testid="login-submit"]' },
  { path: '/dashboard', type: 'Dashboard', elements: 24, locator: '[role="region"][aria-label="KPI"]' },
  { path: '/checkout', type: 'Form', elements: 17, locator: '[aria-label="Complete order"]' },
];

export function MobileInterfaceDemo() {
  const [tab, setTab] = useState<'home' | 'scan' | 'pages' | 'config'>('home');
  const [scanProgress, setScanProgress] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [sheetPage, setSheetPage] = useState<(typeof MOBILE_PAGES)[number] | null>(null);
  const [mobileRobots, setMobileRobots] = useState(true);

  const runMobileScan = () => {
    if (scanning) return;
    setScanning(true);
    setScanProgress(15);
    setTimeout(() => setScanProgress(60), 450);
    setTimeout(() => {
      setScanProgress(100);
      setScanning(false);
      setTab('pages');
    }, 1000);
  };

  return (
    <div className="flex flex-col items-center">
      <div className="w-full max-w-[360px] rounded-[28px] border-2 surface-panel shadow-2xl overflow-hidden flex flex-col h-[520px] relative">
        {/* Top Mobile Bar */}
        <div className="h-12 px-4 border-b flex items-center justify-between surface-elevated shrink-0">
          <span className="font-display font-semibold text-sm text-[var(--text-main)]">
            WebCrawler Mobile
          </span>
          <span className="font-mono text-[11px] text-[var(--text-muted)]">390px</span>
        </div>

        {/* Mobile Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {tab === 'home' && (
            <div className="space-y-3">
              <div className="rounded-xl surface-elevated p-4 space-y-2">
                <div className="text-xs text-[var(--text-muted)]">Active Target</div>
                <div className="font-mono text-xs text-[var(--text-main)] truncate">
                  https://app.example.com
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setTab('scan');
                    runMobileScan();
                  }}
                  className="w-full mt-2 py-2.5 rounded-lg text-xs font-semibold min-h-[44px]"
                  style={{
                    backgroundColor: 'var(--accent-primary)',
                    color: 'var(--accent-contrast)',
                  }}
                >
                  Run Mobile Scan
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="rounded-xl surface-elevated p-3">
                  <div className="text-[11px] text-[var(--text-muted)]">Routes</div>
                  <div className="font-display font-bold text-xl text-[var(--text-main)] tabular-nums">
                    24
                  </div>
                </div>
                <div className="rounded-xl surface-elevated p-3">
                  <div className="text-[11px] text-[var(--text-muted)]">Suites</div>
                  <div className="font-display font-bold text-xl text-[var(--text-main)] tabular-nums">
                    6
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === 'scan' && (
            <div className="rounded-xl surface-elevated p-4 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-[var(--text-main)]">
                  {scanning ? 'Discovering routes...' : scanProgress === 100 ? 'Scan Complete' : 'Ready to scan'}
                </span>
                <span className="font-mono text-[var(--text-main)] tabular-nums">
                  {scanProgress}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-[var(--surface-panel)] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${scanProgress}%`,
                    backgroundColor: 'var(--accent-primary)',
                  }}
                />
              </div>
              <button
                type="button"
                onClick={runMobileScan}
                className="w-full py-2.5 rounded-lg text-xs font-semibold min-h-[44px]"
                style={{
                  backgroundColor: 'var(--accent-primary)',
                  color: 'var(--accent-contrast)',
                }}
              >
                {scanning ? 'Scanning...' : 'Start Quick Scan'}
              </button>
            </div>
          )}

          {tab === 'pages' && (
            <div className="space-y-2.5">
              <div className="text-xs text-[var(--text-muted)]">
                Tap a discovered route to inspect mobile sheet:
              </div>
              {MOBILE_PAGES.map((p) => (
                <button
                  key={p.path}
                  type="button"
                  onClick={() => setSheetPage(p)}
                  className="w-full text-left p-3.5 rounded-xl surface-elevated hover:bg-[var(--surface-hover)] flex items-center justify-between min-h-[48px]"
                >
                  <div>
                    <div className="font-mono text-xs text-[var(--text-main)]">{p.path}</div>
                    <div className="text-[11px] text-[var(--text-secondary)]">
                      {p.type} · {p.elements} elements
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-[var(--text-muted)]" />
                </button>
              ))}
            </div>
          )}

          {tab === 'config' && (
            <div className="rounded-xl surface-elevated p-4 space-y-3">
              <label className="flex items-center justify-between min-h-[44px] text-xs text-[var(--text-main)]">
                <span>Respect robots.txt</span>
                <input
                  type="checkbox"
                  checked={mobileRobots}
                  onChange={(e) => setMobileRobots(e.target.checked)}
                  className="w-5 h-5 accent-[var(--accent-primary)]"
                />
              </label>
              <div className="text-[11px] text-[var(--text-muted)]">
                Touch targets are sized at 44px minimum for thumb ergonomics.
              </div>
            </div>
          )}
        </div>

        {/* Bottom Tab Bar */}
        <nav
          aria-label="Mobile demo navigation"
          className="h-16 border-t surface-elevated grid grid-cols-4 shrink-0"
        >
          {(
            [
              { id: 'home', label: 'Home', icon: Home },
              { id: 'scan', label: 'Scan', icon: Compass },
              { id: 'pages', label: 'Pages', icon: Layers },
              { id: 'config', label: 'Config', icon: SlidersHorizontal },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`flex flex-col items-center justify-center gap-1 text-[11px] min-h-[44px] ${
                  active ? 'text-[var(--accent-primary)] font-semibold' : 'text-[var(--text-secondary)]'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Mobile Bottom Sheet */}
        {sheetPage && (
          <div className="absolute inset-0 bg-black/55 flex items-end">
            <div className="w-full rounded-t-2xl surface-panel border-t p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-semibold text-[var(--text-main)]">
                  {sheetPage.path}
                </span>
                <button
                  type="button"
                  onClick={() => setSheetPage(null)}
                  className="text-xs text-[var(--accent-primary)] font-medium"
                >
                  Close
                </button>
              </div>
              <div className="text-xs text-[var(--text-secondary)]">
                Primary Locator: <span className="font-mono text-[var(--text-main)]">{sheetPage.locator}</span>
              </div>
              <div className="text-[11px] text-[var(--text-muted)]">
                Archetype: {sheetPage.type} · {sheetPage.elements} interactive nodes
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 7. Desktop Interface Demo                                                  */
/* -------------------------------------------------------------------------- */
const DESKTOP_FILES = [
  { name: 'LoginPage.ts', route: '/auth/login', node: '<button data-testid="sign-in">' },
  { name: 'DashboardPage.ts', route: '/workspace', node: '<section aria-label="Metrics">' },
  { name: 'CheckoutPage.ts', route: '/billing/pay', node: '<form role="form">' },
];

export function DesktopInterfaceDemo() {
  const [selectedFile, setSelectedFile] = useState(0);
  const [inspectorTab, setInspectorTab] = useState<'dom' | 'locators' | 'spec'>('dom');
  const [splitView, setSplitView] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const file = DESKTOP_FILES[selectedFile];

  return (
    <div
      className={`rounded-xl border surface-panel overflow-hidden transition-all ${
        expanded ? 'min-h-[380px]' : 'min-h-[290px]'
      }`}
    >
      {/* Desktop Window Header */}
      <div className="h-11 px-4 border-b surface-elevated flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 text-xs">
          <span className="font-display font-semibold text-[var(--text-main)]">
            Desktop Studio Workspace
          </span>
          <span className="text-[var(--text-muted)]">·</span>
          <span className="font-mono text-[var(--text-secondary)]">{file.name}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSplitView((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs surface-panel text-[var(--text-secondary)] hover:text-[var(--text-main)]"
          >
            <Columns className="w-3.5 h-3.5" />
            <span>{splitView ? 'Single Pane' : 'Split Pane'}</span>
          </button>
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="p-1.5 rounded surface-panel text-[var(--text-secondary)] hover:text-[var(--text-main)]"
            aria-label="Toggle desktop window height"
          >
            {expanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 min-h-[250px]">
        {/* Left Tree */}
        <div className="md:col-span-4 border-b md:border-b-0 md:border-r p-3 space-y-1 bg-[var(--surface-elevated)]">
          <div className="text-[11px] font-medium text-[var(--text-muted)] px-2 pb-1">
            Generated Page Objects
          </div>
          {DESKTOP_FILES.map((item, i) => (
            <button
              key={item.name}
              type="button"
              onClick={() => setSelectedFile(i)}
              className={`w-full text-left px-3 py-2 rounded-lg font-mono text-xs transition-colors ${
                selectedFile === i
                  ? 'bg-[var(--accent-soft)] text-[var(--text-main)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-main)]'
              }`}
            >
              {item.name}
            </button>
          ))}
        </div>

        {/* Main Inspector */}
        <div
          className={`${
            splitView ? 'md:col-span-5 border-b md:border-b-0 md:border-r' : 'md:col-span-8'
          } p-4 space-y-3`}
        >
          <div className="flex gap-1 p-1 rounded-lg surface-elevated w-fit">
            {(
              [
                { id: 'dom', label: 'DOM Node' },
                { id: 'locators', label: 'Locators' },
                { id: 'spec', label: 'Spec' },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setInspectorTab(t.id)}
                className={`px-2.5 py-1 rounded text-xs font-medium ${
                  inspectorTab === t.id
                    ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)]'
                    : 'text-[var(--text-secondary)]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="rounded-lg bg-[var(--surface-canvas)] border p-3 font-mono text-xs text-[var(--text-main)] space-y-1.5">
            {inspectorTab === 'dom' && (
              <>
                <div className="text-[var(--text-muted)]">Route: {file.route}</div>
                <div className="text-[var(--accent-secondary)]">{file.node}</div>
              </>
            )}
            {inspectorTab === 'locators' && (
              <>
                <div>1. getByTestId(&apos;primary-action&apos;)</div>
                <div>2. getByRole(&apos;button&apos;, &#123; name: &apos;Continue&apos; &#125;)</div>
              </>
            )}
            {inspectorTab === 'spec' && (
              <div>
                test(&apos;renders {file.route}&apos;, async (&#123; page &#125;) =&gt; &#123; await page.goto(&apos;{file.route}&apos;); &#125;);
              </div>
            )}
          </div>
        </div>

        {splitView && (
          <div className="md:col-span-3 p-4 space-y-2 bg-[var(--surface-panel)]">
            <div className="text-xs font-medium text-[var(--text-main)]">Shortcuts</div>
            <div className="text-[11px] text-[var(--text-secondary)] space-y-1 font-mono">
              <div>⌘K · Command Menu</div>
              <div>⌘B · Toggle Sidebar</div>
              <div>⌘E · Export ZIP</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 8. Feature Showcase Demo                                                   */
/* -------------------------------------------------------------------------- */
const PIPELINE_STAGES = [
  {
    id: 'discovery',
    title: '1. URL Discovery',
    goal: 'Map every reachable route automatically',
    mechanism: 'Breadth-first link extraction with robots.txt filtering',
    outcome: 'Eliminates manual route inventory spreadsheets',
    snippet: 'Discovered 24 internal routes · 0 external leaks',
  },
  {
    id: 'classifier',
    title: '2. DOM Classifier',
    goal: 'Understand page purpose before writing tests',
    mechanism: 'Inspects form inputs, tables, headings, and auth tokens',
    outcome: 'Groups screens into Login, Dashboard, Product, Form, Table',
    snippet: 'Classified /checkout as Form (17 interactive controls)',
  },
  {
    id: 'locators',
    title: '3. Locator Resilience',
    goal: 'Avoid brittle CSS class selectors',
    mechanism: 'Ranks data-testid, aria-label, and accessible roles first',
    outcome: 'Tests survive styling refactors cleanly',
    snippet: 'page.getByRole("button", { name: "Submit Order" })',
  },
  {
    id: 'codegen',
    title: '4. Multi-Framework Export',
    goal: 'Ship runnable suites immediately',
    mechanism: 'Synthesizes typed Page Objects, specs, and runner configs',
    outcome: 'Exports ready-to-run ZIP for Playwright, Cypress, or Selenium',
    snippet: 'playwright-ts/pages/CheckoutPage.ts + tests/checkout.spec.ts',
  },
];

export function FeatureShowcaseDemo() {
  const [activeStage, setActiveStage] = useState(0);
  const [framework, setFramework] = useState<Framework>('playwright-ts');
  const stage = PIPELINE_STAGES[activeStage];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {PIPELINE_STAGES.map((st, idx) => (
          <button
            key={st.id}
            type="button"
            onClick={() => setActiveStage(idx)}
            className={`p-3 rounded-xl border text-left text-xs transition-colors ${
              activeStage === idx
                ? 'surface-elevated border-[var(--accent-primary)] text-[var(--text-main)]'
                : 'surface-panel text-[var(--text-secondary)]'
            }`}
          >
            <div className="font-display font-semibold">{st.title}</div>
          </button>
        ))}
      </div>

      <div className="rounded-xl surface-panel p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-3 rounded-lg surface-elevated space-y-1">
            <div className="text-[var(--text-muted)]">User Goal</div>
            <div className="font-medium text-[var(--text-main)]">{stage.goal}</div>
          </div>
          <div className="p-3 rounded-lg surface-elevated space-y-1">
            <div className="text-[var(--text-muted)]">Interface Mechanism</div>
            <div className="font-medium text-[var(--text-main)]">{stage.mechanism}</div>
          </div>
          <div className="p-3 rounded-lg surface-elevated space-y-1">
            <div className="text-[var(--text-muted)]">Measurable Outcome</div>
            <div className="font-medium text-[var(--text-main)]">{stage.outcome}</div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t">
          <div className="font-mono text-xs text-[var(--accent-secondary)]">
            {stage.snippet}
          </div>
          <select
            aria-label="Target framework comparison"
            value={framework}
            onChange={(e) => setFramework(e.target.value as Framework)}
            className="h-8 px-2.5 rounded-lg surface-elevated text-xs text-[var(--text-main)]"
          >
            <option value="playwright-ts">Playwright TS</option>
            <option value="cypress-ts">Cypress TS</option>
            <option value="selenium-ts">Selenium TS</option>
          </select>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 9. Customization & Personalization Demo                                    */
/* -------------------------------------------------------------------------- */
export function PersonalizationDemo({
  currentSettings,
  onApplyGlobal,
}: {
  currentSettings: AppSettings;
  onApplyGlobal: (patch: Partial<AppSettings>) => void;
}) {
  const [density, setDensity] = useState<LayoutDensity>(currentSettings.density);
  const [fontScale, setFontScale] = useState(currentSettings.fontScale);
  const [showChart, setShowChart] = useState(true);
  const [showLogs, setShowLogs] = useState(true);
  const [applied, setApplied] = useState(false);

  const paddingClass =
    density === 'compact' ? 'p-2.5' : density === 'spacious' ? 'p-5' : 'p-3.5';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl surface-panel p-4 space-y-3">
          <div className="text-xs font-medium text-[var(--text-main)]">
            Workspace Density
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(['compact', 'comfortable', 'spacious'] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => {
                  setDensity(d);
                  setApplied(false);
                }}
                className={`py-2 px-2 rounded-lg text-xs capitalize border ${
                  density === d
                    ? 'surface-elevated border-[var(--accent-primary)] text-[var(--text-main)] font-medium'
                    : 'surface-panel text-[var(--text-secondary)]'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl surface-panel p-4 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-[var(--text-main)]">Typography Scale</span>
            <span className="font-mono text-[var(--text-secondary)] tabular-nums">
              {fontScale}%
            </span>
          </div>
          <input
            type="range"
            min={90}
            max={110}
            step={5}
            value={fontScale}
            onChange={(e) => {
              setFontScale(Number(e.target.value));
              setApplied(false);
            }}
            className="w-full accent-[var(--accent-primary)]"
          />
          <div className="flex items-center gap-4 text-xs text-[var(--text-secondary)]">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={showChart}
                onChange={(e) => setShowChart(e.target.checked)}
                className="accent-[var(--accent-primary)]"
              />
              <span>Metrics Widget</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={showLogs}
                onChange={(e) => setShowLogs(e.target.checked)}
                className="accent-[var(--accent-primary)]"
              />
              <span>Logs Widget</span>
            </label>
          </div>
        </div>
      </div>

      {/* Live Personalized Layout Sandbox */}
      <div
        className="rounded-xl border surface-panel p-4 space-y-3"
        style={{ fontSize: `${fontScale}%` }}
      >
        {showChart && (
          <div className={`rounded-lg surface-elevated border ${paddingClass}`}>
            <div className="font-display font-semibold text-sm text-[var(--text-main)]">
              Coverage Summary Widget
            </div>
            <div className="text-xs text-[var(--text-secondary)] mt-0.5">
              Rendering with {density} spacing at {fontScale}% scale.
            </div>
          </div>
        )}
        {showLogs && (
          <div className={`rounded-lg surface-elevated border font-mono text-xs text-[var(--text-secondary)] ${paddingClass}`}>
            [11:52:04] Classified /checkout/cart as Product (14 elements)
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => {
            onApplyGlobal({ density, fontScale });
            setApplied(true);
          }}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold"
          style={{
            backgroundColor: 'var(--accent-primary)',
            color: 'var(--accent-contrast)',
          }}
        >
          {applied && <Check className="w-3.5 h-3.5" />}
          <span>{applied ? 'Preferences Applied' : 'Apply to Live App'}</span>
        </button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 10. Application Workflow Demo                                              */
/* -------------------------------------------------------------------------- */
const WORKFLOW_STEPS = [
  '1. Target URL',
  '2. Crawl Rules',
  '3. Live Scan',
  '4. Inspect Routes',
  '5. Export Suite',
];

export function ApplicationWorkflowDemo() {
  const [step, setStep] = useState(0);
  const [targetUrl, setTargetUrl] = useState('https://shop.acme-demo.io');
  const [respectRobots, setRespectRobots] = useState(true);
  const [scanDone, setScanDone] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [selectedFw, setSelectedFw] = useState<'Playwright TS' | 'Cypress TS' | 'Selenium TS'>('Playwright TS');

  const triggerScan = () => {
    setScanning(true);
    setScanDone(false);
    setTimeout(() => {
      setScanning(false);
      setScanDone(true);
      setStep(3);
    }, 1100);
  };

  return (
    <div className="space-y-4">
      {/* Stepper */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {WORKFLOW_STEPS.map((label, idx) => (
          <button
            key={label}
            type="button"
            onClick={() => setStep(idx)}
            className={`px-3 py-2 rounded-lg text-xs font-medium text-left transition-colors border ${
              step === idx
                ? 'surface-elevated border-[var(--accent-primary)] text-[var(--text-main)]'
                : idx < step
                  ? 'surface-panel text-[var(--status-success)]'
                  : 'surface-panel text-[var(--text-muted)]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="rounded-xl surface-panel p-5 space-y-4 min-h-[210px] flex flex-col justify-between">
        {step === 0 && (
          <div className="space-y-3">
            <div className="text-sm font-medium text-[var(--text-main)]">
              Step 1: Define Target Application
            </div>
            <input
              type="url"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              className="w-full h-10 px-3 rounded-lg surface-elevated font-mono text-xs text-[var(--text-main)]"
            />
          </div>
        )}

        {step === 1 && (
          <div className="space-y-3">
            <div className="text-sm font-medium text-[var(--text-main)]">
              Step 2: Traversal Boundaries
            </div>
            <label className="flex items-center gap-2.5 text-xs text-[var(--text-secondary)] cursor-pointer">
              <input
                type="checkbox"
                checked={respectRobots}
                onChange={(e) => setRespectRobots(e.target.checked)}
                className="accent-[var(--accent-primary)]"
              />
              <span>Respect robots.txt directives for {targetUrl}</span>
            </label>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <div className="text-sm font-medium text-[var(--text-main)]">
              Step 3: Execute Discovery Scan
            </div>
            <button
              type="button"
              onClick={triggerScan}
              disabled={scanning}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold"
              style={{
                backgroundColor: 'var(--accent-primary)',
                color: 'var(--accent-contrast)',
              }}
            >
              <Play className="w-3.5 h-3.5" />
              <span>{scanning ? 'Crawling routes...' : 'Run 1-Second Simulated Scan'}</span>
            </button>
            {scanDone && (
              <div className="text-xs text-[var(--status-success)] flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>Discovered 12 routes cleanly.</span>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-2.5">
            <div className="text-sm font-medium text-[var(--text-main)]">
              Step 4: Classified Route Snapshot
            </div>
            <div className="rounded-lg surface-elevated p-3 font-mono text-xs text-[var(--text-secondary)] space-y-1">
              <div className="text-[var(--text-main)]">{targetUrl}/login · Login · 9 elements</div>
              <div>{targetUrl}/catalog · Product · 22 elements</div>
              <div>{targetUrl}/orders · Table · 19 elements</div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3">
            <div className="text-sm font-medium text-[var(--text-main)]">
              Step 5: Select Export Target
            </div>
            <div className="flex flex-wrap gap-2">
              {(['Playwright TS', 'Cypress TS', 'Selenium TS'] as const).map((fw) => (
                <button
                  key={fw}
                  type="button"
                  onClick={() => setSelectedFw(fw)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                    selectedFw === fw
                      ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)]'
                      : 'surface-elevated text-[var(--text-secondary)]'
                  }`}
                >
                  {fw}
                </button>
              ))}
            </div>
            <div className="font-mono text-xs text-[var(--status-success)]">
              Ready to archive {selectedFw} Page Objects &amp; specs for {targetUrl}
            </div>
          </div>
        )}

        <div className="pt-3 border-t flex items-center justify-between">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="px-3 py-1.5 rounded-lg text-xs surface-elevated disabled:opacity-40 text-[var(--text-main)]"
          >
            Previous Step
          </button>
          <button
            type="button"
            onClick={() => setStep((s) => Math.min(4, s + 1))}
            disabled={step === 4}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40"
            style={{
              backgroundColor: 'var(--accent-primary)',
              color: 'var(--accent-contrast)',
            }}
          >
            Next Step
          </button>
        </div>
      </div>
    </div>
  );
}
