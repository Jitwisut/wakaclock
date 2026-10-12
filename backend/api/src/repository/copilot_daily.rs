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
        } else if error.as_deref() == Some("auth_required") {
            "auth_required"
        } else if error.as_deref() == Some("permission_required") {
            "permission_required"
        } else if error.as_deref() == Some("rate_limited") {
            "rate_limited"
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
        // At most 100 jobs per pass. Closed provider UTC days, no invented local session timestamps.
        self.pg.execute("INSERT INTO team_copilot_daily_jobs(id,organization_id,installation_id,installation_generation,configuration_revision,day) SELECT gen_random_uuid(),c.organization_id,c.installation_id,i.generation,c.revision,d::date FROM team_copilot_daily_integrations c JOIN team_github_installations i USING(installation_id,organization_id) JOIN team_rollouts t USING(organization_id) CROSS JOIN LATERAL generate_series(GREATEST(c.start_day,((now()-interval '12 months') AT TIME ZONE 'UTC')::date),(now() AT TIME ZONE 'UTC')::date-1,interval '1 day') d WHERE c.enabled AND t.enabled AND i.status='active' AND NOT EXISTS(SELECT 1 FROM team_copilot_daily_jobs j WHERE j.organization_id=c.organization_id AND j.day=d::date AND j.configuration_revision=c.revision) ORDER BY d DESC LIMIT 100 ON CONFLICT DO NOTHING",&[]).await?;
        // Refresh recent provider reports without adding duplicate facts; corrections replace the day.
        self.pg.execute("UPDATE team_copilot_daily_jobs j SET completed_at=NULL,checkpoint='{}',retry_at=now() WHERE id IN(SELECT j.id FROM team_copilot_daily_jobs j JOIN team_copilot_daily_integrations c ON c.organization_id=j.organization_id AND c.revision=j.configuration_revision JOIN team_github_installations i ON i.installation_id=j.installation_id AND i.generation=j.installation_generation WHERE c.enabled AND i.status='active' AND j.completed_at<now()-interval '1 hour' AND j.error_code IS NULL AND j.day>=(now() AT TIME ZONE 'UTC')::date-3 LIMIT 10)",&[]).await?;
        Ok(())
    }
    pub async fn claim(&self) -> Result<Option<DailyJob>> {
        let lease = Uuid::now_v7();
        let row=self.pg.query_opt("UPDATE team_copilot_daily_jobs SET lease_token=$1,lease_until=now()+interval '120 seconds',attempts=attempts+1 WHERE id=(SELECT j.id FROM team_copilot_daily_jobs j JOIN team_copilot_daily_integrations c ON c.organization_id=j.organization_id AND c.revision=j.configuration_revision JOIN team_github_installations i ON i.installation_id=j.installation_id AND i.generation=j.installation_generation JOIN team_rollouts t ON t.organization_id=j.organization_id WHERE c.enabled AND i.status='active' AND t.enabled AND j.completed_at IS NULL AND j.dead_letter_at IS NULL AND j.retry_at<=now() AND (j.lease_until IS NULL OR j.lease_until<now()) ORDER BY j.day DESC,j.retry_at FOR UPDATE OF j SKIP LOCKED LIMIT 1) RETURNING *",&[&lease]).await?;
        let Some(r) = row else { return Ok(None) };
        let installation = r.get("installation_id");
        let i=self.pg.query_one("SELECT account_login,account_id FROM team_github_installations WHERE installation_id=$1",&[&installation]).await?;
        Ok(Some(DailyJob {
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
        }))
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
        let alive=tx.query_opt("SELECT j.id FROM team_copilot_daily_jobs j JOIN team_copilot_daily_integrations c ON c.organization_id=j.organization_id AND c.revision=j.configuration_revision JOIN team_github_installations i ON i.installation_id=j.installation_id AND i.generation=j.installation_generation JOIN team_rollouts t ON t.organization_id=j.organization_id WHERE j.id=$1 AND j.lease_token=$2 AND j.lease_until>now() AND i.status='active' AND c.enabled AND t.enabled FOR UPDATE OF j FOR SHARE OF c,i,t",&[&j.id,&j.lease]).await?;
        ensure!(alive.is_some(), "copilot_scope_or_lease_changed");
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
            tx.execute("INSERT INTO team_copilot_daily_facts(organization_id,user_id,installation_id,day,feature,metrics,payload_hash,consent_version,consent_from) SELECT $1,g.user_id,$2,$3,s.feature,s.metadata,s.payload_hash,c.consent_version,c.aggregate_from FROM team_copilot_daily_staging s JOIN team_github_identities g ON g.github_user_id=s.github_user_id AND g.revoked_at IS NULL JOIN organization_members m ON m.user_id=g.user_id AND m.organization_id=$1 JOIN users u ON u.id=m.user_id JOIN organization_analytics_consents c ON c.organization_id=m.organization_id AND c.user_id=m.user_id WHERE s.job_id=$4 AND m.deactivated_at IS NULL AND m.seat_type='developer' AND m.role<>'viewer' AND u.is_active AND u.deleted_at IS NULL AND c.share_aggregate AND c.aggregate_from<=($3::date::timestamp AT TIME ZONE 'UTC') AND g.verified_at<=($3::date::timestamp AT TIME ZONE 'UTC') AND m.joined_at<=($3::date::timestamp AT TIME ZONE 'UTC') AND NOT EXISTS(SELECT 1 FROM team_copilot_daily_conflicts z WHERE z.job_id=s.job_id AND z.github_user_id=s.github_user_id AND z.feature=s.feature) AND NOT EXISTS(SELECT 1 FROM team_webhook_dispositions d WHERE d.provider='copilot_daily' AND d.delivery_id=$1::uuid::text||':'||g.user_id::text||':'||$2::bigint::text||':'||$3::date::text||':'||s.feature) ON CONFLICT DO NOTHING",&[&j.org,&j.installation,&j.day,&j.id]).await?;
            tx.execute(
                "DELETE FROM team_copilot_daily_staging WHERE job_id=$1",
                &[&j.id],
            )
            .await?;
        }
        tx.execute("UPDATE team_copilot_daily_jobs SET checkpoint=$3,error_code=CASE WHEN EXISTS(SELECT 1 FROM team_copilot_daily_rejections WHERE job_id=$1) THEN 'partial_report' ELSE NULL END,dead_letter_at=CASE WHEN $4 AND EXISTS(SELECT 1 FROM team_copilot_daily_rejections WHERE job_id=$1) THEN now() ELSE NULL END,completed_at=CASE WHEN $4 THEN now() ELSE NULL END,last_success_at=CASE WHEN $4 THEN now() ELSE last_success_at END,lease_token=NULL,lease_until=NULL,retry_at=now() WHERE id=$1 AND lease_token=$2",&[&j.id,&j.lease,&checkpoint,&finished]).await?;
        tx.commit().await?;
        Ok(())
    }
    pub async fn read_fence(&self, org: Uuid, user: Uuid) -> Result<String> {
        let row=self.pg.query_one("SELECT jsonb_build_object('config',(SELECT to_jsonb(c) FROM team_copilot_daily_integrations c WHERE c.organization_id=$1),'installation',(SELECT to_jsonb(i)-'lease_token'-'lease_until'-'updated_at' FROM team_github_installations i JOIN team_copilot_daily_integrations c USING(installation_id,organization_id) WHERE i.organization_id=$1),'identity',(SELECT jsonb_build_object('id',g.github_user_id,'verified_at',g.verified_at,'revoked_at',g.revoked_at) FROM team_github_identities g WHERE g.user_id=$2),'rollout',(SELECT jsonb_build_object('enabled',enabled,'generation',generation) FROM team_rollouts WHERE organization_id=$1))",&[&org,&user]).await?.get::<_,Value>(0);
        Ok(format!(
            "{:x}",
            sha2::Sha256::digest(serde_json::to_vec(&row)?)
        ))
    }
    pub async fn self_day(&self, org: Uuid, user: Uuid, day: NaiveDate) -> Result<Value> {
        let rows=self.pg.query("SELECT f.feature,f.metrics,f.observed_at FROM team_copilot_daily_facts f JOIN team_copilot_daily_integrations q ON q.organization_id=f.organization_id AND q.installation_id=f.installation_id JOIN team_github_installations i ON i.installation_id=f.installation_id AND i.organization_id=f.organization_id JOIN team_github_identities g ON g.user_id=f.user_id JOIN organization_analytics_consents c ON c.organization_id=f.organization_id AND c.user_id=f.user_id JOIN organization_members m ON m.organization_id=f.organization_id AND m.user_id=f.user_id JOIN users u ON u.id=m.user_id JOIN team_rollouts t ON t.organization_id=f.organization_id WHERE t.enabled AND f.organization_id=$1 AND f.user_id=$2 AND f.day=$3 AND NOT f.blocked AND q.enabled AND i.status='active' AND g.revoked_at IS NULL AND c.share_individual AND c.share_aggregate AND c.consent_version=f.consent_version AND c.aggregate_from=f.consent_from AND c.individual_from<=($3::date::timestamp AT TIME ZONE 'UTC') AND m.deactivated_at IS NULL AND u.is_active AND u.deleted_at IS NULL AND f.day::timestamp AT TIME ZONE 'UTC'>=now()-interval '12 months' ORDER BY f.feature LIMIT 64",&[&org,&user,&day]).await?;
        let mut features = Vec::new();
        for r in rows {
            features.push(json!({"feature":r.get::<_,String>(0),"counters":r.get::<_,Value>(1),"observed_at":r.get::<_,chrono::DateTime<Utc>>(2)}));
        }
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
}
