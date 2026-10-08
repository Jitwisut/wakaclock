use anyhow::{Context, Result};
use chrono::{DateTime, Utc};
use std::{
    collections::{BTreeMap, BTreeSet},
    sync::Arc,
};
use uuid::Uuid;

use crate::model::{ai_usage::AiUsageEventRow, date_range::ResolvedRange, team_insights::*};
use crate::repository::team_insights::{ProjectionScope, TeamInsightsRepository};
use crate::services::authorization::{AuthorizationService, OrganizationAction};

#[derive(Debug, thiserror::Error)]
pub enum TeamError {
    #[error("Team is not enabled for this organization")]
    Disabled,
    #[error("sharing or access changed during this request; retry")]
    ProjectionChanged,
    #[error("{0}")]
    Invalid(&'static str),
    #[error("work link not found")]
    NotFound,
}

pub struct TeamInsightsService {
    repo: Option<Arc<TeamInsightsRepository>>,
    authorization: Arc<AuthorizationService>,
    enabled: bool,
}

impl TeamInsightsService {
    pub fn new(
        repo: Option<Arc<TeamInsightsRepository>>,
        authorization: Arc<AuthorizationService>,
        enabled: bool,
    ) -> Self {
        Self {
            repo,
            authorization,
            enabled,
        }
    }

    fn repo(&self) -> Result<&TeamInsightsRepository> {
        self.repo.as_deref().context("Team requires PostgreSQL")
    }

    async fn readable(
        &self,
        actor: Uuid,
        org: Uuid,
        team: Option<Uuid>,
    ) -> Result<&TeamInsightsRepository> {
        self.authorization
            .require_team_read(actor, org, team)
            .await?;
        let repo = self.repo()?;
        if !self.enabled || !repo.enabled(org).await? {
            return Err(TeamError::Disabled.into());
        }
        Ok(repo)
    }

    pub async fn consent(&self, actor: Uuid, org: Uuid) -> Result<TeamConsent> {
        // Preview/withdrawal must remain accessible even during a feature rollback.
        self.authorization
            .require(actor, org, OrganizationAction::ReadSelf, None)
            .await?;
        self.repo()?.consent(org, actor).await
    }

    pub async fn readiness(&self, actor: Uuid, org: Uuid) -> Result<serde_json::Value> {
        self.authorization
            .require(actor, org, OrganizationAction::ManageSecurity, None)
            .await?;
        let evidence = self.repo()?.release_evidence(org).await?;
        Ok(serde_json::json!({
            "receiver_enabled": self.enabled,
            "organization_enabled": self.repo()?.enabled(org).await?,
            "production_ready": false,
            "checkout_available": false,
            "implementation_stage": "privacy_and_metadata_receiver",
            "gates": crate::services::team_release::release_gates(&evidence),
            "billing_packages": crate::services::team_billing::PACKAGES,
            "trial_days": crate::services::team_billing::TRIAL_DAYS,
            "payment_grace_days": crate::services::team_billing::GRACE_DAYS,
            "reason": "integration_reconciliation_and_commercial_runtime_pending"
        }))
    }

