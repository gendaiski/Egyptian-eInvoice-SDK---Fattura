import { createHash, webcrypto } from 'node:crypto';
import * as asn1js from 'asn1js';
import * as pkijs from 'pkijs';

/**
 * CAdES-BES detached signature over the ETA canonical serialization.
 *
 * SignedData (detached) with signed attributes: content-type, signing-time, message-digest
 * (SHA-256 of the content) and signing-certificate-v2 (ESSCertIDv2). The actual RSA signature
 * over the DER-encoded signed attributes is delegated to a `RawSigner`, so the same code works with
 * a software key (test certificate, .p12) on the server and with a USB token via PKCS#11 in the agent.
 *
 * Content type: the ETA reference implementation signs with eContentType 1.2.840.113549.1.7.5
 * (id-digestedData). It is a parameter so it can be switched if the SDK guide says otherwise.
 */
export const OID = {
  data: '1.2.840.113549.1.7.1',
  digestedData: '1.2.840.113549.1.7.5',
  signedData: '1.2.840.113549.1.7.2',
  sha256: '2.16.840.1.101.3.4.2.1',
  rsaEncryption: '1.2.840.113549.1.1.1',
  attrContentType: '1.2.840.113549.1.9.3',
  attrMessageDigest: '1.2.840.113549.1.9.4',
  attrSigningTime: '1.2.840.113549.1.9.5',
  attrSigningCertificateV2: '1.2.840.113549.1.9.16.2.47',
};

let engineSet = false;
function ensureEngine() {
  if (engineSet) return;
  pkijs.setEngine('node', new pkijs.CryptoEngine({ name: 'node', crypto: webcrypto as unknown as Crypto }));
  engineSet = true;
}

export interface RawSigner {
  /** DER of the signing certificate. */
  certificate: Uint8Array;
  /** RSASSA-PKCS1-v1_5 with SHA-256 over `data`. */
  sign(data: Uint8Array): Promise<Uint8Array>;
}

const buf = (u: Uint8Array) => u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer;

export async function signCades(content: Uint8Array | string, signer: RawSigner, opts: { contentType?: string; signingTime?: Date } = {}): Promise<string> {
  ensureEngine();
  const data = typeof content === 'string' ? new TextEncoder().encode(content) : content;
  const contentType = opts.contentType ?? OID.digestedData;
  const cert = pkijs.Certificate.fromBER(buf(signer.certificate));
  const digest = createHash('sha256').update(data).digest();
  const certHash = createHash('sha256').update(signer.certificate).digest();

  // ESSCertIDv2 with the default hash algorithm (SHA-256, so omitted) and IssuerSerial.
  const essCertIdV2 = new asn1js.Sequence({
    value: [
      new asn1js.OctetString({ valueHex: buf(certHash) }),
      new asn1js.Sequence({
        value: [
          new asn1js.Sequence({ value: [new asn1js.Constructed({ idBlock: { tagClass: 3, tagNumber: 4 }, value: [cert.issuer.toSchema()] })] }),
          cert.serialNumber,
        ],
      }),
    ],
  });
  const signingCertificateV2 = new asn1js.Sequence({ value: [new asn1js.Sequence({ value: [essCertIdV2] })] });

  const attributes = [
    new pkijs.Attribute({ type: OID.attrContentType, values: [new asn1js.ObjectIdentifier({ value: contentType })] }),
    new pkijs.Attribute({ type: OID.attrSigningTime, values: [new asn1js.UTCTime({ valueDate: opts.signingTime ?? new Date() })] }),
    new pkijs.Attribute({ type: OID.attrMessageDigest, values: [new asn1js.OctetString({ valueHex: buf(digest) })] }),
    new pkijs.Attribute({ type: OID.attrSigningCertificateV2, values: [signingCertificateV2] }),
  ];

  const signerInfo = new pkijs.SignerInfo({
    version: 1,
    sid: new pkijs.IssuerAndSerialNumber({ issuer: cert.issuer, serialNumber: cert.serialNumber }),
    digestAlgorithm: new pkijs.AlgorithmIdentifier({ algorithmId: OID.sha256, algorithmParams: new asn1js.Null() }),
    signatureAlgorithm: new pkijs.AlgorithmIdentifier({ algorithmId: OID.rsaEncryption, algorithmParams: new asn1js.Null() }),
    signedAttrs: new pkijs.SignedAndUnsignedAttributes({ type: 0, attributes }),
  });

  // The signature covers the attributes DER-encoded as a SET (not the [0] IMPLICIT form in the structure).
  const toBeSigned = new asn1js.Set({ value: attributes.map((a) => a.toSchema()) }).toBER(false);
  const signature = await signer.sign(new Uint8Array(toBeSigned));
  signerInfo.signature = new asn1js.OctetString({ valueHex: buf(signature) });

  const signedData = new pkijs.SignedData({
    version: 1,
    digestAlgorithms: [new pkijs.AlgorithmIdentifier({ algorithmId: OID.sha256, algorithmParams: new asn1js.Null() })],
    encapContentInfo: new pkijs.EncapsulatedContentInfo({ eContentType: contentType }),
    certificates: [cert],
    signerInfos: [signerInfo],
  });
  const contentInfo = new pkijs.ContentInfo({ contentType: OID.signedData, content: signedData.toSchema(true) });
  return Buffer.from(contentInfo.toSchema().toBER(false)).toString('base64');
}

/** Verifies a detached CAdES signature against the content. Used in tests and as a server-side sanity check. */
export async function verifyCades(signatureB64: string, content: Uint8Array | string): Promise<{ ok: boolean; subject?: string }> {
  ensureEngine();
  const data = typeof content === 'string' ? new TextEncoder().encode(content) : content;
  const ci = pkijs.ContentInfo.fromBER(buf(Buffer.from(signatureB64, 'base64')));
  const sd = new pkijs.SignedData({ schema: ci.content });
  try {
    const res = await sd.verify({ signer: 0, data: buf(data), checkChain: false, extendedMode: true });
    const cert = sd.certificates?.[0] as pkijs.Certificate | undefined;
    const subject = cert?.subject.typesAndValues.map((t) => `${t.type}=${t.value.valueBlock.value}`).join(', ');
    return { ok: !!res.signatureVerified, subject };
  } catch { return { ok: false }; }
}

/** RawSigner backed by a PKCS#8 private key (PEM) and a certificate (PEM or DER). */
export async function softwareSigner(privateKeyPem: string, certificatePemOrDer: string | Uint8Array): Promise<RawSigner> {
  const pemToDer = (pem: string) => Buffer.from(pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, ''), 'base64');
  const key = await webcrypto.subtle.importKey('pkcs8', pemToDer(privateKeyPem), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const certificate = typeof certificatePemOrDer === 'string' ? new Uint8Array(pemToDer(certificatePemOrDer)) : certificatePemOrDer;
  return { certificate, sign: async (d) => new Uint8Array(await webcrypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new Uint8Array(d))) };
}
