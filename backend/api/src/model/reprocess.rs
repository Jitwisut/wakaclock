use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Deserialize)]
pub struct ReprocessRequest {
    pub user_id: Uuid,
    pub start: String,
    pub end: String,
}

#[derive(Debug, Serialize)]
pub struct ReprocessData {
    pub user_id: Uuid,
    pub start: String,
    pub end: String,
    pub reprocessed_heartbeats: usize,
}

#[derive(Debug, Serialize)]
pub struct ReprocessResponse {
    pub status: String,
    pub data: ReprocessData,
}
