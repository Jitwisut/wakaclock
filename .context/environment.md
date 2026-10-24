# Environment Variables

**Names only. Never write a value into any file in `.context/` or `CLAUDE.md`.**

## Backend — `backend/api`

Read via `std::env::var` in [../backend/api/src/config/mod.rs](../backend/api/src/config/mod.rs)
and the crates. `.env` is loaded by `dotenvy` at startup.

| Variable | Required | Notes |
| --- | --- | --- |
| `JWT_SECRET` | **yes** | Server refuses to start without it unless `ALLOW_INSECURE_JWT_SECRET=1`. |
| `ALLOW_INSECURE_JWT_SECRET` | no | `1`/`true` permits a hardcoded dev secret. Local only — every session it issues is forgeable. |
| `CLICKHOUSE_URL` | yes | Primary datastore. The server does not create the database: it must already exist (docker-compose creates `wakaclock` via `CLICKHOUSE_DB`), or startup fails with `UNKNOWN_DATABASE`. |
| `CLICKHOUSE_USER`, `CLICKHOUSE_PASSWORD` | no | |
| `CLICKHOUSE_DATABASE` / `CLICKHOUSE_DB` | no | Both names are read; defaults exist. |
| `POSTGRES_URL` | no | Absent ⇒ `AppState.postgres` is `None` and Phase 10 org/billing paths degrade. |
| `ATOAXIS_TEAM_PRIVACY_LEDGER_PATH` | Team reads/worker | Absolute path to shared independent privacy registry outside database backups; missing/stale fails closed. |
| `ATOAXIS_EDITOR_LINE_METRICS_ENABLED` | production: yes | Accepts versioned editor line metrics (`editor-before-after-v1`) and advertises them in `/api/v2/capabilities`. Defaults off. While off, clients keep the line-measurement corrections in their local queue and report them as pending, so dashboards show delivery as incomplete; enable it on every server clients send to. Accepts `1`/`true`/`on`. |
| `ATOAXIS_COPILOT_DAILY_ENABLED` | no | Explicit opt-in for separate GitHub Copilot provider-day counters. Defaults off; accepts `1`/`true`/`on`, and an unrecognised value refuses startup. Requires existing installation permissions and Team rollout/consent. No session, token or PR cost inference. |
| `ATOAXIS_COPILOT_WEEKLY_ENABLED` | no | Opt-in for privacy-safe UTC weekly Copilot reports/CSV; also needs `ATOAXIS_COPILOT_DAILY_ENABLED` and Team enabled for the organization. Accepts `1`/`true`/`on`; an unrecognised value refuses startup. |
| `ATOAXIS_STRIPE_PRICE_CATALOG_PATH` | Team billing catalog | Server-managed approved package configuration; absent/invalid stays unavailable. No default prices. Contract is preparatory; Checkout remains disabled until its separate gates pass. |
| `ATOAXIS_BUILD_REVISION` | build metadata | Compile-time revision for Team readiness; unset is unavailable, never inferred from runtime checkout. |
| `POSTGRES_MAX_CONNECTIONS` | no | |
| `DATABASE_URL` | no | Also read; overlaps with `POSTGRES_URL` — `Unknown / Needs verification` which wins. |
| `CORS_ORIGINS` | no | Comma-separated allowlist, or `*` for permissive. `*` is only safe single-tenant. |
| `ATOAXIS_APP_URL` | no | Public browser origin used in OAuth/device approval links; defaults to `http://localhost:3000`. |
| `SERVER_HOST`, `SERVER_PORT` | no | Default `0.0.0.0`, see `config/mod.rs`. |
| `INTERNAL_API_SECRET` | no | Unset ⇒ `POST /api/v1/internal/subscription` returns 404 rather than being reachable uncredentialed. |
| `IDLE_TIMEOUT_MINUTES` | no | Max pause between proven activity intervals. `0` disables idle bridging. |
| `AGENT_IDLE_TIMEOUT_MINUTES` | no | Agent-only bridge allowance. Keep the default for WakaTime-compatible `total_seconds`; set `0` when consumers should rely on measured `ai_coding_seconds` instead of bridging agent pauses. |
| `ATOAXIS_EVENT_BUS_URL` | no | Kafka bootstrap servers, comma-separated bare `host:port`. Used by the Kafka producer/consumers when heartbeat or AI usage is in `verify`/`kafka` mode. |
| `ATOAXIS_EVENT_BUS_SASL_MECHANISM`, `ATOAXIS_EVENT_BUS_SASL_USERNAME`, `ATOAXIS_EVENT_BUS_SASL_PASSWORD` | no | All three or none. Mechanism `PLAIN`, `SCRAM-SHA-256` or `SCRAM-SHA-512`. Refused without `ATOAXIS_EVENT_BUS_URL`. |
| `ATOAXIS_EVENT_BUS_TLS` | no | Defaults to `true` when SASL is set, else `false`; SASL with `false` is refused. |
| `ATOAXIS_JOB_QUEUE_URL` | no | `amqp://` or `amqps://` RabbitMQ URL. The API uses PostgreSQL as the job/outbox source of truth; the dedicated `job-worker` process runs the outbox relay and processors. Never printed unredacted; a plaintext URL to a non-local host logs a warning. |
| `ATOAXIS_INGEST_MODE` | no | Heartbeat mode: `direct` (default) / `verify` / `kafka`. Non-`direct` needs `ATOAXIS_EVENT_BUS_URL`; `kafka` also needs PostgreSQL state and an explicit cohort. |
| `ATOAXIS_INGEST_KAFKA_COHORT` | no | `all`, `percent:<0-100>` or `users:<uuid>,…`. Required for `kafka` mode; ignored (not refused) in other modes so a rollback deploy can leave it set. |
| `ATOAXIS_AI_USAGE_INGEST_MODE` | no | AI usage mode: `direct` (default) / `verify` / `kafka`, independent from heartbeat mode. |
| `ATOAXIS_AI_USAGE_KAFKA_COHORT` | no | `all`, `percent:<0-100>` or `users:<uuid>,…`; required only when AI usage mode is `kafka`, never inferred as `all`. |
| `ATOAXIS_AI_USAGE_REQUIRE_CONTRACT_V2` | no | Defaults to `false`; when `true`, AI usage clients without `X-AtoAxis-Ai-Usage-Contract: 2` receive `426`. Rollback to direct with this flag unset accepts legacy clients again. |
| `ATOAXIS_AI_USAGE_KAFKA_BATCH_SIZE`, `ATOAXIS_AI_USAGE_KAFKA_BATCH_WAIT_MS` | no | AI usage consumer batch bounds; defaults `1000` and `500ms`. |
| `ATOAXIS_AI_USAGE_KAFKA_RETRY_MIN_MS`, `ATOAXIS_AI_USAGE_KAFKA_RETRY_MAX_MS` | no | AI usage consumer retry bounds; defaults `1000ms` and `60000ms`. |
| `ATOAXIS_REPROCESS_MODE` | no | `sync` (default) / `job`. `job` needs `ATOAXIS_JOB_QUEUE_URL` and `POSTGRES_URL`; requests require `Idempotency-Key` and return `202` while `job-worker` processes them. |
| `ATOAXIS_PROJECTION_REBUILD_MODE` | no | `sync` (default) / `job`. `job` needs `ATOAXIS_JOB_QUEUE_URL` and `POSTGRES_URL`; requests require `Idempotency-Key` and are processed by `projection-worker`. |
| `ATOAXIS_EXPORT_MODE` | no | `disabled` (default) / `job`. `job` additionally requires `POSTGRES_URL`, `ATOAXIS_JOB_QUEUE_URL` and a complete S3 object-store configuration; the API refuses to boot with an incomplete setup. Existing jobs may still be drained by `export-worker` during rollback. |
| `ATOAXIS_ACCOUNT_DELETION_MODE` | no | `disabled` (default) / `job`. `job` requires `POSTGRES_URL`, `ATOAXIS_JOB_QUEUE_URL`, the account-deletion worker and a complete S3 object-store configuration. The API tombstones an account before enqueueing cleanup; enable only after cross-store e2e and audit gates pass. |
| `ATOAXIS_JOB_WORKER_PREFETCH` | no | Worker concurrency/prefetch; defaults to `4`. |
| `ATOAXIS_JOB_LEASE_SECONDS` | no | Lease duration for a claimed job; defaults to `300`. |
| `ATOAXIS_JOB_RENEW_SECONDS` | no | Lease renewal interval; defaults to `60`. |
| `ATOAXIS_JOB_SHUTDOWN_SECONDS` | no | Grace period for in-flight jobs during shutdown; defaults to `30`. |
| `ATOAXIS_JOB_WORKER_HEALTH_HOST`, `ATOAXIS_JOB_WORKER_HEALTH_PORT` | no | Worker liveness/readiness listener; defaults to `0.0.0.0:8081`. |
| `REDIS_URL` | Presence v2 | Redis (`redis://` or `rediss://`) used by Presence v2; required when `PRESENCE_V2_ENABLED=true`. `ATOAXIS_REDIS_URL` is not read by the server. |
| `ATOAXIS_OBJECT_STORE_S3_ENDPOINT`, `ATOAXIS_OBJECT_STORE_S3_BUCKET` | no | Together enable the S3-compatible export artifact store; endpoint must be HTTPS in non-local deployments. A partial configuration refuses startup. |
| `ATOAXIS_OBJECT_STORE_S3_REGION` | no | SigV4 region; defaults to `us-east-1` when the object store is configured. |
| `ATOAXIS_OBJECT_STORE_S3_ACCESS_KEY`, `ATOAXIS_OBJECT_STORE_S3_SECRET_KEY` | no | Required with the S3 endpoint/bucket; never logged or committed. |
| `ATOAXIS_OBJECT_STORE_S3_SESSION_TOKEN` | no | Optional temporary-credential session token. |
| `ATOAXIS_OBJECT_STORE_S3_PATH_STYLE` | no | Defaults to `true` for S3-compatible endpoints such as MinIO; set `false` for virtual-hosted AWS S3 addressing. |
| `ATOAXIS_OBJECT_STORE_ALLOW_HTTP` | no | Defaults to `false`; explicit local-development opt-in for an HTTP MinIO endpoint. |
| `ATOAXIS_KMS_KEY_ID` | no | KMS/Vault key identifier for credential sealing. |
| `ATOAXIS_EXPORT_WORKER_PREFETCH`, `EXPORT_WORKER_HEALTH_HOST`, `EXPORT_WORKER_HEALTH_PORT` | no | Export worker tuning and health listener; defaults to prefetch `1` and `0.0.0.0:8082`. |
| `ATOAXIS_PROJECTION_WORKER_PREFETCH`, `PROJECTION_WORKER_HEALTH_HOST`, `PROJECTION_WORKER_HEALTH_PORT` | no | Projection worker tuning and health listener; defaults to prefetch `2` and `0.0.0.0:8086`. |
| `ATOAXIS_ACCOUNT_DELETION_WORKER_PREFETCH`, `ACCOUNT_DELETION_WORKER_HEALTH_HOST`, `ACCOUNT_DELETION_WORKER_HEALTH_PORT` | no | Account-deletion worker tuning and health listener; defaults to prefetch `1` and `0.0.0.0:8087`. Keep this worker separate from the generic job worker. |