    pub async fn insights(
        &self,
        actor: Uuid,
        org: Uuid,
        team: Option<Uuid>,
        range: ResolvedRange,
    ) -> Result<TeamInsights> {
        let repo = self.readable(actor, org, team).await?;
        anyhow::ensure!(
            range.days_included() <= 90,
            TeamError::Invalid("Team range exceeds 90 days")
        );
        let (from, to) = range.unix_bounds();
        anyhow::ensure!(
            from >= 0.0 && to <= u32::MAX as f64,
            TeamError::Invalid("unsupported date range")
        );
        anyhow::ensure!(
            from >= (Utc::now() - chrono::Months::new(12)).timestamp() as f64,
            TeamError::Invalid("range is outside analytics retention")
        );
        let scope = repo.scope(org, team).await?;
        let users: Vec<_> = scope.contributors.iter().map(|c| c.user_id).collect();
        let facts = repo.facts(&users, from as u32, to as u32).await?;
        let mut projection = project_cost(&facts, &scope, &range)?;
        // Read-time checks are shared by API and CSV, no stale report cache can bypass consent.
        self.authorization
            .require_team_read(actor, org, team)
            .await?;
        if !repo.enabled(org).await? || repo.generation(org).await? != scope.generation {
            return Err(TeamError::ProjectionChanged.into());
        }
        // Capture and delivery coverage are independent from token/pricing coverage.
        // Until those are projected with contributor suppression, completeness is unconfirmed.
        if projection.0.value.is_some() {
            projection.0.status = "partial";
            projection
                .0
                .reason
                .get_or_insert("capture_delivery_coverage_unconfirmed");
        }
        for provider in &mut projection.1 {
            provider.cost_microusd.status = "partial";
            provider
                .cost_microusd
                .reason
                .get_or_insert("capture_delivery_coverage_unconfirmed");
        }
        Ok(TeamInsights {
            organization_id: org,
            team_id: team,
            start: range.start.to_string(),
            end: range.end.to_string(),
            timezone: range.timezone.to_string(),
            generation: scope.generation,
            estimated_ai_cost_microusd: projection.0,
            provider_breakdown: projection.1,
            merged_pr_cost_microusd: Metric::unavailable("confirmed_usage_allocation_not_ready"),
            currency: "USD",
            measurement_health: vec!["capture_delivery_coverage_unconfirmed"],
            production_ready: false,
        })
    }

    pub async fn work_items(
        &self,
        actor: Uuid,
        org: Uuid,
        team: Option<Uuid>,
    ) -> Result<Vec<TeamWorkItem>> {
        let repo = self.readable(actor, org, team).await?;
        let generation = repo.generation(org).await?;
        let items = repo.work_items(org, team).await?;
        self.authorization
            .require_team_read(actor, org, team)
            .await?;
        if repo.generation(org).await? != generation {
            return Err(TeamError::ProjectionChanged.into());
        }
        Ok(items)
    }

    pub async fn receipt(
        &self,
        actor: Uuid,
        org: Uuid,
        team: Option<Uuid>,
        repository: Uuid,
        item: i64,
    ) -> Result<WorkReceipt> {
        let repo = self.readable(actor, org, team).await?;
        let scope = repo.scope(org, team).await?;
        let project = repo
            .work_item_project(org, repository, item)
            .await?
            .ok_or(TeamError::NotFound)?;
        anyhow::ensure!(scope.projects.contains(&project), TeamError::NotFound);
        let links = repo.receipt_links(org, repository, item, team).await?;
        anyhow::ensure!(
            links.len() <= 200,
            TeamError::Invalid("receipt is too large")
        );
        let mut sessions = vec![];
        let mut total = 0u64;
        let mut any = false;
        let mut partial = false;
        let mut updated = None;
        let retention_start = Utc::now() - chrono::Months::new(12);
        for record in links {
            let facts = repo
                .session_facts(record.user_id, &record.link.session_id)
                .await?;
            anyhow::ensure!(
                facts.len() <= 10_000,
                TeamError::Invalid("session is too large")
            );
            let since = record.individual_from.max(retention_start);
            if !facts.iter().any(|f| {
                DateTime::from_timestamp(f.event_time as i64, 0).is_some_and(|at| at >= since)
                    && f.project_id == Some(record.project_id)
                    && f.project_attribution_method.as_deref() == Some("explicit_project_hint")
            }) {
                continue;
            }
            if record.allocation_targets != 1 {
                sessions.push(ReceiptSession {
                    session_id: record.link.session_id,
                    link_id: record.link.id,
                    link_evidence: record.link.evidence,
                    cost_microusd: Metric::unavailable("ambiguous_work_allocation"),
                    allocation: "unallocated",
                });
                partial = true;
                continue;
            }
            let mut cost = receipt_cost(&facts, record.project_id, since)?;
            if cost.value.is_some() {
                cost.status = "partial";
                cost.reason
                    .get_or_insert("capture_delivery_coverage_unconfirmed");
            }
            if let Some(value) = cost.value {
                total = total.checked_add(value).context("AI cost overflow")?;
                any = true;
            }
            partial |= cost.status != "complete";
            updated = updated.max(cost.updated_at);
            sessions.push(ReceiptSession {
                session_id: record.link.session_id,
                link_id: record.link.id,
                link_evidence: record.link.evidence,
                cost_microusd: cost,
                allocation: "confirmed_single_work_item",
            });
        }
        self.authorization
            .require_team_read(actor, org, team)
            .await?;
        if !repo.enabled(org).await? || repo.generation(org).await? != scope.generation {
            return Err(TeamError::ProjectionChanged.into());
        }
        let sharing = if sessions.is_empty() {
            "withheld_or_unlinked"
        } else {
            "individual_opt_in_only"
        };
        let metric = if any {
            Metric {
                value: Some(total),
                status: "partial",
                reason: Some(if partial {
                    "coverage_or_allocation_unconfirmed"
                } else {
                    "nonsharing_data_withheld"
                }),
                coverage: None,
                provenance: "confirmed_links_and_canonical_usage",
                updated_at: updated,
                calculation_version: CALCULATION_VERSION,
            }
        } else {
            Metric::unavailable("withheld_or_unallocated")
        };
        Ok(WorkReceipt {
            repository_id: repository,
            work_item_id: item,
            sessions,
            estimated_cost_microusd: metric,
            sharing,
            generation: scope.generation,
        })
    }

