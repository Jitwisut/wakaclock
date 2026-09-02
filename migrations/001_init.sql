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
    project_id      Nullable(UUID),
    branch          Nullable(String),
    head_revision   Nullable(String),
    repository_id   Nullable(UUID),
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
    machine_name_hash Nullable(String),
    hostname_hash   Nullable(String),
    timezone        Nullable(String),
    feature_id      Nullable(String),
    feature_name    Nullable(String),

    -- Wakaclock additions: AST detection
    ast_language    Nullable(String),
    ast_confidence  Nullable(Float32),

    -- Keystroke tracking
    keystrokes      Nullable(UInt32),
    chars_added     Nullable(UInt32),
    chars_deleted   Nullable(UInt32),
    active_seconds  Nullable(Float64),
    active_seconds_claimed Nullable(Float64),
    activity_segments String DEFAULT '[]',

    -- AI agent tracking
    is_ai_generated Bool DEFAULT false,
    ai_agent        Nullable(String),
    ai_provider     Nullable(String),
    ai_model        Nullable(String),
    ai_source       Nullable(String),
    ai_confidence   Nullable(String),
    ai_event_id     Nullable(String),
    ai_change_id    Nullable(String),
    prompt_character_count Nullable(UInt64),
    input_tokens    Nullable(UInt64),
    output_tokens   Nullable(UInt64),
    cache_read_tokens Nullable(UInt64),
    cache_write_tokens Nullable(UInt64),
    ai_subscription_plan Nullable(String),
    token_source    Nullable(String),
    attribution_source Nullable(String),
    attribution_confidence Nullable(Float32),
    ai_event_fingerprint Nullable(String),
    ai_lines_added  Nullable(UInt32),
    ai_lines_deleted Nullable(UInt32),
    human_lines_added Nullable(UInt32),
    human_lines_deleted Nullable(UInt32),
    unattributed_lines_added Nullable(UInt32),
    unattributed_lines_deleted Nullable(UInt32),

    -- Canonical attribution. Legacy is_ai_generated remains a compatibility field;
    -- readers must use actor_type so missing AI metadata is not treated as Human.
    actor_type      LowCardinality(String) DEFAULT multiIf(
        (
            is_ai_generated = 1
            OR ifNull(ai_agent, '') != ''
            OR ifNull(ai_event_id, '') != ''
            OR coalesce(ai_lines_added, 0) > 0
            OR coalesce(ai_lines_deleted, 0) > 0
            OR lower(ifNull(ai_source, '')) IN ('agent_hook', 'mcp')
            ) AND (
            lower(ifNull(ai_confidence, '')) = 'verified'
            OR lower(ifNull(ai_source, '')) IN ('agent_hook', 'mcp')
        ), 'ai_verified',
        is_ai_generated = 1
            OR ifNull(ai_agent, '') != ''
            OR ifNull(ai_event_id, '') != ''
            OR coalesce(ai_lines_added, 0) > 0
            OR coalesce(ai_lines_deleted, 0) > 0
            OR lower(ifNull(ai_source, '')) IN ('agent_hook', 'mcp'), 'ai_inferred',
        coalesce(human_lines_added, 0) > 0
            OR coalesce(human_lines_deleted, 0) > 0
            OR coalesce(keystrokes, 0) > 0
            OR coalesce(chars_added, 0) > 0
            OR coalesce(chars_deleted, 0) > 0, 'human',
        'unknown'
    ),
    actor_confidence Float32 DEFAULT multiIf(
        actor_type = 'human', 1.0,
        actor_type = 'ai_verified' AND lower(ifNull(ai_source, '')) = 'mcp', 0.95,
        actor_type = 'ai_verified', 1.0,
        actor_type = 'ai_inferred' AND lower(ifNull(ai_confidence, '')) = 'correlated', 0.8,
        actor_type = 'ai_inferred', 0.6,
        0.0
    ),

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

