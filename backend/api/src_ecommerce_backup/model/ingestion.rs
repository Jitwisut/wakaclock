//! Product ingestion domain models used by the webhook and crawler pipelines.
//!
//! This module defines the unified product representation produced by
//! ingress sources (partner webhooks, Google Merchant crawler) together
//! with the typed ClickHouse rows for the `product_events` and
//! `product_current` tables. The models mirror the PRD specification and
//! are intentionally slim so that workers can transform payloads without
//! depending on the legacy product catalogue types.

use anyhow::{anyhow, Error};
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fmt::{Display, Formatter};
use std::str::FromStr;

/// Supported marketplaces / sources for incoming products.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Marketplace {
    Shopee,
    Tiktok,
    Lazada,
    GoogleMerchant,
    Other,
}

impl Marketplace {
    pub fn as_str(&self) -> &'static str {
        match self {
            Marketplace::Shopee => "shopee",
            Marketplace::Tiktok => "tiktok",
            Marketplace::Lazada => "lazada",
            Marketplace::GoogleMerchant => "google_merchant",
            Marketplace::Other => "other",
        }
    }
}

impl Display for Marketplace {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.as_str())
    }
}

impl FromStr for Marketplace {
    type Err = Error;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_ascii_lowercase().as_str() {
            "shopee" => Ok(Marketplace::Shopee),
            "tiktok" | "tiktok_shop" => Ok(Marketplace::Tiktok),
            "lazada" => Ok(Marketplace::Lazada),
            "google_merchant" | "google-merchant" | "googlemerchant" => {
                Ok(Marketplace::GoogleMerchant)
            }
            "other" => Ok(Marketplace::Other),
            unknown => Err(anyhow!("unsupported marketplace '{}'", unknown)),
        }
    }
}

/// Source that produced the ingestion record.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum IngestionSource {
    Webhook,
    Crawler,
}

impl IngestionSource {
    pub fn as_str(&self) -> &'static str {
        match self {
            IngestionSource::Webhook => "webhook",
            IngestionSource::Crawler => "crawler",
        }
    }
}

impl Display for IngestionSource {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.as_str())
    }
}

impl FromStr for IngestionSource {
    type Err = Error;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_ascii_lowercase().as_str() {
            "webhook" => Ok(IngestionSource::Webhook),
            "crawler" => Ok(IngestionSource::Crawler),
            unknown => Err(anyhow!("unsupported source '{}'", unknown)),
        }
    }
}

/// Unified product payload accepted from webhook and crawler ingress.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProductBatchItem {
    pub marketplace: Marketplace,
    #[serde(default)]
    pub sku: Option<String>,
    #[serde(default)]
    pub idea_key: Option<String>,
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub brand: Option<String>,
    #[serde(default)]
    pub price_amount: Option<Decimal>,
    #[serde(default)]
    pub price_currency: Option<String>,
    #[serde(default)]
    pub inventory_quantity: Option<i32>,
    #[serde(default)]
    pub inventory_status: Option<InventoryStatus>,
    #[serde(default)]
    pub images: Vec<String>,
    #[serde(default = "default_attributes")]
    pub attributes: Value,
    #[serde(default = "default_version_ts")]
    pub version_ts: DateTime<Utc>,
    pub source: IngestionSource,
    #[serde(default)]
    pub job_id: Option<String>,
    #[serde(default)]
    pub batch_id: Option<String>,
    #[serde(default)]
    pub idempotency_key: Option<String>,
    #[serde(default)]
    pub body_hash: Option<String>,
}

impl ProductBatchItem {
    pub fn natural_key(&self) -> (&Marketplace, Option<&String>, Option<&String>) {
        (&self.marketplace, self.sku.as_ref(), self.idea_key.as_ref())
    }
}

/// Inventory status values used by ingress sources.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum InventoryStatus {
    InStock,
    OutOfStock,
    Preorder,
}

impl InventoryStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            InventoryStatus::InStock => "in_stock",
            InventoryStatus::OutOfStock => "out_of_stock",
            InventoryStatus::Preorder => "preorder",
        }
    }
}

impl Display for InventoryStatus {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.as_str())
    }
}

impl FromStr for InventoryStatus {
    type Err = Error;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_ascii_lowercase().as_str() {
            "in_stock" => Ok(InventoryStatus::InStock),
            "out_of_stock" => Ok(InventoryStatus::OutOfStock),
            "preorder" => Ok(InventoryStatus::Preorder),
            unknown => Err(anyhow!("unsupported inventory status '{}'", unknown)),
        }
    }
}

fn default_attributes() -> Value {
    Value::Object(Default::default())
}

