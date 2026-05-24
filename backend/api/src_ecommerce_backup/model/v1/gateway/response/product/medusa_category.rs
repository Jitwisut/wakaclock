//! Medusa Store API - Product Categories Response Models
//!
//! This module defines response structures for Medusa's Store API product categories endpoint.
//! Based on Medusa v2 Store API specification for product categories.
//!
//! ## Features
//! - Product category list with pagination
//! - Hierarchical category support (parent-child relationships)
//! - Active/internal category flags
//! - Category metadata and custom fields
//! - Comprehensive filtering and sorting support

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use utoipa::ToSchema;

/// Medusa Store API - Product Category List Response
///
/// Returned when listing product categories from Medusa store
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct MedusaCategoryListResponse {
    /// List of product categories
    pub product_categories: Vec<MedusaCategoryResponse>,

    /// Total number of categories matching the query
    pub count: u64,

    /// Number of items skipped
    pub offset: u32,

    /// Maximum number of items returned
    pub limit: u32,
}

/// Medusa Store API - Single Product Category Response
///
/// Complete product category data from Medusa store including parent-child relationships
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct MedusaCategoryResponse {
    /// Category unique identifier
    pub id: String,

    /// Category name/title
    pub name: String,

    /// Category description (supports markdown)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    /// URL-friendly handle (slug)
    pub handle: String,

    /// Whether category is active/visible in storefront
    #[serde(default)]
    pub is_active: bool,

    /// Whether category is internal only (not visible in storefront)
    #[serde(default)]
    pub is_internal: bool,

    /// Parent category ID (for nested/hierarchical categories)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parent_category_id: Option<String>,

    /// Parent category (full object, if loaded)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parent_category: Option<Box<MedusaCategoryResponse>>,

    /// Child categories (subcategories)
    #[serde(default)]
    pub category_children: Vec<MedusaCategoryResponse>,

    /// Rank/position in category list (for ordering)
    #[serde(default)]
    pub rank: i32,

    /// Custom metadata (key-value pairs)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<HashMap<String, serde_json::Value>>,

    /// Creation timestamp
    pub created_at: DateTime<Utc>,

    /// Last update timestamp
    pub updated_at: DateTime<Utc>,

    /// Soft deletion timestamp
    #[serde(skip_serializing_if = "Option::is_none")]
    pub deleted_at: Option<DateTime<Utc>>,
}

/// Query parameters for listing product categories
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct MedusaCategoryListParams {
    /// Page number (calculated from offset/limit)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub page: Option<u32>,

    /// Number of items to skip
    #[serde(skip_serializing_if = "Option::is_none")]
    pub offset: Option<u32>,

    /// Maximum number of items to return (default: 50, max: 100)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub limit: Option<u32>,

    /// Fields to include in response (comma-separated)
    /// Example: "id,name,*parent_category"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fields: Option<String>,

    /// Search query (searches name and description)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub q: Option<String>,

    /// Filter by category IDs
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<Vec<String>>,

    /// Filter by category description
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    /// Filter by category handle
    #[serde(skip_serializing_if = "Option::is_none")]
    pub handle: Option<String>,

    /// Filter by parent category ID
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parent_category_id: Option<String>,

    /// Filter by active status
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_active: Option<bool>,

    /// Filter by internal status
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_internal: Option<bool>,

    /// Include descendants (child categories)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub include_descendants_tree: Option<bool>,

    /// Sort order (e.g., "name", "-name", "rank", "-created_at")
    /// Multiple fields can be comma-separated
    #[serde(skip_serializing_if = "Option::is_none")]
    pub order: Option<String>,

    /// Created at date range filter (start)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub created_at: Option<MedusaDateFilter>,

    /// Updated at date range filter (start)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<MedusaDateFilter>,
}

/// Date filter for range queries
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct MedusaDateFilter {
    /// Greater than
    #[serde(skip_serializing_if = "Option::is_none")]
    pub gt: Option<DateTime<Utc>>,

    /// Greater than or equal
    #[serde(skip_serializing_if = "Option::is_none")]
    pub gte: Option<DateTime<Utc>>,

    /// Less than
    #[serde(skip_serializing_if = "Option::is_none")]
    pub lt: Option<DateTime<Utc>>,

    /// Less than or equal
    #[serde(skip_serializing_if = "Option::is_none")]
    pub lte: Option<DateTime<Utc>>,
}

