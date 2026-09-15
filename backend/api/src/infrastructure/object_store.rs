//! S3-compatible object storage adapter.
//!
//! Export artifacts are written only after their contents have been generated and
//! hashed. This adapter deliberately implements the small [ObjectStore] contract
//! used by the export worker rather than exposing provider-specific SDK types to the
//! service layer. It uses SigV4 directly so the same code works with AWS S3 and
//! compatible stores such as MinIO without adding a second async runtime or a
//! provider SDK to every server binary.

use anyhow::Context;
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use reqwest::{header::HeaderValue, redirect::Policy, Client, Method, Url};
use ring::hmac;
use sha2::{Digest, Sha256};
use std::{collections::BTreeMap, time::Duration};

use crate::infrastructure::contracts::{InfrastructureError, InfrastructureResult, ObjectStore};

const AWS_ALGORITHM: &str = "AWS4-HMAC-SHA256";
const AWS_REQUEST: &str = "aws4_request";
const SERVICE: &str = "s3";
const MAX_PRESIGNED_URL_SECONDS: u64 = 7 * 24 * 60 * 60;

#[derive(Clone)]
pub struct S3ObjectStoreConfig {
    pub endpoint: Url,
    pub bucket: String,
    pub region: String,
    pub access_key_id: String,
    pub secret_access_key: String,
    pub session_token: Option<String>,
    pub path_style: bool,
    pub allow_http: bool,
}

impl S3ObjectStoreConfig {
    /// Read the production adapter's configuration. With no endpoint configured,
    /// the adapter is absent; a partially configured adapter is an error rather
    /// than an accidental fallback to local disk or an unauthenticated store.
    pub fn from_env() -> anyhow::Result<Option<Self>> {
        let endpoint = match std::env::var("ATOAXIS_OBJECT_STORE_S3_ENDPOINT") {
            Ok(value) if !value.trim().is_empty() => value,
            _ if object_store_env_is_configured() => {
                anyhow::bail!(
                    "S3 object-store configuration is partial; endpoint, bucket and credentials are required"
                )
            }
            _ => return Ok(None),
        };

        let bucket = required_env("ATOAXIS_OBJECT_STORE_S3_BUCKET")?;
        let region = required_env_or("ATOAXIS_OBJECT_STORE_S3_REGION", "us-east-1")?;
        let access_key_id = required_env("ATOAXIS_OBJECT_STORE_S3_ACCESS_KEY")?;
        let secret_access_key = required_env("ATOAXIS_OBJECT_STORE_S3_SECRET_KEY")?;
        let session_token = optional_env("ATOAXIS_OBJECT_STORE_S3_SESSION_TOKEN");
        let path_style = parse_bool_env("ATOAXIS_OBJECT_STORE_S3_PATH_STYLE", true)?;
        let allow_http = parse_bool_env("ATOAXIS_OBJECT_STORE_ALLOW_HTTP", false)?;
        let endpoint = Url::parse(endpoint.trim()).context("invalid S3 object-store endpoint")?;

        validate_endpoint(&endpoint, allow_http)?;
        validate_bucket(&bucket)?;
        validate_region(&region)?;
        validate_credential_component("ATOAXIS_OBJECT_STORE_S3_ACCESS_KEY", &access_key_id)?;
        validate_credential_component("ATOAXIS_OBJECT_STORE_S3_SECRET_KEY", &secret_access_key)?;
        if let Some(token) = &session_token {
            validate_credential_component("ATOAXIS_OBJECT_STORE_S3_SESSION_TOKEN", token)?;
        }

        Ok(Some(Self {
            endpoint,
            bucket,
            region,
            access_key_id,
            secret_access_key,
            session_token,
            path_style,
            allow_http,
        }))
    }
}

pub struct S3ObjectStore {
    client: Client,
    config: S3ObjectStoreConfig,
}

