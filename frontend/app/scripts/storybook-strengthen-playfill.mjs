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

function hasLegacyPlayfill(text) {
  return text.includes("throw new Error('Story rendered no content.')");
}

function replaceLegacyPlayfill(text) {
  const blockRe =
    /(\n[ \t]*)if\s*\(!canvasElement\.querySelector\(['"]\*['"]\)\)\s*\{\s*\n[ \t]*throw\s+new\s+Error\(['"]Story rendered no content\.['"]\);\s*\n[ \t]*\}\s*/m;

  if (!blockRe.test(text)) return { changed: false, text };

  const next = text.replace(blockRe, (_m, indent) => {
    const indent2 = `${indent}  `;
    const indent3 = `${indent2}  `;

    return (
      `\n${indent}const root = canvasElement;\n` +
      `${indent}if (!root.querySelector('*')) {\n` +
      `${indent2}throw new Error('Story rendered no DOM nodes.');\n` +
      `${indent}}\n` +
      `${indent}\n` +
      `${indent}// Best-effort interaction smoke.\n` +
      `${indent}const button = root.querySelector('button:not([disabled])');\n` +
      `${indent}if (button instanceof HTMLElement) {\n` +
      `${indent2}button.focus();\n` +
      `${indent2}button.click();\n` +
      `${indent2}return;\n` +
      `${indent}}\n` +
      `${indent}\n` +
      `${indent}const input = root.querySelector(\n` +
      `${indent2}'input:not([disabled]):not([type="file"]):not([type="color"]), textarea:not([disabled]), select:not([disabled])',\n` +
      `${indent});\n` +
      `${indent}if (!(input instanceof HTMLElement)) return;\n` +
      `${indent}\n` +
      `${indent}input.focus();\n` +
      `${indent}if (input instanceof HTMLInputElement) {\n` +
      `${indent2}if (input.type === 'checkbox' || input.type === 'radio') {\n` +
      `${indent3}input.click();\n` +
      `${indent2}} else {\n` +
      `${indent3}input.value = (input.value ?? '') + 'a';\n` +
      `${indent3}input.dispatchEvent(new Event('input', { bubbles: true }));\n` +
      `${indent2}}\n` +
      `${indent}}\n`
    );
  });

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
  if (!hasLegacyPlayfill(text)) {
    skipped++;
    continue;
  }

  const { changed, text: next } = replaceLegacyPlayfill(text);
  if (!changed) {
    skipped++;
    continue;
  }

  writeText(file, next);
  updated++;
}

console.log(`storybook-strengthen-playfill: updated ${updated}/${files.length} files`);
console.log(`storybook-strengthen-playfill: skipped ${skipped}/${files.length} files`);
