import type { DiscoveredPage, PageType, Framework } from '@/types';

const pageTypeTests: Record<PageType, string[]> = {
  Login: [
    'should display login form with username and password fields',
    'should show error for empty credentials submission',
    'should login with valid credentials and redirect to dashboard',
    'should display "Remember me" checkbox',
    'should navigate to forgot password page',
    'should validate password minimum length',
  ],
  Dashboard: [
    'should display dashboard header and navigation',
    'should render all widget cards correctly',
    'should update real-time statistics',
    'should handle date range filter changes',
    'should display user avatar and dropdown menu',
    'should refresh data on manual refresh click',
  ],
  Product: [
    'should display product name and price',
    'should show product images in gallery',
    'should handle add to cart button click',
    'should display product description and specs',
    'should show related products section',
    'should validate quantity input bounds',
  ],
  Form: [
    'should render all form fields correctly',
    'should validate required fields on submit',
    'should show inline validation errors',
    'should handle form submission successfully',
    'should reset form on cancel button click',
    'should preserve form data on browser refresh',
  ],
  Table: [
    'should display all table columns correctly',
    'should sort data on column header click',
    'should filter rows using search input',
    'should handle pagination navigation',
    'should select and delete multiple rows',
    'should export data to CSV format',
  ],
  Other: [
    'should load page without console errors',
    'should have all navigation links working',
    'should display correct page title',
    'should be responsive on mobile viewport',
    'should have accessible ARIA labels',
  ],
};

function getPageClassName(page: DiscoveredPage): string {
  const name = page.path
    .split('/')
    .filter(Boolean)
    .pop() || 'home';
  return name.charAt(0).toUpperCase() + name.slice(1).replace(/[-_]/g, '');
}

function generateLocators(page: DiscoveredPage): string[] {
  const locatorsByType: Record<PageType, string[]> = {
    Login: [
      '[data-testid="username-input"]',
      '[data-testid="password-input"]',
      '[data-testid="login-button"]',
      '[data-testid="remember-me-checkbox"]',
      '[data-testid="forgot-password-link"]',
      '[data-testid="login-error-message"]',
    ],
    Dashboard: [
      '[data-testid="dashboard-header"]',
      '[data-testid="stats-widget"]',
      '[data-testid="chart-container"]',
      '[data-testid="date-range-picker"]',
      '[data-testid="user-menu-button"]',
      '[data-testid="refresh-button"]',
    ],
    Product: [
      '[data-testid="product-title"]',
      '[data-testid="product-price"]',
      '[data-testid="product-gallery"]',
      '[data-testid="add-to-cart-button"]',
      '[data-testid="quantity-input"]',
      '[data-testid="product-description"]',
    ],
    Form: [
      '[data-testid="form-container"]',
      '[data-testid="submit-button"]',
      '[data-testid="cancel-button"]',
      '[data-testid="reset-button"]',
      '[data-testid="error-summary"]',
      '[data-testid="success-message"]',
    ],
    Table: [
      '[data-testid="data-table"]',
      '[data-testid="table-search"]',
      '[data-testid="column-header"]',
      '[data-testid="pagination-controls"]',
      '[data-testid="row-checkbox"]',
      '[data-testid="export-button"]',
    ],
    Other: [
      '[data-testid="page-container"]',
      '[data-testid="main-content"]',
      '[data-testid="page-title"]',
      '[data-testid="navigation-menu"]',
      '[data-testid="footer"]',
    ],
  };
  return locatorsByType[page.type] || locatorsByType.Other;
}

