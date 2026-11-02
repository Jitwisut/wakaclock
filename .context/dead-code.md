# Dead / Unwired Code — read before treating anything as a reference

This repository was scaffolded from an unrelated **"Multi-Shop eCommerce
Connector"** template. The template code that was never compiled has been
removed (2026-10-29, `codex/repo-cleanup`); see "Removed template code" below.
Git history still contains it. Do not restore it, and do not copy patterns from
old commits: they look idiomatic for this repo and are wrong.

Rule: before using a backend directory as a reference implementation, confirm it
is reachable from [../backend/api/src/main.rs](../backend/api/src/main.rs) via a
`mod`/`pub mod` chain.

## Removed template code

These had no `mod` declaration (or were not listed by their parent `mod.rs`), so
the live build never compiled them. `cargo check --workspace --all-targets` and
the server library tests are unchanged by their removal.

| Removed path | What it was |
| --- | --- |
| `backend/api/src_ecommerce_backup/` (361 files) | the original e-commerce backend, kept as a backup |
| `backend/api/src/interfaces/` (11 files) | e-commerce platform/gateway/queue/webhook abstractions |
| `backend/api/src/docs/` (6 files) | utoipa OpenAPI definitions for the template's gateway API. The live API has no wired-up OpenAPI surface. |
| `backend/api/src/model/v1/` (~104 files) | product/order/vector/webhook DTOs for shops (BigCommerce, WooCommerce, Lazada, eBay, Walmart, Medusa) |
| `backend/api/src/helpers/auth/`, `helpers/mapping/` (~27 files) | never declared; real auth lives in `middleware/auth.rs`. `helpers/mod.rs` remains as an empty module. |
| `backend/api/src/handlers/v1/handler.rs` | not listed in `handlers/v1/mod.rs`; referenced `super::platform` / `super::gateway`, which did not exist |

## Infrastructure declared but not yet connected by the server

`make infra-up` starts PostgreSQL, ClickHouse, Redis, RabbitMQ and Redpanda. The
Rust server uses ClickHouse and optionally PostgreSQL; Kafka and RabbitMQ adapters
are feature/config gated, and their workers are separate processes:

| Service | Reality |
| --- | --- |
| Redis | `presence_store.rs` is deliberately in-memory; `CacheStore`/lock contracts are live but no provider adapter is wired yet. |
| RabbitMQ | `infrastructure/rabbitmq.rs` implements `JobPublisher`/`JobConsumer`; the dedicated `src/bin/job-worker.rs` runs the outbox relay and `analytics.reprocess` processor (plans R3/R4). `src/bin/outbox-relay.rs` remains a legacy stub that errors on purpose. |
| Redpanda | `infrastructure/kafka.rs` implements the feature-gated producer/consumer. Heartbeat workers and the K5 AI usage fact-sink/verifier connect only when their mode is enabled. |
| Qdrant (`docker-compose.dev.yaml`) | Only the removed `model/v1` tree used it; no live code references it. |

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
| `frontend/app/ralph/`, `frontend/app/tasks/`, `frontend/app/new_com.md` | PRD/task scratch documents |
| `frontend/app/coverage/`, `test-results/`, `playwright-report/` | generated |
| `frontend/app/th/` | a single stray `layout.tsx`; purpose `Unknown / Needs verification` |

Screenshots, Playwright scratch output and the scraped WakaTime API dumps were
removed with the template code. The readable route list is
[../wakatime-api-routes.md](../wakatime-api-routes.md).

## Security flag

`backend/api/credentials/` contained e-commerce template configuration. Those
files are removed from the working tree and the path is now ignored. The
published Git history still needs a separate credential-rotation/history audit;
removing files from the tree does not rewrite history or claim that old blobs
are unrecoverable.
