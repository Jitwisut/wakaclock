/**
 * Enterprise-Grade ESLint Configuration
 *
 * Plugins included:
 * - @typescript-eslint: TypeScript support
 * - react & react-hooks: React best practices
 * - jsx-a11y: Accessibility (WCAG compliance)
 * - import: Module import/export management
 * - sonarjs: Code quality and bug detection
 * - unicorn: Best practices (100+ rules)
 * - promise: Promise/async best practices
 * - security: Security vulnerability detection
 * - regexp: RegExp best practices
 * - perfectionist: Code organization/sorting
 * - @tanstack/query: React Query best practices
 */

import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import importPlugin from 'eslint-plugin-import';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import perfectionist from 'eslint-plugin-perfectionist';
import promise from 'eslint-plugin-promise';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import regexp from 'eslint-plugin-regexp';
import security from 'eslint-plugin-security';
import sonarjs from 'eslint-plugin-sonarjs';
import unicorn from 'eslint-plugin-unicorn';
import tanstackQuery from '@tanstack/eslint-plugin-query';
import boundaries from 'eslint-plugin-boundaries';
import playwright from 'eslint-plugin-playwright';
import storybook from 'eslint-plugin-storybook';
import nextPlugin from '@next/eslint-plugin-next';

// =============================================================================
// SHARED GLOBALS
// =============================================================================

const browserGlobals = {
  window: 'readonly',
  document: 'readonly',
  navigator: 'readonly',
  console: 'readonly',
  performance: 'readonly',
  requestAnimationFrame: 'readonly',
  cancelAnimationFrame: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  fetch: 'readonly',
  URL: 'readonly',
  URLSearchParams: 'readonly',
  Headers: 'readonly',
  Request: 'readonly',
  Response: 'readonly',
  AbortController: 'readonly',
  AbortSignal: 'readonly',
  localStorage: 'readonly',
  sessionStorage: 'readonly',
  FormData: 'readonly',
  Blob: 'readonly',
  File: 'readonly',
  FileReader: 'readonly',
  ImageBitmap: 'readonly',
  HTMLCanvasElement: 'readonly',
  HTMLAnchorElement: 'readonly',
  HTMLDetailsElement: 'readonly',
  HTMLImageElement: 'readonly',
  HTMLInputElement: 'readonly',
  HTMLLabelElement: 'readonly',
  HTMLElement: 'readonly',
  HTMLDivElement: 'readonly',
  HTMLFormElement: 'readonly',
  HTMLButtonElement: 'readonly',
  HTMLTextAreaElement: 'readonly',
  HTMLSelectElement: 'readonly',
  HTMLTableElement: 'readonly',
  HTMLTableCaptionElement: 'readonly',
  HTMLTableSectionElement: 'readonly',
  HTMLUListElement: 'readonly',
  SVGElement: 'readonly',
  FileList: 'readonly',
  DataTransfer: 'readonly',
  DragEvent: 'readonly',
  ClipboardEvent: 'readonly',
  FocusEvent: 'readonly',
  InputEvent: 'readonly',
  AnimationEvent: 'readonly',
  TransitionEvent: 'readonly',
  SubmitEvent: 'readonly',
  Element: 'readonly',
  Node: 'readonly',
  NodeList: 'readonly',
  ResizeObserver: 'readonly',
  IntersectionObserver: 'readonly',
  MutationObserver: 'readonly',
  MouseEvent: 'readonly',
  WheelEvent: 'readonly',
  KeyboardEvent: 'readonly',
  TouchEvent: 'readonly',
  PointerEvent: 'readonly',
  Event: 'readonly',
  CustomEvent: 'readonly',
  EventTarget: 'readonly',
  Worker: 'readonly',
  SharedWorker: 'readonly',
  MessageChannel: 'readonly',
  MessagePort: 'readonly',
  BroadcastChannel: 'readonly',
  TextEncoder: 'readonly',
  TextDecoder: 'readonly',
  atob: 'readonly',
  btoa: 'readonly',
  crypto: 'readonly',
  createImageBitmap: 'readonly',
  matchMedia: 'readonly',
  getComputedStyle: 'readonly',
};

const reactGlobals = {
  React: 'readonly',
  JSX: 'readonly',
};

