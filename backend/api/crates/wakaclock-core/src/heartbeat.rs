use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::{fmt, str::FromStr};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum EntityType {
    File,
    Domain,
    Url,
    App,
}

impl fmt::Display for EntityType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let value = match self {
            Self::File => "file",
            Self::Domain => "domain",
            Self::Url => "url",
            Self::App => "app",
        };
        f.write_str(value)
    }
}

impl FromStr for EntityType {
    type Err = String;

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        match value.to_ascii_lowercase().as_str() {
            "file" => Ok(Self::File),
            "domain" => Ok(Self::Domain),
            "url" => Ok(Self::Url),
            "app" => Ok(Self::App),
            other => Err(format!("unsupported entity_type: {other}")),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Category {
    Coding,
    Building,
    Debugging,
    Designing,
    Modeling,
    Meeting,
    Communicating,
}

impl fmt::Display for Category {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let value = match self {
            Self::Coding => "coding",
            Self::Building => "building",
            Self::Debugging => "debugging",
            Self::Designing => "designing",
            Self::Modeling => "modeling",
            Self::Meeting => "meeting",
            Self::Communicating => "communicating",
        };
        f.write_str(value)
    }
}

impl FromStr for Category {
    type Err = String;

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        match value.to_ascii_lowercase().as_str() {
            "coding" => Ok(Self::Coding),
            "building" => Ok(Self::Building),
            "debugging" => Ok(Self::Debugging),
            "designing" => Ok(Self::Designing),
            "modeling" => Ok(Self::Modeling),
            "meeting" => Ok(Self::Meeting),
            "communicating" => Ok(Self::Communicating),
            other => Err(format!("unsupported category: {other}")),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Heartbeat {
    pub user_id: Uuid,
    pub entity: String,
    pub entity_type: EntityType,
    pub time: f64,
    pub date: String,
    pub project: Option<String>,
    pub branch: Option<String>,
    pub language: Option<String>,
    pub dependencies: Vec<String>,
    pub lines: Option<u32>,
    pub line_number: Option<u32>,
    pub cursor_position: Option<u32>,
    pub is_write: bool,
    pub category: Category,
    pub editor: String,
    pub operating_system: String,
    pub machine: String,
    pub user_agent: String,
    pub ast_language: Option<String>,
    pub ast_confidence: Option<f32>,
    pub keystrokes: Option<u32>,
    pub chars_added: Option<u32>,
    pub chars_deleted: Option<u32>,
    pub active_seconds: Option<f64>,
    pub is_ai_generated: bool,
    pub ai_agent: Option<String>,
    pub ai_lines_added: Option<u32>,
    pub ai_lines_deleted: Option<u32>,
    pub created_at: String,
}

impl Heartbeat {
    pub fn new(user_id: Uuid, entity: String, entity_type: EntityType, user_agent: String) -> Self {
        let now = Utc::now();
        let time = now.timestamp_millis() as f64 / 1000.0;
        let date = now.format("%Y-%m-%d").to_string();

        Self {
            user_id,
            entity,
            entity_type,
            time,
            date,
            project: None,
            branch: None,
            language: None,
            dependencies: vec![],
            lines: None,
            line_number: None,
            cursor_position: None,
            is_write: false,
            category: Category::Coding,
            editor: String::new(),
            operating_system: String::new(),
            machine: String::new(),
            user_agent,
            ast_language: None,
            ast_confidence: None,
            keystrokes: None,
            chars_added: None,
            chars_deleted: None,
            active_seconds: None,
            is_ai_generated: false,
            ai_agent: None,
            ai_lines_added: None,
            ai_lines_deleted: None,
            created_at: now.to_rfc3339(),
        }
    }

    pub fn date_from_time(time: f64) -> String {
        let secs = time as i64;
        let dt = chrono::DateTime::from_timestamp(secs, 0).unwrap_or_else(Utc::now);
        dt.format("%Y-%m-%d").to_string()
    }

    pub fn validate(&self) -> Result<(), String> {
        if self.entity.trim().is_empty() {
            return Err("entity cannot be empty".to_string());
        }
        if self.time <= 0.0 {
            return Err("time must be positive".to_string());
        }
        if let Some(conf) = self.ast_confidence {
            if !(0.0..=1.0).contains(&conf) {
                return Err("ast_confidence must be between 0.0 and 1.0".to_string());
            }
        }
        if let Some(active_seconds) = self.active_seconds {
            if !active_seconds.is_finite() || active_seconds < 0.0 {
                return Err("active_seconds must be a non-negative finite number".to_string());
            }
        }
        Ok(())
    }

    pub fn is_duplicate_of(&self, other: &Heartbeat) -> bool {
        let time_diff = (self.time - other.time).abs();
        self.entity == other.entity
            && self.entity_type == other.entity_type
            && !self.is_write
            && time_diff < 120.0
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_new_heartbeat() {
        let hb = Heartbeat::new(
            Uuid::nil(),
            "src/main.rs".to_string(),
            EntityType::File,
            "wakaclock-cli/1.0".to_string(),
        );
        assert_eq!(hb.entity, "src/main.rs");
        assert!(!hb.is_write);
        assert!(!hb.is_ai_generated);
        assert!(!hb.date.is_empty());
        assert!(!hb.created_at.is_empty());
    }

    #[test]
    fn test_validate_empty_entity() {
        let hb = Heartbeat::new(
            Uuid::nil(),
            "".to_string(),
            EntityType::File,
            "wakaclock-cli/1.0".to_string(),
        );
        assert!(hb.validate().is_err());
    }

    #[test]
    fn test_duplicate_detection() {
        let hb1 = Heartbeat::new(
            Uuid::nil(),
            "src/main.rs".to_string(),
            EntityType::File,
            "wakaclock-cli/1.0".to_string(),
        );
        let mut hb2 = hb1.clone();
        hb2.time = hb1.time + 30.0;

        assert!(hb1.is_duplicate_of(&hb2));

        let mut hb3 = hb1.clone();
        hb3.is_write = true;
        assert!(!hb1.is_duplicate_of(&hb3));
    }

    #[test]
    fn test_date_from_time() {
        let date = Heartbeat::date_from_time(1704067200.0);
        assert_eq!(date, "2024-01-01");
    }

    #[test]
    fn parse_entity_type_and_category() {
        assert_eq!(EntityType::from_str("FILE").unwrap(), EntityType::File);
        assert_eq!(
            Category::from_str("debugging").unwrap(),
            Category::Debugging
        );
    }
}
