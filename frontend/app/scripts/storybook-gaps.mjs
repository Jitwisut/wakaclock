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

function title(s) {
  return `\n== ${s} ==`;
}

function bullet(s) {
  return `- ${s}`;
}

function padRight(s, width) {
  const str = String(s);
  if (str.length >= width) return str;
  return str + ' '.repeat(width - str.length);
}

function parseArgs() {
  const args = new Set(process.argv.slice(2));
  return {
    all: args.has('--all'),
    json: args.has('--json'),
  };
}

function tryResolveComponentImport(rel) {
  const direct = `components/${rel}`;
  if (fs.existsSync(direct)) return normalize(direct);

  const candidates = [
    `components/${rel}.tsx`,
    `components/${rel}.ts`,
    `components/${rel}.jsx`,
    `components/${rel}.js`,
    `components/${rel}.css`,
    `components/${rel}/index.tsx`,
    `components/${rel}/index.ts`,
    `components/${rel}/index.jsx`,
    `components/${rel}/index.js`,
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return normalize(c);
  }
  return null;
}

function countStoryExports(text) {
  const re = /export\s+const\s+([A-Za-z0-9_]+)/g;
  const names = [];
  let m;
  while ((m = re.exec(text))) names.push(m[1]);
  return names;
}

function readPackageJson() {
  const pkg = JSON.parse(readText('package.json'));
  return pkg;
}

const args = parseArgs();

if (!exists('.storybook')) {
  console.error('Missing .storybook directory.');
  process.exit(1);
}

const pkg = exists('package.json') ? readPackageJson() : null;
const devDeps = pkg?.devDependencies ?? {};
const deps = pkg?.dependencies ?? {};
const allDeps = { ...deps, ...devDeps };

const mainTs = '.storybook/main.ts';
const ssotTs = '.storybook/ssot.ts';
const previewTsx = '.storybook/preview.tsx';
const managerTs = '.storybook/manager.ts';

const mainText = exists(mainTs) ? readText(mainTs) : '';
const ssotText = exists(ssotTs) ? readText(ssotTs) : '';
const previewText = exists(previewTsx) ? readText(previewTsx) : '';

const storybookVersion = allDeps.storybook ?? '(not found)';
const builder = mainText.includes('@storybook/nextjs-vite')
  ? '@storybook/nextjs-vite'
  : '(unknown)';

const integratedKeys = [
  'actions',
  'backgrounds',
  'controls',
  'viewport',
  'measure',
  'outline',
  'highlight',
  'interactions',
];
const integratedEnabled = integratedKeys.every((k) => mainText.includes(`${k}: true`));

