use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct SummaryItem {
    pub name: String,
    pub total_seconds: f64,
    pub hours: f64,
    pub text: String,
    pub heartbeats: u64,
}

#[derive(Debug, Serialize)]
pub struct SummaryGrandTotal {
    pub total_seconds: f64,
    pub hours: f64,
    pub text: String,
    pub heartbeats: u64,
    /// Optional duration-v2 diagnostics. They are duplicated at the grand-total level
    /// so clients that do not render the evidence object can still compare the two
    /// timelines without changing the legacy fields above.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub comparable_seconds: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ai_measured_seconds: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ai_additional_seconds: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub calculation_version: Option<&'static str>,
    /// Strict Active v1 metrics. Legacy `total_seconds` remains the
    /// WakaTime-compatible value for existing consumers.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub active_seconds: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub active_human_seconds: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub active_human_only_seconds: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub active_ai_only_seconds: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub active_ai_seconds: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub active_overlap_seconds: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub active_coverage: Option<&'static str>,
    /// Additive: `total_seconds` keeps its WakaTime meaning, and this says how much of
    /// it a client actually measured versus how much the idle bridge inferred, and how
    /// much was attended by a human versus produced by an agent.
    pub evidence: crate::services::activity_timeline::EvidenceSplit,
}

#[derive(Debug, Serialize)]
pub struct SummaryDay {
    pub date: String,
    pub grand_total: SummaryGrandTotal,
    pub languages: Vec<SummaryItem>,
    pub projects: Vec<SummaryItem>,
    pub editors: Vec<SummaryItem>,
    pub operating_systems: Vec<SummaryItem>,
    /// Additive; WakaTime's summaries payload has no categories array.
    pub categories: Vec<SummaryItem>,
}

#[derive(Debug, Serialize)]
pub struct SummaryCalculation {
    pub timezone: String,
    pub timeout_seconds: f64,
    pub writes_only: bool,
    pub scope: &'static str,
    pub comparable_metric: &'static str,
    pub calculation_version: &'static str,
}

#[derive(Debug, Serialize)]
pub struct SummariesResponse {
    pub calculation: SummaryCalculation,
    pub start: String,
    pub end: String,
    pub days: Vec<SummaryDay>,
}

/// `GET /api/v1/users/current/summaries` in WakaTime's own shape, flattened next to
/// the AtoAxis fields so the dashboard (which reads `days`) is unaffected. Every
/// figure is taken from the same clipped intervals as `days`; nothing is recomputed.
#[derive(Debug, Serialize)]
pub struct WakaTimeSummariesResponse {
    #[serde(flatten)]
    pub summary: SummariesResponse,
    pub data: Vec<WakaTimeSummaryDay>,
    pub cumulative_total: WakaTimeCumulativeTotal,
    pub daily_average: WakaTimeDailyAverage,
    pub timezone: String,
}

impl WakaTimeSummariesResponse {
    pub fn new(summary: SummariesResponse, data: Vec<WakaTimeSummaryDay>) -> Self {
        let seconds: f64 = data.iter().map(|day| day.grand_total.total_seconds).sum();
        let days_including_holidays = data.len() as u64;
        let days_minus_holidays = data
            .iter()
            .filter(|day| day.grand_total.total_seconds > 0.0)
            .count() as u64;
        let average = if days_minus_holidays == 0 {
            0.0
        } else {
            seconds / days_minus_holidays as f64
        };
        let (hours, minutes) = hours_minutes(seconds);
        Self {
            cumulative_total: WakaTimeCumulativeTotal {
                seconds,
                text: wakatime_text(seconds),
                decimal: wakatime_decimal(seconds),
                digital: format!("{hours}:{minutes:02}"),
            },
            daily_average: WakaTimeDailyAverage {
                holidays: days_including_holidays - days_minus_holidays,
                days_including_holidays,
                days_minus_holidays,
                seconds: average,
                text: wakatime_text(average),
                // AtoAxis has no "Other" language bucket to exclude.
                seconds_including_other_language: average,
                text_including_other_language: wakatime_text(average),
            },
            timezone: summary.calculation.timezone.clone(),
            summary,
            data,
        }
    }
}

