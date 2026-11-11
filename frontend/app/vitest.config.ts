/// <reference types="vitest" />
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],

  test: {
    // ---------------------------------------------------------------------------
    // Environment
    // ---------------------------------------------------------------------------
    environment: 'jsdom',
    globals: true,

    // ---------------------------------------------------------------------------
    // Setup Files
    // ---------------------------------------------------------------------------
    setupFiles: ['./test/setup.ts'],

    // ---------------------------------------------------------------------------
    // File Patterns
    // ---------------------------------------------------------------------------
    include: ['**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', '.next', 'build', 'e2e'],

    // ---------------------------------------------------------------------------
    // Behavior
    // ---------------------------------------------------------------------------
    passWithNoTests: true,

    // Two layouts, one suite: Cinema renders the rebuilt pages, every other preset
    // the original ones (see components/wakaclock/layout-switch.tsx). `*.native.test.*`
    // and `*.classic.test.*` hold the checks that only apply to one of them.
    projects: [
      {
        extends: true,
        test: { name: 'cinema', exclude: ['**/*.classic.test.{ts,tsx}'] },
      },
      {
        extends: true,
        test: {
          name: 'classic',
          exclude: ['**/*.native.test.{ts,tsx}'],
          setupFiles: ['./test/setup-classic.ts'],
        },
      },
    ],
    isolate: true,
    watch: false,

    // ---------------------------------------------------------------------------
    // Timeouts
    // ---------------------------------------------------------------------------
    testTimeout: 10_000,
    hookTimeout: 10_000,

    // ---------------------------------------------------------------------------
    // Coverage (V8)
    // ---------------------------------------------------------------------------
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/',
        'test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/index.ts',
        'components/ui/**', // shadcn/ui components
        '**/__mocks__/**',
      ],
      // Ratchet floor, owner decision 2026-11-11. The 100% gate did not run in CI while
      // earlier jobs failed, and untested code accumulated (mostly Team/GitHub panels).
      // These are the measured totals, rounded down. Raise them as tests land, never
      // lower them; the target is still 100%.
      thresholds: {
        branches: 95.6,
        functions: 95.2,
        lines: 97.5,
        statements: 97.1,
      },
    },

    // ---------------------------------------------------------------------------
    // Reporter
    // ---------------------------------------------------------------------------
    reporters: ['default', 'html'],
    outputFile: {
      html: './test-results/index.html',
    },

    // ---------------------------------------------------------------------------
    // Execution
    // ---------------------------------------------------------------------------
    fileParallelism: true,
    maxConcurrency: 5,

    // ---------------------------------------------------------------------------
    // Mock Configuration
    // ---------------------------------------------------------------------------
    mockReset: true,
    restoreMocks: true,
    clearMocks: true,

    // ---------------------------------------------------------------------------
    // CSS & Assets
    // ---------------------------------------------------------------------------
    css: {
      modules: {
        classNameStrategy: 'non-scoped',
      },
    },
  },

  // ---------------------------------------------------------------------------
  // Path Aliases
  // ---------------------------------------------------------------------------
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },

  // ---------------------------------------------------------------------------
  // ESBuild
  // ---------------------------------------------------------------------------
  esbuild: {
    jsxInject: undefined,
  },
});
