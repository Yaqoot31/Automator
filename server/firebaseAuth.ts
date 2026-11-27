import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { initializeApp, getApps, getApp, type App } from 'firebase-admin/app';
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';

const require = createRequire(import.meta.url);

interface FirebaseAppletConfig {
  projectId?: string;
}

function loadFirebaseConfig(): FirebaseAppletConfig {
  const envProjectId = process.env.FIREBASE_PROJECT_ID?.trim();

  const candidatePaths = [
    path.resolve(process.cwd(), 'firebase-applet-config.json'),
    path.resolve(path.dirname(new URL(import.meta.url).pathname), '../firebase-applet-config.json'),
  ];

  for (const configPath of candidatePaths) {
    try {
      if (fs.existsSync(configPath)) {
        const parsed = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as FirebaseAppletConfig;
        if (parsed?.projectId) {
          return parsed;
        }
      }
    } catch {
      // Try next source
    }
  }

  try {
    const required = require('../firebase-applet-config.json') as FirebaseAppletConfig;
    if (required?.projectId) {
      return required;
    }
  } catch {
    // Fallback to env variable
  }

  return envProjectId ? { projectId: envProjectId } : {};
}

export function isFirebaseAdminConfigured(): boolean {
  const cfg = loadFirebaseConfig();
  return Boolean(cfg.projectId && cfg.projectId !== 'remixed-project-id');
}

function getFirebaseAdminApp(): App | null {
  if (getApps().length > 0) {
    return getApp();
  }
  const cfg = loadFirebaseConfig();
  if (!cfg.projectId || cfg.projectId === 'remixed-project-id') {
    return null;
  }
  return initializeApp({ projectId: cfg.projectId });
}

export async function verifyFirebaseIdToken(idToken: string): Promise<DecodedIdToken> {
  const app = getFirebaseAdminApp();
  if (!app) {
    throw new Error(
      'Firebase project configuration is missing. Ensure firebase-applet-config.json or FIREBASE_PROJECT_ID is configured.'
    );
  }
  // verifyIdToken(token) verifies Firebase cryptographic signatures without requiring IAM roles
  return getAuth(app).verifyIdToken(idToken);
}
