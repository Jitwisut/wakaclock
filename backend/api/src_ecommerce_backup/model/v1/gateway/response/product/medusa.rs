//! Medusa Store API Product Response Models
//!
//! This module defines response structures for Medusa's Store API products endpoint.
//! Based on Medusa v2 Store API specification.
//!
//! ## Features
//! - Complete product schema with variants and options
//! - Sales channel support
//! - Product categories and collections
//! - Image handling with multiple URLs
//! - Metadata support for custom fields
//! - Pagination support for product lists

use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use utoipa::ToSchema;

/// Medusa Store API - Product List Response
///
/// Returned when listing products from Medusa store
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct MedusaProductListResponse {
    /// List of products
    pub products: Vec<MedusaProductResponse>,

    /// Total number of products matching the query
    pub count: u64,

    /// Number of items skipped
    pub offset: u32,

    /// Maximum number of items returned
    pub limit: u32,
}

/// Medusa Store API - Single Product Response
///
/// Complete product data from Medusa store including variants, images, and metadata
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct MedusaProductResponse {
    /// Unique product identifier
    pub id: String,

    /// Product title/name
    pub title: String,

    /// URL-friendly product handle (slug)
    pub handle: String,

    /// Product description (supports markdown)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    /// Product subtitle
    #[serde(skip_serializing_if = "Option::is_none")]
    pub subtitle: Option<String>,

    /// Product status (draft, proposed, published, rejected)
    pub status: String,

    /// Thumbnail image URL
    #[serde(skip_serializing_if = "Option::is_none")]
    pub thumbnail: Option<String>,

    /// Product images
    #[serde(default)]
    pub images: Vec<MedusaProductImage>,

    /// Product options (e.g., Size, Color)
    #[serde(default)]
    pub options: Vec<MedusaProductOption>,

    /// Product variants
    #[serde(default)]
    pub variants: Vec<MedusaProductVariant>,

    /// Product categories
    #[serde(default)]
    pub categories: Vec<MedusaProductCategory>,

    /// Product collection
    #[serde(skip_serializing_if = "Option::is_none")]
    pub collection: Option<MedusaProductCollection>,

    /// Product type
    #[serde(skip_serializing_if = "Option::is_none")]
    pub type_: Option<MedusaProductType>,

    /// Product tags
    #[serde(default)]
    pub tags: Vec<MedusaProductTag>,

    /// Whether product is giftcard
    #[serde(default)]
    pub is_giftcard: bool,

    /// Product weight (in grams)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub weight: Option<i32>,

    /// Product length (in millimeters)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub length: Option<i32>,

    /// Product height (in millimeters)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub height: Option<i32>,

    /// Product width (in millimeters)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub width: Option<i32>,

    /// HS (Harmonized System) code for customs
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hs_code: Option<String>,

    /// Country of origin (ISO 2 letter code)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub origin_country: Option<String>,

    /// Material composition
    #[serde(skip_serializing_if = "Option::is_none")]
    pub material: Option<String>,

    /// MID (Manufacturer Identification) code
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mid_code: Option<String>,

    /// Custom metadata (key-value pairs)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<HashMap<String, serde_json::Value>>,

    /// Product creation timestamp
    pub created_at: DateTime<Utc>,

    /// Last update timestamp
    pub updated_at: DateTime<Utc>,

    /// Soft deletion timestamp
    #[serde(skip_serializing_if = "Option::is_none")]
    pub deleted_at: Option<DateTime<Utc>>,
}

/// Product Image
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct MedusaProductImage {
    /// Image ID
    pub id: String,

    /// Image URL
    pub url: String,

    /// Custom metadata
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<HashMap<String, serde_json::Value>>,

    /// Creation timestamp
    pub created_at: DateTime<Utc>,

    /// Update timestamp
    pub updated_at: DateTime<Utc>,
}

