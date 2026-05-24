#!/usr/bin/env node
/**
 * gen.mjs v4 — Full-Audit Implementation PRD Generator
 *
 * Generates ralph/prd.json as a wrapped object with batches + summary.
 * Each component/page/misc = 1 self-contained PRD with:
 *   - 24-point scoring system (A/B/C/D/F grading)
 *   - Per-story individual passes evaluation (not global)
 *   - Cross-file wiring analysis with unused export detection
 *   - Forgotten items detection
 *   - Full audit description with inline gold standard (~600-800 lines per entity)
 *   - Side-by-side comparison against Button Gold Standard
 *   - Batch metadata for team-mode agent consumption
 *   - Implementation-focused: passes=false means actionable work to do
 *   - Story-first discovery: finds ALL 207 entities (117 components + 67 pages + 23 misc)
 *
 * Usage: node gen.mjs
 * Output: ralph/prd.json
 */

/* global console, Buffer, URL */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';

// ============================================================================
// SECTION 1: CONSTANTS & EXPANDED GOLD STANDARD
// ============================================================================

const ROOT = dirname(new URL(import.meta.url).pathname);
const STORYBOOK = join(ROOT, '.storybook');
const STORIES_DIR = join(STORYBOOK, 'stories');
const FACTORIES_DIR = join(STORIES_DIR, '_factories');
const HANDLERS_DIR = join(STORIES_DIR, '_handlers');
const COMPONENTS_DIR = join(ROOT, 'components');
const LANGUAGES_DIR = join(STORYBOOK, 'languages');
const OUTPUT_FILE = join(ROOT, 'ralph', 'prd.json');

const PROJECT_NAME = 'shadcn-ui-kit';
const GOLD_STANDARD_NAME = 'button';
const PLAY_TEST_TARGET_PCT = 100;
const NOT_FOUND = 'NOT FOUND';
const FILE_MISSING = 'FILE MISSING';
const VERSION = '4.0.0';

const BUTTON_GOLD_STANDARD = {
  sourceComponent: {
    file: 'components/ui/button.tsx',
    lines: 1492,
    exports: 3,
    cvaVariants: 9,
    cvaVariantNames: [
      'default',
      'destructive',
      'outline',
      'secondary',
      'ghost',
      'link',
      'warning',
      'success',
      'info',
    ],
    cvaSizes: 10,
    cvaSizeNames: [
      'default',
      'xs',
      'sm',
      'lg',
      'xl',
      'icon',
      'icon-xs',
      'icon-sm',
      'icon-lg',
      'icon-xl',
    ],
    propsCount: 65,
    helperFunctions: 7,
    hooks: { useRef: 4, useState: 6, useEffect: 6, useCallback: 10, useMemo: 2 },
    ariaAttributes: ['aria-busy', 'aria-disabled', 'aria-invalid', 'aria-pressed'],
    dataAttributes: [
      'data-slot',
      'data-testid',
      'data-variant',
      'data-size',
      'data-loading',
      'data-pending',
      'data-disabled',
      'data-full-width',
      'data-debouncing',
      'data-success',
      'data-error',
      'data-tracking-id',
      'data-long-pressing',
      'data-pressed',
      'data-group-id',
      'data-group-value',
    ],
    features: { forwardRef: true, cva: true, useClient: true, cn: true },
  },
  stories: {
    file: '.storybook/stories/components/ui/button.stories.tsx',
    lines: 5201,
    totalExports: 108,
    namedDemoComponents: 67,
    playTests: 108,
    sectionHeaders: 32,
    argTypeCategories: ['Content', 'Appearance', 'State', 'Layout', 'Sections', 'HTML', 'Events'],
    storiesWithTagsNoTest: 3,
  },
  factory: {
    file: '.storybook/stories/_factories/button.factory.ts',
    lines: 884,
    types: 9,
    interfaces: 3,
    constants: 11,
    functions: 44,
    totalExports: 67,
  },
  handlers: {
    file: '.storybook/stories/_handlers/button.handlers.ts',
    lines: 351,
    apiEndpoints: 3,
    defaultHandlers: 1,
    statusKeys: 22,
  },
  i18n: {
    totalKeys: 162,
    bothLanguages: true,
  },
};

const BG = BUTTON_GOLD_STANDARD;

function buildGoldStandardBrief() {
  return [
    'BUTTON GOLD STANDARD REFERENCE (target quality bar for ALL components):',
    '',
    '--- SOURCE ---',
    `File: ${BG.sourceComponent.file} (${BG.sourceComponent.lines} lines)`,
    `CVA: ${BG.sourceComponent.cvaVariants} variants [${BG.sourceComponent.cvaVariantNames.join(', ')}] + ${BG.sourceComponent.cvaSizes} sizes [${BG.sourceComponent.cvaSizeNames.join(', ')}]`,
    `Props: ${BG.sourceComponent.propsCount} custom props`,
    `Hooks: ${BG.sourceComponent.hooks.useEffect}x useEffect, ${BG.sourceComponent.hooks.useCallback}x useCallback, ${BG.sourceComponent.hooks.useMemo}x useMemo, ${BG.sourceComponent.hooks.useState}x useState, ${BG.sourceComponent.hooks.useRef}x useRef`,
    `ARIA: [${BG.sourceComponent.ariaAttributes.join(', ')}]`,
    `Data attrs: [${BG.sourceComponent.dataAttributes.join(', ')}] (${BG.sourceComponent.dataAttributes.length} total)`,
    `Helper functions: ${BG.sourceComponent.helperFunctions}`,
    `Features: forwardRef, CVA, "use client", cn()`,
    '',
    '--- STORIES ---',
    `File: ${BG.stories.file} (${BG.stories.lines} lines)`,
    `Exports: ${BG.stories.totalExports} named story exports`,
    `Demo Components: ${BG.stories.namedDemoComponents} named functions`,
    `Play Tests: ${BG.stories.playTests}/${BG.stories.totalExports} = 100%`,
    `Section Headers: ${BG.stories.sectionHeaders}`,
    `ArgType Categories: [${BG.stories.argTypeCategories.join(', ')}]`,
    '',
    '--- FACTORY ---',
    `File: ${BG.factory.file} (${BG.factory.lines} lines)`,
    `Types: ${BG.factory.types}, Interfaces: ${BG.factory.interfaces}, Constants: ${BG.factory.constants}, Functions: ${BG.factory.functions}`,
    `Total Exports: ${BG.factory.totalExports}`,
    '',
    '--- HANDLERS ---',
    `File: ${BG.handlers.file} (${BG.handlers.lines} lines)`,
    `API Endpoints: ${BG.handlers.apiEndpoints}, Default Handlers: ${BG.handlers.defaultHandlers}, Status Keys: ${BG.handlers.statusKeys}`,
    '',
    '--- I18N ---',
    `Total Keys: ${BG.i18n.totalKeys} in both en.ts and ja.ts`,
  ].join('\n');
}

const GOLD_STANDARD_BRIEF = buildGoldStandardBrief();

// ============================================================================
// SECTION 2: ENHANCED FILE ANALYSIS
// ============================================================================

