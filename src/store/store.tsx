import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { buildInstallments, recurringRuns } from '@/billing/schedules';
import { DATA_MODE } from '@/env';
import { mockEta } from '@/eta/mockClient';
import { serializeForSigning } from '@/eta/serialize';
import { api, reportApiError } from '@/lib/api';
import { docTotal, formatNumber, toEtaDocument, uid, type DB, type Doc, type PaymentRecord } from './model';
import { seed } from './seed';
import { syncDiff } from './sync';

const KEY = 'fatura.db.v3';
const load = (): DB => {
  try { const raw = localStorage.getItem(KEY); if (raw) { const db = JSON.parse(raw) as DB; if (db.version === 3) return db; } } catch { /* fall through */ }
  return seed();
};

type Mutator = (db: DB) => void;
interface Store {
  db: DB;
  /** Change state. In API mode the change is applied optimistically and synced to the server. */
  set(fn: Mutator): void;
  /** Change local state only (API mode: used after an action whose result the server already holds). */
  setLocal(fn: Mutator): void;
  /** Re-read the authoritative state from the server (API mode); no-op locally. */
  reload(): Promise<void>;
  reset(): void;
  /** Latest committed state; safe to read from async work after the caller unmounts. */
  get(): DB;
  mode: 'local' | 'api';
}
const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  return DATA_MODE === 'api' ? <ApiStoreProvider>{children}</ApiStoreProvider> : <LocalStoreProvider>{children}</LocalStoreProvider>;
}

function LocalStoreProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<DB>(load);
  const latest = useRef(db);
  const set = useCallback((fn: Mutator) => setDb((prev) => { const next = structuredClone(prev); fn(next); latest.current = next; return next; }), []);
  const get = useCallback(() => latest.current, []);
  const reset = useCallback(() => { const s = seed(); latest.current = s; setDb(s); }, []);
  const reload = useCallback(async () => {}, []);
  const t = useRef<number>();
  useEffect(() => {
    window.clearTimeout(t.current);
    t.current = window.setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* quota or private mode */ } }, 250);
  }, [db]);
  const value = useMemo<Store>(() => ({ db, set, setLocal: set, reload, reset, get, mode: 'local' }), [db, set, reload, reset, get]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function ApiStoreProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<DB | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const latest = useRef<DB | null>(null);
  const reload = useCallback(async () => {
    try {
      const next = await api<DB>('GET', '/bootstrap');
      latest.current = next; setDb(next); setFailed(null);
    } catch (e) { setFailed((e as Error).message); }
  }, []);
  useEffect(() => { reload(); }, [reload]);
  const setLocal = useCallback((fn: Mutator) => setDb((prev) => { if (!prev) return prev; const next = structuredClone(prev); fn(next); latest.current = next; return next; }), []);
  const set = useCallback((fn: Mutator) => {
    const prev = latest.current;
    if (!prev) return;
    const next = structuredClone(prev); fn(next);
    latest.current = next; setDb(next);
    syncDiff(prev, next, () => { reload(); });
  }, [reload]);
  const get = useCallback(() => latest.current!, []);
  // While documents are being signed or validated, refresh their state from ETA via the server.
  const busy = db?.docs.some((d) => d.status === 'Signing' || d.status === 'Submitted');
  useEffect(() => {
    if (!busy) return;
    const t = window.setInterval(async () => {
      const pending = latest.current?.docs.filter((d) => d.status === 'Submitted').slice(0, 5) ?? [];
      await Promise.all(pending.map((d) => api('POST', `/actions/documents/${d.id}/refresh`).catch(() => {})));
      await reload();
    }, 4000);
    return () => window.clearInterval(t);
  }, [busy, reload]);
  const value = useMemo<Store | null>(() => (db ? { db, set, setLocal, reload, reset: () => {}, get, mode: 'api' } : null), [db, set, setLocal, reload, get]);
  if (!value) {
    return (
      <div className="min-h-screen grid place-items-center p-6 text-center bg-canvas text-ink">
        {failed ? (
          <div className="max-w-sm">
            <p className="font-semibold">Fatura can’t reach its server.</p>
            <p className="mt-1 text-ink-muted text-[14px]">{failed}</p>
            <button className="mt-4 underline text-accent" onClick={() => reload()}>Try again</button>
          </div>
        ) : <div className="skeleton h-10 w-48" aria-label="Loading" />}
      </div>
    );
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStore outside provider');
  return v;
}

const nowISO = () => new Date().toISOString();

/** All writes go through these actions so the audit trail (doc.events) stays complete. */
export function useActions() {
  const store = useStore();
  const { db, set, setLocal, get, reload, mode } = store;
  const dbRef = { get current() { return get(); } };
  const me = db.session.user.name;

  return useMemo(() => {
    const patchDoc = (id: string, fn: (d: Doc, db: DB) => void) => set((x) => { const d = x.docs.find((y) => y.id === id); if (d) fn(d, x); });

    const nextNumber = (type: Doc['documentType']) => {
      const key = (type === 'EC' || type === 'ED' ? 'EI' : type) as keyof DB['settings']['numbering'];
      const cfg = dbRef.current.settings.numbering[key] ?? { pattern: `${type}-{YYYY}-{#####}`, next: 1 };
      return formatNumber(cfg.pattern, cfg.next);
    };

    const localSave = (x: DB, doc: Doc) => {
      const i = x.docs.findIndex((d) => d.id === doc.id);
      if (i >= 0) x.docs[i] = doc;
      else {
        x.docs.unshift(doc);
        const key = (doc.documentType === 'EC' || doc.documentType === 'ED' ? 'EI' : doc.documentType) as keyof DB['settings']['numbering'];
        if (x.settings.numbering[key]) x.settings.numbering[key].next += 1;
      }
      const target = x.docs.find((d) => d.id === doc.id)!;
      target.installments = doc.plan.kind === 'installments' ? buildInstallments(docTotal(doc), doc.plan).map((r) => ({ ...r, paid: 0 })) : undefined;
    };

    /* ---------------- API mode ---------------- */
    if (mode === 'api') {
      const run = async <T,>(fn: () => Promise<T>): Promise<T | undefined> => { try { return await fn(); } catch (e) { reportApiError(e); return undefined; } finally { await reload(); } };
      const state = (action: string) => async (id: string, reason?: string) => { await run(() => api('POST', `/actions/documents/${id}/${action}`, reason ? { reason } : {})); };
      return {
        nextNumber,
        saveDoc: async (doc: Doc) => {
          setLocal((x) => localSave(x, doc));
          try { const saved = await api<Doc>('PUT', `/data/docs/${encodeURIComponent(doc.id)}`, doc); setLocal((x) => { const i = x.docs.findIndex((d) => d.id === doc.id); if (i >= 0) x.docs[i] = saved; }); }
          catch (e) { reportApiError(e); await reload(); throw e; }
        },
        submit: async (ids: string[]) => {
          setLocal((x) => { for (const d of x.docs) if (ids.includes(d.id)) d.status = 'Signing'; });
          return run(() => api('POST', '/actions/documents/submit', { ids }));
        },
        deleteDraft: async (id: string) => { setLocal((x) => { x.docs = x.docs.filter((d) => d.id !== id); }); await run(() => api('DELETE', `/data/docs/${id}`)); },
        cancel: state('cancel'),
        reject: state('reject'),
        declineCancellation: state('decline-cancellation'),
        acceptCancellation: state('accept-cancellation'),
        recordPayment: async (id: string, p: Omit<PaymentRecord, 'id'>) => { await run(() => api('POST', `/actions/documents/${id}/payments`, p)); },
        setRecurringStatus: (id: string, status: 'active' | 'paused') => set((x) => {
          const r = x.recurring.find((y) => y.id === id)!;
          r.status = status;
          r.nextRun = status === 'active' ? recurringRuns(r.plan, 1, new Date(Date.now() + 86_400_000).toISOString().slice(0, 10))[0] : undefined;
        }),
        runRecurringNow: async (id: string): Promise<string> => { const d = await run(() => api<Doc>('POST', `/actions/recurring/${id}/run`)); return d?.id ?? ''; },
        requestCodes: async (itemIds: string[]) => { await run(() => api('POST', '/actions/items/request-codes', { ids: itemIds })); },
        markAllRead: () => { setLocal((x) => { x.notices.forEach((n) => { n.read = true; }); }); api('POST', '/actions/notices/read-all').catch(reportApiError); },
      };
    }

    /* ---------------- Local demo mode ---------------- */
    /**
     * Sign → submit → poll, simulated in the browser:
     *  1. hash the canonical serialization and sign it;
     *  2. submit one batch;
     *  3. read back each document's validation result.
     */
    const submit = async (ids: string[]) => {
      const startedAt = Date.now();
      set((x) => { for (const d of x.docs) if (ids.includes(d.id)) { d.status = 'Signing'; d.issuedAt = d.issuedAt > nowISO() ? nowISO() : d.issuedAt; d.events.push({ at: nowISO(), type: 'signed', by: `Signer agent · ${x.signing.agent.host}` }); } });
      await new Promise((r) => setTimeout(r, 650));
      const current = dbRef.current;
      const docs = current.docs.filter((d) => ids.includes(d.id));
      const etaDocs = docs.map((d) => {
        const e = toEtaDocument(d, current.company);
        return { ...e, signatures: [{ signatureType: 'I' as const, value: btoa(serializeForSigning(e).slice(0, 48)) }] };
      });
      const res = await mockEta.submitDocuments(etaDocs);
      set((x) => {
        for (const a of res.acceptedDocuments) {
          const d = x.docs.find((y) => ids.includes(y.id) && y.internalID === a.internalId)!;
          Object.assign(d, { status: 'Submitted', uuid: a.uuid, longId: a.longId, submissionId: res.submissionId, submittedAt: nowISO() });
          d.events.push({ at: nowISO(), type: 'submitted', by: me });
        }
        x.submissions.unshift({ id: res.submissionId, at: nowISO(), docIds: ids, accepted: res.acceptedDocuments.length, rejected: res.rejectedDocuments.length, status: 'InProgress', ms: Date.now() - startedAt, by: me });
      });
      const approved = new Set(current.items.filter((i) => i.codeStatus === 'Approved').map((i) => i.itemCode));
      const results = await Promise.all(etaDocs.map((e) => mockEta.getDocumentDetails(e, { approvedCodes: approved })));
      set((x) => {
        let invalid = 0;
        docs.forEach((orig, k) => {
          const d = x.docs.find((y) => y.id === orig.id)!;
          const r = results[k];
          d.status = r.status; d.steps = r.validationSteps; d.validatedAt = nowISO();
          d.events.push({ at: nowISO(), type: r.status === 'Valid' ? 'valid' : 'invalid', by: 'ETA' });
          if (r.status === 'Invalid') invalid++;
        });
        const s = x.submissions.find((y) => y.id === res.submissionId);
        if (s) s.status = invalid === 0 ? 'Valid' : invalid === docs.length ? 'Invalid' : 'PartiallyValid';
        x.notices.unshift({
          id: uid('n'), at: nowISO(), tone: invalid ? 'bad' : 'ok', read: false, to: ids.length === 1 ? `/app/documents/${ids[0]}` : '/app/submissions',
          text: invalid
            ? { en: `${invalid} of ${docs.length} document(s) came back Invalid from ETA.`, ar: `${invalid} من ${docs.length} مستند عادت غير صالحة من المصلحة.` }
            : { en: `${docs.length} document(s) validated by ETA.`, ar: `تم اعتماد ${docs.length} مستند من المصلحة.` },
        });
      });
      return results;
    };

    return {
      nextNumber,
      saveDoc: async (doc: Doc) => { set((x) => localSave(x, doc)); },
      submit,
      deleteDraft: async (id: string) => set((x) => { x.docs = x.docs.filter((d) => d.id !== id || d.status !== 'Draft'); }),
      cancel: async (id: string, reason: string) => {
        await mockEta.changeState();
        patchDoc(id, (d) => { d.status = 'Cancelled'; d.stateReason = reason; d.stateChangedAt = nowISO(); d.events.push({ at: nowISO(), type: 'cancelled', by: me, note: reason }); });
      },
      reject: async (id: string, reason: string) => {
        await mockEta.changeState();
        patchDoc(id, (d) => { d.status = 'Rejected'; d.stateReason = reason; d.stateChangedAt = nowISO(); d.events.push({ at: nowISO(), type: 'rejected', by: me, note: reason }); });
      },
      declineCancellation: async (id: string) => {
        await mockEta.changeState();
        patchDoc(id, (d) => { d.pending = undefined; d.events.push({ at: nowISO(), type: 'cancellation_declined', by: me }); });
      },
      acceptCancellation: async (id: string) => {
        await mockEta.changeState();
        patchDoc(id, (d) => { d.pending = undefined; d.status = 'Cancelled'; d.stateChangedAt = nowISO(); d.events.push({ at: nowISO(), type: 'cancelled', by: d.counterparty.name ?? 'Issuer' }); });
      },
      recordPayment: async (id: string, p: Omit<PaymentRecord, 'id'>) => patchDoc(id, (d) => {
        d.payments.push({ ...p, id: uid('p') });
        let left = p.amount;
        for (const row of d.installments ?? []) {
          if (left <= 0) break;
          const room = Math.round((row.amount - row.paid) * 100) / 100;
          const take = Math.min(room, left);
          row.paid = Math.round((row.paid + take) * 100) / 100;
          left = Math.round((left - take) * 100) / 100;
        }
        d.events.push({ at: nowISO(), type: 'payment', by: me, note: `${p.amount.toFixed(2)} · ${p.method}` });
      }),
      setRecurringStatus: (id: string, status: 'active' | 'paused') => set((x) => {
        const r = x.recurring.find((y) => y.id === id)!;
        r.status = status;
        r.nextRun = status === 'active' ? recurringRuns(r.plan, 1, new Date(Date.now() + 86_400_000).toISOString().slice(0, 10))[0] : undefined;
      }),
      /** Generates the next occurrence now (dated today, never in the future). */
      runRecurringNow: async (id: string): Promise<string> => {
        const x = dbRef.current;
        const r = x.recurring.find((y) => y.id === id)!;
        const c = x.customers.find((y) => y.id === r.customerId)!;
        const doc: Doc = {
          id: uid('d'), direction: 'sent', documentType: 'I', internalID: nextNumber('I'), status: 'Draft',
          counterparty: { type: c.type, id: c.taxId, name: c.name, address: c.address }, customerId: c.id, branchId: r.branchId,
          activityCode: x.company.activityCode, issuedAt: nowISO(), lines: structuredClone(r.lines), extraDiscount: 0,
          plan: { kind: 'one-time', terms: r.plan.terms }, payments: [], recurringId: r.id, events: [{ at: nowISO(), type: 'generated', by: `Recurring · ${r.name}` }],
        };
        set((y) => localSave(y, doc));
        set((y) => { const rr = y.recurring.find((z) => z.id === id)!; rr.generatedIds.push(doc.id); rr.lastRun = nowISO().slice(0, 10); });
        return doc.id;
      },
      requestCodes: async (itemIds: string[]) => {
        set((x) => { for (const i of x.items) if (itemIds.includes(i.id)) { i.codeStatus = 'Submitted'; i.codeRequestedAt = nowISO(); } });
        await mockEta.createEgsCodeUsage();
      },
      markAllRead: () => set((x) => { x.notices.forEach((n) => { n.read = true; }); }),
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [set, setLocal, get, reload, me, mode]);
}

/** Sign-in, sign-up, onboarding and sign-out, for both data modes. */
export function useAuth() {
  const { set, reload, mode, get } = useStore();
  return useMemo(() => ({
    mode,
    async login(email: string, password: string) {
      if (mode === 'api') { await api('POST', '/auth/login', { email, password }); await reload(); return get(); }
      set((x) => { x.session.signedIn = true; x.session.onboarded = true; });
      return get();
    },
    async signup(p: { name: string; company: string; email: string; password: string; plan?: string; billing?: string }, localApply: (x: DB) => void) {
      if (mode === 'api') { await api('POST', '/auth/signup', p); await reload(); return; }
      set(localApply);
    },
    async logout() {
      if (mode === 'api') { await api('POST', '/auth/logout').catch(() => {}); await reload(); return; }
      set((x) => { x.session.signedIn = false; });
    },
    async completeOnboarding(localApply: (x: DB) => void) {
      if (mode === 'api') { set(localApply); await new Promise((r) => setTimeout(r, 800)); await api('POST', '/actions/onboarding/complete'); await reload(); return; }
      set(localApply);
    },
  }), [mode, set, reload, get]);
}
