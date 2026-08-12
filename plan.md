# Wakaclock — Reverse-Engineer WakaTime & Build Better

## Context

WakaTime uses a hub-and-spoke architecture: all IDE extensions delegate to `wakatime-cli` (Go) for heartbeat construction, project/branch detection, language detection (file extension + shebang), offline queue, and API comms. Only Figma breaks this (browser sandbox → direct HTTP).

**Wakaclock's differentiators**: AST-based language detection via tree-sitter (not just file extensions), ClickHouse-native ETL with SummingMergeTree/AggregatingMergeTree (zero app-level aggregation), user-defined project regex rules + project merging, self-hosted-first. All Rust.

---

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

---

## Monorepo Structure

```
wakaclock/
├── Cargo.toml                    # Workspace root
├── crates/
│   ├── wakaclock-core/           # Shared types, config, offline queue, API client
│   ├── wakaclock-ast/            # Tree-sitter language + dependency detection
│   ├── wakaclock-cli/            # Hub CLI binary (clap)
│   ├── wakaclock-ls/             # LSP server for Zed (tower-lsp)
│   ├── wakaclock-server/         # Axum backend + ClickHouse
│   └── wakaclock-desktop/        # Tauri desktop app (Phase 4)
├── extensions/
│   ├── vscode/                   # TypeScript, spawns CLI
│   ├── zed/                      # Rust, uses wakaclock-ls
│   ├── figma/                    # TypeScript, direct HTTP
│   └── blender/                  # Python, spawns CLI
├── migrations/
│   └── 001_init.sql              # ClickHouse schema (full ETL)
└── docker-compose.yml            # ClickHouse for dev
```

### Server Breakdown

```
crates/wakaclock-server/src/
├── main.rs               # Axum bootstrap, signal handling
├── config.rs             # Env config (CH url/user/pass, port, sync interval)
├── error.rs              # AppError enum (ClickHouse, Validation, Auth, NotFound)
├── state.rs              # AppState: Arc<Inner> { ch, config, project_rules_cache, http_client }
│
├── db/
│   ├── ch_client.rs      # ChClient: .execute(), .query<T>(), .insert<T>(), .json_insert<T>()
│   └── migrations.rs     # Read migrations/*.sql, execute on startup
│
├── models/
│   ├── heartbeat.rs      # Heartbeat (ReplicatedMergeTree row)
│   ├── daily_total.rs    # DailyTotal (ReplicatedSummingMergeTree)
│   ├── language_daily.rs # LanguageDaily (ReplicatedSummingMergeTree)
│   ├── project_daily.rs  # ProjectDaily (ReplicatedSummingMergeTree)
│   ├── editor_daily.rs   # EditorDaily (ReplicatedSummingMergeTree)
│   ├── os_daily.rs       # OsDaily (ReplicatedSummingMergeTree)
│   ├── insight_agg.rs    # InsightAgg (ReplicatedAggregatingMergeTree)
│   ├── project_rule.rs   # ProjectRule (ReplicatedReplacingMergeTree)
│   ├── project_merge.rs  # ProjectMerge (ReplicatedReplacingMergeTree)
│   ├── project.rs        # Project metadata (ReplicatedReplacingMergeTree)
│   ├── sync_state.rs     # SyncState (ReplicatedReplacingMergeTree)
│   └── api_response.rs   # WakaTime-compatible JSON response shapes
│
├── services/
│   ├── heartbeat_service.rs      # Validate → resolve project rules → bulk INSERT → MVs auto-fire
│   ├── duration_service.rs       # neighbor() window fn, gap > 15min = new session
│   ├── summary_service.rs        # daily_totals + JOIN dimensions, apply project_merges
│   ├── stats_service.rs          # Total time, daily avg, best day, breakdowns
│   ├── insight_service.rs        # sumMerge/countMerge/uniqMerge on insights_agg
│   ├── project_rule_service.rs   # CRUD + regex validation + in-memory cache (Arc<RwLock>)
│   ├── project_merge_service.rs  # CRUD, validates no circular merges
│   ├── reprocess_service.rs      # TRUNCATE range → re-resolve → INSERT INTO Null engine
│   ├── import_service.rs         # Parse WakaTime JSON export → INSERT INTO Null engine
│   ├── ai_stats_service.rs       # Queries ai_daily: AI lines, human keystrokes, AI %
│   ├── keystroke_service.rs      # Queries keystroke_daily: keystrokes, chars by project
│   └── auth_service.rs           # Register, validate API key (Basic/Bearer), rate limit
│
├── routes/
│   ├── mod.rs             # Router wiring
│   ├── health.rs          # GET /health
│   ├── auth.rs            # POST /auth/register
│   ├── heartbeats.rs      # POST /heartbeats[.bulk], GET /heartbeats?date=
│   ├── durations.rs       # GET /durations?date=
│   ├── summaries.rs       # GET /summaries?start=&end=
│   ├── projects.rs        # GET /projects
│   ├── stats.rs           # GET /stats/:range
│   ├── insights.rs        # GET /insights/:type/:range
│   ├── all_time.rs        # GET /all_time_since_today
│   ├── status_bar.rs      # GET /status_bar/today
│   ├── users.rs           # GET /users/current
│   ├── project_rules.rs   # GET/PUT/DELETE /project_rules[/:id]
│   ├── project_merges.rs  # GET/PUT/DELETE /project_merges[/:id]
│   ├── ai_stats.rs        # GET /users/current/ai_stats?start=&end=
│   ├── keystroke_stats.rs # GET /users/current/keystroke_stats?date=
│   ├── reprocess.rs       # POST /reprocess
│   └── import.rs          # POST /import/wakatime
│
└── middleware/
    ├── auth.rs            # Extract API key, inject UserId
    ├── logging.rs         # Request/response tracing with duration
    └── rate_limit.rs      # Per-API-key rate limiting (governor)
```

