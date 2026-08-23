use anyhow::{Context, Result};
use std::collections::{HashMap, HashSet};
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
        let received = records.len();
        let now = chrono::Utc::now().timestamp().max(0) as u32;

        // Collapse within the batch first. A client retrying mid-batch can legitimately send the
        // same event twice in one call, and ClickHouse would keep both until a merge.
        let mut seen: HashSet<String> = HashSet::new();
        let mut deduped = Vec::with_capacity(records.len());
        for record in records {
            if seen.insert(record.usage_event_id.clone()) {
                deduped.push(record);
            }
        }
        let duplicates_in_batch = received - deduped.len();

        // Price once per model rather than once per event — a batch is overwhelmingly one or two
        // models, and the catalog is small enough to hold for the duration of the call.
        let mut pricing_cache: HashMap<(String, String), Vec<AiModelPricingRow>> = HashMap::new();
        for record in &deduped {
            if let (Some(provider), Some(model)) =
                (record.provider.as_deref(), record.model.as_deref())
            {
                let key = (provider.to_string(), model.to_string());
                if !pricing_cache.contains_key(&key) {
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
                    pricing_cache.insert(key, windows);
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

            rows.push(AiUsageEventRow {
                user_id,
                date: (event_time / 86_400) as u16,
                usage_event_id: record.usage_event_id.clone(),
                ai_session_id: record.ai_session_id.clone(),
                event_time,
                // Explicit privacy-safe hints are resolved here. A later conservative pass may
                // attach the event to a session's sole known project; ambiguous sessions stay in
                // the unattributed-project bucket instead of copying totals to every project.
                project_id,
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
                version: u64::from(now),
                received_at: now,
            });
        }

        let already_present: HashSet<String> = match self
            .repo
            .existing_event_ids(
                user_id,
                &rows
                    .iter()
                    .map(|row| row.usage_event_id.clone())
                    .collect::<Vec<_>>(),
            )
            .await
        {
            Ok(ids) => ids.into_iter().collect(),
            Err(error) => {
                // The stable event id and ReplacingMergeTree remain the
                // server-side safety net. If the read-side dedup query is
                // temporarily unavailable, accepting the batch is preferable
                // to retrying the same transcript forever.
                warn!(
                    %user_id,
                    %error,
                    "AI usage existing-event lookup unavailable; relying on server dedup"
                );
                HashSet::new()
            }
        };

        // Attach project-less events to a session's sole known project. We collect from both
        // the existing authoritative events and the explicit hints in this batch, so retries
        // and split transcript uploads converge on the same allocation. A session touching two
        // projects deliberately receives no inferred project.
        let mut session_projects: HashMap<String, HashSet<Uuid>> = HashMap::new();
        let mut explicit_session_projects: HashSet<(String, Uuid)> = HashSet::new();
        for row in &rows {
            if let Some(project_id) = row.project_id {
                session_projects
                    .entry(row.ai_session_id.clone())
                    .or_default()
                    .insert(project_id);
                explicit_session_projects.insert((row.ai_session_id.clone(), project_id));
            }
        }
        match self.repo.session_project_ids(user_id, &session_ids).await {
            Ok(rows) => {
                for row in rows {
                    session_projects
                        .entry(row.ai_session_id)
                        .or_default()
                        .insert(row.project_id);
                }
            }
            Err(error) => {
                warn!(
                    %user_id,
                    %error,
                    "AI usage session-project lookup unavailable; leaving events unattributed"
                );
            }
        }
        let mut rows = rows;
        for row in &mut rows {
            if row.project_id.is_none() {
                if let Some(project_id) =
                    session_projects
                        .get(&row.ai_session_id)
                        .and_then(|projects| {
                            (projects.len() == 1).then(|| *projects.iter().next().unwrap())
                        })
                {
                    row.project_id = Some(project_id);
                }
            }
        }

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
        if let Err(error) = self
            .persist_session_projects(user_id, &new_rows, &explicit_session_projects, now)
            .await
        {
            warn!(
                %user_id,
                %error,
                "AI usage session-project projection failed after event acceptance"
            );
        }
        let sessions_touched = match self.refresh_sessions(user_id, &session_ids, now).await {
            Ok(touched) => touched,
            Err(error) => {
                warn!(
                    %user_id,
                    %error,
                    "AI usage session projection failed after event acceptance"
                );
                0
            }
        };

        Ok(AiUsageIngestReport {
            received,
            stored: new_rows.len(),
            duplicates_in_batch,
            unpriced,
            sessions_touched,
        })
    }

    async fn persist_session_projects(
        &self,
        user_id: Uuid,
        rows: &[AiUsageEventRow],
        explicit_session_projects: &HashSet<(String, Uuid)>,
        version: u32,
    ) -> Result<()> {
        use std::collections::HashMap;
        #[derive(Default)]
        struct Allocation {
            first: u32,
            last: u32,
            count: u64,
        }
        let mut allocations: HashMap<(String, Uuid), Allocation> = HashMap::new();
        for row in rows {
            let Some(project_id) = row.project_id else {
                continue;
            };
            let entry = allocations
                .entry((row.ai_session_id.clone(), project_id))
                .or_insert_with(|| Allocation {
                    first: row.event_time,
                    last: row.event_time,
                    count: 0,
                });
            entry.first = entry.first.min(row.event_time);
            entry.last = entry.last.max(row.event_time);
            entry.count += 1;
        }
        let rows = allocations
            .into_iter()
            .map(|((session_id, project_id), allocation)| {
                let token_allocation_method =
                    if explicit_session_projects.contains(&(session_id.clone(), project_id)) {
                        "explicit_project_hint"
                    } else {
                        "sole_project_session"
                    };
                crate::model::ai_usage::AiSessionProjectRow {
                    user_id,
                    ai_session_id: session_id,
                    project_id,
                    first_event_at: allocation.first,
                    last_event_at: allocation.last,
                    event_count: allocation.count,
                    ai_lines_changed: 0,
                    token_allocation_method: token_allocation_method.to_string(),
                    version: u64::from(version),
                }
            })
            .collect::<Vec<_>>();
        self.repo.upsert_session_projects(&rows).await
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
        now: u32,
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
                ai_agent: rollup.ai_agent,
                ai_provider: primary_value(rollup.distinct_providers, rollup.latest_provider),
                primary_model: primary_model(rollup.distinct_models, rollup.latest_model),
                ai_client: None,
                editor: None,
                machine: None,
                operating_system: None,
                prompt_count: rollup.prompt_count,
                version: u64::from(now),
                updated_at: now,
            })
            .collect();

        let touched = rows.len();
        self.repo.upsert_sessions(&rows).await?;
        Ok(touched)
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
}
