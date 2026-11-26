export type PageType = 'Login' | 'Dashboard' | 'Product' | 'Form' | 'Table' | 'Other';

export type Framework =
  | 'selenium-js'
  | 'selenium-ts'
  | 'cypress-js'
  | 'cypress-ts'
  | 'playwright-js'
  | 'playwright-ts';

export interface DiscoveredPage {
  id: string;
  url: string;
  path: string;
  type: PageType;
  elements: number;
  status: 'pending' | 'crawling' | 'completed' | 'skipped';
  locators: string[];
}

export interface CrawlConfig {
  url: string;
  respectRobots: boolean;
  followSubdomains: boolean;
  maxPages: number;
  crawlDelayMs?: number;
  maxDepth?: number;
  userAgent?: string;
}

export interface CrawlStats {
  pagesFound: number;
  pagesCrawled: number;
  testsGenerated: number;
  timeElapsed: number;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
}

export interface FrameworkInfo {
  id: Framework;
  name: string;
  language: string;
  color: string;
  description: string;
  icon: string;
}

export type AppState = 'landing' | 'crawling' | 'complete';

export type AppView = 'overview' | 'crawler' | 'results' | 'demos' | 'settings';

export type ThemeMode = 'obsidian' | 'daylight' | 'slate' | 'cobalt';

export type AccentColor = 'amber' | 'teal' | 'cobalt' | 'emerald';

export type LayoutDensity = 'compact' | 'comfortable' | 'spacious';

export interface AppSettings {
  theme: ThemeMode;
  accent: AccentColor;
  density: LayoutDensity;
  reducedMotion: boolean;
  wallpaperEnabled: boolean;
  defaultMaxPages: number;
  defaultFramework: Framework;
  sidebarCollapsed: boolean;
  fontScale: number;
}

export type DemoCategory =
  | 'All'
  | 'Interface & Layout'
  | 'Customization'
  | 'Workflow & Engine'
  | 'Responsive Devices';

export type DemoId =
  | 'interactive-dashboard'
  | 'navigation-menu'
  | 'theme-customization'
  | 'settings-interface'
  | 'animation-transition'
  | 'mobile-interface'
  | 'desktop-interface'
  | 'feature-showcase'
  | 'personalization'
  | 'application-workflow';

export interface DemoDefinition {
  id: DemoId;
  title: string;
  category: Exclude<DemoCategory, 'All'>;
  shortDescription: string;
  featureDescription: string;
  instructions: string[];
  isSimulated: boolean;
  simulationNote?: string;
  previewImage: 'dashboard' | 'devices' | 'hero' | 'aurora' | 'schematic-nav' | 'schematic-settings' | 'schematic-motion' | 'schematic-pipeline' | 'schematic-personalize' | 'schematic-workflow';
  highlights: string[];
}
