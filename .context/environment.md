# Environment Variables

**Names only. Never write a value into any file in `.context/` or `CLAUDE.md`.**

## Backend — `backend/api`

Read via `std::env::var` in [../backend/api/src/config/mod.rs](../backend/api/src/config/mod.rs)
and the crates. `.env` is loaded by `dotenvy` at startup.

| Variable | Required | Notes |
| --- | --- | --- |
| `JWT_SECRET` | **yes** | Server refuses to start without it unless `ALLOW_INSECURE_JWT_SECRET=1`. |
| `ALLOW_INSECURE_JWT_SECRET` | no | `1`/`true` permits a hardcoded dev secret. Local only — every session it issues is forgeable. |
| `CLICKHOUSE_URL` | yes | Primary datastore. |
| `CLICKHOUSE_USER`, `CLICKHOUSE_PASSWORD` | no | |
| `CLICKHOUSE_DATABASE` / `CLICKHOUSE_DB` | no | Both names are read; defaults exist. |
| `POSTGRES_URL` | no | Absent ⇒ `AppState.postgres` is `None` and Phase 10 org/billing paths degrade. |
| `POSTGRES_MAX_CONNECTIONS` | no | |
| `DATABASE_URL` | no | Also read; overlaps with `POSTGRES_URL` — `Unknown / Needs verification` which wins. |
| `CORS_ORIGINS` | no | Comma-separated allowlist, or `*` for permissive. `*` is only safe single-tenant. |
| `ATOAXIS_APP_URL` | no | Public browser origin used in OAuth/device approval links; defaults to `http://localhost:3000`. |
| `SERVER_HOST`, `SERVER_PORT` | no | Default `0.0.0.0`, see `config/mod.rs`. |
| `INTERNAL_API_SECRET` | no | Unset ⇒ `POST /api/v1/internal/subscription` returns 404 rather than being reachable uncredentialed. |
| `IDLE_TIMEOUT_MINUTES` | no | Max pause between proven activity intervals. `0` disables idle bridging. |
| `AGENT_IDLE_TIMEOUT_MINUTES` | no | Agent-only bridge allowance. Keep the default for WakaTime-compatible `total_seconds`; set `0` when consumers should rely on measured `ai_coding_seconds` instead of bridging agent pauses. |
| `ATOAXIS_EVENT_BUS_URL` | no | Kafka-compatible telemetry bootstrap for workers. |
| `ATOAXIS_JOB_QUEUE_URL` | no | RabbitMQ-compatible job queue URL used by worker binaries. |
| `ATOAXIS_REDIS_URL` | no | Redis-compatible cache/lock provider. |
| `ATOAXIS_OBJECT_STORE_BUCKET` | no | S3-compatible export artifact bucket. |
| `ATOAXIS_KMS_KEY_ID` | no | KMS/Vault key identifier for credential sealing. |

### Test-only

`CLICKHOUSE_TEST_URL`, `CLICKHOUSE_TEST_USER`, `CLICKHOUSE_TEST_PASSWORD`,
`CLICKHOUSE_TEST_DATABASE` — used by
[../backend/api/src/test_support.rs](../backend/api/src/test_support.rs).

### Client crates (CLI / language server / extensions)

`WAKACLOCK_SERVER_URL`, `WAKACLOCK_API_KEY`, `WAKACLOCK_EDITOR`, `EDITOR`.

### Dead-tree only

`PLATFORM_CONFIG_PATH` — belongs to the e-commerce template. See
[dead-code.md](dead-code.md).

## Frontend — `frontend/app`

Validated by zod through `@t3-oss/env-nextjs` in
[../frontend/app/lib/env.ts](../frontend/app/lib/env.ts). Adding a variable
means adding it to **both** the schema block and `runtimeEnv`.

| Variable | Notes |
| --- | --- |
| `NEXT_PUBLIC_WAKACLOCK_API_URL` | **The product variable.** Base URL of the Rust API; defaults to `http://localhost:8080`. `lib/wakaclock/client.ts` appends `/api/v1`. |
| `NEXT_PUBLIC_APP_URL` | Public site URL; Netlify injects a fallback at build time. |
| `NODE_ENV` | |
| `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`, `POSTHOG_API_KEY` | analytics, all optional |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | optional |
| `ARCJET_KEY` | optional; rate limiting / bot protection |
| `DATABASE_URL`, `AUTH_SECRET` | Declared in the schema but **unused by product code** — inherited from the shadcn template. Do not add features that depend on them without checking. |
| `SKIP_ENV_VALIDATION` | bypasses validation during builds |

## Compose

[../docker-compose.yml](../docker-compose.yml) and
[../docker-compose.dev.yaml](../docker-compose.dev.yaml) set credentials for
containers. Treat any value there as a local-development default, not something
to reuse or document.
