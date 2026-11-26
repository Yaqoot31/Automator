import { useState } from 'react';
import {
  Chrome,
  Triangle,
  FileCode,
  Check,
  Download,
  Loader2,
  Folder,
  FileText,
} from 'lucide-react';
import type { DiscoveredPage, Framework } from '@/types';
import { generateZip, getPackageStructure } from '@/lib/zipGenerator';
import {
  generatePageObject,
  generateTest,
  generateConfigFiles,
  generateReadme,
  generateExecutionGuide,
} from '@/lib/codeGenerator';

interface CodeGenerationCenterProps {
  pages: DiscoveredPage[];
}

interface FrameworkCard {
  id: Framework;
  name: string;
  language: string;
  color: string;
  description: string;
  icon: 'chrome' | 'triangle' | 'filecode';
}

const FRAMEWORKS: FrameworkCard[] = [
  {
    id: 'playwright-ts',
    name: 'Playwright',
    language: 'TypeScript',
    color: '#14b8a6',
    description: 'Page Objects + Specs + Playwright Config',
    icon: 'triangle',
  },
  {
    id: 'playwright-js',
    name: 'Playwright',
    language: 'JavaScript',
    color: '#14b8a6',
    description: 'Page Objects + Specs + Playwright Config',
    icon: 'triangle',
  },
  {
    id: 'cypress-ts',
    name: 'Cypress',
    language: 'TypeScript',
    color: '#22c55e',
    description: 'Page Objects + E2E Specs + Cypress Config',
    icon: 'filecode',
  },
  {
    id: 'cypress-js',
    name: 'Cypress',
    language: 'JavaScript',
    color: '#22c55e',
    description: 'Page Objects + E2E Specs + Cypress Config',
    icon: 'filecode',
  },
  {
    id: 'selenium-ts',
    name: 'Selenium',
    language: 'TypeScript',
    color: '#d4a017',
    description: 'WebDriver Page Objects + Specs + TS Config',
    icon: 'chrome',
  },
  {
    id: 'selenium-js',
    name: 'Selenium',
    language: 'JavaScript',
    color: '#d4a017',
    description: 'WebDriver Page Objects + Specs + Runner Config',
    icon: 'chrome',
  },
];

function FrameworkIcon({ icon, color }: { icon: FrameworkCard['icon']; color: string }) {
  const props = { className: 'w-6 h-6', style: { color } };
  switch (icon) {
    case 'chrome':
      return <Chrome {...props} />;
    case 'triangle':
      return <Triangle {...props} />;
    case 'filecode':
    default:
      return <FileCode {...props} />;
  }
}

