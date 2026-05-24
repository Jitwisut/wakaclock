/// Selective detail logic for determining when full product details are needed
/// Based on specifications in prompt/002.md section 10
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

/// Field identifier for product data
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum FieldId {
    // Basic product fields
    Id,
    Title,
    Description,
    Price,
    Currency,
    Stock,
    Status,

    // Product metadata
    Brand,
    Category,
    Tags,
    Images,
    Weight,
    Dimensions,

    // SKU information
    Skus,
    Variants,
    Options,

    // Platform-specific
    PlatformId,
    PlatformUrl,
    PlatformData,

    // Timestamps
    CreatedAt,
    UpdatedAt,
    PublishedAt,

    // Custom fields
    Custom(String),
}

impl FieldId {
    pub fn as_str(&self) -> &str {
        match self {
            FieldId::Id => "id",
            FieldId::Title => "title",
            FieldId::Description => "description",
            FieldId::Price => "price",
            FieldId::Currency => "currency",
            FieldId::Stock => "stock",
            FieldId::Status => "status",
            FieldId::Brand => "brand",
            FieldId::Category => "category",
            FieldId::Tags => "tags",
            FieldId::Images => "images",
            FieldId::Weight => "weight",
            FieldId::Dimensions => "dimensions",
            FieldId::Skus => "skus",
            FieldId::Variants => "variants",
            FieldId::Options => "options",
            FieldId::PlatformId => "platform_id",
            FieldId::PlatformUrl => "platform_url",
            FieldId::PlatformData => "platform_data",
            FieldId::CreatedAt => "created_at",
            FieldId::UpdatedAt => "updated_at",
            FieldId::PublishedAt => "published_at",
            FieldId::Custom(ref name) => name,
        }
    }
}

/// Platform capability information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlatformCapability {
    /// Whether platform supports field selection in list API
    pub supports_select_fields: bool,
    /// Fields available in list API response
    pub list_available_fields: HashSet<FieldId>,
    /// Fields that require detail API call
    pub detail_only_fields: HashSet<FieldId>,
    /// Maximum number of fields that can be requested
    pub max_selectable_fields: Option<usize>,
}

/// Tenant requirements for product sync
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TenantRequirement {
    /// Fields required for snapshot contract
    pub required_fields: HashSet<FieldId>,
    /// Optional fields that should be included if available
    pub optional_fields: HashSet<FieldId>,
    /// Custom mapping for platform-specific fields
    pub field_mapping: HashMap<String, FieldId>,
}

/// Decision result for sync strategy
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SyncDecision {
    /// Use list-only path with specified fields
    ListOnly { requested_fields: Vec<FieldId> },
    /// Use list + selective detail path
    ListWithDetail {
        list_fields: Vec<FieldId>,
        detail_required_for: Vec<String>, // Product IDs that need detail
    },
    /// Always use detail API
    DetailOnly,
}

/// Item-level decision for whether detail is needed
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ItemDetailDecision {
    pub product_id: String,
    pub needs_detail: bool,
    pub missing_fields: Vec<FieldId>,
    pub reason: String,
}

/// Selective detail logic manager
pub struct SelectiveDetailLogic {
    platform_capability: PlatformCapability,
    tenant_requirement: TenantRequirement,
}

impl SelectiveDetailLogic {
    pub fn new(
        platform_capability: PlatformCapability,
        tenant_requirement: TenantRequirement,
    ) -> Self {
        Self {
            platform_capability,
            tenant_requirement,
        }
    }