function generateSeleniumJSPageObject(page: DiscoveredPage): string {
  const className = getPageClassName(page);
  const locators = generateLocators(page);

  return `const { By, until } = require('selenium-webdriver');
const BasePage = require('./BasePage');

class ${className}Page extends BasePage {
  constructor(driver) {
    super(driver);
    this.url = '${page.url}';
${locators.map((loc, i) => `    this.locator${i} = By.css('${loc}');`).join('\n')}
  }

  async navigate() {
    await this.driver.get(this.url);
    return this.waitForPageLoad();
  }

  async waitForPageLoad() {
    await this.driver.wait(
      until.elementLocated(this.locator0),
      10000,
      '${className} page did not load within 10 seconds'
    );
    return this;
  }
${page.type === 'Login' ? `
  async enterUsername(username) {
    const el = await this.driver.findElement(this.locator0);
    await el.clear();
    await el.sendKeys(username);
  }

  async enterPassword(password) {
    const el = await this.driver.findElement(this.locator1);
    await el.clear();
    await el.sendKeys(password);
  }

  async clickLogin() {
    const el = await this.driver.findElement(this.locator2);
    await el.click();
  }

  async login(username, password) {
    await this.enterUsername(username);
    await this.enterPassword(password);
    await this.clickLogin();
  }

  async isErrorVisible() {
    try {
      const el = await this.driver.findElement(this.locator5);
      return await el.isDisplayed();
    } catch {
      return false;
    }
  }
` : page.type === 'Dashboard' ? `
  async getHeaderText() {
    const el = await this.driver.findElement(this.locator0);
    return el.getText();
  }

  async areWidgetsVisible() {
    const widgets = await this.driver.findElements(this.locator1);
    return widgets.length > 0;
  }

  async clickUserMenu() {
    const el = await this.driver.findElement(this.locator4);
    await el.click();
  }
` : `
  async isLoaded() {
    try {
      await this.driver.wait(until.elementLocated(this.locator0), 5000);
      return true;
    } catch {
      return false;
    }
  }
`}
}

module.exports = ${className}Page;
`;
}

function generateSeleniumTSPageObject(page: DiscoveredPage): string {
  const className = getPageClassName(page);
  const locators = generateLocators(page);

  return `import { By, until, WebDriver, WebElement } from 'selenium-webdriver';
import { BasePage } from './BasePage';

export class ${className}Page extends BasePage {
  private readonly url: string = '${page.url}';
${locators.map((loc, i) => `  private readonly locator${i} = By.css('${loc}');`).join('\n')}

  constructor(driver: WebDriver) {
    super(driver);
  }

  async navigate(): Promise<${className}Page> {
    await this.driver.get(this.url);
    return this.waitForPageLoad();
  }

  async waitForPageLoad(): Promise<${className}Page> {
    await this.driver.wait(
      until.elementLocated(this.locator0),
      10000,
      '${className} page did not load within 10 seconds'
    );
    return this;
  }
${page.type === 'Login' ? `
  async enterUsername(username: string): Promise<void> {
    const el = await this.driver.findElement(this.locator0);
    await el.clear();
    await el.sendKeys(username);
  }

  async enterPassword(password: string): Promise<void> {
    const el = await this.driver.findElement(this.locator1);
    await el.clear();
    await el.sendKeys(password);
  }

  async clickLogin(): Promise<void> {
    const el = await this.driver.findElement(this.locator2);
    await el.click();
  }

  async login(username: string, password: string): Promise<void> {
    await this.enterUsername(username);
    await this.enterPassword(password);
    await this.clickLogin();
  }

  async isErrorVisible(): Promise<boolean> {
    try {
      const el = await this.driver.findElement(this.locator5);
      return await el.isDisplayed();
    } catch {
      return false;
    }
  }
` : page.type === 'Dashboard' ? `
  async getHeaderText(): Promise<string> {
    const el = await this.driver.findElement(this.locator0);
    return el.getText();
  }

  async areWidgetsVisible(): Promise<boolean> {
    const widgets = await this.driver.findElements(this.locator1);
    return widgets.length > 0;
  }

  async clickUserMenu(): Promise<void> {
    const el = await this.driver.findElement(this.locator4);
    await el.click();
  }
` : `
  async isLoaded(): Promise<boolean> {
    try {
      await this.driver.wait(until.elementLocated(this.locator0), 5000);
      return true;
    } catch {
      return false;
    }
  }
`}
}
`;
}

function generateCypressJSPageObject(page: DiscoveredPage): string {
  const className = getPageClassName(page);
  const locators = generateLocators(page);

  return `class ${className}Page {
  constructor() {
    this.url = '${page.url}';
${locators.map((loc, i) => `    this.locator${i} = '${loc}';`).join('\n')}
  }

  visit() {
    cy.visit(this.url);
    return this;
  }

  waitForPageLoad() {
    cy.get(this.locator0).should('be.visible');
    return this;
  }
${page.type === 'Login' ? `
  enterUsername(username) {
    cy.get(this.locator0).clear().type(username);
    return this;
  }

  enterPassword(password) {
    cy.get(this.locator1).clear().type(password);
    return this;
  }

  clickLogin() {
    cy.get(this.locator2).click();
    return this;
  }

  login(username, password) {
    this.enterUsername(username);
    this.enterPassword(password);
    this.clickLogin();
    return this;
  }

  isErrorVisible() {
    return cy.get(this.locator5).should('be.visible');
  }
` : page.type === 'Dashboard' ? `
  getHeaderText() {
    return cy.get(this.locator0).invoke('text');
  }

  areWidgetsVisible() {
    return cy.get(this.locator1).should('have.length.greaterThan', 0);
  }

  clickUserMenu() {
    cy.get(this.locator4).click();
    return this;
  }
` : `
  isLoaded() {
    return cy.get(this.locator0).should('be.visible');
  }
`}
}

export default ${className}Page;
`;
}

