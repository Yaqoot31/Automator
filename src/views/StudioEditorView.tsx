import { useState, useEffect, useMemo } from 'react';
import {
  Folder,
  FileCode2,
  Download,
  Copy,
  Check,
  Save,
  RefreshCw,
  Search,
  Sparkles,
  Send,
  AlertCircle,
  AlertTriangle,
  Wand2,
  X,
  Loader2,
  Globe,
  Play,
} from 'lucide-react';
import type {
  AiMessage,
  AutomationFramework,
  AutomationProject,
  CodeDiagnostic,
  ProjectFile,
  TestingApproach,
  WorkspaceView,
} from '@/types';
import { APPROACH_OPTIONS, FRAMEWORK_OPTIONS } from '@/lib/frameworks';
import {
  getAiHistoryApi,
  sendAiChatApi,
  validateCodeApi,
} from '@/lib/api';
import {
  downloadCompleteProjectZip,
  downloadSingleProjectFile,
} from '@/lib/projectZip';

interface StudioEditorViewProps {
  token: string;
  project: AutomationProject | null;
  onSaveFiles: (files: ProjectFile[]) => Promise<void>;
  onRegenerate: (
    framework: AutomationFramework,
    approach: TestingApproach,
    selectedFrameworks?: AutomationFramework[]
  ) => Promise<void>;
  onRunSuite: () => Promise<void>;
  onNavigate: (view: WorkspaceView) => void;
}

const AI_QUICK_PROMPTS = [
  'Convert this script from Selenium to Playwright TypeScript',
  'Convert this automation script into Python Pytest',
  'Generate additional negative test cases for this website',
  'Improve element locators to use resilient selectors',
  'Explain this code and suggest optimizations',
  'Fix any failing assertions or wait issues',
];

