import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';
import type {
  AutomationProject,
  TestCase,
  TestRunItemResult,
  TestRunLogEntry,
  TestRunRecord,
} from '../src/types/index.js';
import { createSafeContext, launchIsolatedBrowser } from './browser.js';
import { SCREENSHOTS_DIR, getProjectDecryptedSecrets, saveProject, saveTestRun } from './db.js';
import { validatePublicUrl } from './security.js';

export type RunUpdateBroadcast = (event: {
  type: 'run:started' | 'run:log' | 'run:test_complete' | 'run:finished';
  runId: string;
  projectId: string;
  payload: unknown;
}) => void;

const activeAbortControllers = new Map<string, AbortController>();

export function cancelTestRun(runId: string): boolean {
  const ctrl = activeAbortControllers.get(runId);
  if (!ctrl) return false;
  ctrl.abort();
  return true;
}

function getViewportSize(project: AutomationProject): { width: number; height: number; label: string } {
  const cfg = project.config;
  switch (cfg.viewport) {
    case 'mobile':
      return { width: 390, height: 844, label: 'Mobile (390×844)' };
    case 'tablet':
      return { width: 768, height: 1024, label: 'Tablet (768×1024)' };
    case 'laptop':
      return { width: 1280, height: 800, label: 'Laptop (1280×800)' };
    case 'custom':
      return {
        width: Math.min(Math.max(cfg.customWidth || 1440, 320), 2560),
        height: Math.min(Math.max(cfg.customHeight || 900, 480), 1600),
        label: `Custom (${cfg.customWidth}×${cfg.customHeight})`,
      };
    case 'desktop':
    default:
      return { width: 1440, height: 900, label: 'Desktop (1440×900)' };
  }
}

function getBrowserUserAgent(browser: AutomationProject['config']['browser']): string {
  switch (browser) {
    case 'firefox':
      return 'Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0 AutomatorQA/2.0';
    case 'edge':
      return 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0 AutomatorQA/2.0';
    case 'chrome':
    default:
      return 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 AutomatorQA/2.0';
  }
}

export async function startIsolatedTestRun(params: {
  project: AutomationProject;
  testCaseIds?: string[];
  broadcast: RunUpdateBroadcast;
}): Promise<TestRunRecord> {
  const { project, testCaseIds, broadcast } = params;
  const urlValidation = await validatePublicUrl(project.config.baseUrl || project.url);
  if (!urlValidation.valid) {
    throw new Error(urlValidation.error || 'Target URL failed SSRF validation.');
  }

  const selectedTests = project.testCases.filter((tc) =>
    testCaseIds && testCaseIds.length > 0 ? testCaseIds.includes(tc.id) : tc.enabled
  );

  if (selectedTests.length === 0) {
    throw new Error('No enabled test cases selected for execution.');
  }

  const viewport = getViewportSize(project);
  const runId = crypto.randomUUID();
  const startedAt = new Date().toISOString();

  const initialRun: TestRunRecord = {
    id: runId,
    projectId: project.id,
    userId: project.userId,
    projectName: project.name,
    browser: project.config.browser,
    viewport: viewport.label,
    headless: project.config.headless,
    status: 'running',
    totalTests: selectedTests.length,
    passed: 0,
    failed: 0,
    skipped: 0,
    durationMs: 0,
    results: [],
    logs: [
      {
        timestamp: startedAt,
        level: 'info',
        message: `Queued isolated execution for ${selectedTests.length} test(s) on ${project.config.browser} (${viewport.label})`,
      },
    ],
    startedAt,
  };

  await saveTestRun(initialRun);
  broadcast({
    type: 'run:started',
    runId,
    projectId: project.id,
    payload: initialRun,
  });

  const isServerless = Boolean(process.env.VERCEL || process.env.VERCEL_ENV);
  if (isServerless) {
    // Vercel serverless freezes background tasks after HTTP response; execute synchronously within request lifecycle
    await executeRunInBackground({
      run: initialRun,
      project,
      selectedTests,
      viewport,
      broadcast,
    });
  } else {
    void executeRunInBackground({
      run: initialRun,
      project,
      selectedTests,
      viewport,
      broadcast,
    }).catch((err) => {
      console.error('[testRunner] Unhandled background execution error:', err);
    });
  }

  return initialRun;
}

