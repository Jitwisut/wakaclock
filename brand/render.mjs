// Render brand SVGs to PNG with sharp. Usage: node render.mjs <sharp module path> <brand dir>
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const [sharpDir, dir] = process.argv.slice(2);
const sharp = createRequire(import.meta.url)(sharpDir);

const jobs = [
  ['atoaxis-icon.svg', [128, 256, 512, 1024]],
  ['atoaxis-icon-green.svg', [512]],
  ['atoaxis-mark.svg', [192, 512]],
  ['atoaxis-apple-touch.svg', [180]],
  ['atoaxis-maskable.svg', [512]],
  ['atoaxis-logo.svg', [null]],
  ['atoaxis-logo-white.svg', [null]],
];

for (const [file, sizes] of jobs) {
  const svg = readFileSync(path.join(dir, file));
  for (const size of sizes) {
    const base = file.replace('.svg', '');
    const name = size ? `${base}-${size}.png` : `${base}.png`;
    const img = size
      ? sharp(svg, { density: 300 }).resize(size, size)
      : sharp(svg, { density: 288 });
    await img.png().toFile(path.join(dir, 'png', name));
    console.log(name);
  }
}
