import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = join(root, '.data', 'beta-secure');
mkdirSync(join(root, '.data'), { recursive: true });
const secretFile = join(root, '.data', 'beta-local-secrets.json');
if (!existsSync(secretFile)) {
  writeFileSync(secretFile, JSON.stringify({ appSecret: randomBytes(36).toString('base64url'), encryptionKey: randomBytes(32).toString('base64') }), { flag: 'wx', mode: 0o600 });
}
const secrets = JSON.parse(readFileSync(secretFile, 'utf8'));
if (typeof secrets.appSecret !== 'string' || secrets.appSecret.length < 32 || Buffer.from(secrets.encryptionKey ?? '', 'base64').length !== 32) {
  throw new Error(`Local secrets file is invalid: ${secretFile}. Restore it from backup; do not delete the database.`);
}
const localEnv = {
  ...process.env,
  NODE_ENV: 'development',
  DATABASE_URL: '',
  PGLITE_DIR: dataDir,
  APP_SECRET: secrets.appSecret,
  APP_ENCRYPTION_KEY: secrets.encryptionKey,
  PORT: process.env.FATTURA_BETA_PORT ?? process.env.FATURA_BETA_PORT ?? '8787',
  SEED_DEMO: 'true',
  WORKER: 'off',
  ETA_PRODUCTION_SUBMISSION_ENABLED: 'false',
  PAYMENT_SIMULATOR_ENABLED: 'true',
  VITE_DATA: 'api',
  VITE_SHOW_DEMO_LOGINS: 'true',
};
const run = (args) => {
  const result = spawnSync(process.execPath, args, { cwd: root, env: localEnv, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
};

console.log('Building Fattura Beta for a local-only review…');
run(['scripts/build-server.mjs', 'server']);
run(['node_modules/vite/bin/vite.js', 'build']);
console.log(`Open http://127.0.0.1:${localEnv.PORT}/ on this computer. The Beta uses ${localEnv.PGLITE_DIR}.`);
console.log('Test payments are simulated. Production ETA submission is disabled. Press Ctrl+C to stop.');
run(['dist-server/server.mjs']);
