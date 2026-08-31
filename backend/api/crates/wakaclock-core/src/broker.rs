//! Local AI Activity Broker contract and durable inbox.
//!
//! The broker is deliberately split into a transport-neutral core and a CLI-owned
//! runtime.  This module owns the versioned metadata-only event, validation and the
//! SQLite inbox so HTTP producers and the CLI fallback cannot disagree about identity,
//! attribution or retry state.

use crate::{
    ai::{normalize_agent_id, AiConfidence, AiEventSource},
    error::AppError,
    heartbeat::{resolve_attribution, ActorType, AttributionInput},
};
use chrono::{DateTime, Duration, Utc};
use rusqlite::{params, Connection, OptionalExtension, TransactionBehavior};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    fs,
    path::{Path, PathBuf},
};
use uuid::Uuid;

pub const BROKER_SCHEMA_VERSION: u8 = 1;
pub const MAX_EVENT_BYTES: usize = 64 * 1024;
pub const MAX_BATCH_EVENTS: usize = 500;
pub const MAX_BATCH_BYTES: usize = 2 * 1024 * 1024;
pub const BROKER_LEASE_SECONDS: i64 = 60;
pub const BROKER_MAX_ATTEMPTS: i64 = 20;
pub const BROKER_PAYLOAD_RETENTION_SECONDS: i64 = 7 * 24 * 60 * 60;
pub const BROKER_ID_RETENTION_SECONDS: i64 = 30 * 24 * 60 * 60;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum BrokerEventType {
    FileChange,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum BrokerChangeKind {
    Create,
    Modify,
    Rename,
    Delete,
}

impl BrokerChangeKind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Create => "create",
            Self::Modify => "modify",
            Self::Rename => "rename",
            Self::Delete => "delete",
        }
    }
}

/// planai2.md Phase 1 (decision p1.0 / D3): `BrokerEventV1.transport` stays a free
/// `Option<String>` on the wire so no existing producer breaks, but the Phase 2
/// producer-priority ordering needs a typed, ranked view of it. `priority()` is
/// lower = stronger evidence, matching planai2.md §2 "Producer priority":
/// native hook > structured MCP > completed transcript tool call > before/after
/// snapshot > filesystem/session inference.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum TransportKind {
    NativePlugin,
    Mcp,
    Transcript,
    ToolSnapshot,
    Filesystem,
    Editor,
    Cli,
    Other,
}

impl TransportKind {
    /// Map the free-text `transport` string a producer sent. Unknown / absent ⇒
    /// `Other` (weakest), never a panic.
    pub fn classify(transport: Option<&str>) -> Self {
        match transport.unwrap_or("").trim().to_ascii_lowercase().as_str() {
            "native_plugin" | "native-plugin" | "plugin" | "agent_hook" | "shell_hook" | "hook" => {
                Self::NativePlugin
            }
            "mcp" | "mcp_bridge" | "tool_bridge" => Self::Mcp,
            "transcript" | "session_log" | "jsonl" => Self::Transcript,
            "tool_snapshot" | "snapshot" | "before_after" | "git_sweep" => Self::ToolSnapshot,
            "filesystem" | "fs" | "notify" | "fs_observer" => Self::Filesystem,
            "editor" | "vscode" | "ide" | "sidecar" => Self::Editor,
            "cli" | "wakaclock-cli" | "manual" => Self::Cli,
            _ => Self::Other,
        }
    }

    /// Lower = stronger evidence.
    pub fn priority(self) -> u8 {
        match self {
            Self::NativePlugin => 0,
            Self::Mcp => 1,
            Self::Transcript => 2,
            Self::ToolSnapshot => 3,
            Self::Filesystem => 4,
            Self::Editor => 4,
            Self::Cli => 5,
            Self::Other => 6,
        }
    }
}

/// Every top-level key `BrokerEventV1` accepts. The single source of truth for the
/// quarantine allow-list (kept in sync with the struct by
/// `allow_list_matches_the_struct_fields` in tests).
pub const ALLOWED_EVENT_FIELDS: &[&str] = &[
    "schema_version",
    "event_type",
    "event_id",
    "occurred_at",
    "entity",
    "project_root",
    "change_kind",
    "previous_entity",
    "agent",
    "provider",
    "model",
    "session_id",
    "source",
    "confidence",
    "actor_type",
    "actor_confidence",
    "lines_added",
    "lines_deleted",
    "active_seconds",
    "transport",
    "tool",
    "tool_event_id",
];

/// Field names that carry model or user content and must never reach the broker.
/// Presence of any of these in a rejected payload is reported as a distinct,
/// louder diagnostic than a plain typo'd key.
pub const FORBIDDEN_EVENT_FIELDS: &[&str] = &[
    "prompt",
    "prompts",
    "response",
    "responses",
    "completion",
    "message",
    "messages",
    "patch",
    "diff",
    "content",
    "text",
    "body",
    "source_code",
    "code",
    "clipboard",
    "terminal",
    "stdout",
    "stderr",
    "output",
    "args",
    "argv",
    "arguments",
    "command",
    "cmd",
    "env",
    "environment",
    "secret",
    "token",
    "api_key",
];

/// planai2.md Phase 1 (decision p1.0 / D2): a metadata-only diagnostic for a
/// payload that failed the strict `BrokerEventV1` parse. It reports **field names
/// only** — never a field value — so a leaked prompt, patch or secret cannot ride
/// out inside an error string.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct QuarantineDiagnostic {
    /// Top-level keys present in the payload that are not in the envelope allow-list.
    pub unknown_fields: Vec<String>,
    /// The subset of `unknown_fields` whose name matches known content-bearing data.
    pub forbidden_fields: Vec<String>,
    /// A human-readable summary, guaranteed to contain no field values.
    pub message: String,
}

impl QuarantineDiagnostic {
    pub fn inspect(raw: &[u8]) -> Self {
        let mut unknown = Vec::new();
        if let Ok(serde_json::Value::Object(map)) = serde_json::from_slice::<serde_json::Value>(raw)
        {
            for key in map.keys() {
                if !ALLOWED_EVENT_FIELDS.contains(&key.as_str()) {
                    unknown.push(key.clone());
                }
            }
        }
        unknown.sort();
        unknown.dedup();
        let forbidden: Vec<String> = unknown
            .iter()
            .filter(|key| FORBIDDEN_EVENT_FIELDS.contains(&key.to_ascii_lowercase().as_str()))
            .cloned()
            .collect();
        let message = if !forbidden.is_empty() {
            format!(
                "broker event carries content-bearing field(s) that must never be sent: {}",
                forbidden.join(", ")
            )
        } else if !unknown.is_empty() {
            format!(
                "broker event has field(s) outside the metadata contract: {}",
                unknown.join(", ")
            )
        } else {
            "broker event failed strict metadata validation".to_string()
        };
        Self {
            unknown_fields: unknown,
            forbidden_fields: forbidden,
            message,
        }
    }

