use anyhow::{Context, Result};
use std::collections::HashMap;
use std::sync::Arc;
use uuid::Uuid;

use crate::infrastructure::database::ClickHouseClient;
use crate::infrastructure::postgres::PostgresClient;
use crate::model::ai_usage::{
    AiModelPricingRow, AiSessionProjectRow, AiSessionRow, AiUsageEventRow,
};

pub struct AiUsageRepository {
    client: Arc<ClickHouseClient>,
}

impl AiUsageRepository {
    pub fn new(client: Arc<ClickHouseClient>) -> Self {
        Self { client }
    }

    pub async fn insert_verification_audit(
        &self,
        postgres: &PostgresClient,
        event_id_hash: &str,
        identity_hash: &str,
        mismatch_category: &str,
        field_flags: &[&str],
        received_at: chrono::DateTime<chrono::Utc>,
    ) -> Result<()> {
        let id = Uuid::now_v7();
        let flags = serde_json::to_value(field_flags)?;
        postgres
            .execute(
                "INSERT INTO ai_usage_verification_audits
                 (id, event_id_hash, identity_hash, mismatch_category, field_flags, received_at)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (identity_hash) DO UPDATE SET
                    event_id_hash = EXCLUDED.event_id_hash,
                    mismatch_category = EXCLUDED.mismatch_category,
                    field_flags = EXCLUDED.field_flags,
                    received_at = EXCLUDED.received_at,
                    checked_at = now()",
                &[
                    &id,
                    &event_id_hash,
                    &identity_hash,
                    &mismatch_category,
                    &flags,
                    &received_at,
                ],
            )
            .await
            .context("insert AI usage verification audit")?;
        Ok(())
    }

