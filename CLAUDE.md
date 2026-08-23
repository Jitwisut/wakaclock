# CLAUDE.md

Index for AI agents working in this repository. Keep this file small — detail
lives in `.context/`.

## Project

Wakaclock (product name **AtoAxis**) is a self-hostable, WakaTime-compatible
developer time-tracking platform. Editor/CLI/browser clients send *heartbeats*
to a Rust API; the API stores them in ClickHouse and derives durations,
summaries, project analytics, AI-assistance attribution and team/org reporting,
which a Next.js dashboard renders.

More: [.context/project-overview.md](.context/project-overview.md)

## Tech Stack

- **Backend** — Rust 2021, axum 0.7, tokio, ClickHouse (primary), PostgreSQL
  (optional, Phase 10 org/billing state), utoipa for OpenAPI.
- **Frontend** — Next.js (App Router) + React 19 + TypeScript, Tailwind v4,
  shadcn/ui, TanStack Query, zustand, axios.
- **Clients** — VS Code extension (TypeScript), browser extension, Rust CLI +
  language server, AI-agent hooks.
- **Tooling** — Cargo workspace, Makefile, docker-compose, lefthook, Netlify
  (frontend deploy), GitHub Actions (extension release only).

## Repository Structure

| Path | What it is |
| --- | --- |
| [backend/api/](backend/api/) | Rust API server (`wakaclock-server`) — **the real Cargo workspace root** |
| [backend/api/crates/](backend/api/crates/) | `wakaclock-core`, `-ast`, `-cli`, `-ls` |
| [frontend/app/](frontend/app/) | Next.js app — **package.json lives here, not in `frontend/`** |
| [extensions/](extensions/) | VS Code, browser, desktop-tracker, ai-agents clients |
| [migrations/](migrations/), [backend/api/migrations/](backend/api/migrations/) | SQL files (see caveat in data/migrations.md) |
| [docs/](docs/) | WakaTime compatibility manifest, phase matrices |

## Essential Commands

```bash
# Backend — MUST run from backend/api (root Cargo.toml is broken, see below)
cd backend/api && cargo run          # start API server
cd backend/api && cargo test         # all backend tests
cd backend/api && cargo clippy -- -D warnings

# Frontend — MUST run from frontend/app
cd frontend/app && npm run dev       # dev server, localhost:3000
cd frontend/app && npm run validate  # typecheck + lint:strict + tests
cd frontend/app && npm run test:run

# Infrastructure
make docker-up                       # ClickHouse, Postgres, Redis, RabbitMQ, ...
```

Full list and known-broken targets: [.context/commands.md](.context/commands.md)

## Critical Rules

1. **Never run `cargo` from the repo root.** The root [Cargo.toml](Cargo.toml)
   points at `crates/*` paths that do not exist; `cargo metadata` fails there.
   The working workspace is [backend/api/Cargo.toml](backend/api/Cargo.toml).
2. **Never run `npm`/`pnpm` from `frontend/`.** There is no `package.json`
   there. Use `frontend/app/`.
3. **Do not copy patterns from the dead e-commerce/gateway module tree.** Large
   parts of `backend/api/src` are unreachable template leftovers. Check
   [.context/dead-code.md](.context/dead-code.md) before treating any backend
   directory as a reference implementation.
4. **Handlers never touch the database.** Handler → service → repository. See
   [.context/backend/overview.md](.context/backend/overview.md).
5. **Never trust a client-supplied `user_id`.** Identity comes only from
   `auth::resolve_user_id`. See [.context/backend/auth.md](.context/backend/auth.md).
6. **Every TanStack Query key must include `userId`.** See
   [.context/frontend/data-layer.md](.context/frontend/data-layer.md).
7. **Backend migrations run in code, in order, from `main.rs`.** Ordering is
   load-bearing. See [.context/data/migrations.md](.context/data/migrations.md).
8. **No secrets in committed files.** Env vars by name only:
   [.context/environment.md](.context/environment.md).

## Context Routing — MANDATORY