### Crate Dependency Graph

```
wakaclock-core  ← (no internal deps, the gravity center)
    ↑       ↑
wakaclock-ast   (depends on core for types)
    ↑       ↑
wakaclock-cli   (depends on core + ast)
    ↑
wakaclock-ls    (depends on core + ast)

wakaclock-server  (depends on core only — receives pre-processed heartbeats)
wakaclock-desktop (depends on core + ast — Phase 4)
```

---

## Heartbeat Data Model

```rust
pub struct Heartbeat {
    // --- WakaTime-compatible fields ---
    pub entity: String,           // file path, URL, app name
    pub entity_type: EntityType,  // File | Domain | Url | App
    pub time: f64,                // Unix epoch with ms precision
    pub project: Option<String>,
    pub branch: Option<String>,
    pub language: Option<String>,
    pub dependencies: Vec<String>,
    pub lines: Option<u32>,
    pub line_number: Option<u32>,
    pub cursor_position: Option<u32>,
    pub is_write: bool,
    pub category: Category,       // Coding | Building | Debugging | Designing | Modeling | Meeting
    pub user_agent: String,
    pub machine_name: Option<String>,

    // --- Wakaclock additions ---
    pub ast_language: Option<String>,   // tree-sitter detected
    pub ast_confidence: Option<f32>,    // 0.0–1.0

    // Keystroke tracking
    pub keystrokes: Option<u32>,        // keystrokes since last heartbeat
    pub chars_added: Option<u32>,       // characters inserted
    pub chars_deleted: Option<u32>,     // characters removed

    // AI agent tracking
    pub is_ai_generated: bool,          // true if change was made by AI agent
    pub ai_agent: Option<String>,       // "claude-code" | "copilot" | "cursor" | "aider" | etc.
    pub ai_lines_added: Option<u32>,    // lines added by AI in this heartbeat window
    pub ai_lines_deleted: Option<u32>,  // lines removed by AI
}
```

---

## Keystroke Timeout & Tracking

The IDE extension tracks keystrokes in a per-file rolling buffer:

**Buffer state** (per file, in extension memory):
- `last_keystroke_at` — updated on every key
- `keystroke_count` — incremented per key
- `chars_added` / `chars_deleted` — from text change events

**Heartbeat triggers:**
1. File save (`is_write=true`) — always send
2. Keystroke after 2min gap on same file — send
3. 30s flush timer fires & buffer has keystrokes
4. File switch (different entity) — flush old file

**Session boundaries:**
- 5min no keystrokes → idle (no heartbeat sent)
- 15min no heartbeats → gap in duration calculation

**On heartbeat send:** attach `keystrokes`, `chars_added`, `chars_deleted`, then reset counters.

**Timeline example:**

| Time | Event |
|------|-------|
| t=0s | User types in main.rs (keystrokes accumulate) |
| t=5s | Still typing (keystrokes: 47, chars_added: 38, chars_deleted: 9) |
| t=30s | Flush timer → heartbeat sent with {keystrokes: 47, chars_added: 38, ...} |
| t=35s | Switch to lib.rs → flush main.rs buffer |
| t=60s | User types in lib.rs |
| t=90s | Flush timer → heartbeat for lib.rs |
| t=390s | No activity for 5min → idle, no heartbeat |
| t=600s | User resumes → new heartbeat (gap detected) |

---

## AI Agent Code Tracking

**Problem:** WakaTime counts AI-generated code the same as human code.
**Solution:** Track what percentage of code is written by AI agents vs human keystrokes.

### Detection Methods

**Method 1 — Text Change Delta Analysis**
- Track changes via `onDidChangeTextDocument`
- If change is > N characters AND no keystroke in last 500ms → likely AI-generated
- If change arrives while known AI extension is active → mark as AI

**Method 2 — Extension API Detection (VS Code)**
- Listen for `InlineCompletionItem` events (Copilot accepts)
- Detect active terminal commands from known AI CLIs: `claude`, `aider`, `cursor`, `copilot`
- Track `vscode.commands` for known AI actions
- Check active extensions: `github.copilot`, `cursor.*`, `continue.continue`, `codeium.*`

**Method 3 — Git Diff Attribution (CLI-level, post-hoc)**
- On file save, compare git diff since last heartbeat
- Lines added with no corresponding keystrokes → AI
- Commit message patterns: `Co-Authored-By: Claude`, `[Copilot]`, `aider:` → mark entire commit as AI

**Output per heartbeat:** `is_ai_generated`, `ai_agent`, `ai_lines_added`, `ai_lines_deleted`, `keystrokes` (0 for AI, N for human)

---

## ClickHouse ETL

### Dual Ingestion Paths

