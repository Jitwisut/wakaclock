/// ไฟล์ woocommerce.rs - WooCommerce E-commerce Platform Gateway
/// เชื่อมต่อกับ WooCommerce REST API สำหรับการจัดการสินค้าใน WordPress
/// ใช้ Basic Authentication พร้อม consumer key และ consumer secret
/// รองรับการจัดการสินค้า, categories, orders และ customer data
use crate::config::PlatformCredentials;
use crate::model::error::{AppError, AppResult};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use reqwest::{Client, StatusCode};
use serde_json::json;
use url::Url;

pub struct WooCommerceGateway {
    credentials: PlatformCredentials,
    client: Client,
}

impl WooCommerceGateway {
    pub fn new(credentials: PlatformCredentials) -> Self {
        Self {
            credentials,
            client: Client::new(),
        }
    }

    fn get_auth_header(&self) -> String {
        let auth = format!(
            "{}:{}",
            self.credentials.app_key, self.credentials.app_secret
        );
        format!("Basic {}", BASE64.encode(auth.as_bytes()))
    }

    fn normalized_store_url(&self) -> AppResult<String> {
        let raw = self.credentials.api_base_url.trim();
        if raw.is_empty() {
            return Err(AppError::BadRequest(
                "WooCommerce store URL is not configured".to_string(),
            ));
        }

        let with_scheme = if raw.starts_with("http://") || raw.starts_with("https://") {
            raw.to_string()
        } else {
            format!("https://{}", raw.trim_start_matches('/'))
        };

        let mut url = Url::parse(&with_scheme).map_err(|e| {
            AppError::BadRequest(format!("Invalid WooCommerce store URL '{}': {}", raw, e))
        })?;

        url.set_query(None);
        url.set_fragment(None);

        let mut normalized = url.to_string();
        while normalized.ends_with('/') {
            normalized.pop();
        }

        Ok(normalized)
    }

    fn api_root(&self) -> AppResult<String> {
        let base = self.normalized_store_url()?;
        let lower = base.to_lowercase();

        if lower.ends_with("/wp-json/wc/v3") {
            return Ok(base);
        }

        if lower.contains("/wp-json/wc/v3") {
            return Ok(base.trim_end_matches('/').to_string());
        }

        if lower.contains("/wp-json") {
            return Ok(format!("{}/wc/v3", base.trim_end_matches('/')));
        }

        Ok(format!("{}/wp-json/wc/v3", base.trim_end_matches('/')))
    }

    fn build_endpoint(&self, path: &str) -> AppResult<String> {
        let root = self.api_root()?;
        Ok(format!(
            "{}/{}",
            root.trim_end_matches('/'),
            path.trim_start_matches('/')
        ))
    }

    async fn make_request(
        &self,
        method: reqwest::Method,
        path: &str,
        query: Option<Vec<(&str, String)>>,
        body: Option<serde_json::Value>,
    ) -> AppResult<serde_json::Value> {
        let url = self.build_endpoint(path)?;

        let mut request = self
            .client
            .request(method, &url)
            .header("Authorization", self.get_auth_header())
            .header("Content-Type", "application/json");

        if let Some(params) = query {
            request = request.query(&params);
        }

        if let Some(json_body) = body {
            request = request.json(&json_body);
        }

        let response = request.send().await.map_err(|e| {
            AppError::ExternalApiError(format!("WooCommerce API request failed: {}", e))
        })?;

        let status = response.status();

        if status == StatusCode::UNAUTHORIZED {
            return Err(AppError::ExternalApiError(
                "Invalid WooCommerce API credentials".to_string(),
            ));
        }

        if status == StatusCode::NOT_FOUND {
            return Err(AppError::ExternalApiError(
                "WooCommerce API endpoint not found. Please check your store URL.".to_string(),
            ));
        }

        let response_text = response
            .text()
            .await
            .map_err(|e| AppError::ExternalApiError(format!("Failed to read response: {}", e)))?;

        if !status.is_success() {
            return Err(AppError::ExternalApiError(format!(
                "WooCommerce API returned status {}: {}",
                status, response_text
            )));
        }

        serde_json::from_str(&response_text).map_err(|e| {
            AppError::ExternalApiError(format!("Failed to parse WooCommerce response: {}", e))
        })
    }

