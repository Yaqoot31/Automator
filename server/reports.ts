import PDFDocument from 'pdfkit';
import type {
  AutomationProject,
  SqaDefect,
  SqaRelease,
  SqaRequirement,
  SqaTestPlan,
  SqaTestSuite,
  TestRunRecord,
} from '../src/types/index.js';

export type SqaReportType =
  | 'execution'
  | 'summary'
  | 'test-cases'
  | 'defects'
  | 'automation'
  | 'regression'
  | 'browser-compat'
  | 'responsive'
  | 'release-readiness'
  | 'project-quality';

export interface SqaReportBundle {
  reportType: SqaReportType;
  projects: AutomationProject[];
  runs: TestRunRecord[];
  defects: SqaDefect[];
  plans: SqaTestPlan[];
  suites: SqaTestSuite[];
  requirements: SqaRequirement[];
  releases: SqaRelease[];
}

function escapeHtml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function csvCell(val: unknown): string {
  const s = String(val ?? '').replace(/\r?\n/g, ' ');
  return `"${s.replace(/"/g, '""')}"`;
}

export function buildJsonReport(run: TestRunRecord, project?: AutomationProject | null): string {
  const passRate = run.totalTests > 0 ? Math.round((run.passed / run.totalTests) * 100) : 0;
  // Never include secrets in reports
  const sanitized = {
    reportGeneratedAt: new Date().toISOString(),
    runId: run.id,
    projectId: run.projectId,
    projectName: run.projectName,
    targetUrl: project?.url || '',
    framework: project?.framework || '',
    language: project?.language || '',
    browser: run.browser,
    viewport: run.viewport,
    headless: run.headless,
    status: run.status,
    metrics: {
      totalTests: run.totalTests,
      passed: run.passed,
      failed: run.failed,
      skipped: run.skipped,
      successPercentage: passRate,
      durationMs: run.durationMs,
    },
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    results: run.results,
    logs: run.logs,
  };
  return JSON.stringify(sanitized, null, 2);
}

export function buildCsvReport(run: TestRunRecord): string {
  const header = ['Run ID', 'Project', 'Test Case ID', 'Title', 'Category', 'Status', 'Duration (ms)', 'Actual Result', 'Error'];
  const rows = run.results.map((r) => [
    run.id,
    run.projectName,
    r.code,
    r.title,
    r.category,
    r.status.toUpperCase(),
    r.durationMs,
    r.actualResult,
    r.errorMessage || '',
  ]);
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
}

