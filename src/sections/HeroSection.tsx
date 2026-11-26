import { useState } from 'react';
import {
  ArrowRight,
  Globe,
  PlaySquare,
  Layers,
  ShieldCheck,
  Code2,
  Compass,
  Sliders,
  Smartphone,
  LayoutDashboard,
} from 'lucide-react';
import { MEDIA_ASSETS } from '@/lib/mediaAssets';
import type { AppView, DemoId } from '@/types';

interface HeroSectionProps {
  url: string;
  onUrlChange: (url: string) => void;
  onStartCrawl: () => void;
  onNavigate: (view: AppView) => void;
  onOpenDemo: (demoId: DemoId) => void;
}

const CAPABILITIES = [
  {
    title: '01. Route Discovery',
    metric: 'Up to 1,000 routes',
    description:
      'Maps internal navigation graphs while honoring robots.txt directives and subdomain boundaries.',
    icon: Compass,
  },
  {
    title: '02. Page Classification',
    metric: '6 UI archetypes',
    description:
      'Automatically identifies Login, Dashboard, Product, Form, Table, and general views from DOM structure.',
    icon: Layers,
  },
  {
    title: '03. Resilient Locators',
    metric: 'Role & testid first',
    description:
      'Prioritizes semantic attributes, ARIA roles, and stable selectors to minimize brittle test maintenance.',
    icon: ShieldCheck,
  },
  {
    title: '04. Suite Export',
    metric: '6 framework targets',
    description:
      'Packages complete Page Object Models, specs, configs, and execution guides into a ready-to-run ZIP.',
    icon: Code2,
  },
];

const FEATURED_DEMOS: {
  id: DemoId;
  title: string;
  category: string;
  summary: string;
  icon: typeof LayoutDashboard;
}[] = [
  {
    id: 'interactive-dashboard',
    title: 'Interactive Dashboard Demo',
    category: 'Interface & Layout',
    summary: 'Explore live telemetry charts, timeframe filters, and clickable metric drilldowns.',
    icon: LayoutDashboard,
  },
  {
    id: 'theme-customization',
    title: 'Theme Customization Demo',
    category: 'Customization',
    summary: 'Switch 2050 surface themes, accent palettes, and architectural wallpapers in real time.',
    icon: Sliders,
  },
  {
    id: 'mobile-interface',
    title: 'Mobile Interface Demo',
    category: 'Responsive Devices',
    summary: 'Test touch-first smartphone navigation, mobile bottom sheets, and compact crawl cards.',
    icon: Smartphone,
  },
];

