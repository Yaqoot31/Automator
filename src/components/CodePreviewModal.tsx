import { useEffect, useRef, useState } from 'react';
import { X, Copy, Check } from 'lucide-react';
import type { DiscoveredPage, Framework } from '@/types';
import { generateTest, generatePageObject } from '@/lib/codeGenerator';

interface CodePreviewModalProps {
  page: DiscoveredPage;
  initialFramework?: Framework;
  onClose: () => void;
}

const FRAMEWORK_OPTIONS: { id: Framework; label: string }[] = [
  { id: 'playwright-ts', label: 'Playwright TS' },
  { id: 'playwright-js', label: 'Playwright JS' },
  { id: 'cypress-ts', label: 'Cypress TS' },
  { id: 'cypress-js', label: 'Cypress JS' },
  { id: 'selenium-ts', label: 'Selenium TS' },
  { id: 'selenium-js', label: 'Selenium JS' },
];

const KEYWORDS = new Set([
  'import',
  'from',
  'const',
  'let',
  'var',
  'export',
  'class',
  'interface',
  'type',
  'async',
  'await',
  'return',
  'if',
  'else',
  'try',
  'catch',
  'new',
  'this',
  'constructor',
  'extends',
  'private',
  'protected',
  'public',
  'static',
  'get',
  'set',
  'throw',
  'require',
]);

function renderHighlightedLine(line: string) {
  const trimmed = line.trim();
  if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
    return <span className="syntax-comment">{line}</span>;
  }

  const tokens = line.split(/(\s+|[(){}[\].,;:=<>]+|'[^']*'|"[^"]*"|`[^`]*`)/g);
  return tokens.map((token, idx) => {
    if (!token) return null;
    if (
      (token.startsWith("'") && token.endsWith("'")) ||
      (token.startsWith('"') && token.endsWith('"')) ||
      (token.startsWith('`') && token.endsWith('`'))
    ) {
      return (
        <span key={idx} className="syntax-string">
          {token}
        </span>
      );
    }
    if (KEYWORDS.has(token)) {
      return (
        <span key={idx} className="syntax-keyword font-medium">
          {token}
        </span>
      );
    }
    if (/^[A-Z][a-zA-Z0-9_]*$/.test(token)) {
      return (
        <span key={idx} className="syntax-function">
          {token}
        </span>
      );
    }
    return <span key={idx}>{token}</span>;
  });
}

export function CodePreviewModal({
  page,
  initialFramework = 'playwright-ts',
  onClose,
}: CodePreviewModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [framework, setFramework] = useState<Framework>(initialFramework);
  const [tab, setTab] = useState<'test' | 'page-object'>('test');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const code =
    tab === 'test'
      ? generateTest(page, framework)
      : generatePageObject(page, framework);

  const lines = code.split('\n');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div
        className="w-full max-w-4xl max-h-[86vh] flex flex-col rounded-2xl surface-panel shadow-2xl overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="code-preview-title"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 p-5 sm:p-6 border-b">
          <div className="min-w-0">
            <h3
              id="code-preview-title"
              className="font-display font-semibold text-lg text-[var(--text-main)]"
            >
              Generated Suite Inspector
            </h3>
            <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-secondary)] mt-1">
              <span className="font-mono text-[var(--accent-secondary)] truncate max-w-[440px]">
                {page.url}
              </span>
              <span aria-hidden="true">·</span>
              <span>{page.type}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">{page.elements} elements</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close code inspector"
            className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-[var(--surface-hover)] transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 sm:px-6 py-3 border-b bg-[var(--surface-elevated)]">
          <div className="flex items-center gap-1 p-1 rounded-lg surface-panel">
            <button
              type="button"
              onClick={() => setTab('test')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                tab === 'test'
                  ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-main)]'
              }`}
            >
              Test Spec
            </button>
            <button
              type="button"
              onClick={() => setTab('page-object')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                tab === 'page-object'
                  ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-main)]'
              }`}
            >
              Page Object
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <label htmlFor="modal-framework-select" className="sr-only">
              Select target framework
            </label>
            <select
              id="modal-framework-select"
              value={framework}
              onChange={(e) => setFramework(e.target.value as Framework)}
              className="h-9 px-3 rounded-lg text-xs font-medium surface-panel text-[var(--text-main)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
            >
              {FRAMEWORK_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-medium surface-panel text-[var(--text-main)] hover:bg-[var(--surface-hover)] transition-colors whitespace-nowrap"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[var(--status-success)]" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Code</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Code Viewport */}
        <div className="flex-1 overflow-auto p-5 sm:p-6 bg-[var(--surface-canvas)]">
          <pre className="font-mono text-xs sm:text-[13px] leading-6 text-[var(--text-main)]">
            <code>
              {lines.map((line, i) => (
                <div key={i} className="flex">
                  <span className="select-none w-10 pr-4 text-right text-[var(--text-muted)] shrink-0 tabular-nums">
                    {i + 1}
                  </span>
                  <span className="whitespace-pre">{renderHighlightedLine(line)}</span>
                </div>
              ))}
            </code>
          </pre>
        </div>

        {/* Locators summary */}
        <div className="px-5 sm:px-6 py-3 border-t surface-panel flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--text-secondary)]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[var(--text-muted)]">Detected locators:</span>
            <span className="font-mono text-[var(--text-main)]">
              {page.locators.slice(0, 4).join(' · ')}
            </span>
          </div>
          <span className="font-mono text-[var(--text-muted)]">
            {lines.length} lines
          </span>
        </div>
      </div>
    </div>
  );
}