const mapping = [
  {
    name: '@storybook/addon-links',
    status: mainText.includes('@storybook/addon-links') ? 'enabled' : 'missing',
  },
  {
    name: '@storybook/addon-onboarding',
    status: mainText.includes('@storybook/addon-onboarding') ? 'enabled' : 'missing',
  },
  {
    name: '@storybook/addon-themes',
    status: mainText.includes('@storybook/addon-themes') ? 'enabled' : 'missing',
  },
  {
    name: '@storybook/addon-a11y',
    status: mainText.includes('@storybook/addon-a11y') ? 'enabled' : 'missing',
  },
  {
    name: '@chromatic-com/storybook',
    status: mainText.includes('@chromatic-com/storybook') ? 'enabled' : 'missing',
  },
  {
    name: 'chromatic (CLI)',
    status: allDeps.chromatic ? `installed (${allDeps.chromatic})` : 'missing',
  },
  {
    name: '@storybook/addon-docs',
    status: mainText.includes('@storybook/addon-docs') ? 'enabled' : 'missing',
  },
  {
    name: '@storybook/addon-vitest',
    status: mainText.includes('@storybook/addon-vitest') ? 'enabled' : 'missing',
  },
  {
    name: '@storybook/test-runner',
    status: allDeps['@storybook/test-runner']
      ? `installed (${allDeps['@storybook/test-runner']})`
      : 'missing',
  },
  {
    name: '@axe-core/playwright',
    status: allDeps['@axe-core/playwright']
      ? `installed (${allDeps['@axe-core/playwright']})`
      : 'missing',
  },
  {
    name: '@storybook/addon-coverage',
    status: mainText.includes('@storybook/addon-coverage') ? 'enabled' : 'missing',
  },
  {
    name: 'msw-storybook-addon',
    status: previewText.includes('mswLoader') ? 'enabled (loader)' : 'missing',
  },
  {
    name: 'storybook-react-i18next',
    status:
      mainText.includes('storybook-react-i18next') &&
      previewText.includes('initialGlobals') &&
      ssotText.includes('initReactI18next')
        ? 'enabled'
        : 'missing',
  },
  {
    name: 'storybook-design-token',
    status: mainText.includes('storybook-design-token')
      ? exists('.storybook/tokens')
        ? 'enabled'
        : 'enabled (missing .storybook/tokens)'
      : 'missing',
  },

  // “Classic” addons (Storybook 9+/10 integrated)
  {
    name: '@storybook/addon-actions',
    status: integratedEnabled ? 'integrated (features.actions)' : 'missing integrated features',
  },
  {
    name: '@storybook/addon-controls',
    status: integratedEnabled ? 'integrated (features.controls)' : 'missing integrated features',
  },
  {
    name: '@storybook/addon-backgrounds',
    status: integratedEnabled ? 'integrated (features.backgrounds)' : 'missing integrated features',
  },
  {
    name: '@storybook/addon-viewport',
    status: integratedEnabled ? 'integrated (features.viewport)' : 'missing integrated features',
  },
  {
    name: '@storybook/addon-measure',
    status: integratedEnabled ? 'integrated (features.measure)' : 'missing integrated features',
  },
  {
    name: '@storybook/addon-outline',
    status: integratedEnabled ? 'integrated (features.outline)' : 'missing integrated features',
  },
  {
    name: '@storybook/addon-interactions',
    status: integratedEnabled
      ? 'integrated (features.interactions)'
      : 'missing integrated features',
  },
  {
    name: '@storybook/addon-essentials',
    status: integratedEnabled ? 'integrated (Storybook 9+/10)' : 'missing integrated features',
  },

  // Replacements / not-applicable
  {
    name: '@storybook/addon-console',
    status: previewText.includes('withConsoleToActions')
      ? 'replaced (console-to-actions)'
      : 'missing replacement',
  },
  {
    name: '@storybook/addon-storysource',
    status: ssotText.includes('codePanel: true')
      ? 'replaced (Docs codePanel)'
      : 'missing replacement',
  },
  {
    name: '@storybook/addon-styling-webpack',
    status: builder === '@storybook/nextjs-vite' ? 'not applicable (Vite builder)' : 'unknown',
  },

  // Enterprise extras (added)
  {
    name: '@storybook/addon-designs',
    status: mainText.includes('@storybook/addon-designs') ? 'enabled' : 'missing',
  },
  {
    name: 'storybook-addon-pseudo-states',
    status: mainText.includes('storybook-addon-pseudo-states') ? 'enabled' : 'missing',
  },
  {
    name: 'storybook-addon-rtl',
    status:
      mainText.includes('storybook-addon-rtl') && ssotText.includes('addonRtl')
        ? 'enabled'
        : 'missing',
  },
  {
    name: 'storybook-addon-mock-date',
    status:
      mainText.includes('storybook-addon-mock-date') && ssotText.includes('mockingDate')
        ? 'enabled'
        : 'missing',
  },
];

// ---------------------------------------------------------------------------
// Stories coverage
// ---------------------------------------------------------------------------
const allStoryFiles = exists('.storybook/stories')
  ? listFiles('.storybook/stories')
      .map(normalize)
      .filter((p) => p.endsWith('.stories.ts') || p.endsWith('.stories.tsx') || p.endsWith('.mdx'))
      .sort()
  : [];

const componentStoryFiles = allStoryFiles.filter((p) =>
  p.startsWith('.storybook/stories/components/')
);

function sectionOfStory(file) {
  const parts = file.split('/');
  const idx = parts.indexOf('stories');
  const section = parts[idx + 1] ?? 'unknown';
  return section;
}

