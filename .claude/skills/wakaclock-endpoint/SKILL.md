---
name: wakaclock-endpoint
description: Add or change a backend HTTP endpoint, handler, service, or repository in the Rust API (backend/api). Use when the task involves creating an API route, editing a handler in handlers/v1 or v2.rs, adding a service or repository, changing a response shape, or adding a ClickHouse/Postgres query. Covers the handler → service → repository layering, auth resolution, and route registration for this repo.
---

# Adding or changing a backend endpoint

**Read [.context/workflows/adding-endpoint.md](../../../.context/workflows/adding-endpoint.md) now**, then follow it. It has the 9-step sequence and a worked example. Related: [.context/backend/overview.md](../../../.context/backend/overview.md), [.context/backend/api-routes.md](../../../.context/backend/api-routes.md).

## Non-negotiables (do not violate even before reading further)

1. **Run cargo from `backend/api`, never the repo root.** The root `Cargo.toml`
   is broken.
2. **Check the module is reachable first.** The uncompiled e-commerce template
   trees (`interfaces/`, `docs/`, `model/v1/`, `helpers/*`,
   `handlers/v1/handler.rs`) were removed; old commits still contain them.
   Confirm a module is declared via the `mod` chain before using it as a
   reference, and never copy template patterns —
   [.context/dead-code.md](../../../.context/dead-code.md).
3. **Handler → service → repository.** Handlers extract HTTP types, call
   `auth::resolve_user_id`, call exactly one service method, map the error.
   They never build SQL or open a DB client. Services never import axum types.
4. **Identity comes only from `auth::resolve_user_id(&state, &headers)`.**
   Returning `None` is a hard 401. Never fall back to a `user_id` from a query
   string or body — any caller can forge it.
5. **Wire new services/repositories into `AppState`**
   (`infrastructure/app/init.rs`) or they are unreachable.
6. **New DDL goes in the owning repository's `migrate()`, idempotent, additive.**
   `migrate()` runs on every boot and the order in `main.rs` is load-bearing —
   [.context/data/migrations.md](../../../.context/data/migrations.md).

## Reference implementation

`backend/api/src/handlers/v1/summaries.rs` — the canonical minimal handler.

## Before declaring done

```bash
cd backend/api && cargo test && cargo clippy -- -D warnings
```
