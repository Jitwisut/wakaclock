//! Descriptive transforms of already admitted weekly cells. Never queries raw facts.
use crate::model::team_insights::{Metric, TeamInsights};
use anyhow::{ensure, Result};
use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use uuid::Uuid;

pub fn enabled() -> bool {
    std::env::var("ATOAXIS_TEAM_WORKFLOW_ENABLED")
        .ok()
        .as_deref()
        == Some("1")
}
pub const VERSION: &str = "admitted-weekly-comparison-v1";
#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Family {
    TeamCost,
    Copilot,
}
#[derive(Clone, Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Request {
    pub family: Family,
    pub baseline_week: NaiveDate,
    pub followup_week: NaiveDate,
    pub timezone: String,
    pub team_id: Option<Uuid>,
}
#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct Reading {
    pub value: Option<u64>,
    pub status: String,
    pub reason: Option<String>,
    pub coverage: Option<f64>,
    pub definition: String,
    pub unit: String,
    pub provenance: String,
}
#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct Snapshot {
    pub organization_id: Uuid,
    pub team_id: Option<Uuid>,
    pub family: Family,
    pub week_start: NaiveDate,
    pub timezone: String,
    pub generation: i64,
    pub updated_at: Option<DateTime<Utc>>,
    pub pricing_versions: Vec<String>,
    pub measurement_health: Vec<String>,
    pub cells: BTreeMap<String, Reading>,
}
#[derive(Debug, Serialize)]
pub struct Change {
    pub metric: String,
    pub unit: String,
    pub baseline_value: Option<String>,
    pub followup_value: Option<String>,
    /// Decimal signed integer avoids overflow and JavaScript rounding of the delta.
    pub difference: Option<String>,
    pub percent_change: Option<f64>,
    pub status: &'static str,
    pub reason: &'static str,
    pub baseline_coverage: Option<f64>,
    pub followup_coverage: Option<f64>,
}
#[derive(Debug, Serialize)]
pub struct Report {
    pub baseline: Snapshot,
    pub followup: Snapshot,
    pub changes: Vec<Change>,
    pub calculation_version: &'static str,
    pub interpretation: &'static str,
    pub pricing_changed: Option<bool>,
    #[serde(skip)]
    pub request: Request,
    #[serde(skip)]
    pub cost_source_proof: Option<String>,
    #[serde(skip)]
    pub cost_source_from: Option<u32>,
    #[serde(skip)]
    pub copilot_proof: Option<(
        super::copilot_reports::Report,
        super::copilot_reports::Report,
    )>,
}
fn cost_reading(metric: &Metric<u64>) -> Reading {
    Reading {
        value: metric.value,
        status: metric.status.into(),
        reason: metric.reason.map(String::from),
        coverage: metric.coverage,
        definition: metric.calculation_version.into(),
        unit: "micro_usd".into(),
        provenance: metric.provenance.into(),
    }
}
pub fn team_snapshot(report: &TeamInsights) -> Result<Snapshot> {
    Ok(Snapshot {
        organization_id: report.organization_id,
        team_id: report.team_id,
        family: Family::TeamCost,
        week_start: NaiveDate::parse_from_str(&report.start, "%Y-%m-%d")?,
        timezone: report.timezone.clone(),
        generation: report.generation,
        updated_at: report.estimated_ai_cost_microusd.updated_at,
        pricing_versions: report.merged_pr_cost.pricing_versions.clone(),
        measurement_health: report
            .measurement_health
            .iter()
            .map(|x| (*x).into())
            .collect(),
        cells: [
            (
                "estimated_ai_cost_microusd".into(),
                cost_reading(&report.estimated_ai_cost_microusd),
            ),
            (
                "merged_pr_cost_microusd".into(),
                cost_reading(&report.merged_pr_cost_microusd),
            ),
        ]
        .into(),
    })
}
pub fn copilot_snapshot(report: &super::copilot_reports::Report) -> Snapshot {
    Snapshot {
        organization_id: report.organization_id,
        team_id: report.team_id,
        family: Family::Copilot,
        week_start: report.week_start,
        timezone: report.timezone.clone(),
        generation: report.generation,
        updated_at: report.updated_at,
        pricing_versions: vec![],
        measurement_health: vec![
            format!("capture:{}", report.capture_status),
            format!("ingestion:{}", report.ingestion_status),
        ],
        cells: report
            .cells
            .iter()
            .map(|c| {
                (
                    format!("{}:{}", c.feature, c.counter),
                    Reading {
                        value: c.value.and_then(|x| u64::try_from(x).ok()),
                        status: c.status.clone(),
                        reason: c.reason.clone(),
                        coverage: c.coverage,
                        definition: format!(
                            "{}:{}:{}",
                            report.calculation_version,
                            report.provider_definition_version,
                            c.counter
                        ),
                        unit: if c.counter.contains("loc_") {
                            "lines"
                        } else {
                            "provider_counter"
                        }
                        .into(),
                        provenance: report.provenance.clone(),
                    },
                )
            })
            .collect(),
    }
}
pub fn compare(mut baseline: Snapshot, mut followup: Snapshot, request: Request) -> Result<Report> {
    ensure!(
        baseline.organization_id == followup.organization_id
            && baseline.team_id == followup.team_id
            && baseline.team_id == request.team_id
            && baseline.family == followup.family
            && baseline.family == request.family
            && baseline.timezone == followup.timezone
            && baseline.timezone == request.timezone
            && baseline.generation == followup.generation
            && baseline.week_start == request.baseline_week
            && followup.week_start == request.followup_week
            && baseline.week_start + chrono::Duration::days(7) <= followup.week_start,
        "comparison_scope_definition_or_generation_changed"
    );
    for snapshot in [&mut baseline, &mut followup] {
        for reading in snapshot.cells.values_mut() {
            if !["observed", "partial", "complete"].contains(&reading.status.as_str()) {
                reading.value = None;
                reading.coverage = None;
            }
        }
    }
    let keys = baseline
        .cells
        .keys()
        .chain(followup.cells.keys())
        .cloned()
        .collect::<std::collections::BTreeSet<_>>();
    let mut changes = Vec::new();
    for metric in keys {
        let a = baseline.cells.get(&metric);
        let b = followup.cells.get(&metric);
        let compatible = matches!((a,b),(Some(a),Some(b)) if a.definition==b.definition && a.unit==b.unit && a.provenance==b.provenance);
        let values = if compatible {
            a.and_then(|a| a.value).zip(b.and_then(|b| b.value))
        } else {
            None
        };
        let admissible = matches!((a,b),(Some(a),Some(b)) if ["observed","partial","complete"].contains(&a.status.as_str()) && ["observed","partial","complete"].contains(&b.status.as_str()));
        let values = values.filter(|_| admissible);
        let delta = values.map(|(a, b)| b as i128 - a as i128);
        changes.push(Change {
            metric,
            unit: a.or(b).map(|x| x.unit.clone()).unwrap_or_default(),
            baseline_value: a.and_then(|x| x.value).map(|x| x.to_string()),
            followup_value: b.and_then(|x| x.value).map(|x| x.to_string()),
            difference: delta.map(|d| d.to_string()),
            percent_change: values.and_then(|(a, b)| {
                if a == 0 {
                    None
                } else {
                    Some((b as i128 - a as i128) as f64 / a as f64 * 100.0)
                }
            }),
            status: if values.is_some() {
                "observed_difference"
            } else {
                "unavailable"
            },
            reason: if !compatible {
                "metric_definition_or_evidence_missing"
            } else if values.is_none() {
                "withheld_or_unavailable_input"
            } else if values.is_some_and(|(a, _)| a == 0) {
                "baseline_zero_percent_unavailable"
            } else {
                "descriptive_not_causal"
            },
            baseline_coverage: a.and_then(|x| x.coverage),
            followup_coverage: b.and_then(|x| x.coverage),
        });
    }
    let pricing_changed = (!baseline.pricing_versions.is_empty()
        && !followup.pricing_versions.is_empty())
    .then(|| baseline.pricing_versions != followup.pricing_versions);
    Ok(Report {
        baseline,
        followup,
        changes,
        calculation_version: VERSION,
        interpretation: "descriptive_change_no_ai_causality_or_employee_ranking",
        pricing_changed,
        request,
        copilot_proof: None,
        cost_source_proof: None,
        cost_source_from: None,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    fn input(a: Option<u64>, b: Option<u64>) -> (Snapshot, Snapshot, Request) {
        let week = NaiveDate::from_ymd_opt(2026, 10, 5).unwrap();
        let req = Request {
            family: Family::TeamCost,
            baseline_week: week,
            followup_week: week + chrono::Duration::days(7),
            timezone: "Asia/Bangkok".into(),
            team_id: None,
        };
        let reading = |v| Reading {
            value: v,
            status: if v.is_some() { "partial" } else { "withheld" }.into(),
            reason: None,
            coverage: None,
            definition: "v1".into(),
            unit: "micro_usd".into(),
            provenance: "canonical".into(),
        };
        let snap = |w, v| Snapshot {
            organization_id: Uuid::nil(),
            team_id: None,
            family: Family::TeamCost,
            week_start: w,
            timezone: req.timezone.clone(),
            generation: 1,
            updated_at: None,
            pricing_versions: vec![],
            measurement_health: vec!["capture_unconfirmed".into()],
            cells: [("cost".into(), reading(v))].into(),
        };
        (snap(week, a), snap(req.followup_week, b), req)
    }
    #[test]
    fn zero_unknown_and_large_signed_difference() {
        let (a, b, r) = input(Some(0), Some(u64::MAX));
        let x = compare(a, b, r).unwrap();
        assert_eq!(
            x.changes[0].difference.as_deref(),
            Some("18446744073709551615")
        );
        assert!(x.changes[0].percent_change.is_none());
        let (a, b, r) = input(None, Some(5));
        let x = compare(a, b, r).unwrap();
        assert!(x.changes[0].difference.is_none());
        assert!(x.changes[0].baseline_value.is_none());
    }
    #[test]
    fn incompatible_definition_and_scope_fail_closed() {
        let (a, mut b, r) = input(Some(10), Some(20));
        b.cells.get_mut("cost").unwrap().definition = "v2".into();
        assert!(compare(a, b, r).unwrap().changes[0].difference.is_none());
        let (a, mut b, r) = input(Some(10), Some(20));
        b.generation = 2;
        assert!(compare(a, b, r).is_err());
        let (a, mut b, r) = input(Some(10), Some(20));
        b.timezone = "UTC".into();
        assert!(compare(a, b, r).is_err());
        let (a, b, mut r) = input(Some(10), Some(20));
        r.followup_week = r.baseline_week;
        assert!(compare(a, b, r).is_err());
    }
    #[test]
    fn partial_coverage_and_pricing_change_remain_explicit() {
        let (mut a, mut b, r) = input(Some(10), Some(15));
        a.pricing_versions.push("old_catalog".into());
        b.pricing_versions.push("new_catalog".into());
        let x = compare(a, b, r).unwrap();
        assert_eq!(x.pricing_changed, Some(true));
        assert_eq!(x.changes[0].difference.as_deref(), Some("5"));
        assert_eq!(x.changes[0].percent_change, Some(50.0));
        assert!(x.changes[0].followup_coverage.is_none());
        let encoded = serde_json::to_value(&x).unwrap();
        assert!(encoded.get("request").is_none());
        assert!(encoded.get("copilot_proof").is_none());
        assert!(x.interpretation.contains("no_ai_causality"));
    }
}