    /// Determine sync strategy based on platform capabilities and tenant requirements
    pub fn determine_sync_strategy(&self) -> SyncDecision {
        let required = &self.tenant_requirement.required_fields;
        let available = &self.platform_capability.list_available_fields;

        // Check if all required fields are available in list API
        if required.is_subset(available) {
            // All required fields available in list API
            let mut requested_fields: Vec<FieldId> = required.iter().cloned().collect();

            // Add optional fields if available and within limits
            for optional_field in &self.tenant_requirement.optional_fields {
                if available.contains(optional_field) {
                    if let Some(max_fields) = self.platform_capability.max_selectable_fields {
                        if requested_fields.len() >= max_fields {
                            break;
                        }
                    }
                    requested_fields.push(optional_field.clone());
                }
            }

            if self.platform_capability.supports_select_fields {
                SyncDecision::ListOnly { requested_fields }
            } else {
                // Platform doesn't support field selection, but has all fields in list
                SyncDecision::ListOnly {
                    requested_fields: available.iter().cloned().collect(),
                }
            }
        } else {
            // Some required fields not available in list API
            let list_fields: Vec<FieldId> = available
                .intersection(required)
                .chain(available.intersection(&self.tenant_requirement.optional_fields))
                .cloned()
                .collect();

            SyncDecision::ListWithDetail {
                list_fields,
                detail_required_for: Vec::new(), // Will be populated per-item
            }
        }
    }

    /// Evaluate per-item whether detail API call is needed
    pub fn evaluate_item_detail_need(
        &self,
        product_id: &str,
        list_data: &HashMap<String, serde_json::Value>,
    ) -> ItemDetailDecision {
        let mut missing_fields = Vec::new();
        let mut needs_detail = false;

        // Check each required field
        for field in &self.tenant_requirement.required_fields {
            let field_key = field.as_str();

            if let Some(value) = list_data.get(field_key) {
                // Field exists, check if it's null or empty
                if value.is_null() || (value.is_string() && value.as_str().unwrap_or("").is_empty())
                {
                    missing_fields.push(field.clone());
                    needs_detail = true;
                }
            } else {
                // Field doesn't exist
                missing_fields.push(field.clone());
                needs_detail = true;
            }
        }

        let reason = if needs_detail {
            format!(
                "Missing or null fields: {}",
                missing_fields
                    .iter()
                    .map(|f| f.as_str())
                    .collect::<Vec<_>>()
                    .join(", ")
            )
        } else {
            "All required fields available".to_string()
        };

        ItemDetailDecision {
            product_id: product_id.to_string(),
            needs_detail,
            missing_fields,
            reason,
        }
    }

    /// Get list of field names for API request
    pub fn get_field_names(&self, fields: &[FieldId]) -> Vec<String> {
        fields.iter().map(|f| f.as_str().to_string()).collect()
    }

    /// Update capability based on platform response
    pub fn update_capability_from_response(&mut self, response_fields: HashSet<String>) {
        // Convert string field names to FieldId
        let mut available_fields = HashSet::new();

        for field_name in response_fields {
            if let Some(field_id) = self.string_to_field_id(&field_name) {
                available_fields.insert(field_id);
            } else {
                available_fields.insert(FieldId::Custom(field_name));
            }
        }

        self.platform_capability.list_available_fields = available_fields;
    }

    /// Convert string field name to FieldId
    fn string_to_field_id(&self, field_name: &str) -> Option<FieldId> {
        match field_name {
            "id" => Some(FieldId::Id),
            "title" => Some(FieldId::Title),
            "description" => Some(FieldId::Description),
            "price" => Some(FieldId::Price),
            "currency" => Some(FieldId::Currency),
            "stock" => Some(FieldId::Stock),
            "status" => Some(FieldId::Status),
            "brand" => Some(FieldId::Brand),
            "category" => Some(FieldId::Category),
            "tags" => Some(FieldId::Tags),
            "images" => Some(FieldId::Images),
            "weight" => Some(FieldId::Weight),
            "dimensions" => Some(FieldId::Dimensions),
            "skus" => Some(FieldId::Skus),
            "variants" => Some(FieldId::Variants),
            "options" => Some(FieldId::Options),
            "platform_id" => Some(FieldId::PlatformId),
            "platform_url" => Some(FieldId::PlatformUrl),
            "platform_data" => Some(FieldId::PlatformData),
            "created_at" => Some(FieldId::CreatedAt),
            "updated_at" => Some(FieldId::UpdatedAt),
            "published_at" => Some(FieldId::PublishedAt),
            _ => None,
        }
    }
}

