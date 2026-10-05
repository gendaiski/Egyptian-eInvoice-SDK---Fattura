/**
 * Schema. Entities keep their full shape in a JSONB `data` column (it mirrors the front-end model
 * in src/store/model.ts one-to-one), with the fields we filter, join or enforce uniqueness on
 * promoted to real columns. Append new migrations; never edit applied ones.
 */
export const MIGRATIONS: string[] = [
  `
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  staff_role TEXT,
  mfa BOOLEAN NOT NULL DEFAULT false,
  last_active TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE memberships (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  PRIMARY KEY (user_id, tenant_id)
);
CREATE TABLE tenant_config (
  tenant_id TEXT PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  company JSONB NOT NULL,
  integration JSONB NOT NULL,
  signing JSONB NOT NULL,
  settings JSONB NOT NULL,
  onboarded BOOLEAN NOT NULL DEFAULT false,
  eta_client_secret_enc TEXT,
  signing_key_enc TEXT
);
CREATE TABLE records (
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  id TEXT NOT NULL,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, kind, id)
);
CREATE TABLE documents (
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  direction TEXT NOT NULL,
  status TEXT NOT NULL,
  internal_id TEXT NOT NULL,
  eta_uuid TEXT,
  issued_at TIMESTAMPTZ NOT NULL,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id)
);
CREATE INDEX documents_status ON documents (tenant_id, status);
CREATE UNIQUE INDEX documents_uuid ON documents (tenant_id, eta_uuid) WHERE eta_uuid IS NOT NULL;
CREATE UNIQUE INDEX documents_internal_id ON documents (tenant_id, direction, internal_id) WHERE status NOT IN ('Invalid');
CREATE TABLE signing_jobs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  items JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  claimed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error TEXT
);
CREATE INDEX signing_jobs_pending ON signing_jobs (tenant_id, status);
CREATE TABLE agents (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  version TEXT,
  host TEXT,
  last_seen TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked BOOLEAN NOT NULL DEFAULT false
);
CREATE TABLE api_keys (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  created_by TEXT,
  last_used TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked BOOLEAN NOT NULL DEFAULT false
);
CREATE TABLE webhooks (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  secret_enc TEXT NOT NULL,
  events JSONB NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE outbox (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  event TEXT NOT NULL,
  payload JSONB NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivered_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE platform (
  kind TEXT NOT NULL,
  id TEXT NOT NULL,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (kind, id)
);
CREATE TABLE audit (
  id TEXT PRIMARY KEY,
  at TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor TEXT NOT NULL,
  tenant_id TEXT,
  action TEXT NOT NULL,
  target TEXT NOT NULL,
  ip TEXT
);
CREATE INDEX audit_at ON audit (at DESC);
CREATE TABLE eta_tokens (
  tenant_id TEXT PRIMARY KEY,
  env TEXT NOT NULL,
  token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);
`,
];
