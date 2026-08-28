# Frontend Overview

Next.js App Router app at `frontend/app` (**not** `frontend/`). React 19,
TypeScript, Tailwind v4, shadcn/ui.

## Read the nested agent docs first

[../../frontend/app/CLAUDE.md](../../frontend/app/CLAUDE.md) (auto-loaded by
Claude Code in that subtree) and
[../../frontend/app/AGENTS.md](../../frontend/app/AGENTS.md) already cover the
**template layer**: full command list, Prettier settings, Storybook location,
coverage thresholds, path alias, commit conventions. Do not restate them.

This file covers what they do not: the **product layer**, and where they are
stale.

## Product vs template

The package is literally named `shadcn-ui-kit` — it started as a purchased
admin UI kit. Two populations of code:

| Product code (this is the app) | Template code (inherited) |
| --- | --- |
| `app/dashboard/(auth)/wakaclock/**` | `components/ui/**` (~59 shadcn primitives) |
| `app/(account)/**` — login/register | `components/ui/custom/**` |
| `app/(marketing)/**` — public site | `components/theme-customizer/**` |
| `components/wakaclock/**` | most of `.storybook/stories/**` |
| `components/auth/**` | `frontend/app/tasks/`, `ralph/`, `docs/` scratch |
| `components/presence/**` | |
| `lib/wakaclock/**` | |

**Avoid large edits in `components/ui/`** unless upgrading vendor components.

## Route map

| Route group | Purpose |
| --- | --- |
| `app/(account)/` | `login`, `register`, shared `layout.tsx` + `auth.css` |
| `app/dashboard/(auth)/` | authenticated shell (`layout.tsx`, `error.tsx`) |
| `app/dashboard/(auth)/wakaclock/` | the product dashboard: root `page.tsx` plus `ai/`, `heartbeats/`, `insights/`, `keystrokes/`, `presence/`, `projects/` (+ `[projectId]/`), `settings/` |
| `app/(marketing)/` | pricing, docs, integrations, comparison and SEO pages |

Page-local components live in a `components/` folder **beside the page**
(e.g. `wakaclock/settings/components/api-key-panel.tsx`). Cross-page product
components live in `components/wakaclock/`.

## Shared product components

[../../frontend/app/components/wakaclock/](../../frontend/app/components/wakaclock/)

| Component | Use it for |
| --- | --- |
| `require-user.tsx` | gate any page needing a session. Waits for `hydrated` before redirecting, else every load bounces to `/login`. |
| `query-state.tsx` | **the** loading/error/empty wrapper for every panel. Do not hand-roll skeletons. |
| `page-header.tsx`, `range-picker.tsx`, `stat-tile.tsx`, `breakdown-chart.tsx`, `subscription-badge.tsx`, `user-switcher.tsx` | shared panel furniture |
| `hooks/use-wakaclock-range.ts` (outside this dir) | start/end range state persisted in the URL — every range panel uses it |
| `rpg/` | gamification widgets (`xp-bar`, `rank-badge`, `active-days-badge`, `today-quest-card`), backed by `lib/wakaclock/rpg.ts` |

`components/presence/` is a **separate surface** with its own conventions: a
pixel-art theme (`presence-theme.css`, `presence-fonts.ts`) isolated from the
dashboard's shadcn tokens, SSE-driven state instead of TanStack Query, and no
`QueryState`/`useWakaclockRange`. Do not apply the normal panel pattern there,
and do not apply its conventions to a normal dashboard panel.

## State management — Existing Convention

- **Server state:** TanStack Query. See [data-layer.md](data-layer.md).
- **Session state:** React Context + `useReducer` in
  [../../frontend/app/lib/wakaclock/user-store.tsx](../../frontend/app/lib/wakaclock/user-store.tsx).
- **Forms:** react-hook-form + zod.

### Zustand is forbidden

[../../frontend/app/eslint.config.mjs](../../frontend/app/eslint.config.mjs)
sets `no-restricted-imports` to **error** on `zustand`:
*"Zustand is forbidden in this repo; use React Context + useReducer instead."*

`frontend/app/CLAUDE.md` still lists zustand as the client-state solution. **The
lint rule wins.** Never add a zustand store.

## Where the existing docs are stale

Flag these rather than trusting them:

1. Zustand — forbidden by lint, still documented as in use (above).
2. Env vars — the docs list `DATABASE_URL`, `AUTH_SECRET`, `ARCJET_KEY`; the
   variable the product actually needs is `NEXT_PUBLIC_WAKACLOCK_API_URL`.
   See [../environment.md](../environment.md).
3. `proxy.ts` redirect behaviour and the "8 theme presets" description predate
   the wakaclock dashboard — verify against
   [../../frontend/app/proxy.ts](../../frontend/app/proxy.ts) before relying on it.
4. Package manager is ambiguous — [../commands.md](../commands.md).

## In-flight work

The auth surface is mid-refactor in the working tree: `app/(account)/`,
`components/auth/` and `test/auth-screen.test.tsx` are untracked, while
`components/wakaclock/auth-panel.tsx` and the `login/v1|v2`, `register/v1|v2`
pages are deleted. Read the working tree, not the last commit, and expect
churn here.

## Styling

Tailwind v4 + CSS custom properties in `app/themes.css` / `app/globals.css`.
`app/(account)/auth.css` is route-group scoped. Use `cn()` from `@/lib/utils`.
