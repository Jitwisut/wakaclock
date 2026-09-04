# LEGACY / SUPERSEDED — Wakaclock — Reverse-Engineer WakaTime & Build Better

> This broad original plan is retained for historical architecture context. The
> active AI implementation roadmap is [`plans/ROADMAP.md`](plans/ROADMAP.md).

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

## Phase 5 — AtoAxis extension coverage for every program in the supplied image

### 5.0 Scope, interpretation, and the actual target

This phase supersedes the earlier short "editor coverage" section. The supplied image is
treated only as a list of product names, not as instructions. It contains **72 programs**,
read left-to-right and top-to-bottom. Every one is accounted for in sections 5.6–5.13.

"AtoAxis works with a program" does not always mean the same implementation:

- **Native** — an installable extension/add-on uses the host's supported API and emits
  precise file/document events. This is the preferred result.
- **Family build** — one codebase is packaged and tested for several compatible hosts,
  such as one IntelliJ Platform plugin for 13 JetBrains products.
- **Protocol-compatible** — an existing WakaTime-style plugin can call an AtoAxis-provided
  `wakatime-cli` compatibility executable and send to the AtoAxis endpoint. This is the
  fastest migration path, but is not the final branded user experience.
- **Browser/desktop bridge** — used only where the host does not expose sufficient plugin
  events. It records the active app/domain/document label with lower precision and must be
  labelled as such in the UI; it must never be presented as file-level native tracking.
- **Upstream integration** — the program already has a WakaTime toggle/API contract. Work
  is an upstream request to allow a custom API URL or an AtoAxis provider, plus a desktop
  fallback until that ships.

The acceptance target is not merely "a heartbeat appeared." For native integrations it is:
open/focus, edit, save/write, document switch, project identity, language/type, idle/resume,
offline delivery, duplicate prevention, uninstall, and privacy behaviour all pass the
shared contract tests. Non-code tools use the closest truthful category (`designing`,
`modeling`, `communicating`, `notes`, `browsing`, or `coding`) and expose their lower event
precision on the dashboard.

### 5.1 Current repository gaps that block broad coverage

The repository has a working VS Code extension and AI adapters for Claude Code, Codex CLI,
and Gemini CLI, but the following must be completed before multiplying extensions:

- [ ] **WakaTime CLI compatibility shim.** Ship a second executable name,
  `wakatime-cli`/`wakatime-cli.exe`, backed by the same Rust crate. It must accept the
  common WakaTime flags (`--entity`, `--plugin`, `--alternate-project`, `--alternate-language`,
  `--lineno`, `--cursorpos`, `--write`, `--category`, `--api-url`, `--key`, `--today`),
  parse both `~/.wakatime.cfg` and `~/.wakaclock/config.toml`, and default to the AtoAxis API
  only for an AtoAxis-branded install. Never silently rewrite a user's WakaTime config.
- [ ] **Prove wire compatibility.** Add golden request tests for single and bulk heartbeat
  shapes, Basic/Bearer auth, user agent parsing, categories, offline retries, and custom API
  URLs. The current claim that any WakaTime extension works is not proven while executable
  and config names differ.
- [ ] **Central local bridge.** Add `wakaclock bridge serve` to own the two-minute activity
  window, interval union, per-entity buffers, offline SQLite queue, today/status queries,
  and deduplication. Expose a versioned local protocol over Unix domain socket on macOS/Linux
  and named pipe on Windows; use loopback HTTP with a random per-install token only where a
  host cannot use sockets. Thin plugins send events, not finished duration calculations.
- [ ] **Versioned event schema.** At minimum:

  ```json
  {
    "schema": 1,
    "event_id": "uuid",
    "event": "focus|edit|save|blur|close|build|debug|selection",
    "time": 1787420000.123,
    "entity": "/absolute/path/or/stable-uri",
    "entity_type": "file|url|domain|app",
    "editor": "stable-editor-id",
    "project": "optional-name",
    "language": "optional-language",
    "category": "coding",
    "cursor": {"line": 10, "position": 240},
    "delta": {"keystrokes": 1, "chars_added": 1, "chars_deleted": 0},
    "precision": "native|host-limited|desktop"
  }
  ```

- [ ] **Shared adapter SDKs.** Generate clients from that schema for TypeScript/JavaScript,
  Kotlin/Java, Python, Lua, C# and shell. Each client only reconnects, validates, and queues
  a small bounded memory buffer; timing policy remains in the bridge.
- [ ] **Binary distribution and trust.** Produce signed/notarized universal macOS binaries,
  signed Windows x64/arm64 installers, Linux x64/arm64 packages, checksums/SBOM, a static
  signed release manifest, rollback, and `wakaclock doctor`. Plugins may find an installed
  bridge or offer the official installer; they must not each implement an unsigned binary
  downloader.
- [ ] **Expand categories before non-code tools ship.** The Rust `Category` enum currently
  lacks several values needed by this list. Add at least `notes`, `researching`, `learning`,
  `browsing`, `running tests`, `writing tests`, `manual testing`, `code reviewing`, and
  `ai coding`, with database/API/dashboard migration and unknown-value forward compatibility.
- [ ] **Identity contract.** Publish stable `editor` IDs for all 72 entries, a canonical
  user-agent format such as `atoaxis/<plugin-version> <editor-id>/<host-version>`, and a
  rule that the plugin sends an alternate project hint while the CLI remains authoritative
  for Git project/branch detection.
- [ ] **Secrets and sandbox auth.** Native desktop plugins use OS keychain or the host's
  secret API. Sandboxed web plugins use OAuth device authorization with short-lived access
  tokens; no API key may be embedded in a Figma, Canva, browser, or web-IDE bundle.
- [ ] **Privacy controls.** Default to metadata only, support file/project obfuscation and
  allow/deny patterns centrally, never send document text/cell values/design contents/URLs
  with query strings, and visibly distinguish native precision from inferred desktop time.

### 5.2 One canonical event policy for every native adapter

All native adapters implement the following behaviour, unless a per-program section states
that the host cannot expose the event:

1. On active document change, send `focus` for the new entity and `blur` for the old one.
2. On a local text/object change, send `edit` with counts only. Never send changed content.
3. On save, send `save` with `is_write=true`, even if the same entity was sent recently.
4. Coalesce cursor-only activity and repeated edits in the bridge; plugins do not invent
   duration. After 120 seconds without a new event, activity stops.
5. Ignore generated, vendor, temporary, binary, untitled, remote-coauthor, and extension-owned
   documents by a centrally configurable policy. Allow explicit opt-in for untitled docs.
6. Use absolute local paths where available. For notebooks/design/cloud documents, use a
   stable provider URI and a display-safe entity label; strip secrets, tokens, and URL query.
7. Spawn no synchronous child process on the UI thread. If the bridge is unavailable, queue
   a bounded set of raw events, show one actionable warning, and retry with backoff.
8. On shutdown/unload, flush the last local event without extending time beyond the last
   observed activity. A crash must not create a synthetic time tail.

### 5.3 Test kit and definition of done

- [ ] Create `extensions/contract-tests/` with a fake local bridge and a fake AtoAxis API.
- [ ] Publish fixtures for focus A→B, 100 rapid edits, save, idle >120s, resume, offline then
  reconnect, duplicate retry, remote edit, unsaved document, renamed document, multi-window,
  and bridge upgrade during an active session.
- [ ] Require unit tests for mapping host events, integration tests against the fake bridge,
  and one automated or recorded smoke test in every supported host/version/OS cell.
- [ ] Support the current stable host plus the previous stable version. Legacy products get
  a frozen compatibility build and are marked "legacy," not silently counted as current.
- [ ] Release telemetry is opt-in and operational only: plugin/host/bridge versions, event
  counts, queue depth, and error codes. It cannot contain paths, project names, document
  titles, domains, or user-entered content.
- [ ] A program moves to "supported" only after install, first heartbeat, today total,
  offline recovery, update, and uninstall are documented and verified.

### 5.4 Delivery waves (dependency-aware, not 72 independent projects)

| Wave | Deliverable | Programs unlocked | Exit criterion |
|---|---|---:|---|
| 0 | Compatibility shim, bridge, schema, release pipeline, test kit | all later work | golden protocol and crash/offline tests green on 3 OSes |
| 1 | VS Code family + JetBrains family + existing AI adapters | 21+ | one shared build per family, host-specific editor IDs verified |
| 2 | Browser family + Eclipse family + Office family | 14 | sandbox auth, privacy review, web/desktop parity labels |
| 3 | Python/JS high-value hosts: Blender, Figma, Jupyter, Obsidian, Postman, Pulsar, Nova | 7 | native edit/save/focus where host permits |
| 4 | Terminal editors and classic desktop editors | 18 | package-manager/install matrix and contract tests |
| 5 | Reverse-engineering/security and legacy hosts | 8 | signed packages, version gates, no unsupported-memory access |
| 6 | Proprietary/host-limited integrations and upstream requests | remainder | desktop fallback shipped and limitation stated |

Effort should be planned by adapter family, but product status must still be reported per
program. "One JetBrains plugin built" is not enough: the same artifact must be smoke-tested
and correctly identified in Android Studio, AppCode, CLion, DataGrip, DataSpell, GoLand,
IntelliJ IDEA, MPS, PhpStorm, PyCharm, Rider, RubyMine, and RustRover.

### 5.5 Support matrix summary

Legend: **N** native extension/add-on, **F** shared family build, **C** compatibility shim,
**B** browser extension/native-messaging path, **D** desktop tracker fallback, **U** upstream
integration required, **L** legacy/frozen host.

| Family | Programs from image | Target |
|---|---|---|
| AI/agent CLI | Amp CLI, Antigravity, Claude Code, Codex CLI, Copilot CLI, OpenCode | N/F, transcript fallback |
| VS Code API | Azure Data Studio, Cursor, Kiro, Qoder | F; Azure Data Studio is L |
| IntelliJ Platform | Android Studio, AppCode, CLion, DataGrip, DataSpell, GoLand, IntelliJ IDEA, MPS, PhpStorm, PyCharm, Rider, RubyMine, RustRover | F; AppCode is L |
| Eclipse/OSGi | Aptana, DBeaver, Eclipse, Oxygen | F/C; Aptana is L |
| Chromium/WebExtensions | Brave, Chrome, Edge, Canva web, Cloud9, CodeTasty | B/F |
| Firefox/Safari | Firefox, Safari | B/F with browser-specific package |
| RAD Studio | C++ Builder, Delphi | F/N |
| Microsoft Office | Excel, PowerPoint | F/N plus D fallback |
| Sandboxed design | Figma, Canva web | N or B with direct OAuth API |
| Native Python | Blender, Eric, Gedit, IDA Pro | N/F where practical |
| Remaining host APIs | all other rows below | N when stable; C/D only when explicitly stated |

The implementation notes below are deliberately per icon so no program disappears inside a
family estimate. References to WakaTime plugins are for protocol/behaviour research only;
before reusing source, perform a per-repository licence and trademark review, preserve
required notices, and prefer a clean AtoAxis implementation against the host's official API.

### 5.6 Programs 1–9 (first row)

#### 1. Amp CLI — agent adapter, not an editor extension

- Add `extensions/ai-agents/amp/` using Amp's supported hook/plugin lifecycle if it exposes
  post-tool events; capture file path, tool name, stable call/event ID, model/provider when
  available, and added/deleted line counts from the tool result without reading file text.
- If Amp exposes transcripts but no reliable hook, add an `AmpParser` to `wakaclock agent`
  with per-file cursor state, tail-only first discovery, idempotent event IDs, and explicit
  `ai_confidence=verified` only when the transcript proves an applied edit.
- Send `category=ai coding`, `editor=amp-cli`, `ai_agent=amp`, and continue activity when
  several tool calls occur within 120 seconds. Test write/edit/patch, rejected tool calls,
  concurrent sessions, worktrees, transcript rotation, and offline replay.