#[derive(Debug, Serialize)]
pub struct WakaTimeSummaryDay {
    pub grand_total: WakaTimeGrandTotal,
    pub range: WakaTimeRange,
    pub categories: Vec<WakaTimeSummaryItem>,
    pub projects: Vec<WakaTimeSummaryItem>,
    pub languages: Vec<WakaTimeSummaryItem>,
    pub editors: Vec<WakaTimeSummaryItem>,
    pub operating_systems: Vec<WakaTimeSummaryItem>,
    pub machines: Vec<WakaTimeSummaryItem>,
    pub branches: Vec<WakaTimeSummaryItem>,
    /// Not tracked per interval by AtoAxis; empty rather than invented.
    pub dependencies: Vec<WakaTimeSummaryItem>,
    pub entities: Vec<WakaTimeSummaryItem>,
}

/// Per-dimension `(name, seconds)` totals for one day, already sorted.
pub struct WakaTimeDayTotals {
    pub categories: Vec<(String, f64)>,
    pub projects: Vec<(String, f64)>,
    pub languages: Vec<(String, f64)>,
    pub editors: Vec<(String, f64)>,
    pub operating_systems: Vec<(String, f64)>,
    pub machines: Vec<(String, f64)>,
    pub branches: Vec<(String, f64)>,
}

impl WakaTimeSummaryDay {
    pub fn new(total_seconds: f64, range: WakaTimeRange, totals: WakaTimeDayTotals) -> Self {
        let items = |rows: Vec<(String, f64)>| {
            rows.into_iter()
                .map(|(name, seconds)| WakaTimeSummaryItem::new(name, seconds, total_seconds))
                .collect()
        };
        Self {
            grand_total: WakaTimeGrandTotal::new(total_seconds),
            range,
            categories: items(totals.categories),
            projects: items(totals.projects),
            languages: items(totals.languages),
            editors: items(totals.editors),
            operating_systems: items(totals.operating_systems),
            machines: items(totals.machines),
            branches: items(totals.branches),
            dependencies: Vec::new(),
            entities: Vec::new(),
        }
    }
}

#[derive(Debug, Serialize)]
pub struct WakaTimeGrandTotal {
    pub decimal: String,
    pub digital: String,
    pub hours: u64,
    pub minutes: u64,
    pub text: String,
    pub total_seconds: f64,
}

impl WakaTimeGrandTotal {
    pub fn new(total_seconds: f64) -> Self {
        let (hours, minutes) = hours_minutes(total_seconds);
        Self {
            decimal: wakatime_decimal(total_seconds),
            digital: format!("{hours}:{minutes:02}"),
            hours,
            minutes,
            text: wakatime_text(total_seconds),
            total_seconds: total_seconds.max(0.0),
        }
    }
}

#[derive(Debug, Serialize)]
pub struct WakaTimeSummaryItem {
    pub name: String,
    pub total_seconds: f64,
    pub percent: f64,
    pub digital: String,
    pub decimal: String,
    pub text: String,
    pub hours: u64,
    pub minutes: u64,
    pub seconds: u64,
}

impl WakaTimeSummaryItem {
    fn new(name: String, total_seconds: f64, day_total_seconds: f64) -> Self {
        let whole = total_seconds.max(0.0) as u64;
        let (hours, minutes) = hours_minutes(total_seconds);
        let seconds = whole % 60;
        let percent = if day_total_seconds > 0.0 {
            (total_seconds / day_total_seconds * 10_000.0).round() / 100.0
        } else {
            0.0
        };
        Self {
            name,
            total_seconds: total_seconds.max(0.0),
            percent,
            digital: format!("{hours}:{minutes:02}:{seconds:02}"),
            decimal: wakatime_decimal(total_seconds),
            text: wakatime_text(total_seconds),
            hours,
            minutes,
            seconds,
        }
    }
}

#[derive(Debug, Serialize)]
pub struct WakaTimeRange {
    pub date: String,
    pub start: String,
    pub end: String,
    pub text: String,
    pub timezone: String,
}

impl WakaTimeRange {
    /// `start`/`end` are the local day's UTC bounds; WakaTime reports an inclusive
    /// final second.
    pub fn new(date: chrono::NaiveDate, start: f64, end: f64, timezone: &str) -> Self {
        use chrono::Datelike;
        let rfc3339 = |unix: f64| {
            chrono::DateTime::from_timestamp(unix as i64, 0)
                .map(|time| time.to_rfc3339_opts(chrono::SecondsFormat::Secs, true))
                .unwrap_or_default()
        };
        let suffix = match (date.day() % 10, date.day() % 100) {
            (_, 11..=13) => "th",
            (1, _) => "st",
            (2, _) => "nd",
            (3, _) => "rd",
            _ => "th",
        };
        Self {
            date: date.format("%Y-%m-%d").to_string(),
            start: rfc3339(start),
            end: rfc3339(end - 1.0),
            text: format!(
                "{} {}{suffix} {}",
                date.format("%a %b"),
                date.day(),
                date.year()
            ),
            timezone: timezone.to_string(),
        }
    }
}

