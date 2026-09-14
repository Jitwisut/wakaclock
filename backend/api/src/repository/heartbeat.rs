use anyhow::{Context, Result};
use std::{collections::HashMap, sync::Arc};

use crate::infrastructure::database::ClickHouseClient;
use crate::model::date_range::ResolvedRange;
use crate::model::heartbeat::{ActivityIntervalRow, HeartbeatRow};
use crate::repository::canonical::canonical_winner_relation;

pub struct HeartbeatRepository {
    client: Arc<ClickHouseClient>,
}

/// Metadata selected by the K3 shadow verifier.  This deliberately excludes
/// source text and the rest of the heartbeat payload; parity checks compare only
/// the fields that define the ingest contract.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HeartbeatVerificationProjection {
    pub entity: String,
    pub project: Option<String>,
    pub project_id: Option<uuid::Uuid>,
    pub actor_type: String,
    pub revision: u32,
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
                    identity_status Nullable(String),
                    identity_reason Nullable(String),
                    identity_source Nullable(String),
                    identity_schema_version Nullable(UInt8),
                    identity_turn_id Nullable(String),
                    identity_message_id Nullable(String),
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
                    created_at UInt32,
                    actor_type LowCardinality(String) DEFAULT multiIf(
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
                        actor_type = 'ai_verified'
                            AND lower(ifNull(ai_source, '')) = 'mcp', 0.95,
                        actor_type = 'ai_verified', 1.0,
                        actor_type = 'ai_inferred'
                            AND lower(ifNull(ai_confidence, '')) = 'correlated', 0.8,
                        actor_type = 'ai_inferred', 0.6,
                        0.0
                    ),
                    clipboard_tracking_version Nullable(UInt8),
                    copy_actions Nullable(UInt32),
                    paste_actions Nullable(UInt32),
                    copied_chars Nullable(UInt32),
                    copied_lines Nullable(UInt32),
                    pasted_chars Nullable(UInt32),
                    pasted_lines Nullable(UInt32),
                    paste_same_file_actions Nullable(UInt32),
                    paste_same_workspace_actions Nullable(UInt32),
                    paste_external_or_unknown_actions Nullable(UInt32),
                    revision UInt32 DEFAULT 0,
                    session_id Nullable(String)
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
            // `active_seconds` is clamped at ingest so the MV path and the canonical
            // timeline measure the same thing; the raw claim lands here instead of
            // being overwritten, so nothing a client sent is lost.
            "active_seconds_claimed Nullable(Float64)",
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
            "identity_status Nullable(String)",
            "identity_reason Nullable(String)",
            "identity_source Nullable(String)",
            "identity_schema_version Nullable(UInt8)",
            "identity_turn_id Nullable(String)",
            "identity_message_id Nullable(String)",
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
            "actor_type LowCardinality(String) DEFAULT multiIf(
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
            )",
            "actor_confidence Float32 DEFAULT multiIf(
                actor_type = 'human', 1.0,
                actor_type = 'ai_verified'
                    AND lower(ifNull(ai_source, '')) = 'mcp', 0.95,
                actor_type = 'ai_verified', 1.0,
                actor_type = 'ai_inferred'
                    AND lower(ifNull(ai_confidence, '')) = 'correlated', 0.8,
                actor_type = 'ai_inferred', 0.6,
                0.0
            )",
            "clipboard_tracking_version Nullable(UInt8)",
            "copy_actions Nullable(UInt32)",
            "paste_actions Nullable(UInt32)",
            "copied_chars Nullable(UInt32)",
            "copied_lines Nullable(UInt32)",
            "pasted_chars Nullable(UInt32)",
            "pasted_lines Nullable(UInt32)",
            "paste_same_file_actions Nullable(UInt32)",
            "paste_same_workspace_actions Nullable(UInt32)",
            "paste_external_or_unknown_actions Nullable(UInt32)",
            "revision UInt32 DEFAULT 0",
            "session_id Nullable(String)",
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
                    editor String DEFAULT '',
                    operating_system String DEFAULT '',
                    created_at UInt32,
                    actor_type LowCardinality(String) DEFAULT multiIf(
                        source = 'ai', 'ai_inferred',
                        source = 'editor', 'human',
                        'unknown'
                    ),
                    actor_confidence Float32 DEFAULT multiIf(
                        actor_type = 'human', 1.0,
                        actor_type = 'ai_verified', 1.0,
                        actor_type = 'ai_inferred', 0.6,
                        0.0
                    )
                 ) ENGINE = ReplacingMergeTree(created_at)
                 ORDER BY (user_id, segment_id)",
            )
            .execute()
            .await
            .context("Failed to create activity_intervals table")?;

        // Additive: an activity_intervals table created before the editor/OS breakdowns
        // moved onto the canonical timeline has neither column. Both default to '',
        // which groups as "unknown" rather than losing the interval.
        for column in [
            "editor String DEFAULT ''",
            "operating_system String DEFAULT ''",
            // Same reason, one release later: the project pages key on the stable id, so
            // the timeline has to carry it to be able to serve them.
            "project_id Nullable(UUID)",
            "branch Nullable(String)",
            "actor_type LowCardinality(String) DEFAULT multiIf(
                source = 'ai', 'ai_inferred',
                source = 'editor', 'human',
                'unknown'
            )",
            "actor_confidence Float32 DEFAULT multiIf(
                actor_type = 'human', 1.0,
                actor_type = 'ai_verified', 1.0,
                actor_type = 'ai_inferred', 0.6,
                0.0
            )",
        ] {
            let sql = format!(
                "ALTER TABLE wakaclock.activity_intervals ADD COLUMN IF NOT EXISTS {column}"
            );
            ch_client
                .query(&sql)
                .execute()
                .await
                .with_context(|| format!("Failed to add activity_intervals column: {column}"))?;
        }

        // Keep existing installations on the same actor default as the checked-in
        // migration. This changes only the default for future rows; it does not rewrite
        // historical intervals.
        ch_client
            .query(
                "ALTER TABLE wakaclock.activity_intervals
                 MODIFY COLUMN actor_type LowCardinality(String) DEFAULT multiIf(
                     source = 'ai', 'ai_inferred',
                     source = 'editor', 'human',
                     'unknown'
                 )",
            )
            .execute()
            .await
            .context("Failed to align activity_intervals.actor_type default")?;

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
            // The Null replay table is long-lived, so columns added to raw heartbeats
            // after its first CREATE ... AS must be mirrored explicitly.
            "active_seconds_claimed Nullable(Float64)",
            "clipboard_tracking_version Nullable(UInt8)",
            "copy_actions Nullable(UInt32)",
            "paste_actions Nullable(UInt32)",
            "copied_chars Nullable(UInt32)",
            "copied_lines Nullable(UInt32)",
            "pasted_chars Nullable(UInt32)",
            "pasted_lines Nullable(UInt32)",
            "paste_same_file_actions Nullable(UInt32)",
            "paste_same_workspace_actions Nullable(UInt32)",
            "paste_external_or_unknown_actions Nullable(UInt32)",
            "revision UInt32 DEFAULT 0",
            "session_id Nullable(String)",
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
            "identity_status Nullable(String)",
            "identity_reason Nullable(String)",
            "identity_source Nullable(String)",
            "identity_schema_version Nullable(UInt8)",
            "identity_turn_id Nullable(String)",
            "identity_message_id Nullable(String)",
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
            "actor_type LowCardinality(String) DEFAULT multiIf(
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
            )",
            "actor_confidence Float32 DEFAULT multiIf(
                actor_type = 'human', 1.0,
                actor_type = 'ai_verified'
                    AND lower(ifNull(ai_source, '')) = 'mcp', 0.95,
                actor_type = 'ai_verified', 1.0,
                actor_type = 'ai_inferred'
                    AND lower(ifNull(ai_confidence, '')) = 'correlated', 0.8,
                actor_type = 'ai_inferred', 0.6,
                0.0
            )",
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

        ch_client
            .query(
                "CREATE TABLE IF NOT EXISTS wakaclock.heartbeat_deletions (
            user_id UUID, heartbeat_id String, deleted_at DateTime64(3) DEFAULT now64(3)
        ) ENGINE = ReplacingMergeTree(deleted_at) ORDER BY (user_id, heartbeat_id)",
            )
            .execute()
            .await
            .context("Failed to create heartbeat tombstones")?;

        // Metadata-only identity repair audit.  The correction rows themselves live
        // in `heartbeats` as the next revision; these tables make the repair run and
        // before/after identity tuple inspectable without retaining transcript text,
        // prompts, patches, or source code.
        ch_client
            .query(
                "CREATE TABLE IF NOT EXISTS wakaclock.ai_identity_repair_runs (
                    repair_run_id UUID,
                    user_id UUID,
                    requested UInt32,
                    matched UInt32,
                    corrected UInt32,
                    unchanged UInt32,
                    unresolved UInt32,
                    conflicts UInt32,
                    preserved_heartbeats UInt32,
                    preserved_lines_added UInt64,
                    preserved_lines_deleted UInt64,
                    applied UInt8,
                    created_at DateTime
                 ) ENGINE = MergeTree
                 ORDER BY (user_id, created_at, repair_run_id)",
            )
            .execute()
            .await
            .context("Failed to create AI identity repair run audit")?;
        ch_client
            .query(
                "CREATE TABLE IF NOT EXISTS wakaclock.ai_identity_repair_corrections (
                    repair_run_id UUID,
                    user_id UUID,
                    ai_event_id String,
                    before_json String,
                    after_json String,
                    revision UInt32,
                    created_at DateTime
                 ) ENGINE = MergeTree
                 ORDER BY (user_id, ai_event_id, revision)",
            )
            .execute()
            .await
            .context("Failed to create AI identity repair correction audit")?;

        // Every read-side consumer uses this projection so a correction revision
        // replaces the original operation before durations or line counts are summed.
        // Materialized views continue to consume revision 0 only; the canonical view
        // is the authoritative path for interactive reads and rebuilds.
        let canonical_view = format!(
            "CREATE OR REPLACE VIEW wakaclock.heartbeats_canonical AS SELECT * FROM {}",
            canonical_winner_relation("1 = 1", "h")
        );
        ch_client
            .query(&canonical_view)
            .execute()
            .await
            .context("Failed to create canonical heartbeat view")?;

        Ok(())
    }

    /// Insert heartbeats ลงใน ClickHouse
    pub async fn insert_batch(&self, rows: Vec<HeartbeatRow>) -> Result<()> {
        self.insert_batch_with_token(rows, None).await
    }

    /// Kafka replay path can provide a stable ClickHouse insert-deduplication
    /// token.  The setting is deliberately opt-in so direct mode retains its
    /// historical query shape and materialized-view behaviour.
    pub async fn insert_batch_with_token(
        &self,
        rows: Vec<HeartbeatRow>,
        token: Option<&str>,
    ) -> Result<()> {
        if rows.is_empty() {
            return Ok(());
        }

        let ch_client = self.client.get_client();
        let mut insert = ch_client
            .insert("wakaclock.heartbeats")
            .map_err(|e| anyhow::anyhow!("ClickHouse insert Error: {e}"))?;
        if let Some(token) = token {
            insert = insert
                .with_option("async_insert", "0")
                .with_option("insert_deduplication_token", token);
        }

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
        self.insert_activity_intervals_with_token(rows, None).await
    }

    pub async fn insert_activity_intervals_with_token(
        &self,
        rows: Vec<ActivityIntervalRow>,
        token: Option<&str>,
    ) -> Result<()> {
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
        if let Some(token) = token {
            insert = insert
                .with_option("async_insert", "0")
                .with_option("insert_deduplication_token", token);
        }
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

    /// Return the projected segment IDs already present for one heartbeat.  The
    /// fact-sink uses this only on a replay that the raw revision lookup has
    /// classified as a duplicate: a crash after the raw insert but before the
    /// interval insert must still be repairable, while a normal duplicate must
    /// not append another interval row.
    pub async fn existing_activity_segment_ids(
        &self,
        user_id: uuid::Uuid,
        heartbeat_id: &str,
        candidates: &[String],
    ) -> Result<std::collections::HashSet<String>> {
        if candidates.is_empty() {
            return Ok(std::collections::HashSet::new());
        }
        #[derive(serde::Deserialize, clickhouse::Row)]
        struct SegmentRow {
            segment_id: String,
        }
        let rows = self
            .client
            .get_client()
            .query(
                "SELECT segment_id FROM wakaclock.activity_intervals
                 WHERE user_id = ? AND heartbeat_id = ? AND segment_id IN ?",
            )
            .bind(user_id)
            .bind(heartbeat_id)
            .bind(candidates)
            .fetch_all::<SegmentRow>()
            .await
            .map_err(|error| {
                anyhow::anyhow!("ClickHouse activity interval lookup failed: {error}")
            })?;
        Ok(rows.into_iter().map(|row| row.segment_id).collect())
    }

    /// Return the highest revision already stored for each transport heartbeat ID.
    /// A correction may reuse the same opaque ID with the next revision; a retry of
    /// the same revision remains idempotent.
    pub async fn existing_heartbeat_revisions(
        &self,
        user_id: uuid::Uuid,
        candidates: &[String],
    ) -> Result<HashMap<String, u32>> {
        if candidates.is_empty() {
            return Ok(HashMap::new());
        }
        #[derive(serde::Deserialize, clickhouse::Row)]
        struct RevisionRow {
            heartbeat_id: String,
            revision: u32,
        }
        let rows = self
            .client
            .get_client()
            .query(
                "SELECT assumeNotNull(heartbeat_id) AS heartbeat_id, max(revision) AS revision
                 FROM wakaclock.heartbeats
                 WHERE user_id = ? AND heartbeat_id IS NOT NULL AND heartbeat_id IN ?
                 GROUP BY heartbeat_id",
            )
            .bind(user_id)
            .bind(candidates)
            .fetch_all::<RevisionRow>()
            .await
            .map_err(|error| {
                anyhow::anyhow!("ClickHouse heartbeat revision query failed: {error}")
            })?;
        let mut revisions = rows
            .into_iter()
            .map(|row| (row.heartbeat_id, row.revision))
            .collect::<HashMap<_, _>>();
        #[derive(serde::Deserialize, clickhouse::Row)]
        struct TombstoneRow {
            heartbeat_id: String,
        }
        let tombstones = self
            .client
            .get_client()
            .query(
                "SELECT heartbeat_id FROM wakaclock.heartbeat_deletions
                 WHERE user_id = ? AND heartbeat_id IN ?",
            )
            .bind(user_id)
            .bind(candidates)
            .fetch_all::<TombstoneRow>()
            .await
            .map_err(|error| {
                anyhow::anyhow!("ClickHouse heartbeat tombstone query failed: {error}")
            })?;
        for tombstone in tombstones {
            revisions.insert(tombstone.heartbeat_id, u32::MAX);
        }
        Ok(revisions)
    }

    /// Session-scoped revision lookup for AI heartbeats. AI compatibility IDs are
    /// derived from an opaque event id and a producer is allowed to reuse that id
    /// in a new session; grouping by `(heartbeat_id, session_id)` prevents one
    /// session's correction from suppressing the other session's activity.
    pub async fn existing_heartbeat_revisions_scoped(
        &self,
        user_id: uuid::Uuid,
        candidates: &[String],
    ) -> Result<HashMap<(String, Option<String>), u32>> {
        if candidates.is_empty() {
            return Ok(HashMap::new());
        }
        #[derive(serde::Deserialize, clickhouse::Row)]
        struct RevisionRow {
            heartbeat_id: String,
            session_id: Option<String>,
            revision: u32,
        }
        let rows = self
            .client
            .get_client()
            .query(
                "SELECT assumeNotNull(heartbeat_id) AS heartbeat_id, session_id,
                        max(revision) AS revision
                 FROM wakaclock.heartbeats
                 WHERE user_id = ? AND heartbeat_id IS NOT NULL AND heartbeat_id IN ?
                 GROUP BY heartbeat_id, session_id",
            )
            .bind(user_id)
            .bind(candidates)
            .fetch_all::<RevisionRow>()
            .await
            .map_err(|error| {
                anyhow::anyhow!("ClickHouse scoped heartbeat revision query failed: {error}")
            })?;
        let mut revisions = rows
            .into_iter()
            .map(|row| ((row.heartbeat_id, row.session_id), row.revision))
            .collect::<HashMap<_, _>>();
        #[derive(serde::Deserialize, clickhouse::Row)]
        struct TombstoneRow {
            heartbeat_id: String,
        }
        let tombstones = self
            .client
            .get_client()
            .query(
                "SELECT heartbeat_id FROM wakaclock.heartbeat_deletions
                 WHERE user_id = ? AND heartbeat_id IN ?",
            )
            .bind(user_id)
            .bind(candidates)
            .fetch_all::<TombstoneRow>()
            .await
            .map_err(|error| {
                anyhow::anyhow!("ClickHouse heartbeat tombstone query failed: {error}")
            })?;
        for tombstone in tombstones {
            revisions.insert((tombstone.heartbeat_id, None), u32::MAX);
        }
        Ok(revisions)
    }

    pub async fn has_heartbeat_revision(
        &self,
        user_id: uuid::Uuid,
        heartbeat_id: &str,
        revision: u32,
    ) -> Result<bool> {
        #[derive(serde::Deserialize, clickhouse::Row)]
        struct FoundRow {
            found: u8,
        }
        let row = self
            .client
            .get_client()
            .query(
                "SELECT toUInt8(count() > 0) AS found
                 FROM wakaclock.heartbeats_canonical
                 WHERE user_id = ? AND heartbeat_id = ? AND revision = ?",
            )
            .bind(user_id)
            .bind(heartbeat_id)
            .bind(revision)
            .fetch_one::<FoundRow>()
            .await
            .map_err(|error| {
                anyhow::anyhow!("ClickHouse heartbeat verification query failed: {error}")
            })?;
        Ok(row.found != 0)
    }

    /// Return the canonical projection for one event revision.  The verifier
    /// uses this instead of a count-only existence check so a direct write and
    /// its Kafka shadow event must agree on project, actor attribution, revision
    /// and the privacy-safe entity representation.
    pub async fn heartbeat_verification_projection(
        &self,
        user_id: uuid::Uuid,
        heartbeat_id: &str,
        revision: u32,
    ) -> Result<Option<HeartbeatVerificationProjection>> {
        #[derive(serde::Deserialize, clickhouse::Row)]
        struct ProjectionRow {
            entity: String,
            project: Option<String>,
            #[serde(with = "clickhouse::serde::uuid::option")]
            project_id: Option<uuid::Uuid>,
            actor_type: String,
            revision: u32,
        }
        let relation = canonical_winner_relation(
            "h.user_id = ? AND h.heartbeat_id = ? AND h.revision = ?",
            "h",
        );
        let query = format!(
            "SELECT entity, project, project_id, actor_type, revision FROM {relation} LIMIT 1"
        );
        let row = self
            .client
            .get_client()
            .query(&query)
            .bind(user_id)
            .bind(heartbeat_id)
            .bind(revision)
            .fetch_optional::<ProjectionRow>()
            .await
            .map_err(|error| {
                anyhow::anyhow!("ClickHouse heartbeat verification query failed: {error}")
            })?;
        Ok(row.map(|row| HeartbeatVerificationProjection {
            entity: row.entity,
            project: row.project,
            project_id: row.project_id,
            actor_type: row.actor_type,
            revision: row.revision,
        }))
    }

    /// Return the highest revision already stored for each AI event ID.
    pub async fn existing_ai_event_revisions(
        &self,
        user_id: uuid::Uuid,
        candidates: &[String],
    ) -> Result<HashMap<(String, Option<String>), u32>> {
        if candidates.is_empty() {
            return Ok(HashMap::new());
        }
        #[derive(serde::Deserialize, clickhouse::Row)]
        struct RevisionRow {
            ai_event_id: String,
            session_id: Option<String>,
            revision: u32,
        }
        let rows = self
            .client
            .get_client()
            .query(
                "SELECT assumeNotNull(ai_event_id) AS ai_event_id, session_id, max(revision) AS revision
                 FROM wakaclock.heartbeats
                 WHERE user_id = ? AND ai_event_id IS NOT NULL AND ai_event_id IN ?
                 GROUP BY ai_event_id, session_id",
            )
            .bind(user_id)
            .bind(candidates)
            .fetch_all::<RevisionRow>()
            .await
            .map_err(|error| {
                anyhow::anyhow!("ClickHouse AI event revision query failed: {error}")
            })?;
        Ok(rows
            .into_iter()
            .map(|row| ((row.ai_event_id, row.session_id), row.revision))
            .collect())
    }

    /// Return the highest revision for each explicit canonical change ID. This lets
    /// a correction keep the logical operation stable even when a producer rotates
    /// its transport heartbeat ID.
    pub async fn existing_change_revisions(
        &self,
        user_id: uuid::Uuid,
        candidates: &[String],
    ) -> Result<HashMap<(String, Option<String>), u32>> {
        if candidates.is_empty() {
            return Ok(HashMap::new());
        }
        #[derive(serde::Deserialize, clickhouse::Row)]
        struct RevisionRow {
            ai_change_id: String,
            session_id: Option<String>,
            revision: u32,
        }
        let rows = self
            .client
            .get_client()
            .query(
                "SELECT assumeNotNull(ai_change_id) AS ai_change_id, session_id, max(revision) AS revision
                 FROM wakaclock.heartbeats
                 WHERE user_id = ? AND ai_change_id IS NOT NULL AND ai_change_id IN ?
                 GROUP BY ai_change_id, session_id",
            )
            .bind(user_id)
            .bind(candidates)
            .fetch_all::<RevisionRow>()
            .await
            .map_err(|error| {
                anyhow::anyhow!("ClickHouse AI change revision query failed: {error}")
            })?;
        Ok(rows
            .into_iter()
            .map(|row| ((row.ai_change_id, row.session_id), row.revision))
            .collect())
    }

    /// WakaTime-compatible bulk deletion. Heartbeat IDs are opaque transport
    /// identifiers; clients can only delete rows belonging to their own user.
    pub async fn delete_ids(&self, user_id: uuid::Uuid, heartbeat_ids: &[String]) -> Result<u64> {
        if heartbeat_ids.is_empty() {
            return Ok(0);
        }
        // Persist deletion intent before physical cleanup. All canonical readers
        // exclude these IDs immediately, including retransmissions after deletion.
        self.client
            .get_client()
            .query(
                "INSERT INTO wakaclock.heartbeat_deletions (user_id, heartbeat_id)
             SELECT ?, arrayJoin(?)",
            )
            .bind(user_id)
            .bind(heartbeat_ids)
            .execute()
            .await
            .context("failed to persist heartbeat deletion")?;
        for table in ["heartbeats", "activity_intervals"] {
            self.client.get_client().query(&format!(
                "ALTER TABLE wakaclock.{table} DELETE WHERE user_id = ? AND heartbeat_id IN ? SETTINGS mutations_sync = 1"
            )).bind(user_id).bind(heartbeat_ids).execute().await
                .context("failed to purge deleted heartbeat data")?;
        }
        Ok(heartbeat_ids.len() as u64)
    }

    /// Query heartbeats for one calendar day in the user's timezone.
    ///
    /// The stored `date` column is UTC-oriented and is retained for existing
    /// projections. Filtering by raw timestamp bounds instead makes a selected
    /// browser day correct for Asia/Bangkok, DST zones, and every other IANA timezone.
    pub async fn get_by_ai_event_ids(
        &self,
        user_id: uuid::Uuid,
        candidates: &[String],
    ) -> Result<Vec<HeartbeatRow>> {
        if candidates.is_empty() {
            return Ok(Vec::new());
        }
        let relation = canonical_winner_relation(
            "h.user_id = ? AND h.ai_event_id IS NOT NULL AND h.ai_event_id IN ?",
            "h",
        );
        let query = format!(
            "SELECT
                    user_id, entity, entity_type, time, date,
                    project, project_id, branch, head_revision, repository_id,
                    language, dependencies,
                    lines, line_number, cursor_position,
                    is_write, category, editor, operating_system,
                    machine, user_agent, machine_name_hash, hostname_hash, timezone,
                    feature_id, feature_name,
                    heartbeat_id, ast_language, ast_confidence,
                    keystrokes, chars_added, chars_deleted,
                    active_seconds, active_seconds_claimed, activity_segments,
                    is_ai_generated, ai_agent, ai_provider, ai_model,
                    identity_status, identity_reason, identity_source,
                    identity_schema_version, identity_turn_id, identity_message_id,
                    ai_source,
                    ai_confidence, ai_event_id, ai_change_id,
                    prompt_character_count, input_tokens, output_tokens,
                    cache_read_tokens, cache_write_tokens, ai_subscription_plan,
                    token_source, attribution_source, attribution_confidence,
                    ai_event_fingerprint,
                    ai_lines_added, ai_lines_deleted,
                    human_lines_added, human_lines_deleted,
                    unattributed_lines_added, unattributed_lines_deleted,
                    created_at, actor_type, actor_confidence,
                    clipboard_tracking_version, copy_actions, paste_actions,
                    copied_chars, copied_lines, pasted_chars, pasted_lines,
                    paste_same_file_actions, paste_same_workspace_actions,
                    paste_external_or_unknown_actions, revision, session_id
                FROM {relation}
                ORDER BY time ASC"
        );
        self.client
            .get_client()
            .query(&query)
            .bind(user_id)
            .bind(candidates)
            .fetch_all::<HeartbeatRow>()
            .await
            .map_err(|e| anyhow::anyhow!("ClickHouse query error: {e}"))
    }

    pub async fn get_by_date(
        &self,
        user_id: uuid::Uuid,
        range: &ResolvedRange,
    ) -> Result<Vec<HeartbeatRow>> {
        let ch_client = self.client.get_client();
        let (start_epoch, end_epoch) = range.unix_bounds();

        let relation =
            canonical_winner_relation("h.user_id = ? AND h.time >= ? AND h.time < ?", "h");
        let query = format!(
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
                    keystrokes, chars_added, chars_deleted,
                    active_seconds, active_seconds_claimed, activity_segments,
                    is_ai_generated, ai_agent, ai_provider, ai_model,
                    identity_status, identity_reason, identity_source,
                    identity_schema_version, identity_turn_id, identity_message_id,
                    ai_source,
                    ai_confidence, ai_event_id, ai_change_id,
                    prompt_character_count, input_tokens, output_tokens,
                    cache_read_tokens, cache_write_tokens, ai_subscription_plan,
                    token_source, attribution_source, attribution_confidence,
                    ai_event_fingerprint,
                    ai_lines_added, ai_lines_deleted,
                    human_lines_added, human_lines_deleted,
                    unattributed_lines_added, unattributed_lines_deleted,
                    created_at, actor_type, actor_confidence,
                    clipboard_tracking_version, copy_actions, paste_actions,
                    copied_chars, copied_lines, pasted_chars, pasted_lines,
                    paste_same_file_actions, paste_same_workspace_actions,
                    paste_external_or_unknown_actions, revision, session_id
                FROM {relation}
                ORDER BY time ASC"
        );
        let rows = ch_client
            .query(&query)
            .bind(user_id)
            .bind(start_epoch)
            .bind(end_epoch)
            .fetch_all::<HeartbeatRow>()
            .await
            .map_err(|e| anyhow::anyhow!("ClickHouse query error: {e}"))?;

        Ok(rows)
    }

    /// Returns only the caller's own project labels overlapping a co-working session.
    /// This is intentionally kept separate from participant data so the history endpoint
    /// cannot accidentally disclose another user's project or branch.
    pub async fn projects_for_window(
        &self,
        user_id: uuid::Uuid,
        from: u32,
        to: u32,
    ) -> Result<Vec<String>> {
        self.client
            .get_client()
            .query(
                "SELECT DISTINCT project
                 FROM wakaclock.heartbeats_canonical
                 WHERE user_id = ? AND time >= ? AND time <= ?
                   AND project IS NOT NULL AND project != ''
                 ORDER BY project
                 LIMIT 100",
            )
            .bind(user_id)
            .bind(from as f64)
            .bind(to as f64)
            .fetch_all::<String>()
            .await
            .map_err(|e| anyhow::anyhow!("ClickHouse query error: {e}"))
    }
}
