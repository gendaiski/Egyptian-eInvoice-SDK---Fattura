import { buildInstallments, recurringRuns } from '../../../src/billing/schedules';
import type { EtaDocument, ValidationStep } from '../../../src/eta/types';
import { hasErrors, preflight } from '../../../src/eta/validate';
import { serializeForSigning } from '../../../src/eta/serialize';
import { docTotal, formatNumber, toEtaDocument, type Doc, type PaymentRecord, type Recurring } from '../../../src/store/model';
import type { Db } from '../db/client';
import { newId } from '../crypto';
import { etaFor } from '../eta';
import { EtaApiError } from '../eta/types';
import { HttpError } from '../http';
import { repo } from '../repo';
import { signOrQueue } from '../signing/service';
import { verifyCades } from '../signing/cades';
import { emit } from './webhooks';

const now = () => new Date().toISOString();
const numberingKey = (t: Doc['documentType']) => (t === 'EC' || t === 'ED' ? 'EI' : t);

function mapEtaError(e: unknown): never {
  if (e instanceof EtaApiError) throw new HttpError(e.status >= 400 && e.status < 500 ? 422 : 502, e.error?.code ?? 'eta_error', e.message, e.error);
  if ((e as { code?: string }).code === 'eta_not_configured') throw new HttpError(400, 'eta_not_configured', (e as Error).message);
  throw e;
}

/** Creates or updates a draft. The server owns numbering and installment schedules. */
export async function saveDraft(db: Db, tenantId: string, input: Doc, by: string): Promise<Doc> {
  const r = repo(db);
  const existing = await r.doc(tenantId, input.id);
  if (existing && existing.status !== 'Draft') throw new HttpError(409, 'not_draft', 'Only drafts can be edited. Issue a credit or debit note instead.');
  const cfg = await r.config(tenantId);
  const doc: Doc = {
    ...input, direction: 'sent', status: 'Draft',
    uuid: undefined, longId: undefined, submissionId: undefined, submittedAt: undefined, validatedAt: undefined, steps: undefined, stateChangedAt: undefined, stateReason: undefined, pending: undefined,
    payments: existing?.payments ?? [], events: existing?.events ?? [{ at: now(), type: 'created', by }],
  };
  if (!existing) {
    const key = numberingKey(doc.documentType);
    const n = cfg.settings.numbering[key];
    if (n && (!doc.internalID || doc.internalID === formatNumber(n.pattern, n.next))) {
      doc.internalID = formatNumber(n.pattern, n.next);
      cfg.settings.numbering[key] = { ...n, next: n.next + 1 };
      await r.saveConfig(tenantId, { settings: cfg.settings });
    }
  }
  doc.installments = doc.plan.kind === 'installments' ? buildInstallments(docTotal(doc), doc.plan).map((x) => ({ ...x, paid: 0 })) : undefined;
  await r.putDoc(tenantId, doc);
  return doc;
}

/**
 * Sign → submit → first poll. Documents must be drafts and pass pre-flight. With a USB token the
 * documents wait in `Signing` until the agent returns signatures (see completeSigning).
 */
