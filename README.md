# AtoAxis

> Developer time tracking with complete history. A WakaTime-compatible alternative built in Rust.
>
> One timeline for everything you do.

---

**Naming:** the product is branded **AtoAxis**. The binary (`wakaclock-cli`), config
directory (`~/.wakaclock/config.toml`), crate names and editor setting keys still use the
original `wakaclock` naming, and are written that way throughout these docs because that is
what actually ships.

## What is AtoAxis?

AtoAxis tracks how long you spend coding across editors, languages, and projects — then gives you dashboards and insights. It's WakaTime-compatible (existing IDE extensions work via the CLI hub) and adds:

- **AST-based language detection** via tree-sitter — no more guessing `.h` is C vs C++ vs Objective-C
- **ClickHouse-native ETL** with SummingMergeTree/AggregatingMergeTree — zero app-level aggregation
- **AI code attribution** — the VS Code extension can detect and one-click configure the
  bundled Claude Code, Codex CLI and Gemini CLI hooks. Heartbeats carry provider, agent,
  optional model, attribution source/confidence, event id and AI/human line deltas; the
  dashboard aggregates them per agent and per day. Cursor and Copilot still need
  provider-specific adapters because a generic editor change event cannot identify them
  reliably.
- **Keystroke metrics** — keystrokes and characters added/deleted per project and per day
- **User-defined project rules** — regex-based project matching + project merging
- **Complete history** — every account keeps full coding history rather than a limited recent window

### Known limitations

- The only editor plugin in this repo is for VS Code (`extensions/vscode`); other editors connect via the WakaTime protocol.
- Heartbeats support `file`, `app`, `domain` and `url` entity types, but the VS Code extension sends `file` only — there is no desktop or browser client yet.
- Analytics are scoped to a single account; there is no team or organisation rollup.
- Heartbeats never carry source code, prompts, AI responses, or keystroke content — but they DO carry file paths and project names.
- **Delivery model: hosted SaaS.** There is no self-hosted edition for customers. The `docker-compose` files and build steps below are for running this repo in development, not a customer install path.
- The payment gate (`payment_required`) is enforced only on heartbeat ingestion and reads `subscription_status` from the local database — it is not a licence check against a remote server.

## Architecture

```
                         ┌──────────────────────────┐
                         │   wakaclock-server        │
                         │   (Axum + ClickHouse)     │
                         └──────────▲────────────────┘
                                    │ HTTP (heartbeats.bulk)
               ┌────────────────────┼────────────────────┐
               │                    │                     │
    ┌──────────┴──────────┐  ┌──────┴───────┐  ┌─────────┴────────┐
    │   wakaclock-cli     │  │ figma plugin  │  │  desktop app     │
    │   (Rust binary)     │  │ (direct HTTP) │  │  (Tauri, in-proc)│
    └──────────▲──────────┘  └──────────────-┘  └──────────────────┘
               │ child process / LSP
    ┌──────────┼──────────────────┐
    │          │                  │
 VS Code    Zed (via           Blender
 (TS)       wakaclock-ls)      (Python)
```

All IDE extensions delegate to `wakaclock-cli` for heartbeat construction, project/branch detection, language detection, offline queue, and API communication.

## Tech Stack

| Component | Technology |
|-----------|------------|
| Server | Rust, Axum 0.7 |
| Database | ClickHouse (analytics), Redis (cache) |
| CLI | Rust, Clap |
| AST Detection | tree-sitter |
| VS Code Extension | TypeScript |
| Zed Extension | Rust (LSP via tower-lsp) |
| Figma Plugin | TypeScript (direct HTTP) |
| Blender Addon | Python |
| Desktop App | Tauri (Phase 4) |

## Project Structure

