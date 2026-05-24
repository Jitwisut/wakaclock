use std::collections::HashSet;

use jsonwebtoken::{decode, Algorithm, DecodingKey, Validation};
use serde_json::{Map, Value};

use crate::model::{error::AppError, v1::platfrom::entries::AuthClaims};

/// Decode a Strapi-issued JWT and convert it to `AuthClaims`.
/// Returns `AppError::AuthError` when token cannot be verified or payload is invalid.
pub fn decode_strapi_jwt(token: &str, secret: &str) -> Result<AuthClaims, AppError> {
    let mut validation = Validation::new(Algorithm::HS256);
    // Strapi tokens typically don't include audience/issuer claims; disable strict checks
    validation.validate_aud = false;
    validation.validate_nbf = false;
    validation.required_spec_claims.remove("aud");
    validation.required_spec_claims.remove("iss");

    let data = decode::<Value>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &validation,
    )
    .map_err(|err| AppError::AuthError(format!("Invalid authorization token: {}", err)))?;

    let claims_value = data.claims;
    let raw = claims_value.clone();
    let map = claims_value
        .as_object()
        .ok_or_else(|| AppError::AuthError("JWT payload must be a JSON object".to_string()))?;

    let exp = extract_number(map, &["exp"])
        .ok_or_else(|| AppError::AuthError("JWT payload missing exp claim".to_string()))?;
    let iat = extract_number(map, &["iat"]).unwrap_or_else(|| exp.saturating_sub(60)); // fallback to exp-60s if not provided

    let sub = extract_string(map, &["sub", "id", "user_id", "username"])
        .ok_or_else(|| AppError::AuthError("JWT payload missing subject".to_string()))?;

    let user_id = extract_string(map, &["user_id", "id", "sub"]);
    let org_id = extract_string(
        map,
        &[
            "org_id",
            "organization_id",
            "organization",
            "org",
            "tenant_id",
        ],
    )
    .or_else(|| extract_nested_id(map, &["organization", "tenant", "org"]));

    let email = extract_string(map, &["email", "user_email"]);

    let mut permissions = collect_unique_strings(map.get("permissions"));
    if permissions.is_empty() {
        permissions = collect_unique_strings(map.get("scopes"));
    }
    if permissions.is_empty() {
        permissions = collect_unique_strings(map.get("policies"));
    }

    let mut roles = collect_unique_strings(map.get("roles"));
    if roles.is_empty() {
        roles = collect_unique_strings(map.get("role"));
    }

    Ok(AuthClaims {
        sub,
        exp,
        iat,
        user_id,
        org_id,
        email,
        permissions,
        roles,
        raw: Some(raw),
    })
}

fn extract_number(map: &Map<String, Value>, keys: &[&str]) -> Option<i64> {
    keys.iter()
        .filter_map(|key| map.get(*key))
        .find_map(|value| match value {
            Value::Number(num) => num.as_i64(),
            Value::String(s) => s.parse().ok(),
            Value::Array(items) => items.iter().find_map(|item| match item {
                Value::Number(num) => num.as_i64(),
                Value::String(s) => s.parse().ok(),
                _ => None,
            }),
            _ => None,
        })
}

fn extract_string(map: &Map<String, Value>, keys: &[&str]) -> Option<String> {
    keys.iter()
        .filter_map(|key| map.get(*key))
        .find_map(value_to_string)
}

fn extract_nested_id(map: &Map<String, Value>, keys: &[&str]) -> Option<String> {
    keys.iter()
        .filter_map(|key| map.get(*key))
        .find_map(|value| match value {
            Value::Object(obj) => obj
                .get("id")
                .and_then(value_to_string)
                .or_else(|| obj.get("uid").and_then(value_to_string))
                .or_else(|| obj.get("code").and_then(value_to_string)),
            Value::Array(items) => items
                .iter()
                .filter_map(|item| match item {
                    Value::Object(obj) => obj
                        .get("id")
                        .and_then(value_to_string)
                        .or_else(|| obj.get("uid").and_then(value_to_string)),
                    _ => None,
                })
                .next(),
            _ => None,
        })
}

fn value_to_string(value: &Value) -> Option<String> {
    match value {
        Value::String(s) => Some(s.clone()),
        Value::Number(num) => Some(num.to_string()),
        Value::Bool(b) => Some(b.to_string()),
        Value::Object(obj) => obj
            .get("id")
            .and_then(value_to_string)
            .or_else(|| obj.get("name").and_then(value_to_string))
            .or_else(|| obj.get("code").and_then(value_to_string)),
        Value::Array(items) => items.iter().find_map(value_to_string),
        _ => None,
    }
}

fn collect_unique_strings(value: Option<&Value>) -> Vec<String> {
    let mut set = HashSet::new();

    if let Some(value) = value {
        match value {
            Value::String(s) => {
                set.insert(s.clone());
            }
            Value::Array(items) => {
                for item in items {
                    if let Some(text) = value_to_string(item) {
                        set.insert(text);
                    }
                }
            }
            Value::Object(obj) => {
                if let Some(text) = obj.get("name").and_then(value_to_string) {
                    set.insert(text);
                }
                if let Some(text) = obj.get("code").and_then(value_to_string) {
                    set.insert(text);
                }
                if let Some(text) = obj.get("id").and_then(value_to_string) {
                    set.insert(text);
                }
            }
            _ => {}
        }
    }

    set.into_iter().collect()
}
