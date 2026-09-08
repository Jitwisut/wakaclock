use anyhow::{Context, Result};
use serde::Deserialize;
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

        // Must run before STATEMENTS: the corrected view definitions below are
        // `CREATE MATERIALIZED VIEW IF NOT EXISTS`, which is a no-op against a view
        // that already exists, so the stale pair has to be dropped first.
        let redefined_ai_summary = self.drop_stale_ai_summary_views().await?;

        for statement in STATEMENTS {
            ch_client
                .query(statement)
                .execute()
                .await
                .with_context(|| {
                    format!("Failed to execute analytics migration statement: {statement}")
                })?;
        }

        self.backfill_actor_daily_v2().await?;

        // Marked last, so any failure earlier in `migrate()` — including the backfill's
        // reconciliation bail — leaves the marker unwritten and the next boot redoes
        // the drop and recreate rather than skipping a half-applied redefinition.
        if redefined_ai_summary {
            self.mark_ai_summary_redefined().await?;
        }

        Ok(())
    }

    /// `mv_ai_summary` and `mv_inc_ai_summary` shipped with
    /// `coalesce(ai_agent, 'human')`, which files an AI heartbeat carrying no agent
    /// name — every event written before the broker sidecar started emitting `agent`
    /// — under the literal agent name `'human'`, together with its non-zero
    /// `ai_lines_added`. The definitions now key those rows as `'unknown'`, matching
    /// the spelling `AiStatsService::fetch_agents` already reads with.
    ///
    /// Returns whether the drop ran, so the caller can publish the marker only after
    /// the recreate has succeeded. `ai_daily` is a separate table and keeps every row
    /// it holds; the historical rows already keyed `'human'` stay wrong until
    /// `POST /api/v1/reprocess` rewrites the range — that is `ReprocessService`, whose
    /// `AGGREGATE_TABLES` includes `ai_daily`. Not `POST /api/v1/analytics/rebuild`,
    /// which is `AccountAnalyticsService::rebuild` over the account-projection tables
    /// only and never touches this one.
    async fn drop_stale_ai_summary_views(&self) -> Result<bool> {
        let client = self.client.get_client();
        client
            .query(
                "CREATE TABLE IF NOT EXISTS wakaclock.analytics_view_definition_state (
                    definition String,
                    applied_at DateTime64(3)
                ) ENGINE = MergeTree ORDER BY definition",
            )
            .execute()
            .await
            .context("Failed to create analytics view definition state")?;

        let applied: u64 = client
            .query(
                "SELECT count()
                 FROM wakaclock.analytics_view_definition_state
                 WHERE definition = ?",
            )
            .bind(AI_SUMMARY_DEFINITION)
            .fetch_one()
            .await
            .context("Failed to read analytics view definition state")?;
        if applied > 0 {
            return Ok(false);
        }

        for view in ["mv_ai_summary", "mv_inc_ai_summary"] {
            client
                .query(&format!("DROP VIEW IF EXISTS wakaclock.{view}"))
                .execute()
                .await
                .with_context(|| format!("Failed to drop stale materialized view {view}"))?;
        }
        Ok(true)
    }

    async fn mark_ai_summary_redefined(&self) -> Result<()> {
        self.client
            .get_client()
            .query(
                "INSERT INTO wakaclock.analytics_view_definition_state
                 SELECT ? AS definition, now64(3) AS applied_at",
            )
            .bind(AI_SUMMARY_DEFINITION)
            .execute()
            .await
            .context("Failed to publish analytics view definition marker")
    }

    /// Build the actor-aware rollup once from raw heartbeats. The marker makes the
    /// migration repeatable on every boot; the raw/table totals are checked before the
    /// marker is written so a partial backfill cannot be silently accepted. The old
    /// `ai_daily` table and its views remain untouched for compatibility.
    async fn backfill_actor_daily_v2(&self) -> Result<()> {
        let client = self.client.get_client();
        let completed: u64 = client
            .query(
                "SELECT count()
                 FROM wakaclock.actor_daily_v2_backfill_state
                 WHERE migration = 'initial'",
            )
            .fetch_one()
            .await
            .context("Failed to read actor rollup backfill state")?;
        if completed > 0 {
            return Ok(());
        }

        // actor_daily_v2 is a derived table. Clearing it before an unmarked rebuild
        // makes the backfill recoverable if the process dies after INSERT but before
        // the completion marker, and avoids double-counting rows emitted by the
        // materialized view while this migration is running. Raw heartbeats remain
        // untouched and are the source of truth.
        client
            .query("TRUNCATE TABLE wakaclock.actor_daily_v2")
            .execute()
            .await
            .context("Failed to reset incomplete actor-aware daily rollup")?;

        client
            .query(
                "INSERT INTO wakaclock.actor_daily_v2
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
                 FROM wakaclock.heartbeats_canonical AS h
                 GROUP BY user_id, date, actor_type, ai_agent, ai_provider, ai_model",
            )
            .execute()
            .await
            .context("Failed to backfill actor-aware daily rollup")?;

        let source = client
            .query(
                "SELECT
                    sumIf(toUInt64(ifNull(ai_lines_added, 0)), actor_type IN ('ai_verified', 'ai_inferred')) AS ai_lines_added,
                    sumIf(toUInt64(ifNull(ai_lines_deleted, 0)), actor_type IN ('ai_verified', 'ai_inferred')) AS ai_lines_deleted,
                    sumIf(toUInt64(ifNull(human_lines_added, 0)), actor_type = 'human') AS human_lines_added,
                    sumIf(toUInt64(ifNull(human_lines_deleted, 0)), actor_type = 'human') AS human_lines_deleted,
                    sum(toUInt64(ifNull(unattributed_lines_added, 0)))
                        + sumIf(toUInt64(ifNull(h.ai_lines_added, 0) + ifNull(h.human_lines_added, 0)), actor_type = 'unknown') AS unknown_lines_added,
                    sum(toUInt64(ifNull(unattributed_lines_deleted, 0)))
                        + sumIf(toUInt64(ifNull(h.ai_lines_deleted, 0) + ifNull(h.human_lines_deleted, 0)), actor_type = 'unknown') AS unknown_lines_deleted,
                    count() AS heartbeat_count
                 FROM wakaclock.heartbeats_canonical AS h",
            )
            .fetch_one::<ActorRollupTotalsRow>()
            .await
            .context("Failed to read actor rollup source totals")?;
        let projected = client
            .query(
                "SELECT
                    sum(ai_lines_added) AS ai_lines_added,
                    sum(ai_lines_deleted) AS ai_lines_deleted,
                    sum(human_lines_added) AS human_lines_added,
                    sum(human_lines_deleted) AS human_lines_deleted,
                    sum(unknown_lines_added) AS unknown_lines_added,
                    sum(unknown_lines_deleted) AS unknown_lines_deleted,
                    sum(heartbeat_count) AS heartbeat_count
                 FROM wakaclock.actor_daily_v2",
            )
            .fetch_one::<ActorRollupTotalsRow>()
            .await
            .context("Failed to read actor rollup totals")?;
        if source != projected {
            anyhow::bail!(
                "actor rollup backfill reconciliation failed: source={source:?}, projected={projected:?}"
            );
        }

        client
            .query(
                "INSERT INTO wakaclock.actor_daily_v2_backfill_state
                 SELECT 'initial' AS migration, now64(3) AS completed_at",
            )
            .execute()
            .await
            .context("Failed to publish actor rollup backfill marker")?;
        Ok(())
    }
}