#### 2. Android Studio — shared IntelliJ Platform plugin

- Create `extensions/jetbrains/` in Kotlin. Subscribe to the global document listener,
  file-editor selection changes, and `FileDocumentManagerListener` saves; use project and
  run/debug listeners for `coding`, `building`, and `debugging` events.
- Resolve `VirtualFile` to a local path where possible, count `DocumentEvent` old/new lengths,
  obtain caret line/offset, and send raw events to the bridge. Never access PSI/source text for
  telemetry. Use `PasswordSafe` only for bootstrap credentials and label `editor=android-studio`.
- Declare Android Studio compatibility in the plugin descriptor, test Gradle project windows,
  Kotlin/Java/XML, emulator/debug sessions, remote projects, and run JetBrains Plugin Verifier.

#### 3. Antigravity — dual adapter because the name covers agent and IDE surfaces

- For the Antigravity agent/desktop plugin surface, package a managed plugin under its supported
  Gemini-compatible plugin directory. Record successful write/edit tool events as AI-attributed
  heartbeats and use transcript parsing as recovery, not as a second source of duration.
- If the installed product exposes the VS Code Extension API, reuse the VS Code bundle with a
  distinct product target and `editor=antigravity-ide`; detect capability at activation rather
  than assuming every Antigravity version is a VS Code fork.
- Installer and doctor output must say which adapter is active, deduplicate agent and IDE events
  by event ID/file/time, and test agent-only, IDE-only, and both-active scenarios.

#### 4. AppCode — legacy IntelliJ build

- Reuse `extensions/jetbrains/` but compile a frozen artifact against the last AppCode-compatible
  IntelliJ SDK. Label it `editor=appcode` and never advertise compatibility with newer APIs that
  the discontinued host cannot load.
- Cover Swift/Objective-C file focus/change/save and Xcode project/workspace roots. Disable
  features whose listener APIs do not exist in that platform version behind source-set gates.
- Publish the last tested macOS/AppCode matrix, keep the compatibility artifact downloadable,
  and direct new users to the supported Xcode/JetBrains route without deleting historical support.

#### 5. Aptana — legacy Eclipse/OSGi feature

- Build `extensions/eclipse/` as Java OSGi bundles with a core bundle and product fragments.
  Use active editor/part listeners, `IDocumentListener`, save/resource change listeners, and
  workspace project identity; the Aptana fragment only supplies product detection and editor ID.
- Target the last loadable Eclipse API, ship an archived update site, and label
  `editor=aptana`, `precision=native`, `support=legacy`. Do not depend on a current Java runtime.
- Test JavaScript/Ruby/PHP editors, unsaved buffers, perspective switching, and plugin shutdown.
  If modern signing/runtime constraints prevent installation, offer the CLI shim for the existing
  compatible plugin and the desktop tracker, explicitly marked lower precision.

#### 6. Arduino IDE — two materially different hosts

- For Arduino IDE 2.x, first validate which VS Code/Theia extension APIs are actually exposed;
  build a Theia frontend/backend extension if generic VSIX installation cannot access document
  and save events. Use sketch root as project, `.ino`/`.pde` language mapping, and serial/build/
  upload events as `building` without logging serial-port contents.
- Keep Arduino IDE 1.x as a separate legacy Java plugin/tool adapter. Listen to editor changes and
  sketch saves where its plugin API permits; otherwise launch the bridge from a Tools menu action
  and use file-watch/focus events as `host-limited` rather than pretending keystroke precision.
- Package and test 1.x and 2.x separately on all OSes, including unsaved new sketches, multi-file
  tabs, compile/upload, board package paths, and portable installations. `editor=arduino` remains
  stable while user agent includes the major host generation.

#### 7. Azure Data Studio — frozen VS Code-family build

- Repackage the existing TypeScript extension for Azure Data Studio's extension gallery/VSIX,
  with `editor=azure-data-studio`; add SQL notebook and query-document URI handling, connection/
  server names excluded by default, and query execution as optional `running tests` or `coding`.
- Because Azure Data Studio has a retirement path, freeze against its last supported VS Code API
  and maintain only security/bridge compatibility fixes. Do not let its old API constrain the main
  VS Code extension target.
- Test `.sql`, SQL notebooks, untitled queries, result panes, remote/virtual URIs, multi-root
  workspaces, manual VSIX install, and migration messaging to the supported SQL tooling route.

#### 8. Blender — native Python add-on

- Create `extensions/blender/` using `bpy.app.handlers` for load/save and dependency-graph updates,
  `bpy.msgbus`/timers for active object and mode changes, and persistent handlers that are properly
  removed on add-on disable. Never perform network or child-process work inside a depsgraph callback.
- Entity is the `.blend` path or a stable `untitled.blend` session ID; project is the nearest
  configured/Git root or blend folder. Map object/scene edits to `modeling`, compositor/material/
  layout work to `designing`, Python text-editor changes to `coding`, and render jobs to `building`.
- Send only object type/name if the user allows it; default can use scene/file label without object
  names. Test edit/object/sculpt/animation modes, autosave, Save As, render, background mode,
  unsaved files, add-on reload, and high-frequency depsgraph throttling.

#### 9. Brackets — legacy JavaScript extension

- Build an AMD/JavaScript Brackets extension using `DocumentManager` current-document changes,
  document `change`, `FileSystem`/command save events, and `ProjectManager` root. Communicate with
  the bridge through the supported Node domain, never through synchronous shell execution.
- Count CodeMirror deltas and caret position, send `editor=brackets`, and provide settings/status
  commands. Use the compatibility shim as an interim path for users of the existing ecosystem.
- Brackets distributions vary and the original host is legacy; publish a tested fork/version
  table, include manual ZIP install, and test live preview events do not create false coding time.

### 5.7 Programs 10–18 (second row)

#### 10. Brave — Chromium browser-family package

- Build one Manifest V3 WebExtension core for Brave, Chrome, and Edge. Observe active-tab changes,
  window focus, navigation, browser idle/lock, and supported web-app content-script events; send
  through an AtoAxis native-messaging host so API credentials never live in extension storage.
- For generic browsing, entity defaults to normalized domain (not full URL), category `browsing`,
  and Incognito/Private windows are excluded unless explicitly enabled. For known IDEs/design apps,
  a site adapter can emit a stable workspace/document label without query strings or document text.
- Package/test a Brave-specific store/manual build with `editor=brave`, aggressive tab suspension,
  multiple profiles, private mode, sync-disabled storage, native-host missing, and browser shutdown.

#### 11. C++ Builder — shared RAD Studio native package

- Create `extensions/rad-studio/` in Object Pascal using the Open Tools API. One design-time
  package serves C++ Builder and Delphi; subscribe to module/editor notifiers, modified/save
  notifications, project-group changes, and compile/debug lifecycle events.
- Extract active source file, project, caret line/column and modification counts where the editor
  interface exposes them. Map compilation to `building`, debugger activity to `debugging`, and set
  `editor=cpp-builder`; execute the bridge asynchronously from a worker/IPC client.
- Produce version-specific BPL packages because RAD Studio binary interfaces change. Test C++
  source/header/form/resource modules, multi-project groups, Save All, compile failure, debugger,
  32/64-bit IDE generations, install/uninstall, and coexistence with the Delphi product personality.

#### 12. Canva — browser adapter plus desktop fallback, not an invasive Canva app

- Canva web is covered by the browser-family extension with a narrowly scoped content script on
  Canva origins. Track editor presence, tab focus, design ID and sanitized design title only when
  available from stable URL/accessible page state; map to `designing` and never inspect canvas text,
  uploaded assets, comments, or collaborator data.
- A Canva Apps SDK app runs only when the user launches it inside a design and therefore cannot be
  the sole time tracker. Use an in-product app only if Canva review permits background lifecycle
  events and OAuth; otherwise keep browser tracking truthful as `precision=host-limited`.
- Canva Desktop uses the desktop active-window adapter with `entity_type=app`. Test SPA route
  changes, multiple designs/tabs, presentation mode, background tabs, remote collaborator changes,
  logged-out state, desktop app, and permission revocation.

#### 13. Chrome — canonical Chromium distribution

- Use the shared Manifest V3 core, a service worker, `tabs`/`windows`/navigation/idle signals, and
  native messaging to `wakaclock bridge`. The native host installer registers the extension ID on
  macOS, Windows, and Linux and authenticates each message with an install-scoped token.
- Provide three privacy modes: allowlisted development/design sites only (default), domain-only
  browsing, and explicitly approved full-path tracking with query/fragment stripping. Never request
  history permission when active-tab events are sufficient.
- Publish to Chrome Web Store, test service-worker suspension/restart, discarded tabs, PWA windows,
  profiles, ChromeOS (direct OAuth API fallback because native messaging may be unavailable), idle
  lock, offline events, and extension update while a tab is active. Set `editor=chrome`.

#### 14. Claude Code — harden the existing hook and transcript adapter

- Keep `extensions/ai-agents/plugins/atoaxis-heartbeat/` as the native hook package and the existing
  transcript parser as recovery. Normalize Write/Edit/MultiEdit tool results into a stable AI event,
  include model/provider where proven, and do not send rejected/permission-denied edits.
- The hook and transcript service must share a delivered-event ledger so the same edit is counted
  once. Use `ai_agent=claude-code`, `ai_provider=anthropic`, `editor=claude-code`, source
  `agent_hook` or `transcript`, and verified confidence only when a successful tool result exists.
- Finish real CLI end-to-end tests (not synthetic payload only): concurrent sessions, subagents,
  worktrees, path spaces/newlines, Write vs Edit line counts, transcript truncation/rotation, service
  restart, offline replay, plugin repair, upgrade, and uninstall that removes only managed config.

#### 15. CLion — shared IntelliJ Platform plugin

- Use the Kotlin JetBrains core described for Android Studio, but set `editor=clion` and enable
  C/C++/CMake project metadata. Active `VirtualFile` remains the entity; the CLI detects language,
  branch and dependencies without the plugin reading source.
- Add optional run-configuration listeners for CMake/build (`building`), tests (`running tests`),
  and debugger sessions (`debugging`). Keep these activity streams separate so overlapping build
  and edit intervals are unioned rather than double-counted.
- Test local/remote toolchains, CMake reload/indexing exclusion, header/source switching, generated
  build directories, WSL/SSH paths, JetBrains remote development architecture, and Plugin Verifier.

#### 16. Cloud9 — browser site adapter first, native package only if host API remains available

- Implement an AWS Cloud9 site adapter in the browser extension: observe IDE tab/workspace focus and
  stable file-tab identifiers exposed to the page without reading editor content. Use
  `entity_type=url`, sanitized workspace/file label, `editor=cloud9`, and `precision=host-limited`.
- Run a discovery spike against the current Cloud9 plugin API. If it still supports editor document
  focus/change/save events and background services, build a JavaScript package that sends native
  precision events directly to the bridge/API; if not, do not rely on private DOM selectors as a
  claimed native extension.
- Test AWS authentication redirects, multiple environments, split editors, terminal focus, browser
  suspension, renamed/deleted files and remote filesystem paths. Document service lifecycle/legacy
  status because availability may vary by account and region.

#### 17. Coda — Coda editor plug-in bundle plus macOS bridge

- Target the Coda code editor's supported plug-in mechanism (distinct from the modern collaborative
  Coda documents product). Use its JavaScript event hooks for active editor, text change and save;
  package the bundle with `editor=coda` and call the local bridge through the host-supported process
  or socket mechanism.
- Map site/project root to project and local file to entity; count deltas without content. If a host
  release lacks reliable event hooks or process access, downgrade that version to the macOS desktop
  tracker instead of embedding an unsupported binary workaround.
- Verify which Coda generations still install plug-ins, then test split panes, remote publishing,
  CSS/HTML/JS modes, unsaved sites, Save All and app termination. Publish an explicit legacy matrix
  so this is not confused with coda.io.

#### 18. CodeTasty — web IDE site adapter