export async function submitDocuments(db: Db, tenantId: string, ids: string[], by: string) {
  const r = repo(db);
  const cfg = await r.config(tenantId);
  const docs = (await Promise.all(ids.map((id) => r.doc(tenantId, id)))).filter((d): d is Doc => !!d);
  if (docs.length !== ids.length) throw new HttpError(404, 'not_found', 'One or more documents were not found.');
  const notDraft = docs.filter((d) => d.status !== 'Draft');
  if (notDraft.length) throw new HttpError(409, 'not_draft', `Already submitted: ${notDraft.map((d) => d.internalID).join(', ')}`);
  const existingIds = (await r.docs(tenantId, { direction: 'sent' })).filter((d) => !ids.includes(d.id) && d.status !== 'Invalid').map((d) => d.internalID);
  const prepared: { doc: Doc; eta: EtaDocument }[] = [];
  for (const d of docs) {
    if (d.issuedAt > now()) d.issuedAt = now();
    const eta = toEtaDocument(d, cfg.company);
    const issues = preflight(eta, { existingInternalIds: existingIds, personIdThreshold: cfg.settings.personIdThreshold });
    if (hasErrors(issues)) throw new HttpError(422, 'preflight_failed', `${d.internalID}: ${issues.filter((i) => i.level === 'error').map((i) => i.en).join(' ')}`, issues);
    prepared.push({ doc: d, eta });
  }
  for (const { doc } of prepared) {
    doc.status = 'Signing';
    doc.events.push({ at: now(), type: 'signing', by });
    await r.putDoc(tenantId, doc);
  }
  let signatures: Map<string, string> | null;
  try { signatures = await signOrQueue(db, tenantId, prepared.map((p) => ({ id: p.doc.id, eta: p.eta }))); } catch (e) {
    for (const { doc } of prepared) { doc.status = 'Draft'; await r.putDoc(tenantId, doc); }
    throw e;
  }
  if (!signatures) return { queued: true, documents: prepared.map((p) => p.doc) };
  return { queued: false, ...(await submitSigned(db, tenantId, prepared.map((p) => ({ doc: p.doc, eta: p.eta, signature: signatures!.get(p.doc.id)! })), by)) };
}

/** Called when the signer agent returns signatures for a queued job. */
export async function completeSigning(db: Db, tenantId: string, jobId: string, signatures: { docId: string; value: string }[]) {
  const r = repo(db);
  const [job] = await db.query<{ items: { docId: string; canonical: string }[]; status: string }>('SELECT items, status FROM signing_jobs WHERE id = $1 AND tenant_id = $2', [jobId, tenantId]);
  if (!job) throw new HttpError(404, 'not_found', 'Signing job not found.');
  if (job.status === 'done') return { alreadyDone: true };
  const cfg = await r.config(tenantId);
  const batch: { doc: Doc; eta: EtaDocument; signature: string }[] = [];
  for (const it of job.items) {
    const sig = signatures.find((s) => s.docId === it.docId);
    const doc = await r.doc(tenantId, it.docId);
    if (!sig || !doc || doc.status !== 'Signing') continue;
    const eta = toEtaDocument(doc, cfg.company);
    if (serializeForSigning(eta) !== it.canonical) throw new HttpError(409, 'changed', `${doc.internalID} changed after it was queued for signing.`);
    const v = await verifyCades(sig.value, it.canonical);
    if (!v.ok) throw new HttpError(422, 'bad_signature', `The signature for ${doc.internalID} does not verify.`);
    batch.push({ doc, eta, signature: sig.value });
  }
  await db.query("UPDATE signing_jobs SET status = 'done', completed_at = now() WHERE id = $1", [jobId]);
  return submitSigned(db, tenantId, batch, 'Fatura Signer');
}