// =============================================================================
// MAIN CONFIGURATION
// =============================================================================

const eslintConfig = [
  // Base JS recommended
  js.configs.recommended,

  // Global ignores
  {
    ignores: [
      '.next/**',
      'out/**',
      'build/**',
      'dist/**',
      'node_modules/**',
      'coverage/**',
      'storybook-static/**',
      'test-results/**',
      '*.config.js',
      '*.config.mjs',
      '*.config.ts',
      'next-env.d.ts',
      'public/**',
      '.husky/**',
      // Test files excluded (separate tsconfig needed for type-aware linting)
      'test/**',
      '**/*.test.ts',
      '**/*.test.tsx',
      '**/*.spec.ts',
      '**/*.spec.tsx',
      // shadcn/ui components (generated, do not modify)
      'components/ui/**',
    ],
  },

  // =============================================================================
  // Next.js Config
  // =============================================================================
  {
    plugins: {
      '@next/next': nextPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
    },
  },

  // =============================================================================
  // TypeScript + React + All Enterprise Plugins
  // =============================================================================
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...browserGlobals,
        ...reactGlobals,
        process: 'readonly',
        module: 'readonly',
        require: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        NodeJS: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      react: react,
      'react-hooks': reactHooks,
      import: importPlugin,
      'jsx-a11y': jsxA11y,
      sonarjs: sonarjs,
      unicorn: unicorn,
      promise: promise,
      security: security,
      regexp: regexp,
      perfectionist: perfectionist,
      '@tanstack/query': tanstackQuery,
      boundaries: boundaries,
    },
    settings: {
      react: {
        version: 'detect',
      },
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
        },
      },
      'boundaries/elements': [
        { type: 'app', pattern: 'app/**/*' },
        { type: 'components', pattern: 'components/**/*' },
        { type: 'lib', pattern: 'lib/**/*' },
        { type: 'hooks', pattern: 'hooks/**/*' },
        { type: 'mocks', pattern: 'mocks/**/*' },
      ],
    },
    rules: {
      // =========================================================================
      // ESLint Core Rules (Airbnb-style)
      // =========================================================================
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
      'no-debugger': 'error',
      'no-alert': 'warn', // Demo code uses alerts for user feedback
      'no-unused-vars': 'off', // Use TypeScript version
      'no-use-before-define': 'off', // Use TypeScript version
      'no-shadow': 'off', // Use TypeScript version
      'no-bitwise': 'off',
      'no-underscore-dangle': 'off',
      'no-plusplus': 'off',
      'no-continue': 'off',
      'no-param-reassign': ['error', { props: false }],
      'no-nested-ternary': 'warn',
      'no-restricted-syntax': [
        'error',
        {
          selector: 'LabeledStatement',
          message: 'Labels are a form of GOTO; using them makes code confusing.',
        },
        {
          selector: 'WithStatement',
          message: '`with` is disallowed in strict mode.',
        },
      ],
      'prefer-const': 'error',
      'prefer-template': 'error',
      'prefer-destructuring': ['error', { object: true, array: false }],
      'arrow-body-style': ['error', 'as-needed'],
      'object-shorthand': 'error',
      'max-len': [
        'warn',
        {
          code: 120,
          ignoreStrings: true,
          ignoreTemplateLiterals: true,
          ignoreComments: true,
          ignoreUrls: true,
          ignoreRegExpLiterals: true,
        },
      ],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      curly: ['error', 'multi-line'],
      'default-case': 'warn',
      'default-case-last': 'error',
      'dot-notation': 'error',
      'grouped-accessor-pairs': 'error',
      'guard-for-in': 'error',
      'no-else-return': ['error', { allowElseIf: false }],
      'no-empty-function': 'off', // Use TypeScript version
      'no-lone-blocks': 'error',
      'no-multi-spaces': 'error',
      'no-new': 'error',
      'no-return-assign': 'error',
      'no-self-compare': 'error',
      'no-throw-literal': 'error',
      'no-useless-concat': 'error',
      'no-useless-return': 'error',
      radix: 'warn', // Allow parseInt without radix for base-10
      yoda: 'error',
      camelcase: 'off', // Disabled due to Next.js font imports using underscores
      'func-names': ['warn', 'as-needed'],
      'new-cap': ['error', { newIsCap: true, capIsNew: false }],
      'no-array-constructor': 'error',
      'no-lonely-if': 'error',
      'no-multi-assign': 'error',
      'no-unneeded-ternary': 'error',
      'one-var': ['error', 'never'],
      'operator-assignment': 'error',
      'spaced-comment': ['error', 'always'],

      // =========================================================================
      // TypeScript Rules
      // =========================================================================
      'no-redeclare': 'off', // Use TypeScript-aware version (supports overloads)
      '@typescript-eslint/no-redeclare': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-use-before-define': [
        'error',
        {
          functions: false,
          classes: true,
          variables: false, // Allow Zod lazy() circular references
        },
      ],
      '@typescript-eslint/no-shadow': 'warn',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'off', // Allow for DOM
      '@typescript-eslint/prefer-optional-chain': 'off', // Requires type-aware linting
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/prefer-as-const': 'error',
      '@typescript-eslint/naming-convention': [
        'warn',
        { selector: 'default', format: ['camelCase'] },
        { selector: 'variable', format: ['camelCase', 'UPPER_CASE', 'PascalCase', 'snake_case'] },
        { selector: 'function', format: ['camelCase', 'PascalCase'] },
        { selector: 'parameter', format: ['camelCase'], leadingUnderscore: 'allow' },
        {
          selector: 'memberLike',
          modifiers: ['private'],
          format: ['camelCase'],
          leadingUnderscore: 'allow',
        },
        { selector: 'typeLike', format: ['PascalCase'] },
        { selector: 'enumMember', format: ['UPPER_CASE', 'PascalCase'] },
        { selector: 'property', format: null },
        { selector: 'import', format: null },
        { selector: 'method', format: ['camelCase', 'snake_case'] },
        { selector: 'typeMethod', format: ['camelCase', 'snake_case'] },
      ],

      // =========================================================================
      // React Rules
      // =========================================================================
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react/require-default-props': 'off',
      'react/jsx-props-no-spreading': 'off',
      'react/function-component-definition': 'off',
      'react/jsx-no-useless-fragment': 'warn', // Sometimes needed for type coercion
      'react/jsx-boolean-value': ['error', 'never'],
      'react/jsx-curly-brace-presence': ['error', { props: 'never', children: 'never' }],
      'react/self-closing-comp': 'error',
      'react/jsx-no-target-blank': 'error',
      'react/no-array-index-key': 'warn',
      'react/no-unstable-nested-components': ['warn', { allowAsProps: true }], // Common in chart/table cell renderers
      'react/jsx-key': 'error',
      'react/jsx-no-duplicate-props': 'error',
      'react/jsx-uses-react': 'off',
      'react/jsx-uses-vars': 'error',
      'react/no-danger': 'warn',
      'react/no-deprecated': 'error',
      'react/no-direct-mutation-state': 'error',
      'react/no-find-dom-node': 'error',
      'react/no-is-mounted': 'error',
      'react/no-render-return-value': 'error',
      'react/no-string-refs': 'error',
      'react/no-unescaped-entities': 'off',
      'react/no-unknown-property': 'error',
      'react/jsx-no-comment-textnodes': 'error',
      'react/jsx-no-undef': 'error',
      'react/require-render-return': 'error',
      'react/display-name': 'off',

      // =========================================================================
      // React Hooks Rules
      // =========================================================================
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // React Compiler rules (eslint-plugin-react-hooks v5+)
      // These rules are from the React Compiler and are too strict for this UI component library
      'react-hooks/purity': 'off', // Demo data uses Date.now() which is impure but acceptable
      'react-hooks/set-state-in-effect': 'off', // Throttle/debounce hooks need setState in effects
      'react-hooks/incompatible-library': 'off', // TanStack Table returns non-memoizable functions - disabled as unfixable
      'react-hooks/refs': 'off', // Ref access patterns in drag-and-drop components
      'react-hooks/immutability': 'off', // Some mutation patterns are intentional
      'react-hooks/static-components': 'off', // Component definitions in tables/charts

      // =========================================================================
      // Next.js Rules
      // =========================================================================
      '@next/next/no-img-element': 'off',

      // =========================================================================
      // Import Rules
      // =========================================================================
      'import/prefer-default-export': 'off',
      'import/no-extraneous-dependencies': [
        'error',
        {
          devDependencies: [
            '**/*.config.*',
            '**/*.test.*',
            '**/*.spec.*',
            '**/test/**',
            '**/tests/**',
            '**/__tests__/**',
            '**/setupTests.*',
          ],
        },
      ],
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index', 'type'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
          pathGroups: [
            { pattern: 'react', group: 'builtin', position: 'before' },
            { pattern: '@/**', group: 'internal', position: 'before' },
          ],
          pathGroupsExcludedImportTypes: ['react'],
        },
      ],
      'import/no-duplicates': 'error',
      'import/first': 'error',
      'import/newline-after-import': 'error',
      'import/no-cycle': 'off', // Expensive
      'import/no-self-import': 'error',
      'import/no-useless-path-segments': 'error',
      'import/no-mutable-exports': 'error',
      'import/no-anonymous-default-export': 'warn',
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'zustand',
              message: 'Zustand is forbidden in this repo; use React Context + useReducer instead.',
            },
          ],
        },
      ],

      // =========================================================================
      // Accessibility (jsx-a11y) - WCAG Compliance
      // =========================================================================
      'jsx-a11y/alt-text': 'error',
      'jsx-a11y/anchor-has-content': 'error',
      'jsx-a11y/anchor-is-valid': 'warn', // Navigation patterns may use non-href anchors
      'jsx-a11y/aria-activedescendant-has-tabindex': 'error',
      'jsx-a11y/aria-props': 'error',
      'jsx-a11y/aria-proptypes': 'error',
      'jsx-a11y/aria-role': 'error',
      'jsx-a11y/aria-unsupported-elements': 'error',
      'jsx-a11y/click-events-have-key-events': 'off', // Canvas interactions
      'jsx-a11y/heading-has-content': 'error',
      'jsx-a11y/html-has-lang': 'error',
      'jsx-a11y/iframe-has-title': 'error',
      'jsx-a11y/img-redundant-alt': 'warn', // Alt text patterns vary
      'jsx-a11y/interactive-supports-focus': 'error',
      'jsx-a11y/label-has-associated-control': 'warn', // Some custom form patterns
      'jsx-a11y/media-has-caption': 'warn',
      'jsx-a11y/mouse-events-have-key-events': 'off', // Canvas interactions
      'jsx-a11y/no-access-key': 'error',
      'jsx-a11y/no-autofocus': 'warn',
      'jsx-a11y/no-distracting-elements': 'error',
      'jsx-a11y/no-interactive-element-to-noninteractive-role': 'error',
      'jsx-a11y/no-noninteractive-element-interactions': 'warn',
      'jsx-a11y/no-noninteractive-element-to-interactive-role': 'error',
      'jsx-a11y/no-noninteractive-tabindex': 'error',
      'jsx-a11y/no-redundant-roles': 'error',
      'jsx-a11y/no-static-element-interactions': 'off', // Canvas interactions
      'jsx-a11y/role-has-required-aria-props': 'error',
      'jsx-a11y/role-supports-aria-props': 'error',
      'jsx-a11y/scope': 'error',
      'jsx-a11y/tabindex-no-positive': 'error',

      // =========================================================================
      // SonarJS - Code Quality & Bug Detection (v3.x rules)
      // =========================================================================
      'sonarjs/cognitive-complexity': ['warn', 20],
      'sonarjs/no-duplicate-string': ['warn', { threshold: 4 }],
      'sonarjs/no-identical-functions': 'error',
      'sonarjs/no-collapsible-if': 'error',
      'sonarjs/no-redundant-boolean': 'error',
      'sonarjs/no-unused-collection': 'error',
      'sonarjs/no-use-of-empty-return-value': 'error',
      'sonarjs/prefer-single-boolean-return': 'error',
      'sonarjs/no-inverted-boolean-check': 'error',
      'sonarjs/no-nested-switch': 'error',
      'sonarjs/no-nested-template-literals': 'warn',
      'sonarjs/no-all-duplicated-branches': 'warn', // Sometimes intentional for clarity
      'sonarjs/no-empty-collection': 'error',
      'sonarjs/no-identical-conditions': 'error',
      'sonarjs/no-identical-expressions': 'error',
      'sonarjs/no-duplicated-branches': 'error',
      'sonarjs/no-redundant-jump': 'error',
      'sonarjs/no-nested-conditional': 'warn',
      'sonarjs/nested-control-flow': ['warn', { maximumNestingLevel: 4 }],

      // =========================================================================
      // Unicorn - Best Practices (100+ rules)
      // =========================================================================
      'unicorn/better-regex': 'error',
      'unicorn/catch-error-name': 'error',
      'unicorn/consistent-destructuring': 'off', // Too strict for engine code
      'unicorn/consistent-function-scoping': 'warn',
      'unicorn/error-message': 'error',
      'unicorn/escape-case': 'error',
      'unicorn/expiring-todo-comments': 'warn',
      'unicorn/explicit-length-check': 'warn', // `.length` vs `.length > 0` both valid
      'unicorn/filename-case': [
        'error',
        {
          case: 'kebabCase',
          ignore: [
            // Allow PascalCase for React components
            '^[A-Z][a-zA-Z]+\\.tsx$',
          ],
        },
      ],
      'unicorn/new-for-builtins': 'error',
      'unicorn/no-abusive-eslint-disable': 'error',
      'unicorn/no-array-callback-reference': 'off', // Too strict
      'unicorn/no-array-for-each': 'off', // forEach is fine
      'unicorn/no-array-method-this-argument': 'error',
      'unicorn/no-array-push-push': 'error',
      'unicorn/no-await-expression-member': 'warn', // Common async patterns
      'unicorn/no-console-spaces': 'error',
      'unicorn/no-document-cookie': 'warn', // Cookie handling is intentional
      'unicorn/no-empty-file': 'error',
      'unicorn/no-for-loop': 'off', // For loops are fine for performance
      'unicorn/no-hex-escape': 'error',
      'unicorn/no-instanceof-array': 'error',
      'unicorn/no-invalid-remove-event-listener': 'error',
      'unicorn/no-lonely-if': 'error',
      'unicorn/no-negated-condition': 'off',
      'unicorn/no-nested-ternary': 'off', // Already covered
      'unicorn/no-new-array': 'error',
      'unicorn/no-new-buffer': 'error',
      'unicorn/no-null': 'off', // null is valid
      'unicorn/no-object-as-default-parameter': 'error',
      'unicorn/no-process-exit': 'error',
      'unicorn/no-static-only-class': 'error',
      'unicorn/no-thenable': 'error',
      'unicorn/no-this-assignment': 'error',
      'unicorn/no-typeof-undefined': 'error',
      'unicorn/no-unnecessary-await': 'error',
      'unicorn/no-unreadable-array-destructuring': 'error',
      'unicorn/no-unreadable-iife': 'error',
      'unicorn/no-unused-properties': 'warn',
      'unicorn/no-useless-fallback-in-spread': 'error',
      'unicorn/no-useless-length-check': 'error',
      'unicorn/no-useless-promise-resolve-reject': 'error',
      'unicorn/no-useless-spread': 'error',
      'unicorn/no-useless-switch-case': 'error',
      'unicorn/no-useless-undefined': 'off', // undefined is needed sometimes
      'unicorn/no-zero-fractions': 'error',
      'unicorn/number-literal-case': 'error',
      'unicorn/numeric-separators-style': 'error',
      'unicorn/prefer-add-event-listener': 'error',
      'unicorn/prefer-array-find': 'error',
      'unicorn/prefer-array-flat': 'error',
      'unicorn/prefer-array-flat-map': 'error',
      'unicorn/prefer-array-index-of': 'error',
      'unicorn/prefer-array-some': 'warn', // Both .find() and .some() have uses
      'unicorn/prefer-at': 'off', // Not widely supported yet
      'unicorn/prefer-blob-reading-methods': 'error',
      'unicorn/prefer-code-point': 'error',
      'unicorn/prefer-date-now': 'error',
      'unicorn/prefer-default-parameters': 'warn', // Reassignment patterns are valid
      'unicorn/prefer-dom-node-append': 'error',
      'unicorn/prefer-dom-node-dataset': 'error',
      'unicorn/prefer-dom-node-remove': 'error',
      'unicorn/prefer-dom-node-text-content': 'error',
      'unicorn/prefer-event-target': 'error',
      'unicorn/prefer-export-from': 'error',
      'unicorn/prefer-includes': 'error',
      'unicorn/prefer-json-parse-buffer': 'off',
      'unicorn/prefer-keyboard-event-key': 'error',
      'unicorn/prefer-logical-operator-over-ternary': 'warn', // Ternary can be clearer in some cases
      'unicorn/prefer-math-trunc': 'error',
      'unicorn/prefer-modern-dom-apis': 'error',
      'unicorn/prefer-modern-math-apis': 'error',
      'unicorn/prefer-module': 'error',
      'unicorn/prefer-native-coercion-functions': 'error',
      'unicorn/prefer-negative-index': 'error',
      'unicorn/prefer-node-protocol': 'off', // Not for browser
      'unicorn/prefer-number-properties': 'error',
      'unicorn/prefer-object-from-entries': 'error',
      'unicorn/prefer-optional-catch-binding': 'error',
      'unicorn/prefer-prototype-methods': 'error',
      'unicorn/prefer-query-selector': 'error',
      'unicorn/prefer-reflect-apply': 'error',
      'unicorn/prefer-regexp-test': 'error',
      'unicorn/prefer-set-has': 'error',
      'unicorn/prefer-set-size': 'error',
      'unicorn/prefer-spread': 'error',
      'unicorn/prefer-string-replace-all': 'error',
      'unicorn/prefer-string-slice': 'error',
      'unicorn/prefer-string-starts-ends-with': 'error',
      'unicorn/prefer-string-trim-start-end': 'error',
      'unicorn/prefer-switch': 'warn',
      'unicorn/prefer-ternary': 'off', // Not always cleaner
      'unicorn/prefer-top-level-await': 'off', // Not for all contexts
      'unicorn/prefer-type-error': 'error',
      'unicorn/prevent-abbreviations': 'off', // Too aggressive
      'unicorn/relative-url-style': 'error',
      'unicorn/require-array-join-separator': 'error',
      'unicorn/require-number-to-fixed-digits-argument': 'error',
      'unicorn/switch-case-braces': 'error',
      'unicorn/template-indent': 'error',
      'unicorn/text-encoding-identifier-case': 'error',
      'unicorn/throw-new-error': 'error',

      // =========================================================================
      // Promise - Async/Promise Best Practices
      // =========================================================================
      'promise/always-return': 'warn',
      'promise/no-return-wrap': 'error',
      'promise/param-names': 'error',
      'promise/catch-or-return': 'warn',
      'promise/no-nesting': 'warn',
      'promise/no-promise-in-callback': 'warn',
      'promise/no-callback-in-promise': 'warn',
      'promise/no-new-statics': 'error',
      'promise/no-return-in-finally': 'error',
      'promise/valid-params': 'error',
      'promise/no-multiple-resolved': 'error',
      'promise/prefer-await-to-then': 'off', // .then() is fine
      'promise/prefer-await-to-callbacks': 'off',

      // =========================================================================
      // Security - Vulnerability Detection
      // =========================================================================
      'security/detect-buffer-noassert': 'error',
      'security/detect-child-process': 'warn',
      'security/detect-disable-mustache-escape': 'error',
      'security/detect-eval-with-expression': 'error',
      'security/detect-new-buffer': 'error',
      'security/detect-no-csrf-before-method-override': 'error',
      'security/detect-non-literal-fs-filename': 'off', // Not for browser
      'security/detect-non-literal-regexp': 'warn',
      'security/detect-non-literal-require': 'off', // Dynamic imports are ok
      'security/detect-object-injection': 'off', // Too many false positives
      'security/detect-possible-timing-attacks': 'warn',
      'security/detect-pseudoRandomBytes': 'error',
      'security/detect-unsafe-regex': 'error',
      'security/detect-bidi-characters': 'error',

      // =========================================================================
      // RegExp - Regular Expression Best Practices
      // =========================================================================
      'regexp/confusing-quantifier': 'error',
      'regexp/control-character-escape': 'error',
      'regexp/match-any': 'error',
      'regexp/negation': 'error',
      'regexp/no-contradiction-with-assertion': 'error',
      'regexp/no-control-character': 'error',
      'regexp/no-dupe-characters-character-class': 'error',
      'regexp/no-dupe-disjunctions': 'error',
      'regexp/no-empty-alternative': 'warn',
      'regexp/no-empty-capturing-group': 'error',
      'regexp/no-empty-character-class': 'error',
      'regexp/no-empty-group': 'error',
      'regexp/no-empty-lookarounds-assertion': 'error',
      'regexp/no-escape-backspace': 'error',
      'regexp/no-extra-lookaround-assertions': 'error',
      'regexp/no-invalid-regexp': 'error',
      'regexp/no-invisible-character': 'error',
      'regexp/no-lazy-ends': 'warn',
      'regexp/no-legacy-features': 'error',
      'regexp/no-misleading-capturing-group': 'error',
      'regexp/no-misleading-unicode-character': 'error',
      'regexp/no-missing-g-flag': 'error',
      'regexp/no-non-standard-flag': 'error',
      'regexp/no-obscure-range': 'error',
      'regexp/no-optional-assertion': 'error',
      'regexp/no-potentially-useless-backreference': 'warn',
      'regexp/no-standalone-backslash': 'error',
      'regexp/no-super-linear-backtracking': 'error',
      'regexp/no-super-linear-move': 'warn',
      'regexp/no-trivially-nested-assertion': 'error',
      'regexp/no-trivially-nested-quantifier': 'error',
      'regexp/no-unused-capturing-group': 'warn',
      'regexp/no-useless-assertions': 'error',
      'regexp/no-useless-backreference': 'error',
      'regexp/no-useless-character-class': 'error',
      'regexp/no-useless-dollar-replacements': 'error',
      'regexp/no-useless-escape': 'error',
      'regexp/no-useless-flag': 'error',
      'regexp/no-useless-lazy': 'error',
      'regexp/no-useless-non-capturing-group': 'error',
      'regexp/no-useless-quantifier': 'error',
      'regexp/no-useless-range': 'error',
      'regexp/no-useless-set-operand': 'error',
      'regexp/no-useless-string-literal': 'error',
      'regexp/no-useless-two-nums-quantifier': 'error',
      'regexp/no-zero-quantifier': 'error',
      'regexp/optimal-lookaround-quantifier': 'warn',
      'regexp/optimal-quantifier-concatenation': 'warn',
      'regexp/prefer-escape-replacement-dollar-char': 'error',
      'regexp/prefer-predefined-assertion': 'error',
      'regexp/prefer-quantifier': 'error',
      'regexp/prefer-range': 'error',
      'regexp/prefer-regexp-exec': 'error',
      'regexp/prefer-regexp-test': 'error',
      'regexp/prefer-result-array-groups': 'warn',
      'regexp/require-unicode-regexp': 'off', // Not always needed
      'regexp/sort-alternatives': 'off',
      'regexp/sort-character-class-elements': 'off',
      'regexp/sort-flags': 'error',
      'regexp/strict': 'error',
      'regexp/use-ignore-case': 'warn',

      // =========================================================================
      // Perfectionist - Code Organization & Sorting
      // =========================================================================
      'perfectionist/sort-imports': 'off', // Using import/order instead
      'perfectionist/sort-named-imports': ['error', { type: 'alphabetical', order: 'asc' }],
      'perfectionist/sort-named-exports': ['error', { type: 'alphabetical', order: 'asc' }],
      'perfectionist/sort-object-types': ['error', { type: 'alphabetical', order: 'asc' }],
      'perfectionist/sort-interfaces': ['error', { type: 'alphabetical', order: 'asc' }],
      'perfectionist/sort-union-types': ['error', { type: 'alphabetical', order: 'asc' }],
      'perfectionist/sort-intersection-types': ['error', { type: 'alphabetical', order: 'asc' }],
      'perfectionist/sort-enums': ['error', { type: 'alphabetical', order: 'asc' }],
      'perfectionist/sort-jsx-props': [
        'error',
        {
          type: 'alphabetical',
          order: 'asc',
        },
      ],
      'perfectionist/sort-objects': 'off', // Too aggressive for config objects
      'perfectionist/sort-array-includes': 'off',
      'perfectionist/sort-classes': 'off', // Class member order should be logical
      'perfectionist/sort-maps': 'off',
      'perfectionist/sort-switch-case': 'off',

      // =========================================================================
      // TanStack Query - React Query Best Practices
      // =========================================================================
      '@tanstack/query/exhaustive-deps': 'error',
      '@tanstack/query/no-rest-destructuring': 'warn',
      '@tanstack/query/stable-query-client': 'error',

      // =========================================================================
      // Boundaries - Module Boundary Enforcement
      // =========================================================================
      'boundaries/element-types': [
        'warn',
        {
          default: 'disallow',
          rules: [
            { from: 'app', allow: ['components', 'lib', 'hooks', 'mocks'] },
            { from: 'components', allow: ['components', 'lib', 'hooks'] },
            { from: 'hooks', allow: ['lib', 'hooks'] },
            { from: 'lib', allow: ['lib'] },
            { from: 'mocks', allow: ['lib', 'mocks'] },
          ],
        },
      ],
      'boundaries/no-unknown': 'off',
      'boundaries/no-unknown-files': 'off',
    },
  },

  // =============================================================================
  // Configuration Files
  // =============================================================================
  {
    files: ['**/*.config.ts', '**/*.config.js', '**/*.config.mjs'],
    rules: {
      'import/no-extraneous-dependencies': 'off',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },

  // =============================================================================
  // Test Files
  // =============================================================================
  {
    files: ['**/*.{test,spec}.{ts,tsx}', '**/test/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
    },
  },

  // =============================================================================
  // Playwright E2E Tests
  // =============================================================================
  {
    files: ['e2e/**/*.{ts,tsx}', '**/*.e2e.{ts,tsx}'],
    plugins: {
      playwright: playwright,
    },
    rules: {
      'playwright/expect-expect': 'error',
      'playwright/no-conditional-in-test': 'warn',
      'playwright/no-focused-test': 'error',
      'playwright/no-skipped-test': 'warn',
      'playwright/valid-expect': 'error',
      'playwright/no-standalone-expect': 'error',
      'playwright/no-wait-for-timeout': 'warn',
      'playwright/prefer-web-first-assertions': 'warn',
    },
  },

  // =============================================================================
  // Node Scripts
  // =============================================================================
  {
    files: ['scripts/**/*.{js,mjs,cjs}'],
    languageOptions: {
      globals: {
        ...browserGlobals,
        process: 'readonly',
        module: 'readonly',
        require: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
      },
    },
  },

  // =============================================================================
  // Storybook Stories
  // =============================================================================
  {
    files: ['**/*.stories.{ts,tsx}'],
    plugins: {
      storybook: storybook,
    },
    rules: {
      'storybook/await-interactions': 'error',
      'storybook/context-in-play-function': 'error',
      'storybook/default-exports': 'error',
      'storybook/hierarchy-separator': 'warn',
      'storybook/no-uninstalled-addons': 'error',
      'storybook/prefer-pascal-case': 'error',
      'storybook/story-exports': 'error',
      'storybook/use-storybook-expect': 'error',
      'storybook/use-storybook-testing-library': 'error',
      'import/order': 'off',
      'import/no-extraneous-dependencies': 'off',
      'no-useless-escape': 'off',
      '@typescript-eslint/naming-convention': 'off',
      'perfectionist/sort-jsx-props': 'off',
      'perfectionist/sort-union-types': 'off',
      'regexp/no-useless-escape': 'off',
      'regexp/strict': 'off',
      'sonarjs/no-duplicate-string': 'off',
      'unicorn/consistent-function-scoping': 'off',
      'unicorn/no-useless-fallback-in-spread': 'off',
      'unicorn/prefer-dom-node-dataset': 'off',
      'unicorn/prefer-number-properties': 'off',
      'unicorn/prefer-type-error': 'off',
      'prefer-template': 'off',
    },
  },

  // =============================================================================
  // Storybook Generated Filemap Stories
  // =============================================================================
  {
    files: ['.storybook/stories/filemap/**/*.{ts,tsx}'],
    rules: {
      'unicorn/filename-case': 'off',
    },
  },

  // =============================================================================
  // Storybook Config Files
  // =============================================================================
  {
    files: ['.storybook/**/*.{ts,tsx}'],
    rules: {
      'import/no-extraneous-dependencies': 'off',
      '@typescript-eslint/no-shadow': 'off',
      'unicorn/better-regex': 'off',
      'unicorn/prefer-export-from': 'off',
    },
  },
];

export default eslintConfig;
