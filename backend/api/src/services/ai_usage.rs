use anyhow::{Context, Result};
use sha2::{Digest, Sha256};
use std::collections::{hash_map::Entry, HashMap, HashSet};
use std::sync::Arc;
use uuid::Uuid;

use crate::model::ai_usage::{
    AiModelPricingRow, AiSessionRow, AiUsageEventRow, AiUsageIngestReport,
};
use crate::repository::ai_usage::AiUsageRepository;
use crate::services::project_identity::ProjectIdentityService;
use tracing::warn;
use wakaclock_core::ai::AiUsageRecord;

pub struct AiUsageService {
    repo: Arc<AiUsageRepository>,
    project_identity_service: Arc<ProjectIdentityService>,
}

#[derive(Debug, thiserror::Error)]
pub enum AiUsageBatchError {
    #[error("usage_event_id {0} was submitted with conflicting payloads")]
    IdentityConflict(String),
    #[error("invalid AI usage record: {0}")]
    Validation(String),
    #[error("could not serialize AI usage payload")]
    Serialization(#[from] serde_json::Error),
}

#[derive(Debug, Clone)]
pub struct PreparedAiUsageBatch {
    pub records: Vec<AiUsageRecord>,
    pub duplicates_in_batch: usize,
    pub payload_hashes: HashMap<String, String>,
}

#[derive(Debug, Clone)]
pub struct AiUsageFactsReport {
    pub report: AiUsageIngestReport,
    pub session_ids: Vec<String>,
}

/// Deduplicate by the provider id while treating an ID/payload mismatch as a
/// conflict. The hash covers the complete sanitized record and never contains
/// prompt/response/source data because those fields are not part of the record.
pub fn prepare_batch(records: &[AiUsageRecord]) -> Result<PreparedAiUsageBatch, AiUsageBatchError> {
    let mut by_id: HashMap<String, (String, AiUsageRecord)> = HashMap::new();
    let mut order = Vec::with_capacity(records.len());
    let mut duplicates_in_batch = 0;
    for record in records {
        record.validate().map_err(AiUsageBatchError::Validation)?;
        let payload = serde_json::to_vec(record)?;
        let digest = Sha256::digest(&payload);
        let payload_hash = format!("{digest:x}");
        match by_id.entry(record.usage_event_id.clone()) {
            Entry::Vacant(entry) => {
                order.push(record.usage_event_id.clone());
                entry.insert((payload_hash, record.clone()));
            }
            Entry::Occupied(entry) => {
                if entry.get().0 != payload_hash {
                    return Err(AiUsageBatchError::IdentityConflict(
                        record.usage_event_id.clone(),
                    ));
                }
                duplicates_in_batch += 1;
            }
        }
    }
    let payload_hashes = by_id
        .iter()
        .map(|(id, (hash, _))| (id.clone(), hash.clone()))
        .collect();
    let records = order
        .into_iter()
        .filter_map(|id| by_id.remove(&id).map(|(_, record)| record))
        .collect();
    Ok(PreparedAiUsageBatch {
        records,
        duplicates_in_batch,
        payload_hashes,
    })
}

impl AiUsageService {
    pub fn new(
        repo: Arc<AiUsageRepository>,
        project_identity_service: Arc<ProjectIdentityService>,
    ) -> Self {
        Self {
            repo,
            project_identity_service,
        }
    }

    /// Stores a batch of usage events and refreshes the sessions they belong to.
    ///
    /// Idempotent by construction: `usage_event_id` is the provider's own message id, and the
    /// table replaces on `(user_id, date, usage_event_id)`. Re-sending a transcript therefore
    /// costs a write but never double-counts tokens — which matters because the CLI has no way to
    /// know which events a previous run delivered.
    pub async fn ingest(
        &self,
        user_id: Uuid,
        records: Vec<AiUsageRecord>,
    ) -> Result<AiUsageIngestReport> {
        let mut facts = self.ingest_internal(user_id, records).await?;
        // The direct compatibility path preserves the old synchronous contract by
        // running the same two-stage pipeline as the workers: facts first, then a
        // full session/project rebuild from authoritative facts. Projection errors
        // remain non-fatal after the fact insert, matching the legacy endpoint's
        // accepted-event behaviour while making the next reconcile able to repair it.
        for session_id in &facts.session_ids {
            match self.reconcile_session(user_id, session_id).await {
                Ok(touched) => facts.report.sessions_touched += touched,
                Err(error) => warn!(
                    %user_id,
                    %error,
                    session_id,
                    "AI usage session projection failed after direct fact acceptance"
                ),
            }
        }
        Ok(facts.report)
    }

