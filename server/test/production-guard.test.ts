import { beforeAll, describe, expect, it } from 'vitest';
import { getDb } from '../src/db/client';
import { DEMO_USERS } from '../src/db/seed';
import { setEnv } from '../src/env';
import { repo } from '../src/repo';
import { completeSigning } from '../src/services/documents';
import { client, freshApp } from './helpers';

let app: Awaited<ReturnType<typeof freshApp>>;
beforeAll(async () => { app = await freshApp(); });

describe('live ETA submission protection', () => {
  it('blocks every production submission until operator enablement and request confirmation', async () => {
    const owner = client(app); await owner.login(DEMO_USERS.owner.email, DEMO_USERS.owner.password);
    const db = await getDb();
    const cfg = await repo(db).config('t1');
    await repo(db).saveConfig('t1', { integration: { ...cfg.integration, env: 'production' } });
    await db.query('INSERT INTO signing_jobs (id, tenant_id, status, items) VALUES ($1,$2,$3,$4)', ['job_old_environment', 't1', 'pending', JSON.stringify([{ docId: 'missing', canonical: 'sample', targetEnv: cfg.integration.env, productionConfirmed: false }])]);
    await expect(completeSigning(db, 't1', 'job_old_environment', [])).rejects.toMatchObject({ status: 409, code: 'environment_changed' });
    await db.query('INSERT INTO signing_jobs (id, tenant_id, status, items) VALUES ($1,$2,$3,$4)', ['job_unconfirmed', 't1', 'pending', JSON.stringify([{ docId: 'missing', canonical: 'sample', targetEnv: 'production', productionConfirmed: false }])]);
    await expect(completeSigning(db, 't1', 'job_unconfirmed', [])).rejects.toMatchObject({ status: 409, code: 'production_confirmation_required' });
    const disabled = await owner.post('/v1/actions/documents/submit', { ids: ['missing'], confirmProduction: true });
    expect(disabled.status).toBe(403);
    expect(disabled.json.error.code).toBe('production_disabled');
    setEnv({ ETA_PRODUCTION_SUBMISSION_ENABLED: 'true' });
    const unconfirmed = await owner.post('/v1/actions/documents/submit', { ids: ['missing'] });
    expect(unconfirmed.status).toBe(409);
    expect(unconfirmed.json.error.code).toBe('production_confirmation_required');
    const confirmed = await owner.post('/v1/actions/documents/submit', { ids: ['missing'], confirmProduction: true });
    expect(confirmed.status).toBe(404);
    expect(confirmed.json.error.code).toBe('not_found');
    // The only confirmed request used a missing local document; no ETA host was contacted.
    setEnv({ ETA_PRODUCTION_SUBMISSION_ENABLED: 'false' });
  });
});
