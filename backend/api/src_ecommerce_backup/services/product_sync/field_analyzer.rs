use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

/// Required fields for a complete product snapshot
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RequiredFields {
    /// Core fields that must be present
    pub core_required: HashSet<String>,
    /// Important fields that affect quality score
    pub important: HashSet<String>,
    /// Optional fields that enhance the product data
    pub optional: HashSet<String>,
    /// Platform-specific required fields
    pub platform_specific: HashMap<String, HashSet<String>>,
}

impl RequiredFields {
    /// Get default required fields configuration
    pub fn default_config() -> Self {
        let mut core_required = HashSet::new();
        core_required.insert("title".to_string());
        core_required.insert("price".to_string());
        core_required.insert("currency".to_string());
        core_required.insert("status".to_string());

        let mut important = HashSet::new();
        important.insert("description".to_string());
        important.insert("brand".to_string());
        important.insert("category".to_string());
        important.insert("main_image_url".to_string());
        important.insert("skus".to_string());
        important.insert("total_quantity".to_string());

        let mut optional = HashSet::new();
        optional.insert("seo_title".to_string());
        optional.insert("seo_description".to_string());
        optional.insert("video_urls".to_string());
        optional.insert("marketing_tags".to_string());
        optional.insert("sales_regions".to_string());

        let mut platform_specific = HashMap::new();

        // TikTok specific requirements
        let mut tiktok_fields = HashSet::new();
        tiktok_fields.insert("sales_regions".to_string());
        tiktok_fields.insert("category_chains".to_string());
        platform_specific.insert("tiktok".to_string(), tiktok_fields);

        // Shopify specific requirements
        let mut shopify_fields = HashSet::new();
        shopify_fields.insert("vendor".to_string());
        shopify_fields.insert("product_type".to_string());
        platform_specific.insert("shopify".to_string(), shopify_fields);

        // Amazon specific requirements
        let mut amazon_fields = HashSet::new();
        amazon_fields.insert("asin".to_string());
        amazon_fields.insert("product_group".to_string());
        platform_specific.insert("amazon".to_string(), amazon_fields);

        Self {
            core_required,
            important,
            optional,
            platform_specific,
        }
    }

    /// Get required fields for a specific platform
    pub fn get_platform_requirements(&self, platform: &str) -> HashSet<String> {
        let mut all_required = self.core_required.clone();

        if let Some(platform_fields) = self.platform_specific.get(&platform.to_lowercase()) {
            all_required.extend(platform_fields.clone());
        }

        all_required
    }

    /// Get all important fields including platform-specific ones
    pub fn get_all_important(&self, platform: &str) -> HashSet<String> {
        let mut all_important = self.important.clone();
        all_important.extend(self.get_platform_requirements(platform));
        all_important
    }
}

/// Field completeness analysis result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FieldAnalysis {
    /// Whether the product has all required fields from list API
    pub needs_detail_fetch: bool,
    /// Quality score 0.0-1.0 based on field completeness
    pub quality_score: f32,
    /// Missing required fields
    pub missing_required: Vec<String>,
    /// Missing important fields
    pub missing_important: Vec<String>,
    /// Present fields count
    pub present_fields: usize,
    /// Total possible fields count
    pub total_fields: usize,
    /// Platform-specific analysis
    pub platform_completeness: f32,
}

/// Field analyzer for determining if detail fetch is needed
#[derive(Clone)]
pub struct FieldAnalyzer {
    required_fields: RequiredFields,
}

impl FieldAnalyzer {
    pub fn new() -> Self {
        Self {
            required_fields: RequiredFields::default_config(),
        }
    }

    pub fn with_custom_config(required_fields: RequiredFields) -> Self {
        Self { required_fields }
    }

