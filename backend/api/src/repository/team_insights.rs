use anyhow::{Context, Result};
use chrono::{DateTime, Utc};
use std::collections::BTreeSet;
use std::sync::Arc;
use uuid::Uuid;

use crate::infrastructure::{database::ClickHouseClient, postgres::PostgresClient};
use crate::model::{ai_usage::AiUsageEventRow, team_insights::*};

pub struct Contributor {
    pub user_id: Uuid,
    pub aggregate_from: DateTime<Utc>,
    pub individual_from: Option<DateTime<Utc>>,
}

pub struct ProjectionScope {
    pub generation: i64,
    pub contributors: Vec<Contributor>,
    pub projects: BTreeSet<Uuid>,
}

pub struct ReceiptLink {
    pub user_id: Uuid,
    pub link: WorkLink,
    pub project_id: Uuid,
    pub individual_from: DateTime<Utc>,
    pub allocation_targets: i64,
}

pub struct TeamInsightsRepository {
    pub postgres: Arc<PostgresClient>,
    clickhouse: Arc<ClickHouseClient>,
}

impl TeamInsightsRepository {
    pub fn new(postgres: Arc<PostgresClient>, clickhouse: Arc<ClickHouseClient>) -> Self {
        Self {
            postgres,
            clickhouse,
        }
    }

    pub async fn enabled(&self, org: Uuid) -> Result<bool> {
        Ok(self
            .postgres
            .query_opt(
                "SELECT enabled FROM team_rollouts WHERE organization_id = $1",
                &[&org],
            )
            .await?
            .is_some_and(|r| r.get("enabled")))
    }

    pub async fn release_evidence(
        &self,
        org: Uuid,
    ) -> Result<std::collections::BTreeMap<String, (bool, String)>> {
        Ok(self
            .postgres
            .query(
                "SELECT gate, passed, evidence_ref FROM team_release_evidence
            WHERE organization_id = $1",
                &[&org],
            )
            .await?
            .into_iter()
            .map(|r| (r.get("gate"), (r.get("passed"), r.get("evidence_ref"))))
            .collect())
    }

    pub async fn generation(&self, org: Uuid) -> Result<i64> {
        Ok(self
            .postgres
            .query_opt(
                "SELECT generation FROM team_rollouts WHERE organization_id = $1",
                &[&org],
            )
            .await?
            .map_or(0, |r| r.get("generation")))
    }

    pub async fn consent(&self, org: Uuid, user: Uuid) -> Result<TeamConsent> {
        let row = self.postgres.query_opt(
            "SELECT share_aggregate, share_individual, consent_version, aggregate_from, individual_from
             FROM organization_analytics_consents WHERE organization_id = $1 AND user_id = $2",
            &[&org, &user]).await?;
        Ok(TeamConsent {
            share_aggregate: row.as_ref().is_some_and(|r| r.get("share_aggregate")),
            share_individual: row.as_ref().is_some_and(|r| r.get("share_individual")),
            version: row.as_ref().map_or(0, |r| r.get("consent_version")),
            aggregate_from: row.as_ref().and_then(|r| r.get("aggregate_from")),
            individual_from: row.as_ref().and_then(|r| r.get("individual_from")),
            preview: ConsentPreview::default(),
        })
    }

    pub async fn scope(&self, org: Uuid, team: Option<Uuid>) -> Result<ProjectionScope> {
        let generation = self.generation(org).await?;
        let contributors = self
            .postgres
            .query(
                "SELECT m.user_id, c.aggregate_from, c.individual_from
             FROM organization_members m JOIN organization_analytics_consents c
               ON c.organization_id = m.organization_id AND c.user_id = m.user_id
             JOIN users u ON u.id = m.user_id
             WHERE m.organization_id = $1 AND m.deactivated_at IS NULL
               AND m.seat_type = 'developer' AND m.role <> 'viewer' AND u.is_active AND u.deleted_at IS NULL
               AND c.share_aggregate AND c.aggregate_from IS NOT NULL
               AND ($2::uuid IS NULL OR EXISTS (SELECT 1 FROM team_members tm
                 JOIN teams t ON t.id = tm.team_id WHERE t.organization_id = $1
                 AND tm.team_id = $2 AND tm.user_id = m.user_id))",
                &[&org, &team],
            )
            .await?
            .into_iter()
            .map(|r| Contributor {
                user_id: r.get("user_id"),
                aggregate_from: r.get("aggregate_from"),
                individual_from: r.get("individual_from"),
            })
            .collect();
        let projects = self
            .postgres
            .query(
                "SELECT project_id FROM team_repository_scopes s WHERE organization_id = $1
             AND enabled AND ($2::uuid IS NULL OR team_id = $2)",
                &[&org, &team],
            )
            .await?
            .into_iter()
            .map(|r| r.get("project_id"))
            .collect();
        Ok(ProjectionScope {
            generation,
            contributors,
            projects,
        })
    }

