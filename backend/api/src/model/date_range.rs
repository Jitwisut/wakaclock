//! Validated date ranges in the user's timezone (plan.md 9.7).
//!
//! Every Phase 9 endpoint takes `start`, `end` and an optional `timezone`. Resolving
//! them in one place keeps "today", weekday grouping and the previous-period comparison
//! agreeing with each other — computing any of them against server-local time silently
//! reports the wrong day to anyone not sitting in the server's zone.

use chrono::{Duration, NaiveDate, TimeZone, Utc};
use chrono_tz::Tz;
use serde::Serialize;

/// Upper bound on a single request's span. All-time totals have their own optimized
/// path and must not be served by widening this (plan.md 9.7).
pub const MAX_RANGE_DAYS: i64 = 366;

const DEFAULT_TIMEZONE: &str = "UTC";

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RangeError {
    InvalidDate(String),
    InvalidTimezone(String),
    StartAfterEnd,
    TooLong { days: i64, max: i64 },
}

impl std::fmt::Display for RangeError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::InvalidDate(value) => {
                write!(f, "invalid date '{value}', expected YYYY-MM-DD")
            }
            Self::InvalidTimezone(value) => {
                write!(
                    f,
                    "unknown timezone '{value}', expected an IANA name such as Asia/Bangkok"
                )
            }
            Self::StartAfterEnd => write!(f, "start must not be after end"),
            Self::TooLong { days, max } => {
                write!(f, "range of {days} days exceeds the {max}-day maximum")
            }
        }
    }
}

/// The range a response was computed over, echoed back so a client never has to guess
/// which zone the numbers are in.
#[derive(Debug, Clone, Serialize)]
pub struct RangeInfo {
    pub start: String,
    pub end: String,
    pub timezone: String,
    pub days_included: i64,
}

#[derive(Debug, Clone)]
pub struct ResolvedRange {
    pub start: NaiveDate,
    pub end: NaiveDate,
    pub timezone: Tz,
}

impl ResolvedRange {
    /// Return today's calendar date in the requested timezone.
    ///
    /// This is used by single-day endpoints that accept an optional `date`. Keeping
    /// the default in the same timezone parser as explicit ranges prevents a request
    /// with `timezone=Asia/Bangkok` from silently defaulting to the server's UTC day.
    pub fn today_date_string(timezone: Option<&str>) -> Result<String, RangeError> {
        let timezone = parse_timezone(timezone)?;
        Ok(Utc::now()
            .with_timezone(&timezone)
            .format("%Y-%m-%d")
            .to_string())
    }

    /// Parse and validate a request's range.
    ///
    /// An absent timezone falls back to UTC rather than the server's local zone: a
    /// server that moves hosts would otherwise silently re-bucket everyone's days.
    pub fn parse(start: &str, end: &str, timezone: Option<&str>) -> Result<Self, RangeError> {
        Self::parse_with_limit(start, end, timezone, Some(MAX_RANGE_DAYS))
    }

    /// Parse a range discovered from an all-time activity ledger.
    ///
    /// User-selected windows stay capped by [`MAX_RANGE_DAYS`], but an all-time endpoint
    /// must retain its historical behavior when a user's activity spans more than a year.
    /// The caller is responsible for using the all-time query path rather than accepting an
    /// unbounded range directly from request input.
    pub fn parse_unbounded(
        start: &str,
        end: &str,
        timezone: Option<&str>,
    ) -> Result<Self, RangeError> {
        Self::parse_with_limit(start, end, timezone, None)
    }

    fn parse_with_limit(
        start: &str,
        end: &str,
        timezone: Option<&str>,
        max_days: Option<i64>,
    ) -> Result<Self, RangeError> {
        let timezone = parse_timezone(timezone)?;

        let start = NaiveDate::parse_from_str(start, "%Y-%m-%d")
            .map_err(|_| RangeError::InvalidDate(start.to_string()))?;
        let end = NaiveDate::parse_from_str(end, "%Y-%m-%d")
            .map_err(|_| RangeError::InvalidDate(end.to_string()))?;

        if start > end {
            return Err(RangeError::StartAfterEnd);
        }

        let days = (end - start).num_days() + 1;
        if max_days.is_some_and(|max| days > max) {
            return Err(RangeError::TooLong {
                days,
                max: max_days.expect("checked above"),
            });
        }

        Ok(Self {
            start,
            end,
            timezone,
        })
    }

    /// Inclusive day count — a single-day range is 1, not 0.
    pub fn days_included(&self) -> i64 {
        (self.end - self.start).num_days() + 1
    }

    /// The immediately preceding range of equal length, for period-over-period
    /// comparison. Aug 7–13 yields Jul 31–Aug 6: adjacent, never overlapping.
    pub fn previous_period(&self) -> Self {
        let span = Duration::days(self.days_included());
        Self {
            start: self.start - span,
            end: self.end - span,
            timezone: self.timezone,
        }
    }

    /// Today's date in the user's timezone, which is what "today" on the dashboard has
    /// to mean — not the server's date.
    pub fn today_in_timezone(&self) -> NaiveDate {
        Utc::now().with_timezone(&self.timezone).date_naive()
    }

