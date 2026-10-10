//! Bounded, resumable provider reads. No source/diff/comment/log endpoints are allowed.
use crate::{
    infrastructure::github::*,
    repository::team_github::{GithubJob, GithubRepositoryStore, SyncFact},
    services::team_webhooks::github_metadata,
};
use anyhow::{ensure, Context, Result};
use chrono::{DateTime, Utc};
use reqwest::Method;
use serde_json::{json, Value};
use std::{collections::BTreeMap, sync::Arc};

pub struct GithubSyncWorker {
    pub repo: Arc<GithubRepositoryStore>,
    config: GithubConfig,
    client: GithubClient,
    tokens: BTreeMap<(i64, i64), (String, DateTime<Utc>)>,
}
impl GithubSyncWorker {
    pub fn new(repo: Arc<GithubRepositoryStore>, config: GithubConfig) -> Result<Self> {
        Ok(Self {
            repo,
            config,
            client: GithubClient::new()?,
            tokens: BTreeMap::new(),
        })
    }
    async fn token(&mut self, job: &GithubJob) -> Result<String> {
        if let Some((token, expiry)) = self.tokens.get(&(job.installation, job.generation)) {
            if *expiry > Utc::now() {
                return Ok(token.clone());
            }
        }
        let rows=self.repo.pg.query("SELECT github_repository_id FROM team_repository_scopes WHERE organization_id=$1 AND github_installation_id=$2 AND enabled ORDER BY github_repository_id",&[&job.org,&job.installation]).await?;
        let ids: Vec<i64> = rows.into_iter().map(|r| r.get(0)).collect();
        ensure!(
            !ids.is_empty() && ids.len() <= 100,
            "invalid repository token scope"
        );
        let token = self
            .client
            .installation_token(&self.config, job.installation, &ids)
            .await?;
        self.tokens.insert(
            (job.installation, job.generation),
            (token.clone(), Utc::now() + chrono::Duration::minutes(50)),
        );
        Ok(token)
    }
    pub async fn tick(&mut self) -> Result<bool> {
        let Some(job) = self.repo.claim().await? else {
            return Ok(false);
        };
        let result = self.page(&job).await;
        if let Err(error) = result {
            let (code, wait, dead) = if let Some(e) = error.downcast_ref::<GithubFailure>() {
                (e.code, e.retry_seconds, matches!(e.code, "validation"))
            } else {
                ("sync_unconfirmed", 60, false)
            };
            if code == "auth_required" {
                self.tokens.remove(&(job.installation, job.generation));
            }
            let backoff = (60_i64.saturating_mul(1i64 << job.attempts.min(6))).min(3600);
            self.repo.fail(&job, code, wait.max(backoff), dead).await?;
        }
        Ok(true)
    }
    async fn get(&self, job: &GithubJob, token: &str, path: &str) -> Result<GithubPage> {
        self.repo.renew(job).await?;
        self.client
            .request(token, Method::GET, path, None, None)
            .await
    }
    async fn page(&mut self, job: &GithubJob) -> Result<()> {
        let (github_repo, mut name) = self.repo.repository_metadata(job).await?;
        let token = self.token(job).await?;
        let mut cp = job.checkpoint.clone();
        cp["observed_at"] = json!(Utc::now().to_rfc3339());
        if cp["repository_checked"].as_bool() != Some(true) {
            let etag = self.repo.repository_etag(job).await?;
            self.repo.renew(job).await?;
            let page = self
                .client
                .request(
                    &token,
                    Method::GET,
                    &format!("/repositories/{github_repo}"),
                    None,
                    etag.as_deref(),
                )
                .await?;
            if !page.unchanged {
                let metadata: crate::model::team_github::GithubRepository =
                    serde_json::from_value(page.value)
                        .context("repository metadata unavailable")?;
                ensure!(metadata.id == github_repo, "repository identity changed");
                self.repo
                    .refresh_repository(job, &metadata, page.etag.as_deref())
                    .await?;
                name = metadata.full_name;
            }
            cp["repository_checked"] = json!(true);
        }
        ensure!(
            name.split('/').count() == 2
                && name
                    .bytes()
                    .all(|b| b.is_ascii_alphanumeric() || b"/._-".contains(&b)),
            "invalid repository API name"
        );
        if job.kind == "incremental" && cp["cutoff"].is_null() {
            let row=self.repo.pg.query_opt("SELECT last_success_at FROM team_github_checkpoints WHERE organization_id=$1 AND repository_id=$2",&[&job.org,&job.repository]).await?;
            if let Some(at) = row.and_then(|r| r.get::<_, Option<DateTime<Utc>>>(0)) {
                cp["cutoff"] = json!((at - chrono::Duration::minutes(5)).to_rfc3339());
            }
        }
        let mut items = vec![];
        let mut facts = vec![];
        let mut complete = false;
        if job.kind == "detail" {
            let phase = cp["phase"].as_str().unwrap_or("current").to_string();
            let number = cp["number"].as_i64().context("work number missing")?;
            let item = cp["external_id"].as_i64().context("work id missing")?;
            let base = format!("/repos/{name}/pulls/{number}");
            match phase.as_str() {
                "current" => {
                    let page = self.get(job, &token, &base).await?;
                    ensure!(
                        page.value["id"].as_i64() == Some(item),
                        "PR identity changed"
                    );
                    let raw = json!({"action":"edited","installation":{"id":job.installation},"repository":{"id":github_repo},"pull_request":page.value});
                    let metadata = github_metadata("pull_request", &serde_json::to_vec(&raw)?)?
                        .context("PR metadata unavailable")?;
                    cp["head_sha"] =
                        json!(metadata.details.as_ref().and_then(|d| d.head_sha.clone()));
                    cp["author_id"] = json!(metadata.item.as_ref().and_then(|i| i.author_id));
                    cp["phase"] = json!("reviews");
                    cp["next"] = Value::Null;
                    items.push(metadata);
                }
                "reviews" => {
                    let path = cp["next"]
                        .as_str()
                        .map(str::to_string)
                        .unwrap_or(format!("{base}/reviews?per_page=100"));
                    let page = self.get(job, &token, &path).await?;
                    for r in page.value.as_array().context("review response schema")? {
                        if let Some(at) = r["submitted_at"].as_str() {
                            let at = at.parse()?;
                            let id = r["id"].as_i64().context("review id missing")?;
                            facts.push(SyncFact{kind:"review".into(),external_id:id.to_string(),work_item:Some(item),at,metadata:json!({"id":id,"author_id":r["user"]["id"],"author_type":r["user"]["type"],"state":r["state"].as_str().unwrap_or("UNKNOWN").to_uppercase()})});
                        }
                    }
                    if let Some(next) = page.next {
                        cp["next"] = json!(next)
                    } else {
                        cp["next"] = Value::Null;
                        cp["phase"] = json!("timeline");
                    }
                }
                "timeline" | "relations" => {
                    let parts: Vec<_> = name.split('/').collect();
                    let fields = if phase == "timeline" {
                        "timelineItems(first:100,after:$cursor,itemTypes:[READY_FOR_REVIEW_EVENT,CONVERT_TO_DRAFT_EVENT,REOPENED_EVENT]) {pageInfo{hasNextPage endCursor} nodes{__typename ... on ReadyForReviewEvent{id createdAt} ... on ConvertToDraftEvent{id createdAt} ... on ReopenedEvent{id createdAt}}}"
                    } else {
                        "closingIssuesReferences(first:100,after:$cursor){pageInfo{hasNextPage endCursor} nodes{id databaseId number repository{databaseId}}}"
                    };
                    let query="query($owner:String!,$name:String!,$number:Int!,$cursor:String){repository(owner:$owner,name:$name){pullRequest(number:$number){id createdAt updatedAt isDraft state headRefName headRefOid headRepository{databaseId} author{__typename ... on User{databaseId} ... on Bot{databaseId}} mergedAt closedAt FIELDS}}}".replace("FIELDS",fields);
                    self.repo.renew(job).await?;
                    let response=self.client.request(&token,Method::POST,"/graphql",Some(&json!({"query":query,"variables":{"owner":parts[0],"name":parts[1],"number":number,"cursor":cp["cursor"]}})),None).await?.value;
                    ensure!(response["errors"].is_null(), "GraphQL metadata unavailable");
                    let pr = &response["data"]["repository"]["pullRequest"];
                    ensure!(!pr.is_null(), "pull request metadata unavailable");
                    let connection = &pr[if phase == "timeline" {
                        "timelineItems"
                    } else {
                        "closingIssuesReferences"
                    }];
                    if phase == "timeline" {
                        // Created non-draft PRs are ready from creation only when no draft transition contradicts that history.
                        let nodes = connection["nodes"]
                            .as_array()
                            .context("timeline nodes missing")?;
                        for n in nodes {
                            let kind = match n["__typename"].as_str() {
                                Some("ReadyForReviewEvent") => "ready",
                                Some("ConvertToDraftEvent") => "draft",
                                _ => "reopened",
                            };
                            facts.push(SyncFact {
                                kind: kind.into(),
                                external_id: n["id"]
                                    .as_str()
                                    .context("timeline identity missing")?
                                    .into(),
                                work_item: Some(item),
                                at: n["createdAt"]
                                    .as_str()
                                    .context("timeline time missing")?
                                    .parse()?,
                                metadata: json!({"provenance":"github_timeline"}),
                            });
                        }
                        cp["has_draft_transition"] = json!(
                            cp["has_draft_transition"].as_bool().unwrap_or(false)
                                || nodes.iter().any(|n| matches!(
                                    n["__typename"].as_str(),
                                    Some("ConvertToDraftEvent" | "ReadyForReviewEvent")
                                ))
                        );
                        if connection["pageInfo"]["hasNextPage"].as_bool() == Some(false)
                            && cp["has_draft_transition"].as_bool() == Some(false)
                            && pr["isDraft"].as_bool() == Some(false)
                        {
                            facts.push(SyncFact {
                                kind: "ready".into(),
                                external_id: format!("created:{item}"),
                                work_item: Some(item),
                                at: pr["createdAt"]
                                    .as_str()
                                    .context("creation timestamp missing")?
                                    .parse()?,
                                metadata: json!({"provenance":"github_created_non_draft"}),
                            });
                        }
                    } else {
                        let stamp = pr["updatedAt"].clone();
                        if !cp["relations_updated_at"].is_null()
                            && cp["relations_updated_at"] != stamp
                        {
                            // Persist a restart checkpoint; retrying the old cursor would
                            // otherwise fail forever after a PR changed during pagination.
                            cp["relations_updated_at"] = Value::Null;
                            cp["cursor"] = Value::Null;
                            cp["closing_relation_ids"] = json!([]);
                            self.repo.commit_sync(job, &[], &[], &cp, false).await?;
                            return Ok(());
                        }
                        cp["relations_updated_at"] = stamp;
                        let mut seen = cp["closing_relation_ids"]
                            .as_array()
                            .cloned()
                            .unwrap_or_default();
                        for n in connection["nodes"]
                            .as_array()
                            .context("relation nodes missing")?
                        {
                            seen.push(json!({"repository_id":n["repository"]["databaseId"],"issue_id":n["databaseId"]}));
                            ensure!(seen.len() <= 10000, "relation ledger limit exceeded");
                            facts.push(SyncFact{kind:"closing_issue".into(),external_id:format!("{}:{}",item,n["id"].as_str().context("issue identity missing")?),work_item:Some(item),at:Utc::now(),metadata:json!({"issue_id":n["databaseId"],"issue_number":n["number"],"repository_id":n["repository"]["databaseId"],"relationship":"closing","provenance":"github_current_relation","historical_at":null})});
                        }
                        cp["closing_relation_ids"] = json!(seen);
                    }
                    if connection["pageInfo"]["hasNextPage"].as_bool() == Some(true) {
                        cp["cursor"] = connection["pageInfo"]["endCursor"].clone();
                    } else {
                        cp["cursor"] = Value::Null;
                        cp["phase"] = json!(if phase == "timeline" {
                            "relations"
                        } else {
                            "reference_timeline"
                        });
                    }
                }
                "reference_timeline" => {
                    let path = cp["next"].as_str().map(str::to_string).unwrap_or(format!(
                        "/repos/{name}/issues/{number}/timeline?per_page=100"
                    ));
                    let page = self.get(job, &token, &path).await?;
                    for n in page.value.as_array().context("reference timeline schema")? {
                        if n["event"].as_str() != Some("cross-referenced")
                            || !n["source"]["issue"]["pull_request"].is_null()
                        {
                            continue;
                        }
                        let Some(repository_url) = n["source"]["issue"]["repository_url"].as_str()
                        else {
                            continue;
                        };
                        let Some(full) =
                            repository_url.strip_prefix("https://api.github.com/repos/")
                        else {
                            continue;
                        };
                        let row = self.repo.selected_repository(job.org, full).await?;
                        if let Some(row) = row {
                            if let Some(mut fact) = reference_fact(n, row.get(0))? {
                                fact.work_item = Some(item);
                                facts.push(fact);
                            }
                        }
                    }
                    cp["next"] = page.next.map_or(Value::Null, |p| json!(p));
                    if cp["next"].is_null() {
                        cp["phase"] = json!("checks");
                    }
                }
                "checks" | "statuses" => {
                    let sha = cp["head_sha"].as_str().context("head SHA unavailable")?;
                    ensure!(
                        matches!(sha.len(), 40 | 64) && sha.bytes().all(|b| b.is_ascii_hexdigit()),
                        "invalid head SHA"
                    );
                    let path = cp["next"].as_str().map(str::to_string).unwrap_or(format!(
                        "/repos/{name}/commits/{sha}/{}?per_page=100",
                        if phase == "checks" {
                            "check-runs"
                        } else {
                            "statuses"
                        }
                    ));
                    let page = self.get(job, &token, &path).await?;
                    let rows = if phase == "checks" {
                        page.value["check_runs"].as_array()
                    } else {
                        page.value.as_array()
                    }
                    .context("check response schema")?;
                    for r in rows {
                        let at = r["completed_at"]
                            .as_str()
                            .or(r["started_at"].as_str())
                            .or(r["updated_at"].as_str())
                            .or(r["created_at"].as_str())
                            .map(str::parse)
                            .transpose()?
                            .unwrap_or_else(Utc::now);
                        facts.push(SyncFact{kind:if phase=="checks"{"check_run"}else{"status"}.into(),external_id:r["id"].as_i64().context("check id missing")?.to_string(),work_item:Some(item),at,metadata:json!({"head_sha":sha,"status":if phase=="checks"{r["status"].clone()}else{r["state"].clone()},"conclusion":r["conclusion"],"name":r["name"],"attempt":r["run_attempt"],"context":if phase=="statuses"{r["context"].clone()}else{Value::Null},"source_at":r["completed_at"].as_str().or(r["started_at"].as_str()).or(r["updated_at"].as_str()).or(r["created_at"].as_str()),"provider":"github"})});
                    }
                    if let Some(next) = page.next {
                        cp["next"] = json!(next)
                    } else if phase == "checks" {
                        cp["phase"] = json!("statuses");
                        cp["next"] = Value::Null;
                    } else {
                        complete = true;
                    }
                }
                _ => anyhow::bail!("unknown sync phase"),
            }
        } else {
            let phase = cp["phase"].as_str().unwrap_or("issues").to_string();
            let cutoff = cp["cutoff"]
                .as_str()
                .map(str::to_string)
                .unwrap_or((Utc::now() - chrono::Duration::days(90)).to_rfc3339());
            cp["cutoff"] = json!(cutoff);
            let path=cp["next"].as_str().map(str::to_string).unwrap_or_else(||match phase.as_str(){"issues"=>format!("/repos/{name}/issues?state=all&sort=updated&direction=desc&per_page=100&since={cutoff}"),"open_issues"=>format!("/repos/{name}/issues?state=open&per_page=100"),"pulls"=>format!("/repos/{name}/pulls?state=all&sort=updated&direction=desc&per_page=100"),_=>format!("/repos/{name}/pulls?state=open&per_page=100")});
            let page = self.get(job, &token, &path).await?;
            let rows = page.value.as_array().context("work list schema")?;
            let mut older = false;
            for row in rows {
                if phase == "pulls"
                    && row["updated_at"]
                        .as_str()
                        .context("updated timestamp missing")?
                        .parse::<DateTime<Utc>>()?
                        < cutoff.parse::<DateTime<Utc>>()?
                {
                    older = true;
                    continue;
                }
                if matches!(phase.as_str(), "issues" | "open_issues")
                    && !row["pull_request"].is_null()
                {
                    continue;
                }
                let event = if matches!(phase.as_str(), "issues" | "open_issues") {
                    "issues"
                } else {
                    "pull_request"
                };
                let mut raw = json!({"action":"edited","installation":{"id":job.installation},"repository":{"id":github_repo}});
                raw[if event == "issues" {
                    "issue"
                } else {
                    "pull_request"
                }] = row.clone();
                if let Some(metadata) = github_metadata(event, &serde_json::to_vec(&raw)?)? {
                    items.push(metadata);
                }
            }
            if let Some(next) = page.next.filter(|_| !older) {
                cp["next"] = json!(next);
            } else {
                cp["next"] = Value::Null;
                cp["phase"] = json!(match phase.as_str() {
                    "issues" => "open_issues",
                    "open_issues" => "pulls",
                    "pulls" => "open_pulls",
                    _ => {
                        complete = true;
                        "done"
                    }
                });
            }
        }
        self.repo
            .commit_sync(job, &items, &facts, &cp, complete)
            .await
    }
}

