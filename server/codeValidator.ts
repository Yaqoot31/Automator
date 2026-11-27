import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import type { CodeDiagnostic, ProjectFile } from '../src/types/index.js';

const execFileAsync = promisify(execFile);

function checkBalancedDelimiters(code: string, diagnostics: CodeDiagnostic[]) {
  const stack: { ch: string; line: number }[] = [];
  const pairs: Record<string, string> = { '(': ')', '[': ']', '{': '}' };
  const closing: Record<string, string> = { ')': '(', ']': '[', '}': '{' };

  const lines = code.split('\n');
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const text = lines[lineIdx];
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const prev = i > 0 ? text[i - 1] : '';
      if (prev === '\\') continue;
      if (!inDouble && !inTemplate && ch === "'" ) {
        inSingle = !inSingle;
        continue;
      }
      if (!inSingle && !inTemplate && ch === '"') {
        inDouble = !inDouble;
        continue;
      }
      if (!inSingle && !inDouble && ch === '`') {
        inTemplate = !inTemplate;
        continue;
      }
      if (inSingle || inDouble || inTemplate) continue;
      if (ch === '/' && text[i + 1] === '/') break;

      if (pairs[ch]) {
        stack.push({ ch, line: lineIdx + 1 });
      } else if (closing[ch]) {
        const last = stack.pop();
        if (!last || last.ch !== closing[ch]) {
          diagnostics.push({
            line: lineIdx + 1,
            severity: 'error',
            message: `Unexpected closing delimiter '${ch}'.`,
          });
          return;
        }
      }
    }
  }

  if (stack.length > 0) {
    const unclosed = stack[stack.length - 1];
    diagnostics.push({
      line: unclosed.line,
      severity: 'error',
      message: `Unclosed '${unclosed.ch}' delimiter.`,
    });
  }
}

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
    try {
      const tsPkg = 'typescript';
      const tsModule = (await import(/* @vite-ignore */ tsPkg)) as {
        default?: typeof import('typescript');
      } & typeof import('typescript');
      const ts = tsModule.default || tsModule;
      const isTs = language === 'typescript';
      const sourceFile = ts.createSourceFile(
        isTs ? 'script.ts' : 'script.mjs',
        code,
        ts.ScriptTarget.ES2022,
        true,
        isTs ? ts.ScriptKind.TS : ts.ScriptKind.JS
      );
      const parseDiags =
        (sourceFile as unknown as { parseDiagnostics?: Array<{ start?: number; messageText: unknown }> }).parseDiagnostics || [];
      for (const d of parseDiags) {
        const pos = d.start ?? 0;
        const { line } = sourceFile.getLineAndCharacterOfPosition(pos);
        diagnostics.push({
          line: line + 1,
          severity: 'error',
          message: ts.flattenDiagnosticMessageText(
            d.messageText as string | import('typescript').DiagnosticMessageChain,
            ' '
          ),
        });
      }
    } catch {
      checkBalancedDelimiters(code, diagnostics);
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
      const codeErr = (err as { code?: string })?.code;
      if (codeErr === 'ENOENT') {
        diagnostics.push({
          line: 1,
          severity: 'warning',
          message: 'python3 binary is unavailable in this runtime; structural delimiter check applied.',
        });
        checkBalancedDelimiters(code, diagnostics);
      } else {
        const stderr = (err as { stderr?: string })?.stderr || (err instanceof Error ? err.message : 'Python syntax error');
        const lineMatch = stderr.match(/line (\d+)/i);
        diagnostics.push({
          line: lineMatch ? Number(lineMatch[1]) : 1,
          severity: 'error',
          message: stderr.split('\n').slice(-2).join(' ').trim(),
        });
      }
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
