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

function downgradePlayLine(text) {
  const lineRe =
    /^(\s*)await\s+expect\(canvasElement\.querySelector\(['"]\*['"]\)\)\.toBeTruthy\(\);\s*$/m;

  if (!lineRe.test(text)) return { changed: false, text };

  const next = text.replace(lineRe, (_m, indent) => {
    const indent2 = `${indent}  `;
    return (
      `${indent}if (!canvasElement.querySelector('*')) {\n` +
      `${indent2}throw new Error('Story rendered no content.');\n` +
      `${indent}}`
    );
  });

  return { changed: next !== text, text: next };
}

function removeStandaloneExpectImport(text) {
  if (/\bexpect\s*\(/.test(text)) return text;
  return text.replace(/import\s+\{\s*expect\s*\}\s+from\s+['"]storybook\/test['"];\n\n?/m, '');
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
  if (!text.includes("await expect(canvasElement.querySelector('*')).toBe(true)")) {
    skipped++;
    continue;
  }

  let next = text;
  const res = downgradePlayLine(next);
  next = res.text;
  next = removeStandaloneExpectImport(next);

  if (!res.changed || next === text) {
    skipped++;
    continue;
  }

  writeText(file, next);
  updated++;
}

console.log(`storybook-downgrade-playfill: updated ${updated}/${files.length} files`);
console.log(`storybook-downgrade-playfill: skipped ${skipped}/${files.length} files`);
