import { useState } from 'react';
import {
  FolderKanban,
  Plus,
  Trash2,
  Copy,
  Download,
  ExternalLink,
  KeyRound,
  Check,
  Pencil,
} from 'lucide-react';
import type { AutomationFramework, AutomationProject, WorkspaceView } from '@/types';
import { FRAMEWORK_OPTIONS } from '@/lib/frameworks';
import { downloadCompleteProjectZip } from '@/lib/projectZip';

interface ProjectsViewProps {
  projects: AutomationProject[];
  activeProjectId: string | null;
  onSelectProject: (project: AutomationProject) => void;
  onCreateProject: (params: {
    name: string;
    url: string;
    framework: AutomationFramework;
  }) => Promise<void>;
  onRenameProject: (projectId: string, name: string, description: string) => Promise<void>;
  onDuplicateProject: (projectId: string) => Promise<void>;
  onDeleteProject: (projectId: string) => Promise<void>;
  onSaveSecrets: (projectId: string, secrets: Record<string, string>) => Promise<void>;
  onNavigate: (view: WorkspaceView) => void;
}

export function ProjectsView({
  projects,
  activeProjectId,
  onSelectProject,
  onCreateProject,
  onRenameProject,
  onDuplicateProject,
  onDeleteProject,
  onSaveSecrets,
  onNavigate,
}: ProjectsViewProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('https://example.com');
  const [newFramework, setNewFramework] = useState<AutomationFramework>('cypress-ts');
  const [createError, setCreateError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');

  const [secretsProjectId, setSecretsProjectId] = useState<string | null>(null);
  const [secretUser, setSecretUser] = useState('');
  const [secretPass, setSecretPass] = useState('');
  const [secretSaved, setSecretSaved] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    try {
      await onCreateProject({
        name: newName.trim() || 'New Automation Project',
        url: newUrl.trim(),
        framework: newFramework,
      });
      setNewName('');
      setShowCreate(false);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create project.');
    }
  };

  const handleSaveSecretVault = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!secretsProjectId) return;
    const payload: Record<string, string> = {};
    if (secretUser.trim()) payload.TEST_USERNAME = secretUser.trim();
    if (secretPass.trim()) payload.TEST_PASSWORD = secretPass.trim();
    await onSaveSecrets(secretsProjectId, payload);
    setSecretUser('');
    setSecretPass('');
    setSecretSaved(true);
    setTimeout(() => setSecretSaved(false), 2000);
  };

  return (
    <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-5 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display font-bold text-xl sm:text-2xl text-[var(--text-main)]">
            Projects &amp; Credentials Vault
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
            Manage saved website automation projects, duplicate templates, export archives, and store AES-256 encrypted test credentials.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold min-h-[44px] w-full sm:w-auto shrink-0"
          style={{ backgroundColor: 'var(--accent-primary)', color: 'var(--accent-contrast)' }}
        >
          <Plus className="w-4 h-4" />
          <span>New Project</span>
        </button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="surface-panel rounded-xl p-4 sm:p-5 space-y-4">
          <div className="text-sm font-semibold">Create Automation Project</div>
          {createError && (
            <div className="text-xs text-[var(--status-error)]">{createError}</div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              required
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Project Name (e.g. Storefront E2E)"
              className="min-h-[44px] px-3 rounded-lg surface-elevated text-xs"
            />
            <input
              type="text"
              required
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder="https://example.com"
              className="min-h-[44px] px-3 rounded-lg surface-elevated font-mono text-xs"
            />
            <select
              value={newFramework}
              onChange={(e) => setNewFramework(e.target.value as AutomationFramework)}
              className="min-h-[44px] px-3 rounded-lg surface-elevated text-xs"
            >
              {FRAMEWORK_OPTIONS.map((fw) => (
                <option key={fw.id} value={fw.id}>
                  {fw.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="px-4 min-h-[44px] rounded-lg text-xs surface-elevated"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 min-h-[44px] rounded-lg text-xs font-semibold"
              style={{ backgroundColor: 'var(--accent-primary)', color: 'var(--accent-contrast)' }}
            >
              Create Project
            </button>
          </div>
        </form>
      )}

      {projects.length === 0 ? (
        <div className="surface-panel rounded-2xl p-8 sm:p-12 text-center space-y-4">
          <FolderKanban className="w-10 h-10 mx-auto text-[var(--accent-primary)]" />
          <h2 className="font-display font-bold text-lg">No Projects Saved Yet</h2>
          <p className="text-sm text-[var(--text-secondary)] max-w-md mx-auto">
            Run your first website analysis in the AI Website Analyzer or create a project above.
          </p>
          <button
            type="button"
            onClick={() => onNavigate('analyzer')}
            className="px-5 min-h-[44px] rounded-xl text-sm font-semibold"
            style={{ backgroundColor: 'var(--accent-primary)', color: 'var(--accent-contrast)' }}
          >
            Analyze a Website
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
          {projects.map((p) => {
            const isActive = p.id === activeProjectId;
            const isEditing = editingId === p.id;
            const isSecretsOpen = secretsProjectId === p.id;
            return (
              <div
                key={p.id}
                className={`surface-panel rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-4 min-w-0 ${
                  isActive ? 'border-[var(--accent-primary)]' : ''
                }`}
              >
                <div className="space-y-3 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-xs text-[var(--text-muted)] break-words">
                        {p.framework} · {p.language} · {p.testCases.length} tests
                      </div>
                      {isEditing ? (
                        <div className="space-y-2 mt-2">
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full min-h-[42px] px-3 rounded-lg surface-elevated text-sm font-semibold"
                          />
                          <input
                            type="text"
                            value={editDesc}
                            onChange={(e) => setEditDesc(e.target.value)}
                            placeholder="Optional project notes"
                            className="w-full min-h-[42px] px-3 rounded-lg surface-elevated text-xs"
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={async () => {
                                await onRenameProject(p.id, editName, editDesc);
                                setEditingId(null);
                              }}
                              className="px-3.5 min-h-[40px] rounded-lg text-xs font-semibold"
                              style={{
                                backgroundColor: 'var(--accent-primary)',
                                color: 'var(--accent-contrast)',
                              }}
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="px-3.5 min-h-[40px] rounded-lg text-xs surface-elevated"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <h2 className="font-display font-bold text-lg text-[var(--text-main)] truncate mt-0.5">
                            {p.name}
                          </h2>
                          <div className="font-mono text-xs text-[var(--accent-secondary)] break-all sm:truncate">
                            {p.url}
                          </div>
                          {p.description && (
                            <p className="text-xs text-[var(--text-secondary)] mt-1 break-words">
                              {p.description}
                            </p>
                          )}
                        </>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(p.id);
                        setEditName(p.name);
                        setEditDesc(p.description || '');
                      }}
                      aria-label="Edit project metadata"
                      className="min-h-[42px] min-w-[42px] inline-flex items-center justify-center rounded-lg surface-elevated hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] shrink-0"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="text-[11px] text-[var(--text-muted)] font-mono break-words">
                    Created {new Date(p.createdAt).toLocaleDateString()} · Updated{' '}
                    {new Date(p.updatedAt).toLocaleString()}
                  </div>

                  {p.secretsMeta.length > 0 && (
                    <div className="text-xs text-[var(--text-secondary)] break-words">
                      Encrypted secrets configured:{' '}
                      <span className="font-mono">
                        {p.secretsMeta.map((s) => `${s.key}=${s.maskedValue}`).join(', ')}
                      </span>
                    </div>
                  )}
                </div>

                {isSecretsOpen && (
                  <form
                    onSubmit={handleSaveSecretVault}
                    className="rounded-xl surface-elevated p-3.5 space-y-3 text-xs"
                  >
                    <div className="font-semibold">
                      Encrypted Test Credentials (AES-256-GCM)
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={secretUser}
                        onChange={(e) => setSecretUser(e.target.value)}
                        placeholder="TEST_USERNAME"
                        className="min-h-[42px] px-2.5 rounded-lg surface-panel font-mono text-xs"
                      />
                      <input
                        type="password"
                        value={secretPass}
                        onChange={(e) => setSecretPass(e.target.value)}
                        placeholder="TEST_PASSWORD"
                        className="min-h-[42px] px-2.5 rounded-lg surface-panel font-mono text-xs"
                      />
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <span className="text-[11px] text-[var(--text-muted)]">
                        Never exposed in reports or logs.
                      </span>
                      <button
                        type="submit"
                        className="inline-flex items-center justify-center gap-1 px-3.5 min-h-[40px] rounded-lg font-semibold"
                        style={{
                          backgroundColor: 'var(--accent-primary)',
                          color: 'var(--accent-contrast)',
                        }}
                      >
                        {secretSaved ? <Check className="w-3.5 h-3.5" /> : null}
                        <span>{secretSaved ? 'Encrypted & Saved' : 'Save Secrets'}</span>
                      </button>
                    </div>
                  </form>
                )}

                <div className="flex flex-wrap items-center gap-2 pt-3 border-t">
                  <button
                    type="button"
                    onClick={() => {
                      onSelectProject(p);
                      onNavigate('studio');
                    }}
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 min-h-[42px] rounded-lg text-xs font-semibold"
                    style={{
                      backgroundColor: 'var(--accent-primary)',
                      color: 'var(--accent-contrast)',
                    }}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open Studio</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => downloadCompleteProjectZip(p)}
                    disabled={p.files.length === 0}
                    className="inline-flex items-center justify-center gap-1.5 px-3 min-h-[42px] rounded-lg text-xs font-medium surface-elevated hover:bg-[var(--surface-hover)] disabled:opacity-40"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export ZIP</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setSecretsProjectId(isSecretsOpen ? null : p.id)
                    }
                    className="inline-flex items-center justify-center gap-1.5 px-3 min-h-[42px] rounded-lg text-xs font-medium surface-elevated hover:bg-[var(--surface-hover)]"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Vault</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onDuplicateProject(p.id)}
                    aria-label="Duplicate project"
                    className="min-h-[42px] min-w-[42px] inline-flex items-center justify-center rounded-lg surface-elevated hover:bg-[var(--surface-hover)] text-[var(--text-secondary)]"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => onDeleteProject(p.id)}
                    aria-label="Delete project"
                    className="min-h-[42px] min-w-[42px] inline-flex items-center justify-center rounded-lg surface-elevated hover:bg-red-500/10 text-[var(--status-error)] ml-auto"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
