import fs from 'node:fs';
import path from 'node:path';

function normalize(p) {
  return p.split(path.sep).join('/');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function listJsonFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => path.join(dir, name))
    .sort((a, b) => a.localeCompare(b));
}

const collectDir = path.resolve(process.cwd(), process.argv[2] ?? '.storybook/.a11y-baseline');
const outFile = path.resolve(process.cwd(), process.argv[3] ?? '.storybook/a11y-baseline.json');

const files = listJsonFiles(collectDir);
if (files.length === 0) {
  console.error(
    `ERROR: No JSON files found in ${normalize(path.relative(process.cwd(), collectDir))}`
  );
  console.error(
    `Run: cross-env STORYBOOK_RUN_A11Y=1 STORYBOOK_A11Y_MODE=collect npm run storybook:test`
  );
  process.exit(1);
}

const stories = {};

for (const file of files) {
  const data = readJson(file);
  const id = typeof data?.id === 'string' ? data.id : null;
  const violations = data?.violations;

  if (!id || !isRecord(violations)) continue;

  const out = {};
  for (const [ruleId, count] of Object.entries(violations)) {
    const n = typeof count === 'number' ? count : Number(count);
    if (!Number.isFinite(n)) continue;
    out[ruleId] = Math.max(0, Math.floor(n));
  }

  stories[id] = Object.fromEntries(Object.entries(out).sort((a, b) => a[0].localeCompare(b[0])));
}

const baseline = {
  version: 1,
  generatedAt: new Date().toISOString(),
  stories: Object.fromEntries(Object.entries(stories).sort((a, b) => a[0].localeCompare(b[0]))),
};

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, `${JSON.stringify(baseline, null, 2)}\n`);

console.log('Wrote Storybook a11y baseline.');
console.log(`collectDir: ${normalize(path.relative(process.cwd(), collectDir))}`);
console.log(`outFile:    ${normalize(path.relative(process.cwd(), outFile))}`);
console.log(`stories:    ${Object.keys(baseline.stories).length}`);
