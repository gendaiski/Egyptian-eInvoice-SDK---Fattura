/**
 * Node entry: serves the API at /api and the built front end (dist/) for everything else,
 * and runs the background worker every minute.
 *   npm run server        (after npm run build)
 */
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { existsSync, readFileSync } from 'node:fs';
import { createApp, ensureReady } from './src/app';
import { getDb } from './src/db/client';
import { env } from './src/env';
import { tick } from './src/services/worker';

const api = createApp();
const app = new Hono();
app.route('/', api);
if (existsSync('dist/index.html')) {
  const index = readFileSync('dist/index.html', 'utf8');
  app.use('/*', serveStatic({ root: './dist' }));
  app.get('*', (c) => c.html(index)); // SPA fallback
}

await ensureReady();
const port = env().PORT;
serve({ fetch: app.fetch, port }, () => console.log(`Fatura listening on http://localhost:${port} (db: ${process.env.DATABASE_URL ? 'postgres' : 'embedded'})`));

if (process.env.WORKER !== 'off') {
  const run = async () => { try { await tick(await getDb()); } catch (e) { console.error('worker tick failed', e); } };
  setTimeout(run, 5_000);
  setInterval(run, 60_000);
}
