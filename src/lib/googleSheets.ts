import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import type { AutomationProject } from '@/types';
import {
  TEST_CASE_SHEET_HEADERS,
  buildSummarySheetRows,
  mapTestCasesToRows,
} from '@/lib/exportUtils';

const REQUIRED_SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
];

// Keep OAuth access token strictly in JS memory — never in localStorage or sessionStorage
let cachedGoogleAccessToken: string | null = null;
let cachedGoogleUserEmail: string | null = null;

onAuthStateChanged(auth, (user) => {
  if (!user) {
    cachedGoogleAccessToken = null;
    cachedGoogleUserEmail = null;
  } else {
    cachedGoogleUserEmail = user.email;
  }
});

export function getGoogleWorkspaceStatus(): {
  connected: boolean;
  email: string | null;
  hasToken: boolean;
} {
  return {
    connected: Boolean(cachedGoogleAccessToken),
    email: cachedGoogleUserEmail,
    hasToken: Boolean(cachedGoogleAccessToken),
  };
}

export async function connectGoogleWorkspace(): Promise<{
  email: string | null;
  user: FirebaseUser;
}> {
  const provider = new GoogleAuthProvider();
  REQUIRED_SCOPES.forEach((s) => provider.addScope(s));
  provider.setCustomParameters({ prompt: 'consent' });

  const result = await signInWithPopup(auth, provider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  if (!credential?.accessToken) {
    throw new Error('Google OAuth did not return a spreadsheet access token. Please allow Sheets & Drive scopes.');
  }
  cachedGoogleAccessToken = credential.accessToken;
  cachedGoogleUserEmail = result.user.email;
  return { email: result.user.email, user: result.user };
}

export async function disconnectGoogleWorkspace(): Promise<void> {
  cachedGoogleAccessToken = null;
  cachedGoogleUserEmail = null;
  await signOut(auth).catch(() => {});
}

async function googleFetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  if (!cachedGoogleAccessToken) {
    throw new Error('Connect your Google Workspace account first to access Google Sheets.');
  }
  const headers: Record<string, string> = {
    Authorization: `Bearer ${cachedGoogleAccessToken}`,
    'Content-Type': 'application/json',
    ...((init.headers as Record<string, string>) || {}),
  };
  const res = await fetch(url, { ...init, headers });
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    json = { error: { message: text } };
  }
  if (!res.ok) {
    if (res.status === 401) {
      cachedGoogleAccessToken = null;
      throw new Error('Google authorization expired. Please reconnect your Google account.');
    }
    const errObj = json.error as { message?: string } | undefined;
    throw new Error(errObj?.message || `Google API error (${res.status})`);
  }
  return json as T;
}

export async function createTestCasesSpreadsheet(project: AutomationProject): Promise<{
  spreadsheetId: string;
  spreadsheetUrl: string;
  title: string;
}> {
  const title = `${project.name} — QA Test Cases (${new Date().toISOString().slice(0, 10)})`;
  const created = await googleFetch<{
    spreadsheetId: string;
    spreadsheetUrl: string;
    properties?: { title?: string };
  }>('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    body: JSON.stringify({
      properties: { title },
      sheets: [
        { properties: { title: 'Test Cases', gridProperties: { frozenRowCount: 1 } } },
        { properties: { title: 'Summary Report' } },
      ],
    }),
  });

  await writeTestCasesAndSummary(created.spreadsheetId, project);

  return {
    spreadsheetId: created.spreadsheetId,
    spreadsheetUrl: created.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${created.spreadsheetId}`,
    title: created.properties?.title || title,
  };
}

export async function syncTestCasesToSpreadsheet(
  spreadsheetId: string,
  project: AutomationProject
): Promise<{ updatedRows: number; syncedAt: string }> {
  // Fetch spreadsheet metadata first so sheet tab names are verified rather than hardcoded
  const meta = await googleFetch<{
    sheets?: { properties?: { title?: string } }[];
  }>(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=sheets.properties.title`);

  const existingTitles = (meta.sheets || [])
    .map((s) => s.properties?.title)
    .filter((t): t is string => Boolean(t));

  const missingTabs: string[] = [];
  if (!existingTitles.includes('Test Cases')) missingTabs.push('Test Cases');
  if (!existingTitles.includes('Summary Report')) missingTabs.push('Summary Report');

  if (missingTabs.length > 0) {
    await googleFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}:batchUpdate`,
      {
        method: 'POST',
        body: JSON.stringify({
          requests: missingTabs.map((title) => ({ addSheet: { properties: { title } } })),
        }),
      }
    );
  }

  return writeTestCasesAndSummary(spreadsheetId, project);
}

async function writeTestCasesAndSummary(
  spreadsheetId: string,
  project: AutomationProject
): Promise<{ updatedRows: number; syncedAt: string }> {
  const caseRows = [TEST_CASE_SHEET_HEADERS, ...mapTestCasesToRows(project, project.testCases)];
  const summaryRows = buildSummarySheetRows(project, project.testCases);

  await googleFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/'Test Cases'!A1:Z1000:clear`,
    { method: 'POST', body: JSON.stringify({}) }
  );
  await googleFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/'Summary Report'!A1:Z100:clear`,
    { method: 'POST', body: JSON.stringify({}) }
  );

  await googleFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values:batchUpdate`,
    {
      method: 'POST',
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: [
          { range: "'Test Cases'!A1", values: caseRows },
          { range: "'Summary Report'!A1", values: summaryRows },
        ],
      }),
    }
  );

  return {
    updatedRows: project.testCases.length,
    syncedAt: new Date().toISOString(),
  };
}

export async function shareSpreadsheetPermission(
  spreadsheetId: string,
  params: { email?: string; role: 'reader' | 'writer'; anyoneWithLink?: boolean }
): Promise<void> {
  if (params.anyoneWithLink) {
    await googleFetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(spreadsheetId)}/permissions`,
      {
        method: 'POST',
        body: JSON.stringify({
          type: 'anyone',
          role: params.role,
        }),
      }
    );
    return;
  }

  if (!params.email || !params.email.includes('@')) {
    throw new Error('Enter a valid Google email address to share this sheet.');
  }

  await googleFetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(spreadsheetId)}/permissions`,
    {
      method: 'POST',
      body: JSON.stringify({
        type: 'user',
        role: params.role,
        emailAddress: params.email.trim(),
      }),
    }
  );
}
