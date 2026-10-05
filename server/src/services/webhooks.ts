import { createHmac } from 'node:crypto';
import type { Db } from '../db/client';
import { decrypt, newId } from '../crypto';

export const WEBHOOK_EVENTS = ['document.submitted', 'document.validated', 'document.invalid', 'document.cancelled', 'document.rejected', 'document.cancellation_declined', 'document.rejection_declined', 'document.accept_cancellation', 'received.created', 'payment.recorded'] as const;

/** Queues an event for every active webhook of the tenant subscribed to it (transactional outbox). */
export async function emit(db: Db, tenantId: string, event: string, data: Record<string, unknown>) {
  const hooks = await db.query<{ id: string; events: string[] }>('SELECT id, events FROM webhooks WHERE tenant_id = $1 AND active', [tenantId]);
  if (!hooks.some((h) => h.events.includes('*') || h.events.includes(event))) return;
  await db.query('INSERT INTO outbox (id, tenant_id, event, payload) VALUES ($1,$2,$3,$4)', [newId('evt'), tenantId, event, JSON.stringify({ event, created_at: new Date().toISOString(), data })]);
}

/**
 * Delivers queued events. Each POST carries X-Fatura-Event and X-Fatura-Signature
 * (sha256=HMAC of the raw body with the webhook secret). Failures retry with backoff up to 8 times.
 */
export async function deliverOutbox(db: Db, limit = 25, fetchImpl: typeof fetch = fetch) {
  const due = await db.query<{ id: string; tenant_id: string; event: string; payload: unknown; attempts: number }>('SELECT id, tenant_id, event, payload, attempts FROM outbox WHERE delivered_at IS NULL AND attempts < 8 AND next_attempt_at <= now() ORDER BY created_at LIMIT $1', [limit]);
  let delivered = 0;
  for (const e of due) {
    const hooks = await db.query<{ url: string; secret_enc: string; events: string[] }>('SELECT url, secret_enc, events FROM webhooks WHERE tenant_id = $1 AND active', [e.tenant_id]);
    const body = JSON.stringify({ id: e.id, ...(e.payload as object) });
    let ok = true; let lastError = '';
    for (const h of hooks.filter((h) => h.events.includes('*') || h.events.includes(e.event))) {
      const sig = createHmac('sha256', decrypt(h.secret_enc)).update(body).digest('hex');
      try {
        const res = await fetchImpl(h.url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Fatura-Event': e.event, 'X-Fatura-Signature': `sha256=${sig}`, 'X-Fatura-Delivery': e.id }, body, signal: AbortSignal.timeout(8000) });
        if (!res.ok) { ok = false; lastError = `HTTP ${res.status}`; }
      } catch (err) { ok = false; lastError = (err as Error).message; }
    }
    if (ok) { await db.query('UPDATE outbox SET delivered_at = now(), attempts = attempts + 1 WHERE id = $1', [e.id]); delivered++; }
    else await db.query(`UPDATE outbox SET attempts = attempts + 1, last_error = $2, next_attempt_at = now() + (interval '30 seconds' * power(2, attempts)) WHERE id = $1`, [e.id, lastError]);
  }
  return delivered;
}