```
PATH A: LIVE INGESTION (stores raw + aggregates)
─────────────────────────────────────────────────
POST /heartbeats.bulk
     │
     ▼
┌──────────────────────────────────┐
│  heartbeats (ReplicatedMergeTree)          │ ← raw data STORED (queryable)
│  ORDER BY (user_id, date, time)  │
└──────────┬───────────────────────┘
           │ 8 Materialized Views auto-fire on INSERT
           ├──▶ mv_daily_summary      ──▶ daily_totals      (ReplicatedSummingMergeTree)
           ├──▶ mv_lang_summary       ──▶ language_daily     (ReplicatedSummingMergeTree)
           ├──▶ mv_project_summary    ──▶ project_daily      (ReplicatedSummingMergeTree)
           ├──▶ mv_editor_summary     ──▶ editor_daily       (ReplicatedSummingMergeTree)
           ├──▶ mv_os_summary         ──▶ os_daily           (ReplicatedSummingMergeTree)
           ├──▶ mv_insights_agg       ──▶ insights_agg       (ReplicatedAggregatingMergeTree)
           ├──▶ mv_ai_summary         ──▶ ai_daily           (ReplicatedSummingMergeTree)
           └──▶ mv_keystroke_summary  ──▶ keystroke_daily    (ReplicatedSummingMergeTree)


PATH B: HISTORY REPROCESSING (aggregates only, no raw storage)
──────────────────────────────────────────────────────────────
Used for: backfilling historical data, re-running ETL after rule changes,
importing WakaTime data dumps, reprocessing with updated project rules.

INSERT INTO heartbeats_incoming
     │
     ▼
┌──────────────────────────────────┐
│  heartbeats_incoming (Null)      │ ← data DISCARDED after MVs process it
└──────────┬───────────────────────┘
           │ 8 Materialized Views (same logic, targets same tables)
           ├──▶ mv_inc_daily_summary      ──▶ daily_totals
           ├──▶ mv_inc_lang_summary       ──▶ language_daily
           ├──▶ mv_inc_project_summary    ──▶ project_daily
           ├──▶ mv_inc_editor_summary     ──▶ editor_daily
           ├──▶ mv_inc_os_summary         ──▶ os_daily
           ├──▶ mv_inc_insights_agg       ──▶ insights_agg
           ├──▶ mv_inc_ai_summary         ──▶ ai_daily
           └──▶ mv_inc_keystroke_summary  ──▶ keystroke_daily
```

**Null engine properties:**
- Data passes through MVs → aggregations update → raw data discarded
- No disk usage for raw heartbeats (only aggregated tables grow)
- ReplicatedSummingMergeTree/ReplicatedAggregatingMergeTree correctly merge partial sums
- Safe to replay same data (idempotent for additive aggregations)

### Reprocessing Workflow

When a user updates project rules:
1. TRUNCATE affected ReplicatedSummingMergeTree tables for the date range
2. SELECT heartbeats for affected dates from `heartbeats` table
3. Apply new project rules in Rust (re-resolve project names)
4. INSERT INTO `heartbeats_incoming` (Null engine) with updated projects
5. MVs fire → aggregations rebuilt with new project names
6. Raw data in `heartbeats` table is UNCHANGED

### Tables

| # | Table | Engine | Dimensions | Metrics | ORDER BY |
|---|-------|--------|------------|---------|----------|
| 1 | `heartbeats` | ReplicatedMergeTree | user_id, entity, project, language, branch, editor, os, machine, type, category | time, is_write, lines, lineno, cursor_pos, ast_language, ast_confidence, keystrokes, chars_added, chars_deleted, is_ai_generated, ai_agent, ai_lines_added, ai_lines_deleted | (user_id, toDate(time), time) |
| 1b | `heartbeats_incoming` | Null | Same as heartbeats | Same as heartbeats | N/A |
| 2 | `daily_totals` | ReplicatedSummingMergeTree | user_id, date | total_seconds, heartbeat_count | (user_id, date) |
| 3 | `language_daily` | ReplicatedSummingMergeTree | user_id, date, language | total_seconds, heartbeat_count | (user_id, date, language) |
| 4 | `project_daily` | ReplicatedSummingMergeTree | user_id, date, project | total_seconds, heartbeat_count | (user_id, date, project) |
| 5 | `editor_daily` | ReplicatedSummingMergeTree | user_id, date, editor | total_seconds, heartbeat_count | (user_id, date, editor) |
| 6 | `os_daily` | ReplicatedSummingMergeTree | user_id, date, os | total_seconds, heartbeat_count | (user_id, date, os) |
| 7 | `insights_agg` | ReplicatedAggregatingMergeTree | user_id, date, language, project, editor, os, branch | AggregateFunction(sum/count/uniq) | (user_id, date, language, project) |
| 8 | `project_rules` | ReplicatedReplacingMergeTree | user_id, rule_id | pattern, project_name, priority, is_active | (user_id, priority, rule_id) |
| 9 | `project_merges` | ReplicatedReplacingMergeTree | user_id, merge_id | source_project, target_project | (user_id, source_project) |
| 10 | `projects` | ReplicatedReplacingMergeTree | user_id, name | repository, last_heartbeat_at | (user_id, name) |
| 11 | `sync_state` | ReplicatedReplacingMergeTree | user_id, resource | last_synced_at, cursor | (user_id, resource) |
| 12 | `ai_daily` | ReplicatedSummingMergeTree | user_id, date, ai_agent | ai_lines_added, ai_lines_deleted, human_keystrokes, human_chars_added, heartbeat_count | (user_id, date, ai_agent) |
| 13 | `keystroke_daily` | ReplicatedSummingMergeTree | user_id, date, project | keystrokes, chars_added, chars_deleted, heartbeat_count | (user_id, date, project) |

