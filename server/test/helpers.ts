import { createApp } from '../src/app';
import { resetDb } from '../src/db/client';
import { setEnv } from '../src/env';

/** A fresh app on an in-memory database with the demo seed, plus a cookie-carrying client. */
export async function freshApp() {
  setEnv({ PGLITE_DIR: 'memory', DATABASE_URL: undefined, SEED_DEMO: 'true', APP_SECRET: 'test-secret-test-secret-test-secret-123', CRON_SECRET: undefined });
  await resetDb();
  const app = createApp();
  return app;
}

export function client(app: ReturnType<typeof createApp>) {
  let cookie = '';
  const call = async (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) => {
    const res = await app.request(`/api${path}`, { method, headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), ...headers }, body: body !== undefined ? JSON.stringify(body) : undefined });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    const text = await res.text();
    let json: any; try { json = text ? JSON.parse(text) : undefined; } catch { json = text; }
    return { status: res.status, json };
  };
  return {
    get: (p: string, h?: Record<string, string>) => call('GET', p, undefined, h),
    post: (p: string, b?: unknown, h?: Record<string, string>) => call('POST', p, b ?? {}, h),
    put: (p: string, b: unknown, h?: Record<string, string>) => call('PUT', p, b, h),
    del: (p: string, h?: Record<string, string>) => call('DELETE', p, undefined, h),
    login: (email: string, password: string) => call('POST', '/v1/auth/login', { email, password }),
  };
}
