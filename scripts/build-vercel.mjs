// Produces .vercel/output (Vercel Build Output API v3):
//   static/            the front end built in API mode (VITE_DATA=api)
//   functions/api.func the Hono API bundled for Node, with PGlite copied alongside
// Run after `VITE_DATA=api vite build` (npm run build:vercel does both).
import { build } from 'esbuild';
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';

const out = '.vercel/output';
if (!existsSync('dist/index.html')) throw new Error('Build the front end first: VITE_DATA=api vite build');
rmSync(out, { recursive: true, force: true });
mkdirSync(`${out}/static`, { recursive: true });
cpSync('dist', `${out}/static`, { recursive: true });

const fn = `${out}/functions/api.func`;
mkdirSync(fn, { recursive: true });
await build({
  entryPoints: ['server/vercel.ts'], outfile: `${fn}/index.mjs`, bundle: true, platform: 'node', target: 'node22', format: 'esm',
  external: ['@electric-sql/pglite', 'pg-native'], logLevel: 'info',
  banner: { js: "import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);" },
});
// PGlite loads its WASM and data files from its own package directory, so ship it unbundled.
cpSync('node_modules/@electric-sql/pglite', `${fn}/node_modules/@electric-sql/pglite`, { recursive: true });
writeFileSync(`${fn}/package.json`, JSON.stringify({ type: 'module' }));
writeFileSync(`${fn}/.vc-config.json`, JSON.stringify({
  runtime: 'nodejs22.x', handler: 'index.mjs', launcherType: 'Nodejs', shouldAddHelpers: false, supportsResponseStreaming: true, maxDuration: 60, memory: 1024,
}, null, 2));

writeFileSync(`${out}/config.json`, JSON.stringify({
  version: 3,
  routes: [
    { src: '^/assets/(.*)$', headers: { 'cache-control': 'public, max-age=31536000, immutable' }, continue: true },
    { src: '^/api(/.*)?$', dest: '/api' },
    { handle: 'filesystem' },
    { src: '^/(.*)$', dest: '/index.html' },
  ],
  // Recurring invoices, ETA polling, code-request refresh and webhook delivery. Daily works on every plan;
  // on Pro, tighten to every 5–15 minutes.
  crons: [{ path: '/api/cron/tick', schedule: '0 5 * * *' }],
}, null, 2));
console.log('Vercel output ready in', out);