    /// Ingest only authoritative usage facts. Kafka consumers call this method;
    /// session projections are scheduled separately through PostgreSQL jobs so a
    /// ClickHouse-success/PG-failure crash replays without committing the offset.
    pub async fn ingest_facts(
        &self,
        user_id: Uuid,
        records: Vec<AiUsageRecord>,
    ) -> Result<AiUsageFactsReport> {
        self.ingest_internal(user_id, records).await
    }

    /// Recompute one session projection from the stored facts. The operation is
    /// derived and idempotent; replaying the same job writes the same logical
    /// replacement version rather than accumulating totals.
    pub async fn reconcile_session(&self, user_id: Uuid, session_id: &str) -> Result<usize> {
        let version = chrono::Utc::now().timestamp_micros().max(0) as u64;
        self.reconcile_projects(user_id, session_id, version)
            .await?;
        self.refresh_sessions(user_id, &[session_id.to_string()], version)
            .await
    }

    async fn ingest_internal(
        &self,
        user_id: Uuid,
        records: Vec<AiUsageRecord>,
    ) -> Result<AiUsageFactsReport> {
        let received = records.len();
        let now = chrono::Utc::now().timestamp().max(0) as u32;
        let version = chrono::Utc::now().timestamp_micros().max(0) as u64;
        let prepared = prepare_batch(&records).map_err(ai_usage_batch_error)?;
        let duplicates_in_batch = prepared.duplicates_in_batch;
        let payload_hashes = prepared.payload_hashes;
        let deduped = prepared.records;

        // Price once per model rather than once per event — a batch is overwhelmingly one or two
        // models, and the catalog is small enough to hold for the duration of the call.
        let mut pricing_cache: HashMap<(String, String), Vec<AiModelPricingRow>> = HashMap::new();
        for record in &deduped {
            if let (Some(provider), Some(model)) =
                (record.provider.as_deref(), record.model.as_deref())
            {
                let key = (provider.to_string(), model.to_string());
                if let Entry::Vacant(entry) = pricing_cache.entry(key) {
                    let windows = match self.repo.pricing_for_model(provider, model).await {
                        Ok(windows) => windows,
                        Err(error) => {
                            // Pricing is a derived enrichment. A catalog/query
                            // problem must not reject the authoritative usage
                            // event; store it as unpriced and make the failure
                            // visible for an operator.
                            warn!(
                                %error,
                                provider,
                                model,
                                "AI usage pricing unavailable; storing event as unpriced"
                            );
                            Vec::new()
                        }
                    };
                    entry.insert(windows);
                }
            }
        }

        let mut unpriced = 0;
        let mut rows = Vec::with_capacity(deduped.len());
        let mut session_ids: Vec<String> = Vec::new();

        for record in &deduped {
            let event_time = record.occurred_at.timestamp().max(0) as u32;
            let priced = record
                .provider
                .as_deref()
                .zip(record.model.as_deref())
                .map(|(provider, model)| (provider.to_string(), model.to_string()))
                .and_then(|key| pricing_cache.get(&key))
                .and_then(|windows| price_in_effect(windows, event_time))
                .and_then(|window| estimate_cost(record, window).map(|cost| (cost, window)));

            if priced.is_none() {
                unpriced += 1;
            }

            if !session_ids.contains(&record.ai_session_id) {
                session_ids.push(record.ai_session_id.clone());
            }

            let project_id = match record.project_hint.as_deref() {
                Some(project) if !project.trim().is_empty() => match self
                    .project_identity_service
                    .resolve_project_id(user_id, Some(project), None)
                    .await
                {
                    Ok(project_id) => project_id,
                    Err(error) => {
                        // Project attribution is also derived data. Keep the
                        // token event usable in the unattributed bucket when
                        // identity tables are unavailable.
                        warn!(
                            %user_id,
                            %error,
                            "AI usage project identity unavailable; storing event unattributed"
                        );
                        None
                    }
                },
                _ => None,
            };
            let project_attribution_method =
                project_id.map(|_| "explicit_project_hint".to_string());

            rows.push(AiUsageEventRow {
                user_id,
                date: (event_time / 86_400) as u16,
                usage_event_id: record.usage_event_id.clone(),
                event_payload_hash: payload_hashes.get(&record.usage_event_id).cloned(),
                ai_session_id: record.ai_session_id.clone(),
                event_time,
                // Explicit privacy-safe hints are resolved here. A later conservative pass may
                // attach the event to a session's sole known project; ambiguous sessions stay in
                // the unattributed-project bucket instead of copying totals to every project.
                project_id,
                project_attribution_method,
                ai_agent: record.agent.clone(),
                ai_provider: record.provider.clone(),
                ai_model: record.model.clone(),
                prompt_count: record.prompt_count,
                prompt_character_count: record.prompt_character_count,
                input_tokens: record.input_tokens,
                output_tokens: record.output_tokens,
                cache_read_tokens: record.cache_read_tokens,
                cache_write_tokens: record.cache_write_tokens,
                estimated_cost_microusd: priced.map(|(cost, _)| cost),
                pricing_version: priced.map(|(_, window)| window.pricing_version.clone()),
                token_source: record.token_source.as_str().to_string(),
                version,
                received_at: now,
            });
        }

        let candidates: Vec<String> = rows.iter().map(|row| row.usage_event_id.clone()).collect();
        let existing = self
            .repo
            .existing_event_payload_hashes(user_id, &candidates)
            .await
            .context("AI usage identity lookup failed")?;
        for row in &rows {
            let Some(Some(existing_hash)) = existing.get(&row.usage_event_id) else {
                continue;
            };
            if payload_hashes.get(&row.usage_event_id) != Some(existing_hash) {
                anyhow::bail!(
                    "usage_identity_conflict for usage_event_id {}",
                    row.usage_event_id
                );
            }
        }
        let already_present: HashSet<String> = existing.into_keys().collect();

        // Do not rewrite an event that the database already has. This is stricter
        // than relying on ReplacingMergeTree alone because its sort key includes the
        // event date; an erroneous client retry with a changed timestamp must still
        // not turn one logical `(user_id, usage_event_id)` into two rows.
        let new_rows: Vec<AiUsageEventRow> = rows
            .into_iter()
            .filter(|row| !already_present.contains(&row.usage_event_id))
            .collect();

        self.repo
            .insert_usage_events(&new_rows)
            .await
            .context("AI usage event insert failed")?;

        Ok(AiUsageFactsReport {
            report: AiUsageIngestReport {
                received,
                stored: new_rows.len(),
                duplicates_in_batch,
                unpriced,
                sessions_touched: 0,
            },
            session_ids,
        })
    }

