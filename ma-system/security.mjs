import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { SignJWT, jwtVerify } from 'jose';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';

const scrypt = promisify(scryptCb);
const cookieName = 'ma_session';
const ttl = 60 * 60 * 24 * 7;
let secretsPromise;
export const id = (prefix = '') => prefix + randomUUID();
export const checksum = (data) => createHash('sha256').update(data).digest('hex');

async function secrets() {
  if (!secretsPromise) secretsPromise = loadSecrets();
  return secretsPromise;
}
async function loadSecrets() {
  const session = process.env.MA_SESSION_SECRET;
  const key = process.env.MA_ENCRYPTION_KEY;
  if (session || key || process.env.MA_DATABASE_URL || process.env.NODE_ENV === 'production') {
    if (!session || session.length < 32 || !key || Buffer.from(key, 'base64').length !== 32) {
      throw new Error('Set MA_SESSION_SECRET (32+ characters) and MA_ENCRYPTION_KEY (32 bytes, base64) for production/Postgres.');
    }
    return { session: new TextEncoder().encode(session), encryption: Buffer.from(key, 'base64') };
  }
  // Local-only self-hosting: stable private keys live next to the persistent database,
  // outside Git. A restart never silently makes uploaded documents unreadable.
  const dir = resolve(process.env.MA_DATA_DIR || './data');
  const file = resolve(dir, 'local-secrets.json');
  await mkdir(dir, { recursive: true });
  let record;
  try { record = JSON.parse(await readFile(file, 'utf8')); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    record = { session: randomBytes(48).toString('base64'), encryption: randomBytes(32).toString('base64') };
    try { await writeFile(file, JSON.stringify(record), { flag: 'wx', mode: 0o600 }); }
    catch (race) { if (race.code !== 'EEXIST') throw race; record = JSON.parse(await readFile(file, 'utf8')); }
  }
  const encryption = Buffer.from(record.encryption || '', 'base64');
  const sessionKey = Buffer.from(record.session || '', 'base64');
  if (encryption.length !== 32 || sessionKey.length < 32) throw new Error('Invalid local key file; restore it from backup.');
  return { session: sessionKey, encryption };
}

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}
export async function verifyPassword(password, encoded) {
  const [algorithm, salt, hash] = encoded.split('$');
  if (algorithm !== 'scrypt' || !salt || !hash) return false;
  const candidate = await scrypt(password, Buffer.from(salt, 'base64'), 64);
  const actual = Buffer.from(hash, 'base64');
  return candidate.length === actual.length && timingSafeEqual(candidate, actual);
}
export async function encrypt(content) {
  const { encryption } = await secrets();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryption, iv);
  const body = Buffer.concat([cipher.update(content), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64');
}
export async function decrypt(encoded) {
  const { encryption } = await secrets();
  const raw = Buffer.from(encoded, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', encryption, raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]);
}
export async function issueSession(c, user) {
  const { session } = await secrets();
  const jwt = await new SignJWT({ role: user.role }).setProtectedHeader({ alg: 'HS256' }).setSubject(user.id).setIssuedAt().setExpirationTime(`${ttl}s`).sign(session);
  setCookie(c, cookieName, jwt, { httpOnly: true, sameSite: 'Lax', secure: c.req.url.startsWith('https:'), path: '/', maxAge: ttl });
}
export function clearSession(c) { deleteCookie(c, cookieName, { path: '/' }); }
export async function sessionUser(c, db) {
  const raw = getCookie(c, cookieName);
  if (!raw) return null;
  try {
    const { payload } = await jwtVerify(raw, (await secrets()).session);
    const [user] = await db.query('SELECT id,name,email,role FROM ma_users WHERE id = $1', [payload.sub]);
    return user || null;
  } catch { return null; }
}