    /// Test the WooCommerce connection by fetching system status
    pub async fn test_connection(&self) -> AppResult<serde_json::Value> {
        let store_url = self.normalized_store_url()?;

        let products = self
            .make_request(
                reqwest::Method::GET,
                "products",
                Some(vec![("per_page", "1".to_string())]),
                None,
            )
            .await?;

        Ok(json!({
            "connected": true,
            "api_version": "wc/v3",
            "store_url": store_url,
            "test_result": {
                "products_accessible": products.as_array().is_some(),
                "sample_product": products.as_array().and_then(|arr| arr.first())
            }
        }))
    }

    /// List products with pagination
    pub async fn list_products(
        &self,
        page: u32,
        per_page: u32,
        search: Option<String>,
        category: Option<u32>,
        status: Option<String>,
    ) -> AppResult<serde_json::Value> {
        let mut params = vec![
            ("page", page.to_string()),
            ("per_page", per_page.to_string()),
        ];

        if let Some(search_term) = search {
            params.push(("search", search_term));
        }

        if let Some(cat_id) = category {
            params.push(("category", cat_id.to_string()));
        }

        if let Some(status_val) = status {
            params.push(("status", status_val));
        }

        self.make_request(reqwest::Method::GET, "products", Some(params), None)
            .await
    }

    /// Get a single product by ID
    pub async fn get_product(&self, product_id: u64) -> AppResult<serde_json::Value> {
        self.make_request(
            reqwest::Method::GET,
            &format!("products/{}", product_id),
            None,
            None,
        )
        .await
    }

    /// Create a new product
    pub async fn create_product(
        &self,
        product_data: serde_json::Value,
    ) -> AppResult<serde_json::Value> {
        self.make_request(reqwest::Method::POST, "products", None, Some(product_data))
            .await
    }

    /// Update an existing product
    pub async fn update_product(
        &self,
        product_id: u64,
        product_data: serde_json::Value,
    ) -> AppResult<serde_json::Value> {
        self.make_request(
            reqwest::Method::PUT,
            &format!("products/{}", product_id),
            None,
            Some(product_data),
        )
        .await
    }

    /// Delete a product
    pub async fn delete_product(
        &self,
        product_id: u64,
        force: bool,
    ) -> AppResult<serde_json::Value> {
        let params = vec![("force", force.to_string())];
        self.make_request(
            reqwest::Method::DELETE,
            &format!("products/{}", product_id),
            Some(params),
            None,
        )
        .await
    }

    /// Batch create, update, or delete products
    pub async fn batch_products(
        &self,
        batch_data: serde_json::Value,
    ) -> AppResult<serde_json::Value> {
        self.make_request(
            reqwest::Method::POST,
            "products/batch",
            None,
            Some(batch_data),
        )
        .await
    }

    /// List all product categories
    pub async fn list_categories(
        &self,
        page: u32,
        per_page: u32,
        search: Option<String>,
        parent: Option<u32>,
    ) -> AppResult<serde_json::Value> {
        let mut params = vec![
            ("page", page.to_string()),
            ("per_page", per_page.to_string()),
        ];

        if let Some(search_term) = search {
            params.push(("search", search_term));
        }

        if let Some(parent_id) = parent {
            params.push(("parent", parent_id.to_string()));
        }

        self.make_request(
            reqwest::Method::GET,
            "products/categories",
            Some(params),
            None,
        )
        .await
    }

    /// Get a single category by ID
    pub async fn get_category(&self, category_id: u32) -> AppResult<serde_json::Value> {
        self.make_request(
            reqwest::Method::GET,
            &format!("products/categories/{}", category_id),
            None,
            None,
        )
        .await
    }

