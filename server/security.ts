import crypto from 'node:crypto';
import dns from 'node:dns/promises';
import net from 'node:net';
import path from 'node:path';
import type { Request, Response, NextFunction } from 'express';
import type { UserRole } from '../src/types/index.js';

const SESSION_SECRET =
  process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16
    ? process.env.SESSION_SECRET
    : crypto.randomBytes(32).toString('hex');

const ENCRYPTION_KEY = crypto
  .createHash('sha256')
  .update(
    process.env.SECRETS_ENCRYPTION_KEY && process.env.SECRETS_ENCRYPTION_KEY.length >= 16
      ? process.env.SECRETS_ENCRYPTION_KEY
      : SESSION_SECRET
  )
  .digest();

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'ip6-localhost',
  'ip6-loopback',
  'metadata.google.internal',
  'metadata.goog',
  '169.254.169.254',
  '0.0.0.0',
]);

export function isPrivateOrReservedIp(ip: string): boolean {
  const cleanIp = ip.replace(/^::ffff:/i, '');
  const version = net.isIP(cleanIp);
  if (version === 4) {
    const parts = cleanIp.split('.').map(Number);
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
      return true;
    }
    const [a, b] = parts;
    if (a === 0) return true;
    if (a === 10) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 192 && b === 0 && parts[2] === 0) return true;
    if (a === 198 && (b === 18 || b === 19)) return true;
    if (a >= 224) return true;
    return false;
  }

  if (version === 6) {
    const lower = cleanIp.toLowerCase();
    if (lower === '::' || lower === '::1') return true;
    if (lower.startsWith('fe80:') || lower.startsWith('fec0:')) return true;
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
    if (lower.startsWith('ff')) return true;
    return false;
  }

  return true;
}

export interface ValidatedUrlResult {
  valid: boolean;
  url?: URL;
  error?: string;
}

export async function validatePublicUrl(rawInput: string): Promise<ValidatedUrlResult> {
  if (typeof rawInput !== 'string') {
    return { valid: false, error: 'URL must be a string.' };
  }
  const trimmed = rawInput.trim();
  if (!trimmed || trimmed.length > 2048) {
    return { valid: false, error: 'Please enter a valid URL (max 2048 characters).' };
  }

  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    return { valid: false, error: 'Malformed URL. Example: https://example.com' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { valid: false, error: 'Only http:// and https:// URLs are supported.' };
  }

  if (parsed.username || parsed.password) {
    return { valid: false, error: 'URLs with embedded credentials are not permitted.' };
  }

  const hostname = parsed.hostname.toLowerCase();
  if (
    BLOCKED_HOSTNAMES.has(hostname) ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.localhost')
  ) {
    return { valid: false, error: 'Access to local or internal hostnames is restricted.' };
  }

  if (net.isIP(hostname)) {
    if (isPrivateOrReservedIp(hostname)) {
      return { valid: false, error: 'Access to private or loopback IP addresses is restricted.' };
    }
    return { valid: true, url: parsed };
  }

  try {
    const records = await dns.lookup(hostname, { all: true });
    if (!records || records.length === 0) {
      return { valid: false, error: `Could not resolve hostname: ${hostname}` };
    }
    for (const rec of records) {
      if (isPrivateOrReservedIp(rec.address)) {
        return {
          valid: false,
          error: 'Target hostname resolves to a restricted private or internal network address.',
        };
      }
    }
  } catch {
    return { valid: false, error: `DNS lookup failed for ${hostname}. Verify the domain exists.` };
  }

  return { valid: true, url: parsed };
}

export function isQuickSafeSubrequestUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }
    const host = parsed.hostname.toLowerCase();
    if (
      BLOCKED_HOSTNAMES.has(host) ||
      host.endsWith('.local') ||
      host.endsWith('.internal') ||
      host.endsWith('.localhost')
    ) {
      return false;
    }
    if (net.isIP(host) && isPrivateOrReservedIp(host)) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function sanitizeText(value: unknown, maxLen = 500): string {
  if (typeof value !== 'string') return '';
  let out = '';
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (
      (code >= 0 && code <= 8) ||
      code === 11 ||
      code === 12 ||
      (code >= 14 && code <= 31) ||
      code === 127
    ) {
      continue;
    }
    out += value[i];
  }
  return out.trim().slice(0, maxLen);
}

export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash: derived, salt };
}

