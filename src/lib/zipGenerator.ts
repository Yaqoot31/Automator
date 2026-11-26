import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import type { DiscoveredPage, Framework } from '@/types';
import {
  generatePageObject,
  generateTest,
  generateConfigFiles,
  generatePackageJson,
  generateReadme,
  generateExecutionGuide,
} from './codeGenerator';

const frameworkNames: Record<Framework, string> = {
  'selenium-js': 'selenium-js-project',
  'selenium-ts': 'selenium-ts-project',
  'cypress-js': 'cypress-js-project',
  'cypress-ts': 'cypress-ts-project',
  'playwright-js': 'playwright-js-project',
  'playwright-ts': 'playwright-ts-project',
};

const testExtension: Record<Framework, string> = {
  'selenium-js': 'js',
  'selenium-ts': 'ts',
  'cypress-js': 'js',
  'cypress-ts': 'ts',
  'playwright-js': 'js',
  'playwright-ts': 'ts',
};

function getPageClassName(page: DiscoveredPage): string {
  const name = page.path
    .split('/')
    .filter(Boolean)
    .pop() || 'home';
  return name.charAt(0).toUpperCase() + name.slice(1).replace(/[-_]/g, '');
}

export async function generateZip(
  pages: DiscoveredPage[],
  framework: Framework
): Promise<void> {
  const zip = new JSZip();
  const projectName = frameworkNames[framework];
  const ext = testExtension[framework];
  const root = zip.folder(projectName);
  if (!root) return;

  const testsFolder = root.folder('tests');
  const pagesFolder = root.folder('pages');
  const configFolder = root.folder('config');
  const utilitiesFolder = root.folder('utilities');
  const fixturesFolder = root.folder('fixtures');
  root.folder('reports');

  for (const page of pages) {
    const className = getPageClassName(page);

    if (testsFolder) {
      testsFolder.file(
        `${className.toLowerCase()}.test.${ext}`,
        generateTest(page, framework)
      );
    }

    if (pagesFolder) {
      pagesFolder.file(
        `${className}Page.${ext}`,
        generatePageObject(page, framework)
      );
    }
  }

  const configs = generateConfigFiles(framework);
  for (const [path, content] of Object.entries(configs)) {
    const folder = path.startsWith('config/')
      ? configFolder
      : path.startsWith('utilities/')
        ? utilitiesFolder
        : path.startsWith('fixtures/')
          ? fixturesFolder
          : root;
    if (folder) {
      const fileName = path.split('/').pop() || path;
      folder.file(fileName, content);
    }
  }

  if (framework === 'selenium-js' || framework === 'selenium-ts') {
    const basePage = configs['pages/BasePage.' + ext];
    if (basePage && pagesFolder) {
      pagesFolder.file(`BasePage.${ext}`, basePage);
    }
  }

  root.file('package.json', generatePackageJson(framework));
  root.file('README.md', generateReadme(framework));
  root.file('execution-guide.md', generateExecutionGuide(framework));

  const blob = await zip.generateAsync({ type: 'blob' });
  saveAs(blob, `${projectName}.zip`);
}

export function getPackageStructure(framework: Framework, pages: DiscoveredPage[]): string[] {
  const ext = testExtension[framework];
  const lines: string[] = [`${frameworkNames[framework]}/`];

  lines.push('├── tests/');
  for (const page of pages) {
    const name = getPageClassName(page).toLowerCase();
    lines.push(`│   ├── ${name}.test.${ext}`);
  }

  lines.push('├── pages/');
  for (const page of pages) {
    const name = getPageClassName(page);
    lines.push(`│   ├── ${name}Page.${ext}`);
  }
  lines.push(`│   └── BasePage.${ext}`);

  lines.push('├── config/');
  const configs = generateConfigFiles(framework);
  for (const path of Object.keys(configs)) {
    if (path.startsWith('config/')) {
      lines.push(`│   ├── ${path.replace('config/', '')}`);
    }
  }

  lines.push('├── utilities/');
  for (const path of Object.keys(configs)) {
    if (path.startsWith('utilities/')) {
      lines.push(`│   ├── ${path.replace('utilities/', '')}`);
    }
  }

  if (framework.startsWith('playwright')) {
    lines.push('├── fixtures/');
    for (const path of Object.keys(configs)) {
      if (path.startsWith('fixtures/')) {
        lines.push(`│   └── ${path.replace('fixtures/', '')}`);
      }
    }
  }

  lines.push('├── reports/');
  lines.push('├── package.json');
  lines.push('├── README.md');
  lines.push('└── execution-guide.md');

  return lines;
}