    pub async fn links(&self, actor: Uuid, org: Uuid) -> Result<Vec<WorkLink>> {
        self.authorization
            .require(actor, org, OrganizationAction::ReadSelf, None)
            .await?;
        self.repo()?.links(org, actor).await
    }

    pub async fn propose(&self, actor: Uuid, org: Uuid, request: LinkRequest) -> Result<WorkLink> {
        self.authorization
            .require(actor, org, OrganizationAction::ReadSelf, None)
            .await?;
        if !self.enabled || !self.repo()?.enabled(org).await? {
            return Err(TeamError::Disabled.into());
        }
        anyhow::ensure!(
            valid_session_id(&request.session_id),
            TeamError::Invalid("invalid session identity")
        );
        let repo = self.repo()?;
        let consent = repo.consent(org, actor).await?;
        let from = consent
            .aggregate_from
            .ok_or(TeamError::Invalid("aggregate consent required"))?;
        let facts = repo.session_facts(actor, &request.session_id).await?;
        anyhow::ensure!(
            !facts.is_empty() && facts.len() <= 10_000,
            TeamError::Invalid("session unavailable")
        );
        // An owner can confirm a link, but cannot manufacture repository/project provenance.
        let team = repo
            .work_item_team(org, request.repository_id, request.work_item_id)
            .await?
            .ok_or(TeamError::NotFound)?;
        self.authorization
            .require_team_read(actor, org, team)
            .await?;
        let project = repo
            .work_item_project(org, request.repository_id, request.work_item_id)
            .await?
            .ok_or(TeamError::NotFound)?;
        anyhow::ensure!(
            facts
                .iter()
                .any(|f| DateTime::from_timestamp(f.event_time as i64, 0)
                    .is_some_and(|at| at >= from)
                    && f.project_id == Some(project)
                    && f.project_attribution_method.as_deref() == Some("explicit_project_hint")),
            TeamError::Invalid("session has no consented repository evidence")
        );
        repo.propose(org, actor, &request).await
    }

