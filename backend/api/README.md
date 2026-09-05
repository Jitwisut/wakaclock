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
defaults to 15 and controls the WakaTime-style pause bridge.

Presence v2 is opt-in during rollout. Setting `PRESENCE_V2_ENABLED=true` requires
both `POSTGRES_URL` and `REDIS_URL` to be reachable at boot. `redis://` and
TLS-protected `rediss://` URLs are supported. PostgreSQL migration
`002_presence_v2.sql` creates durable team rooms and the three fixed pairing
zones; Redis owns only leases/live snapshots and ClickHouse owns session history.

The frontend uses `https://api.atoaxis.com` as its production API origin. Set
`NEXT_PUBLIC_WAKACLOCK_API_URL` to a local API URL during development.

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
export-worker           report-worker      billing-reconciliation
account-deletion
```

Each process reads `ATOAXIS_JOB_QUEUE_URL`, propagates envelope metadata
(`event_id`, `event_version`, `tenant_id`, `occurred_at`, `trace_id` and
`idempotency_key`) and exits cleanly on SIGINT/SIGTERM. Set
`ATOAXIS_WORKER_ONESHOT=1` for a readiness check in CI. Production queue and
storage adapters must provide duplicate detection, bounded exponential retry,
dead-letter handling and audit-friendly replay.

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