    pub fn carries_forbidden_content(&self) -> bool {
        !self.forbidden_fields.is_empty()
    }
}

/// Stable metadata-only ingress envelope.  The `deny_unknown_fields` contract is
/// intentional: prompts, responses, patch bodies and tool arguments must not become
/// an accidental part of the local or uploaded activity record.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct BrokerEventV1 {
    pub schema_version: u8,
    pub event_type: BrokerEventType,
    pub event_id: String,
    pub occurred_at: DateTime<Utc>,
    pub entity: String,
    #[serde(default)]
    pub project_root: Option<String>,
    pub change_kind: BrokerChangeKind,
    #[serde(default)]
    pub previous_entity: Option<String>,
    pub agent: String,
    #[serde(default)]
    pub provider: Option<String>,
    #[serde(default)]
    pub model: Option<String>,
    #[serde(default)]
    pub session_id: Option<String>,
    pub source: AiEventSource,
    pub confidence: AiConfidence,
    #[serde(default)]
    pub actor_type: Option<ActorType>,
    #[serde(default)]
    pub actor_confidence: Option<f32>,
    #[serde(default)]
    pub lines_added: Option<u32>,
    #[serde(default)]
    pub lines_deleted: Option<u32>,
    #[serde(default)]
    pub active_seconds: Option<f64>,
    #[serde(default)]
    pub transport: Option<String>,
    #[serde(default)]
    pub tool: Option<String>,
    #[serde(default)]
    pub tool_event_id: Option<String>,
}

impl BrokerEventV1 {
    /// The ranked producer class of this event's `transport` string (p1.0 / D3).
    pub fn transport_kind(&self) -> TransportKind {
        TransportKind::classify(self.transport.as_deref())
    }

    /// Validate and fill canonical fields before the event reaches the inbox.
    pub fn normalize(mut self) -> Result<Self, AppError> {
        if self.schema_version != BROKER_SCHEMA_VERSION {
            return Err(AppError::Validation(format!(
                "unsupported broker schema_version: {}",
                self.schema_version
            )));
        }
        if !matches!(self.event_type, BrokerEventType::FileChange) {
            return Err(AppError::Validation(
                "unsupported broker event_type".to_string(),
            ));
        }
        self.event_id = clean_required("event_id", self.event_id)?;
        self.agent = normalize_agent_id(&clean_required("agent", self.agent)?);
        self.entity = normalize_absolute_path("entity", &self.entity)?;
        self.project_root = self
            .project_root
            .as_deref()
            .map(|value| normalize_absolute_path("project_root", value))
            .transpose()?;
        if let Some(root) = self.project_root.as_deref() {
            if !Path::new(&self.entity).starts_with(root) {
                return Err(AppError::Validation(
                    "entity must be inside project_root".to_string(),
                ));
            }
        }
        self.previous_entity = self
            .previous_entity
            .as_deref()
            .map(|value| normalize_absolute_path("previous_entity", value))
            .transpose()?;
        if let (Some(root), Some(previous_entity)) = (
            self.project_root.as_deref(),
            self.previous_entity.as_deref(),
        ) {
            if !Path::new(previous_entity).starts_with(root) {
                return Err(AppError::Validation(
                    "previous_entity must be inside project_root".to_string(),
                ));
            }
        }
        if matches!(self.change_kind, BrokerChangeKind::Rename) && self.previous_entity.is_none() {
            return Err(AppError::Validation(
                "rename events require previous_entity".to_string(),
            ));
        }
        if !matches!(self.change_kind, BrokerChangeKind::Rename) && self.previous_entity.is_some() {
            return Err(AppError::Validation(
                "previous_entity is only valid for rename events".to_string(),
            ));
        }
        if let Some(seconds) = self.active_seconds {
            if !seconds.is_finite() || seconds < 0.0 {
                return Err(AppError::Validation(
                    "active_seconds must be finite and non-negative".to_string(),
                ));
            }
        }
        if self.occurred_at > Utc::now() + Duration::minutes(5) {
            return Err(AppError::Validation(
                "occurred_at cannot be more than five minutes in the future".to_string(),
            ));
        }

        // Keep Phase 1's resolver as the only attribution authority. Broker events are
        // AI evidence by construction, but explicit enum fields still have to agree with
        // the source/line metadata and legacy clients must not create a second truth.
        let resolution = resolve_attribution(AttributionInput {
            explicit_actor_type: self.actor_type,
            explicit_confidence: self.actor_confidence,
            legacy_is_ai_generated: Some(true),
            ai_agent: Some(&self.agent),
            ai_source: Some(self.source.as_str()),
            ai_confidence: Some(self.confidence.as_str()),
            ai_event_id: Some(&self.event_id),
            ai_lines_added: self.lines_added,
            ai_lines_deleted: self.lines_deleted,
            ..Default::default()
        })
        .map_err(AppError::Validation)?;
        self.actor_type = Some(resolution.actor_type);
        self.actor_confidence = Some(resolution.confidence);
        Ok(self)
    }

    pub fn serialized_len(&self) -> Result<usize, AppError> {
        Ok(serde_json::to_vec(self)?.len())
    }

    pub fn payload_hash(&self) -> Result<String, AppError> {
        let bytes = serde_json::to_vec(self)?;
        Ok(Uuid::new_v5(&Uuid::NAMESPACE_OID, &bytes).to_string())
    }

