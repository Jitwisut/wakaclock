//! Canonical GitHub/GitLab/Bitbucket repository, commit and pull-request state.
//!
//! Provider workers can call these idempotent upserts after OAuth/webhook
//! reconciliation. The request layer never accepts raw provider tokens.

use anyhow::{anyhow, Context, Result};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use chrono::{DateTime, Utc};
use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use tokio_postgres::Row;
use uuid::Uuid;

use crate::infrastructure::contracts::CredentialVault;
use crate::infrastructure::postgres::PostgresClient;
use crate::model::vcs::{
    Commit, CommitAnalytics, ConnectVcsRequest, ProjectMappingRequest, PullRequest,
    PullRequestAnalytics, Repository, RepositoryProjectMapping,
};
use crate::services::activity_timeline::{ActivityTimelineService, CanonicalInterval};
use crate::services::authorization::{AuthorizationService, OrganizationAction};
use crate::services::vcs_attribution::{
    attribute_commits, timeline_window, total_attribution, AttributionTotals, CommitAttribution,
    CommitWindowInput,
};

/// Every column the attribution path needs, with the commit author already resolved to a
/// local user. Identity resolution is deliberately done here in SQL rather than as a
/// second round trip: it is two `LEFT JOIN LATERAL`s on indexed columns, and doing it per
/// commit in Rust would be a query per row.
///
/// Both resolution paths are scoped to `organization_members`. A verified email or a
/// linked provider account proves who a person is, but it does not make their timeline
/// this organization's to read — without the membership join, an org could learn the
/// coding hours of anyone who happened to author a commit in its repositories.
const COMMIT_SELECT: &str = "SELECT c.id, c.repository_id, c.hash, c.branch, c.author_external_id,
                c.author_email, c.authored_at, c.committed_at, c.message_length,
                COALESCE(identity.user_id, email_match.user_id) AS author_user_id,
                COALESCE(mapping.project_ids, ARRAY[]::uuid[]) AS project_ids
         FROM commits c
         JOIN repositories r ON r.id = c.repository_id
         JOIN vcs_connections v ON v.id = r.vcs_connection_id
         LEFT JOIN LATERAL (
             SELECT vi.user_id FROM vcs_identities vi
             JOIN organization_members om ON om.user_id = vi.user_id
                AND om.organization_id = v.organization_id AND om.deactivated_at IS NULL
             WHERE vi.provider = v.provider AND vi.external_id = c.author_external_id
             LIMIT 1
         ) identity ON TRUE
         LEFT JOIN LATERAL (
             SELECT ue.user_id FROM user_emails ue
             JOIN organization_members om ON om.user_id = ue.user_id
                AND om.organization_id = v.organization_id AND om.deactivated_at IS NULL
             WHERE ue.is_verified AND lower(ue.email) = lower(c.author_email)
             LIMIT 1
         ) email_match ON TRUE
         LEFT JOIN LATERAL (
             SELECT array_agg(rp.project_id) AS project_ids FROM repository_projects rp
             WHERE rp.repository_id = c.repository_id
         ) mapping ON TRUE";

/// Which commits belong to one pull request. Bounded above by when the pull request
/// finished and below by the previous finished pull request on the same branch — branch
/// name is the only link `commits` gives us, and branch names get reused.
const PULL_REQUEST_COMMIT_FILTER: &str = "
         WHERE c.repository_id = $1
           AND c.branch IS NOT DISTINCT FROM $2
           AND ($3::timestamptz IS NULL OR c.committed_at <= $3)
           AND ($4::timestamptz IS NULL OR c.committed_at > $4)
         ORDER BY c.committed_at ASC NULLS LAST, c.id ASC";

pub struct VcsService {
    activity_timeline: Arc<ActivityTimelineService>,
    postgres: Option<Arc<PostgresClient>>,
    authorization: Arc<AuthorizationService>,
    credential_vault: Option<Arc<dyn CredentialVault>>,
}

impl VcsService {
    pub fn new(
        postgres: Option<Arc<PostgresClient>>,
        authorization: Arc<AuthorizationService>,
        activity_timeline: Arc<ActivityTimelineService>,
    ) -> Self {
        Self {
            activity_timeline,
            postgres,
            authorization,
            credential_vault: None,
        }
    }

    pub fn with_credential_vault(
        mut self,
        credential_vault: Option<Arc<dyn CredentialVault>>,
    ) -> Self {
        self.credential_vault = credential_vault;
        self
    }