fn default_version_ts() -> DateTime<Utc> {
    Utc::now()
}

/// ClickHouse row for product_events append-only table.
#[derive(Debug, Clone, Serialize, Deserialize, clickhouse::Row)]
pub struct ProductEventRow {
    pub event_id: uuid::Uuid,
    pub source: String,
    pub marketplace: String,
    pub sku: Option<String>,
    pub idea_key: Option<String>,
    pub url: Option<String>,
    pub title: Option<String>,
    pub brand: Option<String>,
    pub price_amount: Option<Decimal>,
    pub price_currency: Option<String>,
    pub inventory_quantity: Option<i32>,
    pub inventory_status: Option<String>,
    pub images: Vec<String>,
    pub attributes: Value,
    pub version_ts: DateTime<Utc>,
    pub job_id: Option<String>,
    pub batch_id: Option<String>,
    pub idempotency_key: Option<String>,
    pub body_hash: Option<String>,
    pub inserted_at: DateTime<Utc>,
}

impl ProductEventRow {
    pub fn from_item(item: &ProductBatchItem) -> Self {
        Self {
            event_id: uuid::Uuid::new_v4(),
            source: item.source.to_string(),
            marketplace: item.marketplace.to_string(),
            sku: item.sku.clone(),
            idea_key: item.idea_key.clone(),
            url: item.url.clone(),
            title: item.title.clone(),
            brand: item.brand.clone(),
            price_amount: item.price_amount,
            price_currency: item.price_currency.clone(),
            inventory_quantity: item.inventory_quantity,
            inventory_status: item.inventory_status.as_ref().map(ToString::to_string),
            images: item.images.clone(),
            attributes: item.attributes.clone(),
            version_ts: item.version_ts,
            job_id: item.job_id.clone(),
            batch_id: item.batch_id.clone(),
            idempotency_key: item.idempotency_key.clone(),
            body_hash: item.body_hash.clone(),
            inserted_at: Utc::now(),
        }
    }
}

/// ClickHouse row for product_current ReplacingMergeTree table.
#[derive(Debug, Clone, Serialize, Deserialize, clickhouse::Row)]
pub struct ProductCurrentRow {
    pub marketplace: String,
    pub sku: Option<String>,
    pub idea_key: Option<String>,
    pub url: Option<String>,
    pub title: Option<String>,
    pub brand: Option<String>,
    pub price_amount: Option<Decimal>,
    pub price_currency: Option<String>,
    pub inventory_quantity: Option<i32>,
    pub inventory_status: Option<String>,
    pub images: Vec<String>,
    pub attributes: Value,
    pub version_ts: DateTime<Utc>,
}

impl ProductCurrentRow {
    pub fn from_item(item: &ProductBatchItem) -> Self {
        Self {
            marketplace: item.marketplace.to_string(),
            sku: item.sku.clone(),
            idea_key: item.idea_key.clone(),
            url: item.url.clone(),
            title: item.title.clone(),
            brand: item.brand.clone(),
            price_amount: item.price_amount,
            price_currency: item.price_currency.clone(),
            inventory_quantity: item.inventory_quantity,
            inventory_status: item.inventory_status.as_ref().map(ToString::to_string),
            images: item.images.clone(),
            attributes: item.attributes.clone(),
            version_ts: item.version_ts,
        }
    }
}

/// Queue message emitted by the webhook ingress containing a batch of products.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProductBatchMessage {
    pub job_id: String,
    pub tenant_id: String,
    pub dedupe_key: String,
    pub items: Vec<ProductBatchItem>,
    pub received_at: DateTime<Utc>,
}

/// Crawler input message describing a batch of URLs to fetch and normalize.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CrawlerUrlBatchMessage {
    pub batch_id: String,
    #[serde(default)]
    pub tenant_id: Option<String>,
    #[serde(default)]
    pub job_id: Option<String>,
    #[serde(default)]
    pub source: Option<String>,
    pub urls: Vec<String>,
    #[serde(default)]
    pub enqueued_at: Option<DateTime<Utc>>,
}

/// Summary emitted by the crawler worker after processing a batch.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CrawlerResultMessage {
    pub batch_id: String,
    pub job_id: String,
    #[serde(default)]
    pub tenant_id: Option<String>,
    pub success_count: usize,
    pub failure_count: usize,
    pub duration_ms: u128,
    pub processed_at: DateTime<Utc>,
}

/// Failure details sent to the crawler DLQ for inspection.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CrawlerFailureMessage {
    pub batch_id: String,
    pub job_id: String,
    pub url: String,
    pub reason: String,
    pub retryable: bool,
    pub occurred_at: DateTime<Utc>,
}
