use std::{sync::Arc, time::Duration};

use anyhow::{anyhow, Context, Result};
use async_trait::async_trait;
use dashmap::DashMap;
use futures::stream::{self, StreamExt};
use reqwest::Client;
use scraper::{Html, Selector};
use tokio::sync::Semaphore;
use tracing::{error, info, warn};
use uuid::Uuid;

use crate::{
    model::{
        error::{AppError, AppResult},
        ingestion::{
            CrawlerFailureMessage, CrawlerResultMessage, CrawlerUrlBatchMessage, IngestionSource,
            Marketplace, ProductBatchItem, ProductCurrentRow, ProductEventRow,
        },
    },
    worker::Worker,
    AppState,
};
use chrono::Utc;
use rust_decimal::Decimal;
use serde_json::json;
use sha2::{Digest, Sha256};

const DEFAULT_FETCH_CONCURRENCY: usize = 10;
const DEFAULT_DOMAIN_CONCURRENCY: usize = 4;
const MAX_FETCH_ATTEMPTS: usize = 3;

pub struct CrawlerConsumer {
    state: Arc<AppState>,
    consumer_name: String,
    fetch_concurrency: usize,
    per_domain_limit: usize,
    http_client: Client,
}

impl CrawlerConsumer {
    pub fn new(state: Arc<AppState>, consumer_name: impl Into<String>) -> Result<Self> {
        let client = Client::builder()
            .timeout(Duration::from_secs(20))
            .user_agent("OnSalesCrawler/1.0 (+https://onsales.example.com)")
            .build()
            .context("failed to build crawler HTTP client")?;

        Ok(Self {
            state,
            consumer_name: consumer_name.into(),
            fetch_concurrency: DEFAULT_FETCH_CONCURRENCY,
            per_domain_limit: DEFAULT_DOMAIN_CONCURRENCY,
            http_client: client,
        })
    }

    async fn setup_subscription(&self) -> Result<()> {
        let queue = self.state.queue.clone();
        let subject = self.state.config.ingestion.crawler_url_queue.clone();

        queue
            .create_durable_consumer("crawler_ingest", &self.consumer_name, &subject)
            .await?;

        let state = self.state.clone();
        let client = self.http_client.clone();
        let fetch_concurrency = self.fetch_concurrency;
        let per_domain_limit = self.per_domain_limit;

        queue
            .subscribe_bytes(
                &subject,
                Box::new(move |payload| {
                    let state = state.clone();
                    let client = client.clone();
                    tokio::task::block_in_place(|| {
                        tokio::runtime::Handle::current().block_on(async move {
                            if let Err(err) = process_crawler_batch(
                                state,
                                client,
                                payload,
                                fetch_concurrency,
                                per_domain_limit,
                            )
                            .await
                            {
                                error!("crawler consumer failed: {err:?}");
                                return Err(err);
                            }
                            Ok(())
                        })
                    })
                }),
            )
            .await?;

        info!(consumer = %self.consumer_name, subject = %subject, "crawler consumer subscribed");
        Ok(())
    }
}

#[async_trait]
impl Worker for CrawlerConsumer {
    async fn start(&self) -> AppResult<()> {
        self.setup_subscription()
            .await
            .map_err(|e| AppError::QueueError(e.to_string()))?;

        tokio::signal::ctrl_c()
            .await
            .map_err(|e| AppError::InternalError(e.to_string()))?;

        Ok(())
    }

    async fn stop(&self) -> AppResult<()> {
        Ok(())
    }

    async fn process_job(&self, _job_data: Vec<u8>) -> AppResult<()> {
        Ok(())
    }
}

