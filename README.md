# AtoAxis

> Developer time tracking with complete history — a privacy-first,
> WakaTime-compatible alternative.

The product is branded **AtoAxis**. The Rust package and installed client still
use the historical `wakaclock` name for compatibility (`wakaclock-cli`,
`wakaclock`, `~/.wakaclock` and editor setting keys).

## What it does

AtoAxis collects heartbeats from editor/CLI clients and derives durations,
projects, languages, keystrokes and AI-attribution analytics. It keeps the full
history for an account and never stores source code, prompts, AI responses or
diff text.

Current product strengths include:

- tree-sitter language/dependency detection and stable project identity;
- ClickHouse projections for time-series summaries and AI usage;
- AI attribution metadata (provider, model, token classes, line counts,
  confidence and coverage) without content retention;
- keystroke/character counters, project rules and project merging;
- a WakaTime-compatible `/api/v1` surface plus an AtoAxis `/api/v2` envelope;
- PostgreSQL-backed identity, OAuth, organizations, goals, exports and billing
  foundation;
- VS Code, Rust CLI/LSP, browser and desktop adapter paths under a shared
  privacy/tracking protocol.

The [capability registry](docs/wakatime-compatibility-manifest.json) is the
source of truth for what is production-ready. It intentionally records
unfinished WakaTime routes instead of advertising them as complete.

## Architecture

```text
editor/CLI/browser/desktop clients
                 │  heartbeat + OAuth
                 ▼
          AtoAxis Rust API
        ┌────────┼─────────┐
        │        │         │
   PostgreSQL ClickHouse  Redis
 transactions  telemetry  cache/locks
                 │
      Kafka-compatible telemetry
      RabbitMQ-compatible jobs
```

The frontend is a Next.js App Router application. It deploys from `main` to
Netlify at `https://atoaxis.com`; the Rust API and workers deploy as OCI
services on managed infrastructure. Docker Compose is for local development.

## Repository layout

```text
backend/api/                 Rust API workspace and worker binaries
backend/api/crates/          core, AST, CLI and LSP crates
frontend/app/                Next.js dashboard and marketing site
extensions/vscode/            first-party VS Code client
extensions/browser/           WebExtension shared tracker and manifests
extensions/desktop-tracker/  desktop privacy policy/core scaffolding
docs/                         compatibility and architecture contracts
.github/workflows/            CI and extension release workflows
Makefile                      repository quality/development commands
```

The live Rust workspace is `backend/api`; there is intentionally no repository
root `Cargo.toml`. The old e-commerce template remains under
`backend/api/src_ecommerce_backup/` and is not part of the build.

## Prerequisites

- Rust stable (with rustfmt and clippy)
- Node.js 20+ and npm 11+
- Docker and Docker Compose

`frontend/app/package-lock.json` is the only frontend dependency lockfile.

## Quick start

```bash
make install
make infra-up
make env-setup

# terminal 1
make dev-backend

# terminal 2
cd frontend/app && npm run dev
```

The API listens on `http://localhost:8080`, the dashboard on
`http://localhost:3000`, ClickHouse UI on `http://localhost:5521` and RabbitMQ
management on `http://localhost:15672`.

## API overview

WakaTime clients authenticate with Basic API key or Bearer OAuth. AtoAxis v2
responses use a stable envelope:

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

Important route families:

| Surface | Examples |
| --- | --- |
| WakaTime v1 | `/api/v1/heartbeats`, `/api/v1/summaries`, `/api/v1/stats`, `/api/v1/projects` |
| AtoAxis analytics | `/api/v2/capabilities`, `/api/v2/me/analytics`, `/api/v2/me/ai/effectiveness` |
| Goals/exports | `/api/v2/me/goals`, `/api/v2/exports`, WakaTime data dumps |
| Integrations/VCS | `/api/v2/integrations`, `/api/v2/repositories`, `/api/v2/commits`, `/api/v2/pull-requests` |
| Organizations | `/api/v2/organizations`, teams, audit, SSO/SCIM and billing routes |
| OAuth | `/oauth/authorize`, `/oauth/token`, `/oauth/revoke`, device flow |

The manifest lists all 87 inventoried WakaTime routes and their current status,
auth, scope, pagination and response behavior. Verify it with:

```bash
node scripts/verify-compatibility-manifest.mjs
```

## Quality gates

```bash
# all local gates
make check

# individual gates
make lint
make test
make build
make check-seo

# ClickHouse SQL regressions against an isolated database
cd backend/api
CLICKHOUSE_TEST_URL=http://localhost:8123 \
  cargo test --workspace -- --ignored --test-threads=1
```

CI runs frontend typecheck/lint/unit/build/prerender, browser tests, Rust
format/Clippy/tests, isolated ClickHouse tests, extension tests, compatibility
manifest validation, secret scanning and dependency audit.

## Privacy and security invariants

- PostgreSQL is the source of truth for identity, access, organization,
  configuration and billing; ClickHouse is the analytics source of truth.
- Server-side authorization resolves accessible IDs before querying ClickHouse.
- Tokens and provider credentials are encrypted/hashed and never returned after
  their one-time creation response.
- Unknown AI attribution remains unknown and metrics include coverage.
- Prompt text, responses, source, diffs and sensitive window titles are not
  transmitted or persisted.
- Queue messages are versioned, tenant-scoped and idempotent; retries are
  bounded and failed work is auditable in a dead-letter path.

## Deployment configuration

Frontend production variables:

```env
NEXT_PUBLIC_APP_URL=https://atoaxis.com
NEXT_PUBLIC_WAKACLOCK_API_URL=https://api.atoaxis.com
```

Backend production minimum:

```env
CLICKHOUSE_URL=<managed ClickHouse URL>
POSTGRES_URL=<managed PostgreSQL URL>
REDIS_URL=<managed Redis URL; use rediss:// when TLS is required>
PRESENCE_V2_ENABLED=true
JWT_SECRET=<long random value>
CORS_ORIGINS=https://atoaxis.com,https://www.atoaxis.com
```

Do not use `ALLOW_INSECURE_JWT_SECRET=1` or `CORS_ORIGINS=*` in production.

## License

Client plugins and SDKs are intended for Apache-2.0 distribution. The hosted
server may remain proprietary; see the applicable license files for each
component.
