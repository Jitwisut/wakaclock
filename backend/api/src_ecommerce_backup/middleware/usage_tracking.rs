use std::sync::Arc;
use std::time::Instant;

use axum::{
    extract::{Request, State},
    middleware::Next,
    response::Response,
};
use once_cell::sync::Lazy;
use reqwest::{Client, StatusCode};
use serde::Serialize;
use tracing::{debug, warn};
use uuid::Uuid;

use crate::model::error::AppError;
use crate::AppState;

static USAGE_CLIENT: Lazy<Client> = Lazy::new(|| {
    Client::builder()
        .timeout(std::time::Duration::from_secs(3))
        .build()
        .expect("usage tracking client")
});

/// Contract for dispatching usage events to external systems.
pub trait UsageEventDispatcher: Send + Sync {
    fn dispatch(&self, url: String, api_key: String, body: serde_json::Value);
}

/// Reqwest-based dispatcher that pushes events asynchronously.
#[derive(Clone)]
pub struct ReqwestUsageDispatcher {
    client: Client,
}

impl Default for ReqwestUsageDispatcher {
    fn default() -> Self {
        Self {
            client: USAGE_CLIENT.clone(),
        }
    }
}

impl UsageEventDispatcher for ReqwestUsageDispatcher {
    fn dispatch(&self, url: String, api_key: String, body: serde_json::Value) {
        let client = self.client.clone();
        tokio::spawn(async move {
            if let Err(err) = send_usage_event(&client, &url, &api_key, body).await {
                warn!("Usage tracking failed for {}: {}", url, err);
            }
        });
    }
}

/// Usage tracker that collects metadata and delegates event dispatch.
struct UsageTracker<'a, D> {
    state: &'a AppState,
    dispatcher: D,
}

impl<'a, D> UsageTracker<'a, D>
where
    D: UsageEventDispatcher,
{
    fn new(state: &'a AppState, dispatcher: D) -> Self {
        Self { state, dispatcher }
    }

    async fn track(&self, request: Request, next: Next) -> Result<Response, AppError> {
        let start = Instant::now();
        let method = request.method().clone();
        let path = request.uri().path().to_string();

        let (platform, shop_id) = extract_platform_context(&path);

        let response = next.run(request).await;
        let duration_ms = start.elapsed().as_millis();
        let status_code = response.status().as_u16();

        if let Some(event_name) = build_event_name(&method, &path) {
            if let Some(strapi_base_url) = resolve_strapi_base_url(self.state) {
                if let Some(api_key) = resolve_usage_api_key(self.state) {
                    let identifier = format!("{}:{}", event_name, Uuid::new_v4());
                    let payload = UsageEventPayload {
                        method: method.as_str(),
                        path: &path,
                        status: status_code,
                        duration_ms,
                        platform: platform.as_deref(),
                        shop_id: shop_id.as_deref(),
                    };

                    let body = serde_json::json!({
                        "identifier": identifier,
                        "event_name": event_name,
                        "payload": payload,
                    });

                    let url = format!(
                        "{}/v1/billing/usage-events",
                        strapi_base_url.trim_end_matches('/')
                    );

                    self.dispatcher.dispatch(url, api_key, body);
                } else {
                    debug!("STRAPI_BACKEND_TOKEN not configured; usage event skipped");
                }
            } else {
                debug!("STRAPI_BACKEND_URL not configured; usage event skipped");
            }
        }

        Ok(response)
    }
}

#[derive(Debug, Serialize)]
struct UsageEventPayload<'a> {
    method: &'a str,
    path: &'a str,
    status: u16,
    duration_ms: u128,
    platform: Option<&'a str>,
    shop_id: Option<&'a str>,
}

/// Middleware that records platform API usage to Strapi's usage meter.
pub async fn usage_tracking_middleware(
    State(state): State<Arc<AppState>>,
    request: Request,
    next: Next,
) -> Result<Response, AppError> {
    let tracker = UsageTracker::new(&state, ReqwestUsageDispatcher::default());
    tracker.track(request, next).await
}

fn extract_platform_context(path: &str) -> (Option<String>, Option<String>) {
    let segments: Vec<&str> = path.trim_matches('/').split('/').collect();
    if let Some(idx) = segments.iter().position(|s| *s == "platform") {
        let rest = &segments[idx + 1..];
        match rest {
            ["shop", shop_id, "connect", platform, ..] => {
                (Some((*platform).to_string()), Some((*shop_id).to_string()))
            }
            ["shop", platform, "test-connection", ..] => (Some((*platform).to_string()), None),
            [platform, "test-connection", ..] => (Some((*platform).to_string()), None),
            _ => (None, None),
        }
    } else {
        (None, None)
    }
}

fn build_event_name(method: &axum::http::Method, path: &str) -> Option<String> {
    let normalized = normalize_path(path);
    Some(format!(
        "platform.api.{}.{normalized}",
        method.as_str().to_lowercase()
    ))
}

fn normalize_path(path: &str) -> String {
    let mut normalized_segments = Vec::new();
    for segment in path.trim_matches('/').split('/') {
        if segment.is_empty() {
            continue;
        }

        if segment.len() > 12
            && segment
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
        {
            normalized_segments.push(":id");
        } else {
            normalized_segments.push(segment);
        }
    }

    if normalized_segments.is_empty() {
        "root".to_string()
    } else {
        normalized_segments.join(".")
    }
}

fn resolve_strapi_base_url(state: &AppState) -> Option<String> {
    state
        .config
        .strapi_url
        .clone()
        .or_else(|| std::env::var("STRAPI_BACKEND_URL").ok())
}

fn resolve_usage_api_key(state: &AppState) -> Option<String> {
    state
        .config
        .security
        .strapi_backend_token
        .clone()
        .or_else(|| std::env::var("STRAPI_BACKEND_TOKEN").ok())
}

async fn send_usage_event(
    client: &Client,
    url: &str,
    api_key: &str,
    body: serde_json::Value,
) -> Result<(), String> {
    let response = client
        .post(url)
        .header("x-api-key", api_key)
        .json(&body)
        .send()
        .await
        .map_err(|err| err.to_string())?;

    if response.status() == StatusCode::OK {
        Ok(())
    } else {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        Err(format!("HTTP {} - {}", status, text))
    }
}