async function submitSigned(db: Db, tenantId: string, batch: { doc: Doc; eta: EtaDocument; signature: string }[], by: string) {
  const r = repo(db);
  const eta = await etaFor(db, tenantId).catch(mapEtaError);
  const started = Date.now();
  let res;
  try {
    res = await eta.submitDocuments(batch.map((b) => ({ ...b.eta, signatures: [{ signatureType: 'I', value: b.signature }] })));
  } catch (e) {
    for (const { doc } of batch) { doc.status = 'Draft'; doc.events.push({ at: now(), type: 'submit_failed', by: 'ETA', note: (e as Error).message }); await r.putDoc(tenantId, doc); }
    mapEtaError(e);
  }
  for (const b of batch) {
    const acc = res.acceptedDocuments.find((a) => a.internalId === b.doc.internalID);
    const rej = res.rejectedDocuments.find((a) => a.internalId === b.doc.internalID);
    b.doc.events.push({ at: now(), type: 'signed', by: by === 'Fatura Signer' ? 'Fatura Signer · USB token' : 'Fatura · test certificate' });
    if (acc) {
      Object.assign(b.doc, { status: 'Submitted', uuid: acc.uuid, longId: acc.longId, submissionId: res.submissionId, submittedAt: now(), issuedAt: b.eta.dateTimeIssued });
      b.doc.events.push({ at: now(), type: 'submitted', by });
    } else {
      Object.assign(b.doc, { status: 'Invalid', submissionId: res.submissionId, submittedAt: now(), validatedAt: now(), steps: [{ name: 'Structure validator', status: 'Invalid', error: rej?.error } satisfies ValidationStep] });
      b.doc.events.push({ at: now(), type: 'invalid', by: 'ETA', note: rej?.error?.message });
    }
    await r.putDoc(tenantId, b.doc);
  }
  const id = res.submissionId;
  await r.put(tenantId, 'submissions', id, { id, at: now(), docIds: batch.map((b) => b.doc.id), accepted: res.acceptedDocuments.length, rejected: res.rejectedDocuments.length, status: 'InProgress', ms: Date.now() - started, by });
  for (const b of batch) await emit(db, tenantId, 'document.submitted', { id: b.doc.id, internal_id: b.doc.internalID, eta_uuid: b.doc.uuid });
  const polled = await pollDocuments(db, tenantId, batch.filter((b) => b.doc.status === 'Submitted').map((b) => b.doc.id));
  return { submissionId: id, accepted: res.acceptedDocuments.length, rejected: res.rejectedDocuments.length, polled };
}

/** Asks ETA for the validation outcome of submitted documents. Safe to call repeatedly. */
export async function pollDocuments(db: Db, tenantId: string, ids?: string[]) {
  const r = repo(db);
  const docs = ids ? (await Promise.all(ids.map((id) => r.doc(tenantId, id)))).filter((d): d is Doc => !!d && d.status === 'Submitted') : await r.docs(tenantId, { status: ['Submitted'] });
  if (!docs.length) return 0;
  const eta = await etaFor(db, tenantId).catch(mapEtaError);
  let done = 0;
  const bySubmission = new Map<string, { invalid: number; total: number }>();
  for (const d of docs) {
    let det;
    try { det = await eta.getDocumentDetails(d.uuid!); } catch (e) { if (e instanceof EtaApiError && e.retryable) continue; throw e; }
    if (det.status === 'Submitted') continue;
    d.status = det.status; d.steps = det.validationSteps; d.validatedAt = now(); if (det.longId) d.longId = det.longId;
    d.events.push({ at: now(), type: det.status === 'Valid' ? 'valid' : 'invalid', by: 'ETA' });
    await r.putDoc(tenantId, d);
    done++;
    const s = bySubmission.get(d.submissionId!) ?? { invalid: 0, total: 0 };
    s.total++; if (det.status === 'Invalid') s.invalid++;
    bySubmission.set(d.submissionId!, s);
    await emit(db, tenantId, det.status === 'Valid' ? 'document.validated' : 'document.invalid', { id: d.id, internal_id: d.internalID, eta_uuid: d.uuid, status: det.status, total: docTotal(d), validation_steps: det.validationSteps });
  }
  for (const [sid, s] of bySubmission) {
    const sub = await r.get<{ status: string }>(tenantId, 'submissions', sid);
    if (sub) await r.put(tenantId, 'submissions', sid, { ...sub, status: s.invalid === 0 ? 'Valid' : s.invalid === s.total ? 'Invalid' : 'PartiallyValid' });
    await r.notify(tenantId, s.invalid ? 'bad' : 'ok', s.invalid ? { en: `${s.invalid} of ${s.total} document(s) came back Invalid from ETA.`, ar: `${s.invalid} من ${s.total} مستند عادت غير صالحة من المصلحة.` } : { en: `${s.total} document(s) validated by ETA.`, ar: `تم اعتماد ${s.total} مستند من المصلحة.` }, '/app/submissions');
  }
  return done;
}

