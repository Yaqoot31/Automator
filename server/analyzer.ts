import crypto from 'node:crypto';
import * as cheerio from 'cheerio';
import type {
  AnalyzedPage,
  DomElementInfo,
  PageArchetype,
  SkippedPageInfo,
  UnsupportedElementInfo,
  WebsiteAnalysisReport,
} from '../src/types/index.js';
import { createSafeContext, launchIsolatedBrowser } from './browser.js';
import { validatePublicUrl } from './security.js';

export interface AnalysisProgressEvent {
  jobId: string;
  stage: string;
  progress: number;
  message: string;
  level: 'info' | 'success' | 'warn' | 'error';
  page?: AnalyzedPage;
}

export interface AnalyzeWebsiteOptions {
  jobId: string;
  rawUrl: string;
  maxPages?: number;
  maxDepth?: number;
  respectRobots?: boolean;
  followSubdomains?: boolean;
  timeoutMs?: number;
  onProgress?: (event: AnalysisProgressEvent) => void;
}

interface RobotsPolicy {
  allowed: boolean;
  disallowedPaths: string[];
  summary: string;
}

async function checkRobotsTxt(baseUrl: URL, respectRobots: boolean): Promise<RobotsPolicy> {
  if (!respectRobots) {
    return {
      allowed: true,
      disallowedPaths: [],
      summary: 'Robots policy enforcement disabled by configuration.',
    };
  }
  try {
    const robotsUrl = new URL('/robots.txt', baseUrl.origin);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);
    const res = await fetch(robotsUrl.toString(), {
      signal: controller.signal,
      headers: { 'User-Agent': 'AutomatorQA/2.0' },
      redirect: 'manual',
    });
    clearTimeout(timer);

    if (!res.ok) {
      return {
        allowed: true,
        disallowedPaths: [],
        summary: `No restrictive robots.txt found (HTTP ${res.status}).`,
      };
    }

    const text = await res.text();
    const lines = text.split(/\r?\n/);
    let inWildcard = false;
    const disallowed: string[] = [];

    for (const rawLine of lines) {
      const line = rawLine.split('#')[0].trim();
      if (!line) continue;
      const [key, ...rest] = line.split(':');
      const directive = key.trim().toLowerCase();
      const val = rest.join(':').trim();

      if (directive === 'user-agent') {
        inWildcard = val === '*' || val.toLowerCase().includes('automator');
      } else if (inWildcard && directive === 'disallow' && val) {
        disallowed.push(val);
      }
    }

    const rootDisallowed = disallowed.includes('/');
    return {
      allowed: !rootDisallowed,
      disallowedPaths: disallowed.slice(0, 50),
      summary: rootDisallowed
        ? 'robots.txt disallows automated crawling (Disallow: /).'
        : disallowed.length > 0
          ? `robots.txt parsed (${disallowed.length} Disallow rule(s) respected).`
          : 'robots.txt allows public route inspection.',
    };
  } catch {
    return {
      allowed: true,
      disallowedPaths: [],
      summary: 'robots.txt unavailable or timed out; proceeding with cautious rate-limited access.',
    };
  }
}

function isPathAllowedByRobots(pathname: string, disallowed: string[]): boolean {
  for (const rule of disallowed) {
    if (rule === '/') return false;
    if (rule && pathname.startsWith(rule)) return false;
  }
  return true;
}

function detectAntiBot(html: string, title: string, statusCode: number): string | undefined {
  const lowerHtml = html.toLowerCase();
  const lowerTitle = title.toLowerCase();
  if (
    lowerTitle.includes('just a moment') ||
    lowerHtml.includes('cf-browser-verification') ||
    lowerHtml.includes('challenges.cloudflare.com')
  ) {
    return 'Cloudflare challenge / bot protection detected. Respecting access controls without bypassing.';
  }
  if (lowerHtml.includes('g-recaptcha') || lowerHtml.includes('recaptcha/api.js')) {
    return 'Google reCAPTCHA detected on page. Interactive submission requires human verification.';
  }
  if (lowerHtml.includes('hcaptcha.com/1/api.js')) {
    return 'hCaptcha challenge detected on page.';
  }
  if (statusCode === 403 || statusCode === 429) {
    return `Access restricted by target server (HTTP ${statusCode}).`;
  }
  return undefined;
}