### Test-only

`CLICKHOUSE_TEST_URL`, `CLICKHOUSE_TEST_USER`, `CLICKHOUSE_TEST_PASSWORD`,
`CLICKHOUSE_TEST_DATABASE` — used by
[../backend/api/src/test_support.rs](../backend/api/src/test_support.rs).
`RABBITMQ_TEST_URL` and `RABBITMQ_TEST_RESTART_CONTAINER` — used by the RabbitMQ
adapter tests in [../backend/api/src/infrastructure/rabbitmq.rs](../backend/api/src/infrastructure/rabbitmq.rs).

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
| `EARLY_ACCESS_DATABASE_URL` | Postgres connection string for the public Early Access list (`app/api/early-access/route.ts`). Falls back to `POSTGRES_URL`, the name the Vercel Postgres/Neon integration injects; `DATABASE_URL` is deliberately **not** read. Server-only and read directly in `lib/early-access/store.ts`, deliberately **not** in `env.ts`, so a hosted URL with query parameters can never fail the build. Unset means the form gets 503 at runtime. |
| `POSTGRES_URL` | fallback for `EARLY_ACCESS_DATABASE_URL` only (see above) |

## Compose

[../docker-compose.yml](../docker-compose.yml) and
[../docker-compose.dev.yaml](../docker-compose.dev.yaml) set credentials for
containers. Treat any value there as a local-development default, not something
to reuse or document.

