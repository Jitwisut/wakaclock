use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct GithubCallback {
    pub state: String,
    pub code: String,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct GithubSelection {
    pub installation_id: i64,
    pub repository_ids: Vec<i64>,
    pub team_id: Option<Uuid>,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ProjectBinding {
    pub project_id: Uuid,
    pub repository_id: Uuid,
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SessionContext {
    pub event_id: String,
    pub session_id: String,
    pub collector_id: Uuid,
    pub project_id: Uuid,
    pub repository_id: Uuid,
    pub occurred_at: DateTime<Utc>,
    pub branch: Option<String>,
    pub commit_sha: Option<String>,
    pub provenance: String,
}
#[derive(Serialize, Deserialize)]
pub struct GithubRepository {
    pub id: i64,
    pub node_id: String,
    pub full_name: String,
    pub default_branch: Option<String>,
    #[serde(default)]
    pub permissions: Option<GithubPermissions>,
}
#[derive(Serialize, Deserialize)]
pub struct GithubPermissions {
    #[serde(default)]
    pub admin: bool,
}

#[derive(Serialize)]
pub struct GithubHealth {
    pub status: &'static str,
    pub reason: &'static str,
    pub last_success_at: Option<DateTime<Utc>>,
    pub pending: Option<i64>,
    pub checked_at: DateTime<Utc>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct GithubWorkQuery {
    pub team_id: Option<Uuid>,
    pub after: Option<String>,
    pub limit: Option<i64>,
}

#[derive(Debug, thiserror::Error)]
#[error("{0}")]
pub struct GithubInputError(pub &'static str);

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SessionPageQuery {
    pub after: Option<String>,
    pub limit: Option<usize>,
}

#[derive(Debug, serde::Deserialize, Default)]
pub struct RelationshipQuery {
    pub after: Option<String>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SessionRepositoryBindingInput {
    pub session_id: String,
    pub repository_id: Option<Uuid>,
    pub expected_revision: i64,
    pub request_id: Uuid,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SessionRepositoryBindingQuery {
    pub session_id: String,
    pub before_revision: Option<i64>,
}

#[derive(serde::Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CopilotDailyConfiguration {
    pub installation_id: i64,
    pub start_day: chrono::NaiveDate,
    pub enabled: bool,
    pub expected_revision: i64,
}
#[derive(serde::Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CopilotDailyQuery {
    pub day: chrono::NaiveDate,
}
