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

function hasPlay(text) {
  return /\bplay\s*:\s*async\b/.test(text) || /\bplay\s*:\s*\(/.test(text);
}

function lineIndentAt(text, index) {
  const lineStart = text.lastIndexOf('\n', index) + 1;
  const linePrefix = text.slice(lineStart, index);
  const m = linePrefix.match(/^[ \t]*/);
  return m ? m[0] : '';
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

function findDefaultObject(text) {
  const m = /export\s+const\s+Default\b/.exec(text);
  if (!m) return null;

  const start = m.index;
  const eq = text.indexOf('=', start);
  if (eq === -1) return null;

  const brace = text.indexOf('{', eq);
  if (brace === -1) return null;

  const endBrace = findMatchingBrace(text, brace);
  if (endBrace === -1) return null;

  return { objStart: brace, objEnd: endBrace };
}

function addDefaultPlay(text, { objStart, objEnd }) {
  const baseIndent = lineIndentAt(text, objStart);
  const propIndent = `${baseIndent}  `;
  const propIndent2 = `${propIndent}  `;
  const propIndent3 = `${propIndent2}  `;

  let innerEnd = objEnd - 1;
  while (innerEnd > objStart && /\s/.test(text[innerEnd])) innerEnd--;

  const lastChar = text[innerEnd];
  const insertPos = innerEnd + 1;
  const needsComma = lastChar !== '{' && lastChar !== ',';
  const prefix = needsComma ? ',' : '';

  const insertion =
    `${prefix}\n` +
    `${propIndent}play: async ({ canvasElement }) => {\n` +
    `${propIndent2}if (!canvasElement.querySelector('*')) {\n` +
    `${propIndent3}throw new Error('Story rendered no content.');\n` +
    `${propIndent2}}\n` +
    `${propIndent}},`;

  const before = text.slice(0, insertPos);
  const after = text.slice(objEnd);
  return `${before}${insertion}\n${baseIndent}${after}`;
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
  if (hasPlay(text)) {
    skipped++;
    continue;
  }

  const range = findDefaultObject(text);
  if (!range) {
    failed++;
    console.error(`[playfill] Could not locate Default story object in: ${file}`);
    continue;
  }

  const next = addDefaultPlay(text, range);
  if (next === text) {
    skipped++;
    continue;
  }

  writeText(file, next);
  updated++;
}

console.log(`storybook-add-default-play: updated ${updated}/${files.length} files`);
console.log(`storybook-add-default-play: skipped ${skipped}/${files.length} files`);
console.log(`storybook-add-default-play: failed ${failed}/${files.length} files`);

if (failed > 0) process.exit(1);
