import 'dotenv/config';
import type { Request, Response } from 'express';
import { createApiApp } from './createApp.ts';

let cachedApp: ReturnType<typeof createApiApp> | null = null;
let initError: unknown = null;

try {
  cachedApp = createApiApp();
} catch (err) {
  initError = err;
}

export default function handler(req: Request, res: Response): Promise<void> {
  return new Promise((resolve) => {
    const done = () => resolve();
    res.once('finish', done);
    res.once('close', done);

    try {
      if (!cachedApp) {
        cachedApp = createApiApp();
      }
      cachedApp(req, res, (err?: unknown) => {
        if (!res.headersSent) {
          const message = err instanceof Error ? err.message : 'API route error.';
          res.status(500).setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ error: message }));
        }
        resolve();
      });
    } catch (err) {
      const activeErr = err || initError;
      const message = activeErr instanceof Error ? activeErr.message : 'Server initialization error.';
      if (!res.headersSent) {
        res.status(500).setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ error: message }));
      }
      resolve();
    }
  });
}
