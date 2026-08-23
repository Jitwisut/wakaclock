# Migrations

## The mechanism — Existing Convention

There is **no migration tool** (no refinery, no sqlx-migrate, no goose).
Migrations are Rust code that runs at every server start.

### ClickHouse

Each repository owns its tables and exposes `async fn migrate(&self) -> Result<()>`
containing `CREATE TABLE IF NOT EXISTS` / `CREATE MATERIALIZED VIEW IF NOT
EXISTS` / `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` statements. Example:
[../../backend/api/src/repository/heartbeat.rs](../../backend/api/src/repository/heartbeat.rs).

[../../backend/api/src/main.rs](../../backend/api/src/main.rs) calls each
`migrate()` in a fixed sequence and aborts startup on the first failure.

### PostgreSQL

One file,
[../../backend/api/migrations/postgres/001_phase10_foundation.sql](../../backend/api/migrations/postgres/001_phase10_foundation.sql),
embedded with `include_str!` and applied via `batch_execute` in
`PostgresClient::migrate()`. Runs only when `POSTGRES_URL` is configured.

## Ordering is load-bearing

`main.rs` runs, in this order: `heartbeat_repo`, `project_merge_repo`,
`project_rule_repo`, `analytics_repo`, `external_duration_repo`,
`follow_up_repo`, `account_analytics_repo`, `ai_usage_repo`,
**`project_identity_repo`**, `reprocess_service`, `org_repo`, `team_repo`,
`coworking_session_repo`, then PostgreSQL.

`project_identity_repo` **must** run after `heartbeat_repo` and `analytics_repo`:
it widens `heartbeats` and `project_daily` with a nullable `project_id`, so both
tables have to exist first. This is called out in a comment at
[../../backend/api/src/main.rs](../../backend/api/src/main.rs). Do not reorder
that block casually.

## How to add a schema change

1. Put the DDL in the owning repository's `migrate()`, at the **end** of the
   existing statements.
2. Make it idempotent: `IF NOT EXISTS` on creates, `ADD COLUMN IF NOT EXISTS` on
   alters. `migrate()` runs on every boot — a non-idempotent statement breaks
   restart.
3. Make it additive. New columns must be `Nullable(...)` or have a `DEFAULT`;
   existing rows are not backfilled by the DDL.
4. If a new repository needs its own tables, add its `migrate()` call to
   `main.rs` **in the correct position** relative to tables it depends on.
5. If the change affects a derived rollup, confirm the reprocess path
   (`analytics_reprocess_audits`, `POST /api/v1/analytics/rebuild`) can rebuild
   it.
6. For PostgreSQL, append to `001_phase10_foundation.sql`. The whole file is
   re-executed each boot, so every statement in it must be idempotent too.
   `PostgresClient` has a test asserting expected `CREATE TABLE IF NOT EXISTS
   <table>` strings are present in the file — keep that literal form.

## Known drift

- [../../migrations/001_init.sql](../../migrations/001_init.sql) at repo root is
  a standalone ClickHouse schema **not referenced by any code path**. It
  overlaps with the in-code DDL and may be stale. The in-code `migrate()`
  functions are authoritative.
- `backend/api/migrations/clickhouse/` contains only a `.gitkeep`, a
  `run_migration.sh` and a `README.md` describing *e-commerce connector*
  migrations that do not exist. Template leftover —
  [../dead-code.md](../dead-code.md).
- [../../ch_schema.json](../../ch_schema.json) and
  [../../schema.txt](../../schema.txt) are schema snapshots, not applied
  artifacts. Treat as documentation of a point in time; verify against code.

## Recommended Convention (not currently practiced)

Adopting a versioned migration runner with an applied-migrations ledger would
remove the "every statement must be idempotent forever" constraint and make
destructive changes possible. **This is a recommendation, not the current rule.**
Until it is adopted, follow the idempotent-DDL-in-`migrate()` pattern above.
