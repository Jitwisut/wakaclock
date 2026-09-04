use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::{fmt, str::FromStr};
use uuid::Uuid;

/// How close in time two heartbeats for the same file must be before the later one is
/// considered a duplicate. Ported from WakaTime's same-file rule, which its editor
/// plugins apply per file — see `ApiClient`'s dedup cache, which must key on entity for
/// this window to mean the same thing here as it does there.
pub const MAX_ACTIVITY_GAP_SECONDS: f64 = 120.0;
pub const DEDUP_WINDOW_SECONDS: f64 = MAX_ACTIVITY_GAP_SECONDS;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ActivitySegment {
    pub segment_id: String,
    pub start: f64,
    pub end: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
}

/// Length of the union of valid activity intervals. Overlapping heartbeats from
/// multiple windows/sources therefore contribute a second only once.
pub fn union_activity_seconds(segments: &[ActivitySegment]) -> f64 {
    let mut ordered: Vec<(f64, f64)> = segments
        .iter()
        .filter(|segment| {
            segment.start.is_finite() && segment.end.is_finite() && segment.end > segment.start
        })
        .map(|segment| (segment.start, segment.end))
        .collect();
    ordered.sort_by(|left, right| {
        left.0
            .partial_cmp(&right.0)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| {
                left.1
                    .partial_cmp(&right.1)
                    .unwrap_or(std::cmp::Ordering::Equal)
            })
    });
    let mut total = 0.0;
    let mut current: Option<(f64, f64)> = None;
    for (start, end) in ordered {
        match current {
            None => current = Some((start, end)),
            Some((current_start, current_end)) if start > current_end => {
                total += current_end - current_start;
                current = Some((start, end));
            }
            Some((current_start, current_end)) => {
                current = Some((current_start, current_end.max(end)));
            }
        }
    }
    if let Some((start, end)) = current {
        total += end - start;
    }
    total.max(0.0)
}

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
    /// Stable project identity (plan.md 9.3). Always `None` on the wire: clients send a
    /// project *name* and the server resolves it, because identity has to survive renames
    /// and merges that a client cannot see. Present on this shared struct only so the
    /// resolved value can reach the ClickHouse row.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub project_id: Option<Uuid>,
    pub branch: Option<String>,
    /// VCS provenance supplied by an official integration when available.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub head_revision: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub repository_id: Option<Uuid>,
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
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub machine_name_hash: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub hostname_hash: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub timezone: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub feature_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub feature_name: Option<String>,
    /// Stable transport identity. Retries, offline queue flushes and process restarts
    /// must carry the same value so the server can accept a heartbeat at most once.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub heartbeat_id: Option<String>,
    pub ast_language: Option<String>,
    pub ast_confidence: Option<f32>,
    pub keystrokes: Option<u32>,
    pub chars_added: Option<u32>,
    pub chars_deleted: Option<u32>,
    pub active_seconds: Option<f64>,
    /// Explicit intervals are the canonical source of duration. `active_seconds` remains
    /// for backwards compatibility with older clients and imported WakaTime payloads.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub activity_segments: Vec<ActivitySegment>,
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
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ai_change_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub prompt_character_count: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub input_tokens: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub output_tokens: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cache_read_tokens: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cache_write_tokens: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ai_subscription_plan: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub token_source: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub attribution_source: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub attribution_confidence: Option<f32>,
    pub ai_lines_added: Option<u32>,
    pub ai_lines_deleted: Option<u32>,
    pub human_lines_added: Option<u32>,
    pub human_lines_deleted: Option<u32>,
    /// Lines whose provenance could not be proven as either AI or manual. Keeping this
    /// separate from the human counters prevents an uncorrelated agent edit from silently
    /// inflating the human metric.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub unattributed_lines_added: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub unattributed_lines_deleted: Option<u32>,
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
            project_id: None,
            branch: None,
            head_revision: None,
            repository_id: None,
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
            machine_name_hash: None,
            hostname_hash: None,
            timezone: None,
            feature_id: None,
            feature_name: None,
            heartbeat_id: None,
            ast_language: None,
            ast_confidence: None,
            keystrokes: None,
            chars_added: None,
            chars_deleted: None,
            active_seconds: None,
            activity_segments: vec![],
            is_ai_generated: false,
            ai_agent: None,
            ai_provider: None,
            ai_model: None,
            ai_source: None,
            ai_confidence: None,
            ai_event_id: None,
            ai_change_id: None,
            prompt_character_count: None,
            input_tokens: None,
            output_tokens: None,
            cache_read_tokens: None,
            cache_write_tokens: None,
            ai_subscription_plan: None,
            token_source: None,
            attribution_source: None,
            attribution_confidence: None,
            ai_lines_added: None,
            ai_lines_deleted: None,
            human_lines_added: None,
            human_lines_deleted: None,
            unattributed_lines_added: None,
            unattributed_lines_deleted: None,
            created_at: now.to_rfc3339(),
        }
    }

    pub fn date_from_time(time: f64) -> String {
        let secs = time as i64;
        let dt = chrono::DateTime::from_timestamp(secs, 0).unwrap_or_else(Utc::now);
        dt.format("%Y-%m-%d").to_string()
    }

    /// Enforce the accuracy-first attribution boundary at every client/server
    /// transport boundary.
    ///
    /// A name is publishable only when the payload identifies a verified edit
    /// transport.  Filesystem/process observation, editor telemetry, and legacy
    /// clients may still prove that *some* AI activity happened, but they do not
    /// prove which tool made the change.  Keep that activity in the AI totals as
    /// an unattributed/inferred row while removing the identity fields that would
    /// otherwise turn a guess into a dashboard fact.
    ///
    /// The method is deliberately idempotent so it can run in the CLI, API client,
    /// and server ingestion service without changing already-sanitized payloads.
    pub fn enforce_attribution_policy(&mut self) {
        let has_identity =
            self.ai_agent.is_some() || self.ai_provider.is_some() || self.ai_model.is_some();
        let verified_source = self
            .ai_source
            .as_deref()
            .map(|source| source.trim().to_ascii_lowercase())
            .is_some_and(|source| {
                matches!(
                    source.as_str(),
                    "agent_hook" | "mcp" | "structured_mcp" | "transcript"
                )
            });
        let verified_confidence = self
            .ai_confidence
            .as_deref()
            .is_some_and(|confidence| confidence.trim().eq_ignore_ascii_case("verified"));

        // A provider/model without a client name is not an identity either. Keep
        // those fields coupled to the named agent so a malformed legacy payload
        // cannot expose partial attribution metadata.
        let verified_identity = self
            .ai_agent
            .as_deref()
            .is_some_and(|agent| !agent.trim().is_empty())
            && verified_source
            && verified_confidence;

        if has_identity && !verified_identity {
            // The identity itself is evidence that the heartbeat is AI activity;
            // stripping it must never reclassify the work as human.
            self.is_ai_generated = true;
            self.ai_agent = None;
            self.ai_provider = None;
            self.ai_model = None;
            self.ai_confidence = Some("inferred".to_string());
            self.attribution_confidence = None;
            // Keep only a generic, non-identifying provenance label.  Raw observer
            // evidence (paths, process names, prompts and diffs) is local-only.
            self.ai_source = Some("observer".to_string());
            self.attribution_source = None;
        } else if has_identity {
            // A verified identity is authoritative even when an old client forgot
            // the redundant boolean flag.
            self.is_ai_generated = true;
        } else if self.is_ai_generated && self.ai_agent.is_none() {
            // Historical/observer rows may arrive already unattributed.  Normalize
            // their label without inventing an agent identity.
            self.ai_provider = None;
            self.ai_model = None;
            self.ai_confidence = Some("inferred".to_string());
            self.attribution_confidence = None;
        }
    }

    /// Whether this heartbeat carries an identity that passed the verified-tier
    /// source and confidence checks.  This is useful to response serializers that
    /// must hide identity on historical rows written before the policy existed.
    pub fn has_verified_ai_identity(&self) -> bool {
        self.is_ai_generated
            && self
                .ai_agent
                .as_deref()
                .is_some_and(|agent| !agent.trim().is_empty())
            && self
                .ai_confidence
                .as_deref()
                .is_some_and(|confidence| confidence.trim().eq_ignore_ascii_case("verified"))
            && self.ai_source.as_deref().is_some_and(|source| {
                matches!(
                    source.trim().to_ascii_lowercase().as_str(),
                    "agent_hook" | "mcp" | "structured_mcp" | "transcript"
                )
            })
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
        if let Some(heartbeat_id) = self.heartbeat_id.as_deref() {
            if heartbeat_id.trim().is_empty() {
                return Err("heartbeat_id cannot be empty".to_string());
            }
        }
        for segment in &self.activity_segments {
            if segment.segment_id.trim().is_empty()
                || !segment.start.is_finite()
                || !segment.end.is_finite()
                || segment.start < 0.0
                || segment.end < segment.start
                || segment.end - segment.start > MAX_ACTIVITY_GAP_SECONDS
            {
                return Err("activity segment is invalid or exceeds the 120 second gap".to_string());
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
        if self.heartbeat_id.is_some() && self.heartbeat_id == other.heartbeat_id {
            return true;
        }
        let time_diff = (self.time - other.time).abs();
        self.entity == other.entity
            && self.entity_type == other.entity_type
            && !self.is_write
            && !other.is_write
            && !self.carries_measurements()
            && time_diff < DEDUP_WINDOW_SECONDS
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
            || positive(self.unattributed_lines_added)
            || positive(self.unattributed_lines_deleted)
            || positive(self.ai_lines_added)
            || positive(self.ai_lines_deleted)
            || self.active_seconds.is_some_and(|seconds| seconds > 0.0)
            || !self.activity_segments.is_empty()
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

    #[test]
    fn unverified_identity_becomes_unattributed_ai() {
        let mut heartbeat = Heartbeat::new(
            Uuid::nil(),
            "src/main.rs".to_string(),
            EntityType::File,
            "test".to_string(),
        );
        heartbeat.ai_agent = Some("codex".to_string());
        heartbeat.ai_provider = Some("openai".to_string());
        heartbeat.ai_model = Some("gpt-test".to_string());
        heartbeat.ai_source = Some("ide_telemetry".to_string());
        heartbeat.ai_confidence = Some("correlated".to_string());

        heartbeat.enforce_attribution_policy();

        assert!(heartbeat.is_ai_generated);
        assert!(heartbeat.ai_agent.is_none());
        assert!(heartbeat.ai_provider.is_none());
        assert!(heartbeat.ai_model.is_none());
        assert_eq!(heartbeat.ai_source.as_deref(), Some("observer"));
        assert_eq!(heartbeat.ai_confidence.as_deref(), Some("inferred"));
    }

    #[test]
    fn verified_hook_identity_survives_policy() {
        let mut heartbeat = Heartbeat::new(
            Uuid::nil(),
            "src/main.rs".to_string(),
            EntityType::File,
            "test".to_string(),
        );
        heartbeat.ai_agent = Some("codex".to_string());
        heartbeat.ai_provider = Some("openai".to_string());
        heartbeat.ai_model = Some("gpt-test".to_string());
        heartbeat.ai_source = Some("agent_hook".to_string());
        heartbeat.ai_confidence = Some("verified".to_string());

        heartbeat.enforce_attribution_policy();

        assert!(heartbeat.is_ai_generated);
        assert_eq!(heartbeat.ai_agent.as_deref(), Some("codex"));
        assert_eq!(heartbeat.ai_provider.as_deref(), Some("openai"));
        assert_eq!(heartbeat.ai_model.as_deref(), Some("gpt-test"));
    }

    #[test]
    fn provider_only_identity_is_unattributed_even_with_verified_labels() {
        let mut heartbeat = Heartbeat::new(
            Uuid::nil(),
            "src/main.rs".to_string(),
            EntityType::File,
            "test".to_string(),
        );
        heartbeat.is_ai_generated = true;
        heartbeat.ai_provider = Some("openai".to_string());
        heartbeat.ai_model = Some("gpt-test".to_string());
        heartbeat.ai_source = Some("agent_hook".to_string());
        heartbeat.ai_confidence = Some("verified".to_string());

        heartbeat.enforce_attribution_policy();

        assert!(heartbeat.ai_agent.is_none());
        assert!(heartbeat.ai_provider.is_none());
        assert!(heartbeat.ai_model.is_none());
        assert_eq!(heartbeat.ai_source.as_deref(), Some("observer"));
    }

    #[test]
    fn policy_is_idempotent_for_unattributed_rows() {
        let mut heartbeat = Heartbeat::new(
            Uuid::nil(),
            "src/main.rs".to_string(),
            EntityType::File,
            "test".to_string(),
        );
        heartbeat.is_ai_generated = true;
        heartbeat.ai_confidence = Some("inferred".to_string());
        heartbeat.ai_source = Some("observer".to_string());

        heartbeat.enforce_attribution_policy();
        let first = heartbeat.clone();
        heartbeat.enforce_attribution_policy();

        assert_eq!(heartbeat.ai_agent, first.ai_agent);
        assert_eq!(heartbeat.ai_provider, first.ai_provider);
        assert_eq!(heartbeat.ai_model, first.ai_model);
        assert_eq!(heartbeat.ai_source, first.ai_source);
        assert_eq!(heartbeat.ai_confidence, first.ai_confidence);
    }
}
