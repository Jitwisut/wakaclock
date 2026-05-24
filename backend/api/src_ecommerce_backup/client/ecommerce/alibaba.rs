/// ไฟล์ alibaba.rs - Alibaba B2B Platform Gateway
/// เชื่อมต่อกับ Alibaba API สำหรับการจัดการสินค้าในตลาด B2B
/// ใช้ HMAC signature authentication และรองรับ OAuth 2.0
/// รองรับการจัดการสินค้า, wholesale pricing, supplier management
use super::RefreshTokenResponse;
use crate::config::PlatformCredentials;
use crate::model::error::{AppError, AppResult};
use crate::model::v1::platfrom::entries::{
    PlatformType, Price, Product, ProductImage, ProductStatus,
};
use chrono::Utc;
use hmac::{Hmac, Mac};
use reqwest::Client;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::Sha256;
use std::collections::HashMap;
use urlencoding;
pub struct AlibabaGateway {
    client: Client,
    credentials: PlatformCredentials,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AlibabaTokenResponse {
    pub access_token: String,
    pub refresh_token: String,
    pub expires_in: i64,
    #[serde(default)]
    pub refresh_expires_in: Option<i64>,
    #[serde(default)]
    pub resource_owner: Option<String>,
    #[serde(default)]
    pub uid: Option<String>,
    #[serde(default)]
    pub ali_id: Option<String>,
    #[serde(default)]
    pub member_id: Option<String>,
    #[serde(default)]
    pub account: Option<String>,
    #[serde(default)]
    pub account_platform: Option<String>,
    #[serde(default)]
    pub country: Option<String>,
    #[serde(default)]
    pub user_info: Option<AlibabaUserInfo>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AlibabaUserInfo {
    #[serde(rename = "user_id")]
    pub user_id: Option<String>,
    #[serde(rename = "seller_id")]
    pub seller_id: Option<String>,
    #[serde(rename = "loginId")]
    pub login_id: Option<String>,
    pub country: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AlibabaProduct {
    #[serde(rename = "productID")]
    pub product_id: String,
    pub subject: String,
    #[serde(rename = "type")]
    pub product_type: String,
    #[serde(rename = "categoryID")]
    pub category_id: i64,
    pub image: Option<String>,
    pub price: String,
    pub quantity: i64,
    pub description: Option<String>,
    #[serde(rename = "skuInfos")]
    pub sku_infos: Option<Vec<SkuInfo>>,
    pub images: Option<Vec<String>>,
    pub attributes: Option<Vec<ProductAttribute>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SkuInfo {
    #[serde(rename = "skuId")]
    pub sku_id: String,
    #[serde(rename = "specAttrs")]
    pub spec_attrs: HashMap<String, String>,
    #[serde(rename = "amountOnSale")]
    pub amount_on_sale: i64,
    pub price: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProductAttribute {
    pub name: String,
    pub value: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AlibabaProductListResponse {
    pub result: Option<ProductListResult>,
    pub success: bool,
    pub code: Option<String>,
    pub message: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProductListResult {
    pub data: Vec<AlibabaProduct>,
    pub total: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AlibabaCategory {
    #[serde(rename = "categoryID")]
    pub category_id: i64,
    pub name: String,
    #[serde(rename = "isLeaf")]
    pub is_leaf: bool,
    pub children: Option<Vec<AlibabaCategory>>,
}

impl AlibabaGateway {
    pub fn new(credentials: PlatformCredentials) -> Self {
        Self {
            client: Client::new(),
            credentials,
        }
    }

    fn convert_to_product(&self, p: &AlibabaProduct) -> Product {
        Product {
            product_id: format!("alibaba_{}", p.product_id),
            platform_product_id: p.product_id.to_string(),
            platform: PlatformType::Alibaba,
            shop_id: "".to_string(), // Will be set by caller
            platform_shop_id: "".to_string(),
            title: p.subject.clone(),
            brand: "".to_string(), // Default empty brand, can be extracted from attributes if available
            description: p.description.clone(),
            price: Price {
                amount: Decimal::from_str_exact(&p.price).unwrap_or(Decimal::ZERO),
                currency: "USD".to_string(),
                original_price: None,
                discount_percentage: None,
            },
            currency: "USD".to_string(),
            sku: p
                .sku_infos
                .as_ref()
                .and_then(|skus| skus.first().map(|s| s.sku_id.clone()))
                .unwrap_or_default(),
            quantity: p.quantity as i16,
            images: {
                let image_urls = p.images.clone().unwrap_or_else(|| {
                    p.image
                        .as_ref()
                        .map(|img| vec![img.clone()])
                        .unwrap_or_default()
                });
                image_urls
                    .into_iter()
                    .enumerate()
                    .map(|(i, url)| ProductImage {
                        url,
                        alt: None,
                        is_primary: i == 0,
                        position: i as i32,
                    })
                    .collect()
            },
            categories: vec![p.category_id.to_string()],
            attributes: HashMap::new(),
            status: ProductStatus::Active, // Default to active since Alibaba doesn't provide status field
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
            synced_at: Some(chrono::Utc::now()),
        }
    }

    fn generate_signature(&self, params: &HashMap<String, String>, path: &str) -> String {
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

        let sign_string = format!("{}{}", path, param_string);

        // Generate HMAC-SHA256 signature
        type HmacSha256 = Hmac<Sha256>;
        let mut mac = HmacSha256::new_from_slice(self.credentials.app_secret.as_bytes())
            .expect("HMAC can take key of any size");
        mac.update(sign_string.as_bytes());

        let result = mac.finalize();
        let signature = result.into_bytes();

        // Convert to uppercase hex
        hex::encode(signature).to_uppercase()
    }

    async fn call_api(
        &self,
        api_name: &str,
        params: HashMap<String, String>,
        access_token: &str,
    ) -> AppResult<Value> {
        let url = format!(
            "{}/openapi/param2/1/com.alibaba.product/{}/{}",
            self.credentials.api_base_url, api_name, self.credentials.app_key
        );

        let mut all_params = params.clone();
        all_params.insert("access_token".to_string(), access_token.to_string());
        all_params.insert(
            "_aop_timestamp".to_string(),
            Utc::now().timestamp_millis().to_string(),
        );

        let signature = self.generate_signature(
            &all_params,
            &format!(
                "/openapi/param2/1/com.alibaba.product/{}/{}",
                api_name, self.credentials.app_key
            ),
        );
        all_params.insert("_aop_signature".to_string(), signature);

        let response = self
            .client
            .get(&url)
            .query(&all_params)
            .send()
            .await
            .map_err(|e| AppError::ExternalApiError(format!("Alibaba API error: {}", e)))?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(AppError::ExternalApiError(format!(
                "Alibaba API returned error: {}",
                error_text
            )));
        }

        response
            .json::<Value>()
            .await
            .map_err(|e| AppError::SerializationError(format!("Failed to parse response: {}", e)))
    }

    async fn signed_token_request(
        &self,
        path: &str,
        mut params: HashMap<String, String>,
    ) -> AppResult<AlibabaTokenResponse> {
        let signature = self.generate_signature(&params, path);
        params.insert("sign".to_string(), signature);

        let url = format!("{}{}", self.credentials.api_base_url, path);
        let response = self
            .client
            .post(&url)
            .form(&params)
            .send()
            .await
            .map_err(|e| AppError::ExternalApiError(format!("Token request failed: {}", e)))?;

        let status = response.status();
        let response_text = response.text().await.unwrap_or_default();

        if !status.is_success() {
            return Err(AppError::ExternalApiError(format!(
                "Token request to {} failed: {} - Response: {}",
                path, status, response_text
            )));
        }

        serde_json::from_str(&response_text).map_err(|e| {
            AppError::ExternalApiError(format!(
                "Failed to parse token response: {} - Raw response: {}",
                e, response_text
            ))
        })
    }
}

// TODO: Update to match new PlatformGateway trait
// The following methods need to be updated to match the new PlatformGateway trait
impl AlibabaGateway {
    pub fn platform_name(&self) -> &str {
        "alibaba"
    }

    pub fn get_oauth_url(&self, state: &str) -> String {
        let default_auth_url = "https://openapi-auth.alibaba.com/oauth/authorize".to_string();
        let auth_url = self
            .credentials
            .oauth_authorize_url
            .as_ref()
            .unwrap_or(&default_auth_url);

        format!(
            "{}?response_type=code&client_id={}&redirect_uri={}&state={}",
            auth_url,
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

    pub async fn exchange_code_for_token(&self, code: &str) -> AppResult<(String, String, i64)> {
        let mut params = HashMap::new();
        params.insert("code".to_string(), code.to_string());
        params.insert("app_key".to_string(), self.credentials.app_key.clone());
        params.insert("client_id".to_string(), self.credentials.app_key.clone());
        params.insert(
            "client_secret".to_string(),
            self.credentials.app_secret.clone(),
        );
        params.insert(
            "timestamp".to_string(),
            Utc::now().timestamp_millis().to_string(),
        );
        params.insert("sign_method".to_string(), "sha256".to_string());

        let token_response = self
            .signed_token_request("/auth/token/create", params)
            .await?;

        Ok((
            token_response.access_token,
            token_response.refresh_token,
            token_response.expires_in,
        ))
    }

    /// Exchange authorization code for tokens with detailed response
    /// Returns (access_token, refresh_token, full_token_data)
    pub async fn exchange_code_for_tokens_detailed(
        &self,
        code: &str,
    ) -> AppResult<(String, String, serde_json::Value)> {
        let mut params = HashMap::new();
        params.insert("code".to_string(), code.to_string());
        params.insert("app_key".to_string(), self.credentials.app_key.clone());
        params.insert("client_id".to_string(), self.credentials.app_key.clone());
        params.insert(
            "client_secret".to_string(),
            self.credentials.app_secret.clone(),
        );
        params.insert(
            "timestamp".to_string(),
            Utc::now().timestamp_millis().to_string(),
        );
        params.insert("sign_method".to_string(), "sha256".to_string());

        let token_response = self
            .signed_token_request("/auth/token/create", params)
            .await?;

        // Create detailed response with all token data
        let detailed_data = serde_json::json!({
            "access_token": token_response.access_token.clone(),
            "refresh_token": token_response.refresh_token.clone(),
            "expires_in": token_response.expires_in,
            "refresh_token_valid_time": token_response.refresh_expires_in.unwrap_or(token_response.expires_in),
            "refresh_expires_in": token_response.refresh_expires_in,
            "uid": token_response.uid.clone(),
            "ali_id": token_response.ali_id.clone(),
            "member_id": token_response.member_id.clone(),
            "resource_owner": token_response.resource_owner.clone(),
            "account": token_response.account.clone(),
            "account_platform": token_response.account_platform.clone(),
            "country": token_response.country.clone(),
            "user_info": token_response.user_info.clone(),
        });

        Ok((
            token_response.access_token.clone(),
            token_response.refresh_token.clone(),
            detailed_data,
        ))
    }

    pub async fn refresh_access_token(
        &self,
        refresh_token: &str,
    ) -> AppResult<RefreshTokenResponse> {
        let mut params = HashMap::new();
        params.insert("refresh_token".to_string(), refresh_token.to_string());
        params.insert("app_key".to_string(), self.credentials.app_key.clone());
        params.insert("client_id".to_string(), self.credentials.app_key.clone());
        params.insert(
            "client_secret".to_string(),
            self.credentials.app_secret.clone(),
        );
        params.insert(
            "timestamp".to_string(),
            Utc::now().timestamp_millis().to_string(),
        );
        params.insert("sign_method".to_string(), "sha256".to_string());

        let token_response = self
            .signed_token_request("/auth/token/refresh", params)
            .await?;

        Ok(RefreshTokenResponse {
            access_token: token_response.access_token,
            refresh_token: Some(token_response.refresh_token),
            expires_in: Some(token_response.expires_in),
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
        params.insert("pageNo".to_string(), page_no.to_string());
        params.insert("pageSize".to_string(), page_size.to_string());

        let response = self
            .call_api("alibaba.product.getList", params, access_token)
            .await?;

        let list_response: AlibabaProductListResponse =
            serde_json::from_value(response).map_err(|e| {
                AppError::ExternalApiError(format!("Failed to parse product list: {}", e))
            })?;

        if !list_response.success {
            return Err(AppError::ExternalApiError(format!(
                "API error: {}",
                list_response.message.unwrap_or_default()
            )));
        }

        let products = list_response.result.map(|r| r.data).unwrap_or_default();

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
        params.insert("productID".to_string(), product_id.to_string());

        let response = self
            .call_api("alibaba.product.get", params, access_token)
            .await?;

        let product: AlibabaProduct = response["result"]
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
        params.insert("subject".to_string(), query.to_string());
        params.insert("pageNo".to_string(), "1".to_string());
        params.insert("pageSize".to_string(), limit.unwrap_or(20).to_string());

        let response = self
            .call_api("alibaba.product.getList", params, access_token)
            .await?;

        let list_response: AlibabaProductListResponse =
            serde_json::from_value(response).map_err(|e| {
                AppError::ExternalApiError(format!("Failed to parse search results: {}", e))
            })?;

        if !list_response.success {
            return Err(AppError::ExternalApiError(format!(
                "Search failed: {}",
                list_response.message.unwrap_or_default()
            )));
        }

        let products = list_response.result.map(|r| r.data).unwrap_or_default();

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
            .call_api("alibaba.category.get", params, access_token)
            .await?;

        let empty_vec = vec![];
        let categories = response["result"]["categoryInfoList"]
            .as_array()
            .unwrap_or(&empty_vec);

        let mut result = Vec::new();
        for cat in categories {
            let category: AlibabaCategory = serde_json::from_value(cat.clone()).map_err(|e| {
                AppError::ExternalApiError(format!("Failed to parse category: {}", e))
            })?;

            result.push(crate::model::v1::platfrom::entries::Category {
                id: category.category_id.to_string(),
                name: category.name.clone(),
                parent_id: None,
            });

            // Add children categories recursively
            if let Some(children) = category.children {
                for child in children {
                    result.push(crate::model::v1::platfrom::entries::Category {
                        id: child.category_id.to_string(),
                        name: child.name.clone(),
                        parent_id: Some(category.category_id.to_string()),
                    });
                }
            }
        }

        Ok(result)
    }
}
