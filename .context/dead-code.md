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

## Infrastructure declared but unused by the server

`make docker-up` starts services the Rust code never connects to:

| Service | Reality |
| --- | --- |
| Redis | Referenced only in comments. `presence_store.rs` is deliberately in-memory; `interfaces/queue.rs` is dead. |
| RabbitMQ / Redpanda | No client dependency in [../backend/api/Cargo.toml](../backend/api/Cargo.toml). |
| Qdrant (`docker-compose.dev.yaml`) | Referenced only from the dead `model/v1` tree. |

Actually used: **ClickHouse** (required) and **PostgreSQL** (optional). See
[data/overview.md](data/overview.md).

## Broken build files

- [../Cargo.toml](../Cargo.toml) (root) — declares members at `crates/*`, which
  do not exist at repo root. `cargo metadata` fails. The live workspace is
  [../backend/api/Cargo.toml](../backend/api/Cargo.toml).
- [../Makefile](../Makefile) — `FRONTEND_DIR = frontend` is wrong; see
  [commands.md](commands.md) for the affected targets.
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

`backend/api/credentials/` is **tracked in git and not gitignored**. It holds
e-commerce template config (`platforms.json`, `policy.csv`, `model.conf`,
`crendential.json`). Do not read, print, or copy its contents into any file.
Flag it to the user for review — it belongs to the dead template tree and
should probably be removed and the history audited.
