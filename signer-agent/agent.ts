/**
 * Fatura Signer — runs on the Windows/macOS/Linux machine that holds the signing certificate.
 * It never sends the private key anywhere: Fatura sends the canonical document text, the agent
 * builds a CAdES-BES signature locally (USB token via PKCS#11, or a .p12 file) and returns it.
 *
 * Configuration (environment variables):
 *   FATURA_URL           https://your-fatura-host            (required)
 *   FATURA_AGENT_TOKEN   fat_agent_… from Settings → Signing  (required)
 *   SIGNER               pkcs11 | pfx                         (default pkcs11)
 *   PKCS11_LIB           path to the token's PKCS#11 library, e.g. C:\Windows\System32\eps2003csp11.dll
 *   PKCS11_PIN           token PIN
 *   PKCS11_SLOT          slot index (default 0)
 *   PFX_PATH, PFX_PASSWORD   for SIGNER=pfx (testing / software certificates)
 *
 * Run: node fatura-signer.mjs        (build with npm run build:signer)
 */
import { readFileSync } from 'node:fs';
import { hostname } from 'node:os';
import forge from 'node-forge';
import { signCades, softwareSigner, type RawSigner } from '../server/src/signing/cades';

const VERSION = '1.0.0';
const URL_BASE = (process.env.FATURA_URL ?? '').replace(/\/$/, '');
const TOKEN = process.env.FATURA_AGENT_TOKEN ?? '';
if (!URL_BASE || !TOKEN) { console.error('Set FATURA_URL and FATURA_AGENT_TOKEN.'); process.exit(1); }

async function pfxSigner(): Promise<{ signer: RawSigner; cert: forge.pki.Certificate }> {
  const p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(readFileSync(process.env.PFX_PATH!, 'binary')), process.env.PFX_PASSWORD ?? '');
  const key = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag]![0].key!;
  const cert = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag]![0].cert!;
  const keyPem = forge.pki.privateKeyInfoToPem(forge.pki.wrapRsaPrivateKey(forge.pki.privateKeyToAsn1(key)));
  return { signer: await softwareSigner(keyPem, forge.pki.certificateToPem(cert)), cert };
}

async function pkcs11Signer(): Promise<{ signer: RawSigner; cert: forge.pki.Certificate }> {
  // Optional native dependency: npm i pkcs11js (needs build tools on the signing PC).
  const mod = await import('pkcs11js' as string).catch(() => { throw new Error('PKCS#11 support needs the pkcs11js package: npm i pkcs11js'); });
  const P = mod.default ?? mod;
  const p = new P.PKCS11();
  p.load(process.env.PKCS11_LIB);
  p.C_Initialize();
  const slot = p.C_GetSlotList(true)[Number(process.env.PKCS11_SLOT ?? 0)];
  if (!slot) throw new Error('No token found. Plug in the USB token.');
  const session = p.C_OpenSession(slot, P.CKF_SERIAL_SESSION | P.CKF_RW_SESSION);
  p.C_Login(session, P.CKU_USER, process.env.PKCS11_PIN ?? '');
  const find = (cls: number) => { p.C_FindObjectsInit(session, [{ type: P.CKA_CLASS, value: cls }]); const h = p.C_FindObjects(session); p.C_FindObjectsFinal(session); if (!h) throw new Error('Certificate or key not found on the token.'); return h; };
  const certHandle = find(P.CKO_CERTIFICATE);
  const keyHandle = find(P.CKO_PRIVATE_KEY);
  const der: Buffer = p.C_GetAttributeValue(session, certHandle, [{ type: P.CKA_VALUE }])[0].value;
  const cert = forge.pki.certificateFromAsn1(forge.asn1.fromDer(der.toString('binary')));
  return {
    cert,
    signer: {
      certificate: new Uint8Array(der),
      sign: async (data) => { p.C_SignInit(session, { mechanism: P.CKM_SHA256_RSA_PKCS }, keyHandle); return new Uint8Array(p.C_Sign(session, Buffer.from(data), Buffer.alloc(1024))); },
    },
  };
}

const api = async (method: string, path: string, body?: unknown) => {
  const res = await fetch(`${URL_BASE}/api/v1/signer${path}`, { method, headers: { Authorization: `Agent ${TOKEN}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j?.error?.message ?? `HTTP ${res.status}`);
  return j;
};

async function main() {
  const { signer, cert } = process.env.SIGNER === 'pfx' ? await pfxSigner() : await pkcs11Signer();
  const certificate = {
    subject: cert.subject.attributes.map((a) => `${a.shortName ?? a.name}=${a.value}`).join(', '),
    issuer: cert.issuer.attributes.map((a) => `${a.shortName ?? a.name}=${a.value}`).join(', '),
    serial: cert.serialNumber.toUpperCase(),
    expires: cert.validity.notAfter.toISOString().slice(0, 10),
  };
  const heartbeat = () => api('POST', '/heartbeat', { version: VERSION, host: hostname(), certificate }).catch((e) => console.error('heartbeat:', e.message));
  await heartbeat();
  setInterval(heartbeat, 30_000);
  console.log(`Fatura Signer ${VERSION} ready on ${hostname()} · ${certificate.subject}`);
  for (;;) {
    try {
      const { jobs } = await api('GET', '/jobs?wait=25');
      for (const job of jobs as { id: string; items: { docId: string; canonical: string }[] }[]) {
        try {
          const signatures = [];
          for (const it of job.items) signatures.push({ docId: it.docId, value: await signCades(it.canonical, signer) });
          await api('POST', `/jobs/${job.id}`, { signatures });
          console.log(`signed job ${job.id} (${signatures.length} document(s))`);
        } catch (e) {
          console.error(`job ${job.id} failed:`, (e as Error).message);
          await api('POST', `/jobs/${job.id}`, { error: (e as Error).message }).catch(() => {});
        }
      }
    } catch (e) {
      console.error('poll:', (e as Error).message);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}

main().catch((e) => { console.error(e.message); process.exit(1); });
