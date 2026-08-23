use anyhow::{Context, Result};
use std::sync::Arc;
use uuid::Uuid;

use crate::infrastructure::database::ClickHouseClient;
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
                    ai_session_id String,
                    event_time UInt32,
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
                    ai_agent String,
                    ai_provider Nullable(String),
                    primary_model Nullable(String),
                    ai_client Nullable(String),
                    editor Nullable(String),
                    machine Nullable(String),
                    operating_system Nullable(String),
                    prompt_count UInt64,
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
                    version UInt64
                ) ENGINE = ReplacingMergeTree(version)
                ORDER BY (user_id, ai_session_id, project_id)
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

        // Existing development databases may have been created by the short-lived
        // FixedString(3) schema above. Pricing is always USD today, but using String
        // keeps the codec safe and makes a future currency code migration explicit.
        self.client
            .get_client()
            .query("ALTER TABLE wakaclock.ai_model_pricing MODIFY COLUMN IF EXISTS currency String")
            .execute()
            .await
            .context("Failed to migrate ai_model_pricing.currency to String")?;

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
                "SELECT ai_session_id, project_id
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
                    sum(prompt_count) AS prompt_count,
                    argMax(ai_agent, event_time) AS ai_agent,
                    uniqExact(ifNull(ai_provider, '')) AS distinct_providers,
                    argMax(ifNull(ai_provider, ''), event_time) AS latest_provider,
                    uniqExact(ifNull(ai_model, '')) AS distinct_models,
                    argMax(ifNull(ai_model, ''), event_time) AS latest_model
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
    pub prompt_count: u64,
    pub ai_agent: String,
    pub distinct_providers: u64,
    pub latest_provider: String,
    pub distinct_models: u64,
    pub latest_model: String,
}

#[derive(Debug, Clone, serde::Deserialize, clickhouse::Row)]
pub struct SessionProjectIdRow {
    pub ai_session_id: String,
    #[serde(with = "clickhouse::serde::uuid")]
    pub project_id: Uuid,
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
