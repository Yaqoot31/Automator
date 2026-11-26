import type {
  AiMessage,
  AutomationFramework,
  AutomationProject,
  CodeDiagnostic,
  ProjectFile,
  TestCase,
  TestRunRecord,
  TestingApproach,
  UserProfile,
  WebsiteAnalysisReport,
} from '@/types';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function apiRequest<T>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
    token?: string | null;
    body?: unknown;
  } = {}
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const res = await fetch(path, {
    method: options.method || 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const text = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    data = { error: text || `Request failed with status ${res.status}` };
  }

  if (!res.ok) {
    throw new ApiError(
      String(data.error || `Request failed with HTTP ${res.status}`),
      res.status
    );
  }

  return data as T;
}

export async function loginApi(email: string, password: string) {
  return apiRequest<{ user: UserProfile; token: string }>('/api/auth/login', {
    method: 'POST',
    body: { email, password },
  });
}

export async function registerApi(name: string, email: string, password: string) {
  return apiRequest<{ user: UserProfile; token: string }>('/api/auth/register', {
    method: 'POST',
    body: { name, email, password },
  });
}

export async function analyzeWebsiteApi(
  token: string,
  payload: {
    url: string;
    maxPages: number;
    maxDepth: number;
    respectRobots: boolean;
    followSubdomains: boolean;
    jobId: string;
  }
) {
  return apiRequest<{ analysis: WebsiteAnalysisReport; testCases: TestCase[] }>(
    '/api/analyze',
    {
      method: 'POST',
      token,
      body: payload,
    }
  );
}

export async function listProjectsApi(token: string) {
  return apiRequest<{ projects: AutomationProject[] }>('/api/projects', { token });
}

export async function createProjectApi(
  token: string,
  payload: {
    name?: string;
    description?: string;
    url: string;
    framework: AutomationFramework;
    approach: TestingApproach;
    analysis?: WebsiteAnalysisReport | null;
    testCases?: TestCase[];
  }
) {
  return apiRequest<{ project: AutomationProject }>('/api/projects', {
    method: 'POST',
    token,
    body: payload,
  });
}

export async function updateProjectApi(
  token: string,
  projectId: string,
  patch: Partial<AutomationProject>
) {
  return apiRequest<{ project: AutomationProject }>(`/api/projects/${projectId}`, {
    method: 'PATCH',
    token,
    body: patch,
  });
}

export async function regenerateProjectApi(
  token: string,
  projectId: string,
  framework: AutomationFramework,
  approach: TestingApproach
) {
  return apiRequest<{ project: AutomationProject }>(
    `/api/projects/${projectId}/regenerate`,
    {
      method: 'POST',
      token,
      body: { framework, approach },
    }
  );
}

export async function duplicateProjectApi(token: string, projectId: string) {
  return apiRequest<{ project: AutomationProject }>(
    `/api/projects/${projectId}/duplicate`,
    {
      method: 'POST',
      token,
    }
  );
}

export async function deleteProjectApi(token: string, projectId: string) {
  return apiRequest<{ ok: boolean }>(`/api/projects/${projectId}`, {
    method: 'DELETE',
    token,
  });
}

export async function saveProjectSecretsApi(
  token: string,
  projectId: string,
  secrets: Record<string, string>
) {
  return apiRequest<{ project: AutomationProject }>(
    `/api/projects/${projectId}/secrets`,
    {
      method: 'PUT',
      token,
      body: { secrets },
    }
  );
}

export async function startTestRunApi(
  token: string,
  projectId: string,
  testCaseIds?: string[]
) {
  return apiRequest<{ run: TestRunRecord }>(`/api/projects/${projectId}/runs`, {
    method: 'POST',
    token,
    body: { testCaseIds },
  });
}

export async function cancelTestRunApi(token: string, runId: string) {
  return apiRequest<{ cancelled: boolean }>(`/api/runs/${runId}/cancel`, {
    method: 'POST',
    token,
  });
}

export async function listTestRunsApi(token: string, projectId?: string) {
  const qs = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
  return apiRequest<{ runs: TestRunRecord[] }>(`/api/runs${qs}`, { token });
}

export async function validateCodeApi(
  token: string,
  language: ProjectFile['language'],
  code: string
) {
  return apiRequest<{ valid: boolean; diagnostics: CodeDiagnostic[] }>(
    '/api/code/validate',
    {
      method: 'POST',
      token,
      body: { language, code },
    }
  );
}

export async function getAiHistoryApi(token: string, projectId: string) {
  return apiRequest<{ messages: AiMessage[] }>(
    `/api/projects/${projectId}/ai/history`,
    { token }
  );
}

export async function sendAiChatApi(
  token: string,
  projectId: string,
  payload: {
    prompt: string;
    activeFilePath?: string;
    activeFileContent?: string;
  }
) {
  return apiRequest<{ message: AiMessage; messages: AiMessage[] }>(
    `/api/projects/${projectId}/ai/chat`,
    {
      method: 'POST',
      token,
      body: payload,
    }
  );
}

export async function enhanceAiTestsApi(
  token: string,
  projectId: string,
  focus?: string
) {
  return apiRequest<{ addedCount: number; project: AutomationProject }>(
    `/api/projects/${projectId}/ai/enhance-tests`,
    {
      method: 'POST',
      token,
      body: { focus },
    }
  );
}

export async function downloadReportApi(
  token: string,
  runId: string,
  format: 'pdf' | 'html' | 'json'
) {
  const res = await fetch(`/api/reports/${runId}/download?format=${format}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to download ${format.toUpperCase()} report.`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `automation-report-${runId.slice(0, 8)}.${format}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function fetchAuthorizedScreenshotUrl(
  token: string,
  screenshotPath: string
): Promise<string> {
  const res = await fetch(screenshotPath, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Screenshot unavailable');
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