#[derive(Debug, Serialize)]
pub struct WakaTimeCumulativeTotal {
    pub seconds: f64,
    pub text: String,
    pub decimal: String,
    pub digital: String,
}

#[derive(Debug, Serialize)]
pub struct WakaTimeDailyAverage {
    pub holidays: u64,
    pub days_including_holidays: u64,
    pub days_minus_holidays: u64,
    pub seconds: f64,
    pub text: String,
    pub seconds_including_other_language: f64,
    pub text_including_other_language: String,
}

pub(crate) fn hours_minutes(seconds: f64) -> (u64, u64) {
    let whole = seconds.max(0.0) as u64;
    (whole / 3600, (whole % 3600) / 60)
}

/// `Mon Sep 1st 2025`, WakaTime's day text.
pub(crate) fn wakatime_day_text(date: chrono::NaiveDate) -> String {
    use chrono::Datelike;
    let suffix = match (date.day() % 10, date.day() % 100) {
        (_, 11..=13) => "th",
        (1, _) => "st",
        (2, _) => "nd",
        (3, _) => "rd",
        _ => "th",
    };
    format!(
        "{} {}{suffix} {}",
        date.format("%a %b"),
        date.day(),
        date.year()
    )
}

pub(crate) fn rfc3339(unix: f64) -> String {
    chrono::DateTime::from_timestamp(unix as i64, 0)
        .map(|time| time.to_rfc3339_opts(chrono::SecondsFormat::Secs, true))
        .unwrap_or_default()
}

/// WakaTime derives `decimal` from the truncated hours and minutes.
pub(crate) fn wakatime_decimal(seconds: f64) -> String {
    let (hours, minutes) = hours_minutes(seconds);
    format!("{:.2}", hours as f64 + minutes as f64 / 60.0)
}

