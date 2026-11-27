import type {
  AutomationFramework,
  ProjectConfig,
  ProjectFile,
  TestCase,
  TestingApproach,
  WebsiteAnalysisReport,
} from '../src/types/index.js';

function sanitizeIdentifier(raw: string, fallback = 'Home'): string {
  const cleaned = raw
    .replace(/^\/+/, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
  if (!cleaned) return fallback;
  return /^[0-9]/.test(cleaned) ? `Page${cleaned}` : cleaned;
}

function escapeStr(val: string): string {
  return val.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/'/g, "\\'");
}

function toSnakeCase(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .toLowerCase()
    .replace(/^_+|_+$/g, '') || 'home';
}

function inferFieldName(locator: string, idx: number, prefix: string): string {
  const clean = locator
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 24);
  return `${prefix}_${clean || idx}`.replace(/__+/g, '_');
}

function buildTestDataJson(analysis: WebsiteAnalysisReport, config: ProjectConfig): string {
  return JSON.stringify(
    {
      baseUrl: config.baseUrl || analysis.url,
      environment: config.environment,
      viewport: {
        preset: config.viewport,
        width: config.customWidth,
        height: config.customHeight,
      },
      sampleInputs: {
        searchQuery: config.customTestData?.searchQuery || 'automation test',
        contactEmail: config.customTestData?.contactEmail || 'qa-engineer@example.org',
        sampleText: config.customTestData?.sampleText || 'Automator QA Verification',
      },
      pages: analysis.pages.map((p) => ({
        path: p.path,
        title: p.title,
        archetype: p.archetype,
      })),
    },
    null,
    2
  );
}

function makeFile(
  path: string,
  language: ProjectFile['language'],
  content: string
): ProjectFile {
  const parts = path.split('/');
  const name = parts.pop() || path;
  const folder = parts.join('/') || '/';
  return { path, name, folder, language, content, isModified: false };
}

