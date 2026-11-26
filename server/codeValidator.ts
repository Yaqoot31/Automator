import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import ts from 'typescript';
import type { CodeDiagnostic, ProjectFile } from '../src/types/index.js';

const execFileAsync = promisify(execFile);

export async function validateProjectCode(
  language: ProjectFile['language'],
  code: string
): Promise<{ valid: boolean; diagnostics: CodeDiagnostic[] }> {
  const diagnostics: CodeDiagnostic[] = [];

  if (!code.trim()) {
    diagnostics.push({ line: 1, severity: 'warning', message: 'File is empty.' });
    return { valid: false, diagnostics };
  }

  if (language === 'json') {
    try {
      JSON.parse(code);
      return { valid: true, diagnostics: [] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Invalid JSON';
      diagnostics.push({ line: 1, severity: 'error', message: msg });
      return { valid: false, diagnostics };
    }
  }

  if (language === 'javascript' || language === 'typescript') {
    const isTs = language === 'typescript';
    const sourceFile = ts.createSourceFile(
      isTs ? 'script.ts' : 'script.mjs',
      code,
      ts.ScriptTarget.ES2022,
      true,
      isTs ? ts.ScriptKind.TS : ts.ScriptKind.JS
    );
    const parseDiags =
      (sourceFile as unknown as { parseDiagnostics?: ts.Diagnostic[] }).parseDiagnostics || [];
    for (const d of parseDiags) {
      const pos = d.start ?? 0;
      const { line } = sourceFile.getLineAndCharacterOfPosition(pos);
      diagnostics.push({
        line: line + 1,
        severity: 'error',
        message: ts.flattenDiagnosticMessageText(d.messageText, ' '),
      });
    }
  }

  if (language === 'python') {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pycheck-'));
    const tmpFile = path.join(tmpDir, 'check.py');
    try {
      await fs.writeFile(tmpFile, code, 'utf8');
      await execFileAsync('python3', ['-m', 'py_compile', tmpFile], {
        timeout: 3000,
      });
    } catch (err) {
      const stderr = (err as { stderr?: string })?.stderr || (err instanceof Error ? err.message : 'Python syntax error');
      const lineMatch = stderr.match(/line (\d+)/i);
      diagnostics.push({
        line: lineMatch ? Number(lineMatch[1]) : 1,
        severity: 'error',
        message: stderr.split('\n').slice(-2).join(' ').trim(),
      });
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  if (language === 'java') {
    const openBraces = (code.match(/\{/g) || []).length;
    const closeBraces = (code.match(/\}/g) || []).length;
    if (openBraces !== closeBraces) {
      diagnostics.push({
        line: code.split('\n').length,
        severity: 'error',
        message: `Unbalanced curly braces (${openBraces} '{' vs ${closeBraces} '}').`,
      });
    }
    if (!/\bclass\s+\w+/.test(code)) {
      diagnostics.push({
        line: 1,
        severity: 'warning',
        message: 'Java file does not declare a top-level class.',
      });
    }
  }

  // Common QA security & best-practice warnings
  const lines = code.split('\n');
  lines.forEach((lineText, idx) => {
    if (/Thread\.sleep\(|cy\.wait\(\d{4,}\)|time\.sleep\(/.test(lineText)) {
      diagnostics.push({
        line: idx + 1,
        severity: 'warning',
        message: 'Hardcoded sleep detected — prefer explicit WebDriverWait / Cypress assertions.',
      });
    }
  });

  const hasErrors = diagnostics.some((d) => d.severity === 'error');
  return { valid: !hasErrors, diagnostics };
}
