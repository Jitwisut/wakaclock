use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, clickhouse::Row)]
pub struct ProjectRuleRow {
    #[serde(with = "clickhouse::serde::uuid")]
    pub user_id: Uuid,
    #[serde(with = "clickhouse::serde::uuid")]
    pub rule_id: Uuid,
    pub pattern: String,
    pub project_name: String,
    pub priority: i32,
    pub is_active: bool,
    pub created_at: u32,
    pub updated_at: u32,
}
