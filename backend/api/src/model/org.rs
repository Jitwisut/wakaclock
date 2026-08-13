use clickhouse::Row;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// `role` is a free-form string rather than an enum at the storage layer, matching how
/// this codebase already treats `subscription_status` (see `model/user.rs`) — the set of
/// valid roles is enforced in `services/org.rs`, not by the column type.
pub const ROLE_OWNER: &str = "owner";
pub const ROLE_ADMIN: &str = "admin";
pub const ROLE_MEMBER: &str = "member";

#[derive(Debug, Clone, Serialize, Deserialize, Row)]
pub struct OrgRow {
    #[serde(with = "clickhouse::serde::uuid")]
    pub org_id: Uuid,
    pub name: String,
    #[serde(with = "clickhouse::serde::uuid")]
    pub owner_user_id: Uuid,
    pub created_at: u32,
    pub updated_at: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, Row)]
pub struct OrgMemberRow {
    #[serde(with = "clickhouse::serde::uuid")]
    pub org_id: Uuid,
    #[serde(with = "clickhouse::serde::uuid")]
    pub user_id: Uuid,
    pub role: String,
    pub joined_at: u32,
    pub updated_at: u32,
}
