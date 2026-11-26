import { GoogleGenAI, Type } from '@google/genai';
import type { AutomationProject, TestCase, TestRunRecord } from '../src/types/index.js';

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    throw new Error(
      'GEMINI_API_KEY is not configured. Add your Gemini API key in Settings > Secrets to use the AI Automation Assistant.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function buildProjectContextSummary(
  project: AutomationProject,
  activeFilePath?: string,
  activeFileContent?: string,
  latestRun?: TestRunRecord | null
): string {
  const pagesSummary = (project.analysis?.pages || [])
    .slice(0, 5)
    .map(
      (p) =>
        `- ${p.path} (${p.archetype}, title="${p.title}", buttons=${p.elementCounts.buttons}, inputs=${p.elementCounts.inputs}, links=${p.elementCounts.links}, forms=${p.elementCounts.forms}, dropdowns=${p.elementCounts.dropdowns}, tables=${p.elementCounts.tables})\n  Sample locators: ${p.elements
          .slice(0, 8)
          .map((e) => `${e.category}:${e.locator}`)
          .join(', ')}`
    )
    .join('\n');

  const testsSummary = project.testCases
    .slice(0, 12)
    .map((tc) => `- ${tc.code} [${tc.category}/${tc.scenarioType}] ${tc.title} (status=${tc.status})`)
    .join('\n');

  const runSummary = latestRun
    ? `Latest Run (${latestRun.browser}, ${latestRun.viewport}): ${latestRun.passed}/${latestRun.totalTests} passed, ${latestRun.failed} failed, ${latestRun.durationMs}ms.\nFailures: ${latestRun.results
        .filter((r) => r.status === 'failed')
        .map((r) => `${r.code}: ${r.errorMessage || r.actualResult}`)
        .join(' | ') || 'None'}`
    : 'No execution runs recorded yet.';

  return `Project: ${project.name}
Target URL: ${project.url}
Selected Tool/Language/Framework: ${project.tool} / ${project.language} / ${project.framework} (Approach: ${project.approach})

Discovered Pages & DOM Elements:
${pagesSummary || 'No DOM pages analyzed yet.'}

Test Cases (${project.testCases.length} total):
${testsSummary || 'None'}

Execution Telemetry:
${runSummary}
${
  activeFilePath && activeFileContent
    ? `\nCurrently Open Editor File (${activeFilePath}):\n\`\`\`\n${activeFileContent.slice(0, 3500)}\n\`\`\``
    : ''
}`;
}

export async function askAiAutomationAssistant(params: {
  project: AutomationProject;
  prompt: string;
  history: { role: 'user' | 'assistant'; content: string }[];
  activeFilePath?: string;
  activeFileContent?: string;
  latestRun?: TestRunRecord | null;
}): Promise<{
  reply: string;
  codeBlocks: { language: string; filename?: string; code: string }[];
}> {
  const ai = getGeminiClient();
  const contextBlock = buildProjectContextSummary(
    params.project,
    params.activeFilePath,
    params.activeFileContent,
    params.latestRun
  );

  const historyText = params.history
    .slice(-8)
    .map((m) => `${m.role === 'user' ? 'Engineer' : 'Assistant'}: ${m.content}`)
    .join('\n\n');

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: `${historyText ? `Previous Conversation:\n${historyText}\n\n` : ''}Current Project Context:\n${contextBlock}\n\nEngineer Request: ${params.prompt}`,
    config: {
      systemInstruction:
        'You are a Principal QA Automation Architect specializing in Selenium WebDriver (Java TestNG/JUnit, JavaScript, TypeScript, Python Pytest) and Cypress (JavaScript, TypeScript). Always provide production-ready Page Object Model code grounded in the discovered DOM locators from the project context. Never hardcode real credentials; use environment variables. Wrap code in fenced markdown code blocks with the language identifier (e.g. ```java, ```python, ```typescript, ```javascript). Keep explanations crisp, actionable, and accurate.',
    },
  });

  const reply = response.text?.trim();
  if (!reply) {
    throw new Error('Gemini returned an empty response. Please try again.');
  }

  const codeBlocks: { language: string; filename?: string; code: string }[] = [];
  const regex = /```([a-zA-Z0-9_-]+)?(?:\s+([^\n]+))?\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(reply)) !== null) {
    codeBlocks.push({
      language: (match[1] || 'text').toLowerCase(),
      filename: match[2]?.trim(),
      code: match[3].trim(),
    });
  }

  return { reply, codeBlocks };
}

export async function generateAiExtraTestCases(
  project: AutomationProject,
  focusPrompt?: string
): Promise<Omit<TestCase, 'id' | 'code' | 'status' | 'enabled'>[]> {
  if (!project.analysis || project.analysis.pages.length === 0) {
    throw new Error('Analyze a website URL first before generating AI test cases.');
  }

  const ai = getGeminiClient();
  const context = buildProjectContextSummary(project);

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: `Based on this analyzed website:\n${context}\n\nGenerate 4 high-value negative, boundary, and exploratory test cases${
      focusPrompt ? ` focusing on: ${focusPrompt}` : ''
    }. Use only valid CSS locators present in the discovered elements or standard semantic tags like body, title, input, form.`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            category: { type: Type.STRING },
            scenarioType: { type: Type.STRING },
            pagePath: { type: Type.STRING },
            scenario: { type: Type.STRING },
            preconditions: { type: Type.STRING },
            expectedResult: { type: Type.STRING },
            targetLocator: { type: Type.STRING },
          },
          required: ['title', 'category', 'scenarioType', 'pagePath', 'scenario', 'preconditions', 'expectedResult', 'targetLocator'],
        },
      },
    },
  });

  const rawJson = (response.text || '[]').trim();
  const parsed = JSON.parse(rawJson) as Array<{
    title: string;
    category: string;
    scenarioType: string;
    pagePath: string;
    scenario: string;
    preconditions: string;
    expectedResult: string;
    targetLocator: string;
  }>;

  const rootUrl = project.analysis.pages[0].url;
  return parsed.slice(0, 6).map((item) => ({
    title: item.title,
    category: 'validation',
    scenarioType:
      item.scenarioType === 'negative' ||
      item.scenarioType === 'boundary' ||
      item.scenarioType === 'exploratory'
        ? item.scenarioType
        : 'negative',
    pagePath: item.pagePath || '/',
    scenario: item.scenario,
    preconditions: item.preconditions,
    expectedResult: item.expectedResult,
    steps: [
      { stepNumber: 1, action: 'navigate', target: rootUrl, expected: 'Page loads' },
      {
        stepNumber: 2,
        action: 'assert_visible',
        target: item.targetLocator || 'body',
        expected: item.expectedResult,
      },
    ],
  }));
}
