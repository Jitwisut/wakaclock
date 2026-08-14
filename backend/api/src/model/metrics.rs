//! Shared metric vocabulary for the Phase 9 analytics APIs (plan.md 9.2, 9.7, 9.8).
//!
//! The dashboard's cards mix fundamentally different quantities — models are counted in
//! AI line changes, editors and languages in active seconds, spend in estimated currency
//! — so every value that crosses the API carries the metric it measures and the unit it
//! is measured in. Without that, a frontend has no way to know whether `47520` is
//! seconds, lines or micro-dollars, and percentaging one against another silently
//! produces a number that means nothing.

use serde::{Deserialize, Serialize};

/// What a value counts. Distinct from [`Unit`]: two metrics can share a unit
/// (`active_duration` and a future `ai_duration` are both seconds) while remaining
/// different quantities that must never be summed or percentaged against each other.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Metric {
    /// Editor-observed active duration, after the existing idle/gap rules.
    ActiveDuration,
    /// Lines an AI agent added plus deleted.
    AiLinesChanged,
    /// Lines attributed to a human after correlation.
    HumanLinesChanged,
    /// Observed lines whose provenance could not be proven either way.
    UnattributedLinesChanged,
    /// Count of user-prompt submissions — not messages, tool calls or retries.
    PromptCount,
    /// Count of distinct stable AI session IDs.
    SessionCount,
    /// Provider-reported tokens.
    TokenCount,
    /// Cost estimate under the price version effective at usage time.
    EstimatedCost,
}