async function runSingleTestWithHttp(params: {
  tc: TestCase;
  project: AutomationProject;
  timeoutMs: number;
  signal: AbortSignal;
}): Promise<{ passed: boolean; actualResult: string; errorMessage?: string }> {
  const { tc, project, timeoutMs, signal } = params;
  let currentUrl = project.config.baseUrl || project.url;
  let currentHtml = '';
  let lastStatus = 200;
  let navDuration = 0;
  let $: cheerio.CheerioAPI | null = null;

  const ensureLoaded = async (urlToFetch: string) => {
    const urlCheck = await validatePublicUrl(urlToFetch);
    if (!urlCheck.valid || !urlCheck.url) {
      throw new Error(`Blocked unsafe URL: ${urlToFetch}`);
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), Math.min(timeoutMs, 8000));
    const onAbort = () => ctrl.abort();
    signal.addEventListener('abort', onAbort, { once: true });
    try {
      const t0 = Date.now();
      const res = await fetch(urlCheck.url.toString(), {
        signal: ctrl.signal,
        headers: { 'User-Agent': getBrowserUserAgent(project.config.browser) },
      });
      navDuration = Date.now() - t0;
      lastStatus = res.status;
      currentUrl = res.url || urlCheck.url.toString();
      if (lastStatus >= 500) {
        throw new Error(`Server returned HTTP ${lastStatus}`);
      }
      currentHtml = await res.text();
      $ = cheerio.load(currentHtml);
    } finally {
      clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
    }
  };

  for (const step of tc.steps) {
    if (signal.aborted) {
      throw new Error('Cancelled by user');
    }
    if (step.action === 'navigate') {
      await ensureLoaded(step.target);
    } else if (step.action === 'assert_status') {
      await ensureLoaded(step.target);
    } else if (step.action === 'assert_visible') {
      if (!$) await ensureLoaded(currentUrl);
      if ($ && step.target && step.target !== 'body' && $(step.target).length === 0) {
        throw new Error(`Selector "${step.target}" not found in HTML response`);
      }
    } else if (step.action === 'assert_text') {
      if (!$) await ensureLoaded(currentUrl);
      if (step.target === 'title') {
        const title = $ ? $('title').text().trim() : '';
        if (!title) throw new Error('Document title was empty');
      } else if ($) {
        const txt = $(step.target).first().text().trim();
        if (!txt) throw new Error(`Element ${step.target} had empty text`);
      }
    } else if (step.action === 'assert_url') {
      if (!currentUrl.includes(step.target)) {
        throw new Error(`Expected URL to contain "${step.target}", got "${currentUrl}"`);
      }
    } else if (step.action === 'check_perf') {
      const budget = Number(step.target) || 5000;
      if (navDuration > budget) {
        throw new Error(`Load duration ${navDuration}ms exceeded ${budget}ms threshold`);
      }
    } else if (step.action === 'check_a11y') {
      if (!$) await ensureLoaded(currentUrl);
      if ($) {
        const missingAlt = $('img').filter((_, img) => $(img).attr('alt') === undefined).length;
        if (missingAlt > 0) {
          throw new Error(`${missingAlt} image(s) missing alt attributes`);
        }
      }
    } else if (step.action === 'check_links' && $) {
      const hrefs = $('a[href]')
        .map((_, a) => $(a).attr('href') || '')
        .get()
        .map((h) => {
          try {
            return new URL(h, currentUrl).toString();
          } catch {
            return '';
          }
        })
        .filter((h) => h.startsWith('http://') || h.startsWith('https://'))
        .slice(0, 5);
      for (const href of hrefs) {
        const safe = await validatePublicUrl(href);
        if (!safe.valid || !safe.url) continue;
        const resp = await fetch(safe.url.toString(), {
          method: 'HEAD',
          headers: { 'User-Agent': 'AutomatorQA/2.0' },
        }).catch(() => null);
        if (resp && resp.status >= 400 && resp.status !== 405) {
          throw new Error(`Broken link HTTP ${resp.status}: ${href}`);
        }
      }
    } else if ((step.action === 'type' || step.action === 'click') && $) {
      if ($(step.target).length === 0) {
        throw new Error(`Interactive target "${step.target}" not present in static DOM`);
      }
    }
  }

  return {
    passed: true,
    actualResult: `Verified via HTTP + DOM check (HTTP ${lastStatus}, ${navDuration}ms)`,
  };
}

