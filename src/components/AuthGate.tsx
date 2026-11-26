import { useState } from 'react';
import {
  ArrowRight,
  ShieldCheck,
  Globe,
  Code2,
  Play,
  Sun,
  Moon,
  Menu,
  X,
  CheckCircle2,
  Mail,
  Send,
  Layers,
  Smartphone,
} from 'lucide-react';
import { loginApi, registerApi } from '@/lib/api';
import { MEDIA_ASSETS } from '@/lib/mediaAssets';
import type { ThemeMode, UserProfile } from '@/types';

interface AuthGateProps {
  onAuthenticated: (user: UserProfile, token: string) => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
}

type DemoStackId = 'cypress-ts' | 'selenium-java' | 'selenium-python' | 'cypress-js';

const DEMO_SNIPPETS: Record<
  DemoStackId,
  { label: string; file: string; approach: string; code: string }
> = {
  'cypress-ts': {
    label: 'Cypress TS',
    file: 'tests/homepage.cy.ts',
    approach: 'Page Object Model · TypeScript',
    code: `import { HomePage } from '../pages/HomePage';

describe('Homepage & Navigation Integrity', () => {
  const home = new HomePage();

  it('TC-001 renders primary landmarks cleanly across viewports', () => {
    home.visit();
    home.verifyPrimaryHeaderVisible();
    home.assertNoHorizontalOverflow();
  });
});`,
  },
  'selenium-java': {
    label: 'Selenium Java',
    file: 'src/test/java/tests/HomeTest.java',
    approach: 'TestNG · Maven · Page Object Model',
    code: `package tests;

import org.testng.Assert;
import org.testng.annotations.Test;
import pages.HomePage;

public class HomeTest extends BaseTest {
    @Test(description = "TC-001 Verify homepage title and DOM landmarks")
    public void verifyHomepageLoads() {
        HomePage home = new HomePage(driver);
        home.open();
        Assert.assertFalse(home.getTitle().isBlank());
    }
}`,
  },
  'selenium-python': {
    label: 'Selenium Python',
    file: 'tests/test_homepage.py',
    approach: 'Pytest · Explicit WebDriverWait · Fixtures',
    code: `import pytest
from pages.home_page import HomePage

def test_homepage_renders_cleanly(driver, base_url):
    home = HomePage(driver, base_url)
    home.open()
    assert home.is_body_visible()
    assert home.has_no_console_errors()`,
  },
  'cypress-js': {
    label: 'Cypress JS',
    file: 'tests/home.cy.js',
    approach: 'Mocha · Chai · Responsive Viewport Checks',
    code: `import HomePage from '../pages/HomePage';

describe('Responsive & Accessibility Suite', () => {
  it('verifies desktop 1440px and mobile 390px layout integrity', () => {
    const home = new HomePage();
    cy.viewport(390, 844);
    home.visit();
    home.assertViewportContained();
  });
});`,
  },
};

const NAV_LINKS = [
  { href: '#welcome', label: 'Platform' },
  { href: '#capabilities', label: 'Capabilities' },
  { href: '#interactive-demo', label: 'Interactive Demo' },
  { href: '#team', label: 'Team' },
  { href: '#contact', label: 'Contact' },
];

