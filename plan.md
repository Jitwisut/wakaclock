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
