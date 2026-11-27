import type { AutomationFramework, ProgrammingLanguage, TestingApproach, TestingTool } from '@/types';

export interface FrameworkOption {
  id: AutomationFramework;
  tool: TestingTool;
  language: ProgrammingLanguage;
  label: string;
  shortLabel: string;
  runnerStack: string;
  description: string;
}

export const LANGUAGE_OPTIONS: {
  id: ProgrammingLanguage;
  label: string;
  badge: string;
}[] = [
  { id: 'java', label: 'Java', badge: 'JVM / Maven' },
  { id: 'javascript', label: 'JavaScript', badge: 'Node.js / ES2022' },
  { id: 'typescript', label: 'TypeScript', badge: 'Typed Node.js' },
  { id: 'python', label: 'Python', badge: 'Pytest 3.11+' },
];

export const TOOL_OPTIONS: {
  id: TestingTool;
  label: string;
  supportedLanguages: ProgrammingLanguage[];
}[] = [
  { id: 'playwright', label: 'Playwright', supportedLanguages: ['typescript', 'python'] },
  { id: 'cypress', label: 'Cypress', supportedLanguages: ['typescript', 'javascript'] },
  { id: 'selenium', label: 'Selenium WebDriver', supportedLanguages: ['java', 'javascript', 'typescript', 'python'] },
];

export const FRAMEWORK_OPTIONS: FrameworkOption[] = [
  {
    id: 'playwright-ts',
    tool: 'playwright',
    language: 'typescript',
    label: 'Playwright (TypeScript)',
    shortLabel: 'Playwright · TS',
    runnerStack: 'Playwright + TypeScript + POM',
    description: 'Modern multi-browser Playwright suite with auto-waiting locators, HTML reports, and mobile presets.',
  },
  {
    id: 'playwright-python',
    tool: 'playwright',
    language: 'python',
    label: 'Playwright (Python)',
    shortLabel: 'Playwright · Py',
    runnerStack: 'Playwright Sync + Pytest + POM',
    description: 'Fast Python Playwright tests with pytest fixtures, viewport assertions, and HTML reports.',
  },
  {
    id: 'selenium-java-testng',
    tool: 'selenium',
    language: 'java',
    label: 'Selenium Java (TestNG)',
    shortLabel: 'Java · TestNG',
    runnerStack: 'Selenium 4 + TestNG + Maven POM',
    description: 'Complete Maven project with pom.xml, testng.xml, DriverFactory, and Page Objects.',
  },
  {
    id: 'selenium-java-junit',
    tool: 'selenium',
    language: 'java',
    label: 'Selenium Java (JUnit 5)',
    shortLabel: 'Java · JUnit 5',
    runnerStack: 'Selenium 4 + JUnit 5 + Maven POM',
    description: 'Enterprise Maven structure with JUnit Jupiter assertions and screenshot hooks.',
  },
  {
    id: 'cypress-ts',
    tool: 'cypress',
    language: 'typescript',
    label: 'Cypress (TypeScript)',
    shortLabel: 'Cypress · TS',
    runnerStack: 'Cypress 13 + TypeScript + POM',
    description: 'Type-safe E2E specs, typed Page Objects, custom commands, and fixtures.',
  },
  {
    id: 'cypress-js',
    tool: 'cypress',
    language: 'javascript',
    label: 'Cypress (JavaScript)',
    shortLabel: 'Cypress · JS',
    runnerStack: 'Cypress 13 + Mocha/Chai + POM',
    description: 'Modern ES module specs with reusable custom commands and Page Objects.',
  },
  {
    id: 'selenium-python-pytest',
    tool: 'selenium',
    language: 'python',
    label: 'Selenium Python (Pytest)',
    shortLabel: 'Python · Pytest',
    runnerStack: 'Selenium 4 + Pytest + Fixtures',
    description: 'Clean Python POM with conftest fixtures, pytest.ini, and HTML reporting.',
  },
  {
    id: 'selenium-js',
    tool: 'selenium',
    language: 'javascript',
    label: 'Selenium (JavaScript)',
    shortLabel: 'Selenium · JS',
    runnerStack: 'Selenium WebDriver + Mocha/Chai',
    description: 'Node.js WebDriver suite with modular BasePage and explicit wait helpers.',
  },
  {
    id: 'selenium-ts',
    tool: 'selenium',
    language: 'typescript',
    label: 'Selenium (TypeScript)',
    shortLabel: 'Selenium · TS',
    runnerStack: 'Selenium WebDriver + Mocha/Chai + TS',
    description: 'Typed WebDriver factory, async explicit waits, and Chai assertions.',
  },
];

export const APPROACH_OPTIONS: { id: TestingApproach; label: string; summary: string }[] = [
  { id: 'pom', label: 'Page Object Model', summary: 'Separated page locators and test specs' },
  { id: 'data-driven', label: 'Data-Driven', summary: 'Externalized fixtures and test-data JSON' },
  { id: 'bdd-style', label: 'Behavior-Driven', summary: 'Scenario-structured Given/When/Then assertions' },
  { id: 'hybrid', label: 'Hybrid Suite', summary: 'POM + Data-Driven + Reusable utilities' },
];

export function getFrameworkMeta(id: AutomationFramework): FrameworkOption {
  return FRAMEWORK_OPTIONS.find((f) => f.id === id) || FRAMEWORK_OPTIONS[0];
}
