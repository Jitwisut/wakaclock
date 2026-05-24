# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**ecommerce-connect** — a Rust multi-tenant e-commerce gateway connecting 20+ platforms (TikTok Shop, Shopee, Lazada, Shopify, Amazon, etc.) with unified APIs for product management, synchronization, and AI-powered vector search.

## Common Commands

| Command | Purpose |
|---|---|
| `make super` | Run check + lint + test + build (full validation) |
| `make check` | `cargo check --all-features` |
| `make lint` | `cargo clippy -- -D warnings` |
| `make test` | `cargo test` |
| `make build` | `cargo build --release` |
| `make fix` | `cargo fix --allow-dirty --allow-staged && cargo fmt` |
| `cargo test <test_name>` | Run a single test |
| `cargo test --lib <module>::tests` | Run tests for a specific module |

## Architecture

Clean Architecture with 4 layers. Dependencies point inward: Presentation → Application → Domain → Infrastructure.

- **`handlers/`** (Presentation) — Axum HTTP handlers, versioned under `v1/` split into `gateway/` (external) and `platform/` (internal management)
- **`services/`** (Application) — Business logic: product, vector search, webhook, OAuth, product sync, backpressure, DLQ
- **`repository/`** + **`interfaces/`** (Domain) — Data access traits and implementations (ClickHouse, Qdrant, unified product, webhook)
- **`infrastructure/`** + **`client/`** (Infrastructure) — DI container (`app/container.rs`), database/cache/queue connections, 20+ platform connectors, Casbin RBAC, observability
- **`worker/`** — Background consumers: product sync, vector sync, batch processor, webhook ingest, crawler
- **`model/`** — DTOs and domain models, versioned under `v1/` split into `gateway/` and `platfrom/` (known typo)
- **`middleware/`** — Auth, CORS, rate limiting, error handling, usage tracking
- **`helpers/`** — Crypto/JWT (`auth/`), platform data mappers (`mapping/`)
- **`modules/`** — Additional binary entry points (product_consumer)

### Key Patterns

- **DI Container**: `infrastructure/app/container.rs` — `App` struct (aliased as `AppState`) holds `Arc` references to all managers
- **Trait-first**: Define contracts in `interfaces/` before writing implementations
- **PlatformGateway trait**: All e-commerce connectors implement this (connect, callback, list_products, get_product, sync_inventory, refresh_token). Factory in `client/ecommerce/connector.rs`
- **Worker trait**: `async_trait`-based with `start()`, `stop()`, `process_job()`
- **Error handling**: `InterfaceError` enum via `thiserror`, `AppResult<T>` alias

### Runtime Modes (CLI via clap)

1. **`web-service`** (port 8080) — Full API server with all routes and middleware
2. **`gateway`** (port 8081) — Lightweight stateless gateway only
3. **`consumer`** — Background workers, selected via `--tasks` flag (e.g., `product-sync-to-ch-list`, `product-detail`, `product-embedding`, `webhook`)

Can also be set via `RUN_MODE` env var.

## Tech Stack

Axum 0.7, Tokio, ClickHouse, Qdrant (vector DB), Redis, RabbitMQ (via Lapin), Sea-ORM 0.12, Casbin (RBAC), jsonwebtoken/argon2/aes-gcm, OpenTelemetry + Prometheus, Utoipa + Aide (API docs).

## Code Conventions

- **MSRV**: 1.94.0
- **No `std::sync::Mutex`/`RwLock`** — use `tokio::sync::` async variants
- **No `stdout`/`stderr`** — use `tracing` macros
- **Clippy thresholds**: max 8 args, 25 cognitive complexity, 350 lines/fn
- **Banned variable names**: `foo`, `bar`, `baz`, `quux`, `temp`, `tmp`, `data2`, `result2`, `ret`, `val`
- **Mocking**: `mockall` 0.12 for test doubles
- **Tests are inline**: `#[cfg(test)]` modules inside source files, no separate `tests/` directory

## Config

Configuration loads from environment variables via `Config::from_env()` in `src/config/mod.rs`. The app tries `dotenvy::dotenv().ok()` at startup. Credential files live in `credentials/` (Casbin model/policy, platform configs).

## Docker

- `Dockerfile` — multi-stage release build on `rust:1.81-slim-bookworm`
- `Dockerfile.dev` — nightly with `cargo-watch` for hot reload
- Docker Compose files are at `../../docker-compose*.yaml` (two levels up)