    /// Creates the AI usage/session/pricing tables and seeds the price catalog.
    ///
    /// Runs on every boot (this database has no migration-tracking table), so every statement is
    /// `IF NOT EXISTS` and the seed is idempotent.
    pub async fn migrate(&self) -> Result<()> {
        let statements = [
            (
                "ai_usage_events",
                r#"
                CREATE TABLE IF NOT EXISTS wakaclock.ai_usage_events (
                    user_id UUID,
                    date Date,
                    usage_event_id String,
                    event_payload_hash Nullable(String),
                    ai_session_id String,
                    collector_id Nullable(String),
                    event_time UInt32,
                    project_id Nullable(UUID),
                    project_attribution_method Nullable(String),
                    ai_agent String,
                    ai_provider Nullable(String),
                    ai_model Nullable(String),
                    prompt_count UInt32,
                    prompt_character_count Nullable(UInt64),
                    input_tokens Nullable(UInt64),
                    output_tokens Nullable(UInt64),
                    cache_read_tokens Nullable(UInt64),
                    cache_write_tokens Nullable(UInt64),
                    estimated_cost_microusd Nullable(UInt64),
                    pricing_version Nullable(String),
                    token_source String,
                    version UInt64,
                    received_at UInt32
                ) ENGINE = ReplacingMergeTree(version)
                ORDER BY (user_id, date, usage_event_id)
                "#,
            ),
            (
                "ai_sessions",
                r#"
                CREATE TABLE IF NOT EXISTS wakaclock.ai_sessions (
                    user_id UUID,
                    ai_session_id String,
                    started_at UInt32,
                    ended_at Nullable(UInt32),
                    last_event_at UInt32 DEFAULT started_at,
                    ai_agent String,
                    ai_provider Nullable(String),
                    primary_model Nullable(String),
                    ai_client Nullable(String),
                    editor Nullable(String),
                    machine Nullable(String),
                    operating_system Nullable(String),
                    prompt_count UInt64,
                    input_tokens Nullable(UInt64),
                    output_tokens Nullable(UInt64),
                    cache_read_tokens Nullable(UInt64),
                    cache_write_tokens Nullable(UInt64),
                    version UInt64,
                    updated_at UInt32
                ) ENGINE = ReplacingMergeTree(version)
                ORDER BY (user_id, ai_session_id)
                "#,
            ),
            (
                "ai_session_projects",
                r#"
                CREATE TABLE IF NOT EXISTS wakaclock.ai_session_projects (
                    user_id UUID,
                    ai_session_id String,
                    project_id UUID,
                    first_event_at UInt32,
                    last_event_at UInt32,
                    event_count UInt64,
                    ai_lines_changed UInt64,
                    token_allocation_method String,
                    is_deleted UInt8 DEFAULT 0,
                    version UInt64
                ) ENGINE = ReplacingMergeTree(version)
                ORDER BY (user_id, ai_session_id, project_id)
                "#,
            ),
            (
                "ai_changes_raw",
                r#"
                CREATE TABLE IF NOT EXISTS wakaclock.ai_changes_raw (
                    user_id UUID,
                    ai_change_id String,
                    file_identity String,
                    start_line UInt32,
                    end_line UInt32,
                    lines_added UInt32,
                    lines_deleted UInt32,
                    provider Nullable(String),
                    model Nullable(String),
                    occurred_at UInt32,
                    attribution_source String,
                    attribution_confidence Nullable(Float32),
                    created_at UInt32 DEFAULT toUInt32(now())
                ) ENGINE = ReplacingMergeTree(created_at)
                ORDER BY (user_id, ai_change_id)
                "#,
            ),
            (
                "ai_model_pricing",
                r#"
                CREATE TABLE IF NOT EXISTS wakaclock.ai_model_pricing (
                    provider String,
                    model String,
                    effective_from UInt32,
                    effective_to Nullable(UInt32),
                    input_microusd_per_million UInt64,
                    output_microusd_per_million UInt64,
                    cache_read_microusd_per_million Nullable(UInt64),
                    cache_write_microusd_per_million Nullable(UInt64),
                    /* `String` matches the Rust row codec. FixedString(3) needs a
                       fixed-width byte serializer and made the initial price-catalog
                       seed unreadable by ClickHouse's RowBinary input format. */
                    currency String,
                    pricing_version String,
                    updated_at UInt32
                ) ENGINE = ReplacingMergeTree(updated_at)
                ORDER BY (provider, model, effective_from)
                "#,
            ),
        ];

        for (table, ddl) in statements {
            self.client
                .get_client()
                .query(ddl)
                .execute()
                .await
                .with_context(|| format!("Failed to create {table} table"))?;
        }

        self.client
            .get_client()
            .query(
                "ALTER TABLE wakaclock.ai_usage_events
                 ADD COLUMN IF NOT EXISTS prompt_character_count Nullable(UInt64)",
            )
            .execute()
            .await
            .context("Failed to add ai_usage_events.prompt_character_count")?;

        self.client
            .get_client()
            .query(
                "ALTER TABLE wakaclock.ai_usage_events
                 ADD COLUMN IF NOT EXISTS event_payload_hash Nullable(String)",
            )
            .execute()
            .await
            .context("Failed to add ai_usage_events.event_payload_hash")?;

        self.client
            .get_client()
            .query(
                "ALTER TABLE wakaclock.ai_usage_events
                 ADD COLUMN IF NOT EXISTS project_attribution_method Nullable(String)",
            )
            .execute()
            .await
            .context("Failed to add ai_usage_events.project_attribution_method")?;

        // Early development schemas appended additive columns at the end of the
        // MergeTree. Keep the RowBinary insert order canonical for both fresh and
        // upgraded databases before any worker starts writing replacement rows.
        self.client
            .get_client()
            .query(
                "ALTER TABLE wakaclock.ai_usage_events
                 MODIFY COLUMN prompt_character_count Nullable(UInt64) AFTER prompt_count",
            )
            .execute()
            .await
            .context("Failed to order ai_usage_events.prompt_character_count")?;

        self.client
            .get_client()
            .query(
                "ALTER TABLE wakaclock.ai_usage_events
                 MODIFY COLUMN event_payload_hash Nullable(String) AFTER usage_event_id",
            )
            .execute()
            .await
            .context("Failed to order ai_usage_events.event_payload_hash")?;

        self.client
            .get_client()
            .query(
                "ALTER TABLE wakaclock.ai_usage_events
                 MODIFY COLUMN project_attribution_method Nullable(String) AFTER project_id",
            )
            .execute()
            .await
            .context("Failed to order ai_usage_events.project_attribution_method")?;

        self.client
            .get_client()
            .query(
                "ALTER TABLE wakaclock.ai_session_projects
                 ADD COLUMN IF NOT EXISTS is_deleted UInt8 DEFAULT 0",
            )
            .execute()
            .await
            .context("Failed to add ai_session_projects.is_deleted")?;

        self.client
            .get_client()
            .query(
                "ALTER TABLE wakaclock.ai_session_projects
                 MODIFY COLUMN is_deleted UInt8 DEFAULT 0 AFTER token_allocation_method",
            )
            .execute()
            .await
            .context("Failed to order ai_session_projects.is_deleted")?;

        // Existing development databases may have been created by the short-lived
        // FixedString(3) schema above. Pricing is always USD today, but using String
        // keeps the codec safe and makes a future currency code migration explicit.
        self.client
            .get_client()
            .query("ALTER TABLE wakaclock.ai_model_pricing MODIFY COLUMN IF EXISTS currency String")
            .execute()
            .await
            .context("Failed to migrate ai_model_pricing.currency to String")?;

        self.client.get_client().query("ALTER TABLE wakaclock.ai_usage_events ADD COLUMN IF NOT EXISTS collector_id Nullable(String)").execute().await?;
        self.client
            .get_client()
            .query(
                "ALTER TABLE wakaclock.ai_sessions
                 ADD COLUMN IF NOT EXISTS last_event_at UInt32 DEFAULT started_at
                 AFTER ended_at",
            )
            .execute()
            .await
            .context("Failed to add ai_sessions.last_event_at")?;

        for (column, after) in [
            ("input_tokens", "prompt_count"),
            ("output_tokens", "input_tokens"),
            ("cache_read_tokens", "output_tokens"),
            ("cache_write_tokens", "cache_read_tokens"),
        ] {
            self.client
                .get_client()
                .query(&format!(
                    "ALTER TABLE wakaclock.ai_sessions
                     ADD COLUMN IF NOT EXISTS {column} Nullable(UInt64)"
                ))
                .execute()
                .await
                .with_context(|| format!("Failed to add ai_sessions.{column}"))?;
            self.client
                .get_client()
                .query(&format!(
                    "ALTER TABLE wakaclock.ai_sessions
                     MODIFY COLUMN {column} Nullable(UInt64) AFTER {after}"
                ))
                .execute()
                .await
                .with_context(|| format!("Failed to order ai_sessions.{column}"))?;
        }

        self.seed_pricing().await?;
        Ok(())
    }

