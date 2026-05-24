/// ไฟล์ magento.rs - Magento E-commerce Platform Gateway
/// เชื่อมต่อกับ Magento REST API สำหรับการจัดการสินค้าและร้านค้าออนไลน์
/// ใช้ Bearer token authentication และรองรับ Admin token based authentication
/// รองรับการจัดการสินค้า, categories, inventory และ customer data
use super::RefreshTokenResponse;
use crate::config::PlatformCredentials;
use crate::model::error::{AppError, AppResult};
use crate::model::v1::platfrom::entries::Category;
use crate::model::v1::platfrom::entries::{
    PlatformType, Price, Product, ProductImage, ProductStatus,
};
use chrono::Utc;
use reqwest::{Client, StatusCode};

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
/// โครงสร้างหลักของ MagentoGateway สำหรับการเชื่อมต่อกับ Magento API
/// เก็บข้อมูล HTTP client, credentials และ base URL ของร้านค้า
pub struct MagentoGateway {
    credentials: PlatformCredentials,
    client: Client,
    base_url: String,
}

impl MagentoGateway {
    pub fn new(credentials: PlatformCredentials, base_url: String) -> Self {
        Self {
            credentials,
            client: Client::new(),
            base_url,
        }
    }

    async fn get_admin_token(&self) -> AppResult<String> {
        #[derive(Serialize)]
        struct LoginRequest {
            username: String,
            password: String,
        }

        let request = LoginRequest {
            username: self.credentials.app_key.clone(),
            password: self.credentials.app_secret.clone(),
        };

        let response = self
            .client
            .post(format!("{}/rest/V1/integration/admin/token", self.base_url))
            .json(&request)
            .send()
            .await
            .map_err(|e| AppError::ExternalApiError(format!("Magento login failed: {}", e)))?;

        if response.status() != StatusCode::OK {
            let error_text = response.text().await.unwrap_or_default();
            return Err(AppError::ExternalApiError(format!(
                "Magento login failed: {}",
                error_text
            )));
        }

        let token: String = response.json().await.map_err(|e| {
            AppError::ExternalApiError(format!("Failed to parse token response: {}", e))
        })?;

        Ok(token)
    }
}

// #[async_trait]
// TODO: Update to match new PlatformGateway trait
// The following methods need to be updated to match the new PlatformGateway trait
impl MagentoGateway {
    pub fn platform_name(&self) -> &str {
        "magento"
    }

    pub fn get_oauth_url(&self, _state: &str) -> String {
        format!("{}://oauth", self.platform_name())
    }

    pub async fn exchange_code_for_token(&self, code: &str) -> AppResult<(String, String, i64)> {
        let (access_token, refresh_token) = self.exchange_code(code, "").await?;
        Ok((access_token, refresh_token, 3600))
    }

    pub async fn refresh_access_token(
        &self,
        refresh_token: &str,
    ) -> AppResult<RefreshTokenResponse> {
        let (access_token, new_refresh_token) = self.refresh_token(refresh_token).await?;
        Ok(RefreshTokenResponse {
            access_token,
            refresh_token: Some(new_refresh_token),
            expires_in: Some(3600),
        })
    }

    pub async fn fetch_products(
        &self,
        access_token: &str,
        limit: Option<usize>,
        offset: Option<usize>,
    ) -> AppResult<Vec<Product>> {
        let page = offset.unwrap_or(0) / limit.unwrap_or(20);
        self.list_products(access_token, page as u32, limit.unwrap_or(20) as u32)
            .await
    }

    pub async fn fetch_product_detail(
        &self,
        access_token: &str,
        product_id: &str,
    ) -> AppResult<Product> {
        self.get_product(access_token, product_id).await
    }

    pub async fn search_products(
        &self,
        _access_token: &str,
        _query: &str,
        _limit: Option<usize>,
    ) -> AppResult<Vec<Product>> {
        // Search not implemented yet
        Ok(vec![])
    }

    pub async fn get_categories(&self, _access_token: &str) -> AppResult<Vec<Category>> {
        // Categories not implemented yet
        Ok(vec![])
    }

    async fn exchange_code(&self, _code: &str, _state: &str) -> AppResult<(String, String)> {
        // Magento uses token-based authentication
        // Get admin token instead
        let token = self.get_admin_token().await?;
        Ok((token.clone(), token))
    }

    async fn refresh_token(&self, _refresh_token: &str) -> AppResult<(String, String)> {
        // Magento tokens don't refresh, get a new one
        let token = self.get_admin_token().await?;
        Ok((token.clone(), token))
    }