#[derive(Debug, Deserialize, PartialEq, Eq, clickhouse::Row)]
struct ActorRollupTotalsRow {
    ai_lines_added: u64,
    ai_lines_deleted: u64,
    human_lines_added: u64,
    human_lines_deleted: u64,
    unknown_lines_added: u64,
    unknown_lines_deleted: u64,
    heartbeat_count: u64,
}

/// Marker for the one-time redefinition of the two AI summary materialized views.
const AI_SUMMARY_DEFINITION: &str = "ai_summary_unknown_agent_v1";

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
        human_lines_added UInt64,
        human_lines_deleted UInt64,
        human_keystrokes  UInt64,
        human_chars_added UInt64,
        heartbeat_count   UInt64
    )
    ENGINE = SummingMergeTree((ai_lines_added, ai_lines_deleted, human_lines_added, human_lines_deleted, human_keystrokes, human_chars_added, heartbeat_count))
    ORDER BY (user_id, date, ai_agent)
    "#,
    r#"
    ALTER TABLE wakaclock.ai_daily ADD COLUMN IF NOT EXISTS human_lines_added UInt64
    "#,
    r#"
    ALTER TABLE wakaclock.ai_daily ADD COLUMN IF NOT EXISTS human_lines_deleted UInt64
    "#,
    r#"
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
    ) ENGINE = SummingMergeTree((ai_lines_added, ai_lines_deleted, human_lines_added, human_lines_deleted, unknown_lines_added, unknown_lines_deleted, human_keystrokes, human_chars_added, heartbeat_count))
    ORDER BY (user_id, date, actor_type, ai_agent, ai_provider, ai_model)
    "#,
    r#"
    CREATE TABLE IF NOT EXISTS wakaclock.actor_daily_v2_backfill_state
    (
        migration   String,
        completed_at DateTime64(3)
    ) ENGINE = ReplacingMergeTree(completed_at)
    ORDER BY migration
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
    // Phase 10 dimensional projections. These are additive and rebuildable; raw
    // heartbeats remain the source of truth for telemetry.
    r#"
    CREATE TABLE IF NOT EXISTS wakaclock.member_daily
    (
        organization_id UUID,
        user_id UUID,
        date Date,
        total_seconds Float64,
        heartbeat_count UInt64
    ) ENGINE = SummingMergeTree((total_seconds, heartbeat_count))
    ORDER BY (organization_id, user_id, date)
    "#,
    r#"
    CREATE TABLE IF NOT EXISTS wakaclock.organization_daily
    (
        organization_id UUID,
        date Date,
        total_seconds Float64,
        heartbeat_count UInt64
    ) ENGINE = SummingMergeTree((total_seconds, heartbeat_count))
    ORDER BY (organization_id, date)
    "#,
    r#"
    CREATE TABLE IF NOT EXISTS wakaclock.feature_daily
    (
        user_id UUID,
        date Date,
        feature_id String,
        feature_name String,
        total_seconds Float64,
        heartbeat_count UInt64
    ) ENGINE = SummingMergeTree((total_seconds, heartbeat_count))
    ORDER BY (user_id, date, feature_id)
    "#,
    r#"
    CREATE TABLE IF NOT EXISTS wakaclock.dependency_daily
    (
        user_id UUID,
        date Date,
        dependency String,
        total_seconds Float64,
        heartbeat_count UInt64
    ) ENGINE = SummingMergeTree((total_seconds, heartbeat_count))
    ORDER BY (user_id, date, dependency)
    "#,
    r#"
    -- `repository_id` is part of the sorting key, so it cannot be Nullable: ClickHouse
    -- rejects the whole CREATE with `Sorting key contains nullable columns` unless
    -- `allow_nullable_key` is on, and a nullable key under SummingMergeTree is a known
    -- source of surprising merge behaviour. Activity that is not mapped to a repository
    -- carries the nil UUID instead, which sorts and sums predictably.
    CREATE TABLE IF NOT EXISTS wakaclock.commit_activity_daily
    (
        user_id UUID,
        repository_id UUID,
        head_revision String,
        date Date,
        total_seconds Float64,
        heartbeat_count UInt64
    ) ENGINE = SummingMergeTree((total_seconds, heartbeat_count))
    ORDER BY (user_id, repository_id, head_revision, date)
    "#,
    r#"
    CREATE TABLE IF NOT EXISTS wakaclock.ai_model_daily
    (
        user_id UUID,
        date Date,
        provider String,
        model String,
        ai_events UInt64,
        ai_lines_added UInt64,
        ai_lines_deleted UInt64,
        prompts UInt64,
        sessions UInt64,
        input_tokens UInt64,
        output_tokens UInt64,
        cache_read_tokens UInt64,
        cache_write_tokens UInt64,
        estimated_cost_microusd Nullable(UInt64),
        priced_tokens UInt64,
        total_reported_tokens UInt64,
        data_version UInt64
    ) ENGINE = MergeTree()
    ORDER BY (user_id, date, provider, model, data_version)
    "#,
    r#"
    CREATE TABLE IF NOT EXISTS wakaclock.ai_effectiveness_daily
    (
        user_id UUID,
        date Date,
        ai_sessions UInt64,
        ai_lines UInt64,
        manual_lines UInt64,
        human_follow_up_events UInt64,
        eligible_ai_changes UInt64,
        estimated_cost_microusd Nullable(UInt64)
    ) ENGINE = SummingMergeTree((ai_sessions, ai_lines, manual_lines, human_follow_up_events, eligible_ai_changes))
    ORDER BY (user_id, date)
    "#,
    r#"
    CREATE TABLE IF NOT EXISTS wakaclock.leaderboard_snapshots
    (
        leaderboard_id UUID,
        user_id UUID,
        period_start Date,
        period_end Date,
        metric String,
        value Float64,
        rank UInt32,
        captured_at DateTime64(3)
    ) ENGINE = ReplacingMergeTree(captured_at)
    ORDER BY (leaderboard_id, period_start, metric, user_id)
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
    // Flat-plan subscription state. Payment processing itself is intentionally not this
    // server's job — see handlers/v1/internal.rs — this table only tracks the resulting
    // status. `trial_ends_at`'s default only takes effect on the INSERT from
    // register() (every other write to this row must carry these three columns forward
    // explicitly, the same way username/email/password_hash already have to be, or a
    // key rotation would silently reset a user's trial).
    r#"
    ALTER TABLE wakaclock.users
    ADD COLUMN IF NOT EXISTS subscription_status String DEFAULT 'trialing'
    "#,
    r#"
    ALTER TABLE wakaclock.users
    ADD COLUMN IF NOT EXISTS trial_ends_at DateTime DEFAULT now() + INTERVAL 14 DAY
    "#,
    r#"
    ALTER TABLE wakaclock.users
    ADD COLUMN IF NOT EXISTS subscription_period_end Nullable(DateTime)
    "#,
    // Keep a retrievable copy for the authenticated dashboard's API-key panel. The
    // `api_key` column remains the SHA-256 authentication value.
    r#"
    ALTER TABLE wakaclock.users
    ADD COLUMN IF NOT EXISTS api_key_plain String DEFAULT ''
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
    WHERE revision = 0
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
    WHERE revision = 0
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
    WHERE revision = 0
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
    WHERE revision = 0
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
    WHERE revision = 0
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
    WHERE revision = 0
    GROUP BY user_id, date, language, project, editor, os, branch
    "#,
    r#"
    CREATE MATERIALIZED VIEW IF NOT EXISTS wakaclock.mv_ai_summary
    TO wakaclock.ai_daily AS
    SELECT
        user_id,
        date,
        coalesce(ai_agent, 'unknown') AS ai_agent,
        sumIf(coalesce(ai_lines_added, 0), actor_type IN ('ai_verified', 'ai_inferred')) AS ai_lines_added,
        sumIf(coalesce(ai_lines_deleted, 0), actor_type IN ('ai_verified', 'ai_inferred')) AS ai_lines_deleted,
        sumIf(coalesce(human_lines_added, 0), actor_type = 'human') AS human_lines_added,
        sumIf(coalesce(human_lines_deleted, 0), actor_type = 'human') AS human_lines_deleted,
        sumIf(coalesce(keystrokes, 0), actor_type = 'human') AS human_keystrokes,
        sumIf(coalesce(chars_added, 0), actor_type = 'human') AS human_chars_added,
        count() AS heartbeat_count
    FROM wakaclock.heartbeats
    WHERE revision = 0
    GROUP BY user_id, date, ai_agent
    "#,
    // Actor-aware replacement for the boolean-keyed AI rollup. It is additive so old
    // readers and historical tables remain available while new reads use raw facts or
    // this explicitly partitioned table.
    r#"
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
    WHERE h.revision = 0
    GROUP BY user_id, date, actor_type, ai_agent, ai_provider, ai_model
    "#,
    r#"
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
    WHERE revision = 0
    GROUP BY user_id, date, project
    "#,
    // ============================================================
    // Materialized Views — Path B: reprocessing (from heartbeats_incoming, Null engine)
    // ============================================================
    r#"
    CREATE MATERIALIZED VIEW IF NOT EXISTS wakaclock.mv_inc_daily_summary
    TO wakaclock.daily_totals AS
    SELECT user_id, date, count() AS heartbeat_count, sum(ifNull(active_seconds, 0.0)) AS total_seconds
    FROM wakaclock.heartbeats_incoming WHERE revision = 0 GROUP BY user_id, date
    "#,
    r#"
    CREATE MATERIALIZED VIEW IF NOT EXISTS wakaclock.mv_inc_lang_summary
    TO wakaclock.language_daily AS
    SELECT user_id, date, coalesce(ast_language, language, 'Unknown') AS language,
           count() AS heartbeat_count, sum(ifNull(active_seconds, 0.0)) AS total_seconds
    FROM wakaclock.heartbeats_incoming WHERE revision = 0 GROUP BY user_id, date, language
    "#,
    r#"
    CREATE MATERIALIZED VIEW IF NOT EXISTS wakaclock.mv_inc_project_summary
    TO wakaclock.project_daily AS
    SELECT user_id, date, coalesce(project, 'Unknown') AS project,
           count() AS heartbeat_count, sum(ifNull(active_seconds, 0.0)) AS total_seconds
    FROM wakaclock.heartbeats_incoming WHERE revision = 0 GROUP BY user_id, date, project
    "#,
    r#"
    CREATE MATERIALIZED VIEW IF NOT EXISTS wakaclock.mv_inc_editor_summary
    TO wakaclock.editor_daily AS
    SELECT user_id, date, editor, count() AS heartbeat_count, sum(ifNull(active_seconds, 0.0)) AS total_seconds
    FROM wakaclock.heartbeats_incoming WHERE revision = 0 GROUP BY user_id, date, editor
    "#,
    r#"
    CREATE MATERIALIZED VIEW IF NOT EXISTS wakaclock.mv_inc_os_summary
    TO wakaclock.os_daily AS
    SELECT user_id, date, operating_system AS os, count() AS heartbeat_count, sum(ifNull(active_seconds, 0.0)) AS total_seconds
    FROM wakaclock.heartbeats_incoming WHERE revision = 0 GROUP BY user_id, date, os
    "#,
    r#"
    CREATE MATERIALIZED VIEW IF NOT EXISTS wakaclock.mv_inc_insights_agg
    TO wakaclock.insights_agg AS
    SELECT user_id, date, coalesce(ast_language, language, 'Unknown') AS language,
           coalesce(project, 'Unknown') AS project, editor, operating_system AS os,
           coalesce(branch, '') AS branch, sum(ifNull(active_seconds, 0.0)) AS total_seconds,
           count() AS heartbeat_count, uniqState(date) AS unique_days
    FROM wakaclock.heartbeats_incoming WHERE revision = 0 GROUP BY user_id, date, language, project, editor, os, branch
    "#,
    r#"
    CREATE MATERIALIZED VIEW IF NOT EXISTS wakaclock.mv_inc_ai_summary
    TO wakaclock.ai_daily AS
    SELECT user_id, date, coalesce(ai_agent, 'unknown') AS ai_agent,
           sumIf(coalesce(ai_lines_added, 0), actor_type IN ('ai_verified', 'ai_inferred')) AS ai_lines_added,
           sumIf(coalesce(ai_lines_deleted, 0), actor_type IN ('ai_verified', 'ai_inferred')) AS ai_lines_deleted,
           sumIf(coalesce(human_lines_added, 0), actor_type = 'human') AS human_lines_added,
           sumIf(coalesce(human_lines_deleted, 0), actor_type = 'human') AS human_lines_deleted,
           sumIf(coalesce(keystrokes, 0), actor_type = 'human') AS human_keystrokes,
           sumIf(coalesce(chars_added, 0), actor_type = 'human') AS human_chars_added,
           count() AS heartbeat_count
    FROM wakaclock.heartbeats_incoming WHERE revision = 0 GROUP BY user_id, date, ai_agent
    "#,
    r#"
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
    WHERE h.revision = 0
    GROUP BY user_id, date, actor_type, ai_agent, ai_provider, ai_model
    "#,
    r#"
    CREATE MATERIALIZED VIEW IF NOT EXISTS wakaclock.mv_inc_keystroke_summary
    TO wakaclock.keystroke_daily AS
    SELECT user_id, date, coalesce(project, 'Unknown') AS project,
           sumIf(coalesce(keystrokes, 0), actor_type = 'human') AS keystrokes,
           sumIf(coalesce(chars_added, 0), actor_type = 'human') AS chars_added,
           sumIf(coalesce(chars_deleted, 0), actor_type = 'human') AS chars_deleted,
           count() AS heartbeat_count
    FROM wakaclock.heartbeats_incoming WHERE revision = 0 GROUP BY user_id, date, project
    "#,
];

