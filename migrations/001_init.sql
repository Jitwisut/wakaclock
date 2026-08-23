-- Wakaclock ClickHouse Schema (dev mode — MergeTree, no replication)
-- Migration: 001_init.sql

CREATE DATABASE IF NOT EXISTS wakaclock;

-- ============================================================
-- 1. Raw heartbeats (stores all heartbeats, queryable)
-- ============================================================
CREATE TABLE IF NOT EXISTS wakaclock.heartbeats
(
    user_id         UUID,
    entity          String,
    entity_type     Enum8('file' = 0, 'domain' = 1, 'url' = 2, 'app' = 3),
    time            Float64,                    -- Unix epoch with ms precision
    date            Date DEFAULT toDate(toDateTime(toUInt32(time))),
    project         Nullable(String),
    branch          Nullable(String),
    language        Nullable(String),
    dependencies    Array(String),
    `lines`         Nullable(UInt32),
    line_number     Nullable(UInt32),
    cursor_position Nullable(UInt32),
    is_write        Bool DEFAULT false,
    category        Enum8('coding' = 0, 'building' = 1, 'debugging' = 2, 'designing' = 3, 'modeling' = 4, 'meeting' = 5, 'communicating' = 6, 'browsing' = 7),
    editor          String DEFAULT '',
    operating_system String DEFAULT '',
    machine         String DEFAULT '',
    user_agent      String DEFAULT '',

    -- Wakaclock additions: AST detection
    ast_language    Nullable(String),
    ast_confidence  Nullable(Float32),

    -- Keystroke tracking
    keystrokes      Nullable(UInt32),
    chars_added     Nullable(UInt32),
    chars_deleted   Nullable(UInt32),
    active_seconds  Nullable(Float64),

    -- AI agent tracking
    is_ai_generated Bool DEFAULT false,
    ai_agent        Nullable(String),
    ai_provider     Nullable(String),
    ai_model        Nullable(String),
    ai_source       Nullable(String),
    ai_confidence   Nullable(String),
    ai_event_id     Nullable(String),
    ai_lines_added  Nullable(UInt32),
    ai_lines_deleted Nullable(UInt32),
    human_lines_added Nullable(UInt32),
    human_lines_deleted Nullable(UInt32),

    -- Metadata
    created_at      DateTime64(3) DEFAULT now64(3)
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (user_id, date, time)
TTL date + INTERVAL 2 YEAR;


-- ============================================================
-- 1b. Null engine for reprocessing / import (data discarded after MVs)
-- ============================================================
CREATE TABLE IF NOT EXISTS wakaclock.heartbeats_incoming AS wakaclock.heartbeats
ENGINE = Null;


-- ============================================================
-- 2. Daily totals (SummingMergeTree)
-- ============================================================
CREATE TABLE IF NOT EXISTS wakaclock.daily_totals
(
    user_id         UUID,
    date            Date,
    total_seconds   Float64,
    heartbeat_count UInt64
)
ENGINE = SummingMergeTree((total_seconds, heartbeat_count))
ORDER BY (user_id, date);


-- ============================================================
-- 3. Language daily (SummingMergeTree)
-- ============================================================
CREATE TABLE IF NOT EXISTS wakaclock.language_daily
(
    user_id         UUID,
    date            Date,
    language        String,
    total_seconds   Float64,
    heartbeat_count UInt64
)
ENGINE = SummingMergeTree((total_seconds, heartbeat_count))
ORDER BY (user_id, date, language);


-- ============================================================
-- 4. Project daily (SummingMergeTree)
-- ============================================================
CREATE TABLE IF NOT EXISTS wakaclock.project_daily
(
    user_id         UUID,
    date            Date,
    project         String,
    total_seconds   Float64,
    heartbeat_count UInt64
)
ENGINE = SummingMergeTree((total_seconds, heartbeat_count))
ORDER BY (user_id, date, project);


-- ============================================================
-- 5. Editor daily (SummingMergeTree)
-- ============================================================
CREATE TABLE IF NOT EXISTS wakaclock.editor_daily
(
    user_id         UUID,
    date            Date,
    editor          String,
    total_seconds   Float64,
    heartbeat_count UInt64
)
ENGINE = SummingMergeTree((total_seconds, heartbeat_count))
ORDER BY (user_id, date, editor);


-- ============================================================
-- 6. OS daily (SummingMergeTree)
-- ============================================================
CREATE TABLE IF NOT EXISTS wakaclock.os_daily
(
    user_id         UUID,
    date            Date,
    os              String,
    total_seconds   Float64,
    heartbeat_count UInt64
)
ENGINE = SummingMergeTree((total_seconds, heartbeat_count))
ORDER BY (user_id, date, os);


-- ============================================================
-- 7. Insights aggregate (AggregatingMergeTree)
-- ============================================================
CREATE TABLE IF NOT EXISTS wakaclock.insights_agg
(
    user_id         UUID,
    date            Date,
    language        String,
    project         String,
    editor          String,
    os              String,
    branch          String,
    total_seconds   SimpleAggregateFunction(sum, Float64),
    heartbeat_count SimpleAggregateFunction(sum, UInt64),
    unique_days     AggregateFunction(uniq, Date)
)
ENGINE = AggregatingMergeTree()
ORDER BY (user_id, date, language, project);


-- ============================================================
-- 8. Project rules (ReplacingMergeTree — user-defined regex rules)
-- ============================================================
CREATE TABLE IF NOT EXISTS wakaclock.project_rules
(
    user_id      UUID,
    rule_id      UUID,
    pattern      String,           -- Rust regex pattern
    project_name String,           -- Resolved project name on match
    priority     Int32 DEFAULT 0,  -- Higher = checked first
    is_active    Bool DEFAULT true,
    created_at   DateTime64(3) DEFAULT now64(3),
    updated_at   DateTime64(3) DEFAULT now64(3)
)
ENGINE = ReplacingMergeTree(updated_at)
ORDER BY (user_id, priority, rule_id);


-- ============================================================
-- 9. Project merges (ReplacingMergeTree — read-time merge mapping)
-- ============================================================
CREATE TABLE IF NOT EXISTS wakaclock.project_merges
(
    user_id         UUID,
    merge_id        UUID,
    source_project  String,
    target_project  String,
    created_at      DateTime64(3) DEFAULT now64(3),
    updated_at      DateTime64(3) DEFAULT now64(3)
)
ENGINE = ReplacingMergeTree(updated_at)
ORDER BY (user_id, source_project);


-- ============================================================
-- 10. Projects metadata (ReplacingMergeTree)
-- ============================================================
CREATE TABLE IF NOT EXISTS wakaclock.projects
(
    user_id             UUID,
    name                String,
    repository          String DEFAULT '',
    last_heartbeat_at   DateTime64(3) DEFAULT now64(3),
    created_at          DateTime64(3) DEFAULT now64(3)
)
ENGINE = ReplacingMergeTree(last_heartbeat_at)
ORDER BY (user_id, name);


-- ============================================================
-- 11. Sync state (ReplacingMergeTree)
-- ============================================================
CREATE TABLE IF NOT EXISTS wakaclock.sync_state
(
    user_id        UUID,
    resource       String,
    last_synced_at DateTime64(3),
    cursor         String DEFAULT ''
)
ENGINE = ReplacingMergeTree(last_synced_at)
ORDER BY (user_id, resource);


-- ============================================================
-- 12. AI daily (SummingMergeTree)
-- ============================================================
CREATE TABLE IF NOT EXISTS wakaclock.ai_daily
(
    user_id          UUID,
    date             Date,
    ai_agent         String,
    ai_lines_added   UInt64,
    ai_lines_deleted UInt64,
    human_lines_added UInt64,
    human_lines_deleted UInt64,
    human_keystrokes UInt64,
    human_chars_added UInt64,
    heartbeat_count  UInt64
)
ENGINE = SummingMergeTree((ai_lines_added, ai_lines_deleted, human_lines_added, human_lines_deleted, human_keystrokes, human_chars_added, heartbeat_count))
ORDER BY (user_id, date, ai_agent);


-- ============================================================
-- 13. Keystroke daily (SummingMergeTree)
-- ============================================================
CREATE TABLE IF NOT EXISTS wakaclock.keystroke_daily
(
    user_id         UUID,
    date            Date,
    project         String,
    keystrokes      UInt64,
    chars_added     UInt64,
    chars_deleted   UInt64,
    heartbeat_count UInt64
)
ENGINE = SummingMergeTree((keystrokes, chars_added, chars_deleted, heartbeat_count))
ORDER BY (user_id, date, project);


-- ============================================================
-- 14. Users / Auth (ReplacingMergeTree)
-- ============================================================
CREATE TABLE IF NOT EXISTS wakaclock.users
(
    user_id    UUID,
    username   String,
    email      String DEFAULT '',
    api_key    String,              -- hashed API key
    is_active  Bool DEFAULT true,
    created_at DateTime64(3) DEFAULT now64(3),
    updated_at DateTime64(3) DEFAULT now64(3)
)
ENGINE = ReplacingMergeTree(updated_at)
ORDER BY (user_id);


-- ============================================================
-- MATERIALIZED VIEWS — Path A: Live Ingestion (from heartbeats)
-- ============================================================

-- MV: daily_totals
CREATE MATERIALIZED VIEW IF NOT EXISTS wakaclock.mv_daily_summary
TO wakaclock.daily_totals AS
SELECT
    user_id,
    date,
    count() AS heartbeat_count,
    sum(ifNull(active_seconds, 0.0)) AS total_seconds
FROM wakaclock.heartbeats
GROUP BY user_id, date;

-- MV: language_daily
CREATE MATERIALIZED VIEW IF NOT EXISTS wakaclock.mv_lang_summary
TO wakaclock.language_daily AS
SELECT
    user_id,
    date,
    coalesce(ast_language, language, 'Unknown') AS language,
    count() AS heartbeat_count,
    sum(ifNull(active_seconds, 0.0)) AS total_seconds
FROM wakaclock.heartbeats
GROUP BY user_id, date, language;

-- MV: project_daily
CREATE MATERIALIZED VIEW IF NOT EXISTS wakaclock.mv_project_summary
TO wakaclock.project_daily AS
SELECT
    user_id,
    date,
    coalesce(project, 'Unknown') AS project,
    count() AS heartbeat_count,
    sum(ifNull(active_seconds, 0.0)) AS total_seconds
FROM wakaclock.heartbeats
GROUP BY user_id, date, project;

-- MV: editor_daily
CREATE MATERIALIZED VIEW IF NOT EXISTS wakaclock.mv_editor_summary
TO wakaclock.editor_daily AS
SELECT
    user_id,
    date,
    editor,
    count() AS heartbeat_count,
    sum(ifNull(active_seconds, 0.0)) AS total_seconds
FROM wakaclock.heartbeats
GROUP BY user_id, date, editor;

-- MV: os_daily
CREATE MATERIALIZED VIEW IF NOT EXISTS wakaclock.mv_os_summary
TO wakaclock.os_daily AS
SELECT
    user_id,
    date,
    operating_system AS os,
    count() AS heartbeat_count,
    sum(ifNull(active_seconds, 0.0)) AS total_seconds
FROM wakaclock.heartbeats
GROUP BY user_id, date, os;

-- MV: insights_agg
CREATE MATERIALIZED VIEW IF NOT EXISTS wakaclock.mv_insights_agg
TO wakaclock.insights_agg AS
SELECT
    user_id,
    date,
    coalesce(ast_language, language, 'Unknown') AS language,
    coalesce(project, 'Unknown') AS project,
    editor,
    operating_system AS os,
    coalesce(branch, '') AS branch,
    sum(ifNull(active_seconds, 0.0)) AS total_seconds,
    count()          AS heartbeat_count,
    uniqState(date)  AS unique_days
FROM wakaclock.heartbeats
GROUP BY user_id, date, language, project, editor, os, branch;

-- MV: ai_daily
CREATE MATERIALIZED VIEW IF NOT EXISTS wakaclock.mv_ai_summary
TO wakaclock.ai_daily AS
SELECT
    user_id,
    date,
    coalesce(ai_agent, 'human') AS ai_agent,
    sum(coalesce(ai_lines_added, 0))  AS ai_lines_added,
    sum(coalesce(ai_lines_deleted, 0)) AS ai_lines_deleted,
    sumIf(coalesce(human_lines_added, 0), NOT is_ai_generated) AS human_lines_added,
    sumIf(coalesce(human_lines_deleted, 0), NOT is_ai_generated) AS human_lines_deleted,
    sumIf(coalesce(keystrokes, 0), NOT is_ai_generated) AS human_keystrokes,
    sumIf(coalesce(chars_added, 0), NOT is_ai_generated) AS human_chars_added,
    count() AS heartbeat_count
FROM wakaclock.heartbeats
GROUP BY user_id, date, ai_agent;

-- MV: keystroke_daily
CREATE MATERIALIZED VIEW IF NOT EXISTS wakaclock.mv_keystroke_summary
TO wakaclock.keystroke_daily AS
SELECT
    user_id,
    date,
    coalesce(project, 'Unknown') AS project,
    sum(coalesce(keystrokes, 0))    AS keystrokes,
    sum(coalesce(chars_added, 0))   AS chars_added,
    sum(coalesce(chars_deleted, 0)) AS chars_deleted,
    count() AS heartbeat_count
FROM wakaclock.heartbeats
GROUP BY user_id, date, project;


-- ============================================================
-- MATERIALIZED VIEWS — Path B: Reprocessing (from heartbeats_incoming → Null)
-- Same target tables, same logic, different source.
-- ============================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS wakaclock.mv_inc_daily_summary
TO wakaclock.daily_totals AS
SELECT user_id, date, count() AS heartbeat_count, sum(ifNull(active_seconds, 0.0)) AS total_seconds
FROM wakaclock.heartbeats_incoming GROUP BY user_id, date;

CREATE MATERIALIZED VIEW IF NOT EXISTS wakaclock.mv_inc_lang_summary
TO wakaclock.language_daily AS
SELECT user_id, date, coalesce(ast_language, language, 'Unknown') AS language,
       count() AS heartbeat_count, sum(ifNull(active_seconds, 0.0)) AS total_seconds
FROM wakaclock.heartbeats_incoming GROUP BY user_id, date, language;

CREATE MATERIALIZED VIEW IF NOT EXISTS wakaclock.mv_inc_project_summary
TO wakaclock.project_daily AS
SELECT user_id, date, coalesce(project, 'Unknown') AS project,
       count() AS heartbeat_count, sum(ifNull(active_seconds, 0.0)) AS total_seconds
FROM wakaclock.heartbeats_incoming GROUP BY user_id, date, project;

CREATE MATERIALIZED VIEW IF NOT EXISTS wakaclock.mv_inc_editor_summary
TO wakaclock.editor_daily AS
SELECT user_id, date, editor, count() AS heartbeat_count, sum(ifNull(active_seconds, 0.0)) AS total_seconds
FROM wakaclock.heartbeats_incoming GROUP BY user_id, date, editor;

CREATE MATERIALIZED VIEW IF NOT EXISTS wakaclock.mv_inc_os_summary
TO wakaclock.os_daily AS
SELECT user_id, date, operating_system AS os, count() AS heartbeat_count, sum(ifNull(active_seconds, 0.0)) AS total_seconds
FROM wakaclock.heartbeats_incoming GROUP BY user_id, date, os;

CREATE MATERIALIZED VIEW IF NOT EXISTS wakaclock.mv_inc_insights_agg
TO wakaclock.insights_agg AS
SELECT user_id, date, coalesce(ast_language, language, 'Unknown') AS language,
       coalesce(project, 'Unknown') AS project, editor, operating_system AS os,
       coalesce(branch, '') AS branch, sum(ifNull(active_seconds, 0.0)) AS total_seconds,
       count() AS heartbeat_count, uniqState(date) AS unique_days
FROM wakaclock.heartbeats_incoming GROUP BY user_id, date, language, project, editor, os, branch;

CREATE MATERIALIZED VIEW IF NOT EXISTS wakaclock.mv_inc_ai_summary
TO wakaclock.ai_daily AS
SELECT user_id, date, coalesce(ai_agent, 'human') AS ai_agent,
       sum(coalesce(ai_lines_added, 0)) AS ai_lines_added,
       sum(coalesce(ai_lines_deleted, 0)) AS ai_lines_deleted,
       sumIf(coalesce(human_lines_added, 0), NOT is_ai_generated) AS human_lines_added,
       sumIf(coalesce(human_lines_deleted, 0), NOT is_ai_generated) AS human_lines_deleted,
       sumIf(coalesce(keystrokes, 0), NOT is_ai_generated) AS human_keystrokes,
       sumIf(coalesce(chars_added, 0), NOT is_ai_generated) AS human_chars_added,
       count() AS heartbeat_count
FROM wakaclock.heartbeats_incoming GROUP BY user_id, date, ai_agent;

CREATE MATERIALIZED VIEW IF NOT EXISTS wakaclock.mv_inc_keystroke_summary
TO wakaclock.keystroke_daily AS
SELECT user_id, date, coalesce(project, 'Unknown') AS project,
       sum(coalesce(keystrokes, 0)) AS keystrokes,
       sum(coalesce(chars_added, 0)) AS chars_added,
       sum(coalesce(chars_deleted, 0)) AS chars_deleted,
       count() AS heartbeat_count
FROM wakaclock.heartbeats_incoming GROUP BY user_id, date, project;
