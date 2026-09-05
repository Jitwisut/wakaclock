use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use wakaclock_core::heartbeat::Category;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "lowercase")]
pub enum DesktopCategory {
    Coding,
    Building,
    Debugging,
    Designing,
    Modeling,
    Meeting,
    Communicating,
}

impl DesktopCategory {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Coding => "coding",
            Self::Building => "building",
            Self::Debugging => "debugging",
            Self::Designing => "designing",
            Self::Modeling => "modeling",
            Self::Meeting => "meeting",
            Self::Communicating => "communicating",
        }
    }
}

impl From<DesktopCategory> for Category {
    fn from(value: DesktopCategory) -> Self {
        match value {
            DesktopCategory::Coding => Category::Coding,
            DesktopCategory::Building => Category::Building,
            DesktopCategory::Debugging => Category::Debugging,
            DesktopCategory::Designing => Category::Designing,
            DesktopCategory::Modeling => Category::Modeling,
            DesktopCategory::Meeting => Category::Meeting,
            DesktopCategory::Communicating => Category::Communicating,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct AppRule {
    pub id: String,
    pub label: String,
    pub identifiers: Vec<String>,
    pub enabled: bool,
    pub category: DesktopCategory,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ForegroundApp {
    pub app_name: String,
    pub identifier: String,
    pub pid: u32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub window_title: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct TrackedActivity {
    pub app_name: String,
    pub identifier: String,
    pub entity: String,
    pub category: DesktopCategory,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum TrackerStatus {
    Active,
    Idle,
    Paused,
    Private,
    Unmonitored,
    Unavailable,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RuntimeSnapshot {
    pub status: TrackerStatus,
    pub app_name: Option<String>,
    pub app_identifier: Option<String>,
    pub category: Option<DesktopCategory>,
    pub idle_seconds: f64,
    pub last_heartbeat_at: Option<f64>,
    pub last_error: Option<String>,
}

impl Default for RuntimeSnapshot {
    fn default() -> Self {
        Self {
            status: TrackerStatus::Unavailable,
            app_name: None,
            app_identifier: None,
            category: None,
            idle_seconds: 0.0,
            last_heartbeat_at: None,
            last_error: None,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct DashboardSnapshot {
    pub today_seconds: f64,
    pub today_text: String,
    pub heartbeat_count: u64,
    pub queued_seconds: f64,
    pub api_connected: bool,
    pub runtime: RuntimeSnapshot,
    pub session_seconds: f64,
    pub category_seconds: BTreeMap<String, f64>,
}
