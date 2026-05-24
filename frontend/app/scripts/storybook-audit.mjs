import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

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

function normalizePath(p) {
  return p.split(path.sep).join('/');
}

function ok(label) {
  return `[OK] ${label}`;
}

function warn(label) {
  return `[WARN] ${label}`;
}

function fail(label) {
  return `[FAIL] ${label}`;
}

const results = [];

// ---------------------------------------------------------------------------
// Config checks
// ---------------------------------------------------------------------------
const mainTs = '.storybook/main.ts';
const ssotTs = '.storybook/ssot.ts';
const previewTsx = '.storybook/preview.tsx';
const managerTs = '.storybook/manager.ts';
const tokenFile = '.storybook/tokens/design-tokens.tokens.css';
const testRunnerConfig = '.storybook/test-runner.ts';
const packageJson = 'package.json';

results.push(exists(mainTs) ? ok(`${mainTs} exists`) : fail(`${mainTs} missing`));
results.push(exists(ssotTs) ? ok(`${ssotTs} exists`) : fail(`${ssotTs} missing`));
results.push(exists(previewTsx) ? ok(`${previewTsx} exists`) : fail(`${previewTsx} missing`));
results.push(exists(managerTs) ? ok(`${managerTs} exists`) : warn(`${managerTs} missing`));
results.push(exists(tokenFile) ? ok(`${tokenFile} exists`) : warn(`${tokenFile} missing`));
results.push(
  exists(testRunnerConfig) ? ok(`${testRunnerConfig} exists`) : warn(`${testRunnerConfig} missing`)
);

if (exists(packageJson)) {
  try {
    const pkg = JSON.parse(readText(packageJson));
    const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
    const scripts = pkg.scripts ?? {};

    results.push(
      deps['@storybook/test-runner']
        ? ok(`${packageJson} includes @storybook/test-runner`)
        : warn(`${packageJson} missing @storybook/test-runner`)
    );
    results.push(
      deps['@axe-core/playwright']
        ? ok(`${packageJson} includes @axe-core/playwright (optional a11y CI)`)
        : warn(`${packageJson} missing @axe-core/playwright`)
    );
    results.push(
      deps['start-server-and-test']
        ? ok(`${packageJson} includes start-server-and-test`)
        : warn(`${packageJson} missing start-server-and-test`)
    );
    results.push(
      scripts['storybook:test']
        ? ok(`${packageJson} includes storybook:test script`)
        : warn(`${packageJson} missing storybook:test script`)
    );
    results.push(
      scripts['storybook:test:a11y']
        ? ok(`${packageJson} includes storybook:test:a11y script`)
        : warn(`${packageJson} missing storybook:test:a11y script`)
    );
  } catch {
    results.push(warn(`Unable to parse ${packageJson}`));
  }
} else {
  results.push(warn(`${packageJson} missing`));
}

if (exists(mainTs)) {
  const text = readText(mainTs);
  const requiredFeatureKeys = [
    'actions',
    'backgrounds',
    'controls',
    'highlight',
    'interactions',
    'measure',
    'outline',
    'viewport',
  ];
  const missing = requiredFeatureKeys.filter((k) => !text.includes(`${k}: true`));
  results.push(
    missing.length === 0
      ? ok(`${mainTs} enables integrated addons (features.*)`)
      : fail(`${mainTs} missing features: ${missing.join(', ')}`)
  );

  const requiredAddons = [
    '@chromatic-com/storybook',
    'storybook-addon-pseudo-states',
    '@storybook/addon-designs',
    'msw-storybook-addon',
    'storybook-addon-rtl',
    'storybook-addon-mock-date',
    'storybook-design-token',
  ];
  const missingAddons = requiredAddons.filter((a) => !text.includes(a));
  results.push(
    missingAddons.length === 0
      ? ok(`${mainTs} includes enterprise addons (designs/pseudo-states)`)
      : warn(`${mainTs} missing addons: ${missingAddons.join(', ')}`)
  );
}

