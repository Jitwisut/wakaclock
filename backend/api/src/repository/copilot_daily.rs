//! Separate provider-day ledger. Never writes personal heartbeat, usage or allocation.
use crate::{infrastructure::postgres::PostgresClient, services::copilot_daily::DailyFact};
use anyhow::{ensure, Context, Result};
use chrono::{NaiveDate, Utc};
use serde_json::{json, Value};
use sha2::Digest;
use std::sync::Arc;
use uuid::Uuid;
pub struct CopilotDailyRepository {
    pub pg: Arc<PostgresClient>,
}
#[derive(Clone)]
pub struct DailyJob {
    pub id: Uuid,
    pub org: Uuid,
    pub installation: i64,
    pub generation: i64,
    pub revision: i64,
    pub day: NaiveDate,
    pub login: String,
    pub account: i64,
    pub checkpoint: Value,
    pub lease: Uuid,
}
impl CopilotDailyRepository {
    pub fn new(pg: Arc<PostgresClient>) -> Self {
        Self { pg }
    }
    pub async fn configure(
        &self,
        user: Uuid,
        org: Uuid,
        installation: i64,
        day: NaiveDate,
        enabled: bool,
        revision: i64,
    ) -> Result<()> {
        ensure!(
            (0..i64::MAX).contains(&revision)
                && (!enabled
                    || (day < Utc::now().date_naive()
                        && day >= crate::services::team_trust::cutoff(Utc::now()).date_naive())),
            "copilot_configuration_invalid"
        );
        let mut c = self.pg.transaction_client().await?;
        let tx = c.transaction().await?;
        tx.query_one(
            "SELECT generation FROM team_rollouts WHERE organization_id=$1 AND enabled FOR UPDATE",
            &[&org],
        )
        .await?;
        tx.query_opt("SELECT 1 FROM organization_members WHERE organization_id=$1 AND user_id=$2 AND deactivated_at IS NULL AND role IN ('owner','admin') FOR SHARE",&[&org,&user]).await?.context("copilot_management_denied")?;
        tx.query_opt("SELECT 1 FROM team_github_installations WHERE organization_id=$1 AND installation_id=$2 AND (NOT $3 OR status='active') FOR SHARE",&[&org,&installation,&enabled]).await?.context("copilot_installation_unavailable")?;
        let old=tx.query_opt("SELECT revision FROM team_copilot_daily_integrations WHERE organization_id=$1 FOR UPDATE",&[&org]).await?.map_or(0,|r|r.get::<_,i64>(0));
        ensure!(old == revision, "copilot_configuration_revision_conflict");
        tx.execute("INSERT INTO team_copilot_daily_integrations(organization_id,installation_id,start_day,enabled,revision) VALUES($1,$2,$3,$4,$5) ON CONFLICT(organization_id) DO UPDATE SET installation_id=$2,start_day=$3,enabled=$4,revision=$5,confirmed_at=now()",&[&org,&installation,&day,&enabled,&(revision+1)]).await?;
        tx.execute("UPDATE team_copilot_daily_jobs SET completed_at=now(),error_code='configuration_changed',lease_token=NULL,lease_until=NULL WHERE organization_id=$1 AND completed_at IS NULL",&[&org]).await?;
        tx.commit().await?;
        Ok(())
    }
    pub async fn status(&self, org: Uuid) -> Result<Value> {
        let config=self.pg.query_opt("SELECT installation_id,enabled,start_day,revision FROM team_copilot_daily_integrations WHERE organization_id=$1",&[&org]).await?;
        let state=self.pg.query_one("SELECT count(*) FILTER(WHERE completed_at IS NULL AND dead_letter_at IS NULL)::bigint pending, count(*) FILTER(WHERE dead_letter_at IS NOT NULL)::bigint dead_letter,max(last_success_at) last_success FROM team_copilot_daily_jobs WHERE organization_id=$1",&[&org]).await?;
        let latest=self.pg.query_opt("SELECT error_code FROM team_copilot_daily_jobs WHERE organization_id=$1 AND error_code IS NOT NULL ORDER BY retry_at DESC LIMIT 1",&[&org]).await?;
        let last = state.get::<_, Option<chrono::DateTime<Utc>>>("last_success");
        let error = latest.and_then(|r| r.get::<_, Option<String>>(0));
        let configuration=config.map(|r|json!({"installation_id":r.get::<_,i64>(0),"enabled":r.get::<_,bool>(1),"start_day":r.get::<_,NaiveDate>(2),"revision":r.get::<_,i64>(3)}));
        let status = if !crate::services::copilot_daily::enabled() {
            "disabled"
        } else if configuration.as_ref().is_none_or(|v| v["enabled"] != true) {
            "not_configured"
        } else if error.as_deref() == Some("commercial_admission_paused") {
            "paused"
        } else if error.as_deref() == Some("auth_required") {
            "auth_required"
        } else if error.as_deref() == Some("permission_required") {
            "permission_required"
        } else if error.as_deref() == Some("rate_limited") {
            "rate_limited"
        } else if error
            .as_deref()
            .is_some_and(|e| e.starts_with("financial_guard_"))
        {
            "unconfirmed"
        } else if error
            .as_deref()
            .is_some_and(|e| e.contains("network") || e == "provider_unavailable")
        {
            "provider_unavailable"
        } else if state.get::<_, i64>("dead_letter") > 0 {
            "dead_letter"
        } else if state.get::<_, i64>("pending") > 0 {
            "pending"
        } else if last.is_none() {
            "unconfirmed"
        } else if last.is_some_and(|at| Utc::now() - at > chrono::Duration::minutes(15)) {
            "stale"
        } else {
            "observed"
        };
        Ok(
            json!({"configuration":configuration,"status":status,"pending_jobs":state.get::<_,i64>("pending"),"dead_letter_jobs":state.get::<_,i64>("dead_letter"),"last_success_at":last,"error_code":error,"granularity":"provider_user_day_feature","timezone":"UTC","tokens":null,"model":null,"cost":null,"session_attribution":"unavailable","live_certification":"pending"}),
        )
    }
    pub async fn schedule(&self) -> Result<()> {
        // Bounded scheduling hints; stage rechecks under the billing/privacy locks.
        let mut db = self.pg.transaction_client().await?;
        let tx = db.transaction().await?;
        let after:Option<Uuid>=tx.query_one("SELECT after_organization FROM team_copilot_schedule_cursor WHERE singleton FOR UPDATE", &[]).await?.get(0);
        let query="SELECT c.organization_id,c.installation_id,c.revision,c.start_day,i.generation,i.account_id FROM team_copilot_daily_integrations c JOIN team_github_installations i USING(organization_id,installation_id) JOIN team_rollouts t USING(organization_id) WHERE c.enabled AND t.enabled AND i.status='active' AND ($1::uuid IS NULL OR c.organization_id>$1) ORDER BY c.organization_id LIMIT 100";
        let mut configs = tx.query(query, &[&after]).await?;
        if configs.is_empty() && after.is_some() {
            configs = tx.query(query, &[&None::<Uuid>]).await?;
        }
        // Reserve the page before network-free per-org work. A crash can postpone a
        // page until the next rotation, but cannot permanently lose its missing jobs.
        let next = configs.last().map(|r| r.get::<_, Uuid>(0));
        tx.execute(
            "UPDATE team_copilot_schedule_cursor SET after_organization=$1 WHERE singleton",
            &[&next],
        )
        .await?;
        tx.commit().await?;
        drop(db);
        let mut remaining = 100;
        for c in configs {
            let org: Uuid = c.get(0);
            let installation: i64 = c.get(1);
            let revision: i64 = c.get(2);
            let mut db = self.pg.transaction_client().await?;
            let tx = db.transaction().await?;
            super::team_seats::lock(&tx, org).await?;
            let state = super::team_analytics_entitlement::load(&tx, org).await?;
            let financial =
                match super::team_financial_guard::TransactionProof::capture(org, state.as_ref()) {
                    Ok(proof) => proof,
                    Err(_) => continue,
                };
            if tx.query_opt("SELECT 1 FROM team_rollouts t JOIN organizations o ON o.id=t.organization_id WHERE t.organization_id=$1 AND t.enabled AND o.deleted_at IS NULL FOR UPDATE OF t FOR SHARE OF o", &[&org]).await?.is_none() {
                continue;
            }
            if tx.query_opt("SELECT 1 FROM team_copilot_daily_integrations c JOIN team_github_installations i USING(organization_id,installation_id) WHERE c.organization_id=$1 AND c.installation_id=$2 AND c.revision=$3 AND c.enabled AND i.generation=$4 AND i.account_id=$5 AND i.status='active' FOR SHARE OF c,i", &[&org,&installation,&revision,&c.get::<_,i64>(4),&c.get::<_,i64>(5)]).await?.is_none() {
                continue;
            }
            let now: chrono::DateTime<Utc> =
                tx.query_one("SELECT clock_timestamp()", &[]).await?.get(0);
            let corrections =
                super::copilot_admission::correction_days_in(&tx, org, installation, c.get(5))
                    .await?;
            let existing=tx.query("SELECT day FROM team_copilot_daily_jobs WHERE organization_id=$1 AND configuration_revision=$2", &[&org,&revision]).await?.into_iter().map(|r|r.get::<_,NaiveDate>(0)).collect::<std::collections::BTreeSet<_>>();
            let earliest = c
                .get::<_, NaiveDate>(3)
                .max(crate::services::team_trust::cutoff(now).date_naive());
            let mut day = now.date_naive() - chrono::Duration::days(1);
            while day >= earliest && remaining > 0 {
                if !existing.contains(&day)
                    && (crate::services::copilot_admission::new_allowed(state.as_ref(), day, now)
                        || corrections.contains(&day))
                {
                    tx.execute("INSERT INTO team_copilot_daily_jobs(id,organization_id,installation_id,installation_generation,configuration_revision,day) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING", &[&Uuid::now_v7(),&org,&installation,&c.get::<_,i64>(4),&revision,&day]).await?;
                    remaining -= 1;
                }
                day -= chrono::Duration::days(1);
            }
            // Corrections remain refreshable after expiry, even if their last report was empty.
            let refresh=tx.query("SELECT id,day FROM team_copilot_daily_jobs WHERE organization_id=$1 AND configuration_revision=$2 AND completed_at<clock_timestamp()-interval '1 hour' AND (error_code IS NULL OR error_code='commercial_admission_limited') AND day>=($3::date-3) ORDER BY day DESC LIMIT 10", &[&org,&revision,&now.date_naive()]).await?;
            for r in refresh {
                let day: NaiveDate = r.get(1);
                if crate::services::copilot_admission::new_allowed(state.as_ref(), day, now)
                    || corrections.contains(&day)
                {
                    tx.execute("UPDATE team_copilot_daily_jobs SET completed_at=NULL,checkpoint='{}',retry_at=clock_timestamp() WHERE id=$1 AND completed_at IS NOT NULL", &[&r.get::<_,Uuid>(0)]).await?;
                }
            }
            if financial.validate().is_err() {
                continue;
            }
            tx.commit().await?;
        }
        Ok(())
    }
    pub async fn claim(&self) -> Result<Option<DailyJob>> {
        for _ in 0..100 {
            let lease = Uuid::now_v7();
            let row=self.pg.query_opt("UPDATE team_copilot_daily_jobs SET lease_token=$1,lease_until=now()+interval '120 seconds',attempts=attempts+1 WHERE id=(SELECT j.id FROM team_copilot_daily_jobs j JOIN team_copilot_daily_integrations c ON c.organization_id=j.organization_id AND c.revision=j.configuration_revision JOIN team_github_installations i ON i.installation_id=j.installation_id AND i.generation=j.installation_generation JOIN team_rollouts t ON t.organization_id=j.organization_id WHERE c.enabled AND i.status='active' AND t.enabled AND j.completed_at IS NULL AND j.dead_letter_at IS NULL AND j.retry_at<=now() AND (j.lease_until IS NULL OR j.lease_until<now()) ORDER BY j.day DESC,j.retry_at FOR UPDATE OF j SKIP LOCKED LIMIT 1) RETURNING *",&[&lease]).await?;
            let Some(r) = row else { return Ok(None) };
            let installation = r.get("installation_id");
            let i=self.pg.query_one("SELECT account_login,account_id FROM team_github_installations WHERE installation_id=$1",&[&installation]).await?;
            let job = DailyJob {
                id: r.get("id"),
                org: r.get("organization_id"),
                installation,
                generation: r.get("installation_generation"),
                revision: r.get("configuration_revision"),
                day: r.get("day"),
                checkpoint: r.get("checkpoint"),
                login: i.get(0),
                account: i.get(1),
                lease,
            };
            let mut failure = "commercial_admission_paused";
            let allowed = match super::copilot_admission::hint(&self.pg, job.org).await {
                Ok(state) => {
                    crate::services::copilot_admission::new_allowed(
                        state.as_ref(),
                        job.day,
                        Utc::now(),
                    ) || match super::copilot_admission::correction_days(
                        &self.pg,
                        job.org,
                        job.installation,
                        job.account,
                    )
                    .await
                    {
                        Ok(days) => days.contains(&job.day),
                        Err(_) => {
                            failure = "financial_guard_unconfirmed";
                            false
                        }
                    }
                }
                Err(_) => {
                    failure = "financial_guard_unconfirmed";
                    false
                }
            };
            if allowed {
                return Ok(Some(job));
            }
            self.fail(&job, failure, 300, false).await?;
        }
        Ok(None)
    }
    pub async fn fail(&self, j: &DailyJob, code: &str, wait: i64, dead: bool) -> Result<()> {
        self.pg.execute("UPDATE team_copilot_daily_jobs SET error_code=$3,retry_at=now()+$4::bigint*interval '1 second',dead_letter_at=CASE WHEN $5 THEN now() ELSE NULL END,lease_token=NULL,lease_until=NULL WHERE id=$1 AND lease_token=$2",&[&j.id,&j.lease,&code,&wait.max(1),&dead]).await?;
        Ok(())
    }
    pub async fn stage(
        &self,
        j: &DailyJob,
        facts: &[DailyFact],
        checkpoint: &Value,
        invalid: i64,
        reset: bool,
        finished: bool,
    ) -> Result<()> {
        let mut c = self.pg.transaction_client().await?;
        let tx = c.transaction().await?;
        super::team_seats::lock(&tx, j.org).await?;
        let entitlement = super::team_analytics_entitlement::load(&tx, j.org).await?;
        let financial =
            super::team_financial_guard::TransactionProof::capture(j.org, entitlement.as_ref())?;
        let generation: i64 = tx
            .query_one(
                "SELECT generation FROM team_rollouts WHERE organization_id=$1 FOR UPDATE",
                &[&j.org],
            )
            .await?
            .get(0);
        let now: chrono::DateTime<Utc> =
            tx.query_one("SELECT clock_timestamp()", &[]).await?.get(0);
        let allow_new =
            crate::services::copilot_admission::new_allowed(entitlement.as_ref(), j.day, now);
        let receipts =
            super::copilot_admission::existing(&tx, j.org, j.installation, j.account, j.day)
                .await?;
        ensure!(
            allow_new || !receipts.is_empty(),
            "copilot_admission_paused"
        );
        ensure!(
            crate::services::copilot_admission::new_allowed(None, j.day, now),
            "copilot_day_not_closed_or_retention_expired"
        );
        let mut minted = 0;

        let alive=tx.query_opt("SELECT j.lease_until FROM team_copilot_daily_jobs j JOIN team_copilot_daily_integrations c ON c.organization_id=j.organization_id AND c.revision=j.configuration_revision JOIN team_github_installations i ON i.installation_id=j.installation_id AND i.generation=j.installation_generation JOIN team_rollouts t ON t.organization_id=j.organization_id WHERE j.id=$1 AND j.lease_token=$2 AND j.lease_until>clock_timestamp() AND i.account_id=$3 AND i.status='active' AND c.enabled AND t.enabled FOR UPDATE OF j FOR SHARE OF c,i",&[&j.id,&j.lease,&j.account]).await?;
        let lease_deadline: chrono::DateTime<Utc> =
            alive.context("copilot_scope_or_lease_changed")?.get(0);
        if reset {
            tx.execute(
                "DELETE FROM team_copilot_daily_conflicts WHERE job_id=$1",
                &[&j.id],
            )
            .await?;
            tx.execute(
                "DELETE FROM team_copilot_daily_staging WHERE job_id=$1",
                &[&j.id],
            )
            .await?;
            tx.execute(
                "DELETE FROM team_copilot_daily_rejections WHERE job_id=$1",
                &[&j.id],
            )
            .await?;
        }
        let eligible=tx.query("SELECT g.github_user_id FROM team_github_identities g JOIN organization_members m ON m.user_id=g.user_id AND m.organization_id=$1 JOIN users u ON u.id=m.user_id JOIN organization_analytics_consents c ON c.organization_id=m.organization_id AND c.user_id=m.user_id WHERE g.revoked_at IS NULL AND g.verified_at<=($2::date::timestamp AT TIME ZONE 'UTC') AND m.joined_at<=($2::date::timestamp AT TIME ZONE 'UTC') AND m.deactivated_at IS NULL AND m.seat_type='developer' AND m.role<>'viewer' AND u.is_active AND u.deleted_at IS NULL AND c.share_aggregate AND c.aggregate_from<=($2::date::timestamp AT TIME ZONE 'UTC') FOR SHARE OF g,m,c,u",&[&j.org,&j.day]).await?.into_iter().map(|r|r.get::<_,i64>(0)).collect::<std::collections::BTreeSet<_>>();
        for fact in facts {
            if !eligible.contains(&fact.github_user_id) {
                continue;
            }
            if !allow_new && !receipts.contains(&(fact.github_user_id, fact.feature.clone())) {
                tx.execute("INSERT INTO team_copilot_daily_rejections(job_id,reason,record_hash) VALUES($1,'commercial_admission_limited','commercial_admission_limited') ON CONFLICT DO NOTHING", &[&j.id]).await?;
                continue;
            }
            let hash = fact.hash();
            let metadata = serde_json::to_value(&fact.metrics)?;
            let old=tx.query_opt("SELECT payload_hash FROM team_copilot_daily_staging WHERE job_id=$1 AND github_user_id=$2 AND feature=$3",&[&j.id,&fact.github_user_id,&fact.feature]).await?;
            if old.is_some_and(|r| r.get::<_, String>(0) != hash) {
                tx.execute("INSERT INTO team_copilot_daily_rejections(job_id,reason,record_hash) VALUES($1,'conflicting_dimension',$2) ON CONFLICT DO NOTHING",&[&j.id,&hash]).await?;
                tx.execute("INSERT INTO team_copilot_daily_conflicts(job_id,github_user_id,feature) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",&[&j.id,&fact.github_user_id,&fact.feature]).await?;
            } else {
                tx.execute("INSERT INTO team_copilot_daily_staging(job_id,github_user_id,feature,metadata,payload_hash) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING",&[&j.id,&fact.github_user_id,&fact.feature,&metadata,&hash]).await?;
            }
        }
        if invalid > 0 {
            let hash = format!(
                "{}:{}",
                checkpoint["content_hash"].as_str().unwrap_or("unknown"),
                checkpoint["offset"]
            );
            tx.execute("INSERT INTO team_copilot_daily_rejections(job_id,reason,record_hash,rejected_rows) VALUES($1,'unsupported_report_record',$2,$3) ON CONFLICT DO NOTHING",&[&j.id,&hash,&invalid]).await?;
        }
        if finished {
            // Replace only this provider day; no cost allocation or canonical usage involved.
            tx.execute("DELETE FROM team_copilot_daily_facts WHERE organization_id=$1 AND installation_id=$2 AND day=$3",&[&j.org,&j.installation,&j.day]).await?;
            tx.execute("INSERT INTO team_copilot_daily_facts(organization_id,user_id,installation_id,day,feature,metrics,payload_hash,consent_version,consent_from,github_user_id,provider_account_id) SELECT $1,g.user_id,$2,$3,s.feature,s.metadata,s.payload_hash,c.consent_version,c.aggregate_from,g.github_user_id,$5 FROM team_copilot_daily_staging s JOIN team_github_identities g ON g.github_user_id=s.github_user_id AND g.revoked_at IS NULL JOIN organization_members m ON m.user_id=g.user_id AND m.organization_id=$1 JOIN users u ON u.id=m.user_id JOIN organization_analytics_consents c ON c.organization_id=m.organization_id AND c.user_id=m.user_id WHERE s.job_id=$4 AND m.deactivated_at IS NULL AND m.seat_type='developer' AND m.role<>'viewer' AND u.is_active AND u.deleted_at IS NULL AND c.share_aggregate AND c.aggregate_from<=($3::date::timestamp AT TIME ZONE 'UTC') AND g.verified_at<=($3::date::timestamp AT TIME ZONE 'UTC') AND m.joined_at<=($3::date::timestamp AT TIME ZONE 'UTC') AND NOT EXISTS(SELECT 1 FROM team_copilot_daily_conflicts z WHERE z.job_id=s.job_id AND z.github_user_id=s.github_user_id AND z.feature=s.feature) AND NOT EXISTS(SELECT 1 FROM team_webhook_dispositions d WHERE d.provider='copilot_daily' AND d.delivery_id=$1::uuid::text||':'||g.user_id::text||':'||$2::bigint::text||':'||$3::date::text||':'||s.feature) ON CONFLICT DO NOTHING",&[&j.org,&j.installation,&j.day,&j.id,&j.account]).await?;
            if allow_new && entitlement.is_some() {
                minted = super::copilot_admission::mint(
                    &tx,
                    j.org,
                    j.installation,
                    j.day,
                    &financial,
                    generation,
                    now,
                )
                .await?;
            }
            // Completed authoritative replacement may remove an old fact, but never its receipt.
            let removed=tx.execute("DELETE FROM team_copilot_daily_facts f WHERE f.organization_id=$1 AND f.installation_id=$2 AND f.day=$3 AND NOT EXISTS(SELECT 1 FROM team_copilot_admitted_facts a WHERE a.organization_id=f.organization_id AND a.user_id=f.user_id AND a.installation_id=f.installation_id AND a.day=f.day AND a.feature=f.feature)", &[&j.org,&j.installation,&j.day]).await?;
            if removed > 0 {
                tx.execute("INSERT INTO team_copilot_daily_rejections(job_id,reason,record_hash) VALUES($1,'commercial_admission_limited','commercial_admission_limited') ON CONFLICT DO NOTHING", &[&j.id]).await?;
            }
            crate::repository::copilot_reports::commit_day_manifest(&tx, j.org, j.day).await?;
            tx.execute(
                "DELETE FROM team_copilot_daily_staging WHERE job_id=$1",
                &[&j.id],
            )
            .await?;
        }
        tx.execute("UPDATE team_copilot_daily_jobs SET checkpoint=$3,error_code=CASE WHEN EXISTS(SELECT 1 FROM team_copilot_daily_rejections WHERE job_id=$1 AND reason<>'commercial_admission_limited') THEN 'partial_report' WHEN EXISTS(SELECT 1 FROM team_copilot_daily_rejections WHERE job_id=$1) THEN 'commercial_admission_limited' ELSE NULL END,dead_letter_at=CASE WHEN $4 AND EXISTS(SELECT 1 FROM team_copilot_daily_rejections WHERE job_id=$1 AND reason<>'commercial_admission_limited') THEN now() ELSE NULL END,completed_at=CASE WHEN $4 THEN now() ELSE NULL END,last_success_at=CASE WHEN $4 THEN now() ELSE last_success_at END,lease_token=NULL,lease_until=NULL,retry_at=now() WHERE id=$1 AND lease_token=$2",&[&j.id,&j.lease,&checkpoint,&finished]).await?;
        financial.validate()?;
        let final_now: chrono::DateTime<Utc> =
            tx.query_one("SELECT clock_timestamp()", &[]).await?.get(0);
        ensure!(
            minted == 0
                || crate::services::copilot_admission::new_allowed(
                    entitlement.as_ref(),
                    j.day,
                    final_now
                ),
            "copilot_admission_expired_during_commit"
        );
        // The deadline was captured before releasing the lease; transaction-start now() is insufficient.
        ensure!(
            final_now < lease_deadline,
            "copilot_lease_expired_during_commit"
        );
        tx.commit().await?;
        Ok(())
    }
    pub async fn read_fence(&self, org: Uuid, user: Uuid) -> Result<String> {
        let financial = super::team_financial_guard::fence(&self.pg, org).await?;
        let mut db = self.pg.transaction_client().await?;
        let tx = db.transaction().await?;
        let row=tx.query_one("SELECT jsonb_build_object('config',(SELECT to_jsonb(c) FROM team_copilot_daily_integrations c WHERE c.organization_id=$1),'installation',(SELECT to_jsonb(i)-'lease_token'-'lease_until'-'updated_at' FROM team_github_installations i JOIN team_copilot_daily_integrations c USING(installation_id,organization_id) WHERE i.organization_id=$1),'identity',(SELECT jsonb_build_object('id',g.github_user_id,'verified_at',g.verified_at,'revoked_at',g.revoked_at) FROM team_github_identities g WHERE g.user_id=$2),'rollout',(SELECT jsonb_build_object('enabled',enabled,'generation',generation) FROM team_rollouts WHERE organization_id=$1),'sources',COALESCE((SELECT jsonb_agg(jsonb_build_object('day',day,'revision',revision,'hash',fingerprint) ORDER BY day) FROM team_copilot_day_manifests WHERE organization_id=$1),'[]'::jsonb))",&[&org,&user]).await?.get::<_,Value>(0);
        super::team_financial_guard::validate_fence(&self.pg, org, &financial).await?;
        Ok(format!(
            "{:x}",
            sha2::Sha256::digest(serde_json::to_vec(&(
                financial,
                row,
                super::copilot_admission::fence(&tx, org).await?
            ))?)
        ))
    }
    pub async fn self_day(&self, org: Uuid, user: Uuid, day: NaiveDate) -> Result<Value> {
        let financial = super::team_financial_guard::fence(&self.pg, org).await?;
        let rows=self.pg.query("SELECT f.feature,f.metrics,f.observed_at FROM team_copilot_admitted_facts f JOIN team_copilot_daily_integrations q ON q.organization_id=f.organization_id AND q.installation_id=f.installation_id JOIN team_github_installations i ON i.installation_id=f.installation_id AND i.organization_id=f.organization_id JOIN team_github_identities g ON g.user_id=f.user_id JOIN organization_analytics_consents c ON c.organization_id=f.organization_id AND c.user_id=f.user_id JOIN organization_members m ON m.organization_id=f.organization_id AND m.user_id=f.user_id JOIN users u ON u.id=m.user_id JOIN team_rollouts t ON t.organization_id=f.organization_id WHERE t.enabled AND f.organization_id=$1 AND f.user_id=$2 AND f.day=$3 AND NOT f.blocked AND q.enabled AND i.status='active' AND f.provider_account_id=i.account_id AND f.github_user_id=g.github_user_id AND g.revoked_at IS NULL AND m.seat_type='developer' AND m.role<>'viewer' AND c.share_individual AND c.share_aggregate AND c.consent_version=f.consent_version AND c.aggregate_from=f.consent_from AND c.individual_from<=($3::date::timestamp AT TIME ZONE 'UTC') AND m.deactivated_at IS NULL AND u.is_active AND u.deleted_at IS NULL AND f.day::timestamp AT TIME ZONE 'UTC'>=now()-interval '12 months' ORDER BY f.feature LIMIT 64",&[&org,&user,&day]).await?;
        let mut features = Vec::new();
        for r in rows {
            features.push(json!({"feature":r.get::<_,String>(0),"counters":r.get::<_,Value>(1),"observed_at":r.get::<_,chrono::DateTime<Utc>>(2)}));
        }
        super::team_financial_guard::validate_fence(&self.pg, org, &financial).await?;
        Ok(
            json!({"day":day,"timezone":"UTC","granularity":"provider_user_day_feature","features":features,"coverage":if features.is_empty(){"unavailable"}else{"partial"},"provenance":"github_copilot_users_1_day","calculation_version":"copilot-daily-v1","tokens":null,"model":null,"estimated_cost":null,"not_allocated_to_sessions_or_prs":true}),
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        config::PostgresConfig,
        repository::team_trust::{Registry, TeamTrustRepository},
    };
    #[tokio::test]
    #[ignore = "requires isolated POSTGRES_TEST_URL"]
    async fn copilot_daily_durable_mixed_report_consent_retry_and_restore() {
        let url = std::env::var("POSTGRES_TEST_URL").unwrap();
        assert_eq!(
            url.parse::<tokio_postgres::Config>().unwrap().get_dbname(),
            Some("atoaxis_team_test")
        );
        let pg = Arc::new(
            PostgresClient::connect(&PostgresConfig {
                url: Some(url),
                max_connections: 8,
            })
            .await
            .unwrap(),
        );
        pg.migrate().await.unwrap();
        pg.migrate().await.unwrap();
        pg.execute("UPDATE team_copilot_daily_integrations SET enabled=false WHERE organization_id IN(SELECT id FROM organizations WHERE name='synthetic Copilot daily')",&[]).await.unwrap();
        let org = Uuid::now_v7();
        let owner = Uuid::now_v7();
        let outsider = Uuid::now_v7();
        let installation = (Uuid::new_v4().as_u128() & 0x7fffffffffffffffu128) as i64;
        for user in [owner, outsider] {
            pg.execute(
                "INSERT INTO users(id,username) VALUES($1,$2)",
                &[&user, &user.to_string()],
            )
            .await
            .unwrap();
        }
        pg.execute(
            "INSERT INTO organizations(id,slug,name) VALUES($1,$2,'synthetic Copilot daily')",
            &[&org, &org.to_string()],
        )
        .await
        .unwrap();
        pg.execute("INSERT INTO organization_members(organization_id,user_id,role,seat_type,joined_at) VALUES($1,$2,'owner','developer',now()-interval '10 days')",&[&org,&owner]).await.unwrap();
        pg.execute("INSERT INTO team_rollouts(organization_id,enabled) VALUES($1,true) ON CONFLICT(organization_id) DO UPDATE SET enabled=true",&[&org]).await.unwrap();
        pg.execute("INSERT INTO organization_analytics_consents(organization_id,user_id,share_aggregate,share_individual) VALUES($1,$2,true,true)",&[&org,&owner]).await.unwrap();
        pg.execute("INSERT INTO team_github_installations(installation_id,organization_id,account_id,account_login,status) VALUES($1,$2,7,'synthetic','active')",&[&installation,&org]).await.unwrap();
        pg.execute("INSERT INTO team_github_identities(user_id,github_user_id,login,verified_at) VALUES($1,$2,'synthetic',now()-interval '10 days')",&[&owner,&installation]).await.unwrap();
        let repo = CopilotDailyRepository::new(pg.clone());
        let day = Utc::now().date_naive() - chrono::Duration::days(1);
        assert!(repo
            .configure(outsider, org, installation, day, true, 0)
            .await
            .is_err());
        repo.configure(owner, org, installation, day, true, 0)
            .await
            .unwrap();
        assert!(repo
            .configure(owner, org, installation, day, true, 0)
            .await
            .is_err());
        repo.schedule().await.unwrap();
        let j = repo.claim().await.unwrap().unwrap();
        assert_eq!(j.org, org);
        assert!(repo.claim().await.unwrap().is_none());
        let fact = DailyFact {
            github_user_id: installation,
            feature: "code_completion".into(),
            metrics: [("loc_added_sum".into(), Some(8))].into_iter().collect(),
        };
        let checkpoint = json!({"content_hash":"fixture","offset":100});
        // Consent granted today must never permit yesterday's report, even staging.
        repo.stage(&j, std::slice::from_ref(&fact), &checkpoint, 0, true, true)
            .await
            .unwrap();
        assert!(repo.self_day(org, owner, day).await.unwrap()["features"]
            .as_array()
            .unwrap()
            .is_empty());
        assert_eq!(
            pg.query_one(
                "SELECT count(*) FROM team_copilot_daily_staging WHERE job_id=$1",
                &[&j.id]
            )
            .await
            .unwrap()
            .get::<_, i64>(0),
            0
        );
        // Synthetic past consent belongs only to this fixture transaction; no global trigger disable.
        let mut c = pg.transaction_client().await.unwrap();
        let tx = c.transaction().await.unwrap();
        tx.batch_execute("SET LOCAL session_replication_role=replica")
            .await
            .unwrap();
        tx.execute("UPDATE organization_analytics_consents SET aggregate_from=now()-interval '10 days',individual_from=now()-interval '10 days' WHERE organization_id=$1 AND user_id=$2",&[&org,&owner]).await.unwrap();
        tx.commit().await.unwrap();
        repo.configure(owner, org, installation, day, true, 1)
            .await
            .unwrap();
        repo.schedule().await.unwrap();
        let j = repo.claim().await.unwrap().unwrap();
        repo.stage(&j, std::slice::from_ref(&fact), &checkpoint, 0, true, false)
            .await
            .unwrap();
        // Lost response / process restart reuses original IDs and unchanged report hash.
        let mut j = repo.claim().await.unwrap().unwrap();
        repo.stage(&j, std::slice::from_ref(&fact), &checkpoint, 1, false, true)
            .await
            .unwrap();
        let result = repo.self_day(org, owner, day).await.unwrap();
        assert_eq!(result["features"].as_array().unwrap().len(), 1);
        assert_eq!(result["features"][0]["counters"]["loc_added_sum"], 8);
        assert!(repo.self_day(org, outsider, day).await.unwrap()["features"]
            .as_array()
            .unwrap()
            .is_empty());
        assert_eq!(
            pg.query_one(
                "SELECT count(*) FROM team_copilot_daily_facts WHERE organization_id=$1",
                &[&org]
            )
            .await
            .unwrap()
            .get::<_, i64>(0),
            1
        );
        let fence = repo.read_fence(org, owner).await.unwrap();
        pg.execute(
            "UPDATE team_github_identities SET revoked_at=now() WHERE user_id=$1",
            &[&owner],
        )
        .await
        .unwrap();
        assert_ne!(repo.read_fence(org, owner).await.unwrap(), fence);
        assert!(repo.self_day(org, owner, day).await.unwrap()["features"]
            .as_array()
            .unwrap()
            .is_empty());
        pg.execute(
            "UPDATE team_github_identities SET revoked_at=NULL WHERE user_id=$1",
            &[&owner],
        )
        .await
        .unwrap();
        repo.configure(owner, org, installation, day, true, 2)
            .await
            .unwrap();
        repo.schedule().await.unwrap();
        j = repo.claim().await.unwrap().unwrap();
        let mut conflict = fact.clone();
        conflict.metrics.insert("loc_added_sum".into(), Some(9));
        let good = DailyFact {
            feature: "agent_edit".into(),
            ..fact.clone()
        };
        repo.stage(
            &j,
            &[fact.clone(), conflict, good],
            &checkpoint,
            0,
            true,
            true,
        )
        .await
        .unwrap();
        let result = repo.self_day(org, owner, day).await.unwrap();
        assert_eq!(result["features"].as_array().unwrap().len(), 1);
        assert_eq!(result["features"][0]["feature"], "agent_edit");
        // Retry-After is preserved in the persisted job; scope and lease remain isolated.
        repo.configure(owner, org, installation, day, true, 3)
            .await
            .unwrap();
        repo.schedule().await.unwrap();
        let j = repo.claim().await.unwrap().unwrap();
        repo.fail(&j, "rate_limited", 7200, false).await.unwrap();
        assert!(repo.claim().await.unwrap().is_none());
        let wait=pg.query_one("SELECT EXTRACT(epoch FROM retry_at-now())::bigint FROM team_copilot_daily_jobs WHERE id=$1",&[&j.id]).await.unwrap().get::<_,i64>(0);
        assert!((7190..=7200).contains(&wait));
        // Commercial enrollment cannot silently grandfather legacy provider facts.
        let enrollment_fence = repo.read_fence(org, owner).await.unwrap();
        let mut entitlement = crate::services::team_analytics_entitlement::State::trial(
            10,
            day.and_hms_opt(0, 0, 0).unwrap().and_utc(),
        )
        .unwrap();
        pg.execute("INSERT INTO team_analytics_entitlements(organization_id,revision,state,created_at,updated_at) VALUES($1,$2,$3,clock_timestamp(),clock_timestamp())", &[&org,&entitlement.revision,&serde_json::to_value(&entitlement).unwrap()]).await.unwrap();
        assert!(
            repo.read_fence(org, owner).await.is_err(),
            "enrolled reads require independent proof"
        );
        let financial =
            crate::infrastructure::team_financial_guard::TestLedger::enrolled(org, &entitlement);
        let _financial_environment = financial.environment();
        assert_ne!(enrollment_fence, repo.read_fence(org, owner).await.unwrap());
        assert_eq!(
            repo.self_day(org, owner, day).await.unwrap()["features"],
            json!([])
        );
        repo.configure(owner, org, installation, day, true, 4)
            .await
            .unwrap();
        repo.schedule().await.unwrap();
        let j = repo.claim().await.unwrap().unwrap();
        let admitted = DailyFact {
            feature: "agent_edit".into(),
            ..fact.clone()
        };
        repo.stage(
            &j,
            std::slice::from_ref(&admitted),
            &checkpoint,
            0,
            true,
            false,
        )
        .await
        .unwrap();
        assert_eq!(
            pg.query_one(
                "SELECT count(*) FROM team_copilot_admissions WHERE organization_id=$1",
                &[&org]
            )
            .await
            .unwrap()
            .get::<_, i64>(0),
            0,
            "intermediate report is not admission"
        );
        let j = repo.claim().await.unwrap().unwrap();
        // A DB lock may outlive either the commercial deadline or worker lease.
        // Failed completion rolls back facts, proof, manifest and checkpoint together.
        for failure in ["commercial", "lease", "financial"] {
            let expire_commercial = failure == "commercial";
            let deadline = Utc::now() + chrono::Duration::seconds(2);
            let mut short = entitlement.clone();
            if expire_commercial {
                short.windows[0].end = deadline;
            }
            super::super::team_financial_guard::set_test_state(&pg, &financial, org, &mut short)
                .await;
            let lease_deadline = if failure != "lease" {
                Utc::now() + chrono::Duration::seconds(120)
            } else {
                deadline
            };
            pg.execute(
                "UPDATE team_copilot_daily_jobs SET lease_until=$2 WHERE id=$1",
                &[&j.id, &lease_deadline],
            )
            .await
            .unwrap();
            let before: Value = pg
                .query_one(
                    "SELECT to_jsonb(j) FROM team_copilot_daily_jobs j WHERE id=$1",
                    &[&j.id],
                )
                .await
                .unwrap()
                .get(0);
            let mut lock_db = pg.transaction_client().await.unwrap();
            let lock_tx = lock_db.transaction().await.unwrap();
            lock_tx
                .batch_execute("LOCK TABLE team_copilot_daily_facts IN SHARE MODE")
                .await
                .unwrap();
            let worker = CopilotDailyRepository::new(pg.clone());
            let work = j.clone();
            let sample = admitted.clone();
            let progress = checkpoint.clone();
            let pending = tokio::spawn(async move {
                worker
                    .stage(&work, &[sample], &progress, 0, false, true)
                    .await
            });
            let mut blocked = false;
            for _ in 0..100 {
                let n:i64=pg.query_one("SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE 'DELETE FROM team_copilot_daily_facts WHERE organization_id=%'", &[]).await.unwrap().get(0);
                if n > 0 {
                    blocked = true;
                    break;
                }
                tokio::time::sleep(std::time::Duration::from_millis(10)).await;
            }
            assert!(
                blocked,
                "completion must reach the fact replacement lock before its deadline"
            );
            let proposed = if failure == "financial" {
                let mut state = short.clone();
                state.revision += 1;
                let id = Uuid::now_v7();
                financial
                    .guard
                    .prepare(
                        org,
                        crate::services::team_financial_guard::Head::Enrolled {
                            state: Box::new(short.clone()),
                        },
                        crate::services::team_financial_guard::Pending {
                            transition_id: id,
                            state: Box::new(state.clone()),
                        },
                    )
                    .unwrap();
                Some((id, state))
            } else {
                let remaining = (deadline - Utc::now()).to_std().unwrap_or_default();
                tokio::time::sleep(remaining + std::time::Duration::from_millis(30)).await;
                None
            };
            lock_tx.commit().await.unwrap();
            let error = pending.await.unwrap().unwrap_err().to_string();
            assert_eq!(
                error,
                if failure == "financial" {
                    "financial_guard_reconciliation_required"
                } else if expire_commercial {
                    "copilot_admission_expired_during_commit"
                } else {
                    "copilot_lease_expired_during_commit"
                }
            );
            assert_eq!(
                pg.query_one(
                    "SELECT count(*) FROM team_copilot_admissions WHERE organization_id=$1",
                    &[&org]
                )
                .await
                .unwrap()
                .get::<_, i64>(0),
                0
            );
            assert_eq!(
                pg.query_one(
                    "SELECT to_jsonb(j) FROM team_copilot_daily_jobs j WHERE id=$1",
                    &[&j.id]
                )
                .await
                .unwrap()
                .get::<_, Value>(0),
                before,
                "failed final fence must roll back checkpoint and lease release"
            );
            if let Some((id, state)) = proposed {
                // Explicit synthetic resolution after the worker rolled back.
                pg.execute("UPDATE team_analytics_entitlements SET revision=$2,state=$3 WHERE organization_id=$1", &[&org,&state.revision,&serde_json::to_value(&state).unwrap()]).await.unwrap();
                financial.guard.confirm_committed(org, id, &state).unwrap();
            }
        }
        super::super::team_financial_guard::set_test_state(&pg, &financial, org, &mut entitlement)
            .await;
        pg.execute("UPDATE team_copilot_daily_jobs SET lease_until=clock_timestamp()+interval '120 seconds' WHERE id=$1", &[&j.id]).await.unwrap();
        repo.stage(
            &j,
            std::slice::from_ref(&admitted),
            &checkpoint,
            0,
            false,
            true,
        )
        .await
        .unwrap();
        assert_eq!(
            pg.query_one(
                "SELECT count(*) FROM team_copilot_admissions WHERE organization_id=$1",
                &[&org]
            )
            .await
            .unwrap()
            .get::<_, i64>(0),
            1
        );
        assert!(
            repo.stage(
                &j,
                std::slice::from_ref(&admitted),
                &checkpoint,
                0,
                false,
                true
            )
            .await
            .is_err(),
            "lost response cannot reuse released lease"
        );
        let receipt = pg
            .query_one(
                "SELECT to_jsonb(a) FROM team_copilot_admissions a WHERE organization_id=$1",
                &[&org],
            )
            .await
            .unwrap()
            .get::<_, Value>(0);
        let mut correction = admitted.clone();
        correction.metrics.insert("loc_added_sum".into(), Some(17));
        // Expiry keeps exact admitted corrections, but rejects new feature identities.
        entitlement.windows[0].end = Utc::now() - chrono::Duration::milliseconds(1);
        super::super::team_financial_guard::set_test_state(&pg, &financial, org, &mut entitlement)
            .await;
        repo.configure(owner, org, installation, day, true, 5)
            .await
            .unwrap();
        repo.schedule().await.unwrap();
        let j = repo.claim().await.unwrap().unwrap();
        repo.stage(
            &j,
            &[correction.clone(), fact.clone()],
            &checkpoint,
            0,
            true,
            true,
        )
        .await
        .unwrap();
        let result = repo.self_day(org, owner, day).await.unwrap();
        assert_eq!(result["features"].as_array().unwrap().len(), 1);
        assert_eq!(result["features"][0]["counters"]["loc_added_sum"], 17);
        assert_eq!(
            pg.query_one(
                "SELECT to_jsonb(a) FROM team_copilot_admissions a WHERE organization_id=$1",
                &[&org]
            )
            .await
            .unwrap()
            .get::<_, Value>(0),
            receipt,
            "provider correction never rewrites commercial proof"
        );
        assert_eq!(pg.query_one("SELECT disposition FROM team_copilot_day_manifests WHERE organization_id=$1 AND day=$2", &[&org,&day]).await.unwrap().get::<_,String>(0),"partial");
        // An authoritative empty correction removes mutable facts, not durable proof.
        repo.configure(owner, org, installation, day, true, 6)
            .await
            .unwrap();
        repo.schedule().await.unwrap();
        let j = repo.claim().await.unwrap().unwrap();
        repo.stage(&j, &[], &checkpoint, 0, true, true)
            .await
            .unwrap();
        assert_eq!(
            repo.self_day(org, owner, day).await.unwrap()["features"],
            json!([])
        );
        repo.configure(owner, org, installation, day, true, 7)
            .await
            .unwrap();
        repo.schedule().await.unwrap();
        let j = repo.claim().await.unwrap().unwrap();
        repo.stage(
            &j,
            std::slice::from_ref(&correction),
            &checkpoint,
            0,
            true,
            true,
        )
        .await
        .unwrap();
        assert_eq!(
            repo.self_day(org, owner, day).await.unwrap()["features"][0]["counters"]
                ["loc_added_sum"],
            17
        );
        // Temporary provider suspension withholds reads but must not tombstone history.
        pg.execute(
            "UPDATE team_github_installations SET status='suspended' WHERE installation_id=$1",
            &[&installation],
        )
        .await
        .unwrap();
        assert_eq!(
            repo.self_day(org, owner, day).await.unwrap()["features"],
            json!([])
        );
        let mut db = pg.transaction_client().await.unwrap();
        let tx = db.transaction().await.unwrap();
        assert_eq!(
            super::super::copilot_admission::cleanup(
                &tx,
                org,
                crate::services::team_trust::cutoff(Utc::now()),
                Utc::now()
            )
            .await
            .unwrap(),
            0
        );
        tx.commit().await.unwrap();
        pg.execute(
            "UPDATE team_github_installations SET status='active' WHERE installation_id=$1",
            &[&installation],
        )
        .await
        .unwrap();
        assert_eq!(
            repo.self_day(org, owner, day).await.unwrap()["features"][0]["counters"]
                ["loc_added_sum"],
            17
        );
        // Exact identity, not account labels or recycled feature slots, governs history.
        pg.execute(
            "UPDATE team_github_identities SET github_user_id=$2 WHERE user_id=$1",
            &[&owner, &(installation - 1)],
        )
        .await
        .unwrap();
        assert_eq!(
            repo.self_day(org, owner, day).await.unwrap()["features"],
            json!([])
        );
        pg.execute(
            "UPDATE team_github_identities SET github_user_id=$2 WHERE user_id=$1",
            &[&owner, &installation],
        )
        .await
        .unwrap();
        // Revocation blocks reads before cleanup; cleanup writes independent dispositions.
        pg.execute("UPDATE organization_analytics_consents SET share_aggregate=false,share_individual=false WHERE organization_id=$1 AND user_id=$2",&[&org,&owner]).await.unwrap();
        assert!(repo.self_day(org, owner, day).await.unwrap()["features"]
            .as_array()
            .unwrap()
            .is_empty());
        let trust = TeamTrustRepository::new(pg.clone());
        pg.execute("INSERT INTO team_cleanup_jobs(organization_id,phase,retry_at) VALUES($1,12,now()) ON CONFLICT(organization_id) DO UPDATE SET phase=12,completed_at=NULL,retry_at=now()",&[&org]).await.unwrap();
        for _ in 0..200 {
            trust.cleanup_tick(Utc::now()).await.unwrap();
            if pg
                .query_one(
                    "SELECT count(*) FROM team_copilot_daily_facts WHERE organization_id=$1",
                    &[&org],
                )
                .await
                .unwrap()
                .get::<_, i64>(0)
                == 0
            {
                break;
            }
        }
        assert_eq!(
            pg.query_one(
                "SELECT count(*) FROM team_copilot_daily_facts WHERE organization_id=$1",
                &[&org]
            )
            .await
            .unwrap()
            .get::<_, i64>(0),
            0
        );
        assert!(pg.query_one("SELECT count(*) FROM team_webhook_dispositions WHERE provider='copilot_daily' AND delivery_id LIKE $1",&[&format!("{org}:%")]).await.unwrap().get::<_,i64>(0)>0);
        let mut db = pg.transaction_client().await.unwrap();
        let tx = db.transaction().await.unwrap();
        assert_eq!(
            super::super::copilot_admission::cleanup(
                &tx,
                org,
                crate::services::team_trust::cutoff(Utc::now()),
                Utc::now()
            )
            .await
            .unwrap(),
            1
        );
        tx.commit().await.unwrap();
        assert_eq!(
            pg.query_one(
                "SELECT count(*) FROM team_copilot_admissions WHERE organization_id=$1",
                &[&org]
            )
            .await
            .unwrap()
            .get::<_, i64>(0),
            0
        );
        // Scheduling is also fenced. A pending independent transition cannot
        // create work; an explicit resolution can, without provider/DB shortcuts.
        entitlement
            .windows
            .push(crate::services::team_analytics_entitlement::Window {
                kind: crate::services::team_analytics_entitlement::Kind::Paid,
                start: Utc::now(),
                end: Utc::now() + chrono::Duration::days(1),
            });
        super::super::team_financial_guard::set_test_state(&pg, &financial, org, &mut entitlement)
            .await;
        let revision: i64 = pg
            .query_one(
                "SELECT revision FROM team_copilot_daily_integrations WHERE organization_id=$1",
                &[&org],
            )
            .await
            .unwrap()
            .get(0);
        repo.configure(owner, org, installation, day, true, revision)
            .await
            .unwrap();
        let mut proposed = entitlement.clone();
        proposed.revision += 1;
        let id = Uuid::now_v7();
        financial
            .guard
            .prepare(
                org,
                crate::services::team_financial_guard::Head::Enrolled {
                    state: Box::new(entitlement.clone()),
                },
                crate::services::team_financial_guard::Pending {
                    transition_id: id,
                    state: Box::new(proposed.clone()),
                },
            )
            .unwrap();
        repo.schedule().await.unwrap();
        assert_eq!(pg.query_one("SELECT count(*) FROM team_copilot_daily_jobs WHERE organization_id=$1 AND configuration_revision=$2", &[&org,&(revision+1)]).await.unwrap().get::<_,i64>(0), 0);
        pg.execute(
            "UPDATE team_analytics_entitlements SET revision=$2,state=$3 WHERE organization_id=$1",
            &[
                &org,
                &proposed.revision,
                &serde_json::to_value(&proposed).unwrap(),
            ],
        )
        .await
        .unwrap();
        financial
            .guard
            .confirm_committed(org, id, &proposed)
            .unwrap();
        repo.schedule().await.unwrap();
        let work = repo.claim().await.unwrap().unwrap();
        financial.guard.quarantine(org).unwrap();
        assert!(repo
            .stage(
                &work,
                std::slice::from_ref(&fact),
                &checkpoint,
                0,
                true,
                true
            )
            .await
            .unwrap_err()
            .to_string()
            .starts_with("financial_guard_"));
        assert_eq!(
            pg.query_one(
                "SELECT count(*) FROM team_copilot_daily_facts WHERE organization_id=$1",
                &[&org]
            )
            .await
            .unwrap()
            .get::<_, i64>(0),
            0
        );
        pg.execute("UPDATE team_copilot_daily_jobs SET lease_until=clock_timestamp()-interval '1 second' WHERE id=$1", &[&work.id]).await.unwrap();
        assert!(repo.claim().await.unwrap().is_none());
        assert_eq!(
            pg.query_one(
                "SELECT error_code FROM team_copilot_daily_jobs WHERE id=$1",
                &[&work.id]
            )
            .await
            .unwrap()
            .get::<_, Option<String>>(0)
            .as_deref(),
            Some("financial_guard_unconfirmed")
        );
        let ledger = Registry {
            schema_version: 1,
            checked_at: Utc::now(),
            organizations: [(org, trust.registry_entry(org).await.unwrap())]
                .into_iter()
                .collect(),
            dispositions: Vec::new(),
        };
        trust.reconcile_restore(&ledger).await.unwrap();
        assert!(!pg
            .query_one(
                "SELECT enabled FROM team_copilot_daily_integrations WHERE organization_id=$1",
                &[&org]
            )
            .await
            .unwrap()
            .get::<_, bool>(0));
        assert!(repo.claim().await.unwrap().is_none());
        pg.execute("DELETE FROM organizations WHERE id=$1", &[&org])
            .await
            .unwrap();
        for user in [owner, outsider] {
            pg.execute("DELETE FROM users WHERE id=$1", &[&user])
                .await
                .unwrap();
        }
    }
    #[tokio::test]
    #[ignore = "requires isolated POSTGRES_TEST_URL"]
    async fn copilot_scheduler_rotates_beyond_one_hundred_organizations() {
        let url = std::env::var("POSTGRES_TEST_URL").unwrap();
        assert_eq!(
            url.parse::<tokio_postgres::Config>().unwrap().get_dbname(),
            Some("atoaxis_team_test")
        );
        let pg = Arc::new(
            PostgresClient::connect(&PostgresConfig {
                url: Some(url),
                max_connections: 8,
            })
            .await
            .unwrap(),
        );
        pg.migrate().await.unwrap();
        let mut organizations = Vec::new();
        let day = Utc::now().date_naive() - chrono::Duration::days(1);
        for _ in 0..101 {
            let org = Uuid::now_v7();
            let installation = (Uuid::new_v4().as_u128() & 0x7fffffffffffffff) as i64;
            pg.execute("INSERT INTO organizations(id,slug,name) VALUES($1,$2,'synthetic Copilot scheduling')", &[&org,&org.to_string()]).await.unwrap();
            pg.execute(
                "INSERT INTO team_rollouts(organization_id,enabled) VALUES($1,true) ON CONFLICT(organization_id) DO UPDATE SET enabled=true",
                &[&org],
            )
            .await
            .unwrap();
            pg.execute("INSERT INTO team_github_installations(installation_id,organization_id,account_id,account_login,status) VALUES($1,$2,$1,'synthetic','active')", &[&installation,&org]).await.unwrap();
            pg.execute("INSERT INTO team_copilot_daily_integrations(organization_id,installation_id,start_day,enabled) VALUES($1,$2,$3,true)", &[&org,&installation,&day]).await.unwrap();
            organizations.push(org);
        }
        let repo = CopilotDailyRepository::new(pg.clone());
        // Existing fixture organizations may occupy a partial page; bounded rotations
        // must still reach every new scope, independent of UUID ordering.
        for _ in 0..5 {
            repo.schedule().await.unwrap();
        }
        assert_eq!(pg.query_one("SELECT count(DISTINCT organization_id) FROM team_copilot_daily_jobs WHERE organization_id=ANY($1)", &[&organizations]).await.unwrap().get::<_,i64>(0),101);
        pg.execute(
            "DELETE FROM organizations WHERE id=ANY($1)",
            &[&organizations],
        )
        .await
        .unwrap();
    }
}
