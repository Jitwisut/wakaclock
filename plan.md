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

> **Superseded 2026-08-13:** the heuristic detection methods below are retained as design
> history only. They must not be implemented as the production attribution system. See
> **Phase 8 — WakaTime-Style Transcript-Based AI Attribution** for the authoritative plan.

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

- [x] Init git repo + Cargo workspace with all crate stubs
- [x] `docker-compose.yml` with ClickHouse
- [x] `migrations/001_init.sql` — full ClickHouse schema (all tables + MVs)
- [x] `rustfmt.toml`, `clippy.toml`, `.editorconfig`

### Phase 1 — Core Heartbeat Pipeline: CLI → Server

- [x] **wakaclock-core**: Heartbeat struct + serde + validation
- [x] **wakaclock-core**: Config from `~/.wakaclock/config.toml`
- [~] **wakaclock-core**: Project detection — git root + branch done, by walking up to `.git` and reading `HEAD` by hand (`git.rs`). Diverges from plan: no `gix` crate, and no remote-URL parsing — project name is the repo folder name, not derived from the remote.
- [~] **wakaclock-core**: Offline queue — SQLite-backed (`queue.rs`, `rusqlite`) exists and is wired into the CLI's send path. Did not verify a 30-day TTL/eviction policy is actually implemented, only that the queue itself is.
- [x] **wakaclock-core**: Heartbeat dedup (`api_client.rs` reports a `deduped` count; CLI surfaces it)
- [x] **wakaclock-core**: API client (reqwest, bulk POST, offline fallback)
- [x] **wakaclock-cli**: `heartbeat` command (--entity, --type, --project, --write, --category, --extra-heartbeats stdin)
- [x] **wakaclock-cli**: `config`, `status`, `today` subcommands (plus `set-key`/`clear-key`, not in the original plan)
- [x] **wakaclock-server**: ChClient (`infrastructure/database.rs`)
- [x] **wakaclock-server**: Auto-run migrations on startup (`main.rs`)
- [x] **wakaclock-server**: POST `/api/v1/heartbeats[.bulk]` with project-rule resolution
- [x] **wakaclock-server**: GET `/api/v1/heartbeats?date=` + GET `/api/v1/status_bar/today`
- [x] **wakaclock-server**: CRUD for project_rules and project_merges
- [x] **wakaclock-server**: POST `/api/v1/auth/register` (login also exists, ahead of what this line names)

### Phase 2 — AST Detection + VS Code Extension

- [x] **wakaclock-ast**: Language detection via tree-sitter (Rust, Python, TS/TSX, JS/JSX, Go, C, C++)
- [x] **wakaclock-ast**: Dependency detection (import/require/use extraction from AST)
- [x] **wakaclock-ast**: Parser pool + 8KB read limit (`MAX_SOURCE_BYTES`) + caching
- [x] Integrate AST into CLI pipeline
- [x] **VS Code extension**: Event detection (file save, text change, debug start/stop, build task)
- [x] **VS Code extension**: Heartbeat buffer (30s flush interval)
- [x] **VS Code extension**: CLI spawn with `--extra-heartbeats` stdin JSON
- [x] **VS Code extension**: Status bar showing today's total coding time

### Phase 3 — Analytics Endpoints + Remaining Extensions

- [x] **Server**: Durations endpoint
- [x] **Server**: Summaries endpoint
- [x] **Server**: Stats endpoint
- [x] **Server**: Projects endpoint
- [x] **Server**: Insights endpoint
- [x] **Server**: Reprocess endpoint
- [x] **Server**: WakaTime import endpoint
- [ ] **Zed extension**: `wakaclock-ls` LSP server — still a 10-line stub (`crates/wakaclock-ls/src/main.rs` prints "not yet implemented" and exits). Not started.
- [ ] **Zed extension**: extension.toml wrapper for Zed extension registry — still not started. The LSP server binary above is real, but there is still nothing that makes Zed launch it: no `extensions/zed/extension.toml`, no `zed_extension_api`-based glue crate, no `extensions/zed/` directory at all. Until this exists, `wakaclock-ls` cannot actually be installed or run inside Zed — it only runs as a standalone LSP-over-stdio process today, and has only been verified by direct unit tests, not against a real Zed instance.
- [ ] **Figma plugin**: Direct HTTP heartbeats on selection/document change — not started, no `extensions/figma` directory exists
- [ ] **Figma plugin**: Category = designing, entity = document name / page name — not started
- [ ] **Blender addon**: Python handlers — not started, no `extensions/blender` directory exists
- [ ] **Blender addon**: Background thread queue, CLI subprocess, 1s poll interval — not started

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
rather than trusting paths/status literally.

**Product decisions taken 2026-08-12 (these override anything older in this file):**

- **Brand is `AtoAxis`.** Technical identifiers were deliberately NOT renamed: the binary
  is still `wakaclock-cli`, config lives at `~/.wakaclock/config.toml`, editor settings are
  `wakaclock.*`, and crates keep their names. Docs quote them verbatim so the documented
  commands actually run. (Earlier names in this file — Wakaclock — refer to the same thing.)
- **Delivery model is hosted SaaS. Self-hosting is dropped.** Customers sign up; they do
  not deploy anything. `docker-compose*.yaml` and the Quick Start are development-only.
  Note that the payment gate was never enforceable under self-hosting anyway:
  `payment_required()` is applied only at heartbeat ingest and reads `subscription_status`
  from the local database.
- **Billing is not implemented.** `POST /internal/subscription` is a seam gated by
  `INTERNAL_API_SECRET`; no payment provider is connected. Nothing can be charged today.
- **A public marketing site now exists** at `frontend/app/app/(marketing)/` — 11 indexable
  routes plus `sitemap.xml`, `robots.txt` and `llms.txt`, with structured data built from
  `frontend/app/lib/seo/`. Every capability claim on it was verified against this codebase,
  and competitor claims against `wakatime.com`. **Do not add roadmap features to it in the
  present tense** — see Phase 7.6.
- **Redis is claimed but not wired.** It appears in `README.md` and the architecture
  diagram, but is absent from `backend/api/Cargo.toml` and has no client in
  `backend/api/src/infrastructure/`. Still true — Phase 7.1's presence prototype (below)
  worked around this with an in-memory store rather than resolving it.
- **Phase 7 (Live Team Presence) is the current strategic bet** — added after verifying
  that WakaTime already ships, or ships better, every previously assumed differentiator.
  **A first prototype shipped 2026-08-12**: backend (`presence_store.rs` +
  `handlers/v1/presence.rs`, 9 passing tests, clippy-clean) and a minimal frontend room UI
  at `/dashboard/wakaclock/presence`. It deliberately skipped both of 7.1's hard blockers
  (org model, Redis) and 7.4/7.5 (session recording, avatar UI).
- **2026-08-13: the 7.4 gap (no recorded sessions) was closed for real**, along with a
  minimal slice of 7.1's org blocker — see Phase 7.1/7.2/7.3/7.4/7.5 inline for the exact,
  audited scope of each. Summary: a real (small) `orgs`/`teams` schema now exists and gates
  room creation with a permission-checked team name instead of free text; canvas positions
  are synced server-side over the same SSE stream everyone reads, replacing the earlier
  per-browser-only positions that were not trustworthy enough to build session data on;
  co-working sessions are now genuinely persisted to ClickHouse with group clustering (not
  pairwise) and a 3-minute drag-apart grace period, both product decisions the owner made
  explicitly; the avatar UI was redesigned in a claymorphism/game theme with real
  state-driven animation and `prefers-reduced-motion` support. Redis is **still not wired**
  — presence itself (who's online, not session history) still lives in the in-memory
  `PresenceStore`, unaffected by this pass. Rust: 50 tests passing workspace-wide, clippy
  and fmt clean. Frontend: 107 tests passing, typecheck/lint:strict/build clean. What is
  still honestly missing: no UI to browse or pick among a user's *existing* teams (only
  "create a new team" is wired from the lobby), no `extension.toml` for Zed, no seat/billing
  tie-in for teams, and presence state itself still does not survive a server restart.
- **2026-08-13 (same day, follow-up pass): fixed room membership not surviving
  navigation, and replaced the claymorphism theme above with a pixel-art/retro-arcade
  one.** The bug: `roomId` lived only in React state
  (`app/dashboard/(auth)/wakaclock/presence/page.tsx`), so leaving the presence page —
  switching to another dashboard route, switching browser tabs in a way that unmounted
  it, or reloading — dropped the UI back to the lobby even though the user was still a
  room member server-side and had never clicked "Leave." Fixed by mirroring `roomId` into
  `localStorage` and replaying an idempotent `POST .../join` for it once on mount; if that
  fails (e.g. the in-memory `PresenceStore` lost the room to a server restart, per 7.1's
  still-open Redis gap), the stored id is cleared and the UI falls back to the lobby with
  a toast instead of getting stuck. Separately, the avatar/room theme was fully redone in
  a pixel-art/retro-arcade direction (Press Start 2P + VT323 fonts, an NES-adjacent
  8-color palette, a hand-authored 10x12 pixel-grid sprite per character with CSS
  `steps()`-eased motion instead of smooth easing, a checkerboard tile-grid canvas
  background, and hard-edged unblurred shadows/borders — border-radius is forced to 0
  throughout the theme) — this **replaces**, not extends, the claymorphism styling
  described above; every "claymorphism" mention elsewhere in this Phase 7 section is
  accordingly stale. Verified: typecheck, lint:strict, `test:run` (107 tests, unchanged —
  no dedicated presence-component tests existed before or after this pass, same gap as
  before), and `build` all clean.
- **The checkboxes below were audited against the actual codebase on 2026-08-12** and
  now reflect it — Phase 0, 1 and 2 are fully `[x]`, Phase 3's server endpoints are `[x]`
  (Zed/Figma/Blender stay `[ ]`, confirmed not started), Phase 4 stays entirely `[ ]`
  (confirmed: no `src-tauri` anywhere in the repo). Two Phase 1 items are marked `[~]`
  where the shipped code diverges from what the line describes — read those two inline
  notes before relying on them. Before this pass every checkbox in the file was `[ ]`
  regardless of actual status; do not trust an unaudited `[ ]` elsewhere in this file
  (Phase 5/6/7) as strongly as these — it may mean "not started" or may just mean "never
  updated."

Older drift, still accurate:

- **Paths are stale.** This plan describes `crates/` and `wakaclock-server` at repo root.
  The actual server lives at `backend/api` (root package, not a separate crate), and CLI
  crates live at `backend/api/crates/`.
- **Auth, subscriptions, and the frontend dashboard aren't in this file at all.**
  Session auth (register/login/JWT + API keys), the 14-day trial/subscription model, and
  the full `frontend/app` Next.js dashboard were built after this plan was written, in a
  separate planning pass. Don't treat their absence here as "not started."
- **Phase 0–2 are done** (verified 2026-08-12, checkboxes now reflect this), Phase 3's
  server endpoints are done, but `/health` still doesn't exist (`README.md`/`start.sh`
  reference it and `/scalar` — neither is real). Zed, Figma, and Blender from Phase 3 are
  **not started** — see the correction below.
- **`wakaclock-ls` (Zed) is no longer a stub** (built 2026-08-12) — it is a real tower-lsp server that turns didOpen/didChange/didSave into heartbeats. What is still missing: the Zed *extension* wrapper (`extension.toml` + `zed_extension_api` glue) that would let Zed actually discover and launch it — that piece does not exist, so `wakaclock-ls` cannot yet be installed in Zed itself. It has been verified by unit tests and a full workspace build only, never against a running Zed instance.

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

## Phase 7 — Live Team Presence (the differentiator bet)

### Context

Added 2026-08-12 after a positioning pass that verified WakaTime's current product against
`wakatime.com` (plugin directory + pricing). That pass produced an uncomfortable result and
this phase is the response to it.

**What the verification found.** Every capability this project had been treating as its
differentiator is either something WakaTime already ships, or something it ships better:

| Assumed differentiator | Reality (verified Aug 2026) |
|---|---|
| AI agent tracking | WakaTime ships official Claude Code, Cursor, Codex and Copilot plugins that populate AI-vs-human lines **automatically**. This repo accepts the fields but **no client sets them** — see "AI Agent Code Tracking" above; it is a schema with no producer. |
| AI token/cost analytics | WakaTime reports tokens and estimated spend per model. This repo has no token or cost column anywhere. |
| Teams | WakaTime sells Team ($21/dev) and Business ($24/dev) with dashboards and leaderboards. Phase 6.1 is not started. |
| Self-hosting | **Dropped as a product direction** — the owner chose hosted SaaS (see Status Note). It was also unenforceable: `payment_required()` reads `subscription_status` from the deployment's own database, so a self-hosting customer could mark themselves active indefinitely. |
| Price | $12/mo vs WakaTime Premium $14/mo. A $2 gap is not a position. |

What survives is thin: complete history included in the base plan (WakaTime gates full
history behind Premium), AST-based language detection, and keystroke/char counts. Enough
for honest comparison copy, not enough to win a category.

**The bet.** Stop competing on analytics depth and change product category. WakaTime is an
analytics company — it sells charts. Phase 7 builds *presence*: a live view of who on your
team is actually coding right now, rendered as animated avatars you can drag together to
start a shared session.

The moat is the data, not the animation:

> Gather, Discord and Teamflow show you as "online" because you moved a mouse.
> This shows you as coding **because heartbeats say you are coding**.

Gather cannot copy it without an editor-telemetry pipeline. WakaTime cannot copy it without
becoming a realtime product. The intersection is defensible in a way that a cheaper
dashboard is not.

### 7.0 — The design rule that decides whether this works

**Presence must be mutual and symmetric. No exceptions, including for owners and admins.**