impl S3ObjectStore {
    pub fn new(config: S3ObjectStoreConfig) -> anyhow::Result<Self> {
        validate_endpoint(&config.endpoint, config.allow_http)?;
        validate_bucket(&config.bucket)?;
        validate_region(&config.region)?;
        if config.access_key_id.trim().is_empty() || config.secret_access_key.is_empty() {
            anyhow::bail!("S3 credentials must not be empty");
        }
        validate_credential_component("S3 access key", &config.access_key_id)?;
        validate_credential_component("S3 secret key", &config.secret_access_key)?;
        if let Some(token) = &config.session_token {
            validate_credential_component("S3 session token", token)?;
        }
        Ok(Self {
            client: Client::builder()
                .redirect(Policy::none())
                .connect_timeout(Duration::from_secs(10))
                .timeout(Duration::from_secs(120))
                .build()
                .context("build S3 object-store HTTP client")?,
            config,
        })
    }

    pub fn from_env() -> anyhow::Result<Option<Self>> {
        S3ObjectStoreConfig::from_env()?.map(Self::new).transpose()
    }

    async fn send_signed(
        &self,
        method: Method,
        key: &str,
        body: Vec<u8>,
        content_type: Option<&str>,
    ) -> InfrastructureResult<()> {
        validate_object_key(key)?;
        let url = self.object_url(key)?;
        let now = Utc::now();
        let payload_hash = sha256_hex(&body);
        let signed = signed_headers(
            &method,
            &url,
            &self.config,
            now,
            &payload_hash,
            content_type,
        )?;

        let mut request = self.client.request(method, url);
        request = request
            .header("host", header_value(&signed.host)?)
            .header("x-amz-date", header_value(&signed.amz_date)?)
            .header("x-amz-content-sha256", header_value(&payload_hash)?)
            .header(
                "authorization",
                sensitive_header_value(&signed.authorization)?,
            );
        if let Some(token) = &self.config.session_token {
            request = request.header(
                "x-amz-security-token",
                sensitive_header_value(&normalize_header_value(token))?,
            );
        }
        if let Some(content_type) = content_type {
            request = request.header(
                "content-type",
                header_value(&normalize_header_value(content_type))?,
            );
        }

        let response = request
            .body(body)
            .send()
            .await
            .map_err(|error| unavailable(format!("object-store request failed: {error}")))?;
        if !response.status().is_success() {
            return Err(unavailable(format!(
                "object-store request returned HTTP {}",
                response.status().as_u16()
            )));
        }
        Ok(())
    }

    fn object_url(&self, key: &str) -> InfrastructureResult<Url> {
        validate_object_key(key)?;
        let mut url = self.config.endpoint.clone();
        let endpoint_path = url.path().trim_end_matches('/');
        let path = if self.config.path_style {
            format!("{endpoint_path}/{}/{}", self.config.bucket, key)
        } else {
            format!("{endpoint_path}/{key}")
        };
        url.set_path(&path);

        if !self.config.path_style {
            let host = url
                .host_str()
                .ok_or_else(|| invalid("object-store endpoint has no host"))?;
            let virtual_host = format!("{}.{host}", self.config.bucket);
            url.set_host(Some(&virtual_host))
                .map_err(|_| invalid("invalid virtual-hosted S3 bucket name"))?;
        }
        Ok(url)
    }

    fn presigned_get_url(&self, key: &str, ttl: Duration) -> InfrastructureResult<String> {
        validate_object_key(key)?;
        let seconds = ttl.as_secs();
        if seconds == 0 || seconds > MAX_PRESIGNED_URL_SECONDS {
            return Err(invalid(format!(
                "signed URL TTL must be 1-{MAX_PRESIGNED_URL_SECONDS} seconds"
            )));
        }
        let url = self.object_url(key)?;
        let now = Utc::now();
        let amz_date = format_amz_date(now);
        let date = format_date(now);
        let scope = format!("{date}/{}/{SERVICE}/{AWS_REQUEST}", self.config.region);
        let host = host_header(&url)?;
        let credential = format!("{}/{scope}", self.config.access_key_id);

        let mut query = BTreeMap::from([
            ("X-Amz-Algorithm".to_string(), AWS_ALGORITHM.to_string()),
            ("X-Amz-Credential".to_string(), credential),
            ("X-Amz-Date".to_string(), amz_date.clone()),
            ("X-Amz-Expires".to_string(), seconds.to_string()),
            ("X-Amz-SignedHeaders".to_string(), "host".to_string()),
        ]);
        if let Some(token) = &self.config.session_token {
            query.insert(
                "X-Amz-Security-Token".to_string(),
                normalize_header_value(token),
            );
        }
        let canonical_query_string = canonical_query(&query);
        let canonical_request = format!(
            "GET\n{}\n{}\nhost:{}\n\nhost\nUNSIGNED-PAYLOAD",
            canonical_uri(url.path()),
            canonical_query_string,
            host
        );
        let string_to_sign = string_to_sign(&amz_date, &scope, &canonical_request);
        let signature = signing_key(&self.config.secret_access_key, &date, &self.config.region)
            .map(|key| hex_encode(&hmac_sha256(&key, string_to_sign.as_bytes())))?;
        query.insert("X-Amz-Signature".to_string(), signature);
        let query_string = canonical_query(&query);

        let mut signed_url = url;
        signed_url.set_query(Some(&query_string));
        Ok(signed_url.to_string())
    }
}