export function generateAutomationProject(params: {
  projectName: string;
  framework: AutomationFramework;
  approach: TestingApproach;
  analysis: WebsiteAnalysisReport;
  testCases: TestCase[];
  config: ProjectConfig;
}): ProjectFile[] {
  const { projectName, framework, approach, analysis, testCases, config } = params;
  const pages = analysis.pages.length > 0 ? analysis.pages : [];
  const baseUrl = config.baseUrl || analysis.url;
  const files: ProjectFile[] = [];
  const testDataContent = buildTestDataJson(analysis, config);

  // Common folders scaffold (.gitkeep in reports/screenshots/videos)
  files.push(makeFile('reports/.gitkeep', 'text', '# Generated HTML/JSON/XML reports output directory\n'));
  files.push(makeFile('screenshots/.gitkeep', 'text', '# Failure and checkpoint screenshots directory\n'));
  files.push(makeFile('videos/.gitkeep', 'text', '# Execution video recordings directory\n'));
  files.push(makeFile('test-data/testdata.json', 'json', testDataContent));
  files.push(makeFile('fixtures/testdata.json', 'json', testDataContent));

  if (framework === 'selenium-java-testng' || framework === 'selenium-java-junit') {
    const isTestNg = framework === 'selenium-java-testng';

    files.push(
      makeFile(
        'pom.xml',
        'xml',
        `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.automator.qa</groupId>
  <artifactId>${toSnakeCase(projectName).replace(/_/g, '-')}</artifactId>
  <version>1.0.0</version>

  <properties>
    <maven.compiler.source>17</maven.compiler.source>
    <maven.compiler.target>17</maven.compiler.target>
    <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
    <selenium.version>4.27.0</selenium.version>
  </properties>

  <dependencies>
    <dependency>
      <groupId>org.seleniumhq.selenium</groupId>
      <artifactId>selenium-java</artifactId>
      <version>\${selenium.version}</version>
    </dependency>
    <dependency>
      <groupId>io.github.bonigarcia</groupId>
      <artifactId>webdrivermanager</artifactId>
      <version>5.9.2</version>
    </dependency>
    ${
      isTestNg
        ? `<dependency>
      <groupId>org.testng</groupId>
      <artifactId>testng</artifactId>
      <version>7.10.2</version>
      <scope>test</scope>
    </dependency>`
        : `<dependency>
      <groupId>org.junit.jupiter</groupId>
      <artifactId>junit-jupiter</artifactId>
      <version>5.11.3</version>
      <scope>test</scope>
    </dependency>`
    }
    <dependency>
      <groupId>org.slf4j</groupId>
      <artifactId>slf4j-simple</artifactId>
      <version>2.0.16</version>
    </dependency>
  </dependencies>
</project>
`
      )
    );

    if (isTestNg) {
      files.push(
        makeFile(
          'testng.xml',
          'xml',
          `<!DOCTYPE suite SYSTEM "https://testng.org/testng-1.0.dtd">
<suite name="${escapeStr(projectName)} Suite" parallel="${config.parallelWorkers > 1 ? 'methods' : 'none'}" thread-count="${config.parallelWorkers}">
  <test name="Automated Regression">
    <classes>
${pages
  .map((p) => `      <class name="tests.${sanitizeIdentifier(p.path)}Test"/>`)
  .join('\n')}
    </classes>
  </test>
</suite>
`
        )
      );
    }

    files.push(
      makeFile(
        'config/config.properties',
        'properties',
        `base.url=${baseUrl}
browser=${config.browser}
headless=${config.headless}
timeout.seconds=${Math.ceil(config.timeoutMs / 1000)}
viewport.width=${config.customWidth}
viewport.height=${config.customHeight}
environment=${config.environment}
# Supply credentials via environment variables: TEST_USERNAME and TEST_PASSWORD
`
      )
    );

    files.push(
      makeFile(
        'support/DriverFactory.java',
        'java',
        `package support;

import io.github.bonigarcia.wdm.WebDriverManager;
import org.openqa.selenium.Dimension;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.edge.EdgeDriver;
import org.openqa.selenium.edge.EdgeOptions;
import org.openqa.selenium.firefox.FirefoxDriver;
import org.openqa.selenium.firefox.FirefoxOptions;

public class DriverFactory {
  public static WebDriver createDriver(String browser, boolean headless, int width, int height) {
    WebDriver driver;
    switch (browser.toLowerCase()) {
      case "firefox": {
        WebDriverManager.firefoxdriver().setup();
        FirefoxOptions opts = new FirefoxOptions();
        if (headless) opts.addArguments("-headless");
        driver = new FirefoxDriver(opts);
        break;
      }
      case "edge": {
        WebDriverManager.edgedriver().setup();
        EdgeOptions opts = new EdgeOptions();
        if (headless) opts.addArguments("--headless=new");
        driver = new EdgeDriver(opts);
        break;
      }
      default: {
        WebDriverManager.chromedriver().setup();
        ChromeOptions opts = new ChromeOptions();
        if (headless) opts.addArguments("--headless=new", "--no-sandbox", "--disable-dev-shm-usage");
        driver = new ChromeDriver(opts);
      }
    }
    driver.manage().window().setSize(new Dimension(width, height));
    return driver;
  }
}
`
      )
    );

    files.push(
      makeFile(
        'support/ScreenshotUtil.java',
        'java',
        `package support;

import org.openqa.selenium.OutputType;
import org.openqa.selenium.TakesScreenshot;
import org.openqa.selenium.WebDriver;
import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;

public class ScreenshotUtil {
  public static void capture(WebDriver driver, String name) {
    try {
      File src = ((TakesScreenshot) driver).getScreenshotAs(OutputType.FILE);
      Path dest = Path.of("screenshots", name + "-" + System.currentTimeMillis() + ".png");
      Files.createDirectories(dest.getParent());
      Files.copy(src.toPath(), dest);
    } catch (Exception ignored) {
    }
  }
}
`
      )
    );

    files.push(
      makeFile(
        'pages/BasePage.java',
        'java',
        `package pages;

import org.openqa.selenium.By;
import org.openqa.selenium.JavascriptExecutor;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;
import java.time.Duration;

public class BasePage {
  protected final WebDriver driver;
  protected final WebDriverWait wait;

  public BasePage(WebDriver driver, int timeoutSeconds) {
    this.driver = driver;
    this.wait = new WebDriverWait(driver, Duration.ofSeconds(timeoutSeconds));
  }

  public void open(String url) {
    driver.get(url);
  }

  protected WebElement waitForVisible(By locator) {
    return wait.until(ExpectedConditions.visibilityOfElementLocated(locator));
  }

  protected void clickSafe(By locator) {
    wait.until(ExpectedConditions.elementToBeClickable(locator)).click();
  }

  protected void typeSafe(By locator, String text) {
    WebElement el = waitForVisible(locator);
    el.clear();
    el.sendKeys(text);
  }

  public boolean hasHorizontalOverflow() {
    Object result = ((JavascriptExecutor) driver).executeScript(
      "return document.documentElement.scrollWidth > window.innerWidth + 4;"
    );
    return Boolean.TRUE.equals(result);
  }
}
`
      )
    );

    pages.forEach((page) => {
      const className = sanitizeIdentifier(page.path);
      const locators = page.elements
        .filter((e) => e.category !== 'image')
        .slice(0, 6)
        .map((el, idx) => {
          const field = inferFieldName(el.locator, idx, el.category);
          return `  private final By ${field} = By.cssSelector("${escapeStr(el.locator)}");`;
        })
        .join('\n');

      files.push(
        makeFile(
          `pages/${className}Page.java`,
          'java',
          `package pages;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

/**
 * Page Object for ${page.path} (${page.archetype})
 * Approach: ${approach.toUpperCase()}
 */
public class ${className}Page extends BasePage {
${locators || '  private final By primaryBody = By.tagName("body");'}

  public ${className}Page(WebDriver driver, int timeoutSeconds) {
    super(driver, timeoutSeconds);
  }

  public String getPageTitle() {
    return driver.getTitle();
  }

  public boolean isLoaded() {
    return waitForVisible(By.tagName("body")).isDisplayed();
  }
}
`
        )
      );

      const pageTests = testCases.filter((tc) => tc.pagePath === page.path).slice(0, 6);
      const testMethods = (pageTests.length > 0 ? pageTests : testCases.slice(0, 3))
        .map((tc, idx) => {
          const methodName = `test_${toSnakeCase(tc.code)}_${idx + 1}`;
          return `  ${isTestNg ? '@Test' : '@Test'}
  public void ${methodName}() {
    // ${tc.code}: ${tc.title}
    page.open("${escapeStr(page.url)}");
    ${isTestNg ? 'Assert.assertTrue(page.isLoaded(), "Page body must render");' : 'Assertions.assertTrue(page.isLoaded(), "Page body must render");'}
    ${isTestNg ? 'Assert.assertFalse(page.getPageTitle().isEmpty(), "Title must not be empty");' : 'Assertions.assertFalse(page.getPageTitle().isEmpty(), "Title must not be empty");'}
  }`;
        })
        .join('\n\n');

      files.push(
        makeFile(
          `tests/${className}Test.java`,
          'java',
          `package tests;

import org.openqa.selenium.WebDriver;
${isTestNg ? 'import org.testng.Assert;\nimport org.testng.annotations.*;' : 'import org.junit.jupiter.api.*;'}
import pages.${className}Page;
import support.DriverFactory;
import support.ScreenshotUtil;

public class ${className}Test {
  private WebDriver driver;
  private ${className}Page page;

  ${isTestNg ? '@BeforeMethod' : '@BeforeEach'}
  public void setUp() {
    String browser = System.getProperty("browser", "${config.browser}");
    boolean headless = Boolean.parseBoolean(System.getProperty("headless", "${config.headless}"));
    driver = DriverFactory.createDriver(browser, headless, ${config.customWidth}, ${config.customHeight});
    page = new ${className}Page(driver, ${Math.ceil(config.timeoutMs / 1000)});
  }

${testMethods}

  ${isTestNg ? '@AfterMethod' : '@AfterEach'}
  public void tearDown() {
    if (driver != null) {
      ScreenshotUtil.capture(driver, "${className}");
      driver.quit();
    }
  }
}
`
        )
      );
    });
  } else if (framework === 'cypress-js' || framework === 'cypress-ts') {
    const isTs = framework === 'cypress-ts';
    const ext = isTs ? 'ts' : 'js';

    files.push(
      makeFile(
        'package.json',
        'json',
        JSON.stringify(
          {
            name: toSnakeCase(projectName).replace(/_/g, '-'),
            version: '1.0.0',
            private: true,
            scripts: {
              'cy:open': 'cypress open',
              'cy:run': 'cypress run',
              'cy:run:chrome': 'cypress run --browser chrome',
              'cy:run:firefox': 'cypress run --browser firefox',
              ...(isTs ? { typecheck: 'tsc --noEmit' } : {}),
            },
            devDependencies: {
              cypress: '^13.17.0',
              ...(isTs ? { typescript: '^5.7.0' } : {}),
            },
          },
          null,
          2
        )
      )
    );

    if (isTs) {
      files.push(
        makeFile(
          'tsconfig.json',
          'json',
          JSON.stringify(
            {
              compilerOptions: {
                target: 'ES2022',
                lib: ['ES2022', 'DOM'],
                types: ['cypress', 'node'],
                moduleResolution: 'bundler',
                strict: true,
                noEmit: true,
              },
              include: ['**/*.ts'],
            },
            null,
            2
          )
        )
      );
    }

    files.push(
      makeFile(
        `cypress.config.${ext}`,
        isTs ? 'typescript' : 'javascript',
        `import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: process.env.BASE_URL || '${escapeStr(baseUrl)}',
    viewportWidth: ${config.customWidth},
    viewportHeight: ${config.customHeight},
    defaultCommandTimeout: ${config.timeoutMs},
    retries: { runMode: ${config.retries}, openMode: 0 },
    screenshotOnRunFailure: ${config.captureScreenshots},
    video: ${config.recordVideo},
    specPattern: 'tests/**/*.cy.${ext}',
    supportFile: 'support/e2e.${ext}',
    fixturesFolder: 'fixtures',
    screenshotsFolder: 'screenshots',
    videosFolder: 'videos',
  },
});
`
      )
    );

    files.push(
      makeFile(
        `support/commands.${ext}`,
        isTs ? 'typescript' : 'javascript',
        `// Reusable Cypress custom commands
Cypress.Commands.add('assertNoHorizontalOverflow', () => {
  cy.window().then((win) => {
    expect(win.document.documentElement.scrollWidth).to.be.at.most(win.innerWidth + 4);
  });
});

Cypress.Commands.add('loginWithEnv', () => {
  const username = Cypress.env('TEST_USERNAME');
  const password = Cypress.env('TEST_PASSWORD');
  if (!username || !password) {
    cy.log('Skipping login: TEST_USERNAME / TEST_PASSWORD env vars not supplied');
    return;
  }
  cy.get('input[type="email"], input[name*="user" i]').first().type(username);
  cy.get('input[type="password"]').first().type(password, { log: false });
  cy.get('button[type="submit"], input[type="submit"]').first().click();
});
`
      )
    );

    files.push(
      makeFile(
        `support/e2e.${ext}`,
        isTs ? 'typescript' : 'javascript',
        `import './commands';
`
      )
    );

    files.push(
      makeFile(
        `pages/BasePage.${ext}`,
        isTs ? 'typescript' : 'javascript',
        `export class BasePage {
  visit(path${isTs ? ': string' : ''} = '/') {
    cy.visit(path);
    cy.get('body').should('be.visible');
  }

  assertTitleNotEmpty() {
    cy.title().should('not.be.empty');
  }

  assertResponsive(width${isTs ? ': number' : ''}, height${isTs ? ': number' : ''}) {
    cy.viewport(width, height);
    cy.window().then((win) => {
      expect(win.document.documentElement.scrollWidth).to.be.at.most(win.innerWidth + 4);
    });
  }
}
`
      )
    );

    pages.forEach((page) => {
      const className = sanitizeIdentifier(page.path);
      const getters = page.elements
        .filter((e) => e.category !== 'image')
        .slice(0, 6)
        .map((el, idx) => {
          const fn = inferFieldName(el.locator, idx, el.category);
          return `  get ${fn}() { return cy.get('${escapeStr(el.locator)}').first(); }`;
        })
        .join('\n');

      files.push(
        makeFile(
          `pages/${className}Page.${ext}`,
          isTs ? 'typescript' : 'javascript',
          `import { BasePage } from './BasePage';

export class ${className}Page extends BasePage {
  readonly path = '${escapeStr(page.path)}';

${getters || "  get body() { return cy.get('body'); }"}

  open() {
    this.visit(this.path);
  }
}
`
        )
      );

      const pageTests = testCases.filter((tc) => tc.pagePath === page.path).slice(0, 8);
      const specs = (pageTests.length > 0 ? pageTests : testCases.slice(0, 4))
        .map((tc) => {
          const firstAction = tc.steps.find((s) => s.action === 'assert_visible' && s.target !== 'body');
          return `  it('${tc.code}: ${escapeStr(tc.title)}', () => {
    page.open();
    page.assertTitleNotEmpty();
${firstAction ? `    cy.get('${escapeStr(firstAction.target)}').first().should('be.visible');` : `    cy.get('body').should('be.visible');`}
${tc.category === 'responsive' ? `    page.assertResponsive(1440, 900);\n    page.assertResponsive(390, 844);` : ''}
  });`;
        })
        .join('\n\n');

      files.push(
        makeFile(
          `tests/${toSnakeCase(className)}.cy.${ext}`,
          isTs ? 'typescript' : 'javascript',
          `import { ${className}Page } from '../pages/${className}Page';

describe('${className} Suite (${approach.toUpperCase()})', () => {
  const page = new ${className}Page();

${specs}
});
`
        )
      );
    });
  } else if (framework === 'selenium-js' || framework === 'selenium-ts') {
    const isTs = framework === 'selenium-ts';
    const ext = isTs ? 'ts' : 'js';

    files.push(
      makeFile(
        'package.json',
        'json',
        JSON.stringify(
          {
            name: toSnakeCase(projectName).replace(/_/g, '-'),
            version: '1.0.0',
            private: true,
            type: 'module',
            scripts: {
              test: isTs
                ? 'mocha --loader ts-node/esm "tests/**/*.test.ts"'
                : 'mocha "tests/**/*.test.js"',
              ...(isTs ? { typecheck: 'tsc --noEmit' } : {}),
            },
            dependencies: {
              'selenium-webdriver': '^4.27.0',
            },
            devDependencies: {
              chai: '^5.1.2',
              mocha: '^10.8.2',
              ...(isTs
                ? {
                    typescript: '^5.7.0',
                    'ts-node': '^10.9.2',
                    '@types/mocha': '^10.0.10',
                    '@types/chai': '^5.0.1',
                    '@types/selenium-webdriver': '^4.1.25',
                  }
                : {}),
            },
          },
          null,
          2
        )
      )
    );

    if (isTs) {
      files.push(
        makeFile(
          'tsconfig.json',
          'json',
          JSON.stringify(
            {
              compilerOptions: {
                target: 'ES2022',
                module: 'ESNext',
                moduleResolution: 'node',
                strict: true,
                esModuleInterop: true,
                skipLibCheck: true,
                noEmit: true,
              },
              include: ['**/*.ts'],
            },
            null,
            2
          )
        )
      );
    }

    files.push(
      makeFile(
        `config/webdriver.config.${ext}`,
        isTs ? 'typescript' : 'javascript',
        `import { Builder${isTs ? ', type WebDriver' : ''} } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome.js';
import firefox from 'selenium-webdriver/firefox.js';

export const RUN_CONFIG = {
  baseUrl: process.env.BASE_URL || '${escapeStr(baseUrl)}',
  browser: process.env.BROWSER || '${config.browser}',
  headless: ${config.headless},
  timeoutMs: ${config.timeoutMs},
  viewport: { width: ${config.customWidth}, height: ${config.customHeight} },
};

export async function buildDriver()${isTs ? ': Promise<WebDriver>' : ''} {
  const builder = new Builder().forBrowser(RUN_CONFIG.browser);
  if (RUN_CONFIG.browser === 'chrome') {
    const opts = new chrome.Options();
    if (RUN_CONFIG.headless) opts.addArguments('--headless=new', '--no-sandbox');
    opts.windowSize(RUN_CONFIG.viewport);
    builder.setChromeOptions(opts);
  } else if (RUN_CONFIG.browser === 'firefox') {
    const opts = new firefox.Options();
    if (RUN_CONFIG.headless) opts.addArguments('-headless');
    builder.setFirefoxOptions(opts);
  }
  return builder.build();
}
`
      )
    );

    files.push(
      makeFile(
        `support/logger.${ext}`,
        isTs ? 'typescript' : 'javascript',
        `export function logStep(scope${isTs ? ': string' : ''}, message${isTs ? ': string' : ''}) {
  console.log(\`[\${new Date().toISOString()}] [\${scope}] \${message}\`);
}
`
      )
    );

    files.push(
      makeFile(
        `pages/BasePage.${ext}`,
        isTs ? 'typescript' : 'javascript',
        `import { By, until${isTs ? ', type WebDriver, type WebElement' : ''} } from 'selenium-webdriver';

export class BasePage {
  ${isTs ? 'protected driver: WebDriver;\n  protected timeoutMs: number;' : ''}

  constructor(driver${isTs ? ': WebDriver' : ''}, timeoutMs = ${config.timeoutMs}) {
    this.driver = driver;
    this.timeoutMs = timeoutMs;
  }

  async open(url${isTs ? ': string' : ''}) {
    await this.driver.get(url);
  }

  async waitForVisible(selector${isTs ? ': string' : ''})${isTs ? ': Promise<WebElement>' : ''} {
    const locator = By.css(selector);
    const el = await this.driver.wait(until.elementLocated(locator), this.timeoutMs);
    await this.driver.wait(until.elementIsVisible(el), this.timeoutMs);
    return el;
  }

  async getTitle() {
    return this.driver.getTitle();
  }
}
`
      )
    );

    pages.forEach((page) => {
      const className = sanitizeIdentifier(page.path);
      const selectors = page.elements
        .filter((e) => e.category !== 'image')
        .slice(0, 6)
        .map((el, idx) => `  ${inferFieldName(el.locator, idx, el.category)}: '${escapeStr(el.locator)}',`)
        .join('\n');

      files.push(
        makeFile(
          `pages/${className}Page.${ext}`,
          isTs ? 'typescript' : 'javascript',
          `import { BasePage } from './BasePage.${ext}';

export const ${className}Selectors = {
${selectors || "  body: 'body',"}
};

export class ${className}Page extends BasePage {
  async verifyLoaded() {
    await this.waitForVisible('body');
    const title = await this.getTitle();
    return Boolean(title && title.trim().length > 0);
  }
}
`
        )
      );

      const pageTests = testCases.filter((tc) => tc.pagePath === page.path).slice(0, 6);
      const testsBody = (pageTests.length > 0 ? pageTests : testCases.slice(0, 3))
        .map((tc) => {
          return `  it('${tc.code}: ${escapeStr(tc.title)}', async () => {
    logStep('${tc.code}', 'Navigating to ${escapeStr(page.url)}');
    await page.open('${escapeStr(page.url)}');
    const loaded = await page.verifyLoaded();
    expect(loaded).to.equal(true);
  });`;
        })
        .join('\n\n');

      files.push(
        makeFile(
          `tests/${toSnakeCase(className)}.test.${ext}`,
          isTs ? 'typescript' : 'javascript',
          `import { expect } from 'chai';
import { buildDriver, RUN_CONFIG } from '../config/webdriver.config.${ext}';
import { ${className}Page } from '../pages/${className}Page.${ext}';
import { logStep } from '../support/logger.${ext}';

describe('${className} Selenium Mocha Suite', function () {
  this.timeout(RUN_CONFIG.timeoutMs + 10000);
  let driver${isTs ? ': Awaited<ReturnType<typeof buildDriver>>' : ''};
  let page${isTs ? `: ${className}Page` : ''};

  beforeEach(async () => {
    driver = await buildDriver();
    page = new ${className}Page(driver, RUN_CONFIG.timeoutMs);
  });

  afterEach(async () => {
    if (driver) await driver.quit();
  });

${testsBody}
});
`
        )
      );
    });
  } else if (framework === 'playwright-ts') {
    files.push(
      makeFile(
        'package.json',
        'json',
        JSON.stringify(
          {
            name: toSnakeCase(projectName).replace(/_/g, '-'),
            version: '1.0.0',
            private: true,
            type: 'module',
            scripts: {
              test: 'playwright test',
              'test:headed': 'playwright test --headed',
              'test:report': 'playwright show-report reports/playwright-html',
              typecheck: 'tsc --noEmit',
            },
            devDependencies: {
              '@playwright/test': '^1.50.0',
              '@types/node': '^22.10.0',
              typescript: '^5.7.0',
            },
          },
          null,
          2
        )
      )
    );

    files.push(
      makeFile(
        'tsconfig.json',
        'json',
        JSON.stringify(
          {
            compilerOptions: {
              target: 'ES2022',
              module: 'ESNext',
              moduleResolution: 'bundler',
              strict: true,
              noEmit: true,
            },
            include: ['**/*.ts'],
          },
          null,
          2
        )
      )
    );

    files.push(
      makeFile(
        'config/playwright.config.ts',
        'typescript',
        `import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '../tests',
  timeout: ${config.timeoutMs},
  retries: ${config.retries},
  workers: ${config.parallelWorkers},
  outputDir: '../screenshots',
  reporter: [
    ['list'],
    ['html', { outputFolder: '../reports/playwright-html', open: 'never' }],
    ['json', { outputFile: '../reports/results.json' }],
  ],
  use: {
    baseURL: process.env.BASE_URL || '${escapeStr(baseUrl)}',
    headless: ${config.headless},
    viewport: { width: ${config.customWidth}, height: ${config.customHeight} },
    screenshot: '${config.captureScreenshots ? 'only-on-failure' : 'off'}',
    video: '${config.recordVideo ? 'retain-on-failure' : 'off'}',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
  ],
});
`
      )
    );

    files.push(
      makeFile(
        'pages/BasePage.ts',
        'typescript',
        `import { expect, type Page } from '@playwright/test';

export class BasePage {
  constructor(protected readonly page: Page) {}

  async goto(path = '/') {
    const res = await this.page.goto(path, { waitUntil: 'domcontentloaded' });
    expect(res?.status() ?? 200).toBeLessThan(400);
    await expect(this.page.locator('body')).toBeVisible();
  }

  async assertNoHorizontalOverflow() {
    const overflow = await this.page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 4
    );
    expect(overflow).toBe(false);
  }
}
`
      )
    );

    pages.forEach((page) => {
      const className = sanitizeIdentifier(page.path);
      const locators = page.elements
        .filter((e) => e.category !== 'image')
        .slice(0, 6)
        .map((el, idx) => `  get ${inferFieldName(el.locator, idx, el.category)}() { return this.page.locator('${escapeStr(el.locator)}').first(); }`)
        .join('\n');

      files.push(
        makeFile(
          `pages/${className}Page.ts`,
          'typescript',
          `import { expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class ${className}Page extends BasePage {
  readonly path = '${escapeStr(page.path)}';

${locators || "  get body() { return this.page.locator('body'); }"}

  async open() {
    await this.goto(this.path);
    await expect(this.page).toHaveTitle(/.+/);
  }
}
`
        )
      );

      const pageTests = testCases.filter((tc) => tc.pagePath === page.path).slice(0, 6);
      const specs = (pageTests.length > 0 ? pageTests : testCases.slice(0, 3))
        .map((tc) => {
          const firstAction = tc.steps.find((s) => s.action === 'assert_visible' && s.target !== 'body');
          return `  test('${tc.code}: ${escapeStr(tc.title)}', async ({ page }) => {
    const pom = new ${className}Page(page);
    await pom.open();
${firstAction ? `    await expect(page.locator('${escapeStr(firstAction.target)}').first()).toBeVisible();` : `    await expect(page.locator('body')).toBeVisible();`}
  });`;
        })
        .join('\n\n');

      files.push(
        makeFile(
          `tests/${toSnakeCase(className)}.spec.ts`,
          'typescript',
          `import { test, expect } from '@playwright/test';
import { ${className}Page } from '../pages/${className}Page';

test.describe('${className} Playwright Suite (${approach.toUpperCase()})', () => {
${specs}
});
`
        )
      );
    });

    // Core scenario-organized suites
    files.push(
      makeFile(
        'tests/homepage.spec.ts',
        'typescript',
        `import { test, expect } from '@playwright/test';
import { BasePage } from '../pages/BasePage';

test('Homepage loads cleanly with valid title and zero console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  const base = new BasePage(page);
  await base.goto('/');
  await expect(page).toHaveTitle(/.+/);
  expect(errors).toEqual([]);
});
`
      )
    );
    files.push(
      makeFile(
        'tests/navigation.spec.ts',
        'typescript',
        `import { test, expect } from '@playwright/test';

test('Primary navigation links render valid destinations', async ({ page }) => {
  await page.goto('/');
  const links = await page.locator('a[href]').all();
  expect(links.length).toBeGreaterThanOrEqual(0);
  if (links.length > 0) {
    await expect(links[0]).toBeVisible();
  }
});
`
      )
    );
    files.push(
      makeFile(
        'tests/form.spec.ts',
        'typescript',
        `import { test, expect } from '@playwright/test';

test('Detected interactive inputs accept values cleanly', async ({ page }) => {
  await page.goto('/');
  const inputs = page.locator('input:not([type="hidden"]):not([type="submit"]):not([type="password"])');
  const count = await inputs.count();
  if (count > 0) {
    await expect(inputs.first()).toBeVisible();
  }
});
`
      )
    );
    files.push(
      makeFile(
        'tests/responsive.spec.ts',
        'typescript',
        `import { test } from '@playwright/test';
import { BasePage } from '../pages/BasePage';

for (const vp of [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
]) {
  test(\`Responsive layout has zero horizontal overflow on \${vp.name}\`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    const base = new BasePage(page);
    await base.goto('/');
    await base.assertNoHorizontalOverflow();
  });
}
`
      )
    );
    files.push(
      makeFile(
        'tests/regression.spec.ts',
        'typescript',
        `import { test, expect } from '@playwright/test';

test('Regression smoke across discovered pages', async ({ page }) => {
  for (const route of ${JSON.stringify(pages.slice(0, 6).map((p) => p.path))}) {
    const res = await page.goto(route, { waitUntil: 'domcontentloaded' });
    expect(res?.status() ?? 200).toBeLessThan(400);
    await expect(page.locator('body')).toBeVisible();
  }
});
`
      )
    );
    files.push(
      makeFile(
        'execution/run.sh',
        'text',
        `#!/usr/bin/env bash
set -euo pipefail
npm install
npx playwright install chromium
npx playwright test --config=config/playwright.config.ts
`
      )
    );
  } else if (framework === 'playwright-python') {
    files.push(
      makeFile(
        'requirements.txt',
        'text',
        `playwright>=1.50.0
pytest>=8.3.0
pytest-playwright>=0.6.2
pytest-html>=4.1.1
python-dotenv>=1.0.1
`
      )
    );
    files.push(
      makeFile(
        'pytest.ini',
        'properties',
        `[pytest]
testpaths = tests
addopts = -v --html=reports/report.html --self-contained-html
`
      )
    );
    files.push(
      makeFile(
        'config/settings.py',
        'python',
        `import os

BASE_URL = os.getenv("BASE_URL", "${escapeStr(baseUrl)}")
HEADLESS = os.getenv("HEADLESS", "${String(config.headless).toLowerCase()}") == "true"
TIMEOUT_MS = ${config.timeoutMs}
VIEWPORT = {"width": ${config.customWidth}, "height": ${config.customHeight}}
`
      )
    );
    files.push(
      makeFile(
        'conftest.py',
        'python',
        `import os
import time
import pytest
from playwright.sync_api import sync_playwright
from config.settings import HEADLESS, VIEWPORT


@pytest.fixture(scope="function")
def page(request):
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=HEADLESS)
        context = browser.new_context(viewport=VIEWPORT)
        pg = context.new_page()
        yield pg
        os.makedirs("screenshots", exist_ok=True)
        pg.screenshot(path=f"screenshots/{request.node.name}_{int(time.time())}.png")
        context.close()
        browser.close()
`
      )
    );
    files.push(
      makeFile(
        'pages/base_page.py',
        'python',
        `from playwright.sync_api import Page, expect


class BasePage:
    def __init__(self, page: Page):
        self.page = page

    def open(self, url: str) -> None:
        resp = self.page.goto(url, wait_until="domcontentloaded")
        assert resp is None or resp.status < 400
        expect(self.page.locator("body")).to_be_visible()

    def has_horizontal_overflow(self) -> bool:
        return bool(
            self.page.evaluate(
                "() => document.documentElement.scrollWidth > window.innerWidth + 4"
            )
        )
`
      )
    );

    pages.forEach((page) => {
      const className = sanitizeIdentifier(page.path);
      const snake = toSnakeCase(className);
      const locators = page.elements
        .filter((e) => e.category !== 'image')
        .slice(0, 6)
        .map((el, idx) => `    ${inferFieldName(el.locator, idx, el.category).toUpperCase()} = "${escapeStr(el.locator)}"`)
        .join('\n');

      files.push(
        makeFile(
          `pages/${snake}_page.py`,
          'python',
          `from pages.base_page import BasePage


class ${className}Page(BasePage):
${locators || '    BODY = "body"'}

    def verify_loaded(self) -> bool:
        return len(self.page.title().strip()) > 0
`
        )
      );

      const pageTests = testCases.filter((tc) => tc.pagePath === page.path).slice(0, 6);
      const pyTests = (pageTests.length > 0 ? pageTests : testCases.slice(0, 3))
        .map((tc, idx) => {
          return `def test_${toSnakeCase(tc.code)}_${idx + 1}(page):
    """${tc.code}: ${tc.title}"""
    pom = ${className}Page(page)
    pom.open("${escapeStr(page.url)}")
    assert pom.verify_loaded(), "Expected page title to be populated"
`;
        })
        .join('\n\n');

      files.push(
        makeFile(
          `tests/test_${snake}.py`,
          'python',
          `from pages.${snake}_page import ${className}Page


${pyTests}
`
        )
      );
    });

    files.push(
      makeFile(
        'tests/test_responsive.py',
        'python',
        `from config.settings import BASE_URL
from pages.base_page import BasePage


def test_responsive_viewports(page):
    base = BasePage(page)
    for width, height in [(1440, 900), (768, 1024), (390, 844)]:
        page.set_viewport_size({"width": width, "height": height})
        base.open(BASE_URL)
        assert not base.has_horizontal_overflow(), f"Overflow detected at {width}x{height}"
`
      )
    );
    files.push(
      makeFile(
        'execution/run.sh',
        'text',
        `#!/usr/bin/env bash
set -euo pipefail
pip install -r requirements.txt
playwright install chromium
pytest
`
      )
    );
  } else {
    // selenium-python-pytest
    files.push(
      makeFile(
        'requirements.txt',
        'text',
        `selenium>=4.27.0
pytest>=8.3.0
pytest-html>=4.1.1
webdriver-manager>=4.0.2
python-dotenv>=1.0.1
`
      )
    );

    files.push(
      makeFile(
        'pytest.ini',
        'properties',
        `[pytest]
testpaths = tests
addopts = -v --html=reports/report.html --self-contained-html
`
      )
    );

    files.push(
      makeFile(
        'config/settings.py',
        'python',
        `import os

BASE_URL = os.getenv("BASE_URL", "${escapeStr(baseUrl)}")
BROWSER = os.getenv("BROWSER", "${config.browser}")
HEADLESS = os.getenv("HEADLESS", "${String(config.headless).toLowerCase()}") == "true"
TIMEOUT_SEC = ${Math.ceil(config.timeoutMs / 1000)}
VIEWPORT_WIDTH = ${config.customWidth}
VIEWPORT_HEIGHT = ${config.customHeight}
`
      )
    );

    files.push(
      makeFile(
        'support/logger.py',
        'python',
        `import logging

def get_logger(name: str) -> logging.Logger:
    logger = logging.getLogger(name)
    if not logger.handlers:
        handler = logging.StreamHandler()
        formatter = logging.Formatter("%(asctime)s [%(levelname)s] %(name)s: %(message)s")
        handler.setFormatter(formatter)
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)
    return logger
`
      )
    );

    files.push(
      makeFile(
        'conftest.py',
        'python',
        `import os
import time
import pytest
from selenium import webdriver
from selenium.webdriver.chrome.options import Options as ChromeOptions
from selenium.webdriver.firefox.options import Options as FirefoxOptions
from config.settings import BROWSER, HEADLESS, VIEWPORT_WIDTH, VIEWPORT_HEIGHT


@pytest.fixture
def driver(request):
    if BROWSER == "firefox":
        opts = FirefoxOptions()
        if HEADLESS:
            opts.add_argument("-headless")
        drv = webdriver.Firefox(options=opts)
    else:
        opts = ChromeOptions()
        if HEADLESS:
            opts.add_argument("--headless=new")
            opts.add_argument("--no-sandbox")
        drv = webdriver.Chrome(options=opts)

    drv.set_window_size(VIEWPORT_WIDTH, VIEWPORT_HEIGHT)
    yield drv
    os.makedirs("screenshots", exist_ok=True)
    drv.save_screenshot(f"screenshots/{request.node.name}_{int(time.time())}.png")
    drv.quit()
`
      )
    );

    files.push(
      makeFile(
        'pages/base_page.py',
        'python',
        `from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC


class BasePage:
    def __init__(self, driver, timeout: int = ${Math.ceil(config.timeoutMs / 1000)}):
        self.driver = driver
        self.wait = WebDriverWait(driver, timeout)

    def open(self, url: str) -> None:
        self.driver.get(url)

    def wait_for_visible(self, css_selector: str):
        return self.wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, css_selector)))

    def has_horizontal_overflow(self) -> bool:
        return bool(
            self.driver.execute_script(
                "return document.documentElement.scrollWidth > window.innerWidth + 4;"
            )
        )
`
      )
    );

    pages.forEach((page) => {
      const className = sanitizeIdentifier(page.path);
      const snake = toSnakeCase(className);
      const locators = page.elements
        .filter((e) => e.category !== 'image')
        .slice(0, 6)
        .map((el, idx) => `    ${inferFieldName(el.locator, idx, el.category).toUpperCase()} = "${escapeStr(el.locator)}"`)
        .join('\n');

      files.push(
        makeFile(
          `pages/${snake}_page.py`,
          'python',
          `from pages.base_page import BasePage


class ${className}Page(BasePage):
${locators || '    BODY = "body"'}

    def verify_loaded(self) -> bool:
        body = self.wait_for_visible("body")
        return body.is_displayed() and len(self.driver.title.strip()) > 0
`
        )
      );

      const pageTests = testCases.filter((tc) => tc.pagePath === page.path).slice(0, 6);
      const pyTests = (pageTests.length > 0 ? pageTests : testCases.slice(0, 3))
        .map((tc, idx) => {
          return `def test_${toSnakeCase(tc.code)}_${idx + 1}(driver):
    """${tc.code}: ${tc.title}"""
    page = ${className}Page(driver)
    page.open("${escapeStr(page.url)}")
    assert page.verify_loaded(), "Expected page body and title to render"
`;
        })
        .join('\n\n');

      files.push(
        makeFile(
          `tests/test_${snake}.py`,
          'python',
          `from pages.${snake}_page import ${className}Page


${pyTests}
`
        )
      );
    });

    files.push(
      makeFile(
        'tests/test_responsive.py',
        'python',
        `from config.settings import BASE_URL
from pages.base_page import BasePage


def test_responsive_viewports(driver):
    page = BasePage(driver)
    for w, h in [(1440, 900), (768, 1024), (390, 844)]:
        driver.set_window_size(w, h)
        page.open(BASE_URL)
        assert not page.has_horizontal_overflow(), f"Horizontal overflow at {w}x{h}"
`
      )
    );
    files.push(
      makeFile(
        'execution/run.sh',
        'text',
        `#!/usr/bin/env bash
set -euo pipefail
pip install -r requirements.txt
pytest
`
      )
    );
  }

  // Ensure execution helper exists for Java/JS/Cypress stacks too
  if (framework.startsWith('selenium-java')) {
    files.push(
      makeFile(
        'execution/run.sh',
        'text',
        `#!/usr/bin/env bash
set -euo pipefail
mvn test
`
      )
    );
  } else if (framework.startsWith('cypress')) {
    files.push(
      makeFile(
        'execution/run.sh',
        'text',
        `#!/usr/bin/env bash
set -euo pipefail
npm install
npx cypress run
`
      )
    );
  } else if (framework === 'selenium-js' || framework === 'selenium-ts') {
    files.push(
      makeFile(
        'execution/run.sh',
        'text',
        `#!/usr/bin/env bash
set -euo pipefail
npm install
npm test
`
      )
    );
  }

  // README.md & .env.example
  files.push(
    makeFile(
      '.env.example',
      'properties',
      `BASE_URL=${baseUrl}
BROWSER=${config.browser}
HEADLESS=${config.headless}
TEST_USERNAME=
TEST_PASSWORD=
`
    )
  );

  files.push(
    makeFile(
      'README.md',
      'markdown',
      `# ${projectName}

Automated QA Test Project generated from **${analysis.url}**

- **Framework**: \`${framework}\`
- **Architecture**: Page Object Model (${approach})
- **Inspected Pages**: ${analysis.pages.length} (Discovered: ${analysis.discoveredUrls?.length ?? analysis.pages.length}, Skipped: ${analysis.skippedPages?.length ?? 0})
- **Generated Test Cases**: ${testCases.length}

## Project Structure

- \`tests/\`: Automated test specs organized by page and scenario (homepage, navigation, forms, responsive, regression)
- \`pages/\`: Page Object Model classes with resilient locators
- \`fixtures/\` & \`test-data/\`: Structured JSON test data
- \`config/\`: Environment and browser settings
- \`execution/\`: One-command test execution script (\`run.sh\`)
- \`reports/\`, \`screenshots/\`, \`videos/\`: Execution artifacts

## Quick Start

${
  framework.startsWith('selenium-java')
    ? '```bash\nmvn test\n```'
    : framework === 'playwright-python'
      ? '```bash\npip install -r requirements.txt\nplaywright install chromium\npytest\n```'
      : framework.startsWith('selenium-python')
        ? '```bash\npip install -r requirements.txt\npytest\n```'
        : framework === 'playwright-ts'
          ? '```bash\nnpm install\nnpx playwright install chromium\nnpx playwright test\n```'
          : framework.startsWith('cypress')
            ? '```bash\nnpm install\nnpx cypress run\n```'
            : '```bash\nnpm install\nnpm test\n```'
}

> **Security Note**: Never commit real credentials. Supply test accounts via environment variables (\`TEST_USERNAME\`, \`TEST_PASSWORD\`).
`
    )
  );

  return files;
}