### Project Rules (write-time, Rust regex)

```
POST /heartbeats → entity="/Users/dev/wakaclock/src/main.rs"
  1. Load user's project_rules (cached, priority-ordered)
  2. Match entity against patterns: ".*\/wakaclock\/.*" → "wakaclock"
  3. First match → set heartbeat.project = matched name
  4. No match → keep WakaTime/git-detected project
  5. INSERT into heartbeats (MVs fire with resolved project)
```

### Project Merges (read-time, SQL JOIN)

```sql
SELECT COALESCE(pm.target_project, d.project) AS project, sum(total_seconds)
FROM project_daily d
LEFT JOIN project_merges pm ON d.user_id = pm.user_id AND d.project = pm.source_project
WHERE d.user_id = ? GROUP BY project
-- "my-app-frontend" + "my-app-backend" → "my-app"
```

**Design note:** Duration is computed at read-time via `neighbor()` window function. Project merges are applied at read-time via LEFT JOIN.

---

## AST-Based Detection (Key Differentiator)

WakaTime: file extension → fails for `.h` (C/C++/ObjC?), extensionless files.

Wakaclock approach:
1. Extension narrows candidates (`.h` → [C, C++, Objective-C])
2. Parse first 8KB with each candidate grammar via tree-sitter
3. Pick grammar with fewest parse errors → that's the language
4. Confidence = `1.0 - (error_nodes / total_nodes)`
5. Extract imports/requires from AST for dependency detection
6. Budget: <50ms per file, parser pool for reuse

---

## API Endpoints

Auth: `Authorization: Basic base64(api_key)` (WakaTime-compatible) or `Bearer <api_key>`.

| Phase | Method | Route | Purpose | Source |
|-------|--------|-------|---------|--------|
| 1 | POST | `/api/v1/heartbeats.bulk` | Bulk heartbeat ingestion | INSERT → heartbeats (MVs auto-fire) |
| 1 | POST | `/api/v1/heartbeats` | Single heartbeat | INSERT → heartbeats |
| 1 | GET | `/api/v1/heartbeats?date=` | List heartbeats for a day | heartbeats (raw) |
| 1 | GET | `/api/v1/status_bar/today` | Today's total time | daily_totals WHERE date=today() |
| 1 | GET | `/api/v1/health` | Health check | — |
| 1 | POST | `/api/v1/auth/register` | Create user + API key | — |
| 1 | GET/PUT/DELETE | `/api/v1/project_rules[/:rule_id]` | CRUD regex rules | project_rules |
| 1 | GET/PUT/DELETE | `/api/v1/project_merges[/:merge_id]` | CRUD merge mappings | project_merges |
| 2 | GET | `/api/v1/durations?date=` | Duration blocks | heartbeats + neighbor() window fn |
| 2 | GET | `/api/v1/summaries?start=&end=` | Grouped summaries | daily_totals + dimension JOINs |
| 2 | GET | `/api/v1/stats/:range` | Stats (total, avg, best day) | ReplicatedSummingMergeTree tables |
| 2 | GET | `/api/v1/projects` | List projects | project_daily + merge JOIN |
| 2 | GET | `/api/v1/users/current` | Current user info | Config/sync_state |
| 2 | GET | `/api/v1/users/current/ai_stats?start=&end=` | AI vs human breakdown | ai_daily |
| 2 | GET | `/api/v1/users/current/keystroke_stats?date=` | Keystroke activity | keystroke_daily |
| 3 | GET | `/api/v1/insights/:type/:range` | Insights (weekdays, languages, etc.) | insights_agg sumMerge/uniqMerge |
| 3 | GET | `/api/v1/all_time_since_today` | Lifetime total | daily_totals SUM all |
| 3 | POST | `/api/v1/reprocess` | Reprocess after rule changes | heartbeats → heartbeats_incoming |
| 3 | POST | `/api/v1/import/wakatime` | Import WakaTime data dump | heartbeats_incoming |

---

## Extension Patterns

| Extension | Language | Communication | Dedup | Category |
|-----------|----------|---------------|-------|----------|
| VS Code | TypeScript | CLI child process, 30s buffer | 2min same-file | coding/building/debugging |
| Zed | Rust | LSP server (wakaclock-ls) | 2min in LSP | coding |
| Figma | TypeScript | Direct HTTP fetch | 2min same-doc | designing |
| Blender | Python | CLI subprocess, 1s queue poll | 2min / 2s writes | modeling |
| Desktop | Rust (Tauri) | In-process wakaclock-core | 2min same-app | varies (meeting for Zoom) |

---

## Key Dependencies

| Crate | Purpose |
|-------|---------|
| `axum 0.7` | Web framework (server) |
| `clickhouse 0.13` | Typed ClickHouse client (RowBinary) |
| `clap` | CLI argument parsing |
| `reqwest` | HTTP client |
| `rusqlite` | Offline queue (SQLite) |
| `gix` (gitoxide) | Git project/branch detection |
| `tree-sitter` + grammars | AST language detection |
| `tower-lsp` | LSP protocol (Zed) |
| `tauri` | Desktop app (Phase 4) |
| `serde`, `chrono`, `uuid`, `thiserror`, `tracing` | Utilities |
| `tower-http` | CORS, trace, timeout middleware |
| `utoipa` + `utoipa-scalar` | OpenAPI docs |
| `dotenvy` | Env config |