async fn process_crawler_batch(
    state: Arc<AppState>,
    client: Client,
    payload: Vec<u8>,
    fetch_concurrency: usize,
    per_domain_limit: usize,
) -> Result<()> {
    let mut message: CrawlerUrlBatchMessage =
        serde_json::from_slice(&payload).context("failed to deserialize CrawlerUrlBatchMessage")?;

    if message.urls.is_empty() {
        return Err(anyhow!("crawler batch contains no urls"));
    }

    let job_id = message
        .job_id
        .clone()
        .unwrap_or_else(|| format!("cb_{}", Uuid::new_v4()));
    message.job_id = Some(job_id.clone());

    let start = std::time::Instant::now();
    let domain_limiters: Arc<DashMap<String, Arc<Semaphore>>> = Arc::new(DashMap::new());

    let stream = stream::iter(message.urls.clone()).map(|url| {
        let client = client.clone();
        let domain_limiters = domain_limiters.clone();
        async move { process_single_url(client, domain_limiters, url, per_domain_limit).await }
    });

    let mut successes = Vec::new();
    let mut failures = Vec::new();

    let mut buffered = stream.buffer_unordered(fetch_concurrency);
    while let Some(result) = buffered.next().await {
        match result {
            Ok(item) => successes.push(item),
            Err(failure) => failures.push(failure),
        }
    }

    if successes.is_empty() && failures.is_empty() {
        return Err(anyhow!("crawler batch produced no results"));
    }

    for item in &mut successes {
        item.batch_id = Some(message.batch_id.clone());
        item.job_id = Some(job_id.clone());
    }

    let repo = state.product_ingestion_repository();
    if !successes.is_empty() {
        let events: Vec<ProductEventRow> =
            successes.iter().map(ProductEventRow::from_item).collect();
        let snapshots: Vec<ProductCurrentRow> =
            successes.iter().map(ProductCurrentRow::from_item).collect();
        repo.persist_batch(&events, &snapshots)
            .await
            .context("failed to persist crawler inserts")?;
    }

    let duration = start.elapsed();
    info!(
        batch_id = %message.batch_id,
        job_id = %job_id,
        success = successes.len(),
        failure = failures.len(),
        elapsed_ms = duration.as_millis(),
        "crawler batch processed"
    );

    publish_crawler_results(&state, &message, &job_id, &successes, &failures, duration).await?;

    Ok(())
}

async fn publish_crawler_results(
    state: &Arc<AppState>,
    message: &CrawlerUrlBatchMessage,
    job_id: &str,
    successes: &[ProductBatchItem],
    failures: &[UrlFailure],
    duration: std::time::Duration,
) -> Result<()> {
    let queue = state.queue.clone();
    let summary = CrawlerResultMessage {
        batch_id: message.batch_id.clone(),
        job_id: job_id.to_string(),
        tenant_id: message.tenant_id.clone(),
        success_count: successes.len(),
        failure_count: failures.len(),
        duration_ms: duration.as_millis(),
        processed_at: Utc::now(),
    };

    queue
        .publish_bytes(
            &state.config.ingestion.crawler_result_queue,
            serde_json::to_vec(&summary)?,
        )
        .await?;

    if !failures.is_empty() {
        for failure in failures {
            let dlq = CrawlerFailureMessage {
                batch_id: message.batch_id.clone(),
                job_id: job_id.to_string(),
                url: failure.url.clone(),
                reason: failure.reason.clone(),
                retryable: failure.retryable,
                occurred_at: Utc::now(),
            };

            queue
                .publish_bytes(
                    &state.config.ingestion.crawler_dlq,
                    serde_json::to_vec(&dlq)?,
                )
                .await?;
        }
    }

    Ok(())
}

#[derive(Debug, Clone)]
struct UrlFailure {
    url: String,
    reason: String,
    retryable: bool,
}

async fn process_single_url(
    client: Client,
    domain_limiters: Arc<DashMap<String, Arc<Semaphore>>>,
    url: String,
    per_domain_limit: usize,
) -> Result<ProductBatchItem, UrlFailure> {
    let normalized_url = normalize_url(&url).map_err(|err| UrlFailure {
        url: url.clone(),
        reason: format!("invalid url: {err}"),
        retryable: false,
    })?;

    let domain = domain_from_url(&normalized_url).ok_or_else(|| UrlFailure {
        url: url.clone(),
        reason: "unable to determine domain".to_string(),
        retryable: false,
    })?;

    let limiter = domain_limiters
        .entry(domain.clone())
        .or_insert_with(|| Arc::new(Semaphore::new(per_domain_limit)))
        .clone();

    let _permit = limiter.acquire_owned().await.map_err(|err| UrlFailure {
        url: url.clone(),
        reason: format!("failed to acquire domain permit: {err}"),
        retryable: true,
    })?;

    let body = fetch_with_retry(&client, &normalized_url)
        .await
        .map_err(|err| UrlFailure {
            url: url.clone(),
            reason: err.reason,
            retryable: err.retryable,
        })?;

    build_product_item(&normalized_url, &body).map_err(|err| UrlFailure {
        url: url.clone(),
        reason: err,
        retryable: false,
    })
}

struct FetchError {
    reason: String,
    retryable: bool,
}

