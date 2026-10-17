//! Rendering of admitted weekly projections. No new aggregate, stored report or causal score.
use crate::{
    model::team_insights::{Metric, TeamInsights},
    services::{copilot_reports, team_actions, team_comparison::Family, team_insights::TeamError},
};
use anyhow::{ensure, Result};
use chrono::{DateTime, Duration, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
pub const VERSION: &str = "team-weekly-summary-v1";
fn include_actions() -> bool {
    true
}
#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Request {
    pub family: Family,
    pub week_start: NaiveDate,
    pub timezone: String,
    pub team_id: Option<Uuid>,
    #[serde(default = "include_actions")]
    pub include_actions: bool,
    pub actions_after: Option<Uuid>,
}
impl Request {
    pub fn validate(&self, now: DateTime<Utc>) -> Result<()> {
        ensure!(
            self.week_start <= now.date_naive()
                && self.week_start >= super::team_trust::cutoff(now).date_naive(),
            TeamError::Invalid("summary week is open or expired")
        );
        ensure!(
            self.include_actions || self.actions_after.is_none(),
            TeamError::Invalid("action cursor requires actions")
        );
        Ok(())
    }
}
#[derive(Debug, Serialize, PartialEq)]
pub struct Cell {
    pub metric: String,
    pub dimension: String,
    pub unit: String,
    pub value: Option<String>,
    pub status: String,
    pub reason: Option<String>,
    pub coverage: Option<f64>,
    pub provenance: String,
    pub updated_at: Option<DateTime<Utc>>,
    pub calculation_version: String,
    pub provider_definition_version: Option<String>,
    pub pricing_versions: Vec<String>,
}
fn metric<T: ToString>(
    name: &str,
    dimension: &str,
    unit: &str,
    m: &Metric<T>,
    prices: &[String],
) -> Cell {
    let readable = matches!(m.status, "complete" | "partial");
    Cell {
        metric: name.into(),
        dimension: dimension.into(),
        unit: unit.into(),
        value: readable
            .then(|| m.value.as_ref().map(ToString::to_string))
            .flatten(),
        status: m.status.into(),
        reason: m.reason.map(String::from),
        coverage: if readable && m.value.is_some() {
            m.coverage
        } else {
            None
        },
        provenance: m.provenance.into(),
        updated_at: m.updated_at,
        calculation_version: m.calculation_version.into(),
        provider_definition_version: None,
        pricing_versions: prices.to_vec(),
    }
}
pub fn cost_cells(r: &TeamInsights) -> Vec<Cell> {
    let prices = &r.merged_pr_cost.pricing_versions;
    let mut rows = vec![
        metric(
            "estimated_ai_cost",
            "all",
            "micro_usd",
            &r.estimated_ai_cost_microusd,
            &[],
        ),
        metric(
            "merged_pr_cost",
            "all",
            "micro_usd",
            &r.merged_pr_cost_microusd,
            prices,
        ),
        metric(
            "average_complete_merged_pr_cost",
            "all",
            "micro_usd",
            &r.merged_pr_cost.average_microusd,
            prices,
        ),
        metric(
            "merged_prs_with_cost",
            "all",
            "pull_requests",
            &r.merged_pr_cost.with_cost,
            prices,
        ),
        metric(
            "merged_prs_without_cost",
            "all",
            "pull_requests",
            &r.merged_pr_cost.without_cost,
            prices,
        ),
        metric(
            "merged_prs_complete_cost",
            "all",
            "pull_requests",
            &r.merged_pr_cost.complete_prs,
            prices,
        ),
    ];
    rows.extend(r.provider_breakdown.iter().map(|p| {
        metric(
            "estimated_ai_cost",
            &format!("{}/{}", p.provider, p.model),
            "micro_usd",
            &p.cost_microusd,
            &[],
        )
    }));
    rows
}
pub fn copilot_cells(r: &copilot_reports::Report) -> Vec<Cell> {
    let barrier = matches!(
        r.status.as_str(),
        "invalidated" | "withheld" | "unavailable"
    );
    r.cells
        .iter()
        .filter(|c| !barrier || c.feature == "all_features")
        .map(|c| {
            let readable = !barrier && matches!(c.status.as_str(), "complete" | "partial");
            let value = if readable {
                c.value.filter(|n| *n >= 0).map(|n| n.to_string())
            } else {
                None
            };
            Cell {
                metric: c.counter.clone(),
                dimension: c.feature.clone(),
                unit: "provider_counter".into(),
                coverage: if value.is_some() { c.coverage } else { None },
                value,
                status: if barrier {
                    r.status.clone()
                } else if c.value.is_some_and(|n| n < 0) {
                    "unavailable".into()
                } else {
                    c.status.clone()
                },
                reason: if barrier {
                    Some("privacy_or_evidence_unconfirmed".into())
                } else if c.value.is_some_and(|n| n < 0) {
                    Some("invalid_provider_counter".into())
                } else {
                    c.reason.clone()
                },
                provenance: r.provenance.clone(),
                updated_at: r.updated_at,
                calculation_version: r.calculation_version.clone(),
                provider_definition_version: Some(r.provider_definition_version.clone()),
                pricing_versions: vec![],
            }
        })
        .collect()
}
#[derive(Debug, Serialize)]
pub struct Summary {
    pub organization_id: Uuid,
    pub team_id: Option<Uuid>,
    pub family: Family,
    pub week_start: NaiveDate,
    pub window_start: DateTime<Utc>,
    pub window_end: DateTime<Utc>,
    pub timezone: String,
    pub checked_at: DateTime<Utc>,
    pub data_status: &'static str,
    pub measurement_health: Vec<String>,
    pub cells: Vec<Cell>,
    pub actions: Vec<team_actions::Action>,
    pub actions_next_cursor: Option<Uuid>,
    pub action_snapshot_at: Option<DateTime<Utc>>,
    pub action_basis: &'static str,
    pub calculation_version: &'static str,
    pub interpretation: &'static str,
    pub production_ready: bool,
    #[serde(skip)]
    pub request: Request,
    #[serde(skip)]
    pub generation: i64,
    #[serde(skip)]
    pub cost_proof: Option<String>,
    #[serde(skip)]
    pub cost_from: Option<u32>,
    #[serde(skip)]
    pub copilot_proof: Option<copilot_reports::Report>,
    #[serde(skip)]
    pub action_proof: Option<String>,
}
pub fn data_status(cells: &[Cell]) -> &'static str {
    if cells.is_empty() {
        "unavailable"
    } else if cells
        .iter()
        .all(|c| c.value.is_some() && c.status == "complete")
    {
        "complete_within_metric_scope"
    } else if cells.iter().all(|c| c.value.is_none()) {
        if cells
            .iter()
            .any(|c| c.status == "withheld" || c.status == "invalidated")
        {
            "withheld"
        } else {
            "unavailable"
        }
    } else {
        "partial"
    }
}
/// Every row contains a single source window. Operational actions are current
/// metadata and have separate observation time; never historical analytics.
pub fn csv(s: &Summary) -> String {
    fn quoted(v: &str) -> String {
        let safe = if v
            .trim_start_matches(' ')
            .starts_with(['=', '+', '-', '@', '\t', '\r', '\n'])
        {
            format!("'{v}")
        } else {
            v.into()
        };
        format!("\"{}\"", safe.replace('"', "\"\""))
    }
    fn row(out: &mut String, v: Vec<String>) {
        out.push_str(&v.iter().map(|v| quoted(v)).collect::<Vec<_>>().join(","));
        out.push_str("\r\n");
    }
    let mut out="row_kind,family,week_start,window_start,window_end,timezone,scope,metric,dimension,unit,value,status,reason,coverage,provenance,updated_at,calculation_version,provider_definition_version,pricing_versions,action_id,action_owner,action_title,action_baseline_week,action_followup_week,action_revision,action_snapshot_at,action_basis\r\n".to_owned();
    let family = match s.family {
        Family::TeamCost => "team_cost",
        Family::Copilot => "copilot",
    };
    let prefix = || {
        vec![
            family.into(),
            s.week_start.to_string(),
            s.window_start.to_rfc3339(),
            s.window_end.to_rfc3339(),
            s.timezone.clone(),
            s.team_id
                .map_or_else(|| "organization".into(), |t| t.to_string()),
        ]
    };
    for c in &s.cells {
        let mut values = vec!["metric".into()];
        values.extend(prefix());
        values.extend([
            c.metric.clone(),
            c.dimension.clone(),
            c.unit.clone(),
            c.value.clone().unwrap_or_default(),
            c.status.clone(),
            c.reason.clone().unwrap_or_default(),
            c.coverage.map(|n| n.to_string()).unwrap_or_default(),
            c.provenance.clone(),
            c.updated_at.map(|t| t.to_rfc3339()).unwrap_or_default(),
            c.calculation_version.clone(),
            c.provider_definition_version.clone().unwrap_or_default(),
            c.pricing_versions.join(";"),
        ]);
        values.resize(27, String::new());
        row(&mut out, values);
    }
    for a in &s.actions {
        let mut values = vec!["action_current_metadata".into()];
        values.extend(prefix());
        values.extend([
            String::new(),
            a.focus.clone(),
            String::new(),
            String::new(),
            a.status.clone(),
            String::new(),
            String::new(),
            "user_authored_workflow_metadata".into(),
            a.updated_at.to_rfc3339(),
            VERSION.into(),
            String::new(),
            String::new(),
            a.id.to_string(),
            a.owner_id.to_string(),
            a.title.clone(),
            a.baseline_week.to_string(),
            a.followup_week.to_string(),
            a.revision.to_string(),
            s.action_snapshot_at
                .map(|t| t.to_rfc3339())
                .unwrap_or_default(),
            s.action_basis.into(),
        ]);
        row(&mut out, values);
    }
    out
}
pub fn end_date(start: NaiveDate) -> Result<NaiveDate> {
    start
        .checked_add_signed(Duration::days(6))
        .ok_or_else(|| TeamError::Invalid("unsupported summary week").into())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn zero_unknown_and_withheld_cannot_be_coerced_to_one_value() {
        let m = Metric {
            value: Some(u64::MAX),
            status: "complete",
            reason: None,
            coverage: Some(1.0),
            provenance: "canonical",
            updated_at: None,
            calculation_version: "v1",
        };
        let mut c = metric("cost", "all", "micro_usd", &m, &[]);
        assert_eq!(c.value.as_deref(), Some("18446744073709551615"));
        assert_eq!(data_status(&[c]), "complete_within_metric_scope");
        let mut hidden = m.clone();
        hidden.status = "withheld";
        c = metric("cost", "all", "micro_usd", &hidden, &[]);
        assert!(c.value.is_none() && c.coverage.is_none());
        hidden.value = Some(0);
        hidden.status = "complete";
        assert_eq!(
            metric("cost", "all", "micro_usd", &hidden, &[])
                .value
                .as_deref(),
            Some("0")
        );
    }
    #[test]
    fn fixed_week_query_rejects_future_expired_or_silent_cursor_adjustment() {
        let now = Utc::now();
        let mut r = Request {
            family: Family::Copilot,
            week_start: now.date_naive() + Duration::days(1),
            timezone: "UTC".into(),
            team_id: None,
            include_actions: false,
            actions_after: None,
        };
        assert!(r.validate(now).is_err());
        r.week_start = now.date_naive() - Duration::days(14);
        r.actions_after = Some(Uuid::new_v4());
        assert!(r.validate(now).is_err());
        r.actions_after = None;
        assert!(r.validate(now).is_ok());
    }
    #[test]
    fn csv_keeps_decimal_units_and_nulls_and_escapes_formula_text() {
        let now = Utc::now();
        let week = NaiveDate::from_ymd_opt(2026, 10, 5).unwrap();
        let known = Metric {
            value: Some(0u64),
            status: "complete",
            reason: None,
            coverage: Some(1.0),
            provenance: "canonical",
            updated_at: Some(now),
            calculation_version: "v1",
        };
        let unknown = Metric::<u64>::unavailable("missing_price");
        let cells = vec![
            metric("cost", " =FORMULA(1)", "micro_usd", &known, &[]),
            metric("cost", "unknown", "micro_usd", &unknown, &[]),
        ];
        let s = Summary {
            organization_id: Uuid::new_v4(),
            team_id: None,
            family: Family::TeamCost,
            week_start: week,
            window_start: now,
            window_end: now,
            timezone: "Asia/Bangkok".into(),
            checked_at: now,
            data_status: "partial",
            measurement_health: vec!["capture_unconfirmed".into()],
            cells,
            actions: vec![],
            actions_next_cursor: None,
            action_snapshot_at: None,
            action_basis: "current_metadata",
            calculation_version: VERSION,
            interpretation: "descriptive",
            production_ready: false,
            request: Request {
                family: Family::TeamCost,
                week_start: week,
                timezone: "Asia/Bangkok".into(),
                team_id: None,
                include_actions: false,
                actions_after: None,
            },
            generation: 1,
            cost_proof: Some("PRIVATE_PROOF_SENTINEL".into()),
            cost_from: Some(1),
            copilot_proof: None,
            action_proof: Some("PRIVATE_ACTION_SENTINEL".into()),
        };
        let output = csv(&s);
        assert!(output.contains("' =FORMULA(1)"));
        assert!(output.contains("\"micro_usd\",\"0\""));
        assert!(output.contains("\"micro_usd\",\"\",\"unavailable\""));
        assert!(output.lines().all(|l| l.split(',').count() == 27));
        assert!(!output.contains("SENTINEL"));
        assert!(!serde_json::to_string(&s).unwrap().contains("SENTINEL"));
    }
}