#[async_trait]
impl ObjectStore for S3ObjectStore {
    async fn put(
        &self,
        key: &str,
        content: Vec<u8>,
        content_type: &str,
    ) -> InfrastructureResult<()> {
        if content_type.trim().is_empty() || content_type.len() > 256 {
            return Err(invalid("object content type must contain 1-256 characters"));
        }
        self.send_signed(Method::PUT, key, content, Some(content_type))
            .await
    }

    async fn signed_get_url(&self, key: &str, ttl: Duration) -> InfrastructureResult<String> {
        self.presigned_get_url(key, ttl)
    }

    async fn delete(&self, key: &str) -> InfrastructureResult<()> {
        self.send_signed(Method::DELETE, key, Vec::new(), None)
            .await
    }
}

struct SignedHeaders {
    host: String,
    amz_date: String,
    authorization: String,
}

fn signed_headers(
    method: &Method,
    url: &Url,
    config: &S3ObjectStoreConfig,
    now: DateTime<Utc>,
    payload_hash: &str,
    content_type: Option<&str>,
) -> InfrastructureResult<SignedHeaders> {
    let amz_date = format_amz_date(now);
    let date = format_date(now);
    let scope = format!("{date}/{}/{SERVICE}/{AWS_REQUEST}", config.region);
    let host = host_header(url)?;

    let mut headers = BTreeMap::from([
        ("host".to_string(), host.clone()),
        ("x-amz-content-sha256".to_string(), payload_hash.to_string()),
        ("x-amz-date".to_string(), amz_date.clone()),
    ]);
    if let Some(content_type) = content_type {
        headers.insert(
            "content-type".to_string(),
            normalize_header_value(content_type),
        );
    }
    if let Some(token) = &config.session_token {
        headers.insert(
            "x-amz-security-token".to_string(),
            normalize_header_value(token),
        );
    }
    let canonical_headers = headers
        .iter()
        .map(|(name, value)| format!("{name}:{value}\n"))
        .collect::<String>();
    let signed_header_names = headers.keys().cloned().collect::<Vec<_>>().join(";");
    let canonical_request = format!(
        "{}\n{}\n\n{}\n{}\n{}",
        method.as_str(),
        canonical_uri(url.path()),
        canonical_headers,
        signed_header_names,
        payload_hash
    );
    let string_to_sign = string_to_sign(&amz_date, &scope, &canonical_request);
    let key = signing_key(&config.secret_access_key, &date, &config.region)?;
    let signature = hex_encode(&hmac_sha256(&key, string_to_sign.as_bytes()));
    let authorization = format!(
        "{AWS_ALGORITHM} Credential={}/{scope}, SignedHeaders={signed_header_names}, Signature={signature}",
        config.access_key_id
    );
    Ok(SignedHeaders {
        host,
        amz_date,
        authorization,
    })
}

fn signing_key(secret: &str, date: &str, region: &str) -> InfrastructureResult<Vec<u8>> {
    if secret.is_empty() || date.len() != 8 || region.is_empty() {
        return Err(invalid("invalid S3 signing configuration"));
    }
    let date_key = hmac_sha256(format!("AWS4{secret}").as_bytes(), date.as_bytes());
    let region_key = hmac_sha256(&date_key, region.as_bytes());
    let service_key = hmac_sha256(&region_key, SERVICE.as_bytes());
    Ok(hmac_sha256(&service_key, AWS_REQUEST.as_bytes()))
}

