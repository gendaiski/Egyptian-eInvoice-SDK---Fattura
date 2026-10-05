import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  // The hosted live preview serves files from a sub-path, so it needs relative asset URLs.
  base: process.env.VITE_ROUTER === 'memory' ? './' : '/',
  build: process.env.VITE_ROUTER === 'memory'
    ? { outDir: 'dist-preview', rollupOptions: { output: { inlineDynamicImports: true } }, chunkSizeWarningLimit: 2000 }
    : { outDir: 'dist' },
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: { environment: 'node', include: ['src/**/*.test.ts', 'server/test/**/*.test.ts'], testTimeout: 30000, hookTimeout: 60000 },
});
