# Data Layer Overview

Two datastores, split by purpose. Migration mechanics: [migrations.md](migrations.md).

| | ClickHouse | PostgreSQL |
| --- | --- | --- |
| Role | telemetry + all derived analytics | transactional product state (Phase 10) |
| Required | **yes** — server will not function without it | **no** — optional |
| Database / schema | `wakaclock` | default |
| Client | [../../backend/api/src/infrastructure/database.rs](../../backend/api/src/infrastructure/database.rs) | [../../backend/api/src/infrastructure/postgres.rs](../../backend/api/src/infrastructure/postgres.rs) |
| Env | `CLICKHOUSE_URL`, … | `POSTGRES_URL` |

`POSTGRES_URL` unset ⇒ `AppState.postgres` is `None`. **Every Postgres-backed
code path must handle `None` by degrading, never by unwrapping.**

Redis, RabbitMQ, Redpanda and Qdrant appear in the compose files but no Rust
code connects to them — [../dead-code.md](../dead-code.md).

## ClickHouse — shape

### Ingest
- `wakaclock.heartbeats` — the raw fact table. Canonical DDL:
  [../../backend/api/src/repository/heartbeat.rs](../../backend/api/src/repository/heartbeat.rs).
- `wakaclock.heartbeats_incoming` — landing table feeding the materialized views.
- `wakaclock.activity_intervals` — proven activity windows.

### Identity / config
`users`, `projects`, `project_identities`, `project_aliases`, `project_rules`,
`project_merges`, `orgs`, `org_members`, `teams`, `team_members`,
`coworking_sessions`, `coworking_session_participants`, `sync_state`.

`wakaclock.users` is a `ReplacingMergeTree` ordered by `user_id` — see the auth
cache note in [../backend/auth.md](../backend/auth.md).

### Derived daily rollups
`daily_totals`, `project_daily`, `language_daily`, `editor_daily`, `os_daily`,
`machine_daily`, `feature_daily`, `dependency_daily`, `keystroke_daily`,
`member_daily`, `organization_daily`, `project_*_daily`,
`commit_activity_daily`, `insights_agg`, `leaderboard_snapshots`.

### AI attribution
`ai_usage_events`, `ai_changes_raw`, `ai_sessions`, `ai_session_projects`,
`ai_daily`, `ai_model_daily`, `ai_client_daily`, `ai_project_daily`,
`ai_effectiveness_daily`, `ai_model_pricing`, `human_follow_up_events`.

### Materialized views
Two families, both `mv_*`: a base set (`mv_daily_summary`, `mv_project_summary`,
`mv_lang_summary`, `mv_editor_summary`, `mv_os_summary`, `mv_ai_summary`,
`mv_keystroke_summary`, `mv_insights_agg`) and an incremental set
(`mv_inc_*`) fed from `heartbeats_incoming`.

### Reprocessing
`account_projection_versions`, `analytics_reprocess_audits` support rebuilding
rollups (`POST /api/v1/analytics/rebuild`, `/reprocess`, `/repair`). When you add
a rollup, make sure the reprocess path can rebuild it.

## PostgreSQL — shape

One migration file:
[../../backend/api/migrations/postgres/001_phase10_foundation.sql](../../backend/api/migrations/postgres/001_phase10_foundation.sql),
`include_str!`-embedded into the binary. Owns identity, access, OAuth,
integrations, productivity configuration, billing and audit state.

IDs are **UUIDv7 supplied by the application**, not by a database extension, so
inserts stay time-sortable. Generate them in Rust; do not add a `gen_random_uuid()`
default.

There is a `schema_migrations` table, but the current runtime applies the whole
file idempotently rather than tracking versions — see [migrations.md](migrations.md).

## Access rules

- Only `repository/*` (ClickHouse) and services holding a `PostgresClient`
  (Postgres) issue queries. Handlers never do.
- Query for a range through `ResolvedRange`
  ([../../backend/api/src/model/date_range.rs](../../backend/api/src/model/date_range.rs)),
  not by formatting dates inline.
- New time-series reads should go through the canonical timeline service, not
  straight at `heartbeats` — [../architecture.md](../architecture.md).
