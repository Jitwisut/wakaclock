import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const apiUrl = process.env.ATOAXIS_FIGMA_API_URL ?? 'https://api.atoaxis.com';
const define = { __ATOAXIS_API_URL__: JSON.stringify(apiUrl.replace(/\/$/, '')) };

await mkdir('dist', { recursive: true });
await build({
  entryPoints: ['src/code.ts'],
  bundle: true,
  format: 'iife',
  target: 'es2022',
  outfile: 'dist/code.js',
  define,
});
const ui = await build({
  entryPoints: ['src/ui.ts'],
  bundle: true,
  format: 'iife',
  target: 'es2022',
  write: false,
});
const template = await readFile('src/ui.html', 'utf8');
const script = ui.outputFiles[0]?.text;
if (!script) throw new Error('Figma UI build produced no JavaScript');
await writeFile('dist/ui.html', template.replace('<!-- ATOAXIS_UI_SCRIPT -->', `<script>${script}</script>`));