    /// Writes the shipped price catalog if it is not already present.
    ///
    /// Seeded from Anthropic's published list prices rather than fetched — plan.md 9.5 requires
    /// pricing updates to stay auditable and explicitly forbids scraping live prices in the
    /// request path. Re-seeding is a no-op once `pricing_version` is present, so an operator can
    /// correct a row without it being overwritten on the next boot.
    async fn seed_pricing(&self) -> Result<()> {
        let existing: u64 = self
            .client
            .get_client()
            .query("SELECT count() FROM wakaclock.ai_model_pricing WHERE pricing_version = ?")
            .bind(SEED_PRICING_VERSION)
            .fetch_one()
            .await
            .map_err(|e| anyhow::anyhow!("ClickHouse pricing seed check failed: {e}"))?;
        if existing > 0 {
            return Ok(());
        }

        let now = chrono::Utc::now().timestamp().max(0) as u32;
        let rows: Vec<AiModelPricingRow> = seed_pricing_rows(now);
        self.insert_pricing(&rows).await
    }

    pub async fn insert_pricing(&self, rows: &[AiModelPricingRow]) -> Result<()> {
        if rows.is_empty() {
            return Ok(());
        }
        let mut insert = self
            .client
            .get_client()
            .insert("wakaclock.ai_model_pricing")
            .map_err(|e| anyhow::anyhow!("ClickHouse insert Error: {e}"))?;
        for row in rows {
            insert
                .write(row)
                .await
                .map_err(|e| anyhow::anyhow!("ClickHouse write row Error: {e}"))?;
        }
        insert
            .end()
            .await
            .map_err(|e| anyhow::anyhow!("ClickHouse end insert Error: {e}"))?;
        Ok(())
    }

