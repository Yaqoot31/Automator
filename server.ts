import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { createExpressApp, type BroadcastFn } from './server/app.js';
import { SESSION_COOKIE_NAME, parseCookies, verifyAuthToken } from './server/security.js';

export { createExpressApp, type BroadcastFn } from './server/app.js';

async function startStandaloneServer() {
  let setBroadcast: (fn: BroadcastFn) => void = () => {};
  const app = await createExpressApp({
    onReadyBroadcast: (setter) => {
      setBroadcast = setter;
    },
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });
  const wsClients = new Map<WebSocket, { userId?: string }>();

  wss.on('connection', (ws, req) => {
    const cookies = parseCookies(req.headers.cookie);
    const cookieTok = cookies[SESSION_COOKIE_NAME];
    const verifiedCookie = cookieTok ? verifyAuthToken(cookieTok) : null;
    wsClients.set(ws, verifiedCookie ? { userId: verifiedCookie.userId } : {});
    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(String(raw)) as { type?: string; token?: string };
        if (msg.type === 'auth' && msg.token) {
          const verified = verifyAuthToken(msg.token);
          if (verified) {
            wsClients.set(ws, { userId: verified.userId });
          }
        }
      } catch {
        // Ignore malformed WS payloads
      }
    });
    ws.on('close', () => wsClients.delete(ws));
  });

  setBroadcast((userId, event) => {
    const data = JSON.stringify(event);
    for (const [client, meta] of wsClients.entries()) {
      if (client.readyState !== WebSocket.OPEN) continue;
      if (!userId || meta.userId === userId) {
        client.send(data);
      }
    }
  });

  // Vite dev middleware (loaded dynamically only in dev) or static production build
  const distDir = path.resolve(process.cwd(), 'dist');
  const distIndex = path.join(distDir, 'index.html');
  const useProdStatic = process.env.NODE_ENV === 'production' && fs.existsSync(distIndex);

  if (!useProdStatic) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distDir));
    app.use((_req, res) => {
      res.sendFile(distIndex);
    });
  }

  const port = Number(process.env.PORT) || 3000;
  server.listen(port, '0.0.0.0', () => {
    console.log(`Automator AI Studio server listening on http://0.0.0.0:${port}`);
  });
}

if (!process.env.VERCEL && !process.env.VERCEL_ENV) {
  startStandaloneServer().catch((err) => {
    console.error('Fatal startup error:', err);
    process.exit(1);
  });
}
