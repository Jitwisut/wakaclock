import fs from 'node:fs';
import path from 'node:path';

import ts from 'typescript';

function exists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

function normalizePath(p) {
  return p.split(path.sep).join('/');
}

function listFiles(dir) {
  const out = [];
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    if (!current) continue;
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else out.push(full);
    }
  }
  return out;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const json = args.includes('--json');
  const dirArg = args.find((value) => value.startsWith('--dir='));
  const rootArg = args.find((value) => value.startsWith('--root='));

  const root = rootArg
    ? path.resolve(process.cwd(), rootArg.slice('--root='.length))
    : process.cwd();
  const dir = dirArg
    ? path.resolve(root, dirArg.slice('--dir='.length))
    : path.resolve(root, '.storybook', 'stories');

  return { dir, json, root };
}

function scriptKindForPath(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.tsx') return ts.ScriptKind.TSX;
  if (ext === '.ts') return ts.ScriptKind.TS;
  if (ext === '.jsx') return ts.ScriptKind.JSX;
  if (ext === '.js') return ts.ScriptKind.JS;
  if (ext === '.mjs' || ext === '.cjs') return ts.ScriptKind.JS;
  if (ext === '.mts' || ext === '.cts') return ts.ScriptKind.TS;
  return ts.ScriptKind.Unknown;
}

function extractSpecifiersFromTs(filePath, text) {
  const sourceFile = ts.createSourceFile(
    filePath,
    text,
    ts.ScriptTarget.Latest,
    true,
    scriptKindForPath(filePath)
  );

  const out = [];
  const visit = (node) => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      if (node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier)) {
        out.push(node.moduleSpecifier.text);
      }
    }

    if (ts.isImportEqualsDeclaration(node)) {
      const ref = node.moduleReference;
      if (
        ts.isExternalModuleReference(ref) &&
        ref.expression &&
        ts.isStringLiteralLike(ref.expression)
      ) {
        out.push(ref.expression.text);
      }
    }

    if (ts.isCallExpression(node)) {
      const [firstArg] = node.arguments;
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        if (firstArg && ts.isStringLiteralLike(firstArg)) out.push(firstArg.text);
      }

      if (ts.isIdentifier(node.expression) && node.expression.text === 'require') {
        if (firstArg && ts.isStringLiteralLike(firstArg)) out.push(firstArg.text);
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return out;
}

function extractSpecifiersFromMdx(text) {
  const out = [];
  const fromRe = /\b(?:import|export)\s+[^;]*?\sfrom\s+['"]([^'"]+)['"]/g;
  const dynamicRe = /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g;

  let match;
  while ((match = fromRe.exec(text))) out.push(match[1]);
  while ((match = dynamicRe.exec(text))) out.push(match[1]);

  return out;
}

function resolveLocalSpecifier(specifier, fileDir, repoRoot) {
  if (specifier.startsWith('@/')) {
    return path.resolve(repoRoot, specifier.slice(2));
  }
  if (specifier.startsWith('./') || specifier.startsWith('../')) {
    return path.resolve(fileDir, specifier);
  }
  return null;
}

const KNOWN_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.mts',
  '.cts',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.css',
  '.mdx',
]);

function resolveExistingPath(basePath) {
  const ext = path.extname(basePath);
  const hasKnownExt = KNOWN_EXTENSIONS.has(ext.toLowerCase());
  const direct = hasKnownExt ? basePath : null;

  if (direct && exists(direct)) return direct;
  if (!hasKnownExt && exists(basePath) && fs.statSync(basePath).isFile()) return basePath;

  const candidates = hasKnownExt
    ? []
    : [
        `${basePath}.ts`,
        `${basePath}.tsx`,
        `${basePath}.mts`,
        `${basePath}.cts`,
        `${basePath}.js`,
        `${basePath}.jsx`,
        `${basePath}.mjs`,
        `${basePath}.cjs`,
        `${basePath}.json`,
        `${basePath}.css`,
        `${basePath}.mdx`,
      ];

  for (const candidate of candidates) {
    if (exists(candidate)) return candidate;
  }

  if (exists(basePath) && fs.statSync(basePath).isDirectory()) {
    const indexCandidates = [
      path.join(basePath, 'index.ts'),
      path.join(basePath, 'index.tsx'),
      path.join(basePath, 'index.mts'),
      path.join(basePath, 'index.cts'),
      path.join(basePath, 'index.js'),
      path.join(basePath, 'index.jsx'),
      path.join(basePath, 'index.mjs'),
      path.join(basePath, 'index.cjs'),
    ];
    for (const candidate of indexCandidates) {
      if (exists(candidate)) return candidate;
    }
  }

  return null;
}

const { dir: storiesDir, json, root } = parseArgs();

if (!exists(storiesDir)) {
  const message = `Missing stories directory: ${normalizePath(storiesDir)}`;
  if (json) {
    process.stdout.write(JSON.stringify({ ok: false, error: message }, null, 2));
    process.stdout.write('\n');
  } else {
    process.stderr.write(`${message}\n`);
  }
  process.exit(1);
}

const files = listFiles(storiesDir).filter((filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  return (
    ext === '.ts' ||
    ext === '.tsx' ||
    ext === '.mts' ||
    ext === '.cts' ||
    ext === '.js' ||
    ext === '.jsx' ||
    ext === '.mjs' ||
    ext === '.cjs' ||
    ext === '.mdx'
  );
});

const missing = [];
let checked = 0;
let totalSpecifiers = 0;

for (const filePath of files) {
  const ext = path.extname(filePath).toLowerCase();
  const text = fs.readFileSync(filePath, 'utf8');

  const specifiers =
    ext === '.mdx' ? extractSpecifiersFromMdx(text) : extractSpecifiersFromTs(filePath, text);

  totalSpecifiers += specifiers.length;

  const fileDir = path.dirname(filePath);
  for (const specifier of specifiers) {
    const localBase = resolveLocalSpecifier(specifier, fileDir, root);
    if (!localBase) continue;
    checked += 1;

    const resolved = resolveExistingPath(localBase);
    if (resolved) continue;

    missing.push({
      file: normalizePath(path.relative(root, filePath)),
      specifier,
      attempted: normalizePath(path.relative(root, localBase)),
    });
  }
}

if (json) {
  process.stdout.write(
    JSON.stringify(
      {
        ok: missing.length === 0,
        scannedFiles: files.length,
        totalSpecifiers,
        checkedLocalSpecifiers: checked,
        missing,
      },
      null,
      2
    )
  );
  process.stdout.write('\n');
  process.exit(missing.length ? 1 : 0);
}

process.stdout.write('\n== Storybook Import Audit ==\n');
process.stdout.write(`- root: ${normalizePath(root)}\n`);
process.stdout.write(`- stories: ${normalizePath(path.relative(root, storiesDir))}\n`);
process.stdout.write(`- files scanned: ${files.length}\n`);
process.stdout.write(`- total specifiers: ${totalSpecifiers}\n`);
process.stdout.write(`- local specifiers checked: ${checked}\n`);

if (missing.length === 0) {
  process.stdout.write('\n✔ No missing local imports found.\n');
  process.exit(0);
}

process.stdout.write(`\n✖ Missing local imports: ${missing.length}\n`);
for (const item of missing) {
  process.stdout.write(`- ${item.file}: ${item.specifier}\n`);
}
process.exit(1);
