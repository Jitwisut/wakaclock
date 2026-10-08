//! Signatures are verified over raw bytes in memory; only this allowlist is persisted.
use anyhow::{Context, Result};
use chrono::{DateTime, Utc};
use ring::hmac;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};

#[derive(Debug, Serialize, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct GithubMetadata {
    pub event: String,
    pub action: String,
    pub installation_id: i64,
    pub repository_id: Option<i64>,
    pub item: Option<WorkItemMetadata>,
    pub review_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct WorkItemMetadata {
    pub external_id: i64,
    pub number: i32,
    pub kind: String,
    pub state: String,
    pub branch: Option<String>,
    pub author_id: Option<i64>,
    pub opened_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub ready_at: Option<DateTime<Utc>>,
    pub merged_at: Option<DateTime<Utc>>,
    pub closed_at: Option<DateTime<Utc>>,
}

pub fn payload_hash(body: &[u8]) -> String {
    format!("{:x}", Sha256::digest(body))
}

fn hex_digest(value: &str) -> Result<Vec<u8>> {
    anyhow::ensure!(
        value.len() == 64 && value.bytes().all(|b| b.is_ascii_hexdigit()),
        "invalid signature"
    );
    (0..64)
        .step_by(2)
        .map(|i| u8::from_str_radix(&value[i..i + 2], 16).context("invalid signature"))
        .collect()
}

pub fn verify_github(secret: &[u8], body: &[u8], signature: &str) -> Result<()> {
    anyhow::ensure!(!secret.is_empty(), "webhook secret not configured");
    let digest = hex_digest(
        signature
            .strip_prefix("sha256=")
            .context("invalid signature")?,
    )?;
    hmac::verify(&hmac::Key::new(hmac::HMAC_SHA256, secret), body, &digest)
        .map_err(|_| anyhow::anyhow!("invalid signature"))
}

/// Stripe signs `timestamp.raw_body`. A five-minute tolerance prevents replay of
/// an intercepted request; durable event IDs handle legitimate provider retries.
pub fn verify_stripe(secret: &[u8], body: &[u8], signature: &str, now: i64) -> Result<()> {
    anyhow::ensure!(!secret.is_empty(), "webhook secret not configured");
    let parts: Vec<_> = signature.split(',').collect();
    let times: Vec<_> = parts.iter().filter_map(|p| p.strip_prefix("t=")).collect();
    anyhow::ensure!(times.len() == 1, "invalid signature timestamp");
    let time: i64 = times[0].parse().context("invalid signature timestamp")?;
    anyhow::ensure!(now.abs_diff(time) <= 300, "expired webhook signature");
    let mut signed = format!("{time}.").into_bytes();
    signed.extend_from_slice(body);
    let key = hmac::Key::new(hmac::HMAC_SHA256, secret);
    anyhow::ensure!(
        parts
            .iter()
            .filter_map(|p| p.strip_prefix("v1="))
            .any(|sig| hex_digest(sig)
                .is_ok_and(|digest| hmac::verify(&key, &signed, &digest).is_ok())),
        "invalid signature"
    );
    Ok(())
}

fn timestamp(value: &Value, key: &str) -> Result<DateTime<Utc>> {
    value
        .get(key)
        .and_then(Value::as_str)
        .context("missing metadata timestamp")?
        .parse()
        .context("invalid metadata timestamp")
}

fn optional_timestamp(value: &Value, key: &str) -> Result<Option<DateTime<Utc>>> {
    if value.get(key).is_none_or(Value::is_null) {
        return Ok(None);
    }
    timestamp(value, key).map(Some)
}

