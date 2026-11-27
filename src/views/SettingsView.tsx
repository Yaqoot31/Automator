import { useEffect, useState } from 'react';
import {
  RotateCcw,
  CheckCircle2,
  ShieldAlert,
  UserCheck,
  KeyRound,
  Save,
  Database,
  Cloud,
  RefreshCw,
  Link2,
  Unlink,
  Loader2,
} from 'lucide-react';
import type {
  AccentColor,
  AppSettings,
  AutomationFramework,
  LayoutDensity,
  ThemeMode,
  UserProfile,
} from '@/types';
import { FRAMEWORK_OPTIONS } from '@/lib/frameworks';
import {
  changePasswordApi,
  resendVerificationApi,
  updateProfileApi,
  verifyEmailApi,
} from '@/lib/api';
import {
  FIREBASE_META,
  formatFirebaseAuthError,
  getFirebaseConnectionState,
  isUnauthorizedDomainError,
  subscribeFirebaseConnection,
  testConnection,
  type FirebaseConnectionState,
} from '@/lib/firebase';
import { UnauthorizedDomainNotice } from '@/components/UnauthorizedDomainNotice';
import {
  fetchFirestoreCollectionSummary,
  type FirestoreCollectionSummary,
} from '@/lib/firebaseSync';

interface SettingsViewProps {
  token: string;
  settings: AppSettings;
  user: UserProfile;
  projectsCount?: number;
  firestoreLiveProjects?: number | null;
  firebaseUserEmail?: string | null;
  firebaseEmailVerified?: boolean;
  onConnectFirebaseGoogle?: () => Promise<void>;
  onDisconnectFirebase?: () => Promise<void>;
  onSyncWorkspaceToFirestore?: () => Promise<FirestoreCollectionSummary>;
  onUserUpdated: (user: UserProfile) => void;
  onUpdateSettings: (patch: Partial<AppSettings>) => void;
  onResetSettings: () => void;
}

const THEMES: { id: ThemeMode; label: string; swatch: string }[] = [
  { id: 'obsidian', label: 'Obsidian Dark', swatch: '#07090e' },
  { id: 'daylight', label: 'Daylight Light', swatch: '#f6f8fb' },
  { id: 'slate', label: 'Slate Studio', swatch: '#0c121a' },
  { id: 'cobalt', label: 'Cobalt Night', swatch: '#060b18' },
];

const ACCENTS: { id: AccentColor; label: string; color: string }[] = [
  { id: 'amber', label: 'Amber', color: '#d4a017' },
  { id: 'teal', label: 'Teal', color: '#0d9488' },
  { id: 'cobalt', label: 'Cobalt', color: '#2563eb' },
  { id: 'emerald', label: 'Emerald', color: '#059669' },
];