export function verifyPassword(password: string, storedHash: string, salt: string): boolean {
  try {
    const derived = crypto.scryptSync(password, salt, 64);
    const expected = Buffer.from(storedHash, 'hex');
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

export function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export function generateOneTimeCode(): string {
  // 8-char uppercase alphanumeric verification/reset code
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

export interface AuthTokenPayload {
  jti: string;
  userId: string;
  email: string;
  name: string;
  role: UserRole;
  exp: number;
}

export function signAuthToken(
  payload: Omit<AuthTokenPayload, 'exp' | 'jti'>,
  rememberMe = false
): string {
  const ttlMs = rememberMe
    ? 1000 * 60 * 60 * 24 * 30 // 30 days
    : 1000 * 60 * 60 * 24; // 24 hours
  const fullPayload: AuthTokenPayload = {
    ...payload,
    jti: crypto.randomUUID(),
    exp: Date.now() + ttlMs,
  };
  const data = Buffer.from(JSON.stringify(fullPayload), 'utf-8').toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}

export function verifyAuthToken(token: string): AuthTokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [data, sig] = parts;
    const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const parsed = JSON.parse(Buffer.from(data, 'base64url').toString('utf-8')) as AuthTokenPayload;
    if (!parsed.userId || !parsed.jti || !parsed.exp || parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export const SESSION_COOKIE_NAME = 'automator_session';

export function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(';')) {
    const eqIdx = part.indexOf('=');
    if (eqIdx <= 0) continue;
    const k = part.slice(0, eqIdx).trim();
    const v = part.slice(eqIdx + 1).trim();
    try {
      out[k] = decodeURIComponent(v);
    } catch {
      out[k] = v;
    }
  }
  return out;
}

export function setSessionCookie(res: Response, token: string, rememberMe: boolean): void {
  const maxAgeSec = rememberMe ? 60 * 60 * 24 * 30 : undefined;
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=None',
    'Partitioned',
  ];
  if (maxAgeSec !== undefined) {
    parts.push(`Max-Age=${maxAgeSec}`);
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}

export function clearSessionCookie(res: Response): void {
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=None; Partitioned; Max-Age=0`
  );
}

export function isSameOriginStateChange(req: Request): boolean {
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return true;
  if (req.headers['x-requested-with']) return true;
  const origin = req.headers.origin;
  const host = (req.headers['x-forwarded-host'] || req.headers.host || '').toString().split(',')[0].trim();
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function encryptSecrets(secrets: Record<string, string>): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  const json = JSON.stringify(secrets);
  const encrypted = Buffer.concat([cipher.update(json, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return JSON.stringify({
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: encrypted.toString('base64'),
  });
}

export function decryptSecrets(payload: string): Record<string, string> {
  try {
    if (!payload) return {};
    const parsed = JSON.parse(payload) as { iv: string; tag: string; data: string };
    if (!parsed.iv || !parsed.tag || !parsed.data) return {};
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      ENCRYPTION_KEY,
      Buffer.from(parsed.iv, 'base64')
    );
    decipher.setAuthTag(Buffer.from(parsed.tag, 'base64'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(parsed.data, 'base64')),
      decipher.final(),
    ]);
    return JSON.parse(decrypted.toString('utf8')) as Record<string, string>;
  } catch {
    return {};
  }
}

export function maskSecretValue(val: string): string {
  if (!val) return '';
  if (val.length <= 4) return '••••';
  return `${val.slice(0, 2)}${'•'.repeat(Math.min(8, val.length - 4))}${val.slice(-2)}`;
}

export function resolveSafePath(baseDir: string, relativeTarget: string): string | null {
  const base = path.resolve(baseDir);
  const target = path.resolve(base, relativeTarget);
  if (!target.startsWith(base + path.sep)) {
    return null;
  }
  return target;
}

export function createRateLimiter(maxRequests: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const recent = (hits.get(key) || []).filter((t) => now - t < windowMs);
    if (recent.length >= maxRequests) {
      res.status(429).json({
        error: 'Rate limit exceeded. Please wait before submitting additional requests.',
      });
      return;
    }
    recent.push(now);
    hits.set(key, recent);
    next();
  };
}

// Brute-force lockout tracker per email+IP
const loginFailures = new Map<string, { count: number; lockedUntil: number }>();
const MAX_LOGIN_ATTEMPTS = 6;
const LOCKOUT_MS = 10 * 60 * 1000; // 10 minutes

export function checkLoginLockout(email: string, ip: string): { locked: boolean; retryAfterSec: number } {
  const key = `${ip}:${email.toLowerCase()}`;
  const entry = loginFailures.get(key);
  if (!entry) return { locked: false, retryAfterSec: 0 };
  if (entry.lockedUntil > Date.now()) {
    return { locked: true, retryAfterSec: Math.ceil((entry.lockedUntil - Date.now()) / 1000) };
  }
  if (entry.lockedUntil > 0 && entry.lockedUntil <= Date.now()) {
    loginFailures.delete(key);
  }
  return { locked: false, retryAfterSec: 0 };
}

export function recordLoginFailure(email: string, ip: string): void {
  const key = `${ip}:${email.toLowerCase()}`;
  const current = loginFailures.get(key) || { count: 0, lockedUntil: 0 };
  const nextCount = current.count + 1;
  loginFailures.set(key, {
    count: nextCount,
    lockedUntil: nextCount >= MAX_LOGIN_ATTEMPTS ? Date.now() + LOCKOUT_MS : 0,
  });
}

export function clearLoginFailures(email: string, ip: string): void {
  const key = `${ip}:${email.toLowerCase()}`;
  loginFailures.delete(key);
}