impl Metric {
    /// The unit a metric is always expressed in. Pairing is fixed here rather than at
    /// each call site so a response can never claim, say, lines measured in seconds.
    pub fn unit(self) -> Unit {
        match self {
            Self::ActiveDuration => Unit::Seconds,
            Self::AiLinesChanged | Self::HumanLinesChanged | Self::UnattributedLinesChanged => {
                Unit::Lines
            }
            Self::PromptCount => Unit::Prompts,
            Self::SessionCount => Unit::Sessions,
            Self::TokenCount => Unit::Tokens,
            Self::EstimatedCost => Unit::MicroUsd,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Unit {
    Seconds,
    Lines,
    Prompts,
    Sessions,
    Tokens,
    MicroUsd,
}

/// One slice of a breakdown (a donut segment, a table row).
///
/// `percentage` is computed server-side from the same total the response reports, so the
/// frontend cannot arrive at a different denominator by summing a paginated page and
/// treating it as the whole account (plan.md 9.8).
#[derive(Debug, Clone, Serialize)]
pub struct BreakdownItem {
    pub name: String,
    pub value: i64,
    pub metric: Metric,
    pub unit: Unit,
    pub percentage: f64,
    /// Pre-formatted for display. Raw `value` is always present too, so a client never
    /// has to parse this back into a number.
    pub text: String,
}

/// A named breakdown plus the metric every item in it shares.
#[derive(Debug, Clone, Serialize)]
pub struct Breakdown {
    pub metric: Metric,
    pub unit: Unit,
    pub total: i64,
    pub items: Vec<BreakdownItem>,
}

impl Breakdown {
    /// Build a breakdown, computing each share against the summed total.
    ///
    /// A zero total yields zero percentages rather than `NaN` from dividing by zero —
    /// an empty range is a legitimate answer, not an error.
    pub fn new(metric: Metric, entries: Vec<(String, i64)>) -> Self {
        let total: i64 = entries.iter().map(|(_, value)| *value).sum();
        let items = entries
            .into_iter()
            .map(|(name, value)| BreakdownItem {
                name,
                value,
                metric,
                unit: metric.unit(),
                percentage: if total > 0 {
                    (value as f64 / total as f64) * 100.0
                } else {
                    0.0
                },
                text: format_value(metric, value),
            })
            .collect();

        Self {
            metric,
            unit: metric.unit(),
            total,
            items,
        }
    }
}

/// Human-readable rendering for a metric's value.
pub fn format_value(metric: Metric, value: i64) -> String {
    match metric.unit() {
        Unit::Seconds => format_duration(value),
        Unit::MicroUsd => format!("{:.2}", value as f64 / 1_000_000.0),
        _ => value.to_string(),
    }
}

/// `9000 -> "2h 30m"`. Minutes are shown even at exact hours so widths stay stable in a
/// column, and sub-minute durations report as `"0m"` rather than vanishing to an empty
/// string.
pub fn format_duration(total_seconds: i64) -> String {
    let seconds = total_seconds.max(0);
    let hours = seconds / 3600;
    let minutes = (seconds % 3600) / 60;
    if hours > 0 {
        format!("{hours}h {minutes}m")
    } else {
        format!("{minutes}m")
    }
}

/// Which way a period-over-period comparison moved.
///
/// `NewActivity` exists because "went from zero to something" has no meaningful
/// percentage — reporting infinity, or silently substituting 100%, would both be lies
/// (plan.md 9.7).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ChangeDirection {
    Increase,
    Decrease,
    Unchanged,
    NewActivity,
}

/// Current period against the immediately preceding period of equal length.
///
/// Both raw totals are returned alongside the percentage so the frontend never has to
/// reverse-engineer them out of formatted text.
#[derive(Debug, Clone, Serialize)]
pub struct PeriodComparison {
    pub current_seconds: i64,
    pub previous_seconds: i64,
    /// `None` when a percentage would be meaningless — see [`ChangeDirection::NewActivity`].
    pub percent: Option<f64>,
    pub direction: ChangeDirection,
}

impl PeriodComparison {
    pub fn new(current_seconds: i64, previous_seconds: i64) -> Self {
        let (percent, direction) = match (current_seconds, previous_seconds) {
            (0, 0) => (Some(0.0), ChangeDirection::Unchanged),
            (current, 0) if current > 0 => (None, ChangeDirection::NewActivity),
            (current, previous) => {
                let change = ((current - previous) as f64 / previous as f64) * 100.0;
                let direction = if current > previous {
                    ChangeDirection::Increase
                } else if current < previous {
                    ChangeDirection::Decrease
                } else {
                    ChangeDirection::Unchanged
                };
                (Some(change), direction)
            }
        };

        Self {
            current_seconds,
            previous_seconds,
            percent,
            direction,
        }
    }
}

/// Daily-average variants, kept separate because they answer different questions and
/// differ sharply for anyone who doesn't code every day (plan.md 9.7).
#[derive(Debug, Clone, Copy, Serialize)]
pub struct DailyAverages {
    /// Averaged over days that had any activity — "how long is a working day".
    pub active_day_average_seconds: i64,
    /// Averaged over every calendar day in the range, including empty ones.
    pub calendar_day_average_seconds: i64,
}

impl DailyAverages {
    pub fn new(daily_totals: &[i64], days_in_range: i64) -> Self {
        let total: i64 = daily_totals.iter().sum();
        let active_days = daily_totals.iter().filter(|value| **value > 0).count() as i64;

        Self {
            active_day_average_seconds: if active_days > 0 {
                total / active_days
            } else {
                0
            },
            calendar_day_average_seconds: if days_in_range > 0 {
                total / days_in_range
            } else {
                0
            },
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn metric_unit_pairing_is_fixed() {
        assert_eq!(Metric::ActiveDuration.unit(), Unit::Seconds);
        assert_eq!(Metric::AiLinesChanged.unit(), Unit::Lines);
        assert_eq!(Metric::EstimatedCost.unit(), Unit::MicroUsd);
    }

    #[test]
    fn breakdown_percentages_use_the_reported_total() {
        let breakdown = Breakdown::new(
            Metric::ActiveDuration,
            vec![("Rust".to_string(), 75), ("TypeScript".to_string(), 25)],
        );

        assert_eq!(breakdown.total, 100);
        assert!((breakdown.items[0].percentage - 75.0).abs() < f64::EPSILON);
        assert!((breakdown.items[1].percentage - 25.0).abs() < f64::EPSILON);
        assert_eq!(breakdown.items[0].unit, Unit::Seconds);
    }

    #[test]
    fn empty_breakdown_reports_zero_rather_than_nan() {
        let breakdown = Breakdown::new(Metric::ActiveDuration, vec![("Rust".to_string(), 0)]);
        assert_eq!(breakdown.total, 0);
        assert_eq!(breakdown.items[0].percentage, 0.0);
        assert!(breakdown.items[0].percentage.is_finite());
    }

    #[test]
    fn duration_formatting_keeps_stable_shape() {
        assert_eq!(format_duration(9_000), "2h 30m");
        assert_eq!(format_duration(3_600), "1h 0m");
        assert_eq!(format_duration(59), "0m");
        assert_eq!(format_duration(-5), "0m");
    }

    #[test]
    fn cost_formats_from_micro_usd() {
        assert_eq!(format_value(Metric::EstimatedCost, 119_000_000), "119.00");
    }

    /// plan.md 9.7: going from nothing to something has no percentage. Infinity, or a
    /// silent 100%, would both misreport it.
    #[test]
    fn zero_to_positive_is_new_activity_with_no_percentage() {
        let comparison = PeriodComparison::new(114_000, 0);
        assert_eq!(comparison.direction, ChangeDirection::NewActivity);
        assert_eq!(comparison.percent, None);
        assert_eq!(comparison.current_seconds, 114_000);
    }

    #[test]
    fn zero_to_zero_is_unchanged_at_zero_percent() {
        let comparison = PeriodComparison::new(0, 0);
        assert_eq!(comparison.direction, ChangeDirection::Unchanged);
        assert_eq!(comparison.percent, Some(0.0));
    }

    #[test]
    fn increase_and_decrease_report_signed_percentages() {
        let up = PeriodComparison::new(150, 100);
        assert_eq!(up.direction, ChangeDirection::Increase);
        assert!((up.percent.unwrap() - 50.0).abs() < 1e-9);

        let down = PeriodComparison::new(50, 100);
        assert_eq!(down.direction, ChangeDirection::Decrease);
        assert!((down.percent.unwrap() + 50.0).abs() < 1e-9);
    }

    /// The two averages must stay distinct: someone who codes hard on two days out of
    /// seven has a long working day and a low weekly average, and conflating them
    /// misrepresents both.
    #[test]
    fn active_day_and_calendar_day_averages_differ() {
        let daily = [3_600, 0, 0, 7_200, 0, 0, 0];
        let averages = DailyAverages::new(&daily, 7);

        assert_eq!(averages.active_day_average_seconds, 5_400);
        assert_eq!(averages.calendar_day_average_seconds, 1_542);
    }

    #[test]
    fn averages_over_an_empty_range_are_zero_not_a_division_by_zero() {
        let averages = DailyAverages::new(&[], 0);
        assert_eq!(averages.active_day_average_seconds, 0);
        assert_eq!(averages.calendar_day_average_seconds, 0);
    }
}
