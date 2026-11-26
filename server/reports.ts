import PDFDocument from 'pdfkit';
import type { AutomationProject, TestRunRecord } from '../src/types/index.js';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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
