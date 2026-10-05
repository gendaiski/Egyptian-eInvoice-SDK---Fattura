import { api, reportApiError } from '@/lib/api';
import type { DB } from './model';

/**
 * API mode: after an optimistic local change, send what changed. Collections are compared by id and
 * JSON; each changed record is PUT (or DELETEd) once. Singletons are debounced so typing into a
 * settings field sends one request. The server validates and enforces permissions; on any error the
 * caller reloads the authoritative state.
 */
type Coll = { key: string; get(db: DB): { id: string }[]; deletable?: boolean };
const COLLECTIONS: Coll[] = [
  { key: 'customers', get: (d) => d.customers, deletable: true },
  { key: 'items', get: (d) => d.items, deletable: true },
  { key: 'recurring', get: (d) => d.recurring, deletable: true },
  { key: 'members', get: (d) => d.members, deletable: true },
  { key: 'notices', get: (d) => d.notices },
  { key: 'admin.plans', get: (d) => d.admin.plans },
  { key: 'admin.tenants', get: (d) => d.admin.tenants },
  { key: 'admin.invoices', get: (d) => d.admin.invoices },
  { key: 'admin.leads', get: (d) => d.admin.leads },
  { key: 'admin.refs', get: (d) => d.admin.refs },
];
const SINGLETONS: { key: string; get(db: DB): unknown }[] = [
  { key: 'company', get: (d) => d.company },
  { key: 'integration', get: (d) => ({ env: d.integration.env, clientId: d.integration.clientId }) },
  { key: 'signing', get: (d) => ({ method: d.signing.method }) },
  { key: 'settings', get: (d) => d.settings },
  { key: 'admin.site', get: (d) => d.admin.site },
];

const timers = new Map<string, number>();

export function syncDiff(prev: DB, next: DB, onError: () => void) {
  const calls: Promise<unknown>[] = [];
  for (const c of COLLECTIONS) {
    const a = new Map(c.get(prev).map((x) => [x.id, JSON.stringify(x)]));
    const b = c.get(next);
    for (const x of b) if (a.get(x.id) !== JSON.stringify(x)) calls.push(api('PUT', `/data/${c.key}/${encodeURIComponent(x.id)}`, x));
    if (c.deletable) { const ids = new Set(b.map((x) => x.id)); for (const id of a.keys()) if (!ids.has(id)) calls.push(api('DELETE', `/data/${c.key}/${encodeURIComponent(id)}`)); }
  }
  for (const s of SINGLETONS) {
    const v = s.get(next);
    if (JSON.stringify(s.get(prev)) === JSON.stringify(v)) continue;
    window.clearTimeout(timers.get(s.key));
    timers.set(s.key, window.setTimeout(() => { api('PUT', `/data/singleton/${s.key}`, v).catch((e) => { reportApiError(e); onError(); }); }, 600));
  }
  if (calls.length) Promise.all(calls).catch((e) => { reportApiError(e); onError(); });
}
