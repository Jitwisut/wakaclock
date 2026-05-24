use reqwest::StatusCode;
use serde::Deserialize;
use tracing::{info, warn};

use crate::model::error::{AppError, AppResult};

/// Payload returned by the Strapi shop token cache endpoint.
#[derive(Debug, Clone, Deserialize)]
pub struct ShopTokenCacheEntry {
    pub access_token: Option<String>,
    pub refresh_token: Option<String>,
    pub expires_at: Option<String>,
    pub token_type: Option<String>,
    pub scope: Option<String>,
    pub platform_shop_id: Option<String>,
    pub extra_data: Option<serde_json::Value>,
    pub credentials: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
struct ShopTokenCacheResponse {
    data: Option<ShopTokenCacheEntry>,
}

#[derive(Debug, Deserialize)]
struct ShopTokenDbResponse {
    data: Vec<ShopTokenDbEntry>,
}

#[derive(Debug, Deserialize)]
struct ShopTokenDbEntry {
    attributes: ShopTokenDbAttributes,
}

#[derive(Debug, Deserialize)]
struct ShopTokenDbAttributes {
    access_token: Option<String>,
    refresh_token: Option<String>,
    expires_at: Option<String>,
    token_type: Option<String>,
    scope: Option<String>,
    platform_shop_id: Option<String>,
    extra_data: Option<serde_json::Value>,
    credentials: Option<serde_json::Value>,
}

pub async fn fetch_shop_token(
    platform: &str,
    shop_id: &str,
    tenant_id: &str,
) -> AppResult<Option<ShopTokenCacheEntry>> {
    match fetch_token_via_cache(platform, shop_id, tenant_id).await {
        Ok(Some(entry)) => return Ok(Some(entry)),
        Ok(None) => {
            info!(
                "Token cache miss for platform={} shop_id={} tenant_id={}",
                platform, shop_id, tenant_id
            );
        }
        Err(err) => {
            warn!(
                "Token cache lookup failed for platform={} shop_id={} tenant_id={} - {}",
                platform, shop_id, tenant_id, err
            );
        }
    }

    fetch_token_via_db(platform, shop_id, tenant_id).await
}

async fn fetch_token_via_cache(
    platform: &str,
    shop_id: &str,
    tenant_id: &str,
) -> AppResult<Option<ShopTokenCacheEntry>> {
    let base_url =
        std::env::var("STRAPI_BACKEND_URL").unwrap_or_else(|_| "http://localhost:1338".to_string());
    let auth_token = std::env::var("X_AUTH_TOKEN_SECRET")
        .map_err(|_| {
            AppError::InternalError(
                "X_AUTH_TOKEN_SECRET not configured; cannot fetch tokens from Strapi".to_string(),
            )
        })?
        .trim()
        .to_string();

    if auth_token.is_empty() {
        return Err(AppError::InternalError(
            "X_AUTH_TOKEN_SECRET not configured; cannot fetch tokens from Strapi".to_string(),
        ));
    }

    let endpoint = format!(
        "{}/api/shop-tokens/cache/{}/{}/{}",
        base_url.trim_end_matches('/'),
        platform,
        shop_id,
        tenant_id
    );

    let client = reqwest::Client::new();
    let response = client
        .get(&endpoint)
        .header("x-auth-token", auth_token)
        .send()
        .await
        .map_err(|err| {
            AppError::ExternalApiError(format!("Failed to fetch tokens from Strapi cache: {}", err))
        })?;

    let status = response.status();

    if status == StatusCode::NOT_FOUND {
        return Ok(None);
    }

    if !status.is_success() {
        let body = response.text().await.unwrap_or_default();
        return Err(AppError::ExternalApiError(format!(
            "Strapi token cache request failed (status {}): {}",
            status, body
        )));
    }

    let payload: ShopTokenCacheResponse = response.json().await.map_err(|err| {
        AppError::SerializationError(format!(
            "Failed to parse Strapi token cache response: {}",
            err
        ))
    })?;

    Ok(payload.data)
}

async fn fetch_token_via_db(
    platform: &str,
    shop_id: &str,
    tenant_id: &str,
) -> AppResult<Option<ShopTokenCacheEntry>> {
    let base_url =
        std::env::var("STRAPI_BACKEND_URL").unwrap_or_else(|_| "http://localhost:1338".to_string());
    let auth_token = std::env::var("X_AUTH_TOKEN_SECRET")
        .map_err(|_| {
            AppError::InternalError(
                "X_AUTH_TOKEN_SECRET not configured; cannot fetch tokens from Strapi".to_string(),
            )
        })?
        .trim()
        .to_string();

    if auth_token.is_empty() {
        return Err(AppError::InternalError(
            "X_AUTH_TOKEN_SECRET not configured; cannot fetch tokens from Strapi".to_string(),
        ));
    }

    let endpoint = format!("{}/api/shop-tokens", base_url.trim_end_matches('/'));

    let client = reqwest::Client::new();
    let response = client
        .get(&endpoint)
        .header("x-auth-token", auth_token)
        .query(&[
            ("filters[platform][$eq]", platform),
            ("filters[shop_id][$eq]", shop_id),
            ("filters[tenant_id][$eq]", tenant_id),
            ("pagination[limit]", "1"),
        ])
        .send()
        .await
        .map_err(|err| {
            AppError::ExternalApiError(format!(
                "Failed to fetch tokens from Strapi (DB fallback): {}",
                err
            ))
        })?;

    let status = response.status();

    if status == StatusCode::NOT_FOUND {
        return Ok(None);
    }

    if !status.is_success() {
        let body = response.text().await.unwrap_or_default();
        return Err(AppError::ExternalApiError(format!(
            "Strapi token DB request failed (status {}): {}",
            status, body
        )));
    }

    let payload: ShopTokenDbResponse = response.json().await.map_err(|err| {
        AppError::SerializationError(format!("Failed to parse Strapi token DB response: {}", err))
    })?;

    if let Some(entry) = payload.data.into_iter().next() {
        return Ok(Some(ShopTokenCacheEntry {
            access_token: entry.attributes.access_token,
            refresh_token: entry.attributes.refresh_token,
            expires_at: entry.attributes.expires_at,
            token_type: entry.attributes.token_type,
            scope: entry.attributes.scope,
            platform_shop_id: entry.attributes.platform_shop_id,
            extra_data: entry.attributes.extra_data,
            credentials: entry.attributes.credentials,
        }));
    }

    Ok(None)
}

/// Helper to extract an access token from the Strapi token entry.
pub fn resolve_access_token(entry: &ShopTokenCacheEntry) -> Option<String> {
    if let Some(token) = entry.access_token.as_ref().and_then(|t| {
        let trimmed = t.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_string())
        }
    }) {
        return Some(token);
    }

    entry
        .credentials
        .as_ref()
        .and_then(|creds| creds.get("api_key").and_then(|v| v.as_str()))
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .or_else(|| {
            entry
                .credentials
                .as_ref()
                .and_then(|creds| creds.get("api_token").and_then(|v| v.as_str()))
                .map(|value| value.trim().to_string())
                .filter(|value| !value.is_empty())
        })
        .or_else(|| {
            entry
                .credentials
                .as_ref()
                .and_then(|creds| creds.get("access_token").and_then(|v| v.as_str()))
                .map(|value| value.trim().to_string())
                .filter(|value| !value.is_empty())
        })
}