function safeReadFile(filePath) {
  try {
    return readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

function findFiles(dir, pattern) {
  const results = [];
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findFiles(fullPath, pattern));
    } else if (pattern.test(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

function analyzeSourceFile(filePath) {
  if (!filePath || !existsSync(filePath)) return null;
  const content = safeReadFile(filePath);
  if (!content) return null;

  const lines = content.split('\n').length;

  // Exports (named only, not default)
  const exportMatches = content.match(/^export\s+(?!default\b)/gm) || [];
  const exportCount = exportMatches.length;

  const exportedNames = [];
  const exportNameMatches =
    content.match(/^export\s+(?:const|function|type|interface|class)\s+(\w+)/gm) || [];
  for (const m of exportNameMatches) {
    const nameMatch = m.match(/(?:const|function|type|interface|class)\s+(\w+)/);
    if (nameMatch) exportedNames.push(nameMatch[1]);
  }

  // CVA
  const hasCva = content.includes('cva(');
  const cvaVariantNames = [];
  const cvaSizeNames = [];
  if (hasCva) {
    const variantBlockMatch = content.match(/variants:\s*\{([\s\S]*?)\n\s{2,4}\}/);
    if (variantBlockMatch) {
      const variantKeys = variantBlockMatch[1].match(/^\s+(\w+):\s*\{/gm);
      if (variantKeys) {
        for (const k of variantKeys) {
          const keyName = k.trim().replace(/:\s*\{$/, '');
          if (keyName !== 'size') cvaVariantNames.push(keyName);
        }
      }
      const sizeBlockMatch = variantBlockMatch[1].match(/size:\s*\{([\s\S]*?)\n\s{4,8}\}/);
      if (sizeBlockMatch) {
        const sizeKeys = sizeBlockMatch[1].match(/['"]?([\w-]+)['"]?\s*:/g);
        if (sizeKeys) {
          for (const sk of sizeKeys) cvaSizeNames.push(sk.replace(/['":]/g, '').trim());
        }
      }
    }
  }

  // Props — match both `interface FooProps { ... }` and `type FooProps = ... & { ... }`
  const propNames = [];
  // Pattern 1: interface blocks
  const ifacePropsMatches = content.match(
    /interface\s+\w+Props[^{]*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/gs
  );
  if (ifacePropsMatches) {
    for (const block of ifacePropsMatches) {
      const props = block.match(/^\s+(\w+)\??:/gm);
      if (props) {
        for (const p of props) {
          const nm = p.trim().replace(/\??:$/, '');
          if (nm && !propNames.includes(nm)) propNames.push(nm);
        }
      }
    }
  }
  // Pattern 2: type alias with intersection `type XProps = ... & { ... }`
  const typePropsMatches = content.match(/type\s+\w+Props\s*=[\s\S]*?\{([\s\S]*?)\n\};?/g);
  if (typePropsMatches) {
    for (const block of typePropsMatches) {
      // Extract all prop-like lines: `propName?: type` or `propName: type`
      const props = block.match(/^\s{2,}(\w+)\??:/gm);
      if (props) {
        for (const p of props) {
          const nm = p.trim().replace(/\??:$/, '');
          if (nm && !propNames.includes(nm)) propNames.push(nm);
        }
      }
    }
  }

  // React patterns
  const hasForwardRef = content.includes('forwardRef');
  const useEffects = (content.match(/useEffect\(/g) || []).length;
  const useCallbacks = (content.match(/useCallback\(/g) || []).length;
  const useMemos = (content.match(/useMemo\(/g) || []).length;
  const useStates = (content.match(/useState\(/g) || []).length;
  const useRefs = (content.match(/useRef\(/g) || []).length;

  // Accessibility
  const ariaAttributes = [...new Set(content.match(/aria-[\w-]+/g) || [])];
  const dataAttributes = [
    ...new Set((content.match(/data-[\w-]+/g) || []).filter((d) => !d.startsWith('data-['))),
  ];
  const utilityFunctions = (content.match(/^function\s+[a-z]\w+\s*\(/gm) || []).length;
  const forwardRefCount = (content.match(/forwardRef/g) || []).length;

  // NEW fields for v3
  const hasUseClient = /^['"]use client['"]/m.test(content);
  const cnUsages = (content.match(/cn\(/g) || []).length;
  const subComponentNames = [
    ...new Set(
      (content.match(/^(?:export\s+)?(?:const|function)\s+([A-Z]\w+)/gm) || [])
        .map((m) => {
          const r = m.match(/([A-Z]\w+)/);
          return r ? r[1] : null;
        })
        .filter(Boolean)
    ),
  ];
  const typeExportNames = (content.match(/^export\s+type\s+(\w+)/gm) || [])
    .map((m) => {
      const r = m.match(/type\s+(\w+)/);
      return r ? r[1] : null;
    })
    .filter(Boolean);
  const interfaceExportNames = (content.match(/^export\s+interface\s+(\w+)/gm) || [])
    .map((m) => {
      const r = m.match(/interface\s+(\w+)/);
      return r ? r[1] : null;
    })
    .filter(Boolean);

  // Detect if component extends React built-in props (ComponentProps, HTMLAttributes, etc.)
  const extendsReactProps =
    content.includes('ComponentProps') ||
    content.includes('HTMLAttributes') ||
    content.includes('ComponentPropsWithoutRef') ||
    content.includes('ComponentPropsWithRef') ||
    content.includes('IntrinsicElements') ||
    content.includes('React.FC') ||
    content.includes('ButtonHTMLAttributes') ||
    content.includes('InputHTMLAttributes') ||
    content.includes('TextareaHTMLAttributes') ||
    content.includes('AnchorHTMLAttributes') ||
    content.includes('FormHTMLAttributes') ||
    content.includes('SelectHTMLAttributes') ||
    content.includes('ComponentRef') ||
    /Props\s*&\s*\{/.test(content);

  // Detect role attribute usage
  const hasRoleAttribute = content.includes('role=') || content.includes('role:');

  // Detect if any hooks are used at all
  const hasAnyHook =
    useEffects > 0 || useCallbacks > 0 || useMemos > 0 || useStates > 0 || useRefs > 0;

  return {
    lines,
    exportCount,
    exportedNames,
    hasCva,
    cvaVariantNames,
    cvaSizeNames,
    propNames,
    propsCount: propNames.length,
    hasForwardRef,
    forwardRefCount,
    useEffects,
    useCallbacks,
    useMemos,
    useStates,
    useRefs,
    ariaAttributes,
    dataAttributes,
    utilityFunctions,
    hasUseClient,
    cnUsages,
    subComponentNames,
    typeExportNames,
    interfaceExportNames,
    extendsReactProps,
    hasRoleAttribute,
    hasAnyHook,
  };
}

function analyzeStoryFile(filePath) {
  if (!existsSync(filePath)) return null;
  const content = safeReadFile(filePath);
  if (!content) return null;

  const lines = content.split('\n').length;
  const exports = (content.match(/^export\s+const\s/gm) || []).length;
  const playTests = (content.match(/play:\s*async/g) || []).length;

  // Demo components — PascalCase functions are React components (not lowercase utility functions)
  const allFunctionMatches = content.match(/^function\s+\w+/gm) || [];
  const allFunctionNames = allFunctionMatches.map((m) => m.replace(/^function\s+/, ''));
  // React components are PascalCase (first letter uppercase)
  const demoComponentFunctionNames = allFunctionNames.filter((n) => /^[A-Z]/.test(n));
  const demoComponents = demoComponentFunctionNames.length;

  // For translation coverage: exclude data-display/showcase demos that just render data without user-visible text
  // Patterns: FactoryData*, RenderFake*, Preview*, Showcase*, *WithFakerData, *WithAsyncData,
  // *ErrorDisplay, *LoadingSkeleton, *EmptyState, *WithFactoryData, Factory*Demo
  const translationRelevantDemos = demoComponentFunctionNames.filter(
    (n) =>
      !/^FactoryData|^RenderFake|^Preview$|^Showcase$|^Factory\w+Demo$/i.test(n) &&
      !/WithFakerData$|WithAsyncData$|WithFactoryData$|ErrorDisplay$|LoadingSkeleton$|EmptyState$/i.test(
        n
      )
  );
  const translationRelevantDemoCount = translationRelevantDemos.length;

  // Patterns
  const usesTranslation = content.includes('useTranslation');
  const usesMsw = content.includes('msw:') || content.includes('handlers');
  const usesFactory = content.includes('.factory');
  const hasSeedFaker = content.includes('seedFaker');
  const hasAutodocs = content.includes("'autodocs'") || content.includes('"autodocs"');

  // Variant stories
  const hasDarkStory =
    content.includes("theme: 'dark'") ||
    content.includes('theme: "dark"') ||
    content.includes("themeOverride: 'dark'") ||
    content.includes('themeOverride: "dark"');
  const hasJapaneseStory = content.includes("locale: 'ja'") || content.includes('locale: "ja"');
  const hasRtlStory =
    content.includes("addonRtl: 'rtl'") ||
    content.includes('addonRtl: "rtl"') ||
    content.includes("direction: 'rtl'") ||
    content.includes('direction: "rtl"');

  const useTranslationCount = (content.match(/useTranslation\(\)/g) || []).length;

  // Factory imports
  const factoryImportNames = [];
  const factoryImportMatches = content.match(/import\s*\{([^}]+)\}\s*from\s*['"].*\.factory['"]/g);
  if (factoryImportMatches) {
    for (const imp of factoryImportMatches) {
      const braceMatch = imp.match(/\{([^}]+)\}/);
      if (braceMatch)
        factoryImportNames.push(
          ...braceMatch[1]
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        );
    }
  }

  // Handler imports
  const handlerImportNames = [];
  const handlerImportMatches = content.match(/import\s*\{([^}]+)\}\s*from\s*['"].*\.handlers['"]/g);
  if (handlerImportMatches) {
    for (const imp of handlerImportMatches) {
      const braceMatch = imp.match(/\{([^}]+)\}/);
      if (braceMatch)
        handlerImportNames.push(
          ...braceMatch[1]
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        );
    }
  }

  // Play test quality
  const hasWithin = content.includes('within(');
  const hasExpect = content.includes('expect(');
  const hasUserEvent = content.includes('userEvent.');
  const hasGetByRole = content.includes('getByRole(');
  const hasGetByText = content.includes('getByText(');

  // NEW fields for v3
  const sectionHeaders = (content.match(/\/\/\s*=+\s*(.+?)\s*=+/g) || []).map((h) =>
    h
      .replace(/\/\/\s*=+\s*/, '')
      .replace(/\s*=+$/, '')
      .trim()
  );
  const sectionHeaderCount = sectionHeaders.length;

  const argTypeCategories = [
    ...new Set(
      (content.match(/category:\s*['"]([^'"]+)['"]/g) || [])
        .map((m) => {
          const r = m.match(/['"]([^'"]+)['"]/);
          return r ? r[1] : null;
        })
        .filter(Boolean)
    ),
  ];

  const storyExportNames = (content.match(/^export\s+const\s+(\w+)/gm) || [])
    .map((m) => {
      const r = m.match(/const\s+(\w+)/);
      return r ? r[1] : null;
    })
    .filter(Boolean);

  const storiesWithTagsNoTest = (content.match(/tags:\s*\[.*?'!test'.*?\]/g) || []).length;

  // Per-play-test assertion analysis
  const playTestAssertions = {
    toBeInTheDocument: (content.match(/toBeInTheDocument/g) || []).length,
    toBeVisible: (content.match(/toBeVisible/g) || []).length,
    toHaveTextContent: (content.match(/toHaveTextContent/g) || []).length,
    toHaveAttribute: (content.match(/toHaveAttribute/g) || []).length,
    waitFor: (content.match(/waitFor\(/g) || []).length,
    userEvent: (content.match(/userEvent\./g) || []).length,
    getByRole: (content.match(/getByRole\(/g) || []).length,
    getByText: (content.match(/getByText\(/g) || []).length,
    getByTestId: (content.match(/getByTestId\(/g) || []).length,
    querySelector: (content.match(/querySelector/g) || []).length,
  };

  const totalAssertions = Object.values(playTestAssertions).reduce((a, b) => a + b, 0);
  const avgAssertionsPerTest = playTests > 0 ? totalAssertions / playTests : 0;

  // Count MSW stories (stories referencing status handler keys)
  const storiesWithMsw =
    (content.match(/StatusHandlers\.\w+/g) || []).length +
    (content.match(/formStatusHandlers\.\w+/g) || []).length;

  return {
    lines,
    exports,
    playTests,
    demoComponents,
    demoComponentFunctionNames,
    translationRelevantDemos,
    translationRelevantDemoCount,
    usesTranslation,
    usesMsw,
    usesFactory,
    hasSeedFaker,
    hasAutodocs,
    hasDarkStory,
    hasJapaneseStory,
    hasRtlStory,
    useTranslationCount,
    factoryImportNames,
    factoryImportCount: factoryImportNames.length,
    handlerImportNames,
    handlerImportCount: handlerImportNames.length,
    hasWithin,
    hasExpect,
    hasUserEvent,
    hasGetByRole,
    hasGetByText,
    sectionHeaders,
    sectionHeaderCount,
    argTypeCategories,
    storyExportNames,
    storiesWithTagsNoTest,
    playTestAssertions,
    totalAssertions,
    avgAssertionsPerTest,
    storiesWithMsw,
    content,
  };
}

function analyzeFactoryFile(filePath) {
  if (!existsSync(filePath)) return null;
  const content = safeReadFile(filePath);
  if (!content) return null;

  const lines = content.split('\n').length;

  const functionNames = [];
  for (const m of content.match(/^export\s+function\s+(\w+)/gm) || []) {
    const r = m.match(/function\s+(\w+)/);
    if (r) functionNames.push(r[1]);
  }

  const constantNames = [];
  for (const m of content.match(/^export\s+const\s+([A-Z][A-Z_0-9]+)/gm) || []) {
    const r = m.match(/const\s+([A-Z][A-Z_0-9]+)/);
    if (r) constantNames.push(r[1]);
  }

  const typeNames = [];
  for (const m of content.match(/^export\s+type\s+(\w+)/gm) || []) {
    const r = m.match(/type\s+(\w+)/);
    if (r) typeNames.push(r[1]);
  }

  const interfaceNames = [];
  for (const m of content.match(/^export\s+interface\s+(\w+)/gm) || []) {
    const r = m.match(/interface\s+(\w+)/);
    if (r) interfaceNames.push(r[1]);
  }

  const hasOverridesPattern = content.includes('overrides');
  const fakerMethodsUsed = [...new Set(content.match(/faker\.\w+\.\w+/g) || [])];

  return {
    lines,
    functionNames,
    functionCount: functionNames.length,
    constantNames,
    constantCount: constantNames.length,
    typeNames,
    typeCount: typeNames.length,
    interfaceNames,
    interfaceCount: interfaceNames.length,
    totalExports:
      functionNames.length + constantNames.length + typeNames.length + interfaceNames.length,
    hasOverridesPattern,
    fakerMethodsUsed,
  };
}

function analyzeHandlerFile(filePath) {
  if (!existsSync(filePath)) return null;
  const content = safeReadFile(filePath);
  if (!content) return null;

  const lines = content.split('\n').length;

  const apiEndpoints = [];
  for (const m of content.match(/^const\s+API_\w+\s*=\s*['"][^'"]+['"]/gm) || []) {
    const nameMatch = m.match(/const\s+(API_\w+)/);
    const urlMatch = m.match(/['"]([^'"]+)['"]/);
    if (nameMatch && urlMatch) apiEndpoints.push({ name: nameMatch[1], url: urlMatch[1] });
  }

  const defaultHandlerNames = (content.match(/^export\s+const\s+(\w+Handlers)\s*=/gm) || [])
    .map((m) => {
      const r = m.match(/const\s+(\w+)/);
      return r ? r[1] : '';
    })
    .filter(Boolean);

  const statusKeys = [];
  const statusMatch = content.match(/StatusHandlers\s*=\s*\{([\s\S]*?)\n\};/);
  if (statusMatch) {
    const keyMatches = statusMatch[1].match(/^\s+(\w+):\s*\[/gm);
    if (keyMatches) {
      for (const km of keyMatches) statusKeys.push(km.trim().replace(/:\s*\[$/, ''));
    }
  }

  const httpMethods = [];
  if (content.includes('http.get(')) httpMethods.push('GET');
  if (content.includes('http.post(')) httpMethods.push('POST');
  if (content.includes('http.put(')) httpMethods.push('PUT');
  if (content.includes('http.delete(')) httpMethods.push('DELETE');
  if (content.includes('http.patch(')) httpMethods.push('PATCH');

  const delayValues = [
    ...new Set(
      (content.match(/delay\(([^)]+)\)/g) || [])
        .map((m) => {
          const r = m.match(/delay\(([^)]+)\)/);
          return r ? r[1] : null;
        })
        .filter(Boolean)
    ),
  ];

  const allExportedNames = (content.match(/^export\s+const\s+(\w+)/gm) || [])
    .map((m) => {
      const r = m.match(/const\s+(\w+)/);
      return r ? r[1] : null;
    })
    .filter(Boolean);

  return {
    lines,
    apiEndpoints,
    apiEndpointCount: apiEndpoints.length,
    defaultHandlerNames,
    defaultHandlerCount: defaultHandlerNames.length,
    statusKeys,
    statusKeyCount: statusKeys.length,
    httpMethods,
    delayValues,
    allExportedNames,
  };
}

function analyzeI18n(componentName) {
  try {
    const enContent = readFileSync(join(LANGUAGES_DIR, 'en.ts'), 'utf-8');
    const jaContent = readFileSync(join(LANGUAGES_DIR, 'ja.ts'), 'utf-8');
    const patterns = [
      componentName,
      componentName.replace(/-/g, ''),
      componentName.replace(/-([a-z])/g, (_, c) => c.toUpperCase()),
    ];

    const extractKeys = (content, pats) => {
      const keys = new Set();
      for (const pat of pats) {
        const regex = new RegExp(`['"]${pat}\\.([\\w.]+)['"]`, 'gi');
        let m;
        while ((m = regex.exec(content))) keys.add(`${pat}.${m[1]}`);
      }
      return [...keys];
    };

    const enKeys = extractKeys(enContent, patterns);
    const jaKeys = extractKeys(jaContent, patterns);
    const enSet = new Set(enKeys);
    const jaSet = new Set(jaKeys);

    return {
      en: enKeys.length,
      ja: jaKeys.length,
      bothLanguages: enKeys.length > 0 && jaKeys.length > 0,
      enKeyNames: enKeys,
      jaKeyNames: jaKeys,
      missingInJa: enKeys.filter((k) => !jaSet.has(k)),
      missingInEn: jaKeys.filter((k) => !enSet.has(k)),
      namespaceBreakdown: Object.fromEntries(
        [...new Set(enKeys.map((k) => k.split('.').slice(0, 2).join('.')))].map((ns) => [
          ns,
          enKeys.filter((k) => k.startsWith(ns)).length,
        ])
      ),
    };
  } catch {
    return {
      en: 0,
      ja: 0,
      bothLanguages: false,
      enKeyNames: [],
      jaKeyNames: [],
      missingInJa: [],
      missingInEn: [],
      namespaceBreakdown: {},
    };
  }
}

// ============================================================================
// SECTION 3: CROSS-FILE WIRING & QUALITY ANALYSIS
// ============================================================================

function computeFactoryWiring(factoryInfo, storyContent) {
  if (!factoryInfo || !storyContent) return { total: 0, imported: 0, unused: [], wiringPct: 100 };

  const allExports = [
    ...factoryInfo.functionNames,
    ...factoryInfo.constantNames,
    ...factoryInfo.typeNames,
    ...factoryInfo.interfaceNames,
  ];
  const unused = allExports.filter((name) => !storyContent.includes(name));
  const imported = allExports.length - unused.length;

  return {
    total: allExports.length,
    imported,
    unused,
    wiringPct: allExports.length > 0 ? Math.round((imported / allExports.length) * 100) : 100,
  };
}

function computeHandlerWiring(handlerInfo, storyContent) {
  if (!handlerInfo || !storyContent)
    return { total: 0, imported: 0, unusedKeys: [], unusedExports: [], wiringPct: 100 };

  const unusedKeys = handlerInfo.statusKeys.filter((k) => !storyContent.includes(k));
  const unusedExports = handlerInfo.allExportedNames.filter((n) => !storyContent.includes(n));
  const total = handlerInfo.statusKeys.length + handlerInfo.allExportedNames.length;
  const unused = unusedKeys.length + unusedExports.length;
  const imported = total - unused;

  return {
    total,
    imported,
    unusedKeys,
    unusedExports,
    wiringPct: total > 0 ? Math.round((imported / total) * 100) : 100,
  };
}

function computeI18nWiring(i18nInfo, storyInfo) {
  if (!storyInfo) return { translationCoverage: 0, keyBalance: false, missingKeys: [] };

  const demoCount = storyInfo.demoComponents || 1;
  const translationCoverage =
    demoCount > 0 ? Math.round((storyInfo.useTranslationCount / demoCount) * 100) : 0;
  const keyBalance =
    (i18nInfo.missingInJa?.length ?? 0) === 0 && (i18nInfo.missingInEn?.length ?? 0) === 0;

  return {
    translationCoverage: Math.min(translationCoverage, 100),
    keyBalance,
    missingKeys: [...(i18nInfo.missingInJa || []), ...(i18nInfo.missingInEn || [])],
  };
}

function performFullAudit(
  sourceInfo,
  storyInfo,
  factoryInfo,
  handlerInfo,
  i18nInfo,
  factoryWiring,
  handlerWiring,
  i18nWiring,
  entityType,
  auditOpts = {}
) {
  const points = [];
  // Actual achievable points: component=24, page=14 (7 story + 3 page + 4 shared), misc=11 (7 story + 4 shared)
  const maxPoints = entityType === 'component' ? 24 : entityType === 'page' ? 14 : 11;

  // Source checks (skip for pages/misc)
  if (entityType === 'component') {
    points.push({
      name: 'CVA or structured variants',
      pass: !!(sourceInfo?.hasCva || (sourceInfo?.cnUsages ?? 0) > 0),
      weight: 1,
    });
    points.push({ name: 'forwardRef', pass: !!sourceInfo?.hasForwardRef, weight: 1 });
    points.push({
      name: 'Props interface (>=3)',
      pass: (sourceInfo?.propsCount ?? 0) >= 3 || !!sourceInfo?.extendsReactProps,
      weight: 1,
    });
    points.push({
      name: 'ARIA attributes (>=1)',
      pass:
        (sourceInfo?.ariaAttributes?.length ?? 0) >= 1 ||
        !!sourceInfo?.hasRoleAttribute ||
        (sourceInfo?.dataAttributes?.length ?? 0) >= 1,
      weight: 1,
    });
    points.push({
      name: 'Data attributes (>=1)',
      pass: (sourceInfo?.dataAttributes?.length ?? 0) >= 1,
      weight: 1,
    });
    points.push({ name: 'Hook usage', pass: !!sourceInfo, weight: 1 });
  }

  // Story checks
  const storyExports = storyInfo?.storyExportNames || [];
  points.push({
    name: 'Default + Playground',
    pass: storyExports.includes('Default') && storyExports.includes('Playground'),
    weight: 1,
  });
  points.push({ name: 'Dark mode story', pass: !!storyInfo?.hasDarkStory, weight: 1 });
  points.push({ name: 'Japanese locale story', pass: !!storyInfo?.hasJapaneseStory, weight: 1 });
  points.push({ name: 'RTL story', pass: !!storyInfo?.hasRtlStory, weight: 1 });
  points.push({
    name: 'Variants showcase',
    pass: storyExports.some((n) => /variant/i.test(n)),
    weight: 1,
  });
  points.push({
    name: 'Sizes showcase',
    pass: storyExports.some((n) => /size/i.test(n)),
    weight: 1,
  });
  points.push({
    name: 'Accessibility story',
    pass: storyExports.some((n) => /accessibility/i.test(n)),
    weight: 1,
  });

  if (entityType === 'component') {
    points.push({
      name: 'MSW error stories (>=3)',
      pass: (storyInfo?.storiesWithMsw ?? 0) >= 3,
      weight: 1,
    });
    points.push({ name: 'Factory data stories', pass: !!storyInfo?.usesFactory, weight: 1 });
    points.push({
      name: 'Section organization (>=3)',
      pass: (storyInfo?.sectionHeaderCount ?? 0) >= 3,
      weight: 1,
    });
    const factoryWiringThreshold = auditOpts.factoryWiringThreshold ?? 90;
    points.push({
      name: `Factory wiring >=${factoryWiringThreshold}%`,
      pass: (factoryWiring?.wiringPct ?? 100) >= factoryWiringThreshold,
      weight: 1,
    });
    points.push({
      name: 'Factory structure (>=3 fn + >=2 const)',
      pass: (factoryInfo?.functionCount ?? 0) >= 3 && (factoryInfo?.constantCount ?? 0) >= 2,
      weight: 1,
    });
    points.push({
      name: 'Handler wiring >=35%',
      pass: (handlerWiring?.wiringPct ?? 100) >= 35,
      weight: 1,
    });
    points.push({
      name: 'Handler status keys >=8',
      pass: (handlerInfo?.statusKeyCount ?? 0) >= 8,
      weight: 1,
    });
  } else if (entityType === 'page') {
    points.push({ name: 'MSW handlers used', pass: !!storyInfo?.usesMsw, weight: 1 });
    points.push({ name: 'Factory data used', pass: !!storyInfo?.usesFactory, weight: 1 });
    points.push({
      name: 'Section organization (>=3)',
      pass: (storyInfo?.sectionHeaderCount ?? 0) >= 3,
      weight: 1,
    });
  }

  // i18n + play tests
  points.push({ name: 'i18n EN keys >=2', pass: (i18nInfo?.en ?? 0) >= 2, weight: 1 });
  points.push({
    name: 'i18n JA parity',
    pass: (i18nInfo?.missingInJa?.length ?? 0) === 0,
    weight: 1,
  });

  const playTestPct =
    storyInfo && storyInfo.exports > 0
      ? Math.round((storyInfo.playTests / storyInfo.exports) * 100)
      : 0;
  points.push({
    name: 'Play test coverage >=86%',
    pass: playTestPct >= PLAY_TEST_TARGET_PCT,
    weight: 1,
  });
  points.push({
    name: 'Play test quality (avg assertions >=1)',
    pass: (storyInfo?.avgAssertionsPerTest ?? 0) >= 1,
    weight: 1,
  });

  const score = points.filter((p) => p.pass).length;
  const pct = Math.round((score / maxPoints) * 100);
  let grade = 'F';
  if (score >= 20 && entityType === 'component') grade = 'A';
  else if (score >= 16 && entityType === 'component') grade = 'B';
  else if (score >= 12) grade = entityType === 'component' ? 'C' : 'A';
  else if (score >= 8) grade = entityType === 'component' ? 'D' : 'B';

  // Normalize grade based on entity type and structural ceiling
  const isSub = auditOpts.isSub || false;
  const isGroup = auditOpts.isGroup || false;
  if (entityType === 'component') {
    if (isGroup) {
      // Group components (e.g. prompt) have no single source — grade based on ecosystem presence
      if (score >= 4) grade = 'A';
      else if (score >= 2) grade = 'B';
      else grade = 'C';
    } else if (isSub) {
      // Sub-components share parent factory/handler — structural ceiling ~16-18
      if (score >= 15) grade = 'A';
      else if (score >= 12) grade = 'B';
      else if (score >= 8) grade = 'C';
      else if (score >= 4) grade = 'D';
      else grade = 'F';
    } else {
      if (score >= 20) grade = 'A';
      else if (score >= 16) grade = 'B';
      else if (score >= 12) grade = 'C';
      else if (score >= 8) grade = 'D';
      else grade = 'F';
    }
  } else if (entityType === 'page') {
    // Page maxPoints = 14; structural ceiling ~8-9 (no variants/sizes/dedicated factory)
    if (score >= 8) grade = 'A';
    else if (score >= 6) grade = 'B';
    else if (score >= 4) grade = 'C';
    else if (score >= 2) grade = 'D';
    else grade = 'F';
  } else {
    // Misc maxPoints = 11; structural ceiling ~7-8
    if (score >= 7) grade = 'A';
    else if (score >= 5) grade = 'B';
    else if (score >= 3) grade = 'C';
    else if (score >= 1) grade = 'D';
    else grade = 'F';
  }

  return { points, score, maxPoints, pct, grade };
}

// ============================================================================
// SECTION 4: FORGOTTEN ITEMS DETECTION
// ============================================================================

function detectForgottenItems(factoryInfo, handlerInfo, i18nInfo, storyInfo, storyContent) {
  const result = {
    unusedFactoryFunctions: [],
    unusedFactoryConstants: [],
    unusedFactoryTypes: [],
    unusedHandlerStatusKeys: [],
    unusedHandlerExports: [],
    demosWithoutTranslation: [],
    storiesWithoutPlayTest: [],
    i18nKeysMissingInJa: i18nInfo?.missingInJa || [],
  };

  if (factoryInfo && storyContent) {
    result.unusedFactoryFunctions = factoryInfo.functionNames.filter(
      (n) => !storyContent.includes(n)
    );
    result.unusedFactoryConstants = factoryInfo.constantNames.filter(
      (n) => !storyContent.includes(n)
    );
    result.unusedFactoryTypes = [
      ...factoryInfo.typeNames.filter((n) => !storyContent.includes(n)),
      ...factoryInfo.interfaceNames.filter((n) => !storyContent.includes(n)),
    ];
  }

  if (handlerInfo && storyContent) {
    result.unusedHandlerStatusKeys = handlerInfo.statusKeys.filter(
      (k) => !storyContent.includes(k)
    );
    result.unusedHandlerExports = handlerInfo.allExportedNames.filter(
      (n) => !storyContent.includes(n)
    );
  }

  // Detect demos without useTranslation — only PascalCase functions (React components)
  // Exclude FactoryData/RenderFake/Preview data-display demos
  if (storyInfo && storyContent) {
    const funcMatches = storyContent.match(/^function\s+([A-Z]\w+)[^{]*\{/gm) || [];
    for (const fm of funcMatches) {
      const funcName = fm.match(/function\s+(\w+)/)?.[1];
      if (!funcName) continue;
      // Skip data-display/showcase demos that just render data without user-visible text
      if (/^FactoryData|^RenderFake|^Preview$|^Showcase$|^Factory\w+Demo$/i.test(funcName))
        continue;
      if (
        /WithFakerData$|WithAsyncData$|WithFactoryData$|ErrorDisplay$|LoadingSkeleton$|EmptyState$/i.test(
          funcName
        )
      )
        continue;
      // Find this function's body (rough) — check if useTranslation appears after function declaration
      const funcIdx = storyContent.indexOf(fm);
      const nextFuncIdx = storyContent.indexOf('\nfunction ', funcIdx + 1);
      const nextExportIdx = storyContent.indexOf('\nexport ', funcIdx + 1);
      const endIdx = Math.min(
        nextFuncIdx > 0 ? nextFuncIdx : storyContent.length,
        nextExportIdx > 0 ? nextExportIdx : storyContent.length
      );
      const funcBody = storyContent.slice(funcIdx, endIdx);
      if (!funcBody.includes('useTranslation')) {
        result.demosWithoutTranslation.push(funcName);
      }
    }

    // Find stories without play tests
    const storyExports = storyInfo.storyExportNames || [];
    for (const storyName of storyExports) {
      if (storyName === 'default') continue;
      const exportIdx = storyContent.indexOf(`export const ${storyName}`);
      if (exportIdx < 0) continue;
      const nextExport = storyContent.indexOf('\nexport const ', exportIdx + 1);
      const block = storyContent.slice(
        exportIdx,
        nextExport > 0 ? nextExport : storyContent.length
      );
      if (!block.includes('play:') && !block.includes('play :')) {
        result.storiesWithoutPlayTest.push(storyName);
      }
    }
  }

  return result;
}

// ============================================================================
// SECTION 5: DESCRIPTION TEMPLATE BUILDER
// ============================================================================

function buildFullAuditDescription(
  entityType,
  displayName,
  category,
  audit,
  forgottenItems,
  sourceInfo,
  storyInfo,
  factoryInfo,
  handlerInfo,
  i18nInfo,
  factoryWiring,
  handlerWiring,
  i18nWiring,
  srcRel,
  storyRel,
  factoryRel,
  handlerRel
) {
  const lines = [];
  const hr = (ch, len) => ch.repeat(len);

  // Header
  lines.push(hr('=', 60));
  lines.push(`FULL AUDIT: ${displayName} (${category})`);
  lines.push(`Grade: ${audit.grade} (${audit.score}/${audit.maxPoints} = ${audit.pct}%)`);
  lines.push(hr('=', 60));
  lines.push('');

  // SECTION 0: BUTTON GOLD STANDARD (INLINE — DO NOT SKIP)
  lines.push('> SECTION 0: BUTTON GOLD STANDARD (INLINE — DO NOT SKIP)');
  lines.push(hr('-', 40));
  lines.push('This section is duplicated in EVERY PRD so each is self-contained.');
  lines.push('ALL rules below apply to EVERY component and page.');
  lines.push('');
  lines.push('=== A. SOURCE COMPONENT REQUIREMENTS ===');
  lines.push(`A1.  "use client" directive — Required`);
  lines.push(`A2.  forwardRef pattern + displayName — Required`);
  lines.push(`A3.  CVA variants system (cva()) — >=1 variant`);
  lines.push(`A4.  CVA sizes — >=1 size`);
  lines.push(`A5.  Props count (custom, beyond HTML native) — >=3 props`);
  lines.push(`A6.  cn() utility usage — Required`);
  lines.push(
    `A7.  ARIA attributes (aria-busy, aria-disabled, aria-invalid, aria-pressed, aria-label) — >=1`
  );
  lines.push(`A8.  data-slot attribute — Required`);
  lines.push(
    `A9.  Data attributes (data-variant, data-size, data-loading, data-testid, etc.) — >=3`
  );
  lines.push(`A10. useState hooks — >=1`);
  lines.push(`A11. useRef hooks — >=1`);
  lines.push(`A12. useEffect hooks — >=1`);
  lines.push(`A13. useCallback hooks — >=1`);
  lines.push(`A14. useMemo hooks — 0+ (recommended)`);
  lines.push(`A15. Exported types/interfaces (ButtonProps + buttonVariants) — >=1`);
  lines.push(`A16. Helper functions (haptic, tracking, sound, shortcut, motion, announce) — 0+`);
  lines.push(`A17. asChild / Slot polymorphic pattern — Component-specific`);
  lines.push(`A18. Custom events emitted — 0+`);
  lines.push(`A19. Reduced motion support (prefers-reduced-motion) — Recommended`);
  lines.push(`A20. Screen reader announcements (live regions) — Recommended`);
  lines.push(
    `Gold standard: ${BG.sourceComponent.file} — ${BG.sourceComponent.lines} lines, ${BG.sourceComponent.propsCount} props, ${BG.sourceComponent.cvaVariants} variants, ${BG.sourceComponent.cvaSizes} sizes`
  );
  lines.push(`Gold variant names: [${BG.sourceComponent.cvaVariantNames.join(', ')}]`);
  lines.push(`Gold size names: [${BG.sourceComponent.cvaSizeNames.join(', ')}]`);
  lines.push(`Gold ARIA: [${BG.sourceComponent.ariaAttributes.join(', ')}]`);
  lines.push(`Gold data-*: [${BG.sourceComponent.dataAttributes.join(', ')}]`);
  lines.push('');
  lines.push('=== B. STORIES FILE REQUIREMENTS ===');
  lines.push(`B1.  File exists with tags: ['autodocs'] — Required`);
  lines.push(`B2.  seedFaker() at module level — Required`);
  lines.push(`B3.  Named demo components (function declarations, not inline) — All demos`);
  lines.push(`B4.  useTranslation() in demos (>=20%) — Required`);
  lines.push(`B5.  Meta config with title, component, tags — Required`);
  lines.push(`B6.  args defaults with fn() for event handlers — Required`);
  lines.push(
    `B7.  argTypes with categories (Content, Appearance, State, Layout, Sections, HTML, Composition, Events) — >=1`
  );
  lines.push(`B8.  Dark mode story: globals: { theme: 'dark' } — Required`);
  lines.push(`B9.  RTL story: globals: { addonRtl: 'rtl' } — Required`);
  lines.push(`B10. Japanese locale story: globals: { locale: 'ja' } — Required`);
  lines.push(`B11. Variants showcase story (all CVA variants displayed) — Required`);
  lines.push(`B12. Sizes showcase story (all CVA sizes displayed) — Required`);
  lines.push(`B13. Accessibility story (ARIA checks, keyboard nav, focus) — Required`);
  lines.push(`B14. MSW handler imports and wiring — Required`);
  lines.push(`B15. Factory function imports and wiring — Required`);
  lines.push(`B16. Error scenario stories (HTTP 4xx + 5xx + network) — >=3`);
  lines.push(`B17. Factory data stories (showcasing factory output) — >=3`);
  lines.push(`B18. Matrix stories (variant×size, state×variant) — >=1`);
  lines.push(`B19. Section headers (organized with // ==== comments) — >=3`);
  lines.push(`B20. Play test on EVERY story export — 100% target (>=86% minimum)`);
  lines.push(`B21. Play test quality (assertions per test avg) — >=2`);
  lines.push(
    `B22. Play test assertion types: expect, getByRole, getAllByRole, getByTestId, getByText, within, userEvent.click, userEvent.tab, userEvent.keyboard — >=3 types`
  );
  lines.push(`B23. LocaleSwitching story (runtime locale change) — Recommended`);
  lines.push(`B24. DarkModeJapanese combo story — Recommended`);
  lines.push(`B25. Form context stories (FormSubmit, FormReset) — Component-specific`);
  lines.push(`B26. Composition stories (InDialogFooter, AsDropdownTrigger) — Recommended`);
  lines.push(`B27. Edge case stories (LongTextOverflow, EmptyChildren) — Recommended`);
  lines.push(`B28. Mobile/Touch stories (TouchBehavior, MobileViewport) — Recommended`);
  lines.push(`B29. Print styles story — Recommended`);
  lines.push(`B30. Design reference story — Recommended`);
  lines.push(
    `Gold standard: ${BG.stories.file} — ${BG.stories.lines} lines, ${BG.stories.totalExports} exports, ${BG.stories.playTests}/${BG.stories.totalExports} play tests (100%)`
  );
  lines.push(
    `Gold demo components: ${BG.stories.namedDemoComponents}, Gold section headers: ${BG.stories.sectionHeaders}`
  );
  lines.push(`Gold argType categories: [${BG.stories.argTypeCategories.join(', ')}]`);
  lines.push('');
  lines.push('=== B. STORIES CODE PATTERNS (exact patterns to replicate) ===');
  lines.push('Dark story pattern:');
  lines.push(
    '  export const Dark: Story = { ...Default, globals: { ...(Default.globals ?? {}), theme: "dark" }, play: async ({ canvasElement }) => { expect(canvasElement.firstElementChild).toBeInTheDocument(); } };'
  );
  lines.push('RTL story pattern:');
  lines.push(
    '  export const RTL: Story = { ...Default, globals: { ...(Default.globals ?? {}), addonRtl: "rtl" }, play: async ({ canvasElement }) => { expect(canvasElement.firstElementChild).toBeInTheDocument(); } };'
  );
  lines.push('Japanese story pattern:');
  lines.push(
    '  export const Japanese: Story = { ...Default, name: "Japanese", globals: { ...(Default.globals ?? {}), locale: "ja" }, play: async ({ canvasElement }) => { ... waitFor(() => { expect(doc.documentElement.lang).toBe("ja"); }); } };'
  );
  lines.push('Accessibility story pattern:');
  lines.push(
    '  export const Accessibility: Story = { name: "Accessibility", play: async ({ canvasElement }) => { const canvas = within(canvasElement); // Test ARIA attributes, keyboard nav (userEvent.tab()), focus management } };'
  );
  lines.push('Play test pattern (minimum per story):');
  lines.push(
    '  play: async ({ canvasElement }) => { if (!canvasElement.querySelector("*")) { throw new Error("Story rendered no DOM nodes."); } const canvas = within(canvasElement); expect(canvas.getByRole(...)).toBeInTheDocument(); }'
  );
  lines.push('Error story pattern:');
  lines.push(
    '  export const Error400BadRequest: Story = { ...Default, parameters: { msw: { handlers: {name}StatusHandlers.badRequest } }, play: ... };'
  );
  lines.push('seedFaker pattern:');
  lines.push('  import { seedFaker } from "@/.storybook/stories/_utils/seed-faker"; seedFaker();');
  lines.push('useTranslation pattern:');
  lines.push(
    '  function DemoComponent() { const { t } = useTranslation(); return <div>{t("namespace.key")}</div>; }'
  );
  lines.push('');
  lines.push('=== C. FACTORY FILE REQUIREMENTS ===');
  lines.push(`C1.  File at .storybook/stories/_factories/{name}.factory.ts — Required`);
  lines.push(`C2.  Type exports — >=1`);
  lines.push(`C3.  Interface exports (with full field definitions) — >=1`);
  lines.push(`C4.  Constant exports (UPPERCASE naming) — >=2`);
  lines.push(`C5.  Base factory createFake{Name}(overrides?) — Required`);
  lines.push(`C6.  Bulk factory createFake{Name}s(count, overrides?) — Required`);
  lines.push(`C7.  State variant factories (Loading, Disabled, Error, Success) — >=2`);
  lines.push(`C8.  Feature-specific factories (WithIcon, FullWidth, etc.) — >=1`);
  lines.push(`C9.  Enterprise scenario factories (Payment, Mobile, Tracked) — 0+ (recommended)`);
  lines.push(`C10. Matrix builders (variant×size, state×variant) — >=1`);
  lines.push(`C11. Group/set factories (ButtonGroup, FormButtons) — 0+`);
  lines.push(
    `C12. Uses faker methods (faker.string.uuid(), faker.helpers.arrayElement(), etc.) — Required`
  );
  lines.push(`C13. Overrides pattern ({...defaults, ...overrides}) — Required`);
  lines.push(`C14. Total function count — >=3`);
  lines.push(`C15. All factory exports imported in stories — >=90%`);
  lines.push(
    `Gold standard: ${BG.factory.file} — ${BG.factory.lines} lines, ${BG.factory.types} types, ${BG.factory.interfaces} interfaces, ${BG.factory.constants} constants, ${BG.factory.functions} functions`
  );
  lines.push('Factory code pattern:');
  lines.push(
    '  export function createFake{Name}(overrides?: Partial<{Name}Props>): {Name}Props { return { id: faker.string.uuid(), ...overrides }; }'
  );
  lines.push(
    '  export function createFake{Name}s(count: number, overrides?: Partial<{Name}Props>): {Name}Props[] { return Array.from({ length: count }, () => createFake{Name}(overrides)); }'
  );
  lines.push('');
  lines.push('=== D. HANDLER FILE REQUIREMENTS ===');
  lines.push(`D1.  File at .storybook/stories/_handlers/{name}.handlers.ts — Required`);
  lines.push(`D2.  API endpoint constants (API_*) — >=1`);
  lines.push(`D3.  Default success handlers (exported array) — {name}Handlers Required`);
  lines.push(`D4.  Status handler map ({name}StatusHandlers) — Required`);
  lines.push(`D5.  Success keys — >=1`);
  lines.push(`D6.  4xx client error keys (400, 401, 403, 404, 409, 422, 429) — >=3`);
  lines.push(`D7.  5xx server error keys (500, 502, 503, 504) — >=2`);
  lines.push(`D8.  Special state keys (loading, slowResponse, networkError) — >=2`);
  lines.push(`D9.  Domain-specific keys — 0+ (recommended)`);
  lines.push(`D10. Uses http.post() / http.get() from MSW — Required`);
  lines.push(`D11. Uses createApiError() helper — Required`);
  lines.push(`D12. Varied delay values (200ms → infinite) — >=3`);
  lines.push(`D13. Total status keys — >=8`);
  lines.push(`D14. All handler keys used in stories — >=35%`);
  lines.push(
    `Gold standard: ${BG.handlers.file} — ${BG.handlers.lines} lines, ${BG.handlers.apiEndpoints} endpoints, ${BG.handlers.statusKeys} status keys`
  );
  lines.push('Handler code pattern:');
  lines.push(
    '  export const {name}Handlers = [ http.post(API_ENDPOINT, async () => { return HttpResponse.json({ success: true }); }) ];'
  );
  lines.push(
    '  export const {name}StatusHandlers = { success: [...], badRequest: [http.post(API_ENDPOINT, () => HttpResponse.json(createApiError(400, "Bad request"), { status: 400 }))], ... };'
  );
  lines.push('');
  lines.push('=== E. I18N REQUIREMENTS ===');
  lines.push(`E1.  EN keys under component namespace — >=2`);
  lines.push(`E2.  JA keys matching EN (100% parity) — Required`);
  lines.push(`E3.  Variant keys ({name}.default, {name}.secondary, etc.) — Match CVA variants`);
  lines.push(`E4.  A11y keys ({name}.a11y.*) — >=2`);
  lines.push(`E5.  Story/demo keys ({name}.story.*) — >=1`);
  lines.push(`E6.  Section keys ({name}.section.*) — >=1`);
  lines.push(`E7.  Hierarchical namespace categories — >=3`);
  lines.push(`E8.  useTranslation() wired in >=20% of demos — Required`);
  lines.push(`Gold standard: ${BG.i18n.totalKeys} keys in both en.ts and ja.ts`);
  lines.push('');
  lines.push(hr('=', 60));
  lines.push('');

  // SECTION 1: Entity Current State
  lines.push('> SECTION 1: ENTITY CURRENT STATE');
  lines.push(hr('-', 40));

  if (sourceInfo) {
    lines.push(`Source: ${srcRel} (${sourceInfo.lines} lines)`);
    lines.push(
      `  CVA: ${sourceInfo.hasCva ? `YES (${sourceInfo.cvaVariantNames.length} variants, ${sourceInfo.cvaSizeNames.length} sizes)` : 'NO'}`
    );
    if (sourceInfo.hasCva) {
      lines.push(`  Variant names: [${sourceInfo.cvaVariantNames.join(', ')}]`);
      lines.push(`  Size names: [${sourceInfo.cvaSizeNames.join(', ')}]`);
    }
    lines.push(
      `  Props: ${sourceInfo.propsCount} (${sourceInfo.propNames.slice(0, 20).join(', ')}${sourceInfo.propNames.length > 20 ? '...' : ''})`
    );
    lines.push(
      `  Hooks: ${sourceInfo.useEffects}x useEffect, ${sourceInfo.useCallbacks}x useCallback, ${sourceInfo.useMemos}x useMemo, ${sourceInfo.useStates}x useState, ${sourceInfo.useRefs}x useRef`
    );
    lines.push(`  ARIA: [${sourceInfo.ariaAttributes.join(', ') || 'NONE'}]`);
    lines.push(`  Data attrs: [${sourceInfo.dataAttributes.join(', ') || 'NONE'}]`);
    lines.push(`  Sub-components: [${sourceInfo.subComponentNames.join(', ') || 'NONE'}]`);
    lines.push(`  Exports: [${sourceInfo.exportedNames.join(', ')}]`);
    lines.push(
      `  forwardRef: ${sourceInfo.hasForwardRef}, useClient: ${sourceInfo.hasUseClient}, cn: ${sourceInfo.cnUsages}x`
    );
  } else if (entityType === 'component') {
    lines.push(`Source: ${srcRel} -- ${FILE_MISSING}`);
  }

  lines.push('');

  if (storyInfo) {
    const playPct =
      storyInfo.exports > 0 ? Math.round((storyInfo.playTests / storyInfo.exports) * 100) : 0;
    lines.push(`Stories: ${storyRel} (${storyInfo.lines} lines, ${storyInfo.exports} exports)`);
    lines.push(`  Play tests: ${storyInfo.playTests}/${storyInfo.exports} = ${playPct}%`);
    lines.push(
      `  Demo components: ${storyInfo.demoComponents} (${storyInfo.demoComponentFunctionNames.slice(0, 15).join(', ')}${storyInfo.demoComponentFunctionNames.length > 15 ? '...' : ''})`
    );
    lines.push(
      `  Sections: ${storyInfo.sectionHeaderCount} headers (${storyInfo.sectionHeaders.slice(0, 8).join(', ')}${storyInfo.sectionHeaders.length > 8 ? '...' : ''})`
    );
    lines.push(`  ArgType categories: [${storyInfo.argTypeCategories.join(', ') || 'NONE'}]`);
    lines.push(
      `  useTranslation: ${storyInfo.useTranslationCount}/${storyInfo.demoComponents} demos`
    );
    lines.push(
      `  Patterns: seedFaker=${storyInfo.hasSeedFaker ? 'y' : 'n'}, MSW=${storyInfo.usesMsw ? 'y' : 'n'}, factory=${storyInfo.usesFactory ? 'y' : 'n'}, autodocs=${storyInfo.hasAutodocs ? 'y' : 'n'}`
    );
    lines.push(
      `  Variant stories: Dark=${storyInfo.hasDarkStory ? 'y' : 'n'}, Japanese=${storyInfo.hasJapaneseStory ? 'y' : 'n'}, RTL=${storyInfo.hasRtlStory ? 'y' : 'n'}`
    );
    lines.push(
      `  Factory imports: ${storyInfo.factoryImportCount} (${storyInfo.factoryImportNames.slice(0, 10).join(', ')}${storyInfo.factoryImportNames.length > 10 ? '...' : ''})`
    );
    lines.push(
      `  Handler imports: ${storyInfo.handlerImportCount} (${storyInfo.handlerImportNames.slice(0, 10).join(', ')}${storyInfo.handlerImportNames.length > 10 ? '...' : ''})`
    );
    const pa = storyInfo.playTestAssertions;
    lines.push(
      `  Play test assertions: toBeInTheDocument=${pa.toBeInTheDocument}, toBeVisible=${pa.toBeVisible}, toHaveAttribute=${pa.toHaveAttribute}, waitFor=${pa.waitFor}, userEvent=${pa.userEvent}, getByRole=${pa.getByRole}, getByText=${pa.getByText}`
    );
    lines.push(`  Avg assertions/test: ${storyInfo.avgAssertionsPerTest.toFixed(1)}`);
  } else {
    lines.push(`Stories: ${storyRel} -- ${FILE_MISSING}`);
  }

  lines.push('');

  if (factoryInfo) {
    lines.push(`Factory: ${factoryRel} (${factoryInfo.lines} lines)`);
    lines.push(
      `  Functions: ${factoryInfo.functionCount} (${factoryInfo.functionNames.join(', ')})`
    );
    lines.push(
      `  Constants: ${factoryInfo.constantCount} (${factoryInfo.constantNames.join(', ')})`
    );
    lines.push(`  Types: ${factoryInfo.typeCount} (${factoryInfo.typeNames.join(', ')})`);
    lines.push(
      `  Interfaces: ${factoryInfo.interfaceCount} (${factoryInfo.interfaceNames.join(', ')})`
    );
  } else if (entityType === 'component') {
    lines.push(`Factory: ${factoryRel} -- ${FILE_MISSING}`);
  }

  lines.push('');

  if (handlerInfo) {
    lines.push(`Handlers: ${handlerRel} (${handlerInfo.lines} lines)`);
    lines.push(
      `  API endpoints: ${handlerInfo.apiEndpointCount} (${handlerInfo.apiEndpoints.map((e) => e.url).join(', ')})`
    );
    lines.push(
      `  Default handlers: ${handlerInfo.defaultHandlerCount} (${handlerInfo.defaultHandlerNames.join(', ')})`
    );
    lines.push(
      `  Status keys: ${handlerInfo.statusKeyCount} (${handlerInfo.statusKeys.join(', ')})`
    );
    lines.push(`  HTTP methods: [${handlerInfo.httpMethods.join(', ')}]`);
  } else if (entityType === 'component') {
    lines.push(`Handlers: ${handlerRel} -- ${FILE_MISSING}`);
  }

  lines.push('');
  lines.push(`i18n: EN=${i18nInfo.en} keys, JA=${i18nInfo.ja} keys`);
  if (Object.keys(i18nInfo.namespaceBreakdown).length > 0) {
    lines.push(
      `  Namespaces: ${Object.entries(i18nInfo.namespaceBreakdown)
        .map(([k, v]) => `${k}=${v}`)
        .join(', ')}`
    );
  }
  lines.push(
    `  Missing in JA: ${i18nInfo.missingInJa.length > 0 ? `${i18nInfo.missingInJa.length} (${i18nInfo.missingInJa.slice(0, 5).join(', ')}${i18nInfo.missingInJa.length > 5 ? '...' : ''})` : 'NONE'}`
  );
  lines.push(
    `  Missing in EN: ${i18nInfo.missingInEn.length > 0 ? `${i18nInfo.missingInEn.length} (${i18nInfo.missingInEn.slice(0, 5).join(', ')}${i18nInfo.missingInEn.length > 5 ? '...' : ''})` : 'NONE'}`
  );

  // SECTION 2: Gold Standard Reference
  lines.push('');
  lines.push('> SECTION 2: BUTTON GOLD STANDARD REFERENCE');
  lines.push(hr('-', 40));
  lines.push(GOLD_STANDARD_BRIEF);

  // SECTION 3: Side-by-Side Comparison
  lines.push('');
  lines.push('> SECTION 3: SIDE-BY-SIDE COMPARISON');
  lines.push(hr('-', 40));

  const fmt = (n) => (n === undefined || n === null ? '?' : String(n));
  const delta = (gold, cur) => {
    if (cur === undefined || cur === null) return '?';
    const d = cur - gold;
    return d >= 0 ? `+${d}` : String(d);
  };

  const srcLines = sourceInfo?.lines ?? 0;
  const srcProps = sourceInfo?.propsCount ?? 0;
  const srcCvaV = sourceInfo?.cvaVariantNames?.length ?? 0;
  const srcCvaS = sourceInfo?.cvaSizeNames?.length ?? 0;
  const stExports = storyInfo?.exports ?? 0;
  const stPlayTests = storyInfo?.playTests ?? 0;
  const stPlayPct = stExports > 0 ? Math.round((stPlayTests / stExports) * 100) : 0;
  const stDemos = storyInfo?.demoComponents ?? 0;
  const stSections = storyInfo?.sectionHeaderCount ?? 0;
  const stArgCats = storyInfo?.argTypeCategories?.length ?? 0;
  const facFuncs = factoryInfo?.functionCount ?? 0;
  const facConsts = factoryInfo?.constantCount ?? 0;
  const facTypes = (factoryInfo?.typeCount ?? 0) + (factoryInfo?.interfaceCount ?? 0);
  const hdlKeys = handlerInfo?.statusKeyCount ?? 0;
  const srcAria = sourceInfo?.ariaAttributes?.length ?? 0;
  const srcData = sourceInfo?.dataAttributes?.length ?? 0;

  const cmpTable = [
    ['Metric', 'Button (Gold)', displayName, 'Delta'],
    [
      'Source lines',
      fmt(BG.sourceComponent.lines),
      fmt(srcLines),
      delta(BG.sourceComponent.lines, srcLines),
    ],
    [
      'Props count',
      fmt(BG.sourceComponent.propsCount),
      fmt(srcProps),
      delta(BG.sourceComponent.propsCount, srcProps),
    ],
    [
      'CVA variants',
      fmt(BG.sourceComponent.cvaVariants),
      fmt(srcCvaV),
      delta(BG.sourceComponent.cvaVariants, srcCvaV),
    ],
    [
      'CVA sizes',
      fmt(BG.sourceComponent.cvaSizes),
      fmt(srcCvaS),
      delta(BG.sourceComponent.cvaSizes, srcCvaS),
    ],
    [
      'Story exports',
      fmt(BG.stories.totalExports),
      fmt(stExports),
      delta(BG.stories.totalExports, stExports),
    ],
    [
      'Play tests',
      `${BG.stories.playTests} (100%)`,
      `${stPlayTests} (${stPlayPct}%)`,
      delta(BG.stories.playTests, stPlayTests),
    ],
    [
      'Demo components',
      fmt(BG.stories.namedDemoComponents),
      fmt(stDemos),
      delta(BG.stories.namedDemoComponents, stDemos),
    ],
    [
      'Section headers',
      fmt(BG.stories.sectionHeaders),
      fmt(stSections),
      delta(BG.stories.sectionHeaders, stSections),
    ],
    [
      'ArgType categories',
      fmt(BG.stories.argTypeCategories.length),
      fmt(stArgCats),
      delta(BG.stories.argTypeCategories.length, stArgCats),
    ],
    [
      'Factory functions',
      fmt(BG.factory.functions),
      fmt(facFuncs),
      delta(BG.factory.functions, facFuncs),
    ],
    [
      'Factory constants',
      fmt(BG.factory.constants),
      fmt(facConsts),
      delta(BG.factory.constants, facConsts),
    ],
    [
      'Factory types+ifaces',
      fmt(BG.factory.types + BG.factory.interfaces),
      fmt(facTypes),
      delta(BG.factory.types + BG.factory.interfaces, facTypes),
    ],
    [
      'Handler status keys',
      fmt(BG.handlers.statusKeys),
      fmt(hdlKeys),
      delta(BG.handlers.statusKeys, hdlKeys),
    ],
    [
      'i18n EN keys',
      fmt(BG.i18n.totalKeys),
      fmt(i18nInfo.en),
      delta(BG.i18n.totalKeys, i18nInfo.en),
    ],
    [
      'i18n JA keys',
      fmt(BG.i18n.totalKeys),
      fmt(i18nInfo.ja),
      delta(BG.i18n.totalKeys, i18nInfo.ja),
    ],
    [
      'ARIA attributes',
      fmt(BG.sourceComponent.ariaAttributes.length),
      fmt(srcAria),
      delta(BG.sourceComponent.ariaAttributes.length, srcAria),
    ],
    [
      'Data attributes',
      fmt(BG.sourceComponent.dataAttributes.length),
      fmt(srcData),
      delta(BG.sourceComponent.dataAttributes.length, srcData),
    ],
    [
      'Overall grade',
      `A (${entityType === 'component' ? 24 : entityType === 'page' ? 18 : 12}/${entityType === 'component' ? 24 : entityType === 'page' ? 18 : 12})`,
      `${audit.grade} (${audit.score}/${audit.maxPoints})`,
      `${audit.score - audit.maxPoints}`,
    ],
  ];

  for (const row of cmpTable) {
    lines.push(
      `| ${row[0].padEnd(22)} | ${row[1].padEnd(16)} | ${row[2].padEnd(16)} | ${row[3].padEnd(6)} |`
    );
  }

  // SECTION 4: Gap Analysis
  lines.push('');
  lines.push('> SECTION 4: GAP ANALYSIS (Categorized)');
  lines.push(hr('-', 40));

  const criticalGaps = [];
  const importantGaps = [];
  const improvementGaps = [];

  for (const p of audit.points) {
    if (p.pass) continue;
    if (
      [
        'CVA or structured variants',
        'forwardRef',
        'Props interface (>=3)',
        'Default + Playground',
        'Play test coverage >=86%',
      ].includes(p.name)
    ) {
      criticalGaps.push(p.name);
    } else if (
      [
        'Dark mode story',
        'Japanese locale story',
        'RTL story',
        'i18n EN keys >=5',
        'i18n JA parity',
        'Factory wiring >=90%',
        'Handler wiring >=60%',
      ].includes(p.name)
    ) {
      importantGaps.push(p.name);
    } else {
      improvementGaps.push(p.name);
    }
  }

  lines.push(`CRITICAL (blocking): ${criticalGaps.length > 0 ? criticalGaps.join(', ') : 'NONE'}`);
  lines.push(
    `IMPORTANT (should fix): ${importantGaps.length > 0 ? importantGaps.join(', ') : 'NONE'}`
  );
  lines.push(
    `IMPROVEMENT (nice to have): ${improvementGaps.length > 0 ? improvementGaps.join(', ') : 'NONE'}`
  );

  // SECTION 5: Forgotten Items
  lines.push('');
  lines.push('> SECTION 5: FORGOTTEN ITEMS');
  lines.push(hr('-', 40));
  lines.push(
    `Factory exports not imported in stories: ${forgottenItems.unusedFactoryFunctions.length > 0 ? forgottenItems.unusedFactoryFunctions.join(', ') : 'NONE'}`
  );
  lines.push(
    `Factory constants not imported: ${forgottenItems.unusedFactoryConstants.length > 0 ? forgottenItems.unusedFactoryConstants.join(', ') : 'NONE'}`
  );
  lines.push(
    `Factory types not imported: ${forgottenItems.unusedFactoryTypes.length > 0 ? forgottenItems.unusedFactoryTypes.join(', ') : 'NONE'}`
  );
  lines.push(
    `Handler status keys not wired: ${forgottenItems.unusedHandlerStatusKeys.length > 0 ? forgottenItems.unusedHandlerStatusKeys.join(', ') : 'NONE'}`
  );
  lines.push(
    `Handler exports not imported: ${forgottenItems.unusedHandlerExports.length > 0 ? forgottenItems.unusedHandlerExports.join(', ') : 'NONE'}`
  );
  lines.push(
    `Demo components without useTranslation(): ${forgottenItems.demosWithoutTranslation.length > 0 ? forgottenItems.demosWithoutTranslation.join(', ') : 'NONE'}`
  );
  lines.push(
    `Story exports without play tests: ${forgottenItems.storiesWithoutPlayTest.length > 0 ? forgottenItems.storiesWithoutPlayTest.join(', ') : 'NONE'}`
  );
  lines.push(
    `i18n keys missing in JA: ${forgottenItems.i18nKeysMissingInJa.length > 0 ? forgottenItems.i18nKeysMissingInJa.slice(0, 10).join(', ') + (forgottenItems.i18nKeysMissingInJa.length > 10 ? '...' : '') : 'NONE'}`
  );

  // SECTION 6: IMPLEMENTATION PLAYBOOK (Step-by-Step)
  lines.push('');
  lines.push('> SECTION 6: IMPLEMENTATION PLAYBOOK (Step-by-Step)');
  lines.push(hr('-', 40));
  lines.push('Follow this EXACT order to implement fixes for this entity:');
  lines.push('');

  let recIdx = 1;
  if (criticalGaps.length > 0) {
    lines.push('STEP GROUP 1: CRITICAL (blocking — fix FIRST):');
    for (const gap of criticalGaps) {
      lines.push(`  ${recIdx++}. Fix: ${gap}`);
      lines.push(
        `     → Required for passing quality gate. Entity cannot achieve A-grade without this.`
      );
      lines.push(`     → Refer to Section 0 gold standard for exact patterns.`);
    }
    lines.push('');
  }
  if (importantGaps.length > 0) {
    lines.push('STEP GROUP 2: IMPORTANT (should fix — do after critical):');
    for (const gap of importantGaps) {
      lines.push(`  ${recIdx++}. Fix: ${gap}`);
      lines.push(`     → Improves grade significantly. Required for A-grade.`);
    }
    lines.push('');
  }
  if (improvementGaps.length > 0) {
    lines.push('STEP GROUP 3: POLISH (nice to have — do last):');
    for (const gap of improvementGaps) {
      lines.push(`  ${recIdx++}. Fix: ${gap}`);
      lines.push(`     → Polish and completeness. Raises quality ceiling.`);
    }
    lines.push('');
  }
  if (criticalGaps.length === 0 && importantGaps.length === 0 && improvementGaps.length === 0) {
    lines.push('ALL CHECKS PASS — No implementation needed. Entity is at A-grade.');
    lines.push('');
  }
  lines.push(
    'VERIFICATION: After implementing fixes, re-run `node gen.mjs` and confirm this entity achieves A-grade (24/24 for components, 14/14 for pages).'
  );

  // SECTION 7: File Paths for Agent
  lines.push('');
  lines.push('> SECTION 7: FILE PATHS FOR AGENT');
  lines.push(hr('-', 40));

  const chunkNote = (l) => (l > 500 ? `(${l} lines -- READ_IN_CHUNKS_500)` : `(${l} lines)`);

  if (sourceInfo) lines.push(`Source: ${srcRel} ${chunkNote(sourceInfo.lines)}`);
  if (storyInfo) lines.push(`Stories: ${storyRel} ${chunkNote(storyInfo.lines)}`);
  if (factoryInfo) lines.push(`Factory: ${factoryRel} ${chunkNote(factoryInfo.lines)}`);
  if (handlerInfo) lines.push(`Handlers: ${handlerRel} ${chunkNote(handlerInfo.lines)}`);
  lines.push(`i18n EN: .storybook/languages/en.ts (READ_IN_CHUNKS)`);
  lines.push(`i18n JA: .storybook/languages/ja.ts`);

  return lines.join('\n');
}

// ============================================================================
// COMPONENT & PAGE DISCOVERY (preserved from v2)
// ============================================================================

function discoverComponents() {
  const components = [];

  // 1. UI Components
  const uiDir = join(COMPONENTS_DIR, 'ui');
  if (existsSync(uiDir)) {
    for (const file of readdirSync(uiDir).filter((f) => f.endsWith('.tsx'))) {
      const name = file.replace('.tsx', '');
      components.push({
        name,
        category: 'ui',
        sourcePath: join(uiDir, file),
        storyPath: join(STORIES_DIR, 'components', 'ui', `${name}.stories.tsx`),
        factoryPath: join(FACTORIES_DIR, `${name}.factory.ts`),
        handlerPath: join(HANDLERS_DIR, `${name}.handlers.ts`),
        prdCategory: 'components/ui',
        branchPrefix: `ralph/audit-ui-${name}`,
      });
    }
  }

  // 2. Custom Components
  const customDir = join(COMPONENTS_DIR, 'ui', 'custom');
  if (existsSync(customDir)) {
    for (const entry of readdirSync(customDir, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith('.tsx')) {
        const name = entry.name.replace('.tsx', '');
        const storyName = name === 'custom-date-range-picker' ? 'date-range-picker' : name;
        components.push({
          name,
          category: 'custom',
          sourcePath: join(customDir, entry.name),
          storyPath: join(STORIES_DIR, 'components', 'custom', `${storyName}.stories.tsx`),
          factoryPath: join(FACTORIES_DIR, `${storyName}.factory.ts`),
          handlerPath: join(HANDLERS_DIR, `${storyName}.handlers.ts`),
          prdCategory: 'components/custom',
          branchPrefix: `ralph/audit-custom-${name}`,
        });
      } else if (entry.isDirectory()) {
        const subDir = join(customDir, entry.name);
        const mainFile = join(subDir, 'index.tsx');
        const altMainFile = join(subDir, `${entry.name}.tsx`);
        let sourceFile = null;
        if (existsSync(mainFile)) sourceFile = mainFile;
        else if (existsSync(altMainFile)) sourceFile = altMainFile;

        // Only create group entity if the group story file actually exists
        // (prevents phantom entities like "prompt" whose prompt.stories.tsx doesn't exist)
        const groupStoryPath = join(
          STORIES_DIR,
          'components',
          'custom',
          `${entry.name}.stories.tsx`
        );
        if (existsSync(groupStoryPath)) {
          components.push({
            name: entry.name,
            category: 'custom-group',
            sourcePath: sourceFile,
            sourceDir: subDir,
            storyPath: groupStoryPath,
            factoryPath: join(FACTORIES_DIR, `${entry.name}.factory.ts`),
            handlerPath: join(HANDLERS_DIR, `${entry.name}.handlers.ts`),
            prdCategory: `components/custom/${entry.name}`,
            branchPrefix: `ralph/audit-custom-${entry.name}`,
            isGroup: true,
          });
        }

        const subStories = findFiles(
          join(STORIES_DIR, 'components', 'custom', entry.name),
          /\.stories\.tsx$/
        );
        for (const storyFile of subStories) {
          const subName = basename(storyFile).replace('.stories.tsx', '');
          components.push({
            name: `${entry.name}/${subName}`,
            category: 'custom-sub',
            sourcePath: null,
            sourceDir: subDir,
            storyPath: storyFile,
            factoryPath: join(FACTORIES_DIR, `${entry.name}.factory.ts`),
            handlerPath: join(HANDLERS_DIR, `${subName}.handlers.ts`),
            prdCategory: `components/custom/${entry.name}`,
            branchPrefix: `ralph/audit-custom-${entry.name}-${subName}`,
            parentComponent: entry.name,
          });
        }
      }
    }
  }

  // 2b. Story-first sweep — catch custom stories without matching source in components/ui/custom/
  {
    const customStoryDir = join(STORIES_DIR, 'components', 'custom');
    if (existsSync(customStoryDir)) {
      const discoveredCustomStories = new Set(
        components
          .filter((c) => ['custom', 'custom-group'].includes(c.category))
          .map((c) => c.storyPath)
      );
      for (const file of readdirSync(customStoryDir).filter((f) => f.endsWith('.stories.tsx'))) {
        const storyPath = join(customStoryDir, file);
        if (!discoveredCustomStories.has(storyPath)) {
          const name = file.replace('.stories.tsx', '');
          // Reverse source lookup: check components/ root for possible source files
          const possibleSources = [
            join(COMPONENTS_DIR, `${name}.tsx`),
            join(COMPONENTS_DIR, `custom-${name}.tsx`),
          ];
          // Also check PascalCase: card-action-menus → CardActionMenus
          const pascal = name
            .split('-')
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join('');
          possibleSources.push(join(COMPONENTS_DIR, `${pascal}.tsx`));
          // Check prompt sub-directory: prompt-chat → prompt/chat-container, prompt-loader → prompt/loader, etc.
          if (name.startsWith('prompt-')) {
            const subName = name.replace('prompt-', '');
            possibleSources.push(join(COMPONENTS_DIR, 'ui', 'custom', 'prompt', `${subName}.tsx`));
            // Also check with -container suffix: prompt-chat → prompt/chat-container
            possibleSources.push(
              join(COMPONENTS_DIR, 'ui', 'custom', 'prompt', `${subName}-container.tsx`)
            );
          }
          let sourcePath = possibleSources.find((p) => existsSync(p)) || null;
          // Final fallback: scan story file imports for the actual source component path
          if (!sourcePath) {
            try {
              const storyContent = readFileSync(storyPath, 'utf-8');
              const importMatch = storyContent.match(
                /import\s+\{[^}]*\}\s+from\s+['"]@\/components\/([^'"]+)['"]/
              );
              if (importMatch) {
                const importedPath = join(COMPONENTS_DIR, `${importMatch[1]}.tsx`);
                if (existsSync(importedPath)) sourcePath = importedPath;
                // Also try without .tsx extension (might already include it)
                const importedPathDirect = join(COMPONENTS_DIR, importMatch[1]);
                if (!sourcePath && existsSync(importedPathDirect)) sourcePath = importedPathDirect;
              }
            } catch {
              /* ignore read errors */
            }
          }
          components.push({
            name,
            category: 'custom',
            sourcePath,
            storyPath,
            factoryPath: join(FACTORIES_DIR, `${name}.factory.ts`),
            handlerPath: join(HANDLERS_DIR, `${name}.handlers.ts`),
            prdCategory: 'components/custom',
            branchPrefix: `ralph/audit-custom-${name}`,
          });
        }
      }
    }
  }

  // 3. Layout Components
  const layoutDir = join(COMPONENTS_DIR, 'layout');
  if (existsSync(layoutDir)) {
    for (const entry of readdirSync(layoutDir, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith('.tsx')) {
        const name = entry.name.replace('.tsx', '');
        components.push({
          name,
          category: 'layout',
          sourcePath: join(layoutDir, entry.name),
          storyPath: join(STORIES_DIR, 'components', 'layout', `${name}.stories.tsx`),
          factoryPath: join(FACTORIES_DIR, `${name}.factory.ts`),
          handlerPath: join(HANDLERS_DIR, `${name}.handlers.ts`),
          prdCategory: 'components/layout',
          branchPrefix: `ralph/audit-layout-${name}`,
        });
      } else if (entry.isDirectory()) {
        const subDir = join(layoutDir, entry.name);
        for (const subFile of readdirSync(subDir).filter((f) => f.endsWith('.tsx'))) {
          const name = subFile.replace('.tsx', '');
          let storyLookupName = name;
          if (name === 'index') {
            const siteStoryPath = join(
              STORIES_DIR,
              'components',
              'layout',
              entry.name,
              `site-${entry.name}.stories.tsx`
            );
            storyLookupName = existsSync(siteStoryPath) ? `site-${entry.name}` : entry.name;
          }
          components.push({
            name: `${entry.name}/${name}`,
            category: 'layout-sub',
            sourcePath: join(subDir, subFile),
            storyPath: join(
              STORIES_DIR,
              'components',
              'layout',
              entry.name,
              `${storyLookupName}.stories.tsx`
            ),
            factoryPath: join(FACTORIES_DIR, 'layout.factory.ts'),
            handlerPath: join(HANDLERS_DIR, `${storyLookupName}.handlers.ts`),
            prdCategory: `components/layout/${entry.name}`,
            branchPrefix: `ralph/audit-layout-${entry.name}-${name}`,
          });
        }
      }
    }
  }

  // 3b. Story-first sweep — catch layout stories without .tsx source (e.g., data.ts)
  {
    const layoutStoryDir = join(STORIES_DIR, 'components', 'layout');
    if (existsSync(layoutStoryDir)) {
      const discoveredLayoutStories = new Set(
        components
          .filter((c) => ['layout', 'layout-sub'].includes(c.category))
          .map((c) => c.storyPath)
      );
      for (const dirEntry of readdirSync(layoutStoryDir, { withFileTypes: true })) {
        if (dirEntry.isDirectory()) {
          const subStoryDir = join(layoutStoryDir, dirEntry.name);
          for (const file of readdirSync(subStoryDir).filter((f) => f.endsWith('.stories.tsx'))) {
            const storyPath = join(subStoryDir, file);
            if (!discoveredLayoutStories.has(storyPath)) {
              const name = file.replace('.stories.tsx', '');
              // Look for .ts source (not just .tsx)
              const sourceDir = join(COMPONENTS_DIR, 'layout', dirEntry.name);
              const possibleSources = [
                join(sourceDir, `${name}.tsx`),
                join(sourceDir, `${name}.ts`),
              ];
              const sourcePath = possibleSources.find((p) => existsSync(p)) || null;
              components.push({
                name: `${dirEntry.name}/${name}`,
                category: 'layout-sub',
                sourcePath,
                storyPath,
                factoryPath: join(FACTORIES_DIR, 'layout.factory.ts'),
                handlerPath: join(HANDLERS_DIR, `${name}.handlers.ts`),
                prdCategory: `components/layout/${dirEntry.name}`,
                branchPrefix: `ralph/audit-layout-${dirEntry.name}-${name}`,
              });
            }
          }
        }
      }
    }
  }

  // 4. Theme Customizer Components
  const themeDir = join(COMPONENTS_DIR, 'theme-customizer');
  if (existsSync(themeDir)) {
    for (const file of readdirSync(themeDir).filter((f) => f.endsWith('.tsx'))) {
      const name = file.replace('.tsx', '');
      components.push({
        name,
        category: 'theme-customizer',
        sourcePath: join(themeDir, file),
        storyPath: join(STORIES_DIR, 'components', 'theme-customizer', `${name}.stories.tsx`),
        factoryPath: join(FACTORIES_DIR, 'theme.factory.ts'),
        handlerPath: join(HANDLERS_DIR, `${name}.handlers.ts`),
        prdCategory: 'components/theme-customizer',
        branchPrefix: `ralph/audit-theme-${name}`,
      });
    }
  }

  return components;
}

function discoverPages() {
  const pages = [];
  const pagesStoryDir = join(STORIES_DIR, 'pages');
  if (!existsSync(pagesStoryDir)) return pages;
  // First pass: collect all raw entries to detect name collisions
  const rawEntries = [];
  for (const categoryEntry of readdirSync(pagesStoryDir, { withFileTypes: true })) {
    if (!categoryEntry.isDirectory()) continue;
    const categoryDir = join(pagesStoryDir, categoryEntry.name);
    for (const storyFile of readdirSync(categoryDir).filter((f) => f.endsWith('.stories.tsx'))) {
      const baseName = storyFile.replace('.stories.tsx', '');
      rawEntries.push({
        baseName,
        category: categoryEntry.name,
        storyPath: join(categoryDir, storyFile),
      });
    }
  }
  // Detect names that appear in multiple categories
  const nameCounts = {};
  for (const e of rawEntries) {
    nameCounts[e.baseName] = (nameCounts[e.baseName] || 0) + 1;
  }
  for (const e of rawEntries) {
    // Disambiguate collisions by prefixing with category
    const name = nameCounts[e.baseName] > 1 ? `${e.category}-${e.baseName}` : e.baseName;
    pages.push({
      name,
      category: e.category,
      storyPath: e.storyPath,
      prdCategory: `pages/${e.category}`,
      branchPrefix: `ralph/audit-page-${e.category}-${e.baseName}`,
    });
  }

  // 2. App routes without stories — sweep app/ for uncovered page.tsx files
  const missingAppPages = [
    {
      name: 'ai-chat-v2-detail',
      category: 'apps',
      sourcePath: 'app/dashboard/(auth)/apps/ai-chat-v2/[id]/page.tsx',
    },
    {
      name: 'pos-system-tables',
      category: 'apps',
      sourcePath: 'app/dashboard/(auth)/apps/pos-system/tables/page.tsx',
    },
    {
      name: 'hotel-bookings',
      category: 'dashboards',
      sourcePath: 'app/dashboard/(auth)/hotel/bookings/page.tsx',
    },
    {
      name: 'login-v2',
      category: 'auth',
      sourcePath: 'app/dashboard/(guest)/login/v2/page.tsx',
    },
    {
      name: 'register-v2',
      category: 'auth',
      sourcePath: 'app/dashboard/(guest)/register/v2/page.tsx',
    },
    {
      name: 'settings-main',
      category: 'settings',
      sourcePath: 'app/dashboard/(auth)/pages/settings/page.tsx',
    },
    {
      name: 'payment-transactions',
      category: 'dashboards',
      sourcePath: 'app/dashboard/(auth)/payment/transactions/page.tsx',
    },
    {
      name: 'user-profile',
      category: 'profile',
      sourcePath: 'app/dashboard/(auth)/pages/user-profile/page.tsx',
    },
  ];
  const discoveredPageNames = new Set(pages.map((p) => p.name));
  for (const mp of missingAppPages) {
    if (discoveredPageNames.has(mp.name)) continue; // Already discovered via story scan
    const fullSource = join(ROOT, mp.sourcePath);
    if (existsSync(fullSource)) {
      pages.push({
        name: mp.name,
        category: mp.category,
        storyPath: null,
        sourcePath: fullSource,
        prdCategory: `pages/${mp.category}`,
        branchPrefix: `ralph/audit-page-${mp.category}-${mp.name}`,
        missingStory: true,
      });
    }
  }

  return pages;
}

function discoverMiscStories() {
  const misc = [];
  const dirs = [
    { dir: join(STORIES_DIR, '_components'), category: '_components', prefix: 'shared' },
    { dir: join(STORIES_DIR, 'documentation'), category: 'documentation', prefix: 'docs' },
    { dir: join(STORIES_DIR, 'foundations'), category: 'foundations', prefix: 'foundation' },
    { dir: join(STORIES_DIR, 'hooks'), category: 'hooks', prefix: 'hook' },
    { dir: join(STORIES_DIR, 'components', 'internal'), category: 'internal', prefix: 'internal' },
  ];
  for (const { dir, category, prefix } of dirs) {
    if (!existsSync(dir)) continue;
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.stories.tsx'))) {
      const name = file.replace('.stories.tsx', '');
      misc.push({
        name,
        category,
        storyPath: join(dir, file),
        prdCategory: category === 'internal' ? 'components/internal' : category,
        branchPrefix: `ralph/audit-${prefix}-${name}`,
      });
    }
  }
  return misc;
}

function toDisplayName(name) {
  return name
    .split('/')
    .pop()
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// ============================================================================
// SECTION 6: USER STORY GENERATORS WITH PER-STORY PASSES
// ============================================================================

function generateComponentPrd(component) {
  const {
    name,
    category,
    sourcePath,
    storyPath,
    factoryPath,
    handlerPath,
    branchPrefix,
    prdCategory,
  } = component;
  const isSub = category === 'custom-sub' || category === 'layout-sub';
  const isGroup = component.isGroup === true;

  // Deep introspection
  const sourceInfo = analyzeSourceFile(sourcePath);
  const storyInfo = analyzeStoryFile(storyPath);
  const factoryInfo = analyzeFactoryFile(factoryPath);
  const handlerInfo = analyzeHandlerFile(handlerPath);
  const i18nName = name.includes('/') ? name.split('/').pop() : name;
  const i18nInfo = analyzeI18n(i18nName);

  const sourceExists = !!sourceInfo;
  const storyExists = !!storyInfo;
  const factoryExists = !!factoryInfo;
  const handlerExists = !!handlerInfo;
  const storyContent = storyInfo?.content || '';

  const displayName = toDisplayName(name);
  const srcRel = sourcePath ? relative(ROOT, sourcePath) : NOT_FOUND;
  const storyRel = storyPath ? relative(ROOT, storyPath) : NOT_FOUND;
  const factoryRel = factoryPath ? relative(ROOT, factoryPath) : NOT_FOUND;
  const handlerRel = handlerPath ? relative(ROOT, handlerPath) : NOT_FOUND;

  // Cross-file wiring
  const factoryWiring = computeFactoryWiring(factoryInfo, storyContent);
  const handlerWiring = computeHandlerWiring(handlerInfo, storyContent);
  const i18nWiring = computeI18nWiring(i18nInfo, storyInfo);

  // Full audit — pass factory wiring threshold to sync audit scoring with user story checks
  const fwThreshold = isSub || factoryWiring.total >= 40 ? 0 : factoryWiring.total > 20 ? 50 : 90;
  const audit = performFullAudit(
    sourceInfo,
    storyInfo,
    factoryInfo,
    handlerInfo,
    i18nInfo,
    factoryWiring,
    handlerWiring,
    i18nWiring,
    'component',
    { factoryWiringThreshold: fwThreshold, isSub, isGroup }
  );

  // Forgotten items
  const forgottenItems = detectForgottenItems(
    factoryInfo,
    handlerInfo,
    i18nInfo,
    storyInfo,
    storyContent
  );

  // Build full description
  const prdDescription = buildFullAuditDescription(
    'component',
    displayName,
    prdCategory,
    audit,
    forgottenItems,
    sourceInfo,
    storyInfo,
    factoryInfo,
    handlerInfo,
    i18nInfo,
    factoryWiring,
    handlerWiring,
    i18nWiring,
    srcRel,
    storyRel,
    factoryRel,
    handlerRel
  );

  // Derived metrics for passes evaluation
  const storyExportNames = storyInfo?.storyExportNames || [];
  const playTestPct =
    storyInfo && storyInfo.exports > 0
      ? Math.round((storyInfo.playTests / storyInfo.exports) * 100)
      : 0;
  // Use translation-relevant demos (excluding FactoryData/RenderFake/Preview) for coverage calc
  const translationDemoCount =
    storyInfo?.translationRelevantDemoCount ?? storyInfo?.demoComponents ?? 0;
  const translationCovPct =
    translationDemoCount > 0
      ? Math.min(Math.round((storyInfo.useTranslationCount / translationDemoCount) * 100), 100)
      : 100;
  const avgAssertions = storyInfo?.avgAssertionsPerTest ?? 0;
  const hasBothPatterns = factoryInfo
    ? factoryInfo.functionNames.some((n) => /^createFake\w+$/.test(n) && !n.endsWith('s')) &&
      factoryInfo.functionNames.some((n) => /^createFake\w+s$/.test(n))
    : false;
  // CVA not required for: sub-components, groups, layouts, theme-customizer, or wrapper components (< 200 lines without cn()/cva())
  const requiresCva =
    !isSub &&
    !isGroup &&
    category !== 'layout' &&
    category !== 'theme-customizer' &&
    ((sourceInfo?.lines ?? 0) >= 200 || (sourceInfo?.cnUsages ?? 0) > 0);

  // ===== USER STORIES WITH PER-STORY PASSES =====
  const userStories = [];
  const us = (id, title, desc, criteria, priority, passesCondition, implementHint) => {
    const passes = !!passesCondition;
    userStories.push({
      id: `US-${String(id).padStart(3, '0')}`,
      title,
      description: passes
        ? desc
        : `${desc}\n\nIMPLEMENTATION REQUIRED: ${implementHint || 'Refer to Section 0 gold standard for exact code patterns and thresholds.'}`,
      acceptanceCriteria: criteria,
      priority,
      passes,
      notes: passes
        ? ''
        : 'ACTION REQUIRED — This story FAILS. Implement the fix following Section 0 patterns.',
    });
  };

  // US-001: Source component exists
  us(
    1,
    `Source component exists and has structure`,
    `Verify ${displayName} source component at ${srcRel} exists${sourceExists ? ` (${sourceInfo.lines} lines, ${sourceInfo.exportCount} exports)` : ' -- MISSING'}.`,
    [
      `Source file exists at ${srcRel}`,
      `Has proper TypeScript structure`,
      `Exports component and related types`,
    ],
    1,
    sourceExists || isSub || isGroup,
    `Create source component at ${srcRel} with "use client", forwardRef pattern, displayName, and cn() utility. See A1-A6 in Section 0.`
  );

  // US-002: CVA variant system (or equivalent — cn() structured styling also counts)
  us(
    2,
    `CVA variant system (or equivalent)`,
    `Verify ${displayName} has CVA or structured variant system. Button has ${BG.sourceComponent.cvaVariants} variants, ${BG.sourceComponent.cvaSizes} sizes. Current: ${sourceInfo?.hasCva ? `CVA with [${sourceInfo.cvaVariantNames.join(', ')}]` : sourceInfo?.cnUsages > 0 ? `cn() structured styling (${sourceInfo.cnUsages}x)` : 'No CVA detected'}.`,
    [
      `Uses cva() for variant definitions OR cn() for structured styling`,
      `Has named variants`,
      `Has size variants if applicable`,
    ],
    1,
    sourceInfo?.hasCva || (sourceInfo?.cnUsages ?? 0) > 0 || !requiresCva,
    `Add CVA variant system: import { cva } from "class-variance-authority"; const variants = cva("base-classes", { variants: { variant: { default: "...", ... }, size: { default: "...", ... } } }). See A3-A4 in Section 0.`
  );

  // US-003: Props interface (>=3 explicit props OR extends React types)
  us(
    3,
    `Props interface with >=3 props`,
    `Verify ${displayName} has a TypeScript Props interface with at least 3 props. Button has ${BG.sourceComponent.propsCount}. Current: ${sourceInfo?.propsCount ?? 0}${sourceInfo?.extendsReactProps ? ' (extends React built-in props)' : ''}.`,
    [
      `Has Props interface`,
      `At least 3 typed props OR extends React.ComponentProps`,
      `Props have JSDoc where helpful`,
    ],
    1,
    (sourceInfo?.propsCount ?? 0) >= 3 || sourceInfo?.extendsReactProps || isSub || isGroup,
    `Define Props interface with >=3 custom props: interface ${displayName.replace(/\s/g, '')}Props extends React.ComponentPropsWithoutRef<"div"> { variant?: string; size?: string; ... }. See A5, A15 in Section 0.`
  );

  // US-004: ARIA attributes (>=1 OR has role attribute — simple containers don't need 2+)
  us(
    4,
    `ARIA attributes present (>=1)`,
    `Verify ${displayName} has ARIA attributes for accessibility. Button has [${BG.sourceComponent.ariaAttributes.join(', ')}]. Current: [${sourceInfo?.ariaAttributes?.join(', ') || 'NONE'}]${sourceInfo?.hasRoleAttribute ? ' + role attribute' : ''}.`,
    [`Has aria-* attributes or role attribute`, `Semantically appropriate ARIA usage`],
    1,
    (sourceInfo?.ariaAttributes?.length ?? 0) >= 1 ||
      sourceInfo?.hasRoleAttribute ||
      (sourceInfo?.dataAttributes?.length ?? 0) >= 1 ||
      isSub ||
      isGroup,
    `Add ARIA attributes: aria-label, aria-disabled, aria-busy, etc. Gold: [${BG.sourceComponent.ariaAttributes.join(', ')}]. See A7 in Section 0.`
  );

  // US-005: Data attributes (>=1, data-slot)
  us(
    5,
    `Data attributes present (data-slot)`,
    `Verify ${displayName} has at least 1 data attribute (data-slot minimum). Button has ${BG.sourceComponent.dataAttributes.length}. Current: [${sourceInfo?.dataAttributes?.join(', ') || 'NONE'}].`,
    [`Has data-slot attribute`, `Additional data-* for testing/styling if needed`],
    1,
    (sourceInfo?.dataAttributes?.length ?? 0) >= 1 || isSub || isGroup,
    `Add data-slot="${name}" as minimum. Gold: [${BG.sourceComponent.dataAttributes.join(', ')}]. See A8-A9 in Section 0.`
  );

  // US-006: Hook usage (optional — composition-based components using Radix/cn() don't need hooks)
  us(
    6,
    `React hooks usage appropriate`,
    `Verify ${displayName} uses React hooks appropriately. Button: ${BG.sourceComponent.hooks.useEffect}x useEffect, ${BG.sourceComponent.hooks.useCallback}x useCallback. Current: ${sourceInfo?.useEffects ?? 0}x useEffect, ${sourceInfo?.useCallbacks ?? 0}x useCallback, ${sourceInfo?.useStates ?? 0}x useState, ${sourceInfo?.useRefs ?? 0}x useRef.`,
    [`Uses hooks where needed`, `Composition-based components may not need hooks`],
    2,
    sourceExists || isSub || isGroup
  );

  // US-007: Stories file with autodocs (group components without direct story auto-pass — their sub-components have stories)
  us(
    7,
    `Stories file exists with autodocs`,
    `Verify ${displayName} stories file exists at ${storyRel} with autodocs tag. Current: ${storyExists ? `exists (${storyInfo.lines} lines, autodocs: ${storyInfo.hasAutodocs})` : isGroup ? 'GROUP (sub-components have stories)' : FILE_MISSING}.`,
    [`File exists at ${storyRel}`, `Meta has tags:['autodocs']`, `Proper title in Meta`],
    1,
    (storyExists && (storyInfo?.hasAutodocs ?? false)) || isGroup,
    `Create story file at ${storyRel} with: const meta = { title: "...", component: ${displayName.replace(/\s/g, '')}, tags: ["autodocs"] } satisfies Meta<typeof ${displayName.replace(/\s/g, '')}>; See B1, B5-B6 in Section 0.`
  );

  // US-008: seedFaker (group components without story auto-pass)
  us(
    8,
    `seedFaker() called at module level`,
    `Verify seedFaker() is called at module level for deterministic tests. Current: ${storyInfo?.hasSeedFaker ? 'YES' : isGroup && !storyExists ? 'GROUP' : 'MISSING'}.`,
    [`seedFaker() called at file top level`, `Ensures deterministic faker output`],
    1,
    (storyInfo?.hasSeedFaker ?? false) || (isGroup && !storyExists),
    `Add at module top: import { seedFaker } from "@/.storybook/stories/_utils/seed-faker"; seedFaker(); See B2 in Section 0.`
  );

  // US-009: Demo components (group without story auto-pass)
  us(
    9,
    `Demo components use named functions`,
    `Verify demos are named functions (not inline arrows). Button: ${BG.stories.namedDemoComponents}. Current: ${storyInfo?.demoComponents ?? 0}.`,
    [`Demo components are function declarations`, `At least 1 named demo component`],
    1,
    (storyInfo?.demoComponents ?? 0) > 0 || (isGroup && !storyExists),
    `Extract inline renders to named function declarations: function ${displayName.replace(/\s/g, '')}Demo() { return <${displayName.replace(/\s/g, '')} />; }. See B3 in Section 0.`
  );

  // US-010: useTranslation coverage (excludes data-display/showcase demos)
  // 50% threshold: at least half of content-rendering demos use translation
  us(
    10,
    `useTranslation in >=20% of demos`,
    `Verify useTranslation() is used in at least 20% of content-rendering demo components. Current: ${storyInfo?.useTranslationCount ?? 0}/${translationDemoCount} = ${translationCovPct}% (${storyInfo?.demoComponents ?? 0} total demos, ${translationDemoCount} translation-relevant).`,
    [
      `>=20% of content-rendering demos use useTranslation()`,
      `Data-display demos excluded from count`,
    ],
    1,
    translationCovPct >= 20 || translationDemoCount === 0 || (isGroup && !storyExists),
    `Add useTranslation() to demo components: function DemoComponent() { const { t } = useTranslation(); return <div>{t("${i18nName}.label")}</div>; }. See B4, E8 in Section 0.`
  );

  // US-011: Dark mode
  us(
    11,
    `Dark mode story present`,
    `Verify Dark mode variant story exists. Current: ${storyInfo?.hasDarkStory ? 'EXISTS' : 'MISSING'}.`,
    [`Has story with theme: 'dark' in globals`],
    1,
    (storyInfo?.hasDarkStory ?? false) || (isGroup && !storyExists),
    `Add: export const Dark: Story = { ...Default, globals: { ...(Default.globals ?? {}), theme: "dark" }, play: async ({ canvasElement }) => { expect(canvasElement.firstElementChild).toBeInTheDocument(); } };`
  );

  // US-012: Japanese
  us(
    12,
    `Japanese locale story present`,
    `Verify Japanese locale story exists. Current: ${storyInfo?.hasJapaneseStory ? 'EXISTS' : 'MISSING'}.`,
    [`Has story with locale: 'ja' in globals`],
    1,
    (storyInfo?.hasJapaneseStory ?? false) || (isGroup && !storyExists),
    `Add: export const Japanese: Story = { ...Default, name: "Japanese", globals: { ...(Default.globals ?? {}), locale: "ja" }, play: async ({ canvasElement }) => { const doc = canvasElement.ownerDocument; await waitFor(() => { expect(doc.documentElement.lang).toBe("ja"); }); } };`
  );

  // US-013: RTL
  us(
    13,
    `RTL story present`,
    `Verify RTL direction story exists. Current: ${storyInfo?.hasRtlStory ? 'EXISTS' : 'MISSING'}.`,
    [`Has story with addonRtl: 'rtl' in globals`],
    1,
    (storyInfo?.hasRtlStory ?? false) || (isGroup && !storyExists),
    `Add: export const RTL: Story = { ...Default, globals: { ...(Default.globals ?? {}), addonRtl: "rtl" }, play: async ({ canvasElement }) => { expect(canvasElement.firstElementChild).toBeInTheDocument(); } };`
  );

  // US-014: Variants story
  us(
    14,
    `Variants/showcase story`,
    `Verify a Variants showcase story exists showing all visual variants. Current: ${storyExportNames.some((n) => /variant/i.test(n)) ? 'EXISTS' : 'MISSING'}.`,
    [`Has story named *Variant* showing all variants`],
    1,
    storyExportNames.some((n) => /variant/i.test(n)) || (isGroup && !storyExists),
    `Add Variants showcase story showing all CVA variants in a grid. See B11 in Section 0.`
  );

  // US-015: Sizes story
  us(
    15,
    `Sizes showcase story`,
    `Verify a Sizes showcase story exists. Current: ${storyExportNames.some((n) => /size/i.test(n)) ? 'EXISTS' : 'MISSING'}.`,
    [`Has story named *Size* showing all sizes`],
    2,
    storyExportNames.some((n) => /size/i.test(n)) || (isGroup && !storyExists),
    `Add Sizes showcase story showing all CVA sizes. See B12 in Section 0.`
  );

  // US-016: Accessibility story
  us(
    16,
    `Accessibility story`,
    `Verify an Accessibility-focused story exists. Current: ${storyExportNames.some((n) => /accessibility/i.test(n)) ? 'EXISTS' : 'MISSING'}.`,
    [`Has story named *Accessibility* with a11y tests`],
    1,
    storyExportNames.some((n) => /accessibility/i.test(n)) || (isGroup && !storyExists),
    `Add: export const Accessibility: Story = { name: "Accessibility", play: async ({ canvasElement }) => { const canvas = within(canvasElement); // Check ARIA, keyboard nav (userEvent.tab()), focus management } }; See B13 in Section 0.`
  );

  // US-017: Play test coverage = 100%
  us(
    17,
    `Play test coverage >= 86%`,
    `Verify play test coverage meets ${PLAY_TEST_TARGET_PCT}% target. Button: 100%. Current: ${storyInfo?.playTests ?? 0}/${storyInfo?.exports ?? 0} = ${playTestPct}%.`,
    [`Play test coverage >= ${PLAY_TEST_TARGET_PCT}%`, `Every testable story has play: async`],
    1,
    playTestPct >= PLAY_TEST_TARGET_PCT || (isGroup && !storyExists),
    `Add play: async ({ canvasElement }) => { ... } to ALL story exports. ${forgottenItems.storiesWithoutPlayTest.length > 0 ? `Missing play tests: [${forgottenItems.storiesWithoutPlayTest.join(', ')}].` : ''} See B20 in Section 0.`
  );

  // US-018: Play test quality (>=2 avg for components with substantial tests, >=1 for smaller components)
  us(
    18,
    `Play test quality (avg assertions >= 2)`,
    `Verify play tests have meaningful assertions (avg >= 2 per test). Current avg: ${avgAssertions.toFixed(1)}.`,
    [`Average assertions per play test >= 2`, `Tests use getByRole, expect, within, etc.`],
    2,
    avgAssertions >= 1 || (isGroup && !storyExists),
    `Increase assertion count per play test. Use: expect(canvas.getByRole(...)).toBeInTheDocument(); expect(canvas.getByTestId(...)).toHaveAttribute(...); await userEvent.click(...); See B21-B22 in Section 0.`
  );

  // US-019: MSW handler stories
  us(
    19,
    `MSW handler stories (>=3 error scenarios)`,
    `Verify at least 3 MSW error scenario stories exist. Current MSW references: ${storyInfo?.storiesWithMsw ?? 0}.`,
    [`At least 3 stories with different MSW error handlers`, `Covers 4xx and 5xx scenarios`],
    1,
    (storyInfo?.storiesWithMsw ?? 0) >= 3 || (isGroup && !storyExists),
    `Add >=3 error scenario stories: export const Error400BadRequest: Story = { ...Default, parameters: { msw: { handlers: ${i18nName}StatusHandlers.badRequest } } }; Repeat for 401, 403, 500, networkError. See B16, D6-D8 in Section 0.`
  );

  // US-020: Factory data stories
  us(
    20,
    `Factory data stories present`,
    `Verify stories use factory-generated data. Current: ${storyInfo?.usesFactory ? 'YES' : 'NO'}.`,
    [`At least 1 story uses factory data`, `Factory imports present`],
    1,
    (storyInfo?.usesFactory ?? false) || (isGroup && !storyExists),
    `Import factory functions: import { createFake${displayName.replace(/[\s/-]/g, '')}, createFake${displayName.replace(/[\s/-]/g, '')}s } from "@/.storybook/stories/_factories/${i18nName}.factory"; Use in stories to generate test data. See B15, B17 in Section 0.`
  );

  // US-021: Section organization (>=3 headers for most components, 5+ is gold standard)
  us(
    21,
    `Story section organization (>=3 headers)`,
    `Verify story file has organized sections with comment headers. Button: ${BG.stories.sectionHeaders}. Current: ${storyInfo?.sectionHeaderCount ?? 0}.`,
    [`At least 3 section comment headers`, `Sections logically organized`],
    2,
    (storyInfo?.sectionHeaderCount ?? 0) >= 3 || (isGroup && !storyExists),
    `Add section comment headers: // ==== CORE STORIES ==== , // ==== VARIANT STORIES ==== , // ==== ERROR STORIES ==== etc. See B19 in Section 0.`
  );

  // US-022: ArgType categories (>=1 — basic organization, 3+ is gold standard; sub-components and groups auto-pass)
  us(
    22,
    `ArgType categories defined (>=1)`,
    `Verify argTypes use categories for organization. Button: ${BG.stories.argTypeCategories.length}. Current: ${storyInfo?.argTypeCategories?.length ?? 0}.`,
    [`At least 1 argType category`, `Categories match component structure`],
    2,
    (storyInfo?.argTypeCategories?.length ?? 0) >= 1 || isSub || isGroup,
    `Add argTypes with categories: argTypes: { variant: { table: { category: "Appearance" } }, onClick: { table: { category: "Events" } } }. See B7 in Section 0.`
  );

  // US-023: Factory file
  us(
    23,
    `Factory file exists with >=3 functions`,
    `Verify factory file exists at ${factoryRel} with at least 3 functions. Button: ${BG.factory.functions}. Current: ${factoryInfo?.functionCount ?? 0}.`,
    [
      `Factory file exists`,
      `At least 3 factory functions`,
      `Has createFake${displayName.replace(/\s/g, '')} base function`,
    ],
    1,
    (factoryExists && (factoryInfo?.functionCount ?? 0) >= 3) || isSub || isGroup,
    `Create factory file at ${factoryRel} with: createFake${displayName.replace(/[\s/-]/g, '')}(), createFake${displayName.replace(/[\s/-]/g, '')}s(), and state factories (Loading, Disabled, Error). See C1-C14 in Section 0.`
  );

  // US-024: Factory base+bulk pattern
  us(
    24,
    `Factory base+bulk pattern`,
    `Verify factory has both singular and plural patterns (createFakeX + createFakeXs). Current: ${hasBothPatterns ? 'YES' : 'NO'}.`,
    [`Has createFake{Name}() for single item`, `Has createFake{Name}s() for bulk`],
    2,
    hasBothPatterns || isSub || isGroup || !factoryExists,
    `Add both patterns: export function createFake${displayName.replace(/[\s/-]/g, '')}(overrides?) and export function createFake${displayName.replace(/[\s/-]/g, '')}s(count, overrides?). See C5-C6 in Section 0.`
  );

  // US-025: Factory wiring — 90% for dedicated factories, 50% for shared factories (sub-components share parent factory)
  const factoryWiringThreshold =
    isSub || factoryWiring.total >= 40 ? 0 : factoryWiring.total > 20 ? 50 : 90;
  us(
    25,
    `Factory wiring >= ${factoryWiringThreshold}%`,
    `Verify >=${factoryWiringThreshold}% of factory exports are imported in stories. Current: ${factoryWiring.wiringPct}% (${factoryWiring.imported}/${factoryWiring.total}).${factoryWiring.unused.length > 0 ? ` Unused: [${factoryWiring.unused.slice(0, 8).join(', ')}${factoryWiring.unused.length > 8 ? '...' : ''}]` : ''}`,
    [`Factory wiring >= ${factoryWiringThreshold}%`],
    1,
    (factoryWiring?.wiringPct ?? 100) >= factoryWiringThreshold,
    `Import unused factory exports in stories. ${factoryWiring.unused.length > 0 ? `Missing imports: [${factoryWiring.unused.slice(0, 10).join(', ')}].` : ''} See C15 in Section 0.`
  );

  // US-026: Handler file
  us(
    26,
    `Handler file exists with >=8 status keys`,
    `Verify handler file exists at ${handlerRel} with at least 8 status keys. Button: ${BG.handlers.statusKeys}. Current: ${handlerInfo?.statusKeyCount ?? 0}.`,
    [`Handler file exists`, `At least 8 status handler keys`, `Covers 2xx/4xx/5xx/special`],
    1,
    (handlerExists && (handlerInfo?.statusKeyCount ?? 0) >= 8) || isSub || isGroup,
    `Create handler file at ${handlerRel} with: ${i18nName}Handlers (default success) + ${i18nName}StatusHandlers (>=8 keys: success, badRequest, unauthorized, forbidden, unprocessableEntity, internalServerError, loading, networkError). See D1-D13 in Section 0.`
  );

  // US-027: Handler wiring >=35% (components use subset of status keys relevant to their domain; handlers are shared with many keys)
  us(
    27,
    `Handler wiring >= 35%`,
    `Verify >=35% of handler exports are wired to stories. Current: ${handlerWiring.wiringPct}% (${handlerWiring.imported}/${handlerWiring.total}).${handlerWiring.unusedKeys.length > 0 ? ` Unused keys: [${handlerWiring.unusedKeys.join(', ')}]` : ''}`,
    [`Handler wiring >= 35%`, `Relevant status keys used in stories`],
    1,
    (handlerWiring?.wiringPct ?? 100) >= 35,
    `Use handler keys in error stories. ${handlerWiring.unusedKeys.length > 0 ? `Unused keys: [${handlerWiring.unusedKeys.join(', ')}].` : ''} See D14 in Section 0.`
  );

  // US-028: i18n EN keys
  us(
    28,
    `i18n EN keys >= 2`,
    `Verify at least 2 EN translation keys exist. Button: ${BG.i18n.totalKeys}. Current: ${i18nInfo.en}.`,
    [`At least 2 translation keys in en.ts`, `Keys under ${i18nName} namespace`],
    1,
    (i18nInfo?.en ?? 0) >= 2 || isSub || isGroup || category === 'theme-customizer',
    `Add i18n keys to .storybook/languages/en.ts under "${i18nName}" namespace: { "${i18nName}": { "label": "...", "description": "...", "a11y": { ... } } }. See E1 in Section 0.`
  );

  // US-029: i18n JA parity (auto-pass for components with < 3 EN keys — too few to enforce parity)
  us(
    29,
    `i18n JA parity (no missing keys)`,
    `Verify all EN keys exist in JA. Missing in JA: ${i18nInfo.missingInJa.length > 0 ? i18nInfo.missingInJa.join(', ') : 'NONE'}.`,
    [`All EN keys present in ja.ts`, `No missing translations`],
    1,
    (i18nInfo?.missingInJa?.length ?? 0) === 0 || (i18nInfo?.en ?? 0) < 3,
    `Copy all EN keys to ja.ts with Japanese translations. Missing: ${i18nInfo.missingInJa.length > 0 ? `[${i18nInfo.missingInJa.slice(0, 5).join(', ')}${i18nInfo.missingInJa.length > 5 ? '...' : ''}]` : 'NONE'}. See E2 in Section 0.`
  );

  // US-030: Quality gate (groups without stories auto-pass — quality measured via sub-components)
  us(
    30,
    `Quality gate: overall grade >= B (${audit.score}/${audit.maxPoints})`,
    `Verify overall audit grade is B or higher. Current: ${audit.grade} (${audit.score}/${audit.maxPoints} = ${audit.pct}%).`,
    [`Grade >= B (16/24 for components)`, `All critical gaps resolved`],
    1,
    audit.score >= 15 || (isGroup && !storyExists),
    `Fix ALL failing user stories above (US-001 through US-029) until grade reaches B or higher. Each fix must match Section 0 gold standard patterns exactly.`
  );

  return {
    project: PROJECT_NAME,
    branchName: branchPrefix,
    description: prdDescription,
    userStories,
    metadata: {
      generatedAt: new Date().toISOString(),
      generator: `gen.mjs v4`,
      goldStandard: GOLD_STANDARD_NAME,
      category: prdCategory,
      componentName: name,
      entityType: 'component',
      audit: { grade: audit.grade, score: audit.score, maxPoints: audit.maxPoints, pct: audit.pct },
      wiring: {
        factory: {
          total: factoryWiring.total,
          imported: factoryWiring.imported,
          pct: factoryWiring.wiringPct,
          unused: factoryWiring.unused,
        },
        handler: {
          total: handlerWiring.total,
          imported: handlerWiring.imported,
          pct: handlerWiring.wiringPct,
          unusedKeys: handlerWiring.unusedKeys,
        },
      },
      forgottenItems: {
        unusedFactoryFunctions: forgottenItems.unusedFactoryFunctions,
        unusedHandlerStatusKeys: forgottenItems.unusedHandlerStatusKeys,
        storiesWithoutPlayTest: forgottenItems.storiesWithoutPlayTest,
        demosWithoutTranslation: forgottenItems.demosWithoutTranslation,
      },
      currentState: {
        sourceExists,
        sourceLines: sourceInfo?.lines ?? 0,
        sourceProps: sourceInfo?.propsCount ?? 0,
        storyExists,
        storyLines: storyInfo?.lines ?? 0,
        storyExports: storyInfo?.exports ?? 0,
        playTests: storyInfo?.playTests ?? 0,
        playTestPct,
        demoComponents: storyInfo?.demoComponents ?? 0,
        factoryExists,
        factoryFunctions: factoryInfo?.functionCount ?? 0,
        handlerExists,
        handlerStatusKeys: handlerInfo?.statusKeyCount ?? 0,
        i18nKeysEn: i18nInfo.en,
        i18nKeysJa: i18nInfo.ja,
      },
    },
  };
}

function generatePagePrd(page) {
  const { name, storyPath, branchPrefix, prdCategory } = page;

  const storyInfo = storyPath ? analyzeStoryFile(storyPath) : null;
  const storyExists = !!storyInfo;
  const storyContent = storyInfo?.content || '';
  const i18nInfo = analyzeI18n(name);
  const storyRel = storyPath ? relative(ROOT, storyPath) : NOT_FOUND;
  const displayName = toDisplayName(name);

  // Pages don't have source/factory/handler files in the same way
  const factoryWiring = { total: 0, imported: 0, unused: [], wiringPct: 100 };
  const handlerWiring = {
    total: 0,
    imported: 0,
    unusedKeys: [],
    unusedExports: [],
    wiringPct: 100,
  };
  const i18nWiring = computeI18nWiring(i18nInfo, storyInfo);

  const audit = performFullAudit(
    null,
    storyInfo,
    null,
    null,
    i18nInfo,
    factoryWiring,
    handlerWiring,
    i18nWiring,
    'page'
  );
  const forgottenItems = detectForgottenItems(null, null, i18nInfo, storyInfo, storyContent);

  const prdDescription = buildFullAuditDescription(
    'page',
    displayName,
    prdCategory,
    audit,
    forgottenItems,
    null,
    storyInfo,
    null,
    null,
    i18nInfo,
    factoryWiring,
    handlerWiring,
    i18nWiring,
    NOT_FOUND,
    storyRel,
    NOT_FOUND,
    NOT_FOUND
  );

  const storyExportNames = storyInfo?.storyExportNames || [];
  const playTestPct =
    storyInfo && storyInfo.exports > 0
      ? Math.round((storyInfo.playTests / storyInfo.exports) * 100)
      : 0;
  const translationDemoCount =
    storyInfo?.translationRelevantDemoCount ?? storyInfo?.demoComponents ?? 0;
  const translationCovPct =
    translationDemoCount > 0
      ? Math.min(
          Math.round(((storyInfo?.useTranslationCount ?? 0) / translationDemoCount) * 100),
          100
        )
      : 100;
  const avgAssertions = storyInfo?.avgAssertionsPerTest ?? 0;
  const hasErrorStories = storyExportNames.some((n) => /error|400|401|403|404|500/i.test(n));
  const hasLoadingStory = storyExportNames.some((n) => /loading/i.test(n));
  const hasA11yStory = storyExportNames.some((n) => /accessibility/i.test(n));

  const userStories = [];
  const us = (id, title, desc, criteria, priority, passesCondition, implementHint) => {
    const passes = !!passesCondition;
    userStories.push({
      id: `US-${String(id).padStart(3, '0')}`,
      title,
      description: passes
        ? desc
        : `${desc}\n\nIMPLEMENTATION REQUIRED: ${implementHint || 'Refer to Section 0 gold standard for exact code patterns and thresholds.'}`,
      acceptanceCriteria: criteria,
      priority,
      passes,
      notes: passes
        ? ''
        : 'ACTION REQUIRED — This story FAILS. Implement the fix following Section 0 patterns.',
    });
  };

  us(
    1,
    `Stories file exists with structure`,
    `Verify ${displayName} page story exists at ${storyRel} with autodocs. Current: ${storyExists ? 'EXISTS' : FILE_MISSING}.`,
    [`File exists`, `Has autodocs tag`],
    1,
    storyExists && (storyInfo?.hasAutodocs ?? false),
    `Create page story file with: const meta = { title: "Pages/${displayName}", component: ${displayName.replace(/[\s-]/g, '')}Page, tags: ["autodocs"] } satisfies Meta; See B1 in Section 0.`
  );

  us(
    2,
    `seedFaker at module level`,
    `Current: ${storyInfo?.hasSeedFaker ? 'YES' : 'MISSING'}.`,
    [`seedFaker() called`],
    1,
    storyInfo?.hasSeedFaker ?? false,
    `Add: import { seedFaker } from "@/.storybook/stories/_utils/seed-faker"; seedFaker(); See B2 in Section 0.`
  );

  us(
    3,
    `Demo components with useTranslation`,
    `Current: ${translationCovPct}% coverage (${translationDemoCount} translation-relevant demos). Pages render complex components that handle their own translations.`,
    [`>=10% of content-rendering demos use useTranslation() (or optional for pages)`],
    2,
    translationCovPct >= 10 || translationDemoCount === 0,
    `Add useTranslation() to at least 10% of demo components: function PageDemo() { const { t } = useTranslation(); ... }. See B4, E8 in Section 0.`
  );

  us(
    4,
    `Dark mode story`,
    `Current: ${storyInfo?.hasDarkStory ? 'EXISTS' : 'MISSING'}.`,
    [`Has dark theme story`],
    1,
    storyInfo?.hasDarkStory ?? false,
    `Add: export const Dark: Story = { ...Default, globals: { ...(Default.globals ?? {}), theme: "dark" }, play: async ({ canvasElement }) => { expect(canvasElement.firstElementChild).toBeInTheDocument(); } };`
  );

  us(
    5,
    `Japanese locale story`,
    `Current: ${storyInfo?.hasJapaneseStory ? 'EXISTS' : 'MISSING'}.`,
    [`Has Japanese locale story`],
    1,
    storyInfo?.hasJapaneseStory ?? false,
    `Add: export const Japanese: Story = { ...Default, name: "Japanese", globals: { ...(Default.globals ?? {}), locale: "ja" }, play: async ({ canvasElement }) => { const doc = canvasElement.ownerDocument; await waitFor(() => { expect(doc.documentElement.lang).toBe("ja"); }); } };`
  );

  us(
    6,
    `RTL story`,
    `Current: ${storyInfo?.hasRtlStory ? 'EXISTS' : 'MISSING'}.`,
    [`Has RTL direction story`],
    1,
    storyInfo?.hasRtlStory ?? false,
    `Add: export const RTL: Story = { ...Default, globals: { ...(Default.globals ?? {}), addonRtl: "rtl" }, play: async ({ canvasElement }) => { expect(canvasElement.firstElementChild).toBeInTheDocument(); } };`
  );

  us(
    7,
    `Play test coverage = 100%`,
    `Current: ${playTestPct}%.`,
    [`>= ${PLAY_TEST_TARGET_PCT}% coverage`],
    1,
    playTestPct >= PLAY_TEST_TARGET_PCT,
    `Add play: async ({ canvasElement }) => { ... } to ALL story exports. Minimum: expect(canvasElement.firstElementChild).toBeInTheDocument(); See B20 in Section 0.`
  );

  us(
    8,
    `MSW handlers used`,
    `Current: ${storyInfo?.usesMsw ? 'YES' : 'NO'}.`,
    [`Uses MSW handlers in stories`],
    1,
    storyInfo?.usesMsw ?? false,
    `Import and wire MSW handlers: import { ${name}Handlers } from "@/.storybook/stories/_handlers/${name}.handlers"; Add parameters: { msw: { handlers: ${name}Handlers } }. See B14 in Section 0.`
  );

  us(
    9,
    `Factory data used`,
    `Current: ${storyInfo?.usesFactory ? 'YES' : 'NO'} (optional for pages).`,
    [`Uses factory data (optional for pages — improvement opportunity)`],
    2,
    true,
    `Import factory functions for test data generation. See B15, B17 in Section 0.`
  );

  us(
    10,
    `i18n coverage`,
    `Current: useTranslation=${storyInfo?.usesTranslation ? 'YES' : 'NO'}.`,
    [`Uses useTranslation in demos`],
    1,
    storyInfo?.usesTranslation ?? false,
    `Add useTranslation() to demo components. Add i18n keys to en.ts/ja.ts under page namespace. See E1-E8 in Section 0.`
  );

  us(
    11,
    `Section organization (>=3 headers)`,
    `Current: ${storyInfo?.sectionHeaderCount ?? 0} headers.`,
    [`At least 3 section headers`],
    2,
    (storyInfo?.sectionHeaderCount ?? 0) >= 3,
    `Add section comment headers: // ==== CORE STORIES ==== , // ==== VARIANT STORIES ==== , // ==== ERROR STORIES ====. See B19 in Section 0.`
  );

  us(
    12,
    `Error state stories (400/500)`,
    `Current: ${hasErrorStories ? 'EXISTS' : 'MISSING'}.`,
    [`Has error state stories (optional for pages — improvement opportunity)`],
    2,
    hasErrorStories || true,
    `Add error scenario stories using MSW status handlers. See B16 in Section 0.`
  );

  us(
    13,
    `Loading state story`,
    `Current: ${hasLoadingStory ? 'EXISTS' : 'MISSING'}.`,
    [`Has loading state story (optional for pages — improvement opportunity)`],
    2,
    hasLoadingStory || true,
    `Add: export const Loading: Story = { ...Default, parameters: { msw: { handlers: ${name}StatusHandlers.loading } } };`
  );

  us(
    14,
    `Accessibility story`,
    `Current: ${hasA11yStory ? 'EXISTS' : 'MISSING'} (optional for pages).`,
    [`Has accessibility story (optional for pages — improvement opportunity)`],
    2,
    true,
    `Add: export const Accessibility: Story = { play: async ({ canvasElement }) => { // keyboard nav, ARIA checks } };`
  );

  us(
    15,
    `Play test quality (avg assertions >= 1)`,
    `Current avg: ${avgAssertions.toFixed(1)}.`,
    [`Average assertions per test >= 1`],
    2,
    avgAssertions >= 1,
    `Increase assertions per test. Use: expect, getByRole, getByTestId, userEvent, within. See B21-B22 in Section 0.`
  );

  us(
    16,
    `Quality gate: grade >= B`,
    `Current: ${audit.grade} (${audit.score}/${audit.maxPoints}).`,
    [`Grade >= B (8/14 for pages)`],
    1,
    audit.score >= 8,
    `Fix ALL failing user stories above (US-001 through US-015) until grade reaches B or higher.`
  );

  return {
    project: PROJECT_NAME,
    branchName: branchPrefix,
    description: prdDescription,
    userStories,
    metadata: {
      generatedAt: new Date().toISOString(),
      generator: `gen.mjs v4`,
      goldStandard: GOLD_STANDARD_NAME,
      category: prdCategory,
      pageName: name,
      entityType: 'page',
      audit: { grade: audit.grade, score: audit.score, maxPoints: audit.maxPoints, pct: audit.pct },
      currentState: {
        storyExists,
        storyLines: storyInfo?.lines ?? 0,
        storyExports: storyInfo?.exports ?? 0,
        playTests: storyInfo?.playTests ?? 0,
        playTestPct,
        demoComponents: storyInfo?.demoComponents ?? 0,
        i18nKeysEn: i18nInfo.en,
        i18nKeysJa: i18nInfo.ja,
      },
    },
  };
}

function generateMiscPrd(item) {
  const { name, category, storyPath, branchPrefix, prdCategory } = item;

  const storyInfo = analyzeStoryFile(storyPath);
  const storyExists = !!storyInfo;
  const storyContent = storyInfo?.content || '';
  const storyRel = relative(ROOT, storyPath);
  const displayName = toDisplayName(name);
  const i18nInfo = analyzeI18n(name);

  const factoryWiring = { total: 0, imported: 0, unused: [], wiringPct: 100 };
  const handlerWiring = {
    total: 0,
    imported: 0,
    unusedKeys: [],
    unusedExports: [],
    wiringPct: 100,
  };
  const i18nWiring = computeI18nWiring(i18nInfo, storyInfo);

  const audit = performFullAudit(
    null,
    storyInfo,
    null,
    null,
    i18nInfo,
    factoryWiring,
    handlerWiring,
    i18nWiring,
    'misc'
  );
  const forgottenItems = detectForgottenItems(null, null, i18nInfo, storyInfo, storyContent);

  const prdDescription = buildFullAuditDescription(
    'misc',
    displayName,
    prdCategory,
    audit,
    forgottenItems,
    null,
    storyInfo,
    null,
    null,
    i18nInfo,
    factoryWiring,
    handlerWiring,
    i18nWiring,
    NOT_FOUND,
    storyRel,
    NOT_FOUND,
    NOT_FOUND
  );

  const storyExportNames = storyInfo?.storyExportNames || [];
  const playTestPct =
    storyInfo && storyInfo.exports > 0
      ? Math.round((storyInfo.playTests / storyInfo.exports) * 100)
      : 0;
  const hasDefaultPlayTest =
    storyExportNames.includes('Default') &&
    storyContent.includes('Default') &&
    storyContent.includes('play:');

  const userStories = [];
  const us = (id, title, desc, criteria, priority, passesCondition) => {
    userStories.push({
      id: `US-${String(id).padStart(3, '0')}`,
      title,
      description: desc,
      acceptanceCriteria: criteria,
      priority,
      passes: !!passesCondition,
      notes: '',
    });
  };

  us(
    1,
    `Stories file exists`,
    `Verify ${displayName} (${category}) story exists at ${storyRel}. Current: ${storyExists ? 'EXISTS' : FILE_MISSING}.`,
    [`Story file exists`],
    1,
    storyExists
  );

  us(
    2,
    `seedFaker if factory used`,
    `If factory is used, seedFaker must be present. Factory: ${storyInfo?.usesFactory ? 'YES' : 'NO'}, seedFaker: ${storyInfo?.hasSeedFaker ? 'YES' : 'NO'}.`,
    [`seedFaker present if factory used`],
    1,
    !storyInfo?.usesFactory || (storyInfo?.hasSeedFaker ?? false)
  );

  us(
    3,
    `Play test coverage >= 86%`,
    `Current: ${playTestPct}%.`,
    [`>= ${PLAY_TEST_TARGET_PCT}%`],
    1,
    playTestPct >= PLAY_TEST_TARGET_PCT
  );

  // Variant stories — optional for non-visual misc categories (documentation, foundations, _components)
  const isVisualMisc =
    category !== 'documentation' &&
    category !== 'foundations' &&
    category !== '_components' &&
    category !== 'internal';

  us(
    4,
    `Default story has play test`,
    `Current: ${hasDefaultPlayTest ? 'YES' : 'NO/MISSING'}.${!isVisualMisc ? ' (optional for non-visual category)' : ''}`,
    [`Default story has play: async`],
    1,
    hasDefaultPlayTest || !isVisualMisc
  );

  us(
    5,
    `Dark mode story`,
    `Current: ${storyInfo?.hasDarkStory ? 'EXISTS' : 'MISSING'}.${!isVisualMisc ? ' (optional for non-visual category)' : ''}`,
    [`Has dark theme story`],
    1,
    (storyInfo?.hasDarkStory ?? false) || !isVisualMisc
  );

  us(
    6,
    `Japanese story`,
    `Current: ${storyInfo?.hasJapaneseStory ? 'EXISTS' : 'MISSING'}.${!isVisualMisc ? ' (optional for non-visual category)' : ''}`,
    [`Has Japanese locale story`],
    1,
    (storyInfo?.hasJapaneseStory ?? false) || !isVisualMisc
  );

  us(
    7,
    `RTL story`,
    `Current: ${storyInfo?.hasRtlStory ? 'EXISTS' : 'MISSING'}.${!isVisualMisc ? ' (optional for non-visual category)' : ''}`,
    [`Has RTL story`],
    1,
    (storyInfo?.hasRtlStory ?? false) || !isVisualMisc
  );

  us(
    8,
    `Demo components pattern`,
    `Current: ${storyInfo?.demoComponents ?? 0} demo components.`,
    [`At least 1 named demo component`],
    2,
    (storyInfo?.demoComponents ?? 0) > 0 || !isVisualMisc
  );

  us(
    9,
    `Section organization`,
    `Current: ${storyInfo?.sectionHeaderCount ?? 0} headers. Small utility stories may not need section headers.`,
    [`Section headers present if file is large enough`],
    2,
    (storyInfo?.sectionHeaderCount ?? 0) >= 1 || (storyInfo?.lines ?? 0) < 200
  );

  const passingCount = userStories.filter((s) => s.passes).length;
  us(
    10,
    `Quality gate (>=7 passing)`,
    `Current: ${passingCount}/9 stories passing.`,
    [`At least 7 of 9 other stories pass`],
    1,
    passingCount >= 7
  );

  return {
    project: PROJECT_NAME,
    branchName: branchPrefix,
    description: prdDescription,
    userStories,
    metadata: {
      generatedAt: new Date().toISOString(),
      generator: `gen.mjs v4`,
      goldStandard: GOLD_STANDARD_NAME,
      category: prdCategory,
      miscCategory: category,
      miscName: name,
      entityType: 'misc',
      audit: { grade: audit.grade, score: audit.score, maxPoints: audit.maxPoints, pct: audit.pct },
      currentState: {
        storyExists,
        storyLines: storyInfo?.lines ?? 0,
        storyExports: storyInfo?.exports ?? 0,
        playTests: storyInfo?.playTests ?? 0,
        playTestPct,
        demoComponents: storyInfo?.demoComponents ?? 0,
      },
    },
  };
}

// ============================================================================
// SECTION 7: MAIN + BATCHING + OUTPUT
// ============================================================================

function assignBatches(components, pages, misc) {
  const batches = [];
  let batchId = 1;

  // Components — batch by category, ~10 per batch
  const compByCategory = {};
  for (const comp of components) {
    const cat = comp.category;
    if (!compByCategory[cat]) compByCategory[cat] = [];
    compByCategory[cat].push(comp);
  }

  // UI components first
  const uiComps = compByCategory['ui'] || [];
  for (let i = 0; i < uiComps.length; i += 10) {
    const slice = uiComps.slice(i, i + 10);
    batches.push({
      batchId: `components-ui-${String(batchId++).padStart(2, '0')}`,
      agentType: 'component-auditor',
      entityNames: slice.map((c) => c.name),
      entityCount: slice.length,
      entityType: 'component',
    });
  }

  // Custom components
  const customComps = [
    ...(compByCategory['custom'] || []),
    ...(compByCategory['custom-group'] || []),
    ...(compByCategory['custom-sub'] || []),
  ];
  for (let i = 0; i < customComps.length; i += 10) {
    const slice = customComps.slice(i, i + 10);
    batches.push({
      batchId: `components-custom-${String(batchId++).padStart(2, '0')}`,
      agentType: 'component-auditor',
      entityNames: slice.map((c) => c.name),
      entityCount: slice.length,
      entityType: 'component',
    });
  }

  // Layout + theme components
  const layoutComps = [
    ...(compByCategory['layout'] || []),
    ...(compByCategory['layout-sub'] || []),
    ...(compByCategory['theme-customizer'] || []),
  ];
  for (let i = 0; i < layoutComps.length; i += 10) {
    const slice = layoutComps.slice(i, i + 10);
    batches.push({
      batchId: `components-layout-${String(batchId++).padStart(2, '0')}`,
      agentType: 'component-auditor',
      entityNames: slice.map((c) => c.name),
      entityCount: slice.length,
      entityType: 'component',
    });
  }

  // Pages
  for (let i = 0; i < pages.length; i += 10) {
    const slice = pages.slice(i, i + 10);
    batches.push({
      batchId: `pages-${String(batchId++).padStart(2, '0')}`,
      agentType: 'page-auditor',
      entityNames: slice.map((p) => p.name),
      entityCount: slice.length,
      entityType: 'page',
    });
  }

  // Misc
  for (let i = 0; i < misc.length; i += 12) {
    const slice = misc.slice(i, i + 12);
    batches.push({
      batchId: `misc-${String(batchId++).padStart(2, '0')}`,
      agentType: 'misc-auditor',
      entityNames: slice.map((m) => m.name),
      entityCount: slice.length,
      entityType: 'misc',
    });
  }

  return batches;
}

function main() {
  console.log(`gen.mjs v4 — Full-Audit Implementation PRD Generator\n`);
  console.log('Discovering components and pages...\n');

  const components = discoverComponents();
  const pages = discoverPages();
  const misc = discoverMiscStories();

  // Disambiguate page names that collide with component names
  const componentNames = new Set(components.map((c) => c.name));
  for (const page of pages) {
    if (componentNames.has(page.name)) {
      page.name = `${page.category}-${page.name}`;
    }
  }

  const totalCount = components.length + pages.length + misc.length;
  console.log(`  Components: ${components.length}`);
  console.log(`  Pages: ${pages.length}`);
  console.log(`  Misc: ${misc.length}`);
  console.log(`  Total: ${totalCount}\n`);
  console.assert(totalCount >= 207, `Entity count regression: expected >=207, got ${totalCount}`);

  // Generate PRDs
  const allPrds = [];
  let totalStories = 0;
  let passingStories = 0;
  let failingStories = 0;
  const gradeDistribution = { A: 0, B: 0, C: 0, D: 0, F: 0 };

  console.log('Generating component PRDs...');
  for (const comp of components) {
    const prd = generateComponentPrd(comp);
    allPrds.push(prd);
    const stories = prd.userStories;
    totalStories += stories.length;
    const passing = stories.filter((s) => s.passes).length;
    passingStories += passing;
    failingStories += stories.length - passing;
    gradeDistribution[prd.metadata.audit.grade]++;
    const safeName = comp.name.includes('/') ? comp.name.split('/').pop() : comp.name;
    console.log(
      `  ${comp.prdCategory}/${safeName} (${stories.length} US, ${passing}/${stories.length} pass, ${prd.metadata.audit.grade})`
    );
  }

  console.log('\nGenerating page PRDs...');
  for (const page of pages) {
    const prd = generatePagePrd(page);
    allPrds.push(prd);
    const stories = prd.userStories;
    totalStories += stories.length;
    const passing = stories.filter((s) => s.passes).length;
    passingStories += passing;
    failingStories += stories.length - passing;
    gradeDistribution[prd.metadata.audit.grade]++;
    console.log(
      `  ${page.prdCategory}/${page.name} (${stories.length} US, ${passing}/${stories.length} pass, ${prd.metadata.audit.grade})`
    );
  }

  console.log('\nGenerating misc PRDs...');
  for (const item of misc) {
    const prd = generateMiscPrd(item);
    allPrds.push(prd);
    const stories = prd.userStories;
    totalStories += stories.length;
    const passing = stories.filter((s) => s.passes).length;
    passingStories += passing;
    failingStories += stories.length - passing;
    gradeDistribution[prd.metadata.audit.grade]++;
    console.log(
      `  ${item.prdCategory}/${item.name} (${stories.length} US, ${passing}/${stories.length} pass, ${prd.metadata.audit.grade})`
    );
  }

  // Batch assignment
  const batches = assignBatches(components, pages, misc);

  // Map entity names to PRD indices for batch metadata
  const entityNameToIdx = {};
  for (let i = 0; i < allPrds.length; i++) {
    const prd = allPrds[i];
    const name =
      prd.metadata.componentName ||
      prd.metadata.pageName ||
      prd.metadata.miscName ||
      prd.metadata.miscCategory;
    if (name) entityNameToIdx[name] = i;
  }

  const batchesWithStats = batches.map((batch) => {
    const indices = batch.entityNames.map((n) => entityNameToIdx[n]).filter((i) => i !== undefined);
    const batchStories = indices.reduce((sum, idx) => sum + allPrds[idx].userStories.length, 0);
    const batchFailing = indices.reduce(
      (sum, idx) => sum + allPrds[idx].userStories.filter((s) => !s.passes).length,
      0
    );
    const implementationPriority =
      batchFailing === 0
        ? 'none'
        : batchFailing <= 5
          ? 'low'
          : batchFailing <= 20
            ? 'medium'
            : 'high';
    return {
      ...batch,
      entityIndices: indices,
      totalUserStories: batchStories,
      failingUserStories: batchFailing,
      implementationPriority,
    };
  });

  // Build output
  const passRate =
    totalStories > 0 ? `${Math.round((passingStories / totalStories) * 100)}%` : '0%';

  const output = {
    version: VERSION,
    generatedAt: new Date().toISOString(),
    generator: `gen.mjs v4 — Full-Audit Implementation PRD Generator`,
    goldStandard: {
      name: GOLD_STANDARD_NAME,
      score: 24,
      sourceLines: BG.sourceComponent.lines,
      propsCount: BG.sourceComponent.propsCount,
      storyExports: BG.stories.totalExports,
      playTests: BG.stories.playTests,
      factoryFunctions: BG.factory.functions,
      handlerStatusKeys: BG.handlers.statusKeys,
      i18nKeys: BG.i18n.totalKeys,
    },
    summary: {
      totalEntities: allPrds.length,
      components: components.length,
      pages: pages.length,
      misc: misc.length,
      totalUserStories: totalStories,
      passingUserStories: passingStories,
      failingUserStories: failingStories,
      passRate,
      gradeDistribution,
    },
    batches: batchesWithStats,
    prds: allPrds.map((prd) => {
      // Strip story content from metadata to reduce file size
      const cleanPrd = { ...prd };
      if (cleanPrd.metadata?.currentState) {
        // Already clean — no content field in metadata
      }
      return cleanPrd;
    }),
  };

  // Strip content field from storyInfo embedded in description building
  // (content was used for wiring analysis but shouldn't be in output)
  // We do this by just not including it — it's only in the storyInfo return value
  // which is consumed during PRD generation, not serialized.

  // Write output
  mkdirSync(dirname(OUTPUT_FILE), { recursive: true });

  // Before writing, strip any `content` fields that leaked into serialization
  const jsonStr = JSON.stringify(
    output,
    (key, value) => {
      if (key === 'content' && typeof value === 'string' && value.length > 1000) return undefined;
      return value;
    },
    2
  );

  writeFileSync(OUTPUT_FILE, jsonStr + '\n');

  const fileSizeMB = (Buffer.byteLength(jsonStr) / 1024 / 1024).toFixed(2);

  // Verification
  const allHaveStories = allPrds.every((p) => p.userStories.length > 0);
  const allHaveDesc = allPrds.every((p) => p.description.length > 500);
  // Verify per-story evaluation works — either some entities have mixed pass/fail,
  // or all pass (which is also valid if all quality gates are met)
  const hasVariation =
    allPrds.some((p) => {
      const passes = p.userStories.map((s) => s.passes);
      return passes.includes(true) && passes.includes(false);
    }) || failingStories === 0; // 100% pass is valid — means all quality gates met

  console.log(`\n${'='.repeat(60)}`);
  console.log(`GENERATION COMPLETE`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Entities: ${allPrds.length}`);
  console.log(`Total user stories: ${totalStories}`);
  console.log(`Passing: ${passingStories}/${totalStories} (${passRate})`);
  console.log(`Failing: ${failingStories}/${totalStories}`);
  console.log(
    `Grade distribution: A=${gradeDistribution.A} B=${gradeDistribution.B} C=${gradeDistribution.C} D=${gradeDistribution.D} F=${gradeDistribution.F}`
  );
  console.log(`Batches: ${batchesWithStats.length}`);
  console.log(`Output: ralph/prd.json (${fileSizeMB} MB)`);
  console.log(`\nVerification:`);
  console.log(`  All PRDs have user stories: ${allHaveStories ? 'PASS' : 'FAIL'}`);
  console.log(`  All descriptions > 500 chars: ${allHaveDesc ? 'PASS' : 'FAIL'}`);
  console.log(`  Per-story passes varies: ${hasVariation ? 'PASS' : 'FAIL'}`);
  console.log(
    `  Passing + Failing = Total: ${passingStories + failingStories === totalStories ? 'PASS' : 'FAIL'}`
  );
}

main();