If a team lead can see members while remaining invisible, this stops being an office and
becomes monitoring software — and it lands the product in the bossware category that
developers actively reject and uninstall. Gather and Discord work precisely because
visibility is equal for everyone in the room.

Concretely, this constrains the implementation:

- [ ] Any user who can *see* the presence room must also *appear* in it. There is no
      observer role, no invisible mode for admins, and no server-side capability to read
      presence without being present. Enforce in the query layer, not the UI.
- [ ] The presence payload carries **activity state only** — `coding | idle | offline`.
      It must **never** carry `entity` (file path), `project`, or `branch`. Those are the
      most sensitive fields in the heartbeat (see `/privacy` on the marketing site, which
      commits to this publicly) and they belong to the individual's own analytics views.
- [ ] Presence is opt-in per user, and leaving a room is always available without leaving
      the org.
- [ ] Legal review before build, not after: the company is Thai, so **PDPA** applies to
      anything resembling employee monitoring, and GDPR applies if EU members are tracked.
      "Mutual and state-only" is a much easier posture to defend than the alternative, but
      it is still a review, not an assumption.

### 7.1 — Prerequisites (hard blockers)

> **2026-08-12 update: a first slice shipped, deliberately skipping both blockers below.**
> Building the full org model and wiring Redis before anyone had tried the actual idea
> risked weeks of infrastructure work on an unvalidated hypothesis. What shipped instead
> is a smaller, honestly-scoped prototype — see the callout after 7.2 for exactly what it
> is and is not. The two items below remain open precisely because the prototype does not
> satisfy them; they are the real requirements for anything beyond a prototype.
>
> **2026-08-13 update: the org/team blocker is now partially resolved, on purpose scoped
> down from the full Phase 6.1 surface.** Rooms are no longer bare invite-link UUIDs with
> zero membership model — a room can be created "for a team," which now means a real,
> permission-checked `team_id`, not free text. Redis remains unwired; see below.

- [x] **Minimal org/team model, not the full Phase 6.1 surface.** `wakaclock.orgs`,
      `wakaclock.org_members`, `wakaclock.teams`, `wakaclock.team_members` — all
      `ReplacingMergeTree`, same full-row-replace discipline as `wakaclock.users`
      (`repository/org.rs`, `repository/team.rs`). `POST /orgs` makes the caller owner;
      `POST /orgs/:org_id/teams` requires org owner/admin (`OrgService::require_admin`);
      the team creator is auto-added as a team member. **What this deliberately does not
      cover**, because it was scoped to only what presence needs: seat accounting, billing
      tie-in, org-scoped analytics, and a frontend surface to browse/manage existing orgs
      and teams (today the lobby UI only offers "create a new team," chaining
      `createOrg` → `createTeam` → `createPresenceRoom(team_id)` — there is no UI yet to
      join or pick among teams a user is already in). Full Phase 6.1 remains the real
      requirement for a customer-facing multi-team product; this is intentionally smaller.
- [ ] **Wire Redis.** `README.md` and the architecture diagram both claim Redis, but it is
      **not in `backend/api/Cargo.toml`** and there is no client in
      `backend/api/src/infrastructure/` — only `auth_cache.rs`, `database.rs`,
      `rate_limiter.rs`, `logger.rs`. Presence state is high-frequency, small, and
      ephemeral; it must not go to ClickHouse, which is an analytical store and will
      degrade under per-user-per-30s upserts. *Still not wired, unchanged by the 2026-08-13
      pass.* The prototype uses an in-memory `PresenceStore`
      (`backend/api/src/infrastructure/presence_store.rs`) instead — same reasoning as
      `AuthKeyCache`, but it does not survive a restart and does not work across more than
      one server process. Swapping this module's internals for Redis, without changing its
      public API, is the migration path once/if this is validated. Co-working *session*
      records (7.4) are unaffected by this gap — those are persisted to ClickHouse, not
      the in-memory store; only live roster/position state is still process-local.
- [x] **Choose a transport.** SSE, as recommended — `axum::response::sse::{Event,
      KeepAlive, Sse}`, no new dependency needed. Implemented at `GET
      /api/v1/presence/rooms/:room_id/stream`; each open connection polls the in-memory
      store on a 3s timer via `futures::stream::unfold` rather than a server-side pubsub
      broadcast, which is adequate at prototype scale (a handful of people per room) and
      is the first thing to change if this goes further.

### 7.2 — Sub-teams

The owner's requirement: an organisation subscribes for N seats and the owner subdivides
those seats into smaller working groups, each with its own presence room.

- [x] Extend Phase 6.1's schema with a `teams` table (`team_id`, `org_id`, `name`) and
      `team_members` (`team_id`, `user_id`, `role`), both `ReplacingMergeTree` following
      the same full-row-replace discipline as `wakaclock.users` — the footgun that already
      bit `update_subscription()` applies here too. Built 2026-08-13
      (`repository/team.rs`); `team_members` is `ORDER BY (team_id, user_id)`.
