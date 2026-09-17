use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Deserialize)]
pub struct ReprocessRequest {
    /// Reprocessing can rewrite aggregates and historical project IDs.  It is opt-in;
    /// callers must send `false` after first inspecting the dry-run response.
    pub dry_run: Option<bool>,
    pub start: String,
    pub end: String,
}

#[derive(Debug, Serialize)]
pub struct ReprocessData {
    pub audit_id: Uuid,
    pub data_version: Option<u64>,
    pub dry_run: bool,
    pub project_ids_written: u64,
    pub resolved_heartbeats: u64,
    pub user_id: Uuid,
    pub start: String,
    pub end: String,
    pub reprocessed_heartbeats: usize,
    pub unresolved_heartbeats: u64,
}

#[derive(Debug, Serialize)]
pub struct ReprocessResponse {
    pub status: String,
    pub data: ReprocessData,
}

#[derive(Debug, Serialize)]
pub struct ReprocessAcceptedData {
    pub job_id: Uuid,
    pub job_status: String,
    pub deduplicated: bool,
    pub status_url: String,
}

#[derive(Debug, Serialize)]
pub struct ReprocessAcceptedResponse {
    pub status: String,
    pub data: ReprocessAcceptedData,
}
