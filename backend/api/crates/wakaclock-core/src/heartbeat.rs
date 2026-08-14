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
    /// Provider that emitted the attribution event (for example `openai` or `anthropic`).
    /// Kept separate from `ai_agent` so the dashboard can group tools and vendors
    /// independently when an agent can use more than one provider.
    pub ai_provider: Option<String>,
    /// Model reported by the agent, when the integration exposes it.
    pub ai_model: Option<String>,
    /// How the client obtained the attribution (`agent_hook`, `ide_telemetry`, ...).
    pub ai_source: Option<String>,
    /// Confidence label rather than a guessed probability. Unknown integrations must
    /// remain visibly unknown instead of being silently counted as human work.
    pub ai_confidence: Option<String>,
    /// Stable id supplied by an agent hook. This is used for retry/deduplication and is
    /// intentionally opaque to the server.
    pub ai_event_id: Option<String>,
    pub ai_lines_added: Option<u32>,
    pub ai_lines_deleted: Option<u32>,
    pub human_lines_added: Option<u32>,
    pub human_lines_deleted: Option<u32>,
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
            ai_provider: None,
            ai_model: None,
            ai_source: None,
            ai_confidence: None,
            ai_event_id: None,
            ai_lines_added: None,
            ai_lines_deleted: None,
            human_lines_added: None,
            human_lines_deleted: None,
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

    /// A symmetric relation: two heartbeats are duplicates of each other, not just of
    /// whichever one happens to be `self`. This matters because the one real caller
    /// (`ApiClient::filter_duplicates`) checks `heartbeat.is_duplicate_of(last)`, where
    /// `last` — the most recently accepted heartbeat — can itself be a save. Only
    /// checking `self.is_write` let a save silently protect an unrelated heartbeat that
    /// arrived shortly after it from ever being sent; a save is a meaningful event on
    /// either side of the comparison and must never let a pair be coalesced into one.
    pub fn is_duplicate_of(&self, other: &Heartbeat) -> bool {
        let time_diff = (self.time - other.time).abs();
        self.entity == other.entity
            && self.entity_type == other.entity_type
            && !self.is_write
            && !other.is_write
            && !self.carries_measurements()
            && time_diff < 120.0
    }

    /// Whether this heartbeat carries measured work that exists nowhere else.
    ///
    /// This is the difference between wakaclock's heartbeats and WakaTime's, and it is
    /// why `is_duplicate_of` cannot be a straight port of WakaTime's 2-minute same-file
    /// rule. A WakaTime heartbeat is a stateless "I was here" marker, so collapsing two
    /// of them inside one window loses nothing but a redundant timestamp. A wakaclock
    /// heartbeat additionally carries counters accumulated by the editor buffer since
    /// the previous flush (keystrokes, characters, lines, active seconds) — and the
    /// editor zeroes those counters as soon as the CLI call returns, regardless of
    /// whether the CLI actually delivered them. Dropping such a heartbeat therefore
    /// destroys the only copy of those measurements: a user typing continuously in one
    /// file had roughly half their keystroke/character totals silently discarded before
    /// this check existed.
    ///
    /// Only `self` is tested, never `other`: `other` is the previously accepted
    /// heartbeat, whose measurements are already stored server-side and are not at risk.
    fn carries_measurements(&self) -> bool {
        fn positive(value: Option<u32>) -> bool {
            value.is_some_and(|count| count > 0)
        }

        positive(self.keystrokes)
            || positive(self.chars_added)
            || positive(self.chars_deleted)
            || positive(self.human_lines_added)
            || positive(self.human_lines_deleted)
            || positive(self.ai_lines_added)
            || positive(self.ai_lines_deleted)
            || self.active_seconds.is_some_and(|seconds| seconds > 0.0)
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

    /// Regression test for silent data loss: a heartbeat carrying counters the editor
    /// accumulated since its last flush must never be dropped as a "duplicate". The
    /// editor zeroes those counters the moment the CLI returns, so dropping the
    /// heartbeat destroys the only copy. Measured against real behaviour: typing 220
    /// keystrokes across three 30-second flush windows in one file recorded only 100
    /// before this rule existed.
    #[test]
    fn heartbeat_carrying_measurements_is_never_a_duplicate() {
        let base = Heartbeat::new(
            Uuid::nil(),
            "src/main.rs".to_string(),
            EntityType::File,
            "wakaclock-cli/1.0".to_string(),
        );

        let mut later = base.clone();
        later.time = base.time + 30.0;
        assert!(
            later.is_duplicate_of(&base),
            "an empty presence heartbeat inside the window is still a duplicate"
        );

        for mutate in [
            (|hb: &mut Heartbeat| hb.keystrokes = Some(42)) as fn(&mut Heartbeat),
            |hb: &mut Heartbeat| hb.chars_added = Some(10),
            |hb: &mut Heartbeat| hb.chars_deleted = Some(3),
            |hb: &mut Heartbeat| hb.human_lines_added = Some(2),
            |hb: &mut Heartbeat| hb.human_lines_deleted = Some(1),
            |hb: &mut Heartbeat| hb.ai_lines_added = Some(7),
            |hb: &mut Heartbeat| hb.ai_lines_deleted = Some(4),
            |hb: &mut Heartbeat| hb.active_seconds = Some(12.5),
        ] {
            let mut measured = base.clone();
            measured.time = base.time + 30.0;
            mutate(&mut measured);
            assert!(
                !measured.is_duplicate_of(&base),
                "a heartbeat carrying measured work must survive dedup"
            );
        }
    }

    /// Explicit zeros are still "no new work" — an editor that reports `keystrokes: 0`
    /// rather than omitting the field must not defeat dedup and reintroduce the
    /// heartbeat spam the 2-minute window exists to prevent.
    #[test]
    fn zero_valued_counters_do_not_defeat_dedup() {
        let base = Heartbeat::new(
            Uuid::nil(),
            "src/main.rs".to_string(),
            EntityType::File,
            "wakaclock-cli/1.0".to_string(),
        );
        let mut zeroed = base.clone();
        zeroed.time = base.time + 30.0;
        zeroed.keystrokes = Some(0);
        zeroed.chars_added = Some(0);
        zeroed.active_seconds = Some(0.0);

        assert!(zeroed.is_duplicate_of(&base));
    }

    /// Regression test: `is_duplicate_of` used to only check `self.is_write`, so a save
    /// that arrived first would silently mark a later non-write heartbeat as its
    /// duplicate — the exact call shape `ApiClient::filter_duplicates` uses, where
    /// `self` is the newly-arriving heartbeat and `other` is the previously accepted
    /// one. The relation must hold regardless of which side of the pair the save is on.
    #[test]
    fn test_duplicate_detection_is_symmetric_in_is_write() {
        let hb1 = Heartbeat::new(
            Uuid::nil(),
            "src/main.rs".to_string(),
            EntityType::File,
            "wakaclock-cli/1.0".to_string(),
        );

        let mut save = hb1.clone();
        save.is_write = true;

        let mut later = hb1.clone();
        later.time = hb1.time + 30.0;

        assert!(!later.is_duplicate_of(&save));
        assert!(!save.is_duplicate_of(&later));
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