`.context/**` is not auto-loaded. These are **triggers, not suggestions**: when
a trigger matches the task, Read the listed file **before** writing code, not
after. If a file you read contradicts your plan, the file wins — it was written
from verified repository state.

### Always, before the first edit of a session

- Touching **anything** under `backend/api/src/` →
  [.context/dead-code.md](.context/dead-code.md) first. Roughly a fifth of that
  tree does not compile. Do not use a directory as a reference implementation
  until you have confirmed it is live.

### Backend triggers

| If the task involves | Read BEFORE starting |
| --- | --- |
| Adding or changing an HTTP endpoint | [.context/workflows/adding-endpoint.md](.context/workflows/adding-endpoint.md) |
| Any handler, service, or repository code | [.context/backend/overview.md](.context/backend/overview.md) |
| Routing, request shapes, response/error format | [.context/backend/api-routes.md](.context/backend/api-routes.md) |
| Login, API keys, tokens, sessions, roles, permissions, OAuth, SCIM | [.context/backend/auth.md](.context/backend/auth.md) |
| SQL, a new table or column, ClickHouse or Postgres | [.context/data/overview.md](.context/data/overview.md) + [.context/data/migrations.md](.context/data/migrations.md) |
| `wakaclock-core`, `-ast`, `-cli`, `-ls`, or the heartbeat wire format | [.context/backend/crates.md](.context/backend/crates.md) |

### Frontend triggers

| If the task involves | Read BEFORE starting |
| --- | --- |
| Adding or changing a dashboard panel or page | [.context/workflows/adding-dashboard-panel.md](.context/workflows/adding-dashboard-panel.md) |
| Any file under `frontend/app/` | [.context/frontend/overview.md](.context/frontend/overview.md) — it lists where [frontend/app/CLAUDE.md](frontend/app/CLAUDE.md) is stale (zustand, env vars) |
| Data fetching, TanStack Query, the API client, session or login state | [.context/frontend/data-layer.md](.context/frontend/data-layer.md) |

### Cross-cutting triggers

| If the task involves | Read BEFORE starting |
| --- | --- |
| Running, building, or testing anything | [.context/commands.md](.context/commands.md) — several Makefile targets are broken |
| Adding a config value or env var | [.context/environment.md](.context/environment.md) |
| Naming, style, error handling, or "what is the convention here" | [.context/conventions.md](.context/conventions.md) — never present a Recommended Convention as an existing rule |
| The VS Code / browser / desktop / AI-agent clients | [.context/extensions/overview.md](.context/extensions/overview.md) |
| A bug, failure, or "why is this not working" | [.context/workflows/debugging.md](.context/workflows/debugging.md) |
| Explaining the system, or a change spanning ≥2 layers | [.context/architecture.md](.context/architecture.md) |
| Product behaviour, domain terms, WakaTime compatibility | [.context/project-overview.md](.context/project-overview.md) |

### Enforcement

Two mechanisms back this routing up, so it does not rely on judgement alone:

- **Skills** (`.claude/skills/`) — `wakaclock-endpoint`, `wakaclock-panel`,
  `wakaclock-debug` load automatically when a task matches their description,
  and carry the non-negotiable rules inline plus a pointer to the full workflow.
- **PreToolUse hooks** (`.claude/settings.json`, scripts in `.claude/hooks/`) —
  ask for confirmation before editing a file in an unreachable backend tree, and
  before running `cargo` from the repo root, `npm`/`pnpm` outside a
  `package.json` directory, or a known-broken Makefile target.

A hook prompt is a signal to stop and read the file it names, not an obstacle to
click past.

### Loading rules

- Read the **specific** file the trigger names. Do not preload `.context/` wholesale.
- Two triggers matching means read both.
- No trigger matching means proceed — do not go hunting.
- Re-read a file if the task returns to its topic after a long detour.

Nested agent docs exist at [frontend/app/CLAUDE.md](frontend/app/CLAUDE.md) and
[frontend/app/AGENTS.md](frontend/app/AGENTS.md); Claude Code auto-loads the
former in that subtree. They describe the **shadcn template layer** and are
stale in places — [.context/frontend/overview.md](.context/frontend/overview.md)
says where.