    async fn list_products(
        &self,
        access_token: &str,
        page: u32,
        limit: u32,
    ) -> AppResult<Vec<Product>> {
        #[derive(Deserialize)]
        struct ProductsResponse {
            items: Vec<MagentoProduct>,
            total_count: i32,
        }

        #[derive(Deserialize)]
        struct MagentoProduct {
            product_id: i64,
            sku: String,
            name: String,
            price: Option<f64>,
            status: i32,
            type_product_id: String,
            attribute_set_product_id: i32,
            custom_attributes: Option<Vec<CustomAttribute>>,
            extension_attributes: Option<ExtensionAttributes>,
            media_gallery_entries: Option<Vec<MediaEntry>>,
        }

        #[derive(Deserialize)]
        struct CustomAttribute {
            attribute_code: String,
            value: Value,
        }

        #[derive(Deserialize)]
        struct ExtensionAttributes {
            stock_item: Option<StockItem>,
            category_links: Option<Vec<CategoryLink>>,
        }

        #[derive(Deserialize)]
        struct StockItem {
            qty: Option<f64>,
            is_in_stock: bool,
        }

        #[derive(Deserialize)]
        struct CategoryLink {
            category_product_id: String,
            position: Option<i32>,
        }

        #[derive(Deserialize)]
        struct MediaEntry {
            product_id: i64,
            file: String,
            media_type: String,
        }

        let url = format!(
            "{}/rest/V1/products?searchCriteria[pageSize]={}&searchCriteria[currentPage]={}",
            self.base_url,
            limit,
            page + 1 // Magento uses 1-based page indexing
        );

        let response = self
            .client
            .get(&url)
            .header("Authorization", format!("Bearer {}", access_token))
            .header("Content-Type", "application/json")
            .send()
            .await
            .map_err(|e| AppError::ExternalApiError(format!("Failed to fetch products: {}", e)))?;

        if response.status() != StatusCode::OK {
            let error_text = response.text().await.unwrap_or_default();
            return Err(AppError::ExternalApiError(format!(
                "Failed to fetch products: {}",
                error_text
            )));
        }

        let products_response: ProductsResponse = response.json().await.map_err(|e| {
            AppError::ExternalApiError(format!("Failed to parse products response: {}", e))
        })?;

        let products = products_response
            .items
            .into_iter()
            .map(|p| {
                let mut images = vec![];
                if let Some(media_entries) = p.media_gallery_entries {
                    for (i, entry) in media_entries.iter().enumerate() {
                        if entry.media_type == "image" {
                            images.push(ProductImage {
                                url: format!(
                                    "{}/pub/media/catalog/product{}",
                                    self.base_url, entry.file
                                ),
                                alt: None,
                                is_primary: i == 0,
                                position: i as i32,
                            });
                        }
                    }
                }

                let stock_quantity = p
                    .extension_attributes
                    .as_ref()
                    .and_then(|ext| ext.stock_item.as_ref())
                    .and_then(|stock| stock.qty)
                    .map(|qty| qty as i64);

                let categories = p
                    .extension_attributes
                    .as_ref()
                    .and_then(|ext| ext.category_links.as_ref())
                    .map(|links| {
                        links
                            .iter()
                            .map(|link| link.category_product_id.clone())
                            .collect()
                    })
                    .unwrap_or_default();

                let description = p
                    .custom_attributes
                    .as_ref()
                    .and_then(|attrs| {
                        attrs
                            .iter()
                            .find(|attr| attr.attribute_code == "description")
                            .and_then(|attr| attr.value.as_str())
                            .map(|s| s.to_string())
                    })
                    .unwrap_or_default();

                Product {
                    product_id: format!("magento_{}", p.product_id),
                    shop_id: "".to_string(),
                    platform_shop_id: "".to_string(),
                    platform: PlatformType::Magento,
                    platform_product_id: p.product_id.to_string(),
                    title: p.name,
                    brand: "".to_string(),
                    description: Some(description),
                    price: Price {
                        amount: rust_decimal::Decimal::from_f64_retain(p.price.unwrap_or(0.0))
                            .unwrap_or(rust_decimal::Decimal::ZERO),
                        currency: "USD".to_string(),
                        original_price: None,
                        discount_percentage: None,
                    },
                    currency: "USD".to_string(),
                    images,
                    sku: p.sku,
                    quantity: stock_quantity.unwrap_or(0) as i16,
                    status: if p.status == 1 {
                        ProductStatus::Active
                    } else {
                        ProductStatus::Inactive
                    },
                    categories,
                    attributes: HashMap::new(),
                    created_at: Utc::now(),
                    updated_at: Utc::now(),
                    synced_at: Some(chrono::Utc::now()),
                }
            })
            .collect();

        Ok(products)
    }