export default function HeroSection({
  url,
  onUrlChange,
  onStartCrawl,
  onNavigate,
  onOpenDemo,
}: HeroSectionProps) {
  const [imageError, setImageError] = useState(false);

  return (
    <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12 space-y-14">
      {/* Split 2-Column Hero */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        <div className="lg:col-span-7 flex flex-col justify-between space-y-8 py-2">
          <div className="space-y-5">
            <div className="text-xs font-medium text-[var(--text-secondary)]">
              Automated Web Testing Platform · Playwright, Cypress &amp; Selenium
            </div>

            <h1
              className="font-display font-bold text-[clamp(2.25rem,4.4vw,3.75rem)] leading-[1.06] tracking-tight text-[var(--text-main)]"
              style={{ textWrap: 'balance' }}
            >
              Crawl any web application and export complete test suites
            </h1>

            <p className="text-base sm:text-lg leading-relaxed text-[var(--text-secondary)] max-w-2xl">
              Discover routes automatically, classify interface patterns, and generate structured Page Object Models with resilient locators—ready to run across desktop and mobile CI pipelines.
            </p>
          </div>

          {/* Quick-Launch Target Bar */}
          <div className="space-y-4">
            <div className="p-2 rounded-xl surface-panel flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="relative flex-1 flex items-center">
                <Globe
                  className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 pointer-events-none"
                  aria-hidden="true"
                />
                <label htmlFor="hero-target-url" className="sr-only">
                  Target application URL
                </label>
                <input
                  id="hero-target-url"
                  type="url"
                  value={url}
                  onChange={(e) => onUrlChange(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full h-11 pl-10 pr-3 rounded-lg bg-transparent font-mono text-sm text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
                />
              </div>

              <button
                type="button"
                onClick={onStartCrawl}
                disabled={!url.trim()}
                className="h-11 px-6 rounded-lg font-display font-semibold text-sm inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 transition-transform duration-150 active:scale-[0.98] disabled:opacity-40"
                style={{
                  backgroundColor: 'var(--accent-primary)',
                  color: 'var(--accent-contrast)',
                }}
              >
                <span>Start Crawl</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-sm">
              <button
                type="button"
                onClick={() => onNavigate('demos')}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium surface-panel hover:bg-[var(--surface-hover)] text-[var(--text-main)] transition-colors min-h-[42px]"
              >
                <PlaySquare className="w-4 h-4 text-[var(--accent-primary)]" />
                <span>Explore Interactive Product Demos</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('crawler')}
                className="text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-main)] transition-colors py-2"
              >
                Open Advanced Crawler Studio →
              </button>
            </div>
          </div>
        </div>

        {/* Right Architectural Visual Viewport */}
        <div className="lg:col-span-5 flex">
          <div className="relative w-full min-h-[320px] lg:min-h-[420px] rounded-2xl overflow-hidden surface-panel flex flex-col justify-end">
            {!imageError ? (
              <img
                src={MEDIA_ASSETS.heroBackdrop}
                alt="Layered architectural glass planes illustrating automated route discovery and test generation"
                referrerPolicy="no-referrer"
                onError={() => setImageError(true)}
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div
                className="absolute inset-0"
                style={{
                  background:
                    'radial-gradient(circle at 30% 25%, var(--accent-soft), transparent 60%), linear-gradient(135deg, var(--surface-panel), var(--surface-elevated))',
                }}
              />
            )}

            <div
              className="absolute inset-0"
              style={{
                background:
                  'linear-gradient(to top, rgba(8, 9, 12, 0.92) 8%, rgba(8, 9, 12, 0.48) 55%, rgba(8, 9, 12, 0.15) 100%)',
              }}
            />

            <div className="relative z-10 p-6 space-y-4">
              <div className="text-xs font-medium text-neutral-300">
                Pipeline Preview · Automated Page Object Synthesis
              </div>
              <div className="rounded-xl bg-black/55 backdrop-blur-md border border-white/10 p-4 space-y-2.5 font-mono text-xs text-neutral-200">
                <div className="flex items-center justify-between text-neutral-400">
                  <span>/checkout/summary</span>
                  <span>Product · 18 elements</span>
                </div>
                <div className="flex items-center justify-between text-neutral-400">
                  <span>/account/login</span>
                  <span>Login · 9 elements</span>
                </div>
                <div className="flex items-center justify-between text-white font-medium">
                  <span>tests/checkout.spec.ts</span>
                  <span style={{ color: '#4ade80' }}>Playwright TS ready</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4-Column Capability Strip */}
      <section aria-label="Platform capabilities" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {CAPABILITIES.map((cap) => {
          const Icon = cap.icon;
          return (
            <div key={cap.title} className="surface-panel rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <Icon
                  className="w-5 h-5 text-[var(--accent-primary)]"
                  aria-hidden="true"
                />
                <span className="font-mono text-xs text-[var(--text-muted)] tabular-nums">
                  {cap.metric}
                </span>
              </div>
              <h2 className="font-display font-semibold text-base text-[var(--text-main)]">
                {cap.title}
              </h2>
              <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
                {cap.description}
              </p>
            </div>
          );
        })}
      </section>

      {/* Interactive Product Demos Spotlight */}
      <section aria-labelledby="overview-demos-heading" className="space-y-6 pt-2 border-t">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-6">
          <div>
            <h2
              id="overview-demos-heading"
              className="font-display font-bold text-2xl text-[var(--text-main)]"
            >
              Interactive Product Demos
            </h2>
            <p className="text-sm text-[var(--text-secondary)] mt-1 max-w-2xl">
              Explore 10 working product demonstrations covering live telemetry dashboards, theme customization, responsive mobile and desktop layouts, and end-to-end crawler workflows.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('demos')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold surface-panel hover:bg-[var(--surface-hover)] text-[var(--text-main)] transition-colors whitespace-nowrap shrink-0 min-h-[42px]"
          >
            <span>Open Demo Center (10)</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {FEATURED_DEMOS.map((demo) => {
            const Icon = demo.icon;
            return (
              <div
                key={demo.id}
                className="interactive-card rounded-xl p-5 flex flex-col justify-between gap-5"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                    <span>{demo.category}</span>
                    <Icon className="w-4 h-4 text-[var(--accent-primary)]" aria-hidden="true" />
                  </div>
                  <h3 className="font-display font-semibold text-base text-[var(--text-main)]">
                    {demo.title}
                  </h3>
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                    {demo.summary}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => onOpenDemo(demo.id)}
                  className="w-full py-2.5 px-4 rounded-lg text-sm font-medium surface-elevated hover:bg-[var(--accent-soft)] text-[var(--text-main)] transition-colors inline-flex items-center justify-center gap-2 min-h-[40px]"
                >
                  <span>Launch Live Preview</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
