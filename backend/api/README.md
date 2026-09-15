# AtoAxis API

The live backend for AtoAxis developer activity tracking. It accepts
WakaTime-compatible telemetry, stores high-volume analytics in ClickHouse and
keeps transactional product state in PostgreSQL.

## Runtime architecture

- **HTTP API:** Rust, Axum, `/api/v1` and `/api/v2`
- **Telemetry:** ClickHouse (heartbeats, summaries, AI usage and projections)
- **Transactional state:** PostgreSQL Phase 10 foundation (identity, OAuth,
  organizations, integrations, goals, exports and billing records)
- **Cache/rate limits:** Redis-compatible `CacheStore`/lock contracts
- **Async jobs:** Kafka-compatible `EventBus` and RabbitMQ-compatible
  `JobQueue` contracts; provider adapters are injected by deployment
- **Object storage:** S3-compatible `ObjectStore` contract for exports
- **Credentials:** KMS/Vault-backed `CredentialVault`; plaintext tokens must
  never be persisted or returned by an API

The provider-neutral contracts live in `src/infrastructure/contracts.rs`.
Worker binaries in `src/bin/` share the lifecycle runtime and are intentionally
independent of any one managed infrastructure vendor.

## Local development

Prerequisites: Rust stable, Node/npm for the frontend, and Docker Compose.

```bash
# From the repository root
make install
make infra-up
make env-setup

# Start the API (http://127.0.0.1:8080 by default)
make dev-backend
```

The Rust workspace is **this directory**. From another working directory use
`cargo --manifest-path backend/api/Cargo.toml ...`; there is no second Rust
workspace at the repository root.

For local infrastructure, `docker-compose.yml` provides PostgreSQL,
ClickHouse, Redis, Redpanda (Kafka-compatible) and RabbitMQ. The API runs
ClickHouse migrations at startup and applies the PostgreSQL foundation
migration when `POSTGRES_URL` is configured.

## Configuration

Required in production:

```env
CLICKHOUSE_URL=https://clickhouse.example.internal:8443
POSTGRES_URL=postgres://...
REDIS_URL=rediss://:<password>@redis.example.internal:6380
PRESENCE_V2_ENABLED=true
JWT_SECRET=<long random value>
CORS_ORIGINS=https://atoaxis.com,https://www.atoaxis.com
```

`ALLOW_INSECURE_JWT_SECRET=1` is for local development only. Never use
`CORS_ORIGINS=*` for a multi-tenant deployment. `IDLE_TIMEOUT_MINUTES`
defaults to 15 and controls the WakaTime-style pause bridge. Keep
`DURATION_CALCULATION_MODE=legacy` while collecting a parity baseline; switch to
`combined_v2` only after the seven-day comparison passes. The new mode exposes the
WakaTime-comparable, measured-AI, and additional-AI seconds alongside the legacy
total, and can be rolled back by changing the value back to `legacy` and restarting.

Presence v2 is opt-in during rollout. Setting `PRESENCE_V2_ENABLED=true` requires
both `POSTGRES_URL` and `REDIS_URL` to be reachable at boot. `redis://` and
TLS-protected `rediss://` URLs are supported. PostgreSQL migration
`002_presence_v2.sql` creates durable team rooms and the three fixed pairing
zones; Redis owns only leases/live snapshots and ClickHouse owns session history.

Exports are closed by default. Set `ATOAXIS_EXPORT_MODE=job` only when the API,
`export-worker`, RabbitMQ job queue and S3-compatible object store are deployed
together; boot validation rejects a partial configuration. The default remains
safe for rollback and local installations, while a worker can still drain already
accepted export jobs.

Account deletion is closed by default. Set `ATOAXIS_ACCOUNT_DELETION_MODE=job`
only after the dedicated `account-deletion` worker and its PostgreSQL,
ClickHouse, object-store and cache purge verification have passed in an isolated
environment. `DELETE /api/v2/me` is session-only and requires `{"confirm":true}`;
it returns `202` only after the account tombstone and system job/outbox commit. The
request writes an account tombstone before enqueueing cleanup;
Kafka fact-sinks reject later records for that account into a metadata-only DLQ.

The frontend uses `https://api.atoaxis.com` as its production API origin. Set
`NEXT_PUBLIC_WAKACLOCK_API_URL` to a local API URL during development.

## Authentication and data-lifecycle rollout

- PostgreSQL is required for new registrations. It owns credentials when configured;
  boot migrates legacy ClickHouse credentials once. Keep PostgreSQL configured after
  cutover: reverting to ClickHouse-only authentication is not a supported rollback.
- Requests consult the authoritative store, including revocation, expiry and active
  account state. Session tokens are registered in PostgreSQL; existing sessions must
  sign in again after this rollout. API keys remain compatible and are migrated.
- API keys are displayed only by their generation response. GET returns `api_key: null`.
  Startup clears the historical `api_key_plain` column. Existing backups need their own
  retention/rotation review; a live-table migration cannot erase historical backups.
- Use `sslmode=require` in `POSTGRES_URL` for remote TLS connections. The pool verifies
  certificates using public trust roots, bounds connection/statement waits and replaces
  disconnected clients. Private-CA deployments need an appropriate trust configuration.