export default function CodeGenerationCenter({ pages }: CodeGenerationCenterProps) {
  const [generating, setGenerating] = useState<Set<Framework>>(new Set());
  const [generated, setGenerated] = useState<Set<Framework>>(new Set());
  const [selectedFramework, setSelectedFramework] = useState<Framework | null>(null);
  const [selectedFile, setSelectedFile] = useState<string>('README.md');

  const handleGenerate = async (framework: Framework) => {
    if (generating.has(framework)) return;
    if (generated.has(framework)) {
      setSelectedFramework(framework);
      return;
    }

    setGenerating((prev) => new Set(prev).add(framework));
    await new Promise((resolve) => setTimeout(resolve, 900));

    setGenerating((prev) => {
      const next = new Set(prev);
      next.delete(framework);
      return next;
    });
    setGenerated((prev) => new Set(prev).add(framework));
    setSelectedFramework(framework);
    setSelectedFile('README.md');
  };

  const handleDownload = async (framework: Framework) => {
    await generateZip(pages, framework);
  };

  const packageStructure = selectedFramework
    ? getPackageStructure(selectedFramework, pages)
    : null;

  const getFileContent = (framework: Framework, filename: string): string => {
    if (filename === 'README.md') return generateReadme(framework);
    if (filename === 'execution-guide.md') return generateExecutionGuide(framework);
    const configs = generateConfigFiles(framework);
    if (configs[filename]) return configs[filename];

    const samplePage = pages[0];
    if (!samplePage) return '// Run a crawl to populate test files.';
    if (filename.includes('Page.')) return generatePageObject(samplePage, framework);
    if (filename.includes('.spec.') || filename.includes('.cy.') || filename.includes('Test.')) {
      return generateTest(samplePage, framework);
    }
    return configs['package.json'] || '// Generated project artifact';
  };

  const getInteractiveFiles = (fw: Framework): string[] => {
    const configs = Object.keys(generateConfigFiles(fw));
    const ext = fw.endsWith('-ts') ? 'ts' : 'js';
    const firstPage = pages[0];
    const pageName = firstPage
      ? (firstPage.path.replace(/^\//, '').replace(/[^a-zA-Z0-9]/g, '_') || 'Home')
      : 'Home';
    const files = [
      'README.md',
      'execution-guide.md',
      ...configs.slice(0, 2),
      `pages/${pageName}Page.${ext}`,
      `tests/${pageName}.spec.${ext}`,
    ];
    return Array.from(new Set(files));
  };

  return (
    <section className="surface-panel rounded-2xl p-5 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="font-display font-semibold text-xl text-[var(--text-main)]">
            Code Generation Center
          </h2>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Generate and download complete, runnable Page Object test suites for your target framework.
          </p>
        </div>
        <span className="font-mono text-xs text-[var(--text-muted)] tabular-nums">
          {pages.length} page objects ready
        </span>
      </div>

      {/* Framework Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {FRAMEWORKS.map((fw) => {
          const isGenerating = generating.has(fw.id);
          const isGenerated = generated.has(fw.id);
          const isSelected = selectedFramework === fw.id;

          return (
            <div
              key={fw.id}
              className={`rounded-xl p-5 border transition-colors flex flex-col justify-between gap-4 ${
                isSelected
                  ? 'surface-elevated border-[var(--accent-primary)]'
                  : 'surface-elevated'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <FrameworkIcon icon={fw.icon} color={fw.color} />
                  <span className="font-mono text-xs text-[var(--text-muted)]">
                    {fw.language}
                  </span>
                </div>
                <div>
                  <h3 className="font-display font-semibold text-base text-[var(--text-main)]">
                    {fw.name}
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">
                    {fw.description}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {isGenerated ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleDownload(fw.id)}
                      className="flex-1 py-2.5 px-3 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 min-h-[40px]"
                      style={{
                        backgroundColor: 'var(--accent-primary)',
                        color: 'var(--accent-contrast)',
                      }}
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download ZIP</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFramework(fw.id);
                        setSelectedFile('README.md');
                      }}
                      className="py-2.5 px-3 rounded-lg text-xs font-medium surface-panel hover:bg-[var(--surface-hover)] text-[var(--text-main)] min-h-[40px]"
                    >
                      Inspect
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleGenerate(fw.id)}
                    disabled={isGenerating || pages.length === 0}
                    className="w-full py-2.5 px-4 rounded-lg text-xs font-semibold surface-panel hover:bg-[var(--accent-soft)] text-[var(--text-main)] transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-40 min-h-[40px]"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Synthesizing Suite...</span>
                      </>
                    ) : (
                      <span>Generate Suite</span>
                    )}
                  </button>
                )}
              </div>

              {isGenerated && (
                <div className="flex items-center gap-1.5 text-xs text-[var(--status-success)]">
                  <Check className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Package built and ready for download</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Interactive Package Structure & Code Preview */}
      {packageStructure && selectedFramework && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 pt-2 border-t">
          <div className="lg:col-span-5 rounded-xl surface-elevated p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-semibold text-sm text-[var(--text-main)]">
                Package Structure ({selectedFramework})
              </h3>
              <span className="text-xs text-[var(--text-muted)]">Click file to preview</span>
            </div>

            <div className="space-y-1">
              {getInteractiveFiles(selectedFramework).map((filePath) => {
                const active = selectedFile === filePath;
                return (
                  <button
                    key={filePath}
                    type="button"
                    onClick={() => setSelectedFile(filePath)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg font-mono text-xs text-left transition-colors ${
                      active
                        ? 'bg-[var(--accent-soft)] text-[var(--text-main)]'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-main)]'
                    }`}
                  >
                    {filePath.includes('/') ? (
                      <Folder className="w-3.5 h-3.5 text-[var(--accent-secondary)] shrink-0" />
                    ) : (
                      <FileText className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
                    )}
                    <span className="truncate">{filePath}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-7 rounded-xl bg-[var(--surface-canvas)] border p-4 flex flex-col">
            <div className="flex items-center justify-between pb-3 mb-3 border-b">
              <span className="font-mono text-xs text-[var(--accent-secondary)]">
                {selectedFile}
              </span>
              <button
                type="button"
                onClick={() => handleDownload(selectedFramework)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--accent-primary)] hover:underline"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download ZIP</span>
              </button>
            </div>
            <pre className="font-mono text-xs leading-relaxed text-[var(--text-main)] overflow-auto max-h-[260px] whitespace-pre-wrap">
              {getFileContent(selectedFramework, selectedFile)}
            </pre>
          </div>
        </div>
      )}
    </section>
  );
}