    /// Analyze a product from list API to determine if detail fetch is needed
    pub fn analyze_list_product(
        &self,
        platform: &str,
        product_data: &serde_json::Value,
    ) -> FieldAnalysis {
        let available_fields = self.extract_available_fields(product_data);
        let required = self.required_fields.get_platform_requirements(platform);
        let important = self.required_fields.get_all_important(platform);
        let all_possible = self.get_all_possible_fields(platform);

        // Check missing required fields
        let missing_required: Vec<String> =
            required.difference(&available_fields).cloned().collect();

        // Check missing important fields
        let missing_important: Vec<String> =
            important.difference(&available_fields).cloned().collect();

        // Determine if detail fetch is needed
        let needs_detail_fetch = !missing_required.is_empty() || missing_important.len() > 2; // Allow up to 2 missing important fields

        // Calculate quality score
        let quality_score =
            self.calculate_quality_score(&available_fields, &required, &important, &all_possible);

        // Platform-specific completeness
        let platform_specific_fields = self
            .required_fields
            .platform_specific
            .get(&platform.to_lowercase())
            .cloned()
            .unwrap_or_default();

        let platform_completeness = if platform_specific_fields.is_empty() {
            1.0
        } else {
            let present_platform_fields = platform_specific_fields
                .intersection(&available_fields)
                .count();
            present_platform_fields as f32 / platform_specific_fields.len() as f32
        };

        FieldAnalysis {
            needs_detail_fetch,
            quality_score,
            missing_required,
            missing_important,
            present_fields: available_fields.len(),
            total_fields: all_possible.len(),
            platform_completeness,
        }
    }

    /// Extract field names that have non-null values from product data
    fn extract_available_fields(&self, product_data: &serde_json::Value) -> HashSet<String> {
        let mut fields = HashSet::new();

        if let Some(obj) = product_data.as_object() {
            for (key, value) in obj {
                if !value.is_null() && self.is_meaningful_value(value) {
                    fields.insert(key.clone());

                    // Handle nested objects (like price, skus)
                    if let Some(nested_obj) = value.as_object() {
                        for nested_key in nested_obj.keys() {
                            fields.insert(format!("{}.{}", key, nested_key));
                        }
                    }

                    // Handle arrays
                    if let Some(array) = value.as_array() {
                        if !array.is_empty() {
                            fields.insert(format!("{}_array", key));
                        }
                    }
                }
            }
        }

        // Map platform-specific field names to normalized names
        self.normalize_field_names(fields)
    }

    /// Check if a value is meaningful (not null, empty string, empty array, etc.)
    fn is_meaningful_value(&self, value: &serde_json::Value) -> bool {
        match value {
            serde_json::Value::Null => false,
            serde_json::Value::String(s) => !s.trim().is_empty(),
            serde_json::Value::Array(arr) => !arr.is_empty(),
            serde_json::Value::Object(obj) => !obj.is_empty(),
            serde_json::Value::Number(_) => true,
            serde_json::Value::Bool(_) => true,
        }
    }

    /// Normalize platform-specific field names to standard names
    fn normalize_field_names(&self, fields: HashSet<String>) -> HashSet<String> {
        let mut normalized = HashSet::new();

        for field in fields {
            if field == "category_chains" || field == "category_chains_array" {
                normalized.insert("category_chains".to_string());
                normalized.insert("category".to_string());
                continue;
            }

            let normalized_name = match field.as_str() {
                // TikTok mappings
                "product_name" | "name" => "title",
                "tax_exclusive_price" => "price",
                "main_images" => "main_image_url",
                "images" => "image_urls",
                "sales_regions_array" => "sales_regions",

                // Shopify mappings
                "vendor" => "brand",
                "product_type" => "category",
                "variants" => "skus",

                // Amazon mappings
                "title" => "title",
                "price_and_currency" => "price",

                // Keep original if no mapping
                _ => &field,
            };

            normalized.insert(normalized_name.to_string());
        }

        normalized
    }

    /// Get all possible fields for quality score calculation
    fn get_all_possible_fields(&self, platform: &str) -> HashSet<String> {
        let mut all_fields = HashSet::new();
        all_fields.extend(self.required_fields.core_required.clone());
        all_fields.extend(self.required_fields.important.clone());
        all_fields.extend(self.required_fields.optional.clone());

        if let Some(platform_fields) = self
            .required_fields
            .platform_specific
            .get(&platform.to_lowercase())
        {
            all_fields.extend(platform_fields.clone());
        }

        all_fields
    }

