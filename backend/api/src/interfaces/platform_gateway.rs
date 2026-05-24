/// ไฟล์ platform_gateway.rs - Platform Gateway Interface
/// กำหนด interface กลางสำหรับการเชื่อมต่อกับ e-commerce platforms
/// ทุก platform adapter ต้อง implement trait นี้เพื่อให้ใช้งานร่วมกันได้
use anyhow::Result;
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::sync::Arc;

use crate::interfaces::InterfaceResult;

/// Platform gateway credentials
/// โครงสร้าง credentials แบบ unified สำหรับทุก platform
/// รองรับทั้ง OAuth และ API key/secret authentication
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Credentials {
    pub api_key: Option<String>,    // API key สำหรับ platforms ที่ใช้ key/secret
    pub api_secret: Option<String>, // API secret คู่กับ key
    pub access_token: Option<String>, // OAuth access token
    pub refresh_token: Option<String>, // OAuth refresh token สำหรับต่ออายุ
    pub store_url: Option<String>,  // Store URL สำหรับ self-hosted platforms
    pub shop_id: Option<String>,    // Shop/Store ID ใน platform
    pub additional: HashMap<String, String>, // ข้อมูลเพิ่มเติม platform-specific
    pub extra: HashMap<String, String>, // ข้อมูล extra สำหรับ custom needs
}

/// OAuth tokens response
/// ข้อมูล OAuth tokens ที่ได้จากการ exchange authorization code
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OAuthTokens {
    pub access_token: String,              // Token สำหรับเข้าถึง API
    pub refresh_token: Option<String>,     // Token สำหรับ refresh access token
    pub expires_at: Option<DateTime<Utc>>, // เวลาหมดอายุของ access token
    pub token_type: Option<String>,        // ประเภท token (Bearer, etc.)
}

/// OAuth URL response
/// URL สำหรับ redirect ผู้ใช้ไป authorize แอพพลิเคชัน
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OAuthUrl {
    pub url: String,   // OAuth authorization URL
    pub state: String, // State parameter สำหรับ CSRF protection
}

/// Platform product
/// โครงสร้างข้อมูลสินค้าแบบ unified ที่ใช้ร่วมกันทุก platform
/// แต่ละ platform adapter จะ map ข้อมูลเข้า struct นี้
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlatformProduct {
    pub id: String,
    pub platform_id: Option<String>,
    pub title: String,
    pub description: Option<String>,
    pub price: f64,
    pub currency: String,
    pub sku: Option<String>,
    pub quantity: Option<i32>,
    pub images: Vec<String>,
    pub variants: Vec<ProductVariant>,
    pub status: String,
    pub attributes: HashMap<String, String>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

/// Product variant
/// ตัวเลือกของสินค้า (size, color, etc.)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProductVariant {
    pub id: String,
    pub sku: Option<String>,
    pub title: Option<String>,
    pub price: f64,
    pub quantity: Option<i32>,
    pub inventory: Option<i32>,
    pub attributes: HashMap<String, String>,
}

/// Product list response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProductList {
    pub products: Vec<PlatformProduct>,
    pub total: u64,
    pub has_more: bool,
    pub next_cursor: Option<String>,
}

/// List product parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListProductParams {
    pub page: Option<u32>,
    pub limit: Option<u32>,
    pub offset: Option<u32>,
    pub status: Option<String>,
    pub search: Option<String>,
    pub sort: Option<String>,
    pub shop_id: Option<String>,
}

/// Shop information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShopInfo {
    pub id: String,
    pub name: String,
    pub url: Option<String>,
    pub country: Option<String>,
    pub currency: Option<String>,
    pub platform: Option<String>,
    pub status: Option<String>,
    pub created_at: Option<DateTime<Utc>>,
}

/// Platform rate limits
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlatformLimits {
    pub requests_per_second: Option<u32>,
    pub requests_per_minute: Option<u32>,
    pub requests_per_hour: Option<u32>,
    pub max_page_size: Option<u32>,
}

/// Rate limit status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RateLimit {
    pub limit: u32,
    pub remaining: u32,
    pub reset_at: Option<DateTime<Utc>>,
}

/// Platform gateway trait for OAuth and API operations
#[async_trait]
pub trait PlatformGateway: Send + Sync {
    /// Get platform identifier
    fn platform_id(&self) -> &str;

    /// Get platform name
    fn platform_name(&self) -> &str;

