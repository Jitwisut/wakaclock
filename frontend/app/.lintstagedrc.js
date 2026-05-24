/**
 * Lint-Staged Configuration
 * =============================================================================
 * Runs on staged files before commit via Lefthook pre-commit hook.
 *
 * Pipeline Order:
 * 1. ESLint (fix) → catches code issues
 * 2. Prettier (write) → formats code consistently
 */
const config = {
  // ---------------------------------------------------------------------------
  // TypeScript & JavaScript
  // ---------------------------------------------------------------------------
  '*.{ts,tsx,mts,cts}': ['eslint --fix --max-warnings=0 --no-warn-ignored', 'prettier --write'],
  '*.{js,jsx,mjs,cjs}': ['eslint --fix --max-warnings=0 --no-warn-ignored', 'prettier --write'],

  // ---------------------------------------------------------------------------
  // Styles
  // ---------------------------------------------------------------------------
  '*.{css,scss,sass}': ['prettier --write'],

  // ---------------------------------------------------------------------------
  // Data & Config Files
  // ---------------------------------------------------------------------------
  '*.{json,jsonc}': ['prettier --write'],
  '*.{yml,yaml}': ['prettier --write'],
  '*.{md,mdx}': ['prettier --write'],

  // ---------------------------------------------------------------------------
  // Package.json (sorted)
  // ---------------------------------------------------------------------------
  'package.json': ['prettier --write'],
};

export default config;
