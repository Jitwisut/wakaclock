//! Provider daily counters remain separate from activity, tokens and PR cost.
use crate::{
    infrastructure::github::{GithubClient, GithubConfig, GithubFailure},
    repository::copilot_daily::{CopilotDailyRepository, DailyJob},
};
use anyhow::{ensure, Context, Result};
use chrono::NaiveDate;
use reqwest::Method;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{collections::BTreeMap, sync::Arc, time::Duration};

pub fn enabled() -> bool {
    crate::config::opt_in_env_flag("ATOAXIS_COPILOT_DAILY_ENABLED")
}
pub const COUNTERS: &[&str] = &[
    "code_generation_activity_count",
    "code_acceptance_activity_count",
    "loc_suggested_to_add_sum",
    "loc_suggested_to_delete_sum",
    "loc_added_sum",
    "loc_deleted_sum",
    "user_initiated_interaction_count",
];
#[derive(Clone, Serialize, Deserialize)]
pub struct DailyFact {
    pub github_user_id: i64,
    pub feature: String,
    pub metrics: BTreeMap<String, Option<i64>>,
}
impl DailyFact {
    pub fn hash(&self) -> String {
        format!(
            "{:x}",
            Sha256::digest(serde_json::to_vec(self).expect("scalar metadata"))
        )
    }
}
pub fn normalize(row: &Value, day: NaiveDate, account: i64) -> Result<Vec<DailyFact>> {
    let number = |key: &str| {
        row[key]
            .as_i64()
            .or_else(|| row[key].as_str().and_then(|s| s.parse().ok()))
    };
    ensure!(
        row["day"].as_str() == Some(day.to_string().as_str())
            && number("organization_id") == Some(account),
        "copilot_daily_scope_mismatch"
    );
    let user = number("user_id")
        .filter(|id| *id > 0)
        .context("copilot_daily_identity_unavailable")?;
    let features = row["totals_by_feature"]
        .as_array()
        .context("copilot_daily_schema_unknown")?;
    ensure!(features.len() <= 64, "copilot_daily_limit");
    let mut result = Vec::new();
    let mut seen = std::collections::BTreeSet::new();
    for feature in features {
        let name = feature["feature"]
            .as_str()
            .filter(|s| {
                !s.is_empty()
                    && s.len() <= 64
                    && s.bytes()
                        .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
            })
            .context("copilot_daily_feature_invalid")?;
        ensure!(seen.insert(name), "copilot_daily_duplicate_dimension");
        let mut metrics = BTreeMap::new();
        for key in COUNTERS {
            let value = feature.get(*key);
            let count = match value {
                None | Some(Value::Null) => None,
                Some(value) => Some(
                    value
                        .as_i64()
                        .filter(|n| *n >= 0)
                        .context("copilot_daily_counter_invalid")?,
                ),
            };
            metrics.insert((*key).into(), count);
        }
        result.push(DailyFact {
            github_user_id: user,
            feature: name.into(),
            metrics,
        });
    }
    Ok(result)
}
// Signed download URLs are provider credentials: never persist, log, attach
// API Authorization, or follow redirects. Resolve and pin only public addresses.
fn public_address(ip: std::net::IpAddr) -> bool {
    match ip {
        std::net::IpAddr::V4(v) => {
            !v.is_private()
                && !v.is_loopback()
                && !v.is_link_local()
                && !v.is_broadcast()
                && !v.is_documentation()
                && !v.is_unspecified()
                && !v.is_multicast()
                && v.octets()[0] != 0
                && v.octets()[0] < 224
                && !(v.octets()[0] == 192 && v.octets()[1] == 0 && v.octets()[2] == 0)
                && !(v.octets()[0] == 198 && (18..=19).contains(&v.octets()[1]))
                && !(v.octets()[0] == 100 && (64..=127).contains(&v.octets()[1]))
        }
        std::net::IpAddr::V6(v) => v.to_ipv4_mapped().map_or_else(
            || {
                !v.is_loopback()
                    && !v.is_unspecified()
                    && !v.is_multicast()
                    && (v.segments()[0] & 0xfe00) != 0xfc00
                    && (v.segments()[0] & 0xffc0) != 0xfe80
                    && (v.segments()[0] & 0xe000) == 0x2000
            },
            |v| public_address(v.into()),
        ),
    }
}
pub async fn download(link: &str) -> Result<Vec<u8>> {
    let url =
        reqwest::Url::parse(link).map_err(|_| anyhow::anyhow!("copilot_report_url_invalid"))?;
    ensure!(
        url.scheme() == "https"
            && url.username().is_empty()
            && url.password().is_none()
            && url.port_or_known_default() == Some(443)
            && url.fragment().is_none(),
        "copilot_report_url_invalid"
    );
    let host = url.host_str().context("copilot_report_url_invalid")?;
    let addresses =
        tokio::time::timeout(Duration::from_secs(3), tokio::net::lookup_host((host, 443)))
            .await
            .map_err(|_| anyhow::anyhow!("copilot_download_network"))?
            .map_err(|_| anyhow::anyhow!("copilot_download_network"))?
            .collect::<Vec<_>>();
    ensure!(
        !addresses.is_empty() && addresses.iter().all(|a| public_address(a.ip())),
        "copilot_report_private_origin_refused"
    );
    let client = reqwest::Client::builder()
        .no_proxy()
        .timeout(Duration::from_secs(8))
        .redirect(reqwest::redirect::Policy::none())
        .resolve_to_addrs(host, &addresses)
        .build()?;
    let mut response = client
        .get(url)
        .send()
        .await
        .map_err(|_| anyhow::anyhow!("copilot_download_network"))?;
    if !response.status().is_success() {
        let header = |name| {
            response
                .headers()
                .get(name)
                .and_then(|value| value.to_str().ok())
        };
        return Err(download_failure(
            response.status().as_u16(),
            header("retry-after"),
            header("x-ratelimit-reset"),
        )
        .into());
    }
    let mut bytes = Vec::new();
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|_| anyhow::anyhow!("copilot_download_network"))?
    {
        ensure!(
            bytes.len() + chunk.len() <= 2 * 1024 * 1024,
            "copilot_download_limit"
        );
        bytes.extend_from_slice(&chunk);
    }
    Ok(bytes)
}
fn download_failure(status: u16, retry: Option<&str>, reset: Option<&str>) -> GithubFailure {
    let mut error = crate::infrastructure::github::failure(
        status,
        None,
        retry,
        reset,
        chrono::Utc::now().timestamp(),
    );
    // A signed download may expire independently of the installation token.
    // Retry the report endpoint for new links; never request wider permission.
    if matches!(status, 401 | 403) && error.code != "rate_limited" {
        error.code = "signed_report_expired";
    }
    error
}

