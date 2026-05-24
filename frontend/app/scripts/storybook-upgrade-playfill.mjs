import fs from 'node:fs';
import path from 'node:path';

function exists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

function readText(p) {
  return fs.readFileSync(p, 'utf8');
}

function writeText(p, text) {
  fs.writeFileSync(p, text, 'utf8');
}

function listFiles(dir) {
  const out = [];
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else out.push(full);
    }
  }
  return out;
}

function normalize(p) {
  return p.split(path.sep).join('/');
}

function ensureExpectImport(text) {
  const importRe = /import\s+\{([^}]+)\}\s+from\s+['"]storybook\/test['"];\n?/;
  const existing = importRe.exec(text);
  if (existing) {
    const names = existing[1]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (names.includes('expect')) return text;
    const nextNames = ['expect', ...names].join(', ');
    return text.replace(importRe, `import { ${nextNames} } from 'storybook/test';\n`);
  }

  const sbReactImportRe = /import\s+type\s+\{[^}]*\}\s+from\s+['"]@storybook\/react['"];\n/;
  const m = sbReactImportRe.exec(text);
  if (m) {
    const insertPos = m.index + m[0].length;
    const before = text.slice(0, insertPos);
    const after = text.slice(insertPos);
    const joiner = after.startsWith('\n') ? '' : '\n';
    return `${before}${joiner}import { expect } from 'storybook/test';\n${after}`;
  }

  const firstImportRe = /^import .*?;\n/m;
  const first = firstImportRe.exec(text);
  if (first) {
    const insertPos = first.index + first[0].length;
    const before = text.slice(0, insertPos);
    const after = text.slice(insertPos);
    const joiner = after.startsWith('\n') ? '' : '\n';
    return `${before}${joiner}import { expect } from 'storybook/test';\n${after}`;
  }

  return `import { expect } from 'storybook/test';\n${text}`;
}

function upgradePlayfill(text) {
  const block =
    /(\n[ \t]*)if\s*\(!canvasElement\.querySelector\(['"]\*['"]\)\)\s*\{\s*\n[ \t]*throw\s+new\s+Error\(['"]Story rendered no content\.['"]\);\s*\n[ \t]*\}/m;

  if (!block.test(text)) return { changed: false, text };

  const next = text.replace(
    block,
    (_m, indent) => `\n${indent}await expect(canvasElement.querySelector('*')).toBe(true);`
  );

  return { changed: next !== text, text: next };
}

if (!exists('.storybook/stories/components')) {
  console.error('Missing .storybook/stories/components directory.');
  process.exit(1);
}

const files = listFiles('.storybook/stories/components')
  .map(normalize)
  .filter((p) => p.endsWith('.stories.ts') || p.endsWith('.stories.tsx'))
  .sort();

let updated = 0;
let skipped = 0;

for (const file of files) {
  const text = readText(file);
  if (!text.includes("throw new Error('Story rendered no content.')")) {
    skipped++;
    continue;
  }

  let next = ensureExpectImport(text);
  const { changed, text: next2 } = upgradePlayfill(next);
  next = next2;

  if (!changed) {
    skipped++;
    continue;
  }

  writeText(file, next);
  updated++;
}

console.log(`storybook-upgrade-playfill: updated ${updated}/${files.length} files`);
console.log(`storybook-upgrade-playfill: skipped ${skipped}/${files.length} files`);
