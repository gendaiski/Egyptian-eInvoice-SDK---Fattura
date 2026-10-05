import { serializeForSigning } from '../../../src/eta/serialize';
import type { EtaDocument } from '../../../src/eta/types';
import type { Db } from '../db/client';
import { decrypt, newId, sha256 } from '../crypto';
import { HttpError } from '../http';
import { repo } from '../repo';
import { signCades, softwareSigner } from './cades';

export interface SignItem { docId: string; canonical: string; digest: string }

/**
 * Signs documents with the tenant's configured method.
 * - test-certificate: signs immediately on the server (simulator / pre-production trials only).
 * - usb-token: queues a signing job for the paired Fatura Signer agent; returns null (async).
 * - hsm / cloud: provider connectors are configured per contract; not available in this build.
 */
export async function signOrQueue(db: Db, tenantId: string, docs: { id: string; eta: EtaDocument }[]): Promise<Map<string, string> | null> {
  const cfg = await repo(db).config(tenantId);
  const items: SignItem[] = docs.map((d) => { const canonical = serializeForSigning(d.eta); return { docId: d.id, canonical, digest: sha256(canonical) }; });
  if (cfg.signing.method === 'test-certificate') {
    if (cfg.integration.env === 'production') throw new HttpError(400, 'test_cert_in_production', 'The test certificate cannot sign production documents. Pair a USB token signer in Settings → Signing.');
    if (!cfg.keyEnc || !cfg.signing.certificatePem) throw new HttpError(400, 'no_test_certificate', 'Generate a test certificate in Settings → Signing first.');
    const signer = await softwareSigner(decrypt(cfg.keyEnc), cfg.signing.certificatePem);
    const out = new Map<string, string>();
    for (const it of items) out.set(it.docId, await signCades(it.canonical, signer));
    return out;
  }
  if (cfg.signing.method === 'usb-token') {
    await db.query('INSERT INTO signing_jobs (id, tenant_id, status, items) VALUES ($1,$2,$3,$4)', [newId('job'), tenantId, 'pending', JSON.stringify(items)]);
    return null;
  }
  throw new HttpError(400, 'signing_unavailable', 'HSM and cloud signing need a provider connector. Use the USB token signer or the test certificate.');
}