    /// Calculate quality score based on field completeness
    fn calculate_quality_score(
        &self,
        available: &HashSet<String>,
        required: &HashSet<String>,
        important: &HashSet<String>,
        all_possible: &HashSet<String>,
    ) -> f32 {
        let required_score = if required.is_empty() {
            1.0
        } else {
            let present_required = required.intersection(available).count();
            present_required as f32 / required.len() as f32
        };

        let important_score = if important.is_empty() {
            1.0
        } else {
            let present_important = important.intersection(available).count();
            present_important as f32 / important.len() as f32
        };

        let overall_completeness = available.len() as f32 / all_possible.len() as f32;

        // Weighted score: required fields are most important
        let weighted_score =
            (required_score * 0.6) + (important_score * 0.3) + (overall_completeness * 0.1);

        // Ensure score is between 0.0 and 1.0
        weighted_score.clamp(0.0, 1.0)
    }

    /// Determine priority for detail fetch based on missing fields
    pub fn calculate_detail_priority(&self, analysis: &FieldAnalysis) -> u8 {
        if !analysis.needs_detail_fetch {
            return 255; // Lowest priority - no detail needed
        }

        let mut priority: u8 = 128; // Medium priority baseline

        // Higher priority (lower number) for missing required fields
        if !analysis.missing_required.is_empty() {
            priority = priority.saturating_sub(50);
        }

        // Adjust based on missing important fields
        let missing_important_count = analysis.missing_important.len();
        if missing_important_count > 3 {
            priority = priority.saturating_sub(30);
        } else if missing_important_count > 1 {
            priority = priority.saturating_sub(15);
        }

        // Adjust based on quality score
        if analysis.quality_score < 0.3 {
            priority = priority.saturating_sub(20);
        } else if analysis.quality_score < 0.6 {
            priority = priority.saturating_sub(10);
        }

        // Platform completeness adjustment
        if analysis.platform_completeness < 0.5 {
            priority = priority.saturating_sub(15);
        }

        priority
    }
}

impl Default for FieldAnalyzer {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_complete_tiktok_product() {
        let analyzer = FieldAnalyzer::new();

        let product = json!({
            "product_name": "Test Product",
            "tax_exclusive_price": "100.00",
            "currency": "USD",
            "status": "ACTIVATE",
            "description": "A great product",
            "brand": "Test Brand",
            "main_images": ["https://example.com/img1.jpg"],
            "sales_regions": ["US", "CA"],
            "category_chains": [{"name": "Electronics"}]
        });

        let analysis = analyzer.analyze_list_product("tiktok", &product);

        assert!(!analysis.needs_detail_fetch);
        assert!(analysis.quality_score > 0.8);
        assert!(analysis.missing_required.is_empty());
    }

    #[test]
    fn test_incomplete_product_needs_detail() {
        let analyzer = FieldAnalyzer::new();

        let product = json!({
            "product_name": "Test Product",
            "tax_exclusive_price": "100.00"
            // Missing currency, status, description, etc.
        });

        let analysis = analyzer.analyze_list_product("tiktok", &product);

        assert!(analysis.needs_detail_fetch);
        assert!(analysis.quality_score < 0.5);
        assert!(!analysis.missing_required.is_empty());
    }

    #[test]
    fn test_priority_calculation() {
        let analyzer = FieldAnalyzer::new();

        let high_priority = FieldAnalysis {
            needs_detail_fetch: true,
            quality_score: 0.2,
            missing_required: vec!["currency".to_string(), "status".to_string()],
            missing_important: vec!["description".to_string(), "brand".to_string()],
            present_fields: 2,
            total_fields: 10,
            platform_completeness: 0.3,
        };

        let priority = analyzer.calculate_detail_priority(&high_priority);
        assert!(priority < 50); // High priority = low number
    }
}