export function StudioEditorView({
  token,
  project,
  onSaveFiles,
  onRegenerate,
  onRunSuite,
  onNavigate,
}: StudioEditorViewProps) {
  const [files, setFiles] = useState<ProjectFile[]>(() => project?.files || []);
  const [openTabs, setOpenTabs] = useState<string[]>(() => {
    const firstFile =
      project?.files.find((f) => f.path.includes('tests/')) ||
      project?.files.find((f) => f.path.includes('pages/')) ||
      project?.files[0];
    return firstFile ? [firstFile.path] : [];
  });
  const [activePath, setActivePath] = useState<string>(() => {
    const firstFile =
      project?.files.find((f) => f.path.includes('tests/')) ||
      project?.files.find((f) => f.path.includes('pages/')) ||
      project?.files[0];
    return firstFile?.path || '';
  });
  const [framework, setFramework] = useState<AutomationFramework>(
    () => project?.framework || 'playwright-ts'
  );
  const [approach, setApproach] = useState<TestingApproach>(
    () => project?.approach || 'pom'
  );
  const [regenerating, setRegenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [copied, setCopied] = useState(false);

  // Search & Replace
  const [showFind, setShowFind] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');

  // Diagnostics
  const [diagnostics, setDiagnostics] = useState<CodeDiagnostic[]>([]);
  const [validating, setValidating] = useState(false);

  // AI Assistant
  const [showAiPanel, setShowAiPanel] = useState(true);
  const [mobilePane, setMobilePane] = useState<'files' | 'editor' | 'ai'>('editor');
  const [aiMessages, setAiMessages] = useState<AiMessage[]>([]);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const projectId = project?.id;
  useEffect(() => {
    if (!projectId) return;
    getAiHistoryApi(token, projectId)
      .then((res) => setAiMessages(res.messages))
      .catch(() => {});
  }, [projectId, token]);

  const activeFile = useMemo(
    () => files.find((f) => f.path === activePath) || null,
    [files, activePath]
  );

  const groupedFolders = useMemo(() => {
    const groups = new Map<string, ProjectFile[]>();
    for (const f of files) {
      const folder = f.folder === '/' ? 'Root' : f.folder;
      const list = groups.get(folder) || [];
      list.push(f);
      groups.set(folder, list);
    }
    return Array.from(groups.entries());
  }, [files]);

  if (!project) {
    return (
      <div className="max-w-[960px] mx-auto px-4 py-16 text-center">
        <div className="surface-panel rounded-2xl p-10 space-y-4">
          <Globe className="w-10 h-10 mx-auto text-[var(--accent-primary)]" />
          <h2 className="font-display font-bold text-xl">No Project Open in Script Studio</h2>
          <p className="text-sm text-[var(--text-secondary)] max-w-md mx-auto">
            Analyze a website URL first to generate complete Java, JavaScript, TypeScript, or Python Playwright, Selenium &amp; Cypress projects.
          </p>
          <button
            type="button"
            onClick={() => onNavigate('analyzer')}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold"
            style={{ backgroundColor: 'var(--accent-primary)', color: 'var(--accent-contrast)' }}
          >
            Open Website Analyzer
          </button>
        </div>
      </div>
    );
  }

  const openFile = (path: string) => {
    setActivePath(path);
    if (!openTabs.includes(path)) {
      setOpenTabs((prev) => [...prev, path]);
    }
    setDiagnostics([]);
    setMobilePane('editor');
  };

  const closeTab = (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = openTabs.filter((t) => t !== path);
    setOpenTabs(next);
    if (activePath === path) {
      setActivePath(next[next.length - 1] || '');
    }
  };

  const updateActiveContent = (newContent: string) => {
    if (!activeFile) return;
    setFiles((prev) =>
      prev.map((f) =>
        f.path === activeFile.path ? { ...f, content: newContent, isModified: true } : f
      )
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const val = target.value;
      const updated = `${val.substring(0, start)}  ${val.substring(end)}`;
      updateActiveContent(updated);
      requestAnimationFrame(() => {
        target.selectionStart = target.selectionEnd = start + 2;
      });
    }
  };

  const handleFormatCode = () => {
    if (!activeFile) return;
    if (activeFile.language === 'json') {
      try {
        const formatted = JSON.stringify(JSON.parse(activeFile.content), null, 2);
        updateActiveContent(formatted);
      } catch {
        // Keep current text if invalid JSON
      }
      return;
    }
    const cleaned = activeFile.content
      .split('\n')
      .map((line) => line.replace(/\s+$/, ''))
      .join('\n');
    updateActiveContent(cleaned);
  };

  const handleReplaceAll = () => {
    if (!activeFile || !findQuery) return;
    const updated = activeFile.content.split(findQuery).join(replaceQuery);
    updateActiveContent(updated);
  };

  const handleValidate = async () => {
    if (!activeFile) return;
    setValidating(true);
    try {
      const res = await validateCodeApi(token, activeFile.language, activeFile.content);
      setDiagnostics(res.diagnostics);
    } catch {
      // Ignore transient errors
    } finally {
      setValidating(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const cleaned = files.map((f) => ({ ...f, isModified: false }));
      await onSaveFiles(cleaned);
      setFiles(cleaned);
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 2000);
      await handleValidate();
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerateProject = async () => {
    setRegenerating(true);
    try {
      await onRegenerate(framework, approach, [framework]);
    } finally {
      setRegenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!activeFile) return;
    await navigator.clipboard.writeText(activeFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleSendAi = async (customPrompt?: string) => {
    const promptToSend = (customPrompt ?? aiPrompt).trim();
    if (!promptToSend || aiLoading) return;
    setAiLoading(true);
    setAiError(null);
    if (!customPrompt) setAiPrompt('');

    try {
      const res = await sendAiChatApi(token, project.id, {
        prompt: promptToSend,
        activeFilePath: activeFile?.path,
        activeFileContent: activeFile?.content,
      });
      setAiMessages(res.messages);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'AI request failed.');
    } finally {
      setAiLoading(false);
    }
  };

  const lineCount = activeFile ? activeFile.content.split('\n').length : 0;
  const hasModified = files.some((f) => f.isModified);

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-5 space-y-4 animate-view-enter">
      {/* Studio Toolbar */}
      <div className="surface-panel rounded-xl p-3.5 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div className="grid grid-cols-1 sm:flex sm:flex-wrap items-center gap-2.5">
          <select
            aria-label="Select Framework and Language"
            value={framework}
            onChange={(e) => setFramework(e.target.value as AutomationFramework)}
            className="min-h-[42px] px-3 rounded-lg surface-elevated text-xs font-medium text-[var(--text-main)] w-full sm:w-auto"
          >
            {FRAMEWORK_OPTIONS.map((fw) => (
              <option key={fw.id} value={fw.id}>
                {fw.label}
              </option>
            ))}
          </select>

          <select
            aria-label="Select Testing Approach"
            value={approach}
            onChange={(e) => setApproach(e.target.value as TestingApproach)}
            className="min-h-[42px] px-3 rounded-lg surface-elevated text-xs font-medium text-[var(--text-main)] w-full sm:w-auto"
          >
            {APPROACH_OPTIONS.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleRegenerateProject}
            disabled={regenerating}
            className="inline-flex items-center justify-center gap-1.5 min-h-[42px] px-3.5 rounded-lg text-xs font-medium surface-elevated hover:bg-[var(--surface-hover)] w-full sm:w-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${regenerating ? 'animate-spin' : ''}`} />
            <span>{regenerating ? 'Generating...' : 'Regenerate Stack'}</span>
          </button>

          {project.selectedFrameworks && project.selectedFrameworks.length > 1 && (
            <span className="text-[11px] font-mono text-[var(--text-muted)]">
              Multi-stack bundle: {project.selectedFrameworks.join(' · ')}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center justify-center gap-1.5 min-h-[42px] px-3 rounded-lg text-xs font-medium surface-elevated hover:bg-[var(--surface-hover)]"
          >
            {savedNotice ? <Check className="w-3.5 h-3.5 text-[var(--status-success)]" /> : <Save className="w-3.5 h-3.5" />}
            <span>{savedNotice ? 'Saved' : hasModified ? 'Save Edits*' : 'Save'}</span>
          </button>

          <button
            type="button"
            onClick={() => downloadCompleteProjectZip({ ...project, files })}
            className="inline-flex items-center justify-center gap-1.5 min-h-[42px] px-3.5 rounded-lg text-xs font-semibold"
            style={{ backgroundColor: 'var(--accent-primary)', color: 'var(--accent-contrast)' }}
          >
            <Download className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Download ZIP</span>
          </button>

          <button
            type="button"
            onClick={onRunSuite}
            className="inline-flex items-center justify-center gap-1.5 min-h-[42px] px-3 rounded-lg text-xs font-medium surface-elevated hover:bg-[var(--surface-hover)]"
          >
            <Play className="w-3.5 h-3.5 text-[var(--status-success)]" />
            <span>Execute</span>
          </button>

          <button
            type="button"
            onClick={() => setShowAiPanel((v) => !v)}
            className={`hidden lg:inline-flex items-center justify-center gap-1.5 min-h-[42px] px-3 rounded-lg text-xs font-medium transition-colors ${
              showAiPanel
                ? 'bg-[var(--accent-soft)] text-[var(--text-main)]'
                : 'surface-elevated text-[var(--text-secondary)]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
            <span>AI Assistant</span>
          </button>
        </div>
      </div>

      {/* Mobile & Tablet Pane Switcher (< lg) */}
      <div className="lg:hidden grid grid-cols-3 gap-1.5 p-1.5 rounded-xl surface-panel">
        <button
          type="button"
          onClick={() => setMobilePane('files')}
          className={`min-h-[42px] px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 ${
            mobilePane === 'files'
              ? 'bg-[var(--accent-soft)] text-[var(--text-main)]'
              : 'text-[var(--text-secondary)]'
          }`}
        >
          <Folder className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">Files ({files.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setMobilePane('editor')}
          className={`min-h-[42px] px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 ${
            mobilePane === 'editor'
              ? 'bg-[var(--accent-soft)] text-[var(--text-main)]'
              : 'text-[var(--text-secondary)]'
          }`}
        >
          <FileCode2 className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">Editor</span>
        </button>
        <button
          type="button"
          onClick={() => setMobilePane('ai')}
          className={`min-h-[42px] px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 ${
            mobilePane === 'ai'
              ? 'bg-[var(--accent-soft)] text-[var(--text-main)]'
              : 'text-[var(--text-secondary)]'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 shrink-0 text-[var(--accent-primary)]" />
          <span className="truncate">AI Helper</span>
        </button>
      </div>

      {/* IDE 3-Pane Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch min-w-0">
        {/* Left File Explorer */}
        <div
          className={`${
            mobilePane === 'files' ? 'flex' : 'hidden lg:flex'
          } lg:col-span-3 surface-panel rounded-xl p-3 flex-col max-h-[68dvh] lg:max-h-[680px] min-w-0`}
        >
          <div className="flex items-center justify-between px-2 pb-2.5 mb-2 border-b">
            <span className="text-xs font-semibold text-[var(--text-secondary)]">
              Explorer ({files.length} files)
            </span>
          </div>

          <div className="overflow-y-auto space-y-3 flex-1 pr-1">
            {groupedFolders.map(([folder, folderFiles]) => (
              <div key={folder} className="space-y-1">
                <div className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-semibold text-[var(--text-muted)]">
                  <Folder className="w-3.5 h-3.5 text-[var(--accent-secondary)] shrink-0" />
                  <span className="truncate">{folder}</span>
                </div>
                {folderFiles.map((file) => {
                  const active = file.path === activePath;
                  return (
                    <button
                      key={file.path}
                      type="button"
                      onClick={() => openFile(file.path)}
                      className={`w-full flex items-center justify-between gap-2 pl-5 pr-2.5 py-2 rounded-lg font-mono text-xs text-left transition-colors min-h-[40px] ${
                        active
                          ? 'bg-[var(--accent-soft)] text-[var(--text-main)]'
                          : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-main)]'
                      }`}
                    >
                      <span className="flex items-center gap-1.5 min-w-0">
                        <FileCode2 className="w-3.5 h-3.5 shrink-0 opacity-75" />
                        <span className="truncate">{file.name}</span>
                      </span>
                      {file.isModified && (
                        <span className="text-[10px] text-[var(--accent-primary)] shrink-0">●</span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Center Code Editor */}
        <div
          className={`${
            mobilePane === 'editor' ? 'flex' : 'hidden lg:flex'
          } ${
            showAiPanel ? 'lg:col-span-5' : 'lg:col-span-9'
          } surface-panel rounded-xl overflow-hidden flex-col min-h-[380px] sm:min-h-[480px] lg:min-h-[540px] max-h-[72dvh] lg:max-h-[680px] min-w-0`}
        >
          <div className="flex flex-wrap sm:flex-nowrap items-center justify-between border-b bg-[var(--surface-elevated)] px-2 py-1.5 min-h-[44px] gap-2">
            <div className="flex items-center gap-1 min-w-0 overflow-x-auto no-scrollbar flex-1">
              {openTabs.map((tabPath) => {
                const f = files.find((item) => item.path === tabPath);
                if (!f) return null;
                const active = tabPath === activePath;
                return (
                  <div
                    key={tabPath}
                    onClick={() => setActivePath(tabPath)}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md font-mono text-xs cursor-pointer whitespace-nowrap shrink-0 min-h-[36px] ${
                      active
                        ? 'bg-[var(--surface-panel)] text-[var(--text-main)]'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-main)]'
                    }`}
                  >
                    <span>{f.name}</span>
                    <button
                      type="button"
                      onClick={(e) => closeTab(tabPath, e)}
                      aria-label={`Close ${f.name}`}
                      className="opacity-60 hover:opacity-100 p-1"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>

            {activeFile && (
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowFind((v) => !v)}
                  title="Search & Replace"
                  aria-label="Search and Replace"
                  className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-md hover:bg-[var(--surface-hover)] text-[var(--text-secondary)]"
                >
                  <Search className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleFormatCode}
                  title="Format code"
                  aria-label="Format code"
                  className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-md hover:bg-[var(--surface-hover)] text-[var(--text-secondary)]"
                >
                  <Wand2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleCopy}
                  title="Copy code"
                  aria-label="Copy code"
                  className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-md hover:bg-[var(--surface-hover)] text-[var(--text-secondary)]"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-[var(--status-success)]" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => downloadSingleProjectFile(activeFile)}
                  title="Download file"
                  aria-label="Download file"
                  className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-md hover:bg-[var(--surface-hover)] text-[var(--text-secondary)]"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleValidate}
                  disabled={validating}
                  className="px-2.5 min-h-[36px] rounded-md text-[11px] font-medium surface-panel hover:bg-[var(--surface-hover)] whitespace-nowrap"
                >
                  {validating ? 'Checking...' : 'Check Syntax'}
                </button>
              </div>
            )}
          </div>

          {showFind && activeFile && (
            <div className="border-b bg-[var(--surface-elevated)]/60 p-2.5 flex flex-wrap items-center gap-2 text-xs">
              <input
                type="text"
                value={findQuery}
                onChange={(e) => setFindQuery(e.target.value)}
                placeholder="Find..."
                className="min-h-[38px] px-2.5 rounded-md surface-panel font-mono text-xs flex-1 min-w-[110px]"
              />
              <input
                type="text"
                value={replaceQuery}
                onChange={(e) => setReplaceQuery(e.target.value)}
                placeholder="Replace with..."
                className="min-h-[38px] px-2.5 rounded-md surface-panel font-mono text-xs flex-1 min-w-[110px]"
              />
              <button
                type="button"
                onClick={handleReplaceAll}
                className="min-h-[38px] px-3 rounded-md font-medium surface-panel hover:bg-[var(--accent-soft)]"
              >
                Replace All
              </button>
            </div>
          )}

          {activeFile ? (
            <div className="flex-1 flex overflow-auto bg-[var(--surface-canvas)] relative font-mono text-xs min-w-0">
              <div
                aria-hidden="true"
                className="select-none py-4 px-2.5 sm:px-3 text-right text-[var(--text-muted)] border-r bg-[var(--surface-panel)]/40 leading-[1.6] tabular-nums shrink-0"
              >
                {Array.from({ length: lineCount }).map((_, idx) => (
                  <div key={idx}>{idx + 1}</div>
                ))}
              </div>
              <textarea
                aria-label={`Code editor for ${activeFile.path}`}
                value={activeFile.content}
                onChange={(e) => updateActiveContent(e.target.value)}
                onKeyDown={handleKeyDown}
                spellCheck={false}
                className="flex-1 min-w-0 w-full min-h-full p-3 sm:p-4 bg-transparent text-[var(--text-main)] leading-[1.6] resize-none focus:outline-none whitespace-pre overflow-x-auto"
              />
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center p-6 text-center text-sm text-[var(--text-muted)]">
              Select a file from the explorer to inspect and edit.
            </div>
          )}

          {diagnostics.length > 0 && (
            <div className="border-t bg-[var(--surface-elevated)] p-3 max-h-32 overflow-y-auto space-y-1.5">
              {diagnostics.map((d, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  {d.severity === 'error' ? (
                    <AlertCircle className="w-3.5 h-3.5 text-[var(--status-error)] shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-3.5 h-3.5 text-[var(--status-warning)] shrink-0 mt-0.5" />
                  )}
                  <span className="font-mono text-[var(--text-muted)] shrink-0">Ln {d.line}:</span>
                  <span className="text-[var(--text-main)] break-words">{d.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right AI Automation Assistant */}
        <div
          className={`${
            mobilePane === 'ai' ? 'flex' : showAiPanel ? 'hidden lg:flex' : 'hidden'
          } lg:col-span-4 surface-panel rounded-xl flex-col max-h-[68dvh] lg:max-h-[680px] min-w-0`}
        >
          <div className="p-3.5 border-b flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Sparkles className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
              <span className="font-display font-semibold text-sm truncate">
                AI Automation Assistant
              </span>
            </div>
            <span className="text-[11px] text-[var(--text-muted)] shrink-0">Context Aware</span>
          </div>

          <div className="p-3 border-b flex flex-wrap gap-1.5">
            {AI_QUICK_PROMPTS.slice(0, 4).map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => handleSendAi(q)}
                disabled={aiLoading}
                className="text-left px-2.5 py-1.5 rounded-md text-[11px] surface-elevated hover:bg-[var(--accent-soft)] text-[var(--text-secondary)] hover:text-[var(--text-main)] transition-colors min-h-[34px]"
              >
                {q}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-3.5 space-y-3 text-xs">
            {aiMessages.length === 0 && (
              <div className="text-[var(--text-secondary)] space-y-2 py-4">
                <p>
                  Ask me to convert scripts across Playwright, Selenium &amp; Cypress, translate between Java, Python, TypeScript, and JavaScript, improve locators, or diagnose failing assertions.
                </p>
              </div>
            )}

            {aiMessages.map((m) => (
              <div
                key={m.id}
                className={`rounded-xl p-3 space-y-2 ${
                  m.role === 'user'
                    ? 'bg-[var(--accent-soft)] ml-2 sm:ml-6'
                    : 'surface-elevated mr-1 sm:mr-2'
                }`}
              >
                <div className="text-[11px] font-semibold text-[var(--text-muted)]">
                  {m.role === 'user' ? 'You' : 'Automation Architect'}
                </div>
                <div className="whitespace-pre-wrap break-words leading-relaxed text-[var(--text-main)]">
                  {m.content}
                </div>
                {m.codeBlocks && m.codeBlocks.length > 0 && activeFile && (
                  <div className="pt-1 flex flex-wrap gap-2">
                    {m.codeBlocks.map((cb, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          updateActiveContent(cb.code);
                          setMobilePane('editor');
                        }}
                        className="px-3 py-1.5 rounded-md text-[11px] font-medium bg-[var(--surface-panel)] hover:bg-[var(--accent-soft)] text-[var(--accent-primary)] border min-h-[36px]"
                      >
                        Apply {cb.language} snippet to {activeFile.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {aiLoading && (
              <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Generating contextual automation guidance...</span>
              </div>
            )}

            {aiError && (
              <div
                role="alert"
                className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-500 break-words"
              >
                {aiError}
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendAi();
            }}
            className="p-3 border-t flex items-center gap-2"
          >
            <input
              type="text"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="Ask to convert, fix, or optimize scripts..."
              className="flex-1 min-w-0 min-h-[44px] px-3 rounded-lg surface-elevated text-xs text-[var(--text-main)]"
            />
            <button
              type="submit"
              disabled={aiLoading || !aiPrompt.trim()}
              aria-label="Send prompt"
              className="min-h-[44px] min-w-[44px] rounded-lg inline-flex items-center justify-center disabled:opacity-40 shrink-0"
              style={{
                backgroundColor: 'var(--accent-primary)',
                color: 'var(--accent-contrast)',
              }}
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
