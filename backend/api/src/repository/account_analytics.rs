//! Versioned account-level projections for Phase 9 PR 9.4.
//!
//! These are deliberately rebuilt from deduplicated raw facts rather than fed by an
//! additive materialized view. A transcript/queue retry can then be replayed safely:
//! a new snapshot is built under a new version and only published when complete.

use anyhow::{Context, Result};
use std::sync::Arc;
use uuid::Uuid;

use crate::infrastructure::database::ClickHouseClient;

pub struct AccountAnalyticsRepository {
    client: Arc<ClickHouseClient>,
}

impl AccountAnalyticsRepository {
    pub fn new(client: Arc<ClickHouseClient>) -> Self {
        Self { client }
    }

    pub async fn migrate(&self) -> Result<()> {
        for (name, statement) in TABLES {
            self.client
                .get_client()
                .query(statement)
                .execute()
                .await
                .with_context(|| format!("Failed to create account projection table {name}"))?;
        }
        Ok(())
    }

    pub async fn source_counts(&self, user_id: Uuid, start: &str, end: &str) -> Result<(u64, u64)> {
        let heartbeats: u64 = self
            .client
            .get_client()
            .query(
                "SELECT count() FROM wakaclock.heartbeats
                 WHERE user_id = ? AND toDate(date) BETWEEN toDate(?) AND toDate(?)",
            )
            .bind(user_id)
            .bind(start)
            .bind(end)
            .fetch_one()
            .await
            .map_err(|error| {
                anyhow::anyhow!("Count account projection heartbeats failed: {error}")
            })?;
        let usage_events: u64 = self
            .client
            .get_client()
            .query(
                "SELECT count() FROM wakaclock.ai_usage_events FINAL
                 WHERE user_id = ? AND toDate(date) BETWEEN toDate(?) AND toDate(?)",
            )
            .bind(user_id)
            .bind(start)
            .bind(end)
            .fetch_one()
            .await
            .map_err(|error| {
                anyhow::anyhow!("Count account projection usage events failed: {error}")
            })?;
        Ok((heartbeats, usage_events))
    }

    pub async fn build_snapshot(
        &self,
        user_id: Uuid,
        start: &str,
        end: &str,
        data_version: u64,
    ) -> Result<()> {
        // Every query is an INSERT ... SELECT from authoritative raw tables. No new
        // materialized view is attached to retryable ReplacingMergeTree input.
        for (name, statement) in SNAPSHOT_INSERTS {
            // `data_version` is an internally generated integer, so interpolation is
            // safe here. Keeping the user/range values as bind parameters preserves
            // ClickHouse type checking and avoids interpolating client input.
            let statement = statement.replace("__DATA_VERSION__", &data_version.to_string());
            let query = self.client.get_client().query(&statement);
            if *name == "machine_daily" {
                query
                    .bind(user_id)
                    .bind(start)
                    .bind(end)
                    .execute()
                    .await
                    .with_context(|| format!("Failed to build account projection {name}"))?;
            } else {
                query
                    .bind(user_id)
                    .bind(start)
                    .bind(end)
                    .bind(user_id)
                    .bind(start)
                    .bind(end)
                    .execute()
                    .await
                    .with_context(|| format!("Failed to build account projection {name}"))?;
            }
        }
        for (name, statement) in PROJECT_DETAIL_SNAPSHOT_INSERTS {
            let statement = statement.replace("__DATA_VERSION__", &data_version.to_string());
            self.client
                .get_client()
                .query(&statement)
                .bind(user_id)
                .bind(start)
                .bind(end)
                .execute()
                .await
                .with_context(|| format!("Failed to build project-detail projection {name}"))?;
        }
        Ok(())
    }

