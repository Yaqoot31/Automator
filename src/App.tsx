import { useState, useCallback, useEffect, useRef } from 'react';
import type {
  AppSettings,
  AppState,
  AppView,
  CrawlStats,
  DemoId,
  DiscoveredPage,
  LogEntry,
} from '@/types';
import { Navigation } from '@/components/Navigation';
import HeroSection from '@/sections/HeroSection';
import CrawlConfiguration from '@/sections/CrawlConfiguration';
import ProgressDashboard from '@/sections/ProgressDashboard';
import ResultsTable from '@/sections/ResultsTable';
import CodeGenerationCenter from '@/sections/CodeGenerationCenter';
import DemoCenter from '@/sections/DemoCenter';
import SettingsPanel from '@/sections/SettingsPanel';
import Footer from '@/sections/Footer';
import {
  generateMockPages,
  generateLogEntry,
  getInitialStats,
} from '@/lib/crawlSimulator';
import { MEDIA_ASSETS } from '@/lib/mediaAssets';

const SETTINGS_STORAGE_KEY = 'webcrawler_pro_settings_v2';

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'obsidian',
  accent: 'amber',
  density: 'comfortable',
  reducedMotion: false,
  wallpaperEnabled: true,
  defaultMaxPages: 100,
  defaultFramework: 'playwright-ts',
  sidebarCollapsed: false,
  fontScale: 100,
};

function loadInitialSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export default function App() {
  const [settings, setSettings] = useState<AppSettings>(loadInitialSettings);
  const [activeView, setActiveView] = useState<AppView>('overview');
  const [selectedDemoId, setSelectedDemoId] = useState<DemoId | null>(null);
  const [appState, setAppState] = useState<AppState>('landing');

  // Crawl config
  const [url, setUrl] = useState('https://example.com');
  const [respectRobots, setRespectRobots] = useState(true);
  const [followSubdomains, setFollowSubdomains] = useState(false);
  const [maxPages, setMaxPages] = useState(() => loadInitialSettings().defaultMaxPages);
  const [crawlDelayMs, setCrawlDelayMs] = useState(500);
  const [maxDepth, setMaxDepth] = useState(3);
  const [userAgent, setUserAgent] = useState('WebCrawlerPro/2.0');

  // Crawl progress & results
  const [stats, setStats] = useState<CrawlStats>(getInitialStats());
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [currentStatus, setCurrentStatus] = useState('Standby');
  const [pages, setPages] = useState<DiscoveredPage[]>([]);

  const progressRef = useRef(0);
  const crawlIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const logIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sync theme, accent, reduced motion, and scale attributes to documentElement
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', settings.theme);
    root.setAttribute('data-accent', settings.accent);
    if (settings.theme === 'daylight') {
      root.classList.remove('dark');
    } else {
      root.classList.add('dark');
    }
    if (settings.reducedMotion) {
      root.classList.add('reduce-motion');
    } else {
      root.classList.remove('reduce-motion');
    }
    root.style.fontSize = `${settings.fontScale}%`;

    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Ignore storage quota issues
    }
  }, [settings]);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
  }, []);

  const clearAllIntervals = useCallback(() => {
    if (crawlIntervalRef.current) clearInterval(crawlIntervalRef.current);
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (logIntervalRef.current) clearInterval(logIntervalRef.current);
    crawlIntervalRef.current = null;
    timerIntervalRef.current = null;
    logIntervalRef.current = null;
  }, []);

  const startCrawl = useCallback(() => {
    clearAllIntervals();
    const targetUrl = url.trim() || 'https://example.com';
    const mockPages = generateMockPages(targetUrl, maxPages);

    setPages(mockPages);
    setStats(getInitialStats());
    setProgress(0);
    progressRef.current = 0;
    setLogs([]);
    setAppState('crawling');
    setActiveView('crawler');
    setCurrentStatus('Scanning target routes...');

    let currentIndex = 0;
    const totalPages = mockPages.length;
    const crawlDuration = 8000;
    const updateInterval = 200;
    const stepsPerInterval = totalPages / (crawlDuration / updateInterval);

    crawlIntervalRef.current = setInterval(() => {
      currentIndex += stepsPerInterval;
      const progressPercent = Math.min(100, (currentIndex / totalPages) * 100);
      progressRef.current = progressPercent;

      setProgress(progressPercent);
      setStats((prev) => ({
        ...prev,
        pagesFound: totalPages,
        pagesCrawled: Math.min(totalPages, Math.floor(currentIndex)),
        testsGenerated: Math.floor((progressPercent / 100) * totalPages * 6),
      }));

      setPages((prev) =>
        prev.map((page, i) => {
          if (i < Math.floor(currentIndex) && page.status !== 'completed') {
            return { ...page, status: 'completed' as const };
          }
          if (i === Math.floor(currentIndex) && page.status === 'pending') {
            return { ...page, status: 'crawling' as const };
          }
          return page;
        })
      );

      if (progressPercent < 30) {
        setCurrentStatus('Discovering internal routes...');
      } else if (progressPercent < 65) {
        setCurrentStatus('Classifying DOM archetypes and locators...');
      } else if (progressPercent < 95) {
        setCurrentStatus('Synthesizing Page Objects and specs...');
      } else {
        setCurrentStatus('Finalizing test suites...');
      }

      if (progressPercent >= 100) {
        clearAllIntervals();
        setAppState('complete');
        setCurrentStatus('Crawl complete');
      }
    }, updateInterval);

    timerIntervalRef.current = setInterval(() => {
      setStats((prev) => ({
        ...prev,
        timeElapsed: prev.timeElapsed + 1,
      }));
    }, 1000);

    let logIndex = 0;
    logIntervalRef.current = setInterval(() => {
      const pct = progressRef.current;
      const stage: 'discovering' | 'crawling' | 'generating' =
        pct < 30 ? 'discovering' : pct < 70 ? 'crawling' : 'generating';
      const entry = generateLogEntry(mockPages, logIndex % mockPages.length, stage);
      setLogs((prev) => [...prev.slice(-99), entry]);
      logIndex++;
    }, 260);
  }, [url, maxPages, clearAllIntervals]);

  const stopCrawl = useCallback(() => {
    clearAllIntervals();
    setPages((prev) =>
      prev.map((p) =>
        p.status === 'pending' || p.status === 'crawling'
          ? { ...p, status: 'completed' as const }
          : p
      )
    );
    setProgress(100);
    progressRef.current = 100;
    setAppState('complete');
    setCurrentStatus('Crawl stopped and finalized');
  }, [clearAllIntervals]);

  const resetCrawl = useCallback(() => {
    clearAllIntervals();
    setAppState('landing');
    setPages([]);
    setLogs([]);
    setStats(getInitialStats());
    setProgress(0);
    progressRef.current = 0;
    setCurrentStatus('Standby');
  }, [clearAllIntervals]);

  const handleOpenDemo = useCallback((demoId: DemoId) => {
    setSelectedDemoId(demoId);
    setActiveView('demos');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleNavigate = useCallback((view: AppView) => {
    setActiveView(view);
    if (view !== 'demos') {
      setSelectedDemoId(null);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    return () => clearAllIntervals();
  }, [clearAllIntervals]);

  const densityPadding =
    settings.density === 'compact'
      ? 'py-4'
      : settings.density === 'spacious'
        ? 'py-10'
        : 'py-6';

  return (
    <div className="min-h-screen relative bg-[var(--surface-canvas)] text-[var(--text-main)]">
      {/* Subtle Ambient Architectural Wallpaper */}
      {settings.wallpaperEnabled && (
        <div
          aria-hidden="true"
          className="fixed inset-0 pointer-events-none z-0 overflow-hidden"
        >
          <img
            src={MEDIA_ASSETS.demoAurora}
            alt=""
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover opacity-[0.07]"
          />
        </div>
      )}

      <Navigation
        appState={appState}
        activeView={activeView}
        onNavigate={handleNavigate}
        onStartQuickCrawl={startCrawl}
        sidebarCollapsed={settings.sidebarCollapsed}
        onToggleSidebar={() =>
          updateSettings({ sidebarCollapsed: !settings.sidebarCollapsed })
        }
        discoveredCount={pages.length}
        progress={progress}
      />

      {/* Main Workspace Viewport */}
      <div
        className={`relative z-10 pt-16 transition-all duration-200 ${
          settings.sidebarCollapsed ? 'lg:pl-[72px]' : 'lg:pl-[240px]'
        }`}
      >
        {/* Contextual Breadcrumb Sub-bar */}
        <div className="border-b bg-[var(--surface-panel)]/70 backdrop-blur-md">
          <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 h-11 flex items-center justify-between text-xs text-[var(--text-secondary)]">
            <div className="flex items-center gap-2 min-w-0">
              <span>WebCrawler Pro</span>
              <span aria-hidden="true">/</span>
              <span className="text-[var(--text-main)] font-medium truncate">
                {activeView === 'overview' && 'Overview'}
                {activeView === 'crawler' && 'Crawler Studio'}
                {activeView === 'results' && 'Results & Code Generation'}
                {activeView === 'demos' &&
                  (selectedDemoId
                    ? 'Interactive Product Demos / Live Preview'
                    : 'Interactive Product Demos')}
                {activeView === 'settings' && 'Settings'}
              </span>
            </div>

            <div className="hidden sm:flex items-center gap-3 text-[var(--text-muted)]">
              <span className="font-mono truncate max-w-[240px]">{url}</span>
            </div>
          </div>
        </div>

        <main className={densityPadding}>
          {activeView === 'overview' && (
            <HeroSection
              url={url}
              onUrlChange={setUrl}
              onStartCrawl={startCrawl}
              onNavigate={handleNavigate}
              onOpenDemo={handleOpenDemo}
            />
          )}

          {activeView === 'crawler' && (
            <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
              <CrawlConfiguration
                url={url}
                onUrlChange={setUrl}
                respectRobots={respectRobots}
                onRespectRobotsChange={setRespectRobots}
                followSubdomains={followSubdomains}
                onFollowSubdomainsChange={setFollowSubdomains}
                maxPages={maxPages}
                onMaxPagesChange={setMaxPages}
                crawlDelayMs={crawlDelayMs}
                onCrawlDelayMsChange={setCrawlDelayMs}
                maxDepth={maxDepth}
                onMaxDepthChange={setMaxDepth}
                userAgent={userAgent}
                onUserAgentChange={setUserAgent}
                onStartCrawl={startCrawl}
                onResetCrawl={resetCrawl}
                hasResults={pages.length > 0}
                disabled={appState === 'crawling'}
              />

              {(appState === 'crawling' || pages.length > 0) && (
                <ProgressDashboard
                  stats={stats}
                  progress={progress}
                  logs={logs}
                  pages={pages}
                  currentStatus={currentStatus}
                  isComplete={appState === 'complete'}
                  onStopCrawl={stopCrawl}
                  onViewResults={() => handleNavigate('results')}
                />
              )}
            </div>
          )}

          {activeView === 'results' && (
            <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
              <ResultsTable
                pages={pages}
                defaultFramework={settings.defaultFramework}
                onStartSampleCrawl={startCrawl}
              />
              {pages.length > 0 && <CodeGenerationCenter pages={pages} />}
            </div>
          )}

          {activeView === 'demos' && (
            <DemoCenter
              selectedDemoId={selectedDemoId}
              onSelectDemo={setSelectedDemoId}
              appSettings={settings}
              onUpdateAppSettings={updateSettings}
            />
          )}

          {activeView === 'settings' && (
            <SettingsPanel
              settings={settings}
              onUpdateSettings={updateSettings}
              onResetSettings={resetSettings}
            />
          )}
        </main>

        <Footer onNavigate={handleNavigate} />
      </div>
    </div>
  );
}