    async fn reconcile_projects(
        &self,
        user_id: Uuid,
        session_id: &str,
        version: u64,
    ) -> Result<()> {
        let mut facts = self
            .repo
            .session_facts(user_id, &[session_id.to_string()])
            .await?;
        let replacements = project_attribution_replacements(&mut facts, version);
        self.repo.insert_usage_events(&replacements).await?;

        #[derive(Default)]
        struct Allocation {
            first_event_at: u32,
            last_event_at: u32,
            event_count: u64,
            inferred_count: u64,
        }
        let mut allocations: HashMap<Uuid, Allocation> = HashMap::new();
        for fact in &facts {
            let Some(project_id) = fact.project_id else {
                continue;
            };
            let entry = allocations.entry(project_id).or_insert_with(|| Allocation {
                first_event_at: fact.event_time,
                last_event_at: fact.event_time,
                event_count: 0,
                inferred_count: 0,
            });
            entry.first_event_at = entry.first_event_at.min(fact.event_time);
            entry.last_event_at = entry.last_event_at.max(fact.event_time);
            entry.event_count += 1;
            if fact.project_attribution_method.as_deref() == Some("sole_project_session") {
                entry.inferred_count += 1;
            }
        }
        let project_rows = allocations
            .into_iter()
            .map(
                |(project_id, allocation)| crate::model::ai_usage::AiSessionProjectRow {
                    user_id,
                    ai_session_id: session_id.to_string(),
                    project_id,
                    first_event_at: allocation.first_event_at,
                    last_event_at: allocation.last_event_at,
                    event_count: allocation.event_count,
                    ai_lines_changed: 0,
                    token_allocation_method: if allocation.inferred_count > 0 {
                        "sole_project_session"
                    } else {
                        "explicit_project_hint"
                    }
                    .to_string(),
                    is_deleted: 0,
                    version,
                },
            )
            .collect::<Vec<_>>();

        let active_project_ids = self
            .repo
            .active_session_project_ids(user_id, session_id)
            .await?;
        let current_project_ids: HashSet<Uuid> =
            project_rows.iter().map(|row| row.project_id).collect();
        let mut writes = project_rows;
        for project_id in active_project_ids {
            if current_project_ids.contains(&project_id) {
                continue;
            }
            writes.push(crate::model::ai_usage::AiSessionProjectRow {
                user_id,
                ai_session_id: session_id.to_string(),
                project_id,
                first_event_at: 0,
                last_event_at: 0,
                event_count: 0,
                ai_lines_changed: 0,
                token_allocation_method: "retracted".to_string(),
                is_deleted: 1,
                version,
            });
        }
        self.repo.upsert_session_projects(&writes).await
    }

