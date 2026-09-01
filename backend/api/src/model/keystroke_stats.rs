use clickhouse::Row;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize)]
pub struct KeystrokeProjectItem {
    pub name: String,
    pub keystrokes: u64,
    pub chars_added: u64,
    pub chars_deleted: u64,
    pub copy_actions: u64,
    pub paste_actions: u64,
    pub copied_chars: u64,
    pub copied_lines: u64,
    pub pasted_chars: u64,
    pub pasted_lines: u64,
    pub paste_same_file_actions: u64,
    pub paste_same_workspace_actions: u64,
    pub paste_external_or_unknown_actions: u64,
}

#[derive(Debug, Serialize)]
pub struct KeystrokeDailyItem {
    pub date: String,
    pub keystrokes: u64,
    pub chars_added: u64,
    pub chars_deleted: u64,
    pub copy_actions: u64,
    pub paste_actions: u64,
    pub copied_chars: u64,
    pub copied_lines: u64,
    pub pasted_chars: u64,
    pub pasted_lines: u64,
    pub paste_same_file_actions: u64,
    pub paste_same_workspace_actions: u64,
    pub paste_external_or_unknown_actions: u64,
}

#[derive(Debug, Serialize)]
pub struct ClipboardCoverage {
    pub supported_vscode_heartbeats: u64,
    pub total_vscode_heartbeats: u64,
    pub percent: f64,
}

#[derive(Debug, Serialize)]
pub struct KeystrokeStatsData {
    pub total_keystrokes: u64,
    pub total_chars_added: u64,
    pub total_chars_deleted: u64,
    pub total_copy_actions: u64,
    pub total_paste_actions: u64,
    pub total_copied_chars: u64,
    pub total_copied_lines: u64,
    pub total_pasted_chars: u64,
    pub total_pasted_lines: u64,
    pub total_paste_same_file_actions: u64,
    pub total_paste_same_workspace_actions: u64,
    pub total_paste_external_or_unknown_actions: u64,
    pub days_with_activity: u64,
    pub clipboard_coverage: ClipboardCoverage,
    pub projects: Vec<KeystrokeProjectItem>,
    pub daily: Vec<KeystrokeDailyItem>,
}

#[derive(Debug, Serialize)]
pub struct KeystrokeStatsResponse {
    pub start: String,
    pub end: String,
    pub data: KeystrokeStatsData,
}

#[derive(Debug, Deserialize, Row)]
pub struct KeystrokeTotalsRow {
    pub total_keystrokes: u64,
    pub total_chars_added: u64,
    pub total_chars_deleted: u64,
    pub total_copy_actions: u64,
    pub total_paste_actions: u64,
    pub total_copied_chars: u64,
    pub total_copied_lines: u64,
    pub total_pasted_chars: u64,
    pub total_pasted_lines: u64,
    pub total_paste_same_file_actions: u64,
    pub total_paste_same_workspace_actions: u64,
    pub total_paste_external_or_unknown_actions: u64,
    pub days_with_activity: u64,
    pub supported_vscode_heartbeats: u64,
    pub total_vscode_heartbeats: u64,
}

#[derive(Debug, Deserialize, Row)]
pub struct KeystrokeProjectRow {
    pub name: String,
    pub keystrokes: u64,
    pub chars_added: u64,
    pub chars_deleted: u64,
    pub copy_actions: u64,
    pub paste_actions: u64,
    pub copied_chars: u64,
    pub copied_lines: u64,
    pub pasted_chars: u64,
    pub pasted_lines: u64,
    pub paste_same_file_actions: u64,
    pub paste_same_workspace_actions: u64,
    pub paste_external_or_unknown_actions: u64,
}

#[derive(Debug, Deserialize, Row)]
pub struct KeystrokeDailyRow {
    #[serde(rename = "day")]
    pub date: String,
    pub keystrokes: u64,
    pub chars_added: u64,
    pub chars_deleted: u64,
    pub copy_actions: u64,
    pub paste_actions: u64,
    pub copied_chars: u64,
    pub copied_lines: u64,
    pub pasted_chars: u64,
    pub pasted_lines: u64,
    pub paste_same_file_actions: u64,
    pub paste_same_workspace_actions: u64,
    pub paste_external_or_unknown_actions: u64,
}