function generateCypressTSPageObject(page: DiscoveredPage): string {
  const className = getPageClassName(page);
  const locators = generateLocators(page);

  return `export class ${className}Page {
  private readonly url: string = '${page.url}';
${locators.map((loc, i) => `  private readonly locator${i}: string = '${loc}';`).join('\n')}

  visit(): ${className}Page {
    cy.visit(this.url);
    return this;
  }

  waitForPageLoad(): ${className}Page {
    cy.get(this.locator0).should('be.visible');
    return this;
  }
${page.type === 'Login' ? `
  enterUsername(username: string): ${className}Page {
    cy.get(this.locator0).clear().type(username);
    return this;
  }

  enterPassword(password: string): ${className}Page {
    cy.get(this.locator1).clear().type(password);
    return this;
  }

  clickLogin(): ${className}Page {
    cy.get(this.locator2).click();
    return this;
  }

  login(username: string, password: string): ${className}Page {
    this.enterUsername(username);
    this.enterPassword(password);
    this.clickLogin();
    return this;
  }

  isErrorVisible(): Cypress.Chainable {
    return cy.get(this.locator5).should('be.visible');
  }
` : page.type === 'Dashboard' ? `
  getHeaderText(): Cypress.Chainable<string> {
    return cy.get(this.locator0).invoke('text');
  }

  areWidgetsVisible(): void {
    cy.get(this.locator1).should('have.length.greaterThan', 0);
  }

  clickUserMenu(): ${className}Page {
    cy.get(this.locator4).click();
    return this;
  }
` : `
  isLoaded(): void {
    cy.get(this.locator0).should('be.visible');
  }
`}
}
`;
}

