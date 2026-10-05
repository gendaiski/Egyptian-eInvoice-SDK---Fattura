import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { ZodError } from 'zod';
import { attachUser } from './auth/session';
import { getDb } from './db/client';
import { seedIfEmpty } from './db/seed';
import { env } from './env';
import { HttpError } from './http';
import { actions, signer } from './routes/actions';
import { core } from './routes/core';
import { ext } from './routes/ext';
import { tick } from './services/worker';

let ready: Promise<void> | null = null;
/** Opens the database, applies migrations and seeds the demo on first run. */
export const ensureReady = () => (ready ??= getDb().then(async (db) => { await seedIfEmpty(db); }));

export function createApp() {
  const app = new Hono().basePath('/api');
  app.use('*', secureHeaders());
  const origins = env().CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean);
  if (origins.length) app.use('*', cors({ origin: origins, credentials: true }));
  app.use('*', async (_c, next) => { await ensureReady(); await next(); });

  app.onError((err, c) => {
    if (err instanceof HttpError) return c.json({ error: { code: err.code, message: err.message, details: err.details } }, err.status as 400);
    if (err instanceof ZodError) return c.json({ error: { code: 'invalid_body', message: err.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; '), details: err.issues } }, 422);
    console.error(err);
    return c.json({ error: { code: 'internal', message: 'Something went wrong on our side. It has been logged.' } }, 500);
  });

  app.get('/health', async (c) => {
    const db = await getDb();
    const [w] = await db.query<{ data: { at: string } }>("SELECT data FROM platform WHERE kind = 'worker' AND id = 'last_tick'");
    return c.json({ ok: true, db: db.kind, lastTick: w?.data.at ?? null, version: '1.0.0' });
  });

  app.post('/cron/tick', async (c) => {
    const secret = env().CRON_SECRET;
    const given = c.req.header('authorization')?.replace(/^Bearer /, '') ?? c.req.query('secret');
    if (secret && given !== secret) throw new HttpError(401, 'unauthorized', 'Bad cron secret.');
    return c.json(await tick(await getDb()));
  });
  app.get('/cron/tick', (c) => app.fetch(new Request(c.req.url, { method: 'POST', headers: c.req.raw.headers })));

  // The signer agent and the integration API authenticate with their own tokens.
  app.route('/v1/signer', signer);
  app.route('/v1/ext', ext);
  // Everything else uses the browser session.
  const v1 = new Hono();
  v1.use('*', attachUser);
  v1.route('/', core);
  v1.route('/actions', actions);
  app.route('/v1', v1);
  app.notFound((c) => c.json({ error: { code: 'not_found', message: `No route for ${c.req.method} ${new URL(c.req.url).pathname}` } }, 404));
  return app;
}