---

## Phased Implementation

### Phase 0 — Workspace Bootstrap

- [ ] Init git repo + Cargo workspace with all crate stubs
- [ ] `docker-compose.yml` with ClickHouse
- [ ] `migrations/001_init.sql` — full ClickHouse schema (all tables + MVs)
- [ ] `rustfmt.toml`, `clippy.toml`, `.editorconfig`

### Phase 1 — Core Heartbeat Pipeline: CLI → Server

- [ ] **wakaclock-core**: Heartbeat struct + serde + validation
- [ ] **wakaclock-core**: Config from `~/.wakaclock/config.toml`
- [ ] **wakaclock-core**: Project detection (Git root, remote URL, branch via `gix`)
- [ ] **wakaclock-core**: Offline queue (SQLite, 30-day TTL)
- [ ] **wakaclock-core**: Heartbeat dedup (same entity within 2min unless is_write)
- [ ] **wakaclock-core**: API client (reqwest, bulk POST, offline fallback)
- [ ] **wakaclock-cli**: `heartbeat` command (--entity, --type, --project, --write, --category, --extra-heartbeats stdin)
- [ ] **wakaclock-cli**: `config`, `status`, `today` subcommands
- [ ] **wakaclock-server**: ChClient (reuse board-backend pattern)
- [ ] **wakaclock-server**: Auto-run migrations on startup
- [ ] **wakaclock-server**: POST `/api/v1/heartbeats[.bulk]` with project-rule resolution
- [ ] **wakaclock-server**: GET `/api/v1/heartbeats?date=` + GET `/api/v1/status_bar/today`
- [ ] **wakaclock-server**: CRUD for project_rules and project_merges
- [ ] **wakaclock-server**: POST `/api/v1/auth/register`

### Phase 2 — AST Detection + VS Code Extension

- [ ] **wakaclock-ast**: Language detection via tree-sitter (Rust, Python, TS, JS, Go, C, C++)
- [ ] **wakaclock-ast**: Dependency detection (import/require/use extraction from AST)
- [ ] **wakaclock-ast**: Parser pool + 8KB read limit + caching
- [ ] Integrate AST into CLI pipeline
- [ ] **VS Code extension**: Event detection (file save, text change, debug start/stop, build task)
- [ ] **VS Code extension**: Heartbeat buffer (30s flush interval)
- [ ] **VS Code extension**: CLI spawn with `--extra-heartbeats` stdin JSON
- [ ] **VS Code extension**: Status bar showing today's total coding time

### Phase 3 — Analytics Endpoints + Remaining Extensions

- [ ] **Server**: Durations endpoint (neighbor() window fn for gap-based session detection)
- [ ] **Server**: Summaries endpoint (daily_totals + JOIN language/project/editor/os)
- [ ] **Server**: Stats endpoint (total time, daily average, best day, breakdowns)
- [ ] **Server**: Projects endpoint (project_daily GROUP BY + LEFT JOIN project_merges)
- [ ] **Server**: Insights endpoint (insights_agg with sumMerge/countMerge/uniqMerge)
- [ ] **Server**: Reprocess endpoint (TRUNCATE range → re-resolve rules → INSERT INTO Null engine)
- [ ] **Server**: WakaTime import endpoint (parse data dump JSON → INSERT INTO Null engine)
- [ ] **Zed extension**: `wakaclock-ls` LSP server (didOpen/didChange/didSave → heartbeat)
- [ ] **Zed extension**: extension.toml wrapper for Zed extension registry
- [ ] **Figma plugin**: Direct HTTP heartbeats on selection/document change
- [ ] **Figma plugin**: Category = designing, entity = document name / page name
- [ ] **Blender addon**: Python handlers (`load_post`, `save_post`, `depsgraph_update_post`)
- [ ] **Blender addon**: Background thread queue, CLI subprocess, 1s poll interval

### Phase 4 — Desktop App

