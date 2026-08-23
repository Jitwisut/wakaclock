---
name: wakaclock-debug
description: Diagnose a failure in this repo — build errors, cargo or npm failing, the server refusing to start, 401 on every request, 404 on an existing endpoint, CORS errors, wrong time totals in the dashboard, one user seeing another's data, or a redirect loop to /login. Use when something is broken and the cause is not yet known.
---

# Debugging

**Read [.context/workflows/debugging.md](../../../.context/workflows/debugging.md) now** — it is a symptom → cause table ordered by how often each cause actually occurs here.

## Check these first — they are repo scaffolding, not your bug

| Symptom | Cause |
| --- | --- |
| `cargo` cannot read `crates/wakaclock-core/Cargo.toml` | you are at the repo root; `cd backend/api` |
| npm/pnpm finds no `package.json` | you are in `frontend/`; use `frontend/app` |
| `make dev` / `make test` / `make *-frontend` fails | broken `FRONTEND_DIR` in the Makefile |
| edits to a backend file change nothing | the file is probably not compiled — [.context/dead-code.md](../../../.context/dead-code.md) |
| Redis / RabbitMQ / Qdrant "integration" not working | no Rust code connects to them; compose-file leftovers |

## Then the real ones

- **Server won't start** — `main.rs` aborts in order: `JWT_SECRET` missing →
  migration failure → auth-cache load → Postgres. Read the *first* error.
- **401 everywhere** — expired/rotated session JWT, an API key created without
  refreshing the in-memory auth cache, or an endpoint that deliberately requires
  a session (`require_session_user`). Never "fix" it by trusting a query-param
  `user_id`.
- **Wrong time totals** — something is querying `wakaclock.heartbeats` directly
  and inferring duration from row gaps. All durations must come from
  `services/activity_timeline.rs`. Also check `IDLE_TIMEOUT_MINUTES`.
- **One user seeing another's data** — a query key missing `userId`.

Full detail, including CORS, presence and rate-limiting caveats, is in the
workflow file.