    pub async fn connect(
        &self,
        actor: Uuid,
        request: ConnectVcsRequest,
    ) -> Result<Vec<Repository>> {
        validate_provider(&request.provider)?;
        self.authorization
            .require(
                actor,
                request.organization_id,
                OrganizationAction::ManageIntegrations,
                None,
            )
            .await?;
        let credentials = BASE64
            .decode(request.encrypted_credentials.trim())
            .context("encrypted_credentials must be base64")?;
        if credentials.len() < 16 || credentials.len() > 128 * 1024 {
            return Err(anyhow!("encrypted_credentials has an invalid size"));
        }
        if request.external_account_id.trim().is_empty() || request.external_account_id.len() > 320
        {
            return Err(anyhow!("external_account_id must contain 1-320 characters"));
        }
        let vault = self
            .credential_vault
            .as_ref()
            .context("integration credential vault is not configured")?;
        let plaintext = vault
            .open(request.organization_id, &credentials)
            .await
            .map_err(|_| anyhow!("encrypted_credentials failed vault validation"))?;
        if plaintext.is_empty() || plaintext.len() > 128 * 1024 {
            return Err(anyhow!(
                "encrypted_credentials has an invalid plaintext size"
            ));
        }
        let sealed_credentials = vault
            .seal(request.organization_id, &plaintext)
            .await
            .map_err(|_| anyhow!("failed to seal VCS credentials"))?;
        let postgres = self.required()?;
        let integration_id = Uuid::now_v7();
        let display_name = format!("{} VCS account", request.provider);
        postgres
            .client()
            .execute(
                "INSERT INTO integration_connections
                    (id, organization_id, provider, display_name, status, scopes)
                 VALUES ($1, $2, $3, $4, 'connected', '{}')
                 ON CONFLICT DO NOTHING",
                &[
                    &integration_id,
                    &request.organization_id,
                    &request.provider,
                    &display_name,
                ],
            )
            .await
            .context("failed to create VCS integration connection")?;
        postgres
            .client()
            .execute(
                "INSERT INTO integration_credentials (connection_id, encrypted_payload, key_version)
                 VALUES ($1, $2, 'credential-vault-v1')
                 ON CONFLICT (connection_id) DO UPDATE SET
                    encrypted_payload = EXCLUDED.encrypted_payload,
                    updated_at = now()",
                &[&integration_id, &sealed_credentials],
            )
            .await
            .context("failed to store VCS encrypted credentials")?;
        let connection_id = postgres
            .client()
            .query_one(
                "INSERT INTO vcs_connections
                    (id, organization_id, provider, external_account_id, encrypted_credentials_id)
                 VALUES ($1, $2, $3, $4, $5)
                 ON CONFLICT (organization_id, provider, external_account_id) DO UPDATE SET
                    encrypted_credentials_id = EXCLUDED.encrypted_credentials_id,
                    disconnected_at = NULL
                 RETURNING id",
                &[
                    &Uuid::now_v7(),
                    &request.organization_id,
                    &request.provider,
                    &request.external_account_id,
                    &integration_id,
                ],
            )
            .await
            .context("failed to upsert VCS connection")?
            .get::<_, Uuid>("id");

        let mut repositories = Vec::with_capacity(request.repositories.len());
        for input in request.repositories {
            validate_repository(&input.external_id, &input.full_name)?;
            let row = postgres
                .client()
                .query_one(
                    "INSERT INTO repositories
                        (id, vcs_connection_id, external_id, full_name, default_branch, is_private)
                     VALUES ($1, $2, $3, $4, $5, $6)
                     ON CONFLICT (vcs_connection_id, external_id) DO UPDATE SET
                        full_name = EXCLUDED.full_name,
                        default_branch = EXCLUDED.default_branch,
                        is_private = EXCLUDED.is_private,
                        updated_at = now()
                     RETURNING id, vcs_connection_id, external_id, full_name, default_branch,
                               is_private, created_at, updated_at",
                    &[
                        &Uuid::now_v7(),
                        &connection_id,
                        &input.external_id,
                        &input.full_name,
                        &input.default_branch,
                        &input.is_private,
                    ],
                )
                .await
                .context("failed to upsert repository")?;
            repositories.push(self.repository_from_row(
                row,
                connection_id,
                request.organization_id,
                &request.provider,
            )?);
        }
        Ok(repositories)
    }

