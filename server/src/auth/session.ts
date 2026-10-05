import { randomBytes } from 'node:crypto';
import type { Context, MiddlewareHandler } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { SignJWT, jwtVerify } from 'jose';
import { getDb } from '../db/client';
import { env } from '../env';
import { HttpError } from '../http';

export interface SessionUser {
  id: string; email: string; name: string;
  staffRole: string | null;
  tenantId: string | null;
  role: string | null; // membership role in the active tenant
}

const COOKIE = 'fatura_session';
const TTL = 60 * 60 * 24 * 7;
let devSecret: Uint8Array | null = null;
const secret = () => (env().APP_SECRET ? new TextEncoder().encode(env().APP_SECRET) : (devSecret ??= randomBytes(32)));

export async function issueSession(c: Context, userId: string, tenantId: string | null) {
  const jwt = await new SignJWT({ tid: tenantId }).setProtectedHeader({ alg: 'HS256' }).setSubject(userId).setIssuedAt().setExpirationTime(`${TTL}s`).sign(secret());
  setCookie(c, COOKIE, jwt, { httpOnly: true, sameSite: 'Lax', secure: c.req.url.startsWith('https'), path: '/', maxAge: TTL });
  return jwt;
}

export function clearSession(c: Context) { deleteCookie(c, COOKIE, { path: '/' }); }

/** Reads the session from the cookie or an `Authorization: Bearer <jwt>` header. Never throws. */
export async function readSession(c: Context): Promise<SessionUser | null> {
  const raw = getCookie(c, COOKIE) ?? c.req.header('authorization')?.match(/^Bearer (eyJ[\w.-]+)$/)?.[1];
  if (!raw) return null;
  try {
    const { payload } = await jwtVerify(raw, secret());
    const db = await getDb();
    const [u] = await db.query<{ id: string; email: string; name: string; staff_role: string | null }>('SELECT id, email, name, staff_role FROM users WHERE id = $1', [payload.sub]);
    if (!u) return null;
    const tid = (payload.tid as string | null) ?? null;
    let role: string | null = null;
    if (tid) {
      const [m] = await db.query<{ role: string }>('SELECT role FROM memberships WHERE user_id = $1 AND tenant_id = $2', [u.id, tid]);
      role = m?.role ?? (u.staff_role ? 'Support' : null);
      if (!role) return { id: u.id, email: u.email, name: u.name, staffRole: u.staff_role, tenantId: null, role: null };
    }
    return { id: u.id, email: u.email, name: u.name, staffRole: u.staff_role, tenantId: tid, role };
  } catch { return null; }
}

declare module 'hono' {
  interface ContextVariableMap { user: SessionUser | null }
}

export const attachUser: MiddlewareHandler = async (c, next) => { c.set('user', await readSession(c)); await next(); };

export function requireUser(c: Context): SessionUser {
  const u = c.get('user');
  if (!u) throw new HttpError(401, 'unauthenticated', 'Sign in to continue.');
  return u;
}

const WRITE_ROLES = ['Owner', 'Admin', 'Accountant'];
/** The signed-in user's active tenant. `write` excludes Sales and Viewer. */
export function requireTenant(c: Context, opts: { write?: boolean; roles?: string[] } = {}): SessionUser & { tenantId: string } {
  const u = requireUser(c);
  if (!u.tenantId) throw new HttpError(403, 'no_tenant', 'This account has no company workspace.');
  if (u.staffRole && !u.role) throw new HttpError(403, 'forbidden', 'Staff access to workspaces is read-only.');
  const allowed = opts.roles ?? (opts.write ? WRITE_ROLES : null);
  if (allowed && !allowed.includes(u.role ?? '')) throw new HttpError(403, 'forbidden', `Your role (${u.role}) cannot do this.`);
  return u as SessionUser & { tenantId: string };
}

export function requireStaff(c: Context, roles?: string[]): SessionUser {
  const u = requireUser(c);
  if (!u.staffRole) throw new HttpError(403, 'forbidden', 'Fatura staff only.');
  if (roles && !roles.includes(u.staffRole)) throw new HttpError(403, 'forbidden', `Requires ${roles.join(' or ')}.`);
  return u;
}
