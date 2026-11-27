import type {
  AiMessage,
  AutomationFramework,
  AutomationProject,
  CodeDiagnostic,
  ProjectFile,
  SqaDefect,
  SqaRelease,
  SqaRequirement,
  SqaTestPlan,
  SqaTestSuite,
  TestCase,
  TestRunRecord,
  TestingApproach,
  UserProfile,
  UserRole,
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
    credentials: 'same-origin',
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

export async function getSessionApi() {
  return apiRequest<{ user: UserProfile | null; token: string | null }>('/api/auth/session');
}

export async function logoutApi(token?: string | null) {
  return apiRequest<{ ok: boolean }>('/api/auth/logout', {
    method: 'POST',
    token,
  });
}

export async function loginApi(email: string, password: string, rememberMe = false) {
  return apiRequest<{ user: UserProfile; token: string }>('/api/auth/login', {
    method: 'POST',
    body: { email, password, rememberMe },
  });
}

export async function registerApi(payload: {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  termsAccepted: boolean;
  role?: UserRole;
}) {
  return apiRequest<{
    user: UserProfile;
    token: string;
    verificationRequired?: boolean;
    verificationPreviewCode?: string;
  }>('/api/auth/register', {
    method: 'POST',
    body: payload,
  });
}

export async function verifyEmailApi(email: string, code: string) {
  return apiRequest<{ ok: boolean; user: UserProfile }>('/api/auth/verify-email', {
    method: 'POST',
    body: { email, code },
  });
}

export async function resendVerificationApi(token: string) {
  return apiRequest<{ ok: boolean; verificationPreviewCode?: string }>('/api/auth/resend-verification', {
    method: 'POST',
    token,
  });
}

export async function forgotPasswordApi(email: string) {
  return apiRequest<{ ok: boolean; message: string; resetPreviewCode?: string }>('/api/auth/forgot-password', {
    method: 'POST',
    body: { email },
  });
}

export async function resetPasswordApi(email: string, code: string, newPassword: string) {
  return apiRequest<{ ok: boolean }>('/api/auth/reset-password', {
    method: 'POST',
    body: { email, code, newPassword },
  });
}

export async function updateProfileApi(
  token: string,
  patch: { name?: string; jobTitle?: string; organization?: string }
) {
  return apiRequest<{ user: UserProfile }>('/api/auth/profile', {
    method: 'PATCH',
    token,
    body: patch,
  });
}

export async function changePasswordApi(
  token: string,
  currentPassword: string,
  newPassword: string
) {
  return apiRequest<{ ok: boolean }>('/api/auth/change-password', {
    method: 'POST',
    token,
    body: { currentPassword, newPassword },
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
    selectedFrameworks?: AutomationFramework[];
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
  approach: TestingApproach,
  selectedFrameworks?: AutomationFramework[]
) {
  return apiRequest<{ project: AutomationProject }>(
    `/api/projects/${projectId}/regenerate`,
    {
      method: 'POST',
      token,
      body: { framework, approach, selectedFrameworks },
    }
  );
}

export async function addProjectMemberApi(
  token: string,
  projectId: string,
  payload: { email: string; name?: string; role: UserRole }
) {
  return apiRequest<{ project: AutomationProject }>(`/api/projects/${projectId}/members`, {
    method: 'POST',
    token,
    body: payload,
  });
}

export async function removeProjectMemberApi(
  token: string,
  projectId: string,
  memberId: string
) {
  return apiRequest<{ project: AutomationProject }>(
    `/api/projects/${projectId}/members/${memberId}`,
    {
      method: 'DELETE',
      token,
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

// SQA Management APIs

export async function getSqaOverviewApi(token: string, projectId?: string) {
  const qs = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
  return apiRequest<{
    plans: SqaTestPlan[];
    suites: SqaTestSuite[];
    defects: SqaDefect[];
    requirements: SqaRequirement[];
    releases: SqaRelease[];
  }>(`/api/sqa/overview${qs}`, { token });
}

export async function saveSqaPlanApi(token: string, plan: Partial<SqaTestPlan>) {
  return apiRequest<{ plan: SqaTestPlan }>('/api/sqa/plans', {
    method: 'POST',
    token,
    body: plan,
  });
}

export async function deleteSqaPlanApi(token: string, id: string) {
  return apiRequest<{ ok: boolean }>(`/api/sqa/plans/${id}`, {
    method: 'DELETE',
    token,
  });
}

export async function saveSqaSuiteApi(token: string, suite: Partial<SqaTestSuite>) {
  return apiRequest<{ suite: SqaTestSuite }>('/api/sqa/suites', {
    method: 'POST',
    token,
    body: suite,
  });
}

export async function deleteSqaSuiteApi(token: string, id: string) {
  return apiRequest<{ ok: boolean }>(`/api/sqa/suites/${id}`, {
    method: 'DELETE',
    token,
  });
}

export async function saveSqaDefectApi(token: string, defect: Partial<SqaDefect>) {
  return apiRequest<{ defect: SqaDefect }>('/api/sqa/defects', {
    method: 'POST',
    token,
    body: defect,
  });
}

export async function deleteSqaDefectApi(token: string, id: string) {
  return apiRequest<{ ok: boolean }>(`/api/sqa/defects/${id}`, {
    method: 'DELETE',
    token,
  });
}

export async function saveSqaRequirementApi(token: string, requirement: Partial<SqaRequirement>) {
  return apiRequest<{ requirement: SqaRequirement }>('/api/sqa/requirements', {
    method: 'POST',
    token,
    body: requirement,
  });
}

export async function deleteSqaRequirementApi(token: string, id: string) {
  return apiRequest<{ ok: boolean }>(`/api/sqa/requirements/${id}`, {
    method: 'DELETE',
    token,
  });
}

export async function saveSqaReleaseApi(token: string, release: Partial<SqaRelease>) {
  return apiRequest<{ release: SqaRelease }>('/api/sqa/releases', {
    method: 'POST',
    token,
    body: release,
  });
}

export async function deleteSqaReleaseApi(token: string, id: string) {
  return apiRequest<{ ok: boolean }>(`/api/sqa/releases/${id}`, {
    method: 'DELETE',
    token,
  });
}

export async function downloadReportApi(
  token: string,
  runId: string,
  format: 'pdf' | 'html' | 'json' | 'csv'
) {
  const res = await fetch(`/api/reports/${runId}/download?format=${format}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    credentials: 'same-origin',
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

export async function downloadSqaReportApi(
  token: string,
  reportType: string,
  format: 'pdf' | 'html' | 'json' | 'csv',
  projectId?: string
) {
  const params = new URLSearchParams({ type: reportType, format });
  if (projectId && projectId !== 'all') params.set('projectId', projectId);
  const res = await fetch(`/api/reports/sqa/download?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'same-origin',
  });
  if (!res.ok) {
    throw new Error(`Failed to download SQA ${format.toUpperCase()} report.`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sqa-${reportType}-report.${format}`;
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
    credentials: 'same-origin',
  });
  if (!res.ok) throw new Error('Screenshot unavailable');
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
