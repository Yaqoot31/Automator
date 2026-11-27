import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);
export const auth = getAuth(app);
export const googleAuthProvider = new GoogleAuthProvider();

export const FIREBASE_META = {
  projectId: firebaseConfig.projectId,
  databaseId: firebaseConfig.firestoreDatabaseId || '(default)',
  authDomain: firebaseConfig.authDomain,
  authorizedDomainsUrl: `https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/settings`,
};

export function isUnauthorizedDomainError(err: unknown): boolean {
  const code = (err as { code?: string } | null)?.code || '';
  const msg = err instanceof Error ? err.message : String(err || '');
  return code === 'auth/unauthorized-domain' || msg.includes('auth/unauthorized-domain');
}

export function formatFirebaseAuthError(err: unknown): string {
  const code = (err as { code?: string } | null)?.code || '';
  const hostname = typeof window !== 'undefined' ? window.location.hostname : 'this domain';

  if (isUnauthorizedDomainError(err)) {
    return `Domain "${hostname}" is not authorized in Firebase Authentication. Add "${hostname}" to Authorized domains in Firebase Console for project "${FIREBASE_META.projectId}".`;
  }
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return 'Google sign-in popup was closed before completion.';
  }
  if (code === 'auth/popup-blocked') {
    return 'Google sign-in popup was blocked by your browser. Please allow popups for this site and try again.';
  }
  if (code === 'auth/operation-not-allowed') {
    return 'Google Sign-In provider is not enabled in Firebase Authentication.';
  }
  return err instanceof Error ? err.message : 'Google authentication failed.';
}

export const OperationType = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  LIST: 'list',
  GET: 'get',
  WRITE: 'write',
} as const;
export type OperationType = (typeof OperationType)[keyof typeof OperationType];

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export type FirebaseConnectionStatus = 'checking' | 'connected' | 'offline' | 'error';

export interface FirebaseConnectionState {
  status: FirebaseConnectionStatus;
  projectId: string;
  databaseId: string;
  checkedAt: string | null;
  detail?: string;
}

let connectionState: FirebaseConnectionState = {
  status: 'checking',
  projectId: FIREBASE_META.projectId,
  databaseId: FIREBASE_META.databaseId,
  checkedAt: null,
};

const listeners = new Set<(state: FirebaseConnectionState) => void>();

function notifyConnection(next: FirebaseConnectionState) {
  connectionState = next;
  listeners.forEach((fn) => fn(connectionState));
}

export function getFirebaseConnectionState(): FirebaseConnectionState {
  return connectionState;
}

export function subscribeFirebaseConnection(
  cb: (state: FirebaseConnectionState) => void
): () => void {
  listeners.add(cb);
  cb(connectionState);
  return () => {
    listeners.delete(cb);
  };
}

export async function testConnection(): Promise<FirebaseConnectionState> {
  notifyConnection({
    ...connectionState,
    status: 'checking',
  });
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    const next: FirebaseConnectionState = {
      status: 'connected',
      projectId: FIREBASE_META.projectId,
      databaseId: FIREBASE_META.databaseId,
      checkedAt: new Date().toISOString(),
      detail: 'Firestore server responded normally.',
    };
    notifyConnection(next);
    return next;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
      const offlineState: FirebaseConnectionState = {
        status: 'offline',
        projectId: FIREBASE_META.projectId,
        databaseId: FIREBASE_META.databaseId,
        checkedAt: new Date().toISOString(),
        detail: 'Firestore client is offline or configuration could not reach server.',
      };
      notifyConnection(offlineState);
      return offlineState;
    }
    // Permission denied on /test/connection when unauthenticated confirms server reachability
    if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('insufficient')) {
      const reachableState: FirebaseConnectionState = {
        status: 'connected',
        projectId: FIREBASE_META.projectId,
        databaseId: FIREBASE_META.databaseId,
        checkedAt: new Date().toISOString(),
        detail: 'Firestore endpoint reachable; sign in with Google to enable cloud sync.',
      };
      notifyConnection(reachableState);
      return reachableState;
    }
    const errState: FirebaseConnectionState = {
      status: 'error',
      projectId: FIREBASE_META.projectId,
      databaseId: FIREBASE_META.databaseId,
      checkedAt: new Date().toISOString(),
      detail: msg,
    };
    notifyConnection(errState);
    return errState;
  }
}

void testConnection();
export { app };
