/// ไฟล์ bigcommerce.rs - BigCommerce E-commerce Platform Gateway
/// เชื่อมต่อกับ BigCommerce API สำหรับการจัดการสินค้าและร้านค้าออนไลน์
/// ใช้ X-Auth-Token authentication และรองรับ OAuth 2.0 authorization code flow
/// รองรับการจัดการสินค้า, categories, variants และ custom fields
use reqwest::{
    header::{HeaderMap, HeaderValue},
    Client,
};

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;

use super::RefreshTokenResponse;
use crate::config::PlatformCredentials;
use crate::model::error::{AppError, AppResult};
use crate::model::v1::platfrom::entries::Category;
use crate::model::v1::platfrom::entries::{
    PlatformType, Price, Product, ProductImage, ProductStatus,
};
/// โครงสร้างหลักของ BigCommerceGateway สำหรับการเชื่อมต่อกับ BigCommerce API
/// เก็บข้อมูล HTTP client, credentials และ store hash
pub struct BigCommerceGateway {
    client: Client,
    credentials: PlatformCredentials,
    store_hash: String,
}

/// โครงสร้างการตอบสนองของ OAuth token จาก BigCommerce
/// ประกอบด้วย access token, scope, user information และ context
#[derive(Debug, Serialize, Deserialize)]
pub struct BigCommerceTokenResponse {
    pub access_token: String,
    pub scope: String,
    pub user: User,
    pub context: String,
    pub account_uuid: String,
}

/// ข้อมูลผู้ใช้จาก BigCommerce OAuth response
#[derive(Debug, Serialize, Deserialize)]
pub struct User {
    pub id: i64,
    pub username: String,
    pub email: String,
}

/// โครงสร้างข้อมูลสินค้าจาก BigCommerce API
/// รวมข้อมูลครบถ้วนของสินค้า ราคา inventory variants และ custom fields
#[derive(Debug, Serialize, Deserialize)]
pub struct BigCommerceProduct {
    pub id: i32,
    pub name: String,
    pub sku: String,
    #[serde(rename = "type")]
    pub product_type: String,
    pub description: String,
    pub weight: f64,
    pub price: f64,
    pub cost_price: Option<f64>,
    pub retail_price: Option<f64>,
    pub sale_price: Option<f64>,
    pub calculated_price: f64,
    pub inventory_level: i32,
    pub inventory_tracking: String,
    pub categories: Vec<i32>,
    pub brand_id: Option<i32>,
    pub is_visible: bool,
    pub is_featured: bool,
    pub condition: String,
    pub availability: String,
    pub availability_description: String,
    pub images: Vec<ProductImage>,
    pub videos: Vec<ProductVideo>,
    pub custom_fields: Vec<CustomField>,
    pub variants: Vec<ProductVariant>,
}

/// ข้อมูลภาพสินค้าจาก BigCommerce พร้อม URL ในขนาดต่างๆ
#[derive(Debug, Serialize, Deserialize)]
pub struct BigCommerceProductImage {
    pub id: i32,
    pub product_id: i32,
    pub is_thumbnail: bool,
    pub sort_order: i32,
    pub description: String,
    pub url_zoom: String,
    pub url: String,
    pub url_thumbnail: String,
    pub url_tiny: String,
}

/// ข้อมูลวิดีโอสินค้าใน BigCommerce
#[derive(Debug, Serialize, Deserialize)]
pub struct ProductVideo {
    pub id: i32,
    pub product_id: i32,
    pub title: String,
    pub description: String,
    pub sort_order: i32,
    pub video_id: String,
}

/// ฟิลด์กำหนดเองของสินค้า (Custom Fields)
#[derive(Debug, Serialize, Deserialize)]
pub struct CustomField {
    pub id: i32,
    pub name: String,
    pub value: String,
}

/// ตัวเลือกสินค้า (Product Variants) พร้อมราคาและ inventory แยกต่างหาก
#[derive(Debug, Serialize, Deserialize)]
pub struct ProductVariant {
    pub id: i32,
    pub product_id: i32,
    pub sku: String,
    pub sku_id: Option<String>,
    pub price: Option<f64>,
    pub calculated_price: f64,
    pub sale_price: Option<f64>,
    pub retail_price: Option<f64>,
    pub weight: Option<f64>,
    pub inventory_level: i32,
    pub option_values: Vec<VariantOption>,
}

/// ตัวเลือกของ variant (เช่น สี, ขนาด)
#[derive(Debug, Serialize, Deserialize)]
pub struct VariantOption {
    pub id: i32,
    pub label: String,
    pub option_id: i32,
    pub option_display_name: String,
}

