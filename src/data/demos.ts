import type { DemoCategory, DemoDefinition } from '@/types';

export const DEMO_CATEGORIES: DemoCategory[] = [
  'All',
  'Interface & Layout',
  'Customization',
  'Workflow & Engine',
  'Responsive Devices',
];

export const DEMOS: DemoDefinition[] = [
  {
    id: 'interactive-dashboard',
    title: 'Interactive Dashboard Demo',
    category: 'Interface & Layout',
    shortDescription:
      'Explore live telemetry KPIs, switch time windows, inspect Recharts velocity curves, and trigger simulated burst crawls.',
    featureDescription:
      'Demonstrates WebCrawler Pro’s analytics surface with tabular numerals, interactive chart series switching, and real-time counter updates.',
    instructions: [
      'Click any timeframe button (24h, 7d, 30d) to update throughput datasets.',
      'Select a KPI card to focus the chart series on Pages, Tests, or Locators.',
      'Click "Simulate Burst Run" to stream live incremental metrics into the dashboard.',
    ],
    isSimulated: true,
    simulationNote: 'Interactive Simulation — telemetry numbers are generated locally in-browser.',
    previewImage: 'dashboard',
    highlights: ['Live Recharts graph', 'Timeframe switching', 'Metric drilldown'],
  },
  {
    id: 'navigation-menu',
    title: 'Navigation & Menu Demo',
    category: 'Interface & Layout',
    shortDescription:
      'Test collapsible workspace rails, live command palette search, dynamic breadcrumb paths, and responsive drawer menus.',
    featureDescription:
      'Showcases multi-level spatial navigation designed for rapid jumping between Crawler Studio, Page Objects, and Suite Exports.',
    instructions: [
      'Click sidebar items to watch the active breadcrumb trail and view header update.',
      'Use the Command Filter input to search routes and jump directly to a module.',
      'Toggle "Collapse Rail" or "Mobile Drawer" to preview compact navigation states.',
    ],
    isSimulated: false,
    previewImage: 'schematic-nav',
    highlights: ['Collapsible rail', 'Command search', 'Live breadcrumbs'],
  },
  {
    id: 'theme-customization',
    title: 'Theme Customization Demo',
    category: 'Customization',
    shortDescription:
      'Switch surface themes, test architectural wallpapers, pick accent colors, and apply changes to the live application.',
    featureDescription:
      'Demonstrates the dual-theme design token architecture across Obsidian, Daylight, Slate, and Cobalt surfaces with calibrated contrast.',
    instructions: [
      'Choose a theme mode (Obsidian, Daylight, Slate, or Cobalt) inside the sandbox.',
      'Select a primary accent swatch and toggle between architectural wallpapers.',
      'Click "Apply to Live App" to promote your customized theme across the entire workspace.',
    ],
    isSimulated: false,
    previewImage: 'aurora',
    highlights: ['4 surface themes', 'Wallpaper switcher', 'Global apply'],
  },
  {
    id: 'settings-interface',
    title: 'Settings Interface Demo',
    category: 'Customization',
    shortDescription:
      'Configure crawler concurrency, reorder locator fallback priorities, toggle notifications, and validate save/reset states.',
    featureDescription:
      'Provides an interactive configuration studio mirroring enterprise crawler policies and deterministic locator ranking.',
    instructions: [
      'Switch between General, Engine, Locators, and Alerts tabs.',
      'Reorder the Locator Priority list using the Up/Down controls.',
      'Adjust concurrency sliders and click "Save Configuration" to confirm state.',
    ],
    isSimulated: true,
    simulationNote: 'Interactive Simulation — settings changes apply inside this demo sandbox.',
    previewImage: 'schematic-settings',
    highlights: ['Locator ranking', 'Tabbed preferences', 'Dirty-state save'],
  },
  {
    id: 'animation-transition',
    title: 'Animation & Transition Demo',
    category: 'Interface & Layout',
    shortDescription:
      'Compare compositor-only easing curves, adjust transition durations, test blur-focus reveals, and toggle Reduced Motion.',
    featureDescription:
      'Demonstrates GPU-friendly transform and opacity motion curves engineered to settle smoothly within perceptual latency budgets.',
    instructions: [
      'Pick a motion preset (Smooth Settling, Spring Snap, Blur Reveal, or Cascade).',
      'Adjust duration (150ms, 300ms, 600ms) or toggle Reduced Motion.',
      'Click "Play Transition" to inspect how cards, drawers, and meters respond.',
    ],
    isSimulated: false,
    previewImage: 'schematic-motion',
    highlights: ['Easing lab', 'Reduced motion test', 'Speed controls'],
  },
  {
    id: 'mobile-interface',
    title: 'Mobile Interface Demo',
    category: 'Responsive Devices',
    shortDescription:
      'Interact with a 390px smartphone frame featuring touch-sized bottom navigation, slide-up drawers, and quick scan triggers.',
    featureDescription:
      'Validates thumb-zone ergonomics, 44px minimum touch targets, and compact route cards on Android and iOS viewports.',
    instructions: [
      'Tap the bottom tab bar icons (Home, Scan, Pages, Config) inside the phone frame.',
      'Press "Run Mobile Scan" on the Scan tab to watch mobile progress indicators.',
      'Open a page card to preview the mobile slide-up detail sheet.',
    ],
    isSimulated: true,
    simulationNote: 'Interactive Simulation — runs an emulated mobile viewport inside desktop browsers.',
    previewImage: 'devices',
    highlights: ['390px viewport', 'Touch bottom tabs', 'Slide-up sheets'],
  },
  {
    id: 'desktop-interface',
    title: 'Desktop Interface Demo',
    category: 'Responsive Devices',
    shortDescription:
      'Explore a multi-pane desktop engineering environment with switchable inspector tabs, split view toggles, and window controls.',
    featureDescription:
      'Demonstrates full-width 1440px studio workflows combining route trees, DOM inspectors, and generated Playwright code side by side.',
    instructions: [
      'Select any route in the left file tree to load its DOM & locator inspector.',
      'Switch inspector tabs between DOM Tree, Locator Matrix, and Generated Spec.',
      'Toggle Split Pane or Maximize Viewport inside the simulated desktop window.',
    ],
    isSimulated: false,
    previewImage: 'hero',
    highlights: ['Multi-pane split', 'DOM tree explorer', 'Window controls'],
  },
  {
    id: 'feature-showcase',
    title: 'Feature Showcase Demo',
    category: 'Workflow & Engine',
    shortDescription:
      'Step through the 4-stage engine pipeline from URL discovery to resilient locator synthesis and inspect real output.',
    featureDescription:
      'Connects each user goal to the exact interface mechanism and resulting Playwright, Cypress, or Selenium artifact.',
    instructions: [
      'Click each stage (1. Discovery, 2. Classifier, 3. Locator Engine, 4. Codegen).',
      'Select different sample DOM nodes in Stage 3 to see selector fallback generation.',
      'Switch output framework in Stage 4 to compare Playwright vs. Cypress vs. Selenium.',
    ],
    isSimulated: true,
    simulationNote: 'Interactive Simulation — inspects sample DOM snapshots generated locally.',
    previewImage: 'schematic-pipeline',
    highlights: ['4-stage pipeline', 'Selector matrix', 'Multi-framework diff'],
  },
  {
    id: 'personalization',
    title: 'Customization & Personalization Demo',
    category: 'Customization',
    shortDescription:
      'Tailor workspace layout density, typography scale, visible dashboard widgets, and sidebar alignment in real time.',
    featureDescription:
      'Showcases adaptive workspace ergonomics allowing QA engineers and team leads to tune information density.',
    instructions: [
      'Switch Layout Density between Compact, Comfortable, and Spacious.',
      'Drag the Typography Scale slider and toggle dashboard widget visibility.',
      'Click "Apply to Live App" to update your active workspace preferences.',
    ],
    isSimulated: false,
    previewImage: 'schematic-personalize',
    highlights: ['Density tuner', 'Widget toggles', 'Font scale slider'],
  },
  {
    id: 'application-workflow',
    title: 'Application Workflow Demo',
    category: 'Workflow & Engine',
    shortDescription:
      'Walk through the complete 5-step WebCrawler Pro journey from entering a URL to inspecting generated Page Objects.',
    featureDescription:
      'Guides new users end-to-end through target setup, rule validation, live crawl execution, route inspection, and export readiness.',
    instructions: [
      'Enter or edit the demo target URL in Step 1 and advance to Step 2.',
      'Toggle crawl rules in Step 2, then launch the 2-second scan in Step 3.',
      'Inspect a discovered route in Step 4 and choose a framework bundle in Step 5.',
    ],
    isSimulated: true,
    simulationNote: 'Interactive Simulation — executes a fast 2-second guided crawl workflow.',
    previewImage: 'schematic-workflow',
    highlights: ['5-step walkthrough', 'Live mini-crawl', 'Code output preview'],
  },
];