-- Canonical measured intervals. This projection is additive and can be rebuilt from
-- raw heartbeats; actor_type is carried explicitly so an absent legacy boolean never
-- turns an interval into Human time.
CREATE TABLE IF NOT EXISTS wakaclock.activity_intervals
(
    user_id          UUID,
    segment_id       String,
    heartbeat_id     String,
    `start`          Float64,
    `end`            Float64,
    source           String,
    entity           String,
    project          Nullable(String),
    project_id       Nullable(UUID),
    branch           Nullable(String),
    language         Nullable(String),
    category         String,
    editor           String DEFAULT '',
    operating_system String DEFAULT '',
    created_at       UInt32,
    actor_type       LowCardinality(String) DEFAULT multiIf(
        source = 'ai', 'ai_inferred',
        source = 'editor', 'human',
        'unknown'
    ),
    actor_confidence Float32 DEFAULT 0.0
)
ENGINE = ReplacingMergeTree(created_at)
ORDER BY (user_id, segment_id);


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
-- 2b. Actor-aware attribution daily rollup (additive replacement for ai_daily)
-- ============================================================
-- Keep the legacy boolean-keyed ai_daily table below for existing readers. New
-- attribution reports use this dimensioned rollup so verified, inferred and unknown
-- facts cannot collapse into one boolean bucket.
CREATE TABLE IF NOT EXISTS wakaclock.actor_daily_v2
(
    user_id             UUID,
    date                Date,
    actor_type          LowCardinality(String),
    ai_agent            String,
    ai_provider         String,
    ai_model            String,
    ai_lines_added      UInt64,
    ai_lines_deleted    UInt64,
    human_lines_added   UInt64,
    human_lines_deleted UInt64,
    unknown_lines_added UInt64,
    unknown_lines_deleted UInt64,
    human_keystrokes    UInt64,
    human_chars_added   UInt64,
    heartbeat_count     UInt64
)
ENGINE = SummingMergeTree((ai_lines_added, ai_lines_deleted, human_lines_added,
    human_lines_deleted, unknown_lines_added, unknown_lines_deleted,
    human_keystrokes, human_chars_added, heartbeat_count))
ORDER BY (user_id, date, actor_type, ai_agent, ai_provider, ai_model);

CREATE TABLE IF NOT EXISTS wakaclock.actor_daily_v2_backfill_state
(
    migration    String,
    completed_at DateTime64(3)
)
ENGINE = ReplacingMergeTree(completed_at)
ORDER BY migration;


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
    api_key    String,              -- SHA-256 hash used for authentication
    api_key_plain String DEFAULT '', -- retrievable value for the authenticated dashboard
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
    sumIf(coalesce(ai_lines_added, 0), actor_type IN ('ai_verified', 'ai_inferred')) AS ai_lines_added,
    sumIf(coalesce(ai_lines_deleted, 0), actor_type IN ('ai_verified', 'ai_inferred')) AS ai_lines_deleted,
    sumIf(coalesce(human_lines_added, 0), actor_type = 'human') AS human_lines_added,
    sumIf(coalesce(human_lines_deleted, 0), actor_type = 'human') AS human_lines_deleted,
    sumIf(coalesce(keystrokes, 0), actor_type = 'human') AS human_keystrokes,
    sumIf(coalesce(chars_added, 0), actor_type = 'human') AS human_chars_added,
    count() AS heartbeat_count
FROM wakaclock.heartbeats
GROUP BY user_id, date, ai_agent;

-- MV: actor_daily_v2
CREATE MATERIALIZED VIEW IF NOT EXISTS wakaclock.mv_actor_summary_v2
TO wakaclock.actor_daily_v2 AS
SELECT
    user_id,
    date,
    actor_type,
    if(actor_type IN ('ai_verified', 'ai_inferred'), ifNull(ai_agent, ''), '') AS ai_agent,
    if(actor_type IN ('ai_verified', 'ai_inferred'), ifNull(ai_provider, ''), '') AS ai_provider,
    if(actor_type IN ('ai_verified', 'ai_inferred'), ifNull(ai_model, ''), '') AS ai_model,
    sumIf(toUInt64(ifNull(ai_lines_added, 0)), actor_type IN ('ai_verified', 'ai_inferred')) AS ai_lines_added,
    sumIf(toUInt64(ifNull(ai_lines_deleted, 0)), actor_type IN ('ai_verified', 'ai_inferred')) AS ai_lines_deleted,
    sumIf(toUInt64(ifNull(human_lines_added, 0)), actor_type = 'human') AS human_lines_added,
    sumIf(toUInt64(ifNull(human_lines_deleted, 0)), actor_type = 'human') AS human_lines_deleted,
    sum(toUInt64(ifNull(unattributed_lines_added, 0)))
        + sumIf(toUInt64(ifNull(h.ai_lines_added, 0) + ifNull(h.human_lines_added, 0)), actor_type = 'unknown') AS unknown_lines_added,
    sum(toUInt64(ifNull(unattributed_lines_deleted, 0)))
        + sumIf(toUInt64(ifNull(h.ai_lines_deleted, 0) + ifNull(h.human_lines_deleted, 0)), actor_type = 'unknown') AS unknown_lines_deleted,
    sumIf(toUInt64(ifNull(keystrokes, 0)), actor_type = 'human') AS human_keystrokes,
    sumIf(toUInt64(ifNull(chars_added, 0)), actor_type = 'human') AS human_chars_added,
    count() AS heartbeat_count
