import fs from 'node:fs';
import path from 'node:path';

const FIGMA_SAMPLE_URL = 'https://www.figma.com/file/LKQ4FJ4bTnCSjedbRpk931/Sample-File';

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

function getExportNames(text) {
  const re = /export\s+const\s+([A-Za-z0-9_]+)/g;
  const names = new Set();
  let m;
  while ((m = re.exec(text))) names.add(m[1]);
  return names;
}

function ensureTrailingNewline(text) {
  return text.endsWith('\n') ? text : `${text}\n`;
}

function appendBlock(text, block) {
  const out = ensureTrailingNewline(text);
  const spacer = out.endsWith('\n\n') ? '' : '\n';
  return `${out}${spacer}${block}\n`;
}

function buildDarkBlock() {
  return `export const Dark: Story = {\n  ...Default,\n  globals: {\n    ...(Default.globals ?? {}),\n    theme: 'dark',\n  },\n};`;
}

function buildRtlBlock() {
  return `export const RTL: Story = {\n  ...Default,\n  globals: {\n    ...(Default.globals ?? {}),\n    addonRtl: 'rtl',\n  },\n};`;
}

function buildDesignBlock() {
  return `export const DesignReference: Story = {\n  ...Default,\n  tags: ['!test'],\n  parameters: {\n    ...(Default.parameters ?? {}),\n    design: {\n      type: 'figma',\n      url: '${FIGMA_SAMPLE_URL}',\n    },\n  },\n};`;
}

function buildPseudoBlock() {
  return `export const PseudoStates: Story = {\n  ...Default,\n  tags: ['!test'],\n  name: 'Pseudo States (hover / focus / active)',\n  decorators: [\n    ...(Default.decorators ?? []),\n    (Story) => (\n      <div className="flex flex-wrap items-center gap-3">\n        <div id="hover">\n          <Story />\n        </div>\n        <div id="focus">\n          <Story />\n        </div>\n        <div id="active">\n          <Story />\n        </div>\n      </div>\n    ),\n  ],\n  parameters: {\n    ...(Default.parameters ?? {}),\n    pseudo: {\n      hover: ['#hover *'],\n      focusVisible: ['#focus *'],\n      active: ['#active *'],\n    },\n  },\n};`;
}

const targetRoot = '.storybook/stories/components';
if (!fs.existsSync(targetRoot)) {
  console.error(`Missing ${targetRoot}`);
  process.exit(1);
}

const storyFiles = listFiles(targetRoot)
  .filter((p) => p.endsWith('.stories.tsx'))
  .sort();

let changed = 0;
for (const file of storyFiles) {
  const original = fs.readFileSync(file, 'utf8');
  const exportNames = getExportNames(original);

  let next = original;

  if (!exportNames.has('Dark')) {
    next = appendBlock(next, buildDarkBlock());
  }

  if (!exportNames.has('RTL') && !exportNames.has('Rtl')) {
    next = appendBlock(next, buildRtlBlock());
  }

  if (!next.includes('design: {')) {
    next = appendBlock(next, buildDesignBlock());
  }

  if (!next.includes('pseudo: {')) {
    next = appendBlock(next, buildPseudoBlock());
  }

  if (next !== original) {
    fs.writeFileSync(file, next, 'utf8');
    changed += 1;
  }
}

console.log(`storybook-component-baseline: updated ${changed}/${storyFiles.length} files`);
