# Workflow: Adding a Dashboard Panel

Read [../frontend/data-layer.md](../frontend/data-layer.md) first. All paths are
relative to `frontend/app/`.

## 1. Types

Add the response type to `lib/wakaclock/types.ts`, mirroring the Rust struct in
`backend/api/src/model/`. There is no codegen — keep them aligned by hand.

## 2. Endpoint function

Add one function to `lib/wakaclock/endpoints.ts`:

```ts
// GET /my_thing?user_id=&start=&end=
export async function getMyThing(userId: string, start: string, end: string) {
  const { data } = await wakaclockClient.get<MyThingResponse>('/my_thing', {
    params: { user_id: userId, start, end },
  });
  return data;
}
```

Match the file's conventions exactly (45 functions already follow them):
`get*`/`post*` naming, **positional** arguments with `userId` first, a
`// GET /path?...` comment above, and the return type inferred from
`wakaclientClient.get<T>` rather than annotated.

`user_id` is still sent as a query param — the backend's `resolve_user_id`
overrides it with the Bearer token's subject, and the two are kept deliberately
in agreement. `baseURL` already ends in `/api/v1`. Never add an `Authorization`
header; the interceptor does it.

## 3. Query key

Add to `wakaclockKeys` in `lib/wakaclock/query-keys.ts`. **`userId` first, then
the parameters that vary the result:**

```ts
myThing: (userId: string, start: string, end: string) =>
  [...wakaclockKeys.all, 'my-thing', userId, start, end] as const,
```

A key without `userId` will serve one account's data to another after a user
switch.

## 4. Component

Where it goes:

- used by one page → `app/dashboard/(auth)/wakaclock/<page>/components/<name>.tsx`
- used by several → `components/wakaclock/<name>.tsx`

Copy the shape of
[../../frontend/app/app/dashboard/(auth)/wakaclock/components/summaries-panel.tsx](<../../frontend/app/app/dashboard/(auth)/wakaclock/components/summaries-panel.tsx>),
which is the reference implementation:

```tsx
'use client';

export function MyThingPanel() {
  const userId = useWakaclockUserStore((s) => s.userId) ?? '';
  const { start, end, setRange } = useWakaclockRange(7);

  const { data, isLoading, error } = useQuery({
    queryKey: wakaclockKeys.myThing(userId, start, end),
    queryFn: () => getMyThing(userId, start, end),
    enabled: Boolean(userId),
  });

  const items = data?.items ?? [];

  return (
    <Card>
      <CardHeader>{/* title + <RangePicker … /> */}</CardHeader>
      <CardContent>
        <QueryState isLoading={isLoading} error={error} isEmpty={!items.length}>
          {/* content */}
        </QueryState>
      </CardContent>
    </Card>
  );
}
```

Required elements, all observed in existing panels:

- **Panels take no range props.** They own their own range via
  `useWakaclockRange(defaultDays)`
  ([../../frontend/app/hooks/use-wakaclock-range.ts](../../frontend/app/hooks/use-wakaclock-range.ts)),
  which persists `?start=&end=` in the URL so a range is linkable. Render
  `RangePicker` bound to its `setRange`.
- `useWakaclockUserStore((s) => s.userId) ?? ''` — the `?? ''` idiom, not `!`.
- `enabled: Boolean(userId)` — no request before hydration.
- `useQuery` is called **inline in the panel**. There is no per-endpoint hook
  wrapper convention; `hooks/` holds only cross-cutting hooks.
- Default array/object with `?? []` before rendering.
- `QueryState` from `components/wakaclock/query-state.tsx` — never hand-roll
  skeleton / alert / empty markup.
- Reuse `stat-tile.tsx`, `breakdown-chart.tsx`, `range-picker.tsx`,
  `page-header.tsx` from `components/wakaclock/` rather than new one-offs.
- shadcn primitives come from `components/ui/` — import, do not edit.

## 5. Mount it

Add to the page in `app/dashboard/(auth)/wakaclock/<page>/page.tsx`. If the page
is new, wrap it in `RequireUser`
(`components/wakaclock/require-user.tsx`) so an unauthenticated visitor is sent
to `/login?next=…` instead of seeing an empty authenticated shell.

`page.tsx` files stay thin — layout plus panels. Logic lives in the panel
component.

## 6. Tests

Vitest in `test/`, matching `**/*.{test,spec}.{ts,tsx}`.
[../../frontend/app/vitest.config.ts](../../frontend/app/vitest.config.ts) sets
**100%** thresholds on branches/functions/lines/statements, excluding
`components/ui/**`, `**/index.ts`, `**/*.config.*` and `test/`. A new product
component with no test will therefore drop coverage below threshold and fail
`npm run test:coverage` / `npm run check:strict`.

MSW exists (`mocks/handlers.ts`, `browser.ts`, `server.ts`) but currently holds
only a handful of template handlers and **no wakaclock endpoints** — existing
panel tests do not go through it. Follow whatever the nearest existing test in
`test/` does rather than assuming MSW is the house pattern here.

## 7. Story (if reusable)

`.storybook/stories/**`, never co-located with the component.

## 8. Verify

```bash
cd frontend/app
npm run validate        # typecheck + lint:strict + test:run
npm run check:strict    # what pre-push runs
```

`lint:strict` runs with `--max-warnings=0`, and `zustand` is a hard error —
[../conventions.md](../conventions.md).