export function buildHtmlReport(run: TestRunRecord, project?: AutomationProject | null): string {
  const passRate = run.totalTests > 0 ? Math.round((run.passed / run.totalTests) * 100) : 0;
  const rows = run.results
    .map(
      (r) => `
      <tr>
        <td style="font-family:monospace;">${escapeHtml(r.code)}</td>
        <td>${escapeHtml(r.title)}</td>
        <td>${escapeHtml(r.category)}</td>
        <td style="font-weight:600;color:${
          r.status === 'passed' ? '#16a34a' : r.status === 'failed' ? '#dc2626' : '#d97706'
        };">${escapeHtml(r.status.toUpperCase())}</td>
        <td style="font-family:monospace;">${r.durationMs}ms</td>
        <td>${escapeHtml(r.actualResult)}</td>
      </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Automation Report — ${escapeHtml(run.projectName)}</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background: #f8fafc; color: #0f172a; margin: 0; padding: 32px; }
    .container { max-width: 1080px; margin: 0 auto; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 32px; }
    h1 { margin: 0 0 8px; font-size: 24px; }
    .meta { color: #475569; font-size: 13px; margin-bottom: 24px; }
    .grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 28px; }
    .stat { border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; }
    .stat-label { font-size: 12px; color: #64748b; }
    .stat-val { font-size: 22px; font-weight: 700; margin-top: 4px; font-variant-numeric: tabular-nums; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
    th { background: #f1f5f9; font-weight: 600; color: #334155; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Automation Execution Report: ${escapeHtml(run.projectName)}</h1>
    <div class="meta">
      Target: ${escapeHtml(project?.url || 'N/A')} &middot;
      Framework: ${escapeHtml(project?.framework || 'N/A')} &middot;
      Browser: ${escapeHtml(run.browser)} (${escapeHtml(run.viewport)}) &middot;
      Executed: ${escapeHtml(run.startedAt)}
    </div>
    <div class="grid">
      <div class="stat"><div class="stat-label">Total</div><div class="stat-val">${run.totalTests}</div></div>
      <div class="stat"><div class="stat-label">Passed</div><div class="stat-val" style="color:#16a34a;">${run.passed}</div></div>
      <div class="stat"><div class="stat-label">Failed</div><div class="stat-val" style="color:#dc2626;">${run.failed}</div></div>
      <div class="stat"><div class="stat-label">Pass Rate</div><div class="stat-val">${passRate}%</div></div>
      <div class="stat"><div class="stat-label">Duration</div><div class="stat-val">${(run.durationMs / 1000).toFixed(2)}s</div></div>
    </div>
    <table>
      <thead>
        <tr><th>Code</th><th>Test Case</th><th>Category</th><th>Status</th><th>Duration</th><th>Actual Result</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
</body>
</html>`;
}

export async function buildPdfReport(
  run: TestRunRecord,
  project?: AutomationProject | null
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 42, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const passRate = run.totalTests > 0 ? Math.round((run.passed / run.totalTests) * 100) : 0;

    doc.fontSize(18).font('Helvetica-Bold').text(`Automation Report: ${run.projectName}`);
    doc.moveDown(0.3);
    doc
      .fontSize(10)
      .font('Helvetica')
      .fillColor('#475569')
      .text(
        `Target: ${project?.url || 'N/A'} | Framework: ${project?.framework || 'N/A'} | Browser: ${run.browser} (${run.viewport})`
      );
    doc.text(`Run ID: ${run.id} | Started: ${run.startedAt}`);
    doc.moveDown(1);

    doc.fillColor('#0f172a').fontSize(12).font('Helvetica-Bold').text('Execution Summary');
    doc.moveDown(0.3);
    doc
      .fontSize(10)
      .font('Helvetica')
      .text(
        `Total: ${run.totalTests}   |   Passed: ${run.passed}   |   Failed: ${run.failed}   |   Skipped: ${run.skipped}   |   Success Rate: ${passRate}%   |   Duration: ${(run.durationMs / 1000).toFixed(2)}s`
      );
    doc.moveDown(1);

    doc.fontSize(12).font('Helvetica-Bold').text('Test Case Results');
    doc.moveDown(0.5);

    for (const r of run.results) {
      if (doc.y > 730) doc.addPage();
      doc
        .fontSize(10)
        .font('Helvetica-Bold')
        .fillColor(r.status === 'passed' ? '#16a34a' : r.status === 'failed' ? '#dc2626' : '#d97706')
        .text(`[${r.status.toUpperCase()}] ${r.code} — ${r.title}`);
      doc
        .fontSize(9)
        .font('Helvetica')
        .fillColor('#334155')
        .text(`Category: ${r.category} | Duration: ${r.durationMs}ms | Result: ${r.actualResult}`);
      doc.moveDown(0.45);
    }

    doc.end();
  });
}

// Comprehensive SQA Report Builders across all 10 report categories

const REPORT_TITLES: Record<SqaReportType, string> = {
  execution: 'Test Execution Report',
  summary: 'Executive SQA Summary Report',
  'test-cases': 'Test Case Repository & Traceability Report',
  defects: 'Defect & Bug Lifecycle Report',
  automation: 'Automation Coverage & Multi-Language Report',
  regression: 'Regression Suite Verification Report',
  'browser-compat': 'Browser Compatibility Report',
  responsive: 'Responsive Viewport Readiness Report',
  'release-readiness': 'Release Readiness & Sign-off Report',
  'project-quality': 'Project Quality Scorecard Report',
};

function computeSqaMetrics(bundle: SqaReportBundle) {
  const allCases = bundle.projects.flatMap((p) =>
    p.testCases.map((tc) => ({ ...tc, projectName: p.name }))
  );
  const totalCases = allCases.length;
  const automatedCases = allCases.filter((tc) => tc.automationStatus !== 'Manual').length;
  const manualCases = totalCases - automatedCases;
  const passedCases = allCases.filter((tc) => tc.status === 'passed' || tc.sqaStatus === 'Pass').length;
  const failedCases = allCases.filter((tc) => tc.status === 'failed' || tc.sqaStatus === 'Fail').length;
  const blockedCases = allCases.filter((tc) => tc.status === 'blocked' || tc.sqaStatus === 'Blocked').length;
  const passRate = totalCases > 0 ? Math.round((passedCases / totalCases) * 100) : 0;
  const automationCoverage = totalCases > 0 ? Math.round((automatedCases / totalCases) * 100) : 0;
  const openDefects = bundle.defects.filter((d) => d.status !== 'Closed').length;
  const criticalDefects = bundle.defects.filter((d) => d.severity === 'Critical' && d.status !== 'Closed').length;
  const coveredReqs = bundle.requirements.filter((r) => r.linkedTestCaseIds.length > 0).length;
  const reqCoverage = bundle.requirements.length > 0 ? Math.round((coveredReqs / bundle.requirements.length) * 100) : 0;

  return {
    allCases,
    totalCases,
    automatedCases,
    manualCases,
    passedCases,
    failedCases,
    blockedCases,
    passRate,
    automationCoverage,
    openDefects,
    criticalDefects,
    coveredReqs,
    reqCoverage,
  };
}