/// WakaTime's duration text: `2 hrs 17 mins`, `1 hr 1 min`, `7 secs`.
pub(crate) fn wakatime_text(seconds: f64) -> String {
    let whole = seconds.max(0.0) as u64;
    let (hours, minutes) = hours_minutes(seconds);
    let plural = |count: u64, unit: &str| {
        if count == 1 {
            format!("1 {unit}")
        } else {
            format!("{count} {unit}s")
        }
    };
    match (hours, minutes) {
        (0, 0) => plural(whole, "sec"),
        (0, minutes) => plural(minutes, "min"),
        (hours, 0) => plural(hours, "hr"),
        (hours, minutes) => format!("{} {}", plural(hours, "hr"), plural(minutes, "min")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::date_range::ResolvedRange;

    fn summary() -> SummariesResponse {
        SummariesResponse {
            calculation: SummaryCalculation {
                timezone: "Asia/Bangkok".to_string(),
                timeout_seconds: 900.0,
                writes_only: false,
                scope: "all_projects_all_categories",
                comparable_metric: "editor_ranges",
                calculation_version: "legacy",
            },
            start: "2026-09-21".to_string(),
            end: "2026-09-22".to_string(),
            days: Vec::new(),
        }
    }

    fn day(date: &str, totals: Vec<(String, f64)>) -> WakaTimeSummaryDay {
        let total: f64 = totals.iter().map(|(_, seconds)| seconds).sum();
        let range = ResolvedRange::parse(date, date, Some("Asia/Bangkok")).unwrap();
        let (start, end) = range.unix_bounds();
        WakaTimeSummaryDay::new(
            total,
            WakaTimeRange::new(range.start, start, end, "Asia/Bangkok"),
            WakaTimeDayTotals {
                categories: vec![("coding".to_string(), total)],
                projects: totals.clone(),
                languages: totals.clone(),
                editors: totals.clone(),
                operating_systems: totals.clone(),
                machines: totals.clone(),
                branches: totals,
            },
        )
    }

    #[test]
    fn response_has_every_key_wakatime_documents_and_keeps_the_atoaxis_fields() {
        let response = WakaTimeSummariesResponse::new(
            summary(),
            vec![
                day(
                    "2026-09-21",
                    vec![("atlas".into(), 7200.0), ("beacon".into(), 1800.0)],
                ),
                day("2026-09-22", Vec::new()),
            ],
        );
        let json = serde_json::to_value(&response).unwrap();
        // https://wakatime.com/developers#summaries
        for key in [
            "data",
            "cumulative_total",
            "daily_average",
            "start",
            "end",
            "timezone",
        ] {
            assert!(json.get(key).is_some(), "missing {key}");
        }
        for key in ["days", "calculation"] {
            assert!(json.get(key).is_some(), "AtoAxis field {key} must stay");
        }
        let first = &json["data"][0];
        for key in [
            "grand_total",
            "range",
            "categories",
            "projects",
            "languages",
            "editors",
            "operating_systems",
            "dependencies",
            "machines",
            "branches",
            "entities",
        ] {
            assert!(first.get(key).is_some(), "missing data[].{key}");
        }
        for key in ["digital", "hours", "minutes", "text", "total_seconds"] {
            assert!(
                first["grand_total"].get(key).is_some(),
                "missing grand_total.{key}"
            );
        }
        for key in ["date", "start", "end", "text", "timezone"] {
            assert!(first["range"].get(key).is_some(), "missing range.{key}");
        }
        for key in [
            "name",
            "total_seconds",
            "percent",
            "digital",
            "text",
            "hours",
            "minutes",
            "seconds",
        ] {
            assert!(
                first["projects"][0].get(key).is_some(),
                "missing item.{key}"
            );
        }
        for key in [
            "holidays",
            "days_including_holidays",
            "days_minus_holidays",
            "seconds",
            "text",
            "seconds_including_other_language",
            "text_including_other_language",
        ] {
            assert!(
                json["daily_average"].get(key).is_some(),
                "missing daily_average.{key}"
            );
        }
        // Integer units: Go/TS clients unmarshal these into ints.
        assert!(first["grand_total"]["hours"].is_u64());
        assert!(first["projects"][0]["minutes"].is_u64());
        assert_eq!(json["timezone"], "Asia/Bangkok");
    }

    #[test]
    fn day_values_use_wakatime_formatting_and_local_bounds() {
        let day = day(
            "2026-09-21",
            vec![("atlas".into(), 7200.0), ("beacon".into(), 1857.0)],
        );
        assert_eq!(day.grand_total.total_seconds, 9057.0);
        assert_eq!(day.grand_total.text, "2 hrs 30 mins");
        assert_eq!(day.grand_total.digital, "2:30");
        assert_eq!(day.grand_total.decimal, "2.50");
        assert_eq!((day.grand_total.hours, day.grand_total.minutes), (2, 30));

        let beacon = &day.projects[1];
        assert_eq!(beacon.text, "30 mins");
        assert_eq!(beacon.digital, "0:30:57");
        assert_eq!(beacon.seconds, 57);
        assert_eq!(beacon.percent, 20.5);
        assert_eq!(day.projects[0].percent, 79.5);

        // Bangkok midnight is 17:00 UTC the previous day.
        assert_eq!(day.range.start, "2026-09-20T17:00:00Z");
        assert_eq!(day.range.end, "2026-09-21T16:59:59Z");
        assert_eq!(day.range.text, "Mon Sep 21st 2026");
        assert!(day.dependencies.is_empty() && day.entities.is_empty());
    }

    #[test]
    fn cumulative_total_and_daily_average_skip_empty_days_like_wakatime() {
        let response = WakaTimeSummariesResponse::new(
            summary(),
            vec![
                day("2026-09-21", vec![("atlas".into(), 3600.0)]),
                day("2026-09-22", Vec::new()),
                day("2026-09-23", vec![("atlas".into(), 1800.0)]),
            ],
        );
        assert_eq!(response.cumulative_total.seconds, 5400.0);
        assert_eq!(response.cumulative_total.text, "1 hr 30 mins");
        assert_eq!(response.daily_average.holidays, 1);
        assert_eq!(response.daily_average.days_including_holidays, 3);
        assert_eq!(response.daily_average.days_minus_holidays, 2);
        assert_eq!(response.daily_average.seconds, 2700.0);
        assert_eq!(response.daily_average.text, "45 mins");
        assert_eq!(day("2026-09-22", Vec::new()).grand_total.text, "0 secs");
    }
}