    pub async fn repositories(
        &self,
        actor: Uuid,
        organization_id: Uuid,
    ) -> Result<Vec<Repository>> {
        self.authorization
            .require(
                actor,
                organization_id,
                OrganizationAction::ReadOrganization,
                None,
            )
            .await?;
        let postgres = self.required()?;
        let rows = postgres
            .client()
            .query(
                "SELECT r.id, r.vcs_connection_id, r.external_id, r.full_name,
                        r.default_branch, r.is_private, r.created_at, r.updated_at,
                        c.organization_id, c.provider
                 FROM repositories r JOIN vcs_connections c ON c.id = r.vcs_connection_id
                 WHERE c.organization_id = $1 AND c.disconnected_at IS NULL
                 ORDER BY r.full_name",
                &[&organization_id],
            )
            .await
            .context("failed to list repositories")?;
        rows.into_iter().map(repository_from_row).collect()
    }

    pub async fn map_project(
        &self,
        actor: Uuid,
        repository_id: Uuid,
        request: ProjectMappingRequest,
    ) -> Result<RepositoryProjectMapping> {
        let postgres = self.required()?;
        let organization_id = postgres
            .client()
            .query_one(
                "SELECT c.organization_id FROM repositories r
                 JOIN vcs_connections c ON c.id = r.vcs_connection_id WHERE r.id = $1",
                &[&repository_id],
            )
            .await
            .context("failed to resolve repository organization")?
            .get::<_, Uuid>("organization_id");
        self.authorization
            .require(
                actor,
                organization_id,
                OrganizationAction::ManageIntegrations,
                None,
            )
            .await?;
        if !matches!(
            request.mapping_source.as_str(),
            "manual" | "observed_head" | "import"
        ) {
            return Err(anyhow!(
                "mapping_source must be manual, observed_head or import"
            ));
        }
        let row = postgres
            .client()
            .query_one(
                "INSERT INTO repository_projects (repository_id, project_id, mapping_source)
                 VALUES ($1, $2, $3)
                 ON CONFLICT (repository_id, project_id) DO UPDATE SET mapping_source = EXCLUDED.mapping_source
                 RETURNING repository_id, project_id, mapping_source, created_at",
                &[&repository_id, &request.project_id, &request.mapping_source],
            )
            .await
            .context("failed to map repository project")?;
        Ok(RepositoryProjectMapping {
            repository_id: row.get("repository_id"),
            project_id: row.get("project_id"),
            mapping_source: row.get("mapping_source"),
            created_at: row.get("created_at"),
        })
    }

    pub async fn commits(
        &self,
        actor: Uuid,
        organization_id: Uuid,
        repository_id: Option<Uuid>,
        limit: i64,
    ) -> Result<Vec<Commit>> {
        self.authorization
            .require(
                actor,
                organization_id,
                OrganizationAction::ReadOrganization,
                None,
            )
            .await?;
        let postgres = self.required()?;
        let limit = limit.clamp(1, 1000);
        let rows = postgres
            .client()
            .query(
                "SELECT c.id, c.repository_id, c.hash, c.branch, c.author_external_id,
                        c.author_email, c.authored_at, c.committed_at, c.message_length
                 FROM commits c JOIN repositories r ON r.id = c.repository_id
                 JOIN vcs_connections v ON v.id = r.vcs_connection_id
                 WHERE v.organization_id = $1 AND ($2::uuid IS NULL OR c.repository_id = $2)
                 ORDER BY c.committed_at DESC NULLS LAST, c.id DESC LIMIT $3",
                &[&organization_id, &repository_id, &limit],
            )
            .await
            .context("failed to list commits")?;
        rows.into_iter().map(commit_from_row).collect()
    }

    pub async fn pull_requests(
        &self,
        actor: Uuid,
        organization_id: Uuid,
        repository_id: Option<Uuid>,
        limit: i64,
    ) -> Result<Vec<PullRequest>> {
        self.authorization
            .require(
                actor,
                organization_id,
                OrganizationAction::ReadOrganization,
                None,
            )
            .await?;
        let postgres = self.required()?;
        let limit = limit.clamp(1, 1000);
        let rows = postgres
            .client()
            .query(
                "SELECT p.id, p.repository_id, p.external_id, p.number, p.head_branch,
                        p.base_branch, p.author_external_id, p.opened_at, p.merged_at, p.closed_at
                 FROM pull_requests p JOIN repositories r ON r.id = p.repository_id
                 JOIN vcs_connections v ON v.id = r.vcs_connection_id
                 WHERE v.organization_id = $1 AND ($2::uuid IS NULL OR p.repository_id = $2)
                 ORDER BY p.opened_at DESC NULLS LAST, p.id DESC LIMIT $3",
                &[&organization_id, &repository_id, &limit],
            )
            .await
            .context("failed to list pull requests")?;
        rows.into_iter().map(pull_request_from_row).collect()
    }