export async function changeState(db: Db, tenantId: string, id: string, action: 'cancel' | 'reject' | 'decline-cancellation' | 'accept-cancellation' | 'decline-rejection', reason: string | undefined, by: string) {
  const r = repo(db);
  const d = await r.doc(tenantId, id);
  if (!d?.uuid) throw new HttpError(404, 'not_found', 'Document not found or not submitted.');
  const eta = await etaFor(db, tenantId).catch(mapEtaError);
  try {
    if (action === 'cancel') { if (d.direction !== 'sent') throw new HttpError(400, 'not_issuer', 'Only documents you issued can be cancelled.'); await eta.cancelDocument(d.uuid, reason ?? ''); d.status = 'Cancelled'; }
    if (action === 'reject') { if (d.direction !== 'received') throw new HttpError(400, 'not_receiver', 'Only documents you received can be rejected.'); await eta.rejectDocument(d.uuid, reason ?? ''); d.status = 'Rejected'; }
    if (action === 'decline-cancellation') { await eta.declineCancellation(d.uuid); d.pending = undefined; d.status = 'Valid'; }
    if (action === 'accept-cancellation') { if (eta.acceptCancellation) await eta.acceptCancellation(d.uuid); d.pending = undefined; d.status = 'Cancelled'; }
    if (action === 'decline-rejection') { await eta.declineRejection(d.uuid); d.pending = undefined; d.status = 'Valid'; }
  } catch (e) { if (e instanceof HttpError) throw e; mapEtaError(e); }
  d.stateChangedAt = now();
  if (reason) d.stateReason = reason;
  d.events.push({ at: now(), type: action === 'cancel' ? 'cancelled' : action === 'reject' ? 'rejected' : action.replace('-', '_'), by, note: reason });
  await r.putDoc(tenantId, d);
  await emit(db, tenantId, `document.${action === 'cancel' ? 'cancelled' : action === 'reject' ? 'rejected' : action.replace('-', '_')}`, { id: d.id, internal_id: d.internalID, eta_uuid: d.uuid, reason });
  return d;
}

export async function recordPayment(db: Db, tenantId: string, id: string, p: Omit<PaymentRecord, 'id'>, by: string) {
  const r = repo(db);
  const d = await r.doc(tenantId, id);
  if (!d) throw new HttpError(404, 'not_found', 'Document not found.');
  if (d.status !== 'Valid' || d.direction !== 'sent') throw new HttpError(409, 'not_payable', 'Payments can be recorded only against valid invoices you issued.');
  const outstanding = Math.round((docTotal(d) - d.payments.reduce((s, x) => s + x.amount, 0)) * 100) / 100;
  if (!(p.amount > 0) || p.amount > outstanding + 0.005) throw new HttpError(422, 'bad_amount', `Amount must be between 0.01 and ${outstanding.toFixed(2)}.`);
  d.payments.push({ ...p, id: newId('p') });
  let left = p.amount;
  for (const row of d.installments ?? []) {
    if (left <= 0) break;
    const take = Math.min(Math.round((row.amount - row.paid) * 100) / 100, left);
    row.paid = Math.round((row.paid + take) * 100) / 100;
    left = Math.round((left - take) * 100) / 100;
  }
  d.events.push({ at: now(), type: 'payment', by, note: `${p.amount.toFixed(2)} · ${p.method}` });
  await r.putDoc(tenantId, d);
  await emit(db, tenantId, 'payment.recorded', { id: d.id, internal_id: d.internalID, amount: p.amount, method: p.method, date: p.date });
  return d;
}