/// Request body for creating a new product category (Admin API)
/// Note: This is typically used by Admin API, not Store API
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct MedusaCreateCategoryRequest {
    /// Category name (required)
    pub name: String,

    /// Category description
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    /// URL-friendly handle (auto-generated if not provided)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub handle: Option<String>,

    /// Whether category is active
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_active: Option<bool>,

    /// Whether category is internal only
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_internal: Option<bool>,

    /// Parent category ID (for creating subcategories)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parent_category_id: Option<String>,

    /// Rank/position in category list
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rank: Option<i32>,

    /// Custom metadata
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

/// Request body for updating a product category (Admin API)
/// Note: This is typically used by Admin API, not Store API
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct MedusaUpdateCategoryRequest {
    /// Category name
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,

    /// Category description
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    /// URL-friendly handle
    #[serde(skip_serializing_if = "Option::is_none")]
    pub handle: Option<String>,

    /// Whether category is active
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_active: Option<bool>,

    /// Whether category is internal only
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_internal: Option<bool>,

    /// Parent category ID
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parent_category_id: Option<String>,

    /// Rank/position in category list
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rank: Option<i32>,

    /// Custom metadata
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

/// Category tree node for hierarchical display
///
/// Helper structure for building category trees in storefront
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct MedusaCategoryTreeNode {
    /// Category data
    #[serde(flatten)]
    pub category: MedusaCategoryResponse,

    /// Child categories (recursive)
    #[serde(default)]
    pub children: Vec<MedusaCategoryTreeNode>,

    /// Depth level in tree (0 = root)
    pub level: u32,

    /// Path from root to this category (category IDs)
    pub path: Vec<String>,
}

impl MedusaCategoryTreeNode {
    /// Create a new category tree node
    pub fn new(category: MedusaCategoryResponse, level: u32, path: Vec<String>) -> Self {
        Self {
            category,
            children: Vec::new(),
            level,
            path,
        }
    }

    /// Add a child category to this node
    pub fn add_child(&mut self, child: MedusaCategoryTreeNode) {
        self.children.push(child);
    }

    /// Get all descendant categories (flattened)
    pub fn get_all_descendants(&self) -> Vec<&MedusaCategoryResponse> {
        let mut descendants = Vec::new();
        for child in &self.children {
            descendants.push(&child.category);
            descendants.extend(child.get_all_descendants());
        }
        descendants
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_category_serialization() {
        let category = MedusaCategoryResponse {
            id: "pcat_123".to_string(),
            name: "Electronics".to_string(),
            description: Some("Electronic devices and accessories".to_string()),
            handle: "electronics".to_string(),
            is_active: true,
            is_internal: false,
            parent_category_id: None,
            parent_category: None,
            category_children: vec![],
            rank: 1,
            metadata: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
            deleted_at: None,
        };

        let json = serde_json::to_string(&category).unwrap();
        assert!(json.contains("Electronics"));
        assert!(json.contains("electronics"));
    }

    #[test]
    fn test_category_tree_node() {
        let category = MedusaCategoryResponse {
            id: "pcat_parent".to_string(),
            name: "Parent Category".to_string(),
            description: None,
            handle: "parent".to_string(),
            is_active: true,
            is_internal: false,
            parent_category_id: None,
            parent_category: None,
            category_children: vec![],
            rank: 1,
            metadata: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
            deleted_at: None,
        };

        let mut tree_node =
            MedusaCategoryTreeNode::new(category.clone(), 0, vec!["pcat_parent".to_string()]);

        let child_category = MedusaCategoryResponse {
            id: "pcat_child".to_string(),
            name: "Child Category".to_string(),
            description: None,
            handle: "child".to_string(),
            is_active: true,
            is_internal: false,
            parent_category_id: Some("pcat_parent".to_string()),
            parent_category: None,
            category_children: vec![],
            rank: 1,
            metadata: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
            deleted_at: None,
        };

        let child_node = MedusaCategoryTreeNode::new(
            child_category,
            1,
            vec!["pcat_parent".to_string(), "pcat_child".to_string()],
        );

        tree_node.add_child(child_node);

        assert_eq!(tree_node.children.len(), 1);
        assert_eq!(tree_node.level, 0);
        assert_eq!(tree_node.children[0].level, 1);
    }
}