    pub async fn decide(&self, actor: Uuid, org: Uuid, id: Uuid, status: &str) -> Result<WorkLink> {
        self.authorization
            .require(actor, org, OrganizationAction::ReadSelf, None)
            .await?;
        anyhow::ensure!(
            matches!(status, "confirmed" | "rejected" | "withdrawn"),
            TeamError::Invalid("invalid link decision")
        );
        // Allow withdrawing evidence during rollback; never permit a manager to act as its owner.
        if status == "confirmed" && (!self.enabled || !self.repo()?.enabled(org).await?) {
            return Err(TeamError::Disabled.into());
        }
        if status == "confirmed" && !self.repo()?.consent(org, actor).await?.share_aggregate {
            return Err(TeamError::Invalid("aggregate consent required").into());
        }
        self.repo()?
            .decide_link(org, actor, id, status)
            .await?
            .ok_or_else(|| TeamError::NotFound.into())
    }
}

fn valid_session_id(id: &str) -> bool {
    id.len() == 64
        && id
            .bytes()
            .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
}

fn receipt_cost(
    facts: &[AiUsageEventRow],
    project: Uuid,
    since: DateTime<Utc>,
) -> Result<Metric<u64>> {
    let mut latest = BTreeMap::new();
    for fact in facts {
        let key = (fact.user_id, &fact.usage_event_id);
        if latest
            .get(&key)
            .is_none_or(|old: &&AiUsageEventRow| old.version < fact.version)
        {
            latest.insert(key, fact);
        }
    }
    let eligible: Vec<_> = latest
        .into_values()
        .filter(|fact| {
            DateTime::from_timestamp(fact.event_time as i64, 0).is_some_and(|at| at >= since)
                && fact.project_id == Some(project)
                && fact.project_attribution_method.as_deref() == Some("explicit_project_hint")
        })
        .collect();
    let mut sum = 0u64;
    let mut known = 0usize;
    for fact in &eligible {
        if let (Some(cost), Some(_), Some(_), Some(_)) = (
            fact.estimated_cost_microusd,
            &fact.pricing_version,
            &fact.ai_provider,
            &fact.ai_model,
        ) {
            sum = sum.checked_add(cost).context("AI cost overflow")?;
            known += 1;
        }
    }
    if known == 0 {
        return Ok(Metric::unavailable("usage_or_price_unavailable"));
    }
    Ok(Metric {
        value: Some(sum),
        status: if known == eligible.len() {
            "complete"
        } else {
            "partial"
        },
        reason: if known == eligible.len() {
            None
        } else {
            Some("usage_or_price_missing")
        },
        coverage: Some(known as f64 / eligible.len() as f64),
        provenance: "confirmed_links_and_canonical_usage",
        updated_at: eligible
            .iter()
            .filter_map(|f| DateTime::from_timestamp(f.received_at as i64, 0))
            .max(),
        calculation_version: CALCULATION_VERSION,
    })
}

/// A partition is publishable only if every nonempty cell has five *actual*
/// contributors. Suppress the parent as well as children when a complementary
/// cell is small; the parent cannot be used to reconstruct the withheld cell.
pub fn publishable_partition(cells: &[BTreeSet<Uuid>]) -> bool {
    if cells.is_empty()
        || cells
            .iter()
            .any(|s| !s.is_empty() && s.len() < MIN_CONTRIBUTORS)
    {
        return false;
    }
    // Intersections/complements matter too: two safe-looking five-person
    // subtotals with four shared people can expose each remaining person.
    let users: BTreeSet<_> = cells.iter().flat_map(|s| s.iter().copied()).collect();
    let mut cohorts: BTreeMap<Vec<bool>, usize> = BTreeMap::new();
    for user in users {
        *cohorts
            .entry(cells.iter().map(|s| s.contains(&user)).collect())
            .or_default() += 1;
    }
    !cohorts.is_empty() && cohorts.values().all(|count| *count >= MIN_CONTRIBUTORS)
}

type CostProjection = (Metric<u64>, Vec<ProviderCost>);
pub fn project_cost(
    facts: &[AiUsageEventRow],
    scope: &ProjectionScope,
    range: &ResolvedRange,
) -> Result<CostProjection> {
    let mut unique = BTreeMap::new();
    for fact in facts {
        let key = (fact.user_id, &fact.usage_event_id);
        if unique
            .get(&key)
            .is_none_or(|old: &&AiUsageEventRow| old.version < fact.version)
        {
            unique.insert(key, fact);
        }
    }
    let mut days: BTreeMap<String, BTreeSet<Uuid>> = BTreeMap::new();
    let mut priced = BTreeSet::new();
    let mut unknown = BTreeSet::new();
    let mut identifiable = BTreeSet::new();
    let mut withheld = BTreeSet::new();
    let mut providers: BTreeMap<(String, String), (BTreeSet<Uuid>, u64)> = BTreeMap::new();
    let mut known_events = 0usize;
    let mut event_count = 0usize;
    let mut sum = 0u64;
    let mut updated = None;
    for fact in unique.values() {
        let Some(contributor) = scope
            .contributors
            .iter()
            .find(|c| c.user_id == fact.user_id)
        else {
            continue;
        };
        let Some(at) = DateTime::from_timestamp(fact.event_time as i64, 0) else {
            continue;
        };
        if at < contributor.aggregate_from
            || !scope
                .projects
                .contains(&fact.project_id.unwrap_or(Uuid::nil()))
            || fact.project_attribution_method.as_deref() != Some("explicit_project_hint")
        {
            continue;
        }
        let day = at.with_timezone(&range.timezone).date_naive();
        if day < range.start || day > range.end {
            continue;
        }
        days.entry(day.to_string())
            .or_default()
            .insert(fact.user_id);
        if contributor.individual_from.is_some_and(|from| at >= from) {
            identifiable.insert(fact.user_id);
        } else {
            withheld.insert(fact.user_id);
        }
        event_count += 1;
        if let (Some(cost), Some(_version), Some(provider), Some(model)) = (
            fact.estimated_cost_microusd,
            &fact.pricing_version,
            &fact.ai_provider,
            &fact.ai_model,
        ) {
            priced.insert(fact.user_id);
            sum = sum.checked_add(cost).context("AI cost overflow")?;
            known_events += 1;
            let cell = providers
                .entry((provider.clone(), model.clone()))
                .or_default();
            cell.0.insert(fact.user_id);
            cell.1 = cell.1.checked_add(cost).context("AI cost overflow")?;
        } else {
            unknown.insert(fact.user_id);
        }
        let received = DateTime::from_timestamp(fact.received_at as i64, 0);
        updated = updated.max(received);
    }
    let mut cells: Vec<_> = days.into_values().collect();
    cells.push(priced);
    cells.push(unknown);
    cells.push(identifiable);
    cells.push(withheld);
    cells.extend(providers.values().map(|p| p.0.clone()));
    if !publishable_partition(&cells) {
        return Ok((Metric::unavailable("privacy_suppressed"), vec![]));
    }
    if known_events == 0 {
        return Ok((Metric::unavailable("pricing_unavailable"), vec![]));
    }
    let metric = Metric {
        value: Some(sum),
        status: if known_events == event_count {
            "complete"
        } else {
            "partial"
        },
        reason: if known_events == event_count {
            None
        } else {
            Some("usage_or_price_missing")
        },
        coverage: Some(known_events as f64 / event_count as f64),
        provenance: "canonical_usage_facts",
        updated_at: updated,
        calculation_version: CALCULATION_VERSION,
    };
    let breakdown = providers
        .into_iter()
        .map(|((provider, model), (_, cost))| ProviderCost {
            provider,
            model,
            cost_microusd: Metric {
                value: Some(cost),
                ..metric.clone()
            },
        })
        .collect();
    Ok((metric, breakdown))
}

#[cfg(test)]
mod tests {
    use super::*;
    fn users(n: u128) -> BTreeSet<Uuid> {
        (1..=n).map(Uuid::from_u128).collect()
    }
    #[test]
    fn suppresses_parent_and_small_complement() {
        assert!(!publishable_partition(&[users(6), users(1)]));
        assert!(!publishable_partition(&[users(4)]));
        assert!(publishable_partition(&[users(5), BTreeSet::new()]));
        assert!(!publishable_partition(&[]));
        let shifted: BTreeSet<_> = (2..=6).map(Uuid::from_u128).collect();
        assert!(!publishable_partition(&[users(5), shifted]));
    }
    #[test]
    fn session_identity_is_scoped_opaque_hash() {
        assert!(!valid_session_id("../private"));
        assert!(valid_session_id(&"a".repeat(64)));
        assert!(!valid_session_id(&"A".repeat(64)));
    }

