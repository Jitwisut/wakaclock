//! Team-only policies. Personal canonical facts are never altered here.
use crate::model::{date_range::ResolvedRange, delivery_status::DeliveryStatusDevice};
use anyhow::{ensure, Result};
use chrono::{DateTime, Datelike, Duration, Months, Utc, Weekday};
use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;
use uuid::Uuid;

pub fn validate_week(range: &ResolvedRange, timezone: &str, now: DateTime<Utc>) -> Result<()> {
    ensure!(
        range.timezone.name() == timezone,
        "use the organization's report timezone"
    );
    ensure!(
        range.start.weekday() == Weekday::Mon && range.end == range.start + Duration::days(6),
        "Team aggregates require one Monday-Sunday week"
    );
    ensure!(
        range.end < now.with_timezone(&range.timezone).date_naive(),
        "Team report week is not closed"
    );
    ensure!(
        range.unix_bounds().0 >= cutoff(now).timestamp() as f64,
        "week is outside Team retention"
    );
    Ok(())
}
pub fn cutoff(now: DateTime<Utc>) -> DateTime<Utc> {
    now.checked_sub_months(Months::new(12))
        .expect("supported UTC date")
}

/// Conservative cross-view rule: disjoint people only, or exactly the same equation.
/// Provider/model cells within an equation still pass the existing partition policy.
pub fn safe_views(
    previous: &[(BTreeSet<Uuid>, String)],
    people: &BTreeSet<Uuid>,
    fingerprint: &str,
) -> bool {
    previous
        .iter()
        .all(|(old, hash)| old.is_disjoint(people) || (old == people && hash == fingerprint))
}
/// Conservative equation control across weeks: no partial reuse of facts.
pub fn safe_fact_view(
    old_facts: Option<&BTreeSet<String>>,
    old_people: &BTreeSet<Uuid>,
    old_hash: &str,
    facts: &BTreeSet<String>,
    people: &BTreeSet<Uuid>,
    hash: &str,
) -> bool {
    match old_facts {
        Some(old) => old.is_disjoint(facts) || (old == facts && old_hash == hash),
        None => !old_people.is_empty() && old_people.is_disjoint(people),
    }
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Health {
    pub status: String,
    pub reason: String,
    pub updated_at: Option<DateTime<Utc>>,
    pub scope: String,
}
impl Health {
    pub fn new(status: &str, reason: &str, at: Option<DateTime<Utc>>, scope: &str) -> Self {
        Self {
            status: status.into(),
            reason: reason.into(),
            updated_at: at,
            scope: scope.into(),
        }
    }
}
pub fn device_health(
    devices: &[DeliveryStatusDevice],
    capture: bool,
    now: DateTime<Utc>,
) -> Health {
    if devices.is_empty() {
        return Health::new("unavailable", "no_snapshot", None, "own_account");
    }
    let at = devices.iter().map(|d| d.captured_at).min();
    for d in devices {
        if d.status != "fresh" {
            return Health::new(d.status, "snapshot_not_fresh", at, "own_account");
        }
        if capture {
            let Some(c) = &d.capture else {
                return Health::new("unconfirmed", "capture_evidence_missing", at, "own_account");
            };
            if !(0..=300).contains(&now.signed_duration_since(c.captured_at).num_seconds())
                || c.last_scan_success_at.is_none_or(|a| {
                    !(0..=300).contains(&now.signed_duration_since(a).num_seconds())
                })
            {
                return Health::new("stale", "capture_scan_stale", at, "own_account");
            }
            if !c.enabled || c.status != "fresh" || c.parser_errors > 0 || c.pending > 0 {
                return Health::new("partial", "capture_not_ready", at, "own_account");
            }
        } else {
            let Some(details) = &d.details else {
                return Health::new("unconfirmed", "delivery_details_missing", at, "own_account");
            };
            if d.dead_letter.unwrap_or(0) > 0 {
                return Health::new("failure", "dead_letter", at, "own_account");
            }
            if let Some(e) = &details.backlog_error {
                if matches!(e.http_status, Some(401..=403)) {
                    return Health::new("failure", "authorization_required", at, "own_account");
                }
            }
            if d.pending.is_none() {
                return Health::new("unconfirmed", "queue_read_unknown", at, "own_account");
            }
            if d.pending.unwrap_or(0) > 0 {
                return Health::new("pending", "backlog_pending", at, "own_account");
            }
        }
    }
    Health::new(
        "observed",
        "fresh_snapshot_only_not_capture_certification",
        at,
        "own_account",
    )
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn cumulative_cross_week_equations_require_independent_fact_sets() {
        let people = (1..=5).map(Uuid::from_u128).collect();
        let old = ["a".into(), "b".into()].into_iter().collect();
        let partial = ["a".into(), "b".into(), "one_person_extra".into()]
            .into_iter()
            .collect();
        let disjoint = ["new_week".into()].into_iter().collect();
        assert!(!safe_fact_view(
            Some(&old),
            &people,
            "old",
            &partial,
            &people,
            "new"
        ));
        assert!(safe_fact_view(
            Some(&old),
            &people,
            "old",
            &disjoint,
            &people,
            "new"
        ));
        assert!(safe_fact_view(
            Some(&old),
            &people,
            "old",
            &old,
            &people,
            "old"
        ));
        assert!(!safe_fact_view(
            Some(&old),
            &people,
            "old",
            &old,
            &people,
            "corrected"
        ));
        assert!(!safe_fact_view(
            None, &people, "legacy", &old, &people, "new"
        ));
        assert!(!safe_fact_view(
            None,
            &BTreeSet::new(),
            "restore_barrier",
            &old,
            &people,
            "new"
        ));
    }
    #[test]
    fn weekly_policy_rejects_open_arbitrary_and_timezone_ranges() {
        let now = DateTime::parse_from_rfc3339("2026-10-08T12:00:00Z")
            .unwrap()
            .with_timezone(&Utc);
        let week = ResolvedRange::parse("2026-09-28", "2026-10-04", Some("Asia/Bangkok")).unwrap();
        assert!(validate_week(&week, "Asia/Bangkok", now).is_ok());
        assert!(validate_week(&week, "UTC", now).is_err());
        let open = ResolvedRange::parse("2026-10-05", "2026-10-11", Some("Asia/Bangkok")).unwrap();
        assert!(validate_week(&open, "Asia/Bangkok", now).is_err());
    }
    #[test]
    fn complements_overlap_and_mutated_equations_are_closed() {
        let a = (1..=5).map(Uuid::from_u128).collect();
        let b = (2..=6).map(Uuid::from_u128).collect();
        assert!(!safe_views(&[(a, "a".into())], &b, "b"));
        let a = (1..=5).map(Uuid::from_u128).collect::<BTreeSet<_>>();
        assert!(safe_views(&[(a.clone(), "a".into())], &a, "a"));
        assert!(!safe_views(&[(a.clone(), "a".into())], &a, "correction"));
    }
    #[test]
    fn calendar_cutoff_handles_leap_day() {
        let at = DateTime::parse_from_rfc3339("2024-02-29T12:34:00Z")
            .unwrap()
            .with_timezone(&Utc);
        assert_eq!(cutoff(at).to_rfc3339(), "2023-02-28T12:34:00+00:00");
    }
    #[test]
    fn health_does_not_conflate_capture_queue_and_delivery() {
        use crate::services::delivery_status::ReceivedDeliverySnapshot;
        use wakaclock_core::queue::{
            CaptureHealthSnapshot, DeliveryErrorSummary, DeliveryQueueDetails,
            DeliveryQueueSnapshot, QueueReadStatus,
        };
        let now = Utc::now();
        assert_eq!(device_health(&[], false, now).status, "unavailable");
        let mut s = DeliveryQueueSnapshot::unavailable("device".into(), "queue".into(), 1);
        s.schema_version = 2;
        s.captured_at = now;
        s.read_status = QueueReadStatus::Available;
        s.pending = Some(0);
        s.dead_letter = Some(0);
        s.details = Some(DeliveryQueueDetails {
            eligible: 0,
            leased: 0,
            next_retry_at: None,
            oldest_event_at: None,
            accepted_total: 0,
            backlog_error: None,
        });
        let health = |snapshot: DeliveryQueueSnapshot, capture| {
            device_health(
                &[DeliveryStatusDevice::from_received(
                    ReceivedDeliverySnapshot {
                        snapshot,
                        received_at: now,
                    },
                    now,
                )],
                capture,
                now,
            )
        };
        assert_eq!(health(s.clone(), false).status, "observed");
        assert_eq!(health(s.clone(), true).status, "unconfirmed");
        s.pending = Some(1);
        assert_eq!(health(s.clone(), false).status, "pending");
        for status in [401, 402, 403] {
            s.details.as_mut().unwrap().backlog_error = Some(DeliveryErrorSummary {
                kind: "auth".into(),
                http_status: Some(status),
                message_code: "auth".into(),
                failed_at: now,
            });
            assert_eq!(health(s.clone(), false).reason, "authorization_required");
        }
        s.dead_letter = Some(1);
        assert_eq!(health(s.clone(), false).reason, "dead_letter");
        s.capture = Some(CaptureHealthSnapshot {
            schema_version: 1,
            captured_at: now,
            enabled: true,
            status: "fresh".into(),
            last_scan_success_at: Some(now),
            parser_errors: 0,
            pending: 0,
        });
        assert_eq!(health(s.clone(), true).status, "observed");
        s.capture.as_mut().unwrap().parser_errors = 1;
        assert_eq!(health(s.clone(), true).status, "partial");
        s.captured_at = now - Duration::seconds(301);
        assert_eq!(health(s.clone(), false).status, "stale");
        s.read_status = QueueReadStatus::Unavailable;
        assert_eq!(health(s, false).status, "unavailable");
    }
}