export function SettingsView({
  token,
  settings,
  user,
  projectsCount = 0,
  firestoreLiveProjects = null,
  firebaseUserEmail = null,
  firebaseEmailVerified = false,
  onConnectFirebaseGoogle,
  onDisconnectFirebase,
  onSyncWorkspaceToFirestore,
  onUserUpdated,
  onUpdateSettings,
  onResetSettings,
}: SettingsViewProps) {
  const [name, setName] = useState(user.name);
  const [jobTitle, setJobTitle] = useState(user.jobTitle || '');
  const [organization, setOrganization] = useState(user.organization || '');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileNotice, setProfileNotice] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [verifyCode, setVerifyCode] = useState('');
  const [previewVerifyCode, setPreviewVerifyCode] = useState<string | null>(null);
  const [verifyLoading, setVerifyLoading] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwNotice, setPwNotice] = useState<string | null>(null);
  const [pwError, setPwError] = useState<string | null>(null);

  const [fbConn, setFbConn] = useState<FirebaseConnectionState>(getFirebaseConnectionState);
  const [testingConn, setTestingConn] = useState(false);
  const [cloudSummary, setCloudSummary] = useState<FirestoreCollectionSummary | null>(null);
  const [cloudBusy, setCloudBusy] = useState<'connect' | 'disconnect' | 'sync' | 'refresh' | null>(
    null
  );
  const [cloudNotice, setCloudNotice] = useState<string | null>(null);
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [cloudUnauthorizedDomain, setCloudUnauthorizedDomain] = useState(false);

  useEffect(() => {
    return subscribeFirebaseConnection(setFbConn);
  }, []);

  useEffect(() => {
    if (!firebaseEmailVerified) {
      return;
    }
    fetchFirestoreCollectionSummary()
      .then(setCloudSummary)
      .catch(() => {
        // Defer error display to explicit refresh/sync actions
      });
  }, [firebaseEmailVerified]);

  const activeCloudSummary = firebaseEmailVerified ? cloudSummary : null;

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileError(null);
    setProfileNotice(null);
    try {
      const res = await updateProfileApi(token, {
        name: name.trim(),
        jobTitle: jobTitle.trim(),
        organization: organization.trim(),
      });
      onUserUpdated(res.user);
      setProfileNotice('Profile saved.');
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Failed to update profile.');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleResendVerification = async () => {
    setVerifyLoading(true);
    setProfileError(null);
    try {
      const res = await resendVerificationApi(token);
      setPreviewVerifyCode(res.verificationPreviewCode || null);
      if (res.verificationPreviewCode) {
        setVerifyCode(res.verificationPreviewCode);
      }
      setProfileNotice('Verification code generated.');
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Could not send verification code.');
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleConfirmVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifyLoading(true);
    setProfileError(null);
    try {
      const res = await verifyEmailApi(user.email, verifyCode.trim());
      onUserUpdated(res.user);
      setVerifyCode('');
      setPreviewVerifyCode(null);
      setProfileNotice('Email address verified successfully.');
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Verification failed.');
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);
    setPwNotice(null);
    if (newPassword !== confirmNewPassword) {
      setPwError('New password and confirmation do not match.');
      return;
    }
    setPwLoading(true);
    try {
      await changePasswordApi(token, currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setPwNotice('Password updated securely.');
    } catch (err) {
      setPwError(err instanceof Error ? err.message : 'Could not change password.');
    } finally {
      setPwLoading(false);
    }
  };

  const handleTestFirebaseConnection = async () => {
    setTestingConn(true);
    setCloudError(null);
    try {
      const next = await testConnection();
      setFbConn(next);
      setCloudNotice(next.detail || 'Connection check completed.');
    } catch (err) {
      setCloudError(err instanceof Error ? err.message : 'Firebase connection test failed.');
    } finally {
      setTestingConn(false);
    }
  };

  const handleConnectFirebase = async () => {
    if (!onConnectFirebaseGoogle) return;
    setCloudBusy('connect');
    setCloudError(null);
    setCloudUnauthorizedDomain(false);
    setCloudNotice(null);
    try {
      await onConnectFirebaseGoogle();
      setCloudNotice('Google / Firebase account linked to workspace.');
    } catch (err) {
      if (isUnauthorizedDomainError(err)) {
        setCloudUnauthorizedDomain(true);
      } else {
        setCloudError(formatFirebaseAuthError(err));
      }
    } finally {
      setCloudBusy(null);
    }
  };

  const handleDisconnectFirebase = async () => {
    if (!onDisconnectFirebase) return;
    setCloudBusy('disconnect');
    setCloudError(null);
    setCloudNotice(null);
    try {
      await onDisconnectFirebase();
      setCloudSummary(null);
      setCloudNotice('Firebase Auth session disconnected.');
    } catch (err) {
      setCloudError(err instanceof Error ? err.message : 'Could not disconnect Firebase.');
    } finally {
      setCloudBusy(null);
    }
  };

  const handleSyncCloudWorkspace = async () => {
    if (!onSyncWorkspaceToFirestore) return;
    setCloudBusy('sync');
    setCloudError(null);
    setCloudNotice(null);
    try {
      const summary = await onSyncWorkspaceToFirestore();
      setCloudSummary(summary);
      setCloudNotice(
        `Synced ${summary.projects} project(s), ${summary.testCases} test case(s), and ${summary.sqaDefects} defect(s) to Cloud Firestore.`
      );
    } catch (err) {
      setCloudError(err instanceof Error ? err.message : 'Cloud Firestore sync failed.');
    } finally {
      setCloudBusy(null);
    }
  };

  const handleRefreshCloudCounts = async () => {
    setCloudBusy('refresh');
    setCloudError(null);
    try {
      const summary = await fetchFirestoreCollectionSummary();
      setCloudSummary(summary);
      setCloudNotice('Refreshed live Cloud Firestore collection metrics.');
    } catch (err) {
      setCloudError(err instanceof Error ? err.message : 'Could not read Firestore collections.');
    } finally {
      setCloudBusy(null);
    }
  };

  return (
    <div className="max-w-[960px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-5 sm:space-y-6 animate-view-enter">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-xl sm:text-2xl text-[var(--text-main)]">
            Profile, Security &amp; Platform Settings
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
            Manage your account profile, email verification, password, themes, and default automation framework.
          </p>
        </div>
        <button
          type="button"
          onClick={onResetSettings}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-medium surface-panel hover:bg-[var(--surface-hover)] min-h-[44px] w-full sm:w-auto shrink-0"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Visual Defaults</span>
        </button>
      </div>

      {/* User Profile & Email Verification */}
      <section className="surface-panel rounded-2xl p-4 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <UserCheck className="w-4 h-4 text-[var(--accent-primary)]" />
            <span>Account Profile &amp; Verification</span>
          </div>
          <div className="text-xs font-mono">
            {user.emailVerified ? (
              <span className="inline-flex items-center gap-1.5 text-[var(--status-success)]">
                <CheckCircle2 className="w-4 h-4" />
                <span>Email Verified</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[var(--status-warning)]">
                <ShieldAlert className="w-4 h-4" />
                <span>Verification Pending</span>
              </span>
            )}
          </div>
        </div>

        {profileError && (
          <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2 text-xs text-red-500">
            {profileError}
          </div>
        )}
        {profileNotice && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2 text-xs text-[var(--status-success)]">
            {profileNotice}
          </div>
        )}

        <form onSubmit={handleSaveProfile} className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="space-y-1">
            <label className="text-[var(--text-secondary)]">Full Name</label>
            <input
              type="text"
              required
              minLength={2}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full min-h-[44px] px-3 rounded-lg surface-elevated text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[var(--text-secondary)]">Email (Verified Identity)</label>
            <input
              type="text"
              disabled
              value={`${user.email} (${user.role.replace('_', ' ')})`}
              className="w-full min-h-[44px] px-3 rounded-lg surface-elevated font-mono text-xs opacity-75"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[var(--text-secondary)]">Job Title</label>
            <input
              type="text"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="e.g. Senior SQA Automation Lead"
              className="w-full min-h-[44px] px-3 rounded-lg surface-elevated text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[var(--text-secondary)]">Organization</label>
            <input
              type="text"
              value={organization}
              onChange={(e) => setOrganization(e.target.value)}
              placeholder="e.g. Acme Engineering"
              className="w-full min-h-[44px] px-3 rounded-lg surface-elevated text-sm"
            />
          </div>
          <div className="sm:col-span-2 flex justify-end pt-1">
            <button
              type="submit"
              disabled={profileSaving}
              className="inline-flex items-center gap-2 px-5 min-h-[42px] rounded-xl font-semibold"
              style={{ backgroundColor: 'var(--accent-primary)', color: 'var(--accent-contrast)' }}
            >
              <Save className="w-3.5 h-3.5" />
              <span>{profileSaving ? 'Saving...' : 'Save Profile'}</span>
            </button>
          </div>
        </form>

        {!user.emailVerified && (
          <div className="pt-4 border-t space-y-3 text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-[var(--text-secondary)]">
                Verify <span className="font-mono text-[var(--text-main)]">{user.email}</span> to complete account setup.
              </span>
              <button
                type="button"
                disabled={verifyLoading}
                onClick={handleResendVerification}
                className="px-3.5 min-h-[40px] rounded-lg surface-elevated font-medium hover:bg-[var(--surface-hover)] shrink-0"
              >
                Send Verification Code
              </button>
            </div>
            {previewVerifyCode && (
              <div className="text-[var(--text-secondary)]">
                Generated verification code:{' '}
                <span className="font-mono font-bold text-[var(--accent-primary)]">
                  {previewVerifyCode}
                </span>
              </div>
            )}
            <form onSubmit={handleConfirmVerification} className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                required
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value)}
                placeholder="Enter 6-digit verification code"
                className="flex-1 min-h-[42px] px-3 rounded-lg surface-elevated font-mono"
              />
              <button
                type="submit"
                disabled={verifyLoading}
                className="px-5 min-h-[42px] rounded-lg font-semibold"
                style={{ backgroundColor: 'var(--accent-primary)', color: 'var(--accent-contrast)' }}
              >
                Verify Email
              </button>
            </form>
          </div>
        )}
      </section>

      {/* Change Password */}
      <section className="surface-panel rounded-2xl p-4 sm:p-6 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <KeyRound className="w-4 h-4 text-[var(--accent-secondary)]" />
          <span>Update Password</span>
        </div>
        {pwError && (
          <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2 text-xs text-red-500">
            {pwError}
          </div>
        )}
        {pwNotice && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2 text-xs text-[var(--status-success)]">
            {pwNotice}
          </div>
        )}
        <form onSubmit={handleChangePassword} className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <input
            type="password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Current password"
            className="min-h-[44px] px-3 rounded-lg surface-elevated"
          />
          <input
            type="password"
            required
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New password (8+ chars)"
            className="min-h-[44px] px-3 rounded-lg surface-elevated"
          />
          <input
            type="password"
            required
            minLength={8}
            value={confirmNewPassword}
            onChange={(e) => setConfirmNewPassword(e.target.value)}
            placeholder="Confirm new password"
            className="min-h-[44px] px-3 rounded-lg surface-elevated"
          />
          <div className="sm:col-span-3 flex justify-end">
            <button
              type="submit"
              disabled={pwLoading}
              className="px-5 min-h-[42px] rounded-xl surface-elevated hover:bg-[var(--accent-soft)] font-semibold"
            >
              {pwLoading ? 'Updating...' : 'Change Password'}
            </button>
          </div>
        </form>
      </section>

      {/* Firebase Cloud Database & Backend */}
      <section className="surface-panel rounded-2xl p-4 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Database className="w-4 h-4 text-[var(--accent-primary)]" />
            <span>Firebase Cloud Database &amp; Backend</span>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${
                fbConn.status === 'connected'
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-[var(--status-success)]'
                  : fbConn.status === 'checking'
                    ? 'border-amber-500/30 bg-amber-500/10 text-[var(--status-warning)]'
                    : 'border-red-500/30 bg-red-500/10 text-red-500'
              }`}
            >
              <Cloud className="w-3.5 h-3.5" />
              <span>
                {fbConn.status === 'connected'
                  ? 'Connected'
                  : fbConn.status === 'checking'
                    ? 'Checking'
                    : fbConn.status === 'offline'
                      ? 'Offline'
                      : 'Error'}
              </span>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="rounded-xl surface-elevated p-3 space-y-1">
            <div className="text-[var(--text-muted)]">Firebase Project ID</div>
            <div className="font-mono text-[var(--text-main)] break-all">
              {FIREBASE_META.projectId}
            </div>
          </div>
          <div className="rounded-xl surface-elevated p-3 space-y-1">
            <div className="text-[var(--text-muted)]">Firestore Database ID</div>
            <div className="font-mono text-[var(--text-main)] break-all">
              {FIREBASE_META.databaseId}
            </div>
          </div>
        </div>

        <div className="rounded-xl surface-elevated p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="space-y-0.5 min-w-0">
            <div className="font-semibold text-[var(--text-main)]">
              {firebaseEmailVerified && firebaseUserEmail
                ? `Firebase Auth Linked: ${firebaseUserEmail}`
                : 'Firebase Google Auth Not Linked'}
            </div>
            <div className="text-[var(--text-secondary)]">
              {firebaseEmailVerified
                ? 'Verified identity active for real-time Cloud Firestore read/write sync and backend token verification.'
                : 'Link a verified Google account to synchronize projects, test cases, runs, and SQA records with Cloud Firestore.'}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleTestFirebaseConnection}
              disabled={testingConn}
              className="inline-flex items-center gap-1.5 px-3.5 min-h-[40px] rounded-xl surface-panel border hover:bg-[var(--surface-hover)] font-medium"
            >
              {testingConn ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              <span>Test Connection</span>
            </button>
            {firebaseEmailVerified ? (
              <button
                type="button"
                onClick={handleDisconnectFirebase}
                disabled={cloudBusy !== null}
                className="inline-flex items-center gap-1.5 px-3.5 min-h-[40px] rounded-xl border border-red-500/30 bg-red-500/10 text-red-500 hover:bg-red-500/15 font-medium"
              >
                <Unlink className="w-3.5 h-3.5" />
                <span>{cloudBusy === 'disconnect' ? 'Disconnecting...' : 'Disconnect Firebase'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleConnectFirebase}
                disabled={cloudBusy !== null}
                className="inline-flex items-center gap-1.5 px-4 min-h-[40px] rounded-xl font-semibold"
                style={{
                  backgroundColor: 'var(--accent-primary)',
                  color: 'var(--accent-contrast)',
                }}
              >
                <Link2 className="w-3.5 h-3.5" />
                <span>{cloudBusy === 'connect' ? 'Linking...' : 'Connect Google / Firebase'}</span>
              </button>
            )}
          </div>
        </div>

        {cloudUnauthorizedDomain && (
          <UnauthorizedDomainNotice contextLabel="Firebase Google Auth" />
        )}

        {cloudError && (
          <div
            role="alert"
            className="rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2 text-xs text-red-500 break-words"
          >
            {cloudError}
          </div>
        )}
        {cloudNotice && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2 text-xs text-[var(--status-success)]">
            {cloudNotice}
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
          {[
            {
              label: 'Projects (Live)',
              val: firestoreLiveProjects ?? activeCloudSummary?.projects ?? 0,
            },
            { label: 'Test Cases', val: activeCloudSummary?.testCases ?? 0 },
            { label: 'Test Runs', val: activeCloudSummary?.runs ?? 0 },
            { label: 'SQA Plans', val: activeCloudSummary?.sqaPlans ?? 0 },
            { label: 'SQA Suites', val: activeCloudSummary?.sqaSuites ?? 0 },
            { label: 'SQA Defects', val: activeCloudSummary?.sqaDefects ?? 0 },
            { label: 'Requirements', val: activeCloudSummary?.sqaRequirements ?? 0 },
            { label: 'Releases', val: activeCloudSummary?.sqaReleases ?? 0 },
          ].map((item) => (
            <div key={item.label} className="rounded-xl surface-elevated p-3 space-y-1">
              <div className="text-[11px] text-[var(--text-muted)] truncate">{item.label}</div>
              <div className="font-mono text-base font-bold text-[var(--text-main)]">
                {firebaseEmailVerified ? item.val : '—'}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 text-xs">
          <span className="text-[var(--text-muted)]">
            Local workspace projects ready: <span className="font-mono text-[var(--text-main)]">{projectsCount}</span>
            {activeCloudSummary?.lastUpdatedAt ? ` · Last synced ${new Date(activeCloudSummary.lastUpdatedAt).toLocaleTimeString()}` : ''}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleRefreshCloudCounts}
              disabled={!firebaseEmailVerified || cloudBusy !== null}
              className="inline-flex items-center gap-1.5 px-3.5 min-h-[40px] rounded-xl surface-elevated hover:bg-[var(--surface-hover)] font-medium disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${cloudBusy === 'refresh' ? 'animate-spin' : ''}`} />
              <span>Refresh Cloud Counts</span>
            </button>
            <button
              type="button"
              onClick={handleSyncCloudWorkspace}
              disabled={!firebaseEmailVerified || cloudBusy !== null}
              className="inline-flex items-center gap-1.5 px-4 min-h-[40px] rounded-xl font-semibold disabled:opacity-50"
              style={{
                backgroundColor: 'var(--accent-primary)',
                color: 'var(--accent-contrast)',
              }}
            >
              <Cloud className="w-3.5 h-3.5" />
              <span>{cloudBusy === 'sync' ? 'Syncing...' : 'Sync Workspace to Firestore'}</span>
            </button>
          </div>
        </div>
      </section>

      {/* Theme Mode */}
      <section className="surface-panel rounded-2xl p-4 sm:p-6 space-y-4">
        <div className="text-sm font-semibold">Color Mode &amp; Surface Theme</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
          {THEMES.map((t) => {
            const active = settings.theme === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onUpdateSettings({ theme: t.id })}
                className={`p-3 sm:p-3.5 rounded-xl border text-left space-y-2 transition-colors min-h-[44px] ${
                  active
                    ? 'border-[var(--accent-primary)] bg-[var(--accent-soft)]'
                    : 'surface-elevated'
                }`}
              >
                <div
                  className="w-full h-8 rounded-lg border"
                  style={{ backgroundColor: t.swatch }}
                />
                <div className="text-xs font-semibold truncate">{t.label}</div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Accent & Typography */}
      <section className="surface-panel rounded-2xl p-4 sm:p-6 space-y-5">
        <div className="space-y-2.5">
          <div className="text-sm font-semibold">Accent Color</div>
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2.5">
            {ACCENTS.map((a) => {
              const active = settings.accent === a.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => onUpdateSettings({ accent: a.id })}
                  className={`inline-flex items-center justify-center sm:justify-start gap-2 px-4 py-2.5 rounded-xl text-xs font-medium border min-h-[44px] ${
                    active
                      ? 'border-[var(--accent-primary)] bg-[var(--accent-soft)]'
                      : 'surface-elevated'
                  }`}
                >
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: a.color }}
                  />
                  <span>{a.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--text-secondary)]">
              Workspace Density
            </label>
            <select
              value={settings.density}
              onChange={(e) => onUpdateSettings({ density: e.target.value as LayoutDensity })}
              className="w-full min-h-[44px] px-3 rounded-lg surface-elevated text-xs"
            >
              <option value="compact">Compact</option>
              <option value="comfortable">Comfortable</option>
              <option value="spacious">Spacious</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--text-secondary)]">
              Default Automation Stack
            </label>
            <select
              value={settings.defaultFramework}
              onChange={(e) =>
                onUpdateSettings({ defaultFramework: e.target.value as AutomationFramework })
              }
              className="w-full min-h-[44px] px-3 rounded-lg surface-elevated text-xs"
            >
              {FRAMEWORK_OPTIONS.map((fw) => (
                <option key={fw.id} value={fw.id}>
                  {fw.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--text-secondary)]">
              Interface Scale ({settings.fontScale}%)
            </label>
            <input
              type="range"
              min={90}
              max={115}
              step={5}
              value={settings.fontScale}
              onChange={(e) => onUpdateSettings({ fontScale: Number(e.target.value) })}
              className="w-full h-11 accent-[var(--accent-primary)]"
            />
          </div>
        </div>

        <div className="pt-1">
          <label className="inline-flex items-center gap-2.5 text-xs cursor-pointer min-h-[44px]">
            <input
              type="checkbox"
              checked={settings.reducedMotion}
              onChange={(e) => onUpdateSettings({ reducedMotion: e.target.checked })}
              className="w-4 h-4 rounded accent-[var(--accent-primary)]"
            />
            <span>Reduce animations and transition motion</span>
          </label>
        </div>
      </section>
    </div>
  );
}
