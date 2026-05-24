# Component Addition State Machine - Complete Workflow

---

# 🚀 COMPLETE TECH STACK REFERENCE

```
╔═══════════════════════════════════════════════════════════════════════════════════════════╗
║                           ULTRA MAX UI-KIT TECH STACK                                      ║
║                    shadcn-ui-kit / template-frontend-rust                                  ║
╚═══════════════════════════════════════════════════════════════════════════════════════════╝

┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│  🏗️ CORE FRAMEWORK                                                                          │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│  Next.js 16              │ App Router, RSC, Server Actions                                 │
│  React 19                │ Concurrent features, useId, use() hook                          │
│  TypeScript 5.9          │ Strict mode, satisfies, const assertions                        │
│  ESM                     │ Native ES Modules throughout                                    │
│                                                                                             │
└─────────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│  🎨 STYLING & UI                                                                            │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│  Tailwind CSS            │ Utility-first CSS (ZERO STYLE CHANGES ALLOWED)                  │
│  CVA                     │ class-variance-authority for component variants                 │
│  shadcn/ui               │ Radix UI primitives + Tailwind styling                          │
│  Radix UI                │ Accessible, unstyled UI primitives                              │
│  Lucide React            │ Icon library                                                    │
│  clsx + tailwind-merge   │ Class name utilities (cn function)                              │
│                                                                                             │
└─────────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│  📚 STORYBOOK 10 (COMPLETE ADDON SUITE)                                                     │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│  @storybook/nextjs-vite        │ Next.js + Vite framework                                  │
│  @storybook/addon-essentials   │ Controls, Actions, Docs, Viewport, Backgrounds           │
│  @storybook/addon-a11y         │ Accessibility testing (axe-core)                          │
│  @storybook/addon-themes       │ Theme switching (light/dark + presets)                    │
│  @storybook/addon-interactions │ Play function testing                                     │
│  @storybook/addon-coverage     │ Test coverage reporting                                   │
│  @storybook/addon-storysource  │ View story source code                                    │
│  @storybook/addon-designs      │ Figma integration                                         │
│  @storybook/addon-console      │ Console output to Actions panel                           │
│  @storybook/test               │ Testing utilities (expect, fn, userEvent, within)        │
│  @storybook/test-runner        │ CLI test execution                                        │
│                                                                                             │
│  storybook-addon-pseudo-states │ Hover, focus, active states                               │
│  storybook-react-i18next       │ i18n integration                                          │
│  storybook-addon-rtl           │ RTL layout testing                                        │
│  storybook-addon-mock-date     │ Time freezing for determinism                             │
│  msw-storybook-addon           │ MSW v2 integration                                        │
│  @chromatic-com/storybook      │ Visual regression testing                                 │
│  storybook-addon-nuqs          │ URL state management                                      │
│                                                                                             │
│  Stories Location: .storybook/stories/** ONLY                                              │
│                                                                                             │
└─────────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│  🧪 TESTING                                                                                 │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│  Vitest                  │ Unit testing framework                                          │
│  @testing-library/react  │ React Testing Library                                           │
│  @testing-library/user-event │ User interaction simulation                                 │
│  MSW v2 (msw@^2.x)       │ Mock Service Worker for API mocking                             │
│  axe-core                │ Accessibility testing engine                                    │
│  Playwright              │ E2E testing (via Storybook)                                     │
│                                                                                             │
└─────────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│  📝 FORMS & VALIDATION                                                                      │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│  React Hook Form         │ Form state management                                           │
│  @hookform/resolvers     │ Schema validation integration                                   │
│  Zod v4                  │ TypeScript-first schema validation                              │
│                                                                                             │
│  Pattern: zod schema → zodResolver → useForm → type inference                              │
│                                                                                             │
└─────────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│  🌍 INTERNATIONALIZATION                                                                    │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│  i18next                 │ Internationalization framework                                  │
│  react-i18next           │ React bindings                                                  │
│  storybook-react-i18next │ Storybook integration                                           │
│                                                                                             │
│  Locales: en (default), ja (Japanese)                                                      │
│  SSOT: .storybook/ssot.ts (524+ keys)                                                      │
│                                                                                             │
└─────────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│  📦 DATA & STATE                                                                            │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│  @faker-js/faker         │ Fake data generation (MUST BE SEEDED)                           │
│  Zustand                 │ EXISTS BUT FORBIDDEN - React-only state required                │
│                                                                                             │
│  Allowed State: useState, useReducer, useContext, useRef, useMemo, useCallback, useId     │
│  Forbidden: import { useStore } from 'zustand'                                             │
│                                                                                             │
└─────────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│  🔧 TOOLING & DX                                                                            │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│  ESLint                  │ Linting (eslint.config.mjs - STRICT)                            │
│  Prettier                │ Code formatting                                                 │
│  TypeScript              │ Type checking (strict mode)                                     │
│  madge                   │ Circular dependency detection                                   │
│  knip                    │ Unused exports detection                                        │
│                                                                                             │
│  Path Alias: @ → repo root                                                                 │
│                                                                                             │
└─────────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│  📂 PROJECT STRUCTURE                                                                       │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│  /                                                                                          │
│  ├── .storybook/                                                                           │
│  │   ├── main.ts                    # Storybook config (14 addons)                         │
│  │   ├── preview.tsx                # Preview decorators + globals                         │
│  │   ├── preview-head.html          # Head injection                                       │
│  │   ├── manager.ts                 # Manager UI config                                    │
│  │   ├── test-runner.ts             # Test runner (a11y modes)                             │
│  │   ├── ssot.ts                    # i18n + global parameters                             │
│  │   └── stories/                   # ALL STORIES HERE                                     │
│  │       ├── _factories/            # 33 factory files                                     │
│  │       │   ├── index.ts           # Barrel export                                        │
│  │       │   └── *.factory.ts       # Per-component factories                              │
│  │       ├── _handlers/             # 31 MSW handler files                                 │
│  │       │   ├── index.ts           # Barrel + allHandlers                                 │
│  │       │   └── *.handlers.ts      # Per-component handlers                               │
│  │       ├── _utils/                # Utilities                                            │
│  │       │   ├── index.ts           # Barrel export                                        │
│  │       │   ├── faker-seed.ts      # Deterministic faker                                  │
│  │       │   └── story-helpers.ts   # Helper functions                                     │
│  │       ├── _components/           # Shared story components                              │
│  │       ├── components/            # Component stories                                    │
│  │       │   ├── ui/                # UI component stories                                 │
│  │       │   ├── custom/            # Custom component stories                             │
│  │       │   ├── layout/            # Layout stories                                       │
│  │       │   └── theme-customizer/  # Theme stories                                        │
│  │       ├── documentation/         # Documentation stories                                │
│  │       ├── foundations/           # Foundation stories                                   │
│  │       └── hooks/                 # Hook stories                                         │
│  │                                                                                          │
│  ├── app/                           # Next.js App Router                                   │
│  │   ├── globals.css                # Global styles + Tailwind                             │
│  │   ├── layout.tsx                 # Root layout                                          │
│  │   └── page.tsx                   # Home page                                            │
│  │                                                                                          │
│  ├── components/                    # React components                                     │
│  │   ├── ui/                        # 58+ shadcn UI components                             │
│  │   │   └── *.tsx                  # CVA + ForwardRef + data-slot                         │
│  │   ├── layout/                    # Layout components                                    │
│  │   │   ├── header/                # Header components                                    │
│  │   │   └── sidebar/               # Sidebar components                                   │
│  │   ├── theme-customizer/          # Theme customization                                  │
│  │   └── custom/                    # Custom components                                    │
│  │       ├── icon.tsx               # Icon wrapper                                         │
│  │       ├── minimal-tiptap/        # Rich text editor                                     │
│  │       └── prompt/                # Chat/prompt components                               │
│  │                                                                                          │
│  ├── hooks/                         # Custom React hooks                                   │
│  │                                                                                          │
│  ├── lib/                           # Utilities                                            │
│  │   ├── utils.ts                   # cn() function                                        │
│  │   ├── themes.ts                  # Theme config                                         │
│  │   ├── env.ts                     # Environment config                                   │
│  │   └── analytics.ts               # Analytics setup                                      │
│  │                                                                                          │
│  ├── public/                        # Static assets                                        │
│  │   └── mockServiceWorker.js       # MSW worker                                           │
│  │                                                                                          │
│  ├── eslint.config.mjs              # ESLint config (STRICT)                               │
│  ├── package.json                   # Dependencies                                         │
│  ├── tsconfig.json                  # TypeScript config                                    │
│  ├── tailwind.config.ts             # Tailwind config                                      │
│  └── next.config.ts                 # Next.js config                                       │
│                                                                                             │
└─────────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│  📜 NPM SCRIPTS                                                                             │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│  DEVELOPMENT                                                                                │
│  ─────────────────────────────────────────────────────────────────────────────────────      │
│  npm run dev                    │ Start Next.js dev server                                 │
│  npm run storybook              │ Start Storybook dev server                               │
│  npm run build                  │ Build Next.js for production                             │
│  npm run build-storybook        │ Build static Storybook                                   │
│                                                                                             │
│  TESTING                                                                                    │
│  ─────────────────────────────────────────────────────────────────────────────────────      │
│  npm run test:run               │ Run Vitest tests                                         │
│  npm run test:coverage          │ Run tests with coverage                                  │
│  npm run storybook:test         │ Run Storybook play function tests                        │
│  npm run storybook:test:a11y    │ Run accessibility tests                                  │
│  npm run storybook:a11y:baseline│ Accessibility baseline mode                              │
│                                                                                             │
│  QUALITY                                                                                    │
│  ─────────────────────────────────────────────────────────────────────────────────────      │
│  npm run typecheck              │ TypeScript type checking                                 │
│  npm run lint                   │ Run ESLint                                               │
│  npm run lint:strict            │ Run ESLint in strict mode                                │
│  npm run storybook:quality      │ Story quality check                                      │
│  npm run storybook:gaps         │ Find story coverage gaps                                 │
│  npm run storybook:deep-gaps    │ Deep gap analysis                                        │
│  npm run storybook:audit        │ Full Storybook audit                                     │
│                                                                                             │
│  REPO HEALTH                                                                                │
│  ─────────────────────────────────────────────────────────────────────────────────────      │
│  npm run madge                  │ Check circular dependencies                              │
│  npm run knip                   │ Find unused exports                                      │
│  npm run storybook:fullread     │ Full Storybook analysis                                  │
│  npm run repo:fullread          │ Full repo analysis                                       │
│                                                                                             │
└─────────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│  🎨 THEME SYSTEM                                                                            │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│  PRESETS (8 color themes)                                                                   │
│  ─────────────────────────────────────────────────────────────────────────────────────      │
│  default    │ Standard shadcn theme                                                        │
│  blue       │ Blue accent                                                                  │
│  green      │ Green accent                                                                 │
│  rose       │ Rose/Pink accent                                                             │
│  orange     │ Orange accent                                                                │
│  purple     │ Purple accent                                                                │
│  yellow     │ Yellow accent                                                                │
│  neutral    │ Neutral/Gray accent                                                          │
│                                                                                             │
│  CUSTOMIZATION                                                                              │
│  ─────────────────────────────────────────────────────────────────────────────────────      │
│  Mode       │ light / dark / system                                                        │
│  Radius     │ 0 / 0.25 / 0.5 / 0.75 / 1.0                                                  │
│  Scale      │ 0.9 / 0.95 / 1.0 / 1.05 / 1.1                                                │
│  Layout     │ default / compact / comfortable                                              │
│  Sidebar    │ default / floating / inset                                                   │
│                                                                                             │
│  CSS Variables: --primary, --secondary, --accent, --background, --foreground, etc.        │
│                                                                                             │
└─────────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│  🔐 COMPONENT PATTERNS                                                                      │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│  CVA VARIANTS                                                                               │
│  ─────────────────────────────────────────────────────────────────────────────────────      │
│  const buttonVariants = cva(base, {                                                        │
│    variants: { variant: {...}, size: {...} },                                              │
│    defaultVariants: { variant: 'default', size: 'default' }                                │
│  });                                                                                        │
│                                                                                             │
│  FORWARDREF                                                                                 │
│  ─────────────────────────────────────────────────────────────────────────────────────      │
│  const Button = React.forwardRef<HTMLButtonElement, ButtonProps>((props, ref) => ...);    │
│  Button.displayName = 'Button';                                                            │
│                                                                                             │
│  DATA ATTRIBUTES (REQUIRED)                                                                 │
│  ─────────────────────────────────────────────────────────────────────────────────────      │
│  data-slot="button"      │ Component identification                                        │
│  data-testid="button"    │ Testing selector                                                │
│  data-loading={loading}  │ State indication                                                │
│  data-disabled={disabled}│ State indication                                                │
│                                                                                             │
│  ARIA ATTRIBUTES                                                                            │
│  ─────────────────────────────────────────────────────────────────────────────────────      │
│  aria-busy={loading}     │ Loading state                                                   │
│  aria-disabled={disabled}│ Disabled state                                                  │
│  aria-label="..."        │ Accessible label                                                │
│  role="..."              │ Semantic role                                                   │
│                                                                                             │
└─────────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│  📊 COUNTS & METRICS                                                                        │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│  UI Components:              58+ files in components/ui/                                   │
│  Custom Components:          2 major (minimal-tiptap, prompt)                              │
│  Layout Components:          8 files (header/sidebar)                                      │
│  Theme Customizer:           9 files                                                       │
│  Factory Files:              33 in _factories/                                             │
│  Handler Files:              31 in _handlers/                                              │
│  Story Files:                120+ in stories/components/                                   │
│  i18n Keys:                  524+ (EN + JA)                                                │
│  Storybook Addons:           14+ configured                                                │
│  Theme Presets:              8 color themes                                                │
│  Radius Options:             5 levels                                                      │
│  Scale Options:              5 levels                                                      │
│                                                                                             │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## ASCII State Machine Diagram

```
                              ┌─────────────────────────────────────────────────────────────────┐
                              │                    COMPONENT LIFECYCLE                          │
                              │                  State Machine Diagram                          │
                              └─────────────────────────────────────────────────────────────────┘

    ╔═══════════════════════════════════════════════════════════════════════════════════════════════════╗
    ║                                    PHASE 1: COMPONENT CREATION                                     ║
    ╚═══════════════════════════════════════════════════════════════════════════════════════════════════╝

    ┌──────────────┐
    │   START      │
    │   (Idea)     │
    └──────┬───────┘
           │
           ▼
    ┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
    │  [1] CREATE COMPONENT                                                                            │
    │  Location: components/ui/<name>.tsx  OR  components/<category>/<name>.tsx                        │
    │                                                                                                  │
    │  Requirements:                                                                                   │
    │  ├─ CVA variants: const <name>Variants = cva(base, { variants: {...}, defaultVariants: {...} }) │
    │  ├─ ForwardRef: React.forwardRef<HTMLElement, Props>                                            │
    │  ├─ data-slot="<name>" attribute on root element                                                │
    │  ├─ data-testid="<name>" attribute on root element                                              │
    │  ├─ TypeScript: export type/interface for Props                                                 │
    │  └─ Export both Component and Variants                                                          │
    └──────────────────────────────────────────────────────────────────────────────────────────────────┘
           │
           │ Component exists?
           ▼
    ╔═══════════════════════════════════════════════════════════════════════════════════════════════════╗
    ║                                   PHASE 2: FACTORY CREATION                                        ║
    ╚═══════════════════════════════════════════════════════════════════════════════════════════════════╝

    ┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
    │  [2] CREATE FACTORY                                                                              │
    │  Location: .storybook/stories/_factories/<name>.factory.ts                                       │
    │                                                                                                  │
    │  Structure:                                                                                      │
    │  ├─ Types: export type <Name>Variant = 'default' | 'secondary' | ...                           │
    │  ├─ Constants: export const <NAME>_VARIANTS: <Name>Variant[] = [...]                           │
    │  ├─ Interface: export interface Fake<Name> { id, label, variant, ... }                         │
    │  ├─ Creator: export function createFake<Name>(overrides?: Partial<Fake<Name>>): Fake<Name>     │
    │  └─ Bulk: export function createFake<Names>(count: number): Fake<Name>[]                       │
    └──────────────────────────────────────────────────────────────────────────────────────────────────┘
           │
           ▼
    ┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
    │  [3] UPDATE FACTORY INDEX                                                                        │
    │  Location: .storybook/stories/_factories/index.ts                                                │
    │                                                                                                  │
    │  Actions:                                                                                        │
    │  ├─ Add comment block: // <Name> factories                                                      │
    │  ├─ Add export: export * from './<name>.factory';                                               │
    │  └─ Maintain alphabetical order                                                                 │
    └──────────────────────────────────────────────────────────────────────────────────────────────────┘
           │
           │ Factories ready?
           ▼
    ╔═══════════════════════════════════════════════════════════════════════════════════════════════════╗
    ║                                   PHASE 3: HANDLER CREATION                                        ║
    ╚═══════════════════════════════════════════════════════════════════════════════════════════════════╝

    ┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
    │  [4] CREATE HANDLERS (MSW)                                                                       │
    │  Location: .storybook/stories/_handlers/<name>.handlers.ts                                       │
    │                                                                                                  │
    │  Structure:                                                                                      │
    │  ├─ API Endpoints: const API_<NAME>_ACTION = '/api/<name>/action';                             │
    │  ├─ Success Handlers: export const <name>Handlers = [ http.post(...) ]                         │
    │  └─ Status Handlers: export const <name>StatusHandlers = {                                     │
    │       success: <name>Handlers,                                                                  │
    │       badRequest: [...],        // 400                                                          │
    │       unauthorized: [...],      // 401                                                          │
    │       forbidden: [...],         // 403                                                          │
    │       notFound: [...],          // 404                                                          │
    │       tooManyRequests: [...],   // 429                                                          │
    │       internalServerError: [...], // 500                                                        │
    │       badGateway: [...],        // 502                                                          │
    │       serviceUnavailable: [...], // 503                                                         │
    │       gatewayTimeout: [...],    // 504                                                          │
    │       loading: [...],           // infinite delay                                               │
    │       slowResponse: [...],      // 5000ms delay                                                 │
    │       networkError: [...],      // network failure                                              │
    │       emptyData: [...]          // empty response                                               │
    │     }                                                                                           │
    └──────────────────────────────────────────────────────────────────────────────────────────────────┘
           │
           ▼
    ┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
    │  [5] UPDATE HANDLERS INDEX                                                                       │
    │  Location: .storybook/stories/_handlers/index.ts                                                 │
    │                                                                                                  │
    │  Actions:                                                                                        │
    │  ├─ Import: import { <name>Handlers, <name>StatusHandlers } from './<name>.handlers';          │
    │  ├─ Add to allHandlers: [..., ...<name>Handlers]                                               │
    │  └─ Re-export: export { <name>Handlers, <name>StatusHandlers };                                │
    └──────────────────────────────────────────────────────────────────────────────────────────────────┘
           │
           │ Handlers ready?
           ▼
    ╔═══════════════════════════════════════════════════════════════════════════════════════════════════╗
    ║                                    PHASE 4: I18N SETUP                                             ║
    ╚═══════════════════════════════════════════════════════════════════════════════════════════════════╝

    ┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
    │  [6] UPDATE SSOT (Single Source of Truth)                                                        │
    │  Location: .storybook/ssot.ts                                                                    │
    │                                                                                                  │
    │  Actions:                                                                                        │
    │  ├─ Add English strings: resources.en.common['<name>.title'] = '...'                           │
    │  │                       resources.en.common['<name>.description'] = '...'                     │
    │  │                       resources.en.common['<name>.placeholder'] = '...'                     │
    │  │                       resources.en.common['<name>.label'] = '...'                           │
    │  │                                                                                              │
    │  └─ Add Japanese strings: resources.ja.common['<name>.title'] = '...'                          │
    │                           resources.ja.common['<name>.description'] = '...'                    │
    │                           resources.ja.common['<name>.placeholder'] = '...'                    │
    │                           resources.ja.common['<name>.label'] = '...'                          │
    └──────────────────────────────────────────────────────────────────────────────────────────────────┘
           │
           │ i18n ready?
           ▼
    ╔═══════════════════════════════════════════════════════════════════════════════════════════════════╗
    ║                                    PHASE 5: STORY CREATION                                         ║
    ╚═══════════════════════════════════════════════════════════════════════════════════════════════════╝

    ┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
    │  [7] CREATE STORY FILE                                                                           │
    │  Location: .storybook/stories/components/<category>/<name>.stories.tsx                           │
    │                                                                                                  │
    │  Required Sections:                                                                              │
    │  ┌────────────────────────────────────────────────────────────────────────────────────────┐      │
    │  │ // IMPORTS                                                                             │      │
    │  │ import type { Meta, StoryObj } from '@storybook/react';                               │      │
    │  │ import { expect, fn, userEvent, within, waitFor } from 'storybook/test';              │      │
    │  │ import { seedFaker, resetFaker } from '@/.storybook/stories/_utils/faker-seed';       │      │
    │  │ import { createFake<Name> } from '@/.storybook/stories/_factories/<name>.factory';    │      │
    │  │ import { <name>Handlers, <name>StatusHandlers }                                       │      │
    │  │   from '@/.storybook/stories/_handlers/<name>.handlers';                              │      │
    │  │ import { createEventArgs, createHttpErrorStories }                                    │      │
    │  │   from '@/.storybook/stories/_utils/story-helpers';                                   │      │
    │  └────────────────────────────────────────────────────────────────────────────────────────┘      │
    │                                                                                                  │
    │  ┌────────────────────────────────────────────────────────────────────────────────────────┐      │
    │  │ // SEED FAKER AT FILE LEVEL                                                           │      │
    │  │ seedFaker();                                                                          │      │
    │  └────────────────────────────────────────────────────────────────────────────────────────┘      │
    │                                                                                                  │
    │  ┌────────────────────────────────────────────────────────────────────────────────────────┐      │
    │  │ // META DEFINITION                                                                    │      │
    │  │ const meta = {                                                                        │      │
    │  │   title: 'Components/<Category>/<Name>',                                             │      │
    │  │   component: <Name>,                                                                  │      │
    │  │   args: { /* default props + fn() event handlers */ },                               │      │
    │  │   parameters: { msw: { handlers: <name>Handlers }, a11y: {...} },                    │      │
    │  │   argTypes: { /* grouped by Content, Appearance, States, Events */ },                │      │
    │  │ } satisfies Meta<typeof <Name>>;                                                     │      │
    │  │ export default meta;                                                                  │      │
    │  │ type Story = StoryObj<typeof meta>;                                                  │      │
    │  └────────────────────────────────────────────────────────────────────────────────────────┘      │
    │                                                                                                  │
    │  Story Categories (in order):                                                                    │
    │  ├─ // ============ PLAYGROUND ============                                                     │
    │  │  export const Playground: Story = {};                                                        │
    │  │                                                                                              │
    │  ├─ // ============ VARIANTS & PRESENTATION ============                                        │
    │  │  export const Variants: Story = { ... };                                                     │
    │  │  export const Sizes: Story = { ... };                                                        │
    │  │  export const WithIcon: Story = { ... };                                                     │
    │  │                                                                                              │
    │  ├─ // ============ STATE VARIANTS ============                                                 │
    │  │  export const Disabled: Story = { ... };                                                     │
    │  │  export const LoadingState: Story = { ... };                                                 │
    │  │  export const ErrorState: Story = { ... };                                                   │
    │  │                                                                                              │
    │  ├─ // ============ COMPOSITION ============                                                    │
    │  │  export const WithOtherComponents: Story = { ... };                                          │
    │  │  export const AsChild: Story = { ... };                                                      │
    │  │                                                                                              │
    │  ├─ // ============ INTERACTIONS & ACCESSIBILITY ============                                   │
    │  │  export const KeyboardInteraction: Story = { play: async ({ canvasElement }) => {...} };    │
    │  │  export const Accessibility: Story = { play: async ({ canvasElement }) => {...} };          │
    │  │                                                                                              │
    │  ├─ // ============ PSEUDO STATES ============                                                  │
    │  │  export const PseudoStates: Story = { parameters: { pseudo: {...} } };                      │
    │  │                                                                                              │
    │  ├─ // ============ THEME VARIANTS ============                                                 │
    │  │  export const Dark: Story = { globals: { theme: 'dark' } };                                 │
    │  │  export const RTL: Story = { parameters: { direction: 'rtl' } };                            │
    │  │  export const Japanese: Story = { globals: { locale: 'ja' } };                              │
    │  │                                                                                              │
    │  ├─ // ============ MSW + FAKER STORIES ============                                            │
    │  │  export const WithMswHandlers: Story = { parameters: { msw: { handlers } } };               │
    │  │  export const HTTP400BadRequest: Story = createHttpErrorStories(statusHandlers, base).400;  │
    │  │  export const HTTP401Unauthorized: Story = ...                                               │
    │  │  export const HTTP500InternalServerError: Story = ...                                        │
    │  │  export const Loading: Story = { parameters: { msw: { handlers: statusHandlers.loading } } };│
    │  │  export const SlowResponse: Story = ...                                                      │
    │  │  export const NetworkError: Story = ...                                                      │
    │  │                                                                                              │
    │  └─ // ============ REFERENCE ============                                                      │
    │     export const DesignReference: Story = { parameters: { design: { type: 'figma', url } } };  │
    └──────────────────────────────────────────────────────────────────────────────────────────────────┘
           │
           │ Story file complete?
           ▼
    ╔═══════════════════════════════════════════════════════════════════════════════════════════════════╗
    ║                                   PHASE 6: VALIDATION                                              ║
    ╚═══════════════════════════════════════════════════════════════════════════════════════════════════╝

    ┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
    │  [8] RUN STORYBOOK & VALIDATE                                                                    │
    │                                                                                                  │
    │  Commands:                                                                                       │
    │  ├─ npm run storybook          # Start Storybook dev server                                     │
    │  ├─ npm run build-storybook    # Build static Storybook                                         │
    │  └─ npm run test-storybook     # Run play function tests                                        │
    │                                                                                                  │
    │  Validation Checklist:                                                                           │
    │  ├─ [ ] Component renders in Storybook                                                          │
    │  ├─ [ ] All variants display correctly                                                          │
    │  ├─ [ ] Controls panel works                                                                    │
    │  ├─ [ ] Actions panel logs events                                                               │
    │  ├─ [ ] MSW handlers mock API calls                                                             │
    │  ├─ [ ] i18n strings display (EN + JA)                                                          │
    │  ├─ [ ] Accessibility addon passes (no critical violations)                                     │
    │  ├─ [ ] Play functions pass (interaction tests)                                                 │
    │  ├─ [ ] Dark mode renders correctly                                                             │
    │  └─ [ ] RTL layout works (if applicable)                                                        │
    └──────────────────────────────────────────────────────────────────────────────────────────────────┘
           │
           │ All validations pass?
           ▼
    ┌──────────────┐
    │   COMPLETE   │
    │   (Done)     │
    └──────────────┘


    ════════════════════════════════════════════════════════════════════════════════════════════════════
                                          DEPENDENCY FLOW
    ════════════════════════════════════════════════════════════════════════════════════════════════════

                                      ┌─────────────────┐
                                      │  components/ui  │
                                      │   <name>.tsx    │
                                      └────────┬────────┘
                                               │
                         ┌─────────────────────┴─────────────────────┐
                         │                                           │
                         ▼                                           ▼
              ┌──────────────────┐                        ┌──────────────────┐
              │    _factories/   │                        │    _handlers/    │
              │ <name>.factory.ts│                        │ <name>.handlers.ts│
              └────────┬─────────┘                        └────────┬─────────┘
                       │                                           │
                       ▼                                           ▼
              ┌──────────────────┐                        ┌──────────────────┐
              │  _factories/     │                        │   _handlers/     │
              │    index.ts      │                        │    index.ts      │
              └────────┬─────────┘                        └────────┬─────────┘
                       │                                           │
                       │         ┌──────────────────┐              │
                       │         │     ssot.ts      │              │
                       │         │  (i18n strings)  │              │
                       │         └────────┬─────────┘              │
                       │                  │                        │
                       └──────────────────┼────────────────────────┘
                                          │
                                          ▼
                                ┌──────────────────┐
                                │    _utils/       │
                                │   index.ts       │
                                │ ├─ faker-seed    │
                                │ ├─ http-status   │
                                │ └─ story-helpers │
                                └────────┬─────────┘
                                         │
                                         ▼
                              ┌────────────────────┐
                              │  stories/components │
                              │ <name>.stories.tsx  │
                              └────────────────────┘


    ════════════════════════════════════════════════════════════════════════════════════════════════════
                                       FILE CREATION ORDER
    ════════════════════════════════════════════════════════════════════════════════════════════════════

    ┌─────┐     ┌─────┐     ┌─────┐     ┌─────┐     ┌─────┐     ┌─────┐     ┌─────┐     ┌─────┐
    │  1  │ ──▶ │  2  │ ──▶ │  3  │ ──▶ │  4  │ ──▶ │  5  │ ──▶ │  6  │ ──▶ │  7  │ ──▶ │  8  │
    └──┬──┘     └──┬──┘     └──┬──┘     └──┬──┘     └──┬──┘     └──┬──┘     └──┬──┘     └──┬──┘
       │          │          │          │          │          │          │          │
       ▼          ▼          ▼          ▼          ▼          ▼          ▼          ▼
    Component  Factory   Factory   Handlers  Handlers   ssot.ts   Story    Validate
      .tsx    .factory.ts index.ts .handlers.ts index.ts  (i18n)  .stories.tsx  ✓


    ════════════════════════════════════════════════════════════════════════════════════════════════════
                                      CRITICAL FILES SUMMARY
    ════════════════════════════════════════════════════════════════════════════════════════════════════

    ┌────────────────────────────────────────────────────────────────────────────────────────────────┐
    │  FILES TO CREATE (NEW)                                                                         │
    ├────────────────────────────────────────────────────────────────────────────────────────────────┤
    │  1. components/<category>/<name>.tsx               # The component itself                      │
    │  2. .storybook/stories/_factories/<name>.factory.ts # Fake data generators                    │
    │  3. .storybook/stories/_handlers/<name>.handlers.ts # MSW API mocks                           │
    │  4. .storybook/stories/components/<cat>/<name>.stories.tsx # Storybook stories                │
    └────────────────────────────────────────────────────────────────────────────────────────────────┘

    ┌────────────────────────────────────────────────────────────────────────────────────────────────┐
    │  FILES TO UPDATE (EXISTING)                                                                    │
    ├────────────────────────────────────────────────────────────────────────────────────────────────┤
    │  1. .storybook/stories/_factories/index.ts         # Export new factory                       │
    │  2. .storybook/stories/_handlers/index.ts          # Export new handlers + add to allHandlers │
    │  3. .storybook/ssot.ts                             # Add i18n strings (EN + JA)               │
    └────────────────────────────────────────────────────────────────────────────────────────────────┘


    ════════════════════════════════════════════════════════════════════════════════════════════════════
                                    STATE TRANSITION RULES
    ════════════════════════════════════════════════════════════════════════════════════════════════════

    State: IDLE
    ├─ Event: NEW_COMPONENT_REQUEST → State: CREATING_COMPONENT
    └─ Guard: component name is unique

    State: CREATING_COMPONENT
    ├─ Event: COMPONENT_CREATED → State: CREATING_FACTORY
    ├─ Guard: component exports correctly, has data-slot/data-testid
    └─ Rollback: delete component file

    State: CREATING_FACTORY
    ├─ Event: FACTORY_CREATED → State: UPDATING_FACTORY_INDEX
    ├─ Guard: factory exports types + create functions
    └─ Rollback: delete factory file

    State: UPDATING_FACTORY_INDEX
    ├─ Event: INDEX_UPDATED → State: CREATING_HANDLERS
    ├─ Guard: export statement added correctly
    └─ Rollback: revert index.ts

    State: CREATING_HANDLERS
    ├─ Event: HANDLERS_CREATED → State: UPDATING_HANDLERS_INDEX
    ├─ Guard: handlers export success + statusHandlers
    └─ Rollback: delete handlers file

    State: UPDATING_HANDLERS_INDEX
    ├─ Event: INDEX_UPDATED → State: UPDATING_SSOT
    ├─ Guard: allHandlers includes new handlers
    └─ Rollback: revert index.ts

    State: UPDATING_SSOT
    ├─ Event: I18N_ADDED → State: CREATING_STORY
    ├─ Guard: both EN + JA strings present
    └─ Rollback: revert ssot.ts

    State: CREATING_STORY
    ├─ Event: STORY_CREATED → State: VALIDATING
    ├─ Guard: story compiles, meta correct
    └─ Rollback: delete story file

    State: VALIDATING
    ├─ Event: ALL_CHECKS_PASS → State: COMPLETE
    ├─ Event: CHECK_FAILED → State: (previous state for fix)
    └─ Guard: storybook builds, tests pass, a11y passes

    State: COMPLETE
    └─ Final state, component fully integrated