function generatePlaywrightJSPageObject(page: DiscoveredPage): string {
  const className = getPageClassName(page);
  const locators = generateLocators(page);

  return `const { expect } = require('@playwright/test');

class ${className}Page {
  constructor(page) {
    this.page = page;
    this.url = '${page.url}';
${locators.map((loc, i) => `    this.locator${i} = page.locator('${loc}');`).join('\n')}
  }

  async navigate() {
    await this.page.goto(this.url);
    await this.waitForPageLoad();
  }

  async waitForPageLoad() {
    await expect(this.locator0).toBeVisible({ timeout: 10000 });
  }
${page.type === 'Login' ? `
  async enterUsername(username) {
    await this.locator0.fill('');
    await this.locator0.fill(username);
  }

  async enterPassword(password) {
    await this.locator1.fill('');
    await this.locator1.fill(password);
  }

  async clickLogin() {
    await this.locator2.click();
  }

  async login(username, password) {
    await this.enterUsername(username);
    await this.enterPassword(password);
    await this.clickLogin();
  }

  async isErrorVisible() {
    return await this.locator5.isVisible();
  }
` : page.type === 'Dashboard' ? `
  async getHeaderText() {
    return await this.locator0.textContent();
  }

  async areWidgetsVisible() {
    const count = await this.locator1.count();
    return count > 0;
  }

  async clickUserMenu() {
    await this.locator4.click();
  }
` : `
  async isLoaded() {
    try {
      await expect(this.locator0).toBeVisible({ timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }
`}
}

module.exports = ${className}Page;
`;
}

function generatePlaywrightTSPageObject(page: DiscoveredPage): string {
  const className = getPageClassName(page);
  const locators = generateLocators(page);

  return `import { Page, Locator, expect } from '@playwright/test';

export class ${className}Page {
  private readonly url: string = '${page.url}';
${locators.map((_loc, i) => `  private readonly locator${i}: Locator;`).join('\n')}

  constructor(private readonly page: Page) {
${locators.map((loc, i) => `    this.locator${i} = page.locator('${loc}');`).join('\n')}
  }

  async navigate(): Promise<void> {
    await this.page.goto(this.url);
    await this.waitForPageLoad();
  }

  async waitForPageLoad(): Promise<void> {
    await expect(this.locator0).toBeVisible({ timeout: 10000 });
  }
${page.type === 'Login' ? `
  async enterUsername(username: string): Promise<void> {
    await this.locator0.fill('');
    await this.locator0.fill(username);
  }

  async enterPassword(password: string): Promise<void> {
    await this.locator1.fill('');
    await this.locator1.fill(password);
  }

  async clickLogin(): Promise<void> {
    await this.locator2.click();
  }

  async login(username: string, password: string): Promise<void> {
    await this.enterUsername(username);
    await this.enterPassword(password);
    await this.clickLogin();
  }

  async isErrorVisible(): Promise<boolean> {
    return await this.locator5.isVisible();
  }
` : page.type === 'Dashboard' ? `
  async getHeaderText(): Promise<string | null> {
    return await this.locator0.textContent();
  }

  async areWidgetsVisible(): Promise<boolean> {
    const count = await this.locator1.count();
    return count > 0;
  }

  async clickUserMenu(): Promise<void> {
    await this.locator4.click();
  }
` : `
  async isLoaded(): Promise<boolean> {
    try {
      await expect(this.locator0).toBeVisible({ timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }
`}
}
`;
}

function generateSeleniumJSTest(page: DiscoveredPage): string {
  const className = getPageClassName(page);
  const tests = pageTypeTests[page.type];

  return `const { Builder } = require('selenium-webdriver');
const ${className}Page = require('../pages/${className}Page');

describe('${className} Page Tests', () => {
  let driver;
  let ${className.toLowerCase()}Page;

  beforeEach(async () => {
    driver = await new Builder().forBrowser('chrome').build();
    ${className.toLowerCase()}Page = new ${className}Page(driver);
    await ${className.toLowerCase()}Page.navigate();
  });

  afterEach(async () => {
    if (driver) {
      await driver.quit();
    }
  });

${tests.map((t, idx) => `  it('${t}', async () => {
    // TODO: Implement test step${idx > 0 ? 's' : ''}
    expect(await ${className.toLowerCase()}Page.isLoaded()).toBe(true);
  });`).join('\n\n')}
});
`;
}

function generateSeleniumTSTest(page: DiscoveredPage): string {
  const className = getPageClassName(page);
  const tests = pageTypeTests[page.type];

  return `import { Builder, WebDriver } from 'selenium-webdriver';
import { ${className}Page } from '../pages/${className}Page';

describe('${className} Page Tests', () => {
  let driver: WebDriver;
  let ${className.toLowerCase()}Page: ${className}Page;

  beforeEach(async () => {
    driver = await new Builder().forBrowser('chrome').build();
    ${className.toLowerCase()}Page = new ${className}Page(driver);
    await ${className.toLowerCase()}Page.navigate();
  });

  afterEach(async () => {
    if (driver) {
      await driver.quit();
    }
  });

${tests.map((t) => `  it('${t}', async () => {
    const isLoaded = await ${className.toLowerCase()}Page.isLoaded();
    expect(isLoaded).toBe(true);
  });`).join('\n\n')}
});
`;
}

function generateCypressJSTest(page: DiscoveredPage): string {
  const className = getPageClassName(page);
  const tests = pageTypeTests[page.type];

  return `import ${className}Page from '../pages/${className}Page';

describe('${className} Page Tests', () => {
  const ${className.toLowerCase()}Page = new ${className}Page();

  beforeEach(() => {
    ${className.toLowerCase()}Page.visit().waitForPageLoad();
  });

${tests.map((t) => `  it('${t}', () => {
    ${className.toLowerCase()}Page.isLoaded();
  });`).join('\n\n')}
});
`;
}

function generateCypressTSTest(page: DiscoveredPage): string {
  const className = getPageClassName(page);
  const tests = pageTypeTests[page.type];

  return `import { ${className}Page } from '../pages/${className}Page';

describe('${className} Page Tests', () => {
  const ${className.toLowerCase()}Page = new ${className}Page();

  beforeEach(() => {
    ${className.toLowerCase()}Page.visit().waitForPageLoad();
  });

${tests.map((t) => `  it('${t}', () => {
    ${className.toLowerCase()}Page.isLoaded();
  });`).join('\n\n')}
});
`;
}

function generatePlaywrightJSTest(page: DiscoveredPage): string {
  const className = getPageClassName(page);
  const tests = pageTypeTests[page.type];

  return `const { test, expect } = require('@playwright/test');
const ${className}Page = require('../pages/${className}Page');

test.describe('${className} Page Tests', () => {
  let ${className.toLowerCase()}Page;

  test.beforeEach(async ({ page }) => {
    ${className.toLowerCase()}Page = new ${className}Page(page);
    await ${className.toLowerCase()}Page.navigate();
  });

${tests.map((t) => `  test('${t}', async () => {
    const isLoaded = await ${className.toLowerCase()}Page.isLoaded();
    expect(isLoaded).toBe(true);
  });`).join('\n\n')}
});
`;
}

function generatePlaywrightTSTest(page: DiscoveredPage): string {
  const className = getPageClassName(page);
  const tests = pageTypeTests[page.type];

  return `import { test, expect } from '@playwright/test';
import { ${className}Page } from '../pages/${className}Page';

test.describe('${className} Page Tests', () => {
  let ${className.toLowerCase()}Page: ${className}Page;

  test.beforeEach(async ({ page }) => {
    ${className.toLowerCase()}Page = new ${className}Page(page);
    await ${className.toLowerCase()}Page.navigate();
  });

${tests.map((t) => `  test('${t}', async () => {
    const isLoaded = await ${className.toLowerCase()}Page.isLoaded();
    expect(isLoaded).toBe(true);
  });`).join('\n\n')}
});
`;
}

const pageObjectGenerators: Record<Framework, (page: DiscoveredPage) => string> = {
  'selenium-js': generateSeleniumJSPageObject,
  'selenium-ts': generateSeleniumTSPageObject,
  'cypress-js': generateCypressJSPageObject,
  'cypress-ts': generateCypressTSPageObject,
  'playwright-js': generatePlaywrightJSPageObject,
  'playwright-ts': generatePlaywrightTSPageObject,
};

const testGenerators: Record<Framework, (page: DiscoveredPage) => string> = {
  'selenium-js': generateSeleniumJSTest,
  'selenium-ts': generateSeleniumTSTest,
  'cypress-js': generateCypressJSTest,
  'cypress-ts': generateCypressTSTest,
  'playwright-js': generatePlaywrightJSTest,
  'playwright-ts': generatePlaywrightTSTest,
};

export function generatePageObject(page: DiscoveredPage, framework: Framework): string {
  return pageObjectGenerators[framework](page);
}

export function generateTest(page: DiscoveredPage, framework: Framework): string {
  return testGenerators[framework](page);
}

export function generateConfigFiles(framework: Framework): Record<string, string> {
  const configs: Record<Framework, Record<string, string>> = {
    'selenium-js': {
      'config/wdio.conf.js': `exports.config = {
  runner: 'local',
  specs: ['../tests/**/*.test.js'],
  exclude: [],
  maxInstances: 5,
  capabilities: [{
    maxInstances: 1,
    browserName: 'chrome',
    'goog:chromeOptions': {
      args: ['--headless', '--disable-gpu', '--window-size=1920,1080']
    }
  }],
  logLevel: 'info',
  bail: 0,
  waitforTimeout: 10000,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 3,
  framework: 'mocha',
  reporters: ['spec'],
  mochaOpts: {
    ui: 'bdd',
    timeout: 60000
  }
};`,
      'pages/BasePage.js': `class BasePage {
  constructor(driver) {
    this.driver = driver;
  }

  async waitForElement(locator, timeout = 10000) {
    const { until } = require('selenium-webdriver');
    return await this.driver.wait(until.elementLocated(locator), timeout);
  }

  async takeScreenshot(name) {
    const data = await this.driver.takeScreenshot();
    const fs = require('fs');
    const path = require('path');
    const screenshotPath = path.join(__dirname, '../reports', \`\${name}_\${Date.now()}.png\`);
    fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
    fs.writeFileSync(screenshotPath, data, 'base64');
    return screenshotPath;
  }
}

module.exports = BasePage;`,
      'utilities/Logger.js': `class Logger {
  static info(message) {
    console.log(\`[INFO] \${new Date().toISOString()} - \${message}\`);
  }

  static error(message, error) {
    console.error(\`[ERROR] \${new Date().toISOString()} - \${message}\`, error);
  }

  static warn(message) {
    console.warn(\`[WARN] \${new Date().toISOString()} - \${message}\`);
  }
}

module.exports = Logger;`,
      'utilities/WaitUtils.js': `const { until } = require('selenium-webdriver');

class WaitUtils {
  static async waitForVisible(driver, locator, timeout = 10000) {
    return await driver.wait(until.elementIsVisible(driver.findElement(locator)), timeout);
  }

  static async waitForClickable(driver, locator, timeout = 10000) {
    return await driver.wait(until.elementIsEnabled(driver.findElement(locator)), timeout);
  }

  static async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = WaitUtils;`,
    },
    'selenium-ts': {
      'config/wdio.conf.ts': `export const config: WebdriverIO.Config = {
  runner: 'local',
  specs: ['../tests/**/*.test.ts'],
  exclude: [],
  maxInstances: 5,
  capabilities: [{
    maxInstances: 1,
    browserName: 'chrome',
    'goog:chromeOptions': {
      args: ['--headless', '--disable-gpu', '--window-size=1920,1080']
    }
  }],
  logLevel: 'info',
  bail: 0,
  waitforTimeout: 10000,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 3,
  framework: 'mocha',
  reporters: ['spec'],
  mochaOpts: {
    ui: 'bdd',
    timeout: 60000
  }
};`,
      'pages/BasePage.ts': `import { WebDriver, By, until, WebElement } from 'selenium-webdriver';

export abstract class BasePage {
  protected constructor(protected readonly driver: WebDriver) {}

  async waitForElement(locator: By, timeout: number = 10000): Promise<WebElement> {
    return await this.driver.wait(until.elementLocated(locator), timeout);
  }

  async takeScreenshot(name: string): Promise<string> {
    const data = await this.driver.takeScreenshot();
    const fs = require('fs');
    const path = require('path');
    const screenshotPath = path.join(__dirname, '../reports', \`\${name}_\${Date.now()}.png\`);
    fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
    fs.writeFileSync(screenshotPath, data, 'base64');
    return screenshotPath;
  }
}`,
      'utilities/Logger.ts': `export class Logger {
  static info(message: string): void {
    console.log(\`[INFO] \${new Date().toISOString()} - \${message}\`);
  }

  static error(message: string, error?: Error): void {
    console.error(\`[ERROR] \${new Date().toISOString()} - \${message}\`, error);
  }

  static warn(message: string): void {
    console.warn(\`[WARN] \${new Date().toISOString()} - \${message}\`);
  }
}`,
      'utilities/WaitUtils.ts': `import { WebDriver, By, until, WebElement } from 'selenium-webdriver';

export class WaitUtils {
  static async waitForVisible(driver: WebDriver, locator: By, timeout: number = 10000): Promise<WebElement> {
    return await driver.wait(until.elementIsVisible(driver.findElement(locator)), timeout);
  }

  static async waitForClickable(driver: WebDriver, locator: By, timeout: number = 10000): Promise<WebElement> {
    return await driver.wait(until.elementIsEnabled(driver.findElement(locator)), timeout);
  }

  static async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}`,
      'tsconfig.json': `{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["**/*.ts"],
  "exclude": ["node_modules", "dist"]
}`,
    },
    'cypress-js': {
      'config/cypress.config.js': `const { defineConfig } = require('cypress');

module.exports = defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000',
    specPattern: 'tests/**/*.test.js',
    supportFile: 'config/support/e2e.js',
    video: false,
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 10000,
    pageLoadTimeout: 30000,
    viewportWidth: 1920,
    viewportHeight: 1080,
    retries: {
      runMode: 2,
      openMode: 0
    }
  }
});`,
      'config/support/e2e.js': `import './commands';

Cypress.on('uncaught:exception', (err, runnable) => {
  console.error('Uncaught exception:', err);
  return false;
});

beforeEach(() => {
  cy.log('Test started:', Cypress.currentTest.title);
});`,
      'config/support/commands.js': `Cypress.Commands.add('getByTestId', (testId) => {
  return cy.get(\`[data-testid="\${testId}"]\`);
});

Cypress.Commands.add('login', (username, password) => {
  cy.session([username, password], () => {
    cy.visit('/login');
    cy.getByTestId('username-input').type(username);
    cy.getByTestId('password-input').type(password);
    cy.getByTestId('login-button').click();
    cy.url().should('not.include', '/login');
  });
});`,
      'utilities/Logger.js': `class Logger {
  static info(message) {
    cy.log(\`[INFO] \${message}\`);
  }

  static error(message) {
    cy.log(\`[ERROR] \${message}\`);
  }
}

module.exports = Logger;`,
    },
    'cypress-ts': {
      'config/cypress.config.ts': `import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000',
    specPattern: 'tests/**/*.test.ts',
    supportFile: 'config/support/e2e.ts',
    video: false,
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 10000,
    pageLoadTimeout: 30000,
    viewportWidth: 1920,
    viewportHeight: 1080,
    retries: {
      runMode: 2,
      openMode: 0
    }
  }
});`,
      'config/support/e2e.ts': `import './commands';

Cypress.on('uncaught:exception', (err: Error, runnable: Mocha.Runnable) => {
  console.error('Uncaught exception:', err);
  return false;
});

beforeEach(() => {
  cy.log('Test started:', Cypress.currentTest.title);
});`,
      'config/support/commands.ts': `declare global {
  namespace Cypress {
    interface Chainable {
      getByTestId(testId: string): Chainable<Element>;
      login(username: string, password: string): void;
    }
  }
}

Cypress.Commands.add('getByTestId', (testId: string) => {
  return cy.get(\`[data-testid="\${testId}"]\`);
});

Cypress.Commands.add('login', (username: string, password: string) => {
  cy.session([username, password], () => {
    cy.visit('/login');
    cy.getByTestId('username-input').type(username);
    cy.getByTestId('password-input').type(password);
    cy.getByTestId('login-button').click();
    cy.url().should('not.include', '/login');
  });
});`,
      'utilities/Logger.ts': `export class Logger {
  static info(message: string): void {
    cy.log(\`[INFO] \${message}\`);
  }

  static error(message: string): void {
    cy.log(\`[ERROR] \${message}\`);
  }
}`,
      'tsconfig.json': `{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM"],
    "allowJs": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "strict": true,
    "noImplicitAny": false,
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "types": ["cypress"]
  },
  "include": ["**/*.ts"]
}`,
    },
    'playwright-js': {
      'config/playwright.config.js': `const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: '../tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { outputFolder: '../reports/playwright-report' }]],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    viewport: { width: 1920, height: 1080 }
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } }
  ]
});`,
      'utilities/Logger.js': `class Logger {
  static info(message) {
    console.log(\`[INFO] \${new Date().toISOString()} - \${message}\`);
  }

  static error(message, error) {
    console.error(\`[ERROR] \${new Date().toISOString()} - \${message}\`, error);
  }
}

module.exports = Logger;`,
      'fixtures/test-data.json': `{
  "users": {
    "valid": {
      "username": "testuser@example.com",
      "password": "TestPassword123!"
    },
    "invalid": {
      "username": "invalid@example.com",
      "password": "wrong"
    }
  },
  "urls": {
    "base": "http://localhost:3000",
    "login": "/login",
    "dashboard": "/dashboard"
  }
}`,
    },
    'playwright-ts': {
      'config/playwright.config.ts': `import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '../tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { outputFolder: '../reports/playwright-report' }]],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    viewport: { width: 1920, height: 1080 }
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } }
  ]
});`,
      'utilities/Logger.ts': `export class Logger {
  static info(message: string): void {
    console.log(\`[INFO] \${new Date().toISOString()} - \${message}\`);
  }

  static error(message: string, error?: Error): void {
    console.error(\`[ERROR] \${new Date().toISOString()} - \${message}\`, error);
  }
}`,
      'fixtures/test-data.json': `{
  "users": {
    "valid": {
      "username": "testuser@example.com",
      "password": "TestPassword123!"
    },
    "invalid": {
      "username": "invalid@example.com",
      "password": "wrong"
    }
  },
  "urls": {
    "base": "http://localhost:3000",
    "login": "/login",
    "dashboard": "/dashboard"
  }
}`,
      'tsconfig.json': `{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "sourceMap": true
  },
  "include": ["**/*.ts"],
  "exclude": ["node_modules", "dist"]
}`,
    },
  };

  return configs[framework];
}

export function generatePackageJson(framework: Framework): string {
  const packages: Record<Framework, { name: string; deps: string; devDeps: string }> = {
    'selenium-js': {
      name: 'selenium-js-project',
      deps: `    "selenium-webdriver": "^4.15.0"`,
      devDeps: `    "mocha": "^10.2.0",
    "chai": "^4.3.10",
    "webdriverio": "^8.24.0"`,
    },
    'selenium-ts': {
      name: 'selenium-ts-project',
      deps: `    "selenium-webdriver": "^4.15.0"`,
      devDeps: `    "@types/node": "^20.0.0",
    "typescript": "^5.2.0",
    "mocha": "^10.2.0",
    "@types/mocha": "^10.0.0",
    "chai": "^4.3.10",
    "@types/chai": "^4.3.0",
    "ts-node": "^10.9.0"`,
    },
    'cypress-js': {
      name: 'cypress-js-project',
      deps: ``,
      devDeps: `    "cypress": "^13.6.0"`,
    },
    'cypress-ts': {
      name: 'cypress-ts-project',
      deps: ``,
      devDeps: `    "cypress": "^13.6.0",
    "typescript": "^5.2.0",
    "@types/node": "^20.0.0"`,
    },
    'playwright-js': {
      name: 'playwright-js-project',
      deps: ``,
      devDeps: `    "@playwright/test": "^1.40.0"`,
    },
    'playwright-ts': {
      name: 'playwright-ts-project',
      deps: ``,
      devDeps: `    "@playwright/test": "^1.40.0",
    "typescript": "^5.2.0",
    "@types/node": "^20.0.0"`,
    },
  };

  const pkg = packages[framework];
  return `{
  "name": "${pkg.name}",
  "version": "1.0.0",
  "description": "Auto-generated test automation project for WebCrawler Pro",
  "scripts": {
    "test": "${framework.startsWith('selenium') ? 'mocha --timeout 60000 tests/**/*.test.' + (framework.endsWith('ts') ? 'ts --require ts-node/register' : 'js') : framework.startsWith('cypress') ? 'cypress run' : 'playwright test'}"
  },
  "dependencies": {
${pkg.deps}${pkg.deps ? '\n  ' : ''}},
  "devDependencies": {
${pkg.devDeps}
  }
}`;
}

export function generateReadme(framework: Framework): string {
  const names: Record<Framework, string> = {
    'selenium-js': 'Selenium WebDriver (JavaScript)',
    'selenium-ts': 'Selenium WebDriver (TypeScript)',
    'cypress-js': 'Cypress (JavaScript)',
    'cypress-ts': 'Cypress (TypeScript)',
    'playwright-js': 'Playwright (JavaScript)',
    'playwright-ts': 'Playwright (TypeScript)',
  };

  const runCommands: Record<Framework, string> = {
    'selenium-js': 'npm test',
    'selenium-ts': 'npm test',
    'cypress-js': 'npx cypress open    # Interactive mode\nnpx cypress run     # Headless mode',
    'cypress-ts': 'npx cypress open    # Interactive mode\nnpx cypress run     # Headless mode',
    'playwright-js': 'npx playwright test\nnpx playwright test --ui    # Interactive UI mode',
    'playwright-ts': 'npx playwright test\nnpx playwright test --ui    # Interactive UI mode',
  };

  return `# ${names[framework]} Test Automation Project

This project was auto-generated by WebCrawler Pro.

## Project Structure

\`\`\`
${framework}/
├── tests/           # Test files (one per discovered page)
├── pages/           # Page Object Models
├── config/          # Framework configuration
├── utilities/       # Helper utilities and logging
├── fixtures/        # Test data
├── reports/         # Test execution reports
└── package.json     # Project dependencies
\`\`\`

## Setup

1. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

2. Install browser drivers (if needed):
   \`\`\`bash
   npx playwright install    # For Playwright
   \`\`\`

## Running Tests

\`\`\`bash
${runCommands[framework]}
\`\`\`

## Page Objects

Each discovered page has a corresponding Page Object with:
- Resilient locators (prioritizing data-testid, aria-label, role)
- Navigation methods
- Element interaction methods
- Wait and synchronization utilities

## Generated Features

- Page Object Model pattern
- Resilient locator strategy
- Dynamic wait mechanisms
- Error handling and logging
- Screenshot capture on failure
- Configurable retry logic
`;
}

export function generateExecutionGuide(framework: Framework): string {
  return `# Execution Guide (${framework})

## Prerequisites

- Node.js 18+ installed
- Target application running and accessible

## Quick Start

1. Extract the ZIP archive
2. Navigate to the project folder
3. Run \`npm install\` to install dependencies
4. Update the \`baseUrl\` in config files if needed
5. Run tests using the commands in README.md

## Configuration

### Changing Target URL

Edit the configuration file in \`config/\` to update the base URL:

- Selenium: Update \`pages/*Page.js\` url fields
- Cypress: Update \`config/cypress.config.*\` baseUrl
- Playwright: Update \`config/playwright.config.*\` baseURL

### Running Specific Tests

- Selenium: \`npm test -- --grep "Login"\`
- Cypress: \`npx cypress run --spec "tests/login.test.*"\`
- Playwright: \`npx playwright test tests/login.test.*\`

### Headless vs Headed Mode

- Selenium: Controlled via WebDriver options
- Cypress: \`npx cypress run\` (headless), \`npx cypress open\` (headed)
- Playwright: \`npx playwright test\` (headless), \`npx playwright test --headed\`

## Troubleshooting

### Browser not found
- Install browsers: \`npx playwright install\`
- Or update ChromeDriver for Selenium

### Tests failing due to timing
- Increase timeout values in config files
- Add explicit waits where needed

### Locator issues
- Check that data-testid attributes match the target application
- Update locators in Page Object files as needed
`;
}