    /// Commits with the coding time charged to each, newest first.
    pub async fn commit_analytics(
        &self,
        actor: Uuid,
        organization_id: Uuid,
        repository_id: Option<Uuid>,
        limit: i64,
    ) -> Result<Vec<CommitAnalytics>> {
        self.authorization
            .require(
                actor,
                organization_id,
                OrganizationAction::ReadOrganization,
                None,
            )
            .await?;
        let postgres = self.required()?;
        let limit = limit.clamp(1, 1000);
        let rows = postgres
            .client()
            .query(
                &format!(
                    "{COMMIT_SELECT}
                     WHERE v.organization_id = $1 AND ($2::uuid IS NULL OR c.repository_id = $2)
                     ORDER BY c.committed_at DESC NULLS LAST, c.id DESC LIMIT $3"
                ),
                &[&organization_id, &repository_id, &limit],
            )
            .await
            .context("failed to list commits for attribution")?;
        Ok(self
            .attribute(rows)
            .await?
            .into_iter()
            .map(commit_analytics)
            .collect())
    }

    pub async fn pull_request_analytics(
        &self,
        actor: Uuid,
        organization_id: Uuid,
        pull_request_id: Uuid,
    ) -> Result<Option<PullRequestAnalytics>> {
        self.authorization
            .require(
                actor,
                organization_id,
                OrganizationAction::ReadOrganization,
                None,
            )
            .await?;
        let postgres = self.required()?;
        let row = postgres
            .client()
            .query_opt(
                "SELECT p.id, p.repository_id, p.external_id, p.number, p.head_branch,
                        p.base_branch, p.author_external_id, p.opened_at, p.merged_at, p.closed_at
                 FROM pull_requests p JOIN repositories r ON r.id = p.repository_id
                 JOIN vcs_connections v ON v.id = r.vcs_connection_id
                 WHERE p.id = $1 AND v.organization_id = $2",
                &[&pull_request_id, &organization_id],
            )
            .await
            .context("failed to load pull request analytics")?;
        let Some(row) = row else { return Ok(None) };
        let pull_request = pull_request_from_row(row)?;

        // A pull request is measured through its commits rather than as a window of its
        // own: `commits` carries no `pull_request_id`, and even if it did, the span from
        // `opened_at` to `merged_at` counts review latency and waiting as coding. Summing
        // the branch's commits reuses one rule instead of inventing a second.
        //
        // Branch name is the only link we have, and branch names get reused — `develop`,
        // or a `feature/x` cut again after the first one merged. Without a lower bound the
        // second pull request would inherit every commit the first one already reported.
        // The bound is the previous finished pull request on the same branch, not this
        // one's `opened_at`: real commits routinely predate the pull request that carries
        // them, and cutting there would drop the work rather than the double count.
        let cutoff = pull_request.merged_at.or(pull_request.closed_at);
        let reference = cutoff.or(pull_request.opened_at);
        let floor: Option<DateTime<Utc>> = postgres
            .client()
            .query_one(
                "SELECT MAX(COALESCE(p.merged_at, p.closed_at)) AS boundary
                 FROM pull_requests p
                 WHERE p.repository_id = $1
                   AND p.head_branch IS NOT DISTINCT FROM $2
                   AND p.id <> $3
                   AND COALESCE(p.merged_at, p.closed_at) IS NOT NULL
                   AND ($4::timestamptz IS NULL
                        OR COALESCE(p.merged_at, p.closed_at) < $4)",
                &[
                    &pull_request.repository_id,
                    &pull_request.head_branch,
                    &pull_request.id,
                    &reference,
                ],
            )
            .await
            .context("failed to find the previous pull request on this branch")?
            .try_get("boundary")?;
        let commit_rows = postgres
            .client()
            .query(
                &format!("{COMMIT_SELECT}{PULL_REQUEST_COMMIT_FILTER}"),
                &[
                    &pull_request.repository_id,
                    &pull_request.head_branch,
                    &cutoff,
                    &floor,
                ],
            )
            .await
            .context("failed to load pull request commits")?;
        let attributed = self.attribute(commit_rows).await?;
        let totals = total_attribution(
            &attributed
                .iter()
                .map(|(_, attribution)| attribution.clone())
                .collect::<Vec<_>>(),
        );

        Ok(Some(PullRequestAnalytics {
            pull_request,
            coding_seconds: (totals.attributed_commits > 0).then_some(totals.coding_seconds),
            review_seconds: None,
            ai_lines: None,
            coverage: pull_request_coverage(&totals).to_string(),
            ai_seconds: (totals.attributed_commits > 0).then_some(totals.ai_seconds),
            attributed_commits: totals.attributed_commits,
            total_commits: totals.total_commits,
        }))
    }