async function executeRunInBackground(params: {
  run: TestRunRecord;
  project: AutomationProject;
  selectedTests: TestCase[];
  viewport: { width: number; height: number; label: string };
  broadcast: RunUpdateBroadcast;
}) {
  const { run, project, selectedTests, viewport, broadcast } = params;
  const abortController = new AbortController();
  activeAbortControllers.set(run.id, abortController);
  const runStart = Date.now();
  const runScreenshotDir = path.join(SCREENSHOTS_DIR, run.id);

  const pushLog = (level: TestRunLogEntry['level'], message: string) => {
    const entry: TestRunLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
    };
    run.logs.push(entry);
    broadcast({
      type: 'run:log',
      runId: run.id,
      projectId: project.id,
      payload: entry,
    });
  };

  let browser: Awaited<ReturnType<typeof launchIsolatedBrowser>> | null = null;

  try {
    const secrets = await getProjectDecryptedSecrets(project.id);
    if (Object.keys(secrets).length > 0) {
      pushLog('info', `Loaded ${Object.keys(secrets).length} encrypted runtime secret(s) into isolated context.`);
    }

    if (project.config.browser !== 'chrome') {
      pushLog(
        'info',
        `Using isolated Chromium headless engine with ${project.config.browser} User-Agent profile.`
      );
    }

    const timeoutMs = Math.min(Math.max(project.config.timeoutMs || 15000, 3000), 30000);
    const maxRetries = Math.min(Math.max(project.config.retries || 0, 0), 2);

    try {
      browser = await launchIsolatedBrowser();
    } catch (launchErr) {
      pushLog(
        'warn',
        `Headless Chromium unavailable in runtime (${launchErr instanceof Error ? launchErr.message : 'missing binary'}); executing HTTP + Cheerio verification fallback.`
      );
    }

    if (!browser) {
      for (const tc of selectedTests) {
        if (abortController.signal.aborted) {
          run.skipped += 1;
          run.results.push({
            testCaseId: tc.id,
            code: tc.code,
            title: tc.title,
            category: tc.category,
            status: 'skipped',
            durationMs: 0,
            actualResult: 'Skipped due to user cancellation.',
          });
          continue;
        }
        pushLog('info', `Running ${tc.code}: ${tc.title}`);
        const tcStart = Date.now();
        let passed = false;
        let actualResult = '';
        let errorMessage: string | undefined;
        try {
          const out = await runSingleTestWithHttp({
            tc,
            project,
            timeoutMs,
            signal: abortController.signal,
          });
          passed = out.passed;
          actualResult = out.actualResult;
        } catch (err) {
          errorMessage = err instanceof Error ? err.message : String(err);
          actualResult = `Failed: ${errorMessage}`;
        }
        const tcDuration = Date.now() - tcStart;
        const itemResult: TestRunItemResult = {
          testCaseId: tc.id,
          code: tc.code,
          title: tc.title,
          category: tc.category,
          status: passed ? 'passed' : 'failed',
          durationMs: tcDuration,
          actualResult,
          errorMessage: passed ? undefined : errorMessage,
        };
        if (passed) {
          run.passed += 1;
          pushLog('success', `PASS ${tc.code} (${tcDuration}ms) — ${actualResult}`);
        } else {
          run.failed += 1;
          pushLog('error', `FAIL ${tc.code} (${tcDuration}ms) — ${errorMessage}`);
        }
        run.results.push(itemResult);
        run.durationMs = Date.now() - runStart;
        await saveTestRun(run);
      }
      run.status = abortController.signal.aborted
        ? 'cancelled'
        : run.failed > 0
          ? 'failed'
          : 'completed';
    } else {
      const context = await createSafeContext(browser, {
        width: viewport.width,
        height: viewport.height,
        userAgent: getBrowserUserAgent(project.config.browser),
      });

      for (const tc of selectedTests) {
        if (abortController.signal.aborted) {
          run.skipped += 1;
          run.results.push({
            testCaseId: tc.id,
            code: tc.code,
            title: tc.title,
            category: tc.category,
            status: 'skipped',
            durationMs: 0,
            actualResult: 'Skipped due to user cancellation.',
          });
          continue;
        }

        pushLog('info', `Running ${tc.code}: ${tc.title}`);
        const tcStart = Date.now();
        let passed = false;
        let actualResult = '';
        let errorMessage: string | undefined;
        let screenshotUrl: string | undefined;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          if (attempt > 0) {
            pushLog('warn', `Retrying ${tc.code} (attempt ${attempt + 1}/${maxRetries + 1})...`);
          }

          const page = await context.newPage();
          const pageErrors: string[] = [];
          page.on('pageerror', (e) => pageErrors.push(e.message));

          try {
            let lastStatus = 200;
            let navDuration = 0;

            for (const step of tc.steps) {
              if (step.action === 'navigate') {
                const urlCheck = await validatePublicUrl(step.target);
                if (!urlCheck.valid || !urlCheck.url) {
                  throw new Error(`Blocked unsafe URL in step ${step.stepNumber}: ${step.target}`);
                }
                const t0 = Date.now();
                const res = await page.goto(urlCheck.url.toString(), {
                  waitUntil: 'domcontentloaded',
                  timeout: timeoutMs,
                });
                await page.waitForTimeout(250);
                navDuration = Date.now() - t0;
                lastStatus = res?.status() ?? 200;
                if (lastStatus >= 500) {
                  throw new Error(`Server returned HTTP ${lastStatus}`);
                }
              } else if (step.action === 'assert_visible') {
                const loc = page.locator(step.target).first();
                await loc.waitFor({ state: 'visible', timeout: Math.min(timeoutMs, 7000) });
              } else if (step.action === 'assert_text') {
                if (step.target === 'title') {
                  const title = await page.title();
                  if (!title || !title.trim()) {
                    throw new Error('Document title was empty');
                  }
                } else {
                  const txt = await page.locator(step.target).first().textContent({ timeout: 5000 });
                  if (!txt || !txt.trim()) {
                    throw new Error(`Element ${step.target} had empty text`);
                  }
                }
              } else if (step.action === 'type') {
                const loc = page.locator(step.target).first();
                await loc.waitFor({ state: 'visible', timeout: 5000 });
                const rawVal = step.value || 'Automator QA';
                const resolvedVal = rawVal.startsWith('$SECRET:')
                  ? secrets[rawVal.slice(8)] || 'test-placeholder'
                  : rawVal;
                await loc.fill(resolvedVal);
                const val = await loc.inputValue().catch(() => '');
                if (!val) {
                  throw new Error(`Input ${step.target} did not retain entered text`);
                }
              } else if (step.action === 'click') {
                await page.locator(step.target).first().click({ timeout: 5000 });
              } else if (step.action === 'assert_url') {
                const current = page.url();
                if (!current.includes(step.target)) {
                  throw new Error(`Expected URL to contain "${step.target}", got "${current}"`);
                }
              } else if (step.action === 'assert_status') {
                const urlCheck = await validatePublicUrl(step.target);
                if (!urlCheck.valid || !urlCheck.url) {
                  throw new Error('Blocked unsafe status-check URL');
                }
                const res = await page.goto(urlCheck.url.toString(), {
                  waitUntil: 'domcontentloaded',
                  timeout: timeoutMs,
                });
                const status = res?.status() ?? 200;
                if (status >= 500) {
                  throw new Error(`Target returned 5xx server error (HTTP ${status})`);
                }
              } else if (step.action === 'check_responsive') {
                await page.setViewportSize({ width: 1440, height: 900 });
                const desktopOverflow = await page.evaluate(
                  () => document.documentElement.scrollWidth > window.innerWidth + 4
                );
                await page.setViewportSize({ width: 390, height: 844 });
                await page.waitForTimeout(150);
                const mobileOverflow = await page.evaluate(
                  () => document.documentElement.scrollWidth > window.innerWidth + 4
                );
                await page.setViewportSize({ width: viewport.width, height: viewport.height });
                if (desktopOverflow || mobileOverflow) {
                  throw new Error(
                    `Horizontal overflow detected (desktop=${desktopOverflow}, mobile=${mobileOverflow})`
                  );
                }
              } else if (step.action === 'check_perf') {
                const budget = Number(step.target) || 5000;
                if (navDuration > budget) {
                  throw new Error(`Load duration ${navDuration}ms exceeded ${budget}ms threshold`);
                }
              } else if (step.action === 'check_a11y') {
                const issues = await page.evaluate(() => {
                  const imgs = Array.from(document.querySelectorAll('img')).filter(
                    (img) => !img.hasAttribute('alt')
                  ).length;
                  return { imgs };
                });
                if (issues.imgs > 0) {
                  throw new Error(`${issues.imgs} image(s) missing alt attributes`);
                }
              } else if (step.action === 'check_links') {
                const hrefs = await page.evaluate(() =>
                  Array.from(document.querySelectorAll('a[href]'))
                    .map((a) => (a as HTMLAnchorElement).href)
                    .filter((h) => h.startsWith('http://') || h.startsWith('https://'))
                    .slice(0, 5)
                );
                for (const href of hrefs) {
                  const safe = await validatePublicUrl(href);
                  if (!safe.valid || !safe.url) continue;
                  const resp = await fetch(safe.url.toString(), {
                    method: 'HEAD',
                    headers: { 'User-Agent': 'AutomatorQA/2.0' },
                  }).catch(() => null);
                  if (resp && resp.status >= 400 && resp.status !== 405) {
                    throw new Error(`Broken link HTTP ${resp.status}: ${href}`);
                  }
                }
              }
            }

            if (tc.category === 'browser-compat' && pageErrors.length > 0) {
              throw new Error(`Uncaught pageerror: ${pageErrors[0]}`);
            }

            passed = true;
            actualResult = `Verified in ${Date.now() - tcStart}ms (HTTP ${lastStatus})`;
            break;
          } catch (err) {
            errorMessage = err instanceof Error ? err.message : String(err);
            actualResult = `Failed: ${errorMessage}`;
            if (attempt === maxRetries && project.config.captureScreenshots) {
              try {
                if (!fs.existsSync(runScreenshotDir)) {
                  fs.mkdirSync(runScreenshotDir, { recursive: true });
                }
                const fileName = `${tc.code.replace(/[^a-zA-Z0-9_-]/g, '_')}.png`;
                const fullPath = path.join(runScreenshotDir, fileName);
                await page.screenshot({ path: fullPath, fullPage: false });
                screenshotUrl = `/api/screenshots/${run.id}/${fileName}`;
              } catch {
                // Ignore screenshot capture errors
              }
            }
          } finally {
            await page.close().catch(() => {});
          }
        }

        const tcDuration = Date.now() - tcStart;
        const itemResult: TestRunItemResult = {
          testCaseId: tc.id,
          code: tc.code,
          title: tc.title,
          category: tc.category,
          status: passed ? 'passed' : 'failed',
          durationMs: tcDuration,
          actualResult,
          screenshotUrl,
          errorMessage: passed ? undefined : errorMessage,
        };

        if (passed) {
          run.passed += 1;
          pushLog('success', `PASS ${tc.code} (${tcDuration}ms) — ${actualResult}`);
        } else {
          run.failed += 1;
          pushLog('error', `FAIL ${tc.code} (${tcDuration}ms) — ${errorMessage}`);
        }

        run.results.push(itemResult);
        run.durationMs = Date.now() - runStart;
        await saveTestRun(run);

        broadcast({
          type: 'run:test_complete',
          runId: run.id,
          projectId: project.id,
          payload: {
            result: itemResult,
            runSummary: {
              passed: run.passed,
              failed: run.failed,
              skipped: run.skipped,
              totalTests: run.totalTests,
              durationMs: run.durationMs,
            },
          },
        });
      }

      await context.close().catch(() => {});
      run.status = abortController.signal.aborted
        ? 'cancelled'
        : run.failed > 0
          ? 'failed'
          : 'completed';
    }
  } catch (fatalErr) {
    const msg = fatalErr instanceof Error ? fatalErr.message : String(fatalErr);
    pushLog('error', `Run terminated: ${msg}`);
    run.status = 'failed';
  } finally {
    activeAbortControllers.delete(run.id);
    if (browser) await browser.close().catch(() => {});
    run.durationMs = Date.now() - runStart;
    run.completedAt = new Date().toISOString();
    pushLog(
      run.failed === 0 ? 'success' : 'warn',
      `Execution finished: ${run.passed} passed, ${run.failed} failed, ${run.skipped} skipped in ${run.durationMs}ms.`
    );
    try {
      await saveTestRun(run);

      const latestProject = project;
      const resultMap = new Map(run.results.map((r) => [r.testCaseId, r]));
      latestProject.testCases = latestProject.testCases.map((tc) => {
        const r = resultMap.get(tc.id);
        if (!r) return tc;
        return {
          ...tc,
          status: r.status,
          actualResult: r.actualResult,
          durationMs: r.durationMs,
          screenshotUrl: r.screenshotUrl,
        };
      });
      latestProject.updatedAt = new Date().toISOString();
      await saveProject(latestProject);
    } catch (persistErr) {
      console.error('[testRunner] Failed to persist finished test run:', persistErr);
    }

    broadcast({
      type: 'run:finished',
      runId: run.id,
      projectId: project.id,
      payload: run,
    });
  }
}