function inferArchetype(
  pathname: string,
  title: string,
  counts: AnalyzedPage['elementCounts'],
  hasLoginForm: boolean,
  hasSearchForm: boolean
): PageArchetype {
  const p = pathname.toLowerCase();
  const t = title.toLowerCase();
  if (hasLoginForm || p.includes('login') || p.includes('signin') || t.includes('sign in')) {
    return 'Login';
  }
  if (p.includes('register') || p.includes('signup') || p.includes('sign-up')) {
    return 'Registration';
  }
  if (p === '/' || p === '') return 'Homepage';
  if (p.includes('search') || (hasSearchForm && counts.forms === 1 && counts.inputs <= 2)) {
    return 'Search';
  }
  if (p.includes('dashboard') || p.includes('analytics') || p.includes('admin')) {
    return 'Dashboard';
  }
  if (counts.tables > 0) return 'Table';
  if (p.includes('product') || p.includes('shop') || p.includes('catalog') || p.includes('pricing')) {
    return 'Catalog';
  }
  if (counts.forms > 0 && counts.inputs >= 2) return 'Form';
  if (p.includes('blog') || p.includes('docs') || p.includes('article')) return 'Article';
  return 'Other';
}

async function checkBrokenLinksSample(links: string[], origin: string): Promise<{ url: string; status: number | string }[]> {
  const unique = Array.from(new Set(links)).slice(0, 8);
  const broken: { url: string; status: number | string }[] = [];

  for (const link of unique) {
    try {
      const target = new URL(link, origin);
      const check = await validatePublicUrl(target.toString());
      if (!check.valid || !check.url) continue;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3500);
      let res = await fetch(check.url.toString(), {
        method: 'HEAD',
        signal: controller.signal,
        headers: { 'User-Agent': 'AutomatorQA/2.0' },
      });
      clearTimeout(timer);

      if (res.status === 405) {
        const c2 = new AbortController();
        const t2 = setTimeout(() => c2.abort(), 3500);
        res = await fetch(check.url.toString(), {
          method: 'GET',
          signal: c2.signal,
          headers: { 'User-Agent': 'AutomatorQA/2.0' },
        });
        clearTimeout(t2);
      }

      if (res.status >= 400) {
        broken.push({ url: check.url.toString(), status: res.status });
      }
    } catch {
      broken.push({ url: link, status: 'Timeout / Network error' });
    }
  }
  return broken;
}

