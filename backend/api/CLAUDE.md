# AtoAxis backend contributor guide

`backend/api` is the live Rust workspace for the AtoAxis developer-time
tracking API. The old e-commerce tree under `src_ecommerce_backup/` is
historical and is not part of the build.

## Commands

Run these from `backend/api` (or use the root `Makefile`):

```bash
cargo fmt --all
cargo check --workspace
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
cargo build --workspace --release
```

Three ClickHouse SQL regression tests are opt-in:

```bash
CLICKHOUSE_TEST_URL=http://localhost:8123 \
  cargo test --workspace -- --ignored --test-threads=1
```

## Live module layout

- `src/main.rs` — Axum server, `/health`, `/api/v1`, `/api/v2`, OAuth, public
  share routes and SCIM.
- `src/handlers/` — HTTP adapters. Resolve authorization before querying
  analytics; never trust a client-supplied user ID.
- `src/services/` — domain rules, entitlements, OAuth, goals, integrations,
  analytics and imports/exports.
- `src/repository/` — ClickHouse analytics and PostgreSQL transactional access.
- `src/infrastructure/` — database clients, auth cache, rate limits, provider-
  neutral queue/cache/object-store/credential contracts and app state.
- `src/model/` — request, response and analytics types.
- `src/bin/` — independently deployable worker entrypoints.
- `crates/wakaclock-core` — client-side heartbeat/AI attribution logic.
- `crates/wakaclock-ast` — language/dependency detection.
- `crates/wakaclock-cli` and `crates/wakaclock-ls` — CLI and LSP clients.

`src_ecommerce_backup/` and its interfaces are not imported by `main.rs` and
must not be used for new AtoAxis features. New infrastructure dependencies
belong under `src/infrastructure/contracts.rs` and should receive an adapter
and an integration test before production rollout.

## Data and privacy invariants

- PostgreSQL is the source of truth for identity, access, organization,
  configuration, billing and OAuth state.
- ClickHouse is the source of truth for telemetry analytics.
- Redis is cache/lock only; it is never the sole copy of product data.
- Every queue message carries `event_id`, `event_version`, `tenant_id`,
  `occurred_at`, `trace_id` and `idempotency_key`.
- Do not store or log source code, prompts, AI responses, diffs, API keys or
  OAuth refresh tokens. Use metadata and coverage reasons instead.
- Credentials must pass through `CredentialVault`, and every provider sync is
  idempotent with bounded retry and a dead-letter path.

## Configuration

Production must set `JWT_SECRET`, `CLICKHOUSE_URL`, `POSTGRES_URL`, `REDIS_URL`
and `PRESENCE_V2_ENABLED=true` when Presence v2 is enabled, plus an
explicit allowlist such as:

```env
CORS_ORIGINS=https://atoaxis.com,https://www.atoaxis.com
```

`ALLOW_INSECURE_JWT_SECRET=1` and `CORS_ORIGINS=*` are development-only
overrides. `IDLE_TIMEOUT_MINUTES` defaults to 15, matching WakaTime's default
pause timeout.

## Contract ownership

`docs/wakatime-compatibility-manifest.json` is the inventory for all 87 v1
routes. `/api/v1` preserves WakaTime envelopes and auth behavior; `/api/v2`
uses AtoAxis's `data`/`meta` envelope and must include coverage when data is
incomplete. Run `node scripts/verify-compatibility-manifest.mjs` after editing
the manifest.
