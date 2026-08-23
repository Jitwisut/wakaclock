use anyhow::{Context, Result};
use std::sync::Arc;

use crate::infrastructure::database::ClickHouseClient;
use crate::model::date_range::ResolvedRange;
use crate::model::heartbeat::{ActivityIntervalRow, HeartbeatRow};

pub struct HeartbeatRepository {
    client: Arc<ClickHouseClient>,
}

impl HeartbeatRepository {
    pub fn new(client: Arc<ClickHouseClient>) -> Self {
        Self { client }
    }

    /// รัน Migration สร้างตาราง
    pub async fn migrate(&self) -> Result<()> {
        let ch_client = self.client.get_client();
        ch_client
            .query(
                r#"
                CREATE TABLE IF NOT EXISTS wakaclock.heartbeats (
                    user_id UUID,
                    entity String,
                    entity_type String,
                    time Float64,
                    date Date DEFAULT toDate(toDateTime(toUInt32(time))),
                    project Nullable(String),
                    project_id Nullable(UUID),
                    branch Nullable(String),
                    language Nullable(String),
                    dependencies Array(String),
                    lines Nullable(UInt32),
                    line_number Nullable(UInt32),
                    cursor_position Nullable(UInt32),
                    is_write UInt8,
                    category String,
                    editor String,
                    operating_system String,
                    machine String,
                    user_agent String,
                    heartbeat_id Nullable(String),
                    ast_language Nullable(String),
                    ast_confidence Nullable(Float32),
                    keystrokes Nullable(UInt32),
                    chars_added Nullable(UInt32),
                    chars_deleted Nullable(UInt32),
                    active_seconds Nullable(Float64),
                    activity_segments String DEFAULT '[]',
                    is_ai_generated UInt8,
                    ai_agent Nullable(String),
                    ai_provider Nullable(String),
                    ai_model Nullable(String),
                    ai_source Nullable(String),
                    ai_confidence Nullable(String),
                    ai_event_id Nullable(String),
                    ai_event_fingerprint Nullable(String),
                    ai_lines_added Nullable(UInt32),
                    ai_lines_deleted Nullable(UInt32),
                    human_lines_added Nullable(UInt32),
                    human_lines_deleted Nullable(UInt32),
                    unattributed_lines_added Nullable(UInt32),
                    unattributed_lines_deleted Nullable(UInt32),
                    created_at UInt32
                ) ENGINE = MergeTree()
                ORDER BY (user_id, date, time)
                "#,
            )
            .execute()
            .await
            .context("Failed to create heartbeats table")?;

        ch_client
            .query(
                "ALTER TABLE wakaclock.heartbeats
                 ADD COLUMN IF NOT EXISTS active_seconds Nullable(Float64)
                 AFTER chars_deleted",
            )
            .execute()
            .await
            .context("Failed to add heartbeats.active_seconds column")?;

        for column in [
            "heartbeat_id Nullable(String)",
            "activity_segments String DEFAULT '[]'",
        ] {
            let sql = format!("ALTER TABLE wakaclock.heartbeats ADD COLUMN IF NOT EXISTS {column}");
            ch_client
                .query(&sql)
                .execute()
                .await
                .with_context(|| format!("Failed to add heartbeats column: {column}"))?;
        }

        for column in [
            "ai_provider Nullable(String)",
            "ai_model Nullable(String)",
            "ai_source Nullable(String)",
            "ai_confidence Nullable(String)",
            "ai_event_id Nullable(String)",
            "ai_event_fingerprint Nullable(String)",
            "human_lines_added Nullable(UInt32)",
            "human_lines_deleted Nullable(UInt32)",
            "unattributed_lines_added Nullable(UInt32)",
            "unattributed_lines_deleted Nullable(UInt32)",
            "head_revision Nullable(String)",
            "repository_id Nullable(UUID)",
            "machine_name_hash Nullable(String)",
            "hostname_hash Nullable(String)",
            "timezone Nullable(String)",
            "feature_id Nullable(String)",
            "feature_name Nullable(String)",
            "ai_change_id Nullable(String)",
            "prompt_character_count Nullable(UInt64)",
            "input_tokens Nullable(UInt64)",
            "output_tokens Nullable(UInt64)",
            "cache_read_tokens Nullable(UInt64)",
            "cache_write_tokens Nullable(UInt64)",
            "ai_subscription_plan Nullable(String)",
            "token_source Nullable(String)",
            "attribution_source Nullable(String)",
            "attribution_confidence Nullable(Float32)",
        ] {
            let sql = format!("ALTER TABLE wakaclock.heartbeats ADD COLUMN IF NOT EXISTS {column}");
            ch_client
                .query(&sql)
                .execute()
                .await
                .with_context(|| format!("Failed to add heartbeats column: {column}"))?;
        }

        ch_client
            .query(
                "CREATE TABLE IF NOT EXISTS wakaclock.heartbeats_incoming
                 AS wakaclock.heartbeats
                 ENGINE = Null",
            )
            .execute()
            .await
            .context("Failed to create heartbeats_incoming table")?;

        ch_client
            .query(
                "CREATE TABLE IF NOT EXISTS wakaclock.activity_intervals (
                    user_id UUID,
                    segment_id String,
                    heartbeat_id String,
                    `start` Float64,
                    `end` Float64,
                    source String,
                    entity String,
                    project Nullable(String),
                    language Nullable(String),
                    category String,
                    created_at UInt32
                 ) ENGINE = ReplacingMergeTree(created_at)
                 ORDER BY (user_id, segment_id)",
            )
            .execute()
            .await
            .context("Failed to create activity_intervals table")?;