    /// Initialize OAuth flow
    async fn init_oauth(&self, state: &str, redirect_uri: &str) -> InterfaceResult<OAuthUrl>;

    /// Generate OAuth URL for authorization
    async fn get_oauth_url(&self, state: &str) -> Result<String>;

    /// Handle OAuth callback
    async fn handle_oauth_callback(&self, code: &str, state: &str) -> InterfaceResult<OAuthTokens>;

    /// Exchange authorization code for tokens
    async fn exchange_code_for_token(&self, code: &str) -> Result<(String, String)>;

    /// Refresh access token using refresh token
    async fn refresh_token(&self, refresh_token: &str) -> Result<(String, String)>;

    /// Refresh tokens
    async fn refresh_tokens(&self, refresh_token: &str) -> InterfaceResult<OAuthTokens>;

    /// List products from platform
    async fn list_products(&self, params: &ListProductParams) -> InterfaceResult<ProductList>;

    /// Fetch products from platform
    async fn fetch_products(
        &self,
        access_token: &str,
        page: Option<u32>,
        limit: Option<u32>,
    ) -> Result<Vec<serde_json::Value>>;

    /// Get single product
    async fn get_product(&self, product_id: &str) -> InterfaceResult<PlatformProduct>;

    /// Fetch single product details
    async fn fetch_product_details(
        &self,
        access_token: &str,
        product_id: &str,
    ) -> Result<serde_json::Value>;

    /// Create product
    async fn create_product(&self, product: &PlatformProduct) -> InterfaceResult<String>;

    /// Update product
    async fn update_product(
        &self,
        product_id: &str,
        product: &PlatformProduct,
    ) -> InterfaceResult<()>;

    /// Create or update product
    async fn upsert_product(
        &self,
        access_token: &str,
        product: serde_json::Value,
    ) -> Result<serde_json::Value>;

    /// Delete product
    async fn delete_product(&self, product_id: &str) -> InterfaceResult<()>;

    /// Get shop information
    async fn get_shop_info(&self) -> InterfaceResult<ShopInfo>;

    /// Validate credentials
    async fn validate_credentials(&self) -> InterfaceResult<bool>;

    /// Get platform limits
    async fn get_limits(&self) -> InterfaceResult<PlatformLimits>;

    /// Check rate limit
    async fn check_rate_limit(&self) -> InterfaceResult<RateLimit>;
}

/// Gateway factory trait
#[async_trait]
pub trait GatewayFactory: Send + Sync {
    /// Create a gateway instance for a platform
    async fn create_gateway(
        &self,
        platform: &str,
        _credentials: Credentials,
    ) -> Result<Arc<dyn PlatformGateway>>;

    /// List supported platforms
    fn supported_platforms(&self) -> Vec<String>;
}

/// Default implementation of GatewayFactory
/// Always uses REST client for platform-gateway communication
pub struct GatewayFactoryImpl {
    supported_platforms: HashSet<String>,
}

impl GatewayFactoryImpl {
    pub fn new() -> Self {
        let supported_platforms = vec![
            "tiktok",
            "shopee",
            "lazada",
            "shopify",
            "woocommerce",
            "bigcommerce",
            "magento",
            "medusa",
            "ecwid",
            "wix",
            "zoho",
            "alibaba",
            "aliexpress",
            "amazon",
            "ebay",
            "etsy",
            "jd",
            "lineshopping",
            "odoo",
            "erpnext",
            "custom",
        ]
        .into_iter()
        .map(|s| s.to_string())
        .collect();

        Self {
            supported_platforms,
        }
    }
}

impl Default for GatewayFactoryImpl {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl GatewayFactory for GatewayFactoryImpl {
    async fn create_gateway(
        &self,
        platform: &str,
        credentials: Credentials,
    ) -> Result<Arc<dyn PlatformGateway>> {
        if !self.supported_platforms.contains(platform) {
            return Err(anyhow::anyhow!("Unsupported platform: {}", platform));
        }

        // Always use REST client for platform-gateway communication
        // K8s handles load balancing and service discovery

        use crate::infrastructure::transport::gateway_http::GatewayHttpClient;

        let gateway = GatewayHttpClient::new(
            platform.to_string(),
            credentials.shop_id.clone(),
            Some(credentials),
        );

        Ok(Arc::new(gateway) as Arc<dyn PlatformGateway>)
    }

    fn supported_platforms(&self) -> Vec<String> {
        self.supported_platforms.iter().cloned().collect()
    }
}
