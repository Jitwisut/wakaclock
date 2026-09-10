# Dead / Unwired Code — read before treating anything as a reference

This repository was scaffolded from an unrelated **"Multi-Shop eCommerce
Connector"** template. Large parts of it are not compiled, not routed, and not
part of the product. Copying their patterns will produce code that looks
idiomatic for this repo and is wrong.

Rule: before using a backend directory as a reference implementation, confirm it
is reachable from [../backend/api/src/main.rs](../backend/api/src/main.rs) via a
`mod`/`pub mod` chain.

## Not compiled at all (no `mod` declaration)

`main.rs` declares only: `config`, `handlers`, `helpers`, `infrastructure`,
`middleware`, `model`, `repository`, `services`. Everything else under `src/` is
dead.

| Path | Why dead |
| --- | --- |
| `backend/api/src/interfaces/` (11 files) | no `mod interfaces;` in `main.rs`. Contains `platform.rs`, `platform_gateway.rs`, `queue.rs`, `webhook.rs`, `worker.rs`, `cache.rs` — e-commerce template abstractions. |
| `backend/api/src/docs/` (6 files) | no `mod docs;`. utoipa OpenAPI definitions for the gateway/platform template API. The live API has no wired-up OpenAPI surface. |
| `backend/api/src/model/v1/` (~104 files) | `model/mod.rs` does not declare `pub mod v1;`. Product/order/vector/webhook DTOs for shops (BigCommerce, WooCommerce, Lazada, eBay, Walmart, Medusa). Note the directory is misspelled `platfrom`. |
| `backend/api/src/helpers/auth/`, `backend/api/src/helpers/mapping/` (~27 files) | `helpers/mod.rs` is literally `// Empty helpers module` — the subdirectories are never declared. Real auth lives in `middleware/auth.rs`. |
| `backend/api/src/handlers/v1/handler.rs` | not listed in `handlers/v1/mod.rs`; references `super::platform` / `super::gateway`, which do not exist. |

## Infrastructure declared but not yet connected by the server

`make infra-up` starts PostgreSQL, ClickHouse, Redis and RabbitMQ; Redpanda is
opt-in via `make infra-kafka-up` (compose profile `kafka`) until the Kafka
adapter lands. The Rust server currently uses ClickHouse and optionally
PostgreSQL; Redis, RabbitMQ and Redpanda are represented by provider-neutral
contracts, and only RabbitMQ has an adapter so far:

| Service | Reality |
| --- | --- |
| Redis | `presence_store.rs` is deliberately in-memory; `CacheStore`/lock contracts are live but no provider adapter is wired yet. |
| RabbitMQ | `infrastructure/rabbitmq.rs` implements `JobPublisher`/`JobConsumer` and is tested against a real broker, but nothing constructs it at runtime yet — the outbox relay (R2) and worker runtime (R3) will. |
| Redpanda | Contracts in `contracts.rs` and settings in `config/brokers.rs` only; no adapter yet (plan K1). |
| Qdrant (`docker-compose.dev.yaml`) | Referenced only from the dead `model/v1` tree. |

Actually used: **ClickHouse** (required) and **PostgreSQL** (optional). See
[data/overview.md](data/overview.md).

## Build-file history

The invalid repository-root Cargo manifest and old e-commerce Makefile were
removed. The live workspace is [../backend/api/Cargo.toml](../backend/api/Cargo.toml)
and the root [../Makefile](../Makefile) points at `backend/api` and
`frontend/app`. Keep this page updated if a legacy file is reintroduced.
- [../migrations/001_init.sql](../migrations/001_init.sql) — standalone SQL not
  referenced by any code path. See [data/migrations.md](data/migrations.md).

## Not product code — do not read for context

| Path | What it is |
| --- | --- |
| [../imageagentsview/](../imageagentsview/) | tracked PNG screenshots |
| [../.playwright-mcp/](../.playwright-mcp/) | Playwright MCP scratch output |
| `frontend/app/ralph/`, `frontend/app/tasks/`, `frontend/app/new_com.md` | PRD/task scratch documents |
| `frontend/app/coverage/`, `test-results/`, `playwright-report/` | generated |
| `frontend/app/th/` | a single stray `layout.tsx`; purpose `Unknown / Needs verification` |
| [../wakatime-api-routes-raw.json](../wakatime-api-routes-raw.json), [../wakatime-api-text-extract.json](../wakatime-api-text-extract.json), [../wakatime-api-methods.json](../wakatime-api-methods.json) | scraped WakaTime API dumps; the readable version is [../wakatime-api-routes.md](../wakatime-api-routes.md) |

## Security flag

`backend/api/credentials/` contained e-commerce template configuration. Those
files are removed from the working tree and the path is now ignored. The
published Git history still needs a separate credential-rotation/history audit;
this change does not rewrite history or claim that old blobs are unrecoverable.