if (exists(ssotTs)) {
  const text = readText(ssotTs);
  const requiredParameters = ['actions:', 'controls:', 'backgrounds:', 'viewport:', 'a11y:'];
  const missing = requiredParameters.filter((k) => !text.includes(k));
  results.push(
    missing.length === 0
      ? ok(`${ssotTs} sets parameters for actions/controls/backgrounds/viewport/a11y`)
      : fail(`${ssotTs} missing parameters: ${missing.join(', ')}`)
  );
  results.push(
    text.includes('initReactI18next')
      ? ok(`${ssotTs} defines i18n resources (storybook-react-i18next)`)
      : warn(`${ssotTs} missing i18n resources`)
  );
  results.push(
    text.includes('codePanel: true')
      ? ok(`${ssotTs} enables Docs Code panel (storysource replacement)`)
      : warn(`${ssotTs} missing docs.codePanel=true`)
  );
  results.push(
    text.includes('mockingDate')
      ? ok(`${ssotTs} enables storybook-addon-mock-date (parameters.mockingDate)`)
      : warn(`${ssotTs} missing parameters.mockingDate`)
  );
  results.push(
    text.includes('addonRtl')
      ? ok(`${ssotTs} enables storybook-addon-rtl (globals.addonRtl)`)
      : warn(`${ssotTs} missing globals.addonRtl`)
  );
}

if (exists(previewTsx)) {
  const text = readText(previewTsx);
  results.push(
    text.includes('mswLoader')
      ? ok(`${previewTsx} enables MSW loader`)
      : warn(`${previewTsx} missing MSW loader`)
  );
  results.push(
    text.includes('withConsoleToActions')
      ? ok(`${previewTsx} replaces addon-console (console-to-actions)`)
      : warn(`${previewTsx} missing addon-console replacement`)
  );
}

// ---------------------------------------------------------------------------
// Filemap coverage for components/**
// ---------------------------------------------------------------------------
if (exists('components') && exists('.storybook/stories/filemap')) {
  const componentsFiles = listFiles('components')
    .map(normalizePath)
    .filter((p) => !p.endsWith('/.DS_Store'));

  const filemapStories = listFiles('.storybook/stories/filemap')
    .map(normalizePath)
    .filter(
      (p) => p.endsWith('.stories.ts') || p.endsWith('.stories.tsx') || p.endsWith('.stories.mdx')
    );

  const storyText = filemapStories.map((f) => readText(f)).join('\n');
  const missing = componentsFiles.filter(
    (f) => !storyText.includes(`file="${f}"`) && !storyText.includes(`file='${f}'`)
  );

  results.push(
    missing.length === 0
      ? ok(
          `Filemap coverage: ${componentsFiles.length}/${componentsFiles.length} components files referenced`
        )
      : fail(`Filemap missing ${missing.length} components files`)
  );
} else {
  results.push(warn('Skipping filemap audit (missing components/ or .storybook/stories/filemap/)'));
}

// ---------------------------------------------------------------------------
// Deep “missing” checks (storybook-gaps)
// ---------------------------------------------------------------------------
if (exists('scripts/storybook-gaps.mjs')) {
  try {
    const raw = execSync('node scripts/storybook-gaps.mjs --json', { encoding: 'utf8' });
    const gaps = JSON.parse(raw);

    const componentQuality = gaps?.storyCoverage?.components;
    if (componentQuality) {
      results.push(
        componentQuality.filesWithOneOrZeroStories === 0
          ? ok('Component stories: no low-coverage files (>= 2 stories each)')
          : fail(
              `Component stories: ${componentQuality.filesWithOneOrZeroStories} files have <= 1 story`
            )
      );
      results.push(
        componentQuality.filesMissingEitherPlaygroundOrDefault === 0
          ? ok('Component stories: all include Playground + Default')
          : fail(
              `Component stories: ${componentQuality.filesMissingEitherPlaygroundOrDefault} files missing Playground or Default`
            )
      );
    } else {
      results.push(warn('storybook-gaps JSON missing storyCoverage.components'));
    }

    const componentCoverage = gaps?.componentCoverage;
    if (componentCoverage) {
      results.push(
        componentCoverage.componentsNotImportedByComponentStories === 0
          ? ok('Component stories: imports cover all components/** files')
          : warn(
              `Component stories: ${componentCoverage.componentsNotImportedByComponentStories} components/** files not imported (filemap still covers them)`
            )
      );
    } else {
      results.push(warn('storybook-gaps JSON missing componentCoverage'));
    }
  } catch {
    results.push(warn('Unable to run storybook-gaps.mjs --json'));
  }
} else {
  results.push(warn('scripts/storybook-gaps.mjs missing (skipping deep gaps checks)'));
}