    /// The price rows covering a provider/model pair, newest window first. Pricing is never
    /// selected by model name alone: two providers can publish the same model label at different
    /// rates, and an unknown provider must remain an unknown cost rather than inheriting a catalog
    /// row by coincidence.
    pub async fn pricing_for_model(
        &self,
        provider: &str,
        model: &str,
    ) -> Result<Vec<AiModelPricingRow>> {
        self.client
            .get_client()
            .query(
                "SELECT
                    provider, model, effective_from, effective_to,
                    input_microusd_per_million, output_microusd_per_million,
                    cache_read_microusd_per_million, cache_write_microusd_per_million,
                    currency, pricing_version, updated_at
                 FROM wakaclock.ai_model_pricing FINAL
                 WHERE provider = ? AND model = ?
                 ORDER BY effective_from DESC",
            )
            .bind(provider)
            .bind(model)
            .fetch_all::<AiModelPricingRow>()
            .await
            .map_err(|e| anyhow::anyhow!("ClickHouse pricing query error: {e}"))
    }

    /// The `usage_event_id`s from `candidates` this user has already recorded.
    ///
    /// Ingest is idempotent through ReplacingMergeTree regardless; this exists so the API can
    /// report how many events were genuinely new rather than claiming every replay as a write.
    pub async fn existing_event_ids(
        &self,
        user_id: Uuid,
        candidates: &[String],
    ) -> Result<Vec<String>> {
        if candidates.is_empty() {
            return Ok(Vec::new());
        }
        #[derive(serde::Deserialize, clickhouse::Row)]
        struct IdRow {
            usage_event_id: String,
        }

        let rows = self
            .client
            .get_client()
            .query(
                "SELECT usage_event_id FROM wakaclock.ai_usage_events FINAL
                 WHERE user_id = ? AND usage_event_id IN ?",
            )
            .bind(user_id)
            .bind(candidates)
            .fetch_all::<IdRow>()
            .await
            .map_err(|e| anyhow::anyhow!("ClickHouse usage id query error: {e}"))?;

        Ok(rows.into_iter().map(|row| row.usage_event_id).collect())
    }

    /// Return the stored payload hash for each logical usage id. `None` means a
    /// legacy row predating the additive hash column; that row is treated as the
    /// first write and is never overwritten by a later payload.
    pub async fn existing_event_payload_hashes(
        &self,
        user_id: Uuid,
        candidates: &[String],
    ) -> Result<HashMap<String, Option<String>>> {
        if candidates.is_empty() {
            return Ok(HashMap::new());
        }
        #[derive(serde::Deserialize, clickhouse::Row)]
        struct IdentityRow {
            usage_event_id: String,
            event_payload_hash: Option<String>,
        }
        let rows = self
            .client
            .get_client()
            .query(
                "SELECT usage_event_id, event_payload_hash
                 FROM wakaclock.ai_usage_events FINAL
                 WHERE user_id = ? AND usage_event_id IN ?",
            )
            .bind(user_id)
            .bind(candidates)
            .fetch_all::<IdentityRow>()
            .await
            .map_err(|e| anyhow::anyhow!("ClickHouse usage identity query error: {e}"))?;
        let mut hashes = HashMap::with_capacity(rows.len());
        for row in rows {
            match hashes.entry(row.usage_event_id) {
                std::collections::hash_map::Entry::Vacant(entry) => {
                    entry.insert(row.event_payload_hash);
                }
                std::collections::hash_map::Entry::Occupied(mut entry) => {
                    match (entry.get().as_ref(), row.event_payload_hash.as_ref()) {
                        (Some(existing), Some(candidate)) if existing != candidate => {
                            anyhow::bail!("usage_identity_conflict")
                        }
                        (None, Some(candidate)) => {
                            entry.insert(Some(candidate.clone()));
                        }
                        _ => {}
                    }
                }
            }
        }
        Ok(hashes)
    }