    fn fixture() -> (Vec<AiUsageEventRow>, ProjectionScope, ResolvedRange) {
        let at = 1_791_417_600u32; // 2026-10-08T00:00:00Z; synthetic metadata only.
        let project = Uuid::from_u128(99);
        let facts = (1..=5)
            .map(|n| AiUsageEventRow {
                user_id: Uuid::from_u128(n),
                date: 0,
                usage_event_id: format!("event-{n}"),
                event_payload_hash: None,
                ai_session_id: "native-session".into(),
                collector_id: Some("installation".into()),
                event_time: at,
                project_id: Some(project),
                project_attribution_method: Some("explicit_project_hint".into()),
                ai_agent: "codex".into(),
                ai_provider: Some("openai".into()),
                ai_model: Some("model".into()),
                prompt_count: 0,
                prompt_character_count: None,
                input_tokens: Some(10),
                output_tokens: Some(20),
                cache_read_tokens: None,
                cache_write_tokens: None,
                estimated_cost_microusd: Some(100),
                pricing_version: Some("price-v1".into()),
                token_source: "native".into(),
                version: 1,
                received_at: at,
            })
            .collect::<Vec<_>>();
        let scope = ProjectionScope {
            generation: 1,
            contributors: facts
                .iter()
                .map(|f| crate::repository::team_insights::Contributor {
                    user_id: f.user_id,
                    aggregate_from: DateTime::from_timestamp(at as i64 - 1, 0).unwrap(),
                    individual_from: None,
                })
                .collect(),
            projects: [project].into_iter().collect(),
        };
        let range = ResolvedRange::parse("2026-10-08", "2026-10-08", Some("UTC")).unwrap();
        (facts, scope, range)
    }

