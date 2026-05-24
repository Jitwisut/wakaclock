import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

import ts from 'typescript';

function nowMs() {
  return Date.now();
}

function resolveBin(binName) {
  const ext = process.platform === 'win32' ? '.cmd' : '';
  return path.resolve(process.cwd(), 'node_modules', '.bin', `${binName}${ext}`);
}

function parseCsvFlag(flagName) {
  const arg = process.argv.find((value) => value.startsWith(`${flagName}=`));
  if (!arg) return null;
  const raw = arg.slice(flagName.length + 1);
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function shouldRun(name, only, skip) {
  if (only && !only.includes(name)) return false;
  if (skip && skip.includes(name)) return false;
  return true;
}

function runCommand(label, command, args) {
  process.stdout.write(`\n== ${label} ==\n`);
  const result = spawnSync(command, args, { stdio: 'inherit', shell: false });
  if (result.error) throw result.error;
  if (typeof result.status === 'number' && result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status}`);
  }
}

function runTypecheck() {
  process.stdout.write('\n== TypeScript (0 diagnostics) ==\n');

  const cwd = process.cwd();

  const formatHost = {
    getCanonicalFileName: (file) => file,
    getCurrentDirectory: () => cwd,
    getNewLine: () => '\n',
  };

  const typecheckConfig = (configPath, label) => {
    const absoluteConfigPath = path.resolve(cwd, configPath);
    if (!ts.sys.fileExists(absoluteConfigPath)) {
      throw new Error(`${label}: Missing tsconfig at ${absoluteConfigPath}`);
    }

    const configFile = ts.readConfigFile(absoluteConfigPath, ts.sys.readFile);
    if (configFile.error) {
      const formatted = ts.formatDiagnosticsWithColorAndContext([configFile.error], formatHost);
      throw new Error(`${label}:\n${formatted}`);
    }

    const basePath = path.dirname(absoluteConfigPath);
    const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, basePath);
    const program = ts.createProgram({ rootNames: parsed.fileNames, options: parsed.options });
    const diagnostics = ts.getPreEmitDiagnostics(program);

    if (diagnostics.length) {
      const formatted = ts.formatDiagnosticsWithColorAndContext(diagnostics, formatHost);
      throw new Error(`${label}:\n${formatted}`);
    }
  };

  typecheckConfig('tsconfig.json', 'TypeScript app');
  typecheckConfig('.storybook/tsconfig.json', 'TypeScript Storybook');
}

const only = parseCsvFlag('--only');
const skip = parseCsvFlag('--skip');

const steps = [
  {
    name: 'typecheck',
    run: runTypecheck,
  },
  {
    name: 'lint',
    run: () => runCommand('ESLint (strict)', resolveBin('eslint'), ['.', '--max-warnings=0']),
  },
  {
    name: 'test',
    run: () => runCommand('Vitest (coverage)', resolveBin('vitest'), ['run', '--coverage']),
  },
  {
    name: 'storybook:imports',
    run: () =>
      runCommand('Storybook Imports', process.execPath, ['scripts/storybook-import-audit.mjs']),
  },
  {
    name: 'storybook:quality',
    run: () => runCommand('Storybook Quality', process.execPath, ['scripts/storybook-quality.mjs']),
  },
  {
    name: 'storybook:gaps',
    run: () => runCommand('Storybook Gaps', process.execPath, ['scripts/storybook-gaps.mjs']),
  },
  {
    name: 'madge',
    run: () => runCommand('Madge (circular)', process.execPath, ['scripts/madge-circular.mjs']),
  },
  {
    name: 'knip',
    run: () => runCommand('Knip', resolveBin('knip'), []),
  },
];

const startedAt = nowMs();
const ran = [];

try {
  for (const step of steps) {
    if (!shouldRun(step.name, only, skip)) continue;
    const stepStart = nowMs();
    step.run();
    ran.push({ name: step.name, ms: nowMs() - stepStart });
  }

  process.stdout.write('\n== Summary ==\n');
  for (const step of ran) process.stdout.write(`- ${step.name}: ${step.ms}ms\n`);
  process.stdout.write(`total: ${nowMs() - startedAt}ms\n`);
} catch (error) {
  process.stderr.write('\n== Failed ==\n');
  process.stderr.write(String(error instanceof Error ? error.message : error));
  process.stderr.write('\n');
  process.exit(1);
}