pub struct CopilotDailyWorker {
    pub repo: Arc<CopilotDailyRepository>,
    config: GithubConfig,
    client: GithubClient,
}
impl CopilotDailyWorker {
    pub fn new(repo: Arc<CopilotDailyRepository>, config: GithubConfig) -> Result<Self> {
        Ok(Self {
            repo,
            config,
            client: GithubClient::new()?,
        })
    }
    pub async fn tick(&self) -> Result<bool> {
        if !enabled() {
            return Ok(false);
        }
        self.repo.schedule().await?;
        let Some(job) = self.repo.claim().await? else {
            return Ok(false);
        };
        if let Err(error) = tokio::time::timeout(Duration::from_secs(75), self.process(&job))
            .await
            .unwrap_or_else(|_| Err(anyhow::anyhow!("copilot_daily_network_timeout")))
        {
            let (code, wait, dead) = error
                .downcast_ref::<GithubFailure>()
                .map(|e| (e.code, e.retry_seconds, e.code == "validation"))
                .unwrap_or_else(|| {
                    // Only classify our static download codes; never persist remote error bodies.
                    let text = error.to_string();
                    let code = if matches!(
                        text.as_str(),
                        "copilot_download_network" | "copilot_daily_network_timeout"
                    ) {
                        "provider_unavailable"
                    } else if matches!(
                        text.as_str(),
                        "copilot_admission_paused" | "copilot_admission_expired_during_commit"
                    ) {
                        "commercial_admission_paused"
                    } else {
                        "copilot_daily_unconfirmed"
                    };
                    (code, 60, false)
                });
            self.repo.fail(&job, code, wait, dead).await?;
        }
        Ok(true)
    }
    async fn process(&self, job: &DailyJob) -> Result<()> {
        // Existing installation credential path; no permission expansion.
        let token = self
            .client
            .installation_token(&self.config, job.installation, &[])
            .await?;
        let path = format!(
            "/orgs/{}/copilot/metrics/reports/users-1-day?day={}",
            job.login, job.day
        );
        let report = self
            .client
            .request(&token, Method::GET, &path, None, None)
            .await?;
        let links = report.value["download_links"]
            .as_array()
            .context("copilot_daily_report_unavailable")?;
        ensure!(
            report.value["report_day"].as_str() == Some(job.day.to_string().as_str())
                && !links.is_empty()
                && links.len() <= 8,
            "copilot_daily_report_scope_invalid"
        );
        // Every resumed batch verifies the entire report identity, not URL expiry
        // or shard index. Signed links and raw bytes never enter the checkpoint.
        let mut lines = Vec::new();
        let mut digest = Sha256::new();
        for link in links {
            let bytes = download(link.as_str().context("copilot_daily_link_invalid")?).await?;
            digest.update((bytes.len() as u64).to_le_bytes());
            digest.update(&bytes);
            for line in bytes.split(|b| *b == b'\n').filter(|b| !b.is_empty()) {
                lines.push(line.to_vec());
            }
            ensure!(lines.len() <= 10000, "copilot_daily_record_limit");
        }
        let content_hash = format!("{:x}", digest.finalize());
        let reset = job.checkpoint["content_hash"].as_str() != Some(content_hash.as_str());
        let offset = if reset {
            0
        } else {
            job.checkpoint["offset"].as_u64().unwrap_or(0) as usize
        };
        ensure!(offset <= lines.len(), "copilot_daily_checkpoint_invalid");
        let mut facts = Vec::new();
        let mut invalid = 0;
        for line in lines.iter().skip(offset).take(100) {
            match serde_json::from_slice::<Value>(line)
                .ok()
                .and_then(|v| normalize(&v, job.day, job.account).ok())
            {
                Some(mut row) => facts.append(&mut row),
                None => invalid += 1,
            }
        }
        let next = (offset + 100).min(lines.len());
        let checkpoint = json!({"offset":next,"content_hash":content_hash});
        self.repo
            .stage(
                job,
                &facts,
                &checkpoint,
                invalid,
                reset,
                next == lines.len(),
            )
            .await?;
        Ok(())
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn daily_metadata_is_nullable_dimensioned_and_not_session_usage() {
        let day = NaiveDate::from_ymd_opt(2026, 10, 11).unwrap();
        let row = json!({"day":"2026-10-11","organization_id":"7","user_id":9,"prompt":"PRIVATE","totals_by_feature":[{"feature":"code_completion","loc_suggested_to_add_sum":8,"code_acceptance_activity_count":0,"response":"PRIVATE"},{"feature":"agent_edit","loc_added_sum":12}]});
        let facts = normalize(&row, day, 7).unwrap();
        assert_eq!(facts[0].metrics["code_acceptance_activity_count"], Some(0));
        assert_eq!(facts[1].metrics["code_acceptance_activity_count"], None);
        assert!(!serde_json::to_string(&facts).unwrap().contains("PRIVATE"));
        assert!(normalize(&row, day, 8).is_err());
        let mut bad = row;
        bad["totals_by_feature"][0]["loc_added_sum"] = json!(-1);
        assert!(normalize(&bad, day, 7).is_err());
    }
    #[test]
    fn signed_download_retry_after_does_not_become_installation_auth_failure() {
        let limited = download_failure(429, Some("7200"), None);
        assert_eq!(limited.code, "rate_limited");
        assert_eq!(limited.retry_seconds, 7200);
        let failed = download_failure(503, Some("3600"), None);
        assert_eq!(failed.code, "provider_unavailable");
        assert_eq!(failed.retry_seconds, 3600);
        assert_eq!(
            download_failure(403, None, None).code,
            "signed_report_expired"
        );
    }
    #[test]
    fn downloads_reject_local_link_local_ipv4_mapped_and_metadata_origins() {
        for ip in [
            "127.0.0.1",
            "10.1.1.1",
            "169.254.169.254",
            "100.64.0.1",
            "::1",
            "::ffff:127.0.0.1",
            "fc00::1",
            "fe80::1",
        ] {
            assert!(!public_address(ip.parse().unwrap()));
        }
        assert!(public_address("1.1.1.1".parse().unwrap()));
    }
}
