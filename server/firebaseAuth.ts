import fs from 'node:fs';
import path from 'node:path';
import { initializeApp, getApps, getApp, type App } from 'firebase-admin/app';
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';

interface FirebaseAppletConfig {
  projectId?: string;
}

function loadFirebaseConfig(): FirebaseAppletConfig {
  try {
    const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    if (!fs.existsSync(configPath)) return {};
    return JSON.parse(fs.readFileSync(configPath, 'utf-8')) as FirebaseAppletConfig;
  } catch {
    return {};
  }
}

function getFirebaseAdminApp(): App | null {
  const cfg = loadFirebaseConfig();
  if (!cfg.projectId || cfg.projectId === 'remixed-project-id') {
    return null;
  }
  return getApps().length ? getApp() : initializeApp({ projectId: cfg.projectId });
}

export async function verifyFirebaseIdToken(idToken: string): Promise<DecodedIdToken> {
  const app = getFirebaseAdminApp();
  if (!app) {
    throw new Error('Firebase project configuration is not initialized.');
  }
  // verifyIdToken(token) verifies Firebase cryptographic signatures without requiring IAM roles
  return getAuth(app).verifyIdToken(idToken);
}