    /// Attribute a loaded batch of commit rows.
    ///
    /// One `canonical` call per distinct author, over the widest window the batch needs.
    /// The timeline is a ClickHouse read shared with every dashboard page, so the cost of
    /// this has to scale with authors, not with commits.
    async fn attribute(&self, rows: Vec<Row>) -> Result<Vec<(Commit, CommitAttribution)>> {
        let mut commits = Vec::with_capacity(rows.len());
        let mut windows = Vec::with_capacity(rows.len());
        for row in rows {
            let author_user_id: Option<Uuid> = row.try_get("author_user_id")?;
            let project_ids: Vec<Uuid> = row.try_get("project_ids")?;
            let commit = commit_from_row(row)?;
            windows.push(CommitWindowInput {
                author_user_id,
                branch: commit.branch.clone(),
                commit_id: commit.id,
                committed_at: commit.committed_at.map(epoch_seconds),
                project_ids,
            });
            commits.push(commit);
        }

        let mut timelines: HashMap<Uuid, Vec<CanonicalInterval>> = HashMap::new();
        if let Some((start, end)) = timeline_window(&windows) {
            let authors: HashSet<Uuid> = windows
                .iter()
                .filter_map(|window| window.author_user_id)
                .collect();
            for author in authors {
                let intervals = self
                    .activity_timeline
                    .canonical(author, start, end)
                    .await
                    .with_context(|| format!("failed to read timeline for author {author}"))?;
                timelines.insert(author, intervals);
            }
        }

        let attributions = attribute_commits(&windows, &timelines);
        Ok(commits.into_iter().zip(attributions).collect())
    }

    fn repository_from_row(
        &self,
        row: Row,
        connection_id: Uuid,
        organization_id: Uuid,
        provider: &str,
    ) -> Result<Repository> {
        Ok(Repository {
            id: row.get("id"),
            connection_id,
            provider: provider.to_string(),
            organization_id,
            external_id: row.get("external_id"),
            full_name: row.get("full_name"),
            default_branch: row.get("default_branch"),
            is_private: row.get("is_private"),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
        })
    }

    fn required(&self) -> Result<&PostgresClient> {
        self.postgres
            .as_deref()
            .ok_or_else(|| anyhow!("PostgreSQL is not configured; set POSTGRES_URL"))
    }
}

fn validate_provider(provider: &str) -> Result<()> {
    if !matches!(provider, "github" | "gitlab" | "bitbucket") {
        return Err(anyhow!("provider must be github, gitlab or bitbucket"));
    }
    Ok(())
}

fn validate_repository(external_id: &str, full_name: &str) -> Result<()> {
    if external_id.trim().is_empty() || external_id.len() > 320 {
        return Err(anyhow!(
            "repository external_id must contain 1-320 characters"
        ));
    }
    if full_name.trim().is_empty() || full_name.len() > 320 {
        return Err(anyhow!(
            "repository full_name must contain 1-320 characters"
        ));
    }
    Ok(())
}

fn repository_from_row(row: Row) -> Result<Repository> {
    Ok(Repository {
        id: row.try_get("id")?,
        connection_id: row.try_get("vcs_connection_id")?,
        provider: row.try_get("provider")?,
        organization_id: row.try_get("organization_id")?,
        external_id: row.try_get("external_id")?,
        full_name: row.try_get("full_name")?,
        default_branch: row.try_get("default_branch")?,
        is_private: row.try_get("is_private")?,
        created_at: row.try_get("created_at")?,
        updated_at: row.try_get("updated_at")?,
    })
}

