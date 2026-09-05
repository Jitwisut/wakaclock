# Project Overview

## What it is

Wakaclock — shipped under the product name **AtoAxis** — is a hosted
developer time-tracking platform that is wire-compatible with WakaTime.
Existing WakaTime editor plugins can point at this server instead.

## Core loop

1. A client (editor extension, CLI, browser extension, AI-agent hook) emits a
   **heartbeat**: "user X was editing entity `src/foo.rs`, project `wakaclock`,
   language Rust, at time T, is_write=true".
2. `POST /api/v1/heartbeats` (or `/heartbeats.bulk`) accepts it and writes to
   the ClickHouse `wakaclock.heartbeats` table.
3. Services derive everything else from that table: durations, daily/range
   summaries, project analytics, leaderboards, AI attribution, keystroke stats.
4. The Next.js dashboard reads those derived endpoints.

## Domain vocabulary

| Term | Meaning |
| --- | --- |
| **Heartbeat** | One point-in-time activity event from a client. The raw fact. |
| **Activity interval / segment** | A proven window of activity inside a heartbeat (strict 120s evidence window). See [../backend/api/src/services/activity_timeline.rs](../backend/api/src/services/activity_timeline.rs). |
| **Canonical timeline** | Overlap-free merged intervals for a user+range. Every duration/summary number is derived from this, not from raw heartbeats. |
| **Idle timeout** | Max gap between proven intervals before the clock stops. Configurable via `IDLE_TIMEOUT_MINUTES`. |
| **Duration block** | A contiguous run of canonical intervals with the same project/language/category/entity. |
| **Project identity** | Stable `project_id` resolution across renames/merges (`project_merge`, `project_rule`, `project_identity`). |
| **AI attribution** | Marking heartbeat lines as AI-generated, with agent/provider/model provenance. |
| **Presence / coworking** | Live "who is coding now" rooms. In-memory only today. |
| **Phase 9 / Phase 10** | Internal roadmap phases. Phase 10 = org/team/billing/enterprise on PostgreSQL. |

## Reference material already in the repo

Do not restate these — read them when the task needs them.

- [../PRD.md](../PRD.md) — product requirements.
- [../plan.md](../plan.md) — very large phased implementation plan. Source of
  truth for intended design; **not** proof that something is built.
- [../docs/wakatime-compatibility-manifest.json](../docs/wakatime-compatibility-manifest.json)
  — which WakaTime endpoints are covered.
- [../wakatime-api-routes.md](../wakatime-api-routes.md) — the upstream WakaTime
  API surface being mirrored.
- [../docs/phase-9-api-examples.md](../docs/phase-9-api-examples.md),
  [../docs/phase-10-feature-matrix.json](../docs/phase-10-feature-matrix.json).
- [../README.md](../README.md) — user-facing setup.

## Surfaces

| Surface | Location | Context |
| --- | --- | --- |
| API server | `backend/api/` | [backend/overview.md](backend/overview.md) |
| Dashboard + marketing site | `frontend/app/` | [frontend/overview.md](frontend/overview.md) |
| VS Code extension | `extensions/vscode/` | [extensions/overview.md](extensions/overview.md) |
| Browser extension | `extensions/browser/` | same |
| Desktop tracker | `extensions/desktop-tracker/` | same |
| AI-agent hooks | `extensions/ai-agents/` | same |
| CLI + language server | `backend/api/crates/wakaclock-cli`, `-ls` | [backend/crates.md](backend/crates.md) |

## Status caveat

This repository was scaffolded from an unrelated e-commerce connector template.
A significant fraction of `backend/api/src_ecommerce_backup/` and a few legacy
model/helper directories are inherited template code that is **not part of the
live product**. Always check
[dead-code.md](dead-code.md) before assuming a directory is live.
