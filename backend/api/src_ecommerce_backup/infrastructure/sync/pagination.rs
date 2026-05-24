/// Pagination and sync strategy implementation for product sync
/// Based on specifications in prompt/002.md section 9
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Pagination mode enumeration
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PaginationMode {
    /// Offset-based pagination with limit
    OffsetLimit,
    /// Cursor-based pagination
    Cursor,
    /// Opaque token pagination
    Token,
}

/// Pagination configuration for platforms
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaginationConfig {
    pub mode: PaginationMode,
    pub page_size: u32,
    pub max_pages: Option<u32>,
    pub supports_ordering: bool,
    pub preferred_ordering: Option<String>, // e.g., "updated_at ASC", "id ASC"
    pub supports_date_filtering: bool,
    pub cursor_field: Option<String>, // Field used for cursor-based pagination
}

/// Pagination state for sync operations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaginationState {
    pub mode: PaginationMode,
    pub current_offset: Option<i64>,
    pub current_cursor: Option<String>,
    pub current_token: Option<String>,
    pub page_seq: u32,
    pub total_items: u64,
    pub has_more: bool,
    pub last_item_timestamp: Option<DateTime<Utc>>,
}

impl Default for PaginationState {
    fn default() -> Self {
        Self {
            mode: PaginationMode::OffsetLimit,
            current_offset: Some(0),
            current_cursor: None,
            current_token: None,
            page_seq: 0,
            total_items: 0,
            has_more: true,
            last_item_timestamp: None,
        }
    }
}

/// Sync bounds for incremental synchronization
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncBounds {
    /// Lower bound timestamp (inclusive)
    pub lower_inclusive: Option<DateTime<Utc>>,
    /// Upper bound timestamp (exclusive)
    pub upper_exclusive: Option<DateTime<Utc>>,
    /// Whether to use server-side filtering
    pub use_server_filtering: bool,
    /// Whether to perform client-side deduplication
    pub client_side_dedupe: bool,
}

impl Default for SyncBounds {
    fn default() -> Self {
        Self {
            lower_inclusive: None,
            upper_exclusive: Some(Utc::now()),
            use_server_filtering: true,
            client_side_dedupe: true,
        }
    }
}

/// Pagination strategy manager
pub struct PaginationStrategy {
    config: PaginationConfig,
}

impl PaginationStrategy {
    pub fn new(config: PaginationConfig) -> Self {
        Self { config }
    }

    /// Initialize pagination state for new sync
    pub fn init_state(&self, bounds: &SyncBounds) -> PaginationState {
        PaginationState {
            mode: self.config.mode.clone(),
            current_offset: match self.config.mode {
                PaginationMode::OffsetLimit => Some(0),
                _ => None,
            },
            current_cursor: None,
            current_token: None,
            page_seq: 0,
            total_items: 0,
            has_more: true,
            last_item_timestamp: bounds.lower_inclusive,
        }
    }

    /// Build query parameters for next page
    pub fn build_query_params(
        &self,
        state: &PaginationState,
        bounds: &SyncBounds,
    ) -> HashMap<String, String> {
        let mut params = HashMap::new();

        // Add pagination parameters based on mode
        match self.config.mode {
            PaginationMode::OffsetLimit => {
                if let Some(offset) = state.current_offset {
                    params.insert("offset".to_string(), offset.to_string());
                }
                params.insert("limit".to_string(), self.config.page_size.to_string());
            }
            PaginationMode::Cursor => {
                if let Some(ref cursor) = state.current_cursor {
                    params.insert("cursor".to_string(), cursor.clone());
                }
                params.insert("limit".to_string(), self.config.page_size.to_string());
            }
            PaginationMode::Token => {
                if let Some(ref token) = state.current_token {
                    params.insert("page_token".to_string(), token.clone());
                }
                params.insert("page_size".to_string(), self.config.page_size.to_string());
            }
        }

        // Add ordering if supported
        if self.config.supports_ordering {
            if let Some(ref ordering) = self.config.preferred_ordering {
                params.insert("order".to_string(), ordering.clone());
            }
        }

        // Add date filtering if supported and bounds are provided
        if self.config.supports_date_filtering && bounds.use_server_filtering {
            if let Some(lower) = bounds.lower_inclusive {
                params.insert("updated_since".to_string(), lower.to_rfc3339());
            }
            if let Some(upper) = bounds.upper_exclusive {
                params.insert("updated_before".to_string(), upper.to_rfc3339());
            }
        }

        params
    }

