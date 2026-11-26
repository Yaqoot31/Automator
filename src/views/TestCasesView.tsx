import { useState, useMemo } from 'react';
import {
  Search,
  Play,
  Plus,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Globe,
} from 'lucide-react';
import type { AutomationProject, TestCase, TestCaseCategory, WorkspaceView } from '@/types';

interface TestCasesViewProps {
  project: AutomationProject | null;
  onUpdateTestCases: (testCases: TestCase[]) => Promise<void>;
  onRunTests: (testCaseIds: string[]) => Promise<void>;
  onEnhanceWithAi: (focus?: string) => Promise<void>;
  onNavigate: (view: WorkspaceView) => void;
}

const SCENARIO_TYPES: { id: 'all' | TestCase['scenarioType']; label: string }[] = [
  { id: 'all', label: 'All Types' },
  { id: 'positive', label: 'Positive' },
  { id: 'negative', label: 'Negative' },
  { id: 'boundary', label: 'Boundary' },
  { id: 'exploratory', label: 'Exploratory' },
];

export function TestCasesView({
  project,
  onUpdateTestCases,
  onRunTests,
  onEnhanceWithAi,
  onNavigate,
}: TestCasesViewProps) {
  const [search, setSearch] = useState('');
  const [scenarioFilter, setScenarioFilter] = useState<'all' | TestCase['scenarioType']>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | TestCaseCategory>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [enhancing, setEnhancing] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  const [newTitle, setNewTitle] = useState('');
  const [newScenario, setNewScenario] = useState('');
  const [newTargetSelector, setNewTargetSelector] = useState('body');
  const [newType, setNewType] = useState<TestCase['scenarioType']>('positive');

  const testCases = useMemo(() => project?.testCases || [], [project?.testCases]);

  const categoriesPresent = useMemo(() => {
    const set = new Set<TestCaseCategory>();
    testCases.forEach((tc) => set.add(tc.category));
    return Array.from(set);
  }, [testCases]);

  const filtered = useMemo(() => {
    return testCases.filter((tc) => {
      if (scenarioFilter !== 'all' && tc.scenarioType !== scenarioFilter) return false;
      if (categoryFilter !== 'all' && tc.category !== categoryFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          tc.code.toLowerCase().includes(q) ||
          tc.title.toLowerCase().includes(q) ||
          tc.scenario.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [testCases, scenarioFilter, categoryFilter, search]);

  if (!project) {
    return (
      <div className="max-w-[960px] mx-auto px-4 py-16 text-center space-y-4">
        <div className="surface-panel rounded-2xl p-10 space-y-4">
          <Globe className="w-10 h-10 mx-auto text-[var(--accent-primary)]" />
          <h2 className="font-display font-bold text-xl">No Active Project Selected</h2>
          <p className="text-sm text-[var(--text-secondary)] max-w-md mx-auto">
            Analyze a website URL first to automatically generate positive, negative, boundary, and accessibility test cases.
          </p>
          <button
            type="button"
            onClick={() => onNavigate('analyzer')}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold"
            style={{ backgroundColor: 'var(--accent-primary)', color: 'var(--accent-contrast)' }}
          >
            Go to Website Analyzer
          </button>
        </div>
      </div>
    );
  }

  const toggleEnabled = async (id: string) => {
    const next = testCases.map((tc) =>
      tc.id === id ? { ...tc, enabled: !tc.enabled } : tc
    );
    await onUpdateTestCases(next);
  };

  const handleAddCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const code = `TC-${String(testCases.length + 1).padStart(3, '0')}`;
    const custom: TestCase = {
      id: crypto.randomUUID(),
      code,
      title: newTitle.trim(),
      category: 'homepage',
      scenarioType: newType,
      pagePath: '/',
      scenario: newScenario.trim() || 'Custom user-authored automation scenario.',
      preconditions: `Target URL ${project.url} is accessible.`,
      steps: [
        { stepNumber: 1, action: 'navigate', target: project.url, expected: 'Page loads' },
        {
          stepNumber: 2,
          action: 'assert_visible',
          target: newTargetSelector.trim() || 'body',
          expected: 'Target locator is visible',
        },
      ],
      expectedResult: 'Target element renders cleanly and passes assertions.',
      status: 'pending',
      enabled: true,
    };
    await onUpdateTestCases([...testCases, custom]);
    setNewTitle('');
    setNewScenario('');
    setNewTargetSelector('body');
    setShowAddForm(false);
  };

  const handleAiEnhance = async () => {
    setEnhancing(true);
    setAiError(null);
    try {
      await onEnhanceWithAi();
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'AI generation failed.');
    } finally {
      setEnhancing(false);
    }
  };

  const enabledCount = testCases.filter((tc) => tc.enabled).length;

  return (
    <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-5 sm:space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display font-bold text-xl sm:text-2xl text-[var(--text-main)]">
            Test Cases &amp; Coverage Matrix
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1 break-words">
            {testCases.length} generated scenarios for <span className="font-mono break-all">{project.url}</span> · {enabledCount} enabled
          </p>
        </div>

        <div className="grid grid-cols-1 sm:flex sm:flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAddForm((v) => !v)}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium surface-panel hover:bg-[var(--surface-hover)] min-h-[44px]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Test Case</span>
          </button>

          <button
            type="button"
            onClick={handleAiEnhance}
            disabled={enhancing}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium surface-panel hover:bg-[var(--surface-hover)] min-h-[44px] disabled:opacity-50"
          >
            {enhancing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
            )}
            <span>{enhancing ? 'Synthesizing...' : 'Generate AI Edge Cases'}</span>
          </button>

          <button
            type="button"
            onClick={() => onRunTests(testCases.filter((t) => t.enabled).map((t) => t.id))}
            disabled={enabledCount === 0}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold min-h-[44px] disabled:opacity-50"
            style={{ backgroundColor: 'var(--accent-primary)', color: 'var(--accent-contrast)' }}
          >
            <Play className="w-3.5 h-3.5" />
            <span>Run All Enabled ({enabledCount})</span>
          </button>
        </div>
      </div>

      {aiError && (
        <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 text-xs text-red-500">
          {aiError}
        </div>
      )}

      {showAddForm && (
        <form onSubmit={handleAddCustom} className="surface-panel rounded-xl p-4 sm:p-5 space-y-4">
          <div className="text-sm font-semibold">New Custom Test Case</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <input
              type="text"
              required
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Test case title"
              className="sm:col-span-2 min-h-[44px] px-3 rounded-lg surface-elevated text-xs"
            />
            <input
              type="text"
              value={newTargetSelector}
              onChange={(e) => setNewTargetSelector(e.target.value)}
              placeholder="CSS selector (e.g. #submit-btn)"
              className="min-h-[44px] px-3 rounded-lg surface-elevated font-mono text-xs"
            />
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value as TestCase['scenarioType'])}
              className="min-h-[44px] px-3 rounded-lg surface-elevated text-xs"
            >
              <option value="positive">Positive</option>
              <option value="negative">Negative</option>
              <option value="boundary">Boundary</option>
              <option value="exploratory">Exploratory</option>
            </select>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={newScenario}
              onChange={(e) => setNewScenario(e.target.value)}
              placeholder="Scenario description & expected assertion"
              className="flex-1 min-h-[44px] px-3 rounded-lg surface-elevated text-xs"
            />
            <button
              type="submit"
              className="px-5 min-h-[44px] rounded-lg text-xs font-semibold"
              style={{ backgroundColor: 'var(--accent-primary)', color: 'var(--accent-contrast)' }}
            >
              Save Test Case
            </button>
          </div>
        </form>
      )}

      {/* Search & Filter Controls */}
      <div className="surface-panel rounded-xl p-3.5 sm:p-4 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        <div className="relative flex-1 lg:max-w-md">
          <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by code, title, or scenario..."
            className="w-full min-h-[44px] pl-9 pr-3 rounded-lg surface-elevated text-xs text-[var(--text-main)]"
          />
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 min-w-0">
          <div className="flex items-center gap-1 p-1 rounded-lg surface-elevated overflow-x-auto no-scrollbar max-w-full">
            {SCENARIO_TYPES.map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setScenarioFilter(st.id)}
                className={`px-3 py-2 rounded-md text-xs font-medium whitespace-nowrap shrink-0 min-h-[38px] transition-colors ${
                  scenarioFilter === st.id
                    ? 'bg-[var(--surface-panel)] text-[var(--text-main)] shadow-xs'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-main)]'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as 'all' | TestCaseCategory)}
            aria-label="Filter by category"
            className="min-h-[44px] px-3 rounded-lg surface-elevated text-xs text-[var(--text-main)]"
          >
            <option value="all">All Categories</option>
            {categoriesPresent.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Test Cases List */}
      <div className="surface-panel rounded-xl overflow-hidden divide-y">
        {filtered.map((tc) => {
          const expanded = expandedId === tc.id;
          return (
            <div key={tc.id} className="transition-colors">
              <div className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[var(--surface-hover)]">
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  <label className="min-h-[44px] min-w-[36px] flex items-start justify-center pt-1.5 cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={tc.enabled}
                      onChange={() => toggleEnabled(tc.id)}
                      aria-label={`Enable ${tc.code}`}
                      className="w-4 h-4 rounded accent-[var(--accent-primary)]"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => setExpandedId(expanded ? null : tc.id)}
                    className="text-left min-w-0 flex-1 space-y-1 py-1"
                  >
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[var(--text-muted)]">
                      <span className="font-mono font-semibold text-[var(--accent-primary)]">
                        {tc.code}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{tc.category}</span>
                      <span aria-hidden="true">·</span>
                      <span>{tc.scenarioType}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono break-all">{tc.pagePath}</span>
                    </div>
                    <div className="text-sm font-semibold text-[var(--text-main)] flex items-start gap-1.5">
                      {expanded ? (
                        <ChevronDown className="w-4 h-4 shrink-0 text-[var(--text-muted)] mt-0.5" />
                      ) : (
                        <ChevronRight className="w-4 h-4 shrink-0 text-[var(--text-muted)] mt-0.5" />
                      )}
                      <span className="break-words sm:truncate">{tc.title}</span>
                    </div>
                  </button>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pl-9 sm:pl-0">
                  <span
                    className="inline-flex items-center gap-1.5 font-mono text-xs font-medium"
                    style={{
                      color:
                        tc.status === 'passed'
                          ? 'var(--status-success)'
                          : tc.status === 'failed'
                            ? 'var(--status-error)'
                            : 'var(--text-muted)',
                    }}
                  >
                    {tc.status === 'passed' && <CheckCircle2 className="w-3.5 h-3.5" />}
                    {tc.status === 'failed' && <XCircle className="w-3.5 h-3.5" />}
                    {(tc.status === 'pending' || tc.status === 'skipped') && (
                      <Clock className="w-3.5 h-3.5" />
                    )}
                    <span>{tc.status.toUpperCase()}</span>
                    {tc.durationMs !== undefined && (
                      <span className="tabular-nums">({tc.durationMs}ms)</span>
                    )}
                  </span>

                  <button
                    type="button"
                    onClick={() => onRunTests([tc.id])}
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium surface-elevated hover:bg-[var(--accent-soft)] min-h-[40px]"
                  >
                    <Play className="w-3 h-3" />
                    <span>Run</span>
                  </button>
                </div>
              </div>

              {expanded && (
                <div className="px-4 pb-4 pt-2 sm:pl-11 space-y-3 bg-[var(--surface-elevated)]/40 text-xs">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="break-words">
                      <span className="font-semibold text-[var(--text-secondary)]">Scenario: </span>
                      <span className="text-[var(--text-main)]">{tc.scenario}</span>
                    </div>
                    <div className="break-words">
                      <span className="font-semibold text-[var(--text-secondary)]">Preconditions: </span>
                      <span className="text-[var(--text-main)]">{tc.preconditions}</span>
                    </div>
                    <div className="break-words">
                      <span className="font-semibold text-[var(--text-secondary)]">Expected Result: </span>
                      <span className="text-[var(--text-main)]">{tc.expectedResult}</span>
                    </div>
                    <div className="break-words">
                      <span className="font-semibold text-[var(--text-secondary)]">Actual Result: </span>
                      <span className="text-[var(--text-main)]">
                        {tc.actualResult || 'Not executed yet'}
                      </span>
                    </div>
                  </div>

                  {/* Mobile Step Cards (< md) */}
                  <div className="md:hidden border rounded-lg divide-y bg-[var(--surface-panel)]">
                    {tc.steps.map((s) => (
                      <div key={s.stepNumber} className="p-3 space-y-1">
                        <div className="flex items-center justify-between gap-2 font-mono">
                          <span className="text-[var(--text-muted)]">Step {s.stepNumber}</span>
                          <span className="text-[var(--accent-primary)]">{s.action}</span>
                        </div>
                        <div className="font-mono text-[11px] break-all text-[var(--text-main)]">
                          {s.target}
                        </div>
                        <div className="text-[var(--text-secondary)]">{s.expected}</div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop Steps Table (md+) */}
                  <div className="hidden md:block border rounded-lg overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="surface-elevated text-[var(--text-muted)] border-b">
                        <tr>
                          <th className="py-1.5 px-3">#</th>
                          <th className="py-1.5 px-3">Action</th>
                          <th className="py-1.5 px-3">Target</th>
                          <th className="py-1.5 px-3">Expected</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {tc.steps.map((s) => (
                          <tr key={s.stepNumber}>
                            <td className="py-1.5 px-3 font-mono">{s.stepNumber}</td>
                            <td className="py-1.5 px-3 font-mono text-[var(--accent-primary)]">
                              {s.action}
                            </td>
                            <td className="py-1.5 px-3 font-mono truncate max-w-[240px]">
                              {s.target}
                            </td>
                            <td className="py-1.5 px-3 text-[var(--text-secondary)]">{s.expected}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="py-12 text-center text-sm text-[var(--text-muted)]">
            No test cases match your current filters.
          </div>
        )}
      </div>
    </div>
  );
}