/// Platform-specific capability configurations
pub struct PlatformCapabilities;

impl PlatformCapabilities {
    /// TikTok Shop capability
    pub fn tiktok_shop() -> PlatformCapability {
        let mut list_fields = HashSet::new();
        list_fields.insert(FieldId::Id);
        list_fields.insert(FieldId::Title);
        list_fields.insert(FieldId::Price);
        list_fields.insert(FieldId::Status);
        list_fields.insert(FieldId::UpdatedAt);
        list_fields.insert(FieldId::Images);

        let mut detail_only = HashSet::new();
        detail_only.insert(FieldId::Description);
        detail_only.insert(FieldId::Skus);
        detail_only.insert(FieldId::PlatformData);

        PlatformCapability {
            supports_select_fields: false,
            list_available_fields: list_fields,
            detail_only_fields: detail_only,
            max_selectable_fields: None,
        }
    }

    /// Shopify capability
    pub fn shopify() -> PlatformCapability {
        let mut list_fields = HashSet::new();
        list_fields.insert(FieldId::Id);
        list_fields.insert(FieldId::Title);
        list_fields.insert(FieldId::Description);
        list_fields.insert(FieldId::Price);
        list_fields.insert(FieldId::Status);
        list_fields.insert(FieldId::CreatedAt);
        list_fields.insert(FieldId::UpdatedAt);

        PlatformCapability {
            supports_select_fields: true,
            list_available_fields: list_fields,
            detail_only_fields: HashSet::new(), // Shopify provides full data in list
            max_selectable_fields: Some(20),
        }
    }

    /// Get capability by platform name
    pub fn get_capability(platform: &str) -> Option<PlatformCapability> {
        match platform.to_lowercase().as_str() {
            "tiktok" | "tiktok_shop" => Some(Self::tiktok_shop()),
            "shopify" => Some(Self::shopify()),
            _ => None,
        }
    }
}

/// Standard tenant requirements
pub struct StandardTenantRequirements;

impl StandardTenantRequirements {
    /// Basic e-commerce requirement
    pub fn basic_ecommerce() -> TenantRequirement {
        let mut required = HashSet::new();
        required.insert(FieldId::Id);
        required.insert(FieldId::Title);
        required.insert(FieldId::Price);
        required.insert(FieldId::Currency);
        required.insert(FieldId::Status);

        let mut optional = HashSet::new();
        optional.insert(FieldId::Description);
        optional.insert(FieldId::Images);
        optional.insert(FieldId::Stock);
        optional.insert(FieldId::Brand);
        optional.insert(FieldId::Category);

        TenantRequirement {
            required_fields: required,
            optional_fields: optional,
            field_mapping: HashMap::new(),
        }
    }

    /// Full catalog requirement
    pub fn full_catalog() -> TenantRequirement {
        let mut required = HashSet::new();
        required.insert(FieldId::Id);
        required.insert(FieldId::Title);
        required.insert(FieldId::Description);
        required.insert(FieldId::Price);
        required.insert(FieldId::Currency);
        required.insert(FieldId::Stock);
        required.insert(FieldId::Status);
        required.insert(FieldId::Images);
        required.insert(FieldId::Skus);

        let mut optional = HashSet::new();
        optional.insert(FieldId::Brand);
        optional.insert(FieldId::Category);
        optional.insert(FieldId::Tags);
        optional.insert(FieldId::Weight);
        optional.insert(FieldId::Dimensions);

        TenantRequirement {
            required_fields: required,
            optional_fields: optional,
            field_mapping: HashMap::new(),
        }
    }
}
