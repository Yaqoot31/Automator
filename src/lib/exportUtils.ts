import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import type { AutomationProject, SqaDefect, SqaRequirement, TestCase } from '@/types';

export const TEST_CASE_SHEET_HEADERS = [
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
  'Framework',
  'Execution Date',
  'Comments',
];

export function mapTestCasesToRows(project: AutomationProject, testCases: TestCase[]): string[][] {
  const frameworks =
    project.selectedFrameworks && project.selectedFrameworks.length > 0
      ? project.selectedFrameworks.join(', ')
      : project.framework;

  return testCases.map((tc) => [
    tc.code,
    tc.module || tc.category,
    `${tc.title}${tc.scenario ? ` — ${tc.scenario}` : ''}`,
    tc.steps.map((s) => `${s.stepNumber}. [${s.action}] ${s.target} -> ${s.expected}`).join(' | '),
    tc.testData || 'N/A',
    tc.expectedResult,
    tc.actualResult || '',
    tc.sqaStatus ||
      (tc.status === 'passed'
        ? 'Pass'
        : tc.status === 'failed'
          ? 'Fail'
          : tc.status === 'blocked'
            ? 'Blocked'
            : 'Not Run'),
    tc.priority || 'Medium',
    tc.severity || 'Major',
    tc.automationStatus || 'Automated',
    frameworks,
    tc.executionDate || '',
    tc.comments || '',
  ]);
}

export function buildSummarySheetRows(project: AutomationProject, testCases: TestCase[]): (string | number)[][] {
  const total = testCases.length;
  const passed = testCases.filter((t) => t.status === 'passed' || t.sqaStatus === 'Pass').length;
  const failed = testCases.filter((t) => t.status === 'failed' || t.sqaStatus === 'Fail').length;
  const blocked = testCases.filter((t) => t.status === 'blocked' || t.sqaStatus === 'Blocked').length;
  const notRun = total - passed - failed - blocked;
  const automated = testCases.filter((t) => t.automationStatus !== 'Manual').length;
  const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;

  return [
    ['Automator AI — Test Case Summary Report', ''],
    ['Project Name', project.name],
    ['Target URL', project.url],
    ['Selected Stack(s)', (project.selectedFrameworks || [project.framework]).join(', ')],
    ['Generated Timestamp', new Date().toISOString()],
    ['', ''],
    ['Metric', 'Value'],
    ['Total Test Cases', total],
    ['Passed', passed],
    ['Failed', failed],
    ['Blocked', blocked],
    ['Not Run / Pending', notRun],
    ['Pass Rate (%)', `${passRate}%`],
    ['Automated Cases', automated],
    ['Manual Cases', total - automated],
  ];
}

export function downloadTestCasesExcel(project: AutomationProject): void {
  const wb = XLSX.utils.book_new();
  const rows = [TEST_CASE_SHEET_HEADERS, ...mapTestCasesToRows(project, project.testCases)];
  const wsCases = XLSX.utils.aoa_to_sheet(rows);
  wsCases['!cols'] = [
    { wch: 12 },
    { wch: 18 },
    { wch: 38 },
    { wch: 46 },
    { wch: 24 },
    { wch: 32 },
    { wch: 28 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 16 },
    { wch: 22 },
    { wch: 20 },
    { wch: 28 },
  ];
  XLSX.utils.book_append_sheet(wb, wsCases, 'Test Cases');

  const summaryRows = buildSummarySheetRows(project, project.testCases);
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary['!cols'] = [{ wch: 28 }, { wch: 44 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary Report');

  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const slug = project.name.replace(/[^a-zA-Z0-9_-]+/g, '-').toLowerCase() || 'test-cases';
  saveAs(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${slug}-test-cases.xlsx`);
}

export function downloadTestCasesCsv(project: AutomationProject): void {
  const csvEscape = (v: string) => `"${String(v || '').replace(/\r?\n/g, ' ').replace(/"/g, '""')}"`;
  const lines = [TEST_CASE_SHEET_HEADERS, ...mapTestCasesToRows(project, project.testCases)].map((r) =>
    r.map(csvEscape).join(',')
  );
  const slug = project.name.replace(/[^a-zA-Z0-9_-]+/g, '-').toLowerCase() || 'test-cases';
  saveAs(new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' }), `${slug}-test-cases.csv`);
}

export function downloadSqaWorkbookExcel(params: {
  projectName: string;
  projects: AutomationProject[];
  defects: SqaDefect[];
  requirements: SqaRequirement[];
}): void {
  const wb = XLSX.utils.book_new();
  const caseRows: string[][] = [TEST_CASE_SHEET_HEADERS];
  for (const p of params.projects) {
    caseRows.push(...mapTestCasesToRows(p, p.testCases));
  }
  const wsCases = XLSX.utils.aoa_to_sheet(caseRows);
  XLSX.utils.book_append_sheet(wb, wsCases, 'Test Cases');

  const defectRows = [
    ['Bug ID', 'Title', 'Severity', 'Priority', 'Status', 'Assigned Developer', 'Reported By', 'Linked Test Case', 'Updated At'],
    ...params.defects.map((d) => [
      d.bugCode,
      d.title,
      d.severity,
      d.priority,
      d.status,
      d.assignedDeveloper,
      d.reportedBy,
      d.linkedTestCaseId || '',
      d.updatedAt,
    ]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(defectRows), 'Defects');

  const rtmRows = [
    ['Requirement ID', 'Type', 'Module', 'Title', 'Priority', 'Linked Tests', 'Linked Defects', 'Coverage'],
    ...params.requirements.map((r) => [
      r.reqCode,
      r.type,
      r.module,
      r.title,
      r.priority,
      String(r.linkedTestCaseIds.length),
      String(r.linkedDefectIds.length),
      r.linkedTestCaseIds.length > 0 ? 'Covered' : 'Uncovered Gap',
    ]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rtmRows), 'RTM Traceability');

  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const slug = params.projectName.replace(/[^a-zA-Z0-9_-]+/g, '-').toLowerCase() || 'sqa-suite';
  saveAs(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${slug}-sqa-report.xlsx`);
}