pub fn github_metadata(event: &str, body: &[u8]) -> Result<Option<GithubMetadata>> {
    anyhow::ensure!(body.len() <= 2_000_000, "webhook too large");
    let raw: Value = serde_json::from_slice(body).context("invalid webhook JSON")?;
    if event == "ping" {
        return Ok(None);
    }
    if !matches!(
        event,
        "pull_request" | "issues" | "pull_request_review" | "installation"
    ) {
        return Ok(None);
    }
    let action = raw["action"].as_str().context("missing action")?;
    // Unknown actions are not acknowledged as accepted work.
    anyhow::ensure!(
        matches!(
            action,
            "opened"
                | "closed"
                | "reopened"
                | "edited"
                | "synchronize"
                | "ready_for_review"
                | "converted_to_draft"
                | "submitted"
                | "dismissed"
                | "deleted"
                | "suspend"
                | "unsuspend"
                | "created"
        ),
        "unsupported action"
    );
    let installation_id = raw["installation"]["id"]
        .as_i64()
        .filter(|v| *v > 0)
        .context("missing installation identity")?;
    let repository_id = raw["repository"]["id"].as_i64().filter(|v| *v > 0);
    let item = if event == "installation" {
        None
    } else {
        let is_pr = event != "issues";
        let value = &raw[if is_pr { "pull_request" } else { "issue" }];
        // Issues API events for pull requests do not create a second work item.
        if !is_pr && !value["pull_request"].is_null() {
            return Ok(None);
        }
        let merged_at = optional_timestamp(value, "merged_at")?;
        let state = if merged_at.is_some() {
            "merged"
        } else {
            value["state"].as_str().context("missing state")?
        };
        anyhow::ensure!(
            matches!(state, "open" | "closed" | "merged"),
            "invalid state"
        );
        let opened_at = timestamp(value, "created_at")?;
        let updated_at = timestamp(value, "updated_at")?;
        let ready_at = if is_pr && action == "ready_for_review" {
            Some(updated_at)
        } else if is_pr && action == "opened" && value["draft"].as_bool() == Some(false) {
            Some(opened_at)
        } else {
            None
        };
        let branch = value["head"]["ref"]
            .as_str()
            .filter(|s| s.len() <= 256 && !s.chars().any(char::is_control))
            .map(str::to_owned);
        Some(WorkItemMetadata {
            external_id: value["id"]
                .as_i64()
                .filter(|v| *v > 0)
                .context("missing item identity")?,
            number: value["number"]
                .as_i64()
                .and_then(|v| i32::try_from(v).ok())
                .filter(|v| *v > 0)
                .context("missing item number")?,
            kind: if is_pr { "pull_request" } else { "issue" }.into(),
            state: state.into(),
            branch,
            author_id: value["user"]["id"].as_i64(),
            opened_at,
            updated_at,
            ready_at,
            merged_at,
            closed_at: optional_timestamp(value, "closed_at")?,
        })
    };
    let review_at = if event == "pull_request_review" && action == "submitted" {
        Some(timestamp(&raw["review"], "submitted_at")?)
    } else {
        None
    };
    Ok(Some(GithubMetadata {
        event: event.into(),
        action: action.into(),
        installation_id,
        repository_id,
        item,
        review_at,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn github_official_signature_vector_and_tamper() {
        let secret = b"It's a Secret to Everybody";
        let sig = "sha256=757107ea0eb2509fc211221cce984b8a37570b6d7586c22c46f4379c8b043e17";
        assert!(verify_github(secret, b"Hello, World!", sig).is_ok());
        assert!(verify_github(secret, b"Hello, World?", sig).is_err());
        assert!(verify_github(secret, b"x", "sha256=zz").is_err());
    }
    #[test]
    fn stripe_rotation_and_replay_tolerance() {
        let key = hmac::Key::new(hmac::HMAC_SHA256, b"test-secret");
        let bytes = hmac::sign(&key, b"1000.{}");
        let digest: String = bytes.as_ref().iter().map(|b| format!("{b:02x}")).collect();
        let header = format!("t=1000,v1={},v1={digest}", "0".repeat(64));
        assert!(verify_stripe(b"test-secret", b"{}", &header, 1001).is_ok());
        assert!(verify_stripe(b"test-secret", b"{}", &header, 1301).is_err());
        assert!(verify_stripe(b"test-secret", b"{x}", &header, 1001).is_err());
    }
    #[test]
    fn allowlist_discards_body_source_and_credentials() {
        let raw = serde_json::json!({"action":"opened", "installation":{"id":1}, "repository":{"id":2,"token":"secret"},
            "pull_request":{"id":3,"number":7,"state":"open","draft":false,"created_at":"2026-10-08T00:00:00Z",
                "updated_at":"2026-10-08T00:00:00Z","body":"private-prompt","diff":"source-text","title":"private-title",
                "head":{"ref":"feature/task"},"user":{"id":4}}});
        let metadata = github_metadata("pull_request", &serde_json::to_vec(&raw).unwrap())
            .unwrap()
            .unwrap();
        let serialized = serde_json::to_string(&metadata).unwrap();
        for value in ["secret", "private-prompt", "source-text", "private-title"] {
            assert!(!serialized.contains(value));
        }
        assert_eq!(metadata.item.unwrap().state, "open");
    }
}