    /// FINAL resolves corrections before event time/project filtering. Never resurrect an old revision.
    pub async fn facts(&self, users: &[Uuid], from: u32, to: u32) -> Result<Vec<AiUsageEventRow>> {
        if users.is_empty() {
            return Ok(vec![]);
        }
        let rows = self.clickhouse.get_client().query(
            "SELECT user_id, toUInt16(date) AS date, usage_event_id, event_payload_hash,
             ai_session_id, collector_id, event_time, project_id, project_attribution_method,
             ai_agent, ai_provider, ai_model, prompt_count, prompt_character_count,
             input_tokens, output_tokens, cache_read_tokens, cache_write_tokens,
             estimated_cost_microusd, pricing_version, token_source, version, received_at
             FROM (SELECT * FROM wakaclock.ai_usage_events FINAL WHERE user_id IN ?)
             WHERE event_time >= ? AND event_time < ? ORDER BY event_time, usage_event_id LIMIT 100001")
            .bind(users).bind(from).bind(to).fetch_all::<AiUsageEventRow>().await
            .context("Team canonical usage query unavailable")?;
        anyhow::ensure!(
            rows.len() <= 100_000,
            "Team fact limit exceeded; narrow the range"
        );
        Ok(rows)
    }

    pub async fn session_facts(&self, user: Uuid, session: &str) -> Result<Vec<AiUsageEventRow>> {
        self.clickhouse
            .get_client()
            .query(
                "SELECT user_id, toUInt16(date) AS date, usage_event_id, event_payload_hash,
             ai_session_id, collector_id, event_time, project_id, project_attribution_method,
             ai_agent, ai_provider, ai_model, prompt_count, prompt_character_count,
             input_tokens, output_tokens, cache_read_tokens, cache_write_tokens,
             estimated_cost_microusd, pricing_version, token_source, version, received_at
             FROM wakaclock.ai_usage_events FINAL WHERE user_id = ?
             AND lower(hex(SHA256(concat(toString(user_id), ':', toString(length(ai_agent)), ':',
               ai_agent, ':', ifNull(collector_id, ''), ':', ai_session_id)))) = ? LIMIT 10001",
            )
            .bind(user)
            .bind(session)
            .fetch_all::<AiUsageEventRow>()
            .await
            .context("Team session lookup unavailable")
    }

    pub async fn work_items(&self, org: Uuid, team: Option<Uuid>) -> Result<Vec<TeamWorkItem>> {
        Ok(self
            .postgres
            .query(
                "SELECT w.* FROM team_work_items w JOIN team_repository_scopes s
             ON s.organization_id = w.organization_id AND s.repository_id = w.repository_id
             WHERE w.organization_id = $1 AND s.enabled AND ($2::uuid IS NULL OR s.team_id = $2)
             ORDER BY w.provider_updated_at DESC LIMIT 200",
                &[&org, &team],
            )
            .await?
            .into_iter()
            .map(|r| TeamWorkItem {
                repository_id: r.get("repository_id"),
                external_id: r.get("external_id"),
                kind: r.get("kind"),
                number: r.get("number"),
                state: r.get("state"),
                opened_at: r.get("opened_at"),
                ready_at: r.get("ready_at"),
                first_review_at: r.get("first_review_at"),
                merged_at: r.get("merged_at"),
                closed_at: r.get("closed_at"),
                synced_at: r.get("synced_at"),
                session_details: "withheld",
            })
            .collect())
    }

    pub async fn receipt_links(
        &self,
        org: Uuid,
        repo: Uuid,
        item: i64,
        team: Option<Uuid>,
    ) -> Result<Vec<ReceiptLink>> {
        Ok(self.postgres.query(
            "SELECT l.*, s.project_id, c.individual_from,
              (SELECT count(*) FROM team_session_links other
               WHERE other.user_id = l.user_id AND other.session_id = l.session_id
                 AND other.status = 'confirmed') AS allocation_targets
             FROM team_session_links l JOIN team_repository_scopes s
               ON s.organization_id = l.organization_id AND s.repository_id = l.repository_id
             JOIN organization_members m ON m.organization_id = l.organization_id AND m.user_id = l.user_id
             JOIN organization_analytics_consents c ON c.organization_id = m.organization_id AND c.user_id = m.user_id
             JOIN users u ON u.id = l.user_id
             WHERE l.organization_id = $1 AND l.repository_id = $2 AND l.work_item_id = $3
               AND l.status = 'confirmed' AND s.enabled AND ($4::uuid IS NULL OR s.team_id = $4)
               AND m.deactivated_at IS NULL AND m.seat_type = 'developer' AND m.role <> 'viewer'
               AND u.is_active AND u.deleted_at IS NULL AND c.share_individual AND c.individual_from IS NOT NULL
             ORDER BY l.id LIMIT 201", &[&org, &repo, &item, &team]).await?.into_iter().map(|r| {
                 ReceiptLink { user_id: r.get("user_id"), project_id: r.get("project_id"),
                   individual_from: r.get("individual_from"), allocation_targets: r.get("allocation_targets"), link: link_row(r) }
             }).collect())
    }