/// Product Option (e.g., Size, Color)
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct MedusaProductOption {
    /// Option ID
    pub id: String,

    /// Option title (e.g., "Size", "Color")
    pub title: String,

    /// Product ID this option belongs to
    pub product_id: String,

    /// Available values for this option
    #[serde(default)]
    pub values: Vec<MedusaProductOptionValue>,

    /// Custom metadata
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<HashMap<String, serde_json::Value>>,

    /// Creation timestamp
    pub created_at: DateTime<Utc>,

    /// Update timestamp
    pub updated_at: DateTime<Utc>,
}

/// Product Option Value (e.g., "Small", "Red")
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct MedusaProductOptionValue {
    /// Value ID
    pub id: String,

    /// Value (e.g., "Small", "Red")
    pub value: String,

    /// Option ID this value belongs to
    pub option_id: String,

    /// Custom metadata
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

/// Product Variant
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct MedusaProductVariant {
    /// Variant ID
    pub id: String,

    /// Variant title
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,

    /// SKU (Stock Keeping Unit)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sku: Option<String>,

    /// Barcode (UPC, EAN, etc.)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub barcode: Option<String>,

    /// EAN (European Article Number)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ean: Option<String>,

    /// UPC (Universal Product Code)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub upc: Option<String>,

    /// Inventory quantity (if inventory management enabled)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub inventory_quantity: Option<i32>,

    /// Whether backorders are allowed
    #[serde(default)]
    pub allow_backorder: bool,

    /// Whether inventory should be managed
    #[serde(default)]
    pub manage_inventory: bool,

    /// HS code for this variant
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hs_code: Option<String>,

    /// Origin country for this variant
    #[serde(skip_serializing_if = "Option::is_none")]
    pub origin_country: Option<String>,

    /// MID code for this variant
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mid_code: Option<String>,

    /// Material for this variant
    #[serde(skip_serializing_if = "Option::is_none")]
    pub material: Option<String>,

    /// Weight in grams
    #[serde(skip_serializing_if = "Option::is_none")]
    pub weight: Option<i32>,

    /// Length in millimeters
    #[serde(skip_serializing_if = "Option::is_none")]
    pub length: Option<i32>,

    /// Height in millimeters
    #[serde(skip_serializing_if = "Option::is_none")]
    pub height: Option<i32>,

    /// Width in millimeters
    #[serde(skip_serializing_if = "Option::is_none")]
    pub width: Option<i32>,

    /// Product ID this variant belongs to
    pub product_id: String,

    /// Prices for different regions/currencies
    #[serde(default)]
    pub prices: Vec<MedusaProductVariantPrice>,

    /// Selected option values for this variant
    #[serde(default)]
    pub options: Vec<MedusaProductOptionValue>,

    /// Custom metadata
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<HashMap<String, serde_json::Value>>,

    /// Creation timestamp
    pub created_at: DateTime<Utc>,

    /// Update timestamp
    pub updated_at: DateTime<Utc>,
}

/// Variant Price for a specific region/currency
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct MedusaProductVariantPrice {
    /// Price ID
    pub id: String,

    /// Currency code (ISO 3-letter code)
    pub currency_code: String,

    /// Price amount (in smallest currency unit, e.g., cents)
    pub amount: Decimal,

    /// Minimum quantity for this price
    #[serde(skip_serializing_if = "Option::is_none")]
    pub min_quantity: Option<i32>,

    /// Maximum quantity for this price
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_quantity: Option<i32>,

    /// Price list this price belongs to
    #[serde(skip_serializing_if = "Option::is_none")]
    pub price_list_id: Option<String>,

    /// Region ID this price applies to
    #[serde(skip_serializing_if = "Option::is_none")]
    pub region_id: Option<String>,
}

/// Product Category
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct MedusaProductCategory {
    /// Category ID
    pub id: String,

    /// Category name
    pub name: String,

    /// Category description
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    /// URL-friendly handle
    pub handle: String,

    /// Whether category is active
    #[serde(default)]
    pub is_active: bool,

    /// Whether category is internal only
    #[serde(default)]
    pub is_internal: bool,

    /// Parent category ID (for nested categories)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parent_category_id: Option<String>,

    /// Rank/position in category list
    #[serde(default)]
    pub rank: i32,

    /// Custom metadata
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<HashMap<String, serde_json::Value>>,

    /// Creation timestamp
    pub created_at: DateTime<Utc>,

    /// Update timestamp
    pub updated_at: DateTime<Utc>,
}

/// Product Collection
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct MedusaProductCollection {
    /// Collection ID
    pub id: String,

    /// Collection title
    pub title: String,

    /// URL-friendly handle
    pub handle: String,

    /// Custom metadata
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<HashMap<String, serde_json::Value>>,

    /// Creation timestamp
    pub created_at: DateTime<Utc>,

    /// Update timestamp
    pub updated_at: DateTime<Utc>,
}

/// Product Type
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct MedusaProductType {
    /// Type ID
    pub id: String,

    /// Type value (e.g., "shirt", "mug")
    pub value: String,

    /// Custom metadata
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<HashMap<String, serde_json::Value>>,

    /// Creation timestamp
    pub created_at: DateTime<Utc>,

    /// Update timestamp
    pub updated_at: DateTime<Utc>,
}

/// Product Tag
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct MedusaProductTag {
    /// Tag ID
    pub id: String,

    /// Tag value (e.g., "summer", "sale")
    pub value: String,

    /// Custom metadata
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<HashMap<String, serde_json::Value>>,

    /// Creation timestamp
    pub created_at: DateTime<Utc>,

    /// Update timestamp
    pub updated_at: DateTime<Utc>,
}

/// Query parameters for listing products
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct MedusaProductListParams {
    /// Page number (calculated from offset/limit)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub page: Option<u32>,

    /// Number of items to skip
    #[serde(skip_serializing_if = "Option::is_none")]
    pub offset: Option<u32>,

    /// Maximum number of items to return (default: 50)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub limit: Option<u32>,

    /// Fields to include in response (comma-separated)
    /// Example: "id,title,*variants"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fields: Option<String>,

    /// Search query
    #[serde(skip_serializing_if = "Option::is_none")]
    pub q: Option<String>,

    /// Filter by product IDs
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<Vec<String>>,

    /// Filter by status
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<Vec<String>>,

    /// Filter by collection IDs
    #[serde(skip_serializing_if = "Option::is_none")]
    pub collection_id: Option<Vec<String>>,

    /// Filter by category IDs
    #[serde(skip_serializing_if = "Option::is_none")]
    pub category_id: Option<Vec<String>>,

    /// Filter by tag IDs
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tag_id: Option<Vec<String>>,

    /// Filter by type IDs
    #[serde(skip_serializing_if = "Option::is_none")]
    pub type_id: Option<Vec<String>>,

    /// Filter by sales channel IDs
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sales_channel_id: Option<Vec<String>>,

    /// Filter by currency code
    #[serde(skip_serializing_if = "Option::is_none")]
    pub currency_code: Option<String>,

    /// Filter by region ID
    #[serde(skip_serializing_if = "Option::is_none")]
    pub region_id: Option<String>,

    /// Sort order (e.g., "created_at", "-created_at")
    #[serde(skip_serializing_if = "Option::is_none")]
    pub order: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_medusa_product_serialization() {
        let product = MedusaProductResponse {
            id: "prod_123".to_string(),
            title: "Test Product".to_string(),
            handle: "test-product".to_string(),
            description: Some("A test product".to_string()),
            subtitle: None,
            status: "published".to_string(),
            thumbnail: Some("https://example.com/thumb.jpg".to_string()),
            images: vec![],
            options: vec![],
            variants: vec![],
            categories: vec![],
            collection: None,
            type_: None,
            tags: vec![],
            is_giftcard: false,
            weight: Some(500),
            length: None,
            height: None,
            width: None,
            hs_code: None,
            origin_country: Some("US".to_string()),
            material: None,
            mid_code: None,
            metadata: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
            deleted_at: None,
        };

        let json = serde_json::to_string(&product).unwrap();
        assert!(json.contains("Test Product"));
    }
}