fn string_to_sign(amz_date: &str, scope: &str, canonical_request: &str) -> String {
    format!(
        "{AWS_ALGORITHM}\n{amz_date}\n{scope}\n{}",
        sha256_hex(canonical_request.as_bytes())
    )
}

fn hmac_sha256(key: &[u8], value: &[u8]) -> Vec<u8> {
    let key = hmac::Key::new(hmac::HMAC_SHA256, key);
    hmac::sign(&key, value).as_ref().to_vec()
}

fn sha256_hex(value: &[u8]) -> String {
    hex_encode(&Sha256::digest(value))
}

fn hex_encode(value: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut output = String::with_capacity(value.len() * 2);
    for byte in value {
        output.push(HEX[(byte >> 4) as usize] as char);
        output.push(HEX[(byte & 0x0f) as usize] as char);
    }
    output
}

fn canonical_query(query: &BTreeMap<String, String>) -> String {
    query
        .iter()
        .map(|(name, value)| {
            format!(
                "{}={}",
                aws_percent_encode(name.as_bytes()),
                aws_percent_encode(value.as_bytes())
            )
        })
        .collect::<Vec<_>>()
        .join("&")
}

fn canonical_uri(path: &str) -> String {
    let encoded = aws_percent_encode_path(path.as_bytes());
    if encoded.starts_with('/') {
        encoded
    } else {
        format!("/{encoded}")
    }
}

fn aws_percent_encode_path(value: &[u8]) -> String {
    value
        .iter()
        .map(|byte| {
            if *byte == b'/' || is_unreserved(*byte) {
                (*byte as char).to_string()
            } else {
                format!("%{byte:02X}")
            }
        })
        .collect()
}

fn aws_percent_encode(value: &[u8]) -> String {
    value
        .iter()
        .map(|byte| {
            if is_unreserved(*byte) {
                (*byte as char).to_string()
            } else {
                format!("%{byte:02X}")
            }
        })
        .collect()
}

