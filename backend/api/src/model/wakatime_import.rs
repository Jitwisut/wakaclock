use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct WakaTimeImportRequest {
    pub dump_json: String,
}

#[derive(Debug, Serialize)]
pub struct WakaTimeImportData {
    pub user_id: Uuid,
    pub import_id: String,
    pub imported_heartbeats: usize,
    pub skipped_heartbeats: usize,
}

#[derive(Debug, Serialize)]
pub struct WakaTimeImportResponse {
    pub status: String,
    pub data: WakaTimeImportData,
}

#[derive(Debug, Deserialize)]
pub struct WakaTimeDump {
    pub user: WakaTimeDumpUser,
    #[serde(default)]
    pub days: Vec<WakaTimeDumpDay>,
}

#[derive(Debug, Deserialize)]
pub struct WakaTimeDumpUser {
    #[serde(default)]
    pub last_plugin: Option<String>,
    #[serde(default)]
    pub last_plugin_name: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct WakaTimeDumpDay {
    #[serde(default)]
    pub heartbeats: Option<Vec<WakaTimeHeartbeat>>,
    #[serde(default)]
    pub grand_total: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct WakaTimeHeartbeat {
    pub entity: String,
    #[serde(rename = "type")]
    pub entity_type: String,
    pub time: f64,
    #[serde(default)]
    pub project: Option<String>,
    #[serde(default)]
    pub branch: Option<String>,
    #[serde(default)]
    pub language: Option<String>,
    #[serde(default)]
    pub dependencies: Vec<String>,
    #[serde(default)]
    pub lines: Option<u32>,
    #[serde(rename = "lineno", default)]
    pub line_number: Option<u32>,
    #[serde(rename = "cursorpos", default)]
    pub cursor_position: Option<u32>,
    #[serde(default)]
    pub is_write: bool,
    #[serde(default)]
    pub category: Option<String>,
    #[serde(default)]
    pub created_at: Option<String>,
    #[serde(default)]
    pub ai_input_tokens: Option<u32>,
    #[serde(default)]
    pub ai_output_tokens: Option<u32>,
    #[serde(default)]
    pub ai_session: Option<String>,
    #[serde(default)]
    pub ai_line_changes: Option<i32>,
    #[serde(default)]
    pub human_line_changes: Option<i32>,
    #[serde(default)]
    pub machine_name_id: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn import_rejects_server_paths() {
        assert!(serde_json::from_value::<WakaTimeImportRequest>(
            serde_json::json!({"file_path":"/etc/passwd"})
        )
        .is_err());
        assert!(serde_json::from_value::<WakaTimeImportRequest>(
            serde_json::json!({"dump_json":"{}", "file_path":"/tmp/other"})
        )
        .is_err());
        assert!(serde_json::from_value::<WakaTimeImportRequest>(
            serde_json::json!({"dump_json":"{}"})
        )
        .is_ok());
    }
}