    /// Create a new category
    pub async fn create_category(
        &self,
        category_data: serde_json::Value,
    ) -> AppResult<serde_json::Value> {
        self.make_request(
            reqwest::Method::POST,
            "products/categories",
            None,
            Some(category_data),
        )
        .await
    }

    /// Update an existing category
    pub async fn update_category(
        &self,
        category_id: u32,
        category_data: serde_json::Value,
    ) -> AppResult<serde_json::Value> {
        self.make_request(
            reqwest::Method::PUT,
            &format!("products/categories/{}", category_id),
            None,
            Some(category_data),
        )
        .await
    }

    /// Delete a category
    pub async fn delete_category(
        &self,
        category_id: u32,
        force: bool,
    ) -> AppResult<serde_json::Value> {
        let params = vec![("force", force.to_string())];
        self.make_request(
            reqwest::Method::DELETE,
            &format!("products/categories/{}", category_id),
            Some(params),
            None,
        )
        .await
    }

    /// Get product variations (for variable products)
    pub async fn list_variations(
        &self,
        product_id: u64,
        page: u32,
        per_page: u32,
    ) -> AppResult<serde_json::Value> {
        let params = vec![
            ("page", page.to_string()),
            ("per_page", per_page.to_string()),
        ];

        self.make_request(
            reqwest::Method::GET,
            &format!("products/{}/variations", product_id),
            Some(params),
            None,
        )
        .await
    }

    /// Get a single variation
    pub async fn get_variation(
        &self,
        product_id: u64,
        variation_id: u64,
    ) -> AppResult<serde_json::Value> {
        self.make_request(
            reqwest::Method::GET,
            &format!("products/{}/variations/{}", product_id, variation_id),
            None,
            None,
        )
        .await
    }

    /// Create a new variation
    pub async fn create_variation(
        &self,
        product_id: u64,
        variation_data: serde_json::Value,
    ) -> AppResult<serde_json::Value> {
        self.make_request(
            reqwest::Method::POST,
            &format!("products/{}/variations", product_id),
            None,
            Some(variation_data),
        )
        .await
    }

    /// Update a variation
    pub async fn update_variation(
        &self,
        product_id: u64,
        variation_id: u64,
        variation_data: serde_json::Value,
    ) -> AppResult<serde_json::Value> {
        self.make_request(
            reqwest::Method::PUT,
            &format!("products/{}/variations/{}", product_id, variation_id),
            None,
            Some(variation_data),
        )
        .await
    }

    /// Delete a variation
    pub async fn delete_variation(
        &self,
        product_id: u64,
        variation_id: u64,
        force: bool,
    ) -> AppResult<serde_json::Value> {
        let params = vec![("force", force.to_string())];
        self.make_request(
            reqwest::Method::DELETE,
            &format!("products/{}/variations/{}", product_id, variation_id),
            Some(params),
            None,
        )
        .await
    }

    /// Batch operations for variations
    pub async fn batch_variations(
        &self,
        product_id: u64,
        batch_data: serde_json::Value,
    ) -> AppResult<serde_json::Value> {
        self.make_request(
            reqwest::Method::POST,
            &format!("products/{}/variations/batch", product_id),
            None,
            Some(batch_data),
        )
        .await
    }

    /// Get all products as raw JSON (for syncing)
    pub async fn get_all_products_raw(&self, limit: Option<u32>) -> AppResult<serde_json::Value> {
        let mut all_products = Vec::new();
        let mut page = 1;
        let per_page = 50;
        let max_limit = limit.unwrap_or(u32::MAX);

        loop {
            let response = self.list_products(page, per_page, None, None, None).await?;

            if let Some(products) = response.as_array() {
                if products.is_empty() {
                    break;
                }

                for product in products {
                    all_products.push(product.clone());
                    if all_products.len() >= max_limit as usize {
                        return Ok(json!(all_products));
                    }
                }

                page += 1;
            } else {
                break;
            }
        }

        Ok(json!(all_products))
    }
}
