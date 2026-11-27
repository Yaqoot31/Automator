import { useState } from 'react';
import {
  ArrowRight,
  ShieldCheck,
  Globe,
  Code2,
  Sun,
  Moon,
  Menu,
  X,
  CheckCircle2,
  Mail,
  Send,
  Layers,
  Smartphone,
  Eye,
  EyeOff,
  ClipboardCheck,
  BarChart3,
  KeyRound,
  FileSpreadsheet,
} from 'lucide-react';
import { signInWithPopup } from 'firebase/auth';
import {
  firebaseGoogleLoginApi,
  forgotPasswordApi,
  loginApi,
  registerApi,
  resetPasswordApi,
  verifyEmailApi,
} from '@/lib/api';
import {
  auth,
  formatFirebaseAuthError,
  googleAuthProvider,
  isUnauthorizedDomainError,
} from '@/lib/firebase';
import { MEDIA_ASSETS } from '@/lib/mediaAssets';
import { BrandMark } from '@/components/BrandMark';
import { UnauthorizedDomainNotice } from '@/components/UnauthorizedDomainNotice';
import type { ThemeMode, UserProfile, UserRole } from '@/types';

interface AuthGateProps {
  onAuthenticated: (user: UserProfile, token: string) => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
}

type AuthMode = 'register' | 'login' | 'verify-email' | 'forgot-password' | 'reset-password';
type DemoStackId =
  | 'playwright-ts'
  | 'playwright-python'
  | 'cypress-ts'
  | 'selenium-java'
  | 'selenium-python'
  | 'cypress-js';

const DEMO_SNIPPETS: Record<
  DemoStackId,
  { label: string; file: string; approach: string; code: string }
> = {
  'playwright-ts': {
    label: 'Playwright TS',
    file: 'tests/homepage.spec.ts',
    approach: 'Playwright · TypeScript · Auto-Wait Locators',
    code: `import { test, expect } from '@playwright/test';
import { HomePage } from '../pages/HomePage';

test('TC-001 renders landmarks cleanly across desktop and mobile', async ({ page }) => {
  const home = new HomePage(page);
  await home.open();
  await expect(home.primaryLandmark).toBeVisible();
  await home.assertNoHorizontalOverflow();
});`,
  },
  'playwright-python': {
    label: 'Playwright Python',
    file: 'tests/test_homepage.py',
    approach: 'Playwright Sync · Pytest · Fixtures',
    code: `from playwright.sync_api import Page, expect
from pages.home_page import HomePage

def test_homepage_renders_cleanly(page: Page, base_url: str):
    home = HomePage(page, base_url)
    home.open()
    expect(page.locator("body")).to_be_visible()
    assert home.horizontal_overflow_px() <= 2`,
  },
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
  { href: '#interactive-demo', label: 'Script Demo' },
  { href: '#team', label: 'Architecture' },
  { href: '#contact', label: 'Contact' },
];

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'sqa_engineer', label: 'SQA Engineer' },
  { value: 'qa_lead', label: 'QA Lead' },
  { value: 'project_manager', label: 'Project Manager' },
  { value: 'developer', label: 'Software Developer' },
  { value: 'admin', label: 'Workspace Admin' },
  { value: 'viewer', label: 'Stakeholder / Viewer' },
];

