---
name: wakaclock-panel
description: Add or change a dashboard panel, page, or data-fetching code in the Next.js frontend (frontend/app). Use when the task involves a wakaclock dashboard component, a TanStack Query hook, the API client in lib/wakaclock, a query key, session or login state, or any new UI that reads backend data. Covers the panel pattern, query-key tenancy rule, and the endpoints house style for this repo.
---

# Adding or changing a dashboard panel

**Read [.context/workflows/adding-dashboard-panel.md](../../../.context/workflows/adding-dashboard-panel.md) now**, then follow it. Related: [.context/frontend/data-layer.md](../../../.context/frontend/data-layer.md), [.context/frontend/overview.md](../../../.context/frontend/overview.md).

## Non-negotiables (do not violate even before reading further)

1. **Run npm from `frontend/app`, never `frontend/`.** There is no
   `package.json` in `frontend/`.
2. **Every TanStack Query key includes `userId`, first.** This is the tenant
   isolation boundary — a key without it serves one account's cached data to
   another after a user switch. Keys live only in `lib/wakaclock/query-keys.ts`.
3. **No bare `axios`/`fetch` in a component.** Add a function to
   `lib/wakaclock/endpoints.ts` and call it through `useQuery`.
4. **Zustand is forbidden** — `no-restricted-imports` is an ESLint *error*.
   Use React Context + `useReducer`. `frontend/app/CLAUDE.md` is stale on this.
5. **`enabled: Boolean(userId)`** on every query, and gate on `hydrated` before
   acting on `userId` — otherwise every page load bounces to `/login`.
6. **Wrap content in `QueryState`** (`components/wakaclock/query-state.tsx`).
   Never hand-roll skeleton / error / empty markup.
7. **Panels own their range** via `useWakaclockRange(days)`; they do not take
   `start`/`end` props.

## Reference implementation

`frontend/app/app/dashboard/(auth)/wakaclock/components/summaries-panel.tsx`

## Before declaring done

```bash
cd frontend/app && npm run validate
```

Coverage thresholds are 100% (excluding `components/ui/**`), so a new product
component needs a test or `check:strict` fails.
