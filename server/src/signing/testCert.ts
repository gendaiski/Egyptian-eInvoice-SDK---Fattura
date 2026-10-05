import { generateKeyPairSync, randomBytes } from 'node:crypto';
import forge from 'node-forge';

/**
 * Self-signed RSA-2048 certificate for the "test certificate" signing method (simulator and
 * pre-production trials only). Production documents must be signed with a certificate issued to the
 * company by a licensed Egyptian CA, held on a USB token or HSM.
 */
export function generateTestCertificate(companyName: string, rin: string) {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const keyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  const pub = forge.pki.publicKeyFromPem(publicKey.export({ type: 'spki', format: 'pem' }).toString());
  const cert = forge.pki.createCertificate();
  cert.publicKey = pub;
  cert.serialNumber = '01' + randomBytes(8).toString('hex');
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date(Date.now() + 365 * 86_400_000);
  const utf8 = forge.asn1.Type.UTF8 as unknown as forge.asn1.Class;
  const attrs = [{ name: 'commonName', value: forge.util.encodeUtf8(`${companyName} (TEST)`), valueTagClass: utf8 }, { shortName: 'OU', value: 'Fatura test signing' }, { name: 'serialNumber', value: rin }, { name: 'countryName', value: 'EG' }] as forge.pki.CertificateField[];
  cert.setSubject(attrs);
  cert.setIssuer([{ name: 'commonName', value: 'Fatura Test CA - not for production' }, { name: 'countryName', value: 'EG' }]);
  cert.setExtensions([{ name: 'keyUsage', digitalSignature: true, nonRepudiation: true }]);
  cert.sign(forge.pki.privateKeyFromPem(keyPem), forge.md.sha256.create());
  const certPem = forge.pki.certificateToPem(cert);
  return {
    keyPem,
    certPem,
    info: { subject: `CN=${companyName} (TEST), SERIALNUMBER=${rin}`, issuer: 'Fatura Test CA - not for production', serial: cert.serialNumber.toUpperCase().match(/.{2}/g)!.slice(0, 6).join(' '), expires: cert.validity.notAfter.toISOString().slice(0, 10) },
  };
}
