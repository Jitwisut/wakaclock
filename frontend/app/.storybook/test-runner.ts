import fs from 'node:fs';
import path from 'node:path';

import AxeBuilder from '@axe-core/playwright';
import { getStoryContext } from '@storybook/test-runner';

import type { TestRunnerConfig } from '@storybook/test-runner';

function isEnabled(value: string | undefined) {
  return value === '1' || value === 'true' || value === 'yes';
}

const RUN_A11Y = isEnabled(process.env.STORYBOOK_RUN_A11Y);
const A11Y_MODE = (process.env.STORYBOOK_A11Y_MODE ?? 'baseline').toLowerCase();
const A11Y_BASELINE_PATH =
  process.env.STORYBOOK_A11Y_BASELINE ?? path.join('.storybook', 'a11y-baseline.json');
const A11Y_COLLECT_DIR =
  process.env.STORYBOOK_A11Y_COLLECT_DIR ?? path.join('.storybook', '.a11y-baseline');

type A11yBaseline = {
  generatedAt: string;
  stories: Record<string, Record<string, number>>;
  version: 1;
};

let baselineCache: A11yBaseline | null = null;

function loadBaseline(): A11yBaseline {
  if (baselineCache) return baselineCache;

  const absPath = path.resolve(process.cwd(), A11Y_BASELINE_PATH);
  if (!fs.existsSync(absPath)) {
    baselineCache = { version: 1, generatedAt: '', stories: {} };
    return baselineCache;
  }

  const raw = fs.readFileSync(absPath, 'utf8');
  const parsed = JSON.parse(raw) as Partial<A11yBaseline>;

  baselineCache = {
    version: 1,
    generatedAt: typeof parsed.generatedAt === 'string' ? parsed.generatedAt : '',
    stories:
      typeof parsed.stories === 'object' && parsed.stories
        ? (parsed.stories as Record<string, Record<string, number>>)
        : {},
  };

  return baselineCache;
}

type AxeNodeResult = {
  target?: string[];
};

type AxeViolation = {
  help?: string;
  id?: string;
  impact?: string;
  nodes: AxeNodeResult[];
};

type AxeResults = {
  violations: AxeViolation[];
};

function writeCollectedResult(storyId: string, title: string, name: string, results: AxeResults) {
  const absDir = path.resolve(process.cwd(), A11Y_COLLECT_DIR);
  fs.mkdirSync(absDir, { recursive: true });

  const violations: Record<string, number> = {};
  for (const v of results.violations) {
    if (!v?.id) continue;
    violations[String(v.id)] = Array.isArray(v.nodes) ? v.nodes.length : 0;
  }

  const out = {
    id: storyId,
    title,
    name,
    violations,
  };

  const outPath = path.join(absDir, `${storyId}.json`);
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
}

const config: TestRunnerConfig = {
  async postVisit(page, context) {
    if (!RUN_A11Y) return;

    const storyContext = await getStoryContext(page, context);
    if (storyContext.parameters?.a11y?.disable) return;

    const builder = new AxeBuilder({ page }).include('#storybook-root');

    const a11yConfig = storyContext.parameters?.a11y?.config as unknown;
    if (a11yConfig && typeof a11yConfig === 'object' && !Array.isArray(a11yConfig)) {
      try {
        const configurable = builder as unknown as {
          configure?: (config: Record<string, unknown>) => void;
        };
        configurable.configure?.(a11yConfig as Record<string, unknown>);
      } catch {
        // Ignore invalid axe config in story params.
      }
    }

    const results = (await builder.analyze()) as unknown as AxeResults;

    if (A11Y_MODE === 'collect') {
      writeCollectedResult(context.id, context.title, context.name, results);
      return;
    }

    if (results.violations.length === 0) return;

    if (A11Y_MODE !== 'strict') {
      const baseline = loadBaseline();
      const allowed = baseline.stories[context.id] ?? {};

      const regressions = results.violations
        .map((v) => ({
          id: String(v.id ?? ''),
          allowed: allowed[String(v.id ?? '')],
          nodes: Array.isArray(v.nodes) ? v.nodes.length : 0,
        }))
        .filter((v) => !v.id || typeof v.allowed !== 'number' || v.nodes > v.allowed);

      if (regressions.length === 0) return;

      const baselineHint = fs.existsSync(path.resolve(process.cwd(), A11Y_BASELINE_PATH))
        ? ''
        : `\n\nBaseline missing: ${A11Y_BASELINE_PATH}\nRun: npm run storybook:a11y:baseline`;

      const summary = regressions
        .map((r) =>
          typeof r.allowed === 'number'
            ? `${r.id}: ${r.nodes} nodes (baseline allows ${r.allowed})`
            : `${r.id}: ${r.nodes} nodes (no baseline entry)`
        )
        .join('\n');

      throw new Error(
        `A11y regressions in "${context.title} / ${context.name}" (mode=baseline)\n\n${summary}${baselineHint}`
      );
    }

    const summary = results.violations
      .map(
        (v) =>
          `${v.id} (${v.impact ?? 'unknown'}): ${v.help}\n${v.nodes
            .map((n) => n.target?.join(' '))
            .filter(Boolean)
            .join('\n')}`
      )
      .join('\n\n');

    throw new Error(
      `A11y violations in "${context.title} / ${context.name}" (mode=strict)\n\n${summary}`
    );
  },
};

export default config;
