use clickhouse::Row;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, Row)]
pub struct TeamRow {
    #[serde(with = "clickhouse::serde::uuid")]
    pub team_id: Uuid,
    #[serde(with = "clickhouse::serde::uuid")]
    pub org_id: Uuid,
    pub name: String,
    pub created_at: u32,
    pub updated_at: u32,
}

/// `role` mirrors `model::org`'s roles (owner/admin/member) — a team member's role is
/// independent of their org-level role; someone can be an org `member` but a team `admin`.
#[derive(Debug, Clone, Serialize, Deserialize, Row)]
pub struct TeamMemberRow {
    #[serde(with = "clickhouse::serde::uuid")]
    pub team_id: Uuid,
    #[serde(with = "clickhouse::serde::uuid")]
    pub user_id: Uuid,
    pub role: String,
    pub joined_at: u32,
    pub updated_at: u32,
}