    /// The pointer is written after all projection inserts succeed. A snapshot read
    /// path can select this active version (with FINAL) before reading any daily table,
    /// giving it a coherent snapshot even while a later rebuild is running.
    pub async fn publish_snapshot(
        &self,
        user_id: Uuid,
        start: &str,
        end: &str,
        data_version: u64,
        published_at: u64,
    ) -> Result<()> {
        self.validate_duration_reconciliation(user_id, start, end, data_version)
            .await?;

        let mut insert = self
            .client
            .get_client()
            .insert("wakaclock.account_projection_versions")
            .map_err(|error| anyhow::anyhow!("Start account projection publish failed: {error}"))?;
        for projection in [
            "machine_daily",
            "ai_model_daily",
            "ai_client_daily",
            "ai_project_daily",
            "project_file_daily",
            "project_branch_daily",
            "project_language_daily",
            "project_editor_daily",
            "project_activity_daily",
        ] {
            insert
                .write(&ProjectionVersionRow {
                    user_id,
                    projection_name: projection.to_string(),
                    active_version: data_version,
                    range_start: date_days(start)?,
                    range_end: date_days(end)?,
                    published_at,
                })
                .await
                .map_err(|error| {
                    anyhow::anyhow!("Write account projection publish failed: {error}")
                })?;
        }
        insert.end().await.map_err(|error| {
            anyhow::anyhow!("Finalize account projection publish failed: {error}")
        })?;

        // ReplacingMergeTree publication is asynchronous. Verify that every projection
        // pointer for this exact user/range/version is present before reporting success; a
        // partial pointer set would make a later reader mix generations.
        let published: u64 = self
            .client
            .get_client()
            .query(
                "SELECT uniqExact(projection_name)
                 FROM wakaclock.account_projection_versions FINAL
                 WHERE user_id = ? AND range_start = toDate(?) AND range_end = toDate(?)
                   AND active_version = ?",
            )
            .bind(user_id)
            .bind(start)
            .bind(end)
            .bind(data_version)
            .fetch_one()
            .await
            .map_err(|error| {
                anyhow::anyhow!("Verify account projection publish failed: {error}")
            })?;
        if published != 9 {
            anyhow::bail!(
                "account projection publish incomplete: expected 9 pointers, found {published}"
            );
        }
        Ok(())
    }

    async fn validate_duration_reconciliation(
        &self,
        user_id: Uuid,
        start: &str,
        end: &str,
        data_version: u64,
    ) -> Result<()> {
        let source: f64 = self
            .client
            .get_client()
            .query(
                "SELECT sum(ifNull(active_seconds, 0.0))
                 FROM wakaclock.heartbeats
                 WHERE user_id = ? AND toDate(date) BETWEEN toDate(?) AND toDate(?)",
            )
            .bind(user_id)
            .bind(start)
            .bind(end)
            .fetch_one()
            .await
            .map_err(|error| anyhow::anyhow!("Read projection source duration failed: {error}"))?;
        let projected: f64 = self
            .client
            .get_client()
            .query(
                "SELECT sum(ifNull(active_seconds, 0.0))
                 FROM wakaclock.machine_daily
                 WHERE user_id = ? AND toDate(date) BETWEEN toDate(?) AND toDate(?)
                   AND data_version = ?",
            )
            .bind(user_id)
            .bind(start)
            .bind(end)
            .bind(data_version)
            .fetch_one()
            .await
            .map_err(|error| anyhow::anyhow!("Read projection duration failed: {error}"))?;

        if (source - projected).abs() > 0.001 {
            anyhow::bail!(
                "account projection duration reconciliation failed: source={source}, projected={projected}"
            );
        }
        Ok(())
    }
}

#[derive(Debug, serde::Serialize, clickhouse::Row)]
struct ProjectionVersionRow {
    #[serde(with = "clickhouse::serde::uuid")]
    user_id: Uuid,
    projection_name: String,
    active_version: u64,
    range_start: u16,
    range_end: u16,
    published_at: u64,
}

fn date_days(value: &str) -> Result<u16> {
    let date = chrono::NaiveDate::parse_from_str(value, "%Y-%m-%d")?;
    let epoch = chrono::NaiveDate::from_ymd_opt(1970, 1, 1).expect("valid Unix epoch date");
    Ok(date.signed_duration_since(epoch).num_days().max(0) as u16)
}

