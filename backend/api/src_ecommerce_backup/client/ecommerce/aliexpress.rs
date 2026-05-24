/// ไฟล์ aliexpress.rs - AliExpress E-commerce Platform Gateway
/// เชื่อมต่อกับ AliExpress API สำหรับการจัดการสินค้าในตลาดออนไลน์โลก
/// ใช้ OAuth 2.0 authentication และ API signature verification
/// รองรับการจัดการสินค้า, dropshipping, orders และ affiliate marketing
use super::RefreshTokenResponse;
use crate::config::PlatformCredentials;
use crate::model::error::{AppError, AppResult};

use crate::model::v1::platfrom::entries::{
    PlatformType, Price, Product, ProductImage, ProductStatus,
};
use chrono::Utc;
use md5;
use reqwest::Client;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use urlencoding;
pub struct AliExpressGateway {
    client: Client,
    credentials: PlatformCredentials,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AliExpressTokenResponse {
    pub access_token: Option<String>,
    pub refresh_token: Option<String>,
    pub expire_time: Option<i64>,
    #[serde(default)]
    pub refresh_token_valid_time: Option<i64>,
    #[serde(default)]
    pub account_id: Option<String>,
    #[serde(default)]
    pub seller_id: Option<String>,
    #[serde(default)]
    pub account_platform: Option<String>,
    #[serde(default)]
    pub user_id: Option<String>,
    #[serde(default)]
    pub locale: Option<String>,
    #[serde(default)]
    pub sp: Option<String>,
    #[serde(default)]
    pub code: Option<String>,
    #[serde(default)]
    pub message: Option<String>,
    #[serde(default)]
    pub error_code: Option<String>,
    #[serde(default)]
    pub error_message: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AliExpressProduct {
    pub product_id: i64,
    pub subject: String,
    pub detail: Option<String>,
    pub category_id: i64,
    pub product_price: String,
    pub freight_template_id: Option<i64>,
    pub product_unit: i32,
    pub image_urls: Option<String>,
    pub product_status_type: String,
    pub ws_display: String,
    pub gmt_create: String,
    pub gmt_modified: String,
    pub owner_member_id: String,
    pub sku_list: Option<Vec<SkuInfo>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SkuInfo {
    pub sku_id: String,
    pub sku_code: String,
    pub sku_price: String,
    pub sku_stock: i32,
    pub sku_property: HashMap<String, String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AliExpressApiResponse<T> {
    pub aliexpress_response: T,
    pub request_id: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProductListResponse {
    pub result_success: bool,
    pub result_code: Option<String>,
    pub result_message: Option<String>,
    pub product_list: Option<Vec<AliExpressProduct>>,
    pub total_count: Option<i32>,
    pub current_page: Option<i32>,
    pub total_page: Option<i32>,
}

impl AliExpressGateway {
    pub fn new(credentials: PlatformCredentials) -> Self {
        Self {
            client: Client::new(),
            credentials,
        }
    }

    fn convert_to_product(&self, p: &AliExpressProduct) -> Product {
        Product {
            product_id: format!("aliexpress_{}", p.product_id),
            platform_product_id: p.product_id.to_string(),
            platform: PlatformType::AliExpress,
            shop_id: "".to_string(), // Will be set by caller
            platform_shop_id: "".to_string(),
            title: p.subject.clone(),
            brand: "".to_string(),
            description: p.detail.clone(),
            price: Price {
                amount: Decimal::from_str_exact(&p.product_price).unwrap_or(Decimal::ZERO),
                currency: "USD".to_string(),
                original_price: None,
                discount_percentage: None,
            },
            currency: "USD".to_string(),
            sku: p
                .sku_list
                .as_ref()
                .and_then(|skus| skus.first().map(|s| s.sku_code.clone()))
                .unwrap_or_default(),
            quantity: p.product_unit as i16,
            images: p
                .image_urls
                .as_ref()
                .map(|urls| {
                    urls.split(',')
                        .enumerate()
                        .map(|(idx, url)| ProductImage {
                            url: url.to_string(),
                            alt: None,
                            is_primary: idx == 0,
                            position: idx as i32,
                        })
                        .collect()
                })
                .unwrap_or_default(),
            categories: vec![p.category_id.to_string()],
            attributes: HashMap::new(),
            status: match p.product_status_type.to_lowercase().as_str() {
                "onselling" => ProductStatus::Active,
                _ => ProductStatus::Inactive,
            },
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
            synced_at: Some(chrono::Utc::now()),
        }
    }

    fn generate_signature(&self, params: &HashMap<String, String>, method: &str) -> String {
        // Sort parameters alphabetically
        let mut sorted_params: Vec<(&str, &str)> = params
            .iter()
            .map(|(k, v)| (k.as_str(), v.as_str()))
            .collect();
        sorted_params.sort_by(|a, b| a.0.cmp(b.0));

        // Build signature string
        let param_string: String = sorted_params
            .iter()
            .map(|(k, v)| format!("{}{}", k, v))
            .collect::<Vec<_>>()
            .join("");

        let sign_string = format!("{}{}{}", self.credentials.app_secret, method, param_string);

        // Generate MD5 signature
        let digest = md5::compute(sign_string.as_bytes());

        // Convert to uppercase hex
        format!("{:X}", digest)
    }

    async fn call_api(
        &self,
        method: &str,
        params: HashMap<String, String>,
        access_token: Option<&str>,
    ) -> AppResult<Value> {
        let mut all_params = params.clone();
        all_params.insert("app_key".to_string(), self.credentials.app_key.clone());
        all_params.insert("method".to_string(), method.to_string());
        all_params.insert(
            "timestamp".to_string(),
            Utc::now().format("%Y-%m-%d %H:%M:%S").to_string(),
        );
        all_params.insert("format".to_string(), "json".to_string());
        all_params.insert("v".to_string(), "2.0".to_string());
        all_params.insert("sign_method".to_string(), "md5".to_string());

        if let Some(token) = access_token {
            all_params.insert("session".to_string(), token.to_string());
        }

        let signature = self.generate_signature(&all_params, method);
        all_params.insert("sign".to_string(), signature);

        let response = self
            .client
            .post(&self.credentials.api_base_url)
            .form(&all_params)
            .send()
            .await
            .map_err(|e| AppError::ExternalApiError(format!("AliExpress API error: {}", e)))?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(AppError::ExternalApiError(format!(
                "AliExpress API returned error: {}",
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
impl AliExpressGateway {
    pub fn platform_name(&self) -> &str {
        "aliexpress"
    }

    pub fn get_oauth_url(&self, state: &str) -> String {
        let authorize_url = self
            .credentials
            .oauth_authorize_url
            .clone()
            .unwrap_or_else(|| "https://oauth.aliexpress.com/authorize".to_string());

        format!(
            "{}?response_type=code&client_id={}&redirect_uri={}&state={}",
            authorize_url,
            self.credentials.app_key,
            urlencoding::encode(
                self.credentials
                    .redirect_uri
                    .as_ref()
                    .unwrap_or(&String::new())
            ),
            state
        )
    }

    async fn send_token_request(
        &self,
        mut params: HashMap<String, String>,
    ) -> AppResult<AliExpressTokenResponse> {
        params.insert("client_id".to_string(), self.credentials.app_key.clone());
        params.insert(
            "client_secret".to_string(),
            self.credentials.app_secret.clone(),
        );

        let token_url = self
            .credentials
            .oauth_token_url
            .clone()
            .unwrap_or_else(|| "https://oauth.aliexpress.com/token".to_string());

        let response = self
            .client
            .post(&token_url)
            .form(&params)
            .send()
            .await
            .map_err(|e| AppError::ExternalApiError(format!("Token request failed: {}", e)))?;

        let status = response.status();
        let response_text = response.text().await.unwrap_or_default();

        if !status.is_success() {
            return Err(AppError::ExternalApiError(format!(
                "Token request failed: {} - {}",
                status, response_text
            )));
        }

        let token_response: AliExpressTokenResponse = serde_json::from_str(&response_text)
            .map_err(|e| {
                AppError::ExternalApiError(format!(
                    "Failed to parse token response: {} - raw: {}",
                    e, response_text
                ))
            })?;

        if let Some(code) = token_response.code.as_deref() {
            if code != "0" && !code.is_empty() {
                let message = token_response
                    .error_message
                    .or(token_response.message)
                    .unwrap_or_else(|| "AliExpress token request failed".to_string());
                return Err(AppError::ExternalApiError(message));
            }
        }

        if token_response.access_token.is_none() {
            let message = token_response
                .error_message
                .or(token_response.message)
                .unwrap_or_else(|| "Missing access token in response".to_string());
            return Err(AppError::ExternalApiError(message));
        }

        Ok(token_response)
    }

    pub async fn exchange_code_for_token(&self, code: &str) -> AppResult<(String, String, i64)> {
        let mut params = HashMap::new();
        params.insert("grant_type".to_string(), "authorization_code".to_string());
        params.insert("code".to_string(), code.to_string());
        if let Some(redirect) = &self.credentials.redirect_uri {
            params.insert("redirect_uri".to_string(), redirect.clone());
        }

        let token_response = self.send_token_request(params).await?;
        let expire_time = token_response
            .expire_time
            .unwrap_or_else(|| Utc::now().timestamp_millis() + 3600 * 1000);
        let expires_in = (expire_time - Utc::now().timestamp_millis()) / 1000;

        Ok((
            token_response
                .access_token
                .unwrap_or_else(|| "".to_string()),
            token_response
                .refresh_token
                .unwrap_or_else(|| "".to_string()),
            expires_in,
        ))
    }

    pub async fn exchange_code_for_tokens_detailed(
        &self,
        code: &str,
    ) -> AppResult<serde_json::Value> {
        let mut params = HashMap::new();
        params.insert("grant_type".to_string(), "authorization_code".to_string());
        params.insert("code".to_string(), code.to_string());
        if let Some(redirect) = &self.credentials.redirect_uri {
            params.insert("redirect_uri".to_string(), redirect.clone());
        }

        let token_response = self.send_token_request(params).await?;
        let expire_time = token_response
            .expire_time
            .unwrap_or_else(|| Utc::now().timestamp_millis() + 3600 * 1000);
        let expires_in = (expire_time - Utc::now().timestamp_millis()) / 1000;

        Ok(json!({
            "access_token": token_response.access_token.unwrap_or_default(),
            "refresh_token": token_response.refresh_token.unwrap_or_default(),
            "expires_in": expires_in,
            "account_id": token_response.account_id,
            "seller_id": token_response.seller_id,
            "account_platform": token_response.account_platform,
            "user_id": token_response.user_id,
            "locale": token_response.locale,
            "sp": token_response.sp,
            "refresh_token_valid_time": token_response.refresh_token_valid_time
        }))
    }

    pub async fn refresh_access_token(
        &self,
        refresh_token: &str,
    ) -> AppResult<RefreshTokenResponse> {
        let mut params = HashMap::new();
        params.insert("grant_type".to_string(), "refresh_token".to_string());
        params.insert("refresh_token".to_string(), refresh_token.to_string());
        let token_response = self.send_token_request(params).await?;
        let expire_time = token_response
            .expire_time
            .unwrap_or_else(|| Utc::now().timestamp_millis() + 3600 * 1000);
        let expires_in = (expire_time - Utc::now().timestamp_millis()) / 1000;

        Ok(RefreshTokenResponse {
            access_token: token_response.access_token.unwrap_or_default(),
            refresh_token: token_response.refresh_token,
            expires_in: Some(expires_in),
        })
    }

    pub async fn fetch_products(
        &self,
        access_token: &str,
        limit: Option<usize>,
        offset: Option<usize>,
    ) -> AppResult<Vec<Product>> {
        let page_size = limit.unwrap_or(20).min(50);
        let page_no = (offset.unwrap_or(0) / page_size) + 1;

        let mut params = HashMap::new();
        params.insert("page_no".to_string(), page_no.to_string());
        params.insert("page_size".to_string(), page_size.to_string());
        params.insert("product_status_type".to_string(), "onSelling".to_string());

        let response = self
            .call_api(
                "aliexpress.solution.product.list.get",
                params,
                Some(access_token),
            )
            .await?;

        let list_response: ProductListResponse = response
            ["aliexpress_solution_product_list_get_response"]["result"]
            .as_object()
            .ok_or_else(|| AppError::ExternalApiError("Invalid response format".to_string()))
            .and_then(|obj| {
                serde_json::from_value(Value::Object(obj.clone())).map_err(|e| {
                    AppError::ExternalApiError(format!("Failed to parse product list: {}", e))
                })
            })?;

        if !list_response.result_success {
            return Err(AppError::ExternalApiError(format!(
                "API error: {}",
                list_response.result_message.unwrap_or_default()
            )));
        }

        let products = list_response.product_list.unwrap_or_default();

        Ok(products
            .into_iter()
            .map(|p| self.convert_to_product(&p))
            .collect())
    }

    pub async fn fetch_product_detail(
        &self,
        access_token: &str,
        product_id: &str,
    ) -> AppResult<Product> {
        let mut params = HashMap::new();
        params.insert("product_id".to_string(), product_id.to_string());

        let response = self
            .call_api(
                "aliexpress.solution.product.info.get",
                params,
                Some(access_token),
            )
            .await?;

        let product: AliExpressProduct = response["aliexpress_solution_product_info_get_response"]
            ["result"]
            .as_object()
            .ok_or_else(|| AppError::ExternalApiError("Invalid product response".to_string()))
            .and_then(|obj| {
                serde_json::from_value(Value::Object(obj.clone())).map_err(|e| {
                    AppError::ExternalApiError(format!("Failed to parse product: {}", e))
                })
            })?;

        Ok(self.convert_to_product(&product))
    }

    pub async fn search_products(
        &self,
        access_token: &str,
        query: &str,
        limit: Option<usize>,
    ) -> AppResult<Vec<Product>> {
        let mut params = HashMap::new();
        params.insert("keywords".to_string(), query.to_string());
        params.insert("page_no".to_string(), "1".to_string());
        params.insert("page_size".to_string(), limit.unwrap_or(20).to_string());

        let response = self
            .call_api(
                "aliexpress.solution.product.search",
                params,
                Some(access_token),
            )
            .await?;

        let list_response: ProductListResponse = response
            ["aliexpress_solution_product_search_response"]["result"]
            .as_object()
            .ok_or_else(|| AppError::ExternalApiError("Invalid response format".to_string()))
            .and_then(|obj| {
                serde_json::from_value(Value::Object(obj.clone())).map_err(|e| {
                    AppError::ExternalApiError(format!("Failed to parse search results: {}", e))
                })
            })?;

        if !list_response.result_success {
            return Err(AppError::ExternalApiError(format!(
                "Search failed: {}",
                list_response.result_message.unwrap_or_default()
            )));
        }

        let products = list_response.product_list.unwrap_or_default();

        Ok(products
            .into_iter()
            .map(|p| self.convert_to_product(&p))
            .collect())
    }

    pub async fn get_categories(
        &self,
        access_token: &str,
    ) -> AppResult<Vec<crate::model::v1::platfrom::entries::Category>> {
        let params = HashMap::new();

        let response = self
            .call_api(
                "aliexpress.solution.seller.category.tree.query",
                params,
                Some(access_token),
            )
            .await?;

        let empty_vec = vec![];
        let categories = response["aliexpress_solution_seller_category_tree_query_response"]
            ["result"]["children_category_list"]
            .as_array()
            .unwrap_or(&empty_vec);

        let mut result = Vec::new();
        for cat in categories {
            if let (Some(id), Some(name)) =
                (cat["category_id"].as_i64(), cat["category_name"].as_str())
            {
                result.push(crate::model::v1::platfrom::entries::Category {
                    id: id.to_string(),
                    name: name.to_string(),
                    parent_id: None,
                });
            }
        }

        Ok(result)
    }
}