        ch_client
            .query(
                "ALTER TABLE wakaclock.heartbeats_incoming
                 ADD COLUMN IF NOT EXISTS active_seconds Nullable(Float64)
                 AFTER chars_deleted",
            )
            .execute()
            .await
            .context("Failed to add heartbeats_incoming.active_seconds column")?;

        for column in [
            "heartbeat_id Nullable(String)",
            "activity_segments String DEFAULT '[]'",
        ] {
            let sql = format!(
                "ALTER TABLE wakaclock.heartbeats_incoming ADD COLUMN IF NOT EXISTS {column}"
            );
            ch_client
                .query(&sql)
                .execute()
                .await
                .with_context(|| format!("Failed to add heartbeats_incoming column: {column}"))?;
        }

        for column in [
            "ai_provider Nullable(String)",
            "ai_model Nullable(String)",
            "ai_source Nullable(String)",
            "ai_confidence Nullable(String)",
            "ai_event_id Nullable(String)",
            "ai_event_fingerprint Nullable(String)",
            "human_lines_added Nullable(UInt32)",
            "human_lines_deleted Nullable(UInt32)",
            "unattributed_lines_added Nullable(UInt32)",
            "unattributed_lines_deleted Nullable(UInt32)",
            "head_revision Nullable(String)",
            "repository_id Nullable(UUID)",
            "machine_name_hash Nullable(String)",
            "hostname_hash Nullable(String)",
            "timezone Nullable(String)",
            "feature_id Nullable(String)",
            "feature_name Nullable(String)",
            "ai_change_id Nullable(String)",
            "prompt_character_count Nullable(UInt64)",
            "input_tokens Nullable(UInt64)",
            "output_tokens Nullable(UInt64)",
            "cache_read_tokens Nullable(UInt64)",
            "cache_write_tokens Nullable(UInt64)",
            "ai_subscription_plan Nullable(String)",
            "token_source Nullable(String)",
            "attribution_source Nullable(String)",
            "attribution_confidence Nullable(Float32)",
        ] {
            let sql = format!(
                "ALTER TABLE wakaclock.heartbeats_incoming ADD COLUMN IF NOT EXISTS {column}"
            );
            ch_client
                .query(&sql)
                .execute()
                .await
                .with_context(|| format!("Failed to add heartbeats_incoming column: {column}"))?;
        }