- [ ] **Tauri app**: Active window tracking (macOS first via NSWorkspace notification center)
- [ ] **Tauri app**: Per-app monitoring toggles (like WakaTime's Monitored Apps panel)
- [ ] **Tauri app**: App → category mapping rules (e.g., "Zoom" → meeting, "Slack" → communicating)
- [ ] **Tauri app**: Zoom meeting tracking — detect active Zoom call, extract meeting title, category = meeting
- [ ] **Tauri app**: Idle detection (no heartbeat if no input events >5min)
- [ ] **Tauri app**: System tray with today's coding time
- [ ] **Tauri app**: Mini dashboard web UI (meeting time vs coding time breakdown)

---

## Status Note (as of 2026-08-12)

This file has drifted from reality in a few places — read the rest of it with this in mind
rather than trusting paths/status literally:

- **Paths are stale.** This plan describes `crates/` and `wakaclock-server` at repo root.
  The actual server lives at `backend/api` (root package, not a separate crate), and CLI
  crates live at `backend/api/crates/`.
- **Auth, subscriptions, and the frontend dashboard aren't in this file at all.**
  Session auth (register/login/JWT + API keys), the 14-day trial/subscription model, and
  the full `frontend/app` Next.js dashboard were built after this plan was written, in a
  separate planning pass. Don't treat their absence here as "not started."
- **Phase 0–2 are largely done**, Phase 3's server endpoints are done, but `/health` still
  doesn't exist (`README.md`/`start.sh` reference it and `/scalar` — neither is real).
  Zed, Figma, and Blender from Phase 3 are **not started** — see the correction below.
- **`wakaclock-ls` (Zed) is a 10-line stub**, not the LSP server the "Extension Patterns"
  table above implies — `crates/wakaclock-ls/src/main.rs` just prints
  `"LSP server not yet implemented (Phase 3)"`.

---

## Phase 5 — Editor & Tool Coverage (Beyond VS Code)

### Context

The reference is WakaTime's "supported editors" grid — ~90 icons. Two things need saying
before scoping this, because they change what "support Program X" actually costs:

1. **Agent CLIs are not editor plugins.** Claude Code, Codex CLI, Copilot CLI, Amp CLI, and
   similar terminal AI agents appear in that grid, but they don't have editor events to
   hook (no `onSave`, no buffer). They're covered by the separate `sync-agents` plan (reads
   `~/.claude/projects/*.jsonl`, `~/.codex/sessions/*.jsonl`) — **not** four more plugins
   here. Don't double-budget them.
2. **~90 line items is the wrong shape for this plan.** Most of that grid shares a plugin
   host with several other apps in the same grid (JetBrains alone is 14 icons for one
   plugin). Scoping by *host platform* instead of by *icon* is both more accurate and
   roughly a tenth of the size. The tiers below are that regrouping.

### Prerequisites (block every tier below, do these first)

- [ ] **Binary distribution.** There is currently no release artifact anywhere — no
  `.github/workflows/release.yml`, no install script, no version-check endpoint. Every
  plugin past VS Code shells out to a `wakaclock` binary the user must already have on
  `PATH`; right now that only exists via `cargo install --path`. WakaTime's plugins solve
  this by having each plugin auto-download `wakatime-cli` on first run. Needs, at minimum:
  cross-compiled release binaries (macOS/Linux/Windows) attached to GitHub releases, and a
  `GET /api/v1/cli/latest` (or static JSON) version-check endpoint plugins can poll.
- [ ] **Move buffering logic out of the VS Code extension and into `wakaclock-core`.**
  Verified: `extensions/vscode/src/buffer.ts` (305 lines) owns the entire flush-timer,
  keystroke-accumulation, gap/idle-detection, and active-seconds-estimate logic — none of
  it is in `wakaclock-core`, which only has the offline SQLite queue. Every Tier 2 plugin
  below would otherwise reimplement ~300 lines of this in Lua, Elisp, Python, C++, or C#.
  Decide the shape before building anything new: either (a) a `wakaclock watch` background
  process that owns buffering and accepts raw keystroke events over a local socket/stdin
  from thin plugins, or (b) a `wakaclock-editor-shim` library crate other language bindings
  wrap via FFI. Until this lands, each new plugin is a full reimplementation, not the
  "~150 lines of event wiring" it should be.
- [ ] **Document the `WAKACLOCK_EDITOR` contract.** The CLI already resolves editor identity
  via `detect_editor()` (`WAKACLOCK_EDITOR` env var → `TERM_PROGRAM` → `EDITOR` →
  `"wakaclock-cli"` fallback), and the VS Code extension already sets it to `"vscode"`
  (`cli.ts:126`). This is currently undocumented and easy to skip. The `editor_daily` table
  and the dashboard's Editors breakdown are useless if every new plugin doesn't set a
  distinct, stable value — make it part of the shim contract from the prerequisite above,
  not an afterthought per plugin.

### Tier 1 — Committed scope (one codebase covers a whole family)

- [ ] **VS Code Extension API family** — VS Code, Cursor, Trae, Kiro, Qoder, Antigravity,
  VSCodium. All consume the same Extension API; `extensions/vscode` already targets it.
  Work is packaging/distribution, not new logic: publish to both the VS Code Marketplace
  and Open VSX (the forks pull from Open VSX, not Marketplace). Credential store:
  `vscode.SecretStorage`, already wired (`secrets.ts`).
- [ ] **IntelliJ Platform SDK family** — IntelliJ IDEA, PyCharm, WebStorm, PhpStorm,
  RubyMine, CLion, GoLand, DataGrip, DataSpell, Rider, RustRover, AppCode, Android Studio,
  MPS. One plugin (Kotlin, IntelliJ Platform Plugin Template) covers all 14 icons via one
  Marketplace listing. New `extensions/jetbrains/`. Spawns the `wakaclock` CLI the same way
  the VS Code extension does — document-open/save/change listeners → buffer → flush.
  Credential store: IntelliJ `PasswordSafe` API.

### Tier 2 — Sequenced, not yet scheduled (one codebase, one app each)

- [ ] **Neovim** (Lua, native LSP client or a plugin using `vim.loop` timers)
- [ ] **Vim** (VimScript — no Lua runtime in classic Vim, separate implementation from Neovim)
- [ ] **Emacs** (Elisp package, distributed via MELPA)
- [ ] **Sublime Text** (Python 3.8 plugin API)
- [ ] **Zed** — finish `wakaclock-ls` for real: `tower-lsp` server implementing
  `didOpen`/`didChange`/`didSave` → heartbeat, plus the `extension.toml` wrapper for Zed's
  extension registry (this was already Phase 3 scope — it just never got built)
