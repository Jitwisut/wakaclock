use std::{
    collections::{BTreeSet, HashMap},
    time::Duration,
};

use anyhow::{anyhow, Result as AnyResult};
use async_trait::async_trait;
use rand::{thread_rng, Rng};
use reqwest::{Client, Method, StatusCode};
use serde_json::{json, Map as JsonMap, Number, Value};
use tokio::time::sleep;
use tracing::{debug, info, warn};
use uuid::Uuid;

use crate::{
    config::PlatformCredentials,
    infrastructure::observability::metrics::{
        track_platform_api_call, track_platform_api_duration,
    },
    interfaces::{
        platform_gateway::{
            ListProductParams, OAuthTokens, OAuthUrl, PlatformLimits, PlatformProduct, ProductList,
            ProductVariant, RateLimit, ShopInfo,
        },
        InterfaceError, InterfaceResult, PlatformGateway,
    },
};

const PLATFORM_ID: &str = "line_shopping";
const PLATFORM_NAME: &str = "LINE SHOPPING (MyShop)";
const BASE_URL: &str = "https://developers-oaplus.line.biz/myshop/v1";
const MAX_RETRIES: usize = 5;

const OPTION_SKIP_KEYS: &[&str] = &[
    "variant_id",
    "variantId",
    "inventory_id",
    "inventoryId",
    "barcode",
    "weight",
    "ready_to_ship_number",
    "readyToShipNumber",
    "reserved_number",
    "reservedNumber",
    "available_number",
    "availableNumber",
    "on_hand_number",
    "onHandNumber",
    "image_url",
    "imageUrl",
];

pub struct LineShoppingGateway {
    credentials: PlatformCredentials,
    http_client: Client,
    base_url: String,
}

impl LineShoppingGateway {
    pub fn new(credentials: PlatformCredentials) -> Self {
        let http_client = Client::builder()
            .connect_timeout(Duration::from_secs(3))
            .timeout(Duration::from_secs(15))
            .pool_idle_timeout(Some(Duration::from_secs(60)))
            .build()
            .expect("failed to build LINE MyShop HTTP client");

        let base_url = if !credentials.api_base_url.is_empty() {
            credentials.api_base_url.clone()
        } else {
            BASE_URL.to_string()
        };

        Self {
            credentials,
            http_client,
            base_url,
        }
    }

    fn api_key(&self) -> InterfaceResult<&str> {
        if self.credentials.api_key.is_empty() {
            return Err(InterfaceError::InvalidInput(
                "LINE MyShop API key is required".to_string(),
            ));
        }
        Ok(self.credentials.api_key.as_str())
    }

    fn build_url(&self, path: &str) -> String {
        if path.starts_with("http://") || path.starts_with("https://") {
            path.to_string()
        } else if path.starts_with('/') {
            format!("{}{}", self.base_url, path)
        } else {
            format!("{}/{}", self.base_url, path)
        }
    }

    fn backoff(&self, attempt: usize) -> Duration {
        let jitter: u64 = thread_rng().gen_range(50..150);
        let base = 200_u64.saturating_mul(1_u64 << attempt.min(6));
        Duration::from_millis(base + jitter)
    }

    fn parse_string(value: &Value) -> Option<String> {
        match value {
            Value::String(s) => Some(s.trim().to_string()),
            Value::Number(n) => Some(n.to_string()),
            Value::Bool(b) => Some(b.to_string()),
            _ => None,
        }
    }

    fn parse_i64(value: &Value) -> Option<i64> {
        match value {
            Value::Number(n) => {
                if let Some(i) = n.as_i64() {
                    Some(i)
                } else if let Some(f) = n.as_f64() {
                    Some(f.round() as i64)
                } else {
                    None
                }
            }
            Value::String(s) => s.trim().parse::<i64>().ok(),
            _ => None,
        }
    }

    fn parse_f64(value: &Value) -> Option<f64> {
        match value {
            Value::Number(n) => n.as_f64(),
            Value::String(s) => s.trim().parse::<f64>().ok(),
            _ => None,
        }
    }

