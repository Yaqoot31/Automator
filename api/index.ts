import type { IncomingMessage, ServerResponse } from 'node:http';
import type express from 'express';
import { createExpressApp } from '../server/app.js';

let appPromise: Promise<express.Express> | null = null;

async function getApp(): Promise<express.Express> {
  if (!appPromise) {
    appPromise = createExpressApp().catch((err) => {
      appPromise = null;
      throw err;
    });
  }
  return appPromise;
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const app = await getApp();

    const rawUrl = req.url || '/api';
    if (rawUrl.startsWith('/api/index') || rawUrl.includes('__path=')) {
      const parsed = new URL(rawUrl, 'http://localhost');
      const subPath = parsed.searchParams.get('__path') || '';
      parsed.searchParams.delete('__path');
      const qs = parsed.searchParams.toString();
      const normalizedSub = subPath.replace(/^\/+/, '');
      req.url = `${normalizedSub ? `/api/${normalizedSub}` : '/api'}${qs ? `?${qs}` : ''}`;
    }

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve();
      };
      const fail = (err: Error) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(err);
      };
      const cleanup = () => {
        res.off('finish', done);
        res.off('close', done);
        res.off('error', fail);
      };

      res.once('finish', done);
      res.once('close', done);
      res.once('error', fail);

      app(
        req as Parameters<express.Express>[0],
        res as Parameters<express.Express>[1],
        (err?: unknown) => {
          if (err) {
            fail(err instanceof Error ? err : new Error(String(err)));
          } else if (!res.writableEnded && !res.headersSent) {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ error: 'API endpoint not found.' }));
          }
        }
      );
    });
  } catch (err) {
    console.error('[Vercel API Handler Error]', err instanceof Error ? err.message : String(err));
    if (!res.headersSent && !res.writableEnded) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(
        JSON.stringify({
          error: 'Server function encountered an unexpected error.',
          detail: err instanceof Error ? err.message : String(err),
        })
      );
    }
  }
}