    #[test]
    fn cost_is_once_per_fact_and_zero_is_observed() {
        let (mut facts, scope, range) = fixture();
        facts.push(facts[0].clone());
        assert_eq!(
            project_cost(&facts, &scope, &range).unwrap().0.value,
            Some(500)
        );
        for f in &mut facts {
            f.estimated_cost_microusd = Some(0);
        }
        assert_eq!(
            project_cost(&facts, &scope, &range).unwrap().0.value,
            Some(0)
        );
    }

    #[test]
    fn correction_to_unknown_does_not_resurrect_old_cost() {
        let (mut facts, scope, range) = fixture();
        let mut correction = facts[0].clone();
        correction.version = 2;
        correction.estimated_cost_microusd = None;
        facts.push(correction);
        let projection = project_cost(&facts, &scope, &range).unwrap();
        assert_eq!(projection.0.value, None);
        assert_eq!(projection.0.reason, Some("privacy_suppressed"));
        assert!(projection.1.is_empty());
    }

    #[test]
    fn private_history_inferred_project_and_nonmember_never_contribute() {
        let (mut facts, mut scope, range) = fixture();
        scope.contributors[0].aggregate_from =
            DateTime::from_timestamp(facts[0].event_time as i64 + 1, 0).unwrap();
        assert_eq!(project_cost(&facts, &scope, &range).unwrap().0.value, None);
        let (fresh, scope, _) = fixture();
        facts = fresh;
        facts[0].project_attribution_method = Some("sole_project_session".into());
        assert_eq!(project_cost(&facts, &scope, &range).unwrap().0.value, None);
        facts[0].user_id = Uuid::from_u128(999);
        assert_eq!(project_cost(&facts, &scope, &range).unwrap().0.value, None);
    }

    #[test]
    fn unknown_price_is_unavailable_not_zero() {
        let (mut facts, scope, range) = fixture();
        for f in &mut facts {
            f.estimated_cost_microusd = None;
        }
        let projection = project_cost(&facts, &scope, &range).unwrap();
        assert_eq!(projection.0.value, None);
        assert_eq!(projection.0.reason, Some("pricing_unavailable"));
        assert_eq!(projection.0.coverage, None);
    }

    #[test]
    fn correction_moving_project_outside_scope_removes_its_contribution() {
        let (mut facts, scope, range) = fixture();
        let mut correction = facts[0].clone();
        correction.version = 3;
        correction.project_id = Some(Uuid::from_u128(333));
        facts.push(correction);
        assert_eq!(project_cost(&facts, &scope, &range).unwrap().0.value, None);
    }

    #[test]
    fn receipt_never_includes_fractional_second_before_consent() {
        let (facts, _, _) = fixture();
        let since = DateTime::from_timestamp(facts[0].event_time as i64, 500_000_000).unwrap();
        assert_eq!(
            receipt_cost(&facts, facts[0].project_id.unwrap(), since)
                .unwrap()
                .value,
            None
        );
        let since = DateTime::from_timestamp(facts[0].event_time as i64, 0).unwrap();
        assert_eq!(
            receipt_cost(&facts, facts[0].project_id.unwrap(), since)
                .unwrap()
                .value,
            Some(500)
        );
    }
}
