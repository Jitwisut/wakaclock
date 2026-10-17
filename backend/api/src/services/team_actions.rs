//! User-authored organizational workflow metadata. Assignment grants no analytics consent.
use super::{team_comparison::Family, team_insights::TeamError};
use anyhow::{ensure, Result};
use chrono::{DateTime, Datelike, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Edit {
    pub request_id: Uuid,
    pub expected_revision: i64,
    pub owner_id: Uuid,
    pub title: String,
    pub focus: String,
    pub family: Family,
    pub baseline_week: NaiveDate,
    pub followup_week: NaiveDate,
    pub status: String,
}
impl Edit {
    pub fn validate(&self, now: DateTime<Utc>) -> Result<()> {
        ensure!(
            !self.request_id.is_nil() && self.expected_revision >= 0,
            TeamError::Invalid("request identity/revision required")
        );
        ensure!(
            !self.owner_id.is_nil()
                && !self.title.trim().is_empty()
                && self.title.chars().count() <= 160
                && !self.title.chars().any(char::is_control),
            TeamError::Invalid("action title/owner invalid")
        );
        ensure!(
            matches!(
                self.focus.as_str(),
                "review_flow"
                    | "tool_evaluation"
                    | "measurement_coverage"
                    | "delivery_reliability"
                    | "work_linking"
            ),
            TeamError::Invalid("action focus invalid")
        );
        ensure!(
            matches!(
                self.status.as_str(),
                "planned" | "active" | "completed" | "cancelled"
            ),
            TeamError::Invalid("action status invalid")
        );
        ensure!(
            self.baseline_week.weekday() == chrono::Weekday::Mon
                && self.followup_week.weekday() == chrono::Weekday::Mon
                && self.followup_week > self.baseline_week,
            TeamError::Invalid("use ordered Monday weeks")
        );
        ensure!(
            self.baseline_week >= (now - chrono::Months::new(12)).date_naive()
                && self.followup_week <= (now + chrono::Months::new(12)).date_naive(),
            TeamError::Invalid("action weeks outside tracking horizon")
        );
        Ok(())
    }
}
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Create {
    pub id: Uuid,
    pub team_id: Option<Uuid>,
    pub edit: Edit,
}
#[derive(Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Delete {
    pub request_id: Uuid,
    pub expected_revision: i64,
}
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct List {
    pub team_id: Option<Uuid>,
    pub after: Option<Uuid>,
    pub limit: Option<i64>,
}
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Action {
    pub organization_id: Uuid,
    pub id: Uuid,
    pub team_id: Option<Uuid>,
    pub owner_id: Uuid,
    pub title: String,
    pub focus: String,
    pub family: Family,
    pub baseline_week: NaiveDate,
    pub followup_week: NaiveDate,
    pub timezone: String,
    pub status: String,
    pub created_by: Uuid,
    pub changed_by: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub revision: i64,
    #[serde(skip_serializing)]
    pub state_hash: String,
    #[serde(skip_serializing)]
    pub deleted: bool,
    #[serde(skip_serializing)]
    pub blocked: bool,
}
#[derive(Debug, Serialize)]
pub struct Page {
    pub actions: Vec<Action>,
    pub next_cursor: Option<Uuid>,
    pub can_manage: bool,
    #[serde(skip)]
    pub proof: String,
}
#[derive(Debug, Serialize)]
pub struct History {
    pub changes: Vec<Action>,
    pub next_revision: Option<i64>,
}
#[derive(Debug, Serialize)]
pub struct Comparison {
    pub action_id: Uuid,
    pub action_revision: i64,
    pub report: super::team_comparison::Report,
    #[serde(skip)]
    pub action_proof: String,
    #[serde(skip)]
    pub team_id: Option<Uuid>,
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn action_validation_keeps_metadata_and_ordered_week_contract() {
        let now = Utc::now();
        let monday = now.date_naive()
            - chrono::Duration::days(now.weekday().num_days_from_monday() as i64 + 7);
        let mut e = Edit {
            request_id: Uuid::new_v4(),
            expected_revision: 0,
            owner_id: Uuid::new_v4(),
            title: "Reduce review wait".into(),
            focus: "review_flow".into(),
            family: Family::TeamCost,
            baseline_week: monday,
            followup_week: monday + chrono::Duration::days(14),
            status: "planned".into(),
        };
        assert!(e.validate(now).is_ok());
        e.title = "source\ntext".into();
        assert!(e.validate(now).is_err());
        e.title = "Evaluate tool".into();
        e.followup_week = monday;
        assert!(e.validate(now).is_err());
        let mut v = serde_json::to_value(&e).unwrap();
        v["raw_prompt"] = serde_json::json!("forbidden");
        assert!(serde_json::from_value::<Edit>(v).is_err());
    }
}
