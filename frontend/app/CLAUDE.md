# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Next.js 16 + React 19 + TypeScript admin dashboard UI kit built on shadcn/ui (new-york style) and Radix UI primitives, styled with Tailwind CSS v4. ESM module (`"type": "module"`). Node.js 20+ required.

## Commands

```sh
npm ci                    # Install dependencies (preferred over npm install)
npm run dev               # Dev server with Turbopack at localhost:3000
npm run build             # Production build
npm run typecheck         # tsc --noEmit
npm run lint:strict       # ESLint with --max-warnings=0
npm run lint:fix          # ESLint with autofix
npm run format            # Prettier write
npm run format:check      # Prettier check

# Unit tests (Vitest, jsdom)
npm run test:run          # Run once
npm run test:watch        # Watch mode
npm run test:coverage     # With coverage (100% thresholds enforced)
npx vitest run test/my-file.test.ts   # Run a single test file

# E2E tests (Playwright - auto-starts dev server)
npm run test:e2e          # All browsers
npm run test:e2e:ui       # Interactive debug mode

# Storybook (port 6006)
npm run storybook         # Dev server
npm run storybook:test    # Test runner

# Quality gates
npm run validate          # typecheck + lint:strict + test:run (parallel)
npm run check:strict      # CI gate: typecheck, lint, coverage, Storybook checks, madge, knip
npm run check:all         # check:strict + Storybook build/audit/a11y + Playwright

# Code quality tools
npm run knip              # Dead code/dependency detection
npm run madge             # Circular dependency detection
```

## Architecture

### Routing (App Router)

- `app/layout.tsx` — Root layout: ThemeProvider, ActiveThemeProvider, Toaster, analytics
- `app/dashboard/(auth)/` — Authenticated pages with sidebar + header layout
- `app/dashboard/(guest)/` — Guest pages (login, register, error pages) with no layout wrapper
- `proxy.ts` redirects `/dashboard` and `/` to `/dashboard/default`

### Component Organization

- `components/ui/` — ~59 shadcn/ui vendor primitives. **Avoid large edits here** unless upgrading vendor components.
- `components/ui/custom/` — Custom components (minimal-tiptap rich text editor, prompt AI UI, count-animation)
- `components/layout/` — App shell (header, sidebar, logo)
- `components/theme-customizer/` — Theme panel components

### State Management

- **zustand** — Client-side stores (chat, POS, onboarding, todo, user-profile)
- **@tanstack/react-query** — Server state/data fetching
- **react-hook-form + zod** — Form state and validation

### Data/API Layer

- **MSW** (Mock Service Worker) in `mocks/` — Handlers for dev, tests, and Storybook
- **axios** as HTTP client
- Most dashboard data comes from local JSON files in feature directories

### Theming

- 8 theme presets stored via cookies (preset, scale, radius, content layout)
- Dark/light mode via `next-themes`
- CSS custom properties defined in `app/themes.css`

### Path Alias

`@/*` maps to project root. Always use `@/` imports:
```ts
import { cn } from '@/lib/utils';
```

## Testing

- **Vitest** in `jsdom`, tests in `test/` directory matching `**/*.{test,spec}.{ts,tsx}`
- Setup file: `test/setup.ts` (mocks matchMedia, IntersectionObserver, ResizeObserver, etc.)
- Coverage: V8 provider, **100% thresholds** on branches/functions/lines/statements
- Coverage excludes: `components/ui/**` (vendor), `node_modules/`, `test/`, config files, `__mocks__/`
- Mocks: `mockReset`, `restoreMocks`, `clearMocks` all enabled
- **Playwright** E2E in `e2e/` — runs against Chromium, Firefox, WebKit, Mobile Chrome (Pixel 5), Mobile Safari (iPhone 12)

## Coding Style

- 2-space indent, single quotes, ~100 char lines, ES5 trailing commas, LF line endings (Prettier)
- Components: `PascalCase.tsx`; hooks: `use-thing.ts`; tests: `*.test.ts(x)`
- Conventional commits enforced: `feat(scope): message`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`, `build` (100 char max header)
- Git hooks via **lefthook**: lint-staged on commit, commitlint on commit-msg, check-strict on pre-push

## Storybook

Stories live under `.storybook/stories/**` — not co-located with components. Storybook 10 with `@storybook/nextjs-vite` framework. A11y baseline in `.storybook/a11y-baseline.json`.

## Key Lib Files

- `lib/utils.ts` — `cn()` (clsx + twMerge), metadata helpers
- `lib/env.ts` — Type-safe env via `@t3-oss/env-nextjs` + zod
- `lib/themes.ts` — Theme presets and config
- `lib/fonts.ts` — Font configuration
- `lib/arcjet.ts` — Arcjet security (rate limiting, bot protection)
- `lib/posthog.ts`, `lib/ga.ts` — Analytics

## Environment

Copy `.env.example` to `.env.local`. Key variables: `NEXT_PUBLIC_APP_URL`, `DATABASE_URL`, `AUTH_SECRET`, `ARCJET_KEY`, PostHog keys, GA measurement ID. Set `SKIP_ENV_VALIDATION=true` to bypass validation during builds.