    pub async fn find_event(
        &self,
        user_id: Uuid,
        usage_event_id: &str,
    ) -> Result<Option<AiUsageEventRow>> {
        self.client
            .get_client()
            .query(
                "SELECT
                    user_id, toUInt16(date) AS date, usage_event_id, event_payload_hash,
                    ai_session_id, collector_id, event_time, project_id, project_attribution_method,
                    ai_agent, ai_provider, ai_model,
                    prompt_count, prompt_character_count, input_tokens, output_tokens,
                    cache_read_tokens, cache_write_tokens, estimated_cost_microusd,
                    pricing_version, token_source, version, received_at
                 FROM wakaclock.ai_usage_events FINAL
                 WHERE user_id = ? AND usage_event_id = ?
                 LIMIT 1",
            )
            .bind(user_id)
            .bind(usage_event_id)
            .fetch_optional::<AiUsageEventRow>()
            .await
            .map_err(|e| anyhow::anyhow!("ClickHouse usage verification query error: {e}"))
    }

    /// Returns the distinct projects already proven for each touched session. This supports
    /// the conservative allocation rule: an event without an explicit project may inherit the
    /// session's sole project, but a multi-project session remains unattributed rather than
    /// copying its token/cost totals into every project.
    pub async fn session_project_ids(
        &self,
        user_id: Uuid,
        session_ids: &[String],
    ) -> Result<Vec<SessionProjectIdRow>> {
        if session_ids.is_empty() {
            return Ok(Vec::new());
        }
        self.client
            .get_client()
            .query(
                /* `project_id` is Nullable(UUID) in the table, and the `IS NOT NULL`
                filter does not change the column's declared type: ClickHouse still
                sends a null-flag byte per row that the non-optional UUID decoder in
                `SessionProjectIdRow` never reads. `assumeNotNull` narrows the type
                at the projection, which the filter has already made true. */
                "SELECT ai_session_id, assumeNotNull(project_id) AS project_id
                 FROM wakaclock.ai_usage_events FINAL
                 WHERE user_id = ? AND ai_session_id IN ? AND project_id IS NOT NULL
                 GROUP BY ai_session_id, project_id",
            )
            .bind(user_id)
            .bind(session_ids)
            .fetch_all::<SessionProjectIdRow>()
            .await
            .map_err(|e| anyhow::anyhow!("ClickHouse session project query error: {e}"))
    }

    /// Full fact rows for a bounded session reconciliation. The worker reads
    /// these values from ClickHouse rather than trusting the small RabbitMQ job
    /// payload.
    pub async fn session_facts(
        &self,
        user_id: Uuid,
        session_ids: &[String],
    ) -> Result<Vec<AiUsageEventRow>> {
        if session_ids.is_empty() {
            return Ok(Vec::new());
        }
        self.client
            .get_client()
            .query(
                "SELECT
                    user_id, toUInt16(date) AS date, usage_event_id, event_payload_hash,
                    ai_session_id, collector_id, event_time, project_id, project_attribution_method,
                    ai_agent, ai_provider, ai_model,
                    prompt_count, prompt_character_count, input_tokens, output_tokens,
                    cache_read_tokens, cache_write_tokens, estimated_cost_microusd,
                    pricing_version, token_source, version, received_at
                 FROM wakaclock.ai_usage_events FINAL
                 WHERE user_id = ? AND ai_session_id IN ?
                 ORDER BY event_time, usage_event_id",
            )
            .bind(user_id)
            .bind(session_ids)
            .fetch_all::<AiUsageEventRow>()
            .await
            .map_err(|e| anyhow::anyhow!("ClickHouse session facts query error: {e}"))
    }