#[cfg(test)]
mod tests {
    use super::AnalyticsRepository;
    use crate::repository::heartbeat::HeartbeatRepository;
    use uuid::Uuid;

    #[tokio::test]
    #[ignore = "requires an isolated ClickHouse 24.10 instance via CLICKHOUSE_TEST_URL"]
    async fn actor_backfill_reconciles_legacy_attribution_into_v2_rollup() {
        let clickhouse = crate::test_support::clickhouse_client().await;
        HeartbeatRepository::new(clickhouse.clone())
            .migrate()
            .await
            .unwrap();
        let repository = AnalyticsRepository::new(clickhouse.clone());
        repository.migrate().await.unwrap();

        let client = clickhouse.get_client();
        client
            .query("TRUNCATE TABLE wakaclock.actor_daily_v2")
            .execute()
            .await
            .unwrap();
        client
            .query("TRUNCATE TABLE wakaclock.actor_daily_v2_backfill_state")
            .execute()
            .await
            .unwrap();

        let user_id = Uuid::new_v4();
        let insert = format!(
            r#"INSERT INTO wakaclock.heartbeats
                (user_id, entity, entity_type, time, dependencies, is_write, category,
                 editor, operating_system, machine, user_agent, is_ai_generated,
                 ai_agent, ai_source, ai_confidence, ai_lines_added, human_lines_added,
                 unattributed_lines_added, created_at)
               VALUES
                ('{user_id}', 'phase1-human.rs', 'file', 1788048000, [], 1, 'coding',
                 'vscode', 'test', 'test', 'phase1-test', 0,
                 NULL, NULL, NULL, NULL, 3, NULL, 1),
                ('{user_id}', 'phase1-verified.rs', 'file', 1788048060, [], 0, 'coding',
                 'agent', 'test', 'test', 'phase1-test', 1,
                 'claude-code', 'agent_hook', 'verified', 5, NULL, NULL, 2),
                ('{user_id}', 'phase1-inferred.rs', 'file', 1788048120, [], 0, 'coding',
                 'agent', 'test', 'test', 'phase1-test', 1,
                 'legacy-agent', 'transcript', 'correlated', 2, NULL, NULL, 3),
                ('{user_id}', 'phase1-unknown.rs', 'file', 1788048180, [], 0, 'coding',
                 '', 'test', 'test', 'phase1-test', 0,
                 NULL, NULL, NULL, NULL, NULL, 4, 4)"#
        );
        client.query(&insert).execute().await.unwrap();

        // The materialized view may have observed the insert already. Removing the
        // marker forces migrate() to truncate that derived state and rebuild it solely
        // from raw heartbeats, which is the historical upgrade path Phase 1 relies on.
        repository.migrate().await.unwrap();

        for actor in ["human", "ai_verified", "ai_inferred", "unknown"] {
            let raw: u64 = client
                .query(&format!(
                    "SELECT count() FROM wakaclock.heartbeats_canonical WHERE user_id = '{user_id}' AND actor_type = '{actor}'"
                ))
                .fetch_one()
                .await
                .unwrap();
            assert_eq!(raw, 1, "unexpected raw actor count for {actor}");

            let rolled_up: u64 = client
                .query(&format!(
                    "SELECT sum(heartbeat_count) FROM wakaclock.actor_daily_v2 WHERE user_id = '{user_id}' AND actor_type = '{actor}'"
                ))
                .fetch_one()
                .await
                .unwrap();
            assert_eq!(rolled_up, 1, "unexpected rollup actor count for {actor}");
        }

        let human_lines: u64 = client
            .query(&format!(
                "SELECT sum(human_lines_added) FROM wakaclock.actor_daily_v2 WHERE user_id = '{user_id}'"
            ))
            .fetch_one()
            .await
            .unwrap();
        let ai_lines: u64 = client
            .query(&format!(
                "SELECT sum(ai_lines_added) FROM wakaclock.actor_daily_v2 WHERE user_id = '{user_id}'"
            ))
            .fetch_one()
            .await
            .unwrap();
        let unknown_lines: u64 = client
            .query(&format!(
                "SELECT sum(unknown_lines_added) FROM wakaclock.actor_daily_v2 WHERE user_id = '{user_id}'"
            ))
            .fetch_one()
            .await
            .unwrap();
        assert_eq!(human_lines, 3);
        assert_eq!(ai_lines, 7);
        assert_eq!(unknown_lines, 4);

        let marker_count: u64 = client
            .query(
                "SELECT count() FROM wakaclock.actor_daily_v2_backfill_state WHERE migration = 'initial'",
            )
            .fetch_one()
            .await
            .unwrap();
        assert_eq!(marker_count, 1);
    }
}
