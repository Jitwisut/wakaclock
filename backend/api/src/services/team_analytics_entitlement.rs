//! Prospective commercial coverage. This ledger alone never authorizes a Team read.
//! Admission receipts and the current privacy projection remain mandatory.
use super::team_billing::{GRACE_DAYS, PACKAGES, TRIAL_DAYS};
use anyhow::{ensure, Result};
use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Scope {
    pub account: String,
    pub live: bool,
    pub customer: String,
    pub subscription: String,
    pub binding_revision: i64,
}
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum Kind {
    Trial,
    Paid,
    Grace,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Window {
    pub kind: Kind,
    pub start: DateTime<Utc>,
    pub end: DateTime<Utc>,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct State {
    pub schema_version: u8,
    pub revision: i64,
    pub package_seats: i32,
    pub activated_at: DateTime<Utc>,
    pub trial_started_at: DateTime<Utc>,
    pub trial_ends_at: DateTime<Utc>,
    pub scope: Option<Scope>,
    pub source_revision: i64,
    pub observed_at: DateTime<Utc>,
    pub ever_paid: bool,
    pub first_failure_at: Option<DateTime<Utc>>,
    pub resolved_failure_through: Option<DateTime<Utc>>,
    pub windows: Vec<Window>,
}
#[derive(Debug, Clone)]
pub enum Evidence {
    Paid {
        seats: i32,
        until: DateTime<Utc>,
        settled_at: DateTime<Utc>,
    },
    PastDue {
        first_failure: DateTime<Utc>,
    },
    Canceled,
    Unconfirmed,
}
impl State {
    /// The caller must authorize activation and persist this once. Never call on read/startup.
    pub fn trial(seats: i32, now: DateTime<Utc>) -> Result<Self> {
        ensure!(
            PACKAGES.iter().any(|n| i32::from(*n) == seats),
            "unsupported package"
        );
        let end = now + Duration::days(TRIAL_DAYS);
        Ok(Self {
            schema_version: 1,
            revision: 1,
            package_seats: seats,
            activated_at: now,
            trial_started_at: now,
            trial_ends_at: end,
            scope: None,
            source_revision: 0,
            observed_at: now,
            ever_paid: false,
            first_failure_at: None,
            resolved_failure_through: None,
            windows: vec![Window {
                kind: Kind::Trial,
                start: now,
                end,
            }],
        })
    }
    pub fn validate(&self) -> Result<()> {
        ensure!(
            self.schema_version == 1 && self.revision > 0,
            "entitlement version unconfirmed"
        );
        ensure!(
            self.trial_started_at == self.activated_at
                && self.trial_ends_at == self.trial_started_at + Duration::days(TRIAL_DAYS),
            "trial history invalid"
        );
        ensure!(
            PACKAGES.iter().any(|n| i32::from(*n) == self.package_seats),
            "unsupported package"
        );
        ensure!(
            self.windows
                .iter()
                .all(|w| w.start >= self.activated_at && w.end >= w.start),
            "coverage history invalid"
        );
        Ok(())
    }
    /// Current coverage is not a cached permission or proof a fact was admitted.
    pub fn covered_at(&self, at: DateTime<Utc>) -> bool {
        self.validate().is_ok() && self.windows.iter().any(|w| w.start <= at && at < w.end)
    }
    /// Provider daily counters require coverage of the entire UTC day; never prorate.
    pub fn covers_range(&self, from: DateTime<Utc>, to: DateTime<Utc>) -> bool {
        if self.validate().is_err() || from >= to {
            return false;
        }
        let mut windows = self.windows.clone();
        windows.sort_by_key(|w| w.start);
        let mut cursor = from;
        for w in windows {
            if w.end <= cursor {
                continue;
            }
            if w.start > cursor {
                return false;
            }
            cursor = w.end;
            if cursor >= to {
                return true;
            }
        }
        false
    }
    fn extend(&mut self, kind: Kind, now: DateTime<Utc>, end: DateTime<Utc>) {
        if end <= now {
            return;
        }
        if let Some(w) = self
            .windows
            .iter_mut()
            .rev()
            .find(|w| w.kind == kind && w.start <= now && now <= w.end)
        {
            w.end = w.end.max(end);
        } else {
            self.windows.push(Window {
                kind,
                start: now,
                end,
            });
        }
    }
    fn close(&mut self, kind: Option<Kind>, now: DateTime<Utc>) {
        for w in &mut self.windows {
            if kind.is_none_or(|k| k == w.kind) && w.end > now {
                w.end = now.max(w.start);
            }
        }
    }
    /// Returns false for a repeated/older revision. Scope changes require a separate,
    /// explicit migration; they cannot be smuggled through a subscription readback.
    pub fn observe(
        &mut self,
        scope: &Scope,
        source_revision: i64,
        at: DateTime<Utc>,
        now: DateTime<Utc>,
        evidence: &Evidence,
    ) -> Result<bool> {
        self.validate()?;
        ensure!(
            scope.binding_revision > 0 && source_revision > 0,
            "provider revision invalid"
        );
        ensure!(
            self.scope.as_ref().is_none_or(|s| s == scope),
            "entitlement scope changed"
        );
        if source_revision <= self.source_revision {
            return Ok(false);
        }
        ensure!(
            at <= now && now - at < Duration::minutes(5) && now >= self.observed_at,
            "provider observation not current"
        );
        // Validate before mutation; rejected evidence must not advance the revision.
        if let Evidence::Paid {
            seats,
            until,
            settled_at,
        } = evidence
        {
            ensure!(
                *seats == self.package_seats,
                "package change requires confirmed transition"
            );
            ensure!(
                *until > now && *settled_at <= at,
                "payment coverage unconfirmed"
            );
        }
        if let Evidence::PastDue { first_failure } = evidence {
            ensure!(*first_failure <= at, "failure timestamp unconfirmed");
        }
        self.scope = Some(scope.clone());
        self.source_revision = source_revision;
        self.observed_at = now;
        self.revision += 1;
        match evidence {
            Evidence::Paid {
                until, settled_at, ..
            } => {
                // An old settled invoice cannot resolve a newer delinquency episode.
                if self.first_failure_at.is_none_or(|f| *settled_at >= f) {
                    self.ever_paid = true;
                    self.first_failure_at = None;
                    self.resolved_failure_through = Some(
                        self.resolved_failure_through
                            .map_or(*settled_at, |v| v.max(*settled_at)),
                    );
                    self.close(Some(Kind::Grace), now);
                    self.extend(Kind::Paid, now, *until);
                }
            }
            Evidence::PastDue { first_failure } => {
                // Replay of a resolved failure, initial purchase failure, or trial
                // expiry must not manufacture a new seven-day grace period.
                if self.ever_paid
                    && self
                        .resolved_failure_through
                        .is_none_or(|t| *first_failure > t)
                {
                    let first = self
                        .first_failure_at
                        .map_or(*first_failure, |v| v.min(*first_failure));
                    self.first_failure_at = Some(first);
                    let end = first + Duration::days(GRACE_DAYS);
                    // Earlier evidence can shorten future grace, not erase admissions
                    // made under the previous evidence. Paid/trial coverage stays intact.
                    for w in &mut self.windows {
                        if w.kind == Kind::Grace && w.end > now {
                            w.end = w.end.min(end.max(now));
                        }
                    }
                    self.extend(Kind::Grace, now, end);
                }
            }
            Evidence::Canceled => self.close(None, now),
            Evidence::Unconfirmed => (), // Never extend or revoke already proven coverage.
        }
        Ok(true)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn at() -> DateTime<Utc> {
        DateTime::parse_from_rfc3339("2026-10-01T00:00:00Z")
            .unwrap()
            .with_timezone(&Utc)
    }
    fn scope() -> Scope {
        Scope {
            account: "acct_test".into(),
            live: false,
            customer: "cus_test".into(),
            subscription: "sub_test".into(),
            binding_revision: 1,
        }
    }
    fn apply(s: &mut State, now: DateTime<Utc>, e: Evidence) {
        s.observe(&scope(), s.source_revision + 1, now, now, &e)
            .unwrap();
    }
    #[test]
    fn trial_is_exact_half_open_and_expiry_never_grants_grace() {
        let t = at();
        let mut s = State::trial(25, t).unwrap();
        assert!(!s.covered_at(t - Duration::seconds(1)));
        assert!(s.covered_at(t));
        assert!(!s.covered_at(t + Duration::days(14)));
        apply(
            &mut s,
            t + Duration::days(15),
            Evidence::PastDue {
                first_failure: t + Duration::days(14),
            },
        );
        assert!(!s.covered_at(t + Duration::days(15)));
        assert_eq!(s.windows.len(), 1);
        assert!(State::trial(11, t).is_err());
    }
    #[test]
    fn coverage_does_not_expire_with_the_five_minute_observation_fence() {
        let t = at();
        let mut s = State::trial(10, t).unwrap();
        apply(
            &mut s,
            t,
            Evidence::Paid {
                seats: 10,
                until: t + Duration::days(30),
                settled_at: t,
            },
        );
        apply(&mut s, t + Duration::days(20), Evidence::Unconfirmed);
        assert!(s.covered_at(t + Duration::days(29)));
        assert!(!s.covered_at(t + Duration::days(30)));
    }
    #[test]
    fn grace_uses_episode_not_latest_invoice_or_restart_and_preserves_paid_coverage() {
        let t = at();
        let mut s = State::trial(10, t).unwrap();
        apply(
            &mut s,
            t,
            Evidence::Paid {
                seats: 10,
                until: t + Duration::days(30),
                settled_at: t,
            },
        );
        let f = t + Duration::days(29);
        apply(&mut s, f, Evidence::PastDue { first_failure: f });
        let saved = serde_json::to_value(&s).unwrap();
        s = serde_json::from_value(saved).unwrap();
        apply(
            &mut s,
            f + Duration::days(6),
            Evidence::PastDue {
                first_failure: f + Duration::days(5),
            },
        );
        assert_eq!(s.first_failure_at, Some(f));
        assert!(s.covered_at(f + Duration::days(6)));
        assert!(!s.covered_at(f + Duration::days(7)));
        assert!(s
            .windows
            .iter()
            .any(|w| w.kind == Kind::Paid && w.end == t + Duration::days(30)));
        apply(
            &mut s,
            f + Duration::days(8),
            Evidence::Paid {
                seats: 10,
                until: t + Duration::days(60),
                settled_at: t,
            },
        );
        assert!(!s.covered_at(f + Duration::days(8))); // old invoice cannot reset episode
        let resumed = f + Duration::days(9);
        apply(
            &mut s,
            resumed,
            Evidence::Paid {
                seats: 10,
                until: t + Duration::days(60),
                settled_at: resumed,
            },
        );
        assert!(s.covered_at(resumed));
        assert!(!s.covered_at(resumed - Duration::seconds(1)));
        apply(
            &mut s,
            resumed + Duration::seconds(1),
            Evidence::PastDue { first_failure: f },
        );
        assert_eq!(s.first_failure_at, None);
        assert_eq!(
            s.windows.iter().filter(|w| w.kind == Kind::Grace).count(),
            1
        );
    }
    #[test]
    fn scope_replay_future_and_package_change_do_not_mutate_state() {
        let t = at();
        let mut s = State::trial(10, t).unwrap();
        apply(&mut s, t, Evidence::Unconfirmed);
        let before = s.clone();
        assert!(!s.observe(&scope(), 1, t, t, &Evidence::Canceled).unwrap());
        assert_eq!(s, before);
        let mut wrong = scope();
        wrong.live = true;
        assert!(s.observe(&wrong, 2, t, t, &Evidence::Canceled).is_err());
        assert!(s
            .observe(
                &scope(),
                2,
                t + Duration::seconds(1),
                t,
                &Evidence::Canceled
            )
            .is_err());
        assert!(s
            .observe(
                &scope(),
                2,
                t,
                t + Duration::minutes(5),
                &Evidence::Canceled
            )
            .is_err());
        assert!(s
            .observe(
                &scope(),
                2,
                t,
                t,
                &Evidence::Paid {
                    seats: 25,
                    until: t + Duration::days(30),
                    settled_at: t
                }
            )
            .is_err());
        assert_eq!(s, before);
    }
    #[test]
    fn cancellation_preserves_history_and_daily_coverage_requires_no_gap() {
        let t = at();
        let mut s = State::trial(10, t).unwrap();
        let stop = t + Duration::hours(12);
        apply(&mut s, stop, Evidence::Canceled);
        assert!(s.covered_at(t));
        assert!(!s.covered_at(stop));
        apply(
            &mut s,
            t + Duration::days(1),
            Evidence::Paid {
                seats: 10,
                until: t + Duration::days(30),
                settled_at: t + Duration::days(1),
            },
        );
        assert!(!s.covers_range(t, t + Duration::days(1)));
        assert!(s.covers_range(t + Duration::days(1), t + Duration::days(2)));
        assert!(!s.covers_range(t, t));
    }
}