    /// Rebuilds each touched session from its stored events.
    ///
    /// Derived rather than accumulated, so the totals are correct however the events were split
    /// across batches — and so a replayed batch produces the same session row instead of doubling
    /// its prompt count.
    async fn refresh_sessions(
        &self,
        user_id: Uuid,
        session_ids: &[String],
        version: u64,
    ) -> Result<usize> {
        let rollups = self.repo.session_rollups(user_id, session_ids).await?;
        let rows: Vec<AiSessionRow> = rollups
            .into_iter()
            .map(|rollup| AiSessionRow {
                user_id,
                ai_session_id: rollup.ai_session_id,
                started_at: rollup.started_at,
                // A session has no end until the agent reports one; the last event's time is not
                // an end, only the latest thing seen so far.
                ended_at: None,
                last_event_at: rollup.last_event_at,
                ai_agent: rollup.ai_agent,
                ai_provider: primary_value(rollup.distinct_providers, rollup.latest_provider),
                primary_model: primary_model(rollup.distinct_models, rollup.latest_model),
                ai_client: None,
                editor: None,
                machine: None,
                operating_system: None,
                prompt_count: rollup.prompt_count,
                input_tokens: rollup.input_tokens,
                output_tokens: rollup.output_tokens,
                cache_read_tokens: rollup.cache_read_tokens,
                cache_write_tokens: rollup.cache_write_tokens,
                version,
                updated_at: chrono::Utc::now().timestamp().max(0) as u32,
            })
            .collect();

        let touched = rows.len();
        self.repo.upsert_sessions(&rows).await?;
        Ok(touched)
    }
}

/// Apply the conservative project rule to a session's logical facts.
///
/// Only explicit project hints are evidence. An earlier `sole_project_session`
/// assignment is a replaceable projection, not proof; when a second explicit
/// project arrives, the inferred facts are withdrawn and their project rows are
/// tombstoned by `reconcile_projects`.
fn project_attribution_replacements(
    facts: &mut [AiUsageEventRow],
    version: u64,
) -> Vec<AiUsageEventRow> {
    let proven_projects: HashSet<Uuid> = facts
        .iter()
        .filter(|fact| {
            fact.project_id.is_some()
                && fact.project_attribution_method.as_deref() != Some("sole_project_session")
        })
        .filter_map(|fact| fact.project_id)
        .collect();
    let sole_project = (proven_projects.len() == 1)
        .then(|| *proven_projects.iter().next().expect("one project exists"));

    let mut replacements = Vec::new();
    for fact in facts {
        let was_inferred =
            fact.project_attribution_method.as_deref() == Some("sole_project_session");
        let desired_project = if was_inferred || fact.project_id.is_none() {
            sole_project
        } else {
            fact.project_id
        };
        let desired_method = if was_inferred || fact.project_id.is_none() {
            desired_project.map(|_| "sole_project_session".to_string())
        } else {
            fact.project_attribution_method.clone()
        };
        if fact.project_id != desired_project || fact.project_attribution_method != desired_method {
            fact.project_id = desired_project;
            fact.project_attribution_method = desired_method;
            fact.version = version;
            replacements.push(fact.clone());
        }
    }
    replacements
}

fn ai_usage_batch_error(error: AiUsageBatchError) -> anyhow::Error {
    match error {
        AiUsageBatchError::IdentityConflict(id) => {
            anyhow::anyhow!("usage_identity_conflict for usage_event_id {id}")
        }
        AiUsageBatchError::Validation(message) => {
            anyhow::anyhow!("invalid AI usage record: {message}")
        }
        AiUsageBatchError::Serialization(error) => anyhow::Error::new(error),
    }
}

/// The single model a session ran on, or `None` when it used several.
///
/// plan.md 9.4 forbids picking the last model for a multi-model session, and on real transcripts
/// half of all sessions are multi-model — so this returns `None` far more often than not, by
/// design. A distribution would let this be populated; a guess would not.
fn primary_model(distinct_models: u64, latest_model: String) -> Option<String> {
    primary_value(distinct_models, latest_model)
}

/// The one provider/model represented by a session, or `None` for a mixed or
/// unknown value. The same no-guessing rule applies to providers as it does models.
fn primary_value(distinct_values: u64, latest_value: String) -> Option<String> {
    if distinct_values == 1 && !latest_value.is_empty() {
        Some(latest_value)
    } else {
        None
    }
}

/// The price window covering `event_time`, if any.
///
/// Matching on the event's own timestamp rather than "now" is what stops a price change from
/// silently rewriting the cost of everything already recorded.
fn price_in_effect(windows: &[AiModelPricingRow], event_time: u32) -> Option<&AiModelPricingRow> {
    windows.iter().find(|window| {
        window.effective_from <= event_time
            && window
                .effective_to
                .is_none_or(|effective_to| event_time <= effective_to)
    })
}

/// Cost in micro-USD, or `None` if any token class present on the event has no price.
///
/// All-or-nothing on purpose: a partial sum would understate the true cost while looking like a
/// complete figure. plan.md 9.5 requires an unknown price to produce a null cost, not a zero.
fn estimate_cost(record: &AiUsageRecord, price: &AiModelPricingRow) -> Option<u64> {
    let mut total: u64 = 0;
    let mut reported_any = false;

    // A token class the provider didn't report contributes nothing and blocks nothing — it is
    // absent, not zero-cost. A class that *is* reported but has no rate makes the whole estimate
    // unknown.
    let mut add = |tokens: Option<u64>, rate: Option<u64>| -> Option<()> {
        let Some(tokens) = tokens else {
            return Some(());
        };
        reported_any = true;
        let rate = rate?;
        total = total.saturating_add(tokens.saturating_mul(rate) / 1_000_000);
        Some(())
    };

    add(record.input_tokens, Some(price.input_microusd_per_million))?;
    add(
        record.output_tokens,
        Some(price.output_microusd_per_million),
    )?;
    add(
        record.cache_read_tokens,
        price.cache_read_microusd_per_million,
    )?;
    add(
        record.cache_write_tokens,
        price.cache_write_microusd_per_million,
    )?;

    reported_any.then_some(total)
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::{TimeZone, Utc};
    use wakaclock_core::ai::TokenSource;

    fn price(from: u32, to: Option<u32>, input: u64, output: u64) -> AiModelPricingRow {
        AiModelPricingRow {
            provider: "anthropic".to_string(),
            model: "claude-opus-5".to_string(),
            effective_from: from,
            effective_to: to,
            input_microusd_per_million: input,
            output_microusd_per_million: output,
            cache_read_microusd_per_million: Some(input / 10),
            cache_write_microusd_per_million: Some(input * 5 / 4),
            currency: "USD".to_string(),
            pricing_version: "test".to_string(),
            updated_at: 0,
        }
    }

    fn record(input: Option<u64>, output: Option<u64>) -> AiUsageRecord {
        AiUsageRecord {
            usage_event_id: "msg_1".to_string(),
            ai_session_id: "s1".to_string(),
            occurred_at: Utc.timestamp_opt(1_000, 0).unwrap(),
            agent: "claude-code".to_string(),
            provider: Some("anthropic".to_string()),
            model: Some("claude-opus-5".to_string()),
            prompt_count: 1,
            prompt_character_count: Some(12),
            input_tokens: input,
            output_tokens: output,
            cache_read_tokens: None,
            cache_write_tokens: None,
            token_source: TokenSource::Transcript,
            project_hint: None,
        }
    }

    #[test]
    fn cost_is_tokens_times_rate_per_million() {
        // 1M input at $5/M plus 1M output at $25/M = $30.00 = 30_000_000 micro-USD.
        let cost = estimate_cost(
            &record(Some(1_000_000), Some(1_000_000)),
            &price(0, None, 5_000_000, 25_000_000),
        );
        assert_eq!(cost, Some(30_000_000));
    }

    #[test]
    fn an_unreported_token_class_contributes_nothing_rather_than_blocking_the_estimate() {
        let cost = estimate_cost(
            &record(Some(1_000_000), None),
            &price(0, None, 5_000_000, 25_000_000),
        );
        assert_eq!(cost, Some(5_000_000));
    }

    #[test]
    fn an_event_without_any_reported_tokens_has_unknown_cost() {
        assert_eq!(
            estimate_cost(&record(None, None), &price(0, None, 5_000_000, 25_000_000)),
            None
        );
    }

    #[test]
    fn a_reported_class_with_no_rate_makes_the_whole_cost_unknown() {
        let mut priced = price(0, None, 5_000_000, 25_000_000);
        priced.cache_read_microusd_per_million = None;
        let mut event = record(Some(1_000_000), None);
        event.cache_read_tokens = Some(500_000);

        assert_eq!(
            estimate_cost(&event, &priced),
            None,
            "a partial sum would understate the cost while looking complete"
        );
    }

    #[test]
    fn cache_reads_are_far_cheaper_than_fresh_input() {
        let mut event = record(None, None);
        event.cache_read_tokens = Some(1_000_000);
        assert_eq!(
            estimate_cost(&event, &price(0, None, 5_000_000, 25_000_000)),
            Some(500_000),
            "cache reads bill at a tenth of the input rate"
        );
    }

    #[test]
    fn an_event_is_priced_by_the_window_covering_its_own_timestamp() {
        let windows = vec![
            price(2_000, None, 3_000_000, 15_000_000),
            price(0, Some(1_999), 2_000_000, 10_000_000),
        ];
        assert_eq!(
            price_in_effect(&windows, 1_000)
                .unwrap()
                .input_microusd_per_million,
            2_000_000,
            "an old event must keep the rate that applied when it happened"
        );
        assert_eq!(
            price_in_effect(&windows, 5_000)
                .unwrap()
                .input_microusd_per_million,
            3_000_000
        );
    }

    #[test]
    fn an_event_before_any_known_price_is_unpriced_not_free() {
        let windows = vec![price(10_000, None, 5_000_000, 25_000_000)];
        assert!(price_in_effect(&windows, 500).is_none());
    }

    #[test]
    fn a_model_with_no_catalog_entry_is_unpriced() {
        assert!(price_in_effect(&[], 1_000).is_none());
    }

    #[test]
    fn a_single_model_session_reports_its_model() {
        assert_eq!(
            primary_model(1, "claude-opus-5".to_string()),
            Some("claude-opus-5".to_string())
        );
    }

    #[test]
    fn a_multi_model_session_reports_no_primary_model() {
        assert_eq!(
            primary_model(2, "claude-opus-5".to_string()),
            None,
            "plan.md 9.4 forbids arbitrarily selecting the last model"
        );
    }

    #[test]
    fn a_session_with_only_unknown_models_reports_none() {
        assert_eq!(primary_model(1, String::new()), None);
    }

    #[test]
    fn batch_preparation_counts_identical_duplicates_without_reordering() {
        let first = record(Some(1), Some(2));
        let mut second = first.clone();
        second.usage_event_id = "msg_2".to_string();
        let input = vec![first.clone(), second.clone(), first.clone()];
        let prepared = prepare_batch(&input).unwrap();
        assert_eq!(prepared.duplicates_in_batch, 1);
        assert_eq!(
            prepared
                .records
                .iter()
                .map(|record| record.usage_event_id.as_str())
                .collect::<Vec<_>>(),
            vec!["msg_1", "msg_2"]
        );
        assert_eq!(prepared.payload_hashes.len(), 2);
    }

    #[test]
    fn batch_preparation_rejects_same_id_with_different_payload() {
        let first = record(Some(1), Some(2));
        let mut conflicting = first.clone();
        conflicting.output_tokens = Some(3);
        let error = prepare_batch(&[first, conflicting]).unwrap_err();
        assert!(matches!(error, AiUsageBatchError::IdentityConflict(_)));
    }

    fn usage_row(
        id: &str,
        project_id: Option<Uuid>,
        project_attribution_method: Option<&str>,
    ) -> AiUsageEventRow {
        AiUsageEventRow {
            user_id: Uuid::nil(),
            date: 0,
            usage_event_id: id.to_string(),
            event_payload_hash: Some(format!("hash-{id}")),
            ai_session_id: "session-1".to_string(),
            event_time: 1,
            project_id,
            project_attribution_method: project_attribution_method.map(str::to_string),
            ai_agent: "test".to_string(),
            ai_provider: Some("provider".to_string()),
            ai_model: Some("model".to_string()),
            prompt_count: 1,
            prompt_character_count: Some(1),
            input_tokens: Some(1),
            output_tokens: Some(1),
            cache_read_tokens: None,
            cache_write_tokens: None,
            estimated_cost_microusd: None,
            pricing_version: None,
            token_source: "transcript".to_string(),
            version: 1,
            received_at: 1,
        }
    }

    #[test]
    fn projectless_facts_inherit_the_only_explicit_session_project() {
        let project = Uuid::from_u128(1);
        let mut facts = vec![
            usage_row("explicit", Some(project), Some("explicit_project_hint")),
            usage_row("projectless", None, None),
        ];

        let replacements = project_attribution_replacements(&mut facts, 42);

        assert_eq!(facts[1].project_id, Some(project));
        assert_eq!(
            facts[1].project_attribution_method.as_deref(),
            Some("sole_project_session")
        );
        assert_eq!(replacements.len(), 1);
        assert_eq!(replacements[0].version, 42);
    }

    #[test]
    fn projectless_facts_stay_unattributed_in_a_multi_project_session() {
        let mut facts = vec![
            usage_row(
                "explicit-a",
                Some(Uuid::from_u128(1)),
                Some("explicit_project_hint"),
            ),
            usage_row(
                "explicit-b",
                Some(Uuid::from_u128(2)),
                Some("explicit_project_hint"),
            ),
            usage_row("projectless", None, None),
        ];

        let replacements = project_attribution_replacements(&mut facts, 42);

        assert!(facts[2].project_id.is_none());
        assert!(facts[2].project_attribution_method.is_none());
        assert!(replacements.is_empty());
    }

    #[test]
    fn a_new_explicit_project_withdraws_an_old_sole_project_inference() {
        let project_a = Uuid::from_u128(1);
        let mut facts = vec![
            usage_row("explicit-a", Some(project_a), Some("explicit_project_hint")),
            usage_row("inferred-a", Some(project_a), Some("sole_project_session")),
            usage_row(
                "explicit-b",
                Some(Uuid::from_u128(2)),
                Some("explicit_project_hint"),
            ),
        ];

        let replacements = project_attribution_replacements(&mut facts, 42);

        assert!(facts[1].project_id.is_none());
        assert!(facts[1].project_attribution_method.is_none());
        assert_eq!(replacements.len(), 1);
        assert_eq!(replacements[0].usage_event_id, "inferred-a");
    }
}