    pub async fn session_project_rollups(
        &self,
        user_id: Uuid,
        session_ids: &[String],
    ) -> Result<Vec<SessionProjectRollup>> {
        if session_ids.is_empty() {
            return Ok(Vec::new());
        }
        self.client
            .get_client()
            .query(
                "SELECT
                    ai_session_id,
                    assumeNotNull(project_id) AS project_id,
                    min(event_time) AS first_event_at,
                    max(event_time) AS last_event_at,
                    count() AS event_count
                 FROM wakaclock.ai_usage_events FINAL
                 WHERE user_id = ? AND ai_session_id IN ? AND project_id IS NOT NULL
                 GROUP BY ai_session_id, project_id",
            )
            .bind(user_id)
            .bind(session_ids)
            .fetch_all::<SessionProjectRollup>()
            .await
            .map_err(|e| anyhow::anyhow!("ClickHouse session project rollup error: {e}"))
    }

    /// Returns active project projections for one session. A reconciliation uses
    /// this snapshot to emit tombstones for projects that were previously inferred
    /// but are no longer supported by the session's facts.
    pub async fn active_session_project_ids(
        &self,
        user_id: Uuid,
        session_id: &str,
    ) -> Result<Vec<Uuid>> {
        #[derive(Debug, serde::Deserialize, clickhouse::Row)]
        struct ProjectIdRow {
            #[serde(with = "clickhouse::serde::uuid")]
            project_id: Uuid,
        }

        let rows = self
            .client
            .get_client()
            .query(
                "SELECT project_id
                 FROM wakaclock.ai_session_projects FINAL
                 WHERE user_id = ? AND ai_session_id = ? AND is_deleted = 0",
            )
            .bind(user_id)
            .bind(session_id)
            .fetch_all::<ProjectIdRow>()
            .await
            .map_err(|e| anyhow::anyhow!("ClickHouse active session project query error: {e}"))?;
        Ok(rows.into_iter().map(|row| row.project_id).collect())
    }

    pub async fn insert_usage_events(&self, rows: &[AiUsageEventRow]) -> Result<()> {
        if rows.is_empty() {
            return Ok(());
        }
        let mut insert = self
            .client
            .get_client()
            .insert("wakaclock.ai_usage_events")
            .map_err(|e| anyhow::anyhow!("ClickHouse insert Error: {e}"))?;
        for row in rows {
            insert
                .write(row)
                .await
                .map_err(|e| anyhow::anyhow!("ClickHouse write row Error: {e}"))?;
        }
        insert
            .end()
            .await
            .map_err(|e| anyhow::anyhow!("ClickHouse end insert Error: {e}"))?;
        Ok(())
    }

    pub async fn upsert_sessions(&self, rows: &[AiSessionRow]) -> Result<()> {
        if rows.is_empty() {
            return Ok(());
        }
        let mut insert = self
            .client
            .get_client()
            .insert("wakaclock.ai_sessions")
            .map_err(|e| anyhow::anyhow!("ClickHouse insert Error: {e}"))?;
        for row in rows {
            insert
                .write(row)
                .await
                .map_err(|e| anyhow::anyhow!("ClickHouse write row Error: {e}"))?;
        }
        insert
            .end()
            .await
            .map_err(|e| anyhow::anyhow!("ClickHouse end insert Error: {e}"))?;
        Ok(())
    }

    /// Backs the session rollup: the aggregate of everything recorded for a session so far.
    ///
    /// Recomputed from stored events rather than accumulated in memory, so a session's totals stay
    /// correct across batches, retries and process restarts.
    pub async fn session_rollups(
        &self,
        user_id: Uuid,
        session_ids: &[String],
    ) -> Result<Vec<SessionRollup>> {
        if session_ids.is_empty() {
            return Ok(Vec::new());
        }
        self.client
            .get_client()
            .query(
                "SELECT
                    ai_session_id,
                    min(event_time) AS started_at,
                    max(event_time) AS last_event_at,
                    sum(prompt_count) AS prompt_count,
                    argMax(ai_agent, event_time) AS ai_agent,
                    uniqExact(ifNull(ai_provider, '')) AS distinct_providers,
                    argMax(ifNull(ai_provider, ''), event_time) AS latest_provider,
                    uniqExact(ifNull(ai_model, '')) AS distinct_models,
                    argMax(ifNull(ai_model, ''), event_time) AS latest_model,
                    sumOrNull(input_tokens) AS input_tokens,
                    sumOrNull(output_tokens) AS output_tokens,
                    sumOrNull(cache_read_tokens) AS cache_read_tokens,
                    sumOrNull(cache_write_tokens) AS cache_write_tokens
                 FROM wakaclock.ai_usage_events FINAL
                 WHERE user_id = ? AND ai_session_id IN ?
                 GROUP BY ai_session_id",
            )
            .bind(user_id)
            .bind(session_ids)
            .fetch_all::<SessionRollup>()
            .await
            .map_err(|e| anyhow::anyhow!("ClickHouse session rollup query error: {e}"))
    }

