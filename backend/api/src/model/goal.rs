use chrono::{NaiveDate, NaiveDateTime};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize)]
pub struct Goal {
    pub id: Uuid,
    pub name: String,
    pub metric: String,
    pub filter_kind: String,
    pub filter_value: Option<String>,
    pub period: String,
    pub target_seconds: i64,
    pub direction: String,
    pub timezone: String,
    pub starts_on: NaiveDate,
    pub ends_on: Option<NaiveDate>,
    pub priority: i32,
    pub public: bool,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateGoalRequest {
    pub name: String,
    pub metric: String,
    pub filter_kind: String,
    pub filter_value: Option<String>,
    pub period: String,
    pub target_seconds: i64,
    pub direction: String,
    pub timezone: Option<String>,
    pub starts_on: NaiveDate,
    pub ends_on: Option<NaiveDate>,
    pub priority: Option<i32>,
    pub public: Option<bool>,
}

#[derive(Debug, Clone, Deserialize, Default)]
pub struct UpdateGoalRequest {
    pub name: Option<String>,
    pub metric: Option<String>,
    pub filter_kind: Option<String>,
    pub filter_value: Option<String>,
    pub period: Option<String>,
    pub target_seconds: Option<i64>,
    pub direction: Option<String>,
    pub timezone: Option<String>,
    pub starts_on: Option<NaiveDate>,
    pub ends_on: Option<NaiveDate>,
    pub priority: Option<i32>,
    pub public: Option<bool>,
}

#[derive(Debug, Clone, Serialize)]
pub struct GoalProgress {
    pub goal_id: Uuid,
    pub period: String,
    pub current_seconds: f64,
    pub target_seconds: i64,
    pub percentage: f64,
    pub direction: String,
    pub on_track: bool,
    pub coverage: f64,
}
