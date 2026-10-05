import { z } from 'zod';

/**
 * Runtime configuration. Everything has a safe development default except the secrets,
 * which are generated per process when missing (sessions then reset on restart — fine for tests,
 * never for production: set APP_SECRET and APP_ENCRYPTION_KEY).
 */
const schema = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: z.coerce.number().default(8787),
  /** Postgres connection string. When absent, an embedded Postgres (PGlite) is used. */
  DATABASE_URL: z.string().optional(),
  /** Where the embedded Postgres keeps its files. "memory" keeps it in RAM. */
  PGLITE_DIR: z.string().default(process.env.VERCEL ? '/tmp/fatura-pglite' : './.data/pglite'),
  /** 32+ chars. Signs session and agent tokens. */
  APP_SECRET: z.string().min(32).optional(),
  /** 32-byte key, base64. Encrypts ETA client secrets and signing keys at rest. */
  APP_ENCRYPTION_KEY: z.string().optional(),
  /** Seed demo tenant, staff admin and demo users on an empty database. */
  SEED_DEMO: z.enum(['true', 'false']).default('true'),
  /** Protects /api/cron/tick when called by a scheduler. */
  CRON_SECRET: z.string().optional(),
  /** Allowed browser origins for CORS (comma-separated). Same-origin needs nothing. */
  CORS_ORIGINS: z.string().default(''),
  /** Override ETA hosts (used by tests and for the SIT environment). */
  ETA_ID_URL: z.string().optional(),
  ETA_API_URL: z.string().optional(),
});

export type Env = z.infer<typeof schema>;
let cached: Env | null = null;

export function env(): Env {
  if (!cached) cached = schema.parse(process.env);
  return cached;
}

/** For tests: replace configuration. */
export function setEnv(overrides: Partial<Env>) {
  cached = { ...env(), ...overrides };
}
