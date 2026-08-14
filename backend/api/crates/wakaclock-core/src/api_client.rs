use crate::{
    config::Config,
    error::{AppError, AppResult},
    heartbeat::Heartbeat,
    queue::Queue,
};
use reqwest::{header, Client};
use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf};

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
                if let Some(last) = filtered.heartbeats.last() {
                    self.store_last_heartbeat(last)?;
                }
                let flushed = self.flush_queue_inner(&queue).await?;
                Ok(SendReport {
                    sent: payloads.len(),
                    deduped,
                    queued: 0,
                    flushed,
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

    pub async fn flush_queue(&self) -> AppResult<usize> {
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
        let mut filtered = Vec::with_capacity(heartbeats.len());
        let mut deduped = 0;
        let mut previous = self.load_last_heartbeat()?;

        for heartbeat in heartbeats {
            heartbeat.validate().map_err(AppError::Validation)?;

            let duplicate = previous
                .as_ref()
                .map(|last| heartbeat.is_duplicate_of(last))
                .unwrap_or(false);

            if duplicate {
                deduped += 1;
                continue;
            }

            previous = Some(heartbeat.clone());
            filtered.push(heartbeat);
        }

        Ok(FilteredHeartbeats {
            heartbeats: filtered,
            deduped,
        })
    }

    async fn flush_queue_inner(&self, queue: &Queue) -> AppResult<usize> {
        let pending = queue.pop_all()?;
        let mut flushed = 0;

        for (id, payload) in pending {
            match self.post_json("/api/v1/heartbeats", &payload).await {
                Ok(()) => {
                    queue.remove(id)?;
                    flushed += 1;
                }
                Err(_) => break,
            }
        }

        Ok(flushed)
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

    fn load_last_heartbeat(&self) -> AppResult<Option<Heartbeat>> {
        let path = Self::last_heartbeat_path()?;
        if !path.exists() {
            return Ok(None);
        }

        let content = fs::read_to_string(path)?;
        Ok(Some(serde_json::from_str(&content)?))
    }

    fn store_last_heartbeat(&self, heartbeat: &Heartbeat) -> AppResult<()> {
        let path = Self::last_heartbeat_path()?;
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }

        let content = serde_json::to_string_pretty(heartbeat)?;
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
}
