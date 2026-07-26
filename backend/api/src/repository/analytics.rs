use anyhow::{Context, Result};
use std::sync::Arc;

use crate::infrastructure::database::ClickHouseClient;

/// สร้างตาราง aggregate ทั้งหมด (SummingMergeTree/AggregatingMergeTree) และ
/// Materialized Views ที่ ETL จาก wakaclock.heartbeats / heartbeats_incoming
pub struct AnalyticsRepository {
    client: Arc<ClickHouseClient>,
}

impl AnalyticsRepository {
    pub fn new(client: Arc<ClickHouseClient>) -> Self {
        Self { client }
    }

    pub async fn migrate(&self) -> Result<()> {
        let ch_client = self.client.get_client();

        for statement in STATEMENTS {
            ch_client
                .query(statement)
                .execute()
                .await
                .with_context(|| format!("Failed to execute analytics migration statement: {statement}"))?;
        }

        Ok(())
    }
}

const STATEMENTS: &[&str] = &[
    // ============================================================
    // Aggregate tables
    // ============================================================
    r#"
    CREATE TABLE IF NOT EXISTS wakaclock.daily_totals
    (
        user_id         UUID,
        date            Date,
        total_seconds   Float64,
        heartbeat_count UInt64
    )
    ENGINE = SummingMergeTree((total_seconds, heartbeat_count))
    ORDER BY (user_id, date)
    "#,
    r#"
    CREATE TABLE IF NOT EXISTS wakaclock.language_daily
    (
        user_id         UUID,
        date            Date,
        language        String,
        total_seconds   Float64,
        heartbeat_count UInt64
    )
    ENGINE = SummingMergeTree((total_seconds, heartbeat_count))
    ORDER BY (user_id, date, language)
    "#,
    r#"
    CREATE TABLE IF NOT EXISTS wakaclock.project_daily
    (
        user_id         UUID,
        date            Date,
        project         String,
        total_seconds   Float64,
        heartbeat_count UInt64
    )
    ENGINE = SummingMergeTree((total_seconds, heartbeat_count))
    ORDER BY (user_id, date, project)
    "#,
    r#"
    CREATE TABLE IF NOT EXISTS wakaclock.editor_daily
    (
        user_id         UUID,
        date            Date,
        editor          String,
        total_seconds   Float64,
        heartbeat_count UInt64
    )
    ENGINE = SummingMergeTree((total_seconds, heartbeat_count))
    ORDER BY (user_id, date, editor)
    "#,
    r#"
    CREATE TABLE IF NOT EXISTS wakaclock.os_daily
    (
        user_id         UUID,
        date            Date,
        os              String,
        total_seconds   Float64,
        heartbeat_count UInt64
    )
    ENGINE = SummingMergeTree((total_seconds, heartbeat_count))
    ORDER BY (user_id, date, os)
    "#,
    r#"
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
    ORDER BY (user_id, date, language, project)
    "#,
    r#"
    CREATE TABLE IF NOT EXISTS wakaclock.projects
    (
        user_id           UUID,
        name              String,
        repository        String DEFAULT '',
        last_heartbeat_at DateTime64(3) DEFAULT now64(3),
        created_at        DateTime64(3) DEFAULT now64(3)
    )
    ENGINE = ReplacingMergeTree(last_heartbeat_at)
    ORDER BY (user_id, name)
    "#,
    r#"
    CREATE TABLE IF NOT EXISTS wakaclock.sync_state
    (
        user_id        UUID,
        resource       String,
        last_synced_at DateTime64(3),
        cursor         String DEFAULT ''
    )
    ENGINE = ReplacingMergeTree(last_synced_at)
    ORDER BY (user_id, resource)
    "#,
    r#"
    CREATE TABLE IF NOT EXISTS wakaclock.ai_daily
    (
        user_id           UUID,
        date              Date,
        ai_agent          String,
        ai_lines_added    UInt64,
        ai_lines_deleted  UInt64,
        human_keystrokes  UInt64,
        human_chars_added UInt64,
        heartbeat_count   UInt64
    )
    ENGINE = SummingMergeTree((ai_lines_added, ai_lines_deleted, human_keystrokes, human_chars_added, heartbeat_count))
    ORDER BY (user_id, date, ai_agent)
    "#,
    r#"
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
    ORDER BY (user_id, date, project)
    "#,
    r#"
    CREATE TABLE IF NOT EXISTS wakaclock.users
    (
        user_id    UUID,
        username   String,
        email      String DEFAULT '',
        api_key    String,
        is_active  Bool DEFAULT true,
        created_at DateTime64(3) DEFAULT now64(3),
        updated_at DateTime64(3) DEFAULT now64(3)
    )
    ENGINE = ReplacingMergeTree(updated_at)
    ORDER BY (user_id)
    "#,
    // `CREATE TABLE IF NOT EXISTS` above is a no-op against a database that already has
    // `wakaclock.users` — this ALTER is what actually adds the column on existing installs.
    r#"
    ALTER TABLE wakaclock.users
    ADD COLUMN IF NOT EXISTS password_hash String DEFAULT ''
    "#,
    // ============================================================
    // Materialized Views — Path A: live ingestion (from heartbeats)
    // ============================================================
    r#"
    CREATE MATERIALIZED VIEW IF NOT EXISTS wakaclock.mv_daily_summary
    TO wakaclock.daily_totals AS
    SELECT
        user_id,
        date,
        count() AS heartbeat_count,
        sum(ifNull(active_seconds, 0.0)) AS total_seconds
    FROM wakaclock.heartbeats
    GROUP BY user_id, date
    "#,
    r#"
    CREATE MATERIALIZED VIEW IF NOT EXISTS wakaclock.mv_lang_summary
    TO wakaclock.language_daily AS
    SELECT
        user_id,
        date,
        coalesce(ast_language, language, 'Unknown') AS language,
        count() AS heartbeat_count,
        sum(ifNull(active_seconds, 0.0)) AS total_seconds
    FROM wakaclock.heartbeats
    GROUP BY user_id, date, language
    "#,
    r#"
    CREATE MATERIALIZED VIEW IF NOT EXISTS wakaclock.mv_project_summary
    TO wakaclock.project_daily AS
    SELECT
        user_id,
        date,
        coalesce(project, 'Unknown') AS project,
        count() AS heartbeat_count,
        sum(ifNull(active_seconds, 0.0)) AS total_seconds
    FROM wakaclock.heartbeats
    GROUP BY user_id, date, project
    "#,
    r#"
    CREATE MATERIALIZED VIEW IF NOT EXISTS wakaclock.mv_editor_summary
    TO wakaclock.editor_daily AS
    SELECT
        user_id,
        date,
        editor,
        count() AS heartbeat_count,
        sum(ifNull(active_seconds, 0.0)) AS total_seconds
    FROM wakaclock.heartbeats
    GROUP BY user_id, date, editor
    "#,
    r#"
    CREATE MATERIALIZED VIEW IF NOT EXISTS wakaclock.mv_os_summary
    TO wakaclock.os_daily AS
    SELECT
        user_id,
        date,
        operating_system AS os,
        count() AS heartbeat_count,
        sum(ifNull(active_seconds, 0.0)) AS total_seconds
    FROM wakaclock.heartbeats
    GROUP BY user_id, date, os
    "#,
    r#"
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
    GROUP BY user_id, date, language, project, editor, os, branch
    "#,
    r#"
    CREATE MATERIALIZED VIEW IF NOT EXISTS wakaclock.mv_ai_summary
    TO wakaclock.ai_daily AS
    SELECT
        user_id,
        date,
        coalesce(ai_agent, 'human') AS ai_agent,
        sum(coalesce(ai_lines_added, 0))  AS ai_lines_added,
        sum(coalesce(ai_lines_deleted, 0)) AS ai_lines_deleted,
        sumIf(coalesce(keystrokes, 0), NOT is_ai_generated) AS human_keystrokes,
        sumIf(coalesce(chars_added, 0), NOT is_ai_generated) AS human_chars_added,
        count() AS heartbeat_count
    FROM wakaclock.heartbeats
    GROUP BY user_id, date, ai_agent
    "#,
    r#"
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
    GROUP BY user_id, date, project
    "#,
    // ============================================================
    // Materialized Views — Path B: reprocessing (from heartbeats_incoming, Null engine)
    // ============================================================
    r#"
    CREATE MATERIALIZED VIEW IF NOT EXISTS wakaclock.mv_inc_daily_summary
    TO wakaclock.daily_totals AS
    SELECT user_id, date, count() AS heartbeat_count, sum(ifNull(active_seconds, 0.0)) AS total_seconds
    FROM wakaclock.heartbeats_incoming GROUP BY user_id, date
    "#,
    r#"
    CREATE MATERIALIZED VIEW IF NOT EXISTS wakaclock.mv_inc_lang_summary
    TO wakaclock.language_daily AS
    SELECT user_id, date, coalesce(ast_language, language, 'Unknown') AS language,
           count() AS heartbeat_count, sum(ifNull(active_seconds, 0.0)) AS total_seconds
    FROM wakaclock.heartbeats_incoming GROUP BY user_id, date, language
    "#,
    r#"
    CREATE MATERIALIZED VIEW IF NOT EXISTS wakaclock.mv_inc_project_summary
    TO wakaclock.project_daily AS
    SELECT user_id, date, coalesce(project, 'Unknown') AS project,
           count() AS heartbeat_count, sum(ifNull(active_seconds, 0.0)) AS total_seconds
    FROM wakaclock.heartbeats_incoming GROUP BY user_id, date, project
    "#,
    r#"
    CREATE MATERIALIZED VIEW IF NOT EXISTS wakaclock.mv_inc_editor_summary
    TO wakaclock.editor_daily AS
    SELECT user_id, date, editor, count() AS heartbeat_count, sum(ifNull(active_seconds, 0.0)) AS total_seconds
    FROM wakaclock.heartbeats_incoming GROUP BY user_id, date, editor
    "#,
    r#"
    CREATE MATERIALIZED VIEW IF NOT EXISTS wakaclock.mv_inc_os_summary
    TO wakaclock.os_daily AS
    SELECT user_id, date, operating_system AS os, count() AS heartbeat_count, sum(ifNull(active_seconds, 0.0)) AS total_seconds
    FROM wakaclock.heartbeats_incoming GROUP BY user_id, date, os
    "#,
    r#"
    CREATE MATERIALIZED VIEW IF NOT EXISTS wakaclock.mv_inc_insights_agg
    TO wakaclock.insights_agg AS
    SELECT user_id, date, coalesce(ast_language, language, 'Unknown') AS language,
           coalesce(project, 'Unknown') AS project, editor, operating_system AS os,
           coalesce(branch, '') AS branch, sum(ifNull(active_seconds, 0.0)) AS total_seconds,
           count() AS heartbeat_count, uniqState(date) AS unique_days
    FROM wakaclock.heartbeats_incoming GROUP BY user_id, date, language, project, editor, os, branch
    "#,
    r#"
    CREATE MATERIALIZED VIEW IF NOT EXISTS wakaclock.mv_inc_ai_summary
    TO wakaclock.ai_daily AS
    SELECT user_id, date, coalesce(ai_agent, 'human') AS ai_agent,
           sum(coalesce(ai_lines_added, 0)) AS ai_lines_added,
           sum(coalesce(ai_lines_deleted, 0)) AS ai_lines_deleted,
           sumIf(coalesce(keystrokes, 0), NOT is_ai_generated) AS human_keystrokes,
           sumIf(coalesce(chars_added, 0), NOT is_ai_generated) AS human_chars_added,
           count() AS heartbeat_count
    FROM wakaclock.heartbeats_incoming GROUP BY user_id, date, ai_agent
    "#,
    r#"
    CREATE MATERIALIZED VIEW IF NOT EXISTS wakaclock.mv_inc_keystroke_summary
    TO wakaclock.keystroke_daily AS
    SELECT user_id, date, coalesce(project, 'Unknown') AS project,
           sum(coalesce(keystrokes, 0)) AS keystrokes,
           sum(coalesce(chars_added, 0)) AS chars_added,
           sum(coalesce(chars_deleted, 0)) AS chars_deleted,
           count() AS heartbeat_count
    FROM wakaclock.heartbeats_incoming GROUP BY user_id, date, project
    "#,
];