export function AuthGate({ onAuthenticated, theme, onToggleTheme }: AuthGateProps) {
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeDemo, setActiveDemo] = useState<DemoStackId>('cypress-ts');

  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [contactSent, setContactSent] = useState(false);

  const [heroImgErr, setHeroImgErr] = useState(false);
  const [capImgErr, setCapImgErr] = useState<Record<string, boolean>>({});
  const [teamImgErr, setTeamImgErr] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res =
        mode === 'register'
          ? await registerApi(name.trim(), email.trim(), password)
          : await loginApi(email.trim(), password);
      onAuthenticated(res.user, res.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactName.trim() || !contactEmail.trim() || !contactMessage.trim()) return;
    setContactSent(true);
    setContactName('');
    setContactEmail('');
    setContactMessage('');
  };

  const scrollToSection = (href: string) => {
    setMobileMenuOpen(false);
    const id = href.replace('#', '');
    const el = document.getElementById(id);
    el?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[var(--surface-canvas)] text-[var(--text-main)] flex flex-col">
      {/* Strict 3-Zone Responsive Header (56px mobile, 64px desktop) */}
      <header className="sticky top-0 z-50 h-14 lg:h-16 surface-glass border-b">
        <div className="h-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4 lg:gap-8">
          <a
            href="#welcome"
            onClick={(e) => {
              e.preventDefault();
              scrollToSection('#welcome');
            }}
            className="font-display font-bold text-base sm:text-lg tracking-tight whitespace-nowrap shrink-0 text-[var(--text-main)]"
          >
            Automator AI
          </a>

          <nav aria-label="Welcome navigation" className="hidden lg:flex items-center gap-6">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={(e) => {
                  e.preventDefault();
                  scrollToSection(link.href);
                }}
                className="text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-main)] transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 border-transparent hover:border-[var(--accent-primary)]"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={theme === 'daylight' ? 'Switch to dark mode' : 'Switch to light mode'}
              className="inline-flex items-center justify-center gap-2 px-3 rounded-lg text-xs font-medium surface-elevated hover:bg-[var(--surface-hover)] whitespace-nowrap shrink-0 min-h-[44px] min-w-[44px]"
            >
              {theme === 'daylight' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
              <span className="hidden sm:inline">
                {theme === 'daylight' ? 'Dark Mode' : 'Light Mode'}
              </span>
            </button>

            <a
              href="#auth-panel"
              onClick={(e) => {
                e.preventDefault();
                scrollToSection('#auth-panel');
              }}
              className="hidden sm:inline-flex items-center gap-1.5 px-4 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 min-h-[44px]"
              style={{
                backgroundColor: 'var(--accent-primary)',
                color: 'var(--accent-contrast)',
              }}
            >
              <span>Launch Workspace</span>
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </a>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileMenuOpen}
              className="lg:hidden inline-flex items-center justify-center w-11 h-11 rounded-lg surface-elevated text-[var(--text-main)]"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile & Tablet Slide-Out Menu */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Mobile navigation"
        >
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="fixed top-14 left-0 right-0 surface-panel border-b p-4 space-y-1.5 max-h-[82dvh] overflow-y-auto shadow-2xl">
            {NAV_LINKS.map((link) => (
              <button
                key={link.href}
                type="button"
                onClick={() => scrollToSection(link.href)}
                className="w-full text-left px-4 py-3 rounded-xl text-sm font-medium text-[var(--text-main)] hover:bg-[var(--surface-hover)] min-h-[44px] flex items-center justify-between"
              >
                <span>{link.label}</span>
                <ArrowRight className="w-4 h-4 text-[var(--text-muted)]" />
              </button>
            ))}
            <div className="pt-2 border-t">
              <button
                type="button"
                onClick={() => scrollToSection('#auth-panel')}
                className="w-full min-h-[46px] rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
                style={{
                  backgroundColor: 'var(--accent-primary)',
                  color: 'var(--accent-contrast)',
                }}
              >
                <span>Sign In or Create Account</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 w-full">
        {/* Section 1: Redesigned Welcome & Auth Workspace Gate */}
        <section
          id="welcome"
          className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 lg:py-14 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-stretch"
        >
          <div className="lg:col-span-7 flex flex-col justify-between gap-6 min-w-0">
            <div className="space-y-3 sm:space-y-4">
              <div className="text-xs font-medium text-[var(--text-secondary)]">
                Website Automation Platform · Java · JavaScript · TypeScript · Python
              </div>
              <h1
                className="font-display font-bold text-[clamp(1.75rem,4.5vw,3.25rem)] leading-[1.1] tracking-tight"
                style={{ textWrap: 'balance' }}
              >
                Analyze any website and generate executable Selenium &amp; Cypress suites
              </h1>
              <p className="text-sm sm:text-base text-[var(--text-secondary)] max-w-2xl leading-relaxed">
                Inspect live DOM trees across mobile and desktop viewports, generate multi-category test cases, edit Page Object projects in a multi-tab studio, run tests in isolated Chromium contexts, and export audit reports.
              </p>
            </div>

            <div className="relative rounded-2xl overflow-hidden surface-panel aspect-[16/9] min-h-[210px] w-full">
              {!heroImgErr ? (
                <img
                  src={MEDIA_ASSETS.heroResponsiveAutomation}
                  alt="Automator AI cross-device test execution command center"
                  referrerPolicy="no-referrer"
                  loading="eager"
                  onError={() => setHeroImgErr(true)}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <div
                  className="absolute inset-0 flex items-center justify-center p-6"
                  style={{
                    background:
                      'radial-gradient(circle at 25% 25%, var(--accent-soft), transparent 60%), linear-gradient(135deg, var(--surface-panel), var(--surface-elevated))',
                  }}
                >
                  <Layers className="w-12 h-12 text-[var(--accent-primary)] opacity-70" />
                </div>
              )}
              <div
                className="absolute inset-0"
                style={{
                  background:
                    'linear-gradient(to top, rgba(8,9,12,0.9) 8%, rgba(8,9,12,0.3) 55%, rgba(8,9,12,0.08) 100%)',
                }}
              />
              <div className="relative z-10 h-full flex flex-col justify-end p-4 sm:p-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3 text-xs text-neutral-200">
                  <div className="rounded-xl bg-black/60 backdrop-blur-md border border-white/10 p-3 space-y-1">
                    <Globe className="w-4 h-4 text-amber-400" aria-hidden="true" />
                    <div className="font-semibold text-white">Live DOM Inspection</div>
                    <div className="text-neutral-300">Headless Chromium crawling</div>
                  </div>
                  <div className="rounded-xl bg-black/60 backdrop-blur-md border border-white/10 p-3 space-y-1">
                    <Code2 className="w-4 h-4 text-teal-400" aria-hidden="true" />
                    <div className="font-semibold text-white">7 Complete Stacks</div>
                    <div className="text-neutral-300">Java, JS, TS &amp; Python POMs</div>
                  </div>
                  <div className="rounded-xl bg-black/60 backdrop-blur-md border border-white/10 p-3 space-y-1">
                    <Play className="w-4 h-4 text-emerald-400" aria-hidden="true" />
                    <div className="font-semibold text-white">Isolated Runner</div>
                    <div className="text-neutral-300">Real screenshots &amp; PDF reports</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Auth Card */}
          <div id="auth-panel" className="lg:col-span-5 flex flex-col justify-center min-w-0">
            <div className="surface-panel rounded-2xl p-5 sm:p-7 space-y-5">
              <div className="flex items-center gap-1 p-1 rounded-xl surface-elevated">
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setError(null);
                  }}
                  className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-semibold transition-colors min-h-[44px] ${
                    mode === 'register'
                      ? 'bg-[var(--surface-panel)] text-[var(--text-main)] shadow-xs'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-main)]'
                  }`}
                >
                  Create Account
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError(null);
                  }}
                  className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-semibold transition-colors min-h-[44px] ${
                    mode === 'login'
                      ? 'bg-[var(--surface-panel)] text-[var(--text-main)] shadow-xs'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-main)]'
                  }`}
                >
                  Sign In
                </button>
              </div>

              <div>
                <h2 className="font-display font-bold text-xl">
                  {mode === 'register' ? 'Start Your QA Workspace' : 'Sign In to Workspace'}
                </h2>
                <p className="text-sm text-[var(--text-secondary)] mt-1">
                  {mode === 'register'
                    ? 'Create an engineer account to save automation projects, encrypted credentials, and test reports.'
                    : 'Access your saved Selenium & Cypress projects and execution history.'}
                </p>
              </div>

              {error && (
                <div
                  role="alert"
                  className="rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-500"
                >
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === 'register' && (
                  <div className="space-y-1.5">
                    <label
                      htmlFor="auth-name"
                      className="text-xs font-medium text-[var(--text-secondary)]"
                    >
                      Full Name
                    </label>
                    <input
                      id="auth-name"
                      type="text"
                      required
                      minLength={2}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Alex Rivera"
                      className="w-full min-h-[44px] px-3.5 rounded-xl surface-elevated text-sm text-[var(--text-main)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <label
                    htmlFor="auth-email"
                    className="text-xs font-medium text-[var(--text-secondary)]"
                  >
                    Work Email
                  </label>
                  <input
                    id="auth-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="qa@company.com"
                    className="w-full min-h-[44px] px-3.5 rounded-xl surface-elevated text-sm text-[var(--text-main)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="auth-password"
                    className="text-xs font-medium text-[var(--text-secondary)]"
                  >
                    Password
                  </label>
                  <input
                    id="auth-password"
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    className="w-full min-h-[44px] px-3.5 rounded-xl surface-elevated text-sm text-[var(--text-main)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full min-h-[48px] px-4 rounded-xl font-display font-semibold text-sm inline-flex items-center justify-center gap-2 transition-opacity disabled:opacity-50"
                  style={{
                    backgroundColor: 'var(--accent-primary)',
                    color: 'var(--accent-contrast)',
                  }}
                >
                  <span>
                    {loading
                      ? 'Authenticating...'
                      : mode === 'register'
                        ? 'Create Workspace Account'
                        : 'Sign In'}
                  </span>
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </button>
              </form>

              <div className="pt-4 border-t flex items-start gap-2.5 text-xs text-[var(--text-secondary)]">
                <ShieldCheck className="w-4 h-4 text-[var(--accent-secondary)] shrink-0 mt-0.5" />
                <span>
                  Session tokens stay strictly in memory, passwords are hashed on the server, and all browser inspections enforce network isolation.
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: Capabilities & Services Showcase */}
        <section
          id="capabilities"
          className="border-t bg-[var(--surface-panel)]/40 py-12 sm:py-16"
        >
          <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
            <div className="max-w-2xl space-y-2">
              <div className="text-xs font-medium text-[var(--text-muted)]">
                Platform Capabilities · End-to-End QA Engineering
              </div>
              <h2 className="font-display font-bold text-2xl sm:text-3xl tracking-tight">
                Built for desktop, tablet, and smartphone test coverage
              </h2>
              <p className="text-sm text-[var(--text-secondary)]">
                Every generated automation project maps real DOM structures, validates accessibility landmarks, and verifies layout stability across screen sizes.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  key: 'dom',
                  img: MEDIA_ASSETS.featureDomInspector,
                  alt: 'Isometric DOM tree inspection visualization',
                  kicker: '01 · Website Analyzer',
                  title: 'Live DOM & Responsive Auditor',
                  desc: 'Crawls public routes via headless Chromium, detects forms, buttons, menus, tables, broken links, and checks 1440px and 390px overflow.',
                },
                {
                  key: 'ide',
                  img: MEDIA_ASSETS.featureIdeWorkspace,
                  alt: 'Laptop and smartphone displaying generated Page Object automation code',
                  kicker: '02 · Script Studio',
                  title: 'Multi-Language Project Generator',
                  desc: 'Generates Maven Java (TestNG/JUnit), Cypress JS/TS, Selenium JS/TS, and Python Pytest repositories with Page Objects and syntax diagnostics.',
                },
                {
                  key: 'exec',
                  img: MEDIA_ASSETS.featureCloudExecution,
                  alt: 'Parallel isolated browser execution containers and analytics',
                  kicker: '03 · Execution & Reports',
                  title: 'Isolated Runner & Audit Exports',
                  desc: 'Executes suites in sandboxed browser contexts, captures failure screenshots, streams live logs, and exports PDF, HTML, and JSON reports.',
                },
              ].map((card) => (
                <article
                  key={card.key}
                  className="interactive-card rounded-2xl overflow-hidden flex flex-col"
                >
                  <div className="relative aspect-[4/3] w-full bg-[var(--surface-elevated)] overflow-hidden">
                    {!capImgErr[card.key] ? (
                      <img
                        src={card.img}
                        alt={card.alt}
                        referrerPolicy="no-referrer"
                        loading="lazy"
                        onError={() => setCapImgErr((p) => ({ ...p, [card.key]: true }))}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[var(--accent-primary)]">
                        <Code2 className="w-10 h-10 opacity-60" />
                      </div>
                    )}
                  </div>
                  <div className="p-5 sm:p-6 space-y-2 flex-1">
                    <div className="text-xs font-mono text-[var(--text-muted)]">{card.kicker}</div>
                    <h3 className="font-display font-bold text-lg text-[var(--text-main)]">
                      {card.title}
                    </h3>
                    <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                      {card.desc}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Section 3: Interactive Product Demo Switcher (Touch & Desktop Friendly) */}
        <section id="interactive-demo" className="py-12 sm:py-16 border-t">
          <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div className="space-y-2 max-w-2xl">
                <div className="text-xs font-medium text-[var(--text-muted)]">
                  Interactive Output Preview · Multi-Stack Code Generation
                </div>
                <h2 className="font-display font-bold text-2xl sm:text-3xl tracking-tight">
                  Switch target stacks with one tap
                </h2>
              </div>

              <div
                className="flex items-center gap-1.5 p-1.5 rounded-xl surface-elevated overflow-x-auto no-scrollbar max-w-full"
                role="tablist"
                aria-label="Preview automation stack"
              >
                {(Object.keys(DEMO_SNIPPETS) as DemoStackId[]).map((id) => {
                  const active = activeDemo === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setActiveDemo(id)}
                      className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 min-h-[40px] transition-colors ${
                        active
                          ? 'bg-[var(--surface-panel)] text-[var(--text-main)] shadow-xs'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-main)]'
                      }`}
                    >
                      {DEMO_SNIPPETS[id].label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="surface-panel rounded-2xl overflow-hidden">
              <div className="px-4 sm:px-5 py-3 border-b bg-[var(--surface-elevated)] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <span className="font-mono font-semibold text-[var(--accent-primary)] truncate">
                  {DEMO_SNIPPETS[activeDemo].file}
                </span>
                <span className="text-[var(--text-muted)]">
                  {DEMO_SNIPPETS[activeDemo].approach}
                </span>
              </div>
              <pre className="p-4 sm:p-6 bg-[var(--surface-canvas)] font-mono text-xs sm:text-[13px] leading-relaxed overflow-x-auto text-[var(--text-main)]">
                <code>{DEMO_SNIPPETS[activeDemo].code}</code>
              </pre>
            </div>
          </div>
        </section>

        {/* Section 4: About & Engineering Team (Preserving Original Team Portrait) */}
        <section id="team" className="border-t bg-[var(--surface-panel)]/40 py-12 sm:py-16">
          <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7 space-y-4">
              <div className="text-xs font-medium text-[var(--text-muted)]">
                About &amp; QA Engineering Leadership
              </div>
              <h2 className="font-display font-bold text-2xl sm:text-3xl tracking-tight">
                Engineered for international software quality teams
              </h2>
              <p className="text-sm sm:text-base text-[var(--text-secondary)] leading-relaxed">
                Automator AI brings together browser engineering, structured test design, and isolated runtime safety so engineering organizations can turn live web routes into maintainable test suites in minutes rather than days.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 text-xs">
                <div className="surface-panel rounded-xl p-4 space-y-1">
                  <Smartphone className="w-4 h-4 text-[var(--accent-primary)]" />
                  <div className="font-semibold">320px to 1920px+</div>
                  <div className="text-[var(--text-secondary)]">
                    Built-in desktop and smartphone layout audits
                  </div>
                </div>
                <div className="surface-panel rounded-xl p-4 space-y-1">
                  <CheckCircle2 className="w-4 h-4 text-[var(--status-success)]" />
                  <div className="font-semibold">16 Test Categories</div>
                  <div className="text-[var(--text-secondary)]">
                    Positive, negative, boundary &amp; a11y scenarios
                  </div>
                </div>
                <div className="surface-panel rounded-xl p-4 space-y-1">
                  <ShieldCheck className="w-4 h-4 text-[var(--accent-secondary)]" />
                  <div className="font-semibold">Encrypted Vault</div>
                  <div className="text-[var(--text-secondary)]">
                    Protected credentials omitted from exports
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="surface-panel rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row lg:flex-col xl:flex-row items-center gap-5">
                <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl overflow-hidden shrink-0 surface-elevated">
                  {!teamImgErr ? (
                    <img
                      src={MEDIA_ASSETS.avatarQaEngineer}
                      alt="Principal QA Automation Architect"
                      referrerPolicy="no-referrer"
                      loading="lazy"
                      onError={() => setTeamImgErr(true)}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center font-display font-bold text-xl">
                      QA
                    </div>
                  )}
                </div>
                <div className="space-y-2 text-center sm:text-left lg:text-center xl:text-left">
                  <div className="text-xs font-medium text-[var(--text-muted)]">
                    Principal Automation Architect
                  </div>
                  <h3 className="font-display font-bold text-lg">QA Engineering Systems</h3>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    Dedicated to resilient Page Object patterns, deterministic explicit waits, and zero-leak credential handling across enterprise CI pipelines.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 5: Contact & Support */}
        <section id="contact" className="border-t py-12 sm:py-16">
          <div className="max-w-[960px] mx-auto px-4 sm:px-6 lg:px-8">
            <div className="surface-panel rounded-2xl p-5 sm:p-8 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="font-display font-bold text-xl sm:text-2xl">
                    Enterprise Inquiries &amp; QA Support
                  </h2>
                  <p className="text-sm text-[var(--text-secondary)] mt-1">
                    Need custom CI/CD runner guidance or multi-team workspace onboarding? Reach out below.
                  </p>
                </div>
                <div className="inline-flex items-center gap-2 text-xs text-[var(--text-muted)] shrink-0">
                  <Mail className="w-4 h-4 text-[var(--accent-primary)]" />
                  <span>qa-support@automator.ai</span>
                </div>
              </div>

              {contactSent ? (
                <div className="rounded-xl surface-elevated p-5 flex items-center justify-between gap-4 text-sm">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-[var(--status-success)] shrink-0" />
                    <span>
                      Inquiry recorded. Sign in above to open your automation workspace immediately.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setContactSent(false)}
                    className="px-3 py-2 rounded-lg text-xs surface-panel min-h-[40px] shrink-0"
                  >
                    New Message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleContactSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label htmlFor="contact-name" className="text-xs font-medium text-[var(--text-secondary)]">
                        Your Name
                      </label>
                      <input
                        id="contact-name"
                        type="text"
                        required
                        value={contactName}
                        onChange={(e) => setContactName(e.target.value)}
                        placeholder="Jordan Taylor"
                        className="w-full min-h-[44px] px-3.5 rounded-xl surface-elevated text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="contact-email" className="text-xs font-medium text-[var(--text-secondary)]">
                        Email Address
                      </label>
                      <input
                        id="contact-email"
                        type="email"
                        required
                        value={contactEmail}
                        onChange={(e) => setContactEmail(e.target.value)}
                        placeholder="jordan@organization.com"
                        className="w-full min-h-[44px] px-3.5 rounded-xl surface-elevated text-sm"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="contact-msg" className="text-xs font-medium text-[var(--text-secondary)]">
                      Message
                    </label>
                    <textarea
                      id="contact-msg"
                      required
                      rows={3}
                      value={contactMessage}
                      onChange={(e) => setContactMessage(e.target.value)}
                      placeholder="Tell us about your target web application and preferred Selenium/Cypress stack..."
                      className="w-full p-3.5 rounded-xl surface-elevated text-sm resize-y"
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="w-full sm:w-auto min-h-[44px] px-6 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2"
                      style={{
                        backgroundColor: 'var(--accent-primary)',
                        color: 'var(--accent-contrast)',
                      }}
                    >
                      <Send className="w-4 h-4" />
                      <span>Send Message</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* Responsive Welcome Footer */}
      <footer className="border-t bg-[var(--surface-panel)] py-8 px-4 sm:px-6 lg:px-8 text-xs text-[var(--text-secondary)]">
        <div className="max-w-[1360px] mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pb-6 border-b">
          <div className="space-y-2">
            <div className="font-display font-bold text-base text-[var(--text-main)]">
              Automator AI
            </div>
            <p className="text-[var(--text-muted)] leading-relaxed">
              Intelligent Website Analyzer, Test Case Generator, and Selenium/Cypress Automation Studio.
            </p>
          </div>
          <div className="space-y-2">
            <div className="font-semibold text-[var(--text-main)]">Platform</div>
            <div className="flex flex-col gap-1.5">
              {NAV_LINKS.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={(e) => {
                    e.preventDefault();
                    scrollToSection(l.href);
                  }}
                  className="hover:text-[var(--text-main)] py-0.5"
                >
                  {l.label}
                </a>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <div className="font-semibold text-[var(--text-main)]">Supported Stacks</div>
            <div className="text-[var(--text-muted)] space-y-1">
              <div>Java Selenium (TestNG &amp; JUnit)</div>
              <div>Cypress (TypeScript &amp; JavaScript)</div>
              <div>Selenium (TypeScript, JS &amp; Python)</div>
            </div>
          </div>
          <div className="space-y-2">
            <div className="font-semibold text-[var(--text-main)]">Workspace Access</div>
            <button
              type="button"
              onClick={() => scrollToSection('#auth-panel')}
              className="px-4 py-2.5 rounded-lg font-semibold min-h-[44px]"
              style={{
                backgroundColor: 'var(--accent-primary)',
                color: 'var(--accent-contrast)',
              }}
            >
              Open Automation Studio
            </button>
          </div>
        </div>
        <div className="max-w-[1360px] mx-auto pt-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-[var(--text-muted)]">
          <span>© {new Date().getFullYear()} Automator AI. All rights reserved.</span>
          <span>Responsive QA Engineering Suite · 320px–1920px+</span>
        </div>
      </footer>
    </div>
  );
}
