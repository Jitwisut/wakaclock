use crate::{
    infrastructure::{contracts::CredentialVault, github::*},
    model::team_github::*,
    repository::{team_github::GithubRepositoryStore, team_insights::TeamInsightsRepository},
    services::authorization::{AuthorizationService, OrganizationAction, OrganizationRole},
};
use anyhow::{ensure, Context, Result};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use chrono::{DateTime, Utc};
use reqwest::Method;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::sync::Arc;
use uuid::Uuid;

pub struct TeamGithubService {
    pub repo: Option<Arc<GithubRepositoryStore>>,
    authorization: Arc<AuthorizationService>,
    vault: Option<Arc<dyn CredentialVault>>,
    config: Option<GithubConfig>,
    client: GithubClient,
    insights: Option<Arc<TeamInsightsRepository>>,
    enabled: bool,
}
impl TeamGithubService {
    pub fn new(
        repo: Option<Arc<GithubRepositoryStore>>,
        authorization: Arc<AuthorizationService>,
        vault: Option<Arc<dyn CredentialVault>>,
        insights: Option<Arc<TeamInsightsRepository>>,
        enabled: bool,
    ) -> Result<Self> {
        Ok(Self {
            repo,
            authorization,
            vault,
            config: GithubConfig::from_env()?,
            client: GithubClient::new()?,
            insights,
            enabled,
        })
    }
    fn repo(&self) -> Result<&GithubRepositoryStore> {
        self.repo.as_deref().context("GitHub requires PostgreSQL")
    }
    fn config(&self) -> Result<&GithubConfig> {
        ensure!(self.enabled, "GitHub integration disabled");
        self.config.as_ref().context("GitHub App not configured")
    }
    fn vault(&self) -> Result<&dyn CredentialVault> {
        self.vault
            .as_deref()
            .context("GitHub credential vault required")
    }
    async fn authorize(&self, user: Uuid, org: Uuid, manage: bool) -> Result<()> {
        self.authorization
            .require(
                user,
                org,
                if manage {
                    OrganizationAction::ManageIntegrations
                } else {
                    OrganizationAction::ReadSelf
                },
                None,
            )
            .await?;
        Ok(())
    }
    pub async fn status(&self, user: Uuid, org: Uuid) -> Result<Value> {
        let role = self
            .authorization
            .require(user, org, OrganizationAction::ReadSelf, None)
            .await?
            .role;
        let mut status = self
            .repo()?
            .overview(
                org,
                user,
                matches!(
                    role,
                    Some(OrganizationRole::Owner | OrganizationRole::Admin)
                ),
            )
            .await?;
        status["configured"] = json!(self.config.is_some() && self.vault.is_some() && self.enabled);
        status["session_context_capability"] = json!(1);
        status["context_health"] = self.repo()?.context_health(org, user).await?;
        self.authorize(user, org, false).await?;
        Ok(status)
    }
    pub async fn start(&self, user: Uuid, org: Uuid, session: &str) -> Result<Value> {
        self.authorize(user, org, false).await?;
        let config = self.config()?;
        self.client.verify_application(config).await?;
        let state = random_secret()?;
        let verifier = random_secret()?;
        let challenge = URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()));
        let sealed = self.vault()?.seal(user, verifier.as_bytes()).await?;
        self.repo()?
            .create_attempt(user, org, &hash(&state), &sealed, session)
            .await?;
        let mut url = reqwest::Url::parse("https://github.com/login/oauth/authorize")?;
        url.query_pairs_mut()
            .append_pair("client_id", &config.client_id)
            .append_pair("redirect_uri", &config.callback())
            .append_pair("state", &state)
            .append_pair("code_challenge", &challenge)
            .append_pair("code_challenge_method", "S256");
        Ok(json!({"authorize_url":url.as_str(),"expires_in":600}))
    }
    pub async fn callback(
        &self,
        user: Uuid,
        input: GithubCallback,
        session: &str,
    ) -> Result<Value> {
        ensure!(
            input.state.len() == 43 && !input.code.is_empty() && input.code.len() < 1024,
            "invalid OAuth callback"
        );
        let (org, sealed) = self
            .repo()?
            .consume_attempt(user, &hash(&input.state), session)
            .await?;
        self.authorize(user, org, false).await?;
        let verifier = String::from_utf8(self.vault()?.open(user, &sealed).await?)
            .context("OAuth verifier unavailable")?;
        let tokens=self.client.oauth(self.config()?,json!({"code":input.code,"code_verifier":verifier,"redirect_uri":self.config()?.callback()})).await?;
        let me = self
            .client
            .request(&tokens.access_token, Method::GET, "/user", None, None)
            .await?
            .value;
        let id = me["id"]
            .as_i64()
            .filter(|v| *v > 0)
            .context("GitHub identity missing")?;
        let login = me["login"].as_str().context("GitHub login missing")?;
        self.authorize(user, org, false).await?;
        let sealed = self
            .vault()?
            .seal(user, &serde_json::to_vec(&tokens)?)
            .await?;
        self.repo()?
            .save_identity(
                user,
                id,
                login,
                &sealed,
                tokens
                    .expires_in
                    .map(|s| Utc::now() + chrono::Duration::seconds(s)),
            )
            .await?;
        Ok(json!({"organization_id":org,"github_user_id":id,"login":login}))
    }
    async fn user_token(&self, user: Uuid) -> Result<String> {
        let row = self
            .repo()?
            .identity(user)
            .await?
            .context("connect GitHub identity first")?;
        let sealed: Vec<u8> = row.get("credentials");
        let tokens: GithubTokens =
            serde_json::from_slice(&self.vault()?.open(user, &sealed).await?)?;
        if row
            .get::<_, Option<DateTime<Utc>>>("expires_at")
            .is_none_or(|at| at > Utc::now() + chrono::Duration::minutes(2))
        {
            return Ok(tokens.access_token);
        }
        let lease = Uuid::now_v7();
        ensure!(
            self.repo()?.refresh_claim(user, lease).await?,
            "GitHub credential refresh in progress; retry"
        );
        // A revoked authorization or an ambiguous refresh must be reauthorized, never guessed.
        let refreshed = match tokens.refresh_token {
            Some(refresh) => {
                self.client
                    .oauth(
                        self.config()?,
                        json!({"grant_type":"refresh_token","refresh_token":refresh}),
                    )
                    .await
            }
            None => Err(anyhow::anyhow!("reauthorization required")),
        };
        match refreshed {
            Ok(tokens) => {
                let sealed = self
                    .vault()?
                    .seal(user, &serde_json::to_vec(&tokens)?)
                    .await?;
                self.repo()?
                    .refresh_finish(
                        user,
                        lease,
                        &sealed,
                        tokens
                            .expires_in
                            .map(|s| Utc::now() + chrono::Duration::seconds(s)),
                    )
                    .await?;
                Ok(tokens.access_token)
            }
            Err(_) => {
                self.repo()?.pg.execute("UPDATE team_github_identities SET revoked_at=now(),credentials=NULL,refresh_lease=NULL,refresh_until=NULL WHERE user_id=$1 AND refresh_lease=$2",&[&user,&lease]).await?;
                anyhow::bail!("GitHub reauthorization required")
            }
        }
    }
    pub async fn installations(&self, user: Uuid, org: Uuid) -> Result<Value> {
        self.authorize(user, org, true).await?;
        self.client.verify_application(self.config()?).await?;
        let token = self.user_token(user).await?;
        let mut next = Some("/user/installations?per_page=100".to_string());
        let mut result = vec![];
        while let Some(path) = next {
            let page = self
                .client
                .request(&token, Method::GET, &path, None, None)
                .await?;
            for i in page.value["installations"]
                .as_array()
                .context("installation list unavailable")?
            {
                if i["app_id"].as_i64().map(|n| n.to_string()).as_deref()
                    == Some(&self.config()?.app_id)
                {
                    result.push(json!({"id":i["id"],"account":{"id":i["account"]["id"],"login":i["account"]["login"]},"suspended":!i["suspended_at"].is_null()}));
                }
            }
            ensure!(result.len() <= 1000, "installation limit exceeded");
            next = page.next;
        }
        self.authorize(user, org, true).await?;
        Ok(
            json!({"install_url":format!("https://github.com/apps/{}/installations/new",self.config()?.slug),"installations":result}),
        )
    }
    pub async fn repositories(&self, user: Uuid, org: Uuid, id: i64) -> Result<Value> {
        self.authorize(user, org, true).await?;
        ensure!(id > 0, "invalid installation");
        let token = self.user_token(user).await?;
        let mut next = Some(format!(
            "/user/installations/{id}/repositories?per_page=100"
        ));
        let mut result = vec![];
        while let Some(path) = next {
            let page = self
                .client
                .request(&token, Method::GET, &path, None, None)
                .await?;
            for i in page.value["repositories"]
                .as_array()
                .context("repository list unavailable")?
            {
                let repo: GithubRepository =
                    serde_json::from_value(i.clone()).context("repository metadata unavailable")?;
                result.push(repo);
            }
            ensure!(result.len() <= 1000, "repository selection limit exceeded");
            next = page.next;
        }
        self.authorize(user, org, true).await?;
        Ok(json!(result))
    }
    pub async fn select(&self, user: Uuid, org: Uuid, input: GithubSelection) -> Result<Value> {
        self.authorize(user, org, true).await?;
        ensure!(
            input.installation_id > 0
                && !input.repository_ids.is_empty()
                && input.repository_ids.len() <= 100,
            "select 1 to 100 repositories"
        );
        let token = self.user_token(user).await?;
        let available = self.repositories(user, org, input.installation_id).await?;
        let available: Vec<GithubRepository> = serde_json::from_value(available)?;
        let mut repos = vec![];
        let mut seen = std::collections::BTreeSet::new();
        for id in input.repository_ids {
            ensure!(seen.insert(id), "duplicate repository");
            let repo = available
                .iter()
                .find(|r| r.id == id)
                .context("repository outside authorized installation")?;
            // Permissions are checked with the user's own token, not an installation token.
            let detail = self
                .client
                .request(
                    &token,
                    Method::GET,
                    &format!("/repositories/{id}"),
                    None,
                    None,
                )
                .await?
                .value;
            ensure!(
                detail["permissions"]["admin"].as_bool() == Some(true),
                "GitHub repository administrator required"
            );
            repos.push(
                serde_json::from_value::<GithubRepository>(detail)
                    .context("invalid repository metadata")?,
            );
            ensure!(repo.id > 0, "invalid repository identity");
        }
        let installation = self
            .client
            .request(
                &self.config()?.app_jwt()?,
                Method::GET,
                &format!("/app/installations/{}", input.installation_id),
                None,
                None,
            )
            .await?
            .value;
        ensure!(
            installation["suspended_at"].is_null(),
            "GitHub installation suspended"
        );
        ensure!(
            installation["app_id"]
                .as_i64()
                .map(|v| v.to_string())
                .as_deref()
                == Some(&self.config()?.app_id),
            "installation belongs to another App"
        );
        for permission in ["metadata", "pull_requests", "issues", "checks", "statuses"] {
            ensure!(
                matches!(
                    installation["permissions"][permission].as_str(),
                    Some("read")
                ),
                "required App permission missing"
            );
        }
        self.authorize(user, org, true).await?;
        self.repo()?
            .select(
                user,
                org,
                input.installation_id,
                installation["account"]["id"]
                    .as_i64()
                    .context("installation owner missing")?,
                installation["account"]["login"]
                    .as_str()
                    .context("installation login missing")?,
                &repos,
                input.team_id,
            )
            .await?;
        self.status(user, org).await
    }
    pub async fn disconnect(&self, user: Uuid, org: Uuid) -> Result<()> {
        self.authorize(user, org, true).await?;
        self.repo()?.disconnect(org).await
    }
    pub async fn sync(&self, user: Uuid, org: Uuid) -> Result<()> {
        self.authorize(user, org, true).await?;
        self.config()?;
        self.repo()?.schedule(Some(org)).await
    }
    pub async fn binding(&self, user: Uuid, org: Uuid, input: ProjectBinding) -> Result<()> {
        self.authorize(user, org, false).await?;
        let repo = self
            .insights
            .as_deref()
            .context("canonical data unavailable")?;
        ensure!(
            repo.personal_project(user, input.project_id).await?,
            "project is not owned by current user"
        );
        let scope=self.repo()?.pg.query_opt("SELECT team_id FROM team_repository_scopes WHERE organization_id=$1 AND repository_id=$2 AND enabled",&[&org,&input.repository_id]).await?.context("repository unavailable")?;
        if let Some(team) = scope.get::<_, Option<Uuid>>(0) {
            self.authorization
                .require_team_read(user, org, Some(team))
                .await?;
        }
        self.repo()?.binding(org, user, &input).await
    }
    pub async fn projects(&self, user: Uuid, org: Uuid) -> Result<Value> {
        self.authorize(user, org, false).await?;
        let projects = self
            .insights
            .as_deref()
            .context("project data unavailable")?
            .personal_projects(user)
            .await?;
        let repositories=self.repo()?.pg.query("SELECT s.repository_id,r.full_name FROM team_repository_scopes s JOIN team_github_repositories r USING(organization_id,repository_id) WHERE s.organization_id=$1 AND s.enabled AND (s.team_id IS NULL OR EXISTS(SELECT 1 FROM team_members tm WHERE tm.team_id=s.team_id AND tm.user_id=$2) OR EXISTS(SELECT 1 FROM organization_members m WHERE m.organization_id=$1 AND m.user_id=$2 AND m.role IN ('owner','admin') AND m.deactivated_at IS NULL)) ORDER BY r.full_name",&[&org,&user]).await?.into_iter().map(|r|json!({"repository_id":r.get::<_,Uuid>(0),"full_name":r.get::<_,String>(1)})).collect::<Vec<_>>();
        self.authorize(user, org, false).await?;
        Ok(json!({"projects":projects,"repositories":repositories}))
    }
    pub async fn context(&self, user: Uuid, org: Uuid, event: SessionContext) -> Result<()> {
        self.authorize(user, org, false).await?;
        self.guard(org).await?;
        validate_context(&event, Utc::now())?;
        ensure!(self.enabled, "session context disabled");
        // Accept sanitized, consented metadata before canonical usage arrives. Verification
        // is a separate durable job; neither arrival order nor a transient CH failure loses it.
        let hash = hash_bytes(&serde_json::to_vec(&event)?);
        self.repo()?
            .store_context(org, user, &event, &hash, "pending")
            .await
    }
    pub async fn work_page(&self, user: Uuid, org: Uuid, query: GithubWorkQuery) -> Result<Value> {
        self.authorization
            .require_team_read(user, org, query.team_id)
            .await?;
        let generation = self.guard(org).await?;
        let result = self.repo()?.work_page(org, &query).await?;
        self.authorization
            .require_team_read(user, org, query.team_id)
            .await?;
        ensure!(
            self.guard(org).await? == generation,
            "sharing or access changed during work read"
        );
        Ok(result)
    }

    pub async fn own_work_page(&self, user: Uuid, org: Uuid, q: GithubWorkQuery) -> Result<Value> {
        self.authorize(user, org, false).await?;
        let generation = self.guard(org).await?;
        let result = self.repo()?.work_page_scoped(org, &q, Some(user)).await?;
        self.authorize(user, org, false).await?;
        ensure!(
            self.guard(org).await? == generation,
            "access changed during work selection"
        );
        Ok(result)
    }
    async fn guard(&self, org: Uuid) -> Result<i64> {
        let insights = self
            .insights
            .as_deref()
            .context("canonical data unavailable")?;
        ensure!(
            self.enabled && insights.enabled(org).await?,
            "Team is disabled"
        );
        crate::repository::team_trust::TeamTrustRepository::new(self.repo()?.pg.clone())
            .guard(org)
            .await?;
        insights.generation(org).await
    }

    pub async fn relations(
        &self,
        user: Uuid,
        org: Uuid,
        repository: Uuid,
        item: i64,
        q: RelationshipQuery,
    ) -> Result<Value> {
        self.authorize(user, org, false).await?;
        let generation = self.guard(org).await?;
        let result = self
            .repo()?
            .relation_history(org, user, repository, item, q.after.as_deref())
            .await?;
        self.authorize(user, org, false).await?;
        ensure!(
            self.guard(org).await? == generation,
            "relationship scope changed during request"
        );
        Ok(result)
    }
    pub async fn retry_contexts(&self, user: Uuid, org: Uuid) -> Result<Value> {
        self.authorize(user, org, false).await?;
        self.guard(org).await?;
        Ok(json!({"pending":self.repo()?.retry_contexts(org,user).await?}))
    }
    pub async fn sessions(&self, user: Uuid, org: Uuid, q: SessionPageQuery) -> Result<Value> {
        self.authorize(user, org, false).await?;
        let generation = self.guard(org).await?;
        let limit = q.limit.unwrap_or(50);
        ensure!(
            (1..=100).contains(&limit),
            GithubInputError("session limit must be 1 to 100")
        );
        if let Some(after) = &q.after {
            ensure!(
                after.len() == 64 && after.bytes().all(|b| b.is_ascii_hexdigit()),
                GithubInputError("invalid session cursor")
            );
        }
        let insights = self
            .insights
            .as_deref()
            .context("canonical sessions unavailable")?;
        let consent = insights.consent(org, user).await?;
        let from = consent
            .aggregate_from
            .context("aggregate consent required")?
            .max(crate::services::team_trust::cutoff(Utc::now()));
        let facts = insights
            .facts(
                &[user],
                from.timestamp() as u32,
                Utc::now().timestamp() as u32 + 1,
            )
            .await?;
        let projects = self.repo()?.own_projects(org, user).await?;
        let mut groups =
            std::collections::BTreeMap::<String, (DateTime<Utc>, DateTime<Utc>)>::new();
        for f in facts.iter().filter(|f| {
            f.project_attribution_method.as_deref() == Some("explicit_project_hint")
                && f.project_id.is_some_and(|p| projects.contains(&p))
        }) {
            let session = hash(&format!(
                "{}:{}:{}:{}:{}",
                f.user_id,
                f.ai_agent.len(),
                f.ai_agent,
                f.collector_id.as_deref().unwrap_or(""),
                f.ai_session_id
            ));
            let at =
                DateTime::from_timestamp(f.event_time as i64, 0).context("invalid session time")?;
            groups
                .entry(session)
                .and_modify(|(a, b)| {
                    *a = (*a).min(at);
                    *b = (*b).max(at);
                })
                .or_insert((at, at));
        }
        let remaining = groups
            .into_iter()
            .filter(|(s, _)| q.after.as_ref().is_none_or(|a| s > a))
            .collect::<Vec<_>>();
        let more = remaining.len() > limit;
        let mut items = vec![];
        let mut next = None;
        for (session, (start, end)) in remaining.into_iter().take(limit) {
            let links=self.repo()?.session_links(org,user,&session).await?.into_iter().map(|r|json!({"id":r.get::<_,Uuid>(0),"status":r.get::<_,String>(1),"revision":r.get::<_,i64>(2),"repository_id":r.get::<_,Uuid>(3),"work_item_id":r.get::<_,i64>(4)})).collect::<Vec<_>>();
            let candidates = self.repo()?.candidates(org, user, &session).await?;
            let context = self
                .repo()?
                .session_verifications(org, user, &session, from)
                .await?;
            let reason = if context.is_empty() {
                "repository_context_missing"
            } else if !context.iter().any(|r| r.get::<_, String>(0) == "verified") {
                "context_verification_pending"
            } else if candidates.as_array().is_none_or(|c| c.is_empty()) {
                "no_unique_branch_commit_candidate"
            } else {
                "repository_branch_commit"
            };
            next = Some(session.clone());
            items.push(json!({"session_id":session,"started_at":start,"last_event_at":end,"candidates":candidates,"links":links,"reason":reason}));
        }
        let context_health = self.repo()?.context_health(org, user).await?;
        self.authorize(user, org, false).await?;
        ensure!(
            self.guard(org).await? == generation,
            "sharing changed during session read"
        );
        Ok(
            json!({"items":items,"next":if more{next}else{None},"generation":generation,"context_health":context_health}),
        )
    }
    pub async fn suggestions(&self, user: Uuid, org: Uuid) -> Result<Value> {
        self.authorize(user, org, false).await?;
        let generation = self.guard(org).await?;
        let result = self.repo()?.suggestions(org, user).await?;
        self.authorize(user, org, false).await?;
        ensure!(
            self.guard(org).await? == generation,
            "sharing changed during request"
        );
        Ok(result)
    }
}
pub fn hash(raw: &str) -> String {
    hash_bytes(raw.as_bytes())
}
pub fn hash_bytes(raw: &[u8]) -> String {
    format!("{:x}", Sha256::digest(raw))
}
fn random_secret() -> Result<String> {
    use ring::rand::SecureRandom;
    let mut bytes = [0u8; 32];
    ring::rand::SystemRandom::new()
        .fill(&mut bytes)
        .map_err(|_| anyhow::anyhow!("secure random unavailable"))?;
    Ok(URL_SAFE_NO_PAD.encode(bytes))
}
pub fn validate_context(event: &SessionContext, now: DateTime<Utc>) -> Result<()> {
    let hex = |s: &str| {
        s.len() == 64
            && s.bytes()
                .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
    };
    ensure!(
        hex(&event.event_id) && hex(&event.session_id),
        GithubInputError("context identity must be an opaque hash")
    );
    ensure!(
        event.occurred_at <= now + chrono::Duration::minutes(5)
            && event.occurred_at >= now - chrono::Months::new(12),
        GithubInputError("context outside retention")
    );
    ensure!(
        event
            .branch
            .as_deref()
            .is_none_or(|s| !s.is_empty() && s.len() <= 256 && !s.chars().any(char::is_control)),
        GithubInputError("invalid branch")
    );
    ensure!(
        event
            .commit_sha
            .as_deref()
            .is_none_or(|s| matches!(s.len(), 40 | 64) && s.bytes().all(|b| b.is_ascii_hexdigit())),
        GithubInputError("invalid commit SHA")
    );
    ensure!(
        matches!(
            event.provenance.as_str(),
            "native_session_git" | "native_inline_git"
        ),
        GithubInputError("unsupported context provenance")
    );
    Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn context_rejects_old_replay_and_paths() {
        let mut c = SessionContext {
            event_id: "a".repeat(64),
            session_id: "b".repeat(64),
            collector_id: Uuid::new_v4(),
            project_id: Uuid::new_v4(),
            repository_id: Uuid::new_v4(),
            occurred_at: Utc::now(),
            branch: Some("codex/test".into()),
            commit_sha: Some("c".repeat(40)),
            provenance: "native_session_git".into(),
        };
        assert!(validate_context(&c, Utc::now()).is_ok());
        c.provenance = "current_git_for_old_transcript".into();
        assert!(validate_context(&c, Utc::now()).is_err());
        c.provenance = "native_session_git".into();
        c.session_id = "/Users/private".into();
        assert!(validate_context(&c, Utc::now()).is_err());
    }
}
