//! Canonical GitHub/GitLab/Bitbucket repository, commit and pull-request state.
//!
//! Provider workers can call these idempotent upserts after OAuth/webhook
//! reconciliation. The request layer never accepts raw provider tokens.

use anyhow::{anyhow, Context, Result};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use std::sync::Arc;
use tokio_postgres::Row;
use uuid::Uuid;

use crate::infrastructure::postgres::PostgresClient;
use crate::model::vcs::{
    Commit, ConnectVcsRequest, ProjectMappingRequest, PullRequest, PullRequestAnalytics,
    Repository, RepositoryProjectMapping,
};
use crate::services::authorization::{AuthorizationService, OrganizationAction};

pub struct VcsService {
    postgres: Option<Arc<PostgresClient>>,
    authorization: Arc<AuthorizationService>,
}

impl VcsService {
    pub fn new(
        postgres: Option<Arc<PostgresClient>>,
        authorization: Arc<AuthorizationService>,
    ) -> Self {
        Self {
            postgres,
            authorization,
        }
    }

    pub async fn connect(&self, actor: Uuid, request: ConnectVcsRequest) -> Result<Vec<Repository>> {
        validate_provider(&request.provider)?;
        self.authorization
            .require(actor, request.organization_id, OrganizationAction::ManageIntegrations, None)
            .await?;
        let credentials = BASE64
            .decode(request.encrypted_credentials.trim())
            .context("encrypted_credentials must be base64")?;
        if credentials.len() < 16 || credentials.len() > 128 * 1024 {
            return Err(anyhow!("encrypted_credentials has an invalid size"));
        }
        if request.external_account_id.trim().is_empty() || request.external_account_id.len() > 320 {
            return Err(anyhow!("external_account_id must contain 1-320 characters"));
        }
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
                &[&integration_id, &request.organization_id, &request.provider, &display_name],
            )
            .await
            .context("failed to create VCS integration connection")?;
        postgres
            .client()
            .execute(
                "INSERT INTO integration_credentials (connection_id, encrypted_payload, key_version)
                 VALUES ($1, $2, 'client-envelope-v1')
                 ON CONFLICT (connection_id) DO UPDATE SET
                    encrypted_payload = EXCLUDED.encrypted_payload,
                    updated_at = now()",
                &[&integration_id, &credentials],
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
            repositories.push(self.repository_from_row(row, connection_id, request.organization_id, &request.provider)?);
        }
        Ok(repositories)
    }

    pub async fn repositories(&self, actor: Uuid, organization_id: Uuid) -> Result<Vec<Repository>> {
        self.authorization
            .require(actor, organization_id, OrganizationAction::ReadOrganization, None)
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
            .require(actor, organization_id, OrganizationAction::ManageIntegrations, None)
            .await?;
        if !matches!(request.mapping_source.as_str(), "manual" | "observed_head" | "import") {
            return Err(anyhow!("mapping_source must be manual, observed_head or import"));
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
            .require(actor, organization_id, OrganizationAction::ReadOrganization, None)
            .await?;
        let postgres = self.required()?;
        let limit = limit.clamp(1, 1000);
        let rows = postgres
            .client()
            .query(
                "SELECT c.id, c.repository_id, c.hash, c.branch, c.author_external_id,
                        c.authored_at, c.committed_at, c.message_length
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
            .require(actor, organization_id, OrganizationAction::ReadOrganization, None)
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

    pub async fn pull_request_analytics(
        &self,
        actor: Uuid,
        organization_id: Uuid,
        pull_request_id: Uuid,
    ) -> Result<Option<PullRequestAnalytics>> {
        self.authorization
            .require(actor, organization_id, OrganizationAction::ReadOrganization, None)
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
        Ok(Some(PullRequestAnalytics {
            pull_request: pull_request_from_row(row)?,
            coding_seconds: None,
            review_seconds: None,
            ai_lines: None,
            coverage: "vcs_metadata_only_until_heartbeat_head_provenance_is_synced".to_string(),
        }))
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
        return Err(anyhow!("repository external_id must contain 1-320 characters"));
    }
    if full_name.trim().is_empty() || full_name.len() > 320 {
        return Err(anyhow!("repository full_name must contain 1-320 characters"));
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

fn commit_from_row(row: Row) -> Result<Commit> {
    Ok(Commit {
        id: row.try_get("id")?,
        repository_id: row.try_get("repository_id")?,
        hash: row.try_get("hash")?,
        branch: row.try_get("branch")?,
        author_external_id: row.try_get("author_external_id")?,
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
