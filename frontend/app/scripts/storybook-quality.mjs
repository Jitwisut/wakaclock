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

function parseArgs() {
  const args = new Set(process.argv.slice(2));
  return {
    json: args.has('--json'),
    all: args.has('--all'),
  };
}

function countStoryExports(text) {
  const re = /export\s+const\s+([A-Za-z0-9_]+)/g;
  const names = [];
  let m;
  while ((m = re.exec(text))) names.push(m[1]);
  return names;
}

function playKind(text) {
  const hasPlay = /\bplay\s*:\s*async\b/.test(text) || /\bplay\s*:\s*\(/.test(text);
  if (!hasPlay) return 'none';

  const isPlayfill = text.includes("throw new Error('Story rendered no content.')");
  const usesUserEvent = /\buserEvent\b/.test(text) || /\bfireEvent\b/.test(text);
  const usesExpect =
    /\bexpect\s*\(/.test(text) ||
    /\btoHaveBeenCalled\b/.test(text) ||
    /\btoBeInTheDocument\b/.test(text);

  if (usesUserEvent) return 'interaction';
  if (usesExpect) return 'assertion';
  if (isPlayfill) return 'smoke';
  return 'custom';
}

function sectionOfStory(file) {
  const parts = file.split('/');
  const idx = parts.indexOf('stories');
  return parts[idx + 1] ?? 'unknown';
}

function analyzeStoryFile(file) {
  const text = readText(file);
  const exports = countStoryExports(text);

  const kind = playKind(text);

  const hasGlobalsOverride = /\bglobals\s*:\s*\{/.test(text);
  const hasDesign = /\bdesign\s*:\s*\{/.test(text);
  const hasPseudo = /\bpseudo\s*:\s*\{/.test(text);
  const hasMsw = /\bmsw\s*:\s*\{/.test(text);
  const hasArgs = /\bargs\s*:\s*\{/.test(text);
  const hasArgTypes = /\bargTypes\s*:\s*\{/.test(text);
  const hasControlsParam = /\bcontrols\s*:\s*\{/.test(text);
  const hasActionsParam = /\bactions\s*:\s*\{/.test(text);
  const hasBackgroundsParam = /\bbackgrounds\s*:\s*\{/.test(text);
  const hasViewportParam = /\bviewport\s*:\s*\{/.test(text);
  const hasLayoutParam = /\blayout\s*:\s*['"][A-Za-z-]+['"]/.test(text);
  const hasDecorators = /\bdecorators\s*:\s*\[/.test(text);
  const hasDocsParam = /\bdocs\s*:\s*\{/.test(text);
  const hasTags = /\btags\s*:\s*\[/.test(text);
  const hasA11yDisable = /\ba11y\s*:\s*\{\s*disable\s*:\s*true/.test(text);

  const isComponentStory = file.startsWith('.storybook/stories/components/');

  const storyCount = exports.length;
  const hasPlayground = exports.includes('Playground');
  const hasDefault = exports.includes('Default');
  const hasDarkExport = exports.some((e) => e.toLowerCase().includes('dark'));
  const hasRtlExport = exports.some((e) => e.toLowerCase().includes('rtl'));
  const hasDesignReferenceExport = exports.some((e) => e.toLowerCase().includes('design'));
  const hasPseudoExport = exports.some((e) => e.toLowerCase().includes('pseudo'));

  const gaps = [];
  if (isComponentStory) {
    if (!hasPlayground) gaps.push('missing:Playground');
    if (!hasDefault) gaps.push('missing:Default');
    if (!hasDarkExport) gaps.push('missing:Dark');
    if (!hasRtlExport) gaps.push('missing:RTL');
    if (!hasDesignReferenceExport || !hasDesign) gaps.push('missing:Designs');
    if (!hasPseudoExport || !hasPseudo) gaps.push('missing:PseudoStates');
    if (kind === 'none') gaps.push('missing:play');
    if (kind === 'smoke') gaps.push('weak:play(smoke)');
    if (!hasArgs) gaps.push('missing:meta.args');
    if (!hasArgTypes) gaps.push('missing:meta.argTypes');
    if (hasA11yDisable) gaps.push('warn:a11yDisabled');
    if (!hasTags) gaps.push('missing:tags');
  }

  return {
    file,
    section: sectionOfStory(file),
    isComponentStory,
    bytes: fs.statSync(file).size,
    storyCount,
    exports,
    play: {
      kind,
    },
    features: {
      hasGlobalsOverride,
      hasDesign,
      hasPseudo,
      hasMsw,
      hasArgs,
      hasArgTypes,
      hasControlsParam,
      hasActionsParam,
      hasBackgroundsParam,
      hasViewportParam,
      hasLayoutParam,
      hasDecorators,
      hasDocsParam,
      hasTags,
      hasA11yDisable,
    },
    gaps,
  };
}

const args = parseArgs();

if (!exists('.storybook/stories')) {
  console.error('Missing .storybook/stories directory.');
  process.exit(1);
}

const storyFiles = listFiles('.storybook/stories')
  .map(normalize)
  .filter((p) => p.endsWith('.stories.ts') || p.endsWith('.stories.tsx') || p.endsWith('.mdx'))
  .sort();

const stats = storyFiles.map(analyzeStoryFile);
const component = stats.filter((s) => s.isComponentStory);

const gaps = {
  storyFiles: stats.length,
  componentStoryFiles: component.length,
  component: {
    filesWithNoGaps: component.filter((s) => s.gaps.length === 0).map((s) => s.file),
    filesWithAnyGaps: component.filter((s) => s.gaps.length > 0).map((s) => s.file),
    gapCounts: component.reduce((acc, s) => {
      for (const g of s.gaps) acc[g] = (acc[g] ?? 0) + 1;
      return acc;
    }, {}),
    filesWithSmokePlay: component.filter((s) => s.play.kind === 'smoke').map((s) => s.file),
    filesMissingArgs: component.filter((s) => !s.features.hasArgs).map((s) => s.file),
    filesMissingArgTypes: component.filter((s) => !s.features.hasArgTypes).map((s) => s.file),
  },
};

if (args.json) {
  const payload = {
    storyStats: args.all
      ? stats
      : stats.map(({ exports: _exports, ...rest }) => {
          void _exports;
          return rest;
        }),
    gaps,
  };
  fs.writeFileSync(1, `${JSON.stringify(payload, null, 2)}\n`);
  process.exit(0);
}

console.log('== Storybook Quality ==');
console.log(`- story files: ${stats.length}`);
console.log(`- component story files: ${component.length}`);
console.log('');
console.log('== Component Gaps Summary ==');
console.log(`- files with any gaps: ${gaps.component.filesWithAnyGaps.length}`);
console.log(`- files with smoke-only play(): ${gaps.component.filesWithSmokePlay.length}`);
console.log(`- files missing meta.args: ${gaps.component.filesMissingArgs.length}`);
console.log(`- files missing meta.argTypes: ${gaps.component.filesMissingArgTypes.length}`);

const sortedGapCounts = Object.entries(gaps.component.gapCounts).sort((a, b) => b[1] - a[1]);
if (sortedGapCounts.length > 0) {
  console.log('\nTop gap types:');
  for (const [k, v] of sortedGapCounts.slice(0, 15)) console.log(`- ${k}: ${v}`);
}

const listLimit = args.all ? Number.POSITIVE_INFINITY : 30;
if (gaps.component.filesWithSmokePlay.length > 0) {
  console.log('\nExamples (smoke-only play):');
  for (const f of gaps.component.filesWithSmokePlay.slice(0, listLimit)) console.log(`- ${f}`);
  if (!args.all && gaps.component.filesWithSmokePlay.length > listLimit) {
    console.log(
      `- ... ${gaps.component.filesWithSmokePlay.length - listLimit} more (run with --all)`
    );
  }
}
