// Bundles the API for Node (dist-server/server.mjs) and the signer agent (signer-agent/dist/fatura-signer.mjs).
import { build } from 'esbuild';

const common = { bundle: true, platform: 'node', target: 'node20', format: 'esm', sourcemap: true, logLevel: 'info',
  banner: { js: "import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);" } };

const what = process.argv[2] ?? 'all';
if (what === 'all' || what === 'server') {
  await build({ ...common, entryPoints: ['server/node.ts'], outfile: 'dist-server/server.mjs', external: ['@electric-sql/pglite', 'pg-native'] });
}
if (what === 'all' || what === 'signer') {
  await build({ ...common, entryPoints: ['signer-agent/agent.ts'], outfile: 'signer-agent/dist/fatura-signer.mjs', external: ['pkcs11js'] });
}