    pub async fn links(&self, org: Uuid, user: Uuid) -> Result<Vec<WorkLink>> {
        Ok(self
            .postgres
            .query(
                "SELECT l.* FROM team_session_links l JOIN team_repository_scopes s
             ON s.organization_id = l.organization_id AND s.repository_id = l.repository_id
             WHERE l.organization_id = $1 AND l.user_id = $2 AND s.enabled
             ORDER BY l.updated_at DESC LIMIT 200",
                &[&org, &user],
            )
            .await?
            .into_iter()
            .map(link_row)
            .collect())
    }

    pub async fn work_item_team(
        &self,
        org: Uuid,
        repository: Uuid,
        work_item: i64,
    ) -> Result<Option<Option<Uuid>>> {
        Ok(self
            .postgres
            .query_opt(
                "SELECT s.team_id FROM team_repository_scopes s JOIN team_work_items w
            ON w.organization_id=s.organization_id AND w.repository_id=s.repository_id
            WHERE s.organization_id=$1 AND s.repository_id=$2 AND w.external_id=$3 AND s.enabled",
                &[&org, &repository, &work_item],
            )
            .await?
            .map(|r| r.get("team_id")))
    }

    pub async fn work_item_project(
        &self,
        org: Uuid,
        repository: Uuid,
        work_item: i64,
    ) -> Result<Option<Uuid>> {
        Ok(self.postgres.query_opt(
            "SELECT s.project_id FROM team_repository_scopes s JOIN team_work_items w
             ON w.organization_id = s.organization_id AND w.repository_id = s.repository_id
             WHERE s.organization_id = $1 AND s.repository_id = $2 AND w.external_id = $3 AND s.enabled",
            &[&org, &repository, &work_item]).await?.map(|r| r.get("project_id")))
    }

    pub async fn propose(&self, org: Uuid, user: Uuid, request: &LinkRequest) -> Result<WorkLink> {
        let mut client = self.postgres.transaction_client().await?;
        let tx = client.transaction().await?;
        let row = tx
            .query_one(
                "INSERT INTO team_session_links (id, organization_id, repository_id, work_item_id,
              user_id, session_id, status, evidence)
             VALUES ($1, $2, $3, $4, $5, $6, 'proposed', 'owner_confirmation')
             ON CONFLICT (organization_id, user_id, session_id, repository_id, work_item_id)
               DO UPDATE SET session_id = EXCLUDED.session_id RETURNING *",
                &[
                    &Uuid::now_v7(),
                    &org,
                    &request.repository_id,
                    &request.work_item_id,
                    &user,
                    &request.session_id,
                ],
            )
            .await?;
        tx.commit().await?;
        Ok(link_row(row))
    }

    pub async fn decide_link(
        &self,
        org: Uuid,
        user: Uuid,
        id: Uuid,
        status: &str,
    ) -> Result<Option<WorkLink>> {
        let mut client = self.postgres.transaction_client().await?;
        let tx = client.transaction().await?;
        let row = tx
            .query_opt(
                "UPDATE team_session_links SET status = $4, updated_at = now()
             WHERE organization_id = $1 AND user_id = $2 AND id = $3
               AND EXISTS (SELECT 1 FROM organization_members m
                 LEFT JOIN organization_analytics_consents c ON c.organization_id = m.organization_id AND c.user_id = m.user_id
                 WHERE m.organization_id = $1 AND m.user_id = $2 AND m.deactivated_at IS NULL
                 AND ($4 <> 'confirmed' OR (m.seat_type = 'developer' AND m.role <> 'viewer' AND c.share_aggregate)))
             RETURNING *",
                &[&org, &user, &id, &status],
            )
            .await?;
        if row.is_some() {
            // Every link change invalidates allocations. Multiple confirmed links stay unallocated.
            tx.execute(
                "DELETE FROM team_usage_allocations WHERE link_id = $1",
                &[&id],
            )
            .await?;
            tx.execute(
                "INSERT INTO team_link_history (id, link_id, actor_user_id, status)
              VALUES ($1, $2, $3, $4)",
                &[&Uuid::now_v7(), &id, &user, &status],
            )
            .await?;
            tx.execute(
                "SELECT team_bump_generation(organization_id) FROM team_session_links
                WHERE user_id = $1 AND session_id = $2 GROUP BY organization_id",
                &[
                    &user,
                    &row.as_ref()
                        .expect("present")
                        .get::<_, String>("session_id"),
                ],
            )
            .await?;
        }
        tx.commit().await?;
        Ok(row.map(link_row))
    }
}

fn link_row(r: tokio_postgres::Row) -> WorkLink {
    WorkLink {
        id: r.get("id"),
        repository_id: r.get("repository_id"),
        work_item_id: r.get("work_item_id"),
        session_id: r.get("session_id"),
        status: r.get("status"),
        evidence: r.get("evidence"),
        updated_at: r.get("updated_at"),
    }
}
