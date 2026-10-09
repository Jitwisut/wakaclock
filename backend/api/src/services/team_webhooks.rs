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
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub details: Option<GithubDetails>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Default)]
#[serde(deny_unknown_fields)]
pub struct GithubDetails {
    pub revoked_user_id: Option<i64>,
    pub removed_repository_ids: Vec<i64>,
    pub head_sha: Option<String>,
    pub head_repository_id: Option<i64>,
    pub draft: Option<bool>,
    pub review: Option<ReviewMetadata>,
    pub check: Option<CheckMetadata>,
}
#[derive(Debug, Serialize, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct ReviewMetadata {
    pub id: i64,
    pub author_id: i64,
    pub author_type: String,
    pub state: String,
    pub submitted_at: DateTime<Utc>,
}
#[derive(Debug, Serialize, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct CheckMetadata {
    pub kind: String,
    pub id: String,
    pub head_sha: String,
    pub status: String,
    pub conclusion: Option<String>,
    pub at: Option<DateTime<Utc>>,
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
        "pull_request"
            | "issues"
            | "pull_request_review"
            | "installation"
            | "installation_repositories"
            | "github_app_authorization"
            | "check_run"
            | "check_suite"
            | "status"
            | "repository"
    ) {
        return Ok(None);
    }
    let action = raw["action"]
        .as_str()
        .or_else(|| (event == "status").then_some("updated"))
        .context("missing action")?;
    // Unknown actions are not acknowledged as accepted work.
    if !matches!(
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
            | "added"
            | "removed"
            | "revoked"
            | "completed"
            | "requested"
            | "rerequested"
            | "queued"
            | "in_progress"
            | "updated"
            | "renamed"
            | "transferred"
            | "archived"
            | "unarchived"
            | "review_requested"
            | "review_request_removed"
            | "labeled"
            | "unlabeled"
            | "assigned"
            | "unassigned"
            | "locked"
            | "unlocked"
            | "milestoned"
            | "demilestoned"
    ) {
        return Ok(None);
    }
    let installation_id = raw["installation"]["id"]
        .as_i64()
        .filter(|v| *v > 0)
        .or_else(|| (event == "github_app_authorization").then_some(0))
        .context("missing installation identity")?;
    let repository_id = raw["repository"]["id"].as_i64().filter(|v| *v > 0);
    let item = if !matches!(event, "pull_request" | "issues" | "pull_request_review") {
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
    let mut details = GithubDetails::default();
    if event == "github_app_authorization" {
        details.revoked_user_id = raw["sender"]["id"].as_i64();
    }
    if event == "installation_repositories" {
        details.removed_repository_ids = raw["repositories_removed"]
            .as_array()
            .map(|a| a.iter().filter_map(|r| r["id"].as_i64()).collect())
            .unwrap_or_default();
    }
    if matches!(event, "pull_request" | "pull_request_review") {
        details.head_sha = raw["pull_request"]["head"]["sha"]
            .as_str()
            .map(str::to_string);
        details.head_repository_id = raw["pull_request"]["head"]["repo"]["id"].as_i64();
        details.draft = raw["pull_request"]["draft"].as_bool();
    }
    if event == "pull_request_review" {
        let r = &raw["review"];
        details.review = Some(ReviewMetadata {
            id: r["id"].as_i64().context("review id missing")?,
            author_id: r["user"]["id"].as_i64().context("review author missing")?,
            author_type: r["user"]["type"].as_str().unwrap_or("unknown").into(),
            state: r["state"]
                .as_str()
                .context("review state missing")?
                .to_uppercase(),
            submitted_at: timestamp(r, "submitted_at")?,
        });
    }
    if matches!(event, "check_run" | "check_suite" | "status") {
        let c = if event == "status" { &raw } else { &raw[event] };
        let sha = c[if event == "status" { "sha" } else { "head_sha" }]
            .as_str()
            .context("check SHA missing")?;
        anyhow::ensure!(
            matches!(sha.len(), 40 | 64) && sha.bytes().all(|b| b.is_ascii_hexdigit()),
            "invalid check SHA"
        );
        let status = c[if event == "status" { "state" } else { "status" }]
            .as_str()
            .context("check state missing")?;
        let at = optional_timestamp(c, "completed_at")?
            .or(optional_timestamp(c, "started_at")?)
            .or(optional_timestamp(c, "updated_at")?)
            .or(optional_timestamp(c, "created_at")?);
        details.check = Some(CheckMetadata {
            kind: event.into(),
            id: if event == "status" {
                format!(
                    "{}:{}",
                    sha,
                    c["context"].as_str().context("status context missing")?
                )
            } else {
                c["id"].as_i64().context("check id missing")?.to_string()
            },
            head_sha: sha.into(),
            status: status.into(),
            conclusion: c["conclusion"].as_str().map(str::to_string),
            at,
        });
    }
    let review_at = if event == "pull_request_review"
        && action == "submitted"
        && details.review.as_ref().is_some_and(|r| {
            r.author_type == "User"
                && item
                    .as_ref()
                    .is_some_and(|i| i.author_id != Some(r.author_id))
        }) {
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
        details: Some(details),
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
