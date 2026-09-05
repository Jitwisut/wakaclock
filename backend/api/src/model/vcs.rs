use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Deserialize)]
pub struct ConnectVcsRequest {
    pub organization_id: Uuid,
    pub provider: String,
    pub external_account_id: String,
    /// Client/KMS envelope-encrypted provider credentials. Raw tokens are not accepted.
    pub encrypted_credentials: String,
    #[serde(default)]
    pub repositories: Vec<RepositoryInput>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct RepositoryInput {
    pub external_id: String,
    pub full_name: String,
    pub default_branch: Option<String>,
    #[serde(default = "default_private")]
    pub is_private: bool,
}

fn default_private() -> bool {
    true
}

#[derive(Debug, Clone, Serialize)]
pub struct Repository {
    pub id: Uuid,
    pub connection_id: Uuid,
    pub provider: String,
    pub organization_id: Uuid,
    pub external_id: String,
    pub full_name: String,
    pub default_branch: Option<String>,
    pub is_private: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ProjectMappingRequest {
    pub project_id: Uuid,
    #[serde(default = "default_mapping_source")]
    pub mapping_source: String,
}

fn default_mapping_source() -> String {
    "manual".to_string()
}

#[derive(Debug, Clone, Serialize)]
pub struct RepositoryProjectMapping {
    pub repository_id: Uuid,
    pub project_id: Uuid,
    pub mapping_source: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize)]
pub struct Commit {
    pub id: Uuid,
    pub repository_id: Uuid,
    pub hash: String,
    pub branch: Option<String>,
    pub author_external_id: Option<String>,
    pub authored_at: Option<DateTime<Utc>>,
    pub committed_at: Option<DateTime<Utc>>,
    pub message_length: Option<i32>,
    pub attribution_method: &'static str,
}

#[derive(Debug, Clone, Serialize)]
pub struct PullRequest {
    pub id: Uuid,
    pub repository_id: Uuid,
    pub external_id: String,
    pub number: i32,
    pub head_branch: Option<String>,
    pub base_branch: Option<String>,
    pub author_external_id: Option<String>,
    pub opened_at: Option<DateTime<Utc>>,
    pub merged_at: Option<DateTime<Utc>>,
    pub closed_at: Option<DateTime<Utc>>,
    pub attribution_method: &'static str,
}

#[derive(Debug, Clone, Serialize)]
pub struct PullRequestAnalytics {
    pub pull_request: PullRequest,
    pub coding_seconds: Option<f64>,
    pub review_seconds: Option<f64>,
    pub ai_lines: Option<u64>,
    pub coverage: String,
}