- [x] A user may belong to several teams within one org (schema allows it; no UI to browse
      that yet, see 7.1's callout). Presence rooms are scoped to a `team_id` carried on the
      room, not `org_id`, so a 200-person org does not render 200 avatars in one room.
- [ ] Seat accounting lives at the org, not the team — subdividing must never change what
      is billed. *Still not built* — there is no seat/billing model at all yet (Phase 6.1
      is still open); this line stays `[ ]` until that exists.

> **What is real as of 2026-08-13, precisely:** `POST /presence/rooms` optionally accepts
> a `team_id`; if given, the server verifies the caller is a member of that team
> (`resolve_team_name()` in `handlers/v1/presence.rs`) and stores the team's real,
> permission-checked name on the room — never client-supplied free text. A room created
> *without* a `team_id` still behaves exactly like the 2026-08-12 prototype: an
> invite-link-shaped UUID with no membership model, acceptable for a quick ad-hoc room but
> not for anything requiring real access control. So the access-control gap described in
> the original callout below is closed **only for team-linked rooms**, not for teamless
> ones — that asymmetry is intentional (teamless rooms are the deliberately-kept "quick
> room" escape hatch) but is worth remembering before treating "has a room" as "has
> authorization." Frontend: the lobby (`/dashboard/wakaclock/presence`) now offers both
> "create a room for `<team name>`" (chains org+team creation) and the original "create a
> room without a team," plus join-by-link. The avatar UI is no longer solid-colour circles
> with a text badge — see 7.5, it was redesigned twice this same day: first into
> claymorphism, then replaced with a pixel-art/retro-arcade theme (see the Status Note's
> second 2026-08-13 entry). Room membership also now survives navigating away and back
> (`localStorage` + idempotent rejoin-on-mount — same Status Note entry) instead of
> resetting to the lobby. The public `/teams` marketing page is unchanged and still
> correctly describes all of this as in development; it is still not customer-visible.

### 7.3 — Presence state

Derived, not reported. The client never says "I am working"; the server infers it from
heartbeat recency, which is what makes the signal unfakeable.

- [ ] Redis key per user: `presence:{user_id}` → `{ state, last_heartbeat_at, team_ids }`,
      TTL slightly above the idle threshold so expiry *is* the offline transition. *Not
      built.* The prototype keeps `HashMap<Uuid, Instant>` in `PresenceStore` instead —
      same data, no TTL/expiry (state is recomputed from elapsed time on every read
      instead), no persistence, single process only.
- [x] Write on heartbeat ingest, in `handlers/v1/heartbeats.rs` alongside the existing
      ClickHouse insert. Non-blocking and best-effort by construction:
      `PresenceStore::record_heartbeat` has no error return at all, so there is nothing
      for the heartbeat handlers to propagate even if they wanted to.
- [x] State machine driven by existing values, no new client config: `coding` (heartbeat
      within the last 2 min) → `idle` (within 5 min) → `offline` (beyond that). One
      precision note: the 5-minute idle boundary is a hardcoded constant on the server
      (`IDLE_WINDOW` in `presence_store.rs`) chosen to match `wakaclock.idleMinutes`'
      *default* — the server has no way to read that setting's actual per-user value,
      since it is a client-side VS Code config the server never sees.
- [x] The 30-second default flush (`wakaclock.flushIntervalSeconds`) is **sufficient**.
      Confirmed by building against it: the SSE stream ticks every 3s against a coding
      window of 2 minutes, comfortably inside a single flush interval.
- [x] `GET /api/v1/presence/rooms/:room_id/stream` (SSE) — emits the roster on each tick.
      Path differs from the plan's `/teams/:team_id/presence`: rooms, not teams, since 7.2
      is not built (see the callout above). Authorization: caller must be a room member,
      checked via `PresenceStore::is_member`; by construction the emitted roster is always
      the room's member set, so the caller is necessarily included (7.0's mutual/symmetric
      rule holds by how the data is shaped, not by an extra check that could be skipped).

### 7.4 — Co-working sessions ("drag to join")

**This is the part that decides whether the feature has value beyond novelty.** If dragging
two avatars together only makes them stand next to each other, it is a toy with a two-day
half-life. The interaction has to produce something durable, and the natural something —
given this is a time-tracking product — is a recorded shared session.

> **Built 2026-08-13.** Before this could be built at all, a gap had to be closed first:
> canvas positions were purely local, per-browser state — nothing synced them, so "two
> avatars dragged together" was never a signal the *server* could see, only something one
> browser rendered locally. `POST /presence/rooms/:room_id/position` and the corresponding
> `position: Point | null` field on each SSE roster entry (`presence_store.rs`,
> `room-canvas.tsx`) fixed that: every viewer's stream now carries everyone's real
> coordinates, which is what makes drag-together a trustworthy signal to build a session on.
> Two product decisions the owner made explicitly shape what follows: sessions cluster as
> **groups**, not pairwise (a third person joining an existing pair extends it rather than
> starting a second session), and dragging apart doesn't end a session immediately — a
> 3-minute grace period must elapse first, so a brief separation doesn't fragment one
> collaboration into several recorded sessions.

- [x] `POST /presence/rooms/:room_id/sessions` — reports "I am now close to this person";
      the server decides whether this extends an existing group session or starts a new
      one (`CoworkingSessionService::start_or_join`, `services/coworking_session.rs`).
      `POST /presence/rooms/:room_id/sessions/leave` ends the caller's own participation.
      Path differs from the plan's `/api/v1/sessions/*`: scoped under the room, matching
      the same rooms-not-teams reality noted in 7.3, and the client never chooses or
      supplies a session id — only the server does, precisely so it can implement group
      clustering instead of trusting the client's idea of which session it's joining.
- [x] Persist to ClickHouse (`wakaclock.coworking_sessions`: `session_id`, `room_id`,
      `team_id` (nullable), `started_at`, `ended_at`; `wakaclock.coworking_session_participants`:
      `session_id`, `user_id`, `joined_at`, `left_at`) — `repository/coworking_session.rs`,
      both `ReplacingMergeTree` with `updated_at` versioning, mandatory `FINAL` reads.
- [ ] Surface the result in each participant's existing history: *"paired with X for 2h on
      project Y."* **Still not built** — sessions are recorded and queryable in ClickHouse,
      but nothing in the dashboard reads `coworking_sessions` yet. This is the one 7.4 item
      still open; it's what turns the recorded data into a feature a user can actually see.
- [x] A session ends when participants drop to one (`active_participant_count <= 1` in
      `CoworkingSessionService::leave`) or, per the grace-period decision above, when a
      participant stays apart from everyone for 3 minutes (`LEAVE_GRACE_MS` in
      `room-canvas.tsx`) — not immediately on drag-apart. "All participants go `offline`"
      specifically is not its own separate check; it falls out of the same room's
      `leave_room` path when a member disconnects.

### 7.5 — Avatar UI

> **Redesigned twice on 2026-08-13.** First pass: claymorphism (chunky borders, offset
> shadows, Fredoka+Nunito fonts). Second pass, same day: **replaced** that with a
> pixel-art/retro-arcade theme — Press Start 2P (headings/buttons only) + VT323 (body,
> at a larger base size than the dashboard default since VT323 draws small), an
> NES-adjacent 8-color palette (`character-colors.ts`), `border-radius: 0` forced
> theme-wide (`presence/game-theme.css`), hard unblurred offset shadows, and a
> checkerboard tile-grid canvas background in place of the dot-grid. Still scoped to the
> presence page only, isolated from the dashboard's shadcn tokens.

- [x] Animated states matching 7.3 exactly: working, idle, offline. Nothing else — an
      avatar must never encode *what* someone is working on.
      `components/wakaclock/presence/character-avatar.tsx` renders a hand-authored
      10x12 pixel-grid sprite (a `<rect>` per grid cell) whose eye/mouth openness and a
      small blinking "status LED" square change per `PresenceState`, never file/project/
      branch data.
- [x] Drag-to-join as the primary interaction; the room is a canvas, not a list.
      `room-canvas.tsx`, `@dnd-kit/core` — only the current user's own character is
      draggable (everyone else renders read-only), since dragging always reports the
      *authenticated* caller's new position, never the position of whoever's avatar was
      visually grabbed.
- [x] `prefers-reduced-motion` must stop the animation loops. Continuous idle animation is
      an accessibility problem and a battery problem. `hooks/use-reduced-motion.ts` gates
      the CSS `steps()`-eased bob/sway/blink classes in `CharacterAvatar` and the
      drag-together `CelebrationBurst` effect; `game-theme.css` also carries a
      `prefers-reduced-motion` media-query fallback in case a class ever slips through
      without the prop.
- [ ] Render cost is bounded by team size, not org size (see 7.2) — target 20–30 avatars
      per room before virtualisation is needed. **Not verified.** No virtualisation exists
      and no test has rendered a room at that size; the room-scoping in 7.2 makes it
      unlikely to matter soon, but the claim itself is unverified.
- [x] **This is design-led, not engineering-led.** Whether the avatars read as charming or
      cheap decides adoption more than any backend choice in this phase, and no amount of
      correct SSE plumbing compensates for animation that looks unfinished. Addressed via
      two separate `/ui-ux-pro-max` design passes this session — real design time was
      spent both times, not a placeholder recolour; whether the final pixel-art direction
      reads as charming rather than cheap is still a subjective call for the owner to make
      against a running instance, not something a checkbox can certify.

### 7.6 — Positioning consequences

- Competitive set moves from WakaTime to Gather / Teamflow / Discord. Comparison content
  built against WakaTime stays valid for the analytics half of the product but is no longer
  the main story.
- Buyer moves from the individual developer to the remote team, which supports per-seat
  pricing well above the current flat $12/mo.
- **The marketing site must not describe any of this in the present tense until it ships.**
  `frontend/app/lib/seo/site.ts` exports `IN_DEVELOPMENT` for exactly this reason; unbuilt
  capabilities are excluded from `PRODUCT_ANSWER`, from `SoftwareApplication` structured
  data, and from every FAQ answer. That site was audited once to remove claims the code
  could not support — do not reintroduce them from the roadmap.

### 7.7 — Open questions

- ~~What happens when a participant's editor closes mid-session — does the session pause
  or end?~~ **Resolved 2026-08-13, by construction rather than by a deliberate design
  call:** leaving the room (`POST /presence/rooms/:room_id/leave`) calls
  `coworking_session_service.leave()`, so the session ends/shrinks immediately. There is no
  separate "pause" state — going idle or briefly disconnecting is covered by the 3-minute
  grace period (7.4) instead, which only applies to *drag-apart*, not to leaving the room
  outright. Whether that's the right behavior for an editor crash vs. a deliberate leave is
  still worth revisiting, since the client can't currently distinguish the two.
- Is presence visible across teams within an org, or strictly per-team? 7.2 assumes
  strictly per-team.
- Does an idle avatar remain in the room or fade out? Fading is kinder; remaining is more
  useful for "who is around today".
- Should co-working sessions be attributable to a project? The data supports it, but
  inferring it means reading `project` in the presence layer, which 7.0 forbids —
  resolve by attributing after the fact from each participant's own heartbeats.

---

## Phase 8 — WakaTime-Style Transcript-Based AI Attribution

### Status note (2026-08-14)

Six commits landed the transcript-parsing pipeline's core and ran it live, not just
against fixtures: `event.rs`/`patch.rs`/`path.rs`/`parser.rs` (pure types + shared
trait), `codex.rs` + `claude.rs` (real parsers, fixture-tested), `correlation.rs`
(AI-vs-Human matching decision, in-memory pool only), `state.rs` (SQLite cursor +
delivery dedup), and `wakaclock ai sync`/`wakaclock ai status` CLI commands. Full
verification record, including a real bug found and fixed by running against a live
session (not a fixture) and a byte-exact idempotency check, is in
`crates/wakaclock-core/src/ai/VERIFICATION.md`.

**Not done, in priority order for whoever continues this:**
1. Server-side dedup by `ai_event_id` — the pre-existing `extensions/ai-agents/` hooks
   and this new transcript path are both active right now and will double-count the
   same edit under different `ai_event_id` schemes until this lands (8.1's
   "never let hook and transcript parser submit the same event twice" is currently
   violated in practice, not just in principle).
2. `ai-sync.lock` cross-process locking (8.6) — not implemented; single-writer SQLite
   makes concurrent runs safe but uncoordinated, not race-free in intent.
3. Gemini CLI parser — blocked on having a real local transcript to verify against.
4. Wiring `correlation.rs` into a live path — it's tested in isolation but nothing
   calls it yet; `wakaclock ai sync` deliberately bypasses it (no editor buffer exists
   in that path, see 8.2's "outside VS Code" case), so `correlation.rs` only matters
   once the VS Code extension itself starts producing `EditorObservation`s.
5. Historical reprocessing, retiring/migrating the old hooks, dashboard Unattributed
   labeling, privacy docs, packaged E2E tests — none started.

The granular checkboxes below this note were **not** individually re-audited item by
item (165 lines) — only 8.0's top-level committed-scope list was corrected to match
the above. Treat an unmarked `[ ]` elsewhere in 8.1–8.9 as before: unaudited, not
necessarily false.

### Context and decision

Added 2026-08-13 after diagnosing why the AI Stats page reports work performed with an
AI agent as Human. The current dashboard is faithfully displaying what was ingested: the
VS Code extension labels every observed text-document change as human activity, while AI
metadata only arrives when a separate agent hook successfully sends a second heartbeat.
There is no component that correlates those two observations or suppresses the duplicate
human record.

The earlier **AI Agent Code Tracking** section in this document proposes heuristics such
as "large edit with no recent keypress" and detection of installed AI extensions. Those
heuristics are not sufficient for production attribution and are superseded by this
phase. A large paste, formatter, refactor, code generator, or file restore is not proof of
AI use; conversely, an AI agent can make a one-character edit. Installed extensions are
also not proof that a particular edit came from them.

The chosen design follows WakaTime's current architecture:

1. The editor emits ordinary activity heartbeats with rich IDE metadata.
2. `wakaclock-cli` reads local AI-agent transcripts/activity logs using one parser per
   supported agent.
3. Parsers normalize tool activity into a common `AiEditEvent` model.
4. The CLI correlates AI events with editor heartbeats by normalized file path and time.
5. A matching editor heartbeat is replaced by one AI-attributed heartbeat, preserving
   useful editor metadata and preventing the same edit from being counted as Human.
6. Events that cannot be proven or safely correlated remain unattributed; the system does
   not guess merely to increase the AI percentage.

This belongs in `wakaclock-cli`/`wakaclock-core`, not in the VS Code extension. The CLI is
the hub shared by present and future editors, and transcript parsing must continue to work
when an agent edits files outside VS Code or when a different supported editor is used.

### 8.0 — Outcome, scope and non-goals

**Required outcome:** when Codex applies one patch to one file, AtoAxis records exactly one
AI edit event for that patch, attributes its added/deleted lines to `codex`, and does not
also add the same editor-observed change to Human keystrokes or Human lines.

Initial committed scope:

- [~] Codex parser exists and is unit-tested against a real-transcript-shaped fixture
      (`crates/wakaclock-core/src/ai/codex.rs`), but has not been run against a live
      Codex session — only Claude Code has been verified end-to-end (see
      `ai/VERIFICATION.md`, 2026-08-14). Correlation is not wired into the live path;
      `wakaclock ai sync` builds AI-attributed heartbeats directly from parsed events
      with no editor buffer to correlate against, which is a deliberate, documented
      choice for the "agent edits outside the IDE" case (8.2), not an oversight.
- [x] Claude Code parser — implemented, unit-tested, and run live against a real
      session (this one). Found and fixed a real bug this way: a brand-new file's
      `structuredPatch` is empty, not a single addition hunk (`ai/CAPABILITIES.md`'s
      2026-08-14 correction note).
- [ ] Gemini CLI parser — not started. No Gemini CLI installation was available to
      capture a real transcript shape against; `ai/fixtures/gemini_cli/README.md`
      documents this explicitly rather than guessing at a shape.
- [x] Shared parser interface (`ai/parser.rs`'s `AiActivityParser` trait) — Codex and
      Claude Code both implement it; adding Gemini or another agent needs no change to
      `correlation.rs`.
- [~] Local parser state and event idempotency exist (`ai/state.rs`, SQLite-backed
      cursor + delivered-event dedup, verified idempotent via a live double-run — see
      `ai/VERIFICATION.md`). Cross-process locking (`ai-sync.lock`) and diagnostics
      beyond plain stdout are not implemented — `ai/state.rs`'s doc comment explains
      why a single local writer is safe without the lock, just uncoordinated.
- [ ] Historical reprocessing path — not started.

Non-goals for the first release:

- [ ] Do not upload prompts, model responses, full patches, transcript files or source
      code. They may be read locally and held briefly in memory only to derive metadata.
- [ ] Do not classify an edit as AI solely from edit size, edit speed, installed
      extensions, commit-message text, or the absence of physical keypresses.
- [ ] Do not promise exact token cost until model identity, billable token semantics and
      pricing-version data are designed separately. Token counts may be captured as
      optional raw metadata, but cost reporting is out of this phase.
- [ ] Do not silently rewrite historical data during normal heartbeat ingestion.
- [ ] Do not make AI transcript parsing a prerequisite for ordinary time tracking. Parser
      failures must degrade to unattributed/editor activity, never block heartbeats.

### 8.1 — Current implementation inventory and gaps

The repository already contains useful pieces, but they do not yet form an attribution
pipeline:

| Area | Current state | Required change |
|---|---|---|
| Core heartbeat | `backend/api/crates/wakaclock-core/src/heartbeat.rs` contains `is_ai_generated`, agent/provider/model/source/confidence/event ID and line fields | Keep the wire fields; add a separate local `AiEditEvent` domain model rather than using `Heartbeat` as the parser model |
| CLI | `backend/api/crates/wakaclock-cli/src/main.rs` accepts `--ai-*` flags and treats a present `ai_agent` as AI | Add AI sync orchestration, parser state, correlation and diagnostic subcommands |
| VS Code buffer | `extensions/vscode/src/buffer.ts` increments keystrokes, chars and `humanLines*` for every text change | Treat these values as editor-observed/unattributed until correlation; clear human metrics when a matching AI event wins |
| Agent integrations | `extensions/ai-agents/` contains Codex/Claude/Gemini hook scripts; Codex currently invokes `wakaclock heartbeat` directly | Convert hooks into optional local event producers/fallbacks, or retire them where transcript parsing is reliable; never let hook and transcript parser submit the same event twice |
| Extension setup | `extensions/vscode/src/agentSetup.ts` installs/configures hooks and exposes setup/status commands | Report parser capability and transcript discovery separately from hook installation; setup must be repeatable and repairable |
| API ingest | `backend/api/src/handlers/v1/heartbeats.rs` correctly makes `ai_agent` authoritative over a contradictory false boolean | Add validation, deterministic event handling and server-side duplicate protection |
| Raw storage | `wakaclock.heartbeats` stores all AI metadata | Add an attribution/event identity suitable for reliable retries and historical overrides |
| AI aggregate | `mv_ai_summary` groups `coalesce(ai_agent, 'human')`; `ai_daily` is additive | Stop treating missing `ai_agent` as proven Human and prevent retry/dual-producer events from inflating additive aggregates |
| Dashboard | AI Stats labels unmatched activity as Human | Rename unknown activity to Unattributed until provenance is established; show parser health/confidence |

Before implementation, update the older heartbeat model example and table inventory in
this document so they include all fields that already exist (`ai_provider`, `ai_model`,
`ai_source`, `ai_confidence`, `ai_event_id`, `human_lines_added/deleted`, and
`active_seconds`). Do not use the older abbreviated model as an implementation contract.

### 8.2 — Target architecture

```text
Editor activity                                        AI activity
────────────────                                       ───────────
VS Code / future editor                                Codex / Claude / Gemini
        │                                                         │
        │ ordinary heartbeat                                     │ local transcript/log
        ▼                                                         ▼
┌─────────────────────┐                               ┌─────────────────────────┐
│ wakaclock-cli input │                               │ agent-specific parsers  │
│ IDE-rich metadata   │                               │ local-only source read  │
└──────────┬──────────┘                               └────────────┬────────────┘
           │                                                       │ AiEditEvent[]
           └──────────────────────┬────────────────────────────────┘
                                  ▼
                    ┌──────────────────────────┐
                    │ attribution correlator   │
                    │ canonical path + time    │
                    │ one-to-one event match   │
                    └─────────────┬────────────┘
                                  │
                    ┌─────────────┴──────────────┐
                    │                            │
          exact/correlated match              no safe match
                    │                            │
                    ▼                            ▼
          AI heartbeat only              unattributed heartbeat
          preserve IDE metadata          never guessed as AI
                    │                            │
                    └─────────────┬──────────────┘
                                  ▼
                         offline queue/API
                                  ▼
                    idempotent raw/event storage
                                  ▼
               AI / Human / Unattributed analytics
```

The transcript parser and correlation stages execute before the existing offline queue.
This guarantees that an offline retry replays the final normalized heartbeat rather than
rerunning attribution against a transcript whose state may have advanced.

### 8.3 — Normalized AI event contract

Add the following conceptual model under
`backend/api/crates/wakaclock-core/src/ai/`:

```rust
pub struct AiEditEvent {
    pub event_id: String,
    pub agent: String,
    pub provider: Option<String>,
    pub model: Option<String>,
    pub session_id: Option<String>,
    pub occurred_at: DateTime<Utc>,
    pub entity: PathBuf,
    pub project_root: Option<PathBuf>,
    pub lines_added: Option<u32>,
    pub lines_deleted: Option<u32>,
    pub input_tokens: Option<u64>,
    pub output_tokens: Option<u64>,
    pub source: AiEventSource,
    pub confidence: AiConfidence,
}

pub enum AiEventSource {
    Transcript,
    AgentHook,
    IdeTelemetry,
}

pub enum AiConfidence {
    Verified,
    Correlated,
    Inferred,
    Unknown,
}
```

Contract rules:

- [ ] `event_id` must be stable across retries. Prefer an agent-supplied tool-call/event
      ID; otherwise hash a versioned tuple of agent, session ID, canonical entity,
      high-precision timestamp and stable transcript record position. Do not use current
      wall-clock time at send time as the sole ID.
- [ ] `entity` is mandatory for line attribution. An AI session event without a concrete
      file may produce an `app`/`ai coding` activity record later, but must not claim file
      lines.
- [ ] Preserve subsecond timestamps whenever the source provides them. Rounding to whole
      seconds makes concurrent events harder to correlate and can cause watermark replay.
- [ ] Line counts are optional because some agents expose a tool call but not an exact
      patch. Missing counts mean "unknown," not zero.
- [ ] Count patch lines using parsed patch semantics. Ignore `+++`/`---` headers and
      metadata; handle file add/delete/rename and multiple hunks explicitly.
- [ ] A parser may emit several events for one transcript turn when several files were
      modified. One event represents one file mutation, enabling entity-level matching.
- [ ] Normalize agent names to stable identifiers (`codex`, `claude-code`, `gemini-cli`)
      and keep provider/model separate so dashboards can group each dimension correctly.
- [ ] The core model must serialize only derived metadata. Raw transcript lines, prompts,
      responses and patch bodies are deliberately absent from the type.

Proposed files:

```text
backend/api/crates/wakaclock-core/src/ai/
├── mod.rs
├── event.rs          # AiEditEvent, source and confidence enums
├── parser.rs         # parser trait, discovery and common errors
├── patch.rs          # safe patch line counting
├── path.rs           # canonicalization and workspace-relative resolution
├── correlation.rs    # matching, preservation and duplicate suppression
├── state.rs          # watermarks/seen-event persistence
├── codex.rs
├── claude.rs
└── gemini.rs
```

### 8.4 — Parser interface and discovery

Use one interface for every agent:

```rust
pub trait AiActivityParser {
    fn id(&self) -> &'static str;
    fn discover(&self, context: &DiscoveryContext) -> DiscoveryResult;
    fn parse_since(
        &self,
        context: &ParseContext,
        cursor: Option<&ParserCursor>,
    ) -> Result<ParseBatch, AiParseError>;
}

pub struct ParseBatch {
    pub events: Vec<AiEditEvent>,
    pub next_cursor: ParserCursor,
    pub warnings: Vec<ParseWarning>,
}
```

Discovery rules:

- [ ] Resolve paths from an explicit Wakaclock configuration override first, then agent
      configuration/environment, then documented platform-specific candidate paths.
- [ ] Support macOS/Linux first. Windows paths and path normalization must still be
      represented in the design and covered by pure unit tests before claiming support.
- [ ] Distinguish `not installed`, `installed but no transcript found`, `transcript found`,
      `permission denied`, and `unsupported transcript version`. These states must appear
      in `wakaclock ai status` and the extension status UI.
- [ ] Do not recursively scan a user's whole home directory. Search only bounded,
      agent-specific locations.
- [ ] Detect transcript/schema versions where available. A parser must reject an unknown
      incompatible record safely rather than reinterpret arbitrary JSON.
- [ ] Read files incrementally. The cursor should include enough identity to survive log
      rotation (for example source path, inode/file identity where available, byte offset,
      last record timestamp and last stable record ID).
- [ ] Cap individual record size and batch work. A malformed or extremely large transcript
      must not cause unbounded memory/CPU use on every 30-second heartbeat.
- [ ] Parser errors are isolated per agent. One broken Claude record must not suppress a
      valid Codex batch or the ordinary editor heartbeat.

### 8.5 — Agent adapters

#### 8.5.1 Codex

- [ ] Inventory the actual transcript/activity formats emitted by the supported Codex
      clients in fixtures before coding assumptions. Codex CLI and Codex Desktop may not
      share an identical location or schema.
- [ ] Identify file-mutating tool events (`apply_patch` first; add direct write/edit tool
      shapes if present) and extract stable tool-call ID, session ID, timestamp, model,
      patch target files and line counts.
- [ ] Resolve relative paths against the event's recorded working directory/workspace,
      not against whichever directory happens to invoke `wakaclock-cli` later.
- [ ] Split multi-file patches into one `AiEditEvent` per target file while retaining a
      stable parent/tool-call identity in the derived event ID.
- [ ] Add fixtures for update, add, delete, rename, multi-hunk, multi-file, malformed patch,
      missing working directory, repeated tool event and transcript rotation.
- [ ] Treat the existing `extensions/ai-agents/codex/heartbeat-hook.sh` as a temporary
      fallback only. Its current timestamp-derived ID and direct API-bound heartbeat can
      duplicate transcript-derived events and must not remain active unchanged.

#### 8.5.2 Claude Code

- [ ] Discover Claude project/session transcript files without scanning unrelated user
      data.
- [ ] Parse only tool-result records that prove a file edit/write. A conversational claim
      such as "I updated the file" is not evidence.
- [ ] Extract provider/model/session information when present and count concrete patch or
      before/after edit data without persisting either body.
- [ ] Handle transcript records whose schema changes or whose tool result is represented
      by more than one JSON shape; keep versioned fixtures for every supported shape.
- [ ] Migrate the existing Claude plugin hook to the same local normalized event input or
      disable it when transcript discovery is healthy.

#### 8.5.3 Gemini CLI

- [ ] Discover Gemini sessions and extract verified file write/edit tool activity.
- [ ] Map Gemini-specific tool and model identifiers into the shared contract.
- [ ] Add the same patch, path, replay, rotation and malformed-record coverage used for
      Codex and Claude.
- [ ] Migrate the existing Gemini extension hook so it cannot double-submit alongside the
      transcript parser.

#### 8.5.4 Future adapters

- [ ] Add an adapter capability matrix to documentation: file identity, exact diff,
      timestamps, model, tokens and session ID. Missing capabilities must remain visibly
      unknown rather than fabricated.
- [ ] Add Copilot/Cursor only after confirming an authorized, stable local telemetry
      source or supported extension API. Presence of the extension alone is insufficient.
- [ ] Permit third-party agent hooks to submit a normalized event locally through a
      documented CLI command/stdin schema; never require them to know the server's raw
      heartbeat aggregation rules.

### 8.6 — Local parser state, concurrency and privacy

Multiple editor events can launch several CLI processes close together. AI sync therefore
requires durable cursors and cross-process coordination.

Proposed local files:

```text
~/.wakaclock/
├── config.toml
├── queue.sqlite3                 # existing offline queue, exact current name may differ
├── ai-attribution.sqlite3       # parser cursors and recent normalized event metadata
└── ai-sync.lock                 # bounded cross-process sync lock
```

SQLite schema (conceptual):

```sql
CREATE TABLE parser_state (
    parser_id TEXT PRIMARY KEY,
    cursor_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE ai_events (
    event_id TEXT PRIMARY KEY,
    parser_id TEXT NOT NULL,
    entity TEXT NOT NULL,
    occurred_at TEXT NOT NULL,
    derived_metadata_json TEXT NOT NULL,
    matched_heartbeat_id TEXT,
    delivery_state TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
```

Implementation requirements:

- [ ] Acquire `ai-sync.lock` with a short timeout. If another process owns it, skip parsing
      and continue sending the ordinary heartbeat; never block the editor for the full
      parser duration.
- [ ] Parse a batch and advance its cursor transactionally. A crash must either leave the
      old cursor replayable or commit both events and the new cursor.
- [ ] Enforce `event_id` uniqueness locally so transcript replay, hook retry and parser
      retry converge on one event.
- [ ] Retain unmatched events for a bounded correlation window and delivered IDs for a
      bounded deduplication period (initial default: 30 days or 50,000 IDs, whichever is
      smaller; validate with real volume before freezing the value).
- [ ] Delete expired derived metadata automatically. Never copy raw transcript content
      into SQLite, debug logs or crash diagnostics.
- [ ] Store canonical paths only as required for matching and respect the same path
      sanitization rules/configuration used by normal heartbeats.
- [ ] Redact user-home prefixes and prompt-like data from logs. Debug mode may show parser,
      source filename basename, record ID and error class, but not the raw record.
- [ ] Add a config kill switch (`ai_sync_disabled`) and per-parser enable/disable settings.
- [ ] Document that reading local agent logs is opt-in and list exactly which metadata is
      transmitted. Existing privacy/marketing pages must be updated before release.

### 8.7 — Correlation, enrichment and duplicate suppression

Correlation must be deterministic and conservative. It is the component that turns two
observations (the editor saw a change; an AI agent reported a tool edit) into one attributed
heartbeat.

#### Path normalization

- [ ] Normalize separators and lexical `.`/`..` components without allowing paths to
      escape a known workspace root.
- [ ] Resolve symlinks/case sensitivity only when safe and platform-correct. Do not require
      a file to still exist: deletes and renames are valid AI events.
- [ ] Resolve agent-relative paths using the transcript's working directory; resolve
      editor paths using the editor-provided absolute entity.
- [ ] Preserve the original sanitized display entity for upload after matching; a local
      canonical path used for correlation must not defeat user path sanitization.

#### Match policy

Start with two deliberately different windows:

- **Exact duplicate window: 5 seconds.** Same canonical file plus closest timestamp. A
  successful one-to-one match replaces/suppresses the editor's unattributed record.
- **Context window: up to 2 minutes.** May mark category as `ai coding` when an AI session
  is clearly active, but must not claim AI line counts or erase non-zero human activity
  without a concrete file edit match.

Candidate scoring order:

1. Same canonical entity is mandatory for file-line attribution.
2. Unconsumed stable agent event ID.
3. Smallest absolute timestamp difference.
4. Same workspace/project root when available.
5. Compatible line delta when both sources expose it.
6. Higher evidence confidence (`verified` before `correlated` before `inferred`).

Rules:

- [ ] Each AI event can match at most one editor heartbeat, and each editor heartbeat can
      consume at most one event unless an explicit merge rule combines several AI tool
      events for the same buffered editor window.
- [ ] If several AI events for the same file land inside one editor flush window, merge
      their line counts and retain their individual stable IDs in local delivery state;
      derive a deterministic aggregate heartbeat ID.
- [ ] If candidates tie ambiguously, leave the editor activity unattributed and deliver
      the AI event separately only when it has sufficient standalone evidence. Never
      choose randomly.
- [ ] Preserve project, branch, language, dependencies, cursor, machine, editor,
      operating system, user agent and active duration from the editor heartbeat when the
      AI event lacks them.
- [ ] On an AI match set `is_ai_generated=true`, agent/provider/model/source/confidence,
      stable event ID and AI line metrics from the AI event.
- [ ] Clear `human_lines_added`, `human_lines_deleted` and editor-derived "human"
      keystrokes/chars for the portion proven to be the same AI edit. In the first release,
      clear the full matched buffered change; partial mixed attribution requires the
      line-level work described below.
- [ ] Preserve a genuine human edit that happens after the AI edit, even in the same file.
      A non-zero human change beyond the exact duplicate window must remain Human.
- [ ] Mark standalone AI activity with category `ai coding`; extend the server/category
      enum and WakaTime import normalization consistently if this category is not yet a
      first-class value everywhere.

#### Mixed AI and human editing

File/time correlation can identify pure agent edits reliably, but a 30-second editor
buffer can contain both an AI patch and subsequent human correction. Implement in stages:

- [ ] **MVP:** when all observed changes in the buffer fall within the matched event's
      exact window and deltas are compatible, attribute the buffer to AI.
- [ ] **Safety fallback:** when human activity clearly continues outside the window, emit
      a separate Human heartbeat for the residual activity rather than clearing it.
- [ ] **Advanced:** retain timestamped editor change segments in the VS Code buffer instead
      of only totals. Correlate AI events against segments and subtract only matching
      lines/chars. This is required before claiming precise mixed-session attribution.
- [ ] Never manufacture physical keystroke counts by treating inserted character length
      as keys. Rename the current metric in code/UI if it is actually text-change volume
      rather than a real keyboard event count.

### 8.8 — Editor buffer semantics and hook migration

The extension must report observations; attribution belongs to the CLI.

- [ ] Rename internal `humanLinesAdded/humanLinesDeleted` in
      `extensions/vscode/src/buffer.ts` and `types.ts` to
      `observedLinesAdded/observedLinesDeleted` (or equivalent). Preserve backward wire
      compatibility during migration.
- [ ] Add timestamped change segments containing entity, start/end time, chars/lines delta
      and whether VS Code identified a programmatic workspace edit, when that information
      is available without relying on private APIs.
- [ ] Continue buffering and spawning the CLI asynchronously. Transcript parsing must not
      execute on the VS Code extension host thread.
- [ ] Let the CLI return diagnostic attribution counts only in debug/status modes; normal
      heartbeat operation should stay quiet and fast.
- [ ] Replace `AtoAxis: Set Up AI Tracking` semantics: it should enable/discover native
      transcript parsers first and install hooks only for agents that require them.
- [ ] `AtoAxis: Show AI Tracking Status` must report detection and health per source, for
      example `Codex transcript detected · last event 12:31 · syncing`, rather than merely
      confirming an executable exists or a hook was written to config.
- [ ] Migrate existing hook scripts to `wakaclock ai ingest-event --stdin` (local normalized
      spool) instead of `wakaclock heartbeat` (direct server submission). The shared event
      ID makes hook and transcript observations converge locally.
- [ ] Remove or disable previously installed managed hook blocks when native parsing is
      healthy, using the existing marker in config so unrelated user configuration is
      untouched.
- [ ] Build a compatibility path for extension upgrades: old direct hooks must not remain
      active indefinitely after the new parser ships.

### 8.9 — CLI commands and orchestration

Add an `ai` command group to `wakaclock-cli`:

```text
wakaclock ai status [--json]
wakaclock ai sync [--dry-run] [--parser codex]
wakaclock ai ingest-event --stdin
wakaclock ai reprocess --since 7d [--dry-run]
wakaclock ai doctor
```

- [ ] `status`: show enabled parsers, discovery state, last successful parse, cursor age,
      unmatched event count, last delivery and sanitized last error.
- [ ] `sync`: acquire the lock, parse new records, correlate pending editor observations
      where available, and deliver normalized events. `--dry-run` prints counts and
      redacted metadata only; it must not advance cursors or send data.
- [ ] `ingest-event`: validate a versioned JSON schema from optional agent hooks and place
      the normalized event in the local attribution database. It must not accept arbitrary
      server heartbeat fields.
- [ ] `reprocess`: explicit historical scan described in 8.11. It must default to dry-run
      or require a confirmation flag for mutations.
- [ ] `doctor`: verify config, database permissions, lock behavior, parser discovery,
      clock skew and server compatibility without uploading transcript content.
- [ ] Normal `heartbeat` execution performs a bounded incremental AI sync before enqueueing
      the final payload. Establish a strict time budget; if exceeded, send ordinary
      activity and leave events for the next run/background sync.
- [ ] Consider a long-lived background sync process only after profiling shows repeated
      parser startup costs are material. Do not introduce a daemon for the initial build.

### 8.10 — Server validation, idempotency and ClickHouse model

Local deduplication is necessary but not sufficient: offline replay, two editors or a
client reinstall can resubmit an event. Add a server-side authoritative identity.

#### Validation

- [ ] If `ai_agent` is present, force `is_ai_generated=true` (already implemented) and
      validate normalized non-empty agent/provider/source values.
- [ ] Require `ai_event_id` for verified transcript/hook events in the new client version.
      Continue accepting legacy records without it, but classify their confidence as
      unknown and do not promise retry-safe AI metrics.
- [ ] Reject impossible counts and cap values to prevent malformed transcripts or clients
      from creating extreme aggregates.
- [ ] Validate confidence/source enums while retaining a forward-compatible unknown value.
- [ ] Record client/parser schema version for diagnostics and future migrations.

#### Idempotent event storage

Do not rely on `ReplacingMergeTree` alone in front of the existing additive
`SummingMergeTree` materialized view: ClickHouse MVs fire on every inserted block before
background replacement/merge, so retries would still increment `ai_daily` twice.

Add an authoritative event-level table, conceptually:

```sql
CREATE TABLE wakaclock.ai_events
(
    user_id UUID,
    date Date,
    ai_event_id String,
    entity String,
    event_time DateTime64(6),
    ai_agent String,
    ai_provider Nullable(String),
    ai_model Nullable(String),
    ai_source String,
    ai_confidence String,
    ai_lines_added Nullable(UInt32),
    ai_lines_deleted Nullable(UInt32),
    input_tokens Nullable(UInt64),
    output_tokens Nullable(UInt64),
    version UInt64,
    received_at DateTime64(6)
)
ENGINE = ReplacingMergeTree(version)
ORDER BY (user_id, date, ai_event_id);
```

- [ ] Use `(user_id, ai_event_id)` as the logical identity. A retry may update metadata by
      version but must not add another logical event.
- [ ] Query AI metrics from deduplicated event-level state (`argMax`/`FINAL` as appropriate)
      or build a version-aware aggregate pipeline. Do not feed un-deduplicated retries
      directly into additive `ai_daily`.
- [ ] Keep ordinary `heartbeats` for time/duration and IDE metadata. Link the attributed
      heartbeat to `ai_event_id`; `ai_events` is authoritative for AI line/token totals.
- [ ] Redesign `ai_daily` so three provenance buckets are explicit:
      `ai`, `human`, and `unattributed`. `coalesce(ai_agent, 'human')` is not valid because
      absence of AI proof is not proof of human authorship.
- [ ] Define Human as explicit residual/editor activity after correlation, not every row
      with a null agent.
- [ ] Update both live and `heartbeats_incoming` paths consistently. Add migration tests
      proving that a duplicate `ai_event_id` does not change AI totals.
- [ ] Decide how raw-heartbeat retry identity works separately from AI event identity;
      do not overload one ID when an editor buffer can aggregate several AI events.

### 8.11 — Historical attribution and aggregate repair

Historical reprocessing is a separate workflow because old editor heartbeats were already
aggregated as Human and transcript retention varies by agent.

- [ ] `wakaclock ai reprocess --since <duration> --dry-run` discovers available transcript
      history, reports event/date/file counts and estimates matchability without mutation.
- [ ] Bound the range by transcript availability and server retention. Clearly report days
      that cannot be reconstructed instead of silently labeling them Human.
- [ ] Upload historical AI events with deterministic IDs and correlation keys. Never reuse
      current time as the event timestamp.
- [ ] Add a server endpoint/job that rebuilds only the requesting user's AI attribution for
      the affected date range from raw heartbeats plus authoritative `ai_events`.
- [ ] Do not `TRUNCATE` a shared aggregate table to repair one user. Use user/date-scoped
      versioned replacement or an explicit staging-and-swap strategy compatible with
      ClickHouse's asynchronous mutations.
- [ ] Make the repair idempotent: running the same range twice yields identical totals.
- [ ] Keep an audit record containing user, requested range, parser versions, event count,
      start/end time and success/error, but no transcript content.
- [ ] Refresh/requery the dashboard only after the rebuild reaches a committed version so
      users do not observe partially subtracted/re-added totals.

### 8.12 — Dashboard and user-facing diagnostics

- [ ] Rename `Human keystrokes` to `Unattributed editor activity` until the metric is
      explicitly proven Human. Tooltips must explain that editor-observed changes can come
      from humans, AI tools, formatters or generators until attribution completes.
- [ ] Display AI, Human and Unattributed as separate values. Do not force a misleading
      two-way donut when unattributed activity is non-zero.
- [ ] Show confidence breakdown and source (`transcript`, `agent_hook`, `ide_telemetry`) so
      users can distinguish verified and inferred data.
- [ ] Show per-agent lines/events with provider and model only when those fields are known.
- [ ] Add an AI Tracking panel in Settings with parser state, last sync, last event,
      sanitized error, Sync now, Repair setup and Reprocess actions.
- [ ] Explain that enabling transcript tracking reads local agent activity metadata and
      never uploads prompts, responses, patches or source code.
- [ ] Add clock-skew warnings: correlation becomes unreliable when editor and transcript
      timestamps differ materially.
- [ ] Keep marketing claims in future/development tense until all acceptance criteria in
      8.15 pass on packaged builds, not only source checkouts.

### 8.13 — Testing matrix

#### Parser unit tests

- [ ] Golden fixtures for every supported transcript schema/version.
- [ ] Single-file add/update/delete/rename and multi-hunk/multi-file patches.
- [ ] Relative and absolute paths, spaces, Unicode, Windows separators and deleted files.
- [ ] Stable ID across replay, restart and log rotation.
- [ ] Missing/invalid timestamps, missing workspace, unknown model and partial tool results.
- [ ] Malformed/truncated/oversized records are skipped with bounded warnings.
- [ ] Prompt/response/source/patch bodies never appear in serialized events, SQLite or logs.

#### Correlation unit/property tests

- [ ] Same file within 5 seconds matches exactly once.
- [ ] Same file outside the exact window does not erase Human metrics.
- [ ] Different files never match solely because timestamps are close.
- [ ] Closest event wins deterministically; tied ambiguity remains unattributed.
- [ ] Several AI events in one editor buffer combine without losing event IDs.
- [ ] AI edit followed by human correction produces AI plus Human residuals.
- [ ] Canonicalization cannot escape workspace roots or leak unsanitized paths.
- [ ] Random event ordering and repeated batches converge on the same output.

#### State/concurrency tests

- [ ] Two CLI processes contend for the sync lock without duplicate parsing or blocking
      ordinary heartbeat delivery.
- [ ] Crash before/after cursor commit replays safely and does not lose events.
- [ ] SQLite migration from each released schema version preserves pending events.
- [ ] Retention cleanup never removes undelivered/unmatched events prematurely.

#### Server/ClickHouse integration tests

- [ ] Duplicate `(user_id, ai_event_id)` changes no AI totals.
- [ ] Two users may use the same agent event ID without collision.
- [ ] Legacy AI heartbeat without event ID remains readable but visibly low confidence.
- [ ] Null/missing agent activity lands in Unattributed, not Human.
- [ ] Historical reprocess is idempotent and user/date scoped.
- [ ] Live and incoming/reprocess ingestion produce equivalent final analytics.

#### Extension tests

- [ ] Text changes are buffered as observed/unattributed, not prematurely Human.
- [ ] Successful CLI correlation clears only matching activity.
- [ ] Parser timeout/error leaves an ordinary heartbeat queued.
- [ ] Setup/status/repair handle native parser and fallback hook states correctly.
- [ ] Upgrade removes only AtoAxis-managed hook configuration.

#### Packaged end-to-end tests

- [ ] Install the packaged extension and release CLI into a clean temporary home.
- [ ] Run one Codex patch, wait for flush, and assert one AI event, correct file/lines and no
      duplicate Human metrics.
- [ ] Make a manual edit afterward and assert it remains Human/residual activity.
- [ ] Repeat offline, restart, reconnect and verify queue replay does not inflate totals.
- [ ] Repeat the core scenario for Claude Code and Gemini CLI.

### 8.14 — Delivery sequence

Keep changes reviewable and avoid switching the dashboard before ingestion is trustworthy:

1. **PR 1 — Contracts and fixtures**
   - `AiEditEvent`, parser trait, confidence/source enums, patch counter and path utilities.
   - Sanitized real-world fixtures and parser/privacy unit-test harness.
2. **PR 2 — Codex parser and local state**
   - Codex discovery/parser, SQLite cursor/event store, lock and `wakaclock ai status/sync`.
   - No production aggregate/UI change yet.
3. **PR 3 — Correlation and CLI integration**
   - Bounded sync in the heartbeat path, exact-window matching, enrichment, local dedup and
     offline-queue ordering.
4. **PR 4 — Extension observation semantics and hook migration**
   - Rename premature Human counters, timestamped segments, local event hook protocol,
     setup/status/repair upgrade behavior.
5. **PR 5 — Server event identity and analytics migration**
   - `ai_events`, validation, idempotent queries/aggregation and explicit Unattributed
     bucket. Backfill/migration tests are mandatory before deployment.
6. **PR 6 — Dashboard and diagnostics**
   - Three-way attribution UI, confidence/source details and Settings health panel.
7. **PR 7 — Claude and Gemini adapters**
   - Reuse the proven interface/state/correlation path; no agent-specific branches in the
     dashboard or server.
8. **PR 8 — Historical reprocessing**
   - Dry-run, scoped server rebuild, audit state and packaged recovery tests.

Rollout controls:

- [ ] Gate transcript sync behind an opt-in feature flag for the first release.
- [ ] Collect only aggregate operational diagnostics: parser success/error class, latency,
      events found/matched/unmatched and schema version. Never collect transcript content.
- [ ] Start with conservative exact matching and expose Unattributed honestly. Broaden
      windows only after fixture/E2E evidence shows acceptable false-positive risk.
- [ ] Support rollback by disabling new attribution while continuing ordinary heartbeat
      ingestion; schema migrations must be backward-readable by the previous API version.
- [ ] Compare a development user's AtoAxis result against manually reviewed agent edits
      for at least one week before making automatic-AI-attribution marketing claims.

### 8.15 — Definition of done / acceptance criteria

Phase 8 is complete only when all of the following are true:

- [ ] A Codex patch modifying multiple files yields one stable AI event per file with
      correct added/deleted counts and shared session/tool provenance.
- [ ] Matching VS Code activity is not also counted as Human or Unattributed.
- [ ] A manual edit in the same file after the AI patch remains attributable as Human
      residual activity.
- [ ] The same transcript and offline queue can be replayed repeatedly without changing
      final AI totals.
- [ ] Parser failure, permission denial, unknown schema and lock contention never prevent
      ordinary heartbeat delivery.
- [ ] Prompts, responses, patches and source code are absent from network payloads,
      persistent attribution state, server tables, normal/debug logs and diagnostics.
- [ ] Codex, Claude Code and Gemini CLI each pass parser, correlation and packaged E2E
      tests on every platform claimed as supported.
- [ ] AI Stats displays AI, Human and Unattributed without representing missing provenance
      as Human.
- [ ] Settings explains whether each agent is detected and actually producing events,
      including actionable errors.
- [ ] Historical reprocessing is dry-run capable, user/date scoped and idempotent.
- [ ] Privacy documentation and product copy match the shipped behavior exactly.

### 8.16 — Decisions to validate during implementation

- Whether Codex Desktop and Codex CLI expose sufficiently stable, authorized local
  transcript formats to share one adapter or require separate source adapters.
- Whether editor change-segment timestamps are precise enough to subtract mixed Human/AI
  edits, or whether file snapshots/diff ranges are required locally.
- Whether unmatched verified AI events should be uploaded immediately as standalone
  `ai coding` activity or retained briefly to await a late editor heartbeat. Initial
  recommendation: retain for one exact/context window, then upload standalone.
- Whether optional token counts belong in `ai_events` now or in a later dedicated usage
  model. Capturing them now is convenient, but semantics differ across agents and must not
  imply billing accuracy.
- Whether server-level event idempotency should be implemented entirely in ClickHouse or
  with a transactional operational store when the hosted API scales to multiple writers.
  The additive-MV limitation above must be resolved before choosing the simpler-looking
  design.

---

## Phase 9 — Complete Analytics Dashboard and Project Drill-Down

### Context and dependency on Phase 8

Added 2026-08-13 to define the complete backend contract required by the target frontend:

- an overview dashboard with Models, Editors, Languages, Operating Systems, Machines,
  weekday activity, current-period summary and daily AI/Human activity;
- a project gallery with duration and AI productivity cards;
- a project detail page with AI summary, daily activity, languages, editors, files,
  branches and a file-duration packed-bubble visualization;
- prompt, session, token and estimated-cost metrics per project and across the account.

Phase 9 consumes the attributed events produced by **Phase 8**. It must not be implemented
by inventing AI data from ordinary heartbeats. The existing backend can already answer
some duration breakdowns, but it cannot produce reliable prompts, AI sessions, token use,
model cost, or AI/Human line attribution until the transcript/event pipeline exists.

The implementation order is therefore strict:

```text
Phase 8 transcript parsing + correlation + idempotency
                         │
                         ▼
Phase 9 authoritative AI usage/session storage
                         │
                         ▼
Project identity + analytics projections
                         │
                         ▼
Dashboard and project-detail APIs
                         │
                         ▼
Frontend charts/cards/drill-down
```

The frontend screenshots are presentation targets, not metric definitions. Every chart
must state its metric and unit explicitly because the cards mix fundamentally different
quantities: Models use AI line changes or tokens, Editors/Languages/OS/Machines use active
seconds, AI-vs-Human uses line changes, and cost uses estimated currency. The backend must
never silently compare or percentage one unit against another.

### 9.0 — Target product surfaces and data ownership

#### Dashboard overview

- [ ] Models donut: AI lines changed per model, with optional token/cost toggles later.
- [ ] Editors/AI clients donut: active duration by editor or AI client; the response must
      identify which dimension is being displayed.
- [ ] Languages donut: duration by language.
- [ ] Operating Systems donut: duration by OS.
- [ ] Machines donut: duration by sanitized machine display name.
- [ ] Today summary: today's duration, active-day average, best day and change against the
      immediately preceding equal-length period.
- [ ] AI vs Human by day: additions and deletions for AI, Human and Unattributed.
- [ ] Weekday chart: duration grouped Monday–Sunday in the user's timezone.
- [ ] Project cards: duration, attribution, prompts, sessions, tokens and estimated spend.

#### Projects index

- [ ] Show all projects with activity in the selected date range.
- [ ] Allow sorting by duration, recent activity, AI changes, prompts, tokens and cost.
- [ ] Each project card links by stable `project_id`, never by a mutable display name.
- [ ] Show partial/unknown data explicitly; do not turn missing token or price coverage into
      zero usage or zero cost.
- [ ] Paginate/cursor projects rather than returning an unbounded account history.

#### Project detail

- [ ] Header: project name, selected date range, branch filter, project duration and total
      duration across all projects for context.
- [ ] AI Coding summary: AI percentage, AI/Human/Unattributed lines, tokens, estimated
      cost, sessions and prompts.
- [ ] Daily duration/activity graph.
- [ ] Daily AI/Human/Unattributed additions and deletions.
- [ ] Languages and Editors/AI clients breakdowns.
- [ ] Files list ordered by duration.
- [ ] Packed-bubble file view using the same file dataset as the list.
- [ ] Branches list with duration and a branch filter that affects every compatible panel.
- [ ] Drill-down endpoints for large file/branch/history datasets.

### 9.1 — Current backend capability audit

The current code already provides part of the target and should be evolved rather than
duplicated:

| Capability | Current implementation | Gap |
|---|---|---|
| Total/daily average/best day | `backend/api/src/services/stats.rs` | No previous-period comparison; date boundaries use server-local time |
| Languages | `language_daily`, `/stats/:range`, `/insights/languages/:range` | Need unified response percentages/units and project-scoped equivalent |
| Editors | `editor_daily` | Does not distinguish editor, AI agent and AI client/tool |
| Operating systems | `os_daily` | Needs project-scoped equivalent and timezone-safe range handling |
| Projects/duration | `project_daily`, `backend/api/src/services/projects.rs` | Name-based identity; no AI/project card metrics; no pagination or drill-down |
| Branches | `insights_agg.branch` | No dedicated project/branch daily table or project-detail API |
| Machines | Present only in raw `heartbeats.machine` | No aggregate table or analytics API |
| Files | Present as raw `heartbeats.entity` | No sanitized relative-file aggregate, paging or project endpoint |
| Daily AI lines | `backend/api/src/services/ai_stats.rs` | Null agent is effectively treated as Human; no Unattributed; retry-safe event identity incomplete |
| Models | `ai_model` exists on heartbeat | No authoritative model usage aggregate; source is usually empty without Phase 8 |
| Prompts/tokens/sessions | Some WakaTime import fields exist transiently | No stored first-class usage/session model and no API |
| Estimated spend | None | Requires token semantics, time-versioned pricing and coverage reporting |

Do not create a second set of endpoints that disagrees with `/stats`, `/projects`, and
`/users/current/ai_stats` indefinitely. Introduce v2 analytics response models, migrate the
frontend, then deprecate or implement the older endpoints as adapters over the same
services/projections.

### 9.2 — Metric dictionary (authoritative semantics)

Before schema work, define these terms in Rust types and API documentation:

| Metric | Definition | Unit | Source |
|---|---|---|---|
| `active_seconds` | Editor-observed active duration after existing idle/gap rules | seconds | Heartbeats |
| `ai_lines_added/deleted` | Patch lines proven to originate from an AI event | lines | Phase 8 `ai_events` |
| `human_lines_added/deleted` | Residual observed lines explicitly classified Human after correlation | lines | Phase 8 attribution |
| `unattributed_lines_added/deleted` | Observed lines whose provenance cannot be proven | lines | Phase 8 attribution |
| `prompt_count` | Count of user-prompt submission events, not messages, tool calls or model retries | prompts | Transcript usage events |
| `session_count` | Count of unique stable AI coding session IDs in scope | sessions | `ai_sessions` |
| `input_tokens` | Provider-reported model input tokens | tokens | Transcript/provider metadata |
| `output_tokens` | Provider-reported model output tokens | tokens | Transcript/provider metadata |
| `cache_read/write_tokens` | Provider-reported cache token classes | tokens | Transcript/provider metadata |
| `estimated_cost_microusd` | Cost estimate under the price version effective at usage time | micro-USD | Usage + pricing catalog |
| `ai_percentage` | AI changes / (AI + Human changes), excluding Unattributed | percent | Attributed line totals |
| `attribution_coverage` | (AI + Human changes) / all observed changes | percent | All three provenance buckets |
| `cost_coverage` | Priced tokens / all reported tokens for which cost would be expected | percent | Usage/pricing join |

Rules:

- [ ] `AI changes = ai_lines_added + ai_lines_deleted`.
- [ ] `Human changes = human_lines_added + human_lines_deleted`.
- [ ] `Unattributed changes = unattributed_lines_added + unattributed_lines_deleted`.
- [ ] `ai_percentage` is `null`, not `0`, when there are no AI or Human changes.
- [ ] Always return `attribution_coverage`; a 100% AI percentage with 10% attribution
      coverage must not appear equivalent to a fully attributed project.
- [ ] AI time is not inferred from AI line percentage. Only report `ai_seconds` when a
      defensible event/session duration source exists.
- [ ] Character insertion count is not a physical keystroke count. Rename any UI/API
      metric that currently implies otherwise unless the client captures actual keys.
- [ ] `prompt_count` excludes system prompts, assistant messages, tool calls and provider
      internal retries unless a provider only exposes a coarser count; coarse counts must
      carry a quality/coverage marker.
- [ ] Cost is always labeled **estimated** unless imported from an authoritative billing
      record. A Claude/Codex subscription plan is not API token spend.

### 9.3 — Stable project identity and project resolution

The existing tables primarily identify a project by name. That is insufficient for a
clickable detail route because names can be renamed, merged, duplicated or contain unsafe
URL characters.

Evolve `wakaclock.projects` conceptually to:

```sql
CREATE TABLE wakaclock.projects
(
    user_id UUID,
    project_id UUID,
    canonical_name String,
    display_name String,
    repository Nullable(String),
    root_fingerprint Nullable(String),
    first_heartbeat_at DateTime64(6),
    last_heartbeat_at DateTime64(6),
    created_at DateTime64(6),
    updated_at DateTime64(6),
    version UInt64
)
ENGINE = ReplacingMergeTree(version)
ORDER BY (user_id, project_id);
```

Requirements:

- [ ] Generate/persist `project_id` server-side when a resolved project is first seen.
- [ ] Prefer a privacy-safe repository/root fingerprint for identity; never use a raw
      absolute path as a public project ID.
- [ ] Map incoming `project` names/rules to a canonical project ID before analytics
      projection.
- [ ] Extend `heartbeats`, `ai_events`, `ai_usage_events`, and aggregate dimensions with
      nullable `project_id` during migration; eventually require it for resolved projects.
- [ ] Project merges resolve multiple source identities into one canonical target ID. Do
      not merely rename result rows at read time because that can duplicate sessions,
      tokens and usage when the same source appears under aliases.
- [ ] Keep historical aliases so old URLs/imports can redirect to the canonical project.
- [ ] Every project endpoint verifies `(authenticated user_id, project_id)` ownership.
- [ ] Frontend routes use `/dashboard/wakaclock/projects/:project_id`; display names remain
      editable without breaking links.

### 9.4 — Authoritative AI usage and session storage

Phase 8 defines authoritative file edit events. Phase 9 adds usage and session records
needed for the project cards and detail page.

#### `wakaclock.ai_usage_events`

```sql
CREATE TABLE wakaclock.ai_usage_events
(
    user_id UUID,
    date Date,
    usage_event_id String,
    ai_session_id String,
    event_time DateTime64(6),
    project_id Nullable(UUID),
    ai_agent String,
    ai_provider Nullable(String),
    ai_model Nullable(String),
    prompt_count UInt32,
    input_tokens Nullable(UInt64),
    output_tokens Nullable(UInt64),
    cache_read_tokens Nullable(UInt64),
    cache_write_tokens Nullable(UInt64),
    estimated_cost_microusd Nullable(UInt64),
    pricing_version Nullable(String),
    token_source String,
    version UInt64,
    received_at DateTime64(6)
)
ENGINE = ReplacingMergeTree(version)
ORDER BY (user_id, date, usage_event_id);
```

- [ ] `(user_id, usage_event_id)` is the logical identity.
- [ ] Stable provider event/message ID is preferred. Otherwise derive a versioned stable
      ID from session/source record identity, never upload time.
- [ ] Nullable token fields mean unavailable. Missing is not zero.
- [ ] Store only counts and identity metadata; never prompts/responses.
- [ ] Pricing may be calculated during projection, but record the price version used so a
      later price-table update does not rewrite historical estimates silently.

#### `wakaclock.ai_sessions`

```sql
CREATE TABLE wakaclock.ai_sessions
(
    user_id UUID,
    ai_session_id String,
    started_at DateTime64(6),
    ended_at Nullable(DateTime64(6)),
    ai_agent String,
    ai_provider Nullable(String),
    primary_model Nullable(String),
    ai_client Nullable(String),
    editor Nullable(String),
    machine Nullable(String),
    operating_system Nullable(String),
    prompt_count UInt64,
    version UInt64,
    updated_at DateTime64(6)
)
ENGINE = ReplacingMergeTree(version)
ORDER BY (user_id, ai_session_id);
```

- [ ] Session count uses unique stable IDs, never heartbeat count.
- [ ] A session remains open until an explicit end or a documented inactivity timeout.
- [ ] Reopened/resumed sessions retain their source session identity where the agent does.
- [ ] Primary model is `null` for multi-model sessions unless the API also returns a model
      distribution; do not arbitrarily select the last model.

#### `wakaclock.ai_session_projects`

```sql
CREATE TABLE wakaclock.ai_session_projects
(
    user_id UUID,
    ai_session_id String,
    project_id UUID,
    first_event_at DateTime64(6),
    last_event_at DateTime64(6),
    event_count UInt64,
    ai_lines_changed UInt64,
    token_allocation_method String,
    version UInt64
)
ENGINE = ReplacingMergeTree(version)
ORDER BY (user_id, ai_session_id, project_id);
```

Token/project allocation rules:

1. Use an explicit project/workspace on the usage record when available.
2. Otherwise attach to the sole project touched by the session during the relevant usage
   window.
3. For multiple projects, allocate using event-level mapping if tokens are attached to a
   message/tool result.
4. If only session totals exist, either allocate by documented AI-line proportion or keep
   them in an `unattributed_project` bucket. Initial recommendation: keep unattributed
   rather than imply precision.
5. Never copy the full session token/cost total into every linked project.

### 9.5 — Model pricing and estimated cost

Add a time-versioned pricing catalog:

```sql
CREATE TABLE wakaclock.ai_model_pricing
(
    provider String,
    model String,
    effective_from DateTime64(6),
    effective_to Nullable(DateTime64(6)),
    input_microusd_per_million UInt64,
    output_microusd_per_million UInt64,
    cache_read_microusd_per_million Nullable(UInt64),
    cache_write_microusd_per_million Nullable(UInt64),
    currency FixedString(3),
    pricing_version String,
    updated_at DateTime64(6)
)
ENGINE = ReplacingMergeTree(updated_at)
ORDER BY (provider, model, effective_from);
```

- [ ] Use integer micro-USD or a fixed decimal representation; never binary `Float64` for
      stored money.
- [ ] Match the price effective at `ai_usage_events.event_time`.
- [ ] Keep distinct input/output/cache rates; providers bill these differently.
- [ ] Normalize model aliases before pricing, but retain the raw model identifier for
      diagnostics.
- [ ] Unknown model, token class or price returns `estimated_cost = null`, not zero.
- [ ] Return `cost_coverage_percent` and `unpriced_tokens` with every aggregate cost.
- [ ] Keep pricing updates auditable and manually reviewable. Do not silently scrape live
      pricing in the request path.
- [ ] Subscription/seat fees are not inferred from token usage and remain outside this
      metric unless a future billing import supplies authoritative actual cost.

### 9.6 — Analytics projection tables

All projections must be rebuildable from raw heartbeats plus authoritative AI event,
usage, session and project-identity tables. Avoid a design where an incoming retry fires
an additive MV before deduplication.

#### Existing account-level projections to retain/evolve

- `daily_totals`
- `language_daily`
- `editor_daily`
- `os_daily`
- `project_daily`

Add consistent columns/semantics where necessary: `active_seconds`, heartbeat count,
project ID, data version and timezone strategy.

#### `machine_daily`

```text
user_id, date, machine_key, machine_display_name,
total_seconds, heartbeat_count, data_version
```

- [ ] Hash or otherwise sanitize the machine identity used internally.
- [ ] Return a user-friendly name only to its owner; team analytics require a separate
      privacy decision.

#### `ai_model_daily`

```text
user_id, date, provider, model,
ai_events, ai_lines_added, ai_lines_deleted,
prompts, sessions, input_tokens, output_tokens,
cache_read_tokens, cache_write_tokens,
estimated_cost_microusd, priced_tokens, total_reported_tokens,
data_version
```

#### `ai_client_daily`

```text
user_id, date, ai_agent, ai_client, editor,
active_seconds, ai_events, sessions, ai_lines_changed,
data_version
```

Dimension definitions:

- `editor`: VS Code, Zed, Cursor, terminal host, etc.
- `ai_agent`: Codex, Claude Code, Gemini CLI, etc.
- `ai_client`: Codex VS Code, Codex CLI, Claude Code CLI, etc.

The API must not label an AI client distribution as Editors unless that is the explicit
selected dimension.

#### `ai_project_daily`

```text
user_id, date, project_id,
total_seconds,
ai_lines_added, ai_lines_deleted,
human_lines_added, human_lines_deleted,
unattributed_lines_added, unattributed_lines_deleted,
prompts, sessions,
input_tokens, output_tokens, cache_read_tokens, cache_write_tokens,
estimated_cost_microusd, priced_tokens, total_reported_tokens,
data_version
```

#### Project-detail projections

`project_file_daily`:

```text
user_id, date, project_id, entity_key, relative_path,
language, branch, total_seconds, heartbeat_count,
ai_lines_added/deleted, human_lines_added/deleted,
unattributed_lines_added/deleted, data_version
```

`project_branch_daily`:

```text
user_id, date, project_id, branch,
total_seconds, heartbeat_count,
ai_lines_added/deleted, human_lines_added/deleted,
unattributed_lines_added/deleted, data_version
```

`project_language_daily`:

```text
user_id, date, project_id, language,
total_seconds, heartbeat_count, data_version
```

`project_editor_daily`:

```text
user_id, date, project_id, editor, ai_client,
total_seconds, heartbeat_count, data_version
```

`project_activity_daily`:

```text
user_id, date, project_id, branch,
total_seconds, heartbeat_count,
ai_lines_added/deleted, human_lines_added/deleted,
unattributed_lines_added/deleted, data_version
```

Projection rules:

- [ ] File paths returned by APIs are project-relative and sanitized. Raw absolute paths
      remain private raw-ingestion data and must not appear in frontend responses.
- [ ] A deleted file remains aggregatable via stable `entity_key` and last known relative
      path.
- [ ] File rename handling must define whether history follows the logical file or appears
      under both paths. Initial implementation may treat paths separately but must expose
      this behavior explicitly.
- [ ] Branch `null`/empty maps to `Unknown`, not `main`.
- [ ] Project detail duration by dimension must reconcile with project total within known
      rounding/unknown buckets.
- [ ] Build version-aware projections or query deduplicated authoritative events. Do not
      connect retryable `ReplacingMergeTree` sources straight into additive
      `SummingMergeTree` MVs.
- [ ] Store `data_version`/projection version so a reprocess can publish a coherent new
      snapshot instead of partially mutating visible aggregates.

### 9.7 — Timezone, date ranges and comparison periods

The target UI contains Today, weekdays, best day and period comparisons. These are wrong
if server-local dates are used for a user in another timezone.

- [ ] Add an IANA timezone to the user profile/settings, defaulting from explicit client
      setup rather than permanently assuming server locale.
- [ ] Allow a validated `timezone` query override for preview/migration, then prefer the
      saved user timezone.
- [ ] Store source timestamps in UTC with microsecond precision.
- [ ] Compute local day boundaries, weekday and Today using the user's timezone.
- [ ] Document DST behavior: a local day can have 23 or 25 hours; use timezone conversion,
      not fixed UTC offsets.
- [ ] Decide projection strategy: either store a configured local date and rebuild when
      timezone changes, or keep UTC buckets fine-grained enough to aggregate by local day
      correctly at read time. Do not silently reuse old local-date aggregates after a
      timezone change.
- [ ] Validate `start <= end` and cap public analytics ranges (initial recommendation:
      366 days per request; all-time uses a dedicated optimized path).

Previous-period calculation:

```text
current:  Aug 7–Aug 13  (7 inclusive local dates)
previous: Jul 31–Aug 6  (the immediately preceding 7 dates)

percent = ((current_seconds - previous_seconds) / previous_seconds) * 100
```

- [ ] If previous is zero and current is positive, return `direction: new_activity` and
      `percent: null`, never infinity.
- [ ] If both are zero, return `direction: unchanged`, `percent: 0`.
- [ ] Return raw current/previous seconds alongside the percentage so the frontend does
      not reverse-engineer values from formatted text.
- [ ] Define daily average as average across **days with activity** for the screenshot's
      intended value, while also returning calendar-day average if useful. Name both
      explicitly to avoid ambiguity.

### 9.8 — API design conventions

All new endpoints:

- authenticate from the session/API key and derive `user_id`; never accept another user ID
  from the browser;
- validate ISO dates, IANA timezone, enum/sort/filter values and pagination cursors;
- return raw numeric values plus optional formatted text; frontend formatting must not be
  forced to parse strings;
- include `generated_at`, `data_version`, metric/unit metadata and coverage indicators;
- use stable response versioning so the frontend can migrate safely;
- return `null` for unavailable metrics and zero only for a known measured zero;
- support `ETag`/cache keys after correctness is established.

Common range object:

```json
{
  "start": "2026-08-07",
  "end": "2026-08-13",
  "timezone": "Asia/Bangkok",
  "days_included": 7
}
```

Common breakdown item:

```json
{
  "name": "TypeScript",
  "value": 47520,
  "metric": "active_duration",
  "unit": "seconds",
  "percentage": 41.45,
  "text": "13h 12m"
}
```

Percentages should be calculated in the backend from the same filtered total returned in
the response. Frontend and backend must not compute different denominators.

### 9.9 — Dashboard analytics API

Add:

```http
GET /api/v1/dashboard/analytics
    ?start=2026-08-07
    &end=2026-08-13
    &timezone=Asia/Bangkok
```

Conceptual response:

```json
{
  "schema_version": 1,
  "generated_at": "2026-08-13T12:40:00Z",
  "data_version": 42,
  "range": {
    "start": "2026-08-07",
    "end": "2026-08-13",
    "timezone": "Asia/Bangkok",
    "days_included": 7
  },
  "summary": {
    "today_seconds": 19440,
    "today_text": "5h 24m",
    "active_day_average_seconds": 16380,
    "calendar_day_average_seconds": 14040,
    "most_active_day": {
      "date": "2026-08-10",
      "total_seconds": 20160,
      "text": "5h 36m"
    },
    "previous_period": {
      "current_seconds": 114000,
      "previous_seconds": 92683,
      "percent": 23.0,
      "direction": "increase"
    }
  },
  "breakdowns": {
    "models": {
      "metric": "ai_lines_changed",
      "unit": "lines",
      "items": []
    },
    "editors": {
      "metric": "active_duration",
      "unit": "seconds",
      "items": []
    },
    "languages": {
      "metric": "active_duration",
      "unit": "seconds",
      "items": []
    },
    "operating_systems": {
      "metric": "active_duration",
      "unit": "seconds",
      "items": []
    },
    "machines": {
      "metric": "active_duration",
      "unit": "seconds",
      "items": []
    },
    "weekdays": {
      "metric": "active_duration",
      "unit": "seconds",
      "items": []
    }
  },
  "daily_attribution": [
    {
      "date": "2026-08-13",
      "ai_added": 7200,
      "ai_deleted": 110,
      "human_added": 30,
      "human_deleted": 6,
      "unattributed_added": 12,
      "unattributed_deleted": 0,
      "unit": "lines"
    }
  ],
  "coverage": {
    "attribution_percent": 98.9,
    "token_percent": 95.0,
    "cost_percent": 91.4
  }
}
```

Implementation notes:

- [ ] Query independent breakdowns concurrently in `DashboardAnalyticsService` using the
      shared ClickHouse client.
- [ ] Return all seven weekdays, including zero values, in deterministic Monday–Sunday
      order.
- [ ] Model display names may be normalized (`claude-sonnet-*` → `Sonnet`) only if the raw
      model and provider remain available for tooltips/drill-down.
- [ ] Keep this endpoint sized for initial dashboard render. Large project/file lists are
      separate endpoints.

### 9.10 — Project analytics list API

Add:

```http
GET /api/v1/projects/analytics
    ?start=2026-08-07
    &end=2026-08-13
    &timezone=Asia/Bangkok
    &sort=duration
    &order=desc
    &limit=30
    &cursor=<opaque>
```

Supported sort values:

```text
duration | recent | ai_changes | prompts | sessions | tokens | estimated_cost
```

Project card contract:

```json
{
  "project_id": "018f...uuid",
  "name": "wakaclock",
  "repository": null,
  "last_activity_at": "2026-08-13T12:30:00Z",
  "total_seconds": 30900,
  "duration_text": "8h 35m",
  "ai": {
    "lines_added": 10500,
    "lines_deleted": 500,
    "changes": 11000,
    "percentage": 99.63
  },
  "human": {
    "lines_added": 35,
    "lines_deleted": 6,
    "changes": 41,
    "percentage": 0.37
  },
  "unattributed": {
    "lines_added": 100,
    "lines_deleted": 20,
    "changes": 120,
    "percentage_of_observed": 1.08
  },
  "attribution_coverage_percent": 98.9,
  "prompts": 74,
  "sessions": 8,
  "tokens": {
    "input": 401600000,
    "output": 753900,
    "cache_read": 0,
    "cache_write": 0,
    "total": 402353900,
    "coverage_percent": 95.0
  },
  "estimated_spend": {
    "amount_microusd": 119000000,
    "amount": "119.00",
    "currency": "USD",
    "coverage_percent": 91.4
  }
}
```

- [ ] Return an opaque signed/versioned cursor based on sort value plus stable project ID.
- [ ] Use deterministic tie-breaking by `project_id`.
- [ ] Projects with duration but no AI records still appear with AI metrics known-zero or
      null according to coverage.
- [ ] Project merges are applied before totals/session/token aggregation so source aliases
      cannot duplicate values.
- [ ] Return response-level totals if the frontend needs proportional card bars; do not
      force it to sum a paginated page as though it were the complete account.

### 9.11 — Project detail overview API

Add an initial-render endpoint:

```http
GET /api/v1/projects/:project_id/analytics
    ?start=2026-08-07
    &end=2026-08-13
    &timezone=Asia/Bangkok
    &branch=all
```

Conceptual response:

```json
{
  "schema_version": 1,
  "generated_at": "2026-08-13T12:40:00Z",
  "data_version": 42,
  "project": {
    "project_id": "018f...uuid",
    "name": "wakaclock",
    "repository": null
  },
  "range": {
    "start": "2026-08-07",
    "end": "2026-08-13",
    "timezone": "Asia/Bangkok",
    "branch": "all"
  },
  "summary": {
    "project_seconds": 30900,
    "project_text": "8h 35m",
    "all_projects_seconds": 137220,
    "active_days": 7,
    "last_activity_at": "2026-08-13T12:30:00Z"
  },
  "ai": {
    "ai_percentage": 99.63,
    "attribution_coverage_percent": 98.9,
    "ai_lines": 11000,
    "human_lines": 41,
    "unattributed_lines": 120,
    "prompts": 74,
    "prompts_per_session": 9.25,
    "sessions": 8,
    "tokens": {
      "input": 401600000,
      "output": 753900,
      "cache_read": 0,
      "cache_write": 0,
      "total": 402353900,
      "coverage_percent": 95.0
    },
    "estimated_spend": {
      "amount_microusd": 119000000,
      "amount": "119.00",
      "currency": "USD",
      "coverage_percent": 91.4
    }
  },
  "daily_activity": [],
  "daily_attribution": [],
  "languages": [],
  "editors": [],
  "branches": [],
  "top_files": []
}
```

Filtering rules:

- [ ] `branch=all` includes all branches and returns their individual breakdown.
- [ ] A specific branch filters duration, daily, language, editor and file panels.
- [ ] AI usage that lacks branch provenance remains in an explicit `branch_unknown` bucket;
      do not arbitrarily assign it to the selected branch.
- [ ] `all_projects_seconds` uses the same date/timezone range but is not restricted by the
      selected project or branch.
- [ ] Return top files only up to a small initial limit (for example 20); the complete list
      uses the paginated endpoint below.

### 9.12 — Project files and packed-bubble data

Add:

```http
GET /api/v1/projects/:project_id/files
    ?start=2026-08-07
    &end=2026-08-13
    &timezone=Asia/Bangkok
    &branch=all
    &sort=duration
    &order=desc
    &min_seconds=0
    &limit=100
    &cursor=<opaque>
```

Response:

```json
{
  "metric": "active_duration",
  "unit": "seconds",
  "project_total_seconds": 30900,
  "items": [
    {
      "entity_key": "privacy-safe-stable-key",
      "path": "plan.md",
      "display_name": "plan.md",
      "language": "Markdown",
      "total_seconds": 4020,
      "text": "1h 7m",
      "percentage_of_project": 13.01,
      "ai_changes": 800,
      "human_changes": 4,
      "unattributed_changes": 3
    }
  ],
  "next_cursor": null
}
```

- [ ] Files list and bubble chart consume the same endpoint/data, preventing mismatched
      totals between visualizations.
- [ ] Frontend computes circle packing and positions; backend returns values only.
- [ ] Bubble area uses `total_seconds`, not radius directly. The visualization library
      should transform area correctly.
- [ ] `min_seconds` and top-N keep a large repository renderable; response should report
      `other_seconds` for omitted files so totals remain honest.
- [ ] `display_name` may be basename/truncated for labels, while `path` remains the
      sanitized project-relative path for tooltips/list rows.
- [ ] Never expose `/Users/...`, home directory names or unredacted external paths.

### 9.13 — Project branches and daily drill-down APIs

Add:

```http
GET /api/v1/projects/:project_id/branches?start=&end=&timezone=&limit=&cursor=
GET /api/v1/projects/:project_id/daily?start=&end=&timezone=&branch=all
GET /api/v1/projects/:project_id/ai?start=&end=&timezone=&branch=all
```

Branch item:

```json
{
  "branch": "main",
  "total_seconds": 22260,
  "text": "6h 11m",
  "percentage": 72.04,
  "heartbeat_count": 85,
  "ai_changes": 5000,
  "human_changes": 20,
  "unattributed_changes": 12
}
```

Daily item:

```json
{
  "date": "2026-08-13",
  "total_seconds": 12600,
  "ai_added": 4500,
  "ai_deleted": 80,
  "human_added": 20,
  "human_deleted": 4,
  "unattributed_added": 5,
  "unattributed_deleted": 0
}
```

- [ ] Daily endpoint returns every local date in the range with zero-filled gaps so chart
      axes are stable.
- [ ] Branch names are treated as data and parameter-bound, never interpolated into SQL.
- [ ] Extremely high-cardinality branch histories use pagination/top-N plus Other.
- [ ] Define branch identity for renamed/deleted branches as the recorded heartbeat value;
      no live git lookup is required to view history.
- [ ] `/ai` may return per-model, per-agent, per-client and per-session summaries for the
      selected project without bloating the initial overview response.

### 9.14 — Service/repository/module layout

Use the repository's actual current structure under `backend/api/src/`:

```text
backend/api/src/
├── handlers/v1/
│   ├── dashboard_analytics.rs
│   └── project_analytics.rs
├── model/
│   ├── dashboard_analytics.rs
│   ├── project_analytics.rs
│   ├── ai_usage.rs
│   └── ai_pricing.rs
├── repository/
│   ├── analytics_v2.rs
│   ├── ai_event.rs
│   ├── ai_usage.rs
│   ├── ai_session.rs
│   ├── ai_pricing.rs
│   └── project_identity.rs
└── services/
    ├── dashboard_analytics.rs
    ├── project_analytics.rs
    ├── ai_usage.rs
    ├── ai_pricing.rs
    └── analytics_reprocess.rs
```

- [ ] Keep SQL in repositories and orchestration/metric calculation in services.
- [ ] Share date/timezone/filter validation across dashboard and project endpoints.
- [ ] Run independent read queries concurrently where the ClickHouse driver permits it.
- [ ] Avoid unbounded dynamic table/column interpolation. Dimension selection uses a closed
      enum mapped to known SQL fragments, as the current `InsightsService` already does.
- [ ] Update `AppState`, migration startup, handler router, OpenAPI docs and frontend TypeScript
      types in the same API-contract PR.

### 9.15 — Migration and historical reprocessing

Existing data lacks stable project IDs, explicit Unattributed attribution and most AI usage
metadata. Migration must distinguish reconstructable data from unknowable data.

#### Schema migration

- [ ] Add new columns/tables with backward-compatible nullable/default states.
- [ ] Do not rewrite `001_init.sql` as the only migration mechanism for deployed databases;
      add ordered/versioned migrations or retain explicit `ALTER ... IF NOT EXISTS` startup
      statements with a recorded schema version.
- [ ] Deploy read compatibility before switching writes.
- [ ] Backfill project IDs from existing project names/rules/merges with an audit report.
- [ ] Update both `heartbeats` and `heartbeats_incoming` schemas/projections consistently.

#### Reprocessing workflow

```text
raw heartbeats + project rules/merges + Phase 8 ai_events/usage/sessions
                              │
                              ▼
                    versioned staging projections
                              │ validate totals
                              ▼
                     publish new data_version
```

- [ ] Reprocess by authenticated user and inclusive date range.
- [ ] Never `TRUNCATE` a shared aggregate table to repair one user's project data.
- [ ] Use staging/versioned rows and publish a new coherent `data_version` only after all
      dimensions reconcile.
- [ ] Historical activity with no transcript remains Unattributed, not automatically Human.
- [ ] Transcript retention limits are reported per date range.
- [ ] Re-running the same project/date range produces identical final totals.
- [ ] Audit each reprocess: requester, range, project mapping version, parser versions,
      source counts, result counts, duration and error; never raw transcript content.
- [ ] Validate reconciliation before publish:
      project totals ≈ file/branch/language/editor totals plus explicit Unknown/Other;
      project token/cost totals sum to account totals plus unattributed-project usage;
      AI event IDs remain unique.

### 9.16 — Privacy, authorization and abuse controls

- [ ] Every project endpoint requires ownership; team/org access is a separate permission
      feature and must not be inherited accidentally from presence membership.
- [ ] Return sanitized project-relative file paths only.
- [ ] Do not return prompts, responses, patch bodies or source text.
- [ ] Machine names are visible only to the owning user unless future org consent and
      policy explicitly allow aggregation.
- [ ] Hash/cache keys must not expose raw paths or secrets.
- [ ] Limit `limit`, range length and query complexity; reject pathological requests.
- [ ] Rate-limit expensive drill-down and reprocess endpoints separately from heartbeats.
- [ ] Parameterize project, branch, date and cursor filters.
- [ ] Redact ClickHouse/SQL/internal paths from production API errors.
- [ ] Price/catalog administration requires an internal authenticated path and audit log.
- [ ] Privacy and marketing pages must describe local transcript access, transmitted
      metadata, file-path sanitization and estimated-cost limitations before launch.

### 9.17 — Performance and caching

- [ ] Initial dashboard/project overview target: p95 under 500 ms for a 30-day range on a
      normal individual account after warm cache; validate with representative data.
- [ ] Cache by authenticated user, normalized range, timezone, project, branch,
      response-schema version and `data_version`.
- [ ] Invalidate/bypass cache when a newer projection version publishes.
- [ ] Return `ETag`, `generated_at`, `data_version` and sensible private cache headers.
- [ ] Use aggregate tables for long ranges; raw heartbeats are reserved for detail repair,
      validation and small bounded queries.
- [ ] Paginate project/file/branch/session lists with opaque cursors.
- [ ] Return top-N plus an explicit Other bucket where a chart cannot render high
      cardinality safely.
- [ ] Profile ClickHouse queries with realistic volumes and add ordering/partitioning to
      match `user_id`, date, project and dimension filters.
- [ ] Avoid N+1 project-card queries. Fetch all visible project metrics in grouped queries
      or a single coherent projection.

### 9.18 — Testing matrix

#### Metric/unit tests

- [ ] AI percentage and attribution coverage for AI-only, Human-only, mixed,
      Unattributed-heavy and empty datasets.
- [ ] Token totals with nullable classes and no double counting.
- [ ] Cost calculations for input/output/cache prices, price changes, unknown model and
      partial coverage.
- [ ] Session count uses unique IDs; retries do not increase prompts/sessions/tokens.
- [ ] Multi-project session allocation never copies totals into every project.
- [ ] Previous-period new/unchanged/increase/decrease cases.
- [ ] Active-day average and calendar-day average are distinct and correct.

#### Timezone tests

- [ ] Heartbeats around UTC midnight map to the correct Bangkok/local day.
- [ ] Monday–Sunday ordering is stable.
- [ ] DST 23/25-hour dates for zones that observe DST.
- [ ] Today/best day/previous range all use the same zone.
- [ ] Changing saved timezone triggers or selects correct rebuilt/query-time data.

#### Project identity/merge tests

- [ ] Rename preserves project ID and route.
- [ ] Two same-name projects with different identity do not collide.
- [ ] Merge combines duration, files, branches, sessions, tokens and cost once.
- [ ] Old alias redirects/resolves to canonical project.
- [ ] Unauthorized project ID returns not found/forbidden without leaking existence.

#### Projection/ClickHouse tests

- [ ] Account duration reconciles with project totals plus Unknown.
- [ ] Project duration reconciles with file/language/editor/branch plus Other/Unknown.
- [ ] Duplicate AI/usage event IDs do not affect final projections.
- [ ] Live ingest and historical reprocess converge on identical results.
- [ ] Version publish prevents partial projection visibility.
- [ ] File deletes/renames and empty branches remain queryable.

#### API contract tests

- [ ] Dashboard returns all dimensions, explicit metric/unit, zero-filled weekdays/dates and
      coverage fields.
- [ ] Project list sorting, stable cursor pagination and deterministic ties.
- [ ] Project detail branch/date/timezone filters affect all intended panels consistently.
- [ ] Files endpoint returns relative paths and same values used by list/bubble views.
- [ ] Null metrics remain null through Rust serialization and frontend TypeScript parsing.
- [ ] Invalid date/timezone/branch/sort/cursor/range receives a controlled 4xx response.

#### Packaged end-to-end tests

- [ ] Generate manual and Codex edits in one project and verify AI/Human/Unattributed
      project card values.
- [ ] Open Project Detail and reconcile header, daily chart, language/editor donuts, files,
      bubbles and branches against stored fixtures.
- [ ] Generate a multi-project AI session and verify token/cost allocation/account totals.
- [ ] Replay transcripts, restart offline queue and rerun reprocess without changing totals.
- [ ] Verify no API response/storage/log contains prompt, response, patch or raw source.

### 9.19 — Delivery sequence

Deliver this in small, dependency-ordered PRs after the relevant Phase 8 foundation lands:

1. **PR 9.1 — Metric contracts and API schemas**
   - Rust metric types, units, coverage semantics, date/timezone/filter validators and
     versioned response fixtures.
2. **PR 9.2 — Stable project identity**
   - `project_id`, aliases, merge-to-canonical mapping, ownership checks and backfill
     dry-run.
3. **PR 9.3 — AI usage/session/pricing storage**
   - `ai_usage_events`, `ai_sessions`, `ai_session_projects`, pricing catalog, validation
     and idempotency tests.
4. **PR 9.4 — Account projections**
   - machine/model/client/project daily analytics and version-aware rebuild mechanism.
5. **PR 9.5 — Project-detail projections**
   - file/branch/language/editor/activity daily tables, path sanitization and reconciliation
     tests.
6. **PR 9.6 — Dashboard API**
   - summary, comparison, models/editors/languages/OS/machines/weekdays and daily
     attribution.
7. **PR 9.7 — Project list API**
   - project cards, sorting, cursor pagination, coverage and account-level denominators.
8. **PR 9.8 — Project detail/drill-down APIs**
   - overview, files, branches, daily and AI endpoints with consistent filters.
9. **PR 9.9 — Historical reprocess**
   - project ID backfill, transcript-aware attribution rebuild, versioned publish and audit.
10. **PR 9.10 — Frontend integration**
    - dashboard charts, project cards, detail page, bubble/list reuse, branch filter and
      partial/empty/error states.
11. **PR 9.11 — Performance/privacy launch gate**
    - query profiling, cache/ETag, range/rate limits, packaged E2E, privacy/docs/product-copy
      audit.

### 9.20 — Definition of done / acceptance criteria

Phase 9 is complete only when:

- [ ] Dashboard shows Models, Editors/AI clients, Languages, OS, Machines, weekdays,
      Today, daily average, best day and previous-period change using explicit correct units.
- [ ] Daily attribution shows AI, Human and Unattributed additions/deletions without
      classifying missing provenance as Human.
- [ ] Project index shows every in-range project with duration and reliable AI metrics.
- [ ] Clicking a stable project route opens detail with summary, daily activity,
      attribution, languages, editors, files and branches.
- [ ] File list and bubble chart use the same paginated/sanitized dataset and reconcile with
      the project duration plus Other.
- [ ] Branch selection filters every compatible project panel consistently.
- [ ] Prompts count user prompts, sessions count stable sessions, and tokens are not counted
      more than once.
- [ ] Estimated spend uses the price effective at usage time and displays cost coverage;
      unknown pricing is null, not zero.
- [ ] A multi-project session does not duplicate prompts/tokens/cost across projects, and
      project totals reconcile to account totals plus explicit unattributed-project usage.
- [ ] AI edits are not simultaneously counted as Human; subsequent manual edits remain
      Human; uncertain changes remain Unattributed.
- [ ] Project rename/merge does not break links or inflate duration/AI usage.
- [ ] Today, weekday, best day and range comparison are correct in the user's IANA timezone.
- [ ] Transcript/API/offline/reprocess retries leave final totals unchanged.
- [ ] APIs never expose raw absolute paths, prompts, responses, patches or source code.
- [ ] Reprocessing is scoped, audited, versioned and idempotent.
- [ ] Frontend TypeScript contracts, backend serialization and OpenAPI examples agree.
- [ ] Packaged Codex, Claude and Gemini scenarios pass against a real ClickHouse test stack
      before the feature is advertised as shipped.

### 9.21 — Explicit product/UI caveats

- The backend supplies chart values, units, percentages and deterministic ordering; the
  frontend owns donut/bar/line/bubble layout and colors.
- Bubble size represents file duration, not AI lines, unless the UI explicitly switches
  metric and labels it.
- An editor and an AI client are separate dimensions. A label such as `Codex VS Code`
  should come from `ai_client`, not overwrite the underlying `editor = VS Code`.
- An AI percentage is code-change attribution, not percentage of time, productivity or
  quality.
- Token and spend totals may have incomplete coverage. Coverage must remain visible near
  the number rather than hidden in a distant settings page.
- Historical data cannot be reconstructed beyond locally retained transcripts. Such dates
  remain Unattributed and the UI must not imply otherwise.

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
