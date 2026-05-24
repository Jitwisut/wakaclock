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