export async function analyzeWebsite(options: AnalyzeWebsiteOptions): Promise<WebsiteAnalysisReport> {
  const startTime = Date.now();
  const emit = (
    stage: string,
    progress: number,
    message: string,
    level: AnalysisProgressEvent['level'] = 'info',
    page?: AnalyzedPage
  ) => {
    options.onProgress?.({ jobId: options.jobId, stage, progress, message, level, page });
  };

  emit('validating', 5, `Validating target URL: ${options.rawUrl}`);
  const validation = await validatePublicUrl(options.rawUrl);
  if (!validation.valid || !validation.url) {
    throw new Error(validation.error || 'Invalid target URL');
  }

  const targetUrl = validation.url;
  const maxPages = Math.min(Math.max(options.maxPages ?? 6, 1), 15);
  const maxDepth = Math.min(Math.max(options.maxDepth ?? 2, 1), 3);
  const respectRobots = options.respectRobots ?? true;
  const followSubdomains = options.followSubdomains ?? false;
  const timeoutMs = Math.min(Math.max(options.timeoutMs ?? 15000, 5000), 30000);

  emit('robots', 12, `Checking robots.txt directives for ${targetUrl.origin}...`);
  const robots = await checkRobotsTxt(targetUrl, respectRobots);
  emit(
    'robots',
    18,
    robots.summary,
    robots.allowed ? 'info' : 'warn'
  );

  if (!robots.allowed) {
    return {
      id: crypto.randomUUID(),
      url: targetUrl.toString(),
      finalUrl: targetUrl.toString(),
      accessible: false,
      robotsAllowed: false,
      robotsSummary: robots.summary,
      analyzedAt: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      pages: [],
      discoveredUrls: [targetUrl.toString()],
      skippedPages: [{ url: targetUrl.toString(), reason: 'Disallowed by site robots.txt (Disallow: /)' }],
      unsupportedElements: [],
      coverageScope: 'single-page',
      summary: {
        totalPages: 0,
        totalElements: 0,
        totalForms: 0,
        totalLinks: 0,
        brokenLinksCount: 0,
        accessibilityIssuesCount: 0,
        avgLoadTimeMs: 0,
        responsiveReady: true,
      },
    };
  }

  emit('browser', 24, 'Launching isolated headless Chromium browser session...');
  const browser = await launchIsolatedBrowser();
  const visited = new Set<string>();
  const discoveredUrls = new Set<string>([targetUrl.toString()]);
  const skippedPages: SkippedPageInfo[] = [];
  const skippedSet = new Set<string>();
  const unsupportedElements: UnsupportedElementInfo[] = [];
  const queue: { url: string; depth: number }[] = [{ url: targetUrl.toString(), depth: 0 }];
  const analyzedPages: AnalyzedPage[] = [];
  let rootFinalUrl = targetUrl.toString();
  let rootAntiBot: string | undefined;

  const recordSkip = (url: string, reason: string) => {
    if (skippedSet.has(url)) return;
    skippedSet.add(url);
    skippedPages.push({ url, reason });
  };

  try {
    const context = await createSafeContext(browser, { width: 1440, height: 900 });

    while (queue.length > 0 && analyzedPages.length < maxPages) {
      const next = queue.shift()!;
      const normUrl = next.url.split('#')[0];
      if (visited.has(normUrl)) continue;
      visited.add(normUrl);

      const urlCheck = await validatePublicUrl(normUrl);
      if (!urlCheck.valid || !urlCheck.url) {
        recordSkip(normUrl, urlCheck.error || 'Restricted or unsafe target URL');
        emit('crawl', 30, `Skipped restricted URL: ${normUrl}`, 'warn');
        continue;
      }

      if (respectRobots && !isPathAllowedByRobots(urlCheck.url.pathname, robots.disallowedPaths)) {
        recordSkip(urlCheck.url.toString(), 'Disallowed by robots.txt rule');
        emit('crawl', 35, `Skipped disallowed path per robots.txt: ${urlCheck.url.pathname}`, 'warn');
        continue;
      }

      const pct = Math.min(88, 28 + Math.round((analyzedPages.length / maxPages) * 58));
      emit('crawl', pct, `Inspecting DOM & interactive elements at ${urlCheck.url.pathname || '/'}...`);

      const page = await context.newPage();
      let statusCode = 0;
      let loadTimeMs = 0;
      let finalUrl = urlCheck.url.toString();
      let htmlContent = '';

      try {
        const navStart = Date.now();
        const response = await page.goto(urlCheck.url.toString(), {
          waitUntil: 'domcontentloaded',
          timeout: timeoutMs,
        });
        await page.waitForTimeout(450);
        loadTimeMs = Date.now() - navStart;
        statusCode = response?.status() ?? 200;
        finalUrl = page.url();
        if (analyzedPages.length === 0) {
          rootFinalUrl = finalUrl;
        }
        discoveredUrls.add(finalUrl);
        htmlContent = await page.content();

        const domSnapshot = await page.evaluate(() => {
          const cleanText = (el: Element | null) =>
            (el?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80);

          const buildLocator = (el: Element): { locator: string; strategy: DomElementInfo['locatorStrategy'] } => {
            const testId = el.getAttribute('data-testid') || el.getAttribute('data-test');
            if (testId) return { locator: `[data-testid="${testId}"]`, strategy: 'data-testid' };
            const id = el.getAttribute('id');
            if (id && /^[a-zA-Z][\w-]*$/.test(id)) return { locator: `#${id}`, strategy: 'id' };
            const aria = el.getAttribute('aria-label');
            if (aria) return { locator: `[aria-label="${aria.replace(/"/g, '\\"')}"]`, strategy: 'aria-label' };
            const name = el.getAttribute('name');
            if (name) return { locator: `${el.tagName.toLowerCase()}[name="${name.replace(/"/g, '\\"')}"]`, strategy: 'name' };
            const role = el.getAttribute('role');
            if (role) return { locator: `[role="${role}"]`, strategy: 'role' };
            const classes = Array.from(el.classList).filter((c) => /^[a-zA-Z_-][\w-]*$/.test(c)).slice(0, 2);
            if (classes.length > 0) return { locator: `${el.tagName.toLowerCase()}.${classes.join('.')}`, strategy: 'css' };
            return { locator: el.tagName.toLowerCase(), strategy: 'css' };
          };

          const elements: Omit<DomElementInfo, 'id'>[] = [];
          const seenLocators = new Set<string>();
          const pushEl = (item: Omit<DomElementInfo, 'id'>) => {
            const key = `${item.category}:${item.locator}:${item.text}`;
            if (seenLocators.has(key) || elements.length >= 80) return;
            seenLocators.add(key);
            elements.push(item);
          };

          document.querySelectorAll('button, [role="button"], input[type="submit"], input[type="button"]').forEach((el) => {
            const { locator, strategy } = buildLocator(el);
            pushEl({
              tag: el.tagName.toLowerCase(),
              category: 'button',
              role: el.getAttribute('role') || 'button',
              text: cleanText(el) || el.getAttribute('value') || el.getAttribute('aria-label') || 'Button',
              type: el.getAttribute('type') || undefined,
              locator,
              locatorStrategy: strategy,
            });
          });

          document.querySelectorAll('a[href]').forEach((el) => {
            const { locator, strategy } = buildLocator(el);
            pushEl({
              tag: 'a',
              category: 'link',
              role: 'link',
              text: cleanText(el) || el.getAttribute('aria-label') || el.getAttribute('href') || 'Link',
              href: el.getAttribute('href') || undefined,
              locator,
              locatorStrategy: strategy,
            });
          });

          document.querySelectorAll('form').forEach((el) => {
            const { locator, strategy } = buildLocator(el);
            pushEl({
              tag: 'form',
              category: 'form',
              text: el.getAttribute('aria-label') || el.getAttribute('name') || el.getAttribute('action') || 'Form',
              locator,
              locatorStrategy: strategy,
            });
          });

          document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea').forEach((el) => {
            const type = (el.getAttribute('type') || 'text').toLowerCase();
            const { locator, strategy } = buildLocator(el);
            pushEl({
              tag: el.tagName.toLowerCase(),
              category: type === 'file' ? 'upload' : 'input',
              text: el.getAttribute('placeholder') || el.getAttribute('aria-label') || el.getAttribute('name') || type,
              type,
              name: el.getAttribute('name') || undefined,
              placeholder: el.getAttribute('placeholder') || undefined,
              required: el.hasAttribute('required'),
              locator,
              locatorStrategy: strategy,
            });
          });

          document.querySelectorAll('select').forEach((el) => {
            const { locator, strategy } = buildLocator(el);
            const options = Array.from(el.querySelectorAll('option'))
              .map((o) => cleanText(o))
              .filter(Boolean)
              .slice(0, 8);
            pushEl({
              tag: 'select',
              category: 'dropdown',
              text: el.getAttribute('aria-label') || el.getAttribute('name') || 'Dropdown',
              name: el.getAttribute('name') || undefined,
              options,
              locator,
              locatorStrategy: strategy,
            });
          });

          document.querySelectorAll('nav, [role="menu"], [role="menubar"]').forEach((el) => {
            const { locator, strategy } = buildLocator(el);
            pushEl({
              tag: el.tagName.toLowerCase(),
              category: 'menu',
              role: el.getAttribute('role') || 'navigation',
              text: el.getAttribute('aria-label') || 'Navigation Menu',
              locator,
              locatorStrategy: strategy,
            });
          });

          document.querySelectorAll('table').forEach((el) => {
            const { locator, strategy } = buildLocator(el);
            const rows = el.querySelectorAll('tr').length;
            pushEl({
              tag: 'table',
              category: 'table',
              text: `Table (${rows} rows)`,
              locator,
              locatorStrategy: strategy,
            });
          });

          document.querySelectorAll('img').forEach((el) => {
            const { locator, strategy } = buildLocator(el);
            pushEl({
              tag: 'img',
              category: 'image',
              text: el.getAttribute('alt') || 'Image',
              src: el.getAttribute('src') || undefined,
              alt: el.getAttribute('alt') ?? undefined,
              locator,
              locatorStrategy: strategy,
            });
          });

          document.querySelectorAll('[role="tab"], [role="dialog"], [role="combobox"], [aria-expanded]').forEach((el) => {
            const { locator, strategy } = buildLocator(el);
            pushEl({
              tag: el.tagName.toLowerCase(),
              category: 'dynamic',
              role: el.getAttribute('role') || 'interactive',
              text: cleanText(el) || el.getAttribute('aria-label') || 'Dynamic Widget',
              locator,
              locatorStrategy: strategy,
            });
          });

          const headings = Array.from(document.querySelectorAll('h1, h2, h3'))
            .map((h) => cleanText(h))
            .filter(Boolean)
            .slice(0, 12);

          const hasLoginForm = Boolean(
            document.querySelector('input[type="password"]') ||
              document.querySelector('form[action*="login"], form[action*="signin"]')
          );
          const hasSearchForm = Boolean(
            document.querySelector('input[type="search"], input[name*="search" i], input[placeholder*="search" i], [role="search"]')
          );
          const hasFileUpload = Boolean(document.querySelector('input[type="file"]'));

          // Detect unsupported / manual-only elements on page
          const unsupported: { category: string; detail: string; manualReason: string }[] = [];
          const canvases = document.querySelectorAll('canvas').length;
          if (canvases > 0) {
            unsupported.push({
              category: 'HTML5 Canvas / WebGL',
              detail: `${canvases} <canvas> element(s) detected`,
              manualReason: 'Pixel-based canvas rendering requires visual/manual verification beyond standard DOM selectors.',
            });
          }
          const iframes = Array.from(document.querySelectorAll('iframe'));
          const crossOriginIframes = iframes.filter((f) => {
            const src = f.getAttribute('src') || '';
            return src.startsWith('http') && !src.startsWith(window.location.origin);
          });
          if (crossOriginIframes.length > 0) {
            unsupported.push({
              category: 'Cross-Origin Iframe',
              detail: `${crossOriginIframes.length} third-party <iframe> frame(s) detected`,
              manualReason: 'Browser same-origin policy blocks automated cross-origin DOM inspection without explicit frame targeting.',
            });
          }
          const mediaPlayers = document.querySelectorAll('video, audio').length;
          if (mediaPlayers > 0) {
            unsupported.push({
              category: 'Media Playback',
              detail: `${mediaPlayers} audio/video element(s) detected`,
              manualReason: 'Audio/video codec playback quality and streaming synchronization require manual QA checks.',
            });
          }
          const shadowHosts = Array.from(document.querySelectorAll('*')).filter((el) => Boolean(el.shadowRoot)).length;
          if (shadowHosts > 0) {
            unsupported.push({
              category: 'Closed/Nested Shadow DOM',
              detail: `${shadowHosts} Web Component shadow root(s) detected`,
              manualReason: 'Encapsulated shadow DOM trees may require specialized shadow-piercing test review.',
            });
          }

          const a11yIssues: { severity: 'warning' | 'error'; rule: string; detail: string }[] = [];
          const imgsWithoutAlt = Array.from(document.querySelectorAll('img')).filter(
            (img) => !img.hasAttribute('alt')
          ).length;
          if (imgsWithoutAlt > 0) {
            a11yIssues.push({
              severity: 'error',
              rule: 'img-alt',
              detail: `${imgsWithoutAlt} image(s) missing alt attribute`,
            });
          }
          if (!document.documentElement.getAttribute('lang')) {
            a11yIssues.push({
              severity: 'warning',
              rule: 'html-has-lang',
              detail: 'Document <html> element is missing a lang attribute',
            });
          }
          if (document.querySelectorAll('h1').length === 0) {
            a11yIssues.push({
              severity: 'warning',
              rule: 'page-has-heading-one',
              detail: 'No primary <h1> heading found on page',
            });
          }
          const unlabeledInputs = Array.from(
            document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"])')
          ).filter((inp) => {
            const id = inp.getAttribute('id');
            const hasLabel = id && document.querySelector(`label[for="${id}"]`);
            return !hasLabel && !inp.getAttribute('aria-label') && !inp.getAttribute('placeholder');
          }).length;
          if (unlabeledInputs > 0) {
            a11yIssues.push({
              severity: 'error',
              rule: 'label',
              detail: `${unlabeledInputs} form input(s) lack an accessible label`,
            });
          }

          const desktopOverflow =
            document.documentElement.scrollWidth > window.innerWidth + 4;

          const counts = {
            buttons: document.querySelectorAll('button, [role="button"], input[type="submit"], input[type="button"]').length,
            links: document.querySelectorAll('a[href]').length,
            forms: document.querySelectorAll('form').length,
            inputs: document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea').length,
            dropdowns: document.querySelectorAll('select').length,
            menus: document.querySelectorAll('nav, [role="menu"], [role="menubar"]').length,
            tables: document.querySelectorAll('table').length,
            images: document.querySelectorAll('img').length,
            uploads: document.querySelectorAll('input[type="file"]').length,
            dynamicWidgets: document.querySelectorAll('[role="tab"], [role="dialog"], [role="combobox"], [aria-expanded]').length,
          };

          const rawLinks = Array.from(document.querySelectorAll('a[href]'))
            .map((a) => (a as HTMLAnchorElement).href)
            .filter((href) => href.startsWith('http://') || href.startsWith('https://'));

          return {
            title: document.title || 'Untitled Page',
            metaDescription:
              document.querySelector('meta[name="description"]')?.getAttribute('content') || '',
            lang: document.documentElement.getAttribute('lang') || '',
            headings,
            counts,
            elements,
            a11yIssues,
            desktopOverflow,
            hasLoginForm,
            hasSearchForm,
            hasFileUpload,
            unsupported,
            rawLinks: Array.from(new Set(rawLinks)).slice(0, 60),
          };
        });

        // Mobile viewport overflow check
        await page.setViewportSize({ width: 390, height: 844 });
        await page.waitForTimeout(150);
        const mobileOverflow = await page.evaluate(
          () => document.documentElement.scrollWidth > window.innerWidth + 4
        );

        const antiBot = detectAntiBot(htmlContent, domSnapshot.title, statusCode);
        if (antiBot && analyzedPages.length === 0) {
          rootAntiBot = antiBot;
        }

        const parsedFinal = new URL(finalUrl);
        const pagePath = parsedFinal.pathname || '/';

        for (const u of domSnapshot.unsupported) {
          unsupportedElements.push({
            pagePath,
            category: u.category,
            detail: u.detail,
            manualReason: u.manualReason,
          });
        }
        if (antiBot) {
          unsupportedElements.push({
            pagePath,
            category: 'CAPTCHA / Anti-Bot Guard',
            detail: antiBot,
            manualReason: 'Human challenge / bot protection prevents automated submission and requires manual QA or staging bypass token.',
          });
        }

        const internalLinks: string[] = [];
        for (const href of domSnapshot.rawLinks) {
          try {
            const parsed = new URL(href);
            const sameHost = parsed.hostname === targetUrl.hostname;
            const subdomainMatch =
              followSubdomains && parsed.hostname.endsWith(`.${targetUrl.hostname}`);
            if (sameHost || subdomainMatch) {
              const clean = `${parsed.origin}${parsed.pathname}${parsed.search}`;
              internalLinks.push(clean);
              discoveredUrls.add(clean);
              if (next.depth + 1 <= maxDepth) {
                if (!visited.has(clean) && queue.length < maxPages * 3) {
                  queue.push({ url: clean, depth: next.depth + 1 });
                }
              } else if (!visited.has(clean)) {
                recordSkip(clean, `Exceeded max crawl depth (${maxDepth})`);
              }
            }
          } catch {
            // Skip malformed links
          }
        }

        const brokenLinks =
          analyzedPages.length === 0
            ? await checkBrokenLinksSample(internalLinks, targetUrl.origin)
            : [];

        const analyzedPage: AnalyzedPage = {
          id: crypto.randomUUID(),
          url: finalUrl,
          path: pagePath,
          title: domSnapshot.title,
          statusCode,
          loadTimeMs,
          archetype: inferArchetype(
            parsedFinal.pathname,
            domSnapshot.title,
            domSnapshot.counts,
            domSnapshot.hasLoginForm,
            domSnapshot.hasSearchForm
          ),
          metaDescription: domSnapshot.metaDescription,
          lang: domSnapshot.lang,
          headings: domSnapshot.headings,
          elementCounts: domSnapshot.counts,
          elements: domSnapshot.elements.map((e, idx) => ({ ...e, id: `el-${idx + 1}` })),
          internalLinks: Array.from(new Set(internalLinks)).slice(0, 30),
          brokenLinks,
          accessibilityIssues: domSnapshot.a11yIssues,
          responsiveCheck: {
            desktopOverflow: domSnapshot.desktopOverflow,
            mobileOverflow,
          },
          hasLoginForm: domSnapshot.hasLoginForm,
          hasSearchForm: domSnapshot.hasSearchForm,
          hasFileUpload: domSnapshot.hasFileUpload,
          antiBotDetected: antiBot,
        };

        analyzedPages.push(analyzedPage);
        emit(
          'crawl',
          Math.min(92, pct + 6),
          `Analyzed ${analyzedPage.path} (${analyzedPage.archetype}) — ${analyzedPage.elements.length} interactive elements mapped`,
          antiBot ? 'warn' : 'success',
          analyzedPage
        );
      } catch (err) {
        // Fallback lightweight HTML inspection via fetch + cheerio if Playwright navigation fails
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 8000);
          const res = await fetch(urlCheck.url.toString(), {
            signal: controller.signal,
            headers: { 'User-Agent': 'AutomatorQA/2.0' },
          });
          clearTimeout(timer);
          const html = await res.text();
          const $ = cheerio.load(html);
          const title = $('title').text().trim() || urlCheck.url.hostname;
          const elements: DomElementInfo[] = [];
          $('a[href]').slice(0, 20).each((i, el) => {
            elements.push({
              id: `el-a-${i}`,
              tag: 'a',
              category: 'link',
              text: $(el).text().trim().slice(0, 60) || $(el).attr('href') || 'Link',
              href: $(el).attr('href'),
              locator: `a[href="${$(el).attr('href') || ''}"]`,
              locatorStrategy: 'css',
            });
          });
          $('button, input[type="submit"]').slice(0, 15).each((i, el) => {
            elements.push({
              id: `el-b-${i}`,
              tag: el.tagName,
              category: 'button',
              text: $(el).text().trim().slice(0, 60) || $(el).attr('value') || 'Button',
              locator: $(el).attr('id') ? `#${$(el).attr('id')}` : el.tagName,
              locatorStrategy: $(el).attr('id') ? 'id' : 'css',
            });
          });

          const fallbackPage: AnalyzedPage = {
            id: crypto.randomUUID(),
            url: urlCheck.url.toString(),
            path: urlCheck.url.pathname || '/',
            title,
            statusCode: res.status,
            loadTimeMs: 0,
            archetype: 'Other',
            metaDescription: $('meta[name="description"]').attr('content') || '',
            lang: $('html').attr('lang') || '',
            headings: $('h1, h2').map((_, h) => $(h).text().trim()).get().slice(0, 8),
            elementCounts: {
              buttons: $('button, input[type="submit"]').length,
              links: $('a[href]').length,
              forms: $('form').length,
              inputs: $('input:not([type="hidden"])').length,
              dropdowns: $('select').length,
              menus: $('nav').length,
              tables: $('table').length,
              images: $('img').length,
              uploads: $('input[type="file"]').length,
              dynamicWidgets: 0,
            },
            elements,
            internalLinks: [],
            brokenLinks: [],
            accessibilityIssues: [],
            responsiveCheck: { desktopOverflow: false, mobileOverflow: false },
            hasLoginForm: $('input[type="password"]').length > 0,
            hasSearchForm: $('input[type="search"]').length > 0,
            hasFileUpload: $('input[type="file"]').length > 0,
            antiBotDetected: detectAntiBot(html, title, res.status),
          };
          analyzedPages.push(fallbackPage);
          const fallbackReason = err instanceof Error ? err.message : String(err);
          emit('crawl', 80, `Analyzed ${fallbackPage.path} via static HTTP inspection (${fallbackReason}).`, 'warn', fallbackPage);
        } catch (fallbackErr) {
          const reason = err instanceof Error ? err.message : String(fallbackErr);
          recordSkip(urlCheck.url.toString(), `Navigation failed: ${reason}`);
          emit(
            'crawl',
            pct,
            `Failed to load ${urlCheck.url.pathname}: ${reason}`,
            'error'
          );
        }
      } finally {
        await page.close().catch(() => {});
      }
    }

    // Any URLs remaining in queue were discovered but skipped due to maxPages limit
    for (const rem of queue) {
      const norm = rem.url.split('#')[0];
      if (!visited.has(norm)) {
        recordSkip(norm, `Stopped after reaching max crawl limit (${maxPages} page(s))`);
      }
    }

    await context.close().catch(() => {});
  } finally {
    await browser.close().catch(() => {});
  }

  const totalElements = analyzedPages.reduce(
    (sum, p) =>
      sum +
      p.elementCounts.buttons +
      p.elementCounts.links +
      p.elementCounts.inputs +
      p.elementCounts.dropdowns +
      p.elementCounts.tables,
    0
  );
  const totalForms = analyzedPages.reduce((sum, p) => sum + p.elementCounts.forms, 0);
  const totalLinks = analyzedPages.reduce((sum, p) => sum + p.elementCounts.links, 0);
  const brokenLinksCount = analyzedPages.reduce((sum, p) => sum + p.brokenLinks.length, 0);
  const accessibilityIssuesCount = analyzedPages.reduce(
    (sum, p) => sum + p.accessibilityIssues.length,
    0
  );
  const avgLoadTimeMs =
    analyzedPages.length > 0
      ? Math.round(
          analyzedPages.reduce((sum, p) => sum + p.loadTimeMs, 0) / analyzedPages.length
        )
      : 0;
  const responsiveReady = analyzedPages.every(
    (p) => !p.responsiveCheck.desktopOverflow && !p.responsiveCheck.mobileOverflow
  );

  const coverageScope: WebsiteAnalysisReport['coverageScope'] =
    analyzedPages.length <= 1
      ? 'single-page'
      : skippedPages.length > 0
        ? 'partial-crawl'
        : 'full-discovered';

  const report: WebsiteAnalysisReport = {
    id: crypto.randomUUID(),
    url: targetUrl.toString(),
    finalUrl: rootFinalUrl,
    accessible: analyzedPages.length > 0 && analyzedPages[0].statusCode < 500,
    robotsAllowed: robots.allowed,
    robotsSummary: robots.summary,
    antiBotDetected: rootAntiBot,
    analyzedAt: new Date().toISOString(),
    durationMs: Date.now() - startTime,
    pages: analyzedPages,
    discoveredUrls: Array.from(discoveredUrls),
    skippedPages,
    unsupportedElements,
    coverageScope,
    summary: {
      totalPages: analyzedPages.length,
      totalElements,
      totalForms,
      totalLinks,
      brokenLinksCount,
      accessibilityIssuesCount,
      avgLoadTimeMs,
      responsiveReady,
    },
  };

  emit('complete', 100, `Analysis complete: ${analyzedPages.length} inspected (${discoveredUrls.size} discovered, ${skippedPages.length} skipped), ${totalElements} elements mapped.`, 'success');
  return report;
}
