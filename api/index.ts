import type { IncomingMessage, ServerResponse } from 'node:http';
import type express from 'express';
import { createExpressApp } from '../server.js';

let appPromise: Promise<express.Express> | null = null;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (!appPromise) {
    appPromise = createExpressApp();
  }
  const app = await appPromise;

  const rawUrl = req.url || '/api';
  if (rawUrl.startsWith('/api/index') || rawUrl.includes('__path=')) {
    const parsed = new URL(rawUrl, 'http://localhost');
    const subPath = parsed.searchParams.get('__path') || '';
    parsed.searchParams.delete('__path');
    const qs = parsed.searchParams.toString();
    req.url = `/api/${subPath.replace(/^\/+/, '')}${qs ? `?${qs}` : ''}`;
  }

  return app(req as Parameters<express.Express>[0], res as Parameters<express.Express>[1]);
}