## Team Checkout worker (internal, not a launch approval)

- `ATOAXIS_TEAM_STRIPE_CHECKOUT_WORKER_ENABLED`: default false; accepts explicit true/1 or false/0. When enabled, processes one already accepted checkout intent per tick using the existing Stripe account cooldown and approved price catalog. Does not enable a customer-facing confirmation endpoint or paid entitlement.
- `ATOAXIS_TEAM_STRIPE_TEST_CHECKOUT_ENABLED`: default off; explicit `1`/`true` allows the internal confirmation API only with Stripe **test mode** and an approved policy. Live mode is rejected even with this flag. This does not enable paid entitlement or production readiness.
- `ATOAXIS_STRIPE_CHECKOUT_POLICY_PATH`: server-owned JSON file with `schema_version: 1`, `owner_approved: true`, HTTPS `return_origin` (origin only, no credentials/path/query/fragment), and explicit boolean `automatic_tax`. The accepted request freezes these values; browsers cannot supply them. No owner values/configuration have been created.
- Price quotes add `test_checkout_confirmation_available`; absent/false means preview only. API/UI confirmation and fresh hosted destination lookup are implemented for internal testing; browser/Stripe certification and complete payment/seat verification remain pending.

## Team usage admission scans (internal, default off)

- `ATOAXIS_TEAM_USAGE_ADMISSION_WORKER_ENABLED`: explicit true/1 enables bounded canonical-metadata scans in the existing `team-privacy-worker`; absent/false/0 leaves them disabled. Requires the Team feature flag and fresh independent privacy ledger. Each tick starts at most five pages of 100 records with a 10-second start budget and 10-second operation deadline. Does not enroll an organization, start a trial, enable checkout, or change personal capture/delivery. Public activation remains closed until Copilot admission and commercial restore proof are complete.