    /// Attaches projects to a session. Unused until the projections in PR 9.4/9.5 need it; the
    /// table and its writer ship together so the allocation rules live in one place.
    #[allow(dead_code)]
    pub async fn upsert_session_projects(&self, rows: &[AiSessionProjectRow]) -> Result<()> {
        if rows.is_empty() {
            return Ok(());
        }
        let mut insert = self
            .client
            .get_client()
            .insert("wakaclock.ai_session_projects")
            .map_err(|e| anyhow::anyhow!("ClickHouse insert Error: {e}"))?;
        for row in rows {
            insert
                .write(row)
                .await
                .map_err(|e| anyhow::anyhow!("ClickHouse write row Error: {e}"))?;
        }
        insert
            .end()
            .await
            .map_err(|e| anyhow::anyhow!("ClickHouse end insert Error: {e}"))?;
        Ok(())
    }
}

#[derive(Debug, Clone, serde::Deserialize, clickhouse::Row)]
pub struct SessionRollup {
    pub ai_session_id: String,
    pub started_at: u32,
    pub last_event_at: u32,
    pub prompt_count: u64,
    pub ai_agent: String,
    pub distinct_providers: u64,
    pub latest_provider: String,
    pub distinct_models: u64,
    pub latest_model: String,
    pub input_tokens: Option<u64>,
    pub output_tokens: Option<u64>,
    pub cache_read_tokens: Option<u64>,
    pub cache_write_tokens: Option<u64>,
}

#[derive(Debug, Clone, serde::Deserialize, clickhouse::Row)]
pub struct SessionProjectIdRow {
    pub ai_session_id: String,
    #[serde(with = "clickhouse::serde::uuid")]
    pub project_id: Uuid,
}

#[derive(Debug, Clone, serde::Deserialize, clickhouse::Row)]
pub struct SessionProjectRollup {
    pub ai_session_id: String,
    #[serde(with = "clickhouse::serde::uuid")]
    pub project_id: Uuid,
    pub first_event_at: u32,
    pub last_event_at: u32,
    pub event_count: u64,
}

/// Identifies the shipped catalog. Bump when the seeded numbers change so a new boot writes the
/// corrected rows instead of silently keeping the old ones.
pub const SEED_PRICING_VERSION: &str = "anthropic-2026-06-24";