    /// Update pagination state after processing a page
    pub fn update_state(
        &self,
        state: &mut PaginationState,
        page_items: u32,
        next_cursor: Option<String>,
        next_token: Option<String>,
        last_timestamp: Option<DateTime<Utc>>,
    ) {
        state.page_seq += 1;
        state.total_items += page_items as u64;

        match self.config.mode {
            PaginationMode::OffsetLimit => {
                if let Some(ref mut offset) = state.current_offset {
                    *offset += self.config.page_size as i64;
                }
                // No more pages if we got fewer items than page size
                state.has_more = page_items == self.config.page_size;
            }
            PaginationMode::Cursor => {
                state.current_cursor = next_cursor;
                state.has_more = state.current_cursor.is_some();
            }
            PaginationMode::Token => {
                state.current_token = next_token;
                state.has_more = state.current_token.is_some();
            }
        }

        // Update timestamp tracking
        if let Some(ts) = last_timestamp {
            state.last_item_timestamp = Some(ts);
        }

        // Check max pages limit
        if let Some(max_pages) = self.config.max_pages {
            if state.page_seq >= max_pages {
                state.has_more = false;
            }
        }
    }

    /// Check if sync should continue
    pub fn should_continue(&self, state: &PaginationState, bounds: &SyncBounds) -> bool {
        if !state.has_more {
            return false;
        }

        // Check if we've exceeded upper bound
        if let (Some(upper), Some(last_ts)) = (bounds.upper_exclusive, state.last_item_timestamp) {
            if last_ts >= upper {
                return false;
            }
        }

        true
    }

    /// Get sync progress percentage
    pub fn get_progress(&self, state: &PaginationState) -> Option<f64> {
        self.config
            .max_pages
            .map(|max_pages| (state.page_seq as f64 / max_pages as f64) * 100.0)
    }

    /// Reset state for backfill operation
    pub fn reset_for_backfill(&self, state: &mut PaginationState, new_bounds: &SyncBounds) {
        state.current_offset = match self.config.mode {
            PaginationMode::OffsetLimit => Some(0),
            _ => None,
        };
        state.current_cursor = None;
        state.current_token = None;
        state.page_seq = 0;
        state.total_items = 0;
        state.has_more = true;
        state.last_item_timestamp = new_bounds.lower_inclusive;
    }
}

/// Platform-specific pagination configurations
pub struct PlatformPaginationConfigs;

impl PlatformPaginationConfigs {
    /// Get pagination config for TikTok Shop
    pub fn tiktok_shop() -> PaginationConfig {
        PaginationConfig {
            mode: PaginationMode::OffsetLimit,
            page_size: 20,
            max_pages: Some(100),
            supports_ordering: true,
            preferred_ordering: Some("update_time ASC".to_string()),
            supports_date_filtering: true,
            cursor_field: None,
        }
    }

    /// Get pagination config for Shopee
    pub fn shopee() -> PaginationConfig {
        PaginationConfig {
            mode: PaginationMode::OffsetLimit,
            page_size: 100,
            max_pages: Some(1000),
            supports_ordering: true,
            preferred_ordering: Some("update_time ASC".to_string()),
            supports_date_filtering: true,
            cursor_field: None,
        }
    }

    /// Get pagination config for Lazada
    pub fn lazada() -> PaginationConfig {
        PaginationConfig {
            mode: PaginationMode::OffsetLimit,
            page_size: 50,
            max_pages: Some(500),
            supports_ordering: true,
            preferred_ordering: Some("updated_at ASC".to_string()),
            supports_date_filtering: true,
            cursor_field: None,
        }
    }

    /// Get pagination config for Shopify
    pub fn shopify() -> PaginationConfig {
        PaginationConfig {
            mode: PaginationMode::Cursor,
            page_size: 250,
            max_pages: None,
            supports_ordering: true,
            preferred_ordering: Some("updated_at ASC".to_string()),
            supports_date_filtering: true,
            cursor_field: Some("updated_at".to_string()),
        }
    }

    /// Get pagination config for Amazon
    pub fn amazon() -> PaginationConfig {
        PaginationConfig {
            mode: PaginationMode::Token,
            page_size: 50,
            max_pages: None,
            supports_ordering: false,
            preferred_ordering: None,
            supports_date_filtering: true,
            cursor_field: None,
        }
    }

    /// Get pagination config by platform name
    pub fn get_config(platform: &str) -> Option<PaginationConfig> {
        match platform.to_lowercase().as_str() {
            "tiktok" | "tiktok_shop" => Some(Self::tiktok_shop()),
            "shopee" => Some(Self::shopee()),
            "lazada" => Some(Self::lazada()),
            "shopify" => Some(Self::shopify()),
            "amazon" => Some(Self::amazon()),
            _ => None,
        }
    }
}
