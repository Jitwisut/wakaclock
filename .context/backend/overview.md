# Backend Overview

Rust API server, crate name `wakaclock-server`. Workspace root:
[../../backend/api/Cargo.toml](../../backend/api/Cargo.toml) — **never run
`cargo` from the repo root** ([../dead-code.md](../dead-code.md)).

## Live module map

| Directory | Role |
| --- | --- |
| `backend/api/src/handlers/` | HTTP: extract, authenticate, call one service, map to JSON |
| `backend/api/src/services/` | Business logic. ~38 modules, one per domain concept |
| `backend/api/src/repository/` | ClickHouse SQL + per-table `migrate()`. 13 modules |
| `backend/api/src/model/` | Serde structs shared by handlers/services/repos |
| `backend/api/src/infrastructure/` | DB clients, `AppState`, auth cache, rate limiter, presence store, logger |
| `backend/api/src/middleware/auth.rs` | The only identity resolution path |
| `backend/api/src/config/mod.rs` | `Config::from_env()` |

`src/interfaces/`, `src/docs/`, `src/model/v1/`, `src/helpers/*` are **not
compiled** — see [../dead-code.md](../dead-code.md).

## Where new code goes

| You are adding | Put it in |
| --- | --- |
| A new HTTP endpoint | `handlers/v1/<domain>.rs` (or `v2.rs`), routed in the matching `router()` |
| A calculation, aggregation, policy | `services/<domain>.rs` |
| A new query or table | `repository/<domain>.rs`, with its DDL in that repo's `migrate()` |
| A request/response shape | `model/<domain>.rs` |
| A shared client or process-wide cache | `infrastructure/` |

Wire every new service/repository into `AppState` in
[../../backend/api/src/infrastructure/app/init.rs](../../backend/api/src/infrastructure/app/init.rs).
Nothing is reachable otherwise.

## Layer rules

**Handlers must not** open a ClickHouse or Postgres client, build SQL, or hold
domain rules. They may only: extract axum types, call `auth::resolve_user_id`,
call exactly one service method, map `Result` to a status code.

**Services must not** import `axum` types or return `StatusCode`. They return
`anyhow::Result<T>`; the handler decides the HTTP shape.

**Repositories must not** decide policy. They take resolved parameters
(`user_id: Uuid`, `range: &ResolvedRange`) and return rows.

Reference implementations that follow the rules cleanly:
[../../backend/api/src/handlers/v1/summaries.rs](../../backend/api/src/handlers/v1/summaries.rs),
[../../backend/api/src/services/duration.rs](../../backend/api/src/services/duration.rs),
[../../backend/api/src/repository/heartbeat.rs](../../backend/api/src/repository/heartbeat.rs).

## Error handling — Existing Convention

- Internals use `anyhow::Result` with `.context("...")`.
- Handlers convert to `Result<Json<T>, (StatusCode, Json<serde_json::Value>)>`
  and emit `{"error": "<message>"}` via a local `app_error` helper.
- Auth failure uses the shared `auth::unauthorized()` helper.

There is **no** central `IntoResponse` error type. Each handler module defines
its own `app_error`. Follow the local file's existing pattern rather than
introducing a new error enum.

## Derived-data invariant

Durations, summaries, stats and project analytics must be derived from the
canonical timeline
([../../backend/api/src/services/activity_timeline.rs](../../backend/api/src/services/activity_timeline.rs)),
not from raw heartbeat row gaps. See [../architecture.md](../architecture.md).

## Testing — Existing Convention

Inline `#[cfg(test)] mod tests` at the bottom of the file under test (~31 files
do this). There is no `backend/api/tests/` directory. Shared fixtures live in
[../../backend/api/src/test_support.rs](../../backend/api/src/test_support.rs);
ClickHouse-dependent tests read `CLICKHOUSE_TEST_*`
([../environment.md](../environment.md)).

Pure decision functions are deliberately split from their async DB adapters so
they can be tested without a database — see `AuthorizationService` in
[../../backend/api/src/services/authorization.rs](../../backend/api/src/services/authorization.rs).
Follow that split for new policy code.