## Financial enrollment guard operator tool (internal, not authorization)

`team-financial-guard initialize/inspect/verify-database` accepts an explicit private absolute journal path. Initialization requires a reviewed explicit roster and namespace; verification pins the expected namespace and reads existing `POSTGRES_URL` only. `verify-deployment` validates the commercial configuration below with no database/provider access. These commands do not load `.env`, run migrations, contact Stripe or enable Team. Keep this ledger independently retained/versioned outside database backups. Selected writer/read/admission guards are implemented, but full financial-source restore and public activation remain pending.

## Enrollment/observation transaction guard (internal rollout)

- `ATOAXIS_TEAM_FINANCIAL_GUARD_PATH` and `ATOAXIS_TEAM_FINANCIAL_GUARD_NAMESPACE`: must be configured together; private independent journal plus pinned namespace. Invalid or unreadable configuration blocks guarded observations. No automatic creation.
- `ATOAXIS_TEAM_FINANCIAL_GUARD_REQUIRED`: explicit true/1 requires valid configuration independently of DB enrollment rows. False/0/absent is reserved for never-enrolled precommercial environments; it is not a safe production fallback after restore. Billing worker checks this before provider requests.
- Trial requires `CommercialDeployment`, constructed only from explicit required=true/1 plus valid pinned evidence in production. Enrolled Team reads/minting require this configuration too; configured roster authority is retained by provider observations even when activation is off. Invalid encoding is rejected rather than treated as an absent setting.
- Usage-admission, enabled Copilot ingestion and enabled Checkout worker entrypoints preflight this requirement before database/provider work. Cleanup-only privacy and GitHub-only sync remain separate. This does not yet certify every customer/quote/Checkout/portal surface or independent financial-source recovery. Public activation stays disabled.
- Readiness exposes only the safe deployment status, never path/namespace/head/token. `commercial_guard_configured` is a configuration prerequisite, not production readiness or payment proof. Required settings and independently versioned evidence must survive restore; removing all settings cannot be detected as a rollback by a never-commercial local installation.

## Financial-source event component (not enabled)

The same independent journal can read/append scoped source-root proposals, accepted request/key digests, possible-dispatch markers and external outcome identities. No new environment flag, real seed or production emitter is enabled. Runtime source roots are not yet derived from canonical SQL or wired into Stripe workers/readers; the diagnostic-only inventory below does not enable them. Keep `financial_sources=unconfirmed` and public activation disabled; see `docs/atoaxis-team-financial-source-protocol-2026-10-23.md`. New readers must precede source writers; never remove new events for rollback. Baseline approval, SQL/provider reconciliation, financial retention and versioned storage remain separate gates.

`team-financial-guard inspect-inventory <private-ledger> --namespace <pin> --organization <id> --account <id> [--live]` uses the existing `POSTGRES_URL` for a read-only canonical SQL preview. Migration055 creates empty heads/tombstones; preview never migrates, seeds, dispatches or grants rights. Output is safe counts/status only. Missing SQL checkpoint is uninitialized even when empty. Account-level ingress proof, semantic writer fencing and runtime source authorization remain unconfirmed; SQL hash agreement alone is not a restore/paid-access proof. See `docs/atoaxis-team-financial-inventory-2026-10-23.md`. No additional product environment flag is introduced.

## Account financial ingress (guarded runtime; real baseline not initialized)

Migration056 and the new journal event family retain immutable signed-notification receipts, including ignored/unbound events. Configured guard receivers require reviewed account+SQL heads, flush Prepare before SQL commit and Confirm before ACK; same-event pending retry uses original metadata/revision and exact predecessor, while committed SQL loss fails closed. Stripe account/job paths and Checkout receipt take account lock before organization/job/binding locks. Checkout inherits its parent's pinned authority rather than rereading a different environment. `inspect-ingress <ledger> --namespace <pin> --account <id> [--live]` is metadata-only and read-only. No automatic seed. Explicit private `prepare-ingress-recovery`/`apply-ingress-recovery` commands support prospective empty-account bootstrap and original pending recovery only; exact digest/scope/ack approval and 15-minute evidence fences are required. Legacy/historical or committed SQL loss stays blocked. See `docs/atoaxis-team-financial-recovery-2026-10-24.md`; no real baseline applied. Legacy unguarded inboxes cannot claim coverage. Organization financial-source readers/writers, approved baseline/recovery, retention/versioned storage and production activation remain gated. See `docs/atoaxis-team-financial-ingress-2026-10-24.md`.