export function buildSqaReportJson(bundle: SqaReportBundle): string {
  const m = computeSqaMetrics(bundle);
  return JSON.stringify(
    {
      reportType: bundle.reportType,
      title: REPORT_TITLES[bundle.reportType],
      generatedAt: new Date().toISOString(),
      summary: {
        projects: bundle.projects.length,
        totalTestCases: m.totalCases,
        automatedTestCases: m.automatedCases,
        manualTestCases: m.manualCases,
        passedTestCases: m.passedCases,
        failedTestCases: m.failedCases,
        blockedTestCases: m.blockedCases,
        passRatePercentage: m.passRate,
        automationCoveragePercentage: m.automationCoverage,
        totalRuns: bundle.runs.length,
        totalDefects: bundle.defects.length,
        openDefects: m.openDefects,
        criticalOpenDefects: m.criticalDefects,
        requirementsCount: bundle.requirements.length,
        requirementsCoveragePercentage: m.reqCoverage,
        releasesCount: bundle.releases.length,
      },
      projects: bundle.projects.map((p) => ({
        id: p.id,
        name: p.name,
        url: p.url,
        framework: p.framework,
        selectedFrameworks: p.selectedFrameworks || [p.framework],
        testCasesCount: p.testCases.length,
      })),
      defects: bundle.defects,
      releases: bundle.releases,
      requirements: bundle.requirements,
      plans: bundle.plans,
      suites: bundle.suites,
      recentRuns: bundle.runs.slice(0, 20).map((r) => ({
        id: r.id,
        projectName: r.projectName,
        browser: r.browser,
        status: r.status,
        passed: r.passed,
        failed: r.failed,
        totalTests: r.totalTests,
        startedAt: r.startedAt,
      })),
    },
    null,
    2
  );
}

