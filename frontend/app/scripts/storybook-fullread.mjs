import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

function listFiles(dir) {
  const files = [];
  const stack = [dir];

  while (stack.length) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name === '.DS_Store') continue;

      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else {
        files.push(full);
      }
    }
  }

  return files;
}

function normalize(p) {
  return p.split(path.sep).join('/');
}

function formatBytes(bytes) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let idx = 0;
  while (value >= 1024 && idx < units.length - 1) {
    value /= 1024;
    idx += 1;
  }
  const text = idx === 0 ? `${value}` : value.toFixed(2);
  return `${text}${units[idx]}`;
}

const targetDir = process.argv[2] ?? '.storybook';
if (!fs.existsSync(targetDir) || !fs.statSync(targetDir).isDirectory()) {
  console.error(`ERROR: "${targetDir}" is not a directory`);
  process.exit(1);
}

const cwd = process.cwd();
const absTargetDir = path.resolve(cwd, targetDir);
const files = listFiles(absTargetDir).sort();

let totalBytes = 0;
const dirStats = new Map();

for (const filePath of files) {
  const buf = fs.readFileSync(filePath);
  totalBytes += buf.byteLength;

  const rel = normalize(path.relative(cwd, filePath));
  const relDir = normalize(path.dirname(rel));

  const sha256 = crypto.createHash('sha256').update(buf).digest('hex');

  const stat = dirStats.get(relDir) ?? { files: 0, bytes: 0 };
  stat.files += 1;
  stat.bytes += buf.byteLength;
  dirStats.set(relDir, stat);

  // Touch each file: reading + hashing proves full reads without dumping contents.
  // Print one line per file to make it auditable and deterministic.
  console.log(`${rel}\t${buf.byteLength}\t${sha256}`);
}

console.log('\n== Summary ==');
console.log(`dir: ${normalize(targetDir)}`);
console.log(`files: ${files.length}`);
console.log(`bytes: ${totalBytes} (${formatBytes(totalBytes)})`);

console.log('\n== Breakdown (by folder) ==');
const rows = [...dirStats.entries()]
  .map(([dir, stat]) => ({ dir, ...stat }))
  .sort((a, b) => a.dir.localeCompare(b.dir));

for (const row of rows) {
  console.log(`${row.dir}\t${row.files}\t${row.bytes}\t${formatBytes(row.bytes)}`);
}