- [ ] **Visual Studio** (full, not Code) — VSPackage/VSIX, C#/.NET
- [ ] **Xcode** — Swift Source Editor Extension; flag risk early, Apple's extension API is
  sandboxed and notoriously limited (no reliable save/change hooks in some Xcode versions)
- [ ] **Notepad++** (C++, Notepad++ Plugin API)
- [ ] **Eclipse** (Java, OSGi/Eclipse Platform plugin)

Credential store for all of Tier 2: none of these hosts have a secret-storage API wakaclock
can use, so they fall back to `~/.wakaclock/config.toml` via `wakaclock config set-key` —
same path the CLI already supports today, just document it per-plugin instead of building
anything new.

### Tier 3 — Explicitly out (bucket rule, not a per-app decision)

**Rule:** no plugin/extension API with editor-event hooks, or the app isn't primarily a
coding surface → covered by the Tauri desktop app's active-window tracking (Phase 4), not a
dedicated plugin. This is a deliberate non-goal, not a gap to fill later per-app.

Covers the rest of the grid: terminals, browsers (Chrome/Firefox/Edge/Brave/Safari — a
browser plugin would track *view* time, not *coding* time, which is out of scope for this
product), Office apps (Word/Excel/PowerPoint), Discord, Postman, IDA Pro, database GUIs
(DBeaver, MySQL Workbench, Azure Data Studio, SQL Server Studio, Aqua Data Studio — DataGrip
is the one exception, covered under Tier 1 as JetBrains), and the long tail of niche editors
(BlueJ, Processing, Qt Creator, Code::Blocks, CodeLite, KDevelop, Light Table, Espresso,
RStudio, Spyder, TeXstudio, TextMate, Kakoune, Kate, Micro, Helix, Nova, Coda, Geany, Gedit,
EmEditor, WPS Office, SiYuan, HBuilder X, Delphi, Wing, ReClassEx, Recaf, Oxygen, Maestro,
Komodo, Cloud9, Brackets, Aptana, Arduino IDE, SlickEdit, Zotero).

Two apps already have a home in the *existing* plan and aren't new Phase 5 work:
**Figma** (Phase 3, direct HTTP plugin) and **Blender** (Phase 3, Python addon) — both
already scoped above, neither started yet.

---

## Phase 6 — Teams/Orgs, Billing & Trust Surfaces

### Context

Source: a Playwright research session against the real WakaTime app (logged in), snapshots
saved under `.playwright-mcp/`. Cross-referenced against what `frontend/app` already has
(full 21-endpoint dashboard, register/login, flat-plan trial). Four gaps found; only the
first is a structural blocker for the target market this product already committed to
(engineering managers running 20–200 person teams, per the pricing/positioning pass) — the
other three are parity nice-to-haves and should not jump the queue ahead of it.

### 6.1 — Teams & Organizations (🔴 blocking for the chosen target market)

**Why this outranks everything else in this file:** the auth/subscription system built so
far (`services/user.rs`, `middleware/auth.rs`) is single-user end to end — one `user_id`,
one `api_key`, one `subscription_status`. There is no concept of "these 40 people are one
customer." An engineering manager evaluating this product will ask for a team view in the
first five minutes; without it, the entire positioning built around that buyer doesn't work
yet, regardless of how good the AI-analytics differentiator is.

**Schema** (new tables, same `ReplacingMergeTree` + full-row-replace discipline as
`wakaclock.users` — every write must carry every column forward, the same footgun that bit
`update_subscription()` earlier in this project):

```sql
CREATE TABLE IF NOT EXISTS wakaclock.orgs
(
    org_id        UUID,
    name          String,
    owner_user_id UUID,
    created_at    DateTime64(3) DEFAULT now64(3),
    updated_at    DateTime64(3) DEFAULT now64(3)
)
ENGINE = ReplacingMergeTree(updated_at)
ORDER BY (org_id)

CREATE TABLE IF NOT EXISTS wakaclock.org_members
(
    org_id     UUID,
    user_id    UUID,
    role       String,   -- 'owner' | 'admin' | 'member'
    joined_at  DateTime64(3) DEFAULT now64(3),
    updated_at DateTime64(3) DEFAULT now64(3)
)
ENGINE = ReplacingMergeTree(updated_at)
ORDER BY (org_id, user_id)
```