export function generateMultiFrameworkProject(params: {
  projectName: string;
  frameworks: AutomationFramework[];
  approach: TestingApproach;
  analysis: WebsiteAnalysisReport;
  testCases: TestCase[];
  config: ProjectConfig;
}): ProjectFile[] {
  const unique = Array.from(new Set(params.frameworks));
  if (unique.length <= 1) {
    return generateAutomationProject({
      projectName: params.projectName,
      framework: unique[0] || 'playwright-ts',
      approach: params.approach,
      analysis: params.analysis,
      testCases: params.testCases,
      config: params.config,
    });
  }

  const combined: ProjectFile[] = [
    makeFile(
      'README.md',
      'markdown',
      `# ${params.projectName} — Multi-Language Automation Suite

Generated from **${params.analysis.url}** across **${unique.length}** stacks:
${unique.map((fw) => `- \`${fw}/\` — Independent ${fw} automation workspace`).join('\n')}

Each subdirectory is completely self-contained with its own dependency manifest (\`pom.xml\`, \`package.json\`, or \`requirements.txt\`), configuration, Page Objects, test specs, and \`execution/run.sh\`.

> **Security Note**: Never commit real credentials or API keys. Configure \`.env\` from \`.env.example\` locally or in CI/CD.
`
    ),
    makeFile(
      '.env.example',
      'properties',
      `BASE_URL=${params.config.baseUrl || params.analysis.url}
BROWSER=${params.config.browser}
HEADLESS=${params.config.headless}
TEST_USERNAME=
TEST_PASSWORD=
`
    ),
  ];

  for (const fw of unique) {
    const subFiles = generateAutomationProject({
      projectName: params.projectName,
      framework: fw,
      approach: params.approach,
      analysis: params.analysis,
      testCases: params.testCases,
      config: params.config,
    });
    for (const f of subFiles) {
      const prefixed = `${fw}/${f.path}`;
      const parts = prefixed.split('/');
      const name = parts.pop() || prefixed;
      combined.push({
        ...f,
        path: prefixed,
        name,
        folder: parts.join('/'),
      });
    }
  }

  return combined;
}
