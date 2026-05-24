import { execSync } from 'node:child_process';

function ok(label) {
  return `[OK] ${label}`;
}

function fail(label) {
  return `[FAIL] ${label}`;
}

function warn(label) {
  return `[WARN] ${label}`;
}

function parseArgs() {
  const args = new Set(process.argv.slice(2));
  return {
    json: args.has('--json'),
  };
}

function runJson(cmd) {
  const out = execSync(cmd, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 20 * 1024 * 1024,
  });
  return JSON.parse(out);
}

const args = parseArgs();

const results = [];
const failures = [];
const warnings = [];

let gaps = null;
let quality = null;

try {
  gaps = runJson('node scripts/storybook-gaps.mjs --json --all');
  results.push(ok('storybook-gaps.mjs ran'));
} catch (err) {
  failures.push(fail('Unable to run scripts/storybook-gaps.mjs --json --all'));
  warnings.push(String(err));
}

try {
  quality = runJson('node scripts/storybook-quality.mjs --json');
  results.push(ok('storybook-quality.mjs ran'));
} catch (err) {
  failures.push(fail('Unable to run scripts/storybook-quality.mjs --json'));
  warnings.push(String(err));
}

const integratedEnabled = gaps?.integratedEnabled;
if (typeof integratedEnabled === 'boolean') {
  if (integratedEnabled) results.push(ok('Integrated addons enabled (features.*)'));
  else failures.push(fail('Integrated addons NOT enabled (features.*)'));
} else {
  warnings.push(warn('storybook-gaps JSON missing integratedEnabled'));
}

const componentCoverage = gaps?.componentCoverage;
if (componentCoverage && typeof componentCoverage === 'object') {
  const missingCount = componentCoverage.componentsNotImportedByComponentStories;
  if (typeof missingCount === 'number') {
    if (missingCount === 0) {
      results.push(ok('All components/** files are imported by component stories'));
    } else {
      failures.push(
        fail(
          `components/** files not imported by .storybook/stories/components: ${missingCount} (filemap still covers them)`
        )
      );
    }
  } else {
    warnings.push(
      warn('storybook-gaps JSON missing componentCoverage.componentsNotImportedByComponentStories')
    );
  }
} else {
  warnings.push(warn('storybook-gaps JSON missing componentCoverage'));
}

const storyCoverage = gaps?.storyCoverage?.components;
if (storyCoverage && typeof storyCoverage === 'object') {
  const lowCoverage = storyCoverage.filesWithOneOrZeroStories;
  if (typeof lowCoverage === 'number') {
    if (lowCoverage === 0)
      results.push(ok('Component stories: no low-coverage files (>= 2 exports each)'));
    else failures.push(fail(`Component stories: ${lowCoverage} files have <= 1 exported story`));
  } else {
    warnings.push(
      warn('storybook-gaps JSON missing storyCoverage.components.filesWithOneOrZeroStories')
    );
  }

  const missingPlaygroundOrDefault = storyCoverage.filesMissingEitherPlaygroundOrDefault;
  if (typeof missingPlaygroundOrDefault === 'number') {
    if (missingPlaygroundOrDefault === 0)
      results.push(ok('Component stories: all include Playground + Default'));
    else
      failures.push(
        fail(`Component stories: ${missingPlaygroundOrDefault} files missing Playground or Default`)
      );
  } else {
    warnings.push(
      warn(
        'storybook-gaps JSON missing storyCoverage.components.filesMissingEitherPlaygroundOrDefault'
      )
    );
  }
} else {
  warnings.push(warn('storybook-gaps JSON missing storyCoverage.components'));
}

const qualityGaps = quality?.gaps?.component;
if (qualityGaps && typeof qualityGaps === 'object') {
  const anyGapFiles = qualityGaps.filesWithAnyGaps;
  if (Array.isArray(anyGapFiles)) {
    if (anyGapFiles.length === 0)
      results.push(ok('Component stories: no addon/variant gaps detected'));
    else
      failures.push(fail(`Component stories: ${anyGapFiles.length} files have addon/variant gaps`));
  } else {
    warnings.push(warn('storybook-quality JSON missing gaps.component.filesWithAnyGaps'));
  }
} else {
  warnings.push(warn('storybook-quality JSON missing gaps.component'));
}

if (args.json) {
  console.log(
    JSON.stringify(
      {
        ok: results,
        warnings,
        failures,
        details: {
          componentsNotImportedByComponentStories:
            gaps?.componentCoverage?.componentsNotImportedByComponentStories,
          notImportedList: gaps?.componentCoverage?.notImportedList,
          componentStoryCoverage: gaps?.storyCoverage?.components,
          componentStoryQuality: quality?.gaps?.component,
        },
      },
      null,
      2
    )
  );
  process.exit(failures.length > 0 ? 1 : 0);
}

console.log('Storybook deep gaps results:');
for (const line of results) console.log(line);
for (const line of warnings) console.log(line);

if (failures.length > 0) {
  console.log('\nFailures:');
  for (const line of failures) console.log(line);

  const notImported = gaps?.componentCoverage?.notImportedList;
  if (Array.isArray(notImported) && notImported.length > 0) {
    console.log('\nNot imported by component stories (first 30):');
    for (const f of notImported.slice(0, 30)) console.log(`- ${f}`);
    if (notImported.length > 30) console.log(`- ... ${notImported.length - 30} more`);
  }

  const anyGapFiles = quality?.gaps?.component?.filesWithAnyGaps;
  if (Array.isArray(anyGapFiles) && anyGapFiles.length > 0) {
    console.log('\nComponent story files with gaps (first 30):');
    for (const f of anyGapFiles.slice(0, 30)) console.log(`- ${f}`);
    if (anyGapFiles.length > 30) console.log(`- ... ${anyGapFiles.length - 30} more`);
  }

  process.exit(1);
}