- Configure `TRUSTED_PROXY_IPS` with exact comma-separated reverse-proxy IPs to use
  `X-Forwarded-For` for auth rate limits. Without this setting, only the TCP peer is trusted.
  Limits remain per API process; distributed rate limiting is a separate follow-up.
- `/api/v1/import/wakatime` accepts `{ "dump_json": "...JSON export contents..." }`.
  Server paths are rejected. The Settings UI uploads a local file (1 MiB / 10,000
  heartbeats maximum). Identical imports reuse stable record IDs.
- Canonical time reads derive segments from the latest raw heartbeat revision,
  including delayed uploads. Durable tombstones exclude deleted IDs and prevent
  retransmission from restoring them. Legacy aggregate tables still need full
  versioned invalidation/rebuild work; do not use them as the authority for deleted data.
- Startup migrations serialize across API replicas sharing PostgreSQL. Reprocess apply
  jobs serialize per user, but legacy aggregate replay is not an atomic snapshot swap.

Run the disposable two-replica regression suite after building the server:

```bash
python3 scripts/backend-security-smoke-runtime.py \
  --binary backend/api/target/debug/wakaclock-server \
  --clickhouse-test-url http://127.0.0.1:58129 \
  --postgres-test-url postgres://test:test@127.0.0.1:55439/test
```

Run this command from the repository root against isolated test databases only.
The runner creates test identities, exercises credential revocation and terminates
API connections in that test database to verify reconnect behavior.

## Public contracts

### WakaTime compatibility (`/api/v1`)

The compatibility manifest at
[`docs/wakatime-compatibility-manifest.json`](../../docs/wakatime-compatibility-manifest.json)
lists all 87 inventoried routes, their auth requirements, scopes, envelopes,
pagination and current implementation status. Basic API-key auth and Bearer
OAuth are supported on implemented routes. WakaTime v1 response shapes are not
silently changed.

### AtoAxis API (`/api/v2`)

Responses use:

```json
{
  "data": {},
  "meta": {
    "request_id": "uuid",
    "generated_at": "2026-08-24T00:00:00Z",
    "timezone": "UTC",
    "data_freshness": "near_real_time",
    "coverage": {}
  }
}
```

The `coverage` field is present whenever provider/client data is incomplete.
Unknown AI attribution remains unknown; it is never silently counted as human
or AI activity.

Implemented v2 route families include capabilities, analytics, AI effectiveness
and follow-up, goals, exports, profiles/share links, integrations, VCS,
organizations/teams, SSO/SCIM management, leaderboards, reports, developer
apps and API-key rotation. The manifest and route tests are the source of truth
for what is production-ready.

## Workers

The following binaries provide separate deployment units:

```text
heartbeat-enrichment   outbox-relay       integration-sync
export-worker           projection-worker  report-worker
billing-reconciliation account-deletion   job-worker
```

`job-worker`, `projection-worker`, and `export-worker` have registered processors,
but only `analytics.reprocess` is enabled by default. Projection rebuild is opt-in
with `ATOAXIS_PROJECTION_REBUILD_MODE=job`; exports remain guarded until their
object-store and end-to-end gates are complete. `report-worker`,
`integration-sync`, and `billing-reconciliation` intentionally fail closed because
their provider processors are not registered. `account-deletion` has a registered
processor but remains closed unless `ATOAXIS_ACCOUNT_DELETION_MODE=job` is set and
the object-store dependency is ready.
`ATOAXIS_WORKER_ONESHOT=1` does not bypass these checks. Report scheduling, new
integration credentials, and export creation return 503 before persisting new work
while the corresponding capability is disabled. Existing records remain
readable/cancellable where the service supports it. Capabilities expose
`available: false` for these incomplete workflows.

Queue consumption, retry/dead-letter processing, artifact delivery, provider sync
and cross-store account deletion are not interchangeable: deploy only workers whose
processor and dependency gates are enabled. Do not deploy the fail-closed binaries
as healthy consumers merely because they compile.

## Quality gates

```bash
cargo fmt --all -- --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace

# Opt-in ClickHouse SQL regression tests against an isolated instance
CLICKHOUSE_TEST_URL=http://localhost:8123 \
  cargo test --workspace -- --ignored --test-threads=1
```

The three ClickHouse integration tests are deliberately ignored in ordinary
unit runs so a developer cannot accidentally mutate a normal development
database. CI runs them in a dedicated isolated ClickHouse job.

## Security and privacy

- Tenant authorization is resolved server-side before analytics IDs reach
  ClickHouse.
- API keys, OAuth refresh tokens and provider credentials are encrypted or
  hashed; plaintext values are returned only once when explicitly required.
- Prompt text, model responses, source code and diffs are never sent or stored.
  AI analytics contain metadata such as counts, token classes, model and
  attribution coverage only.
- Logs and exports must redact credentials, prompts, source and session tokens.
- Account deletion workers must remove/anonymize data across PostgreSQL,
  ClickHouse, object storage, caches and queued jobs.

## Deployment

Build the server and all worker binaries with:

```bash
cargo build --manifest-path backend/api/Cargo.toml --workspace --release
```

Package the resulting binaries into OCI images and deploy them on the managed
runtime. The Next.js frontend deploys from `main` through Netlify; its build
uses local WOFF2 assets and does not require Google Fonts network access.