```

## Quick Reference Checklist

```
[ ] 1. Create component file with:
    [ ] CVA variants
    [ ] ForwardRef
    [ ] data-slot attribute
    [ ] data-testid attribute
    [ ] Type exports

[ ] 2. Create factory file with:
    [ ] Type definitions
    [ ] Constants (VARIANTS, SIZES, etc.)
    [ ] Interface (Fake<Name>)
    [ ] createFake<Name>() function
    [ ] createFake<Names>() bulk function

[ ] 3. Update _factories/index.ts:
    [ ] Add export statement

[ ] 4. Create handlers file with:
    [ ] API endpoint constants
    [ ] Success handlers
    [ ] Status handlers object (all HTTP codes)
    [ ] Special handlers (loading, slow, error)

[ ] 5. Update _handlers/index.ts:
    [ ] Import handlers
    [ ] Add to allHandlers array
    [ ] Re-export handlers

[ ] 6. Update ssot.ts:
    [ ] English strings
    [ ] Japanese strings

[ ] 7. Create story file with:
    [ ] Imports (meta, test, factories, handlers, utils)
    [ ] seedFaker() call
    [ ] Meta definition
    [ ] Story categories (variants, states, a11y, themes, MSW)

[ ] 8. Validate:
    [ ] Storybook renders
    [ ] Controls work
    [ ] Actions log
    [ ] MSW mocks
    [ ] i18n displays
    [ ] a11y passes
    [ ] Play functions pass