impl BigCommerceGateway {
    /// สร้าง instance ใหม่ของ BigCommerceGateway
    /// ดึง store hash จาก API URL และกำหนดค่า HTTP client
    pub fn new(credentials: PlatformCredentials) -> Self {
        // Extract store hash from credentials or API URL
        let store_hash = credentials
            .api_base_url
            .split('/')
            .find(|s| s.starts_with("stores/"))
            .and_then(|s| s.strip_prefix("stores/"))
            .unwrap_or("default")
            .to_string();

        Self {
            client: Client::new(),
            credentials,
            store_hash,
        }
    }

    /// เรียก BigCommerce API endpoint พร้อม X-Auth-Token authentication
    /// รองรับ HTTP methods ต่างๆ และจัดการ query parameters, request body
    async fn call_api(
        &self,
        method: &str,
        path: &str,
        params: Option<HashMap<String, String>>,
        body: Option<Value>,
        access_token: &str,
    ) -> AppResult<Value> {
        let url = format!(
            "https://api.bigcommerce.com/stores/{}/v3{}",
            self.store_hash, path
        );

        let mut headers = HeaderMap::new();
        headers.insert(
            "X-Auth-Token",
            HeaderValue::from_str(access_token)
                .map_err(|_| AppError::ExternalApiError("Invalid access token".to_string()))?,
        );
        headers.insert("Content-Type", HeaderValue::from_static("application/json"));
        headers.insert("Accept", HeaderValue::from_static("application/json"));

        let mut request_builder = match method {
            "GET" => self.client.get(&url),
            "POST" => self.client.post(&url),
            "PUT" => self.client.put(&url),
            "DELETE" => self.client.delete(&url),
            _ => {
                return Err(AppError::ExternalApiError(
                    "Unsupported HTTP method".to_string(),
                ))
            }
        };

        if let Some(params) = params {
            request_builder = request_builder.query(&params);
        }

        if let Some(body) = body {
            request_builder = request_builder.json(&body);
        }

        let response = request_builder
            .headers(headers)
            .send()
            .await
            .map_err(|e| AppError::ExternalApiError(format!("BigCommerce API error: {}", e)))?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(AppError::ExternalApiError(format!(
                "BigCommerce API returned error: {}",
                error_text
            )));
        }

        response
            .json::<Value>()
            .await
            .map_err(|e| AppError::ExternalApiError(format!("Failed to parse response: {}", e)))
    }
}

// #[async_trait]
// TODO: Update to match new PlatformGateway trait
// The following methods need to be updated to match the new PlatformGateway trait
impl BigCommerceGateway {
    pub fn platform_name(&self) -> &str {
        "bigcommerce"
    }

    pub fn get_oauth_url(&self, state: &str) -> String {
        let scopes = "store_v2_products store_v2_orders store_v2_customers";
        let redirect_uri = self
            .credentials
            .redirect_uri
            .clone()
            .unwrap_or_else(|| "https://api.lodashventure.local/auth".to_string());
        format!(
            "https://login.bigcommerce.com/oauth2/authorize?client_id={}&response_type=code&redirect_uri={}&scope={}&state={}",
            self.credentials.app_key,
            urlencoding::encode(redirect_uri.as_str()),
            scopes,
            state
        )
    }

    pub async fn exchange_code_for_token(
        &self,
        code: &str,
        context: &str,
    ) -> AppResult<BigCommerceTokenResponse> {
        let mut params = HashMap::new();
        params.insert("client_id", self.credentials.app_key.as_str());
        params.insert("client_secret", self.credentials.app_secret.as_str());
        params.insert("code", code);
        params.insert("scope", "store_v2_products store_v2_orders");
        params.insert("grant_type", "authorization_code");
        let redirect_uri = self
            .credentials
            .redirect_uri
            .clone()
            .unwrap_or_else(|| "https://api.lodashventure.local/auth".to_string());
        params.insert("redirect_uri", redirect_uri.as_str());
        params.insert("context", context);

        let response = self
            .client
            .post("https://login.bigcommerce.com/oauth2/token")
            .form(&params)
            .send()
            .await
            .map_err(|e| AppError::ExternalApiError(format!("Token exchange failed: {}", e)))?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(AppError::ExternalApiError(format!(
                "Token exchange failed: {}",
                error_text
            )));
        }