    async fn get_product(&self, access_token: &str, product_sku: &str) -> AppResult<Product> {
        #[derive(Deserialize)]
        struct MagentoProduct {
            product_id: i64,
            sku: String,
            name: String,
            price: Option<f64>,
            status: i32,
            type_product_id: String,
            attribute_set_product_id: i32,
            custom_attributes: Option<Vec<CustomAttribute>>,
            extension_attributes: Option<ExtensionAttributes>,
            media_gallery_entries: Option<Vec<MediaEntry>>,
        }

        #[derive(Deserialize)]
        struct CustomAttribute {
            attribute_code: String,
            value: Value,
        }

        #[derive(Deserialize)]
        struct ExtensionAttributes {
            stock_item: Option<StockItem>,
            category_links: Option<Vec<CategoryLink>>,
        }

        #[derive(Deserialize)]
        struct StockItem {
            qty: Option<f64>,
            is_in_stock: bool,
        }

        #[derive(Deserialize)]
        struct CategoryLink {
            category_product_id: String,
            position: Option<i32>,
        }

        #[derive(Deserialize)]
        struct MediaEntry {
            product_id: i64,
            file: String,
            media_type: String,
        }

        let url = format!("{}/rest/V1/products/{}", self.base_url, product_sku);

        let response = self
            .client
            .get(&url)
            .header("Authorization", format!("Bearer {}", access_token))
            .header("Content-Type", "application/json")
            .send()
            .await
            .map_err(|e| AppError::ExternalApiError(format!("Failed to fetch product: {}", e)))?;

        if response.status() != StatusCode::OK {
            let error_text = response.text().await.unwrap_or_default();
            return Err(AppError::ExternalApiError(format!(
                "Failed to fetch product: {}",
                error_text
            )));
        }

        let p: MagentoProduct = response.json().await.map_err(|e| {
            AppError::ExternalApiError(format!("Failed to parse product response: {}", e))
        })?;

        let mut images = vec![];
        if let Some(media_entries) = p.media_gallery_entries {
            for (i, entry) in media_entries.iter().enumerate() {
                if entry.media_type == "image" {
                    images.push(ProductImage {
                        url: format!("{}/pub/media/catalog/product{}", self.base_url, entry.file),
                        alt: None,
                        is_primary: i == 0,
                        position: i as i32,
                    });
                }
            }
        }

        let stock_quantity = p
            .extension_attributes
            .as_ref()
            .and_then(|ext| ext.stock_item.as_ref())
            .and_then(|stock| stock.qty)
            .map(|qty| qty as i64);

        let categories = p
            .extension_attributes
            .as_ref()
            .and_then(|ext| ext.category_links.as_ref())
            .map(|links| {
                links
                    .iter()
                    .map(|link| link.category_product_id.clone())
                    .collect()
            })
            .unwrap_or_default();

        let description = p
            .custom_attributes
            .as_ref()
            .and_then(|attrs| {
                attrs
                    .iter()
                    .find(|attr| attr.attribute_code == "description")
                    .and_then(|attr| attr.value.as_str())
                    .map(|s| s.to_string())
            })
            .unwrap_or_default();

        Ok(Product {
            product_id: format!("magento_{}", p.product_id),
            platform_product_id: p.product_id.to_string(),
            shop_id: "".to_string(),
            platform_shop_id: "".to_string(),
            platform: PlatformType::Magento,
            title: p.name,
            brand: "".to_string(),
            description: Some(description),
            price: Price {
                amount: rust_decimal::Decimal::from_f64_retain(p.price.unwrap_or(0.0))
                    .unwrap_or(rust_decimal::Decimal::ZERO),
                currency: "USD".to_string(),
                original_price: None,
                discount_percentage: None,
            },
            currency: "USD".to_string(),
            images,
            sku: p.sku,
            quantity: stock_quantity.unwrap_or(0) as i16,
            status: if p.status == 1 {
                ProductStatus::Active
            } else {
                ProductStatus::Inactive
            },
            categories,
            attributes: HashMap::new(),

            created_at: Utc::now(),
            updated_at: Utc::now(),
            synced_at: Some(chrono::Utc::now()),
        })
    }

    /// Test the Magento connection by fetching a single product
    pub async fn test_connection(&self) -> AppResult<serde_json::Value> {
        use serde_json::json;

        // Magento requires admin token authentication, get it first
        let access_token = match self.get_admin_token().await {
            Ok(token) => token,
            Err(e) => {
                return Ok(json!({
                    "connected": false,
                    "api_version": "V1",
                    "store_url": self.base_url,
                    "test_result": {
                        "error": format!("Failed to authenticate: {}", e)
                    }
                }));
            }
        };

        // Try to fetch one product to test the connection
        let url = format!(
            "{}/rest/V1/products?searchCriteria[pageSize]=1&searchCriteria[currentPage]=1",
            self.base_url
        );

        let response = self
            .client
            .get(&url)
            .header("Authorization", format!("Bearer {}", access_token))
            .header("Content-Type", "application/json")
            .send()
            .await
            .map_err(|e| AppError::ExternalApiError(format!("Failed to test connection: {}", e)))?;

        if response.status() != StatusCode::OK {
            let error_text = response.text().await.unwrap_or_default();
            return Err(AppError::ExternalApiError(format!(
                "Failed to test connection: {}",
                error_text
            )));
        }

        let response_data: serde_json::Value = response.json().await.map_err(|e| {
            AppError::ExternalApiError(format!("Failed to parse test response: {}", e))
        })?;

        let items = response_data["items"].as_array();
        let has_products = items.is_some_and(|arr| !arr.is_empty());

        Ok(json!({
            "connected": true,
            "api_version": "V1",
            "store_url": self.base_url,
            "test_result": {
                "products_accessible": has_products,
                "sample_product": items.and_then(|arr| arr.first())
            }
        }))
    }
}
