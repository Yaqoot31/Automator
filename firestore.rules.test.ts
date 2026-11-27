/**
 * Phase 0 Adversarial Security Rule Test Matrix for Automator AI
 * Documents expected PERMISSION_DENIED vs ALLOW assertions for the Dirty Dozen payloads.
 */
export interface DirtyDozenCase {
  id: string;
  targetPath: string;
  operation: 'create' | 'update' | 'get' | 'list' | 'delete';
  actor: { uid: string; emailVerified: boolean; email?: string };
  payload?: Record<string, unknown>;
  expected: 'PERMISSION_DENIED' | 'ALLOW';
  invariant: string;
}

export const DIRTY_DOZEN_TESTS: DirtyDozenCase[] = [
  {
    id: 'DD-01-unauthenticated-create',
    targetPath: 'projects/proj_1',
    operation: 'create',
    actor: { uid: '', emailVerified: false },
    payload: { id: 'proj_1', ownerUid: 'anon', name: 'Test' },
    expected: 'PERMISSION_DENIED',
    invariant: 'isSignedIn() && isVerified()',
  },
  {
    id: 'DD-02-email-spoofing',
    targetPath: 'projects/proj_1',
    operation: 'get',
    actor: { uid: 'spoof', emailVerified: false, email: 'rajpoot311210@gmail.com' },
    expected: 'PERMISSION_DENIED',
    invariant: 'isBootstrappedAdmin() requires email_verified == true',
  },
  {
    id: 'DD-03-owner-uid-spoof',
    targetPath: 'projects/proj_1',
    operation: 'create',
    actor: { uid: 'user_a', emailVerified: true },
    payload: { id: 'proj_1', ownerUid: 'user_b', name: 'Hijack' },
    expected: 'PERMISSION_DENIED',
    invariant: 'isValidProject enforces incoming().ownerUid == request.auth.uid',
  },
  {
    id: 'DD-04-shadow-ghost-field',
    targetPath: 'projects/proj_1',
    operation: 'create',
    actor: { uid: 'user_a', emailVerified: true },
    payload: { id: 'proj_1', ownerUid: 'user_a', name: 'Valid', isAdmin: true },
    expected: 'PERMISSION_DENIED',
    invariant: 'keys().hasOnly() rejects undeclared ghost keys',
  },
  {
    id: 'DD-05-id-poisoning',
    targetPath: 'projects/bad$id_!@#',
    operation: 'create',
    actor: { uid: 'user_a', emailVerified: true },
    payload: { id: 'bad$id_!@#', ownerUid: 'user_a', name: 'Bad' },
    expected: 'PERMISSION_DENIED',
    invariant: 'isValidId() enforces ^[a-zA-Z0-9_\\-]+$ and <= 128 chars',
  },
  {
    id: 'DD-06-value-poisoning-oversize-name',
    targetPath: 'projects/proj_1',
    operation: 'update',
    actor: { uid: 'user_a', emailVerified: true },
    payload: { name: 'A'.repeat(500) },
    expected: 'PERMISSION_DENIED',
    invariant: 'isValidProject enforces name.size() <= 120 on update',
  },
  {
    id: 'DD-07-orphaned-subcollection-defect',
    targetPath: 'projects/missing_proj/sqaDefects/bug_1',
    operation: 'create',
    actor: { uid: 'user_a', emailVerified: true },
    payload: { id: 'bug_1', projectId: 'missing_proj', ownerUid: 'user_a', title: 'Orphan' },
    expected: 'PERMISSION_DENIED',
    invariant: 'Master Gate get(/projects/missing_proj) fails',
  },
  {
    id: 'DD-08-cross-tenant-testcase-write',
    targetPath: 'projects/user_b_proj/testCases/tc_1',
    operation: 'create',
    actor: { uid: 'user_a', emailVerified: true },
    payload: { id: 'tc_1', projectId: 'user_b_proj', ownerUid: 'user_a', title: 'Cross' },
    expected: 'PERMISSION_DENIED',
    invariant: 'Master Gate checks parent project ownerUid == request.auth.uid',
  },
  {
    id: 'DD-09-client-timestamp-forgery',
    targetPath: 'projects/proj_1',
    operation: 'create',
    actor: { uid: 'user_a', emailVerified: true },
    payload: { id: 'proj_1', ownerUid: 'user_a', createdAt: '2020-01-01T00:00:00Z' },
    expected: 'PERMISSION_DENIED',
    invariant: 'createdAt == request.time',
  },
  {
    id: 'DD-10-terminal-state-defect-bypass',
    targetPath: 'projects/proj_1/sqaDefects/bug_closed',
    operation: 'update',
    actor: { uid: 'user_a', emailVerified: true },
    payload: { status: 'New', title: 'Reopen illegally' },
    expected: 'PERMISSION_DENIED',
    invariant: 'existing().status != "Closed"',
  },
  {
    id: 'DD-11-pii-blanket-read',
    targetPath: 'users/user_b/private/info',
    operation: 'get',
    actor: { uid: 'user_a', emailVerified: true },
    expected: 'PERMISSION_DENIED',
    invariant: 'isOwner(userId) strictly isolates PII subcollection',
  },
  {
    id: 'DD-12-blanket-list-scrape',
    targetPath: 'projects',
    operation: 'list',
    actor: { uid: 'user_a', emailVerified: true },
    expected: 'PERMISSION_DENIED',
    invariant: 'allow list requires resource.data.ownerUid == request.auth.uid',
  },
];
