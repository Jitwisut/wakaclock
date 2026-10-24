//! Commercial admission uses whole provider UTC days, never prorated counters.
use super::team_analytics_entitlement::State;
use chrono::{DateTime, NaiveDate, Utc};

pub fn new_allowed(state: Option<&State>, day: NaiveDate, now: DateTime<Utc>) -> bool {
    let Some(end) = day.succ_opt().and_then(|d| d.and_hms_opt(0, 0, 0)) else {
        return false;
    };
    let start = day.and_hms_opt(0, 0, 0).unwrap().and_utc();
    let end = end.and_utc();
    end <= now
        && start >= super::team_trust::cutoff(now)
        && state.is_none_or(|s| s.covered_at(now) && s.covers_range(start, end))
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Duration;
    #[test]
    fn whole_utc_days_and_current_coverage_are_both_required() {
        let day = NaiveDate::from_ymd_opt(2026, 10, 12).unwrap();
        let start = day.and_hms_opt(0, 0, 0).unwrap().and_utc();
        let now = start + Duration::days(2);
        let state = State::trial(10, start).unwrap();
        assert!(new_allowed(Some(&state), day, now));
        assert!(!new_allowed(Some(&state), day.pred_opt().unwrap(), now));
        assert!(!new_allowed(
            Some(&State::trial(10, start + Duration::seconds(1)).unwrap()),
            day,
            now
        ));
        assert!(!new_allowed(Some(&state), day, state.trial_ends_at));
        assert!(!new_allowed(None, now.date_naive(), now));
        assert!(!new_allowed(None, day, start + Duration::days(400)));
        assert!(new_allowed(None, day, now)); // Explicitly unenrolled legacy rollout only.
    }
    #[test]
    fn adjacent_coverage_is_whole_but_a_one_second_gap_is_not() {
        use crate::services::team_analytics_entitlement::{Kind, Window};
        let day = NaiveDate::from_ymd_opt(2026, 10, 12).unwrap();
        let start = day.and_hms_opt(0, 0, 0).unwrap().and_utc();
        let now = start + Duration::days(2);
        let mut state = State::trial(10, start).unwrap();
        state.windows = vec![
            Window {
                kind: Kind::Trial,
                start,
                end: start + Duration::hours(12),
            },
            Window {
                kind: Kind::Paid,
                start: start + Duration::hours(12),
                end: now + Duration::days(1),
            },
        ];
        assert!(new_allowed(Some(&state), day, now));
        state.windows[1].start += Duration::seconds(1);
        assert!(!new_allowed(Some(&state), day, now));
    }
    #[test]
    fn midnight_close_is_exact_and_retention_uses_calendar_months() {
        let day = NaiveDate::from_ymd_opt(2024, 2, 29).unwrap();
        let start = day.and_hms_opt(0, 0, 0).unwrap().and_utc();
        assert!(!new_allowed(
            None,
            day,
            start + Duration::days(1) - Duration::nanoseconds(1)
        ));
        assert!(new_allowed(None, day, start + Duration::days(1)));
        let cutoff = NaiveDate::from_ymd_opt(2025, 2, 28)
            .unwrap()
            .and_hms_opt(0, 0, 0)
            .unwrap()
            .and_utc();
        assert!(new_allowed(None, day, cutoff));
        assert!(!new_allowed(None, day, cutoff + Duration::days(1)));
    }
}