```

---

# ENTERPRISE-GRADE IMPLEMENTATION DETAILS

## 📊 Project Statistics (Discovered via 12+ Agent Analysis)

```
┌─────────────────────────────────────────────────────────────────┐
│  CODEBASE METRICS                                               │
├─────────────────────────────────────────────────────────────────┤
│  UI Components:           58+ files in components/ui/           │
│  Custom Components:       2 major (minimal-tiptap, prompt)      │
│  Layout Components:       8 files (header/sidebar)              │
│  Theme Customizer:        9 files                               │
│  Factory Files:           33 in _factories/                     │
│  Handler Files:           31 in _handlers/                      │
│  Story Files:             120+ in stories/components/           │
│  i18n Keys:               524+ (EN + JA)                        │
│  Storybook Addons:        14 configured                         │
│  Theme Presets:           8 color themes                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔧 PHASE 1: COMPONENT CREATION - DETAILED TEMPLATE

### File: `components/ui/<name>.tsx`

```tsx
'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// ═══════════════════════════════════════════════════════════════
// VARIANTS DEFINITION (CVA Pattern)
// ═══════════════════════════════════════════════════════════════
const <name>Variants = cva(
  // Base classes (always applied)
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow-xs hover:bg-primary/90',
        secondary: 'bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80',
        destructive: 'bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/90',
        outline: 'border border-input bg-background shadow-xs hover:bg-accent hover:text-accent-foreground',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2 has-[>svg]:px-3',
        sm: 'h-8 rounded-md px-3 has-[>svg]:px-2.5',
        lg: 'h-10 rounded-md px-6 has-[>svg]:px-4',
        icon: 'size-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

// ═══════════════════════════════════════════════════════════════
// PROPS INTERFACE
// ═══════════════════════════════════════════════════════════════
export interface <Name>Props
  extends React.ComponentPropsWithoutRef<'div'>,
    VariantProps<typeof <name>Variants> {
  /** Optional: Enable asChild pattern for Radix UI */
  asChild?: boolean;
  /** Optional: Loading state */
  loading?: boolean;
  /** Optional: Disabled state */
  disabled?: boolean;
}

// ═══════════════════════════════════════════════════════════════
// COMPONENT DEFINITION
// ═══════════════════════════════════════════════════════════════
const <Name> = React.forwardRef<HTMLDivElement, <Name>Props>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      loading = false,
      disabled = false,
      children,
      ...props
    },
    ref
  ) => {
    // Use Slot for asChild pattern (requires @radix-ui/react-slot)
    const Comp = asChild ? Slot : 'div';

    return (
      <Comp
        ref={ref}
        data-slot="<name>"
        data-testid="<name>"
        data-loading={loading || undefined}
        data-disabled={disabled || undefined}
        aria-busy={loading || undefined}
        aria-disabled={disabled || undefined}
        className={cn(<name>Variants({ variant, size }), className)}
        {...props}
      >
        {loading && <Spinner className="size-4 animate-spin" />}
        {children}
      </Comp>
    );
  }
);
<Name>.displayName = '<Name>';

// ═══════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════
export { <Name>, <name>Variants };
```

