use crate::{infrastructure::postgres::PostgresClient, model::team_github::*};
use anyhow::{ensure, Context, Result};
use chrono::{DateTime, Utc};
use serde_json::{json, Value};
use std::sync::Arc;
use tokio_postgres::Row;
use uuid::Uuid;

pub struct GithubRepositoryStore {
    pub pg: Arc<PostgresClient>,
}
pub struct GithubJob {
    pub id: Uuid,
    pub org: Uuid,
    pub installation: i64,
    pub repository: Option<Uuid>,
    pub generation: i64,
    pub kind: String,
    pub checkpoint: Value,
    pub lease: Uuid,
    pub attempts: i32,
}
pub struct SyncFact {
    pub kind: String,
    pub external_id: String,
    pub work_item: Option<i64>,
    pub at: DateTime<Utc>,
    pub metadata: Value,
}
impl GithubRepositoryStore {
    pub fn new(pg: Arc<PostgresClient>) -> Self {
        Self { pg }
    }
    pub async fn create_attempt(
        &self,
        user: Uuid,
        org: Uuid,
        hash: &str,
        verifier: &[u8],
        session_hash: &str,
    ) -> Result<()> {
        self.pg.execute("INSERT INTO team_github_oauth_attempts(state_hash,user_id,organization_id,verifier,session_hash,expires_at) VALUES($1,$2,$3,$4,$5,now()+interval '10 minutes')",&[&hash,&user,&org,&verifier,&session_hash]).await?;
        Ok(())
    }
    pub async fn consume_attempt(
        &self,
        user: Uuid,
        hash: &str,
        session_hash: &str,
    ) -> Result<(Uuid, Vec<u8>)> {
        let row=self.pg.query_opt("UPDATE team_github_oauth_attempts SET consumed_at=now() WHERE state_hash=$1 AND user_id=$2 AND session_hash=$3 AND consumed_at IS NULL AND expires_at>now() RETURNING organization_id,verifier",&[&hash,&user,&session_hash]).await?.context("OAuth state invalid or expired")?;
        Ok((row.get(0), row.get(1)))
    }
    pub async fn save_identity(
        &self,
        user: Uuid,
        github_id: i64,
        login: &str,
        sealed: &[u8],
        expires: Option<DateTime<Utc>>,
    ) -> Result<()> {
        self.pg.execute("INSERT INTO team_github_identities(user_id,github_user_id,login,credentials,expires_at) VALUES($1,$2,$3,$4,$5) ON CONFLICT(user_id) DO UPDATE SET github_user_id=EXCLUDED.github_user_id,login=EXCLUDED.login,credentials=EXCLUDED.credentials,expires_at=EXCLUDED.expires_at,verified_at=now(),revoked_at=NULL,refresh_lease=NULL,refresh_until=NULL",&[&user,&github_id,&login,&sealed,&expires]).await?;
        Ok(())
    }
    pub async fn identity(&self, user: Uuid) -> Result<Option<Row>> {
        self.pg
            .query_opt(
                "SELECT * FROM team_github_identities WHERE user_id=$1 AND revoked_at IS NULL",
                &[&user],
            )
            .await
    }
    pub async fn refresh_claim(&self, user: Uuid, lease: Uuid) -> Result<bool> {
        Ok(self.pg.execute("UPDATE team_github_identities SET refresh_lease=$2,refresh_until=now()+interval '1 minute' WHERE user_id=$1 AND revoked_at IS NULL AND (refresh_until IS NULL OR refresh_until<now())",&[&user,&lease]).await?==1)
    }
    pub async fn refresh_finish(
        &self,
        user: Uuid,
        lease: Uuid,
        sealed: &[u8],
        expires: Option<DateTime<Utc>>,
    ) -> Result<()> {
        ensure!(self.pg.execute("UPDATE team_github_identities SET credentials=$3,expires_at=$4,refresh_lease=NULL,refresh_until=NULL WHERE user_id=$1 AND refresh_lease=$2 AND revoked_at IS NULL",&[&user,&lease,&sealed,&expires]).await?==1,"identity changed during refresh");
        Ok(())
    }
    pub async fn select(
        &self,
        actor: Uuid,
        org: Uuid,
        installation: i64,
        account: i64,
        login: &str,
        repos: &[GithubRepository],
        team: Option<Uuid>,
    ) -> Result<()> {
        let mut client = self.pg.transaction_client().await?;
        let tx = client.transaction().await?;
        tx.query_one("SELECT pg_advisory_xact_lock($1)", &[&installation])
            .await?;
        ensure!(tx.query_opt("SELECT 1 FROM organization_members m JOIN users u ON u.id=m.user_id WHERE m.organization_id=$1 AND m.user_id=$2 AND m.role IN ('owner','admin') AND m.deactivated_at IS NULL AND u.is_active AND u.deleted_at IS NULL FOR SHARE OF m,u",&[&org,&actor]).await?.is_some(),"administrator access changed");
        let existing=tx.query_opt("SELECT organization_id FROM team_github_installations WHERE installation_id=$1 FOR UPDATE",&[&installation]).await?;
        ensure!(
            existing.as_ref().is_none_or(|r| r.get::<_, Uuid>(0) == org),
            "installation already bound to another organization"
        );
        if let Some(team) = team {
            ensure!(
                tx.query_opt(
                    "SELECT 1 FROM teams WHERE organization_id=$1 AND id=$2",
                    &[&org, &team]
                )
                .await?
                .is_some(),
                "team outside organization"
            );
        }
        let generation:i64=tx.query_one("INSERT INTO team_github_installations(installation_id,organization_id,account_id,account_login,status) VALUES($1,$2,$3,$4,'active') ON CONFLICT(installation_id) DO UPDATE SET status='active',generation=team_github_installations.generation+1,updated_at=now(),lease_token=NULL,lease_until=NULL RETURNING generation",&[&installation,&org,&account,&login]).await?.get(0);
        tx.execute("UPDATE team_repository_scopes SET enabled=false WHERE organization_id=$1 AND github_installation_id=$2 AND enabled",&[&org,&installation]).await?;
        for repo in repos {
            let id = Uuid::new_v5(&org, format!("github:{}", repo.id).as_bytes());
            let row=tx.query_one("INSERT INTO team_repository_scopes(organization_id,repository_id,github_repository_id,github_installation_id,project_id,team_id,enabled) VALUES($1,$2,$3,$4,$2,$5,true) ON CONFLICT(organization_id,github_repository_id) DO UPDATE SET github_installation_id=EXCLUDED.github_installation_id,team_id=EXCLUDED.team_id,enabled=true RETURNING repository_id",&[&org,&id,&repo.id,&installation,&team]).await?;
            let id: Uuid = row.get(0);
            tx.execute("INSERT INTO team_github_repositories(organization_id,repository_id,full_name,node_id,default_branch) VALUES($1,$2,$3,$4,$5) ON CONFLICT(organization_id,repository_id) DO UPDATE SET full_name=EXCLUDED.full_name,node_id=EXCLUDED.node_id,default_branch=EXCLUDED.default_branch,observed_at=now()",&[&org,&id,&repo.full_name,&repo.node_id,&repo.default_branch]).await?;
            tx.execute("INSERT INTO team_github_checkpoints(organization_id,installation_id,repository_id) VALUES($1,$2,$3) ON CONFLICT(organization_id,repository_id) DO UPDATE SET coverage='initial_sync',error_code=NULL",&[&org,&installation,&id]).await?;
            tx.execute("INSERT INTO team_github_sync_jobs(id,installation_id,organization_id,repository_id,generation,kind) VALUES($1,$2,$3,$4,$5,'backfill') ON CONFLICT DO NOTHING",&[&Uuid::now_v7(),&installation,&org,&id,&generation]).await?;
        }
        tx.execute("UPDATE team_github_sync_jobs SET completed_at=now(),error_code='scope_superseded',lease_token=NULL,lease_until=NULL WHERE installation_id=$1 AND generation<>$2 AND completed_at IS NULL",&[&installation,&generation]).await?;
        tx.commit().await?;
        Ok(())
    }
    pub async fn disconnect(&self, org: Uuid) -> Result<()> {
        let mut client = self.pg.transaction_client().await?;
        let tx = client.transaction().await?;
        tx.execute("UPDATE team_github_installations SET status='removed',generation=generation+1,updated_at=now() WHERE organization_id=$1",&[&org]).await?;
        tx.execute(
            "UPDATE team_repository_scopes SET enabled=false WHERE organization_id=$1 AND enabled",
            &[&org],
        )
        .await?;
        tx.commit().await?;
        Ok(())
    }
    pub async fn overview(&self, org: Uuid, user: Uuid, admin: bool) -> Result<Value> {
        let identity=self.identity(user).await?.map(|r|json!({"github_user_id":r.get::<_,i64>("github_user_id"),"login":r.get::<_,String>("login"),"verified_at":r.get::<_,DateTime<Utc>>("verified_at")}));
        if !admin {
            return Ok(
                json!({"identity":identity,"can_manage":false,"repositories":[],"health":{"status":"withheld","reason":"administrator_diagnostics"}}),
            );
        }
        let rows=self.pg.query("SELECT s.repository_id,s.github_repository_id,s.github_installation_id,s.team_id,s.enabled,r.full_name,c.last_success_at,c.coverage,c.error_code FROM team_repository_scopes s JOIN team_github_repositories r USING(organization_id,repository_id) LEFT JOIN team_github_checkpoints c USING(organization_id,repository_id) WHERE s.organization_id=$1 ORDER BY r.full_name",&[&org]).await?;
        let repos:Vec<_>=rows.into_iter().map(|r|json!({"repository_id":r.get::<_,Uuid>(0),"github_repository_id":r.get::<_,i64>(1),"installation_id":r.get::<_,i64>(2),"team_id":r.get::<_,Option<Uuid>>(3),"enabled":r.get::<_,bool>(4),"full_name":r.get::<_,String>(5),"last_success_at":r.get::<_,Option<DateTime<Utc>>>(6),"coverage":r.get::<_,Option<String>>(7),"error_code":r.get::<_,Option<String>>(8)})).collect();
        let health = self.health(org).await?;
        Ok(json!({"identity":identity,"can_manage":true,"repositories":repos,"health":health}))
    }
    pub async fn health(&self, org: Uuid) -> Result<GithubHealth> {
        let row=self.pg.query_one("SELECT (SELECT min(last_success_at) FROM team_github_checkpoints c JOIN team_repository_scopes s USING(organization_id,repository_id) WHERE c.organization_id=$1 AND s.enabled) AS success,(SELECT count(*) FROM team_github_sync_jobs j JOIN team_github_installations i USING(installation_id) WHERE j.organization_id=$1 AND j.generation=i.generation AND j.completed_at IS NULL AND j.dead_letter_at IS NULL) AS pending,(SELECT count(*) FROM team_github_sync_jobs j JOIN team_github_installations i USING(installation_id) WHERE j.organization_id=$1 AND j.generation=i.generation AND j.completed_at IS NULL AND j.dead_letter_at IS NOT NULL) AS dead,(SELECT min(j.created_at) FROM team_github_sync_jobs j JOIN team_github_installations i USING(installation_id) WHERE j.organization_id=$1 AND j.generation=i.generation AND j.completed_at IS NULL) AS oldest,(SELECT error_code FROM team_github_sync_jobs j JOIN team_github_installations i USING(installation_id) WHERE j.organization_id=$1 AND j.generation=i.generation AND j.completed_at IS NULL AND error_code IS NOT NULL ORDER BY j.updated_at DESC LIMIT 1) AS error,(SELECT count(*) FROM team_repository_scopes WHERE organization_id=$1 AND enabled) AS repos,(SELECT count(*) FROM team_github_checkpoints c JOIN team_repository_scopes s USING(organization_id,repository_id) WHERE c.organization_id=$1 AND s.enabled AND c.last_success_at IS NULL) AS unconfirmed",&[&org]).await?;
        let success: Option<DateTime<Utc>> = row.get("success");
        let inbox=self.pg.query_one("SELECT count(*) FILTER(WHERE w.dead_letter_at IS NULL) AS pending,count(*) FILTER(WHERE w.dead_letter_at IS NOT NULL) AS dead,min(w.received_at) AS oldest FROM team_webhook_inbox w JOIN team_github_installations i ON w.metadata->>'installation_id'=i.installation_id::text WHERE w.provider='github' AND i.organization_id=$1 AND w.processed_at IS NULL",&[&org]).await?;
        let recovery=self.pg.query_one("SELECT count(*) FILTER(WHERE d.attempts<3) AS pending,count(*) FILTER(WHERE d.attempts>=3) AS dead,min(d.delivered_at) AS oldest FROM team_github_delivery_recovery d JOIN team_github_installations i USING(installation_id) WHERE i.organization_id=$1 AND d.acknowledged_at IS NULL AND NOT EXISTS(SELECT 1 FROM team_webhook_inbox w WHERE w.provider='github' AND w.delivery_id=d.delivery_guid) AND NOT EXISTS(SELECT 1 FROM team_webhook_dispositions w WHERE w.provider='github' AND w.delivery_id=d.delivery_guid)",&[&org]).await?;
        let pending: i64 = row.get::<_, i64>("pending")
            + inbox.get::<_, i64>("pending")
            + recovery.get::<_, i64>("pending");
        let dead = row.get::<_, i64>("dead")
            + inbox.get::<_, i64>("dead")
            + recovery.get::<_, i64>("dead");
        let oldest = [
            row.get::<_, Option<DateTime<Utc>>>("oldest"),
            inbox.get("oldest"),
            recovery.get("oldest"),
        ]
        .into_iter()
        .flatten()
        .min();
        let error: Option<String> = row.get("error");
        let (status, reason) = if row.get::<_, i64>("repos") == 0 {
            ("unavailable", "not_connected")
        } else if matches!(
            error.as_deref(),
            Some("auth_required" | "permission_required")
        ) {
            ("auth_required", "authorization_or_permissions")
        } else if error.as_deref() == Some("rate_limited") {
            ("rate_limited", "provider_retry_after")
        } else if matches!(
            error.as_deref(),
            Some("network" | "provider_unavailable" | "access_unconfirmed")
        ) {
            ("unavailable", "provider_or_access_unconfirmed")
        } else if dead > 0 {
            ("degraded", "dead_letter")
        } else if oldest.is_some_and(|at| Utc::now() - at > chrono::Duration::minutes(5)) {
            ("pending", "accepted_backlog_overdue")
        } else if row.get::<_, i64>("unconfirmed") > 0 {
            ("pending", "initial_sync")
        } else if success.is_none_or(|at| Utc::now() - at > chrono::Duration::minutes(15)) {
            ("stale", "checkpoint_overdue")
        } else {
            ("observed", "scoped_reconciliation")
        };
        Ok(GithubHealth {
            status,
            reason,
            last_success_at: success,
            pending: Some(pending),
            checked_at: Utc::now(),
        })
    }
    pub async fn binding(&self, org: Uuid, user: Uuid, input: &ProjectBinding) -> Result<()> {
        // Canonical project ownership is checked by the service. Scope and membership
        // are checked again under locks so revocation cannot race this write.
        let mut client = self.pg.transaction_client().await?;
        let tx = client.transaction().await?;
        let member=tx.query_opt("SELECT m.role FROM organization_members m JOIN users u ON u.id=m.user_id WHERE m.organization_id=$1 AND m.user_id=$2 AND m.deactivated_at IS NULL AND m.seat_type='developer' AND m.role<>'viewer' AND u.is_active AND u.deleted_at IS NULL FOR SHARE OF m,u",&[&org,&user]).await?.context("active developer membership required")?;
        let scope=tx.query_opt("SELECT team_id FROM team_repository_scopes WHERE organization_id=$1 AND repository_id=$2 AND enabled FOR SHARE",&[&org,&input.repository_id]).await?.context("repository unavailable")?;
        let role: String = member.get(0);
        if !matches!(role.as_str(), "owner" | "admin") {
            if let Some(team) = scope.get::<_, Option<Uuid>>(0) {
                ensure!(
                    tx.query_opt(
                        "SELECT 1 FROM team_members WHERE team_id=$1 AND user_id=$2 FOR SHARE",
                        &[&team, &user]
                    )
                    .await?
                    .is_some(),
                    "repository outside member team"
                );
            }
        }
        tx.execute("INSERT INTO team_member_project_bindings(organization_id,user_id,project_id,repository_id) VALUES($1,$2,$3,$4) ON CONFLICT(organization_id,user_id,project_id) DO UPDATE SET repository_id=EXCLUDED.repository_id,confirmed_at=now()",&[&org,&user,&input.project_id,&input.repository_id]).await?;
        tx.commit().await?;
        Ok(())
    }
    pub async fn context(
        &self,
        org: Uuid,
        user: Uuid,
        event: &SessionContext,
        hash: &str,
    ) -> Result<()> {
        let mut client = self.pg.transaction_client().await?;
        let tx = client.transaction().await?;
        let row=tx.query_opt("SELECT c.individual_from FROM organization_analytics_consents c JOIN organization_members m USING(organization_id,user_id) JOIN users u ON u.id=m.user_id WHERE c.organization_id=$1 AND c.user_id=$2 AND c.share_individual AND c.individual_from<=$3 AND m.deactivated_at IS NULL AND m.seat_type='developer' AND m.role<>'viewer' AND u.is_active AND u.deleted_at IS NULL FOR SHARE OF c,m",&[&org,&user,&event.occurred_at]).await?;
        ensure!(row.is_some(), "individual consent required for context");
        ensure!(tx.query_opt("SELECT 1 FROM team_member_project_bindings b JOIN team_repository_scopes s USING(organization_id,repository_id) WHERE b.organization_id=$1 AND b.user_id=$2 AND b.project_id=$3 AND b.repository_id=$4 AND s.enabled AND (s.team_id IS NULL OR EXISTS(SELECT 1 FROM team_members tm WHERE tm.team_id=s.team_id AND tm.user_id=$2) OR EXISTS(SELECT 1 FROM organization_members m WHERE m.organization_id=$1 AND m.user_id=$2 AND m.deactivated_at IS NULL AND m.role IN ('owner','admin'))) FOR SHARE OF b,s",&[&org,&user,&event.project_id,&event.repository_id]).await?.is_some(),"repository binding missing");
        ensure!(tx.query_opt("INSERT INTO team_session_contexts(organization_id,user_id,event_id,payload_hash,session_id,collector_id,project_id,repository_id,occurred_at,branch,commit_sha,provenance) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT(user_id,event_id) DO UPDATE SET event_id=EXCLUDED.event_id WHERE team_session_contexts.payload_hash=EXCLUDED.payload_hash RETURNING event_id",&[&org,&user,&event.event_id,&hash,&event.session_id,&event.collector_id,&event.project_id,&event.repository_id,&event.occurred_at,&event.branch,&event.commit_sha,&event.provenance]).await?.is_some(),"context identity conflict");
        tx.commit().await?;
        Ok(())
    }
    pub async fn suggestions(&self, org: Uuid, user: Uuid) -> Result<Value> {
        let rows=self.pg.query("SELECT c.session_id,c.repository_id,c.branch,c.commit_sha,w.external_id,w.number FROM team_session_contexts c JOIN team_repository_scopes s USING(organization_id,repository_id) JOIN team_work_items w ON w.organization_id=c.organization_id AND w.repository_id=c.repository_id AND w.kind='pull_request' AND w.head_branch=c.branch AND w.head_sha=c.commit_sha AND w.head_repository_id=s.github_repository_id JOIN organization_analytics_consents consent ON consent.organization_id=c.organization_id AND consent.user_id=c.user_id AND consent.share_individual AND c.occurred_at>=consent.individual_from WHERE c.organization_id=$1 AND c.user_id=$2 AND s.enabled AND (s.team_id IS NULL OR EXISTS(SELECT 1 FROM team_members tm WHERE tm.team_id=s.team_id AND tm.user_id=$2) OR EXISTS(SELECT 1 FROM organization_members m WHERE m.organization_id=$1 AND m.user_id=$2 AND m.role IN ('owner','admin') AND m.deactivated_at IS NULL)) AND c.occurred_at>=now()-interval '12 months' AND c.commit_sha IS NOT NULL AND w.state='open' AND NOT EXISTS(SELECT 1 FROM team_session_links l WHERE l.organization_id=c.organization_id AND l.user_id=c.user_id AND l.session_id=c.session_id AND l.repository_id=c.repository_id AND l.work_item_id=w.external_id AND l.status IN ('confirmed','rejected')) ORDER BY c.occurred_at DESC LIMIT 201",&[&org,&user]).await?;
        ensure!(rows.len() <= 200, "suggestion page too large");
        let mut groups = std::collections::BTreeMap::new();
        for r in rows {
            let session: String = r.get(0);
            let repo: Uuid = r.get(1);
            let item: i64 = r.get(4);
            groups
                .entry((session, repo))
                .or_insert_with(std::collections::BTreeMap::new)
                .insert(item, r.get::<_, i32>(5));
        }
        Ok(json!(groups.into_iter().map(|((session,repo),items)|json!({"session_id":session,"repository_id":repo,"status":if items.len()==1{"proposed"}else{"unresolved"},"evidence":"repository_branch_commit","candidates":items.into_iter().map(|(id,number)|json!({"external_id":id,"number":number})).collect::<Vec<_>>()})).collect::<Vec<_>>()))
    }
    pub async fn work_page(&self, org: Uuid, query: &GithubWorkQuery) -> Result<Value> {
        use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
        let limit = query.limit.unwrap_or(50);
        if !(1..=100).contains(&limit) {
            return Err(GithubInputError("work page limit must be 1 to 100").into());
        }
        let cursor: Option<(DateTime<Utc>, Uuid, i64)> = query
            .after
            .as_deref()
            .map(|c| {
                if c.len() >= 1024 {
                    return Err(GithubInputError("invalid work cursor"));
                }
                let bytes = URL_SAFE_NO_PAD
                    .decode(c)
                    .map_err(|_| GithubInputError("invalid work cursor"))?;
                serde_json::from_slice(&bytes).map_err(|_| GithubInputError("invalid work cursor"))
            })
            .transpose()?;
        let (at, repo, id) = cursor
            .map(|(at, r, id)| (Some(at), Some(r), Some(id)))
            .unwrap_or((None, None, None));
        let rows=self.pg.query("SELECT w.*,r.full_name FROM team_work_items w JOIN team_repository_scopes s USING(organization_id,repository_id) JOIN team_github_repositories r USING(organization_id,repository_id) WHERE w.organization_id=$1 AND s.enabled AND (w.provider_updated_at>=now()-interval '12 months' OR w.state='open') AND ($2::uuid IS NULL OR s.team_id=$2) AND ($3::timestamptz IS NULL OR (w.provider_updated_at,w.repository_id,w.external_id)<($3,$4::uuid,$5::bigint)) ORDER BY w.provider_updated_at DESC,w.repository_id DESC,w.external_id DESC LIMIT $6",&[&org,&query.team_id,&at,&repo,&id,&(limit+1)]).await?;
        let has_more = rows.len() > limit as usize;
        let mut items = vec![];
        let mut next = None;
        for row in rows.into_iter().take(limit as usize) {
            let repository: Uuid = row.get("repository_id");
            let external: i64 = row.get("external_id");
            let updated: DateTime<Utc> = row.get("provider_updated_at");
            let head: Option<String> = row.get("head_sha");
            let number: i32 = row.get("number");
            let name: String = row.get("full_name");
            let kind: String = row.get("kind");
            let facts=self.pg.query("SELECT DISTINCT ON (kind,COALESCE(metadata->>'context',metadata->>'name',external_id)) metadata FROM team_github_facts WHERE organization_id=$1 AND repository_id=$2 AND metadata->>'head_sha'=$3 AND kind IN ('check_run','status') AND occurred_at>=now()-interval '12 months' ORDER BY kind,COALESCE(metadata->>'context',metadata->>'name',external_id),occurred_at DESC,observed_at DESC",&[&org,&repository,&head]).await?.into_iter().map(|r|r.get::<_,Value>(0)).collect::<Vec<_>>();
            let ci = head
                .as_deref()
                .map(|sha| crate::services::team_github_sync::ci_state(sha, &facts))
                .unwrap_or("unavailable");
            let historical = updated >= Utc::now() - chrono::Months::new(12);
            let ready: Option<DateTime<Utc>> = if historical {
                row.get::<_, Option<DateTime<Utc>>>("ready_at")
                    .filter(|at| *at >= Utc::now() - chrono::Months::new(12))
            } else {
                None
            };
            let reviewed: Option<DateTime<Utc>> = if historical {
                row.get("first_review_at")
            } else {
                None
            };
            let merged: Option<DateTime<Utc>> = if historical {
                row.get("merged_at")
            } else {
                None
            };
            let elapsed = |end: Option<DateTime<Utc>>| {
                ready
                    .zip(end)
                    .filter(|(a, b)| b >= a)
                    .map(|(a, b)| (b - a).num_seconds())
            };
            let metric = |value: Option<i64>| json!({"value":value,"status":if value.is_some(){"observed"}else{"unavailable"},"coverage":null,"provenance":"github_timeline_and_reviews","updated_at":row.get::<_,DateTime<Utc>>("synced_at"),"calculation_version":"github_elapsed_v1","reason":if value.is_some(){None}else{Some("historical_start_or_end_unconfirmed")}});
            items.push(json!({"repository_id":repository,"external_id":external,"number":number,"kind":kind,"state":row.get::<_,String>("state"),"url":format!("https://github.com/{name}/{}/{number}",if kind=="pull_request"{"pull"}else{"issues"}),"head_sha":head,"draft":row.get::<_,Option<bool>>("draft"),"ready_at":ready,"first_review_at":reviewed,"merged_at":merged,"review_wait_seconds":metric(elapsed(reviewed)),"ready_to_merge_seconds":metric(elapsed(merged)),"ci":{"status":ci,"required_checks":"unavailable","provenance":"github_observed_checks_and_statuses","calculation_version":"github_ci_v1"},"lifecycle_coverage":row.get::<_,String>("lifecycle_coverage"),"synced_at":row.get::<_,DateTime<Utc>>("synced_at"),"current_snapshot_only":!historical}));
            next =
                Some(URL_SAFE_NO_PAD.encode(serde_json::to_vec(&(updated, repository, external))?));
        }
        Ok(
            json!({"items":items,"next":if has_more{next}else{None},"scope":"selected_repositories","coverage":"observed_metadata"}),
        )
    }
    pub async fn schedule(&self, org: Option<Uuid>) -> Result<()> {
        if let Some(org) = org {
            self.pg.execute("UPDATE team_github_sync_jobs j SET retry_at=now(),error_code=NULL WHERE organization_id=$1 AND completed_at IS NULL AND dead_letter_at IS NULL AND error_code IN ('auth_required','permission_required') AND EXISTS(SELECT 1 FROM team_github_installations i WHERE i.installation_id=j.installation_id AND i.generation=j.generation AND i.status='active')",&[&org]).await?;
        }
        self.pg.execute("INSERT INTO team_github_sync_jobs(id,installation_id,organization_id,repository_id,generation,kind) SELECT gen_random_uuid(),i.installation_id,i.organization_id,s.repository_id,i.generation,CASE WHEN c.sweep_at IS NULL OR c.sweep_at<now()-interval '1 day' THEN 'backfill' ELSE 'incremental' END FROM team_github_installations i JOIN team_repository_scopes s ON s.organization_id=i.organization_id AND s.github_installation_id=i.installation_id LEFT JOIN team_github_checkpoints c ON c.organization_id=s.organization_id AND c.repository_id=s.repository_id JOIN team_rollouts rollout ON rollout.organization_id=i.organization_id AND rollout.enabled WHERE i.status='active' AND s.enabled AND ($1::uuid IS NULL OR i.organization_id=$1) AND (c.last_success_at IS NULL OR c.last_success_at<now()-interval '5 minutes' OR $1 IS NOT NULL) AND NOT EXISTS(SELECT 1 FROM team_github_sync_jobs j WHERE j.installation_id=i.installation_id AND j.repository_id=s.repository_id AND j.generation=i.generation AND j.completed_at IS NULL AND j.dead_letter_at IS NULL) ON CONFLICT DO NOTHING",&[&org]).await?;
        Ok(())
    }
    pub async fn claim(&self) -> Result<Option<GithubJob>> {
        let mut client = self.pg.transaction_client().await?;
        let tx = client.transaction().await?;
        let Some(installation)=tx.query_opt("SELECT i.installation_id FROM team_github_installations i JOIN team_rollouts r ON r.organization_id=i.organization_id AND r.enabled WHERE i.status='active' AND (i.lease_until IS NULL OR i.lease_until<now()) AND EXISTS(SELECT 1 FROM team_github_sync_jobs j WHERE j.installation_id=i.installation_id AND j.generation=i.generation AND j.completed_at IS NULL AND j.dead_letter_at IS NULL AND j.retry_at<=now() AND (j.lease_until IS NULL OR j.lease_until<now())) ORDER BY i.installation_id FOR UPDATE OF i SKIP LOCKED LIMIT 1",&[]).await? else{return Ok(None)};
        let id: i64 = installation.get(0);
        let lease = Uuid::now_v7();
        let row=tx.query_one("UPDATE team_github_sync_jobs j SET lease_token=$2,lease_until=now()+interval '90 seconds',attempts=attempts+1,updated_at=now() WHERE id=(SELECT j2.id FROM team_github_sync_jobs j2 JOIN team_github_installations i ON i.installation_id=j2.installation_id AND i.generation=j2.generation WHERE j2.installation_id=$1 AND j2.completed_at IS NULL AND j2.dead_letter_at IS NULL AND j2.retry_at<=now() AND (j2.lease_until IS NULL OR j2.lease_until<now()) ORDER BY j2.retry_at,j2.created_at FOR UPDATE OF j2 SKIP LOCKED LIMIT 1) RETURNING j.*",&[&id,&lease]).await?;
        tx.execute("UPDATE team_github_installations SET lease_token=$2,lease_until=now()+interval '90 seconds' WHERE installation_id=$1",&[&id,&lease]).await?;
        let job = GithubJob {
            id: row.get("id"),
            org: row.get("organization_id"),
            installation: id,
            repository: row.get("repository_id"),
            generation: row.get("generation"),
            kind: row.get("kind"),
            checkpoint: row.get("checkpoint"),
            lease,
            attempts: row.get("attempts"),
        };
        tx.commit().await?;
        Ok(Some(job))
    }
    pub async fn renew(&self, job: &GithubJob) -> Result<()> {
        let mut client = self.pg.transaction_client().await?;
        let tx = client.transaction().await?;
        ensure!(tx.execute("UPDATE team_github_installations SET lease_until=now()+interval '90 seconds' WHERE installation_id=$1 AND generation=$2 AND lease_token=$3 AND lease_until>now() AND status='active'",&[&job.installation,&job.generation,&job.lease]).await?==1,"installation lease lost");
        ensure!(tx.execute("UPDATE team_github_sync_jobs SET lease_until=now()+interval '90 seconds' WHERE id=$1 AND lease_token=$2 AND lease_until>now()",&[&job.id,&job.lease]).await?==1,"sync lease lost");
        tx.commit().await?;
        Ok(())
    }
    pub async fn fail(&self, job: &GithubJob, code: &str, seconds: i64, dead: bool) -> Result<()> {
        self.pg.execute("UPDATE team_github_sync_jobs SET retry_at=CASE WHEN $4 IN ('auth_required','permission_required') THEN 'infinity'::timestamptz ELSE now()+$3*interval '1 second' END,error_code=$4,dead_letter_at=CASE WHEN $5 THEN now() ELSE NULL END,lease_token=NULL,lease_until=NULL WHERE id=$1 AND lease_token=$2",&[&job.id,&job.lease,&seconds,&code,&dead]).await?;
        self.pg.execute("UPDATE team_github_installations SET lease_token=NULL,lease_until=NULL WHERE installation_id=$1 AND lease_token=$2",&[&job.installation,&job.lease]).await?;
        if let Some(repo) = job.repository {
            self.pg.execute("UPDATE team_github_checkpoints SET error_code=$3 WHERE organization_id=$1 AND repository_id=$2",&[&job.org,&repo,&code]).await?;
        }
        Ok(())
    }
    pub async fn repository_metadata(&self, job: &GithubJob) -> Result<(i64, String)> {
        let repo = job.repository.context("repository job required")?;
        let row=self.pg.query_opt("SELECT s.github_repository_id,r.full_name FROM team_repository_scopes s JOIN team_github_repositories r USING(organization_id,repository_id) JOIN team_github_installations i ON i.installation_id=s.github_installation_id WHERE s.organization_id=$1 AND s.repository_id=$2 AND s.enabled AND i.status='active' AND i.generation=$3",&[&job.org,&repo,&job.generation]).await?.context("installation or scope changed")?;
        Ok((row.get(0), row.get(1)))
    }
    pub async fn repository_etag(&self, job: &GithubJob) -> Result<Option<String>> {
        Ok(self.pg.query_one("SELECT metadata_etag FROM team_github_repositories WHERE organization_id=$1 AND repository_id=$2",&[&job.org,&job.repository]).await?.get(0))
    }
    pub async fn refresh_repository(
        &self,
        job: &GithubJob,
        metadata: &GithubRepository,
        etag: Option<&str>,
    ) -> Result<()> {
        let mut client = self.pg.transaction_client().await?;
        let tx = client.transaction().await?;
        ensure!(tx.query_opt("SELECT 1 FROM team_github_installations WHERE installation_id=$1 AND generation=$2 AND status='active' AND lease_token=$3 AND lease_until>now() FOR SHARE",&[&job.installation,&job.generation,&job.lease]).await?.is_some(),"repository refresh scope changed");
        ensure!(tx.execute("UPDATE team_github_repositories r SET full_name=$3,node_id=$4,default_branch=$5,metadata_etag=$6,observed_at=now() FROM team_repository_scopes s WHERE r.organization_id=$1 AND r.repository_id=$2 AND s.organization_id=r.organization_id AND s.repository_id=r.repository_id AND s.enabled AND s.github_repository_id=$7",&[&job.org,&job.repository,&metadata.full_name,&metadata.node_id,&metadata.default_branch,&etag,&metadata.id]).await?==1,"repository identity or scope changed");
        tx.commit().await?;
        Ok(())
    }
    /// Metadata, derived jobs and page cursor share one commit. Response loss replays this page safely.
    pub async fn commit_sync(
        &self,
        job: &GithubJob,
        items: &[crate::services::team_webhooks::GithubMetadata],
        facts: &[SyncFact],
        checkpoint: &Value,
        complete: bool,
    ) -> Result<()> {
        let repo = job.repository.context("repository job required")?;
        let mut client = self.pg.transaction_client().await?;
        let tx = client.transaction().await?;
        ensure!(tx.query_opt("SELECT 1 FROM team_github_installations WHERE installation_id=$1 AND generation=$2 AND lease_token=$3 AND lease_until>now() AND status='active' FOR UPDATE",&[&job.installation,&job.generation,&job.lease]).await?.is_some(),"installation lease changed");
        ensure!(tx.query_opt("SELECT 1 FROM team_github_sync_jobs j JOIN team_github_installations i ON i.installation_id=j.installation_id JOIN team_repository_scopes s ON s.organization_id=j.organization_id AND s.repository_id=j.repository_id WHERE j.id=$1 AND j.lease_token=$2 AND j.lease_until>now() AND i.generation=j.generation AND i.status='active' AND s.enabled FOR UPDATE OF j FOR SHARE OF i,s",&[&job.id,&job.lease]).await?.is_some(),"sync scope or lease changed");
        for event in items {
            if let Some(item) = &event.item {
                let details = event.details.as_ref();
                tx.execute("INSERT INTO team_work_items(organization_id,repository_id,external_id,kind,number,state,head_branch,author_github_id,opened_at,ready_at,merged_at,closed_at,provider_updated_at,head_sha,head_repository_id,draft) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) ON CONFLICT(organization_id,repository_id,external_id) DO UPDATE SET state=EXCLUDED.state,head_branch=EXCLUDED.head_branch,author_github_id=EXCLUDED.author_github_id,merged_at=EXCLUDED.merged_at,closed_at=EXCLUDED.closed_at,provider_updated_at=EXCLUDED.provider_updated_at,head_sha=EXCLUDED.head_sha,head_repository_id=EXCLUDED.head_repository_id,draft=EXCLUDED.draft,synced_at=now() WHERE EXCLUDED.provider_updated_at>=team_work_items.provider_updated_at",&[&job.org,&repo,&item.external_id,&item.kind,&item.number,&item.state,&item.branch,&item.author_id,&item.opened_at,&item.ready_at,&item.merged_at,&item.closed_at,&item.updated_at,&details.and_then(|d|d.head_sha.clone()),&details.and_then(|d|d.head_repository_id),&details.and_then(|d|d.draft)]).await?;
                if item.kind == "pull_request" && job.kind != "detail" {
                    let cp = json!({"phase":"current","number":item.number,"external_id":item.external_id,"head_sha":details.and_then(|d|d.head_sha.clone()),"author_id":item.author_id});
                    tx.execute("INSERT INTO team_github_sync_jobs(id,installation_id,organization_id,repository_id,generation,kind,target_key,checkpoint) VALUES($1,$2,$3,$4,$5,'detail',$6,$7) ON CONFLICT DO NOTHING",&[&Uuid::now_v7(),&job.installation,&job.org,&repo,&job.generation,&format!("{}:{}",item.external_id,details.and_then(|d|d.head_sha.as_deref()).unwrap_or("unconfirmed")),&cp]).await?;
                }
            }
        }
        let observed_at = checkpoint["observed_at"]
            .as_str()
            .map(str::parse::<DateTime<Utc>>)
            .transpose()?
            .unwrap_or_else(Utc::now);
        for fact in facts {
            upsert_fact(&tx, job.org, repo, fact, observed_at).await?;
        }
        tx.execute("UPDATE team_github_sync_jobs SET checkpoint=$3,completed_at=CASE WHEN $4 THEN now() ELSE NULL END,lease_token=NULL,lease_until=NULL,error_code=NULL,retry_at=now(),updated_at=now() WHERE id=$1 AND lease_token=$2",&[&job.id,&job.lease,&checkpoint,&complete]).await?;
        if complete && job.kind == "detail" {
            let item = checkpoint["external_id"]
                .as_i64()
                .context("detail item missing")?;
            tx.execute("UPDATE team_work_items SET ready_at=(SELECT min(occurred_at) FROM team_github_facts f WHERE f.organization_id=$1 AND f.repository_id=$2 AND f.work_item_id=$3 AND f.kind='ready'),first_review_at=(SELECT min(f.occurred_at) FROM team_github_facts f WHERE f.organization_id=$1 AND f.repository_id=$2 AND f.work_item_id=$3 AND f.kind='review' AND f.metadata->>'author_type'='User' AND (f.metadata->>'author_id')::bigint IS DISTINCT FROM team_work_items.author_github_id AND f.occurred_at>=COALESCE((SELECT min(occurred_at) FROM team_github_facts r WHERE r.organization_id=$1 AND r.repository_id=$2 AND r.work_item_id=$3 AND r.kind='ready'), 'infinity'::timestamptz)),lifecycle_coverage='observed' WHERE organization_id=$1 AND repository_id=$2 AND external_id=$3",&[&job.org,&repo,&item]).await?;
        }
        if complete && matches!(job.kind.as_str(), "backfill" | "incremental") {
            tx.execute("UPDATE team_github_checkpoints SET sweep_at=CASE WHEN $3='backfill' THEN now() ELSE sweep_at END WHERE organization_id=$1 AND repository_id=$2",&[&job.org,&repo,&job.kind]).await?;
        }
        if complete {
            tx.execute("UPDATE team_github_checkpoints c SET last_success_at=now(),coverage='observed',error_code=NULL WHERE organization_id=$1 AND repository_id=$2 AND NOT EXISTS(SELECT 1 FROM team_github_sync_jobs j WHERE j.organization_id=c.organization_id AND j.repository_id=c.repository_id AND j.generation=$3 AND j.completed_at IS NULL)",&[&job.org,&repo,&job.generation]).await?;
        }
        tx.execute("UPDATE team_github_installations SET lease_token=NULL,lease_until=NULL WHERE installation_id=$1 AND lease_token=$2",&[&job.installation,&job.lease]).await?;
        tx.commit().await?;
        Ok(())
    }
}

