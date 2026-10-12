//! Copilot shares the existing organization publication authority and restore ledger.
use crate::{infrastructure::postgres::PostgresClient, services::copilot_reports::*};
use anyhow::{ensure, Context, Result};
use chrono::{DateTime, Duration, NaiveDate, Utc};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    collections::{BTreeMap, BTreeSet},
    sync::Arc,
};
use tokio_postgres::Transaction;
use uuid::Uuid;
fn hash(v: &impl serde::Serialize) -> Result<String> {
    Ok(format!("{:x}", Sha256::digest(serde_json::to_vec(v)?)))
}

/// Caller owns the organization publication lock. Replace/revision/invalidation
/// commit together; a changed-to-empty day is still a new source revision.
pub async fn commit_day_manifest(tx: &Transaction<'_>, org: Uuid, day: NaiveDate) -> Result<()> {
    let manifest:Value=tx.query_one("SELECT jsonb_build_object('facts',COALESCE((SELECT jsonb_agg(jsonb_build_object('user',user_id,'github',github_user_id,'account',provider_account_id,'feature',feature,'metrics',metrics,'consent',consent_version,'from',consent_from,'blocked',blocked) ORDER BY user_id,provider_account_id,feature) FROM team_copilot_daily_facts WHERE organization_id=$1 AND day=$2),'[]'::jsonb),'rejections',COALESCE((SELECT jsonb_agg(jsonb_build_object('reason',r.reason,'hash',r.record_hash,'rows',r.rejected_rows) ORDER BY r.reason,r.record_hash) FROM team_copilot_daily_rejections r JOIN team_copilot_daily_jobs j ON j.id=r.job_id JOIN team_copilot_daily_integrations c ON c.organization_id=j.organization_id AND c.revision=j.configuration_revision WHERE j.organization_id=$1 AND j.day=$2),'[]'::jsonb),'conflicts',COALESCE((SELECT jsonb_agg(jsonb_build_object('user',z.github_user_id,'feature',z.feature) ORDER BY z.github_user_id,z.feature) FROM team_copilot_daily_conflicts z JOIN team_copilot_daily_jobs j ON j.id=z.job_id JOIN team_copilot_daily_integrations c ON c.organization_id=j.organization_id AND c.revision=j.configuration_revision WHERE j.organization_id=$1 AND j.day=$2),'[]'::jsonb),'account',(SELECT i.account_id FROM team_copilot_daily_integrations c JOIN team_github_installations i USING(organization_id,installation_id) WHERE c.organization_id=$1))",&[&org,&day]).await?.get(0);
    let fingerprint = hash(&manifest)?;
    let old=tx.query_opt("SELECT fingerprint FROM team_copilot_day_manifests WHERE organization_id=$1 AND day=$2",&[&org,&day]).await?;
    if old.is_some_and(|r| r.get::<_, String>(0) == fingerprint) {
        tx.execute("UPDATE team_copilot_day_manifests SET observed_at=now() WHERE organization_id=$1 AND day=$2",&[&org,&day]).await?;
        return Ok(());
    }
    let disposition = if manifest["rejections"]
        .as_array()
        .is_some_and(|a| !a.is_empty())
        || manifest["conflicts"]
            .as_array()
            .is_some_and(|a| !a.is_empty())
    {
        "partial"
    } else {
        "observed"
    };
    tx.execute("INSERT INTO team_copilot_day_manifests(organization_id,day,revision,fingerprint,disposition) VALUES($1,$2,1,$3,$4) ON CONFLICT(organization_id,day) DO UPDATE SET revision=team_copilot_day_manifests.revision+1,fingerprint=$3,disposition=$4,observed_at=now()",&[&org,&day,&fingerprint,&disposition]).await?;
    // Legacy windows are opaque conservative barriers; day labels cannot prove disjointness.
    tx.execute("UPDATE team_weekly_publications SET invalidated_at=COALESCE(invalidated_at,now()),projection=NULL WHERE organization_id=$1 AND (report_family='copilot_daily_weekly' OR view_key='copilot:bundle') AND (window_start IS NULL OR (window_start<($2::date+1)::timestamp AT TIME ZONE 'UTC' AND window_end>$2::date::timestamp AT TIME ZONE 'UTC'))",&[&org,&day]).await?;
    Ok(())
}
pub struct CopilotReportsRepository {
    pub pg: Arc<PostgresClient>,
}
impl CopilotReportsRepository {
    pub fn new(pg: Arc<PostgresClient>) -> Self {
        Self { pg }
    }
    pub async fn fence(&self, org: Uuid) -> Result<String> {
        let mut c = self.pg.transaction_client().await?;
        let tx = c.transaction().await?;
        Self::tx_fence(&tx, org, true).await
    }
    async fn tx_fence(tx: &Transaction<'_>, org: Uuid, publications: bool) -> Result<String> {
        let mut state = Self::tx_state(tx, org).await?;
        if !publications {
            state.as_object_mut().unwrap().remove("publications");
        }
        hash(&state)
    }
    async fn tx_state(tx: &Transaction<'_>, org: Uuid) -> Result<Value> {
        let v:Value=tx.query_one("SELECT jsonb_build_object('sources',COALESCE((SELECT jsonb_agg(to_jsonb(m)-'observed_at' ORDER BY day) FROM team_copilot_day_manifests m WHERE organization_id=$1),'[]'::jsonb),'config',(SELECT to_jsonb(c) FROM team_copilot_daily_integrations c WHERE organization_id=$1),'installation',(SELECT to_jsonb(i)-'updated_at'-'lease_token'-'lease_until' FROM team_github_installations i JOIN team_copilot_daily_integrations c USING(organization_id,installation_id) WHERE i.organization_id=$1),'generation',(SELECT jsonb_build_object('generation',generation,'enabled',enabled) FROM team_rollouts WHERE organization_id=$1),'membership',COALESCE((SELECT jsonb_agg(to_jsonb(h) ORDER BY id) FROM team_copilot_membership_intervals h WHERE organization_id=$1),'[]'::jsonb),'identities',COALESCE((SELECT jsonb_agg(jsonb_build_object('user',g.user_id,'github',g.github_user_id,'verified',g.verified_at,'revoked',g.revoked_at) ORDER BY g.user_id) FROM team_github_identities g JOIN organization_members m ON m.user_id=g.user_id WHERE m.organization_id=$1),'[]'::jsonb),'users',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',u.id,'active',u.is_active,'deleted',u.deleted_at) ORDER BY u.id) FROM users u JOIN organization_members m ON m.user_id=u.id WHERE m.organization_id=$1),'[]'::jsonb),'consents',COALESCE((SELECT jsonb_agg(to_jsonb(c) ORDER BY user_id) FROM organization_analytics_consents c WHERE c.organization_id=$1),'[]'::jsonb),'members',COALESCE((SELECT jsonb_agg(to_jsonb(m) ORDER BY user_id) FROM organization_members m WHERE m.organization_id=$1),'[]'::jsonb),'roster',COALESCE((SELECT jsonb_agg(to_jsonb(tm) ORDER BY tm.team_id,tm.user_id) FROM team_members tm JOIN teams t ON t.id=tm.team_id WHERE t.organization_id=$1),'[]'::jsonb),'teams',COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM teams t WHERE t.organization_id=$1),'[]'::jsonb),'publications',COALESCE((SELECT jsonb_agg(jsonb_build_object('week',week_start,'key',view_key,'hash',fingerprint,'invalidated',invalidated_at) ORDER BY week_start,view_key) FROM team_weekly_publications WHERE organization_id=$1),'[]'::jsonb))",&[&org]).await?.get(0);
        Ok(v)
    }
    pub async fn report(&self, org: Uuid, team: Option<Uuid>, start: NaiveDate) -> Result<Report> {
        let (from, to) = week(start, "UTC", Utc::now())?;
        let mut c = self.pg.transaction_client().await?;
        let tx = c.transaction().await?;
        let generation:i64=tx.query_one("SELECT generation FROM team_rollouts WHERE organization_id=$1 AND enabled FOR UPDATE",&[&org]).await?.get(0);
        let input_fence = Self::tx_fence(&tx, org, false).await?;
        let policy: Option<String> = tx
            .query_opt(
                "SELECT timezone FROM team_report_policies WHERE organization_id=$1",
                &[&org],
            )
            .await?
            .map(|r| r.get(0));
        let sources=tx.query("SELECT day,revision,fingerprint,observed_at,disposition FROM team_copilot_day_manifests WHERE organization_id=$1 AND day>=$2 AND day<$3 ORDER BY day",&[&org,&start,&(start+Duration::days(7))]).await?;
        let mut revisions = BTreeMap::<String, Value>::new();
        let mut updated = None;
        let ingestion = if sources.len() == 7
            && sources
                .iter()
                .all(|r| r.get::<_, String>("disposition") == "observed")
        {
            "reports_ingested"
        } else {
            "unconfirmed"
        };
        for r in sources {
            revisions.insert(
                r.get::<_, NaiveDate>(0).to_string(),
                json!({"revision":r.get::<_,i64>(1),"hash":r.get::<_,String>(2)}),
            );
            let at: DateTime<Utc> = r.get(3);
            updated = Some(updated.map_or(at, |old: DateTime<Utc>| old.max(at)));
        }
        let source_revision = hash(
            &revisions
                .iter()
                .map(|(day, v)| (day, &v["revision"]))
                .collect::<Vec<_>>(),
        )?;
        let config=tx.query_opt("SELECT c.enabled AND i.status='active' FROM team_copilot_daily_integrations c JOIN team_github_installations i USING(organization_id,installation_id) WHERE c.organization_id=$1",&[&org]).await?.is_some_and(|r|r.get::<_,bool>(0));
        let teams = tx
            .query(
                "SELECT id FROM teams WHERE organization_id=$1 ORDER BY id",
                &[&org],
            )
            .await?
            .into_iter()
            .map(|r| r.get::<_, Uuid>(0))
            .collect::<BTreeSet<_>>();
        ensure!(
            team.is_none_or(|t| teams.contains(&t)),
            "copilot_team_outside_scope"
        );
        let universe=tx.query("SELECT m.user_id FROM organization_members m JOIN users u ON u.id=m.user_id JOIN organization_analytics_consents c USING(organization_id,user_id) JOIN team_github_identities g ON g.user_id=m.user_id WHERE m.organization_id=$1 AND m.deactivated_at IS NULL AND m.seat_type='developer' AND m.role<>'viewer' AND u.is_active AND u.deleted_at IS NULL AND c.share_aggregate AND c.aggregate_from<$2 AND g.revoked_at IS NULL AND EXISTS(SELECT 1 FROM team_copilot_membership_intervals h WHERE h.organization_id=m.organization_id AND h.user_id=m.user_id AND h.team_id IS NULL AND h.valid_from<$2 AND (h.valid_to IS NULL OR h.valid_to>$3))",&[&org,&to,&from]).await?.into_iter().map(|r|r.get::<_,Uuid>(0)).collect::<BTreeSet<_>>();
        let rows=tx.query("SELECT f.user_id,f.day,f.feature,f.metrics,f.provider_account_id,f.github_user_id,ARRAY(SELECT h.team_id FROM team_copilot_membership_intervals h JOIN team_members tm ON tm.team_id=h.team_id AND tm.user_id=h.user_id JOIN teams t ON t.id=h.team_id AND t.organization_id=h.organization_id WHERE h.organization_id=f.organization_id AND h.user_id=f.user_id AND h.valid_from<=f.day::timestamp AT TIME ZONE 'UTC' AND (h.valid_to IS NULL OR h.valid_to>=(f.day+1)::timestamp AT TIME ZONE 'UTC')) teams FROM team_copilot_daily_facts f JOIN team_copilot_daily_integrations q USING(organization_id,installation_id) JOIN team_github_installations i USING(organization_id,installation_id) JOIN organization_members m USING(organization_id,user_id) JOIN users u ON u.id=m.user_id JOIN organization_analytics_consents c USING(organization_id,user_id) JOIN team_github_identities g ON g.user_id=f.user_id WHERE f.organization_id=$1 AND f.day>=$2 AND f.day<$3 AND NOT f.blocked AND q.enabled AND i.status='active' AND f.provider_account_id=i.account_id AND f.github_user_id=g.github_user_id AND g.revoked_at IS NULL AND g.verified_at<=f.day::timestamp AT TIME ZONE 'UTC' AND m.deactivated_at IS NULL AND m.seat_type='developer' AND m.role<>'viewer' AND u.is_active AND u.deleted_at IS NULL AND c.share_aggregate AND c.consent_version=f.consent_version AND c.aggregate_from=f.consent_from AND c.aggregate_from<=f.day::timestamp AT TIME ZONE 'UTC' AND EXISTS(SELECT 1 FROM team_copilot_membership_intervals h WHERE h.organization_id=f.organization_id AND h.user_id=f.user_id AND h.team_id IS NULL AND h.valid_from<=f.day::timestamp AT TIME ZONE 'UTC' AND (h.valid_to IS NULL OR h.valid_to>=(f.day+1)::timestamp AT TIME ZONE 'UTC')) ORDER BY f.user_id,f.day,f.feature LIMIT 44801",&[&org,&start,&(start+Duration::days(7))]).await?;
        let mut facts = Vec::new();
        for r in rows {
            let user: Uuid = r.get(0);
            let day: NaiveDate = r.get(1);
            let feature: String = r.get(2);
            let metrics = serde_json::from_value(r.get(3))?;
            let identity = hash(&(
                "copilot",
                r.get::<_, i64>(4),
                r.get::<_, i64>(5),
                day,
                &feature,
            ))?;
            facts.push(Fact {
                user,
                day,
                feature,
                metrics,
                teams: r.get::<_, Vec<Uuid>>(6).into_iter().collect(),
                identity,
            });
        }
        let bundle = project(&facts, &universe, &teams, start)?;
        let fingerprint = hash(&(&bundle, VERSION, &revisions))?;
        let mut status = if config { "partial" } else { "unavailable" };
        let history=tx.query("SELECT week_start,view_key,report_family,window_start,window_end,fingerprint,contributors,fact_membership,invalidated_at,projection,generation FROM team_weekly_publications WHERE organization_id=$1",&[&org]).await?;
        let existing = history.iter().find(|r| {
            r.get::<_, NaiveDate>("week_start") == start
                && r.get::<_, String>("view_key") == "copilot:bundle"
        });
        let window_invalidated = history.iter().any(|r| {
            r.get::<_, Option<DateTime<Utc>>>("invalidated_at")
                .is_some()
                && (r.get::<_, Option<DateTime<Utc>>>("window_start").is_none()
                    || (r
                        .get::<_, Option<DateTime<Utc>>>("window_start")
                        .is_some_and(|a| a < to)
                        && r.get::<_, Option<DateTime<Utc>>>("window_end")
                            .is_some_and(|b| b > from)))
        });
        let has_numbers = !bundle.facts.is_empty();
        let mut released = false;
        if window_invalidated {
            status = "invalidated";
        } else if config && has_numbers {
            let invalid = history.iter().any(|r| {
                r.get::<_, Option<DateTime<Utc>>>("invalidated_at")
                    .is_some()
                    && (r.get::<_, Option<DateTime<Utc>>>("window_start").is_none()
                        || (r
                            .get::<_, Option<DateTime<Utc>>>("window_start")
                            .is_some_and(|a| a < to)
                            && r.get::<_, Option<DateTime<Utc>>>("window_end")
                                .is_some_and(|b| b > from)))
            });
            if invalid {
                status = "invalidated";
            } else if let Some(old) = existing {
                if old.get::<_, String>("fingerprint") != fingerprint
                    || old.get::<_, i64>("generation") != generation
                {
                    tx.execute("UPDATE team_weekly_publications SET invalidated_at=now(),projection=NULL WHERE organization_id=$1 AND window_start<$3 AND window_end>$2",&[&org,&from,&to]).await?;
                    status = "invalidated";
                } else {
                    released = true;
                }
            } else {
                // Do not bypass older cross-family equations or an opaque restored barrier.
                let allowed = history.iter().all(|r| {
                    let people: BTreeSet<Uuid> =
                        r.get::<_, Vec<Uuid>>("contributors").into_iter().collect();
                    let bounds = (
                        r.get::<_, Option<DateTime<Utc>>>("window_start"),
                        r.get::<_, Option<DateTime<Utc>>>("window_end"),
                    );
                    let same_family = r.get::<_, Option<String>>("report_family").as_deref()
                        == Some("copilot_daily_weekly");
                    let overlap = match bounds {
                        (Some(a), Some(b)) => a < to && b > from,
                        _ => true,
                    };
                    if overlap && !same_family {
                        return !people.is_empty() && people.is_disjoint(&bundle.people);
                    }
                    let support = r
                        .get::<_, Option<Vec<String>>>("fact_membership")
                        .map(|f| f.into_iter().collect());
                    crate::services::team_trust::safe_fact_view(
                        support.as_ref(),
                        &people,
                        &r.get::<_, String>("fingerprint"),
                        &bundle.facts,
                        &bundle.people,
                        &fingerprint,
                    )
                });
                if allowed {
                    let people = bundle.people.iter().copied().collect::<Vec<_>>();
                    let support = bundle.facts.iter().cloned().collect::<Vec<_>>();
                    let projection = serde_json::to_value(&bundle.scopes)?;
                    let sources = serde_json::to_value(&revisions)?;
                    tx.execute("INSERT INTO team_weekly_publications(organization_id,week_start,view_key,generation,fingerprint,contributors,fact_membership,report_family,window_start,window_end,calculation_version,source_revisions,projection) VALUES($1,$2,'copilot:bundle',$3,$4,$5,$6,'copilot_daily_weekly',$7,$8,$9,$10,$11)",&[&org,&start,&generation,&fingerprint,&people,&support,&from,&to,&VERSION,&sources,&projection]).await?;
                    tx.execute("INSERT INTO team_copilot_report_policies(organization_id,locked_at) VALUES($1,now()) ON CONFLICT(organization_id) DO UPDATE SET locked_at=COALESCE(team_copilot_report_policies.locked_at,now())",&[&org]).await?;
                    released = true;
                } else {
                    status = "withheld";
                }
            }
        } else if config {
            status = "unavailable";
        }
        let cells = bundle
            .scopes
            .into_iter()
            .find(|s| s.team_id == team)
            .context("copilot_scope_missing")?
            .cells;
        let mut report = Report {
            organization_id: org,
            team_id: team,
            week_start: start,
            window_start: from,
            window_end: to,
            timezone: "UTC".into(),
            organization_timezone: policy.unwrap_or_else(|| "Asia/Bangkok".into()),
            status: status.into(),
            cells,
            provenance: "github_copilot_users_1_day".into(),
            calculation_version: VERSION.into(),
            provider_definition_version: "copilot-daily-v1".into(),
            updated_at: updated,
            ingestion_status: ingestion.into(),
            capture_status: "unconfirmed".into(),
            generation,
            source_revision,
            publication_id: released.then_some(fingerprint),
            fence: String::new(),
        };
        if !released {
            report.hide(status);
        }
        let final_state = Self::tx_state(&tx, org).await?;
        let mut final_inputs = final_state.clone();
        final_inputs.as_object_mut().unwrap().remove("publications");
        ensure!(
            hash(&final_inputs)? == input_fence,
            crate::services::team_insights::TeamError::ProjectionChanged
        );
        report.fence = hash(&final_state)?;
        tx.commit().await?;
        Ok(report)
    }
}