### Required Attributes Checklist:

```
✅ data-slot="<name>"          → Required for component identification
✅ data-testid="<name>"        → Required for testing selectors
✅ aria-* attributes           → Required for accessibility
✅ data-loading/data-disabled  → Required for state styling
✅ React.forwardRef            → Required for ref forwarding
✅ displayName                 → Required for DevTools debugging
```

---

## 🏭 PHASE 2: FACTORY CREATION - DETAILED TEMPLATE

### File: `.storybook/stories/_factories/<name>.factory.ts`

```typescript
import { faker } from '@faker-js/faker';

// ═══════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════
export type <Name>Variant = 'default' | 'secondary' | 'destructive' | 'outline' | 'ghost' | 'link';
export type <Name>Size = 'default' | 'sm' | 'lg' | 'icon';
export type <Name>State = 'idle' | 'loading' | 'disabled' | 'error' | 'success';

// ═══════════════════════════════════════════════════════════════
// CONSTANTS (Used in Stories for Iteration)
// ═══════════════════════════════════════════════════════════════
export const <NAME>_VARIANTS: <Name>Variant[] = [
  'default',
  'secondary',
  'destructive',
  'outline',
  'ghost',
  'link',
];

export const <NAME>_SIZES: <Name>Size[] = ['default', 'sm', 'lg', 'icon'];

export const <NAME>_STATES: <Name>State[] = ['idle', 'loading', 'disabled', 'error', 'success'];

// ═══════════════════════════════════════════════════════════════
// INTERFACE (Shape of Generated Data)
// ═══════════════════════════════════════════════════════════════
export interface Fake<Name> {
  id: string;
  label: string;
  description?: string;
  variant: <Name>Variant;
  size: <Name>Size;
  state: <Name>State;
  disabled: boolean;
  loading: boolean;
  icon?: string;
  onClick?: () => void;
  createdAt: Date;
  metadata?: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════════════
// SINGLE ITEM FACTORY
// ═══════════════════════════════════════════════════════════════
export function createFake<Name>(overrides?: Partial<Fake<Name>>): Fake<Name> {
  const variant = faker.helpers.arrayElement(<NAME>_VARIANTS);
  const size = faker.helpers.arrayElement(<NAME>_SIZES);
  const state = faker.helpers.arrayElement(<NAME>_STATES);

  return {
    id: faker.string.uuid(),
    label: faker.lorem.words({ min: 1, max: 3 }),
    description: faker.datatype.boolean() ? faker.lorem.sentence() : undefined,
    variant,
    size,
    state,
    disabled: state === 'disabled',
    loading: state === 'loading',
    icon: faker.datatype.boolean() ? faker.helpers.arrayElement(['plus', 'check', 'x', 'edit']) : undefined,
    createdAt: faker.date.recent(),
    metadata: faker.datatype.boolean() ? { source: faker.word.noun() } : undefined,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════
// BULK FACTORY (For Lists/Tables)
// ═══════════════════════════════════════════════════════════════
export function createFake<Name>s(count: number, overrides?: Partial<Fake<Name>>): Fake<Name>[] {
  return Array.from({ length: count }, () => createFake<Name>(overrides));
}

// ═══════════════════════════════════════════════════════════════
// SPECIALIZED FACTORIES (For Specific Scenarios)
// ═══════════════════════════════════════════════════════════════
export function createFake<Name>Loading(): Fake<Name> {
  return createFake<Name>({ state: 'loading', loading: true });
}

export function createFake<Name>Disabled(): Fake<Name> {
  return createFake<Name>({ state: 'disabled', disabled: true });
}

export function createFake<Name>Error(): Fake<Name> {
  return createFake<Name>({ state: 'error' });
}

export function createFake<Name>WithAllVariants(): Fake<Name>[] {
  return <NAME>_VARIANTS.map((variant) => createFake<Name>({ variant }));
}

export function createFake<Name>WithAllSizes(): Fake<Name>[] {
  return <NAME>_SIZES.map((size) => createFake<Name>({ size }));
}
```

### Update: `.storybook/stories/_factories/index.ts`

```typescript
// ... existing exports ...

// <Name> factories
export * from './<name>.factory';
```

---

## 🌐 PHASE 3: HANDLER CREATION - DETAILED TEMPLATE

### File: `.storybook/stories/_handlers/<name>.handlers.ts`

