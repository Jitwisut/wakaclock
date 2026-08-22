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
}

#[derive(Debug, Clone)]
pub struct SendReport {
    pub sent: usize,
    pub deduped: usize,
    pub queued: usize,
    pub flushed: usize,
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

impl SendReport {
    fn queued(sent: usize, deduped: usize, queued: usize) -> Self {
        Self {
            sent,
            deduped,
            queued,
            flushed: 0,
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

    pub async fn send_heartbeats(&self, heartbeats: Vec<Heartbeat>) -> AppResult<SendReport> {
        let queue = Queue::open()?;
        let filtered = self.filter_duplicates(heartbeats)?;
        let deduped = filtered.deduped;

        if filtered.heartbeats.is_empty() {
            return Ok(SendReport {
                sent: 0,
                deduped,
                queued: 0,
                flushed: 0,
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
                let mut last_by_entity = filtered.last_by_entity;
                prune_stale_entries(&mut last_by_entity, chrono::Utc::now().timestamp() as f64);
                self.store_last_heartbeats(&last_by_entity)?;
                let flush = self.flush_queue_inner(&queue).await?;
                Ok(SendReport {
                    sent: payloads.len(),
                    deduped,
                    queued: 0,
                    flushed: flush.flushed,
                })
            }
            Err(_) => {
                for payload in &payloads {
                    queue.push(payload)?;
                }
                Ok(SendReport::queued(0, deduped, payloads.len()))
            }
        }
    }

    pub async fn flush_queue(&self) -> AppResult<FlushReport> {
        let queue = Queue::open()?;
        self.flush_queue_inner(&queue).await
    }

    pub async fn today(&self) -> AppResult<StatusBarSnapshot> {
        let response = self
            .client
            .get(format!(
                "{}/api/v1/status_bar/today",
                self.config.server_url
            ))
            .send()
            .await?;
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
        let response = response.error_for_status()?;
        Ok(response.json::<AiUsageIngestReport>().await?)
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

    async fn flush_queue_inner(&self, queue: &Queue) -> AppResult<FlushReport> {
        let pending = queue.pop_all()?;
        let mut flushed = 0;
        let mut stopped_because = None;

        for (id, payload) in pending {
            match self.post_json("/api/v1/heartbeats", &payload).await {
                Ok(()) => {
                    queue.remove(id)?;
                    flushed += 1;
                }
                Err(error) => {
                    stopped_because = Some(error.to_string());
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
        response.error_for_status()?;
        Ok(())
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