- Build a restricted content-script adapter for the CodeTasty web IDE. Capture route/workspace/tab
  focus and host-provided save/change events if a public extension API exists; otherwise report only
  focused workspace/file-tab time with `precision=host-limited`, never DOM-derived keystrokes.
- Use a stable cloud-document URI, strip account IDs/tokens/query strings, set `editor=codetasty`,
  category `coding`, and send via OAuth-authenticated browser background worker.
- Test SPA navigation, multiple projects, reconnect/offline editor, split panes, preview/terminal
  focus, background tabs, minified UI changes, and permission revocation. A DOM contract test must
  fail closed when selectors change rather than attributing the wrong document.

### 5.8 Programs 19–27 (third row)

#### 19. Codex CLI — finish and verify the existing adapter

- Keep the managed hook and `CodexParser` but verify them against real Codex CLI payloads. Parse all
  files in an `apply_patch`, successful write operations, move/rename/delete semantics, event ID,
  provider/model and line deltas; a failed patch emits no applied-code heartbeat.
- Use `editor=codex-cli`, `ai_agent=codex`, `ai_provider=openai`, category `ai coding`, and share the
  delivered-event ledger between hook and transcript paths. Multiple files from one patch become
  separate file heartbeats linked by one parent event ID.
- Test simultaneous tasks, worktrees, approvals/denials, absolute/relative paths, new/deleted files,
  patch lines resembling diff markers, transcript compaction, config TOML preservation, feature-flag
  absence, service restart, repair and uninstall of only AtoAxis-managed hook blocks.

#### 20. Copilot CLI — agent hook/transcript adapter

- Add `extensions/ai-agents/copilot-cli/` only against an officially supported Copilot CLI hook or
  plugin lifecycle. Record successful file-changing tool calls and commands with stable IDs; if no
  reliable applied-edit event exists, parse supported local session logs and mark confidence/source
  accurately rather than inferring from file-system timing.
- Send `editor=copilot-cli`, `ai_agent=copilot-cli`, provider `github`, category `ai coding`, model
  only when explicitly reported, and use the same transcript/hook dedup ledger as other agents.
- Test GitHub authentication renewal, tool approval denial, shell commands that generate many files,
  multi-repo sessions, concurrent agents, log retention changes, offline queue and uninstall. Do not
  claim AI line attribution for opaque shell side effects; those remain unattributed.

#### 21. Cursor — VS Code-family build with explicit AI-boundary rules

- Build the current VS Code extension as a Cursor-compatible VSIX/Open VSX artifact, feature-detect
  APIs at runtime, store credentials in `SecretStorage`, and send `editor=cursor` rather than
  `vscode`. Reuse text/save/debug/build event code and the central bridge.
- Human document changes remain human only when backed by input events. Cursor AI attribution must
  come from a documented Cursor event/export/transcript adapter; bulk changes with no attribution
  are recorded as `unattributed`, never guessed as AI or silently counted as human.
- Test Chat/Composer/Agent edits, accept/reject partial suggestions, Apply All, background agent
  changes, remote workspaces, extension-host restarts, Cursor API divergence, dual installation with
  the VS Code build, and marketplace/manual VSIX updates.

#### 22. DataGrip — shared IntelliJ Platform plugin

- Reuse the Kotlin core with `editor=datagrip`. Track `.sql` files and console/scratch documents via
  stable virtual URIs; use project/data-source label only if user allows it, never send hostnames,
  usernames, SQL text, bound values, result rows, or connection strings.
- Focus/edit/save map to `coding`; query execution can emit a raw `run` marker but must not extend
  time without nearby user activity. Database object viewers and result panes are excluded or
  optionally `researching` at host-limited precision.
- Test local files, query consoles, scratches, multiple data sources, remote development, password
  storage isolation, console rename, read-only viewers, query cancellation and Plugin Verifier.

#### 23. DataSpell — shared IntelliJ Platform plugin

- Reuse the Kotlin core with `editor=dataspell`, adding notebook cell and scientific workspace
  handling. Entity is the `.ipynb`/script path plus optional cell ID kept locally; the server gets
  the notebook path, language/kernel name, counts and cursor only, never cell source/output.
- Track cell edit/focus/save as `coding`, execution as `running tests` or `coding` by policy, and
  exclude kernel/background output events so they cannot fabricate active time.
- Test Jupyter local/remote kernels, notebooks and Python/R scripts, autosave, cell reorder/delete,
  large outputs, remote gateways, scientific mode, host restart and Plugin Verifier.

#### 24. DBeaver — Eclipse/OSGi product fragment

- Reuse the Eclipse core with a DBeaver fragment and `editor=dbeaver`. Subscribe to SQL editor part
  activation, document change/save, and project/resource events; represent SQL consoles/scratch
  editors by stable virtual URI when no local file exists.
- Default-redact connection names, database/schema names, SQL text, credentials and result data.
  Query execution is an event marker only and category `coding`; optional browsing of schema editors
  is `researching` and clearly host-limited.
- Publish an Eclipse p2 update site and signed bundle. Test Community/Enterprise where legally
  available, multiple SQL editors/connections, result tabs, autosave, workspace switch, Java runtime
  versions, bridge loss, and coexistence with other Eclipse products.

#### 25. Delphi — shared RAD Studio native package

- Use the same Open Tools API package as C++ Builder, with `editor=delphi` selected from the active
  product personality. Track Pascal/form/project modules, text modification/save, project group,
  compile/run/debug, and caret location without reading source contents.
- Map `.pas`/`.dpr` work to `coding`, form designer interactions to `designing`, builds to
  `building`, and debugger intervals to `debugging`. The bridge unions overlapping designer/source
  activity and derives Git metadata.
- Build signed packages for supported RAD Studio versions and a frozen legacy line for old Delphi.
  Test source/form toggling, DFM binary/text resources, multi-project groups, packages, Save All,
  debugger, IDE crash recovery and uninstall registry/package cleanup.

#### 26. Discord — BetterDiscord/Vencord community adapter with a safe fallback

- A native Discord client plugin is possible only through third-party mod hosts such as Vencord or
  BetterDiscord. Keep adapters small: observe selected server/channel and window focus, emit
  `communicating`, and default entity to `Discord` or a user-defined category—not server/channel/user
  names. Never collect message text, participant names, voice audio, DMs, or attachments.
- Because client mods can conflict with Discord policy and break frequently, do not make them the
  default installer. Offer an opt-in community package and a supported desktop active-window path
  with `precision=desktop`, `editor=discord`.
- Test text/voice/video channels, streamer mode, DMs, multiple accounts, minimized/background state,
  plugin host update, permission revocation, data redaction, and total absence of network payload
  content. Publish the policy risk prominently.

#### 27. Eclipse — canonical Eclipse/OSGi core

- Build the signed Java OSGi core used by Aptana, DBeaver, and Oxygen. Register workbench window/page
  part listeners, active text editor/document listeners, resource/save listeners and project lifecycle;
  send to the bridge off the UI thread and dispose every listener on bundle stop.
- Use active `IFile` location, `IProject` hint, content-type/language, selection line/offset, delta
  lengths and save flag. Handle non-file storage editors with sanitized virtual URIs and
  `editor=eclipse`; ignore Problems, Console and generated preview parts.
- Distribute through a signed p2 update site and Marketplace listing. Test Java/C/C++/XML/PDE,
  workspace switching, multiple windows, linked resources, EFS remote files, autosave, crash/offline,
  Java LTS versions, bundle update/uninstall and the previous/current Eclipse releases.

### 5.9 Programs 28–36 (fourth row)

#### 28. Edge — Chromium browser-family package

- Reuse the Manifest V3 core/native host with an Edge-specific package and `editor=edge`. Track
  active tab/window/navigation/idle, development web apps and explicit domain-only browsing; strip
  query/fragment and block InPrivate by default.
- Publish through Microsoft Edge Add-ons and support enterprise policy deployment of both extension
  and native-messaging host. Managed policy may set allowlists/privacy mode but cannot inject a
  plaintext AtoAxis API key.
- Test personal/work profiles, vertical tabs, sleeping tabs, installed PWAs, InPrivate, enterprise
  policies, Windows/macOS, native-host registration and service-worker suspension/update.

#### 29. Emacs — native Emacs Lisp package

- Create `extensions/emacs/atoaxis-mode.el` as a global minor mode. Hook buffer/window selection,
  `after-change-functions`, `after-save-hook`, focus in/out and kill-buffer; use `buffer-file-name`,
  project.el/VC root, major mode and point line/offset, with remote TRAMP paths sanitized by policy.
- Send newline/character deltas to the bridge via a long-lived process/filter or local socket; never
  block redisplay by invoking one process per edit. Provide `atoaxis-status`, `atoaxis-today`,
  `atoaxis-diagnose`, enable/disable and privacy customization variables.
- Package for MELPA plus signed source release, lexical binding and byte-compile clean. Test GUI/
  terminal/daemon Emacs, multiple frames, indirect buffers, Org source blocks, Magit buffers,
  TRAMP, autosave, mode reload, bridge restart and clean hook removal. Set `editor=emacs`.

#### 30. Eric — native Python plugin

- Build an Eric Python plugin using its project/editor APIs for active editor changes, text
  modifications and saves. Use project root/file/language/caret metadata, call the Python bridge SDK
  asynchronously, and set `editor=eric`.
- Track run/debug lifecycle if the stable plugin API exposes it; map those to `building`/`debugging`
  while excluding console output and background code analysis. Store only plugin preferences; the
  bridge owns secrets.
- Test supported Eric/Python/Qt versions, multi-project sessions, untitled files, external file
  changes, split editors, debug/run, plugin reload, offline queue and packaged-wheel/ZIP install.

#### 31. Excel — cross-platform Office.js add-in plus Windows precision helper

- Build `extensions/office/` with a shared Office.js task-pane/runtime. Excel registers workbook,
  worksheet selection and local `onChanged` events, ignores `event.source=Remote`, and emits stable
  workbook/worksheet metadata without cell addresses/values/formulas by default. Use
  `category=coding` for VBA/formula authoring only when detectable; otherwise `designing` or `notes`.
- Office event handlers do not persist across sessions and background auto-activation is constrained.
  Provide a Windows VSTO/COM companion for precise open/change/save/close and local bridge access;
  Office.js uses OAuth direct API and visibly reports `host-limited` when its pane/runtime is inactive.
- Entity is local workbook path when permitted or a stable hashed cloud-document ID. Test desktop/
  web/Mac, coauthoring, autosave, protected/read-only workbooks, Save As, multiple windows, add-in
  sideload/store deployment, admin event activation, VSTO signing/installer and uninstall.

#### 32. Figma — native plugin with sandbox-safe direct API

- Create `extensions/figma/` in TypeScript with a minimal UI/auth iframe and Figma plugin main
  context. Use current page, selection, document-change and close/timer lifecycle events; debounce
  changes and send direct HTTPS because a Figma plugin cannot spawn the local CLI.
- Authenticate by OAuth device flow/one-time browser link and short-lived tokens. Entity is sanitized
  file/page identity, category `designing`; never send node text, layer contents, comments, images,
  collaborator identities or full document snapshots. Use provider file key only after hashing or
  explicit consent.
- Figma plugins are not guaranteed to run continuously unless launched, so clearly state runtime
  limits; explore widget/background-approved capabilities but do not fake always-on tracking. Test
  browser/desktop, page/selection/document changes, plugin close/reopen, offline retry in plugin data,
  FigJam/Slides mode, large documents, team files, auth expiry and duplicate event IDs.

#### 33. Firefox — WebExtensions package

- Port the browser core to Firefox Manifest/WebExtensions differences with `editor=firefox` and a
  Firefox native-messaging manifest. Use tabs/windows/navigation/idle events and the same allowlist,
  domain normalization and private-window exclusion as Chromium.
