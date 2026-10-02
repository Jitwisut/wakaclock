use clickhouse::Row;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize)]
pub struct ProjectItem {
    pub name: String,
    pub total_seconds: f64,
    pub hours: f64,
    pub text: String,
    pub heartbeats: u64,
}

#[derive(Debug, Serialize)]
pub struct ProjectsResponse {
    pub start: String,
    pub end: String,
    pub data: Vec<ProjectItem>,
}

#[derive(Debug, Deserialize, Row)]
pub struct ProjectRow {
    pub name: String,
    pub total_seconds: f64,
    pub heartbeat_count: u64,
}

/// One project's span, read from canonical heartbeats (merges applied by the service).
#[derive(Debug, Deserialize, Row)]
pub struct ProjectSpanRow {
    pub name: String,
    pub first_heartbeat_at: f64,
    pub last_heartbeat_at: f64,
    /// Empty when the project's heartbeats predate project identity.
    pub project_id: String,
}

/// `GET /users/current/projects` without a date range: WakaTime's project list.
#[derive(Debug, Serialize)]
pub struct WakaTimeProjectsResponse {
    pub data: Vec<WakaTimeProject>,
}

/// https://wakatime.com/developers#projects. Sharing, badges and colors are not
/// AtoAxis features, so those fields are empty rather than invented.
#[derive(Debug, Serialize)]
pub struct WakaTimeProject {
    pub id: String,
    pub name: String,
    pub repository: Option<serde_json::Value>,
    pub badge: Option<serde_json::Value>,
    pub color: Option<String>,
    pub clients: Vec<serde_json::Value>,
    pub has_public_url: bool,
    pub human_readable_last_heartbeat_at: String,
    pub last_heartbeat_at: String,
    pub human_readable_first_heartbeat_at: String,
    pub first_heartbeat_at: String,
    /// The project's AtoAxis dashboard page; null without a stable project id.
    pub url: Option<String>,
    pub urlencoded_name: String,
    pub created_at: String,
}

impl WakaTimeProject {
    pub fn new(user_id: uuid::Uuid, row: ProjectSpanRow, app_url: &str, now: f64) -> Self {
        let id = if row.project_id.is_empty() {
            // Stable per account and name, without exposing either.
            uuid::Uuid::new_v5(&user_id, row.name.as_bytes()).to_string()
        } else {
            row.project_id.clone()
        };
        let url = (!row.project_id.is_empty()).then(|| {
            format!(
                "{}/dashboard/wakaclock/projects/{}",
                app_url.trim_end_matches('/'),
                row.project_id
            )
        });
        let first = crate::model::summary::rfc3339(row.first_heartbeat_at);
        Self {
            id,
            urlencoded_name: urlencode(&row.name),
            name: row.name,
            repository: None,
            badge: None,
            color: None,
            clients: Vec::new(),
            has_public_url: false,
            human_readable_last_heartbeat_at: time_ago(now - row.last_heartbeat_at),
            last_heartbeat_at: crate::model::summary::rfc3339(row.last_heartbeat_at),
            human_readable_first_heartbeat_at: time_ago(now - row.first_heartbeat_at),
            created_at: first.clone(),
            first_heartbeat_at: first,
            url,
        }
    }
}

fn urlencode(value: &str) -> String {
    value
        .bytes()
        .map(|byte| match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                (byte as char).to_string()
            }
            other => format!("%{other:02X}"),
        })
        .collect()
}

/// `3 days ago`, WakaTime's relative wording.
fn time_ago(seconds: f64) -> String {
    let seconds = seconds.max(0.0) as u64;
    let (count, unit) = match seconds {
        0..=59 => return "just now".to_string(),
        60..=3_599 => (seconds / 60, "minute"),
        3_600..=86_399 => (seconds / 3_600, "hour"),
        86_400..=2_591_999 => (seconds / 86_400, "day"),
        2_592_000..=31_535_999 => (seconds / 2_592_000, "month"),
        _ => (seconds / 31_536_000, "year"),
    };
    format!("{count} {unit}{} ago", if count == 1 { "" } else { "s" })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn wakatime_project_has_documented_keys_and_stable_ids() {
        let user = uuid::Uuid::nil();
        let row = |id: &str| ProjectSpanRow {
            name: "my app/v2".to_string(),
            first_heartbeat_at: 1_756_684_800.0,
            last_heartbeat_at: 1_759_363_200.0,
            project_id: id.to_string(),
        };
        let now = 1_759_363_200.0 + 3.0 * 86_400.0;
        let legacy = WakaTimeProject::new(user, row(""), "https://atoaxis.com/", now);
        let json = serde_json::to_value(&legacy).unwrap();
        for key in [
            "id",
            "name",
            "repository",
            "badge",
            "color",
            "clients",
            "has_public_url",
            "human_readable_last_heartbeat_at",
            "last_heartbeat_at",
            "human_readable_first_heartbeat_at",
            "first_heartbeat_at",
            "url",
            "urlencoded_name",
            "created_at",
        ] {
            assert!(json.get(key).is_some(), "missing {key}");
        }
        assert_eq!(legacy.urlencoded_name, "my%20app%2Fv2");
        assert_eq!(legacy.human_readable_last_heartbeat_at, "3 days ago");
        assert_eq!(legacy.last_heartbeat_at, "2025-10-02T00:00:00Z");
        assert_eq!(legacy.url, None);
        assert_eq!(
            legacy.id,
            WakaTimeProject::new(user, row(""), "", now).id,
            "a project without identity keeps a stable id"
        );

        let known = WakaTimeProject::new(
            user,
            row("0199a1b2-0000-7000-8000-000000000001"),
            "https://atoaxis.com/",
            now,
        );
        assert_eq!(known.id, "0199a1b2-0000-7000-8000-000000000001");
        assert_eq!(
            known.url.as_deref(),
            Some("https://atoaxis.com/dashboard/wakaclock/projects/0199a1b2-0000-7000-8000-000000000001")
        );
    }

    #[test]
    fn time_ago_matches_wakatime_wording() {
        assert_eq!(time_ago(10.0), "just now");
        assert_eq!(time_ago(60.0), "1 minute ago");
        assert_eq!(time_ago(7_200.0), "2 hours ago");
        assert_eq!(time_ago(86_400.0), "1 day ago");
        assert_eq!(time_ago(40.0 * 86_400.0), "1 month ago");
        assert_eq!(time_ago(800.0 * 86_400.0), "2 years ago");
    }
}
