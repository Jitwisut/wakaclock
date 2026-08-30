use crate::{
    ai::{AiUsageIngestReport, AiUsageRecord},
    config::Config,
    error::{AppError, AppResult},
    heartbeat::{Heartbeat, DEDUP_WINDOW_SECONDS},
    queue::Queue,
};
use reqwest::{header, Client};
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, fs, path::PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatusBarSnapshot {
    pub total_seconds: f64,
    pub human_readable: String,
    pub heartbeat_count: u64,
    #[serde(default)]
    pub confirmed_seconds: Option<f64>,
    /// Additive fields returned by newer servers. Older servers omit them and the
    /// client treats the missing values as zero/unknown.
    #[serde(default)]
    pub queued_seconds: f64,
    #[serde(default)]
    pub last_heartbeat_at: Option<f64>,
    #[serde(default)]
    pub timezone: Option<String>,
    #[serde(default)]
    pub buffered_seconds: f64,
    #[serde(default)]
    pub agent_health: Option<serde_json::Value>,
    #[serde(default)]
    pub covered_intervals: Vec<crate::heartbeat::ActivitySegment>,
    #[serde(default)]
    pub last_increment_seconds: Option<f64>,
    #[serde(default)]
    pub last_increment_source: Option<String>,
    #[serde(default)]
    pub discarded_seconds: f64,
}

