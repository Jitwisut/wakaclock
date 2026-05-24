import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { StorybookConfig } from '@storybook/nextjs-vite';
import type { Plugin } from 'vite';

function stripNextModuleDirectives(): Plugin {
  const directivePattern = /^\s*(['"])use client\1;?\s*/;

  return {
    name: 'strip-next-module-directives',
    enforce: 'pre',
    transform(code: string, id: string) {
      const normalized = id.split(path.win32.sep).join('/').split('?')[0] ?? '';
      if (!/\.[cm]?[jt]sx?$/.test(normalized)) return null;
      const match = code.match(directivePattern);
      if (!match) return null;

      return {
        code: code.slice(match[0].length),
        map: null,
      };
    },
  };
}

function fixMinimalTiptapCssImportOrder(): Plugin {
  const reference = '@reference "tailwindcss";';
  const partialsDir = '/components/ui/custom/minimal-tiptap/styles/partials/';
  const indexFile = '/components/ui/custom/minimal-tiptap/styles/index.css';

  return {
    name: 'fix-minimal-tiptap-css-import-order',
    enforce: 'pre',
    transform(code: string, id: string) {
      const normalized = id.split(path.win32.sep).join('/').split('?')[0] ?? '';

      if (normalized.endsWith(indexFile)) {
        const lines = code.split('\n');
        const firstNonEmptyIndex = lines.findIndex((l) => l.trim() !== '');
        if (firstNonEmptyIndex === -1) return null;
        if (lines[firstNonEmptyIndex] !== reference) return null;

        let cursor = firstNonEmptyIndex + 1;
        while (cursor < lines.length && lines[cursor].trim() === '') cursor++;

        const importLines = [];
        while (cursor < lines.length && lines[cursor].trimStart().startsWith('@import')) {
          importLines.push(lines[cursor]);
          cursor++;
        }
        if (importLines.length === 0) return null;

        while (cursor < lines.length && lines[cursor].trim() === '') cursor++;

        const leading = lines.slice(0, firstNonEmptyIndex);
        const rest = lines.slice(cursor);
        return [...leading, ...importLines, reference, '', ...rest].join('\n');
      }

      if (normalized.includes(partialsDir) && normalized.endsWith('.css')) {
        if (code.includes(reference)) return null;
        return `${reference}\n\n${code}`;
      }

      return null;
    },
  };
}

const config: StorybookConfig = {
  // ---------------------------------------------------------------------------
  // Core
  // ---------------------------------------------------------------------------
  // Enterprise defaults: avoid interactive telemetry prompts in local/dev runs.
  core: {
    disableTelemetry: true,
    enableCrashReports: false,
  },

  // ---------------------------------------------------------------------------
  // Stories
  // ---------------------------------------------------------------------------
  stories: ['./stories/**/*.mdx', './stories/**/*.stories.@(js|jsx|mjs|ts|tsx)'],

  // ---------------------------------------------------------------------------
  // Integrated Addons (Storybook 9+)
  // ---------------------------------------------------------------------------
  features: {
    actions: true,
    backgrounds: true,
    controls: true,
    highlight: true,
    interactions: true,
    measure: true,
    outline: true,
    viewport: true,
    experimentalCodeExamples: true,
  },

  // ---------------------------------------------------------------------------
  // Addons
  // ---------------------------------------------------------------------------
  addons: [
    '@storybook/addon-links',
    '@storybook/addon-onboarding',
    '@storybook/addon-themes',
    '@storybook/addon-a11y',
    '@chromatic-com/storybook',
    'storybook-addon-rtl',
    'storybook-addon-mock-date',
    'storybook-addon-pseudo-states',
    '@storybook/addon-designs',
    {
      name: 'storybook-design-token',
      options: {
        designTokenGlob: '.storybook/tokens/**/*.tokens.{css,json,svg,png,jpg,jpeg,webp,gif}',
        preserveCSSVars: true,
      },
    },
    {
      name: '@storybook/addon-coverage',
      options: {
        istanbul: {
          include: ['app/**/*', 'components/**/*', 'lib/**/*', 'hooks/**/*'],
          exclude: [
            '**/*.stories.*',
            '**/*.mdx',
            '**/*.test.*',
            '**/*.spec.*',
            '**/__tests__/**',
            '**/node_modules/**',
            'storybook-static/**',
          ],
          requireEnv: true,
        },
      },
    },
    'storybook-react-i18next',
    '@storybook/addon-docs',
    '@storybook/addon-vitest',
  ],

  // ---------------------------------------------------------------------------
  // Framework
  // ---------------------------------------------------------------------------
  framework: {
    name: '@storybook/nextjs-vite',
    options: {},
  },

  // ---------------------------------------------------------------------------
  // Static Directories
  // ---------------------------------------------------------------------------
  staticDirs: ['../public'],

  // ---------------------------------------------------------------------------
  // Docs
  // ---------------------------------------------------------------------------
  docs: {
    defaultName: 'Documentation',
  },

  // ---------------------------------------------------------------------------
  // TypeScript
  // ---------------------------------------------------------------------------
  typescript: {
    reactDocgen: 'react-docgen-typescript',
  },

  // ---------------------------------------------------------------------------
  // Vite Config
  // ---------------------------------------------------------------------------
  viteFinal: async (config) => {
    const existingIgnored = config.server?.watch?.ignored;
    const ignored = (() => {
      if (Array.isArray(existingIgnored)) {
        return [...existingIgnored, '**/public/design-tokens.source.json'];
      }
      if (existingIgnored) {
        return ['**/public/design-tokens.source.json', existingIgnored];
      }
      return ['**/public/design-tokens.source.json'];
    })();

    return {
      ...config,
      plugins: [
        ...(config.plugins ?? []),
        stripNextModuleDirectives(),
        fixMinimalTiptapCssImportOrder(),
      ],
      build: {
        ...config.build,
        sourcemap: true,
        // Storybook bundles are large; avoid noisy warnings in CI logs.
        chunkSizeWarningLimit: 2000,
      },
      server: {
        ...config.server,
        watch: {
          ...config.server?.watch,
          ignored,
        },
      },
      resolve: {
        ...config.resolve,
        alias: {
          ...config.resolve?.alias,
          '@': fileURLToPath(new URL('../', import.meta.url)),
        },
      },
    };
  },
};

export default config;