- Build with browser-polyfill and capability gates; do not assume Manifest V3 service-worker
  semantics match Chromium. Publish signed AMO XPI and a controlled enterprise distribution build.
- Test private browsing permission, containers, multiple windows/profiles, discarded tabs, Firefox
  Developer Edition/ESR, native host missing, extension background restart, SPA adapters, offline
  OAuth fallback and uninstall of host registration.

#### 34. Geany — native C plugin

- Create a C plugin against Geany's plugin API. Subscribe to document activate/open/change/save/
  close and project events, read caret position/filetype/project metadata, and send compact JSON to
  the bridge on a non-UI GLib channel. Set `editor=geany`.
- Count Scintilla modification deltas without reading changed text into telemetry; saves are
  unconditional writes and compiler/build commands can emit `building` if available.
- Build signed packages for Linux/Windows/macOS-supported Geany versions and distro packaging.
  Test split documents, project/no-project, untitled/save-as, external reload, large files, plugin
  unload, bridge restart, ABI/version gates and no memory ownership leaks.

#### 35. Gedit — Python/libpeas plugin

- Implement a libpeas Python plugin for supported Gedit/GNOME Text Editor versions, using window/
  tab active-document, GtkSourceBuffer changed, GFile save/location and focus signals. Keep product
  variants/source sets separate if their extension APIs diverge; set `editor=gedit`.
- Send via Python SDK/Unix socket using GLib idle callbacks, never block GTK. Use local path or safe
  GIO URI, language ID, delta counts and save; key remains in the bridge/keyring.
- Distribute a user plugin bundle/Flatpak-aware instructions. Test Wayland/X11, sandbox filesystem
  portals, remote GIO, untitled/save-as, multiple windows, autosave, plugin disable, bridge loss and
  GNOME API version compatibility.

#### 36. GoLand — shared IntelliJ Platform plugin

- Reuse the Kotlin core with `editor=goland`. Track Go/module/workspace files with standard
  document/focus/save events; let the CLI determine Git/project/language and avoid source/PSI reads.
- Map Go build/run to `building`, tests to `running tests`, debugger to `debugging`, and exclude
  indexing/code-analysis background changes. Support remote development through backend-side bridge
  execution with path mapping.
- Test Go modules/workspaces, generated/vendor files, tests/benchmarks, debugger, WSL/SSH/Dev
  Containers, multiple projects and Plugin Verifier on the current/previous GoLand versions.

### 5.10 Programs 37–45 (fifth row)

#### 37. HBuilder X — native JavaScript plugin

- Build an HBuilder X plugin using its extension API for active text editor, document change/save,
  workspace/project folders and commands. Use its Node-capable runtime to connect to the bridge and
  set `editor=hbuilderx`; capability-test rather than importing VS Code APIs it does not implement.
- Track Vue/uni-app/HTML/JS files and map run/build/publish commands to `building` only when the host
  exposes lifecycle events. Exclude generated `unpackage`/build output by default.
- Publish through HBuilder X's plugin market/manual package. Test uni-app multi-platform projects,
  remote/device run, multiple windows, untitled/save-as, localization, plugin update and host API
  changes, plus mainland-network/offline installation of the bridge.

#### 38. IDA Pro — signed IDAPython plugin

- Create `extensions/ida/` in IDAPython using UI hooks for database open/close, current address/view
  changes, rename/comment/type/function modifications and IDB save. Entity is the IDB/i64 path or
  input-binary hash label—not disassembled bytes, strings, symbols, comments or decompiled text.
- Map disassembly/decompiler navigation and analysis to `researching`, manual database changes to
  `coding`, and debugger sessions to `debugging`; set `editor=ida-pro`. High-frequency cursor events
  are coalesced by the bridge.
- Security review is mandatory because users analyze untrusted binaries. No network access in IDA,
  no shell interpolation, strict local socket schema, and no import of target-controlled Python.
  Test 32/64-bit databases, IDB Save As, Hex-Rays present/absent, debugger, headless batch mode
  exclusion, multiple databases, plugin reload and supported IDA/Python versions.

#### 39. IntelliJ IDEA — canonical IntelliJ Platform distribution

- Use the shared Kotlin plugin and `editor=intellij-idea`. Global document listener captures delta
  lengths, file editor manager captures focus, file document manager captures save, and project/
  execution listeners provide project/build/debug/test markers.
- Support Community/Ultimate and local/remote development; bridge code belongs in the backend-side
  plugin module for remote architecture. Credentials use PasswordSafe only for bootstrap and paths
  respect AtoAxis allow/deny/obfuscation policy.
- Publish one Marketplace listing with product-specific IDs, run Plugin Verifier, and test Java/
  Kotlin/XML/scratch/console, multi-module/multi-window, Gradle/Maven, tests/debug, generated files,
  remote development, dynamic unload and previous/current releases.

#### 40. Jupyter — JupyterLab extension plus server component

- Create a prebuilt JupyterLab TypeScript extension for notebook/editor focus, model content-change,
  save-state and active cell/kernel execution. Pair it with a small Python server extension that
  resolves notebook paths/project roots and connects to the local bridge without exposing the API
  key to browser JavaScript.
- Entity is notebook/file path; send cell language/kernel and delta counts only, never cell source,
  outputs, variables or credentials. Execution maps to `running tests`/`coding` by policy and remote
  collaboration edits are excluded where origin is known. Set `editor=jupyter`.
- Cover JupyterLab current/previous, Notebook 7, optionally a frozen classic Notebook build. Test
  autosave, cell reorder/delete/type change, text editor, terminals excluded, remote JupyterHub,
  RTC collaboration, server restart, multiple browser tabs, package install/uninstall and auth.

#### 41. Kakoune — native hook script

- Create a Kakoune plugin (`atoaxis.kak`) registering `BufOpenFile`, buffer/display focus, insert/
  normal modification, `BufWritePost`, `BufClose` and client-exit hooks. Send newline-delimited events
  to one long-lived bridge client, not a shell process for every keystroke.
- Use `%val{buffile}`, project root, filetype, cursor line/column and edit counters available from
  hooks; set `editor=kakoune`. Ignore scratch/help/FIFO buffers and allow remote path policy.
- Distribute through common Kakoune plugin managers plus source. Test multiple clients/sessions,
  selections, macros generating many edits, FIFO buffers, save-as, remote terminal, bridge restart,
  hook removal and safe quoting of arbitrary file paths.

#### 42. Kate — KTextEditor plugin

- Build a C++/Qt/KTextEditor plugin using main-window active-view changes, `KTextEditor::Document`
  text-change/save/URL signals, cursor position and Kate project plugin metadata. Send asynchronously
  over local socket and set `editor=kate`.
- Use KIO URLs safely, exclude terminal/output/tool views, and map build/debug plugin lifecycle only
  when public signals are available. No KDE wallet secret is needed if the bridge owns credentials.
- Package for KDE Store/distributions with ABI/version guards. Test local/KIO remote files, sessions,
  multiple windows/splits, untitled/save-as, external reload, autosave, plugin unload, Wayland and
  current/previous KDE Frameworks/Qt versions.

#### 43. Kiro — VS Code-family build with agent attribution adapter

- Package the TypeScript extension for Kiro's supported extension channel with `editor=kiro`, using
  capability detection for standard VS Code document/save/debug/task APIs and the central bridge.
- Integrate Kiro's agent/spec/task execution only through documented events or export/transcript
  format. AI-applied edits get verified agent attribution; editor changes with unknown origin remain
  unattributed rather than inferred.
- Test specs, hooks/steering files, accept/reject agent changes, background changes, remote workspace,
  extension API/version divergence, Open VSX/manual install, bridge setup and deduplication when an
  agent adapter and editor adapter both see the same file change.

#### 44. Komodo — legacy add-on with desktop fallback

- Target the last Komodo IDE/Edit add-on SDK with a JavaScript/XUL component listening to current
  view, Scintilla modification/save and project changes; use `editor=komodo` and the compatibility
  CLI shim where the host can launch processes.
- Keep the artifact frozen and isolated from modern JS dependencies. If the supported add-on API is
  unavailable in a user's build, use the desktop tracker and mark precision lower rather than using
  binary injection or unsupported preference modifications.
- Test the final IDE/Edit releases, local/remote files, toolbox/run commands, projects, splits,
  untitled/save-as, add-on manager install/remove, bridge absence and legacy TLS/runtime constraints.

#### 45. Maestro — upstream integration, not a parallel plug-in host

- Maestro already exposes a WakaTime tracking toggle rather than a general third-party extension
  surface. Open an upstream issue/PR to add provider selection or a configurable compatible API URL,
  CLI path and AtoAxis branding while retaining the same privacy semantics.
- Define the required contract: emit active flow/file focus, YAML edit/save and test-run events with
  `editor=maestro`; map authoring to `coding` and flow execution to `running tests`, without command
  output, device data or test secrets.
- Until upstream support ships, document the `wakatime-cli` shim if Maestro can resolve it and the
  desktop fallback otherwise. Contract-test any supported API-url override, then test Desktop/CLI,
  workspace switching, flow run/cancel, secrets redaction, offline queue and duplicate prevention.

### 5.11 Programs 46–54 (sixth row)

#### 46. Micro — native Lua plugin

- Create a Lua plugin using Micro's buffer open/change/save/close, tab/focus and cursor hooks. Maintain
  one session client to the bridge, send file/project/filetype/cursor/delta metadata, and set
  `editor=micro`; do not invoke the CLI once per key.
- Use Micro's config/plugin manager for enable/status/diagnose commands. Ignore help/log/terminal and
  unnamed buffers until saved unless the user opts in.
- Test terminal and GUI terminals, multiple panes/tabs, macros/paste, save-as, remote SSH, unusual
  paths, Lua/plugin API versions, bridge restart, reload/uninstall and bounded queue behaviour.

#### 47. MPS — shared IntelliJ Platform plugin with model-aware events

- Reuse the JetBrains core with `editor=mps` for ordinary text documents, then add an MPS-specific
  optional module for active editor/node/model changes and model save events. Feature-gate it so an
  MPS API change cannot break every other JetBrains product.
- Entity is the model/module file or a stable model URI; default-redact node names/content. Map model
  edits to `modeling` or `coding` by language configuration, builds/generation to `building`, and
  send only counts and identifiers permitted by privacy policy.
- Test projectional editors, multiple nodes/models, generated sources exclusion, model save, make/
  generation, project switching, plugin dynamic unload and Plugin Verifier for MPS-specific APIs.

#### 48. Neovim — native Lua plugin

- Create `extensions/neovim/` in Lua using `BufEnter`, `TextChanged`, `TextChangedI`, `BufWritePost`,
  `BufLeave`, `FocusGained/Lost`, `VimLeavePre` and `nvim_buf_attach` deltas. Use libuv local pipe/socket
  with reconnection and set `editor=neovim`.
- Resolve project with `vim.fs.root` only as an alternate hint, language from filetype, cursor from
  the active window, and ignore unlisted/terminal/prompt/help buffers. Batch paste/macros produce
  character deltas without ever transmitting inserted text.
- Distribute via LuaRock/source and document lazy.nvim/packer/manual setup. Test headless exclusion,
  multiple UIs/tabs/windows, LSP edits, remote SSH, unsaved/save-as, huge/binary buffers, plugin lazy
  load/unload, bridge restart and current/previous Neovim versions.

#### 49. NetBeans — Java module

- Build a NetBeans Platform module using TopComponent/editor activation, EditorCookie documents,
  `DocumentListener`, SaveCookie/file change and project APIs. Send through JVM bridge SDK off the
  AWT event thread and set `editor=netbeans`.
- Entity is FileObject local path/safe URI, project is an alternate hint, MIME type is language, and
  caret/delta/save events follow the shared policy. Build/run/test/debug lifecycle can map categories
  through public project action events; ignore output and generated files.
- Publish signed NBM/update center. Test Java/PHP/C++ distributions where available, Maven/Gradle/
  Ant, multiple projects, remote files, untitled/save-as, GUI builder source/design, module reload,
  bridge restart and current/previous NetBeans/JDK LTS versions.

