import { useState } from 'react';
import {
  ArrowLeft,
  RotateCcw,
  Maximize2,
  Minimize2,
  Search,
  Play,
  Info,
} from 'lucide-react';
import { DEMO_CATEGORIES, DEMOS } from '@/data/demos';
import { DemoCardPreview } from '@/components/DemoCardPreview';
import {
  InteractiveDashboardDemo,
  NavigationMenuDemo,
  ThemeCustomizationDemo,
  SettingsInterfaceDemo,
  AnimationTransitionDemo,
} from '@/components/demos/DemoSandboxesPart1';
import {
  MobileInterfaceDemo,
  DesktopInterfaceDemo,
  FeatureShowcaseDemo,
  PersonalizationDemo,
  ApplicationWorkflowDemo,
} from '@/components/demos/DemoSandboxesPart2';
import type { AppSettings, DemoCategory, DemoId } from '@/types';

interface DemoCenterProps {
  selectedDemoId: DemoId | null;
  onSelectDemo: (id: DemoId | null) => void;
  appSettings: AppSettings;
  onUpdateAppSettings: (patch: Partial<AppSettings>) => void;
}

export default function DemoCenter({
  selectedDemoId,
  onSelectDemo,
  appSettings,
  onUpdateAppSettings,
}: DemoCenterProps) {
  const [activeCategory, setActiveCategory] = useState<DemoCategory>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [fullscreen, setFullscreen] = useState(false);
  const [resetNonce, setResetNonce] = useState(0);

  const activeDemo = selectedDemoId
    ? DEMOS.find((d) => d.id === selectedDemoId) ?? null
    : null;

  const filteredDemos = DEMOS.filter((demo) => {
    const matchesCategory =
      activeCategory === 'All' || demo.category === activeCategory;
    const q = searchQuery.trim().toLowerCase();
    const matchesQuery =
      !q ||
      demo.title.toLowerCase().includes(q) ||
      demo.shortDescription.toLowerCase().includes(q) ||
      demo.category.toLowerCase().includes(q);
    return matchesCategory && matchesQuery;
  });

  const renderSandbox = (demoId: DemoId) => {
    switch (demoId) {
      case 'interactive-dashboard':
        return <InteractiveDashboardDemo key={resetNonce} />;
      case 'navigation-menu':
        return <NavigationMenuDemo key={resetNonce} />;
      case 'theme-customization':
        return (
          <ThemeCustomizationDemo
            key={resetNonce}
            currentSettings={appSettings}
            onApplyGlobal={onUpdateAppSettings}
          />
        );
      case 'settings-interface':
        return <SettingsInterfaceDemo key={resetNonce} />;
      case 'animation-transition':
        return <AnimationTransitionDemo key={resetNonce} />;
      case 'mobile-interface':
        return <MobileInterfaceDemo key={resetNonce} />;
      case 'desktop-interface':
        return <DesktopInterfaceDemo key={resetNonce} />;
      case 'feature-showcase':
        return <FeatureShowcaseDemo key={resetNonce} />;
      case 'personalization':
        return (
          <PersonalizationDemo
            key={resetNonce}
            currentSettings={appSettings}
            onApplyGlobal={onUpdateAppSettings}
          />
        );
      case 'application-workflow':
        return <ApplicationWorkflowDemo key={resetNonce} />;
    }
  };

  if (activeDemo) {
    const containerClasses = fullscreen
      ? 'fixed inset-0 z-[150] bg-[var(--surface-canvas)] overflow-y-auto p-4 sm:p-8'
      : 'max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 py-8';

    return (
      <section className={containerClasses} aria-label={`${activeDemo.title} preview`}>
        <div className="max-w-[1200px] mx-auto space-y-6">
          {/* Demo Preview Control Bar */}
          <div className="surface-panel rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setFullscreen(false);
                  onSelectDemo(null);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium surface-elevated hover:bg-[var(--surface-hover)] text-[var(--text-main)] min-h-[38px]"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Demo Center</span>
              </button>

              <div>
                <h1 className="font-display font-bold text-lg text-[var(--text-main)]">
                  {activeDemo.title}
                </h1>
                <div className="text-xs text-[var(--text-secondary)]">
                  {activeDemo.category} · {activeDemo.isSimulated ? 'Simulated Sandbox' : 'Live UI Module'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setResetNonce((n) => n + 1)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium surface-elevated hover:bg-[var(--surface-hover)] text-[var(--text-main)] min-h-[38px]"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Demo</span>
              </button>

              <button
                type="button"
                onClick={() => setFullscreen((prev) => !prev)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold min-h-[38px]"
                style={{
                  backgroundColor: 'var(--accent-primary)',
                  color: 'var(--accent-contrast)',
                }}
              >
                {fullscreen ? (
                  <>
                    <Minimize2 className="w-3.5 h-3.5" />
                    <span>Exit Fullscreen</span>
                  </>
                ) : (
                  <>
                    <Maximize2 className="w-3.5 h-3.5" />
                    <span>Fullscreen</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Demo Workspace + Guide Split */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-8 surface-panel rounded-2xl p-5 sm:p-6 space-y-4">
              {activeDemo.isSimulated && activeDemo.simulationNote && (
                <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)] pb-3 border-b">
                  <Info className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
                  <span>{activeDemo.simulationNote}</span>
                </div>
              )}
              {renderSandbox(activeDemo.id)}
            </div>

            <aside className="lg:col-span-4 surface-panel rounded-2xl p-5 space-y-5">
              <div className="space-y-1.5">
                <h2 className="font-display font-semibold text-base text-[var(--text-main)]">
                  Feature Overview
                </h2>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                  {activeDemo.featureDescription}
                </p>
              </div>

              <div className="pt-4 border-t space-y-2.5">
                <h3 className="font-display font-semibold text-sm text-[var(--text-main)]">
                  Demo Instructions
                </h3>
                <ol className="space-y-2 text-xs text-[var(--text-secondary)] list-decimal list-inside leading-relaxed">
                  {activeDemo.instructions.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
              </div>

              <div className="pt-4 border-t space-y-2">
                <div className="text-xs font-medium text-[var(--text-muted)]">
                  Included Capabilities
                </div>
                <div className="text-xs text-[var(--text-main)]">
                  {activeDemo.highlights.join(' · ')}
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-6 border-b">
        <div className="space-y-2 max-w-2xl">
          <div className="text-xs font-medium text-[var(--text-secondary)]">
            Interactive Product Demos · 10 Live Preview Modules
          </div>
          <h1 className="font-display font-bold text-2xl sm:text-3xl text-[var(--text-main)]">
            Interactive Product Demos
          </h1>
          <p className="text-sm sm:text-base text-[var(--text-secondary)]">
            Explore WebCrawler Pro capabilities through real interactive sandboxes. Test dashboards, themes, navigation patterns, responsive device views, and the full crawling workflow.
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full lg:w-72">
          <Search
            className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <label htmlFor="demo-search" className="sr-only">
            Search interactive demos
          </label>
          <input
            id="demo-search"
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search demos..."
            className="w-full h-10 pl-10 pr-3 rounded-xl surface-panel text-sm text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
          />
        </div>
      </div>

      {/* Category Filter Tabs */}
      <div className="flex flex-wrap gap-1.5 p-1.5 rounded-xl surface-panel w-fit">
        {DEMO_CATEGORIES.map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => setActiveCategory(category)}
            className={`px-3.5 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors min-h-[36px] ${
              activeCategory === category
                ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)] font-semibold'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-main)]'
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      {/* 10 Demo Cards Grid */}
      {filteredDemos.length === 0 ? (
        <div className="surface-panel rounded-2xl p-10 text-center space-y-3">
          <div className="font-display font-semibold text-base text-[var(--text-main)]">
            No matching demos found
          </div>
          <button
            type="button"
            onClick={() => {
              setActiveCategory('All');
              setSearchQuery('');
            }}
            className="px-4 py-2 rounded-lg text-xs font-semibold surface-elevated text-[var(--text-main)]"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDemos.map((demo) => (
            <article
              key={demo.id}
              className="group interactive-card rounded-xl flex flex-col justify-between overflow-hidden"
            >
              <div>
                <DemoCardPreview demo={demo} />
                <div className="p-5 space-y-2.5">
                  <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                    <span>{demo.category}</span>
                    <span>{demo.isSimulated ? 'Simulated' : 'Interactive'}</span>
                  </div>
                  <h2 className="font-display font-semibold text-base text-[var(--text-main)]">
                    {demo.title}
                  </h2>
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                    {demo.shortDescription}
                  </p>
                </div>
              </div>

              <div className="px-5 pb-5 pt-2 flex items-center justify-between gap-3">
                <span className="text-xs text-[var(--text-muted)] truncate">
                  {demo.highlights.slice(0, 2).join(' · ')}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setResetNonce(0);
                    onSelectDemo(demo.id);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-transform duration-150 active:scale-[0.98] min-h-[38px]"
                  style={{
                    backgroundColor: 'var(--accent-primary)',
                    color: 'var(--accent-contrast)',
                  }}
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Live Preview</span>
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
