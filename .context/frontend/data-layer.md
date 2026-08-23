# Frontend Data Layer

Everything the dashboard knows about the backend lives in
[../../frontend/app/lib/wakaclock/](../../frontend/app/lib/wakaclock/), one job
per file.

| File | Job |
| --- | --- |
| `client.ts` | the single axios instance + interceptors + `WakaclockError` |
| `endpoints.ts` | one typed function per backend endpoint |
| `types.ts` | request/response types mirroring the Rust `model/` structs |
| `query-keys.ts` | the `wakaclockKeys` factory |
| `session.ts` | non-React bridge for the current token |
| `user-store.tsx` | `WakaclockUserProvider` — the React-side session state |
| `format.ts`, `rpg.ts` | display formatting, gamification math |

## Rules

1. **Never call `axios` or `fetch` directly in a component.** Add a function to
   `endpoints.ts` and call it through TanStack Query.
2. **Never build a query key inline.** Add it to `wakaclockKeys` in
   `query-keys.ts`.
3. **Every query key must include `userId`.** Stated at the top of
   `query-keys.ts`: switching users in the header must never serve another
   uuid's cached data. A key without `userId` is a data-leak bug.
4. **Never set an `Authorization` header yourself.** The request interceptor
   does it.
5. **Never pass `user_id` as the source of identity.** The backend's
   `resolve_user_id` overrides any `?user_id=` with the Bearer token's subject;
   the interceptor comment says the two are kept deliberately in agreement.
   See [../backend/auth.md](../backend/auth.md).

## The client

```ts
export const wakaclockClient = axios.create({
  baseURL: `${env.NEXT_PUBLIC_WAKACLOCK_API_URL}/api/v1`,
  timeout: 15_000,
});
```

Note `baseURL` already includes `/api/v1`. A v2 endpoint needs an explicit path,
not a second client — check `endpoints.ts` for the existing convention before
adding one.

### `endpoints.ts` house style (45 functions follow it)

`get*` / `post*` naming, **positional** arguments with `userId` first, a
`// GET /path?...` comment above each, return type inferred from
`wakaclockClient.get<T>()`. `user_id` is passed as a query param even though the
Bearer token is authoritative — the two are kept deliberately in agreement.

### Error contract

All failures reject with `WakaclockError { message, status, isNotFound }`.
`message` prefers the backend's `{"error": ...}` body, falls back to a
timeout-specific message for `ECONNABORTED`. Components should render
`WakaclockError.message` rather than a generic string.

### The 401 rule

A 401 on any non-`/auth/*` endpoint calls `notifyUnauthorized()`, which ends the
session so the login form returns. Without it an expired token — or one signed
with a since-rotated `JWT_SECRET` — leaves `userId` in localStorage, so the
login gate passes while every request 401s with no way out.

`/auth/*` is excluded: a 401 there is just wrong credentials.

**If you add an endpoint that legitimately 401s without meaning "session over",
it must be excluded here explicitly.**

## Session plumbing

`session.ts` holds a module-level mirror of the token plus an unauthorized
callback. It exists because the axios interceptor needs **synchronous,
non-React** access to the current token — React Context cannot be read outside a
component.

[../../frontend/app/lib/wakaclock/user-store.tsx](../../frontend/app/lib/wakaclock/user-store.tsx)
(`WakaclockUserProvider`) owns the real state: `{ token, userId, username,
hydrated }` in Context + `useReducer`, persisted to `localStorage` under
`wakaclock-session`, and it keeps `session.ts` in sync.

**`hydrated` matters.** Before the stored session is read, a signed-in visitor
is indistinguishable from a signed-out one. Always gate on `hydrated` before
acting on `userId` — this is what
[../../frontend/app/components/wakaclock/require-user.tsx](../../frontend/app/components/wakaclock/require-user.tsx)
does.

## Panel pattern

```tsx
const userId = useWakaclockUserStore((s) => s.userId) ?? '';
const { start, end, setRange } = useWakaclockRange(7);

const { data, isLoading, error } = useQuery({
  queryKey: wakaclockKeys.summaries(userId, start, end),
  queryFn: () => getSummaries(userId, start, end),
  enabled: Boolean(userId),
});

const days = data?.days ?? [];

return (
  <QueryState isLoading={isLoading} error={error} isEmpty={!days.length}>
    {/* content */}
  </QueryState>
);
```

Reference implementation:
[../../frontend/app/app/dashboard/(auth)/wakaclock/components/summaries-panel.tsx](<../../frontend/app/app/dashboard/(auth)/wakaclock/components/summaries-panel.tsx>).

`enabled: Boolean(userId)` prevents a request firing before hydration.
`QueryState`
([../../frontend/app/components/wakaclock/query-state.tsx](../../frontend/app/components/wakaclock/query-state.tsx))
renders skeleton / alert / empty states so "no data for this user" never looks
like a broken request.

## Keeping types in sync

`types.ts` mirrors the Rust structs in `backend/api/src/model/`. There is **no
codegen** — the two are kept aligned by hand. Changing a response shape in Rust
means editing `types.ts` in the same change.
