use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// A rebuild request always creates a complete replacement snapshot for the selected
/// UTC date range. The server publishes it only after every projection table has been
/// populated, so readers never have to combine a half-old and half-new aggregate.
#[derive(Debug, Deserialize)]
pub struct AccountProjectionRebuildRequest {
    pub start: String,
    pub end: String,
}

#[derive(Debug, Serialize)]
pub struct AccountProjectionRebuildData {
    pub user_id: Uuid,
    pub start: String,
    pub end: String,
    pub data_version: u64,
    pub source_heartbeats: u64,
    pub source_usage_events: u64,
}

#[derive(Debug, Serialize)]
pub struct AccountProjectionRebuildResponse {
    pub status: String,
    pub data: AccountProjectionRebuildData,
}