```
wakaclock/
├── backend/
│   └── api/                  # Axum server + ClickHouse
│       ├── src/
│       │   ├── client/       # Database, cache, queue clients
│       │   ├── modules/      # Feature modules
│       │   └── main.rs
│       ├── migrations/       # ClickHouse schema
│       └── Cargo.toml
├── frontend/
│   └── app/                  # Next.js dashboard
├── docker-compose.dev.yaml   # ClickHouse, Redis, Qdrant, RabbitMQ
├── Caddyfile                 # Reverse proxy (dev)
├── Makefile                  # Build automation
├── plan.md                   # Full architecture & design doc
└── start.sh                  # Quick start script
```

## Prerequisites

- **Rust** (1.75+) — [rustup.rs](https://rustup.rs/)
- **Node.js** (20+) — [nodejs.org](https://nodejs.org/)
- **pnpm** (9+) — `npm install -g pnpm`
- **Docker** & **Docker Compose** — [docker.com](https://docs.docker.com/get-docker/)

## Quick Start

```bash
# 1. Start infrastructure (ClickHouse, Redis, etc.)
docker compose -f docker-compose.dev.yaml up -d

# 2. Start the backend
cd backend/api
cargo run -- web-service

# 3. Start the frontend (separate terminal)
cd frontend/app
pnpm install && pnpm dev
```

Or use the start script:

```bash
./start.sh                   # Everything
./start.sh --backend-only    # Backend only
./start.sh --frontend-only   # Frontend only
```

### Service URLs

| Service | URL |
|---------|-----|
| Backend API | http://localhost:8080 |
| API Docs (Scalar) | http://localhost:8080/scalar |
| Frontend Dashboard | http://localhost:3000 |
| ClickHouse UI | http://localhost:5521 |
| RabbitMQ Management | http://localhost:15672 |

## API Overview

Auth: `Authorization: Basic base64(api_key)` or `Bearer <api_key>`

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/v1/heartbeats.bulk` | Bulk heartbeat ingestion |
| POST | `/api/v1/heartbeats` | Single heartbeat |
| GET | `/api/v1/heartbeats?date=` | List heartbeats for a day |
| GET | `/api/v1/status_bar/today` | Today's total coding time |
| GET | `/api/v1/durations?date=` | Duration blocks (session detection) |
| GET | `/api/v1/summaries?start=&end=` | Grouped summaries |
| GET | `/api/v1/stats/:range` | Stats (total, avg, best day) |
| GET | `/api/v1/projects` | List projects |
| GET | `/api/v1/insights/:type/:range` | Insights (weekdays, languages) |
| GET | `/api/v1/users/current/ai_stats` | AI vs human code breakdown |
| GET/PUT/DELETE | `/api/v1/project_rules[/:id]` | CRUD regex project rules |
| GET/PUT/DELETE | `/api/v1/project_merges[/:id]` | CRUD merge mappings |
| POST | `/api/v1/import/wakatime` | Import WakaTime data dump |

Full endpoint list in [plan.md](./plan.md).

## Development

```bash
make dev               # Full dev environment
make test              # Run all tests
make lint              # Run linters
make build             # Production build
make docker-up         # Start infrastructure
make docker-down       # Stop infrastructure
```

## ClickHouse ETL

Heartbeats flow through two paths:

**Live ingestion** — `POST /heartbeats.bulk` inserts into `heartbeats` (MergeTree). Eight materialized views auto-fire to populate aggregation tables (`daily_totals`, `language_daily`, `project_daily`, etc.) using SummingMergeTree and AggregatingMergeTree.

**History reprocessing** — For backfills and rule changes, data is inserted into `heartbeats_incoming` (Null engine). Same MVs fire, aggregations update, but raw data is discarded. This keeps disk usage minimal for historical imports.

## Implementation Phases

- **Phase 0** — Workspace bootstrap, ClickHouse schema, Docker setup
- **Phase 1** — Core heartbeat pipeline: CLI + Server + project rules
- **Phase 2** — AST detection (tree-sitter) + VS Code extension
- **Phase 3** — Analytics endpoints + Zed/Figma/Blender extensions
- **Phase 4** — Tauri desktop app (active window tracking, meeting detection)

See [plan.md](./plan.md) for full details.

## License

Confidential — StandUpCode / Lodash (Thailand) Co., Ltd.
