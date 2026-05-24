# Repository Guidelines

## Project Structure & Module Organization

- `app/`: App Router routes, layouts, and global styles (e.g. `app/layout.tsx`).
- `components/`: Reusable UI + feature components. `components/ui/` contains
  shadcn/ui primitives.
- `lib/`: Shared utilities (env, analytics, theme).
- `hooks/`: Reusable React hooks.
- `mocks/`: MSW mocks/handlers for tests and local development.
- `test/`: Vitest setup and unit/component tests.
- `e2e/`: Playwright end-to-end tests.
- `.storybook/`: Storybook config and stories. Stories must live under
  `.storybook/stories/**` (not next to components).
- `public/`: Static assets served at `/`.

Generated outputs: `coverage/`, `test-results/`, `playwright-report/`, `.next/`.

## Build, Test, and Development Commands

- `npm ci` (preferred) or `npm install`: Install dependencies.
- `npm run dev`: Start the local Next.js dev server at `http://localhost:3000`.
- `npm run build` / `npm run start`: Build and serve production output.
- `npm run lint` / `npm run format`: Run ESLint and apply Prettier formatting.
- `npm run typecheck`: Run `tsc --noEmit`.
- `npm run test:run` / `npm run test:watch`: Run Vitest once (CI) or in watch
  mode.
- `npm run test:e2e`: Run Playwright specs (auto-starts the dev server).
- `npm run storybook`: Run Storybook at `http://localhost:6006`.
- `npm run validate`: Typecheck + lint (no warnings) + unit tests.
- `npm run check:strict`: CI gate (typecheck, lint, coverage, Storybook checks,
  madge, knip).
- `npm run check:all`: Adds heavy gates (Storybook build/audit/a11y runner +
  Playwright).

## Coding Style & Naming Conventions

- TypeScript + React; 2-space indentation, single quotes, ~100 char lines
  (Prettier).
- Prefer the `@/` path alias (repo root), e.g.
  `import { cn } from '@/lib/utils'`.
- Components: `PascalCase.tsx`; hooks: `useThing.ts`; tests: `*.test.ts(x)` or
  `*.spec.ts(x)`.
- Avoid large edits in `components/ui/` unless you are upgrading vendor
  components.

## Testing Guidelines

- Vitest runs in `jsdom` and matches `**/*.{test,spec}.{ts,tsx}`; common setup
  lives in `test/setup.ts`.
- Coverage is enforced (100% thresholds). Use `npm run test:coverage` before
  merging.
- Playwright tests live in `e2e/` and match `**/*.spec.ts`. Use
  `npm run test:e2e:ui` to debug.

## Commit & Pull Request Guidelines

- Conventional Commits are enforced via `commitlint` (example:
  `feat(ui): add date picker`). Valid types include: `feat`, `fix`, `docs`,
  `refactor`, `test`, `chore`, `ci`, `build`.
- Git hooks run via `lefthook` (lint-staged on commit; typecheck + tests on
  push).
- PRs should include: a short summary, testing notes, and screenshots/Storybook
  links for UI changes.

## Security & Configuration Tips

- Copy `.env.example` to `.env.local` for local secrets; never commit real
  credentials.