```typescript
import { http, HttpResponse, delay } from 'msw';

// ═══════════════════════════════════════════════════════════════
// API ENDPOINT CONSTANTS
// ═══════════════════════════════════════════════════════════════
const API_<NAME>_LIST = '/api/<name>s';
const API_<NAME>_GET = '/api/<name>s/:id';
const API_<NAME>_CREATE = '/api/<name>s';
const API_<NAME>_UPDATE = '/api/<name>s/:id';
const API_<NAME>_DELETE = '/api/<name>s/:id';
const API_<NAME>_ACTION = '/api/<name>s/:id/action';

// ═══════════════════════════════════════════════════════════════
// SUCCESS HANDLERS (Default Happy Path)
// ═══════════════════════════════════════════════════════════════
export const <name>Handlers = [
  // LIST
  http.get(API_<NAME>_LIST, async () => {
    await delay(100);
    return HttpResponse.json({
      data: [
        { id: '1', name: 'Item 1', status: 'active' },
        { id: '2', name: 'Item 2', status: 'pending' },
      ],
      total: 2,
      page: 1,
      pageSize: 10,
    });
  }),

  // GET SINGLE
  http.get(API_<NAME>_GET, async ({ params }) => {
    await delay(100);
    return HttpResponse.json({
      id: params.id,
      name: `Item ${params.id}`,
      status: 'active',
      createdAt: new Date().toISOString(),
    });
  }),

  // CREATE
  http.post(API_<NAME>_CREATE, async ({ request }) => {
    const body = await request.json();
    await delay(200);
    return HttpResponse.json(
      { id: crypto.randomUUID(), ...body, createdAt: new Date().toISOString() },
      { status: 201 }
    );
  }),

  // UPDATE
  http.patch(API_<NAME>_UPDATE, async ({ params, request }) => {
    const body = await request.json();
    await delay(150);
    return HttpResponse.json({
      id: params.id,
      ...body,
      updatedAt: new Date().toISOString(),
    });
  }),

  // DELETE
  http.delete(API_<NAME>_DELETE, async () => {
    await delay(100);
    return new HttpResponse(null, { status: 204 });
  }),

  // CUSTOM ACTION
  http.post(API_<NAME>_ACTION, async () => {
    await delay(150);
    return HttpResponse.json({ success: true, message: 'Action completed' });
  }),
];

// ═══════════════════════════════════════════════════════════════
// STATUS HANDLERS (Error States + Edge Cases)
// ═══════════════════════════════════════════════════════════════
export const <name>StatusHandlers = {
  // ─────────────────────────────────────────────────────────────
  // SUCCESS (Default)
  // ─────────────────────────────────────────────────────────────
  success: <name>Handlers,

  // ─────────────────────────────────────────────────────────────
  // CLIENT ERRORS (4xx)
  // ─────────────────────────────────────────────────────────────
  badRequest: [
    http.all('*', () =>
      HttpResponse.json(
        { error: 'Bad Request', message: 'Invalid request parameters', code: 'INVALID_PARAMS' },
        { status: 400 }
      )
    ),
  ],

  unauthorized: [
    http.all('*', () =>
      HttpResponse.json(
        { error: 'Unauthorized', message: 'Authentication required', code: 'AUTH_REQUIRED' },
        { status: 401 }
      )
    ),
  ],

  forbidden: [
    http.all('*', () =>
      HttpResponse.json(
        { error: 'Forbidden', message: 'Insufficient permissions', code: 'PERMISSION_DENIED' },
        { status: 403 }
      )
    ),
  ],

  notFound: [
    http.all('*', () =>
      HttpResponse.json(
        { error: 'Not Found', message: 'Resource not found', code: 'NOT_FOUND' },
        { status: 404 }
      )
    ),
  ],

  conflict: [
    http.all('*', () =>
      HttpResponse.json(
        { error: 'Conflict', message: 'Resource already exists', code: 'DUPLICATE_ENTRY' },
        { status: 409 }
      )
    ),
  ],

  unprocessableEntity: [
    http.all('*', () =>
      HttpResponse.json(
        {
          error: 'Unprocessable Entity',
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: [{ field: 'name', message: 'Name is required' }],
        },
        { status: 422 }
      )
    ),
  ],

  tooManyRequests: [
    http.all('*', () =>
      HttpResponse.json(
        { error: 'Too Many Requests', message: 'Rate limit exceeded', code: 'RATE_LIMITED', retryAfter: 60 },
        { status: 429, headers: { 'Retry-After': '60' } }
      )
    ),
  ],

  // ─────────────────────────────────────────────────────────────
  // SERVER ERRORS (5xx)
  // ─────────────────────────────────────────────────────────────
  internalServerError: [
    http.all('*', () =>
      HttpResponse.json(
        { error: 'Internal Server Error', message: 'An unexpected error occurred', code: 'INTERNAL_ERROR' },
        { status: 500 }
      )
    ),
  ],

  badGateway: [
    http.all('*', () =>
      HttpResponse.json(
        { error: 'Bad Gateway', message: 'Upstream service unavailable', code: 'BAD_GATEWAY' },
        { status: 502 }
      )
    ),
  ],

  serviceUnavailable: [
    http.all('*', () =>
      HttpResponse.json(
        { error: 'Service Unavailable', message: 'Service temporarily unavailable', code: 'SERVICE_DOWN' },
        { status: 503, headers: { 'Retry-After': '300' } }
      )
    ),
  ],

  gatewayTimeout: [
    http.all('*', () =>
      HttpResponse.json(
        { error: 'Gateway Timeout', message: 'Request timed out', code: 'TIMEOUT' },
        { status: 504 }
      )
    ),
  ],

  // ─────────────────────────────────────────────────────────────
  // SPECIAL STATES
  // ─────────────────────────────────────────────────────────────
  loading: [
    http.all('*', async () => {
      await delay('infinite'); // Never resolves - shows loading state forever
      return HttpResponse.json({});
    }),
  ],

  slowResponse: [
    http.all('*', async () => {
      await delay(5000); // 5 second delay
      return HttpResponse.json({ data: [], message: 'Slow response completed' });
    }),
  ],

  networkError: [
    http.all('*', () => {
      return HttpResponse.error(); // Simulates network failure
    }),
  ],

  emptyData: [
    http.get('*', () =>
      HttpResponse.json({ data: [], total: 0, page: 1, pageSize: 10 })
    ),
  ],

  partialData: [
    http.get('*', () =>
      HttpResponse.json({
        data: [{ id: '1', name: 'Only One Item' }],
        total: 1,
        page: 1,
        pageSize: 10,
      })
    ),
  ],
};
```

### Update: `.storybook/stories/_handlers/index.ts`

```typescript
// ... existing imports ...
import { <name>Handlers, <name>StatusHandlers } from './<name>.handlers';

// Combine all success handlers
export const allHandlers = [
  // ... existing handlers ...
  ...<name>Handlers,
];

// Re-export for story-level usage
export { <name>Handlers, <name>StatusHandlers };
```

---

## 🌍 PHASE 4: I18N SETUP - DETAILED TEMPLATE

### Update: `.storybook/ssot.ts`

```typescript
// ═══════════════════════════════════════════════════════════════
// ENGLISH STRINGS (Add in resources.en.common section)
// ═══════════════════════════════════════════════════════════════
'<name>.title': '<Name>',
'<name>.description': 'A versatile <name> component for user interactions.',
'<name>.label': '<Name> Label',
'<name>.placeholder': 'Enter <name>...',
'<name>.loading': 'Loading...',
'<name>.error': 'An error occurred',
'<name>.empty': 'No items found',
'<name>.action.submit': 'Submit',
'<name>.action.cancel': 'Cancel',
'<name>.action.confirm': 'Confirm',
'<name>.action.delete': 'Delete',
'<name>.validation.required': 'This field is required',
'<name>.validation.invalid': 'Invalid input',
'<name>.aria.label': '<Name> component',
'<name>.aria.description': 'Interactive <name> element',

// ═══════════════════════════════════════════════════════════════
// JAPANESE STRINGS (Add in resources.ja.common section)
// ═══════════════════════════════════════════════════════════════
'<name>.title': '<Name>',
'<name>.description': 'ユーザーインタラクション用の汎用<name>コンポーネント。',
'<name>.label': '<Name>ラベル',
'<name>.placeholder': '<name>を入力...',
'<name>.loading': '読み込み中...',
'<name>.error': 'エラーが発生しました',
'<name>.empty': 'アイテムが見つかりません',
'<name>.action.submit': '送信',
'<name>.action.cancel': 'キャンセル',
'<name>.action.confirm': '確認',
'<name>.action.delete': '削除',
'<name>.validation.required': 'この項目は必須です',
'<name>.validation.invalid': '無効な入力',
'<name>.aria.label': '<Name>コンポーネント',
'<name>.aria.description': 'インタラクティブな<name>要素',
```

---

## 📖 PHASE 5: STORY CREATION - COMPREHENSIVE TEMPLATE

### File: `.storybook/stories/components/<category>/<name>.stories.tsx`

```tsx
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within, waitFor } from 'storybook/test';
import { <Name> } from '@/components/ui/<name>';
import { seedFaker, resetFaker } from '@/.storybook/stories/_utils/faker-seed';
import {
  createFake<Name>,
  createFake<Name>s,
  createFake<Name>WithAllVariants,
  createFake<Name>WithAllSizes,
  <NAME>_VARIANTS,
  <NAME>_SIZES,
} from '@/.storybook/stories/_factories/<name>.factory';
import {
  <name>Handlers,
  <name>StatusHandlers,
} from '@/.storybook/stories/_handlers/<name>.handlers';
import {
  createEventArgs,
  createHttpErrorStories,
} from '@/.storybook/stories/_utils/story-helpers';
import { Icon } from '@/components/custom/icon';

// ═══════════════════════════════════════════════════════════════
// DETERMINISTIC FAKER SEED
// ═══════════════════════════════════════════════════════════════
seedFaker();

// ═══════════════════════════════════════════════════════════════
// META DEFINITION
// ═══════════════════════════════════════════════════════════════
const meta = {
  title: 'Components/<Category>/<Name>',
  component: <Name>,
  tags: ['autodocs'],

  // Default args with event handlers
  args: {
    children: 'Click me',
    variant: 'default',
    size: 'default',
    disabled: false,
    loading: false,
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
  },

  // Parameters for addons
  parameters: {
    layout: 'centered',
    msw: { handlers: <name>Handlers },
    a11y: {
      config: {
        rules: [
          { id: 'color-contrast', enabled: true },
          { id: 'button-name', enabled: true },
        ],
      },
    },
    docs: {
      description: {
        component: `
## <Name> Component

A versatile, accessible component built with CVA variants.