FROM wakaclock.heartbeats AS h
GROUP BY user_id, date, actor_type, ai_agent, ai_provider, ai_model;

-- MV: keystroke_daily
CREATE MATERIALIZED VIEW IF NOT EXISTS wakaclock.mv_keystroke_summary
TO wakaclock.keystroke_daily AS
SELECT
    user_id,
    date,
    coalesce(project, 'Unknown') AS project,
    sumIf(coalesce(keystrokes, 0), actor_type = 'human')    AS keystrokes,
    sumIf(coalesce(chars_added, 0), actor_type = 'human')   AS chars_added,
    sumIf(coalesce(chars_deleted, 0), actor_type = 'human') AS chars_deleted,
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
       sumIf(coalesce(ai_lines_added, 0), actor_type IN ('ai_verified', 'ai_inferred')) AS ai_lines_added,
       sumIf(coalesce(ai_lines_deleted, 0), actor_type IN ('ai_verified', 'ai_inferred')) AS ai_lines_deleted,
       sumIf(coalesce(human_lines_added, 0), actor_type = 'human') AS human_lines_added,
       sumIf(coalesce(human_lines_deleted, 0), actor_type = 'human') AS human_lines_deleted,
       sumIf(coalesce(keystrokes, 0), actor_type = 'human') AS human_keystrokes,
       sumIf(coalesce(chars_added, 0), actor_type = 'human') AS human_chars_added,
       count() AS heartbeat_count
FROM wakaclock.heartbeats_incoming GROUP BY user_id, date, ai_agent;

CREATE MATERIALIZED VIEW IF NOT EXISTS wakaclock.mv_inc_actor_summary_v2
TO wakaclock.actor_daily_v2 AS
SELECT
    user_id,
    date,
    actor_type,
    if(actor_type IN ('ai_verified', 'ai_inferred'), ifNull(ai_agent, ''), '') AS ai_agent,
    if(actor_type IN ('ai_verified', 'ai_inferred'), ifNull(ai_provider, ''), '') AS ai_provider,
    if(actor_type IN ('ai_verified', 'ai_inferred'), ifNull(ai_model, ''), '') AS ai_model,
    sumIf(toUInt64(ifNull(ai_lines_added, 0)), actor_type IN ('ai_verified', 'ai_inferred')) AS ai_lines_added,
    sumIf(toUInt64(ifNull(ai_lines_deleted, 0)), actor_type IN ('ai_verified', 'ai_inferred')) AS ai_lines_deleted,
    sumIf(toUInt64(ifNull(human_lines_added, 0)), actor_type = 'human') AS human_lines_added,
    sumIf(toUInt64(ifNull(human_lines_deleted, 0)), actor_type = 'human') AS human_lines_deleted,
    sum(toUInt64(ifNull(unattributed_lines_added, 0)))
        + sumIf(toUInt64(ifNull(h.ai_lines_added, 0) + ifNull(h.human_lines_added, 0)), actor_type = 'unknown') AS unknown_lines_added,
    sum(toUInt64(ifNull(unattributed_lines_deleted, 0)))
        + sumIf(toUInt64(ifNull(h.ai_lines_deleted, 0) + ifNull(h.human_lines_deleted, 0)), actor_type = 'unknown') AS unknown_lines_deleted,
    sumIf(toUInt64(ifNull(keystrokes, 0)), actor_type = 'human') AS human_keystrokes,
    sumIf(toUInt64(ifNull(chars_added, 0)), actor_type = 'human') AS human_chars_added,
    count() AS heartbeat_count
FROM wakaclock.heartbeats_incoming AS h
GROUP BY user_id, date, actor_type, ai_agent, ai_provider, ai_model;

CREATE MATERIALIZED VIEW IF NOT EXISTS wakaclock.mv_inc_keystroke_summary
TO wakaclock.keystroke_daily AS
SELECT user_id, date, coalesce(project, 'Unknown') AS project,
       sumIf(coalesce(keystrokes, 0), actor_type = 'human') AS keystrokes,
       sumIf(coalesce(chars_added, 0), actor_type = 'human') AS chars_added,
       sumIf(coalesce(chars_deleted, 0), actor_type = 'human') AS chars_deleted,
       count() AS heartbeat_count
FROM wakaclock.heartbeats_incoming GROUP BY user_id, date, project;