pub fn ci_state(current_sha: &str, checks: &[Value]) -> &'static str {
    let current: Vec<_> = checks
        .iter()
        .filter(|c| c["head_sha"].as_str() == Some(current_sha))
        .collect();
    if current.is_empty()
        || current.iter().any(|c| {
            c.get("source_at").is_some_and(Value::is_null)
                || c.get("at").is_some_and(Value::is_null)
        })
    {
        return "unavailable";
    }
    if current.iter().any(|c| {
        matches!(
            c["status"].as_str(),
            Some("pending" | "queued" | "in_progress")
        )
    }) {
        return "pending";
    }
    if current.iter().any(|c| {
        matches!(c["status"].as_str(), Some("failure" | "error"))
            || matches!(
                c["conclusion"].as_str(),
                Some("failure" | "timed_out" | "action_required")
            )
    }) {
        return "failure";
    }
    if current
        .iter()
        .any(|c| c["conclusion"].as_str() == Some("cancelled"))
    {
        return "cancelled";
    }
    if current.iter().all(|c| {
        c["status"].as_str() == Some("success") || c["conclusion"].as_str() == Some("success")
    }) {
        "success"
    } else if current
        .iter()
        .all(|c| c["conclusion"].as_str() == Some("skipped"))
    {
        "skipped"
    } else if current
        .iter()
        .all(|c| c["conclusion"].as_str() == Some("neutral"))
    {
        "neutral"
    } else if current.iter().all(|c| {
        matches!(
            c["conclusion"].as_str(),
            Some("success" | "skipped" | "neutral")
        )
    }) {
        "mixed_non_failure"
    } else {
        "unavailable"
    }
}
/// Allowlisted relationship metadata only. Never inspect issue title/body/comment contents.
pub fn reference_fact(n: &Value, repository: i64) -> Result<Option<SyncFact>> {
    if n["event"].as_str() != Some("cross-referenced") {
        return Ok(None);
    }
    let issue = n["source"]["issue"]["id"]
        .as_i64()
        .context("referenced issue identity missing")?;
    let id = n["id"]
        .as_i64()
        .context("reference event identity missing")?;
    let at = n["created_at"]
        .as_str()
        .context("reference event time unavailable")?
        .parse()?;
    Ok(Some(SyncFact {
        kind: "reference_issue".into(),
        external_id: format!("reference:{id}"),
        work_item: None,
        at,
        metadata: json!({"issue_id":issue,"repository_id":repository,"relationship":"reference","source_at":at,"action":"present","provenance":"github_reference_timeline"}),
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn issue_reference_preserves_source_time_and_only_allowlisted_metadata() {
        let input = json!({"id":111,"event":"cross-referenced","created_at":"2026-10-07T00:00:00Z","source":{"issue":{"id":222,"title":"FORBIDDEN_TITLE","body":"FORBIDDEN_BODY"}},"comment":{"body":"FORBIDDEN_COMMENT"}});
        let fact = reference_fact(&input, 333).unwrap().unwrap();
        assert_eq!(fact.external_id, "reference:111");
        assert_eq!(fact.metadata["issue_id"], 222);
        assert_eq!(fact.at.to_rfc3339(), "2026-10-07T00:00:00+00:00");
        assert!(!fact.metadata.to_string().contains("FORBIDDEN"));
        assert!(
            reference_fact(&json!({"event":"commented","body":"FORBIDDEN"}), 333)
                .unwrap()
                .is_none()
        );
        assert!(reference_fact(
            &json!({"event":"cross-referenced","id":111,"source":{"issue":{"id":222}}}),
            333
        )
        .is_err());
    }
    #[test]
    fn old_green_sha_is_not_current_green() {
        assert_eq!(
            ci_state("new", &[json!({"head_sha":"old","conclusion":"success"})]),
            "unavailable"
        );
        assert_eq!(
            ci_state("new", &[json!({"head_sha":"new","status":"in_progress"})]),
            "pending"
        );
        assert_eq!(
            ci_state(
                "new",
                &[json!({"head_sha":"new","status":"completed","conclusion":"skipped"})]
            ),
            "skipped"
        );
    }
}