/// Anthropic list prices, in micro-USD per million tokens.
///
/// Cache rates are derived from the input rate by the published multipliers — reads at 0.1x, and
/// writes at 1.25x (the 5-minute TTL, which is the default). They are stored explicitly rather
/// than recomputed at read time so a rate change is a catalog edit, not a code change.
fn seed_pricing_rows(now: u32) -> Vec<AiModelPricingRow> {
    /// Beginning of the window for prices already in effect. Any real event timestamp falls after
    /// this, so a historical event still finds a covering price rather than costing NULL.
    const ALREADY_IN_EFFECT: u32 = 0;
    /// Claude Sonnet 5's introductory rate runs through 2026-08-31; the standard rate opens the
    /// moment it closes. This pair is the reason the catalog is time-versioned at all.
    const SONNET_5_INTRO_ENDS: u32 = 1_788_220_799; // 2026-08-31T23:59:59Z
    const SONNET_5_STANDARD_BEGINS: u32 = 1_788_220_800; // 2026-09-01T00:00:00Z

    let price =
        |model: &str, effective_from: u32, effective_to: Option<u32>, input: u64, output: u64| {
            AiModelPricingRow {
                provider: "anthropic".to_string(),
                model: model.to_string(),
                effective_from,
                effective_to,
                input_microusd_per_million: input,
                output_microusd_per_million: output,
                cache_read_microusd_per_million: Some(input / 10),
                cache_write_microusd_per_million: Some(input * 5 / 4),
                currency: "USD".to_string(),
                pricing_version: SEED_PRICING_VERSION.to_string(),
                updated_at: now,
            }
        };

    vec![
        // Opus tier — $5 / $25 per million.
        price(
            "claude-opus-5",
            ALREADY_IN_EFFECT,
            None,
            5_000_000,
            25_000_000,
        ),
        price(
            "claude-opus-4-8",
            ALREADY_IN_EFFECT,
            None,
            5_000_000,
            25_000_000,
        ),
        price(
            "claude-opus-4-7",
            ALREADY_IN_EFFECT,
            None,
            5_000_000,
            25_000_000,
        ),
        price(
            "claude-opus-4-6",
            ALREADY_IN_EFFECT,
            None,
            5_000_000,
            25_000_000,
        ),
        // Sonnet 5 — introductory $2 / $10 until it reverts to $3 / $15.
        price(
            "claude-sonnet-5",
            ALREADY_IN_EFFECT,
            Some(SONNET_5_INTRO_ENDS),
            2_000_000,
            10_000_000,
        ),
        price(
            "claude-sonnet-5",
            SONNET_5_STANDARD_BEGINS,
            None,
            3_000_000,
            15_000_000,
        ),
        price(
            "claude-sonnet-4-6",
            ALREADY_IN_EFFECT,
            None,
            3_000_000,
            15_000_000,
        ),
        // Haiku tier — $1 / $5 per million.
        price(
            "claude-haiku-4-5",
            ALREADY_IN_EFFECT,
            None,
            1_000_000,
            5_000_000,
        ),
        // Fable/Mythos tier — $10 / $50 per million.
        price(
            "claude-fable-5",
            ALREADY_IN_EFFECT,
            None,
            10_000_000,
            50_000_000,
        ),
        price(
            "claude-mythos-5",
            ALREADY_IN_EFFECT,
            None,
            10_000_000,
            50_000_000,
        ),
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cache_rates_follow_the_published_multipliers() {
        let rows = seed_pricing_rows(0);
        let opus = rows.iter().find(|r| r.model == "claude-opus-5").unwrap();
        assert_eq!(
            opus.cache_read_microusd_per_million,
            Some(500_000),
            "cache reads bill at 0.1x the input rate"
        );
        assert_eq!(
            opus.cache_write_microusd_per_million,
            Some(6_250_000),
            "cache writes bill at 1.25x the input rate at the default 5-minute TTL"
        );
    }

    #[test]
    fn sonnet_5_has_two_non_overlapping_price_windows() {
        let rows = seed_pricing_rows(0);
        let windows: Vec<_> = rows
            .iter()
            .filter(|r| r.model == "claude-sonnet-5")
            .collect();
        assert_eq!(
            windows.len(),
            2,
            "an introductory rate and the standard rate"
        );

        let intro = windows
            .iter()
            .find(|r| r.effective_to.is_some())
            .expect("the introductory window closes");
        let standard = windows
            .iter()
            .find(|r| r.effective_to.is_none())
            .expect("the standard window is still open");
        assert_eq!(
            intro.effective_to.unwrap() + 1,
            standard.effective_from,
            "the standard rate must open the instant the introductory one closes, or an event \
             landing in the gap would price as NULL"
        );
        assert!(intro.input_microusd_per_million < standard.input_microusd_per_million);
    }

    #[test]
    fn every_seeded_price_is_integer_microusd_in_one_currency() {
        for row in seed_pricing_rows(0) {
            assert_eq!(row.currency, "USD");
            assert!(row.input_microusd_per_million > 0, "{} input", row.model);
            assert!(row.output_microusd_per_million > 0, "{} output", row.model);
        }
    }

    #[test]
    fn output_is_never_cheaper_than_input() {
        for row in seed_pricing_rows(0) {
            assert!(
                row.output_microusd_per_million > row.input_microusd_per_million,
                "{} prices output below input, which no Anthropic tier does",
                row.model
            );
        }
    }
}