fn commit_analytics((commit, attribution): (Commit, CommitAttribution)) -> CommitAnalytics {
    CommitAnalytics {
        ai_seconds: attribution.ai_seconds,
        coding_seconds: attribution.coding_seconds,
        commit,
        coverage: attribution.coverage.as_str(),
        window_end: attribution.window_end,
        window_start: attribution.window_start,
    }
}

/// The timeline speaks in unix seconds; Postgres hands back a `DateTime`. Milliseconds
/// rather than whole seconds so a commit landing mid-second does not shift its own window.
fn epoch_seconds(at: DateTime<Utc>) -> f64 {
    at.timestamp_millis() as f64 / 1000.0
}

/// What the number on a pull request is worth, in one word the UI can branch on.
///
/// The old value here was a single fixed string saying the feature was unbuilt. It now
/// reports the actual state, and keeps "no commits at all" separate from "commits we
/// could not attribute" — those look identical as a zero and are not the same problem.
fn pull_request_coverage(totals: &AttributionTotals) -> &'static str {
    if totals.total_commits == 0 {
        "no_commits_synced"
    } else if totals.attributed_commits == 0 {
        "commits_unattributed"
    } else if totals.attributed_commits < totals.total_commits {
        "partially_attributed"
    } else {
        "fully_attributed"
    }
}

fn commit_from_row(row: Row) -> Result<Commit> {
    Ok(Commit {
        id: row.try_get("id")?,
        repository_id: row.try_get("repository_id")?,
        hash: row.try_get("hash")?,
        branch: row.try_get("branch")?,
        author_external_id: row.try_get("author_external_id")?,
        author_email: row.try_get("author_email")?,
        authored_at: row.try_get("authored_at")?,
        committed_at: row.try_get("committed_at")?,
        message_length: row.try_get("message_length")?,
        attribution_method: "metadata_only",
    })
}

fn pull_request_from_row(row: Row) -> Result<PullRequest> {
    Ok(PullRequest {
        id: row.try_get("id")?,
        repository_id: row.try_get("repository_id")?,
        external_id: row.try_get("external_id")?,
        number: row.try_get("number")?,
        head_branch: row.try_get("head_branch")?,
        base_branch: row.try_get("base_branch")?,
        author_external_id: row.try_get("author_external_id")?,
        opened_at: row.try_get("opened_at")?,
        merged_at: row.try_get("merged_at")?,
        closed_at: row.try_get("closed_at")?,
        attribution_method: "metadata_only",
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn totals(total: usize, attributed: usize) -> AttributionTotals {
        AttributionTotals {
            ai_seconds: 0.0,
            attributed_commits: attributed,
            coding_seconds: 0.0,
            total_commits: total,
        }
    }

    #[test]
    fn separates_a_pull_request_with_no_commits_from_one_we_could_not_attribute() {
        // Both render as zero seconds; only one of them is a data-sync problem.
        assert_eq!(pull_request_coverage(&totals(0, 0)), "no_commits_synced");
        assert_eq!(pull_request_coverage(&totals(3, 0)), "commits_unattributed");
        assert_eq!(pull_request_coverage(&totals(3, 2)), "partially_attributed");
        assert_eq!(pull_request_coverage(&totals(3, 3)), "fully_attributed");
    }

    #[test]
    fn separates_a_pull_request_from_an_earlier_one_that_reused_the_branch_name() {
        // `develop`, or a `feature/x` cut again after the first merged: without the lower
        // bound the second pull request inherits every commit the first already reported.
        assert!(PULL_REQUEST_COMMIT_FILTER.contains("c.committed_at > $4"));
        assert!(PULL_REQUEST_COMMIT_FILTER.contains("c.committed_at <= $3"));
        assert!(PULL_REQUEST_COMMIT_FILTER.contains("c.branch IS NOT DISTINCT FROM $2"));
    }

    #[test]
    fn resolves_a_commit_author_only_through_this_organization_members() {
        // The tenancy guard is in SQL, so assert the query still carries it: a verified
        // email proves identity, not that this org may read that person's timeline.
        assert_eq!(COMMIT_SELECT.matches("organization_members om").count(), 2);
        assert!(COMMIT_SELECT.contains("om.organization_id = v.organization_id"));
        assert!(COMMIT_SELECT.contains("om.deactivated_at IS NULL"));
    }
}