#### 50. Notepad++ — native C++ plugin

- Implement the Notepad++ Plugin API in C++ using `NPPN_BUFFERACTIVATED`, `SCN_MODIFIED`,
  `NPPN_FILESAVED`, shutdown and Scintilla caret APIs. Maintain one named-pipe client and set
  `editor=notepad-plus-plus`; build separate x86/x64 binaries if still required.
- Use full local path, lexer/language, delta lengths and save flag; ignore internal/console/untitled
  buffers until explicitly allowed. The plugin must never load arbitrary DLLs from project paths.
- Sign releases and publish through Plugins Admin/manual ZIP. Test split views of the same buffer,
  sessions, huge files, macros/paste, Save All/Save As, external reload, portable mode, bridge update,
  plugin unload and current/previous Notepad++ versions.

#### 51. Nova — native Nova extension

- Create a JavaScript/TypeScript Nova extension using workspace text editor activation/change/save/
  destroy events, workspace path and syntax, and Nova's process API to maintain bridge communication.
  Store bootstrap secrets in Nova secure storage if needed and set `editor=nova`.
- Use document path/project workspace, selection/caret and text-change range lengths. Task/run events
  map to `building` only through supported APIs; remote files use sanitized URI/path mapping.
- Distribute through Nova Extension Library and signed source. Test local/remote workspaces, multiple
  windows, extension reload, unsaved/save-as, tasks, clips/multi-cursor edits, bridge install/update,
  network outage and current/previous Nova releases.

#### 52. Obsidian — native TypeScript community plugin

- Build an Obsidian plugin using workspace active-leaf/file events, editor change/CodeMirror
  transactions, vault modify/rename/delete and window focus. Register listeners only after layout
  ready and dispose them through the plugin lifecycle; set `editor=obsidian`.
- Entity is vault-relative Markdown/canvas path (absolute path stays local if privacy mode demands),
  project is vault name or configured project, category `notes`; send character counts only and never
  note text, frontmatter, links, tags, canvas contents or attachment names by default.
- Desktop can use the local bridge; mobile requires OAuth direct API with encrypted bounded offline
  storage and must be a separate capability tier. Test Live Preview/source mode, Canvas, rename,
  sync/remote modifications exclusion, multiple vaults/windows, mobile suspend, plugin reload and
  Community Plugins review requirements.

#### 53. OpenCode — native npm plugin

- Create an `opencode-atoaxis` package for OpenCode's supported plugin lifecycle, configured in
  `opencode.json`. Listen to successful file write/edit/patch tool completion and session metadata;
  emit AI attribution without inspecting prompts/responses and set `editor=opencode`.
- Use `ai_agent=opencode`, provider/model only when reported, category `ai coding`, stable tool-call
  event ID and per-file line deltas. Shell commands with opaque side effects are `unattributed` and
  do not receive fabricated AI line counts.
- Add an OpenCode transcript parser only as crash recovery and share the delivered ledger. Test npm
  install/update, local/global config preservation, parallel sessions, permissions/rejected tools,
  multi-file patches, custom providers/models, offline queue, bridge absence and clean uninstall.

#### 54. Oxygen — Eclipse/RCP fragment

- Determine the current Oxygen XML Editor extension point and Eclipse/RCP compatibility. Where OSGi
  workbench/document listeners are accessible, reuse the Eclipse core with an Oxygen fragment and
  `editor=oxygen`; otherwise build the documented Java plugin adapter against Oxygen's SDK.
- Track XML/XSLT/XQuery/text document focus/change/save and project/framework hint. Exclude document
  text, validation messages, transformation output and remote credentials; transformation/debug runs
  can map to `building`/`debugging` through public lifecycle events.
- Because Oxygen is proprietary, test licensed supported versions in CI/manual matrix and maintain
  version gates. Cover local/remote WebDAV files, Author/Text/Grid modes, DITA projects, Save As,
  validation/transformation, plugin install/update/uninstall and desktop fallback for unsupported hosts.

### 5.12 Programs 55–63 (seventh row)

#### 55. PhpStorm — shared IntelliJ Platform plugin

- Reuse the Kotlin core with `editor=phpstorm`; track PHP/JS/template/config documents with standard
  focus/change/save. CLI derives project/Git/language, while run/debug/test listeners provide truthful
  `building`, `debugging`, and `running tests` markers.
- Exclude caches/vendor/generated files by central defaults, support remote development/WSL path
  mapping, and keep database consoles subject to the same redaction as DataGrip.
- Test Composer projects, PHPUnit, Xdebug, JavaScript tooling, remote deployment files, multiple
  projects, generated templates and Plugin Verifier on current/previous PhpStorm.

#### 56. Postman — desktop companion/official API route, not page injection

- First research the current Postman integration surface. If a supported desktop extension API can
  observe workspace/request/tab focus and local request changes, build against it; Postman scripts
  execute only during requests and cannot truthfully measure editing time, so do not use collection
  scripts as a timer.
- Default plan is an AtoAxis desktop companion that recognizes the Postman app/window and, where a
  documented local API exposes stable workspace/request IDs, emits `editor=postman`, category
  `coding`/`manual testing`, `precision=host-limited`. Never capture URLs with secrets, headers,
  bodies, variables, responses, cookies, environment values or auth tokens.
- Test desktop and web client, multiple workspaces/tabs, request edit/send, collection runner,
  background requests, secret redaction, window-title changes, offline mode and no false time when a
  request is running in the background. Native status waits on a supported host API.

#### 57. PowerPoint — shared Office add-in plus Windows precision helper

- Reuse `extensions/office/` with a PowerPoint manifest. Track presentation open/activation,
  selection/slide changes and save events available through Office.js; use `designing`, entity as
  local path or hashed cloud-document ID, and exclude slide text, speaker notes, media, comments and
  participant identities.
- Because Office.js background events are limited, ship the signed Windows VSTO companion for precise
  presentation/window/change/save/close and bridge IPC. macOS/web remain host-limited and visibly
  report that limitation unless supported event-based activation becomes sufficient.
- Test Windows/Mac/web, coauthoring/autosave, slide show mode exclusion or separate `presenting`
  future category, multiple windows, Save As, protected files, add-in deployment, VSTO installer,
  OAuth expiry and uninstall.

#### 58. Processing — Java Tool/plugin

- Build a Processing Tool or Mode-compatible Java extension using editor/sketch activation,
  document change/save and run/stop callbacks. Project is sketch folder, entity is `.pde`/Java file,
  language is Processing/Java, and `editor=processing`.
- Map authoring to `coding`, sketch run/build to `building`, and exclude console/render-window
  activity unless a user event returns focus to the editor. Use the JVM bridge client off Swing EDT.
- Processing major versions have different extension APIs; ship version-specific builds and test
  multi-tab sketches, new unsaved sketch, Save As, Java mode, contribution manager install, run/
  stop/error, multiple editors, bridge restart and clean unload.

#### 59. Pulsar — native package

- Create an Atom/Pulsar JavaScript package using workspace active pane item, TextEditor `onDidChange`,
  `onDidSave`, `onDidDestroy`, project paths and cursor events. Reuse a Node bridge client, dispose
  subscriptions through a CompositeDisposable, and set `editor=pulsar`.
- Track local/remote package-supported paths, delta counts and saves; ignore settings, terminal and
  non-text pane items. Provide status-bar, today, configure/doctor and privacy commands.
- Publish to Pulsar Package Registry/source, not the retired Atom registry. Test multiple panes,
  Tree-sitter grammars, Teletype/remote edits, untitled/save-as, large paste, package reload/update,
  bridge missing/restart and current/previous Pulsar.

#### 60. PyCharm — shared IntelliJ Platform plugin

- Reuse Kotlin core with `editor=pycharm`, supporting Community/Professional, Python files and
  notebooks through the same native document path. Run/debug/tests map to their categories and
  background indexing/type analysis is excluded.
- Virtualenv/interpreter names are not telemetry. Remote interpreters/development require backend
  bridge and safe path mapping; generated `.venv`, caches and notebooks outputs are ignored.
- Test pytest/unittest, debugger, scientific/notebook modes, Django templates, remote interpreter,
  multiple projects and Plugin Verifier on current/previous PyCharm.

#### 61. Qoder — VS Code-family build with agent adapter boundary

- Package the TypeScript extension for Qoder's supported VS Code-compatible channel with
  `editor=qoder`, capability gates and the shared bridge. Standard editor focus/edit/save/task/debug
  behaviour stays identical to VS Code.
- Attribute Qoder agent-generated edits only through documented agent events/transcripts; keep
  unknown bulk changes unattributed. Deduplicate agent and editor observations through stable event
  IDs/correlation without converting heuristic confidence into verified attribution.
- Test chat/agent workflows, accept/reject changes, background edits, remote workspaces, API fork
  differences, manual VSIX/Open VSX installation, bridge bootstrap, updates and dual-source dedup.

#### 62. Recaf — Java plugin

- Build against Recaf's supported plugin API for workspace/class/file tab activation, text/assembler
  editor changes and workspace save/export. Use stable archive/workspace plus class/resource URI,
  `editor=recaf`, category `researching` for navigation and `coding` for actual modifications.
- Never transmit bytecode, decompiled source, class/member names or target strings by default; allow
  hashed entity labels. Connect via JVM bridge SDK and treat background decompilation/analysis as idle.
- Security harden for hostile archives: no project-controlled classloading, strict plugin classloader,
  bounded strings/events, and safe IPC. Test large/obfuscated archives, multiple tabs, assembler edits,
  export/save, plugin reload, Recaf/API/JDK versions and desktop fallback when API breaks.

#### 63. ReClassEx — native C++ plugin with strict security boundary

- Implement the documented ReClass.NET/ReClassEx plugin API in C++ for project open/save, active
  class/node selection and model modifications; verify the exact product/version because plugin APIs
  differ. Set `editor=reclassex`, entity to project/process-safe label, category `researching` or
  `modeling`—never memory contents, addresses, process arguments or symbol values.
- Use signed native binaries and named-pipe IPC only. Do not inject hooks, scan memory, or elevate;
  if supported callbacks cannot provide sufficient events, fall back to desktop active-window
  tracking instead of reverse engineering private internals.
- Test x86/x64, attach/detach, project save, node edits, target process exit, hostile names, plugin
  install/remove, bridge restart, version gates and an explicit threat-model review.

### 5.13 Programs 64–72 (eighth row)

#### 64. Rider — shared IntelliJ Platform plugin

- Reuse the Kotlin JetBrains core with `editor=rider`, but validate Rider's frontend/backend split.
  Document focus/change/save lives in the proper IntelliJ-side module while build/test/debug lifecycle
  may require Rider/ReSharper-specific APIs behind an optional source set.
- Track C#/F#/VB/Razor/Unity solution files; map build to `building`, test to `running tests`, debug to
  `debugging`, and exclude generated `obj`/`bin`. Remote development requires the bridge beside the
  project backend with safe frontend path/display mapping.
- Test .NET solutions, Unity-generated projects, tests/debugger, multiple solutions, WSL/remote,
  frontend/backend reconnect, plugin dynamic unload and Plugin Verifier/current/previous Rider.

#### 65. Roblox Studio — native Studio plugin

- Build a Roblox Studio Lua plugin using Script Editor document open/focus/change/close hooks and
  place publish/save lifecycle where the supported Studio API permits. Because filesystem/process
  access is sandboxed, send direct HTTPS with OAuth device authorization and encrypted plugin
  settings; set `editor=roblox-studio`.
- Entity is stable place/script ID plus user-approved display label, project is place/universe, and
  category `coding` or `designing`; never send source, game contents, player data, asset contents,
  collaboration messages or secret keys. Team Create remote edits must not be credited locally.
