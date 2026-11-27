import crypto from 'node:crypto';
import type {
  AnalyzedPage,
  TestCase,
  TestCaseCategory,
  TestPriority,
  TestSeverity,
  TestingType,
  WebsiteAnalysisReport,
} from '../src/types/index.js';

function makeCode(index: number): string {
  return `TC-${String(index).padStart(3, '0')}`;
}

export const CATEGORY_LABELS: Record<TestCaseCategory, string> = {
  homepage: 'Homepage',
  navigation: 'Navigation & Links',
  buttons: 'Buttons & Actions',
  forms: 'Form Submissions',
  validation: 'Input Validation',
  search: 'Search',
  dropdowns: 'Dropdowns',
  auth: 'Authentication',
  responsive: 'Responsive UI',
  'broken-links': 'Broken Links',
  performance: 'Performance',
  'error-messages': 'Error Handling',
  'file-upload': 'File Uploads',
  redirects: 'Redirects',
  accessibility: 'Accessibility',
  'browser-compat': 'Browser Compatibility',
};

function defaultPriority(cat: TestCaseCategory): TestPriority {
  if (cat === 'homepage' || cat === 'auth' || cat === 'navigation') return 'Critical';
  if (cat === 'forms' || cat === 'validation' || cat === 'broken-links' || cat === 'responsive') return 'High';
  if (cat === 'accessibility' || cat === 'performance' || cat === 'search') return 'Medium';
  return 'Low';
}

function defaultSeverity(cat: TestCaseCategory): TestSeverity {
  if (cat === 'homepage' || cat === 'auth' || cat === 'broken-links') return 'Critical';
  if (cat === 'forms' || cat === 'validation' || cat === 'responsive' || cat === 'navigation') return 'Major';
  return 'Minor';
}

function defaultTestingType(cat: TestCaseCategory): TestingType {
  if (cat === 'homepage' || cat === 'navigation') return 'Smoke';
  if (cat === 'responsive') return 'Responsive';
  if (cat === 'browser-compat') return 'Cross-Browser';
  if (cat === 'forms' || cat === 'validation' || cat === 'auth' || cat === 'search' || cat === 'dropdowns') {
    return 'Functional';
  }
  return 'Automated';
}

function enrichCase(tc: TestCase): TestCase {
  const testData = tc.steps
    .filter((s) => s.value)
    .map((s) => `${s.target}: ${s.value}`)
    .join('; ');
  return {
    ...tc,
    module: tc.module || CATEGORY_LABELS[tc.category] || 'Core Module',
    testData: tc.testData || testData || 'N/A (DOM inspection)',
    priority: tc.priority || defaultPriority(tc.category),
    severity: tc.severity || defaultSeverity(tc.category),
    automationStatus: tc.automationStatus || 'Automated',
    testingType: tc.testingType || defaultTestingType(tc.category),
    sqaStatus: tc.sqaStatus || 'Not Run',
    actualResult: tc.actualResult || '',
    comments: tc.comments || '',
  };
}