- [ ] **Org context resolution** — don't embed `org_id` in the JWT (`SessionClaims { sub:
      Uuid }` stays user-only, avoids re-issuing tokens on every org switch). Add
      `resolve_org_context(state, headers, user_id) -> Option<Uuid>` reading an
      `X-Wakaclock-Org` header, validated against `org_members` — same shape as
      `resolve_user_id()`, same "no client-supplied trust" rule.
- [ ] **Every read query gets an org-scoped variant.** This is the real size of the feature,
      not the schema. `summaries`, `stats`, `insights`, `projects`, `ai_stats`,
      `keystroke_stats` all currently filter `WHERE user_id = ?` in
      `repository/analytics.rs`; an org view needs
      `WHERE user_id IN (SELECT user_id FROM org_members WHERE org_id = ?)` on each one.
      Budget this as touching essentially every existing query, not as one new endpoint.
- [ ] **Billing model decision (blocks implementation, decide first):** subscription state
      (`subscription_status`, `trial_ends_at`, `subscription_period_end`) currently lives on
      `wakaclock.users`, i.e. per person. Teams pricing was already recommended as per-seat
      (see pricing discussion) — decide whether that means moving subscription state onto
      `orgs` and gating org members off the org's subscription, or keeping it per-user and
      having the org owner's plan act as a seat pool. Don't start the schema work until this
      is picked; it changes which table the new columns land on.
- [ ] **Migration shape for existing accounts:** every user created so far has no org. Two
      options — (a) auto-create a personal, always-1-member org per existing/new user, so
      every query is uniformly org-scoped and "Personal" is just an org with one member
      (this is what WakaTime's own org switcher implies, per the snapshot); or (b) org stays
      a fully optional overlay with two code paths (personal vs org queries). Prefer (a) —
      it collapses the org-scoped query work above into the *only* query shape, instead of
      building and maintaining two.
- [ ] **Frontend:** org switcher (mirrors the WakaTime snapshot's pattern — dropdown with
      "Personal dashboard" + one entry per org), invite-by-email flow, member list with
      role management (owner can promote/demote/remove), org-scoped variant of the existing
      Overview/Projects/Insights pages.
- [ ] **Permissions:** only `org_members` rows can read that org's aggregated data; only
      `owner`/`admin` roles can invite, remove, or change roles. Enforce server-side in the
      org-context resolver, not just hidden in the frontend.

### 6.2 — Public API docs (🟡 medium, cheap relative to its value)

`utoipa` and `utoipa-scalar` are **already dependencies** (`Cargo.toml:42-43`) but nothing
mounts them — `README.md`/`start.sh` advertise a `/scalar` route that 404s today (see Status
Note above). This is mostly annotation work on handlers already written, not new
infrastructure:

- [ ] Add `#[utoipa::path(...)]` annotations to existing `handlers/v1/*` functions
- [ ] Mount `utoipa-scalar` at `/scalar`, wire the generated `OpenApi` doc
- [ ] Sequence this early relative to the rest of Phase 6 — it's the cheapest item here and
      it closes a gap between what the README already claims and what's actually running

### 6.3 — Reports & Invoices (🟡 medium, freelancer-shaped — reconsider before building)

WakaTime has both; they exist to support freelancers billing clients by tracked hours. That
use case sits outside the team/org buyer this product is positioned for — **don't build
either until real signups show a freelancer segment actually asking for it.** If it
happens:
- [ ] **Reports** — exportable periodic summary (CSV/PDF) of an existing date-range query;
      no new data model, purely a rendering/export layer on `summaries`/`stats`.
- [ ] **Invoices** — genuinely new data: hourly rate per project, invoice records with
      paid/unpaid status, rate × tracked-time line items, CSV/PDF export. Meaningfully more
      work than Reports; don't bundle the two as one estimate.

### 6.4 — Email weekly report (🟢 low-medium)

No email-sending capability exists anywhere in the stack yet (no SMTP/email crate in
`Cargo.toml`). Build this once as a shared `EmailService`, not twice:

- [ ] Pick a sending path (SMTP via `lettre`, or a transactional API like Postmark/SES)
- [ ] Scheduled job querying each user's (or org's, if 6.1 ships first) past-7-days summary,
      rendering a simple HTML digest, sending
- [ ] Reuse the same `EmailService` for org invite emails (6.1) — building invite-email and
      report-email as two independent integrations would duplicate the sending
      infrastructure for no reason

---

## Testing Strategy (TDD per CLAUDE.md)

| Layer | Tool | Coverage |
|-------|------|----------|
| Unit (Rust) | `cargo test` | Heartbeat validation, config, dedup, AST detection accuracy, duration calc, project rule regex |
| Integration (Rust) | `assert_cmd` | CLI end-to-end, `axum::test` for server routes, real SQLite for offline queue |
| Integration (Server) | Docker ClickHouse | MV aggregation, ReplicatedSummingMergeTree correctness, Null engine reprocessing |
| Unit (TypeScript) | Vitest | VS Code heartbeat buffer/flush timing, Figma rate limiting, dedup |
| Unit (Python) | pytest | Blender event queue, CLI delegation, handler registration |
| E2E | Full roundtrip | CLI → server → ClickHouse INSERT → MV fires → query aggregated table → verify response |

---

## Verification

1. `cargo test --workspace` — all Rust tests pass
2. `cargo build --workspace --release` — all binaries compile
3. `docker compose up -d` — start ClickHouse
4. `cargo run -p wakaclock-server` — starts, runs migrations, connects to CH
5. `cargo run -p wakaclock-cli -- heartbeat --entity ./test.rs --write`
6. `curl localhost:3030/api/v1/status_bar/today -H "Authorization: Basic <key>"`
7. Verify MVs fired: `SELECT * FROM daily_totals` shows aggregated data
8. VS Code: install extension, open file, verify status bar shows time

---

## Critical Reference Files

- `screenshot/backend/board-backend/src/repositories/ch_client.rs` — ChClient pattern
- `screenshot/backend/board-backend/Cargo.toml` — dependency versions
- `screenshot/backend/board-backend/docker-compose.yml` — ClickHouse docker
- `wakaclock/wakatime-api-routes.json` — all WakaTime API routes