/// Shared by webhook and API reconciliation. A late queued event cannot restore
/// an older CI result. Review dismissal keeps its actual submission timestamp.
pub async fn upsert_fact(
    tx: &tokio_postgres::Transaction<'_>,
    org: Uuid,
    repo: Uuid,
    fact: &SyncFact,
    observed_at: DateTime<Utc>,
) -> Result<()> {
    tx.execute("INSERT INTO team_github_facts(organization_id,repository_id,kind,external_id,work_item_id,occurred_at,metadata,observed_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(organization_id,repository_id,kind,external_id) DO UPDATE SET metadata=EXCLUDED.metadata,occurred_at=EXCLUDED.occurred_at,observed_at=EXCLUDED.observed_at,work_item_id=COALESCE(EXCLUDED.work_item_id,team_github_facts.work_item_id) WHERE (EXCLUDED.occurred_at,EXCLUDED.observed_at)>=(team_github_facts.occurred_at,team_github_facts.observed_at) AND NOT COALESCE((EXCLUDED.kind='review' AND team_github_facts.metadata->>'state'='DISMISSED' AND EXCLUDED.metadata->>'state'<>'DISMISSED'),false) AND NOT (EXCLUDED.kind IN ('check_run','status') AND (COALESCE(EXCLUDED.metadata->'source_at'='null'::jsonb,false) OR COALESCE(EXCLUDED.metadata->'at'='null'::jsonb,false)) AND NOT (COALESCE(team_github_facts.metadata->'source_at'='null'::jsonb,false) OR COALESCE(team_github_facts.metadata->'at'='null'::jsonb,false)))",&[&org,&repo,&fact.kind,&fact.external_id,&fact.work_item,&fact.at,&fact.metadata,&observed_at]).await?;
    Ok(())
}