        Ok(())
    }

    /// Insert heartbeats ลงใน ClickHouse
    pub async fn insert_batch(&self, rows: Vec<HeartbeatRow>) -> Result<()> {
        if rows.is_empty() {
            return Ok(());
        }

        let ch_client = self.client.get_client();
        let mut insert = ch_client
            .insert("wakaclock.heartbeats")
            .map_err(|e| anyhow::anyhow!("ClickHouse insert Error: {e}"))?;

        for row in rows {
            insert
                .write(&row)
                .await
                .map_err(|e| anyhow::anyhow!("ClickHouse write row Error: {e}"))?;
        }

        insert
            .end()
            .await
            .map_err(|e| anyhow::anyhow!("ClickHouse end insert Error: {e}"))?;

        Ok(())
    }

    pub async fn insert_activity_intervals(&self, rows: Vec<ActivityIntervalRow>) -> Result<()> {
        if rows.is_empty() {
            return Ok(());
        }
        let mut insert = self
            .client
            .get_client()
            .insert("wakaclock.activity_intervals")
            .map_err(|error| {
                anyhow::anyhow!("ClickHouse activity interval insert error: {error}")
            })?;
        for row in rows {
            insert.write(&row).await.map_err(|error| {
                anyhow::anyhow!("ClickHouse activity interval row error: {error}")
            })?;
        }
        insert.end().await.map_err(|error| {
            anyhow::anyhow!("ClickHouse activity interval flush error: {error}")
        })?;
        Ok(())
    }

    /// Returns AI event IDs already persisted for this user. The explicit ID check covers
    /// retries whose timestamp changed enough to land in another date partition.
    pub async fn existing_ai_event_ids(
        &self,
        user_id: uuid::Uuid,
        candidates: &[String],
    ) -> Result<Vec<String>> {
        if candidates.is_empty() {
            return Ok(Vec::new());
        }
        #[derive(serde::Deserialize, clickhouse::Row)]
        struct IdRow {
            ai_event_id: String,
        }
        let rows = self
            .client
            .get_client()
            .query(
                "SELECT assumeNotNull(ai_event_id) AS ai_event_id
                 FROM wakaclock.heartbeats
                 WHERE user_id = ? AND ai_event_id IS NOT NULL AND ai_event_id IN ?",
            )
            .bind(user_id)
            .bind(candidates)
            .fetch_all::<IdRow>()
            .await
            .map_err(|error| anyhow::anyhow!("ClickHouse AI event id query failed: {error}"))?;
        Ok(rows.into_iter().map(|row| row.ai_event_id).collect())
    }

    /// Returns transport heartbeat IDs already persisted. This makes an accepted
    /// request safe to replay after an offline queue/remove failure.
    pub async fn existing_heartbeat_ids(
        &self,
        user_id: uuid::Uuid,
        candidates: &[String],
    ) -> Result<Vec<String>> {
        if candidates.is_empty() {
            return Ok(Vec::new());
        }
        #[derive(serde::Deserialize, clickhouse::Row)]
        struct IdRow {
            heartbeat_id: String,
        }
        let rows = self
            .client
            .get_client()
            .query(
                "SELECT assumeNotNull(heartbeat_id) AS heartbeat_id
                 FROM wakaclock.heartbeats
                 WHERE user_id = ? AND heartbeat_id IS NOT NULL AND heartbeat_id IN ?",
            )
            .bind(user_id)
            .bind(candidates)
            .fetch_all::<IdRow>()
            .await
            .map_err(|error| anyhow::anyhow!("ClickHouse heartbeat ID query failed: {error}"))?;
        Ok(rows.into_iter().map(|row| row.heartbeat_id).collect())
    }

    /// Returns fingerprints already persisted for this user. Fingerprints bridge two
    /// transports (agent hook and transcript replay) that may not share an event ID.
    pub async fn existing_ai_fingerprints(
        &self,
        user_id: uuid::Uuid,
        candidates: &[String],
    ) -> Result<Vec<String>> {
        if candidates.is_empty() {
            return Ok(Vec::new());
        }
        #[derive(serde::Deserialize, clickhouse::Row)]
        struct FingerprintRow {
            ai_event_fingerprint: String,
        }
        let rows = self
            .client
            .get_client()
            .query(
                "SELECT assumeNotNull(ai_event_fingerprint) AS ai_event_fingerprint
                 FROM wakaclock.heartbeats
                 WHERE user_id = ? AND ai_event_fingerprint IS NOT NULL
                   AND ai_event_fingerprint IN ?",
            )
            .bind(user_id)
            .bind(candidates)
            .fetch_all::<FingerprintRow>()
            .await
            .map_err(|error| anyhow::anyhow!("ClickHouse AI fingerprint query failed: {error}"))?;
        Ok(rows
            .into_iter()
            .map(|row| row.ai_event_fingerprint)
            .collect())
    }

    /// WakaTime-compatible bulk deletion. Heartbeat IDs are opaque transport
    /// identifiers; clients can only delete rows belonging to their own user.
    pub async fn delete_ids(&self, user_id: uuid::Uuid, heartbeat_ids: &[String]) -> Result<u64> {
        if heartbeat_ids.is_empty() {
            return Ok(0);
        }
        let query = self
            .client
            .get_client()
            .query(
                "ALTER TABLE wakaclock.heartbeats DELETE
                 WHERE user_id = ? AND heartbeat_id IN ?",
            )
            .bind(user_id)
            .bind(heartbeat_ids);
        query
            .execute()
            .await
            .map_err(|error| anyhow::anyhow!("ClickHouse heartbeat deletion failed: {error}"))?;
        Ok(heartbeat_ids.len() as u64)
    }

    /// Query heartbeats for one calendar day in the user's timezone.
    ///
    /// The stored `date` column is UTC-oriented and is retained for existing
    /// projections. Filtering by raw timestamp bounds instead makes a selected
    /// browser day correct for Asia/Bangkok, DST zones, and every other IANA timezone.
    pub async fn get_by_date(
        &self,
        user_id: uuid::Uuid,
        range: &ResolvedRange,
    ) -> Result<Vec<HeartbeatRow>> {
        let ch_client = self.client.get_client();
        let (start_epoch, end_epoch) = range.unix_bounds();

        let rows = ch_client
            .query(
                // Column order must match `HeartbeatRow` field order exactly — the client
                // decodes positionally, so an omitted or reordered column misaligns every
                // field after it rather than failing cleanly.
                "SELECT
                    user_id, entity, entity_type, time, date,
                    project, project_id, branch, head_revision, repository_id,
                    language, dependencies,
                    lines, line_number, cursor_position,
                    is_write, category, editor, operating_system,
                    machine, user_agent, machine_name_hash, hostname_hash, timezone,
                    feature_id, feature_name,
                    heartbeat_id, ast_language, ast_confidence,
                    keystrokes, chars_added, chars_deleted, active_seconds, activity_segments,
                    is_ai_generated, ai_agent, ai_provider, ai_model, ai_source,
                    ai_confidence, ai_event_id, ai_change_id,
                    prompt_character_count, input_tokens, output_tokens,
                    cache_read_tokens, cache_write_tokens, ai_subscription_plan,
                    token_source, attribution_source, attribution_confidence,
                    ai_event_fingerprint,
                    ai_lines_added, ai_lines_deleted,
                    human_lines_added, human_lines_deleted,
                    unattributed_lines_added, unattributed_lines_deleted,
                    created_at
                FROM wakaclock.heartbeats
                WHERE user_id = ? AND time >= ? AND time < ?
                ORDER BY time ASC",
            )
            .bind(user_id)
            .bind(start_epoch)
            .bind(end_epoch)
            .fetch_all::<HeartbeatRow>()
            .await
            .map_err(|e| anyhow::anyhow!("ClickHouse query error: {e}"))?;

        Ok(rows)
    }
}