- Verify current plugin security/network capabilities before committing native status. Test local/
  cloud places, Team Create, Script Editor multi-tabs, autosave/publish, play-test (`running tests`),
  plugin unload/update, OAuth expiry, offline bounded queue and marketplace review.

#### 66. RubyMine — shared IntelliJ Platform plugin

- Reuse Kotlin core with `editor=rubymine`. Standard editor events cover Ruby/Rails/templates; run,
  test and debugger listeners map categories without collecting console output, environment variables
  or interpreter credentials.
- Exclude bundle/vendor/cache/generated files centrally and support remote SDK/development via
  backend bridge/path mapping. Database console behaviour follows DataGrip redaction.
- Test Rails projects, RSpec/Minitest, debugger, ERB/JS, remote interpreters, multiple projects and
  Plugin Verifier on current/previous RubyMine.

#### 67. RustRover — shared IntelliJ Platform plugin

- Reuse Kotlin core with `editor=rustrover`; track Rust/Cargo files via standard events and let the
  CLI derive workspace/Git/language. Cargo run/build/test/debug become their respective categories,
  while indexing/macro expansion/background analysis is excluded.
- Exclude `target` and generated code by default, support WSL/remote development, and keep toolchain/
  environment values out of telemetry.
- Test Cargo workspaces, build scripts, tests/benchmarks, debugger, macro-generated files, remote
  projects, multiple windows and Plugin Verifier/current/previous RustRover.

#### 68. Safari — Safari Web Extension wrapper

- Reuse the browser core through a Safari Web Extension packaged in a signed/notarized macOS/iOS app
  extension. Track active tab/window/navigation and known web-app site adapters, normalize domains,
  exclude Private Browsing by default, and set `editor=safari`.
- macOS can use an App Group/native companion to reach the bridge; iOS/iPadOS must use OAuth direct
  API with short-lived tokens and bounded encrypted queue. Ask only for per-site access where Safari
  supports it and make domain allowlisting the default.
- Test macOS/iOS Safari, extension permission prompts, private windows, tab groups, profiles, PWAs,
  background suspension, native companion missing, auth expiry, App Store update and uninstall/data
  deletion.

#### 69. SiYuan — native TypeScript plugin

- Build a SiYuan plugin using its workspace/document/tab lifecycle, editor transaction/change and
  document save/sync events. Desktop connects to the bridge; mobile uses OAuth direct API. Set
  `editor=siyuan`, category `notes`.
- Entity is notebook/document stable ID or privacy-safe path; default-redact titles, block content,
  backlinks, tags, assets and synced collaborator data. Count local editor deltas only and ignore
  renderer/index/sync changes.
- Test desktop/mobile, multiple notebooks/windows, block moves, rename/delete, local vs sync edits,
  Markdown/source modes, plugin update/reload, bridge unavailable, mobile suspend and marketplace
  packaging/privacy review.

#### 70. Sketch — native macOS plugin

- Create a signed Sketch JavaScript/CocoaScript plugin (or current official plugin API) observing
  document open/selection/change/save/close and app focus. Use a native helper/bridge connection,
  entity as local document path or hashed cloud-document ID, `editor=sketch`, category `designing`.
- Never send layer text, names, images, symbols, comments, collaborator identity or design snapshots
  by default. Coalesce high-frequency selection/document events and exclude export/background sync.
- Verify the current Sketch plugin runtime and notarization rules. Test local/Workspace documents,
  autosave/versioning, multiple windows/pages, prototypes, libraries, offline documents, plugin
  update/uninstall, helper missing and host API version changes.

#### 71. SlickEdit — native Slick-C macro package

- Implement a Slick-C macro package using buffer switch/modify/save/quit, project/workspace and
  cursor callbacks. Maintain one background bridge channel or a debounced CLI-shim call path and set
  `editor=slickedit`.
- Send absolute file/project hint/language/cursor/delta/save only; map build/debug through supported
  callbacks and exclude output/tool buffers. Avoid shell-string construction by passing structured
  arguments or socket JSON.
- Package through SlickEdit macro loading with version gates. Test Windows/macOS/Linux, workspaces,
  multiple MDI windows, remote files, macros/paste, Save All/Save As, debugger/build, bridge restart,
  Slick-C API changes and clean macro unload.

#### 72. SQL Server Studio (SQL Server Management Studio / SSMS) — Visual Studio Shell VSIX

- Build a signed C# VSIX/VSPackage for supported SSMS generations using Visual Studio Shell document
  window/selection, text buffer change/save and solution/project services. Version-specific manifests
  may be required; set `editor=sql-server-management-studio`.
- Track SQL files and unsaved query buffers via stable session URI. Never send SQL text, server/
  database/login names, connection strings, query parameters, results or execution plans. Query run
  is `coding` or `manual testing` by policy and background completion does not extend active time.
- Ship an MSI/VSIX installer that registers only supported SSMS versions and uninstalls cleanly.
  Test SSMS 18/19/20+ as applicable, multiple query windows/connections, Save/Save As, results/design
  panes, admin/non-admin install, extension allowlisting, bridge named pipe, offline and host update.

### 5.14 Proposed repository layout

```text
extensions/
├── protocol/                 # JSON Schema + generated SDKs + contract fixtures
├── browser/                  # Chromium/Firefox core + site adapters
├── safari/                   # Safari Web Extension wrapper/companion
├── jetbrains/                # one Kotlin core, product IDs/source sets
├── eclipse/                  # OSGi core + Aptana/DBeaver/Oxygen fragments
├── office/                   # Office.js shared code + Excel/PowerPoint manifests
├── office-windows/           # signed VSTO companions
├── rad-studio/               # Delphi/C++ Builder Open Tools API package
├── ai-agents/                # Amp/Claude/Codex/Copilot/OpenCode/Antigravity
├── blender/ figma/ jupyter/ obsidian/ nova/ pulsar/
├── emacs/ neovim/ micro/ kakoune/
├── geany/ gedit/ kate/ netbeans/ notepad-plus-plus/
├── ida/ recaf/ reclassex/ processing/ roblox-studio/
└── legacy/                   # AppCode/Aptana/Brackets/Coda/Komodo frozen builds

backend/api/crates/
├── wakaclock-bridge/         # local daemon, socket/pipe server, raw event state machine
├── wakaclock-protocol/       # schema types/version negotiation
└── wakaclock-cli/            # wakaclock + wakatime-cli compatible entry points
```

Every adapter directory contains `README.md`, `SUPPORT.md`, `PRIVACY.md`, host-version matrix,
licence notices, package/store metadata, unit tests, contract-test launcher and reproducible release
instructions. Generated binaries and store credentials are never committed.

### 5.15 Effort and staffing estimate

These are engineering ranges after requirements discovery, not calendar promises. They include
implementation, tests, packaging and documentation but exclude external store-review waiting time.

| Workstream | Estimated person-weeks | Notes |
|---|---:|---|
| Foundation: shim, bridge, protocol, SDKs, release/test infrastructure | 12–18 | critical path; 3 OSes |
| VS Code and IntelliJ families, including product QA | 10–16 | 17 icons, two codebases |
| Six AI/agent adapters and dedup ledger | 10–16 | availability of official events is the risk |
| Browser/Safari/site adapters | 10–15 | privacy/store review/native host |
| Eclipse, RAD Studio, NetBeans, SSMS, Office | 18–28 | JVM/.NET/Pascal and version matrices |
| Design/notebook/knowledge tools | 14–22 | sandbox auth and host-limited lifecycle |
| Classic editors and terminal editors | 18–28 | many packaging ecosystems |
| Reverse-engineering/security tools | 8–14 | mandatory threat modelling |
| Legacy/proprietary discovery and frozen builds | 10–18 | APIs may be unavailable |
| Cross-product QA, docs, installers, support launch | 14–22 | cannot be deferred to the end |
| **Total** | **124–197 person-weeks** | roughly 8–12 months for a focused 4–6 person team, subject to host APIs/store approval |

Do not start 72 repositories at once. Recommended staffing is one bridge/release engineer, one JVM/
.NET engineer, one TypeScript/web engineer, one native/Python/editor engineer, and shared QA/security.
Limit work in progress to two adapter families per engineer and release each wave independently.

### 5.16 Release gates and rollout

- **Alpha:** internal accounts, paths obfuscated by default, fake bridge plus staging API, no stores.
- **Beta:** signed packages, opt-in users, crash/offline/privacy telemetry only, one-click diagnostic
  bundle with local redaction preview, rollback tested.
- **General availability:** host store approval, current/previous version matrix green, privacy and
  security review, support runbook, uninstall/data deletion, and SLO for heartbeat ingestion.
- **Legacy:** frozen signed artifact, last-tested host/OS prominently shown, no GA badge for current
  versions, compatibility shim/desktop fallback offered.
- **Retirement:** announce at least one stable release ahead, keep data export and uninstall docs,
  and never auto-convert native precision history into desktop precision without a new source label.

### 5.17 Research references and validation backlog

The architectural pattern follows WakaTime's public plugin guidance—editor event adapter plus common
CLI—but AtoAxis should implement and test its own bridge contract. The reference list is a discovery
aid, not proof that every host API is unchanged or that source may be copied:

