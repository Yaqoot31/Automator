import fs from 'node:fs';
import { chromium, type Browser, type BrowserContext } from 'playwright-core';
import { isQuickSafeSubrequestUrl } from './security.js';

const CANDIDATE_EXECUTABLES = [
  process.env.CHROMIUM_EXECUTABLE_PATH,
  '/ms-playwright/chrome-headless-shell-linux64/chrome-headless-shell',
  '/ms-playwright/chromium_headless_shell-1247/chrome-headless-shell-linux64/chrome-headless-shell',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
].filter((p): p is string => Boolean(p));

export function findChromiumExecutable(): string | undefined {
  for (const p of CANDIDATE_EXECUTABLES) {
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

export async function launchIsolatedBrowser(): Promise<Browser> {
  const executablePath = findChromiumExecutable();
  return chromium.launch({
    ...(executablePath ? { executablePath } : {}),
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-background-networking',
    ],
  });
}

export async function createSafeContext(
  browser: Browser,
  options: {
    width?: number;
    height?: number;
    userAgent?: string;
    ignoreHTTPSErrors?: boolean;
  } = {}
): Promise<BrowserContext> {
  const context = await browser.newContext({
    viewport: { width: options.width ?? 1440, height: options.height ?? 900 },
    userAgent:
      options.userAgent ??
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 AutomatorQA/2.0',
    ignoreHTTPSErrors: options.ignoreHTTPSErrors ?? false,
    javaScriptEnabled: true,
  });

  // Polyfill esbuild/tsx keepNames helper (__name) inside browser evaluate contexts
  await context.addInitScript('window.__name = window.__name || function(target) { return target; };');

  // Enforce SSRF protection on every subresource, XHR, and navigation redirect inside Playwright
  await context.route('**/*', async (route) => {
    const reqUrl = route.request().url();
    if (reqUrl.startsWith('data:') || reqUrl.startsWith('blob:') || reqUrl === 'about:blank') {
      await route.continue();
      return;
    }
    if (!isQuickSafeSubrequestUrl(reqUrl)) {
      await route.abort('blockedbyclient');
      return;
    }
    await route.continue();
  });

  return context;
}
