import type { DiscoveredPage, PageType, LogEntry, CrawlStats } from '@/types';

const PATHS_BY_TYPE: Record<PageType, string[]> = {
  Login: ['/login', '/auth/signin', '/account/login', '/signin', '/user/login'],
  Dashboard: ['/dashboard', '/admin', '/home', '/overview', '/analytics'],
  Product: ['/products', '/products/item-1', '/products/item-2', '/catalog', '/item/detail'],
  Form: ['/contact', '/feedback', '/register', '/subscribe', '/apply'],
  Table: ['/users', '/orders', '/transactions', '/reports/data', '/listings'],
  Other: ['/about', '/privacy', '/terms', '/help', '/faq'],
};

const LOG_MESSAGES = {
  discovering: [
    'Discovering: {path}',
    'Found link: {path}',
    'Queueing: {path}',
    'Enqueue: {path}',
  ],
  crawled: [
    'Crawled: {path} — {n} elements found',
    'Completed: {path} ({n} DOM nodes)',
    'Indexed: {path} [{n} elements]',
  ],
  classified: [
    'Classified: {path} as {type}',
    'Detected {type} pattern: {path}',
    'Pattern match [{type}]: {path}',
  ],
  skipped: [
    'Skipped: {path} (external link)',
    'Filtered: {path} (nofollow)',
    'Excluding: {path} (depth limit)',
  ],
  generating: [
    'Generating locators for: {path}',
    'Building page object: {name}Page',
    'Analyzing selectors: {path}',
  ],
};

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function generateMockPages(baseUrl: string, maxPages: number): DiscoveredPage[] {
  const pages: DiscoveredPage[] = [];
  const allPaths: { type: PageType; path: string }[] = [];

  for (const [type, paths] of Object.entries(PATHS_BY_TYPE)) {
    for (const path of paths) {
      allPaths.push({ type: type as PageType, path });
    }
  }

  // Shuffle and take up to maxPages
  for (let i = allPaths.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allPaths[i], allPaths[j]] = [allPaths[j], allPaths[i]];
  }

  const selected = allPaths.slice(0, Math.min(maxPages, allPaths.length));

  for (let i = 0; i < selected.length; i++) {
    const { type, path } = selected[i];
    const fullUrl = baseUrl.replace(/\/$/, '') + path;
    pages.push({
      id: `page-${i}`,
      url: fullUrl,
      path,
      type,
      elements: randomInt(5, 50),
      status: 'pending',
      locators: [],
    });
  }

  return pages;
}

export function generateLogEntry(
  pages: DiscoveredPage[],
  currentIndex: number,
  stage: 'discovering' | 'crawling' | 'generating'
): LogEntry {
  const now = new Date();
  const timestamp = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

  const page = pages[currentIndex];
  const path = page?.path || '/unknown';
  const type = page?.type || 'Other';
  const name = path.split('/').filter(Boolean).pop() || 'home';

  let message: string;
  let logType: LogEntry['type'];

  switch (stage) {
    case 'discovering':
      message = randomItem(LOG_MESSAGES.discovering)
        .replace('{path}', path);
      logType = 'info';
      break;
    case 'crawling': {
      const roll = Math.random();
      if (roll < 0.6) {
        message = randomItem(LOG_MESSAGES.crawled)
          .replace('{path}', path)
          .replace('{n}', String(randomInt(8, 45)));
        logType = 'success';
      } else if (roll < 0.85) {
        message = randomItem(LOG_MESSAGES.classified)
          .replace('{path}', path)
          .replace('{type}', type);
        logType = 'info';
      } else {
        message = randomItem(LOG_MESSAGES.skipped).replace('{path}', path);
        logType = 'warning';
      }
      break;
    }
    case 'generating':
      message = randomItem(LOG_MESSAGES.generating)
        .replace('{path}', path)
        .replace('{name}', name.charAt(0).toUpperCase() + name.slice(1));
      logType = 'info';
      break;
  }

  return {
    id: `log-${timestamp}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp,
    type: logType,
    message,
  };
}

export function getInitialStats(): CrawlStats {
  return {
    pagesFound: 0,
    pagesCrawled: 0,
    testsGenerated: 0,
    timeElapsed: 0,
  };
}

export function getTypeDistribution(pages: DiscoveredPage[]): Record<PageType, number> {
  const dist: Record<string, number> = {};
  for (const page of pages) {
    dist[page.type] = (dist[page.type] || 0) + 1;
  }
  return dist as Record<PageType, number>;
}

export const TYPE_COLORS: Record<PageType, string> = {
  Login: '#d4a017',
  Dashboard: '#17d4d4',
  Product: '#4ade80',
  Form: '#fb923c',
  Table: '#f87171',
  Other: '#666666',
};