/** Issues one occurrence of a recurring schedule, dated today. Returns the new document. */
export async function runRecurring(db: Db, tenantId: string, recurringId: string, by: string): Promise<Doc> {
  const r = repo(db);
  const rec = await r.get<Recurring>(tenantId, 'recurring', recurringId);
  if (!rec) throw new HttpError(404, 'not_found', 'Recurring schedule not found.');
  const c = await r.get<{ id: string; type: Doc['counterparty']['type']; taxId: string; name: string; address: Doc['counterparty']['address'] }>(tenantId, 'customers', rec.customerId);
  if (!c) throw new HttpError(409, 'no_customer', 'The schedule’s customer no longer exists.');
  const cfg = await r.config(tenantId);
  const draft: Doc = {
    id: newId('d'), direction: 'sent', documentType: 'I', internalID: '', status: 'Draft',
    counterparty: { type: c.type, id: c.taxId, name: c.name, address: c.address }, customerId: c.id, branchId: rec.branchId,
    activityCode: cfg.company.activityCode, issuedAt: now(), lines: structuredClone(rec.lines), extraDiscount: 0,
    plan: { kind: 'one-time', terms: rec.plan.terms }, payments: [], recurringId: rec.id, events: [{ at: now(), type: 'generated', by: `Recurring · ${rec.name}` }],
  };
  const doc = await saveDraft(db, tenantId, draft, by);
  rec.generatedIds.push(doc.id);
  rec.lastRun = now().slice(0, 10);
  rec.nextRun = rec.status === 'active' ? recurringRuns(rec.plan, 1, new Date(Date.now() + 86_400_000).toISOString().slice(0, 10))[0] : undefined;
  if (!rec.nextRun && rec.status === 'active') rec.status = 'ended';
  await r.put(tenantId, 'recurring', rec.id, rec);
  if (rec.plan.delivery !== 'draft') {
    try { await submitDocuments(db, tenantId, [doc.id], `Recurring · ${rec.name}`); } catch (e) {
      await r.notify(tenantId, 'warn', { en: `Recurring invoice ${doc.internalID} is waiting as a draft: ${(e as Error).message}`, ar: `الفاتورة المتكررة ${doc.internalID} بانتظار الإرسال كمسودة.` }, `/app/documents/${doc.id}`);
    }
  } else {
    await r.notify(tenantId, 'info', { en: `Recurring invoice ${doc.internalID} is ready for your approval.`, ar: `الفاتورة المتكررة ${doc.internalID} جاهزة للاعتماد.` }, `/app/documents/${doc.id}`);
  }
  return (await r.doc(tenantId, doc.id))!;
}

/** Runs every active schedule whose next run is today or earlier. */
export async function runDueRecurring(db: Db, tenantId: string) {
  const r = repo(db);
  const today = now().slice(0, 10);
  let n = 0;
  for (const rec of await r.list<Recurring>(tenantId, 'recurring')) {
    if (rec.status === 'active' && rec.nextRun && rec.nextRun <= today && rec.lastRun !== today) { await runRecurring(db, tenantId, rec.id, 'Recurring scheduler'); n++; }
  }
  return n;
}