### Features
- 🎨 Multiple variants and sizes
- ♿ WCAG 2.1 AA compliant
- 🌙 Dark mode support
- 🌍 i18n ready (EN/JA)
- 🧪 Fully tested with play functions
        `,
      },
    },
  },

  // ArgTypes for Controls panel grouping
  argTypes: {
    // ─── Content ───
    children: {
      control: 'text',
      description: 'The content of the component',
      table: { category: 'Content' },
    },

    // ─── Appearance ───
    variant: {
      control: 'select',
      options: <NAME>_VARIANTS,
      description: 'Visual style variant',
      table: { category: 'Appearance' },
    },
    size: {
      control: 'select',
      options: <NAME>_SIZES,
      description: 'Size variant',
      table: { category: 'Appearance' },
    },

    // ─── States ───
    disabled: {
      control: 'boolean',
      description: 'Disable the component',
      table: { category: 'States' },
    },
    loading: {
      control: 'boolean',
      description: 'Show loading state',
      table: { category: 'States' },
    },

    // ─── Events ───
    onClick: {
      action: 'clicked',
      description: 'Click handler',
      table: { category: 'Events' },
    },
    onFocus: {
      action: 'focused',
      description: 'Focus handler',
      table: { category: 'Events' },
    },
    onBlur: {
      action: 'blurred',
      description: 'Blur handler',
      table: { category: 'Events' },
    },
  },
} satisfies Meta<typeof <Name>>;

export default meta;
type Story = StoryObj<typeof meta>;

// ═══════════════════════════════════════════════════════════════
// ============ PLAYGROUND ============
// ═══════════════════════════════════════════════════════════════
export const Playground: Story = {};

// ═══════════════════════════════════════════════════════════════
// ============ VARIANTS & PRESENTATION ============
// ═══════════════════════════════════════════════════════════════
export const AllVariants: Story = {
  name: 'All Variants',
  render: () => (
    <div className="flex flex-wrap gap-4">
      {<NAME>_VARIANTS.map((variant) => (
        <<Name> key={variant} variant={variant}>
          {variant}
        </<Name>>
      ))}
    </div>
  ),
};

export const AllSizes: Story = {
  name: 'All Sizes',
  render: () => (
    <div className="flex items-center gap-4">
      {<NAME>_SIZES.map((size) => (
        <<Name> key={size} size={size}>
          {size}
        </<Name>>
      ))}
    </div>
  ),
};

export const WithIcon: Story = {
  name: 'With Icon',
  render: () => (
    <div className="flex gap-4">
      <<Name>>
        <Icon name="plus" className="size-4" />
        Add Item
      </<Name>>
      <<Name> variant="destructive">
        <Icon name="trash" className="size-4" />
        Delete
      </<Name>>
    </div>
  ),
};

// ═══════════════════════════════════════════════════════════════
// ============ STATE VARIANTS ============
// ═══════════════════════════════════════════════════════════════
export const Disabled: Story = {
  args: {
    disabled: true,
    children: 'Disabled',
  },
};

export const Loading: Story = {
  args: {
    loading: true,
    children: 'Loading...',
  },
};

export const DisabledVariants: Story = {
  name: 'Disabled Variants',
  render: () => (
    <div className="flex gap-4">
      {<NAME>_VARIANTS.map((variant) => (
        <<Name> key={variant} variant={variant} disabled>
          {variant}
        </<Name>>
      ))}
    </div>
  ),
};

// ═══════════════════════════════════════════════════════════════
// ============ COMPOSITION ============
// ═══════════════════════════════════════════════════════════════
export const Composition: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <<Name> variant="default">Primary</<Name>>
        <<Name> variant="secondary">Secondary</<Name>>
        <<Name> variant="outline">Cancel</<Name>>
      </div>
    </div>
  ),
};

// ═══════════════════════════════════════════════════════════════
// ============ INTERACTIONS & ACCESSIBILITY ============
// ═══════════════════════════════════════════════════════════════
export const KeyboardNavigation: Story = {
  name: 'Keyboard Navigation',
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const component = canvas.getByTestId('<name>');

    // Tab to focus
    await userEvent.tab();
    await expect(component).toHaveFocus();

    // Enter to activate
    await userEvent.keyboard('{Enter}');
    await expect(args.onClick).toHaveBeenCalledTimes(1);

    // Space to activate
    await userEvent.keyboard(' ');
    await expect(args.onClick).toHaveBeenCalledTimes(2);
  },
};

export const ClickInteraction: Story = {
  name: 'Click Interaction',
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const component = canvas.getByTestId('<name>');

    await userEvent.click(component);
    await expect(args.onClick).toHaveBeenCalled();
  },
};

export const AccessibilityTest: Story = {
  name: 'Accessibility',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const component = canvas.getByTestId('<name>');

    // Check ARIA attributes
    await expect(component).toHaveAttribute('data-slot', '<name>');

    // Check focusability
    await userEvent.tab();
    await expect(component).toHaveFocus();
  },
};

// ═══════════════════════════════════════════════════════════════
// ============ PSEUDO STATES ============
// ═══════════════════════════════════════════════════════════════
export const PseudoHover: Story = {
  name: 'Hover State',
  parameters: {
    pseudo: { hover: true },
  },
};

export const PseudoFocus: Story = {
  name: 'Focus State',
  parameters: {
    pseudo: { focus: true, focusVisible: true },
  },
};

export const PseudoActive: Story = {
  name: 'Active State',
  parameters: {
    pseudo: { active: true },
  },
};

// ═══════════════════════════════════════════════════════════════
// ============ THEME VARIANTS ============
// ═══════════════════════════════════════════════════════════════
export const DarkMode: Story = {
  name: 'Dark Mode',
  globals: {
    theme: 'dark',
  },
};

export const LightMode: Story = {
  name: 'Light Mode',
  globals: {
    theme: 'light',
  },
};

export const Japanese: Story = {
  name: 'Japanese Locale',
  globals: {
    locale: 'ja',
  },
  args: {
    children: '送信',
  },
};

export const RTL: Story = {
  name: 'Right-to-Left',
  parameters: {
    direction: 'rtl',
  },
  decorators: [
    (Story) => (
      <div dir="rtl">
        <Story />
      </div>
    ),
  ],
};

// ═══════════════════════════════════════════════════════════════
// ============ MSW + FAKER STORIES ============
// ═══════════════════════════════════════════════════════════════
export const WithFakerData: Story = {
  name: 'With Faker Data',
  render: () => {
    const items = createFake<Name>s(5);
    return (
      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <<Name> key={item.id} variant={item.variant} size={item.size} disabled={item.disabled}>
            {item.label}
          </<Name>>
        ))}
      </div>
    );
  },
};

export const WithMswSuccess: Story = {
  name: 'MSW Success',
  parameters: {
    msw: { handlers: <name>StatusHandlers.success },
  },
};

// ─── HTTP Error Stories ───
export const HTTP400BadRequest: Story = {
  name: 'HTTP 400 Bad Request',
  parameters: {
    msw: { handlers: <name>StatusHandlers.badRequest },
  },
};

export const HTTP401Unauthorized: Story = {
  name: 'HTTP 401 Unauthorized',
  parameters: {
    msw: { handlers: <name>StatusHandlers.unauthorized },
  },
};

export const HTTP403Forbidden: Story = {
  name: 'HTTP 403 Forbidden',
  parameters: {
    msw: { handlers: <name>StatusHandlers.forbidden },
  },
};

export const HTTP404NotFound: Story = {
  name: 'HTTP 404 Not Found',
  parameters: {
    msw: { handlers: <name>StatusHandlers.notFound },
  },
};

export const HTTP429TooManyRequests: Story = {
  name: 'HTTP 429 Too Many Requests',
  parameters: {
    msw: { handlers: <name>StatusHandlers.tooManyRequests },
  },
};

export const HTTP500InternalServerError: Story = {
  name: 'HTTP 500 Internal Server Error',
  parameters: {
    msw: { handlers: <name>StatusHandlers.internalServerError },
  },
};

export const HTTP502BadGateway: Story = {
  name: 'HTTP 502 Bad Gateway',
  parameters: {
    msw: { handlers: <name>StatusHandlers.badGateway },
  },
};

export const HTTP503ServiceUnavailable: Story = {
  name: 'HTTP 503 Service Unavailable',
  parameters: {
    msw: { handlers: <name>StatusHandlers.serviceUnavailable },
  },
};

export const HTTP504GatewayTimeout: Story = {
  name: 'HTTP 504 Gateway Timeout',
  parameters: {
    msw: { handlers: <name>StatusHandlers.gatewayTimeout },
  },
};

// ─── Special States ───
export const LoadingState: Story = {
  name: 'MSW Loading (Infinite)',
  parameters: {
    msw: { handlers: <name>StatusHandlers.loading },
  },
};

export const SlowResponse: Story = {
  name: 'MSW Slow Response (5s)',
  parameters: {
    msw: { handlers: <name>StatusHandlers.slowResponse },
  },
};

export const NetworkError: Story = {
  name: 'MSW Network Error',
  parameters: {
    msw: { handlers: <name>StatusHandlers.networkError },
  },
};

export const EmptyData: Story = {
  name: 'MSW Empty Data',
  parameters: {
    msw: { handlers: <name>StatusHandlers.emptyData },
  },
};

// ═══════════════════════════════════════════════════════════════
// ============ REFERENCE ============
// ═══════════════════════════════════════════════════════════════
export const DesignReference: Story = {
  name: 'Design Reference',
  parameters: {
    design: {
      type: 'figma',
      url: 'https://www.figma.com/file/xxx/<name>-design',
    },
  },
};
```

---

## ✅ PHASE 6: VALIDATION - COMPREHENSIVE CHECKLIST

### Validation Commands

```bash
# Start Storybook dev server
npm run storybook

# Build static Storybook (catches build errors)
npm run build-storybook

# Run play function tests
npm run test-storybook

# Run accessibility tests specifically
npm run test-storybook -- --url http://localhost:6006 --coverage

# Type check
npx tsc --noEmit

# Lint check
npm run lint
```

### Validation Checklist

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  VALIDATION PHASE CHECKLIST                                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  🎨 RENDERING                                                               │
│  [ ] Component renders without errors                                       │
│  [ ] All variants display correctly                                         │
│  [ ] All sizes render appropriately                                         │
│  [ ] Loading state shows spinner                                            │
│  [ ] Disabled state is visually distinct                                    │
│                                                                             │
│  🎛️ CONTROLS                                                                │
│  [ ] All props appear in Controls panel                                     │
│  [ ] Controls are grouped correctly (Content, Appearance, States, Events)  │
│  [ ] Changing controls updates component                                    │
│  [ ] Default values are correct                                             │
│                                                                             │
│  📋 ACTIONS                                                                 │
│  [ ] onClick logs in Actions panel                                          │
│  [ ] onFocus logs in Actions panel                                          │
│  [ ] onBlur logs in Actions panel                                           │
│  [ ] All event handlers are logged                                          │
│                                                                             │
│  🌐 MSW HANDLERS                                                            │
│  [ ] Success handlers return expected data                                  │
│  [ ] Error handlers show appropriate error states                           │
│  [ ] Loading handler keeps component in loading state                       │
│  [ ] Network error is handled gracefully                                    │
│                                                                             │
│  🌍 I18N                                                                    │
│  [ ] English strings display correctly                                      │
│  [ ] Japanese strings display correctly (switch locale)                     │
│  [ ] All translation keys resolve (no missing key warnings)                 │
│                                                                             │
│  ♿ ACCESSIBILITY                                                            │
│  [ ] No critical a11y violations in addon                                   │
│  [ ] Keyboard navigation works (Tab, Enter, Space)                          │
│  [ ] Focus indicator is visible                                             │
│  [ ] ARIA attributes are correct                                            │
│  [ ] Screen reader announces component correctly                            │
│                                                                             │
│  🧪 PLAY FUNCTIONS                                                          │
│  [ ] All play functions pass                                                │
│  [ ] Interaction tests work correctly                                       │
│  [ ] Assertions validate expected behavior                                  │
│  [ ] No timeout errors                                                      │
│                                                                             │
│  🌙 THEME                                                                   │
│  [ ] Light mode renders correctly                                           │
│  [ ] Dark mode renders correctly                                            │
│  [ ] All theme presets work                                                 │
│  [ ] CSS variables are applied                                              │
│                                                                             │
│  📐 PSEUDO STATES                                                           │
│  [ ] Hover state is visible                                                 │
│  [ ] Focus state is visible                                                 │
│  [ ] Active state is visible                                                │
│                                                                             │
│  🔄 RTL                                                                     │
│  [ ] RTL layout renders correctly (if applicable)                           │
│  [ ] Text direction is correct                                              │
│                                                                             │
│  📦 BUILD                                                                   │
│  [ ] npm run build-storybook succeeds                                       │
│  [ ] No TypeScript errors                                                   │
│  [ ] No lint errors                                                         │
│  [ ] No console warnings/errors                                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🎯 ADDITIONAL ENTERPRISE PATTERNS

### Theme Presets (8 Available)

```typescript
// Available in theme customizer
const THEME_PRESETS = [
  'default', // Default shadcn theme
  'blue', // Blue accent
  'green', // Green accent
  'rose', // Rose/Pink accent
  'orange', // Orange accent
  'purple', // Purple accent
  'yellow', // Yellow accent
  'neutral', // Neutral/Gray accent
];
```

### Storybook Addons (14 Configured)

```
1. @storybook/addon-essentials    → Controls, Actions, Docs
2. @storybook/addon-a11y          → Accessibility testing
3. @storybook/addon-themes        → Theme switching
4. @storybook/addon-storysource   → View story source
5. msw-storybook-addon            → MSW integration
6. storybook-addon-pseudo-states  → Pseudo state testing
7. storybook-react-i18next        → i18n integration
8. @storybook/addon-designs       → Figma integration
9. @storybook/addon-coverage      → Test coverage
10. @storybook/addon-interactions → Interaction testing
11. @chromatic-com/storybook      → Visual regression
12. storybook-addon-nuqs          → URL state
13. @storybook/addon-console      → Console to Actions
14. @storybook/test-runner        → Test execution
```

### Utility Functions Available

