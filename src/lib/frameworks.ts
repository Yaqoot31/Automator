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

export const FRAMEWORK_OPTIONS: FrameworkOption[] = [
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
    id: 'selenium-python-pytest',
    tool: 'selenium',
    language: 'python',
    label: 'Selenium Python (Pytest)',
    shortLabel: 'Python · Pytest',
    runnerStack: 'Selenium 4 + Pytest + Fixtures',
    description: 'Clean Python POM with conftest fixtures, pytest.ini, and HTML reporting.',
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
  {
    id: 'selenium-js',
    tool: 'selenium',
    language: 'javascript',
    label: 'Selenium (JavaScript)',
    shortLabel: 'Selenium · JS',
    runnerStack: 'Selenium WebDriver + Mocha/Chai',
    description: 'Node.js WebDriver suite with modular BasePage and explicit wait helpers.',
  },
];

export const APPROACH_OPTIONS: { id: TestingApproach; label: string; summary: string }[] = [
  { id: 'pom', label: 'Page Object Model', summary: 'Separated page locators and test specs' },
  { id: 'data-driven', label: 'Data-Driven', summary: 'Externalized fixtures and test-data JSON' },
  { id: 'bdd-style', label: 'Behavior-Driven', summary: 'Scenario-structured Given/When/Then assertions' },
  { id: 'hybrid', label: 'Hybrid Suite', summary: 'POM + Data-Driven + Reusable utilities' },
];