    pub fn heartbeat_id(&self) -> String {
        format!("broker:{}", self.event_id)
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum BrokerEventStatus {
    Pending,
    Processing,
    Processed,
    Retry,
    DeadLetter,
}

impl BrokerEventStatus {
    fn parse(value: &str) -> Result<Self, AppError> {
        match value {
            "pending" => Ok(Self::Pending),
            "processing" => Ok(Self::Processing),
            "processed" => Ok(Self::Processed),
            "retry" => Ok(Self::Retry),
            "dead_letter" => Ok(Self::DeadLetter),
            other => Err(AppError::Validation(format!(
                "invalid broker event status: {other}"
            ))),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BrokerIngestOutcome {
    Accepted,
    Duplicate,
    Conflict,
}

#[derive(Debug, Clone, Serialize)]
pub struct BrokerRecord {
    pub event_id: String,
    pub event: BrokerEventV1,
    pub status: BrokerEventStatus,
    pub attempt_count: i64,
}

#[derive(Debug, Clone, Serialize, Default)]
pub struct BrokerStoreStats {
    pub pending: u64,
    pub processing: u64,
    pub processed: u64,
    pub retry: u64,
    pub dead_letter: u64,
    pub last_received_at: Option<i64>,
    pub last_processed_at: Option<i64>,
    pub last_delivery_at: Option<i64>,
    pub last_error_code: Option<String>,
    pub last_error_message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrokerDiscovery {
    pub endpoint: String,
    pub pid: u32,
    pub schema_version: u8,
    pub started_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrokerEventAck {
    pub event_id: String,
    pub status: String,
    pub actor_type: ActorType,
    pub actor_confidence: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrokerBatchAck {
    pub accepted: usize,
    pub duplicate: usize,
    pub results: Vec<BrokerEventAck>,
}

/// Small HTTP client shared by CLI producers and external integrations. Discovery is
/// file-based so a dynamic port can be used without a global port reservation.
#[derive(Clone)]
pub struct BrokerClient {
    endpoint: String,
    token: String,
    client: reqwest::Client,
}

impl BrokerClient {
    pub fn new(endpoint: String, token: String) -> Result<Self, AppError> {
        let parsed = reqwest::Url::parse(&endpoint)
            .map_err(|error| AppError::Validation(format!("invalid broker endpoint: {error}")))?;
        if parsed.scheme() != "http"
            || !matches!(parsed.host_str(), Some("127.0.0.1" | "localhost" | "::1"))
        {
            return Err(AppError::Validation(
                "broker endpoint must be an HTTP loopback URL".to_string(),
            ));
        }
        if token.trim().is_empty() {
            return Err(AppError::Auth("broker token is empty".to_string()));
        }
        Ok(Self {
            endpoint: endpoint.trim_end_matches('/').to_string(),
            token,
            client: reqwest::Client::builder()
                .timeout(std::time::Duration::from_millis(750))
                .build()?,
        })
    }

    pub fn discover() -> Result<Option<Self>, AppError> {
        let discovery_path = broker_discovery_path();
        let token_path = broker_token_path();
        let Ok(discovery_json) = fs::read_to_string(&discovery_path) else {
            return Ok(None);
        };
        let Ok(discovery) = serde_json::from_str::<BrokerDiscovery>(&discovery_json) else {
            return Ok(None);
        };
        if discovery.schema_version != BROKER_SCHEMA_VERSION {
            return Ok(None);
        }
        let Ok(token) = fs::read_to_string(token_path) else {
            return Ok(None);
        };
        Ok(Some(Self::new(
            discovery.endpoint,
            token.trim().to_string(),
        )?))
    }

    pub async fn ingest(&self, event: &BrokerEventV1) -> Result<BrokerEventAck, AppError> {
        let event = event.clone().normalize()?;
        if event.serialized_len()? > MAX_EVENT_BYTES {
            return Err(AppError::Validation(format!(
                "broker event exceeds {} bytes",
                MAX_EVENT_BYTES
            )));
        }
        self.post("/v1/events", &event).await
    }

    pub async fn ingest_batch(&self, events: &[BrokerEventV1]) -> Result<BrokerBatchAck, AppError> {
        if events.is_empty() {
            return Ok(BrokerBatchAck {
                accepted: 0,
                duplicate: 0,
                results: Vec::new(),
            });
        }
        if events.len() > MAX_BATCH_EVENTS {
            return Err(AppError::Validation(format!(
                "broker batch exceeds {} events",
                MAX_BATCH_EVENTS
            )));
        }
        let mut normalized = Vec::with_capacity(events.len());
        for event in events {
            let event = event.clone().normalize()?;
            if event.serialized_len()? > MAX_EVENT_BYTES {
                return Err(AppError::Validation(format!(
                    "broker event exceeds {} bytes",
                    MAX_EVENT_BYTES
                )));
            }
            normalized.push(event);
        }
        let size = serde_json::to_vec(&normalized)?.len();
        if size > MAX_BATCH_BYTES {
            return Err(AppError::Validation(format!(
                "broker batch exceeds {} bytes",
                MAX_BATCH_BYTES
            )));
        }
        self.post("/v1/events/batch", &normalized).await
    }

    async fn post<T, R>(&self, path: &str, payload: &T) -> Result<R, AppError>
    where
        T: Serialize + ?Sized,
        R: for<'de> Deserialize<'de>,
    {
        let response = self
            .client
            .post(format!("{}{}", self.endpoint, path))
            .bearer_auth(&self.token)
            .json(payload)
            .send()
            .await?;
        let status = response.status();
        if !status.is_success() {
            let body = response.text().await.unwrap_or_default();
            let message = if body.trim().is_empty() {
                status
                    .canonical_reason()
                    .unwrap_or("broker request failed")
                    .to_string()
            } else {
                body.chars().take(2_048).collect()
            };
            return Err(AppError::HttpStatus {
                status: status.as_u16(),
                message,
            });
        }
        Ok(response.json::<R>().await?)
    }
}

pub fn broker_runtime_dir() -> PathBuf {
    dirs::home_dir()
        .expect("could not resolve home directory")
        .join(".wakaclock")
}

pub fn broker_discovery_path() -> PathBuf {
    broker_runtime_dir().join("broker.json")
}

pub fn broker_token_path() -> PathBuf {
    broker_runtime_dir().join("broker.token")
}

/// SQLite inbox used by the HTTP runtime and the service-unavailable CLI fallback.
pub struct BrokerStore {
    conn: Connection,
}

impl BrokerStore {
    pub fn open() -> Result<Self, AppError> {
        Self::open_at(&broker_db_path())
    }

    pub fn open_at(path: &Path) -> Result<Self, AppError> {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        let conn = Connection::open(path)?;
        conn.busy_timeout(std::time::Duration::from_secs(2))?;
        conn.execute_batch(
            "
            PRAGMA journal_mode = WAL;
            CREATE TABLE IF NOT EXISTS broker_events (
                event_id TEXT PRIMARY KEY NOT NULL,
                schema_version INTEGER NOT NULL,
                normalized_payload_json TEXT,
                payload_hash TEXT NOT NULL,
                status TEXT NOT NULL CHECK (status IN
                    ('pending', 'processing', 'processed', 'retry', 'dead_letter')),
                received_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                attempt_count INTEGER NOT NULL DEFAULT 0,
                next_attempt_at INTEGER NOT NULL DEFAULT 0,
                lease_until INTEGER,
                processed_at INTEGER,
                last_error_code TEXT,
                last_error_message TEXT
            );
            CREATE INDEX IF NOT EXISTS broker_events_ready_idx
                ON broker_events(status, next_attempt_at, lease_until, received_at);
            CREATE INDEX IF NOT EXISTS broker_events_retention_idx
                ON broker_events(status, updated_at);
            ",
        )?;
        // `event_json` was the pre-release name used by the first local broker
        // builds. Rename it in place so an upgrade never loses the durable inbox.
        let columns = conn
            .prepare("PRAGMA table_info(broker_events)")?
            .query_map([], |row| row.get::<_, String>(1))?
            .collect::<Result<Vec<_>, _>>()?;
        if columns.iter().any(|column| column == "event_json")
            && !columns
                .iter()
                .any(|column| column == "normalized_payload_json")
        {
            conn.execute(
                "ALTER TABLE broker_events RENAME COLUMN event_json TO normalized_payload_json",
                [],
            )?;
        }
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let _ = fs::set_permissions(path, fs::Permissions::from_mode(0o600));
        }
        Ok(Self { conn })
    }

    pub fn ingest(&self, event: &BrokerEventV1) -> Result<BrokerIngestOutcome, AppError> {
        self.ingest_normalized(&event.clone().normalize()?)
    }

    pub fn ingest_normalized(
        &self,
        event: &BrokerEventV1,
    ) -> Result<BrokerIngestOutcome, AppError> {
        let size = event.serialized_len()?;
        if size > MAX_EVENT_BYTES {
            return Err(AppError::Validation(format!(
                "broker event exceeds {} bytes",
                MAX_EVENT_BYTES
            )));
        }
        let json = serde_json::to_string(&event)?;
        let hash = event.payload_hash()?;
        let now = Utc::now().timestamp();
        let inserted = self.conn.execute(
            "INSERT INTO broker_events
             (event_id, schema_version, normalized_payload_json, payload_hash, status, received_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, 'pending', ?5, ?5)
             ON CONFLICT(event_id) DO NOTHING",
            params![event.event_id, event.schema_version, json, hash, now],
        )?;
        if inserted > 0 {
            return Ok(BrokerIngestOutcome::Accepted);
        }

        let existing_hash: Option<String> = self
            .conn
            .query_row(
                "SELECT payload_hash FROM broker_events WHERE event_id = ?1",
                params![event.event_id],
                |row| row.get(0),
            )
            .optional()?;
        match existing_hash {
            Some(existing_hash) if existing_hash == hash => Ok(BrokerIngestOutcome::Duplicate),
            Some(_) => Ok(BrokerIngestOutcome::Conflict),
            None => Err(AppError::Conflict(
                "broker event disappeared during concurrent ingestion".to_string(),
            )),
        }
    }

    /// Ingest a batch in one transaction. Existing identical IDs are reported as
    /// duplicates; one conflicting ID aborts the entire batch so a single malformed
    /// producer retry cannot partially represent a multi-file tool call.
    pub fn ingest_batch(
        &mut self,
        events: &[BrokerEventV1],
    ) -> Result<Vec<BrokerIngestOutcome>, AppError> {
        if events.is_empty() {
            return Ok(Vec::new());
        }
        if events.len() > MAX_BATCH_EVENTS {
            return Err(AppError::Validation(format!(
                "broker batch exceeds {} events",
                MAX_BATCH_EVENTS
            )));
        }
        let mut normalized = Vec::with_capacity(events.len());
        for event in events {
            let event = event.clone().normalize()?;
            if event.serialized_len()? > MAX_EVENT_BYTES {
                return Err(AppError::Validation(format!(
                    "broker event exceeds {} bytes",
                    MAX_EVENT_BYTES
                )));
            }
            normalized.push(event);
        }
        self.ingest_normalized_batch(&normalized)
    }

    pub fn ingest_normalized_batch(
        &mut self,
        normalized: &[BrokerEventV1],
    ) -> Result<Vec<BrokerIngestOutcome>, AppError> {
        if normalized.is_empty() {
            return Ok(Vec::new());
        }
        if normalized.len() > MAX_BATCH_EVENTS {
            return Err(AppError::Validation(format!(
                "broker batch exceeds {} events",
                MAX_BATCH_EVENTS
            )));
        }
        for event in normalized {
            if event.schema_version != BROKER_SCHEMA_VERSION {
                return Err(AppError::Validation(
                    "broker batch contains an unsupported schema version".to_string(),
                ));
            }
            if event.serialized_len()? > MAX_EVENT_BYTES {
                return Err(AppError::Validation(format!(
                    "broker event exceeds {} bytes",
                    MAX_EVENT_BYTES
                )));
            }
        }
        if serde_json::to_vec(normalized)?.len() > MAX_BATCH_BYTES {
            return Err(AppError::Validation(format!(
                "broker batch exceeds {} bytes",
                MAX_BATCH_BYTES
            )));
        }

        // Serialize claim transactions so two broker workers cannot both observe the
        // same ready row before either one changes its lease. The process itself is
        // still safe to restart because the lease remains recoverable after expiry.
        let tx = self
            .conn
            .transaction_with_behavior(TransactionBehavior::Immediate)?;
        let mut existing = Vec::with_capacity(normalized.len());
        let mut hashes = Vec::with_capacity(normalized.len());
        let mut seen_hashes = HashMap::with_capacity(normalized.len());
        for event in normalized {
            let hash = event.payload_hash()?;
            if let Some(previous_hash) = seen_hashes.get(&event.event_id) {
                if previous_hash != &hash {
                    return Err(AppError::Conflict(format!(
                        "broker batch contains conflicting payloads for event_id: {}",
                        event.event_id
                    )));
                }
                hashes.push(hash);
                existing.push(BrokerIngestOutcome::Duplicate);
                continue;
            }
            seen_hashes.insert(event.event_id.clone(), hash.clone());
            hashes.push(hash.clone());

            let payload_hash: Option<String> = tx
                .query_row(
                    "SELECT payload_hash FROM broker_events WHERE event_id = ?1",
                    params![event.event_id],
                    |row| row.get(0),
                )
                .optional()?;
            if let Some(payload_hash) = payload_hash {
                if payload_hash != hash {
                    return Err(AppError::Conflict(format!(
                        "broker event_id already exists with a different payload: {}",
                        event.event_id
                    )));
                }
                existing.push(BrokerIngestOutcome::Duplicate);
            } else {
                existing.push(BrokerIngestOutcome::Accepted);
            }
        }

        let now = Utc::now().timestamp();
        for ((event, outcome), hash) in normalized.iter().zip(existing.iter()).zip(hashes.iter()) {
            if *outcome != BrokerIngestOutcome::Accepted {
                continue;
            }
            let json = serde_json::to_string(event)?;
            tx.execute(
                "INSERT INTO broker_events
                 (event_id, schema_version, normalized_payload_json, payload_hash, status, received_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, 'pending', ?5, ?5)",
                params![event.event_id, event.schema_version, json, hash, now],
            )?;
        }
        tx.commit()?;
        Ok(existing)
    }

    /// Claim a bounded batch. Expired processing leases are recoverable after a crash.
    pub fn claim_ready(&mut self, limit: usize) -> Result<Vec<BrokerRecord>, AppError> {
        let now = Utc::now().timestamp();
        let limit = limit.clamp(1, MAX_BATCH_EVENTS);
        let tx = self
            .conn
            .transaction_with_behavior(TransactionBehavior::Immediate)?;
        let mut statement = tx.prepare(
            "SELECT event_id, normalized_payload_json, status, attempt_count
             FROM broker_events
             WHERE normalized_payload_json IS NOT NULL AND (
                   (status IN ('pending', 'retry') AND next_attempt_at <= ?1)
                OR (status = 'processing' AND lease_until IS NOT NULL AND lease_until <= ?1)
             )
             ORDER BY received_at ASC LIMIT ?2",
        )?;
        let rows: Vec<(String, String, String, i64)> = statement
            .query_map(params![now, limit as i64], |row| {
                Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?))
            })?
            .collect::<Result<_, _>>()?;
        drop(statement);

        let mut records = Vec::with_capacity(rows.len());
        for (event_id, normalized_payload_json, status, attempt_count) in rows {
            let next_attempt = attempt_count + 1;
            let changed = tx.execute(
                "UPDATE broker_events SET status = 'processing', attempt_count = ?2,
                 lease_until = ?3, updated_at = ?4 WHERE event_id = ?1 AND (
                    (status IN ('pending', 'retry') AND next_attempt_at <= ?5)
                    OR (status = 'processing' AND lease_until IS NOT NULL AND lease_until <= ?5)
                 )",
                params![event_id, next_attempt, now + BROKER_LEASE_SECONDS, now, now],
            )?;
            if changed == 0 {
                continue;
            }
            let event: BrokerEventV1 = serde_json::from_str(&normalized_payload_json)?;
            records.push(BrokerRecord {
                event_id,
                event,
                status: BrokerEventStatus::parse(&status)?,
                attempt_count: next_attempt,
            });
        }
        tx.commit()?;
        Ok(records)
    }

    pub fn mark_processed(&self, event_id: &str) -> Result<(), AppError> {
        let now = Utc::now().timestamp();
        self.conn.execute(
            "UPDATE broker_events SET status = 'processed', processed_at = ?2,
             updated_at = ?2, lease_until = NULL, last_error_code = NULL,
             last_error_message = NULL WHERE event_id = ?1",
            params![event_id, now],
        )?;
        Ok(())
    }

    /// Mark only the lease generation that actually processed the event. If a
    /// previous worker wakes up after its lease expired, it must not overwrite the
    /// state written by the worker that reclaimed the row.
    pub fn mark_processed_for_attempt(
        &self,
        event_id: &str,
        attempt_count: i64,
    ) -> Result<bool, AppError> {
        let now = Utc::now().timestamp();
        let changed = self.conn.execute(
            "UPDATE broker_events SET status = 'processed', processed_at = ?3,
             updated_at = ?3, lease_until = NULL, last_error_code = NULL,
             last_error_message = NULL WHERE event_id = ?1 AND status = 'processing'
             AND attempt_count = ?2",
            params![event_id, attempt_count, now],
        )?;
        Ok(changed > 0)
    }

    pub fn mark_retry(
        &self,
        event_id: &str,
        attempt_count: i64,
        code: &str,
        message: &str,
    ) -> Result<BrokerEventStatus, AppError> {
        let now = Utc::now().timestamp();
        let terminal = attempt_count >= BROKER_MAX_ATTEMPTS;
        let status = if terminal { "dead_letter" } else { "retry" };
        let backoff = retry_backoff_seconds(attempt_count);
        self.conn.execute(
            "UPDATE broker_events SET status = ?2, updated_at = ?3,
             next_attempt_at = ?4, lease_until = NULL,
             last_error_code = ?5, last_error_message = ?6 WHERE event_id = ?1",
            params![
                event_id,
                status,
                now,
                now + backoff,
                code,
                sanitize_error_message(message),
            ],
        )?;
        BrokerEventStatus::parse(status)
    }

    /// Lease-aware retry variant. `None` means another worker already reclaimed
    /// the event, so the stale worker must not change its status.
    pub fn mark_retry_for_attempt(
        &self,
        event_id: &str,
        attempt_count: i64,
        code: &str,
        message: &str,
    ) -> Result<Option<BrokerEventStatus>, AppError> {
        let now = Utc::now().timestamp();
        let terminal = attempt_count >= BROKER_MAX_ATTEMPTS;
        let status = if terminal { "dead_letter" } else { "retry" };
        let backoff = retry_backoff_seconds(attempt_count);
        let changed = self.conn.execute(
            "UPDATE broker_events SET status = ?2, updated_at = ?3,
             next_attempt_at = ?4, lease_until = NULL,
             last_error_code = ?5, last_error_message = ?6 WHERE event_id = ?1
             AND status = 'processing' AND attempt_count = ?7",
            params![
                event_id,
                status,
                now,
                now + backoff,
                code,
                sanitize_error_message(message),
                attempt_count,
            ],
        )?;
        if changed == 0 {
            Ok(None)
        } else {
            Ok(Some(BrokerEventStatus::parse(status)?))
        }
    }

    pub fn retry_dead_letters(&self, event_id: Option<&str>) -> Result<usize, AppError> {
        let now = Utc::now().timestamp();
        let changed = if let Some(event_id) = event_id {
            self.conn.execute(
                "UPDATE broker_events SET status = 'pending', attempt_count = 0,
                 next_attempt_at = 0, lease_until = NULL, updated_at = ?2
                 WHERE event_id = ?1 AND status = 'dead_letter'",
                params![event_id, now],
            )?
        } else {
            self.conn.execute(
                "UPDATE broker_events SET status = 'pending', attempt_count = 0,
                 next_attempt_at = 0, lease_until = NULL, updated_at = ?1
                 WHERE status = 'dead_letter'",
                params![now],
            )?
        };
        Ok(changed)
    }

    pub fn stats(&self) -> Result<BrokerStoreStats, AppError> {
        let mut stats = BrokerStoreStats::default();
        let mut statement = self
            .conn
            .prepare("SELECT status, COUNT(*) FROM broker_events GROUP BY status")?;
        for row in statement.query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, u64>(1)?))
        })? {
            let (status, count) = row?;
            match status.as_str() {
                "pending" => stats.pending = count,
                "processing" => stats.processing = count,
                "processed" => stats.processed = count,
                "retry" => stats.retry = count,
                "dead_letter" => stats.dead_letter = count,
                _ => {}
            }
        }
        stats.last_received_at =
            self.conn
                .query_row("SELECT MAX(received_at) FROM broker_events", [], |row| {
                    row.get(0)
                })?;
        stats.last_processed_at =
            self.conn
                .query_row("SELECT MAX(processed_at) FROM broker_events", [], |row| {
                    row.get(0)
                })?;
        // A broker event only becomes `processed` after its heartbeat was sent or
        // durably placed in the outbound queue, so this is the delivery watermark.
        stats.last_delivery_at = stats.last_processed_at;
        let last_error: Option<(String, String)> = self
            .conn
            .query_row(
                "SELECT last_error_code, last_error_message FROM broker_events
                 WHERE last_error_code IS NOT NULL ORDER BY updated_at DESC LIMIT 1",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .optional()?;
        if let Some((code, message)) = last_error {
            stats.last_error_code = Some(code);
            stats.last_error_message = Some(sanitize_error_message(&message));
        }
        Ok(stats)
    }

    /// Remove event payloads after a week while retaining event IDs and hashes for
    /// duplicate detection. Old identity rows are removed after thirty days.
    pub fn compact(&self) -> Result<(), AppError> {
        let now = Utc::now().timestamp();
        self.conn.execute(
            "UPDATE broker_events SET normalized_payload_json = NULL
             WHERE status = 'processed' AND updated_at < ?1 AND normalized_payload_json IS NOT NULL",
            params![now - BROKER_PAYLOAD_RETENTION_SECONDS],
        )?;
        self.conn.execute(
            "DELETE FROM broker_events WHERE updated_at < ?1
             AND status IN ('processed', 'dead_letter')",
            params![now - BROKER_ID_RETENTION_SECONDS],
        )?;
        Ok(())
    }

    pub fn db_path() -> PathBuf {
        broker_db_path()
    }
}

fn clean_required(name: &str, value: String) -> Result<String, AppError> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err(AppError::Validation(format!("{name} must not be empty")));
    }
    Ok(trimmed.to_string())
}

