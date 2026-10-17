//! Atomic workflow revisions and append-only restore proofs; never stores analytics numbers.
use crate::{
    infrastructure::postgres::PostgresClient,
    repository::team_trust::{Disposition, Registry, TeamTrustRepository},
    services::{
        authorization::{AuthorizationDenied, AuthorizationService},
        team_actions::*,
        team_insights::TeamError,
    },
};
use anyhow::{ensure, Context, Result};
use chrono::Utc;
use sha2::{Digest, Sha256};
use std::{collections::BTreeMap, sync::Arc};
use uuid::Uuid;

pub struct TeamActionsRepository {
    pub pg: Arc<PostgresClient>,
}
type Heads = BTreeMap<Uuid, Disposition>;
fn heads(org: Uuid, dispositions: impl IntoIterator<Item = Disposition>) -> Result<Heads> {
    let mut out = Heads::new();
    for d in dispositions {
        if d.provider != "team_improvement_action" {
            continue;
        }
        let fields = d.delivery_id.split(':').collect::<Vec<_>>();
        ensure!(fields.len() == 3, "action proof identity invalid");
        if Uuid::parse_str(fields[0])? != org {
            continue;
        }
        let id = Uuid::parse_str(fields[1])?;
        let revision = fields[2].parse::<i64>()?;
        ensure!(
            revision > 0
                && matches!(
                    d.reason.as_str(),
                    "action_revision"
                        | "action_deleted"
                        | "action_restore_blocked"
                        | "action_retention_expired"
                ),
            "action proof invalid"
        );
        if out.get(&id).is_none_or(|old| {
            old.delivery_id
                .rsplit(':')
                .next()
                .unwrap()
                .parse::<i64>()
                .unwrap()
                < revision
        }) {
            out.insert(id, d);
        }
    }
    Ok(out)
}
fn digest(value: &impl serde::Serialize) -> Result<String> {
    Ok(format!("{:x}", Sha256::digest(serde_json::to_vec(value)?)))
}
fn decode(row: &tokio_postgres::Row) -> Result<Action> {
    Ok(serde_json::from_value(row.get(0))?)
}
impl TeamActionsRepository {
    pub fn new(pg: Arc<PostgresClient>) -> Self {
        Self { pg }
    }
    pub async fn guard(&self, org: Uuid) -> Result<String> {
        TeamTrustRepository::new(self.pg.clone()).guard(org).await?;
        let ledger: Registry = serde_json::from_slice(&std::fs::read(std::env::var(
            "ATOAXIS_TEAM_PRIVACY_LEDGER_PATH",
        )?)?)?;
        let entry = ledger
            .organizations
            .get(&org)
            .context("action privacy scope missing")?;
        let access = (
            entry.generation,
            entry.access_hash.clone(),
            entry.retention_before,
            entry.deleted,
        );
        let expected = heads(org, ledger.dispositions)?;
        let rows=self.pg.query("SELECT provider,delivery_id,payload_hash,reason,disposed_at FROM team_webhook_dispositions WHERE provider='team_improvement_action' AND split_part(delivery_id,':',1)=$1",&[&org.to_string()]).await?;
        let current = heads(
            org,
            rows.into_iter().map(|r| Disposition {
                provider: r.get(0),
                delivery_id: r.get(1),
                payload_hash: r.get(2),
                reason: r.get(3),
                disposed_at: r.get(4),
            }),
        )?;
        ensure!(current == expected, TeamError::ProjectionChanged);
        // A restored older row cannot be covered by merely importing a newer head.
        // Deleted/blocked barriers close both current and history reads.
        let rows = self
            .pg
            .query(
                "SELECT to_jsonb(a),team_action_hash(a) FROM team_improvement_actions a WHERE organization_id=$1",
                &[&org],
            )
            .await?;
        for row in rows {
            let a = decode(&row)?;
            ensure!(
                a.state_hash == row.get::<_, String>(1),
                TeamError::ProjectionChanged
            );
            let d = current.get(&a.id).context("action head missing")?;
            if d.reason == "action_revision" {
                ensure!(
                    !a.deleted
                        && !a.blocked
                        && d.delivery_id == format!("{org}:{}:{}", a.id, a.revision)
                        && d.payload_hash == a.state_hash,
                    TeamError::ProjectionChanged
                );
            } else {
                ensure!(a.deleted || a.blocked, TeamError::ProjectionChanged);
            }
        }
        for (id, d) in &current {
            if d.reason == "action_revision" {
                ensure!(self.pg.query_opt("SELECT 1 FROM team_improvement_actions WHERE organization_id=$1 AND id=$2",&[&org,id]).await?.is_some(),TeamError::ProjectionChanged);
            }
        }
        digest(&(current, access))
    }
    pub async fn can_manage(&self, actor: Uuid, org: Uuid, team: Option<Uuid>) -> Result<bool> {
        let row=self.pg.query_one("SELECT EXISTS(SELECT 1 FROM organization_members m JOIN users u ON u.id=m.user_id JOIN organizations o ON o.id=m.organization_id WHERE m.organization_id=$1 AND m.user_id=$2 AND m.deactivated_at IS NULL AND o.deleted_at IS NULL AND u.is_active AND u.deleted_at IS NULL AND (m.role IN ('owner','admin') OR (m.role='member' AND EXISTS(SELECT 1 FROM teams t JOIN team_members tm ON tm.team_id=t.id WHERE t.organization_id=$1 AND t.id=$3 AND tm.user_id=$2 AND tm.role='lead'))))",&[&org,&actor,&team]).await?;
        Ok(row.get(0))
    }
    pub async fn list(&self, actor: Uuid, org: Uuid, q: &List) -> Result<Page> {
        self.list_filtered(actor, org, q, None, None).await
    }
    /// Filter before pagination; shared access/restore fence applies to every page.
    pub async fn list_week(
        &self,
        actor: Uuid,
        org: Uuid,
        q: &List,
        family: &crate::services::team_comparison::Family,
        week: chrono::NaiveDate,
    ) -> Result<Page> {
        let family = match family {
            crate::services::team_comparison::Family::Copilot => "copilot",
            crate::services::team_comparison::Family::TeamCost => "team_cost",
        };
        self.list_filtered(actor, org, q, Some(family), Some(week))
            .await
    }
    async fn list_filtered(
        &self,
        actor: Uuid,
        org: Uuid,
        q: &List,
        family: Option<&str>,
        week: Option<chrono::NaiveDate>,
    ) -> Result<Page> {
        AuthorizationService::new(Some(self.pg.clone()))
            .require_team_read(actor, org, q.team_id)
            .await?;
        let proof = self.guard(org).await?;
        let limit = q.limit.unwrap_or(25);
        ensure!(
            (1..=100).contains(&limit),
            TeamError::Invalid("limit must be 1..100")
        );
        let cutoff = crate::services::team_trust::cutoff(Utc::now());
        let rows=self.pg.query("SELECT to_jsonb(a) FROM team_improvement_actions a JOIN organization_members m ON m.organization_id=a.organization_id AND m.user_id=a.owner_id JOIN users u ON u.id=m.user_id WHERE a.organization_id=$1 AND a.team_id IS NOT DISTINCT FROM $2 AND NOT a.deleted AND NOT a.blocked AND a.created_at>=$3 AND m.deactivated_at IS NULL AND u.is_active AND u.deleted_at IS NULL AND (a.team_id IS NULL OR EXISTS(SELECT 1 FROM team_members tm WHERE tm.team_id=a.team_id AND tm.user_id=a.owner_id)) AND ($4::uuid IS NULL OR a.id>$4) AND ($6::text IS NULL OR a.family=$6) AND ($7::date IS NULL OR (a.baseline_week<=$7 AND a.followup_week>=$7)) ORDER BY a.id LIMIT $5",&[&org,&q.team_id,&cutoff,&q.after,&(limit+1),&family,&week]).await?;
        let mut actions = rows.iter().map(decode).collect::<Result<Vec<_>>>()?;
        let next_cursor = if actions.len() > limit as usize {
            actions.truncate(limit as usize);
            actions.last().map(|a| a.id)
        } else {
            None
        };
        let can_manage = self.can_manage(actor, org, q.team_id).await?;
        ensure!(
            self.guard(org).await? == proof,
            TeamError::ProjectionChanged
        );
        Ok(Page {
            actions,
            next_cursor,
            can_manage,
            proof,
        })
    }
    pub async fn get(&self, actor: Uuid, org: Uuid, id: Uuid) -> Result<Action> {
        let proof = self.guard(org).await?;
        let row=self.pg.query_opt("SELECT to_jsonb(a) FROM team_improvement_actions a WHERE organization_id=$1 AND id=$2 AND NOT deleted AND NOT blocked AND created_at>=$3 AND EXISTS(SELECT 1 FROM organization_members m JOIN users u ON u.id=m.user_id WHERE m.organization_id=a.organization_id AND m.user_id=a.owner_id AND m.deactivated_at IS NULL AND u.is_active AND u.deleted_at IS NULL AND (a.team_id IS NULL OR EXISTS(SELECT 1 FROM team_members tm WHERE tm.team_id=a.team_id AND tm.user_id=a.owner_id)))",&[&org,&id,&crate::services::team_trust::cutoff(Utc::now())]).await?.ok_or(TeamError::NotFound)?;
        let a = decode(&row)?;
        AuthorizationService::new(Some(self.pg.clone()))
            .require_team_read(actor, org, a.team_id)
            .await?;
        ensure!(
            self.guard(org).await? == proof,
            TeamError::ProjectionChanged
        );
        Ok(a)
    }
    pub async fn history(
        &self,
        actor: Uuid,
        org: Uuid,
        id: Uuid,
        before: Option<i64>,
    ) -> Result<History> {
        let a = self.get(actor, org, id).await?;
        let rows=self.pg.query("SELECT snapshot FROM team_improvement_action_history WHERE organization_id=$1 AND action_id=$2 AND changed_at>=$3 AND ($4::bigint IS NULL OR revision<$4) ORDER BY revision DESC LIMIT 51",&[&org,&id,&crate::services::team_trust::cutoff(Utc::now()),&before]).await?;
        let mut changes = rows.iter().map(decode).collect::<Result<Vec<_>>>()?;
        let next_revision = if changes.len() > 50 {
            changes.truncate(50);
            changes.last().map(|a| a.revision)
        } else {
            None
        };
        ensure!(
            self.get(actor, org, id).await?.revision == a.revision,
            TeamError::ProjectionChanged
        );
        Ok(History {
            changes,
            next_revision,
        })
    }
    /// CAS/idempotence and current role/owner checks all occur under one PG lock.
    /// No filesystem export or network is awaited while this transaction is held.
    #[allow(clippy::too_many_arguments)]
    pub async fn write(
        &self,
        actor: Uuid,
        org: Uuid,
        id: Uuid,
        team: Option<Uuid>,
        edit: Option<&Edit>,
        delete: Option<&Delete>,
        timezone: &str,
    ) -> Result<i64> {
        ensure!(!id.is_nil(), TeamError::Invalid("action identity required"));
        if let Some(e) = edit {
            e.validate(Utc::now())?;
        }
        let (request, expected) = if let Some(e) = edit {
            (e.request_id, e.expected_revision)
        } else {
            let d = delete.context("action mutation required")?;
            (d.request_id, d.expected_revision)
        };
        ensure!(
            !request.is_nil() && expected >= 0,
            TeamError::Invalid("request identity/revision required")
        );
        let request_hash = digest(&(id, team, edit, delete, timezone))?;
        let mut client = self.pg.transaction_client().await?;
        let tx = client.transaction().await?;
        tx.query_one("SELECT pg_advisory_xact_lock(74103031)", &[])
            .await?;
        let role=tx.query_opt("SELECT m.role FROM organization_members m JOIN users u ON u.id=m.user_id JOIN organizations o ON o.id=m.organization_id JOIN team_rollouts r ON r.organization_id=o.id WHERE m.organization_id=$1 AND m.user_id=$2 AND m.deactivated_at IS NULL AND u.is_active AND u.deleted_at IS NULL AND o.deleted_at IS NULL AND r.enabled FOR UPDATE OF m,r",&[&org,&actor]).await?.ok_or(AuthorizationDenied("action access denied"))?.get::<_,String>(0);
        let current=tx.query_opt("SELECT team_id,revision,deleted,blocked,created_at FROM team_improvement_actions WHERE organization_id=$1 AND id=$2 FOR UPDATE",&[&org,&id]).await?;
        let scope = current
            .as_ref()
            .map(|r| r.get::<_, Option<Uuid>>(0))
            .unwrap_or(team);
        ensure!(scope == team, TeamError::Invalid("action scope immutable"));
        if !matches!(role.as_str(), "owner" | "admin") {
            ensure!(role=="member" && tx.query_opt("SELECT 1 FROM teams t JOIN team_members tm ON tm.team_id=t.id WHERE t.organization_id=$1 AND t.id=$2 AND tm.user_id=$3 AND tm.role='lead' FOR SHARE OF t,tm",&[&org,&scope,&actor]).await?.is_some(),AuthorizationDenied("action requires owner, admin or scoped lead"));
        }
        if let Some(t) = scope {
            ensure!(
                tx.query_opt(
                    "SELECT 1 FROM teams WHERE organization_id=$1 AND id=$2 FOR SHARE",
                    &[&org, &t]
                )
                .await?
                .is_some(),
                AuthorizationDenied("team outside organization")
            );
        }
        if let Some(row)=tx.query_opt("SELECT action_id,request_hash FROM team_improvement_action_history WHERE organization_id=$1 AND request_id=$2",&[&org,&request]).await?{
            ensure!(row.get::<_,Uuid>(0)==id && row.get::<_,String>(1)==request_hash,TeamError::ProjectionChanged);
            let revision=current.context("action no longer available")?.get(1);tx.commit().await?;return Ok(revision);
        }
        if let Some(r) = &current {
            ensure!(
                !r.get::<_, bool>(2)
                    && !r.get::<_, bool>(3)
                    && r.get::<_, chrono::DateTime<Utc>>(4)
                        >= crate::services::team_trust::cutoff(Utc::now()),
                TeamError::NotFound
            );
            ensure!(r.get::<_, i64>(1) == expected, TeamError::ProjectionChanged);
        } else {
            ensure!(expected == 0 && edit.is_some(), TeamError::NotFound);
            ensure!(tx.query_opt("SELECT 1 FROM team_webhook_dispositions WHERE provider='team_improvement_action' AND split_part(delivery_id,':',1)=$1 AND split_part(delivery_id,':',2)=$2 LIMIT 1",&[&org.to_string(),&id.to_string()]).await?.is_none(),TeamError::ProjectionChanged);
        }
        let revision = if let Some(e) = edit {
            ensure!(tx.query_opt("SELECT 1 FROM organization_members m JOIN users u ON u.id=m.user_id WHERE m.organization_id=$1 AND m.user_id=$2 AND m.deactivated_at IS NULL AND u.is_active AND u.deleted_at IS NULL AND ($3::uuid IS NULL OR EXISTS(SELECT 1 FROM team_members tm WHERE tm.team_id=$3 AND tm.user_id=$2)) FOR SHARE OF m,u",&[&org,&e.owner_id,&scope]).await?.is_some(),TeamError::Invalid("action owner must be current scoped member"));
            let family = match e.family {
                crate::services::team_comparison::Family::TeamCost => "team_cost",
                crate::services::team_comparison::Family::Copilot => "copilot",
            };
            if current.is_none() {
                tx.query_one("INSERT INTO team_improvement_actions(organization_id,id,team_id,owner_id,title,focus,family,baseline_week,followup_week,timezone,status,created_by,changed_by,request_id,request_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12,$13,$14) RETURNING revision",&[&org,&id,&scope,&e.owner_id,&e.title,&e.focus,&family,&e.baseline_week,&e.followup_week,&timezone,&e.status,&actor,&request,&request_hash]).await?.get(0)
            } else {
                tx.query_one("UPDATE team_improvement_actions SET owner_id=$3,title=$4,focus=$5,family=$6,baseline_week=$7,followup_week=$8,timezone=$9,status=$10,changed_by=$11,request_id=$12,request_hash=$13 WHERE organization_id=$1 AND id=$2 RETURNING revision",&[&org,&id,&e.owner_id,&e.title,&e.focus,&family,&e.baseline_week,&e.followup_week,&timezone,&e.status,&actor,&request,&request_hash]).await?.get(0)
            }
        } else {
            tx.query_one("UPDATE team_improvement_actions SET deleted=TRUE,changed_by=$3,request_id=$4,request_hash=$5 WHERE organization_id=$1 AND id=$2 RETURNING revision",&[&org,&id,&actor,&request,&request_hash]).await?.get(0)
        };
        tx.commit().await?;
        Ok(revision)
    }
}