const fn is_unreserved(byte: u8) -> bool {
    matches!(byte, b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~')
}

fn host_header(url: &Url) -> InfrastructureResult<String> {
    let host = url
        .host_str()
        .ok_or_else(|| invalid("object-store endpoint has no host"))?;
    Ok(match url.port() {
        Some(port) => format!("{host}:{port}"),
        None => host.to_string(),
    })
}

fn validate_endpoint(endpoint: &Url, allow_http: bool) -> anyhow::Result<()> {
    if endpoint.host_str().is_none()
        || !endpoint.username().is_empty()
        || endpoint.password().is_some()
        || endpoint.query().is_some()
        || endpoint.fragment().is_some()
    {
        anyhow::bail!("S3 endpoint must contain a host and no query or fragment");
    }
    if !endpoint
        .path()
        .bytes()
        .all(|byte| byte == b'/' || is_unreserved(byte))
    {
        anyhow::bail!("S3 endpoint path may contain only unreserved characters and slash");
    }
    match endpoint.scheme() {
        "https" => Ok(()),
        "http" if allow_http => Ok(()),
        "http" => anyhow::bail!(
            "HTTP object-store endpoints are disabled; set ATOAXIS_OBJECT_STORE_ALLOW_HTTP=true for local development"
        ),
        _ => anyhow::bail!("S3 endpoint scheme must be https"),
    }
}

fn validate_bucket(bucket: &str) -> anyhow::Result<()> {
    if bucket.is_empty()
        || bucket.len() > 63
        || !bucket.bytes().all(|byte| {
            byte.is_ascii_lowercase() || byte.is_ascii_digit() || matches!(byte, b'.' | b'-')
        })
        || bucket.starts_with('.')
        || bucket.ends_with('.')
        || bucket.starts_with('-')
        || bucket.ends_with('-')
    {
        anyhow::bail!("S3 bucket must be a valid lowercase bucket name");
    }
    Ok(())
}

fn validate_region(region: &str) -> anyhow::Result<()> {
    if region.is_empty()
        || region.len() > 128
        || !region
            .bytes()
            .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-')
    {
        anyhow::bail!("S3 region must contain only lowercase letters, digits and hyphens");
    }
    Ok(())
}

fn validate_credential_component(name: &str, value: &str) -> anyhow::Result<()> {
    if value.is_empty()
        || value
            .bytes()
            .any(|byte| byte.is_ascii_control() || byte.is_ascii_whitespace())
    {
        anyhow::bail!("{name} contains invalid whitespace or control characters");
    }
    Ok(())
}

fn validate_object_key(key: &str) -> InfrastructureResult<()> {
    if key.is_empty() || key.len() > 1024 || key.starts_with('/') || key.contains("//") {
        return Err(invalid("object key must be a relative non-empty path"));
    }
    if key
        .split('/')
        .any(|part| part.is_empty() || part == "." || part == "..")
    {
        return Err(invalid("object key contains an unsafe path segment"));
    }
    if !key
        .bytes()
        .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.' | b'/'))
    {
        return Err(invalid("object key contains an unsupported character"));
    }
    Ok(())
}

fn normalize_header_value(value: &str) -> String {
    value.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn header_value(value: &str) -> InfrastructureResult<HeaderValue> {
    HeaderValue::from_str(value).map_err(|_| invalid("invalid object-store header value"))
}

fn sensitive_header_value(value: &str) -> InfrastructureResult<HeaderValue> {
    let mut header = header_value(value)?;
    header.set_sensitive(true);
    Ok(header)
}

fn format_amz_date(value: DateTime<Utc>) -> String {
    value.format("%Y%m%dT%H%M%SZ").to_string()
}

fn format_date(value: DateTime<Utc>) -> String {
    value.format("%Y%m%d").to_string()
}

fn required_env(name: &str) -> anyhow::Result<String> {
    let value = std::env::var(name).with_context(|| format!("{name} is required"))?;
    if value.trim().is_empty() {
        anyhow::bail!("{name} must not be empty");
    }
    Ok(value)
}

fn required_env_or(name: &str, default: &str) -> anyhow::Result<String> {
    Ok(std::env::var(name)
        .ok()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| default.to_string()))
}

fn optional_env(name: &str) -> Option<String> {
    std::env::var(name)
        .ok()
        .filter(|value| !value.trim().is_empty())
}

fn parse_bool_env(name: &str, default: bool) -> anyhow::Result<bool> {
    match std::env::var(name) {
        Ok(value) if value.eq_ignore_ascii_case("true") || value == "1" => Ok(true),
        Ok(value) if value.eq_ignore_ascii_case("false") || value == "0" => Ok(false),
        Ok(_) => anyhow::bail!("{name} must be true or false"),
        Err(_) => Ok(default),
    }
}

fn object_store_env_is_configured() -> bool {
    [
        "ATOAXIS_OBJECT_STORE_S3_ENDPOINT",
        "ATOAXIS_OBJECT_STORE_S3_BUCKET",
        "ATOAXIS_OBJECT_STORE_S3_REGION",
        "ATOAXIS_OBJECT_STORE_S3_ACCESS_KEY",
        "ATOAXIS_OBJECT_STORE_S3_SECRET_KEY",
        "ATOAXIS_OBJECT_STORE_S3_SESSION_TOKEN",
        "ATOAXIS_OBJECT_STORE_S3_PATH_STYLE",
        "ATOAXIS_OBJECT_STORE_ALLOW_HTTP",
    ]
    .into_iter()
    .any(|name| std::env::var_os(name).is_some())
}

fn invalid(message: impl Into<String>) -> InfrastructureError {
    InfrastructureError::InvalidEnvelope(message.into())
}

fn unavailable(message: impl Into<String>) -> InfrastructureError {
    InfrastructureError::Unavailable(message.into())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn config(path_style: bool) -> S3ObjectStoreConfig {
        S3ObjectStoreConfig {
            endpoint: Url::parse("https://s3.example.test/base").unwrap(),
            bucket: "wakaclock-artifacts".to_string(),
            region: "us-east-1".to_string(),
            access_key_id: "AKIDEXAMPLE".to_string(),
            secret_access_key: "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY".to_string(),
            session_token: None,
            path_style,
            allow_http: false,
        }
    }

    #[test]
    fn object_keys_are_relative_and_safe() {
        assert!(validate_object_key("exports/01HXYZ/file.json").is_ok());
        assert!(validate_object_key("/exports/file.json").is_err());
        assert!(validate_object_key("exports/../file.json").is_err());
        assert!(validate_object_key("exports/file name.json").is_err());
    }

    #[test]
    fn endpoint_rejects_plain_http_by_default() {
        let endpoint = Url::parse("http://minio:9000").unwrap();
        assert!(validate_endpoint(&endpoint, false).is_err());
        assert!(validate_endpoint(&endpoint, true).is_ok());
    }

    #[test]
    fn endpoint_rejects_userinfo_and_encoded_prefixes() {
        let with_user = Url::parse("https://user:password@s3.example.test").unwrap();
        assert!(validate_endpoint(&with_user, false).is_err());
        let encoded_prefix = Url::parse("https://s3.example.test/s3%20root").unwrap();
        assert!(validate_endpoint(&encoded_prefix, false).is_err());
    }

    #[test]
    fn path_style_url_contains_bucket_and_preserves_prefix() {
        let store = S3ObjectStore::new(config(true)).unwrap();
        let url = store.object_url("exports/file.json").unwrap();
        assert_eq!(
            url.as_str(),
            "https://s3.example.test/base/wakaclock-artifacts/exports/file.json"
        );
    }

    #[test]
    fn virtual_host_url_contains_bucket_in_host() {
        let store = S3ObjectStore::new(config(false)).unwrap();
        let url = store.object_url("exports/file.json").unwrap();
        assert_eq!(
            url.as_str(),
            "https://wakaclock-artifacts.s3.example.test/base/exports/file.json"
        );
    }

    #[test]
    fn canonical_query_sorts_and_encodes_sigv4_parameters() {
        let query = BTreeMap::from([
            ("X-Amz-Date".to_string(), "20260915T010203Z".to_string()),
            (
                "X-Amz-Credential".to_string(),
                "AKID/20260915/us-east-1/s3/aws4_request".to_string(),
            ),
            ("X-Amz-Expires".to_string(), "60".to_string()),
        ]);
        assert_eq!(
            canonical_query(&query),
            "X-Amz-Credential=AKID%2F20260915%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20260915T010203Z&X-Amz-Expires=60"
        );
    }

    #[test]
    fn signed_url_has_bounded_expiry_and_signature() {
        let store = S3ObjectStore::new(config(true)).unwrap();
        let url = store
            .presigned_get_url("exports/file.json", Duration::from_secs(60))
            .unwrap();
        assert!(url.contains("X-Amz-Algorithm=AWS4-HMAC-SHA256"));
        assert!(url.contains("X-Amz-SignedHeaders=host"));
        assert!(url.contains("X-Amz-Signature="));
        assert!(store
            .presigned_get_url("exports/file.json", Duration::from_secs(604_801))
            .is_err());
    }

    #[test]
    fn signing_uses_the_http_method_and_empty_delete_payload_hash() {
        let config = config(true);
        let url = Url::parse("https://s3.example.test/base/wakaclock-artifacts/file.json").unwrap();
        let timestamp = chrono::DateTime::parse_from_rfc3339("2026-09-15T01:02:03Z")
            .unwrap()
            .with_timezone(&Utc);
        let put = signed_headers(
            &Method::PUT,
            &url,
            &config,
            timestamp,
            &sha256_hex(b"payload"),
            Some("text/plain"),
        )
        .unwrap();
        let delete = signed_headers(
            &Method::DELETE,
            &url,
            &config,
            timestamp,
            &sha256_hex(&[]),
            None,
        )
        .unwrap();
        assert_ne!(put.authorization, delete.authorization);
        assert!(delete
            .authorization
            .contains("SignedHeaders=host;x-amz-content-sha256;x-amz-date"));
        assert_eq!(
            sha256_hex(&[]),
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        );
    }
}
