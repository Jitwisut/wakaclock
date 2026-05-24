import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_IGNORED_DIRS = new Set(['.next', 'node_modules', 'public', 'test-results', '.git']);

function normalize(p) {
  return p.split(path.sep).join('/');
}

function isIgnoredDirName(name, ignoredDirs) {
  return ignoredDirs.has(name);
}

function walkFiles(rootDir, ignoredDirs) {
  const out = [];
  const stack = [rootDir];

  while (stack.length) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (isIgnoredDirName(entry.name, ignoredDirs)) continue;
        stack.push(full);
        continue;
      }
      if (entry.isFile()) out.push(full);
    }
  }

  return out;
}

function sha256File(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function topFolder(relPath) {
  const parts = relPath.split('/');
  return parts[0] ?? '.';
}

function humanBytes(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let b = bytes / 1024;
  let u = 0;
  while (b >= 1024 && u < units.length - 1) {
    b /= 1024;
    u++;
  }
  return `${b.toFixed(2)}${units[u]}`;
}

function parseArgs() {
  const argv = process.argv.slice(2);
  const flags = new Set(argv.filter((a) => a.startsWith('--')));
  const root = argv.find((a) => !a.startsWith('--')) ?? '.';
  const ignored = new Set(DEFAULT_IGNORED_DIRS);

  const ignoreFlag = argv.find((a) => a.startsWith('--ignore='));
  if (ignoreFlag) {
    const value = ignoreFlag.split('=')[1] ?? '';
    for (const part of value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean))
      ignored.add(part);
  }

  return {
    root,
    json: flags.has('--json'),
    ignored,
  };
}

const args = parseArgs();
const rootDir = path.resolve(process.cwd(), args.root);

const files = walkFiles(rootDir, args.ignored)
  .map((p) => path.relative(process.cwd(), p))
  .map(normalize)
  .sort();

let totalBytes = 0;
const perFolder = {};

const results = files.map((file) => {
  const stat = fs.statSync(file);
  const bytes = stat.size;
  totalBytes += bytes;

  const folder = topFolder(file);
  if (!perFolder[folder]) perFolder[folder] = { files: 0, bytes: 0 };
  perFolder[folder].files += 1;
  perFolder[folder].bytes += bytes;

  return {
    file,
    bytes,
    sha256: sha256File(file),
  };
});

if (args.json) {
  console.log(
    JSON.stringify(
      {
        root: normalize(path.relative(process.cwd(), rootDir) || '.'),
        ignoredDirs: Array.from(args.ignored).sort(),
        files: results,
        summary: {
          files: results.length,
          bytes: totalBytes,
          perFolder,
        },
      },
      null,
      2
    )
  );
  process.exit(0);
}

for (const r of results) {
  console.log(`${r.file}\t${r.bytes}\t${r.sha256}`);
}

console.log('\n== Summary ==');
console.log(`root: ${normalize(path.relative(process.cwd(), rootDir) || '.')}`);
console.log(`ignored dirs: ${Array.from(args.ignored).sort().join(', ')}`);
console.log(`files: ${results.length}`);
console.log(`bytes: ${totalBytes} (${humanBytes(totalBytes)})`);

console.log('\n== Breakdown (top-level) ==');
for (const [folder, summary] of Object.entries(perFolder).sort((a, b) =>
  a[0].localeCompare(b[0])
)) {
  console.log(`${folder}\t${summary.files}\t${summary.bytes}\t${humanBytes(summary.bytes)}`);
}