/// Helper to extract shop cipher (TikTok-specific) from extra_data.
pub fn resolve_shop_cipher(entry: &ShopTokenCacheEntry) -> Option<String> {
    entry
        .extra_data
        .as_ref()
        .and_then(|extra| extra.get("shop_cipher"))
        .and_then(|value| value.as_str())
        .map(|value| value.to_string())
}

/// Helper to extract API key style credentials from cached entries.
pub fn resolve_api_key(entry: &ShopTokenCacheEntry) -> Option<String> {
    entry
        .credentials
        .as_ref()
        .and_then(|creds| {
            creds
                .get("api_key")
                .or_else(|| creds.get("publishable_key"))
                .or_else(|| creds.get("api_token"))
                .or_else(|| creds.get("consumer_key"))
                .or_else(|| creds.get("access_key"))
                .or_else(|| creds.get("accessToken"))
                .or_else(|| creds.get("apiKey"))
        })
        .and_then(value_to_string)
        .or_else(|| {
            entry
                .access_token
                .as_ref()
                .map(|value| value.trim().to_string())
                .filter(|value| !value.is_empty())
        })
}

/// Helper to extract API secrets (client/consumer secret) from cached entries.
pub fn resolve_api_secret(entry: &ShopTokenCacheEntry) -> Option<String> {
    entry
        .credentials
        .as_ref()
        .and_then(|creds| {
            creds
                .get("api_secret")
                .or_else(|| creds.get("client_secret"))
                .or_else(|| creds.get("consumer_secret"))
                .or_else(|| creds.get("secret"))
                .or_else(|| creds.get("secret_key"))
                .or_else(|| creds.get("clientSecret"))
        })
        .and_then(value_to_string)
}

/// Helper to extract store URLs / shop domains from cached entries.
pub fn resolve_store_url(entry: &ShopTokenCacheEntry) -> Option<String> {
    entry
        .credentials
        .as_ref()
        .and_then(|creds| {
            creds
                .get("store_url")
                .or_else(|| creds.get("shop_domain"))
                .or_else(|| creds.get("domain"))
                .or_else(|| creds.get("shop_url"))
                .or_else(|| creds.get("storeUrl"))
                .or_else(|| creds.get("shopUrl"))
                .or_else(|| creds.get("base_url"))
                .or_else(|| creds.get("endpoint"))
                .or_else(|| creds.get("api_base_url"))
        })
        .and_then(value_to_string)
        .or_else(|| {
            entry
                .extra_data
                .as_ref()
                .and_then(|extra| {
                    extra
                        .get("shop_domain")
                        .or_else(|| extra.get("store_url"))
                        .or_else(|| extra.get("base_url"))
                        .or_else(|| extra.get("endpoint"))
                })
                .and_then(value_to_string)
        })
}

fn value_to_string(value: &serde_json::Value) -> Option<String> {
    match value {
        serde_json::Value::String(raw) => {
            let trimmed = raw.trim();
            if trimmed.is_empty() {
                None
            } else {
                Some(trimmed.to_string())
            }
        }
        serde_json::Value::Number(num) => Some(num.to_string()),
        serde_json::Value::Bool(flag) => Some(flag.to_string()),
        _ => None,
    }
}