/// Why the server last refused a heartbeat, and when. Persisted so a refusal outlives the
/// process that saw it — see `record_delivery_failure`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryFailure {
    pub at: f64,
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct SendReport {
    pub sent: usize,
    pub deduped: usize,
    pub queued: usize,
    pub flushed: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// What a queue flush actually did. `flushed` alone was ambiguous in the one place it
/// matters most — `wakaclock status` printing "Queued: 2 / Flushed now: 0" gave no hint
/// whether the server was down, the key was rejected, or the queue was simply empty.
#[derive(Debug, Clone)]
pub struct FlushReport {
    pub flushed: usize,
    /// Why the flush stopped before draining the queue, if it did. Flushing sends one
    /// heartbeat at a time and stops at the first failure, so the remaining entries keep
    /// their order and a dead server is not hammered; this carries that first failure's
    /// message instead of discarding it.
    pub stopped_because: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RepairDayReport {
    pub date: String,
    pub timezone: String,
    pub before_seconds: f64,
    pub after_seconds: f64,
    pub duplicate_heartbeats: u64,
    pub overlap_seconds: f64,
    pub long_gap_seconds: f64,
    #[serde(default)]
    pub revision_id: Option<String>,
    pub applied: bool,
    #[serde(default)]
    pub dry_run: bool,
}

impl SendReport {
    fn queued(sent: usize, deduped: usize, queued: usize, error: Option<String>) -> Self {
        Self {
            sent,
            deduped,
            queued,
            flushed: 0,
            error,
        }
    }
}

pub struct ApiClient {
    config: Config,
    client: Client,
}

impl ApiClient {
    pub fn new(config: Config) -> AppResult<Self> {
        let mut headers = header::HeaderMap::new();
        if let Some(api_key) = config.api_key.as_deref() {
            let mut value = header::HeaderValue::from_str(&format!("Bearer {api_key}"))
                .map_err(|e| AppError::Auth(e.to_string()))?;
            value.set_sensitive(true);
            headers.insert(header::AUTHORIZATION, value);
        }

        let client = Client::builder().default_headers(headers).build()?;
        Ok(Self { config, client })
    }

    pub async fn send_heartbeat(&self, heartbeat: Heartbeat) -> AppResult<SendReport> {
        self.send_heartbeats(vec![heartbeat]).await
    }

    pub async fn send_heartbeats(&self, mut heartbeats: Vec<Heartbeat>) -> AppResult<SendReport> {
        // Every transport payload gets an identity before it touches the dedup cache or
        // durable queue. This makes a retry/restart indistinguishable from the original
        // request at the backend even for older callers that did not know the field yet.
        for heartbeat in &mut heartbeats {
            if heartbeat.heartbeat_id.is_none() {
                heartbeat.heartbeat_id = Some(uuid::Uuid::new_v4().to_string());
            }
        }
        let filtered = self.filter_duplicates(heartbeats)?;
        let deduped = filtered.deduped;

        if filtered.heartbeats.is_empty() {
            // A previous attempt may have queued this same stable heartbeat ID after
            // the server was unreachable. The local cache can call the retry a
            // duplicate, but that must not prevent the durable queue from being
            // drained (otherwise it waits for an unrelated heartbeat).
            let flush = match self.flush_queue_inner().await {
                Ok(flush) => flush,
                Err(error) => FlushReport {
                    flushed: 0,
                    stopped_because: Some(format!("could not flush offline queue: {error}")),
                },
            };
            return Ok(SendReport {
                sent: 0,
                deduped,
                queued: 0,
                flushed: flush.flushed,
                error: flush.stopped_because,
            });
        }

        let payloads: Vec<serde_json::Value> = filtered
            .heartbeats
            .iter()
            .map(serde_json::to_value)
            .collect::<Result<_, _>>()?;

        let send_result = if payloads.len() == 1 {
            self.post_json("/api/v1/heartbeats", &payloads[0]).await
        } else {
            self.post_json("/api/v1/heartbeats.bulk", &payloads).await
        };

        match send_result {
            Ok(()) => {
                self.clear_delivery_failure();
                let mut last_by_entity = filtered.last_by_entity;
                prune_stale_entries(&mut last_by_entity, chrono::Utc::now().timestamp() as f64);
                // The server has accepted the current payload at this point. Cache and
                // queue-maintenance failures are reported to the caller but must not turn
                // that confirmed send into a non-zero exit (which would make an editor
                // retry and double-count the heartbeat).
                let cache_error = self
                    .store_last_heartbeats(&last_by_entity)
                    .err()
                    .map(|error| format!("could not persist local dedup cache: {error}"));
                let flush = match self.flush_queue_inner().await {
                    Ok(flush) => flush,
                    Err(error) => FlushReport {
                        flushed: 0,
                        stopped_because: Some(format!("could not flush offline queue: {error}")),
                    },
                };
                let error = match (cache_error, flush.stopped_because) {
                    (Some(cache_error), Some(flush_error)) => {
                        Some(format!("{cache_error}; {flush_error}"))
                    }
                    (Some(cache_error), None) => Some(cache_error),
                    (None, flush_error) => flush_error,
                };
                Ok(SendReport {
                    sent: payloads.len(),
                    deduped,
                    queued: 0,
                    flushed: flush.flushed,
                    error,
                })
            }
            Err(error) => {
                self.record_delivery_failure(&error.to_string());
                let queue = Queue::open()?;
                for payload in &payloads {
                    queue.push(payload)?;
                }
                // Do not persist a failed payload in the local last-heartbeat cache:
                // the stable ID must remain retryable, and the durable queue already
                // provides the deduplication needed while the server is offline.
                Ok(SendReport::queued(
                    0,
                    deduped,
                    payloads.len(),
                    Some(error.to_string()),
                ))
            }
        }
    }

    pub async fn flush_queue(&self) -> AppResult<FlushReport> {
        self.flush_queue_inner().await
    }

    pub async fn today(&self) -> AppResult<StatusBarSnapshot> {
        self.today_with_timezone(None).await
    }

    /// Probe authentication without requiring the status payload to be decoded.
    /// The CLI uses this for first-run onboarding, where a machine-readable result
    /// is more useful than an exit code and an opaque reqwest error.
    pub async fn verify(&self) -> AppResult<()> {
        let response = self
            .client
            .get(format!(
                "{}/api/v1/status_bar/today",
                self.config.server_url
            ))
            .send()
            .await?;
        let response = Self::reject_unauthorized(response)?;
        response.error_for_status()?;
        Ok(())
    }

    pub async fn today_with_timezone(
        &self,
        timezone: Option<&str>,
    ) -> AppResult<StatusBarSnapshot> {
        let mut request = self.client.get(format!(
            "{}/api/v1/status_bar/today",
            self.config.server_url
        ));
        if let Some(timezone) = timezone.filter(|value| !value.trim().is_empty()) {
            request = request.query(&[("timezone", timezone)]);
        }
        let response = request.send().await?;
        let response = Self::reject_unauthorized(response)?;
        let response = response.error_for_status()?;
        Ok(response.json::<StatusBarSnapshot>().await?)
    }

    /// Upload sanitized token/session usage parsed from an agent transcript. Unlike
    /// heartbeats this stream is not placed in the offline heartbeat queue: each event
    /// has its own stable provider id, so a failed or retried batch can simply be sent
    /// again without ever duplicating usage at the server.
    pub async fn send_ai_usage(&self, records: &[AiUsageRecord]) -> AppResult<AiUsageIngestReport> {
        let response = self
            .client
            .post(format!("{}/api/v1/ai/usage", self.config.server_url))
            .json(records)
            .send()
            .await?;
        let response = Self::reject_unauthorized(response)?;
        let response = Self::error_for_status_with_body(response).await?;
        Ok(response.json::<AiUsageIngestReport>().await?)
    }

    pub async fn repair_day(
        &self,
        date: &str,
        timezone: Option<&str>,
        apply: bool,
    ) -> AppResult<RepairDayReport> {
        let response = self
            .client
            .post(format!("{}/api/v1/repair/day", self.config.server_url))
            .json(&serde_json::json!({
                "date": date,
                "timezone": timezone,
                "apply": apply,
            }))
            .send()
            .await?;
        let response = Self::reject_unauthorized(response)?;
        Ok(response
            .error_for_status()?
            .json::<RepairDayReport>()
            .await?)
    }

    /// Turns a 401 into a message that actually says what to do about it, instead of
    /// letting it fall through to `error_for_status()` and print as an opaque
    /// `Http(reqwest::Error { kind: Status(401, None), .. })` — which was indistinguishable
    /// from "server unreachable" to a VS Code user (both surfaced as the same generic
    /// wakaclock-cli exit-code-1 toast). The most common real cause: the API key stored
    /// in the editor's own SecretStorage (set via "Wakaclock: Set API Key") doesn't match
    /// what the server currently recognizes — e.g. it was regenerated on the dashboard,
    /// which invalidates the previous key.
    fn reject_unauthorized(response: reqwest::Response) -> AppResult<reqwest::Response> {
        if response.status() == reqwest::StatusCode::UNAUTHORIZED {
            return Err(AppError::Auth(
                "API key was rejected by the server. If you regenerated your API key on \
                 the dashboard, the old one stopped working — run \"Wakaclock: Set API Key\" \
                 again with a fresh key from Settings → API key."
                    .to_string(),
            ));
        }
        Ok(response)
    }

    fn filter_duplicates(&self, heartbeats: Vec<Heartbeat>) -> AppResult<FilteredHeartbeats> {
        let mut last_by_entity = self.load_last_heartbeats();
        let (filtered, deduped) = filter_duplicates_against(heartbeats, &mut last_by_entity)?;

        Ok(FilteredHeartbeats {
            heartbeats: filtered,
            deduped,
            last_by_entity,
        })
    }

    async fn flush_queue_inner(&self) -> AppResult<FlushReport> {
        let pending = Queue::open()?.pop_all()?;
        let mut flushed = 0;
        let mut stopped_because = None;

        for (id, payload) in pending {
            match self.post_json("/api/v1/heartbeats", &payload).await {
                Ok(()) => {
                    // A drained queue is proof the server is accepting again, and the
                    // editor reads this state to decide whether to warn. Leaving a stale
                    // refusal here would keep the warning up after recovery, which trains
                    // the developer to ignore it — the opposite of the point.
                    self.clear_delivery_failure();
                    Queue::open()?.remove(id)?;
                    flushed += 1;
                }
                Err(error) => {
                    self.record_delivery_failure(&error.to_string());
                    stopped_because = Some(error.to_string());
                    Queue::open()?.mark_retry(id)?;
                    break;
                }
            }
        }

        Ok(FlushReport {
            flushed,
            stopped_because,
        })
    }

    async fn post_json<T: Serialize + ?Sized>(&self, path: &str, payload: &T) -> AppResult<()> {
        let response = self
            .client
            .post(format!("{}{}", self.config.server_url, path))
            .json(payload)
            .send()
            .await?;

        let response = Self::reject_unauthorized(response)?;
        Self::error_for_status_with_body(response).await?;
        Ok(())
    }

    /// Preserve the API's bounded JSON/text error body instead of returning only
    /// reqwest's status label. This is especially important for the transcript
    /// agent: its server-side ingest path can fail in several independent
    /// ClickHouse operations, and the response body identifies which one failed.
    async fn error_for_status_with_body(
        response: reqwest::Response,
    ) -> AppResult<reqwest::Response> {
        let status = response.status();
        if !status.is_client_error() && !status.is_server_error() {
            return Ok(response);
        }

        let body = response.text().await.unwrap_or_default();
        let body = body.trim();
        let message = if body.is_empty() {
            status
                .canonical_reason()
                .unwrap_or("request failed")
                .to_string()
        } else {
            body.chars().take(2_048).collect::<String>()
        };
        Err(AppError::HttpStatus {
            status: status.as_u16(),
            message,
        })
    }

    /// Read the per-entity dedup cache.
    ///
    /// Deliberately infallible: this is a cache, and a missing, corrupt, or
    /// wrong-schema file must degrade to "nothing seen yet" rather than abort the send.
    /// The previous version propagated a parse error, which meant one bad
    /// `last_heartbeat.json` — including the older single-record format this replaced —
    /// would block every heartbeat until the file was deleted by hand.
    fn load_last_heartbeats(&self) -> HashMap<String, Heartbeat> {
        let Ok(path) = Self::last_heartbeat_path() else {
            return HashMap::new();
        };
        let Ok(content) = fs::read_to_string(&path) else {
            return HashMap::new();
        };

        if let Ok(map) = serde_json::from_str::<HashMap<String, Heartbeat>>(&content) {
            return map;
        }

        // Migration from the single-heartbeat format written by earlier versions: keep
        // the one record it held rather than discarding it, so an upgrade mid-session
        // doesn't briefly forget the file the user is actively editing.
        match serde_json::from_str::<Heartbeat>(&content) {
            Ok(legacy) => HashMap::from([(legacy.entity.clone(), legacy)]),
            Err(_) => HashMap::new(),
        }
    }

    fn store_last_heartbeats(&self, last_by_entity: &HashMap<String, Heartbeat>) -> AppResult<()> {
        let path = Self::last_heartbeat_path()?;
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }

        let content = serde_json::to_string_pretty(last_by_entity)?;
        fs::write(path, content)?;
        Ok(())
    }

    fn last_heartbeat_path() -> AppResult<PathBuf> {
        let home =
            dirs::home_dir().ok_or_else(|| AppError::NotFound("home directory".to_string()))?;
        Ok(home.join(".wakaclock").join("last_heartbeat.json"))
    }

    fn delivery_failure_path() -> AppResult<PathBuf> {
        let home =
            dirs::home_dir().ok_or_else(|| AppError::NotFound("home directory".to_string()))?;
        Ok(home.join(".wakaclock").join("last-delivery-failure.json"))
    }

    /// Remember why the server last refused a heartbeat.
    ///
    /// Without this the refusal existed only in the `SendReport` handed back to the
    /// caller, and every caller that matters discards it — the agent hooks end their CLI
    /// invocation with `>/dev/null 2>&1 || true` precisely so a tracking failure can never
    /// break the tool call it is observing. The heartbeat went quietly into the offline
    /// queue and the developer's dashboard simply showed a light day.
    ///
    /// That is how an expired trial spent a day and a half looking exactly like an idle
    /// one. Writing the reason down is what lets `wakaclock status` and the editor say
    /// "the server is refusing these" instead of nothing at all. Best-effort: failing to
    /// record a failure must never turn into a second failure.
    fn record_delivery_failure(&self, message: &str) {
        let Ok(path) = Self::delivery_failure_path() else {
            return;
        };
        if let Some(parent) = path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        let failure = DeliveryFailure {
            at: chrono::Utc::now().timestamp() as f64,
            message: message.to_string(),
        };
        if let Ok(serialized) = serde_json::to_string(&failure) {
            let _ = fs::write(&path, serialized);
        }
    }

    /// A send got through, so whatever was wrong no longer is.
    fn clear_delivery_failure(&self) {
        if let Ok(path) = Self::delivery_failure_path() {
            let _ = fs::remove_file(path);
        }
    }

    /// The last recorded refusal, if the server has not accepted anything since.
    pub fn last_delivery_failure() -> Option<DeliveryFailure> {
        let path = Self::delivery_failure_path().ok()?;
        let raw = fs::read_to_string(path).ok()?;
        serde_json::from_str(&raw).ok()
    }
}

struct FilteredHeartbeats {
    heartbeats: Vec<Heartbeat>,
    deduped: usize,
    /// The dedup cache updated with everything accepted in this batch, ready to persist
    /// once the send actually succeeds.
    last_by_entity: HashMap<String, Heartbeat>,
}

/// Decide which heartbeats survive dedup, comparing each against the last accepted
/// heartbeat **for its own entity**.
///
/// Keying on entity is what makes the window mean the same thing it does in WakaTime,
/// whose plugins track the last heartbeat per file. The earlier implementation kept a
/// single most-recent heartbeat for all files, so alternating between two files
/// (A→B→A→B) never matched — every heartbeat's predecessor was a different entity —
/// and dedup silently stopped applying during exactly the split-attention editing where
/// it matters most.
///
/// Pure and I/O-free so the rule can be tested without touching `~/.wakaclock`.
fn filter_duplicates_against(
    heartbeats: Vec<Heartbeat>,
    last_by_entity: &mut HashMap<String, Heartbeat>,
) -> AppResult<(Vec<Heartbeat>, usize)> {
    let mut filtered = Vec::with_capacity(heartbeats.len());
    let mut deduped = 0;

    for heartbeat in heartbeats {
        heartbeat.validate().map_err(AppError::Validation)?;

        let duplicate = last_by_entity
            .get(&heartbeat.entity)
            .map(|last| heartbeat.is_duplicate_of(last))
            .unwrap_or(false);

        if duplicate {
            deduped += 1;
            continue;
        }

        last_by_entity.insert(heartbeat.entity.clone(), heartbeat.clone());
        filtered.push(heartbeat);
    }

    Ok((filtered, deduped))
}

/// Drop cache entries too old to ever match again.
///
/// An entry older than the dedup window cannot make any future heartbeat a duplicate,
/// so keeping it only grows the file. This makes the cache self-bounding — it holds
/// roughly "files touched in the last two minutes" — with no LRU or size cap to tune.
fn prune_stale_entries(last_by_entity: &mut HashMap<String, Heartbeat>, now: f64) {
    last_by_entity.retain(|_, heartbeat| (now - heartbeat.time).abs() < DEDUP_WINDOW_SECONDS);
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::heartbeat::EntityType;
    use uuid::Uuid;

    fn heartbeat(entity: &str, time: f64) -> Heartbeat {
        let mut hb = Heartbeat::new(
            Uuid::nil(),
            entity.to_string(),
            EntityType::File,
            "test".to_string(),
        );
        hb.time = time;
        hb
    }

    /// The bug this per-entity cache exists to fix: with a single shared "last
    /// heartbeat", alternating between two files defeated dedup completely.
    #[test]
    fn alternating_files_still_dedup_per_file() {
        let mut cache = HashMap::new();
        let batch = vec![
            heartbeat("a.rs", 1_000.0),
            heartbeat("b.rs", 1_010.0),
            heartbeat("a.rs", 1_020.0), // duplicate of a.rs @1000
            heartbeat("b.rs", 1_030.0), // duplicate of b.rs @1010
        ];

        let (filtered, deduped) = filter_duplicates_against(batch, &mut cache).unwrap();

        assert_eq!(deduped, 2, "the two repeats must be recognised per file");
        assert_eq!(filtered.len(), 2);
        assert_eq!(cache.len(), 2, "one entry per distinct file");
    }

    #[test]
    fn each_file_keeps_its_own_window() {
        let mut cache = HashMap::new();
        filter_duplicates_against(vec![heartbeat("a.rs", 1_000.0)], &mut cache).unwrap();

        // Well outside a.rs's window, so not a duplicate even though a.rs is cached.
        let (filtered, deduped) =
            filter_duplicates_against(vec![heartbeat("a.rs", 1_200.0)], &mut cache).unwrap();
        assert_eq!(deduped, 0);
        assert_eq!(filtered.len(), 1);
        assert_eq!(
            cache["a.rs"].time, 1_200.0,
            "cache advances to the newest accepted"
        );
    }

    #[test]
    fn prune_drops_only_entries_past_the_window() {
        let mut cache = HashMap::from([
            ("old.rs".to_string(), heartbeat("old.rs", 1_000.0)),
            ("fresh.rs".to_string(), heartbeat("fresh.rs", 1_500.0)),
        ]);

        prune_stale_entries(&mut cache, 1_550.0);

        assert!(
            !cache.contains_key("old.rs"),
            "cannot match again, so dropped"
        );
        assert!(cache.contains_key("fresh.rs"));
    }
}