```typescript
// .storybook/stories/_utils/story-helpers.ts
export function createEventArgs(
  ...events: string[]
): Record<string, () => void>;
export function createHttpErrorStories(
  statusHandlers,
  baseStory
): Record<string, Story>;
export function waitForElement(
  selector: string,
  options?: WaitOptions
): Promise<Element>;

// .storybook/stories/_utils/faker-seed.ts
export function seedFaker(seed?: number): void;
export function resetFaker(): void;
```

### Test Runner Configuration

```typescript
// .storybook/test-runner.ts
// Modes: 'baseline' | 'strict' | 'collect'
// - baseline: Standard a11y testing
// - strict: Fail on any violation
// - collect: Collect violations without failing
```

---

## 🔗 FILE PATH REFERENCE

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  COMPLETE FILE PATH REFERENCE                                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  📁 COMPONENT FILES                                                         │
│  ├── components/ui/<name>.tsx                    # Standard UI components   │
│  ├── components/ui/custom/<name>/                # Complex custom components│
│  ├── components/layout/header/                   # Header components        │
│  ├── components/layout/sidebar/                  # Sidebar components       │
│  └── components/theme-customizer/                # Theme customizer         │
│                                                                             │
│  📁 STORYBOOK FILES                                                         │
│  ├── .storybook/main.ts                          # Main config (14 addons)  │
│  ├── .storybook/preview.tsx                      # Preview config           │
│  ├── .storybook/preview-head.html                # Head injection           │
│  ├── .storybook/manager.ts                       # Manager UI config        │
│  ├── .storybook/test-runner.ts                   # Test runner config       │
│  └── .storybook/ssot.ts                          # i18n + global config     │
│                                                                             │
│  📁 STORY INFRASTRUCTURE                                                    │
│  ├── .storybook/stories/_factories/              # 33 factory files         │
│  │   ├── index.ts                                # Barrel export            │
│  │   └── <name>.factory.ts                       # Per-component factory    │
│  ├── .storybook/stories/_handlers/               # 31 handler files         │
│  │   ├── index.ts                                # Barrel + allHandlers     │
│  │   └── <name>.handlers.ts                      # Per-component handlers   │
│  ├── .storybook/stories/_utils/                  # Utility helpers          │
│  │   ├── index.ts                                # Barrel export            │
│  │   ├── faker-seed.ts                           # Deterministic faker      │
│  │   └── story-helpers.ts                        # Story utilities          │
│  └── .storybook/stories/_components/             # Shared story components  │
│                                                                             │
│  📁 STORY FILES                                                             │
│  ├── .storybook/stories/components/ui/           # UI component stories     │
│  ├── .storybook/stories/components/custom/       # Custom component stories │
│  ├── .storybook/stories/components/layout/       # Layout component stories │
│  ├── .storybook/stories/components/theme-customizer/                        │
│  ├── .storybook/stories/documentation/           # Doc stories              │
│  └── .storybook/stories/foundations/             # Foundation stories       │
│                                                                             │
│  📁 LIB FILES                                                               │
│  ├── lib/utils.ts                                # cn() and utilities       │
│  ├── lib/themes.ts                               # Theme configuration      │
│  ├── lib/env.ts                                  # Environment config       │
│  └── lib/analytics.ts                            # Analytics setup          │
│                                                                             │
│  📁 HOOKS                                                                   │
│  └── .storybook/stories/hooks/                   # Hook stories             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🚀 QUICK START COMMAND

```bash
# Create a new component with all infrastructure
# Replace <name> with your component name (e.g., "card", "tooltip")

COMPONENT_NAME="mycomponent"

# 1. Create component file
touch components/ui/${COMPONENT_NAME}.tsx

# 2. Create factory
touch .storybook/stories/_factories/${COMPONENT_NAME}.factory.ts

# 3. Create handlers
touch .storybook/stories/_handlers/${COMPONENT_NAME}.handlers.ts

# 4. Create story
mkdir -p .storybook/stories/components/ui
touch .storybook/stories/components/ui/${COMPONENT_NAME}.stories.tsx

# 5. Update indexes (manual step required)
# - Add export to _factories/index.ts
# - Add export + allHandlers to _handlers/index.ts
# - Add i18n strings to ssot.ts

# 6. Start Storybook
npm run storybook
```

---

---

# ULTRA MAX UI-KIT LIFECYCLE INTEGRATION

## 🔴 CRITICAL: ADDON ENRICHMENT POLICY (HARD REQUIREMENTS)

Every component Unit MUST explicitly report each addon status:

- ✅ **done** - Fully implemented and verified
- 🚫 **n/a** - Not applicable with documented proof
- ⚠️ **suppressed** - Justified suppression with ledger note

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ADDON MATRIX TEMPLATE (MANDATORY FOR EVERY UNIT)                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  📊 CONTROLS (args/argTypes)                                                │
│  ├─ MUST expose meaningful control surface                                  │
│  ├─ args: defaults for ALL user-facing props                               │
│  ├─ argTypes: booleans, enums, sizes/variants (select/inline-radio)        │
│  ├─ callbacks: MUST NOT be controllable (wire via Actions)                 │
│  ├─ complex props: control: false + documented in table                    │
│  └─ MUST be deterministic (no random, no Date.now, no unstable IDs)        │
│                                                                             │
│  📋 ACTIONS (public events)                                                 │
│  ├─ MUST wire ALL public event callbacks                                   │
│  ├─ onClick, onChange, onOpenChange → Actions panel                        │
│  ├─ Use fn() spies for play function assertions                            │
│  └─ Actions ≠ Interactions (Actions = observability, Interactions = tests) │
│                                                                             │
│  🎭 INTERACTIONS (play functions)                                           │
│  ├─ REQUIRED for components with: internal state, keyboard, focus, events  │
│  ├─ Use @storybook/test patterns + role-based queries                      │
│  ├─ Include keyboard paths: Tab/Enter/Escape/arrows                        │
│  ├─ Assert observable outcomes                                             │
│  ├─ Use step() for better reporting                                        │
│  └─ MUST be deterministic (freeze time when needed)                        │
│                                                                             │
│  ♿ ACCESSIBILITY (a11y addon)                                               │
│  ├─ MUST have at least one "a11y representative" story                     │
│  ├─ Do NOT disable a11y globally                                           │
│  ├─ Suppressions: minimal (rule-level), documented, logged                 │
│  └─ Improvements: ONLY non-visual (aria-*, role, id/for)                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔒 NON-NEGOTIABLE HARD INVARIANTS

### A) REACT-ONLY STATE (NO ZUSTAND)

```typescript
// ✅ ALLOWED
(useState,
  useReducer,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  useId,
  useContext);

// ❌ FORBIDDEN
import { useStore } from 'zustand'; // NEVER
```

### B) TAILWIND / UI MUST NOT CHANGE

```
❌ Do NOT change any className strings
❌ Do NOT add/remove/reorder Tailwind utilities
❌ Do NOT restructure/wrap/reorder DOM
❌ Do NOT prettify/reformat files
✅ ONLY add non-visual attributes (aria-*, data-*, id)
```

### C) NO HALLUCINATION / NO GUESSING

```
❌ Never invent endpoints, response shapes, providers, env vars
❌ Never implement what you haven't verified by reading files
✅ Mark UNKNOWN and implement defensively
```

### D) NEXT/SSR/RSC SAFETY

```typescript
// ❌ FORBIDDEN in render
window.localStorage;
document.querySelector;
navigator.userAgent;

// ✅ Gate in useEffect
useEffect(() => {
  if (typeof window !== 'undefined') {
    // safe to use browser APIs
  }
}, []);

// ✅ Use useId for stable IDs
const id = useId(); // NOT: Math.random() or nanoid()
```

### E) ESLINT-FIRST

```
✅ Read eslint.config.mjs BEFORE editing
✅ Respect import order, module boundaries, hook rules
✅ Fix violations immediately
```

### F) NO NEW DEPENDENCIES

### G) STORIES LOCATION FIXED: `.storybook/stories/**` ONLY

---

## ✅ WHAT "DONE" MEANS (A UNIT)

A Unit = Component + Stories + Fixtures + Tests

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  UNIT COMPLETION CHECKLIST (ALL MUST BE TRUE)                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1️⃣ HARD INVARIANTS SATISFIED                                               │
│     [ ] React-only state (no Zustand)                                       │
│     [ ] Tailwind locked (no style changes)                                  │
│     [ ] SSR safe (no window/document in render)                             │
│     [ ] ESLint clean                                                        │
│                                                                             │
│  2️⃣ COMPONENT IS PRODUCTION-GRADE                                           │
│     [ ] Defensive rendering for null/undefined/partial data                 │
│     [ ] Deterministic behavior under rapid interactions/unmounts            │
│     [ ] Safe a11y improvements only (non-visual)                            │
│     [ ] Async safety (abort + stale guard + retry + no setState after unmount)│
│                                                                             │
│  3️⃣ VARIANT MATRIX COMPLETE                                                 │
│     [ ] Every meaningful state/branch/variant listed                        │
│     [ ] Every listed variant has story coverage                             │
│                                                                             │
│  4️⃣ ADDON MATRIX COMPLETE                                                   │
│     [ ] Controls: intentional argTypes/args (or n/a with proof)            │
│     [ ] Actions: wired for public events (or n/a with proof)               │
│     [ ] Interactions: play story for interactive components (or n/a)       │
│     [ ] A11y: representative story + no global disables                    │
│                                                                             │
│  5️⃣ I18N COVERAGE (when component renders text)                             │
│     [ ] Default locale story                                                │
│     [ ] Non-default locale story (Japanese)                                 │
│     [ ] RTL story (if RTL setup exists AND component is direction-sensitive)│
│                                                                             │
│  6️⃣ DETERMINISM (CHROMATIC-SAFE)                                            │
│     [ ] No randomness (Faker seeded)                                        │
│     [ ] Time frozen when needed                                             │
│     [ ] Async stable                                                        │
│     [ ] No animation flake                                                  │
│                                                                             │
│  7️⃣ TESTS + COVERAGE (when logic changed)                                   │
│     [ ] Vitest+RTL tests cover meaningful branches                          │
│     [ ] 100% branch coverage for touched modules                            │
│                                                                             │
│  8️⃣ REPO HEALTH                                                             │
│     [ ] No circular deps (madge)                                            │
│     [ ] No unused exports (knip)                                            │
│     [ ] Storybook scripts pass                                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 COMPONENT-FIRST WORKFLOW (CRITICAL ORDER)

```
┌─────┐     ┌─────┐     ┌─────┐     ┌─────┐
│  1  │ ──▶ │  2  │ ──▶ │  3  │ ──▶ │  4  │
└──┬──┘     └──┬──┘     └──┬──┘     └──┬──┘
   │          │          │          │
   ▼          ▼          ▼          ▼
 DISCOVER   READ       IMPLEMENT   ALIGN
 stories    component  component   stories
 +neighbors +imports   FIRST       to match
```

**ORDER IS NON-NEGOTIABLE:**

1. Read stories + neighbors (discovery only)
2. Read component + full local import graph
3. **IMPLEMENT/UPGRADE COMPONENT FIRST** until Variant Matrix stable
4. **ONLY AFTER** component is stable: align/upgrade stories

---

## 📊 TIERING SYSTEM (LLM DECIDES BASED ON CODE)