export function buildSqaReportCsv(bundle: SqaReportBundle): string {
  if (bundle.reportType === 'defects') {
    const header = ['Bug ID', 'Title', 'Severity', 'Priority', 'Status', 'Assigned Developer', 'Reported By', 'Linked Test Case', 'Updated At'];
    const rows = bundle.defects.map((d) => [
      d.bugCode,
      d.title,
      d.severity,
      d.priority,
      d.status,
      d.assignedDeveloper,
      d.reportedBy,
      d.linkedTestCaseId || '',
      d.updatedAt,
    ]);
    return [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\n');
  }
  if (bundle.reportType === 'release-readiness') {
    const header = ['Version', 'Release Name', 'Build', 'Environment', 'Target Date', 'Build Verified', 'Readiness', 'Approval', 'Approved By'];
    const rows = bundle.releases.map((rel) => [
      rel.version,
      rel.name,
      rel.buildNumber,
      rel.environment,
      rel.targetDate,
      rel.buildVerified ? 'Yes' : 'No',
      rel.readinessStatus,
      rel.approvalStatus,
      rel.approvedBy || '',
    ]);
    return [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\n');
  }
  const header = [
    'Project',
    'Test Case ID',
    'Module',
    'Test Scenario',
    'Test Steps',
    'Test Data',
    'Expected Result',
    'Actual Result',
    'Status',
    'Priority',
    'Severity',
    'Automation Status',
    'Execution Date',
    'Comments',
  ];
  const rows = bundle.projects.flatMap((p) =>
    p.testCases.map((tc) => [
      p.name,
      tc.code,
      tc.module || tc.category,
      tc.scenario || tc.title,
      tc.steps.map((s) => `${s.stepNumber}. ${s.action} ${s.target}`).join(' | '),
      tc.testData || '',
      tc.expectedResult,
      tc.actualResult || '',
      tc.sqaStatus || tc.status,
      tc.priority || 'Medium',
      tc.severity || 'Major',
      tc.automationStatus || 'Automated',
      tc.executionDate || '',
      tc.comments || '',
    ])
  );
  return [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\n');
}

export function buildSqaReportHtml(bundle: SqaReportBundle): string {
  const m = computeSqaMetrics(bundle);
  const title = REPORT_TITLES[bundle.reportType];
  const defectRows = bundle.defects
    .slice(0, 40)
    .map(
      (d) => `<tr><td>${escapeHtml(d.bugCode)}</td><td>${escapeHtml(d.title)}</td><td>${escapeHtml(d.severity)}</td><td>${escapeHtml(d.status)}</td><td>${escapeHtml(d.assignedDeveloper || 'Unassigned')}</td></tr>`
    )
    .join('');
  const caseRows = m.allCases
    .slice(0, 60)
    .map(
      (tc) => `<tr><td>${escapeHtml(tc.code)}</td><td>${escapeHtml(tc.projectName)}</td><td>${escapeHtml(tc.title)}</td><td>${escapeHtml(tc.priority || 'Medium')}</td><td>${escapeHtml(tc.automationStatus || 'Automated')}</td><td>${escapeHtml(tc.sqaStatus || tc.status)}</td></tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #f8fafc; color: #0f172a; margin: 0; padding: 32px; }
    .wrap { max-width: 1120px; margin: 0 auto; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 32px; }
    .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 20px 0 28px; }
    .kpi { border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; }
    .kpi small { color: #64748b; display: block; font-size: 12px; }
    .kpi strong { font-size: 22px; font-variant-numeric: tabular-nums; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 24px; }
    th, td { padding: 9px 12px; border-bottom: 1px solid #e2e8f0; text-align: left; }
    th { background: #f1f5f9; color: #334155; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>${escapeHtml(title)}</h1>
    <p style="color:#475569;font-size:13px;">Generated ${escapeHtml(new Date().toISOString())} &middot; Projects: ${bundle.projects.length}</p>
    <div class="kpis">
      <div class="kpi"><small>Total Test Cases</small><strong>${m.totalCases}</strong></div>
      <div class="kpi"><small>Pass Rate</small><strong>${m.passRate}%</strong></div>
      <div class="kpi"><small>Automation Coverage</small><strong>${m.automationCoverage}%</strong></div>
      <div class="kpi"><small>Open Defects (Critical)</small><strong>${m.openDefects} (${m.criticalDefects})</strong></div>
    </div>
    <h2>Test Cases (${m.allCases.length})</h2>
    <table><thead><tr><th>Code</th><th>Project</th><th>Title</th><th>Priority</th><th>Mode</th><th>Status</th></tr></thead><tbody>${caseRows || '<tr><td colspan="6">No test cases recorded.</td></tr>'}</tbody></table>
    <h2>Defects (${bundle.defects.length})</h2>
    <table><thead><tr><th>ID</th><th>Title</th><th>Severity</th><th>Status</th><th>Assignee</th></tr></thead><tbody>${defectRows || '<tr><td colspan="5">No defects logged.</td></tr>'}</tbody></table>
  </div>
</body>
</html>`;
}

export async function buildSqaReportPdf(bundle: SqaReportBundle): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const m = computeSqaMetrics(bundle);
    const doc = new PDFDocument({ margin: 42, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(18).font('Helvetica-Bold').text(REPORT_TITLES[bundle.reportType]);
    doc.moveDown(0.3);
    doc
      .fontSize(10)
      .font('Helvetica')
      .fillColor('#475569')
      .text(`Generated: ${new Date().toISOString()} | Projects: ${bundle.projects.length} | Test Runs: ${bundle.runs.length}`);
    doc.moveDown(0.8);

    doc.fillColor('#0f172a').fontSize(12).font('Helvetica-Bold').text('Quality Metrics Overview');
    doc.moveDown(0.3);
    doc
      .fontSize(10)
      .font('Helvetica')
      .text(
        `Test Cases: ${m.totalCases} (Auto: ${m.automatedCases}, Manual: ${m.manualCases}) | Pass Rate: ${m.passRate}% | Automation Coverage: ${m.automationCoverage}%`
      );
    doc.text(
      `Defects: ${bundle.defects.length} total (${m.openDefects} open, ${m.criticalDefects} critical) | RTM Coverage: ${m.reqCoverage}% | Releases: ${bundle.releases.length}`
    );
    doc.moveDown(1);

    doc.fontSize(12).font('Helvetica-Bold').text('Project Quality Breakdown');
    doc.moveDown(0.4);
    for (const p of bundle.projects) {
      if (doc.y > 730) doc.addPage();
      const fwList = (p.selectedFrameworks && p.selectedFrameworks.length > 0 ? p.selectedFrameworks : [p.framework]).join(', ');
      doc.fontSize(10).font('Helvetica-Bold').text(`${p.name} (${p.url})`);
      doc.fontSize(9).font('Helvetica').fillColor('#334155').text(`Stacks: ${fwList} | Cases: ${p.testCases.length}`);
      doc.moveDown(0.35);
      doc.fillColor('#0f172a');
    }

    if (bundle.defects.length > 0) {
      doc.moveDown(0.5);
      doc.fontSize(12).font('Helvetica-Bold').text('Logged Defects');
      doc.moveDown(0.3);
      for (const d of bundle.defects.slice(0, 30)) {
        if (doc.y > 730) doc.addPage();
        doc.fontSize(9.5).font('Helvetica-Bold').text(`[${d.status}] ${d.bugCode}: ${d.title}`);
        doc
          .fontSize(8.5)
          .font('Helvetica')
          .fillColor('#475569')
          .text(`Severity: ${d.severity} | Priority: ${d.priority} | Assignee: ${d.assignedDeveloper || 'Unassigned'}`);
        doc.fillColor('#0f172a').moveDown(0.25);
      }
    }

    doc.end();
  });
}