// ---------------------------------------------------------------------------
// Built output checks (requires storybook build)
// ---------------------------------------------------------------------------
if (exists('storybook-static/sb-addons')) {
  const addons = fs
    .readdirSync('storybook-static/sb-addons', { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  const expectedAddonPrefixes = [
    'a11y-',
    'docs-',
    'links-',
    'onboarding-',
    'themes-',
    'vitest-',
    'storybook-react-i18next-',
  ];
  const missing = expectedAddonPrefixes.filter(
    (prefix) => !addons.some((name) => name.startsWith(prefix))
  );
  results.push(
    missing.length === 0
      ? ok('storybook-static includes expected addon bundles')
      : warn(`storybook-static missing addon bundles: ${missing.join(', ')}`)
  );

  const enterpriseAddonPrefixes = ['designs-', 'pseudo-states-'];
  const missingEnterprise = enterpriseAddonPrefixes.filter(
    (prefix) => !addons.some((name) => name.startsWith(prefix))
  );
  results.push(
    missingEnterprise.length === 0
      ? ok('storybook-static includes enterprise addon bundles (designs/pseudo-states)')
      : warn(`storybook-static missing enterprise addon bundles: ${missingEnterprise.join(', ')}`)
  );

  const enterpriseAddonPrefixes2 = ['rtl-', 'mock-date-'];
  const missingEnterprise2 = enterpriseAddonPrefixes2.filter(
    (prefix) => !addons.some((name) => name.startsWith(prefix))
  );
  results.push(
    missingEnterprise2.length === 0
      ? ok('storybook-static includes enterprise addon bundles (rtl/mock-date)')
      : warn(`storybook-static missing enterprise addon bundles: ${missingEnterprise2.join(', ')}`)
  );

  results.push(
    addons.some((name) => name.includes('chromatic'))
      ? ok('storybook-static includes Chromatic addon bundle')
      : warn('storybook-static missing Chromatic addon bundle')
  );

  results.push(
    addons.some((name) => name.includes('design-token'))
      ? ok('storybook-static includes design-token addon bundle')
      : warn('storybook-static missing design-token addon bundle')
  );

  const managerBundle =
    'storybook-static/sb-addons/storybook-core-server-presets-0/common-manager-bundle.js';
  if (exists(managerBundle)) {
    const managerText = readText(managerBundle);
    const integratedMarkers = [
      'storybook/actions',
      'storybook/background',
      'storybook/viewport',
      'storybook/measure-addon',
      'storybook/outline',
      'storybook/highlight',
      '__STORYBOOK_TEST__',
    ];
    const missingMarkers = integratedMarkers.filter((m) => !managerText.includes(m));
    results.push(
      missingMarkers.length === 0
        ? ok(
            'Manager bundle contains integrated addon markers (actions/backgrounds/viewport/measure/outline/highlight/test)'
          )
        : warn(`Manager bundle missing markers: ${missingMarkers.join(', ')}`)
    );
  } else {
    results.push(warn(`Missing ${managerBundle}; run 'npm run storybook:build'`));
  }
} else {
  results.push(
    ok(
      "storybook-static not found (bundle validation skipped; run 'npm run storybook:build' to validate bundles)"
    )
  );
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------
console.log('Storybook audit results:');
for (const line of results) console.log(line);

const hasFailures = results.some((l) => l.startsWith('[FAIL]'));
if (hasFailures) process.exit(1);
