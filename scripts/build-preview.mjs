// Builds the hosted live preview: one self-contained HTML page (JS and CSS inlined,
// in-memory routing, no downloads/printing). Output: dist-preview/fatura.html
import { execSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';

execSync('npx vite build', { stdio: 'inherit', env: { ...process.env, VITE_ROUTER: 'memory' } });
const dir = 'dist-preview/assets';
const pick = (ext) => readFileSync(`${dir}/${readdirSync(dir).find((f) => f.endsWith(ext))}`, 'utf8');
const html = readFileSync('dist-preview/index.html', 'utf8');
const theme = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const fonts = html.match(/<link href="(https:\/\/fonts\.googleapis\.com\/css2[^"]+)"/)[1];
const js = pick('.js').replace(/<\/script/gi, '<\\/script');
const css = pick('.css').replace(/<\/style/gi, '<\\/style');
// The charset meta keeps Arabic intact when the file is opened directly from disk.
const page = `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Fatura e-Invoicing</title>
<meta name="description" content="Fatura — Egyptian ETA e-invoicing: website, taxpayer workspace and admin panel.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${fonts}">
<script>${theme}</script>
<style>${css}</style>
<div id="root"></div>
<script type="module">${js}</script>
`;
writeFileSync('dist-preview/fatura.html', page);
console.log(`dist-preview/fatura.html · ${(page.length / 1024).toFixed(0)} KB`);
