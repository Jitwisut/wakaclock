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

function findMatchingBrace(text, startIndex) {
  let depth = 0;

  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  let inLineComment = false;
  let inBlockComment = false;
  let escape = false;

  for (let i = startIndex; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inLineComment) {
      if (ch === '\n') inLineComment = false;
      continue;
    }

    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false;
        i++;
      }
      continue;
    }

    if (inSingle) {
      if (ch === '\\' && !escape) {
        escape = true;
        continue;
      }
      if (ch === "'" && !escape) inSingle = false;
      escape = false;
      continue;
    }

    if (inDouble) {
      if (ch === '\\' && !escape) {
        escape = true;
        continue;
      }
      if (ch === '"' && !escape) inDouble = false;
      escape = false;
      continue;
    }

    if (inTemplate) {
      if (ch === '\\' && !escape) {
        escape = true;
        continue;
      }
      if (ch === '`' && !escape) inTemplate = false;
      escape = false;
      continue;
    }

    if (ch === '/' && next === '/') {
      inLineComment = true;
      i++;
      continue;
    }

    if (ch === '/' && next === '*') {
      inBlockComment = true;
      i++;
      continue;
    }

    if (ch === "'") {
      inSingle = true;
      continue;
    }

    if (ch === '"') {
      inDouble = true;
      continue;
    }

    if (ch === '`') {
      inTemplate = true;
      continue;
    }

    if (ch === '{') {
      depth++;
      continue;
    }

    if (ch === '}') {
      depth--;
      if (depth === 0) return i;
      continue;
    }
  }

  return -1;
}

function findMetaObject(text) {
  const m = /\bconst\s+meta\s*=\s*\{/.exec(text);
  if (!m) return null;

  const brace = text.indexOf('{', m.index);
  if (brace === -1) return null;

  const endBrace = findMatchingBrace(text, brace);
  if (endBrace === -1) return null;

  return { objStart: brace, objEnd: endBrace };
}

function addMetaBaseline(text, { objStart, objEnd }) {
  const inner = text.slice(objStart + 1, objEnd);
  const hasArgs = /\bargs\s*:/.test(inner);
  const hasArgTypes = /\bargTypes\s*:/.test(inner);
  if (hasArgs && hasArgTypes) return { changed: false, text };

  const paramsMatch = /\n([ \t]*)parameters\s*:/.exec(inner);
  const insertPos = paramsMatch ? objStart + 1 + paramsMatch.index : objEnd;

  let indent = '  ';
  if (paramsMatch) indent = paramsMatch[1] ?? indent;
  else {
    const firstProp = /\n([ \t]*)[A-Za-z_$][A-Za-z0-9_$]*\s*:/.exec(inner);
    if (firstProp) indent = firstProp[1] ?? indent;
  }

  let insertion = '';
  if (!hasArgs) insertion += `\n${indent}args: {},`;
  if (!hasArgTypes) insertion += `\n${indent}argTypes: {},`;
  if (!insertion) return { changed: false, text };

  const before = text.slice(0, insertPos);
  const after = text.slice(insertPos);

  return { changed: true, text: `${before}${insertion}${after}` };
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
let failed = 0;

for (const file of files) {
  const text = readText(file);

  const range = findMetaObject(text);
  if (!range) {
    failed++;
    console.error(`[meta] Could not locate meta object in: ${file}`);
    continue;
  }

  const { changed, text: next } = addMetaBaseline(text, range);
  if (!changed) {
    skipped++;
    continue;
  }

  writeText(file, next);
  updated++;
}

console.log(`storybook-meta-baseline: updated ${updated}/${files.length} files`);
console.log(`storybook-meta-baseline: skipped ${skipped}/${files.length} files`);
console.log(`storybook-meta-baseline: failed ${failed}/${files.length} files`);

if (failed > 0) process.exit(1);