/** Imports documents issued to this taxpayer and refreshes pending cancellation requests. */
export async function syncReceived(db: Db, tenantId: string) {
  const r = repo(db);
  const cfg = await r.config(tenantId);
  const eta = await etaFor(db, tenantId).catch(mapEtaError);
  const { result } = await eta.searchDocuments({ direction: 'Received', pageSize: 100 });
  let imported = 0, updated = 0;
  for (const s of result) {
    const existing = await r.docByUuid(tenantId, s.uuid);
    const det = await eta.getDocumentDetails(s.uuid).catch(() => undefined);
    if (existing) {
      const pending = det?.cancelRequestDate ? 'cancellation_requested' : undefined;
      if (existing.status !== s.status || existing.pending !== pending) { existing.status = s.status; existing.pending = pending; await r.putDoc(tenantId, existing); updated++; }
      continue;
    }
    const raw = await eta.getDocumentRaw(s.uuid).catch(() => undefined);
    const doc: Doc = {
      id: newId('d'), direction: 'received', documentType: (raw?.documentType ?? s.typeName ?? 'I') as Doc['documentType'], internalID: s.internalId, status: s.status,
      counterparty: raw?.issuer ?? { type: 'B', id: s.issuerId, name: s.issuerName }, branchId: cfg.company.branches[0]?.id ?? 'b0', activityCode: raw?.taxpayerActivityCode ?? '',
      issuedAt: s.dateTimeIssued, lines: (raw?.invoiceLines ?? []).map((l) => ({ description: l.description, itemType: l.itemType, itemCode: l.itemCode, unitType: l.unitType, quantity: l.quantity, unitPrice: l.unitValue.amountSold ?? l.unitValue.amountEGP, currency: l.unitValue.currencySold, exchangeRate: l.unitValue.currencyExchangeRate, discountRate: l.discount?.rate, itemsDiscount: l.itemsDiscount, taxes: l.taxableItems.map((t) => ({ taxType: t.taxType, subType: t.subType, rate: t.rate, amount: t.rate ? undefined : t.amount })) })),
      extraDiscount: raw?.extraDiscountAmount ?? 0, plan: { kind: 'one-time', terms: 'net30' }, payments: [], uuid: s.uuid, longId: s.longId, submittedAt: s.dateTimeIssued, validatedAt: s.dateTimeIssued,
      steps: det?.validationSteps, pending: det?.cancelRequestDate ? 'cancellation_requested' : undefined, events: [{ at: now(), type: 'received', by: s.issuerName }],
    };
    await r.putDoc(tenantId, doc);
    imported++;
    await emit(db, tenantId, 'received.created', { id: doc.id, eta_uuid: doc.uuid, issuer: doc.counterparty.name, internal_id: doc.internalID });
  }
  if (imported) await r.notify(tenantId, 'info', { en: `${imported} new document(s) received from suppliers.`, ar: `${imported} مستند جديد من الموردين.` }, '/app/received');
  return { imported, updated };
}

export async function requestCodes(db: Db, tenantId: string, itemIds: string[]) {
  const r = repo(db);
  const eta = await etaFor(db, tenantId).catch(mapEtaError);
  const items = (await Promise.all(itemIds.map((id) => r.get<{ id: string; itemType: string; itemCode: string; gpcCode: string; name: string; nameAr: string; codeStatus: string; codeRequestedAt: string }>(tenantId, 'items', id)))).filter((i) => i && i.itemType === 'EGS');
  const res = await eta.createEgsCodeUsage(items.map((i) => ({ codeType: 'EGS', parentCode: i!.gpcCode, itemCode: i!.itemCode, codeName: i!.name, codeNameAr: i!.nameAr, activeFrom: now(), description: i!.name, descriptionAr: i!.nameAr }))).catch(mapEtaError);
  for (const i of items) {
    if (res.passedItems.some((p) => p.itemCode === i!.itemCode)) await r.put(tenantId, 'items', i!.id, { ...i, codeStatus: 'Submitted', codeRequestedAt: now() });
  }
  return res;
}

export async function refreshCodes(db: Db, tenantId: string) {
  const r = repo(db);
  const eta = await etaFor(db, tenantId).catch(mapEtaError);
  const statuses = await eta.getMyCodeUsageRequests();
  let changed = 0;
  for (const i of await r.list<{ id: string; itemCode: string; codeStatus: string }>(tenantId, 'items')) {
    const s = statuses.find((x) => x.itemCode === i.itemCode);
    if (s && s.status !== i.codeStatus) {
      await r.put(tenantId, 'items', i.id, { ...i, codeStatus: s.status });
      changed++;
      if (s.status === 'Rejected') await r.notify(tenantId, 'bad', { en: `Item code ${i.itemCode} was rejected by ETA.`, ar: `رفضت المصلحة كود الصنف ${i.itemCode}.` }, '/app/items');
    }
  }
  return changed;
}
