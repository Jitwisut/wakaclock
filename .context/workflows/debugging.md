# Workflow: Debugging

Ordered by how often the cause turns out to be repository scaffolding rather
than a real bug.

## Build / tooling failures

| Symptom | Cause | Fix |
| --- | --- | --- |
| `cargo` fails: *failed to read a workspace member* | command is using a stale path or wrong directory | use `backend/api` or the root Makefile |
| `npm`/`pnpm` finds no `package.json` | you are in `frontend/` | `cd frontend/app` and use npm |
| `make` cannot find a frontend package | a legacy command is being used | use the root `Makefile` targets documented in [../commands.md](../commands.md) |
| a worker name is unknown | worker binaries are hyphenated | use `cargo run --bin heartbeat-enrichment` (or another name listed in `backend/api/README.md`) |
| A backend file's code seems to have no effect | it is probably not compiled | check the `mod` chain — [../dead-code.md](../dead-code.md) |

## Server will not start

`main.rs` aborts loudly and in order. Read the first error, not the last.

1. **`JWT_SECRET is not set`** — set it, or `ALLOW_INSECURE_JWT_SECRET=1` for
   local only.
2. **Migration failed** — a `migrate()` call. Likely a non-idempotent statement
   or a table ordering violation (`project_identity_repo` must follow
   `heartbeat_repo` and `analytics_repo`). See [../data/migrations.md](../data/migrations.md).
3. **`Failed to load auth key cache`** — ClickHouse reachable but
   `wakaclock.users` unusable; migrations did not complete.
4. **PostgreSQL migration failed** — only when `POSTGRES_URL` is set. Unset it
   to boot ClickHouse-only.

Run `make infra-up` first; ClickHouse is required.

## 401 on every request

1. Is `Authorization` present? Only `Bearer <token>` and `Basic base64(<token>)`
   are parsed.
2. Session JWT — is it older than 24 h, or was `JWT_SECRET` rotated? Both
   invalidate it. The frontend handles this by dropping the session on any
   non-`/auth/*` 401.
3. API key — was it created/rotated without refreshing the auth cache? The cache
   is in-memory; a restart re-reads it. See [../backend/auth.md](../backend/auth.md).
4. Are you on an endpoint that uses `require_session_user`? API keys are refused
   there by design.
5. **Never "fix" this by reading `user_id` from a query param.**

## 404 on an endpoint that exists

- `POST /api/v1/internal/subscription` returns 404 when `INTERNAL_API_SECRET` is
  unset — deliberate.
- Otherwise: is the handler registered in the `Router` in
  `handlers/v1/mod.rs` / `v2.rs`? Defining a handler function does not route it.

## Frontend gets CORS errors

`CORS_ORIGINS` on the backend must list the frontend origin exactly (scheme +
host + port). `*` sets a permissive layer; anything else is an exact allowlist.
Only `GET, POST, PUT, PATCH, DELETE` and `Authorization`/`Content-Type` are
allowed. Tests for this live at the bottom of `main.rs`.

## Numbers look wrong (too much / too little time)

The usual cause is querying `wakaclock.heartbeats` directly and inferring
duration from row gaps — that counts idle time. Every duration must come from
the canonical timeline (`services/activity_timeline.rs`). See
[../architecture.md](../architecture.md).

Also check `IDLE_TIMEOUT_MINUTES`: `0` disables idle bridging, so pauses longer
than the 120-second evidence window vanish from the day's total.

If a rollup is stale, rebuild it: `POST /api/v1/analytics/rebuild`, or the
`/reprocess` and `/repair` routes.

## Dashboard shows another user's data

A query key missing `userId`. Check `lib/wakaclock/query-keys.ts` —
[../frontend/data-layer.md](../frontend/data-layer.md).

## Redirected to `/login` on every page load

`RequireUser` acted before `hydrated` was true. Gate on `hydrated` before
reading `userId`.

## Presence/coworking state disappears

`infrastructure/presence_store.rs` is in-memory: it does not survive a restart
and does not work across instances. Expected, not a bug.

## Rate limiting behaves oddly behind a proxy

The limiter keys on the direct TCP peer. Behind a reverse proxy every request
shares the proxy's IP. `X-Forwarded-For` is not implemented.