export function generateTestCasesFromAnalysis(
  analysis: WebsiteAnalysisReport
): TestCase[] {
  const cases: TestCase[] = [];
  let seq = 1;

  const rootPage: AnalyzedPage | undefined = analysis.pages[0];
  if (!rootPage) return cases;

  // 1. Homepage Functionality
  cases.push({
    id: crypto.randomUUID(),
    code: makeCode(seq++),
    title: `Verify homepage loads with valid title and primary landmark (${rootPage.path})`,
    category: 'homepage',
    scenarioType: 'positive',
    pagePath: rootPage.path,
    scenario: 'Ensure the entry URL renders HTTP < 400, non-empty document title, and visible body content.',
    preconditions: `Target application ${analysis.url} is publicly accessible.`,
    steps: [
      {
        stepNumber: 1,
        action: 'navigate',
        target: rootPage.url,
        expected: 'Page loads with HTTP status 200-399',
      },
      {
        stepNumber: 2,
        action: 'assert_visible',
        target: 'body',
        expected: 'Primary page body is rendered and visible',
      },
      {
        stepNumber: 3,
        action: 'assert_text',
        target: 'title',
        value: rootPage.title,
        expected: `Page title matches or contains "${rootPage.title}"`,
      },
    ],
    expectedResult: 'Homepage renders completely with expected title and visible content.',
    status: 'pending',
    enabled: true,
  });

  // 2. Navigation and internal links
  const navLinks = rootPage.elements.filter((e) => e.category === 'link').slice(0, 3);
  if (navLinks.length > 0) {
    cases.push({
      id: crypto.randomUUID(),
      code: makeCode(seq++),
      title: `Verify primary navigation links are visible and interactive (${navLinks.length} sampled)`,
      category: 'navigation',
      scenarioType: 'positive',
      pagePath: rootPage.path,
      scenario: 'Check discovered internal navigation anchors are visible and have valid href destinations.',
      preconditions: `User is on ${rootPage.url}`,
      steps: [
        {
          stepNumber: 1,
          action: 'navigate',
          target: rootPage.url,
          expected: 'Homepage loads successfully',
        },
        ...navLinks.map((lnk, idx) => ({
          stepNumber: idx + 2,
          action: 'assert_visible' as const,
          target: lnk.locator,
          expected: `Navigation link "${lnk.text}" is visible`,
        })),
      ],
      expectedResult: 'All sampled navigation links render properly and remain clickable.',
      status: 'pending',
      enabled: true,
    });
  }

  // 3. Buttons and clickable elements
  const buttons = analysis.pages.flatMap((p) =>
    p.elements.filter((e) => e.category === 'button').map((b) => ({ page: p, btn: b }))
  );
  if (buttons.length > 0) {
    const first = buttons[0];
    cases.push({
      id: crypto.randomUUID(),
      code: makeCode(seq++),
      title: `Verify interactive button visibility and clickability: "${first.btn.text}"`,
      category: 'buttons',
      scenarioType: 'positive',
      pagePath: first.page.path,
      scenario: 'Confirm primary call-to-action button is visible and enabled in the DOM.',
      preconditions: `Navigate to ${first.page.url}`,
      steps: [
        { stepNumber: 1, action: 'navigate', target: first.page.url, expected: 'Page loads' },
        {
          stepNumber: 2,
          action: 'assert_visible',
          target: first.btn.locator,
          expected: `Button "${first.btn.text}" is visible and enabled`,
        },
      ],
      expectedResult: 'Interactive button is rendered and ready for user action.',
      status: 'pending',
      enabled: true,
    });
  }

  // 4 & 5 & 12. Form submissions, Input validation (negative & boundary), Error messages
  for (const page of analysis.pages) {
    const inputs = page.elements.filter((e) => e.category === 'input');
    const forms = page.elements.filter((e) => e.category === 'form');
    if (forms.length > 0 || inputs.length > 0) {
      const sampleInput = inputs[0];
      if (sampleInput) {
        cases.push({
          id: crypto.randomUUID(),
          code: makeCode(seq++),
          title: `Positive input entry on ${page.path} (${sampleInput.name || sampleInput.text})`,
          category: 'forms',
          scenarioType: 'positive',
          pagePath: page.path,
          scenario: 'Enter valid test data into detected input field and verify field accepts value.',
          preconditions: `Page ${page.url} loaded with form controls.`,
          steps: [
            { stepNumber: 1, action: 'navigate', target: page.url, expected: 'Page opens' },
            {
              stepNumber: 2,
              action: 'type',
              target: sampleInput.locator,
              value:
                sampleInput.type === 'email'
                  ? 'qa.automation@example.org'
                  : 'Automator Test Input',
              expected: 'Input field accepts and retains valid test string',
            },
          ],
          expectedResult: 'Input field validates and stores entered value without console errors.',
          status: 'pending',
          enabled: true,
        });

        cases.push({
          id: crypto.randomUUID(),
          code: makeCode(seq++),
          title: `Negative/Boundary validation on ${page.path} (${sampleInput.name || sampleInput.text})`,
          category: 'validation',
          scenarioType: 'negative',
          pagePath: page.path,
          scenario: 'Verify required/type constraints or boundary length input handling.',
          preconditions: `Page ${page.url} loaded.`,
          steps: [
            { stepNumber: 1, action: 'navigate', target: page.url, expected: 'Page opens' },
            {
              stepNumber: 2,
              action: 'assert_visible',
              target: sampleInput.locator,
              expected: 'Input constraint attributes verified',
            },
          ],
          expectedResult: 'Invalid or empty required fields trigger native or custom validation.',
          status: 'pending',
          enabled: true,
        });
      }
    }

    // 6. Search functionality
    if (page.hasSearchForm) {
      const searchInput = page.elements.find(
        (e) =>
          e.category === 'input' &&
          (e.type === 'search' ||
            (e.name || '').toLowerCase().includes('search') ||
            (e.placeholder || '').toLowerCase().includes('search'))
      );
      cases.push({
        id: crypto.randomUUID(),
        code: makeCode(seq++),
        title: `Search input interaction on ${page.path}`,
        category: 'search',
        scenarioType: 'positive',
        pagePath: page.path,
        scenario: 'Verify search input is reachable and accepts query strings.',
        preconditions: `User is on ${page.url}`,
        steps: [
          { stepNumber: 1, action: 'navigate', target: page.url, expected: 'Page opens' },
          {
            stepNumber: 2,
            action: 'type',
            target: searchInput?.locator || 'input[type="search"]',
            value: 'automation test query',
            expected: 'Search field accepts query text',
          },
        ],
        expectedResult: 'Search control responds cleanly to user input.',
        status: 'pending',
        enabled: true,
      });
    }

    // 7. Dropdown menus
    const dropdowns = page.elements.filter((e) => e.category === 'dropdown');
    if (dropdowns.length > 0) {
      const dd = dropdowns[0];
      cases.push({
        id: crypto.randomUUID(),
        code: makeCode(seq++),
        title: `Dropdown selection check on ${page.path} (${dd.name || dd.text})`,
        category: 'dropdowns',
        scenarioType: 'positive',
        pagePath: page.path,
        scenario: 'Verify <select> dropdown renders options and allows selection.',
        preconditions: `Page ${page.url} loaded.`,
        steps: [
          { stepNumber: 1, action: 'navigate', target: page.url, expected: 'Page opens' },
          {
            stepNumber: 2,
            action: 'assert_visible',
            target: dd.locator,
            expected: `Dropdown (${dd.options?.length ?? 0} options) is visible`,
          },
        ],
        expectedResult: 'Dropdown displays valid options and accepts selection.',
        status: 'pending',
        enabled: true,
      });
    }

    // 8. Login & Registration (only when authorized credentials are supplied)
    if (page.hasLoginForm) {
      cases.push({
        id: crypto.randomUUID(),
        code: makeCode(seq++),
        title: `Authentication form presence & negative empty-submit guard (${page.path})`,
        category: 'auth',
        scenarioType: 'negative',
        pagePath: page.path,
        scenario:
          'Verify login form fields are present. Authorized test credentials use encrypted secrets when configured.',
        preconditions: `Navigate to ${page.url}. Configure TEST_USERNAME / TEST_PASSWORD in project secrets for authorized login runs.`,
        steps: [
          { stepNumber: 1, action: 'navigate', target: page.url, expected: 'Login page loads' },
          {
            stepNumber: 2,
            action: 'assert_visible',
            target: 'input[type="password"]',
            expected: 'Password input is rendered with masked type="password"',
          },
        ],
        expectedResult: 'Authentication form protects password input and validates missing fields.',
        status: 'pending',
        enabled: true,
      });
    }

    // 13. File upload check
    if (page.hasFileUpload) {
      const uploadEl = page.elements.find((e) => e.category === 'upload');
      cases.push({
        id: crypto.randomUUID(),
        code: makeCode(seq++),
        title: `File upload input verification on ${page.path}`,
        category: 'file-upload',
        scenarioType: 'positive',
        pagePath: page.path,
        scenario: 'Confirm <input type="file"> element is present and accepts test fixture upload.',
        preconditions: `Page ${page.url} loaded.`,
        steps: [
          { stepNumber: 1, action: 'navigate', target: page.url, expected: 'Page loads' },
          {
            stepNumber: 2,
            action: 'assert_visible',
            target: uploadEl?.locator || 'input[type="file"]',
            expected: 'File upload input is present in DOM',
          },
        ],
        expectedResult: 'File input control is functional and accessible.',
        status: 'pending',
        enabled: true,
      });
    }
  }

  // 9. Responsive UI behavior
  cases.push({
    id: crypto.randomUUID(),
    code: makeCode(seq++),
    title: 'Responsive layout check across desktop (1440px) and mobile (390px) viewports',
    category: 'responsive',
    scenarioType: 'boundary',
    pagePath: rootPage.path,
    scenario: 'Verify zero horizontal viewport overflow on desktop and mobile screen widths.',
    preconditions: `Target URL ${rootPage.url} is accessible.`,
    steps: [
      { stepNumber: 1, action: 'navigate', target: rootPage.url, expected: 'Page loads' },
      {
        stepNumber: 2,
        action: 'check_responsive',
        target: rootPage.url,
        expected: 'scrollWidth <= innerWidth on both 1440x900 and 390x844 viewports',
      },
    ],
    expectedResult: 'UI adapts cleanly without horizontal clipping on desktop and mobile.',
    status: 'pending',
    enabled: true,
  });

  // 10. Broken links check
  cases.push({
    id: crypto.randomUUID(),
    code: makeCode(seq++),
    title: 'Broken internal links & HTTP status integrity check',
    category: 'broken-links',
    scenarioType: 'negative',
    pagePath: rootPage.path,
    scenario: 'Verify sampled internal links return HTTP < 400 without 404/500 responses.',
    preconditions: `Target URL ${rootPage.url} crawled.`,
    steps: [
      { stepNumber: 1, action: 'navigate', target: rootPage.url, expected: 'Page loads' },
      {
        stepNumber: 2,
        action: 'check_links',
        target: rootPage.url,
        expected: 'All sampled internal links respond with HTTP 2xx/3xx',
      },
    ],
    expectedResult: 'Zero broken internal links detected.',
    status: 'pending',
    enabled: true,
  });

  // 11. Page loading and performance checks
  cases.push({
    id: crypto.randomUUID(),
    code: makeCode(seq++),
    title: 'Page load latency & DOMContentLoaded threshold check (< 5000ms)',
    category: 'performance',
    scenarioType: 'boundary',
    pagePath: rootPage.path,
    scenario: 'Measure real browser navigation time and ensure page settles within budget.',
    preconditions: `Target URL ${rootPage.url} reachable.`,
    steps: [
      { stepNumber: 1, action: 'navigate', target: rootPage.url, expected: 'Page loads' },
      {
        stepNumber: 2,
        action: 'check_perf',
        target: '5000',
        expected: 'Navigation completes in under 5000ms',
      },
    ],
    expectedResult: 'Page renders within acceptable performance budget (< 5s).',
    status: 'pending',
    enabled: true,
  });

  // 12. Error messages & 404 handling
  cases.push({
    id: crypto.randomUUID(),
    code: makeCode(seq++),
    title: 'Non-existent route error page & graceful 404 handling check',
    category: 'error-messages',
    scenarioType: 'exploratory',
    pagePath: '/__automator_nonexistent_route_check__',
    scenario: 'Request an unknown route on target domain to verify safe error response.',
    preconditions: `Base origin ${new URL(rootPage.url).origin} is accessible.`,
    steps: [
      {
        stepNumber: 1,
        action: 'assert_status',
        target: `${new URL(rootPage.url).origin}/__automator_nonexistent_route_check__`,
        expected: 'Server responds gracefully (404 or SPA fallback) without 500 server crash',
      },
    ],
    expectedResult: 'Target returns clean 404 or SPA route without unhandled server errors.',
    status: 'pending',
    enabled: true,
  });

  // 14. Page redirects
  cases.push({
    id: crypto.randomUUID(),
    code: makeCode(seq++),
    title: 'Canonical URL & HTTP redirect consistency check',
    category: 'redirects',
    scenarioType: 'positive',
    pagePath: rootPage.path,
    scenario: 'Verify URL navigation resolves cleanly without redirect loops.',
    preconditions: `Target URL ${analysis.url}`,
    steps: [
      { stepNumber: 1, action: 'navigate', target: analysis.url, expected: 'Navigation resolves' },
      {
        stepNumber: 2,
        action: 'assert_url',
        target: new URL(analysis.finalUrl).hostname,
        expected: 'Final URL remains on authorized target hostname',
      },
    ],
    expectedResult: 'Redirects resolve cleanly to expected canonical destination.',
    status: 'pending',
    enabled: true,
  });

  // 15. Basic accessibility checks
  cases.push({
    id: crypto.randomUUID(),
    code: makeCode(seq++),
    title: 'Accessibility audit (image alt attributes, html lang, h1 landmark, input labels)',
    category: 'accessibility',
    scenarioType: 'positive',
    pagePath: rootPage.path,
    scenario: 'Validate baseline WCAG accessibility criteria across DOM nodes.',
    preconditions: `Page ${rootPage.url} rendered.`,
    steps: [
      { stepNumber: 1, action: 'navigate', target: rootPage.url, expected: 'Page loads' },
      {
        stepNumber: 2,
        action: 'check_a11y',
        target: rootPage.url,
        expected: 'Zero critical missing-alt or unlabeled-input accessibility errors',
      },
    ],
    expectedResult: 'Page passes baseline automated accessibility checks.',
    status: 'pending',
    enabled: true,
  });

  // 16. Browser compatibility check
  cases.push({
    id: crypto.randomUUID(),
    code: makeCode(seq++),
    title: 'Cross-browser DOM readiness & console error check',
    category: 'browser-compat',
    scenarioType: 'exploratory',
    pagePath: rootPage.path,
    scenario: 'Verify zero uncaught JavaScript page errors during initial render.',
    preconditions: `Target URL ${rootPage.url}`,
    steps: [
      { stepNumber: 1, action: 'navigate', target: rootPage.url, expected: 'Page loads' },
      {
        stepNumber: 2,
        action: 'assert_visible',
        target: 'body',
        expected: 'Document renders without uncaught runtime exceptions',
      },
    ],
    expectedResult: 'Application boots cleanly without fatal JavaScript runtime errors.',
    status: 'pending',
    enabled: true,
  });

  // 17. Manual review test cases for any unsupported elements detected on pages
  for (const unsup of (analysis.unsupportedElements || []).slice(0, 4)) {
    cases.push({
      id: crypto.randomUUID(),
      code: makeCode(seq++),
      title: `Manual QA verification: ${unsup.category} on ${unsup.pagePath}`,
      module: unsup.category,
      category: 'browser-compat',
      scenarioType: 'exploratory',
      pagePath: unsup.pagePath,
      scenario: `${unsup.detail}. ${unsup.manualReason}`,
      preconditions: `Open ${rootPage.url} manually in target browser.`,
      steps: [
        {
          stepNumber: 1,
          action: 'navigate',
          target: rootPage.url,
          expected: 'Inspect interactive unsupported widget visually and functionally.',
        },
      ],
      expectedResult: 'Manual QA engineer verifies behavior matches specification.',
      automationStatus: 'Manual',
      testingType: 'Manual',
      status: 'pending',
      enabled: false,
    });
  }

  return cases.slice(0, 36).map(enrichCase);
}