    pub fn info(&self) -> RangeInfo {
        RangeInfo {
            start: self.start.to_string(),
            end: self.end.to_string(),
            timezone: self.timezone.to_string(),
            days_included: self.days_included(),
        }
    }

    /// Unix-second bounds for querying the raw heartbeat/usage facts. The boundaries are
    /// computed from the user's local midnight, so DST transitions produce a 23/25-hour
    /// interval instead of silently shifting a day into the server's timezone.
    pub fn unix_bounds(&self) -> (f64, f64) {
        let start = self
            .timezone
            .from_local_datetime(&self.start.and_hms_opt(0, 0, 0).expect("midnight is valid"))
            .earliest()
            .or_else(|| {
                self.timezone
                    .from_local_datetime(
                        &self.start.and_hms_opt(0, 0, 0).expect("midnight is valid"),
                    )
                    .latest()
            })
            .expect("timezone has a midnight offset");
        let end_date = self.end + Duration::days(1);
        let end = self
            .timezone
            .from_local_datetime(&end_date.and_hms_opt(0, 0, 0).expect("midnight is valid"))
            .earliest()
            .or_else(|| {
                self.timezone
                    .from_local_datetime(&end_date.and_hms_opt(0, 0, 0).expect("midnight is valid"))
                    .latest()
            })
            .expect("timezone has a midnight offset");
        (start.timestamp() as f64, end.timestamp() as f64)
    }
}

fn parse_timezone(timezone: Option<&str>) -> Result<Tz, RangeError> {
    let value = timezone
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or(DEFAULT_TIMEZONE);
    value
        .parse()
        .map_err(|_| RangeError::InvalidTimezone(value.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_a_valid_range_with_an_iana_timezone() {
        let range = ResolvedRange::parse("2026-08-07", "2026-08-13", Some("Asia/Bangkok")).unwrap();
        assert_eq!(range.days_included(), 7);
        assert_eq!(range.timezone.to_string(), "Asia/Bangkok");
    }

    #[test]
    fn a_single_day_range_counts_as_one_day() {
        let range = ResolvedRange::parse("2026-08-07", "2026-08-07", None).unwrap();
        assert_eq!(range.days_included(), 1);
    }

    #[test]
    fn missing_timezone_falls_back_to_utc_not_server_local() {
        let range = ResolvedRange::parse("2026-08-07", "2026-08-13", None).unwrap();
        assert_eq!(range.timezone, Tz::UTC);
    }

    #[test]
    fn rejects_malformed_dates_and_unknown_timezones() {
        assert!(matches!(
            ResolvedRange::parse("07-08-2026", "2026-08-13", None),
            Err(RangeError::InvalidDate(_))
        ));
        assert!(matches!(
            ResolvedRange::parse("2026-08-07", "2026-08-13", Some("Mars/Olympus")),
            Err(RangeError::InvalidTimezone(_))
        ));
    }

    #[test]
    fn rejects_a_reversed_range() {
        assert!(matches!(
            ResolvedRange::parse("2026-08-13", "2026-08-07", None),
            Err(RangeError::StartAfterEnd)
        ));
    }

    #[test]
    fn caps_the_range_length() {
        let result = ResolvedRange::parse("2020-01-01", "2026-01-01", None);
        assert!(matches!(result, Err(RangeError::TooLong { .. })));
    }

    #[test]
    fn all_time_ranges_can_span_more_than_the_request_limit() {
        let range = ResolvedRange::parse_unbounded("2020-01-01", "2026-01-01", None).unwrap();
        assert!(range.days_included() > MAX_RANGE_DAYS);
    }

    /// plan.md 9.7's worked example: the previous period is adjacent and equal-length,
    /// never overlapping the current one.
    #[test]
    fn previous_period_is_adjacent_and_equal_length() {
        let range = ResolvedRange::parse("2026-08-07", "2026-08-13", None).unwrap();
        let previous = range.previous_period();

        assert_eq!(previous.start.to_string(), "2026-07-31");
        assert_eq!(previous.end.to_string(), "2026-08-06");
        assert_eq!(previous.days_included(), range.days_included());
        assert!(previous.end < range.start);
    }

    #[test]
    fn range_info_echoes_the_zone_the_numbers_were_computed_in() {
        let range = ResolvedRange::parse("2026-08-07", "2026-08-13", Some("Asia/Bangkok")).unwrap();
        let info = range.info();
        assert_eq!(info.timezone, "Asia/Bangkok");
        assert_eq!(info.days_included, 7);
    }

    #[test]
    fn unix_bounds_follow_the_requested_timezone() {
        let range = ResolvedRange::parse("2026-08-07", "2026-08-07", Some("Asia/Bangkok")).unwrap();
        let (start, end) = range.unix_bounds();
        assert_eq!(end - start, 86_400.0);
        assert!(start > 0.0);
    }

    #[test]
    fn bangkok_midnight_starts_on_the_previous_utc_date() {
        let range = ResolvedRange::parse("2026-08-23", "2026-08-23", Some("Asia/Bangkok")).unwrap();
        let (start, end) = range.unix_bounds();
        assert_eq!(start, 1_787_418_000.0); // 2026-08-22 17:00:00 UTC
        assert_eq!(end - start, 86_400.0);
    }
}
