use clickhouse::Row;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize)]
pub struct UserData {
    pub id: Uuid,
    pub username: String,
    pub email: String,
    pub is_active: bool,
}

#[derive(Debug, Serialize)]
pub struct UserResponse {
    pub data: UserData,
}

#[derive(Debug, Deserialize, Row)]
pub struct UserRow {
    pub username: String,
    pub email: String,
    pub is_active: bool,
}