- [WakaTime public supported-program grid](https://wakatime.com/plugins) and
  [plugin creation model](https://wakatime.com/help/creating-plugin)
- [VS Code Extension API](https://code.visualstudio.com/api/references/vscode-api)
- [IntelliJ document and listener APIs](https://plugins.jetbrains.com/docs/intellij/documents.html)
  and [Plugin SDK](https://plugins.jetbrains.com/docs/intellij/welcome.html)
- [Figma plugin events](https://developers.figma.com/docs/plugins/api/properties/figma-on/)
- [Blender application handlers](https://docs.blender.org/api/current/bpy.app.handlers.html)
- [Office.js Excel events](https://learn.microsoft.com/en-us/office/dev/add-ins/excel/excel-add-ins-events),
  [Office add-in event activation limits](https://learn.microsoft.com/en-us/office/dev/add-ins/develop/event-based-activation),
  and [Office add-in overview](https://learn.microsoft.com/en-us/office/dev/add-ins/excel/excel-add-ins-overview)
- [Obsidian plugin lifecycle](https://docs.obsidian.md/plugins/guides/lifecycle-management)
- Existing public install behaviour for special cases:
  [Canva](https://wakatime.com/canva), [Discord](https://wakatime.com/discord),
  [Maestro](https://wakatime.com/maestro), [OpenCode](https://wakatime.com/opencode),
  [C++ Builder](https://wakatime.com/c%2B%2B-builder), and
  [SQL Server Management Studio](https://wakatime.com/sql-server-management-studio)

Before opening an implementation issue for any program, attach a one-page discovery record containing:
official SDK/version URL, latest host release tested, event APIs available, process/network/sandbox
limits, secret-storage option, packaging/store route, licence decision, exact precision level, and a
working hello-event proof. A failed discovery produces a documented desktop/browser fallback; it does
not produce an unsupported injection/hooking workaround.

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
   - Versioned Kafka event envelopes, topic contracts, partition keys and RabbitMQ job
     contracts. These contracts land before any producer or consumer is switched on.
2. **PR 9.2 — Stable project identity**
   - `project_id`, aliases, merge-to-canonical mapping, ownership checks and backfill
     dry-run.
3. **PR 9.3 — AI usage/session/pricing storage**
   - `ai_usage_events`, `ai_sessions`, `ai_session_projects`, pricing catalog, validation
     and idempotency tests.
   - Kafka producers for authenticated heartbeat/AI metadata ingestion and idempotent
     consumers for `ai.edit.v1` and `ai.usage.v1`.
4. **PR 9.4 — Account projections**
   - machine/model/client/project daily analytics, Kafka-to-ClickHouse batch consumer and
     version-aware rebuild mechanism.
5. **PR 9.5 — Project-detail projections**
   - file/branch/language/editor/activity daily tables, path sanitization and reconciliation
     tests. Projection consumers commit Kafka offsets only after the complete ClickHouse
     batch is durable.
6. **PR 9.6 — Dashboard API**
   - summary, comparison, models/editors/languages/OS/machines/weekdays and daily
     attribution.
7. **PR 9.7 — Project list API**
   - project cards, sorting, cursor pagination, coverage and account-level denominators.
8. **PR 9.8 — Project detail/drill-down APIs**
   - overview, files, branches, daily and AI endpoints with consistent filters.
9. **PR 9.9 — Historical reprocess**
   - project ID backfill, transcript-aware attribution rebuild, versioned publish and audit.
   - RabbitMQ job exchange, reprocess/projection queues, retry policy, publisher confirms,
     manual acknowledgements and dead-letter queues.
10. **PR 9.10 — Frontend integration**
    - dashboard charts, project cards, detail page, bubble/list reuse, branch filter and
      partial/empty/error states.
11. **PR 9.11 — Performance/privacy launch gate**
    - query profiling, cache/ETag, range/rate limits, packaged E2E, privacy/docs/product-copy
      audit.
    - Kafka consumer-lag/load tests, RabbitMQ backlog/retry/DLQ tests, broker outage tests,
      broker ACL/TLS review and verification that queued payloads contain no prohibited data.

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
- [ ] Authenticated heartbeat, AI edit and AI usage events pass through Kafka with stable
      identities; replay, consumer restart and duplicate delivery do not change final totals.
- [ ] Historical reprocess and projection rebuild requests pass through RabbitMQ, expose a
      durable job status, retry safely and reach a dead-letter queue after bounded failures.
- [ ] Kafka or ClickHouse downtime does not lose accepted telemetry, and RabbitMQ or worker
      downtime does not lose accepted background jobs.

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

### 9.22 — Kafka event backbone and RabbitMQ job architecture

Phase 9 must support horizontal API and worker scaling without turning ClickHouse into the
backpressure boundary for every connected editor. Kafka and RabbitMQ are both part of the
production architecture, but they solve different problems and must not carry duplicate copies
of the same workload merely for redundancy.

#### Locked responsibility split

| Component | Owns | Must not own |
|-----------|------|--------------|
| Kafka | High-volume, append-only heartbeat, AI edit and AI usage event streams; ordered delivery per account; short-term replay; fan-out to independent consumers | User-triggered reprocess commands, delayed retries, cron-like jobs, email/notification jobs |
| RabbitMQ | Bounded background commands with explicit completion: AI session reconciliation, historical reprocess, projection rebuild, pricing reconciliation; retry/backoff and dead-letter handling | The continuous heartbeat firehose, client-local transcript parsing or a second copy of the Kafka telemetry stream |
| ClickHouse | Authoritative raw metadata facts, versioned projections, reconciliation and analytics reads | Acting as a message broker or absorbing unbounded synchronous request bursts |
| Client SQLite queue | Device-side offline buffering until the authenticated API confirms broker acceptance | Cross-user/server coordination or analytics processing |

If only one broker is healthy, the system handles only the workload assigned to that broker.
Kafka is not a fallback for RabbitMQ jobs, and RabbitMQ is not a fallback for Kafka telemetry.
Recovery comes from stable event/job identities, client retry, broker durability and idempotent
consumers rather than publishing every message twice.

#### End-to-end data flow

```text
IDE / CLI / agent hook
        │ local SQLite offline queue
        ▼
Authenticated ingest API (stateless, horizontally scalable)
        │ validate + sanitize + assign/verify stable event_id
        ▼
Kafka
  ├── heartbeat.v1 ───────────────┐
  ├── ai.edit.v1 ─────────────────┼──► ClickHouse fact sink (batched)
  └── ai.usage.v1 ────────────────┤
                                   ├──► attribution/session consumer
                                   └──► project identity/projection consumers

Authenticated maintenance API
        │ validate range + create stable job_id
        ▼
RabbitMQ topic exchange: wakaclock.jobs
  ├── ai.session.reconcile ───────► sanitized session/allocation worker
  ├── analytics.reprocess ────────► reprocess worker
  ├── projection.rebuild ─────────► projection worker
  └── pricing.reconcile ──────────► pricing worker
             │ bounded retry/backoff
             └────────────────────► wakaclock.jobs.dlq
```

Dashboard and project read APIs never wait for RabbitMQ jobs. They read one coherent published
projection version when available, otherwise the marked raw-data fallback. Read endpoints do not
publish telemetry messages simply because a chart was opened.

#### Shared event envelope

Every Kafka record uses a versioned metadata-only envelope. Producers may add optional fields but
may not reinterpret or remove a field without publishing a new schema version.

```json
{
  "schema_version": 1,
  "event_id": "stable-source-or-derived-id",
  "event_type": "heartbeat.recorded",
  "occurred_at": "2026-08-22T12:34:56.123Z",
  "received_at": "2026-08-22T12:34:56.456Z",
  "user_id": "uuid",
  "project_id": "uuid-or-null",
  "source": "vscode|cli|codex|claude|gemini",
  "trace_id": "uuid",
  "payload": {}
}
```

Envelope rules:

- `event_id` is stable across HTTP retry, client offline replay, Kafka replay and consumer
  restart. Upload time is never part of a derived identity.
- The Kafka record key is `user_id`. This preserves account-local order while allowing accounts
  to spread across partitions. No global ordering guarantee is required.
- `occurred_at` controls analytics time; `received_at` is observability metadata only.
- `project_id` may be null until stable resolution succeeds. A later resolver may emit a new
  versioned identity event but may not silently classify unknown project data.
- The payload contains counts, dimensions and opaque hashes/relative keys only. It never contains
  prompts, responses, transcript bodies, patch bodies, source code or absolute file paths.
- Unknown/Unattributed values remain explicit nullable fields and are never converted to Human or
  numeric zero by a producer, serializer or consumer.

#### Kafka topics and consumers

| Topic | Key | Producer | Primary consumers | Initial retention |
|-------|-----|----------|-------------------|------------------|
| `wakaclock.heartbeat.v1` | `user_id` | Heartbeat bulk API | heartbeat fact sink, project identity resolver, activity projection | 7 days |
| `wakaclock.ai-edit.v1` | `user_id` | Verified agent/correlation ingest API | AI fact sink, attribution/session consumer, AI projections | 30 days |
| `wakaclock.ai-usage.v1` | `user_id` | AI usage ingest API | usage/session fact sink, pricing consumer, project allocation | 30 days |
| `wakaclock.identity-change.v1` | `user_id` | Project identity/merge service | projection invalidator, audit consumer | 30 days |
| `wakaclock.ingest.dlq.v1` | original record key | Consumer error handler | restricted repair tooling only | 30 days |

Production Kafka defaults, subject to load-test revision:

- Start with 24 partitions for each telemetry topic. Measure skew by account before increasing;
  adding partitions changes cross-partition placement but does not weaken event-id deduplication.
- Use replication factor 3, `acks=all`, idempotent producers and minimum in-sync replicas 2.
- Disable consumer auto-commit. Commit offsets only after the complete ClickHouse batch succeeds.
- Batch ClickHouse writes by both size and time, initially 1,000 records or 500 ms, whichever
  occurs first. Tune from actual insert latency and consumer lag rather than request rate alone.
- A consumer group owns one logical side effect. Additional analytics uses get separate consumer
  groups; adding a replica to the same group increases throughput without duplicating the effect.
- Schema compatibility is checked in CI. A schema registry is required before any external team
  independently publishes to these topics.

Kafka delivery is at-least-once. Exactly-once analytics comes from idempotent effects:

1. The API verifies or derives a stable `event_id` and waits for Kafka acknowledgement before
   confirming acceptance to the client.
2. The ClickHouse sink writes the logical identity and version into a deduplicating/replacing fact
   table or rejects an already-seen identity.
3. Projection workers aggregate only deduplicated facts and publish a new `data_version` after
   reconciliation.
4. The consumer commits its Kafka offset after the write/publish succeeds. A crash before commit
   replays the batch safely.

The Kafka sink must not write retryable records directly into an additive materialized-view path.
Every heartbeat, AI edit and usage fact receives an `event_id` column and first lands in a
version-aware deduplication table keyed by `(user_id, event_id)`. Projection input selects one
logical version per identity. A replay may create another physical ClickHouse row before merging,
but API/projection queries must not count both rows, and additive projections are published only
from the deduplicated input. This requirement applies to ordinary heartbeats as well as AI events.

#### RabbitMQ exchanges, queues and workers

Use a durable topic exchange named `wakaclock.jobs` and a separate durable dead-letter exchange
named `wakaclock.jobs.dlx`.

| Routing key / queue | Producer | Worker responsibility | Completion result |
|---------------------|----------|-----------------------|------------------|
| `ai.session.reconcile` | AI usage consumer/internal scheduler | Rebuild session/model/project allocation from sanitized facts already ingested through Kafka | Counts, allocation method and coverage; never transcript content |
| `analytics.reprocess` | Authenticated maintenance API | Re-resolve project IDs and attribution for one user/range | Audit ID, reconciliation totals and published `data_version` |
| `projection.rebuild` | Reprocess worker or internal scheduler | Build account/project staging projections and publish after validation | Published `data_version` or controlled failure |
| `pricing.reconcile` | Internal audited administration path | Reprice only events covered by an explicitly approved catalog version | Pricing version, affected count and coverage delta |
| `wakaclock.jobs.dlq` | RabbitMQ dead-letter exchange | Hold exhausted jobs for restricted inspection/replay | No automatic replay |

RabbitMQ job contract:

```json
{
  "schema_version": 1,
  "job_id": "uuid-or-idempotency-key-derived-id",
  "job_type": "analytics.reprocess",
  "requested_by": "authenticated-user-or-internal-principal",
  "user_id": "uuid",
  "range": {"start": "2026-08-01", "end": "2026-08-31", "timezone": "Asia/Bangkok"},
  "attempt": 0,
  "trace_id": "uuid",
  "parameters": {}
}
```

Persist privacy-safe job state in a versioned `wakaclock.async_jobs` table:

```text
user_id, job_id, job_type, idempotency_key_hash,
status(pending_publish|queued|running|succeeded|failed|dead_lettered|cancelled),
attempt, requested_at, started_at, finished_at,
result_data_version Nullable(UInt64), error_code Nullable(String), version
```

Expose `GET /api/v1/jobs/:job_id` with ownership checks. The response contains state, progress,
timestamps, sanitized error code and result version only; it does not expose broker routing,
worker hostnames or serialized message bodies.

RabbitMQ processing rules:

- The API uses publisher confirms and returns `202 Accepted` only after the broker confirms the
  durable message. A failed publish returns a controlled retryable error.
- The API writes `pending_publish` before publishing and updates to `queued` after publisher
  confirmation. A reconciler republishes abandoned `pending_publish` rows with the same `job_id`;
  worker idempotency makes a crash between publish and status update safe.
- Repeated `Idempotency-Key` values resolve to the same `job_id`. Workers keep a durable job audit
  and treat an already completed job as success without performing it again.
- Consumers use manual acknowledgement and acknowledge only after durable audit/projection state
  is written.
- Retry with exponential backoff plus jitter, initially 5 seconds, 30 seconds, 2 minutes and
  10 minutes. After the bounded attempts, dead-letter the job with a sanitized error category.
- Use a bounded prefetch, initially 10 for session reconciliation and 1 for expensive reprocess/rebuild
  workers. Increase only after ClickHouse load and memory use are measured.
- A projection rebuild spawned by reprocess receives a deterministic child job ID. Retrying the
  parent cannot create parallel rebuilds of the same user/range/version.
- Job payloads carry IDs, ranges and configuration versions. Large data is read from authoritative
  stores by the worker and is not embedded in RabbitMQ messages.
- Transcript discovery and parsing remain local to the CLI/extension because the server cannot and
  must not reach into a user's local transcript files. RabbitMQ starts only after sanitized event
  metadata has crossed the authenticated Kafka ingestion boundary.

#### API behavior and backpressure

- Heartbeat/AI ingest endpoints validate authentication, size limits, schema and privacy before
  publishing. They return an acceptance ID after Kafka acknowledgement; they do not wait for
  ClickHouse or projections.
- Existing CLI/extension SQLite queues remove an item only after broker-backed API acceptance. If
  Kafka is unavailable, the API returns `503` plus `Retry-After` and the client retains the item.
- When ClickHouse is unavailable, Kafka consumers stop committing offsets. Kafka absorbs the
  bounded outage and consumer-lag alerts fire; the API remains available while topic retention and
  disk capacity are safe.
- Maintenance endpoints return a `job_id` and expose authenticated job status. They never hold an
  HTTP connection open for a reprocess or rebuild.
- If RabbitMQ is unavailable, a job request is not reported as accepted. Clients may retry with
  the same idempotency key without creating duplicate work.
- Apply per-user and global publish quotas before either broker. A broker is a backpressure buffer,
  not permission to accept unlimited untrusted input.

#### Security and privacy controls

- Browsers, IDEs and external agents never receive direct Kafka or RabbitMQ credentials. Only
  authenticated server-side producers and workers can reach broker networks.
- Production brokers require TLS, authentication and least-privilege ACLs. API producers receive
  write-only access to their topics/exchange; consumers receive only their group/queue access;
  repair tools use a separate audited principal.
- Do not place bearer tokens, API keys, prompt text, transcript text, patches, source code or raw
  absolute paths in message bodies, headers, keys, topic names, queue names or error logs.
- Encrypt broker disks/backups, set explicit retention and document deletion propagation. Kafka
  retention is a recovery window, not a second permanent analytics database.
- DLQ access is production-sensitive. DLQ inspection tools display identifiers and sanitized error
  categories, not arbitrary serialized payload dumps.

#### Observability and capacity gates

Required metrics and alerts:

- API publish latency/error rate by topic or routing key.
- Kafka bytes/records in, partition skew, under-replicated partitions, consumer lag and age of the
  oldest unprocessed record for every consumer group.
- RabbitMQ ready/unacked counts, oldest job age, retry count, DLQ count and worker concurrency.
- ClickHouse batch size, insert latency, rejected rows, dedup hits and projection reconciliation
  failures.
- End-to-end delay from `occurred_at` to raw fact visibility and from fact visibility to published
  projection version.

Initial production targets:

- Kafka-backed ingest acknowledgement p95 below 250 ms under expected peak load.
- Normal consumer lag below 60 seconds; alert at 5 minutes and page at 15 minutes.
- No accepted event/job loss during one broker/worker restart.
- Zero projection publication when reconciliation fails.
- RabbitMQ DLQ is normally empty; any non-test message pages the owning worker team.

Capacity tests must establish the supported users rather than claim scale from broker presence
alone. Test concurrent active users, per-user burst, Kafka partition skew, ClickHouse batch
throughput, worker catch-up after outage and storage required for the full retention window.

#### Rollout and migration sequence

1. Land schemas, event/job types and compatibility tests with all producers disabled.
2. Deploy Kafka/RabbitMQ, ACLs, dashboards and empty consumers in shadow mode.
3. Dual-observe a sample of sanitized telemetry: keep the current direct write authoritative while
   the Kafka sink writes to isolated shadow tables. Compare counts, identities and latency.
4. Stop shadow writes and fix every reconciliation mismatch; do not compensate by adding totals.
5. Switch one account cohort at a time so Kafka becomes the sole accepted telemetry path. Keep the
   client offline queue enabled throughout.
6. Enable RabbitMQ for dry-run reprocess jobs, then projection rebuilds, then non-dry-run repairs.
7. Remove the direct ClickHouse ingest path only after rollback and replay tests pass. Reads remain
   unchanged until broker-backed facts reconcile with the existing API responses.
8. Run packaged Codex, Claude and Gemini scenarios, broker restart tests and realistic load tests
   before declaring the launch gate complete.

Rollback rules:

- A cohort may return to direct ingest only while dual-write reconciliation and a deterministic
  event-ID bridge are still available. Never run independent direct and Kafka authoritative paths
  indefinitely.
- Kafka records already acknowledged remain consumable after rollback and must still deduplicate
  against any direct writes.
- RabbitMQ jobs already accepted must finish or be explicitly cancelled/audited; disabling new job
  publishing does not discard queued work.

#### Deployment baseline

Development uses one KRaft Kafka broker, one RabbitMQ node with the management UI and one
ClickHouse node in Docker Compose. Production starts with either managed services or at least three
Kafka brokers and three RabbitMQ nodes; RabbitMQ workload queues use durable quorum queues. Kafka
uses replication factor 3/minimum ISR 2, while RabbitMQ publishers use confirms and consumers use
manual acknowledgements.

Required configuration groups:

- `KAFKA_BOOTSTRAP_SERVERS`, security protocol/SASL/TLS settings, client ID, topic prefix,
  producer acknowledgement/compression limits and consumer group IDs.
- `RABBITMQ_URL`, TLS/credential settings, exchange/queue prefix, publisher-confirm timeout,
  prefetch, retry TTLs and DLQ names.
- Per-environment topic retention, message-size ceilings, queue length/age ceilings and disk-watermark
  alerts. Production secrets come from the deployment secret manager, never committed `.env` files.

Retry delays use explicit TTL retry queues dead-lettering back to the work queue, avoiding a
mandatory delayed-message plugin. Quorum queues protect accepted jobs across a node loss; they do
not replace idempotent workers or a tested backup/restore procedure.

#### Broker acceptance tests

- [ ] Replaying the same client batch 100 times produces one logical heartbeat/AI/usage fact per
      stable event ID.
- [ ] Killing a Kafka consumer after ClickHouse insert but before offset commit replays safely and
      leaves projections unchanged.
- [ ] Pausing ClickHouse causes Kafka lag to grow without losing accepted events; resuming it
      drains the backlog and reconciles exactly.
- [ ] Records for one user remain ordered; high traffic from one user does not block unrelated
      partitions beyond measured capacity limits.
- [ ] An incompatible schema, oversized payload or prohibited privacy field is rejected before
      broker publication.
- [ ] Repeating a RabbitMQ request with the same idempotency key returns the same job identity and
      executes the expensive operation at most once logically.
- [ ] Worker crashes cause bounded retry, then success or DLQ; no job is silently acknowledged.
- [ ] A failed projection reconciliation never publishes its `data_version` and the prior version
      remains readable.
- [ ] Kafka, RabbitMQ, worker and ClickHouse restart scenarios expose controlled health/lag status
      without leaking broker details to public API callers.
- [ ] Broker storage, logs and DLQs contain no prompts, responses, transcripts, patches, source
      code, raw absolute paths or authentication secrets.

---

## Testing Strategy (TDD per CLAUDE.md)

| Layer | Tool | Coverage |
|-------|------|----------|
| Unit (Rust) | `cargo test` | Heartbeat validation, config, dedup, AST detection accuracy, duration calc, project rule regex |
| Integration (Rust) | `assert_cmd` | CLI end-to-end, `axum::test` for server routes, real SQLite for offline queue |
| Integration (Server) | Docker ClickHouse | MV aggregation, ReplicatedSummingMergeTree correctness, Null engine reprocessing |
| Integration (Brokers) | Testcontainers/Docker Kafka + RabbitMQ + ClickHouse | Producer acknowledgement, consumer restart/replay, offset commit ordering, publisher confirms, retry/DLQ and idempotent ClickHouse effects |
| Unit (TypeScript) | Vitest | VS Code heartbeat buffer/flush timing, Figma rate limiting, dedup |
| Unit (Python) | pytest | Blender event queue, CLI delegation, handler registration |
| E2E telemetry | Full roundtrip | CLI → ingest API → Kafka → ClickHouse consumer → projection publish → analytics API |
| E2E jobs | Full roundtrip | Maintenance API → RabbitMQ → reprocess/rebuild worker → reconciled `data_version` → job status |

---

## Verification

1. `cargo test --workspace` — all Rust tests pass
2. `cargo build --workspace --release` — all binaries compile
3. `docker compose up -d` — start ClickHouse, Kafka and RabbitMQ with health checks
4. Verify Kafka topics/ACLs, RabbitMQ exchanges/queues/DLQ and empty initial consumer lag
5. Start Kafka fact/projection consumers and RabbitMQ session/reprocess/rebuild workers
6. `cargo run -p wakaclock-server` — starts, runs migrations and connects to all required services
7. `cargo run -p wakaclock-cli -- heartbeat --entity ./test.rs --write`
8. Verify the event is acknowledged by Kafka, consumed once logically and visible in ClickHouse
9. `curl localhost:3030/api/v1/status_bar/today -H "Authorization: Basic <key>"`
10. Submit a dry-run reprocess request, observe RabbitMQ job status and verify DLQ remains empty
11. Restart one consumer/worker and replay the same event/job IDs; totals and published version do
    not change
12. VS Code: install extension, open file, verify status bar shows time

---

## Critical Reference Files

- `screenshot/backend/board-backend/src/repositories/ch_client.rs` — ChClient pattern
- `screenshot/backend/board-backend/Cargo.toml` — dependency versions
- `screenshot/backend/board-backend/docker-compose.yml` — ClickHouse docker
- `wakaclock/wakatime-api-routes.json` — all WakaTime API routes

---

## Phase 10 — Feature-parity implementation ledger (2026-08-23)

The executable compatibility source of truth is now split into two machine-readable files:

- `docs/phase-10-feature-matrix.json` — product capability status and owner-facing release state.
- `docs/wakatime-compatibility-manifest.json` — WakaTime v1 route patterns, auth/envelope defaults
  and known compatibility status.

Implemented slices in the current backend:

- PostgreSQL transactional foundation with UUIDv7 identity, personal organizations, role/seat
  membership, encrypted credential containers, OAuth apps/tokens/PKCE/device flow, exports,
  profiles/share links, reports, leaderboards, billing summaries, SSO configuration and SCIM
  token/user/group provisioning.
- ClickHouse telemetry expansion for VCS provenance, feature/dependency dimensions, AI token
  metadata and rebuildable daily projections. Unknown provider fields remain nullable and are
  accompanied by coverage metadata.
- WakaTime v1 aliases for core analytics, data dumps, external durations, goals, heartbeats
  (including bulk delete), metadata/catalog routes, machine/user-agent discovery, custom rules,
  organizations and private leaderboards.
- AtoAxis v2 contracts for integrations, repositories/commits/pull requests, organization
  administration, SSO/SCIM administration, goals, exports, AI effectiveness and sharing.
- Privacy-first browser/desktop tracker policy scaffolds and AI follow-up line-ownership ledger;
  raw source, prompts, responses and diffs are not persisted by the telemetry contract. Transcript
  project hints are reduced to one bounded final path component before serialization, with a
  regression test covering Unix absolute paths.
- The release workflow builds the nested Rust workspace through `backend/api/Cargo.toml`, so the
  stale root workspace manifest cannot accidentally select missing legacy crate paths.

Still intentionally beta/partial and therefore not marked production-ready in the matrix:

- Kafka/RabbitMQ consumers and the object-storage export worker (the API creates durable jobs,
  but signed artifact URLs require the deployment worker).
- Provider-specific GitHub/GitLab/Bitbucket/calendar sync workers and full head-revision activity
  attribution; metadata ingestion and idempotent storage contracts are present.
- Native packaged desktop clients, browser store release artifacts and a 600+ language Linguist
  registry; the shared privacy core and current registry are the compatibility baseline.
- Complete seven-day human-follow-up denominator, leaderboard ranking snapshots, Stripe webhook
  reconciliation, and live OIDC/SAML test-login callbacks.

Every rollout must keep the feature flag, migration/reconciliation runbook and rollback path
described in the Phase 10 request. A capability must not be advertised as production-ready until
its worker, privacy, tenant-isolation and end-to-end acceptance tests exist.
