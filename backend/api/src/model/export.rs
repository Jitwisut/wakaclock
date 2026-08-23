use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Deserialize)]
pub struct CreateExportRequest {
    pub format: String,
    pub scope: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct ExportJob {
    pub id: Uuid,
    pub format: String,
    pub scope: String,
    pub status: String,
    pub progress: i16,
    pub requested_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
    pub expires_at: Option<DateTime<Utc>>,
    pub download_url: Option<String>,
    pub checksum: Option<String>,
}
