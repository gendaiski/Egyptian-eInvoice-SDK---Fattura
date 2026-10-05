import { createCipheriv, createDecipheriv, createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { env } from '../env';

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

let generatedKey: Buffer | null = null;
function encKey(): Buffer {
  const k = env().APP_ENCRYPTION_KEY;
  if (k) {
    const buf = Buffer.from(k, 'base64');
    if (buf.length !== 32) throw new Error('APP_ENCRYPTION_KEY must be 32 bytes, base64-encoded');
    return buf;
  }
  if (env().NODE_ENV === 'production' && !process.env.VERCEL) throw new Error('APP_ENCRYPTION_KEY is required in production');
  return (generatedKey ??= createHash('sha256').update(env().APP_SECRET ?? 'fatura-dev-only-key').digest());
}

/** AES-256-GCM. Output: base64(iv | tag | ciphertext). Used for ETA client secrets, signing keys, webhook secrets. */
export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', encKey(), iv);
  const body = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), body]).toString('base64');
}

export function decrypt(enc: string): string {
  const raw = Buffer.from(enc, 'base64');
  const d = createDecipheriv('aes-256-gcm', encKey(), raw.subarray(0, 12));
  d.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString('utf8');
}

/** scrypt password hash: "scrypt$<salt b64>$<hash b64>". */
export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  const h = await scrypt(pw, salt, 64);
  return `scrypt$${salt.toString('base64')}$${h.toString('base64')}`;
}

export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const [alg, salt, hash] = stored.split('$');
  if (alg !== 'scrypt' || !salt || !hash) return false;
  const h = await scrypt(pw, Buffer.from(salt, 'base64'), 64);
  const expected = Buffer.from(hash, 'base64');
  return h.length === expected.length && timingSafeEqual(h, expected);
}

export const sha256 = (s: string | Uint8Array) => createHash('sha256').update(s).digest('hex');

/** URL-safe random token with a readable prefix, e.g. "fat_live_…" for API keys. */
export const token = (prefix: string, bytes = 24) => `${prefix}_${randomBytes(bytes).toString('base64url')}`;

/** Short sortable-ish ids for rows. */
export const newId = (prefix = '') => prefix + Date.now().toString(36) + randomBytes(5).toString('hex');