export function AuthGate({ onAuthenticated, theme, onToggleTheme }: AuthGateProps) {
  const [mode, setMode] = useState<AuthMode>('register');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('sqa_engineer');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [unauthorizedDomain, setUnauthorizedDomain] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Verification / Password reset state
  const [pendingAuth, setPendingAuth] = useState<{ user: UserProfile; token: string } | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [previewVerificationCode, setPreviewVerificationCode] = useState<string | null>(null);
  const [resetCode, setResetCode] = useState('');
  const [previewResetCode, setPreviewResetCode] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeDemo, setActiveDemo] = useState<DemoStackId>('playwright-ts');

  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [contactSent, setContactSent] = useState(false);

  const [heroImgErr, setHeroImgErr] = useState(false);
  const [capImgErr, setCapImgErr] = useState<Record<string, boolean>>({});
  const [teamImgErr, setTeamImgErr] = useState(false);

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setError(null);
    setUnauthorizedDomain(false);
    setNotice(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setUnauthorizedDomain(false);
    setNotice(null);

    if (mode === 'register') {
      if (password !== confirmPassword) {
        setError('Password and confirmation password do not match.');
        return;
      }
      if (!termsAccepted) {
        setError('Please accept the Terms & Conditions to create your account.');
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === 'register') {
        const res = await registerApi({
          name: name.trim(),
          email: email.trim(),
          password,
          confirmPassword,
          termsAccepted,
          role,
        });
        if (res.verificationRequired) {
          setPendingAuth({ user: res.user, token: res.token });
          setPreviewVerificationCode(res.verificationPreviewCode || null);
          setVerificationCode(res.verificationPreviewCode || '');
          setNotice('Account created. Enter the verification code below to verify your email address.');
          setMode('verify-email');
        } else {
          onAuthenticated(res.user, res.token);
        }
      } else if (mode === 'login') {
        const res = await loginApi(email.trim(), password, rememberMe);
        onAuthenticated(res.user, res.token);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const targetEmail = pendingAuth?.user.email || email.trim();
      const res = await verifyEmailApi(targetEmail, verificationCode.trim());
      if (pendingAuth) {
        onAuthenticated(res.user, pendingAuth.token);
      } else {
        setNotice('Email verified successfully. You can now sign in.');
        setMode('login');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Email verification failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      const res = await forgotPasswordApi(email.trim());
      setPreviewResetCode(res.resetPreviewCode || null);
      if (res.resetPreviewCode) {
        setResetCode(res.resetPreviewCode);
      }
      setNotice(res.message);
      setMode('reset-password');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send reset code.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirmNewPassword) {
      setError('New password and confirmation do not match.');
      return;
    }
    setLoading(true);
    try {
      await resetPasswordApi(email.trim(), resetCode.trim(), newPassword);
      setNotice('Password updated successfully. Sign in with your new credentials.');
      setPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setResetCode('');
      setPreviewResetCode(null);
      setMode('login');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Password reset failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setUnauthorizedDomain(false);
    setNotice(null);
    setGoogleLoading(true);
    try {
      const result = await signInWithPopup(auth, googleAuthProvider);
      const idToken = await result.user.getIdToken();
      const res = await firebaseGoogleLoginApi(idToken);
      onAuthenticated(res.user, res.token);
    } catch (err) {
      if (isUnauthorizedDomainError(err)) {
        setUnauthorizedDomain(true);
      } else {
        setError(formatFirebaseAuthError(err));
      }
    } finally {
      setGoogleLoading(false);
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
    <div className="min-h-screen text-[var(--text-main)] flex flex-col">
      {/* Strict 3-Zone Responsive Header */}
      <header className="sticky top-0 z-50 h-14 lg:h-16 surface-glass border-b">
        <div className="h-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4 lg:gap-8">
          <a
            href="#welcome"
            onClick={(e) => {
              e.preventDefault();
              scrollToSection('#welcome');
            }}
            className="inline-flex items-center gap-2.5 font-display font-bold text-base sm:text-lg tracking-tight whitespace-nowrap shrink-0 text-[var(--text-main)]"
          >
            <BrandMark size={28} />
            <span>Automator AI</span>
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
                {theme === 'daylight' ? 'Dark' : 'Light'}
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

      {/* Mobile & Tablet App-Style Slide-Out Menu */}
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
                <span>Sign In or Register</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 w-full">
        {/* Hero Split + Personal Email Authentication Panel */}
        <section
          id="welcome"
          className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 lg:py-14 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-stretch"
        >
          <div className="lg:col-span-7 flex flex-col justify-between gap-6 min-w-0">
            <div className="space-y-3 sm:space-y-4">
              <div className="text-xs font-medium text-[var(--text-secondary)]">
                Next-Generation QA Platform · Playwright · Cypress · Selenium · SQA · Analytics
              </div>
              <h1
                className="font-display font-bold text-[clamp(1.75rem,4.3vw,3.25rem)] leading-[1.08] tracking-tight"
                style={{ textWrap: 'balance' }}
              >
                Autonomous web testing, SQA governance, and live analytics in one studio
              </h1>
              <p className="text-sm sm:text-base text-[var(--text-secondary)] max-w-2xl leading-relaxed">
                Analyze public websites, synthesize multi-language automation suites across Java, JavaScript, TypeScript, and Python, sync 14-column test cases directly to Google Sheets, manage defects and RTM traceability, and export audit reports.
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
                    'linear-gradient(to top, rgba(7,9,14,0.92) 8%, rgba(7,9,14,0.34) 55%, rgba(7,9,14,0.08) 100%)',
                }}
              />
              <div className="relative z-10 h-full flex flex-col justify-end p-4 sm:p-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3 text-xs text-neutral-200">
                  <div className="rounded-xl bg-black/65 backdrop-blur-md border border-white/10 p-3 space-y-1">
                    <Globe className="w-4 h-4 text-amber-400" aria-hidden="true" />
                    <div className="font-semibold text-white">Honest Site Crawl</div>
                    <div className="text-neutral-300">Discovered, tested &amp; skipped audit</div>
                  </div>
                  <div className="rounded-xl bg-black/65 backdrop-blur-md border border-white/10 p-3 space-y-1">
                    <Code2 className="w-4 h-4 text-teal-400" aria-hidden="true" />
                    <div className="font-semibold text-white">9 Target Stacks</div>
                    <div className="text-neutral-300">Playwright, Cypress &amp; Selenium</div>
                  </div>
                  <div className="rounded-xl bg-black/65 backdrop-blur-md border border-white/10 p-3 space-y-1">
                    <ClipboardCheck className="w-4 h-4 text-emerald-400" aria-hidden="true" />
                    <div className="font-semibold text-white">Full SQA Lifecycle</div>
                    <div className="text-neutral-300">Plans, bugs, RTM &amp; Google Sheets</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Auth Card */}
          <div id="auth-panel" className="lg:col-span-5 flex flex-col justify-center min-w-0">
            <div className="surface-panel rounded-2xl p-5 sm:p-7 space-y-5 shadow-[var(--shadow-elevated)]">
              {(mode === 'register' || mode === 'login') && (
                <div className="flex items-center gap-1 p-1 rounded-xl surface-elevated">
                  <button
                    type="button"
                    onClick={() => switchMode('register')}
                    className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-semibold transition-colors min-h-[44px] whitespace-nowrap ${
                      mode === 'register'
                        ? 'bg-[var(--surface-panel)] text-[var(--text-main)] shadow-xs'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-main)]'
                    }`}
                  >
                    Create Account
                  </button>
                  <button
                    type="button"
                    onClick={() => switchMode('login')}
                    className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-semibold transition-colors min-h-[44px] whitespace-nowrap ${
                      mode === 'login'
                        ? 'bg-[var(--surface-panel)] text-[var(--text-main)] shadow-xs'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-main)]'
                    }`}
                  >
                    Sign In
                  </button>
                </div>
              )}

              <div>
                <h2 className="font-display font-bold text-xl">
                  {mode === 'register'
                    ? 'Create Personal or Team Account'
                    : mode === 'login'
                      ? 'Sign In to Workspace'
                      : mode === 'verify-email'
                        ? 'Verify Your Email Address'
                        : mode === 'forgot-password'
                          ? 'Recover Account Access'
                          : 'Set a New Password'}
                </h2>
                <p className="text-sm text-[var(--text-secondary)] mt-1">
                  {mode === 'register'
                    ? 'Gmail, Outlook, Hotmail, and all personal or work email domains are supported.'
                    : mode === 'login'
                      ? 'Access your saved automation suites, SQA records, and analytics.'
                      : mode === 'verify-email'
                        ? 'Enter the 6-digit verification code issued for your account.'
                        : mode === 'forgot-password'
                          ? 'Request a one-time reset code to restore access to your account.'
                          : 'Enter your reset code and choose a new password (8+ characters).'}
                </p>
              </div>

              {unauthorizedDomain && <UnauthorizedDomainNotice contextLabel="Continue with Google" />}

              {error && (
                <div
                  role="alert"
                  className="rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-500"
                >
                  {error}
                </div>
              )}

              {notice && (
                <div
                  role="status"
                  className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-xs text-[var(--status-success)]"
                >
                  {notice}
                </div>
              )}

              {/* Register or Login Form */}
              {(mode === 'register' || mode === 'login') && (
                <form onSubmit={handleSubmit} className="space-y-3.5">
                  {mode === 'register' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                      <div className="space-y-1.5">
                        <label
                          htmlFor="auth-role"
                          className="text-xs font-medium text-[var(--text-secondary)]"
                        >
                          Workspace Role
                        </label>
                        <select
                          id="auth-role"
                          value={role}
                          onChange={(e) => setRole(e.target.value as UserRole)}
                          className="w-full min-h-[44px] px-3 rounded-xl surface-elevated text-sm text-[var(--text-main)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
                        >
                          {ROLE_OPTIONS.map((r) => (
                            <option key={r.value} value={r.value}>
                              {r.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label
                      htmlFor="auth-email"
                      className="text-xs font-medium text-[var(--text-secondary)]"
                    >
                      Email Address (Gmail, Outlook, Hotmail, or Work)
                    </label>
                    <input
                      id="auth-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@gmail.com"
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
                    <div className="relative">
                      <input
                        id="auth-password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        minLength={8}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Minimum 8 characters"
                        className="w-full min-h-[44px] pl-3.5 pr-11 rounded-xl surface-elevated text-sm text-[var(--text-main)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        className="absolute right-1 top-1/2 -translate-y-1/2 min-h-[38px] min-w-[38px] inline-flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-main)]"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {mode === 'register' && (
                    <>
                      <div className="space-y-1.5">
                        <label
                          htmlFor="auth-confirm-password"
                          className="text-xs font-medium text-[var(--text-secondary)]"
                        >
                          Confirm Password
                        </label>
                        <div className="relative">
                          <input
                            id="auth-confirm-password"
                            type={showConfirmPassword ? 'text' : 'password'}
                            required
                            minLength={8}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Re-enter password"
                            className="w-full min-h-[44px] pl-3.5 pr-11 rounded-xl surface-elevated text-sm text-[var(--text-main)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword((v) => !v)}
                            aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                            className="absolute right-1 top-1/2 -translate-y-1/2 min-h-[38px] min-w-[38px] inline-flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-main)]"
                          >
                            {showConfirmPassword ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      <label className="flex items-start gap-2.5 text-xs text-[var(--text-secondary)] cursor-pointer min-h-[40px] pt-1">
                        <input
                          type="checkbox"
                          checked={termsAccepted}
                          onChange={(e) => setTermsAccepted(e.target.checked)}
                          className="w-4 h-4 mt-0.5 rounded accent-[var(--accent-primary)] shrink-0"
                        />
                        <span>
                          I accept the Platform Terms &amp; Conditions and authorize secure server-side storage of my SQA workspace projects.
                        </span>
                      </label>
                    </>
                  )}

                  {mode === 'login' && (
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <label className="inline-flex items-center gap-2 cursor-pointer min-h-[40px] text-[var(--text-secondary)]">
                        <input
                          type="checkbox"
                          checked={rememberMe}
                          onChange={(e) => setRememberMe(e.target.checked)}
                          className="w-4 h-4 rounded accent-[var(--accent-primary)]"
                        />
                        <span>Remember me (30 days)</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => switchMode('forgot-password')}
                        className="font-medium text-[var(--accent-primary)] hover:underline min-h-[40px] whitespace-nowrap"
                      >
                        Forgot password?
                      </button>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading || googleLoading}
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
                          : 'Sign In to Workspace'}
                    </span>
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </button>

                  <div className="relative flex items-center py-1">
                    <div className="flex-grow border-t border-[var(--border-subtle)]" />
                    <span className="shrink mx-3 text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
                      or continue with
                    </span>
                    <div className="flex-grow border-t border-[var(--border-subtle)]" />
                  </div>

                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={loading || googleLoading}
                    className="w-full min-h-[46px] px-4 rounded-xl surface-elevated hover:bg-[var(--surface-hover)] border text-sm font-medium text-[var(--text-main)] inline-flex items-center justify-center gap-2.5 transition-colors disabled:opacity-50"
                  >
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        fill="#EA4335"
                        d="M12 10.2v3.9h5.4c-.2 1.3-1.5 3.8-5.4 3.8-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.3 14.6 2.4 12 2.4 6.7 2.4 2.4 6.7 2.4 12s4.3 9.6 9.6 9.6c5.5 0 9.2-3.9 9.2-9.4 0-.6-.1-1.1-.2-1.6H12z"
                      />
                      <path
                        fill="#34A853"
                        d="M3.5 7.4l3.2 2.3C7.6 7.9 9.6 6.6 12 6.6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.3 14.6 2.4 12 2.4 8.3 2.4 5.1 4.5 3.5 7.4z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M12 21.6c2.5 0 4.6-.8 6.2-2.3l-2.9-2.4c-.8.6-1.9 1-3.3 1-2.5 0-4.7-1.7-5.5-4l-3.2 2.5C5 19.4 8.2 21.6 12 21.6z"
                      />
                      <path
                        fill="#4285F4"
                        d="M21.2 12.2c0-.7-.1-1.3-.2-2H12v3.9h5.4c-.3 1.3-1 2.4-2.1 3.1l2.9 2.4c1.7-1.6 3-4 3-7.4z"
                      />
                    </svg>
                    <span>
                      {googleLoading ? 'Connecting Google & Firebase...' : 'Continue with Google'}
                    </span>
                  </button>
                </form>
              )}

              {/* Email Verification Form */}
              {mode === 'verify-email' && (
                <form onSubmit={handleVerifyEmail} className="space-y-4">
                  {previewVerificationCode && (
                    <div className="rounded-xl surface-elevated p-3.5 text-xs space-y-1">
                      <div className="font-semibold text-[var(--text-main)]">
                        Verification Code Issued
                      </div>
                      <div className="text-[var(--text-secondary)]">
                        Use code{' '}
                        <span className="font-mono font-bold text-[var(--accent-primary)]">
                          {previewVerificationCode}
                        </span>{' '}
                        to confirm {pendingAuth?.user.email || email}.
                      </div>
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="verify-code-input"
                      className="text-xs font-medium text-[var(--text-secondary)]"
                    >
                      6-Digit Verification Code
                    </label>
                    <input
                      id="verify-code-input"
                      type="text"
                      required
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value)}
                      placeholder="123456"
                      className="w-full min-h-[44px] px-3.5 rounded-xl surface-elevated font-mono text-sm text-[var(--text-main)]"
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 min-h-[46px] px-4 rounded-xl font-semibold text-xs inline-flex items-center justify-center gap-2"
                      style={{
                        backgroundColor: 'var(--accent-primary)',
                        color: 'var(--accent-contrast)',
                      }}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{loading ? 'Verifying...' : 'Verify & Open Workspace'}</span>
                    </button>
                    {pendingAuth && (
                      <button
                        type="button"
                        onClick={() => onAuthenticated(pendingAuth.user, pendingAuth.token)}
                        className="min-h-[46px] px-4 rounded-xl text-xs font-medium surface-elevated hover:bg-[var(--surface-hover)]"
                      >
                        Verify Later
                      </button>
                    )}
                  </div>
                </form>
              )}

              {/* Forgot Password Form */}
              {mode === 'forgot-password' && (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="forgot-email"
                      className="text-xs font-medium text-[var(--text-secondary)]"
                    >
                      Registered Email Address
                    </label>
                    <input
                      id="forgot-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@gmail.com"
                      className="w-full min-h-[44px] px-3.5 rounded-xl surface-elevated text-sm text-[var(--text-main)]"
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 min-h-[46px] px-4 rounded-xl font-semibold text-xs inline-flex items-center justify-center gap-2"
                      style={{
                        backgroundColor: 'var(--accent-primary)',
                        color: 'var(--accent-contrast)',
                      }}
                    >
                      <KeyRound className="w-4 h-4" />
                      <span>{loading ? 'Sending...' : 'Send Reset Code'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => switchMode('login')}
                      className="min-h-[46px] px-4 rounded-xl text-xs font-medium surface-elevated"
                    >
                      Back to Sign In
                    </button>
                  </div>
                </form>
              )}

              {/* Reset Password Form */}
              {mode === 'reset-password' && (
                <form onSubmit={handleResetPassword} className="space-y-3.5">
                  {previewResetCode && (
                    <div className="rounded-xl surface-elevated p-3 text-xs">
                      Reset verification code:{' '}
                      <span className="font-mono font-bold text-[var(--accent-primary)]">
                        {previewResetCode}
                      </span>
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-[var(--text-secondary)]">
                      Reset Code
                    </label>
                    <input
                      type="text"
                      required
                      value={resetCode}
                      onChange={(e) => setResetCode(e.target.value)}
                      placeholder="6-digit code"
                      className="w-full min-h-[44px] px-3.5 rounded-xl surface-elevated font-mono text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-[var(--text-secondary)]">
                      New Password
                    </label>
                    <input
                      type="password"
                      required
                      minLength={8}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimum 8 characters"
                      className="w-full min-h-[44px] px-3.5 rounded-xl surface-elevated text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-[var(--text-secondary)]">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      required
                      minLength={8}
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      placeholder="Confirm new password"
                      className="w-full min-h-[44px] px-3.5 rounded-xl surface-elevated text-sm"
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 min-h-[46px] px-4 rounded-xl font-semibold text-xs"
                      style={{
                        backgroundColor: 'var(--accent-primary)',
                        color: 'var(--accent-contrast)',
                      }}
                    >
                      {loading ? 'Updating...' : 'Reset Password'}
                    </button>
                    <button
                      type="button"
                      onClick={() => switchMode('login')}
                      className="min-h-[46px] px-4 rounded-xl text-xs font-medium surface-elevated"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              <div className="pt-4 border-t flex items-start gap-2.5 text-xs text-[var(--text-secondary)]">
                <ShieldCheck className="w-4 h-4 text-[var(--accent-secondary)] shrink-0 mt-0.5" />
                <span>
                  HttpOnly session cookies, server-side password hashing, brute-force lockout protection, and isolated browser execution.
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Capabilities Showcase */}
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
                Engineered for desktop, tablet, and smartphone test coverage
              </h2>
              <p className="text-sm text-[var(--text-secondary)]">
                Every generated automation project maps real DOM structures, reports discovered vs skipped coverage honestly, syncs to Google Sheets, and tracks defects through release sign-off.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  key: 'dom',
                  img: MEDIA_ASSETS.featureDomInspector,
                  alt: 'Isometric DOM tree inspection visualization',
                  kicker: '01 · Website Analyzer',
                  title: 'Live DOM & Honest Coverage Audit',
                  desc: 'Crawls public routes via headless Chromium, detects forms, buttons, links, unsupported widgets (Canvas/Iframes), and checks 1440px and 390px overflow.',
                },
                {
                  key: 'ide',
                  img: MEDIA_ASSETS.featureIdeWorkspace,
                  alt: 'Laptop and smartphone displaying generated Page Object automation code',
                  kicker: '02 · Multi-Language Studio',
                  title: 'Playwright, Cypress & Selenium',
                  desc: 'Generates Maven Java (TestNG/JUnit), Playwright TS/Python, Cypress JS/TS, and Selenium JS/TS/Python repositories—even bundled together in one ZIP.',
                },
                {
                  key: 'exec',
                  img: MEDIA_ASSETS.featureCloudExecution,
                  alt: 'Parallel isolated browser execution containers and analytics',
                  kicker: '03 · SQA, Sheets & Analytics',
                  title: 'SQA Lifecycle & Live Telemetry',
                  desc: 'Manage test plans, 14-column test cases, Google Sheets sync, 7-stage defect lifecycles, RTM traceability, and 10 interactive Recharts analytics views.',
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

        {/* Interactive Multi-Language Script Switcher */}
        <section id="interactive-demo" className="py-12 sm:py-16 border-t">
          <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div className="space-y-2 max-w-2xl">
                <div className="text-xs font-medium text-[var(--text-muted)]">
                  Interactive Output Preview · Multi-Stack Code Generation
                </div>
                <h2 className="font-display font-bold text-2xl sm:text-3xl tracking-tight">
                  Switch target languages with one tap
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

        {/* Architecture & Engineering Leadership */}
        <section id="team" className="border-t bg-[var(--surface-panel)]/40 py-12 sm:py-16">
          <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7 space-y-4">
              <div className="text-xs font-medium text-[var(--text-muted)]">
                QA Architecture · International Engineering Standards
              </div>
              <h2 className="font-display font-bold text-2xl sm:text-3xl tracking-tight">
                Built for SQA teams, QA leads, and release managers
              </h2>
              <p className="text-sm sm:text-base text-[var(--text-secondary)] leading-relaxed">
                Automator AI unifies live Playwright crawling, multi-framework repository scaffolding, Requirements Traceability Matrices, Google Sheets collaboration, and executive analytics under strict role-based security.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 text-xs">
                <div className="surface-panel rounded-xl p-4 space-y-1">
                  <Smartphone className="w-4 h-4 text-[var(--accent-primary)]" />
                  <div className="font-semibold">320px to 1920px+</div>
                  <div className="text-[var(--text-secondary)]">
                    App-style mobile layout &amp; desktop suite
                  </div>
                </div>
                <div className="surface-panel rounded-xl p-4 space-y-1">
                  <FileSpreadsheet className="w-4 h-4 text-[var(--status-success)]" />
                  <div className="font-semibold">Google Sheets &amp; XLSX</div>
                  <div className="text-[var(--text-secondary)]">
                    14-column QA test matrix sync
                  </div>
                </div>
                <div className="surface-panel rounded-xl p-4 space-y-1">
                  <BarChart3 className="w-4 h-4 text-[var(--accent-secondary)]" />
                  <div className="font-semibold">10 Live Analytics Charts</div>
                  <div className="text-[var(--text-secondary)]">
                    Real-time SQA &amp; defect telemetry
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
                  <div className="text-xs font-medium text-[var(--accent-primary)]">
                    Project by Coders31
                  </div>
                  <h3 className="font-display font-bold text-lg">Yaqoot Nawab</h3>
                  <div className="text-xs font-medium text-[var(--text-muted)]">
                    Architecture, Design &amp; Full-Stack Development
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    Dedicated to deterministic explicit waits, transparent crawl boundaries, zero-leak vault hygiene, and ISO-aligned SQA traceability.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Contact & Support */}
        <section id="contact" className="border-t py-12 sm:py-16">
          <div className="max-w-[960px] mx-auto px-4 sm:px-6 lg:px-8">
            <div className="surface-panel rounded-2xl p-5 sm:p-8 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="font-display font-bold text-xl sm:text-2xl">
                    Enterprise Inquiries &amp; QA Support
                  </h2>
                  <p className="text-sm text-[var(--text-secondary)] mt-1">
                    Need CI/CD runner guidance or multi-team SQA onboarding? Send us a note.
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
                        placeholder="jordan@gmail.com"
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
                      placeholder="Tell us about your target web application and preferred Playwright/Selenium/Cypress stack..."
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

      {/* Footer */}
      <footer className="border-t bg-[var(--surface-panel)] py-8 px-4 sm:px-6 lg:px-8 text-xs text-[var(--text-secondary)]">
        <div className="max-w-[1360px] mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pb-6 border-b">
          <div className="space-y-2">
            <div className="flex items-center gap-2 font-display font-bold text-base text-[var(--text-main)]">
              <BrandMark size={24} />
              <span>Automator AI</span>
            </div>
            <p className="text-[var(--text-muted)] leading-relaxed">
              Website Automation Platform, Multi-Language Script Studio, SQA Lifecycle Manager, and Analytics Console.
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
              <div>Playwright (TypeScript &amp; Python)</div>
              <div>Java Selenium (TestNG &amp; JUnit)</div>
              <div>Cypress &amp; Selenium (JS, TS, Python)</div>
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
        <div className="max-w-[1360px] mx-auto pt-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-[var(--text-muted)] text-center sm:text-left">
          <span>
            © {new Date().getFullYear()} Automator AI · Project by{' '}
            <strong className="text-[var(--text-secondary)]">Coders31</strong> · Architected, Designed &amp; Developed by{' '}
            <strong className="text-[var(--text-secondary)]">Yaqoot Nawab</strong>
          </span>
          <span>Responsive QA &amp; SQA Engineering Suite · 320px–1920px+</span>
        </div>
      </footer>
    </div>
  );
}