    fn pick_string(map: &JsonMap<String, Value>, keys: &[&str]) -> Option<String> {
        keys.iter()
            .find_map(|key| map.get(*key).and_then(Self::parse_string))
            .filter(|s| !s.is_empty())
    }

    fn pick_bool(map: &JsonMap<String, Value>, keys: &[&str]) -> Option<bool> {
        keys.iter()
            .find_map(|key| map.get(*key))
            .and_then(|value| match value {
                Value::Bool(flag) => Some(*flag),
                Value::Number(n) => n.as_i64().map(|v| v != 0),
                Value::String(s) => {
                    let lowered = s.trim().to_ascii_lowercase();
                    match lowered.as_str() {
                        "true" | "1" | "yes" | "onsale" | "on" => Some(true),
                        "false" | "0" | "no" | "hide" | "off" => Some(false),
                        _ => None,
                    }
                }
                _ => None,
            })
    }

    fn pick_array<'a>(map: &'a JsonMap<String, Value>, keys: &[&str]) -> Option<&'a Vec<Value>> {
        keys.iter()
            .find_map(|key| map.get(*key).and_then(|v| v.as_array()))
    }

    fn convert_price(value: f64) -> InterfaceResult<Number> {
        Number::from_f64(value)
            .ok_or_else(|| InterfaceError::InvalidInput(format!("invalid price value '{}'", value)))
    }

    fn parse_variant_weight(attributes: &HashMap<String, String>) -> Option<Number> {
        attributes
            .get("weight")
            .and_then(|raw| raw.trim().parse::<f64>().ok().and_then(Number::from_f64))
    }

    fn parse_instant_discount(attributes: &HashMap<String, String>) -> Option<Number> {
        attributes
            .get("instant_discount")
            .and_then(|raw| raw.trim().parse::<i64>().ok().map(Number::from))
    }

    fn parse_variant_inventory(variant: &ProductVariant) -> i64 {
        variant
            .inventory
            .map(|v| v as i64)
            .or_else(|| variant.quantity.map(|v| v as i64))
            .unwrap_or(0)
    }

    fn derive_variant_options(product: &PlatformProduct) -> (Vec<String>, Vec<Value>) {
        let mut option_order: Vec<String> = Vec::new();
        let mut values_map: HashMap<String, BTreeSet<String>> = HashMap::new();

        for variant in &product.variants {
            for (key, value) in &variant.attributes {
                if OPTION_SKIP_KEYS
                    .iter()
                    .any(|skip| skip.eq_ignore_ascii_case(key))
                {
                    continue;
                }
                let trimmed = value.trim();
                if trimmed.is_empty() {
                    continue;
                }
                if !option_order
                    .iter()
                    .any(|existing| existing.eq_ignore_ascii_case(key))
                {
                    option_order.push(key.clone());
                }
                values_map
                    .entry(key.clone())
                    .or_insert_with(BTreeSet::new)
                    .insert(trimmed.to_string());
            }
        }

        let mut payload = Vec::with_capacity(option_order.len());
        for key in &option_order {
            if let Some(values) = values_map.get(key) {
                payload.push(json!({
                    "name": key,
                    "value": values.iter().cloned().collect::<Vec<_>>(),
                }));
            }
        }

        (option_order, payload)
    }

    fn build_create_payload(&self, product: &PlatformProduct) -> InterfaceResult<Value> {
        let category_id = product
            .attributes
            .get("category_id")
            .or_else(|| product.attributes.get("categoryId"))
            .cloned()
            .ok_or_else(|| {
                InterfaceError::InvalidInput(
                    "category_id attribute is required for LINE MyShop".to_string(),
                )
            })?;

        let (option_order, variant_options_payload) = Self::derive_variant_options(product);

        let mut variants_payload = Vec::with_capacity(product.variants.len());
        for variant in &product.variants {
            let mut variant_map = JsonMap::new();

            if let Some(price) = Number::from_f64(variant.price) {
                variant_map.insert("price".to_string(), Value::Number(price));
            }

            variant_map.insert(
                "onHandNumber".to_string(),
                Value::Number(Number::from(Self::parse_variant_inventory(variant))),
            );

            if let Some(sku) = &variant.sku {
                variant_map.insert("sku".to_string(), Value::String(sku.clone()));
            }

            if let Some(weight) = Self::parse_variant_weight(&variant.attributes) {
                variant_map.insert("weight".to_string(), Value::Number(weight));
            }

            for (idx, option_name) in option_order.iter().enumerate() {
                if let Some(value) = variant
                    .attributes
                    .iter()
                    .find(|(key, _)| key.eq_ignore_ascii_case(option_name))
                    .map(|(_, value)| value.trim().to_string())
                {
                    let field = match idx {
                        0 => "option1",
                        1 => "option2",
                        2 => "option3",
                        _ => continue,
                    };
                    variant_map.insert(field.to_string(), Value::String(value));
                }
            }

            variants_payload.push(Value::Object(variant_map));
        }

        let mut payload = JsonMap::new();
        payload.insert("name".to_string(), Value::String(product.title.clone()));
        payload.insert("categoryId".to_string(), Value::String(category_id));
        payload.insert(
            "code".to_string(),
            Value::String(product.sku.clone().unwrap_or_else(|| product.id.clone())),
        );

        payload.insert(
            "imageUrls".to_string(),
            Value::Array(product.images.iter().cloned().map(Value::String).collect()),
        );

        if let Some(description) = &product.description {
            payload.insert(
                "description".to_string(),
                Value::String(description.clone()),
            );
        }

        if let Some(brand) = product.attributes.get("brand").cloned() {
            payload.insert("brand".to_string(), Value::String(brand));
        }

        if let Some(discount) = Self::parse_instant_discount(&product.attributes) {
            payload.insert("instantDiscount".to_string(), Value::Number(discount));
        }

        if !variant_options_payload.is_empty() {
            payload.insert(
                "variantOptions".to_string(),
                Value::Array(variant_options_payload),
            );
        }

        if !variants_payload.is_empty() {
            payload.insert("variants".to_string(), Value::Array(variants_payload));
        }

        Ok(Value::Object(payload))
    }

    fn build_update_payload(&self, product: &PlatformProduct) -> InterfaceResult<Value> {
        let mut payload = JsonMap::new();

        payload.insert("name".to_string(), Value::String(product.title.clone()));

        if let Some(description) = &product.description {
            payload.insert(
                "description".to_string(),
                Value::String(description.clone()),
            );
        }

        if let Some(brand) = product.attributes.get("brand").cloned() {
            payload.insert("brand".to_string(), Value::String(brand));
        }

        if let Some(category) = product
            .attributes
            .get("category_id")
            .or_else(|| product.attributes.get("categoryId"))
        {
            payload.insert("categoryId".to_string(), Value::String(category.clone()));
        }

        payload.insert(
            "imageUrls".to_string(),
            Value::Array(product.images.iter().cloned().map(Value::String).collect()),
        );

        let (_, variant_options_payload) = Self::derive_variant_options(product);
        if !variant_options_payload.is_empty() {
            payload.insert(
                "variantOptions".to_string(),
                Value::Array(variant_options_payload),
            );
        }

        Ok(Value::Object(payload))
    }

    fn build_variant_update_payload(&self, product: &PlatformProduct) -> Value {
        let (option_order, _) = Self::derive_variant_options(product);
        let mut variants_payload = Vec::new();

        for variant in &product.variants {
            if variant.id.trim().is_empty() {
                continue;
            }

            let mut obj = JsonMap::new();
            obj.insert("id".to_string(), Value::String(variant.id.clone()));
            obj.insert(
                "onHandNumber".to_string(),
                Value::Number(Number::from(Self::parse_variant_inventory(variant))),
            );

            if let Some(sku) = &variant.sku {
                obj.insert("sku".to_string(), Value::String(sku.clone()));
            }

            if let Some(weight) = Self::parse_variant_weight(&variant.attributes) {
                obj.insert("weight".to_string(), Value::Number(weight));
            }

            for (idx, option_name) in option_order.iter().enumerate() {
                if let Some(value) = variant
                    .attributes
                    .iter()
                    .find(|(key, _)| key.eq_ignore_ascii_case(option_name))
                    .map(|(_, value)| value.trim().to_string())
                {
                    let field = match idx {
                        0 => "option1",
                        1 => "option2",
                        2 => "option3",
                        _ => continue,
                    };
                    obj.insert(field.to_string(), Value::String(value));
                }
            }

            variants_payload.push(Value::Object(obj));
        }

        Value::Object(
            [("variants".to_string(), Value::Array(variants_payload))]
                .into_iter()
                .collect(),
        )
    }

    fn build_price_update_payload(
        &self,
        product: &PlatformProduct,
    ) -> InterfaceResult<Option<Value>> {
        let mut variants_payload = Vec::new();
        for variant in &product.variants {
            if variant.id.trim().is_empty() {
                continue;
            }
            if let Some(number) = Number::from_f64(variant.price) {
                let mut obj = JsonMap::new();
                obj.insert("id".to_string(), Value::String(variant.id.clone()));
                obj.insert("price".to_string(), Value::Number(number));
                variants_payload.push(Value::Object(obj));
            }
        }

        let mut payload = JsonMap::new();
        if let Some(discount) = Self::parse_instant_discount(&product.attributes) {
            payload.insert("instantDiscount".to_string(), Value::Number(discount));
        }

        if !variants_payload.is_empty() {
            payload.insert("variants".to_string(), Value::Array(variants_payload));
        }

        if payload.is_empty() {
            return Ok(None);
        }

        Ok(Some(Value::Object(payload)))
    }

    async fn send_request(
        &self,
        method: Method,
        path: &str,
        query: Option<Vec<(&str, String)>>,
        body: Option<Value>,
    ) -> InterfaceResult<reqwest::Response> {
        let api_key = self.api_key()?.to_string();
        let url = self.build_url(path);
        let operation = format!("{} {}", method, path);

        let mut attempt = 0_usize;
        loop {
            let mut request = self
                .http_client
                .request(method.clone(), &url)
                .header("X-API-KEY", &api_key)
                .header("Accept", "application/json");

            if let Some(params) = &query {
                request = request.query(params);
            }
            if let Some(payload) = &body {
                request = request
                    .header("Content-Type", "application/json")
                    .json(payload);
            }

            let start = std::time::Instant::now();
            match request.send().await {
                Ok(response) => {
                    let duration = start.elapsed().as_secs_f64();
                    track_platform_api_duration(PLATFORM_ID, &operation, duration);

                    if response.status().is_success() {
                        track_platform_api_call(PLATFORM_ID, &operation, true);
                        return Ok(response);
                    }

                    track_platform_api_call(PLATFORM_ID, &operation, false);

                    if response.status() == StatusCode::TOO_MANY_REQUESTS
                        || response.status().is_server_error()
                    {
                        if attempt + 1 >= MAX_RETRIES {
                            let status = response.status();
                            let text = response.text().await.unwrap_or_default();
                            return Err(InterfaceError::External(format!(
                                "LINE MyShop API error {}: {}",
                                status, text
                            )));
                        }

                        let retry_after = response
                            .headers()
                            .get("Retry-After")
                            .and_then(|value| value.to_str().ok())
                            .and_then(|value| value.parse::<u64>().ok())
                            .map(Duration::from_secs)
                            .unwrap_or_else(|| self.backoff(attempt));

                        warn!(
                            attempt = attempt,
                            status = %response.status(),
                            retry_ms = retry_after.as_millis(),
                            "LINE MyShop API retry scheduled"
                        );

                        sleep(retry_after).await;
                        attempt += 1;
                        continue;
                    }

                    let status = response.status();
                    let text = response.text().await.unwrap_or_default();
                    return Err(InterfaceError::External(format!(
                        "LINE MyShop API error {}: {}",
                        status, text
                    )));
                }
                Err(error) => {
                    if attempt + 1 >= MAX_RETRIES {
                        return Err(InterfaceError::ConnectionError(error.to_string()));
                    }

                    let backoff = self.backoff(attempt);
                    warn!(
                        attempt = attempt,
                        retry_ms = backoff.as_millis(),
                        "LINE MyShop transport error: {}",
                        error
                    );
                    sleep(backoff).await;
                    attempt += 1;
                }
            }
        }
    }

    fn convert_to_platform_product(value: Value) -> InterfaceResult<PlatformProduct> {
        let obj = value
            .as_object()
            .ok_or_else(|| InterfaceError::SerializationError("expected product object".into()))?;

        let product_id = Self::pick_string(obj, &["productId", "id", "product_id", "productID"])
            .unwrap_or_else(|| Uuid::new_v4().to_string());

        let title = Self::pick_string(obj, &["name", "productName"])
            .unwrap_or_else(|| "Unnamed product".to_string());
        let description = Self::pick_string(obj, &["description", "detail"]);

        let image_urls = Self::pick_array(obj, &["imageUrls", "images"])
            .map(|arr| {
                arr.iter()
                    .filter_map(|item| Self::parse_string(item))
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default();

        let variant_options = Self::pick_array(obj, &["variantOptions"]).cloned();
        let option_names: Vec<String> = variant_options
            .as_ref()
            .map(|arr| {
                arr.iter()
                    .filter_map(|item| {
                        item.as_object()
                            .and_then(|map| map.get("name"))
                            .and_then(Self::parse_string)
                    })
                    .collect()
            })
            .unwrap_or_default();

        let mut variants = Vec::new();
        if let Some(variant_values) = Self::pick_array(obj, &["variants"]) {
            for variant_value in variant_values {
                if let Some(variant_obj) = variant_value.as_object() {
                    let variant_id =
                        Self::pick_string(variant_obj, &["id", "variantId", "variant_id"])
                            .unwrap_or_else(|| Uuid::new_v4().to_string());

                    let price =
                        Self::pick_f64(variant_obj, &["price", "sellingPrice"]).unwrap_or(0.0);
                    let quantity =
                        Self::pick_i64(variant_obj, &["availableNumber", "available", "quantity"])
                            .map(|value| value as i32);
                    let inventory =
                        Self::pick_i64(variant_obj, &["onHandNumber", "stock", "inventory"])
                            .map(|value| value as i32);

                    let mut attributes = HashMap::new();
                    if let Some(on_hand) = inventory {
                        attributes.insert("onHandNumber".to_string(), on_hand.to_string());
                    }
                    if let Some(available) = quantity {
                        attributes.insert("availableNumber".to_string(), available.to_string());
                    }

                    if let Some(weight) = Self::pick_string(variant_obj, &["weight", "weightGram"])
                    {
                        attributes.insert("weight".to_string(), weight);
                    }
                    if let Some(barcode) = Self::pick_string(variant_obj, &["barcode"]) {
                        attributes.insert("barcode".to_string(), barcode);
                    }

                    for (idx, option_name) in option_names.iter().enumerate() {
                        let field = match idx {
                            0 => "option1",
                            1 => "option2",
                            2 => "option3",
                            _ => continue,
                        };
                        if let Some(option_value) = Self::pick_string(variant_obj, &[field]) {
                            attributes.insert(option_name.clone(), option_value.clone());
                            attributes.insert(field.to_string(), option_value);
                        }
                    }

                    variants.push(ProductVariant {
                        id: variant_id,
                        sku: Self::pick_string(variant_obj, &["sku", "code"]),
                        title: None,
                        price,
                        quantity,
                        inventory,
                        attributes,
                    });
                }
            }
        }

        let primary_price = variants
            .first()
            .map(|v| v.price)
            .unwrap_or_else(|| Self::pick_f64(obj, &["price"]).unwrap_or(0.0));

        let total_quantity = variants
            .iter()
            .filter_map(|variant| variant.inventory)
            .sum::<i32>();

        let status = if Self::pick_bool(obj, &["isDisplay", "displayStatus"]).unwrap_or(true) {
            "active".to_string()
        } else {
            "inactive".to_string()
        };

        let mut attributes = HashMap::new();
        if let Some(code) = Self::pick_string(obj, &["code", "productCode"]) {
            attributes.insert("code".to_string(), code);
        }
        if let Some(category) = Self::pick_string(obj, &["categoryId", "category_id"]) {
            attributes.insert("category_id".to_string(), category);
        }
        if let Some(brand) = Self::pick_string(obj, &["brand"]) {
            attributes.insert("brand".to_string(), brand);
        }
        if let Some(discount) = Self::pick_string(obj, &["instantDiscount"]) {
            attributes.insert("instant_discount".to_string(), discount);
        }
        if let Some(display_status) = Self::pick_string(obj, &["displayStatus"]) {
            attributes.insert("display_status".to_string(), display_status);
        }

        Ok(PlatformProduct {
            id: product_id.clone(),
            platform_id: Some(product_id),
            title,
            description,
            price: primary_price,
            currency: "THB".to_string(),
            sku: attributes.get("code").cloned(),
            quantity: Some(total_quantity),
            images: image_urls,
            variants,
            status,
            attributes,
            created_at: None,
            updated_at: None,
        })
    }

    fn pick_i64(map: &JsonMap<String, Value>, keys: &[&str]) -> Option<i64> {
        keys.iter()
            .find_map(|key| map.get(*key).and_then(Self::parse_i64))
    }

    fn pick_f64(map: &JsonMap<String, Value>, keys: &[&str]) -> Option<f64> {
        keys.iter()
            .find_map(|key| map.get(*key).and_then(Self::parse_f64))
    }

    async fn toggle_display_status(&self, product_id: &str, status: &str) -> InterfaceResult<()> {
        let normalized = match status.to_ascii_lowercase().as_str() {
            "active" | "onsale" => "onsale",
            _ => "hide",
        };

        let path = format!("/products/{}/display-status/{}", product_id, normalized);
        let response = self.send_request(Method::POST, &path, None, None).await?;

        if response.status().is_success() {
            Ok(())
        } else {
            Err(InterfaceError::External(format!(
                "failed to toggle display status: {}",
                response.status()
            )))
        }
    }

    pub async fn test_connection(&self) -> InterfaceResult<Value> {
        let response = self
            .send_request(
                Method::GET,
                "/products",
                Some(vec![("size", "1".to_string()), ("page", "1".to_string())]),
                None,
            )
            .await?;

        if response.status().is_success() {
            Ok(json!({
                "connected": true,
                "platform": PLATFORM_ID,
                "message": "LINE MyShop API key validated successfully"
            }))
        } else {
            Err(InterfaceError::External(format!(
                "LINE MyShop responded with status {}",
                response.status()
            )))
        }
    }
}

#[async_trait]
impl PlatformGateway for LineShoppingGateway {
    fn platform_id(&self) -> &str {
        PLATFORM_ID
    }

    fn platform_name(&self) -> &str {
        PLATFORM_NAME
    }

    async fn init_oauth(&self, _state: &str, _redirect_uri: &str) -> InterfaceResult<OAuthUrl> {
        Err(InterfaceError::NotImplemented(
            "LINE MyShop uses API keys instead of OAuth".to_string(),
        ))
    }

    async fn get_oauth_url(&self, _state: &str) -> AnyResult<String> {
        Ok("LINE MyShop uses API keys, no OAuth consent screen".to_string())
    }

    async fn handle_oauth_callback(
        &self,
        _code: &str,
        _state: &str,
    ) -> InterfaceResult<OAuthTokens> {
        Err(InterfaceError::NotImplemented(
            "LINE MyShop uses API keys instead of OAuth".to_string(),
        ))
    }

    async fn exchange_code_for_token(&self, _code: &str) -> AnyResult<(String, String)> {
        Err(anyhow!(
            "LINE MyShop uses API keys instead of OAuth; no token exchange available"
        ))
    }

    async fn refresh_token(&self, _refresh_token: &str) -> AnyResult<(String, String)> {
        Err(anyhow!(
            "LINE MyShop uses API keys instead of OAuth; no token refresh available"
        ))
    }

    async fn refresh_tokens(&self, _refresh_token: &str) -> InterfaceResult<OAuthTokens> {
        Err(InterfaceError::NotImplemented(
            "LINE MyShop uses API keys instead of OAuth".to_string(),
        ))
    }

    async fn list_products(&self, params: &ListProductParams) -> InterfaceResult<ProductList> {
        let mut query = Vec::new();
        if let Some(page) = params.page {
            query.push(("page", page.to_string()));
        }
        if let Some(limit) = params.limit {
            query.push(("size", limit.min(100).to_string()));
        }
        if let Some(search) = &params.search {
            query.push(("search", search.clone()));
        }

        let response = self
            .send_request(Method::GET, "/products", Some(query), None)
            .await?;
        let headers = response.headers().clone();
        let payload: Value = response
            .json()
            .await
            .map_err(|err| InterfaceError::SerializationError(err.to_string()))?;

        let products_array =
            if let Some(array) = payload.get("data").and_then(|value| value.as_array()) {
                array.clone()
            } else if let Some(array) = payload.get("items").and_then(|value| value.as_array()) {
                array.clone()
            } else if payload.is_array() {
                payload.as_array().cloned().unwrap_or_default()
            } else {
                Vec::new()
            };

        let mut products = Vec::with_capacity(products_array.len());
        for item in products_array {
            match Self::convert_to_platform_product(item) {
                Ok(product) => products.push(product),
                Err(err) => {
                    warn!("failed to map LINE MyShop product: {}", err);
                }
            }
        }

        let total = payload
            .get("total")
            .and_then(|v| v.as_u64())
            .or_else(|| payload.get("totalRow").and_then(|v| v.as_u64()))
            .unwrap_or(products.len() as u64);

        let has_more = payload
            .get("pageInfo")
            .and_then(|info| info.get("hasNext"))
            .and_then(|value| value.as_bool())
            .unwrap_or(false);

        debug!(
            total = total,
            products = products.len(),
            remaining = headers
                .get("RateLimit-Remaining")
                .and_then(|h| h.to_str().ok())
                .unwrap_or("unknown"),
            "fetched LINE MyShop products"
        );

        Ok(ProductList {
            products,
            total,
            has_more,
            next_cursor: payload
                .get("pageInfo")
                .and_then(|info| info.get("nextCursor"))
                .and_then(|value| value.as_str())
                .map(|s| s.to_string()),
        })
    }

    async fn fetch_products(
        &self,
        _access_token: &str,
        page: Option<u32>,
        limit: Option<u32>,
    ) -> AnyResult<Vec<Value>> {
        let mut query = Vec::new();
        if let Some(page) = page {
            query.push(("page", page.to_string()));
        }
        if let Some(limit) = limit {
            query.push(("size", limit.min(100).to_string()));
        }

        let response = self
            .send_request(Method::GET, "/products", Some(query), None)
            .await
            .map_err(|err| anyhow!(err.to_string()))?;
        let payload: Value = response
            .json()
            .await
            .map_err(|err| anyhow!(err.to_string()))?;

        if let Some(array) = payload.get("data").and_then(|value| value.as_array()) {
            Ok(array.clone())
        } else if let Some(array) = payload.get("items").and_then(|value| value.as_array()) {
            Ok(array.clone())
        } else if let Some(array) = payload.as_array() {
            Ok(array.clone())
        } else {
            Ok(vec![payload])
        }
    }

    async fn get_product(&self, product_id: &str) -> InterfaceResult<PlatformProduct> {
        let path = format!("/products/{}", product_id);
        let response = self.send_request(Method::GET, &path, None, None).await?;
        let payload: Value = response
            .json()
            .await
            .map_err(|err| InterfaceError::SerializationError(err.to_string()))?;

        Self::convert_to_platform_product(payload)
    }

    async fn fetch_product_details(
        &self,
        _access_token: &str,
        product_id: &str,
    ) -> AnyResult<Value> {
        let path = format!("/products/{}", product_id);
        let response = self
            .send_request(Method::GET, &path, None, None)
            .await
            .map_err(|err| anyhow!(err.to_string()))?;
        response
            .json()
            .await
            .map_err(|err| anyhow!(err.to_string()))
    }

    async fn create_product(&self, product: &PlatformProduct) -> InterfaceResult<String> {
        let payload = self.build_create_payload(product)?;
        let response = self
            .send_request(Method::POST, "/products", None, Some(payload))
            .await?;
        let body: Value = response
            .json()
            .await
            .map_err(|err| InterfaceError::SerializationError(err.to_string()))?;

        let product_id = Self::convert_to_platform_product(body.clone())?.id;

        info!(
            product_id = %product_id,
            "created product on LINE MyShop"
        );

        Ok(product_id)
    }

    async fn update_product(
        &self,
        product_id: &str,
        product: &PlatformProduct,
    ) -> InterfaceResult<()> {
        let base_payload = self.build_update_payload(product)?;
        let path = format!("/products/{}", product_id);
        self.send_request(Method::PATCH, &path, None, Some(base_payload))
            .await?;

        if let Some(price_payload) = self.build_price_update_payload(product)? {
            let price_path = format!("/products/{}/prices", product_id);
            self.send_request(Method::PATCH, &price_path, None, Some(price_payload))
                .await?;
        }

        let variant_payload = self.build_variant_update_payload(product);
        if let Some(variants) = variant_payload
            .get("variants")
            .and_then(|value| value.as_array())
        {
            if !variants.is_empty() {
                let variant_path = format!("/products/{}/variant", product_id);
                self.send_request(Method::PATCH, &variant_path, None, Some(variant_payload))
                    .await?;
            }
        }

        self.toggle_display_status(product_id, &product.status)
            .await?;

        Ok(())
    }

    async fn upsert_product(&self, _access_token: &str, _product: Value) -> AnyResult<Value> {
        Err(anyhow!(
            "LINE MyShop upsert flow is not supported; perform explicit create/update instead"
        ))
    }

    async fn delete_product(&self, product_id: &str) -> InterfaceResult<()> {
        let path = format!("/products/{}", product_id);
        let response = self.send_request(Method::DELETE, &path, None, None).await?;

        if response.status() == StatusCode::NO_CONTENT || response.status().is_success() {
            info!(product_id = %product_id, "deleted product on LINE MyShop");
            Ok(())
        } else {
            Err(InterfaceError::External(format!(
                "LINE MyShop delete returned {}",
                response.status()
            )))
        }
    }

    async fn get_shop_info(&self) -> InterfaceResult<ShopInfo> {
        Ok(ShopInfo {
            id: "line_myshop".to_string(),
            name: "LINE SHOPPING MyShop".to_string(),
            url: Some("https://www.linemyshop.com".to_string()),
            country: Some("TH".to_string()),
            currency: Some("THB".to_string()),
            platform: Some(PLATFORM_ID.to_string()),
            status: Some("active".to_string()),
            created_at: None,
        })
    }

    async fn validate_credentials(&self) -> InterfaceResult<bool> {
        let response = self
            .send_request(
                Method::GET,
                "/products",
                Some(vec![("size", "1".to_string())]),
                None,
            )
            .await?;

        Ok(response.status().is_success())
    }

    async fn get_limits(&self) -> InterfaceResult<PlatformLimits> {
        Ok(PlatformLimits {
            requests_per_second: Some(10),
            requests_per_minute: Some(600),
            requests_per_hour: Some(36_000),
            max_page_size: Some(100),
        })
    }

    async fn check_rate_limit(&self) -> InterfaceResult<RateLimit> {
        Ok(RateLimit {
            limit: 600,
            remaining: 600,
            reset_at: None,
        })
    }
}