        response
            .json::<BigCommerceTokenResponse>()
            .await
            .map_err(|e| {
                AppError::ExternalApiError(format!("Failed to parse token response: {}", e))
            })
    }

    pub async fn refresh_access_token(
        &self,
        _refresh_token: &str,
    ) -> AppResult<RefreshTokenResponse> {
        // BigCommerce tokens don't expire and don't have refresh tokens
        Err(AppError::ExternalApiError(
            "BigCommerce tokens don't expire".to_string(),
        ))
    }

    pub async fn fetch_products(
        &self,
        access_token: &str,
        limit: Option<usize>,
        offset: Option<usize>,
    ) -> AppResult<Vec<Product>> {
        let mut params = HashMap::new();
        params.insert(
            "limit".to_string(),
            limit.unwrap_or(50).min(250).to_string(),
        );
        params.insert(
            "page".to_string(),
            ((offset.unwrap_or(0) / limit.unwrap_or(50)) + 1).to_string(),
        );
        params.insert(
            "include".to_string(),
            "images,videos,custom_fields,variants".to_string(),
        );

        let response = self
            .call_api("GET", "/catalog/products", Some(params), None, access_token)
            .await?;

        let empty_vec = vec![];
        let products = response["data"].as_array().unwrap_or(&empty_vec);

        Ok(products
            .iter()
            .filter_map(|product| {
                let bc_product: BigCommerceProduct =
                    serde_json::from_value(product.clone()).ok()?;

                let images: Vec<ProductImage> = bc_product
                    .images
                    .into_iter()
                    .enumerate()
                    .map(|(idx, img)| ProductImage {
                        url: img.url,
                        alt: None,
                        is_primary: idx == 0,
                        position: idx as i32,
                    })
                    .collect();

                let mut attributes = HashMap::new();
                for field in bc_product.custom_fields {
                    attributes.insert(field.name, field.value);
                }

                Some(Product {
                    product_id: format!("bigcommerce_{}", bc_product.id),
                    platform_product_id: bc_product.id.to_string(),
                    shop_id: "".to_string(),
                    platform_shop_id: "".to_string(),
                    platform: PlatformType::BigCommerce,
                    title: bc_product.name,
                    brand: "".to_string(),
                    description: Some(bc_product.description),
                    price: Price {
                        amount: Decimal::from_f64_retain(bc_product.calculated_price)
                            .unwrap_or(Decimal::ZERO),
                        currency: "USD".to_string(),
                        original_price: None,
                        discount_percentage: None,
                    },
                    sku: bc_product.sku,
                    quantity: bc_product.inventory_level as i16,
                    images,
                    categories: bc_product
                        .categories
                        .into_iter()
                        .map(|c| c.to_string())
                        .collect(),
                    attributes,
                    currency: "USD".to_string(),
                    status: if bc_product.is_visible {
                        ProductStatus::Active
                    } else {
                        ProductStatus::Inactive
                    },
                    created_at: chrono::Utc::now(),
                    updated_at: chrono::Utc::now(),
                    synced_at: Some(chrono::Utc::now()),
                })
            })
            .collect())
    }

    pub async fn fetch_product_detail(
        &self,
        access_token: &str,
        product_id: &str,
    ) -> AppResult<Product> {
        let mut params = HashMap::new();
        params.insert(
            "include".to_string(),
            "images,videos,custom_fields,variants".to_string(),
        );

        let response = self
            .call_api(
                "GET",
                &format!("/catalog/products/{}", product_id),
                Some(params),
                None,
                access_token,
            )
            .await?;

        let bc_product: BigCommerceProduct = serde_json::from_value(response["data"].clone())
            .map_err(|e| AppError::ExternalApiError(format!("Failed to parse product: {}", e)))?;

        let images: Vec<ProductImage> = bc_product
            .images
            .into_iter()
            .enumerate()
            .map(|(idx, img)| ProductImage {
                url: img.url,
                alt: None,
                is_primary: idx == 0,
                position: idx as i32,
            })
            .collect();

        let mut attributes = HashMap::new();
        for field in bc_product.custom_fields {
            attributes.insert(field.name, field.value);
        }

        Ok(Product {
            product_id: format!("bigcommerce_{}", bc_product.id),
            platform_product_id: bc_product.id.to_string(),
            shop_id: "".to_string(),
            platform_shop_id: "".to_string(),
            platform: PlatformType::BigCommerce,
            title: bc_product.name,
            brand: "".to_string(),
            description: Some(bc_product.description),
            price: Price {
                amount: Decimal::from_f64_retain(bc_product.calculated_price)
                    .unwrap_or(Decimal::ZERO),
                currency: "USD".to_string(),
                original_price: None,
                discount_percentage: None,
            },
            sku: bc_product.sku,
            quantity: bc_product.inventory_level as i16,
            images,
            categories: bc_product
                .categories
                .into_iter()
                .map(|c| c.to_string())
                .collect(),
            attributes,
            currency: "USD".to_string(),
            status: if bc_product.is_visible {
                ProductStatus::Active
            } else {
                ProductStatus::Inactive
            },
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
            synced_at: Some(chrono::Utc::now()),
        })
    }

    pub async fn search_products(
        &self,
        access_token: &str,
        query: &str,
        limit: Option<usize>,
    ) -> AppResult<Vec<Product>> {
        let mut params = HashMap::new();
        params.insert("keyword".to_string(), query.to_string());
        params.insert(
            "limit".to_string(),
            limit.unwrap_or(50).min(250).to_string(),
        );
        params.insert("include".to_string(), "images,variants".to_string());

        let response = self
            .call_api("GET", "/catalog/products", Some(params), None, access_token)
            .await?;

        let empty_vec = vec![];
        let products = response["data"].as_array().unwrap_or(&empty_vec);

        Ok(products
            .iter()
            .filter_map(|product| {
                let bc_product: BigCommerceProduct =
                    serde_json::from_value(product.clone()).ok()?;

                let images: Vec<ProductImage> = bc_product
                    .images
                    .into_iter()
                    .enumerate()
                    .map(|(idx, img)| ProductImage {
                        url: img.url,
                        alt: None,
                        is_primary: idx == 0,
                        position: idx as i32,
                    })
                    .collect();

                Some(Product {
                    product_id: format!("bigcommerce_{}", bc_product.id),
                    platform_product_id: bc_product.id.to_string(),
                    shop_id: "".to_string(),
                    platform_shop_id: "".to_string(),
                    platform: PlatformType::BigCommerce,
                    title: bc_product.name,
                    brand: "".to_string(),
                    description: Some(bc_product.description),
                    price: Price {
                        amount: Decimal::from_f64_retain(bc_product.calculated_price)
                            .unwrap_or(Decimal::ZERO),
                        currency: "USD".to_string(),
                        original_price: None,
                        discount_percentage: None,
                    },
                    sku: bc_product.sku,
                    quantity: bc_product.inventory_level as i16,
                    images,
                    categories: bc_product
                        .categories
                        .into_iter()
                        .map(|c| c.to_string())
                        .collect(),
                    attributes: HashMap::new(),
                    currency: "USD".to_string(),
                    status: if bc_product.is_visible {
                        ProductStatus::Active
                    } else {
                        ProductStatus::Inactive
                    },
                    created_at: chrono::Utc::now(),
                    updated_at: chrono::Utc::now(),
                    synced_at: Some(chrono::Utc::now()),
                })
            })
            .collect())
    }

    pub async fn get_categories(&self, access_token: &str) -> AppResult<Vec<Category>> {
        let response = self
            .call_api("GET", "/catalog/categories", None, None, access_token)
            .await?;

        let empty_vec = vec![];
        let categories = response["data"].as_array().unwrap_or(&empty_vec);

        Ok(categories
            .iter()
            .filter_map(|cat| {
                let id = cat["id"].as_i64()?;
                let name = cat["name"].as_str()?;
                Some(Category {
                    id: id.to_string(),
                    name: name.to_string(),
                    parent_id: None,
                })
            })
            .collect())
    }

    /// Test the BigCommerce connection by fetching a single product
    pub async fn test_connection(&self) -> AppResult<serde_json::Value> {
        use serde_json::json;

        // BigCommerce uses stored API token (app_secret is the access token)
        let access_token = &self.credentials.app_secret;

        // Try to fetch one product to test the connection
        let mut params = HashMap::new();
        params.insert("limit".to_string(), "1".to_string());
        params.insert("include".to_string(), "images".to_string());

        let response = self
            .call_api("GET", "/catalog/products", Some(params), None, access_token)
            .await?;

        let empty_vec = vec![];
        let products = response["data"].as_array().unwrap_or(&empty_vec);

        Ok(json!({
            "connected": true,
            "api_version": "v3",
            "store_url": format!("https://api.bigcommerce.com/stores/{}", self.store_hash),
            "test_result": {
                "products_accessible": !products.is_empty(),
                "sample_product": products.first()
            }
        }))
    }
}