### Tier A: Presentational

```typescript
// Defensive rendering, safe a11y attrs, avoid unnecessary memo
const MyComponent = ({ title, items }: Props) => {
  if (!items?.length) return <Empty />;
  return <div>{items.map(...)}</div>;
};
```

### Tier B: Local UI State / Input Behavior

```typescript
// useState for simple; useReducer for multi-transition
const [isOpen, setIsOpen] = useState(false);

// Keyboard/focus correctness
onKeyDown={(e) => {
  if (e.key === 'Escape') setIsOpen(false);
  if (e.key === 'Enter') handleSubmit();
}}
```

### Tier C: Async Inside Component (ONLY if async exists)

```typescript
type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'refreshing'; data: T }
  | { status: 'success'; data: T }
  | { status: 'empty' }
  | { status: 'error'; error: NormalizedError };

// AbortController + requestId stale-guard
const abortRef = useRef<AbortController>();
const requestIdRef = useRef(0);

// Never setState after unmount
useEffect(() => {
  let mounted = true;
  // ... async work
  if (mounted) setState(...);
  return () => { mounted = false; };
}, []);
```

### Tier D: TRUE FORMS ONLY (MANDATORY ZOD + RHF)

```typescript
// ONLY for real form workflows
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(1, 'Required'),
  email: z.string().email('Invalid email'),
});

type FormData = z.infer<typeof schema>;

const {
  register,
  handleSubmit,
  formState: { errors },
} = useForm<FormData>({
  resolver: zodResolver(schema),
});
```

---

## 🎯 DETERMINISM POLICY (CHROMATIC-SAFE)

### ❌ FORBIDDEN (unless controlled/seeded/frozen/injected)

```typescript
Math.random(); // → Use seeded Faker
Date.now(); // → Freeze with mock-date addon
nanoid(); // → Use useId() or stable IDs
uuid(); // → Inject stable IDs
new Date(); // → Freeze time in stories
```

### ✅ FAKER SEEDING PATTERN

```typescript
// At file level - MANDATORY
import { faker } from '@faker-js/faker';
faker.seed(12345); // Deterministic seed

// Or use project utility
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
seedFaker(); // Uses consistent seed
```

### ✅ TIME FREEZING (when time affects output)

```typescript
// Use verified mock-date addon patterns
export const TimeSensitive: Story = {
  parameters: {
    date: new Date('2024-01-15T10:00:00Z'),
  },
};
```

---

## 📖 MANDATORY FULL-READ BEFORE EDIT

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  MUST READ BEFORE EDITING ANY FILE IN A UNIT                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ⬜ .storybook/main.ts                                                      │
│  ⬜ .storybook/preview.tsx                                                  │
│  ⬜ .storybook/ssot.ts                                                      │
│  ⬜ Unit's story file                                                       │
│  ⬜ 2-3 neighbor stories (same folder pattern)                              │
│  ⬜ Unit's component file(s)                                                │
│  ⬜ ALL local imports recursively until leaf modules                        │
│  ⬜ Any barrels (index.ts/tsx) and follow exports                           │
│                                                                             │
│  ⚠️ UNREAD FILE = UNKNOWN → implement defensively                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## ✅ VALIDATION GATES (MUST RUN, MUST REPORT HONESTLY)

### After Each Batch:

```bash
npm run typecheck              # TypeScript check
npm run lint:strict            # ESLint strict
npm run test:run               # If logic/state/validation changed
npm run test:coverage          # When branches touched
npm run storybook:quality      # Story quality
npm run storybook:gaps         # Coverage gaps
```

### For "Batch DONE / Merge-Ready":

```bash
npm run storybook:test         # All story tests
npm run storybook:test:a11y    # Accessibility tests
npm run storybook:audit        # Full audit
npm run storybook:deep-gaps    # Deep gap analysis
npm run madge                  # Circular deps check
npm run knip                   # Unused exports check
```

**NEVER claim PASS unless you actually ran it. Report: PASS | FAIL | NOT RUN**

---

## 📋 ADDON MATRIX TEMPLATE (USE IN ALL RESPONSES)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ADDON MATRIX: <ComponentName>                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Controls:     ✅ done | 🚫 n/a (proof) | ⚠️ suppressed (why)               │
│  Actions:      ✅ done | 🚫 n/a (proof) | ⚠️ suppressed (why)               │
│  Interactions: ✅ done | 🚫 n/a (proof) | ⚠️ suppressed (why)               │
│  A11y:         ✅ done | 🚫 n/a (proof) | ⚠️ suppressed (why)               │
│                                                                             │
│  Story Files:                                                               │
│  - <name>.stories.tsx (Controls ✅, Actions ✅, Interactions ✅, A11y ✅)    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📊 VARIANT MATRIX TEMPLATE

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  VARIANT MATRIX: <ComponentName>                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  VARIANTS                    STORY COVERAGE                                 │
│  ─────────────────────────   ─────────────────────────────────────────      │
│  variant="default"           ✅ AllVariants, Playground                     │
│  variant="secondary"         ✅ AllVariants                                 │
│  variant="destructive"       ✅ AllVariants                                 │
│  variant="outline"           ✅ AllVariants                                 │
│  variant="ghost"             ✅ AllVariants                                 │
│  variant="link"              ✅ AllVariants                                 │
│                                                                             │
│  SIZES                       STORY COVERAGE                                 │
│  ─────────────────────────   ─────────────────────────────────────────      │
│  size="default"              ✅ AllSizes, Playground                        │
│  size="sm"                   ✅ AllSizes                                    │
│  size="lg"                   ✅ AllSizes                                    │
│  size="icon"                 ✅ AllSizes                                    │
│                                                                             │
│  STATES                      STORY COVERAGE                                 │
│  ─────────────────────────   ─────────────────────────────────────────      │
│  disabled={true}             ✅ Disabled, DisabledVariants                  │
│  loading={true}              ✅ Loading, LoadingState                       │
│  hover                       ✅ PseudoHover                                 │
│  focus                       ✅ PseudoFocus                                 │
│  active                      ✅ PseudoActive                                │
│                                                                             │
│  THEMES                      STORY COVERAGE                                 │
│  ─────────────────────────   ─────────────────────────────────────────      │
│  light mode                  ✅ LightMode                                   │
│  dark mode                   ✅ DarkMode                                    │
│  Japanese locale             ✅ Japanese                                    │
│  RTL direction               ✅ RTL                                         │
│                                                                             │
│  MSW STATES                  STORY COVERAGE                                 │
│  ─────────────────────────   ─────────────────────────────────────────      │
│  success                     ✅ WithMswSuccess                              │
│  HTTP 400                    ✅ HTTP400BadRequest                           │
│  HTTP 401                    ✅ HTTP401Unauthorized                         │
│  HTTP 403                    ✅ HTTP403Forbidden                            │
│  HTTP 404                    ✅ HTTP404NotFound                             │
│  HTTP 429                    ✅ HTTP429TooManyRequests                      │
│  HTTP 500                    ✅ HTTP500InternalServerError                  │
│  HTTP 502                    ✅ HTTP502BadGateway                           │
│  HTTP 503                    ✅ HTTP503ServiceUnavailable                   │
│  HTTP 504                    ✅ HTTP504GatewayTimeout                       │
│  loading (infinite)          ✅ LoadingState                                │
│  slow (5s)                   ✅ SlowResponse                                │
│  network error               ✅ NetworkError                                │
│  empty data                  ✅ EmptyData                                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 LIFECYCLE WORKFLOW

```
    ════════════════════════════════════════════════════════════════════════════
                              ITERATIVE LIFECYCLE
    ════════════════════════════════════════════════════════════════════════════

    ┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
    │  INVENTORY  │ ──▶ │    PLAN     │ ──▶ │  IMPLEMENT  │ ──▶ │   ALIGN     │
    │             │     │             │     │ (Component  │     │  (Stories)  │
    │ tree, rg,   │     │ Variant +   │     │   FIRST)    │     │             │
    │ scripts     │     │ Addon Matrix│     │             │     │             │
    └─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
           │                   │                   │                   │
           └───────────────────┴───────────────────┴───────────────────┘
                                         │
                                         ▼
                               ┌─────────────────┐
                               │    VALIDATE     │
                               │                 │
                               │ Gates + Report  │
                               └─────────────────┘
```

---

## 📁 USER COMMANDS (LOOP)

```bash
START INVENTORY              # Begin inventory phase
NEXT BATCH (N)               # Process next N units
DO UNIT <path>               # Process specific unit
RECHECK GATES                # Re-run validation gates
```

---

## 🚨 MSW V2 RULES (ONLY WHEN NEEDED)

```typescript
// ✅ Correct MSW v2 imports
import { http, HttpResponse, delay } from 'msw';

// ✅ Handler pattern
http.get('/api/items', async () => {
  await delay(100);
  return HttpResponse.json({ data: [...] });
});

// ❌ Never invent endpoints - derive from code or existing mocks
// ❌ Never use MSW v1 patterns
```

---

## 🌍 I18N RULES (MUST SUPPORT INJECTION)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  I18N COVERAGE REQUIREMENTS (when component renders text)                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  REQUIRED:                                                                  │
│  ✅ Default locale story (English)                                         │
│  ✅ Non-default locale story (Japanese)                                    │
│  ✅ Use verified i18next/react-i18next patterns only                       │
│                                                                             │
│  CONDITIONAL:                                                               │
│  ⬜ RTL story (only if RTL setup exists AND component direction-sensitive) │
│                                                                             │
│  FORBIDDEN:                                                                 │
│  ❌ Do not hardcode new user-facing strings                                │
│  ❌ Do not add new translation resources without verified pattern          │
│  ❌ Do not invent i18n patterns                                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📊 OUTPUT FORMAT (STRICT)

Every response MUST include:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  RESPONSE FORMAT                                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1) BATCH SUMMARY                                                           │
│     - What you attempted                                                    │
│     - What's next                                                           │
│                                                                             │
│  2) FILES READ (explicit paths)                                             │
│     - .storybook/main.ts ✅                                                 │
│     - .storybook/preview.tsx ✅                                             │
│     - components/ui/<name>.tsx ✅                                           │
│     - etc.                                                                  │
│                                                                             │
│  3) VARIANT MATRIX + ADDON MATRIX                                           │
│     - Per touched unit                                                      │
│     - Controls/Actions/Interactions/A11y status                            │
│                                                                             │
│  4) CHANGES MADE                                                            │
│     - Short factual bullets                                                 │
│                                                                             │
│  5) GIT DIFF PATCH                                                          │
│     - Unified diff for changed/added files only                            │
│                                                                             │
│  6) GATES RUN + RESULTS                                                     │
│     - typecheck: PASS | FAIL | NOT RUN                                     │
│     - lint: PASS | FAIL | NOT RUN                                          │
│     - storybook:quality: PASS | FAIL | NOT RUN                             │
│     - etc.                                                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

**Document Version**: Enterprise Grade v2.0 (ULTRA MAX LIFECYCLE INTEGRATED)
**Last Updated**: Based on 12+ agent deep-dive analysis + ULTRA MAX UI-KIT
LIFECYCLE **Coverage**: 10000% - Full state machine + Addon enrichment +
Invariants + Validation gates