const TABLES: &[(&str, &str)] = &[
    (
        "account_projection_versions",
        r#"
        CREATE TABLE IF NOT EXISTS wakaclock.account_projection_versions (
            user_id UUID,
            projection_name String,
            active_version UInt64,
            range_start Date,
            range_end Date,
            published_at UInt64
        ) ENGINE = ReplacingMergeTree(published_at)
        ORDER BY (user_id, projection_name)
        "#,
    ),
    (
        "machine_daily",
        r#"
        CREATE TABLE IF NOT EXISTS wakaclock.machine_daily (
            user_id UUID,
            date Date,
            machine_key String,
            machine_display_name String,
            active_seconds Float64,
            heartbeat_count UInt64,
            data_version UInt64
        ) ENGINE = MergeTree()
        ORDER BY (user_id, date, machine_key, data_version)
        "#,
    ),
    (
        "ai_model_daily",
        r#"
        CREATE TABLE IF NOT EXISTS wakaclock.ai_model_daily (
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
    ),
    (
        "ai_client_daily",
        r#"
        CREATE TABLE IF NOT EXISTS wakaclock.ai_client_daily (
            user_id UUID,
            date Date,
            ai_agent String,
            ai_client String,
            editor String,
            active_seconds Float64,
            ai_events UInt64,
            sessions UInt64,
            ai_lines_changed UInt64,
            data_version UInt64
        ) ENGINE = MergeTree()
        ORDER BY (user_id, date, ai_agent, ai_client, editor, data_version)
        "#,
    ),
    (
        "ai_project_daily",
        r#"
        CREATE TABLE IF NOT EXISTS wakaclock.ai_project_daily (
            user_id UUID,
            date Date,
            project_id UUID,
            total_seconds Float64,
            ai_lines_added UInt64,
            ai_lines_deleted UInt64,
            human_lines_added UInt64,
            human_lines_deleted UInt64,
            unattributed_lines_added Nullable(UInt64),
            unattributed_lines_deleted Nullable(UInt64),
            prompts Nullable(UInt64),
            sessions Nullable(UInt64),
            input_tokens Nullable(UInt64),
            output_tokens Nullable(UInt64),
            cache_read_tokens Nullable(UInt64),
            cache_write_tokens Nullable(UInt64),
            estimated_cost_microusd Nullable(UInt64),
            priced_tokens Nullable(UInt64),
            total_reported_tokens Nullable(UInt64),
            data_version UInt64
        ) ENGINE = MergeTree()
        ORDER BY (user_id, date, project_id, data_version)
        "#,
    ),
    (
        "project_file_daily",
        r#"
        CREATE TABLE IF NOT EXISTS wakaclock.project_file_daily (
            user_id UUID,
            date Date,
            project_id UUID,
            entity_key String,
            relative_path String,
            language String,
            branch String,
            total_seconds Float64,
            heartbeat_count UInt64,
            ai_lines_added UInt64,
            ai_lines_deleted UInt64,
            human_lines_added UInt64,
            human_lines_deleted UInt64,
            unattributed_lines_added Nullable(UInt64),
            unattributed_lines_deleted Nullable(UInt64),
            data_version UInt64
        ) ENGINE = MergeTree()
        ORDER BY (user_id, date, project_id, entity_key, data_version)
        "#,
    ),
    (
        "project_branch_daily",
        r#"
        CREATE TABLE IF NOT EXISTS wakaclock.project_branch_daily (
            user_id UUID,
            date Date,
            project_id UUID,
            branch String,
            total_seconds Float64,
            heartbeat_count UInt64,
            ai_lines_added UInt64,
            ai_lines_deleted UInt64,
            human_lines_added UInt64,
            human_lines_deleted UInt64,
            unattributed_lines_added Nullable(UInt64),
            unattributed_lines_deleted Nullable(UInt64),
            data_version UInt64
        ) ENGINE = MergeTree()
        ORDER BY (user_id, date, project_id, branch, data_version)
        "#,
    ),
    (
        "project_language_daily",
        r#"
        CREATE TABLE IF NOT EXISTS wakaclock.project_language_daily (
            user_id UUID,
            date Date,
            project_id UUID,
            language String,
            total_seconds Float64,
            heartbeat_count UInt64,
            data_version UInt64
        ) ENGINE = MergeTree()
        ORDER BY (user_id, date, project_id, language, data_version)
        "#,
    ),
    (
        "project_editor_daily",
        r#"
        CREATE TABLE IF NOT EXISTS wakaclock.project_editor_daily (
            user_id UUID,
            date Date,
            project_id UUID,
            editor String,
            ai_client String,
            total_seconds Float64,
            heartbeat_count UInt64,
            data_version UInt64
        ) ENGINE = MergeTree()
        ORDER BY (user_id, date, project_id, editor, ai_client, data_version)
        "#,
    ),
    (
        "project_activity_daily",
        r#"
        CREATE TABLE IF NOT EXISTS wakaclock.project_activity_daily (
            user_id UUID,
            date Date,
            project_id UUID,
            branch String,
            total_seconds Float64,
            heartbeat_count UInt64,
            ai_lines_added UInt64,
            ai_lines_deleted UInt64,
            human_lines_added UInt64,
            human_lines_deleted UInt64,
            unattributed_lines_added Nullable(UInt64),
            unattributed_lines_deleted Nullable(UInt64),
            data_version UInt64
        ) ENGINE = MergeTree()
        ORDER BY (user_id, date, project_id, branch, data_version)
        "#,
    ),
];

const SNAPSHOT_INSERTS: &[(&str, &str)] = &[
    (
        "machine_daily",
        r#"
        INSERT INTO wakaclock.machine_daily
        SELECT
            user_id,
            date,
            lower(hex(SHA256(if(empty(machine), 'unknown', machine)))) AS machine_key,
            if(empty(machine), 'Unknown', concat('Machine ', substring(hex(SHA256(machine)), 1, 8))) AS machine_display_name,
            sum(ifNull(active_seconds, 0.0)) AS active_seconds,
            count() AS heartbeat_count,
            __DATA_VERSION__ AS data_version
        FROM wakaclock.heartbeats
        WHERE user_id = ? AND toDate(date) BETWEEN toDate(?) AND toDate(?)
        GROUP BY user_id, date, machine_key, machine_display_name
        "#,
    ),
    (
        "ai_model_daily",
        r#"
        INSERT INTO wakaclock.ai_model_daily
        SELECT
            source.user_id, source.date, source.provider, source.model,
            sum(source.ai_events) AS ai_events,
            sum(source.ai_lines_added) AS ai_lines_added,
            sum(source.ai_lines_deleted) AS ai_lines_deleted,
            sum(source.prompts) AS prompts,
            uniqExactIf(source.ai_session_id, source.ai_session_id != '') AS sessions,
            sum(source.input_tokens) AS input_tokens,
            sum(source.output_tokens) AS output_tokens,
            sum(source.cache_read_tokens) AS cache_read_tokens,
            sum(source.cache_write_tokens) AS cache_write_tokens,
            CAST(if(sum(source.total_reported_tokens) = 0 OR sum(source.unpriced_tokens) > 0, NULL, sum(source.cost_microusd)) AS Nullable(UInt64)) AS estimated_cost_microusd,
            sum(source.priced_tokens) AS priced_tokens,
            sum(source.total_reported_tokens) AS total_reported_tokens,
            __DATA_VERSION__ AS data_version
        FROM (
            SELECT
                user_id, date,
                ifNull(ai_provider, 'Unknown') AS provider,
                ifNull(ai_model, 'Unknown') AS model,
                toUInt64(1) AS ai_events,
                toUInt64(ifNull(ai_lines_added, 0)) AS ai_lines_added,
                toUInt64(ifNull(ai_lines_deleted, 0)) AS ai_lines_deleted,
                toUInt64(0) AS prompts,
                '' AS ai_session_id,
                toUInt64(0) AS input_tokens, toUInt64(0) AS output_tokens,
                toUInt64(0) AS cache_read_tokens, toUInt64(0) AS cache_write_tokens,
                toUInt64(0) AS cost_microusd, toUInt64(0) AS priced_tokens,
                toUInt64(0) AS total_reported_tokens, toUInt64(0) AS unpriced_tokens
            FROM wakaclock.heartbeats AS heartbeat
            WHERE heartbeat.user_id = ? AND toDate(heartbeat.date) BETWEEN toDate(?) AND toDate(?) AND heartbeat.is_ai_generated
            UNION ALL
            SELECT
                usage.user_id, usage.date,
                ifNull(usage.ai_provider, 'Unknown') AS provider,
                ifNull(usage.ai_model, 'Unknown') AS model,
                toUInt64(0) AS ai_events, toUInt64(0) AS ai_lines_added, toUInt64(0) AS ai_lines_deleted,
                toUInt64(usage.prompt_count) AS prompts,
                usage.ai_session_id,
                toUInt64(ifNull(usage.input_tokens, 0)), toUInt64(ifNull(usage.output_tokens, 0)),
                toUInt64(ifNull(usage.cache_read_tokens, 0)), toUInt64(ifNull(usage.cache_write_tokens, 0)),
                toUInt64(ifNull(usage.estimated_cost_microusd, 0)),
                if(isNull(usage.estimated_cost_microusd), toUInt64(0), toUInt64(ifNull(usage.input_tokens, 0) + ifNull(usage.output_tokens, 0) + ifNull(usage.cache_read_tokens, 0) + ifNull(usage.cache_write_tokens, 0))),
                toUInt64(ifNull(usage.input_tokens, 0) + ifNull(usage.output_tokens, 0) + ifNull(usage.cache_read_tokens, 0) + ifNull(usage.cache_write_tokens, 0)),
                if(isNull(usage.estimated_cost_microusd), toUInt64(ifNull(usage.input_tokens, 0) + ifNull(usage.output_tokens, 0) + ifNull(usage.cache_read_tokens, 0) + ifNull(usage.cache_write_tokens, 0)), toUInt64(0))
            FROM wakaclock.ai_usage_events AS usage FINAL
            WHERE usage.user_id = ? AND toDate(usage.date) BETWEEN toDate(?) AND toDate(?)
        ) AS source
        GROUP BY source.user_id, source.date, source.provider, source.model
        "#,
    ),
    (
        "ai_client_daily",
        r#"
        INSERT INTO wakaclock.ai_client_daily
        SELECT
            source.user_id, source.date, source.ai_agent, source.ai_client, source.editor,
            sum(source.active_seconds) AS active_seconds,
            sum(source.ai_events) AS ai_events,
            uniqExactIf(source.ai_session_id, source.ai_session_id != '') AS sessions,
            sum(source.ai_lines_changed) AS ai_lines_changed,
            __DATA_VERSION__ AS data_version
        FROM (
            SELECT
                user_id, date,
                ifNull(ai_agent, 'Unknown') AS ai_agent,
                if(empty(editor) OR editor = 'wakaclock-ai-sync', ifNull(ai_agent, 'Unknown'), concat(ifNull(ai_agent, 'Unknown'), ' ', editor)) AS ai_client,
                if(empty(editor), 'Unknown', editor) AS editor,
                toFloat64(ifNull(active_seconds, 0.0)) AS active_seconds,
                toUInt64(1) AS ai_events,
                '' AS ai_session_id,
                toUInt64(ifNull(ai_lines_added, 0) + ifNull(ai_lines_deleted, 0)) AS ai_lines_changed
            FROM wakaclock.heartbeats AS heartbeat
            WHERE heartbeat.user_id = ? AND toDate(heartbeat.date) BETWEEN toDate(?) AND toDate(?) AND heartbeat.is_ai_generated
            UNION ALL
            SELECT
                usage.user_id, usage.date,
                usage.ai_agent,
                usage.ai_agent AS ai_client,
                'Unknown' AS editor,
                toFloat64(0) AS active_seconds,
                toUInt64(0) AS ai_events,
                usage.ai_session_id,
                toUInt64(0) AS ai_lines_changed
            FROM wakaclock.ai_usage_events AS usage FINAL
            WHERE usage.user_id = ? AND toDate(usage.date) BETWEEN toDate(?) AND toDate(?)
        ) AS source
        GROUP BY source.user_id, source.date, source.ai_agent, source.ai_client, source.editor
        "#,
    ),
    (
        "ai_project_daily",
        r#"
        INSERT INTO wakaclock.ai_project_daily
        SELECT
            source.user_id, source.date, source.project_id,
            sum(source.total_seconds) AS total_seconds,
            sum(source.ai_lines_added) AS ai_lines_added,
            sum(source.ai_lines_deleted) AS ai_lines_deleted,
            sum(source.human_lines_added) AS human_lines_added,
            sum(source.human_lines_deleted) AS human_lines_deleted,
            sum(toUInt64(ifNull(source.unattributed_lines_added, 0))) AS unattributed_lines_added,
            sum(toUInt64(ifNull(source.unattributed_lines_deleted, 0))) AS unattributed_lines_deleted,
            CAST(if(sum(source.has_usage) = 0, NULL, sum(source.prompts)) AS Nullable(UInt64)) AS prompts,
            CAST(if(sum(source.has_usage) = 0, NULL, uniqExactIf(source.ai_session_id, source.ai_session_id != '')) AS Nullable(UInt64)) AS sessions,
            CAST(if(sum(source.has_usage) = 0, NULL, sum(source.input_tokens)) AS Nullable(UInt64)) AS input_tokens,
            CAST(if(sum(source.has_usage) = 0, NULL, sum(source.output_tokens)) AS Nullable(UInt64)) AS output_tokens,
            CAST(if(sum(source.has_usage) = 0, NULL, sum(source.cache_read_tokens)) AS Nullable(UInt64)) AS cache_read_tokens,
            CAST(if(sum(source.has_usage) = 0, NULL, sum(source.cache_write_tokens)) AS Nullable(UInt64)) AS cache_write_tokens,
            CAST(if(sum(source.has_usage) = 0 OR sum(source.total_reported_tokens) = 0 OR sum(source.unpriced_tokens) > 0, NULL, sum(source.cost_microusd)) AS Nullable(UInt64)) AS estimated_cost_microusd,
            CAST(if(sum(source.has_usage) = 0, NULL, sum(source.priced_tokens)) AS Nullable(UInt64)) AS priced_tokens,
            CAST(if(sum(source.has_usage) = 0, NULL, sum(source.total_reported_tokens)) AS Nullable(UInt64)) AS total_reported_tokens,
            __DATA_VERSION__ AS data_version
        FROM (
            SELECT
                user_id, date, project_id,
                toFloat64(ifNull(active_seconds, 0.0)) AS total_seconds,
                toUInt64(ifNull(ai_lines_added, 0)) AS ai_lines_added,
                toUInt64(ifNull(ai_lines_deleted, 0)) AS ai_lines_deleted,
                toUInt64(ifNull(human_lines_added, 0)) AS human_lines_added,
                toUInt64(ifNull(human_lines_deleted, 0)) AS human_lines_deleted,
                toUInt64(ifNull(unattributed_lines_added, 0)) AS unattributed_lines_added,
                toUInt64(ifNull(unattributed_lines_deleted, 0)) AS unattributed_lines_deleted,
                toUInt64(0) AS has_usage, toUInt64(0) AS prompts, '' AS ai_session_id,
                toUInt64(0) AS input_tokens, toUInt64(0) AS output_tokens,
                toUInt64(0) AS cache_read_tokens, toUInt64(0) AS cache_write_tokens,
                toUInt64(0) AS cost_microusd, toUInt64(0) AS priced_tokens,
                toUInt64(0) AS total_reported_tokens, toUInt64(0) AS unpriced_tokens
            FROM wakaclock.heartbeats AS heartbeat
            WHERE heartbeat.user_id = ? AND toDate(heartbeat.date) BETWEEN toDate(?) AND toDate(?) AND heartbeat.project_id IS NOT NULL
            UNION ALL
            SELECT
                usage.user_id, usage.date, usage.project_id,
                toFloat64(0) AS total_seconds,
                toUInt64(0) AS ai_lines_added, toUInt64(0) AS ai_lines_deleted,
                toUInt64(0) AS human_lines_added, toUInt64(0) AS human_lines_deleted,
                toUInt64(0) AS unattributed_lines_added, toUInt64(0) AS unattributed_lines_deleted,
                toUInt64(1) AS has_usage, toUInt64(usage.prompt_count) AS prompts, usage.ai_session_id,
                toUInt64(ifNull(usage.input_tokens, 0)), toUInt64(ifNull(usage.output_tokens, 0)),
                toUInt64(ifNull(usage.cache_read_tokens, 0)), toUInt64(ifNull(usage.cache_write_tokens, 0)),
                toUInt64(ifNull(usage.estimated_cost_microusd, 0)),
                if(isNull(usage.estimated_cost_microusd), toUInt64(0), toUInt64(ifNull(usage.input_tokens, 0) + ifNull(usage.output_tokens, 0) + ifNull(usage.cache_read_tokens, 0) + ifNull(usage.cache_write_tokens, 0))),
                toUInt64(ifNull(usage.input_tokens, 0) + ifNull(usage.output_tokens, 0) + ifNull(usage.cache_read_tokens, 0) + ifNull(usage.cache_write_tokens, 0)),
                if(isNull(usage.estimated_cost_microusd), toUInt64(ifNull(usage.input_tokens, 0) + ifNull(usage.output_tokens, 0) + ifNull(usage.cache_read_tokens, 0) + ifNull(usage.cache_write_tokens, 0)), toUInt64(0))
            FROM wakaclock.ai_usage_events AS usage FINAL
            WHERE usage.user_id = ? AND toDate(usage.date) BETWEEN toDate(?) AND toDate(?) AND usage.project_id IS NOT NULL
        ) AS source
        GROUP BY source.user_id, source.date, source.project_id
        "#,
    ),
];

/// Project drill-down aggregates are kept in separate tables because file and branch
/// cardinality would make the account overview unnecessarily expensive. `project_id` is
/// resolved at heartbeat ingest; rows without one are intentionally omitted rather than
/// guessed into a project before the historical backfill is run.
const PROJECT_DETAIL_SNAPSHOT_INSERTS: &[(&str, &str)] = &[
    (
        "project_file_daily",
        r#"
        INSERT INTO wakaclock.project_file_daily
        SELECT
            user_id,
            date,
            assumeNotNull(project_id) AS project_id,
            lower(hex(SHA256(entity))) AS entity_key,
            if(startsWith(entity, '/') OR position(entity, '..') > 0,
                replaceRegexpOne(entity, '^.*/', ''), entity) AS relative_path,
            if(empty(ifNull(language, '')), 'Unknown', ifNull(language, '')) AS language,
            if(empty(ifNull(branch, '')), 'Unknown', ifNull(branch, '')) AS branch,
            sum(ifNull(active_seconds, 0.0)) AS total_seconds,
            count() AS heartbeat_count,
            sum(toUInt64(ifNull(ai_lines_added, 0))) AS ai_lines_added,
            sum(toUInt64(ifNull(ai_lines_deleted, 0))) AS ai_lines_deleted,
            sum(toUInt64(ifNull(human_lines_added, 0))) AS human_lines_added,
            sum(toUInt64(ifNull(human_lines_deleted, 0))) AS human_lines_deleted,
            sum(toUInt64(ifNull(unattributed_lines_added, 0))) AS unattributed_lines_added,
            sum(toUInt64(ifNull(unattributed_lines_deleted, 0))) AS unattributed_lines_deleted,
            __DATA_VERSION__ AS data_version
        FROM wakaclock.heartbeats
        WHERE user_id = ? AND toDate(date) BETWEEN toDate(?) AND toDate(?) AND project_id IS NOT NULL
        GROUP BY user_id, date, project_id, entity_key, relative_path, language, branch
        "#,
    ),
    (
        "project_branch_daily",
        r#"
        INSERT INTO wakaclock.project_branch_daily
        SELECT
            user_id,
            date,
            assumeNotNull(project_id) AS project_id,
            if(empty(ifNull(branch, '')), 'Unknown', ifNull(branch, '')) AS branch,
            sum(ifNull(active_seconds, 0.0)) AS total_seconds,
            count() AS heartbeat_count,
            sum(toUInt64(ifNull(ai_lines_added, 0))) AS ai_lines_added,
            sum(toUInt64(ifNull(ai_lines_deleted, 0))) AS ai_lines_deleted,
            sum(toUInt64(ifNull(human_lines_added, 0))) AS human_lines_added,
            sum(toUInt64(ifNull(human_lines_deleted, 0))) AS human_lines_deleted,
            sum(toUInt64(ifNull(unattributed_lines_added, 0))) AS unattributed_lines_added,
            sum(toUInt64(ifNull(unattributed_lines_deleted, 0))) AS unattributed_lines_deleted,
            __DATA_VERSION__ AS data_version
        FROM wakaclock.heartbeats
        WHERE user_id = ? AND toDate(date) BETWEEN toDate(?) AND toDate(?) AND project_id IS NOT NULL
        GROUP BY user_id, date, project_id, branch
        "#,
    ),
    (
        "project_language_daily",
        r#"
        INSERT INTO wakaclock.project_language_daily
        SELECT
            user_id,
            date,
            assumeNotNull(project_id) AS project_id,
            if(empty(ifNull(language, '')), 'Unknown', ifNull(language, '')) AS language,
            sum(ifNull(active_seconds, 0.0)) AS total_seconds,
            count() AS heartbeat_count,
            __DATA_VERSION__ AS data_version
        FROM wakaclock.heartbeats
        WHERE user_id = ? AND toDate(date) BETWEEN toDate(?) AND toDate(?) AND project_id IS NOT NULL
        GROUP BY user_id, date, project_id, language
        "#,
    ),
    (
        "project_editor_daily",
        r#"
        INSERT INTO wakaclock.project_editor_daily
        SELECT
            user_id,
            date,
            assumeNotNull(project_id) AS project_id,
            if(empty(editor), 'Unknown', editor) AS editor,
            if(is_ai_generated,
                if(empty(editor), ifNull(ai_agent, 'Unknown'), concat(ifNull(ai_agent, 'Unknown'), ' ', editor)),
                'Human') AS ai_client,
            sum(ifNull(active_seconds, 0.0)) AS total_seconds,
            count() AS heartbeat_count,
            __DATA_VERSION__ AS data_version
        FROM wakaclock.heartbeats
        WHERE user_id = ? AND toDate(date) BETWEEN toDate(?) AND toDate(?) AND project_id IS NOT NULL
        GROUP BY user_id, date, project_id, editor, ai_client
        "#,
    ),
    (
        "project_activity_daily",
        r#"
        INSERT INTO wakaclock.project_activity_daily
        SELECT
            user_id,
            date,
            assumeNotNull(project_id) AS project_id,
            if(empty(ifNull(branch, '')), 'Unknown', ifNull(branch, '')) AS branch,
            sum(ifNull(active_seconds, 0.0)) AS total_seconds,
            count() AS heartbeat_count,
            sum(toUInt64(ifNull(ai_lines_added, 0))) AS ai_lines_added,
            sum(toUInt64(ifNull(ai_lines_deleted, 0))) AS ai_lines_deleted,
            sum(toUInt64(ifNull(human_lines_added, 0))) AS human_lines_added,
            sum(toUInt64(ifNull(human_lines_deleted, 0))) AS human_lines_deleted,
            sum(toUInt64(ifNull(unattributed_lines_added, 0))) AS unattributed_lines_added,
            sum(toUInt64(ifNull(unattributed_lines_deleted, 0))) AS unattributed_lines_deleted,
            __DATA_VERSION__ AS data_version
        FROM wakaclock.heartbeats
        WHERE user_id = ? AND toDate(date) BETWEEN toDate(?) AND toDate(?) AND project_id IS NOT NULL
        GROUP BY user_id, date, project_id, branch
        "#,
    ),
];

#[cfg(test)]
mod tests {
    use uuid::Uuid;

    use crate::repository::ai_usage::AiUsageRepository;
    use crate::repository::heartbeat::HeartbeatRepository;

    use super::AccountAnalyticsRepository;

    #[tokio::test]
    #[ignore = "requires an isolated ClickHouse 24.10 instance via CLICKHOUSE_TEST_URL"]
    async fn snapshot_rebuild_queries_parse_without_alias_collisions() {
        let clickhouse = crate::test_support::clickhouse_client().await;
        HeartbeatRepository::new(clickhouse.clone())
            .migrate()
            .await
            .unwrap();
        AiUsageRepository::new(clickhouse.clone())
            .migrate()
            .await
            .unwrap();

        let repo = AccountAnalyticsRepository::new(clickhouse);
        repo.migrate().await.unwrap();
        repo.build_snapshot(Uuid::new_v4(), "2026-08-01", "2026-08-01", 1)
            .await
            .unwrap();
    }
}