function computeStoryStats(files) {
  return files.map((file) => {
    const text = readText(file);
    const exports = countStoryExports(text);
    return {
      file,
      storyCount: exports.length,
      hasPlayground: exports.includes('Playground'),
      hasDefault: exports.includes('Default'),
      hasPlay: /\bplay\s*:\s*async\b/.test(text) || /\bplay\s*:\s*\(/.test(text),
      bytes: fs.statSync(file).size,
    };
  });
}

const allStoryStats = computeStoryStats(allStoryFiles);
const componentStoryStats = computeStoryStats(componentStoryFiles);

const componentOnlyOneStory = componentStoryStats.filter((s) => s.storyCount <= 1);
const componentMissingEitherPlaygroundOrDefault = componentStoryStats.filter(
  (s) => !s.hasPlayground || !s.hasDefault
);
const componentMissingBothPlaygroundAndDefault = componentStoryStats.filter(
  (s) => !s.hasPlayground && !s.hasDefault
);

const allPlayFiles = allStoryStats.filter((s) => s.hasPlay);
const componentPlayFiles = componentStoryStats.filter((s) => s.hasPlay);

const storySectionSummary = allStoryStats.reduce((acc, s) => {
  const section = sectionOfStory(s.file);
  if (!acc[section]) acc[section] = { files: 0, exports: 0, playFiles: 0 };
  acc[section].files += 1;
  acc[section].exports += s.storyCount;
  if (s.hasPlay) acc[section].playFiles += 1;
  return acc;
}, {});

// ---------------------------------------------------------------------------
// components/** imported by .storybook/stories/components/**
// ---------------------------------------------------------------------------
const importCoverageIgnored = new Set([
  // Tailwind v4 requires `@reference` context for `@apply`-heavy partials.
  // These files are still covered via `.storybook/stories/filemap/**`.
  'components/ui/custom/minimal-tiptap/styles/partials/code.css',
  'components/ui/custom/minimal-tiptap/styles/partials/lists.css',
  'components/ui/custom/minimal-tiptap/styles/partials/placeholder.css',
  'components/ui/custom/minimal-tiptap/styles/partials/typography.css',
  'components/ui/custom/minimal-tiptap/styles/partials/zoom.css',
  // Non-component module (types-only) still covered via filemap.
  'components/ui/custom/minimal-tiptap/extensions/image/types.ts',
]);

const componentFiles = exists('components')
  ? listFiles('components')
      .map(normalize)
      .filter((p) => !p.endsWith('/.DS_Store'))
      .sort()
  : [];

const importPaths = new Set();
const importRe = /(?:from\s+['"]@\/components\/(.+?)['"]|import\s+['"]@\/components\/(.+?)['"])/g;

for (const file of componentStoryFiles) {
  const text = readText(file);
  let m;
  while ((m = importRe.exec(text))) {
    const rel = m[1] ?? m[2];
    if (rel) importPaths.add(rel);
  }
}

const resolvedComponentFiles = new Set();
for (const rel of importPaths) {
  const resolved = tryResolveComponentImport(rel);
  if (resolved) resolvedComponentFiles.add(resolved);
}

const notImportedByComponentStories = componentFiles.filter(
  (f) => !resolvedComponentFiles.has(f) && !importCoverageIgnored.has(f)
);

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------
if (args.json) {
  const payload = {
    storybookVersion,
    builder,
    configFiles: {
      mainTs: exists(mainTs),
      previewTsx: exists(previewTsx),
      managerTs: exists(managerTs),
    },
    integratedEnabled,
    addonMapping: mapping,
    storyCoverage: {
      all: {
        storyFiles: allStoryFiles.length,
        totalStoryExports: allStoryStats.reduce((sum, s) => sum + s.storyCount, 0),
        filesWithPlayFunctions: allPlayFiles.length,
        bySection: storySectionSummary,
      },
      components: {
        storyFiles: componentStoryFiles.length,
        totalStoryExports: componentStoryStats.reduce((sum, s) => sum + s.storyCount, 0),
        filesWithOneOrZeroStories: componentOnlyOneStory.length,
        filesMissingPlaygroundOrDefault: componentMissingBothPlaygroundAndDefault.length,
        filesMissingEitherPlaygroundOrDefault: componentMissingEitherPlaygroundOrDefault.length,
        filesWithPlayFunctions: componentPlayFiles.length,
      },
    },
    componentCoverage: {
      componentFiles: componentFiles.length,
      uniqueComponentImportsInStories: importPaths.size,
      resolvedComponentFilesReferenced: resolvedComponentFiles.size,
      componentsNotImportedByComponentStories: notImportedByComponentStories.length,
      ignoredFromComponentImportCoverage: Array.from(importCoverageIgnored),
      notImportedList: args.all
        ? notImportedByComponentStories
        : notImportedByComponentStories.slice(0, 50),
    },
  };
  fs.writeFileSync(1, `${JSON.stringify(payload, null, 2)}\n`);
  process.exit(0);
}

console.log(title('Storybook Environment'));
console.log(bullet(`storybook: ${storybookVersion}`));
console.log(bullet(`builder: ${builder}`));
console.log(
  bullet(
    `config: ${mainTs}=${exists(mainTs)} ${previewTsx}=${exists(previewTsx)} ${managerTs}=${exists(managerTs)}`
  )
);
console.log(bullet(`integrated addons enabled (features.*): ${integratedEnabled}`));

console.log(title('Addon Support (requested + enterprise)'));
const maxName = Math.max(...mapping.map((m) => m.name.length));
for (const m of mapping) console.log(`${padRight(m.name, maxName)}  ->  ${m.status}`);

console.log(title('Stories Coverage (.storybook/stories)'));
console.log(bullet(`story files: ${allStoryFiles.length}`));
console.log(
  bullet(`total exported stories: ${allStoryStats.reduce((sum, s) => sum + s.storyCount, 0)}`)
);
console.log(bullet(`files with play() tests: ${allPlayFiles.length}`));

console.log('\nBy section:');
for (const [section, summary] of Object.entries(storySectionSummary).sort((a, b) =>
  a[0].localeCompare(b[0])
)) {
  console.log(
    bullet(
      `${section}: ${summary.files} files, ${summary.exports} exports, ${summary.playFiles} play()`
    )
  );
}

console.log(title('Component Story Quality (.storybook/stories/components)'));
console.log(bullet(`story files: ${componentStoryFiles.length}`));
console.log(
  bullet(`total exported stories: ${componentStoryStats.reduce((sum, s) => sum + s.storyCount, 0)}`)
);
console.log(bullet(`files with <= 1 story: ${componentOnlyOneStory.length}`));
console.log(
  bullet(`files missing Playground AND Default: ${componentMissingBothPlaygroundAndDefault.length}`)
);
console.log(
  bullet(`files missing Playground OR Default: ${componentMissingEitherPlaygroundOrDefault.length}`)
);
console.log(bullet(`files with play() tests: ${componentPlayFiles.length}`));

const listLimit = args.all ? Number.POSITIVE_INFINITY : 30;
if (componentOnlyOneStory.length > 0) {
  console.log('\nLow coverage (<= 1 story):');
  for (const s of componentOnlyOneStory.sort((a, b) => a.bytes - b.bytes).slice(0, listLimit)) {
    console.log(bullet(`${s.file}  (${s.storyCount} stories, ${s.bytes} bytes)`));
  }
}

if (componentMissingEitherPlaygroundOrDefault.length > 0) {
  console.log('\nMissing Playground OR Default:');
  for (const s of componentMissingEitherPlaygroundOrDefault
    .sort((a, b) => a.bytes - b.bytes)
    .slice(0, listLimit)) {
    console.log(bullet(`${s.file}  (${s.storyCount} stories, ${s.bytes} bytes)`));
  }
}

console.log(title('Components Coverage'));
console.log(bullet(`components files: ${componentFiles.length}`));
console.log(bullet(`unique @/components imports in component stories: ${importPaths.size}`));
console.log(bullet(`resolved component files referenced: ${resolvedComponentFiles.size}`));
console.log(
  bullet(
    `components NOT imported by .storybook/stories/components: ${notImportedByComponentStories.length}`
  )
);
console.log(bullet(`ignored from import coverage: ${importCoverageIgnored.size}`));

if (notImportedByComponentStories.length > 0) {
  console.log('\nNot imported by component stories (still covered by filemap):');
  for (const f of notImportedByComponentStories.slice(0, listLimit)) console.log(bullet(f));
  if (!args.all && notImportedByComponentStories.length > listLimit) {
    console.log(
      bullet(`... ${notImportedByComponentStories.length - listLimit} more (run with --all)`)
    );
  }
}
