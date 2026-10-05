import { describe, expect, it } from 'vitest';
import * as asn1js from 'asn1js';
import * as pkijs from 'pkijs';
import { OID, signCades, softwareSigner, verifyCades } from '../src/signing/cades';
import { generateTestCertificate } from '../src/signing/testCert';

describe('CAdES-BES', () => {
  const tc = generateTestCertificate('Lawtech Labs Egypt LLC', '100483726');
  const content = '"ISSUER""TYPE""B""ID""100483726""NAME""شركة"';

  it('produces a detached signature that verifies against the content', async () => {
    const sig = await signCades(content, await softwareSigner(tc.keyPem, tc.certPem));
    const res = await verifyCades(sig, content);
    expect(res.ok).toBe(true);
    expect(res.subject).toContain('100483726');
  });

  it('fails verification when the content changes', async () => {
    const sig = await signCades(content, await softwareSigner(tc.keyPem, tc.certPem));
    expect((await verifyCades(sig, content + ' ')).ok).toBe(false);
  });

  it('carries the four CAdES-BES signed attributes and is detached', async () => {
    const sig = await signCades(content, await softwareSigner(tc.keyPem, tc.certPem));
    const ci = pkijs.ContentInfo.fromBER(Buffer.from(sig, 'base64'));
    const sd = new pkijs.SignedData({ schema: ci.content });
    expect(sd.encapContentInfo.eContent).toBeUndefined();
    expect(sd.encapContentInfo.eContentType).toBe(OID.digestedData);
    const types = sd.signerInfos[0].signedAttrs!.attributes.map((a) => a.type);
    expect(types).toEqual(expect.arrayContaining([OID.attrContentType, OID.attrSigningTime, OID.attrMessageDigest, OID.attrSigningCertificateV2]));
    expect(asn1js).toBeTruthy();
  });
});