async fn fetch_with_retry(client: &Client, url: &str) -> Result<String, FetchError> {
    let mut last_error: Option<FetchError> = None;

    for attempt in 0..MAX_FETCH_ATTEMPTS {
        match client.get(url).send().await {
            Ok(response) => {
                if response.status().is_success() {
                    return response.text().await.map_err(|e| FetchError {
                        reason: format!("failed to read body: {e}"),
                        retryable: true,
                    });
                } else if response.status().is_client_error() {
                    return Err(FetchError {
                        reason: format!("received status {}", response.status()),
                        retryable: false,
                    });
                } else {
                    last_error = Some(FetchError {
                        reason: format!("received status {}", response.status()),
                        retryable: true,
                    });
                }
            }
            Err(err) => {
                last_error = Some(FetchError {
                    reason: err.to_string(),
                    retryable: true,
                });
            }
        }

        if attempt + 1 < MAX_FETCH_ATTEMPTS {
            tokio::time::sleep(Duration::from_millis(500 * (attempt as u64 + 1))).await;
        }
    }

    Err(last_error.unwrap_or(FetchError {
        reason: "unknown fetch error".to_string(),
        retryable: true,
    }))
}

fn build_product_item(url: &str, html: &str) -> Result<ProductBatchItem, String> {
    let document = Html::parse_document(html);

    let title = extract_meta(&document, "meta[property=\"og:title\"]")
        .or_else(|| extract_meta(&document, "meta[name=\"title\"]"))
        .or_else(|| extract_text(&document, "title"));

    let image = extract_meta(&document, "meta[property=\"og:image\"]");
    let price_str = extract_meta(&document, "meta[property=\"product:price:amount\"]")
        .or_else(|| extract_meta(&document, "meta[itemprop=\"price\"]"));
    let currency = extract_meta(&document, "meta[property=\"product:price:currency\"]");
    let brand = extract_meta(&document, "meta[property=\"product:brand\"]")
        .or_else(|| extract_meta(&document, "meta[itemprop=\"brand\"]"));

    let price_amount = price_str.and_then(|value| parse_decimal(&value));
    let price_currency = currency.map(|c| c.to_uppercase());

    let mut images = Vec::new();
    if let Some(img) = image {
        images.push(img);
    }

    let idea_key = hex::encode(Sha256::digest(url.as_bytes()));

    Ok(ProductBatchItem {
        marketplace: Marketplace::GoogleMerchant,
        sku: None,
        idea_key: Some(idea_key),
        url: Some(url.to_string()),
        title,
        brand,
        price_amount,
        price_currency,
        inventory_quantity: None,
        inventory_status: None,
        images,
        attributes: serde_json::json!({ "normalized_url": url }),
        version_ts: Utc::now(),
        source: IngestionSource::Crawler,
        job_id: None,
        batch_id: None,
        idempotency_key: None,
        body_hash: None,
    })
}

fn extract_meta(document: &Html, selector: &str) -> Option<String> {
    let selector = Selector::parse(selector).ok()?;
    document
        .select(&selector)
        .filter_map(|elem| elem.value().attr("content"))
        .map(|value| value.trim().to_string())
        .find(|value| !value.is_empty())
}

fn extract_text(document: &Html, selector: &str) -> Option<String> {
    let selector = Selector::parse(selector).ok()?;
    document
        .select(&selector)
        .next()
        .map(|elem| elem.text().collect::<String>().trim().to_string())
        .filter(|text| !text.is_empty())
}

fn parse_decimal(value: &str) -> Option<Decimal> {
    let filtered: String = value
        .chars()
        .filter(|c| c.is_ascii_digit() || *c == '.' || *c == ',')
        .collect();

    if filtered.is_empty() {
        return None;
    }

    let decimal_sep = filtered.chars().rev().find(|c| *c == '.' || *c == ',');
    let normalized = match decimal_sep {
        Some('.') => filtered.replace(',', ""),
        Some(',') => filtered.replace('.', "").replace(',', "."),
        None => filtered.replace(',', ""),
        _ => filtered,
    };

    Decimal::from_str_exact(&normalized).ok()
}

fn normalize_url(raw: &str) -> Result<String, url::ParseError> {
    let mut parsed = url::Url::parse(raw)?;
    parsed.set_fragment(None);
    Ok(parsed.to_string())
}

fn domain_from_url(url: &str) -> Option<String> {
    url::Url::parse(url)
        .ok()
        .and_then(|parsed| parsed.host_str().map(|s| s.to_lowercase()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_decimal_handles_currency_formats() {
        let value = parse_decimal("$1,299.50");
        assert_eq!(value.unwrap().to_string(), "1299.50");

        let value = parse_decimal("1.234,56");
        assert_eq!(value.unwrap().to_string(), "1234.56");
    }

    #[test]
    fn normalize_url_strips_fragment() {
        let normalized = normalize_url("https://example.com/item?ref=1#details").unwrap();
        assert_eq!(normalized, "https://example.com/item?ref=1");
    }

    #[test]
    fn domain_from_url_extracts_host() {
        let domain = domain_from_url("https://sub.domain.example.com/product").unwrap();
        assert_eq!(domain, "sub.domain.example.com");
    }
}