fn normalize_absolute_path(name: &str, value: &str) -> Result<String, AppError> {
    let value = value.trim();
    let path = Path::new(value);
    if value.is_empty() || !path.is_absolute() {
        return Err(AppError::Validation(format!(
            "{name} must be an absolute path"
        )));
    }
    Ok(crate::ai::path::to_comparable_string(path))
}

fn retry_backoff_seconds(attempt_count: i64) -> i64 {
    match attempt_count {
        0 | 1 => 5,
        2 => 15,
        3 => 60,
        4 => 300,
        5 => 900,
        6 => 1_800,
        _ => 3_600,
    }
}

fn truncate_error(message: &str) -> String {
    message.chars().take(2_048).collect()
}

fn sanitize_error_message(message: &str) -> String {
    let lower = message.to_ascii_lowercase();
    if message.contains('/')
        || message.contains('\\')
        || [
            "prompt",
            "response",
            "patch",
            "content",
            "source text",
            "command arguments",
        ]
        .iter()
        .any(|secret| lower.contains(secret))
    {
        return "broker processing failed; inspect broker logs for a sanitized error code"
            .to_string();
    }
    truncate_error(message)
}

fn broker_db_path() -> PathBuf {
    broker_runtime_dir().join("broker.db")
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::SystemTime;

    fn sample_event(id: &str) -> BrokerEventV1 {
        BrokerEventV1 {
            schema_version: BROKER_SCHEMA_VERSION,
            event_type: BrokerEventType::FileChange,
            event_id: id.to_string(),
            occurred_at: Utc::now(),
            entity: "/workspace/src/lib.rs".to_string(),
            project_root: Some("/workspace".to_string()),
            change_kind: BrokerChangeKind::Modify,
            previous_entity: None,
            agent: "Codex CLI".to_string(),
            provider: Some("openai".to_string()),
            model: None,
            session_id: Some("session-1".to_string()),
            source: AiEventSource::AgentHook,
            confidence: AiConfidence::Verified,
            actor_type: None,
            actor_confidence: None,
            lines_added: Some(2),
            lines_deleted: Some(1),
            active_seconds: Some(1.0),
            transport: Some("shell_hook".to_string()),
            tool: Some("apply_patch".to_string()),
            tool_event_id: Some("tool-1".to_string()),
        }
    }

    fn temp_db(name: &str) -> PathBuf {
        let nonce = SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!("wakaclock-broker-{name}-{nonce}.db"))
    }

    #[test]
    fn normalizes_paths_agent_and_verified_actor() {
        let event = sample_event("event-1").normalize().unwrap();
        assert_eq!(event.agent, "codex");
        assert_eq!(event.actor_type, Some(ActorType::AiVerified));
        assert_eq!(event.actor_confidence, Some(1.0));
        assert!(event.entity.starts_with('/'));
    }

    #[test]
    fn full_envelope_round_trips_through_json() {
        // planai2.md p1.1: every field the plan's target evidence JSON names must
        // survive a serialize → deserialize round trip unchanged.
        let event = sample_event("round-trip");
        let json = serde_json::to_string(&event).unwrap();
        let back: BrokerEventV1 = serde_json::from_str(&json).unwrap();
        assert_eq!(event, back);
        // The plan's named fields are all present on the wire.
        let value: serde_json::Value = serde_json::from_str(&json).unwrap();
        for key in [
            "schema_version",
            "event_type",
            "event_id",
            "occurred_at",
            "entity",
            "project_root",
            "change_kind",
            "agent",
            "provider",
            "model",
            "session_id",
            "tool_event_id",
            "source",
            "transport",
            "confidence",
            "lines_added",
            "lines_deleted",
        ] {
            assert!(value.get(key).is_some(), "missing envelope key {key}");
        }
    }

    #[test]
    fn a_minimal_old_shape_envelope_still_parses() {
        // An older producer that predates the optional fields sends only the
        // required ones; `#[serde(default)]` must fill the rest.
        let value = serde_json::json!({
            "schema_version": 1,
            "event_type": "file_change",
            "event_id": "old-shape",
            "occurred_at": Utc::now(),
            "entity": "/workspace/src/lib.rs",
            "change_kind": "modify",
            "agent": "codex",
            "source": "agent_hook",
            "confidence": "verified"
        });
        let event: BrokerEventV1 = serde_json::from_value(value).unwrap();
        assert_eq!(event.project_root, None);
        assert_eq!(event.transport, None);
        assert_eq!(event.tool_event_id, None);
        assert_eq!(event.lines_added, None);
        assert!(event.normalize().is_ok());
    }

    #[test]
    fn a_wrong_schema_version_is_rejected_by_normalize() {
        let mut event = sample_event("bad-version");
        event.schema_version = BROKER_SCHEMA_VERSION + 1;
        assert!(event.normalize().is_err());
    }

    #[test]
    fn transport_kind_ranks_producers_by_evidence_strength() {
        assert_eq!(
            TransportKind::classify(Some("native_plugin")),
            TransportKind::NativePlugin
        );
        assert_eq!(TransportKind::classify(Some("MCP")), TransportKind::Mcp);
        assert_eq!(
            TransportKind::classify(Some("fs_observer")),
            TransportKind::Filesystem
        );
        assert_eq!(TransportKind::classify(None), TransportKind::Other);
        assert_eq!(
            TransportKind::classify(Some("something-new")),
            TransportKind::Other
        );
        // A native hook outranks (lower priority number than) a filesystem event.
        assert!(TransportKind::NativePlugin.priority() < TransportKind::Filesystem.priority());
        assert!(TransportKind::Mcp.priority() < TransportKind::Transcript.priority());
        assert_eq!(
            sample_event("t").transport_kind(),
            TransportKind::NativePlugin // sample uses "shell_hook"
        );
    }

    #[test]
    fn allow_list_matches_the_struct_fields() {
        // If a field is added to BrokerEventV1, ALLOWED_EVENT_FIELDS must gain it
        // too or the quarantine diagnostic will wrongly flag it as unknown.
        let value = serde_json::to_value(sample_event("x")).unwrap();
        let keys: std::collections::BTreeSet<&str> = value
            .as_object()
            .unwrap()
            .keys()
            .map(String::as_str)
            .collect();
        let allowed: std::collections::BTreeSet<&str> =
            ALLOWED_EVENT_FIELDS.iter().copied().collect();
        assert_eq!(
            keys, allowed,
            "ALLOWED_EVENT_FIELDS is out of sync with BrokerEventV1"
        );
    }

    #[test]
    fn quarantine_diagnostic_names_a_prompt_field_but_never_its_value() {
        // planai2.md p1.2: a payload smuggling a prompt is quarantined, and the
        // diagnostic contains the field NAME but none of the prompt TEXT.
        let secret = "how do I exfiltrate the database";
        let raw = serde_json::json!({
            "schema_version": 1,
            "event_type": "file_change",
            "event_id": "e",
            "occurred_at": "2026-08-31T00:00:00Z",
            "entity": "/w/x.rs",
            "change_kind": "modify",
            "agent": "codex",
            "source": "agent_hook",
            "confidence": "verified",
            "prompt": secret,
        });
        let raw = serde_json::to_vec(&raw).unwrap();

        assert!(serde_json::from_slice::<BrokerEventV1>(&raw).is_err());
        let diag = QuarantineDiagnostic::inspect(&raw);
        assert_eq!(diag.forbidden_fields, vec!["prompt"]);
        assert!(diag.carries_forbidden_content());
        assert!(diag.message.contains("prompt"));
        assert!(
            !diag.message.contains(secret) && !diag.message.contains("exfiltrate"),
            "diagnostic leaked the field value: {}",
            diag.message
        );
        // The serialized diagnostic as a whole is value-free.
        let serialized = serde_json::to_string(&diag).unwrap();
        assert!(!serialized.contains("exfiltrate"));
    }

    #[test]
    fn quarantine_diagnostic_flags_every_forbidden_field_and_plain_unknowns_separately() {
        let raw = serde_json::to_vec(&serde_json::json!({
            "schema_version": 1,
            "event_type": "file_change",
            "event_id": "e",
            "occurred_at": "2026-08-31T00:00:00Z",
            "entity": "/w/x.rs",
            "change_kind": "modify",
            "agent": "codex",
            "source": "agent_hook",
            "confidence": "verified",
            "patch": "--- a\n+++ b\n",
            "stdout": "secret build output",
            "some_typo_field": 1,
        }))
        .unwrap();
        let diag = QuarantineDiagnostic::inspect(&raw);
        assert_eq!(diag.forbidden_fields, vec!["patch", "stdout"]);
        assert_eq!(
            diag.unknown_fields,
            vec!["patch", "some_typo_field", "stdout"]
        );
        assert!(diag.message.contains("must never be sent"));
        assert!(!diag.message.contains("secret build output"));
    }

    #[test]
    fn rejects_unknown_fields_at_the_wire_boundary() {
        let value = serde_json::json!({
            "schema_version": 1,
            "event_type": "file_change",
            "event_id": "event-1",
            "occurred_at": Utc::now(),
            "entity": "/workspace/src/lib.rs",
            "change_kind": "modify",
            "agent": "codex",
            "source": "agent_hook",
            "confidence": "verified",
            "prompt": "must not be accepted"
        });
        assert!(serde_json::from_value::<BrokerEventV1>(value).is_err());
    }

    #[test]
    fn duplicate_and_conflicting_ids_are_distinguished() {
        let path = temp_db("dedup");
        let store = BrokerStore::open_at(&path).unwrap();
        let event = sample_event("same-id");
        assert_eq!(store.ingest(&event).unwrap(), BrokerIngestOutcome::Accepted);
        assert_eq!(
            store.ingest(&event).unwrap(),
            BrokerIngestOutcome::Duplicate
        );
        let mut conflict = event;
        conflict.lines_added = Some(99);
        assert_eq!(
            store.ingest(&conflict).unwrap(),
            BrokerIngestOutcome::Conflict
        );
        let _ = fs::remove_file(path);
    }

    #[test]
    fn batch_deduplicates_repeated_ids_without_double_inserting() {
        let path = temp_db("batch-dedup");
        let mut store = BrokerStore::open_at(&path).unwrap();
        let first = sample_event("batch-same");
        let second = first.clone();
        let outcomes = store.ingest_batch(&[first, second]).unwrap();
        assert_eq!(
            outcomes,
            vec![
                BrokerIngestOutcome::Accepted,
                BrokerIngestOutcome::Duplicate
            ]
        );
        let stats = store.stats().unwrap();
        assert_eq!(stats.pending, 1);
        let _ = fs::remove_file(&path);
        let _ = fs::remove_file(path.with_extension("db-wal"));
        let _ = fs::remove_file(path.with_extension("db-shm"));
    }

    #[test]
    fn an_ai_edit_touching_fifty_files_is_captured_once_per_file() {
        let path = temp_db("fifty-files");
        let mut store = BrokerStore::open_at(&path).unwrap();
        let events = (0..50)
            .map(|index| {
                let mut event = sample_event(&format!("fifty-{index}"));
                event.entity = format!("/workspace/src/file-{index}.rs");
                event
            })
            .collect::<Vec<_>>();
        let outcomes = store.ingest_batch(&events).unwrap();
        assert_eq!(outcomes.len(), 50);
        assert!(outcomes
            .iter()
            .all(|outcome| *outcome == BrokerIngestOutcome::Accepted));
        assert_eq!(store.stats().unwrap().pending, 50);
        let _ = fs::remove_file(&path);
        let _ = fs::remove_file(path.with_extension("db-wal"));
        let _ = fs::remove_file(path.with_extension("db-shm"));
    }

    #[test]
    fn conflicting_duplicate_inside_batch_rolls_back_atomically() {
        let path = temp_db("batch-conflict");
        let mut store = BrokerStore::open_at(&path).unwrap();
        let first = sample_event("batch-conflict");
        let mut second = first.clone();
        second.lines_added = Some(99);
        assert!(matches!(
            store.ingest_batch(&[first.clone(), second]),
            Err(AppError::Conflict(_))
        ));
        assert_eq!(store.stats().unwrap().pending, 0);
        assert_eq!(store.ingest(&first).unwrap(), BrokerIngestOutcome::Accepted);
        let _ = fs::remove_file(&path);
        let _ = fs::remove_file(path.with_extension("db-wal"));
        let _ = fs::remove_file(path.with_extension("db-shm"));
    }

    #[test]
    fn claim_process_and_retry_state_survives_reopen() {
        let path = temp_db("state");
        let mut store = BrokerStore::open_at(&path).unwrap();
        let event = sample_event("state-event");
        store.ingest(&event).unwrap();
        let claimed = store.claim_ready(10).unwrap();
        assert_eq!(claimed.len(), 1);
        assert_eq!(claimed[0].attempt_count, 1);
        assert_eq!(
            store
                .mark_retry("state-event", 1, "backend_offline", "offline")
                .unwrap(),
            BrokerEventStatus::Retry
        );
        let reopened = BrokerStore::open_at(&path).unwrap();
        let stats = reopened.stats().unwrap();
        assert_eq!(stats.retry, 1);
        assert_eq!(
            reopened
                .mark_retry("state-event", BROKER_MAX_ATTEMPTS, "delivery", "offline")
                .unwrap(),
            BrokerEventStatus::DeadLetter
        );
        reopened.retry_dead_letters(None).unwrap();
        assert_eq!(reopened.stats().unwrap().pending, 1);
        let _ = fs::remove_file(path);
    }

    #[test]
    fn renames_pre_release_event_json_without_losing_inbox_rows() {
        let path = temp_db("schema-rename");
        let connection = Connection::open(&path).unwrap();
        connection
            .execute_batch(
                "CREATE TABLE broker_events (
                    event_id TEXT PRIMARY KEY NOT NULL,
                    schema_version INTEGER NOT NULL,
                    event_json TEXT,
                    payload_hash TEXT NOT NULL,
                    status TEXT NOT NULL,
                    received_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL,
                    attempt_count INTEGER NOT NULL DEFAULT 0,
                    next_attempt_at INTEGER NOT NULL DEFAULT 0,
                    lease_until INTEGER,
                    processed_at INTEGER,
                    last_error_code TEXT,
                    last_error_message TEXT
                );",
            )
            .unwrap();
        drop(connection);

        let mut store = BrokerStore::open_at(&path).unwrap();
        let columns = store
            .conn
            .prepare("PRAGMA table_info(broker_events)")
            .unwrap()
            .query_map([], |row| row.get::<_, String>(1))
            .unwrap()
            .collect::<Result<Vec<_>, _>>()
            .unwrap();
        assert!(columns
            .iter()
            .any(|column| column == "normalized_payload_json"));
        assert!(!columns.iter().any(|column| column == "event_json"));
        assert_eq!(
            store.ingest(&sample_event("schema-event")).unwrap(),
            BrokerIngestOutcome::Accepted
        );
        assert_eq!(store.claim_ready(1).unwrap().len(), 1);

        let _ = fs::remove_file(&path);
        let _ = fs::remove_file(path.with_extension("db-wal"));
        let _ = fs::remove_file(path.with_extension("db-shm"));
    }

    #[test]
    fn stale_lease_cannot_overwrite_a_reclaimed_attempt() {
        let path = temp_db("lease-generation");
        let mut store = BrokerStore::open_at(&path).unwrap();
        store.ingest(&sample_event("lease-event")).unwrap();
        let first = store.claim_ready(1).unwrap().remove(0);
        store
            .mark_retry("lease-event", first.attempt_count, "delivery", "offline")
            .unwrap();
        store
            .conn
            .execute(
                "UPDATE broker_events SET next_attempt_at = 0 WHERE event_id = 'lease-event'",
                [],
            )
            .unwrap();
        let second = store.claim_ready(1).unwrap().remove(0);
        assert_eq!(second.attempt_count, first.attempt_count + 1);
        assert!(!store
            .mark_processed_for_attempt("lease-event", first.attempt_count)
            .unwrap());
        assert!(store
            .mark_processed_for_attempt("lease-event", second.attempt_count)
            .unwrap());
        assert_eq!(store.stats().unwrap().processed, 1);
        let _ = fs::remove_file(&path);
        let _ = fs::remove_file(path.with_extension("db-wal"));
        let _ = fs::remove_file(path.with_extension("db-shm"));
    }

    #[test]
    fn rename_requires_previous_entity() {
        let mut event = sample_event("rename");
        event.change_kind = BrokerChangeKind::Rename;
        assert!(event.clone().normalize().is_err());
        event.previous_entity = Some("/workspace/src/old.rs".to_string());
        assert!(event.normalize().is_ok());
    }

    #[test]
    fn rename_previous_entity_must_stay_inside_project_root() {
        let mut event = sample_event("rename-boundary");
        event.change_kind = BrokerChangeKind::Rename;
        event.previous_entity = Some("/other/src/old.rs".to_string());
        assert!(event.normalize().is_err());
    }

    #[test]
    fn payload_is_metadata_only_and_size_is_bounded() {
        let event = sample_event("metadata").normalize().unwrap();
        let json = serde_json::to_value(&event).unwrap();
        assert!(!json.as_object().unwrap().contains_key("prompt"));
        assert!(event.serialized_len().unwrap() < MAX_EVENT_BYTES);
    }

    #[test]
    fn processing_error_is_sanitized_before_storage() {
        let path = temp_db("error-sanitize");
        let store = BrokerStore::open_at(&path).unwrap();
        store.ingest(&sample_event("sanitize")).unwrap();
        let mut store = BrokerStore::open_at(&path).unwrap();
        let claimed = store.claim_ready(1).unwrap();
        store
            .mark_retry(
                "sanitize",
                claimed[0].attempt_count,
                "delivery",
                "request /project/src/lib.rs included prompt and patch content",
            )
            .unwrap();
        let stats = store.stats().unwrap();
        assert_eq!(
            stats.last_error_message.as_deref(),
            Some("broker processing failed; inspect broker logs for a sanitized error code")
        );
        let _ = fs::remove_file(&path);
        let _ = fs::remove_file(path.with_extension("db-wal"));
        let _ = fs::remove_file(path.with_extension("db-shm"));
    }
}
