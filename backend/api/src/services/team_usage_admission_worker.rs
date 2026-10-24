//! Internal opted-in Team scans. Existing privacy worker supplies the 15-second tick.
use crate::repository::{
    team_insights::TeamInsightsRepository, team_trust::TeamTrustRepository, team_usage_admissions,
    team_usage_scan,
};
use anyhow::{Context, Result};
use chrono::{DateTime, Utc};
use std::time::{Duration, Instant};

/// Operational evidence only. Never expose scan cursors or contributor counts.
pub struct Observation {
    pub enrolled: bool,
    pub access_active: Option<bool>,
    pub scan_before: Option<DateTime<Utc>>,
    pub last_success: Option<DateTime<Utc>>,
    pub last_completed: Option<DateTime<Utc>>,
    pub error: Option<String>,
}

pub fn health(observation: &Observation, now: DateTime<Utc>) -> super::team_trust::Health {
    let recent =
        |at: DateTime<Utc>| (0..=300).contains(&now.signed_duration_since(at).num_seconds());
    let (status, reason) = if !observation.enrolled {
        ("unavailable", "commercial_admission_not_enrolled")
    } else if observation.access_active.is_none() {
        ("unconfirmed", "commercial_access_unconfirmed")
    } else if observation.access_active == Some(false) {
        ("paused", "commercial_access_inactive")
    } else if let Some(error) = observation.error.as_deref() {
        match error {
            "entitlement_inactive" | "entitlement_unconfirmed" => {
                ("pending", "canonical_scan_awaiting_recovery")
            }
            _ => ("unavailable", "admission_dependency_unconfirmed"),
        }
    } else if let Some(started) = observation.scan_before {
        if recent(started) {
            ("pending", "canonical_scan_in_progress")
        } else {
            ("stale", "canonical_scan_lagging")
        }
    } else if observation.last_success.is_none() || observation.last_completed.is_none() {
        ("unconfirmed", "awaiting_first_canonical_scan")
    } else if !observation.last_success.is_some_and(recent)
        || !observation.last_completed.is_some_and(recent)
    {
        ("stale", "canonical_scan_checkpoint_stale")
    } else {
        ("observed", "latest_sweep_observed_capture_unconfirmed")
    };
    super::team_trust::Health::new(
        status,
        reason,
        observation.last_success,
        "organization_operations",
    )
}

pub fn enabled(value: Option<&str>) -> Result<bool> {
    match value {
        None | Some("0" | "false") => Ok(false),
        Some("1" | "true") => Ok(true),
        _ => anyhow::bail!("Team admission worker flag must be explicit"),
    }
}

pub async fn tick(repo: &TeamInsightsRepository, trust: &TeamTrustRepository) -> Result<()> {
    // Include DB acquisition, claim, and retry in the budget: an unavailable
    // admission checkpoint must not stall the existing privacy maintenance loop.
    tokio::time::timeout(Duration::from_secs(10), run(repo, trust))
        .await
        .context("Team admission tick deadline exceeded")?
}

async fn run(repo: &TeamInsightsRepository, trust: &TeamTrustRepository) -> Result<()> {
    let started = Instant::now();
    for _ in 0..5 {
        if started.elapsed() >= Duration::from_secs(10) {
            break;
        }
        let Some(claim) = team_usage_scan::claim(&repo.postgres).await? else {
            break;
        };
        let outcome = tokio::time::timeout(Duration::from_secs(10), async {
            trust.guard(claim.org).await?;
            let rows = repo.admission_page(&claim).await?;
            // A source request cannot bypass a changed independent privacy proof.
            trust.guard(claim.org).await?;
            team_usage_admissions::admit_page(&repo.postgres, &claim, &rows).await?;
            Ok::<_, anyhow::Error>(())
        })
        .await;
        if !matches!(outcome, Ok(Ok(()))) {
            // Safe code only, never source metadata, credentials or provider errors.
            // A lost DB response after commit cannot overwrite the completed checkpoint.
            team_usage_scan::retry(&repo.postgres, &claim).await?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn health_never_equates_scans_or_absent_receipts_with_complete_capture() {
        let now = DateTime::from_timestamp(1_800_000_000, 0).unwrap();
        let mut observation = Observation {
            enrolled: false,
            access_active: None,
            scan_before: None,
            last_success: None,
            last_completed: None,
            error: None,
        };
        assert_eq!(
            health(&observation, now).reason,
            "commercial_admission_not_enrolled"
        );
        observation.enrolled = true;
        assert_eq!(health(&observation, now).status, "unconfirmed");
        observation.access_active = Some(true);
        assert_eq!(
            health(&observation, now).reason,
            "awaiting_first_canonical_scan"
        );
        observation.scan_before = Some(now);
        assert_eq!(health(&observation, now).status, "pending");
        observation.scan_before = Some(now - chrono::Duration::seconds(301));
        assert_eq!(health(&observation, now).status, "stale");
        observation.scan_before = None;
        observation.last_completed = Some(now);
        observation.last_success = Some(now);
        let recovered = health(&observation, now);
        assert_eq!(recovered.status, "observed");
        assert_eq!(
            recovered.reason,
            "latest_sweep_observed_capture_unconfirmed"
        );
        observation.last_completed = Some(now + chrono::Duration::seconds(1));
        assert_eq!(health(&observation, now).status, "stale");
        observation.error = Some("provider-secret-fixture-do-not-export".into());
        let failure = serde_json::to_string(&health(&observation, now)).unwrap();
        assert!(!failure.contains("provider-secret"));
        assert!(failure.contains("admission_dependency_unconfirmed"));
        observation.access_active = Some(false);
        assert_eq!(health(&observation, now).status, "paused");
        observation.access_active = Some(true);
        observation.error = Some("entitlement_inactive".into());
        assert_eq!(
            health(&observation, now).reason,
            "canonical_scan_awaiting_recovery"
        );
    }
    #[test]
    fn opt_in_is_explicit() {
        assert!(!super::enabled(None).unwrap());
        assert!(!super::enabled(Some("false")).unwrap());
        assert!(super::enabled(Some("true")).unwrap());
        assert!(super::enabled(Some("yes")).is_err());
    }
}
