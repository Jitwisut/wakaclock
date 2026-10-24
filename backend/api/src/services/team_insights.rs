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
        crate::repository::team_trust::TeamTrustRepository::new(repo.postgres.clone())
            .guard(org)
            .await?;
        Ok(repo)
    }

    /// Final gate after response/CSV construction, shared with every projection channel.
    pub async fn validate_response(
        &self,
        actor: Uuid,
        org: Uuid,
        team: Option<Uuid>,
        generation: i64,
    ) -> Result<()> {
        let repo = self.readable(actor, org, team).await?;
        if repo.generation(org).await? != generation {
            return Err(TeamError::ProjectionChanged.into());
        }
        Ok(())
    }

    /// Private source proof retained through rendering; never a client supplied token.
    pub async fn validate_financial_response(&self, org: Uuid, expected: &str) -> Result<()> {
        crate::repository::team_financial_guard::validate_fence(
            &self.repo()?.postgres,
            org,
            expected,
        )
        .await
    }

    pub async fn copilot_report(
        &self,
        actor: Uuid,
        org: Uuid,
        team: Option<Uuid>,
        start: chrono::NaiveDate,
        timezone: &str,
    ) -> Result<crate::services::copilot_reports::Report> {
        anyhow::ensure!(
            crate::services::copilot_reports::enabled(),
            TeamError::Disabled
        );
        crate::services::copilot_reports::week(start, timezone, Utc::now()).map_err(|_| {
            TeamError::Invalid("request one closed Monday-Sunday UTC week within retention")
        })?;
        let repo = self.readable(actor, org, team).await?;
        let reports = crate::repository::copilot_reports::CopilotReportsRepository::new(
            repo.postgres.clone(),
        );
        let report = reports.report(org, team, start).await?;
        if report.publication_id.is_some() || report.status == "invalidated" {
            let path = std::env::var("ATOAXIS_TEAM_PRIVACY_LEDGER_PATH")?;
            crate::repository::team_trust::TeamTrustRepository::new(repo.postgres.clone())
                .export_registry(std::path::Path::new(&path))
                .await?;
        }
        self.validate_copilot_response(actor, &report).await?;
        Ok(report)
    }
    pub async fn validate_copilot_response(
        &self,
        actor: Uuid,
        report: &crate::services::copilot_reports::Report,
    ) -> Result<()> {
        anyhow::ensure!(
            crate::services::copilot_reports::enabled(),
            TeamError::Disabled
        );
        let repo = self
            .readable(actor, report.organization_id, report.team_id)
            .await?;
        let reports = crate::repository::copilot_reports::CopilotReportsRepository::new(
            repo.postgres.clone(),
        );
        anyhow::ensure!(
            reports.fence(report.organization_id).await? == report.fence,
            TeamError::ProjectionChanged
        );
        Ok(())
    }

    pub async fn weekly_comparison(
        &self,
        actor: Uuid,
        org: Uuid,
        request: super::team_comparison::Request,
    ) -> Result<super::team_comparison::Report> {
        use super::team_comparison::{compare, Family};
        anyhow::ensure!(super::team_comparison::enabled(), TeamError::Disabled);
        anyhow::ensure!(
            request.baseline_week + chrono::Duration::days(7) <= request.followup_week,
            TeamError::Invalid("select distinct ordered closed weeks")
        );
        let cost_from = if request.family == Family::TeamCost {
            Some(
                u32::try_from(super::team_trust::cutoff(Utc::now()).timestamp())
                    .map_err(|_| TeamError::Invalid("unsupported cost retention boundary"))?,
            )
        } else {
            None
        };
        let cost_proof = if let Some(from) = cost_from {
            Some(
                self.comparison_cost_source(actor, org, &request, from)
                    .await?,
            )
        } else {
            None
        };
        // Admit both weeks first. A followup publication changes Copilot's
        // publication fence, so rebuild both inputs from current proofs afterwards.
        for week in [request.baseline_week, request.followup_week] {
            self.comparison_snapshot(actor, org, &request, week).await?;
        }
        let (baseline, a) = self
            .comparison_snapshot(actor, org, &request, request.baseline_week)
            .await?;
        let (followup, b) = self
            .comparison_snapshot(actor, org, &request, request.followup_week)
            .await?;
        let mut report =
            compare(baseline, followup, request).map_err(|_| TeamError::ProjectionChanged)?;
        if report.request.family == Family::Copilot {
            report.copilot_proof =
                Some((a.context("baseline proof")?, b.context("followup proof")?));
        }
        report.cost_source_from = cost_from;
        report.cost_source_proof = cost_proof;
        self.validate_weekly_comparison(actor, &report).await?;
        Ok(report)
    }
    async fn comparison_snapshot(
        &self,
        actor: Uuid,
        org: Uuid,
        request: &super::team_comparison::Request,
        week: chrono::NaiveDate,
    ) -> Result<(
        super::team_comparison::Snapshot,
        Option<super::copilot_reports::Report>,
    )> {
        use super::team_comparison::{copilot_snapshot, team_snapshot, Family};
        match request.family {
            Family::Copilot => {
                let r = self
                    .copilot_report(actor, org, request.team_id, week, &request.timezone)
                    .await?;
                Ok((copilot_snapshot(&r), Some(r)))
            }
            Family::TeamCost => {
                let range = ResolvedRange::parse(
                    &week.to_string(),
                    &(week + chrono::Duration::days(6)).to_string(),
                    Some(&request.timezone),
                )
                .map_err(|_| TeamError::Invalid("invalid comparison week/timezone"))?;
                let r = self.insights(actor, org, request.team_id, range).await?;
                Ok((team_snapshot(&r)?, None))
            }
        }
    }
    /// One shared proof covers both weekly cells, their cumulative to-merge
    /// usage, and work/link metadata even when either week is withheld. Hashes
    /// stay private; raw facts never enter action storage or the HTTP response.
    async fn comparison_cost_source(
        &self,
        actor: Uuid,
        org: Uuid,
        request: &super::team_comparison::Request,
        from: u32,
    ) -> Result<String> {
        use sha2::{Digest, Sha256};
        let repo = self.readable(actor, org, request.team_id).await?;
        let financial = crate::repository::team_financial_guard::fence(&repo.postgres, org).await?;
        let revision:i64=repo.postgres.query_one("SELECT COALESCE((SELECT revision FROM team_cost_source_revisions WHERE organization_id=$1),0)",&[&org]).await?.get(0);
        // Existing shared ledger carries append-only operational heads. A stale
        // restore may not pass as the latest source merely because scopes match.
        let ledger: crate::repository::team_trust::Registry = serde_json::from_slice(
            &std::fs::read(std::env::var("ATOAXIS_TEAM_PRIVACY_LEDGER_PATH")?)?,
        )?;
        let prefix = format!("{org}:");
        let head = ledger
            .dispositions
            .iter()
            .filter(|d| d.provider == "team_cost_source")
            .filter_map(|d| d.delivery_id.strip_prefix(&prefix)?.parse::<i64>().ok())
            .max()
            .unwrap_or(0);
        anyhow::ensure!(head == revision, TeamError::ProjectionChanged);
        let scope = repo.scope(org, request.team_id).await?;
        let mut contributors = scope
            .contributors
            .iter()
            .map(|c| (c.user_id, c.aggregate_from, c.individual_from))
            .collect::<Vec<_>>();
        contributors.sort();
        let users = contributors.iter().map(|c| c.0).collect::<Vec<_>>();
        let start = ResolvedRange::parse(
            &request.baseline_week.to_string(),
            &(request.baseline_week + chrono::Duration::days(6)).to_string(),
            Some(&request.timezone),
        )
        .map_err(|_| TeamError::Invalid("invalid cost comparison week/timezone"))?;
        let end = ResolvedRange::parse(
            &request.followup_week.to_string(),
            &(request.followup_week + chrono::Duration::days(6)).to_string(),
            Some(&request.timezone),
        )
        .map_err(|_| TeamError::Invalid("invalid cost comparison week/timezone"))?;
        let to = u32::try_from(end.unix_bounds().1 as i64)
            .map_err(|_| TeamError::Invalid("unsupported comparison boundary"))?;

        let links = repo
            .merged_links(
                org,
                request.team_id,
                DateTime::from_timestamp(start.unix_bounds().0 as i64, 0)
                    .context("comparison start")?,
                DateTime::from_timestamp(to as i64, 0).context("comparison end")?,
            )
            .await?;
        super::team_trust::validate_week(&start, &request.timezone, Utc::now())
            .map_err(|_| TeamError::Invalid("baseline week is open or expired"))?;
        super::team_trust::validate_week(&end, &request.timezone, Utc::now())
            .map_err(|_| TeamError::Invalid("followup week is open or expired"))?;
        let policy = crate::repository::team_trust::TeamTrustRepository::new(repo.postgres.clone())
            .policy(org)
            .await?;
        anyhow::ensure!(
            policy == request.timezone,
            TeamError::Invalid("use the organization report timezone")
        );
        // Canonical source is checked jointly, in one query after PG metadata.
        // In particular a withheld followup cannot skip a corrected baseline.
        let facts = repo.admitted_facts(org, &users, from, to).await?;
        let current:i64=repo.postgres.query_one("SELECT COALESCE((SELECT revision FROM team_cost_source_revisions WHERE organization_id=$1),0)",&[&org]).await?.get(0);
        anyhow::ensure!(revision == current, TeamError::ProjectionChanged);
        self.validate_response(actor, org, request.team_id, scope.generation)
            .await?;
        self.validate_financial_response(org, &financial).await?;
        Ok(format!(
            "{:x}",
            Sha256::digest(serde_json::to_vec(&(
                financial,
                scope.generation,
                revision,
                contributors,
                scope.projects,
                facts,
                links,
                from,
                to
            ))?)
        ))
    }

    pub async fn validate_weekly_comparison(
        &self,
        actor: Uuid,
        report: &super::team_comparison::Report,
    ) -> Result<()> {
        anyhow::ensure!(super::team_comparison::enabled(), TeamError::Disabled);
        if let Some((a, b)) = &report.copilot_proof {
            self.validate_copilot_response(actor, a).await?;
            self.validate_copilot_response(actor, b).await?;
        } else {
            // Canonical cost corrections need a reread, not a generation check alone.
            for snapshot in [&report.baseline, &report.followup] {
                let (live, _) = self
                    .comparison_snapshot(
                        actor,
                        snapshot.organization_id,
                        &report.request,
                        snapshot.week_start,
                    )
                    .await?;
                anyhow::ensure!(live == *snapshot, TeamError::ProjectionChanged);
                self.validate_response(
                    actor,
                    snapshot.organization_id,
                    snapshot.team_id,
                    snapshot.generation,
                )
                .await?;
            }
            let live = self
                .comparison_cost_source(
                    actor,
                    report.baseline.organization_id,
                    &report.request,
                    report
                        .cost_source_from
                        .context("cost source bounds unavailable")?,
                )
                .await?;
            anyhow::ensure!(
                report.cost_source_proof.as_deref() == Some(live.as_str()),
                TeamError::ProjectionChanged
            );
        }
        Ok(())
    }

    pub async fn consent(&self, actor: Uuid, org: Uuid) -> Result<TeamConsent> {
        // Preview/withdrawal must remain accessible even during a feature rollback.
        self.authorization
            .require(actor, org, OrganizationAction::ReadSelf, None)
            .await?;
        self.repo()?.consent(org, actor).await
    }

    pub async fn weekly_summary(
        &self,
        actor: Uuid,
        org: Uuid,
        request: super::team_weekly_summary::Request,
    ) -> Result<super::team_weekly_summary::Summary> {
        use super::{team_comparison::Family, team_weekly_summary as summary};
        anyhow::ensure!(super::team_comparison::enabled(), TeamError::Disabled);
        request.validate(Utc::now())?;
        self.readable(actor, org, request.team_id).await?;
        let week_end = summary::end_date(request.week_start)?;
        let range = ResolvedRange::parse(
            &request.week_start.to_string(),
            &week_end.to_string(),
            Some(&request.timezone),
        )
        .map_err(|_| TeamError::Invalid("invalid summary week/timezone"))?;
        let cost_request = super::team_comparison::Request {
            family: Family::TeamCost,
            baseline_week: request.week_start,
            followup_week: request.week_start,
            timezone: request.timezone.clone(),
            team_id: request.team_id,
        };
        let (
            window_start,
            window_end,
            cells,
            health,
            generation,
            cost_proof,
            cost_from,
            copilot_proof,
        ) = match request.family {
            Family::TeamCost => {
                super::team_trust::validate_week(&range, &request.timezone, Utc::now()).map_err(
                    |_| TeamError::Invalid("request one closed organization week within retention"),
                )?;
                let from = u32::try_from(super::team_trust::cutoff(Utc::now()).timestamp())
                    .map_err(|_| TeamError::Invalid("unsupported cost retention"))?;
                let proof = self
                    .comparison_cost_source(actor, org, &cost_request, from)
                    .await?;
                let r = self
                    .insights(actor, org, request.team_id, range.clone())
                    .await?;
                let (a, b) = range.unix_bounds();
                (
                    DateTime::from_timestamp(a as i64, 0).context("summary window start")?,
                    DateTime::from_timestamp(b as i64, 0).context("summary window end")?,
                    summary::cost_cells(&r),
                    r.measurement_health.into_iter().map(String::from).collect(),
                    r.generation,
                    Some(proof),
                    Some(from),
                    None,
                )
            }
            Family::Copilot => {
                super::copilot_reports::week(request.week_start, &request.timezone, Utc::now())
                    .map_err(|_| {
                        TeamError::Invalid("request one closed Copilot UTC week within retention")
                    })?;
                let r = self
                    .copilot_report(
                        actor,
                        org,
                        request.team_id,
                        request.week_start,
                        &request.timezone,
                    )
                    .await?;
                (
                    r.window_start,
                    r.window_end,
                    summary::copilot_cells(&r),
                    vec![
                        format!("capture:{}", r.capture_status),
                        format!("ingestion:{}", r.ingestion_status),
                    ],
                    r.generation,
                    None,
                    None,
                    Some(r),
                )
            }
        };
        let mut result = summary::Summary {
            organization_id: org,
            team_id: request.team_id,
            family: request.family.clone(),
            week_start: request.week_start,
            window_start,
            window_end,
            timezone: request.timezone.clone(),
            checked_at: Utc::now(),
            data_status: summary::data_status(&cells),
            cells,
            measurement_health: health,
            actions: vec![],
            actions_next_cursor: None,
            action_snapshot_at: None,
            action_basis: "current_metadata_at_read_time_not_historical_status",
            calculation_version: summary::VERSION,
            interpretation: "descriptive_admitted_metrics_no_personal_ranking_or_causal_claim",
            production_ready: false,
            request,
            generation,
            cost_proof,
            cost_from,
            copilot_proof,
            action_proof: None,
        };
        if result.request.include_actions {
            let repo = self.readable(actor, org, result.team_id).await?;
            let page =
                crate::repository::team_actions::TeamActionsRepository::new(repo.postgres.clone())
                    .list_week(
                        actor,
                        org,
                        &super::team_actions::List {
                            team_id: result.team_id,
                            after: result.request.actions_after,
                            limit: Some(25),
                        },
                        &result.family,
                        result.week_start,
                    )
                    .await?;
            result.actions_next_cursor = page.next_cursor;
            result.action_snapshot_at = Some(Utc::now());
            result.action_proof = Some(page.proof);
            result.actions = page.actions;
        }
        self.validate_weekly_summary(actor, &result).await?;
        Ok(result)
    }
    /// CSV is a complete export of matching current actions, never a silent first page.
    /// Bound total work; changing source/access proofs cancels rather than mixing generations.
    pub async fn weekly_summary_export(
        &self,
        actor: Uuid,
        org: Uuid,
        request: super::team_weekly_summary::Request,
    ) -> Result<super::team_weekly_summary::Summary> {
        anyhow::ensure!(
            request.actions_after.is_none(),
            TeamError::Invalid("CSV export starts at the first action; omit actions_after")
        );
        let mut summary = self.weekly_summary(actor, org, request).await?;
        while let Some(after) = summary.actions_next_cursor {
            anyhow::ensure!(
                summary.actions.len() < 10_000,
                TeamError::Invalid(
                    "weekly action export exceeds 10000; select a narrower team scope"
                )
            );
            let repo = self.readable(actor, org, summary.team_id).await?;
            let page =
                crate::repository::team_actions::TeamActionsRepository::new(repo.postgres.clone())
                    .list_week(
                        actor,
                        org,
                        &super::team_actions::List {
                            team_id: summary.team_id,
                            after: Some(after),
                            limit: Some(100),
                        },
                        &summary.family,
                        summary.week_start,
                    )
                    .await?;
            anyhow::ensure!(
                summary.action_proof.as_deref() == Some(page.proof.as_str()),
                TeamError::ProjectionChanged
            );
            summary.actions.extend(page.actions);
            summary.actions_next_cursor = page.next_cursor;
        }
        anyhow::ensure!(
            summary.actions.len() <= 10_000,
            TeamError::Invalid("weekly action export exceeds 10000; select a narrower team scope")
        );
        self.validate_weekly_summary(actor, &summary).await?;
        Ok(summary)
    }
    /// Called after JSON or CSV construction. All channels reuse the same
    /// current source/access checks, including a correction to a withheld week.
    pub async fn validate_weekly_summary(
        &self,
        actor: Uuid,
        s: &super::team_weekly_summary::Summary,
    ) -> Result<()> {
        anyhow::ensure!(super::team_comparison::enabled(), TeamError::Disabled);
        if let Some(r) = &s.copilot_proof {
            self.validate_copilot_response(actor, r).await?;
        } else {
            let end = super::team_weekly_summary::end_date(s.week_start)?;
            let range = ResolvedRange::parse(
                &s.week_start.to_string(),
                &end.to_string(),
                Some(&s.timezone),
            )
            .map_err(|_| TeamError::Invalid("invalid summary window"))?;
            let live = self
                .insights(actor, s.organization_id, s.team_id, range)
                .await?;
            anyhow::ensure!(
                super::team_weekly_summary::cost_cells(&live) == s.cells
                    && live.generation == s.generation,
                TeamError::ProjectionChanged
            );
            let request = super::team_comparison::Request {
                family: super::team_comparison::Family::TeamCost,
                baseline_week: s.week_start,
                followup_week: s.week_start,
                timezone: s.timezone.clone(),
                team_id: s.team_id,
            };
            let proof = self
                .comparison_cost_source(
                    actor,
                    s.organization_id,
                    &request,
                    s.cost_from.context("summary cost boundary missing")?,
                )
                .await?;
            anyhow::ensure!(
                s.cost_proof.as_deref() == Some(proof.as_str()),
                TeamError::ProjectionChanged
            );
        }
        if let Some(proof) = &s.action_proof {
            self.validate_actions(actor, s.organization_id, s.team_id, proof)
                .await?;
        }
        self.validate_response(actor, s.organization_id, s.team_id, s.generation)
            .await
    }
    pub async fn actions(
        &self,
        actor: Uuid,
        org: Uuid,
        q: &super::team_actions::List,
    ) -> Result<super::team_actions::Page> {
        anyhow::ensure!(super::team_comparison::enabled(), TeamError::Disabled);
        let r = self.readable(actor, org, q.team_id).await?;
        crate::repository::team_actions::TeamActionsRepository::new(r.postgres.clone())
            .list(actor, org, q)
            .await
    }
    pub async fn validate_actions(
        &self,
        actor: Uuid,
        org: Uuid,
        team: Option<Uuid>,
        proof: &str,
    ) -> Result<()> {
        let r = self.readable(actor, org, team).await?;
        anyhow::ensure!(
            super::team_comparison::enabled()
                && crate::repository::team_actions::TeamActionsRepository::new(r.postgres.clone())
                    .guard(org)
                    .await?
                    == proof,
            TeamError::ProjectionChanged
        );
        Ok(())
    }
    pub async fn action_comparison(
        &self,
        actor: Uuid,
        org: Uuid,
        id: Uuid,
        team: Option<Uuid>,
    ) -> Result<super::team_actions::Comparison> {
        anyhow::ensure!(super::team_comparison::enabled(), TeamError::Disabled);
        let repo = self.readable(actor, org, team).await?;
        let r = crate::repository::team_actions::TeamActionsRepository::new(repo.postgres.clone());
        let proof = r.guard(org).await?;
        let a = r.get(actor, org, id).await?;
        anyhow::ensure!(
            a.team_id == team,
            crate::services::authorization::AuthorizationDenied("action scope mismatch")
        );
        let report = self
            .weekly_comparison(
                actor,
                org,
                super::team_comparison::Request {
                    family: a.family,
                    baseline_week: a.baseline_week,
                    followup_week: a.followup_week,
                    timezone: a.timezone,
                    team_id: team,
                },
            )
            .await?;
        let result = super::team_actions::Comparison {
            action_id: id,
            action_revision: a.revision,
            report,
            action_proof: proof,
            team_id: team,
        };
        self.validate_action_comparison(actor, org, &result).await?;
        Ok(result)
    }
    pub async fn validate_action_comparison(
        &self,
        actor: Uuid,
        org: Uuid,
        result: &super::team_actions::Comparison,
    ) -> Result<()> {
        self.validate_weekly_comparison(actor, &result.report)
            .await?;
        let repo = self.readable(actor, org, result.team_id).await?;
        let a = crate::repository::team_actions::TeamActionsRepository::new(repo.postgres.clone())
            .get(actor, org, result.action_id)
            .await?;
        anyhow::ensure!(
            a.revision == result.action_revision && a.team_id == result.team_id,
            TeamError::ProjectionChanged
        );
        self.validate_actions(actor, org, result.team_id, &result.action_proof)
            .await
    }
    pub async fn action_history(
        &self,
        actor: Uuid,
        org: Uuid,
        id: Uuid,
        before: Option<i64>,
    ) -> Result<super::team_actions::History> {
        anyhow::ensure!(
            super::team_comparison::enabled() && self.enabled,
            TeamError::Disabled
        );
        let r = crate::repository::team_actions::TeamActionsRepository::new(
            self.repo()?.postgres.clone(),
        );
        let a = r.get(actor, org, id).await?;
        self.readable(actor, org, a.team_id).await?;
        r.history(actor, org, id, before).await
    }
    #[allow(clippy::too_many_arguments)]
    pub async fn mutate_action(
        &self,
        actor: Uuid,
        org: Uuid,
        id: Uuid,
        team: Option<Uuid>,
        edit: Option<&super::team_actions::Edit>,
        delete: Option<&super::team_actions::Delete>,
    ) -> Result<serde_json::Value> {
        anyhow::ensure!(super::team_comparison::enabled(), TeamError::Disabled);
        let repo = self.readable(actor, org, team).await?;
        let r = crate::repository::team_actions::TeamActionsRepository::new(repo.postgres.clone());
        // Retry may follow a committed write whose ledger export/response failed.
        // The existing registry exporter refuses regressed backup history.
        let path = std::env::var("ATOAXIS_TEAM_PRIVACY_LEDGER_PATH")?;
        crate::repository::team_trust::TeamTrustRepository::new(repo.postgres.clone())
            .export_registry(std::path::Path::new(&path))
            .await?;
        r.guard(org).await?;
        let timezone = if edit.is_some_and(|e| e.family == super::team_comparison::Family::Copilot)
        {
            "UTC".into()
        } else {
            crate::repository::team_trust::TeamTrustRepository::new(repo.postgres.clone())
                .policy(org)
                .await?
        };
        let revision = r
            .write(actor, org, id, team, edit, delete, &timezone)
            .await?;
        // Durable DB acceptance survives an export/response failure; replay uses
        // request_id. Never ACK a stale action after a concurrent deletion.
        crate::repository::team_trust::TeamTrustRepository::new(repo.postgres.clone())
            .export_registry(std::path::Path::new(&path))
            .await?;
        let proof = r.guard(org).await?;
        self.readable(actor, org, team).await?;
        anyhow::ensure!(
            r.can_manage(actor, org, team).await?,
            crate::services::authorization::AuthorizationDenied("action access changed")
        );
        let row=repo.postgres.query_one("SELECT revision,deleted FROM team_improvement_actions WHERE organization_id=$1 AND id=$2",&[&org,&id]).await?;
        anyhow::ensure!(
            row.get::<_, i64>(0) == revision && row.get::<_, bool>(1) == delete.is_some(),
            TeamError::ProjectionChanged
        );
        let result = if delete.is_some() {
            serde_json::json!({"id":id,"revision":revision,"deleted":true})
        } else {
            serde_json::to_value(r.get(actor, org, id).await?)?
        };
        self.validate_actions(actor, org, team, &proof).await?;
        Ok(result)
    }

    pub async fn readiness(&self, actor: Uuid, org: Uuid) -> Result<serde_json::Value> {
        self.authorization
            .require(actor, org, OrganizationAction::ManageSecurity, None)
            .await?;
        let evidence = self.repo()?.release_evidence(org).await?;
        let financial_deployment = match crate::infrastructure::team_financial_guard::CommercialDeployment::from_environment() {
            Ok(Some(_)) => "commercial_guard_configured",
            Ok(None) => "precommercial",
            Err(_) => "unconfirmed",
        };
        let local = self.repo()?.postgres.query("SELECT gate,passed,evidence_ref,checked_at,build FROM team_release_evidence WHERE organization_id=$1 AND evidence_scope='local' ORDER BY gate",&[&org]).await?.into_iter().map(|row|serde_json::json!({"gate":row.get::<_,String>(0),"passed":row.get::<_,bool>(1),"evidence_ref":row.get::<_,String>(2),"checked_at":row.get::<_,DateTime<Utc>>(3),"build":row.get::<_,Option<String>>(4)})).collect::<Vec<_>>();
        Ok(serde_json::json!({
            "receiver_enabled": self.enabled,
            "organization_enabled": self.repo()?.enabled(org).await?,
            "production_ready": false,
            "checkout_available": false,
            "financial_deployment": {"status": financial_deployment, "scope":"enrollment_entitlement_only", "financial_sources":"unconfirmed", "public_activation_enabled":false},
            "implementation_stage": "team_trust_local_verification",
            "evidence_scope": {"local": local, "external": "unconfirmed"},
            "evaluated_at": Utc::now(),
            "build": option_env!("ATOAXIS_BUILD_REVISION"),
            "version": env!("CARGO_PKG_VERSION"),
            "weekly_aggregates": true,
            "copilot_weekly_reports": crate::services::copilot_reports::enabled(),
            "copilot_weekly_csv": crate::services::copilot_reports::enabled(),
            "weekly_comparison": super::team_comparison::enabled(),
            "improvement_actions": super::team_comparison::enabled(),
            "weekly_summary": super::team_comparison::enabled(),
            "report_timezone": crate::repository::team_trust::TeamTrustRepository::new(self.repo()?.postgres.clone()).policy(org).await?,
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
        let financial_fence =
            crate::repository::team_financial_guard::fence(&repo.postgres, org).await?;
        anyhow::ensure!(
            range.days_included() <= 90,
            TeamError::Invalid("Team range exceeds 90 days")
        );
        let trust = crate::repository::team_trust::TeamTrustRepository::new(repo.postgres.clone());
        let timezone = trust.policy(org).await?;
        crate::services::team_trust::validate_week(&range, &timezone, Utc::now())
            .map_err(TeamError::Invalid)?;
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
        let facts = repo
            .admitted_facts(org, &users, from as u32, to as u32)
            .await?;
        let mut projection = project_cost(&facts, &scope, &range)?;
        let retention = crate::services::team_trust::cutoff(Utc::now());
        let cumulative = repo
            .admitted_facts(org, &users, retention.timestamp() as u32, to as u32)
            .await?;
        let mut merged_links = repo
            .merged_links(
                org,
                team,
                DateTime::from_timestamp(from as i64, 0).context("range start")?,
                DateTime::from_timestamp(to as i64, 0).context("range end")?,
            )
            .await?;
        for link in &mut merged_links {
            link.visible &= scope
                .contributors
                .iter()
                .any(|c| Some(c.user_id) == link.user);
        }
        let mut merged =
            crate::services::team_merged_cost::calculate(&cumulative, &merged_links, retention)?;

        // Hash metadata in memory only. The registry stores no raw usage or credentials.
        use sha2::{Digest, Sha256};
        let fingerprint = format!(
            "{:x}",
            Sha256::digest(serde_json::to_vec(&(&facts, &cumulative, &merged_links))?)
        );
        let mut people: BTreeSet<Uuid> = facts
            .iter()
            .filter(|f| {
                scope
                    .projects
                    .contains(&f.project_id.unwrap_or(Uuid::nil()))
                    && f.project_attribution_method.as_deref() == Some("explicit_project_hint")
                    && scope.contributors.iter().any(|c| {
                        c.user_id == f.user_id
                            && DateTime::from_timestamp(f.event_time as i64, 0)
                                .is_some_and(|at| at >= c.aggregate_from)
                    })
            })
            .map(|f| f.user_id)
            .collect();

        if merged.cost_microusd.value.is_some()
            && !crate::services::team_merged_cost::joint_partition(
                &cumulative,
                (from as u32, to as u32),
                &people,
                &merged,
            )
        {
            merged = crate::services::team_merged_cost::MergedCost::withheld(
                "joint_metric_privacy_suppressed",
            );
        }
        let mut publication_facts: BTreeSet<String> = facts
            .iter()
            .map(|f| usage_identity(f.user_id, &f.usage_event_id))
            .collect();
        publication_facts.extend(
            merged
                .admitted
                .iter()
                .map(|(user, event)| usage_identity(*user, event)),
        );
        people.extend(merged.people.iter().copied());
        if (projection.0.value.is_some() || merged.cost_microusd.value.is_some())
            && !trust
                .release_with_facts(
                    org,
                    range.start,
                    &team.map_or_else(|| "organization".into(), |id| id.to_string()),
                    scope.generation,
                    &fingerprint,
                    &people,
                    Some(&publication_facts),
                )
                .await?
        {
            projection = (Metric::unavailable("privacy_suppressed"), vec![]);
            merged = crate::services::team_merged_cost::MergedCost::withheld("privacy_suppressed");
        }

        // No numeric publication is acknowledged before its independent history is durable.
        if projection.0.value.is_some() || merged.cost_microusd.value.is_some() {
            let path = std::env::var("ATOAXIS_TEAM_PRIVACY_LEDGER_PATH")?;
            trust.export_registry(std::path::Path::new(&path)).await?;
        }

        // Read-time checks are shared by API and CSV, no stale report cache can bypass consent.
        self.authorization
            .require_team_read(actor, org, team)
            .await?;
        if !repo.enabled(org).await? || repo.generation(org).await? != scope.generation {
            return Err(TeamError::ProjectionChanged.into());
        }
        self.readable(actor, org, team).await?;
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
        self.validate_financial_response(org, &financial_fence)
            .await?;
        Ok(TeamInsights {
            financial_fence,
            organization_id: org,
            team_id: team,
            start: range.start.to_string(),
            end: range.end.to_string(),
            timezone: range.timezone.to_string(),
            generation: scope.generation,
            estimated_ai_cost_microusd: projection.0,
            provider_breakdown: projection.1,
            merged_pr_cost_microusd: merged.cost_microusd.clone(),
            merged_pr_cost: merged,
            currency: "USD",
            measurement_health: vec!["capture_delivery_coverage_unconfirmed"],
            production_ready: false,
        })
    }

    pub async fn measurement_health(
        &self,
        actor: Uuid,
        org: Uuid,
        delivery: &crate::services::delivery_status::DeliveryStatusService,
    ) -> Result<serde_json::Value> {
        self.authorization
            .require(actor, org, OrganizationAction::ReadSelf, None)
            .await?;
        let generation = self.repo()?.generation(org).await?;
        let now = Utc::now();
        let devices = delivery
            .latest(actor)
            .await?
            .into_iter()
            .map(|entry| {
                crate::model::delivery_status::DeliveryStatusDevice::from_received(entry, now)
            })
            .collect::<Vec<_>>();
        let own_capture = crate::services::team_trust::device_health(&devices, true, now);
        let own_delivery = crate::services::team_trust::device_health(&devices, false, now);
        let trust =
            crate::repository::team_trust::TeamTrustRepository::new(self.repo()?.postgres.clone());
        let registry_ready = trust.guard(org).await.is_ok();
        let retention = trust
            .postgres
            .query_opt(
                "SELECT CASE WHEN s.generation=r.generation AND s.error_code IS NULL AND j.error_code IS NULL AND j.completed_at IS NOT NULL AND s.completed_at IS NOT NULL THEN LEAST(j.completed_at,s.completed_at) ELSE NULL END AS completed_at FROM team_cleanup_jobs j LEFT JOIN team_store_cleanup s USING(organization_id) JOIN team_rollouts r USING(organization_id) WHERE j.organization_id=$1",
                &[&org],
            )
            .await?;
        let at = retention
            .as_ref()
            .and_then(|r| r.get::<_, Option<DateTime<Utc>>>("completed_at"));
        let role = self
            .authorization
            .require(actor, org, OrganizationAction::ReadSelf, None)
            .await?
            .role;
        let integration = if matches!(
            role,
            Some(
                crate::services::authorization::OrganizationRole::Owner
                    | crate::services::authorization::OrganizationRole::Admin
            )
        ) {
            serde_json::to_value(
                crate::repository::team_github::GithubRepositoryStore::new(
                    self.repo()?.postgres.clone(),
                )
                .health(org)
                .await?,
            )?
        } else {
            serde_json::json!({"status":"withheld","reason":"administrator_diagnostics","scope":"organization"})
        };
        // These are organization operations, never group/user counts or scan cursors.
        let admission = if matches!(
            role,
            Some(
                crate::services::authorization::OrganizationRole::Owner
                    | crate::services::authorization::OrganizationRole::Admin
            )
        ) {
            let observation =
                crate::repository::team_usage_scan::observation(&trust.postgres, org, now).await?;
            serde_json::to_value(super::team_usage_admission_worker::health(
                &observation,
                now,
            ))?
        } else {
            serde_json::json!({"status":"withheld","reason":"administrator_diagnostics","scope":"organization_operations"})
        };
        let timezone = trust.policy(org).await?;
        let current = self
            .authorization
            .require(actor, org, OrganizationAction::ReadSelf, None)
            .await?;
        anyhow::ensure!(
            current.role == role && self.repo()?.generation(org).await? == generation,
            TeamError::ProjectionChanged
        );
        Ok(
            serde_json::json!({"checked_at":now,"capabilities":{"weekly_comparison":super::team_comparison::enabled(),"improvement_actions":super::team_comparison::enabled(),"weekly_summary":super::team_comparison::enabled()},"report_timezone":timezone,"own":{"capture":own_capture,"delivery":own_delivery},
            "team":{"capture":{"status":"withheld","reason":"group_health_not_certified","scope":"organization"},
              "delivery":{"status":"withheld","reason":"group_health_not_certified","scope":"organization"},
              "integration":integration,"usage_admission":admission,
              "retention":{"status":if at.is_some_and(|t|(0..=7200).contains(&now.signed_duration_since(t).num_seconds())) {"observed"}else{"unconfirmed"},"updated_at":at,"reason":"postgres_and_clickhouse_team_cleanup_checkpoints","scope":"organization"}},
            "restore":{"status":if registry_ready {"observed"}else{"unavailable"},"reason":"independent_privacy_and_enrollment_registry_guards"}}),
        )
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
        self.readable(actor, org, team).await?;
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
        self.receipt_page(actor, org, team, repository, item, None, false)
            .await
    }
    pub async fn validate_own_response(
        &self,
        actor: Uuid,
        org: Uuid,
        generation: i64,
    ) -> Result<()> {
        self.authorization
            .require(actor, org, OrganizationAction::ReadSelf, None)
            .await?;
        let repo = self.repo()?;
        anyhow::ensure!(
            self.enabled && repo.enabled(org).await?,
            TeamError::Disabled
        );
        crate::repository::team_trust::TeamTrustRepository::new(repo.postgres.clone())
            .guard(org)
            .await?;
        anyhow::ensure!(
            repo.generation(org).await? == generation,
            TeamError::ProjectionChanged
        );
        Ok(())
    }
    pub async fn receipt_page(
        &self,
        actor: Uuid,
        org: Uuid,
        team: Option<Uuid>,
        repository: Uuid,
        item: i64,
        after: Option<Uuid>,
        owner_only: bool,
    ) -> Result<WorkReceipt> {
        let repo = if owner_only {
            self.authorization
                .require(actor, org, OrganizationAction::ReadSelf, None)
                .await?;
            let repo = self.repo()?;
            self.validate_own_response(actor, org, repo.generation(org).await?)
                .await?;
            let work_team = repo
                .work_item_team(org, repository, item)
                .await?
                .ok_or(TeamError::NotFound)?;
            if let Some(t) = work_team {
                self.authorization
                    .require_team_read(actor, org, Some(t))
                    .await?;
            }
            repo
        } else {
            self.readable(actor, org, team).await?
        };
        let financial_fence =
            crate::repository::team_financial_guard::fence(&repo.postgres, org).await?;
        let mut scope = repo.scope(org, team).await?;
        if owner_only {
            scope.contributors.retain(|c| c.user_id == actor);
        }
        let project = repo
            .work_item_project(org, repository, item)
            .await?
            .ok_or(TeamError::NotFound)?;
        anyhow::ensure!(scope.projects.contains(&project), TeamError::NotFound);
        let until = repo.work_item_merge(org, repository, item).await?;
        let links = repo.receipt_links(org, repository, item, team).await?;
        anyhow::ensure!(
            links.len() <= 10_000,
            TeamError::Invalid("receipt is too large")
        );
        let mut sessions = vec![];
        let mut total = 0u64;
        let mut any = false;
        let mut partial = false;
        let mut updated = None;
        let mut pricing_versions = BTreeSet::new();
        let retention_start = Utc::now() - chrono::Months::new(12);
        for record in links
            .into_iter()
            .filter(|r| !owner_only || r.user_id == actor)
        {
            let facts = repo
                .admitted_session_facts(org, record.user_id, &record.link.session_id)
                .await?
                .into_iter()
                .filter(|f| {
                    until.is_none_or(|end| {
                        DateTime::from_timestamp(f.event_time as i64, 0).is_some_and(|at| at <= end)
                    })
                })
                .collect::<Vec<_>>();
            anyhow::ensure!(
                facts.len() <= 10_000,
                TeamError::Invalid("session is too large")
            );
            let since = record.individual_from.max(retention_start);
            if !facts.iter().any(|f| {
                DateTime::from_timestamp(f.event_time as i64, 0).is_some_and(|at| at >= since)
                    && f.project_id
                        .is_some_and(|project| record.projects.contains(&project))
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
            let eligible = facts
                .iter()
                .filter(|f| {
                    DateTime::from_timestamp(f.event_time as i64, 0).is_some_and(|at| at >= since)
                        && f.project_id
                            .is_some_and(|project| record.projects.contains(&project))
                        && f.project_attribution_method.as_deref() == Some("explicit_project_hint")
                })
                .collect::<Vec<_>>();
            let identities = eligible
                .iter()
                .map(|f| usage_identity(f.user_id, &f.usage_event_id))
                .collect::<Vec<_>>();
            let allocated = repo
                .allocate(
                    org,
                    record.user_id,
                    record.link.id,
                    &identities,
                    scope.generation,
                )
                .await?;
            let admitted = facts
                .into_iter()
                .filter(|f| allocated.contains(&usage_identity(f.user_id, &f.usage_event_id)))
                .collect::<Vec<_>>();
            pricing_versions.extend(admitted.iter().filter_map(|f| f.pricing_version.clone()));
            let mut cost = receipt_cost_projects(&admitted, &record.projects, since)?;
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
        if owner_only {
            self.validate_own_response(actor, org, scope.generation)
                .await?;
        } else {
            self.validate_response(actor, org, team, scope.generation)
                .await?;
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
        sessions.sort_by_key(|b| std::cmp::Reverse(b.link_id));
        let remaining = sessions
            .into_iter()
            .filter(|s| after.is_none_or(|a| s.link_id < a))
            .collect::<Vec<_>>();
        let more = remaining.len() > 50;
        let sessions = remaining.into_iter().take(50).collect::<Vec<_>>();
        let next = if more {
            sessions.last().map(|s| s.link_id)
        } else {
            None
        };
        self.validate_financial_response(org, &financial_fence)
            .await?;
        Ok(WorkReceipt {
            financial_fence,
            next,
            repository_id: repository,
            work_item_id: item,
            sessions,
            estimated_cost_microusd: metric,
            sharing,
            generation: scope.generation,
            cost_until: until,
            pricing_versions: pricing_versions.into_iter().collect(),
            calculation_version: "confirmed_observed_usage_to_merge_v1",
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
            .ok_or(TeamError::Invalid("aggregate consent required"))?
            .max(crate::services::team_trust::cutoff(Utc::now()));
        let facts = repo
            .admitted_session_facts(org, actor, &request.session_id)
            .await?;
        anyhow::ensure!(
            !facts.is_empty() && facts.len() <= 10_000,
            TeamError::Invalid("session unavailable")
        );
        // An owner can confirm a link, but cannot manufacture repository/project provenance.
        let team = repo
            .work_item_team(org, request.repository_id, request.work_item_id)
            .await?
            .ok_or(TeamError::NotFound)?;
        if let Some(team) = team {
            self.authorization
                .require_team_read(actor, org, Some(team))
                .await?;
        }
        let projects = repo
            .member_work_projects(org, actor, request.repository_id)
            .await?;
        anyhow::ensure!(
            facts
                .iter()
                .any(|f| DateTime::from_timestamp(f.event_time as i64, 0)
                    .is_some_and(|at| at >= from)
                    && f.project_id.is_some_and(|p| projects.contains(&p))
                    && f.project_attribution_method.as_deref() == Some("explicit_project_hint")),
            TeamError::Invalid("session has no consented repository evidence")
        );
        repo.propose(org, actor, &request).await
    }

    pub async fn decide(&self, actor: Uuid, org: Uuid, id: Uuid, status: &str) -> Result<WorkLink> {
        self.decide_revision(actor, org, id, status, None).await
    }
    pub async fn decide_revision(
        &self,
        actor: Uuid,
        org: Uuid,
        id: Uuid,
        status: &str,
        expected: Option<i64>,
    ) -> Result<WorkLink> {
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
            .decide_link_revision(org, actor, id, status, expected)
            .await?
            .ok_or_else(|| {
                if expected.is_some() {
                    TeamError::ProjectionChanged.into()
                } else {
                    TeamError::NotFound.into()
                }
            })
    }

    pub async fn links_page(
        &self,
        actor: Uuid,
        org: Uuid,
        after: Option<Uuid>,
    ) -> Result<serde_json::Value> {
        self.authorization
            .require(actor, org, OrganizationAction::ReadSelf, None)
            .await?;
        let repo = self.repo()?;
        let generation = repo.generation(org).await?;
        self.validate_own_response(actor, org, generation).await?;
        let financial = crate::repository::team_financial_guard::fence(&repo.postgres, org).await?;
        let result = repo.links_page(org, actor, after).await?;
        self.authorization
            .require(actor, org, OrganizationAction::ReadSelf, None)
            .await?;
        anyhow::ensure!(
            repo.generation(org).await? == generation,
            TeamError::ProjectionChanged
        );
        self.validate_own_response(actor, org, generation).await?;
        self.validate_financial_response(org, &financial).await?;
        Ok(result)
    }
    pub async fn replace(
        &self,
        actor: Uuid,
        org: Uuid,
        id: Uuid,
        input: LinkReplacement,
    ) -> Result<WorkLink> {
        anyhow::ensure!(
            input.expected_revision > 0,
            TeamError::Invalid("revision required")
        );
        self.authorization
            .require(actor, org, OrganizationAction::ReadSelf, None)
            .await?;
        let old = self
            .repo()?
            .link(org, actor, id)
            .await?
            .ok_or(TeamError::NotFound)?;
        let target = self
            .propose(
                actor,
                org,
                LinkRequest {
                    session_id: old.session_id,
                    repository_id: input.repository_id,
                    work_item_id: input.work_item_id,
                },
            )
            .await?;
        self.repo()?
            .replace_link(org, actor, id, target.id, input.expected_revision)
            .await
    }
    pub async fn history(
        &self,
        actor: Uuid,
        org: Uuid,
        id: Uuid,
        after: Option<Uuid>,
    ) -> Result<serde_json::Value> {
        self.authorization
            .require(actor, org, OrganizationAction::ReadSelf, None)
            .await?;
        let repo = self.repo()?;
        let generation = repo.generation(org).await?;
        self.validate_own_response(actor, org, generation).await?;
        let financial = crate::repository::team_financial_guard::fence(&repo.postgres, org).await?;
        let result = repo.link_history(org, actor, id, after).await?;
        self.authorization
            .require(actor, org, OrganizationAction::ReadSelf, None)
            .await?;
        anyhow::ensure!(
            repo.generation(org).await? == generation,
            TeamError::ProjectionChanged
        );
        self.validate_own_response(actor, org, generation).await?;
        self.validate_financial_response(org, &financial).await?;
        Ok(result)
    }
}

fn valid_session_id(id: &str) -> bool {
    id.len() == 64
        && id
            .bytes()
            .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
}

fn usage_identity(user: Uuid, event: &str) -> String {
    use sha2::{Digest, Sha256};
    format!("{:x}", Sha256::digest(format!("{user}:{event}").as_bytes()))
}
#[cfg(test)]
fn receipt_cost(
    facts: &[AiUsageEventRow],
    project: Uuid,
    since: DateTime<Utc>,
) -> Result<Metric<u64>> {
    receipt_cost_projects(facts, &[project], since)
}
fn receipt_cost_projects(
    facts: &[AiUsageEventRow],
    projects: &[Uuid],
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
                && fact.project_id.is_some_and(|p| projects.contains(&p))
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
