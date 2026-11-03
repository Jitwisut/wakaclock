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
| `app/dashboard/(auth)/wakaclock/` | the product dashboard: root `page.tsx` plus `ai/`, `heartbeats/`, `insights/`, `keystrokes/`, `presence/`, `projects/` (+ `[projectId]/`), `settings/`, `time-machine/` |
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

`components/wakaclock/analytics/` is the shared Analytics Explorer surface. Its
Timeline, Human vs AI, Projects and Heatmap routes all read one URL-backed filter
contract from `use-analytics-filters.ts` and one canonical duration response from
`GET /api/v1/dashboard/explorer`. New analytics views should preserve those URL
filters and derive duration from the canonical activity timeline rather than
summing raw heartbeat `active_seconds` independently.

`/dashboard/wakaclock/time-machine` reuses those URL filters but not
`AnalyticsFrame`: it reads `GET /api/v1/dashboard/replay` alone, so one page load
builds the canonical timeline once. All playback runs in the browser from
`lib/wakaclock/replay.ts`. The sidebar entry needs the `time_machine` capability.
GitHub events load separately from the replay, so their failure never affects it.
The page opens on City, which reads `GET /api/v1/dashboard/city`. `?view=timeline` opens
the replay. `components/wakaclock/analytics/city/city-scene.ts` is plain three.js behind
a small interface, imported only after `chooseTimeQuality` allows 3D; otherwise the module
table stands alone.
Only a project filter can apply to them; any other filter hides them with a note.

### Motion Native — default theme preset

`[data-theme-preset='motion-native']` in `app/themes.css` is the dashboard default
(`lib/themes.ts` `DEFAULT_THEME`); the other presets, Retro Pixel 3D included, stay
selectable in the theme customizer. Owner decision 2026-11-03.

- All visual values are tokens in that block (colour, type, radius, `--elevation-*`,
  `--material-*`, `--motion-*` durations, `--ease-*` curves, layers) with light and dark
  values. Components read tokens; the skin below the tokens restyles shadcn primitives by
  `data-slot`, as the Retro preset does.
- Page-level art in CSS modules (overview, settings, timeline, heatmap, time-machine
  city, insights) has `:global([data-theme-preset='motion-native'])` overrides at the end
  of each file. New page art should read the preset tokens rather than fixed colours.
- Motion rules: transform/opacity only; material blur only on small floating surfaces;
  no infinite animation on an idle page (attention pulses run a few iterations). Measured
  on a production build: zero infinite animations after 6 s idle on the audited routes.
- Appearance is Light / Dark / System (`components/layout/header/theme-switch.tsx`);
  the dashboard and account layouts default to System.
- `app/dashboard/(auth)/template.tsx` gives every dashboard route a short entrance; the
  toolbar shows a breadcrumb (`toolbar-breadcrumb.tsx`); the sidebar's current-page
  highlight glides between items (`nav-main.tsx`, visible only when a preset opts in).
- Marketing pages (`app/(marketing)`, `marketing.css`) are a separate art-directed
  system and do not use presets; they were not redesigned in this pass.

### Settings shell and 3D tilt — Teams page

`components/wakaclock/settings-shell.tsx` is a settings-style split view (section list
beside a content pane; a push-style stack below `md`). `components/wakaclock/tilt-3d.tsx`
leans a surface toward the mouse on springs (mouse only; flat for touch, focus inside
and reduced motion). `/dashboard/wakaclock/teams` is the only user so far.

- Owner direction (2026-11-03): match the active theme preset — no decorative icons,
  no gradients. Build these surfaces from theme tokens and shadcn primitives (`Card`,
  `Input`, `NativeSelect`, `DropdownMenu`) so presets such as `retro-pixel` style them.
- A macOS-style "glass" theme layer existed briefly (commit `f63f4ec`) and was removed at
  the owner's request; the owner may still want it later as an optional theme preset.
- The Teams page keeps `?org=&section=` in the URL via the native History API, so
  navigation stays client-side and browser back works.

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
