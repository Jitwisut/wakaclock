//! Fixed UTC weekly provider counters. No activity, token or cost allocation.
use super::copilot_daily::COUNTERS;
use anyhow::{ensure, Result};
use chrono::{DateTime, Datelike, Duration, NaiveDate, Utc, Weekday};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};
use uuid::Uuid;

pub const VERSION: &str = "copilot-weekly-v1";
pub fn enabled() -> bool {
    super::copilot_daily::enabled()
        && crate::config::opt_in_env_flag("ATOAXIS_COPILOT_WEEKLY_ENABLED")
}
pub fn week(
    start: NaiveDate,
    timezone: &str,
    now: DateTime<Utc>,
) -> Result<(DateTime<Utc>, DateTime<Utc>)> {
    ensure!(
        timezone == "UTC" && start.weekday() == Weekday::Mon,
        "copilot_closed_utc_week_required"
    );
    let from = start.and_hms_opt(0, 0, 0).unwrap().and_utc();
    let to = from + Duration::days(7);
    ensure!(
        to <= now && from >= super::team_trust::cutoff(now),
        "copilot_week_open_or_expired"
    );
    Ok((from, to))
}
#[derive(Clone, Debug)]
pub struct Fact {
    pub user: Uuid,
    pub day: NaiveDate,
    pub feature: String,
    pub metrics: BTreeMap<String, Option<i64>>,
    pub teams: BTreeSet<Uuid>,
    /// Stable provider account/user/day/feature identity, never a revision/hash/scope.
    pub identity: String,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Cell {
    pub feature: String,
    pub counter: String,
    pub value: Option<i64>,
    pub status: String,
    pub reason: Option<String>,
    pub coverage: Option<f64>,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ScopeReport {
    pub team_id: Option<Uuid>,
    pub cells: Vec<Cell>,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Bundle {
    pub scopes: Vec<ScopeReport>,
    // Private proof fields; never returned by HTTP or CSV.
    pub people: BTreeSet<Uuid>,
    pub facts: BTreeSet<String>,
}
#[derive(Clone)]
struct Candidate {
    scope: Option<Uuid>,
    feature: String,
    counter: String,
    value: i64,
}
fn applies(f: &Fact, c: &Candidate) -> bool {
    (c.scope.is_none() || c.scope.is_some_and(|t| f.teams.contains(&t)))
        && (c.feature == "all_features" || c.feature == f.feature)
}
/// Per-user atomic coordinate incidence, not merely a contributor count. Every
/// distinguishable positive/zero/null/missing/scope cohort must contain >=5 people.
fn refine(
    previous: &[Vec<Uuid>],
    c: &Candidate,
    index: &BTreeMap<(Uuid, NaiveDate, &str), &Fact>,
    features: &BTreeSet<&str>,
    start: NaiveDate,
) -> Option<Vec<Vec<Uuid>>> {
    let mut result = Vec::new();
    for group in previous {
        let mut partition = BTreeMap::<Vec<u8>, Vec<Uuid>>::new();
        for user in group {
            let mut signature = Vec::new();
            for offset in 0..7 {
                for feature in features {
                    if c.feature != "all_features" && c.feature != *feature {
                        continue;
                    }
                    let day = start + Duration::days(offset);
                    signature.push(match index.get(&(*user, day, *feature)) {
                        None => 1,
                        Some(f) if !applies(f, c) => 0,
                        Some(f) => match f.metrics.get(&c.counter).copied().flatten() {
                            None => 2,
                            Some(0) => 3,
                            Some(_) => 4,
                        },
                    });
                }
            }
            partition.entry(signature).or_default().push(*user);
        }
        if partition.values().any(|p| p.len() < 5) {
            return None;
        }
        result.extend(partition.into_values());
    }
    Some(result)
}

pub fn project(
    facts: &[Fact],
    universe: &BTreeSet<Uuid>,
    teams: &BTreeSet<Uuid>,
    start: NaiveDate,
) -> Result<Bundle> {
    ensure!(
        facts.len() <= 100 * 7 * 64 && universe.len() <= 100,
        "copilot_report_scope_limit"
    );
    let mut index = BTreeMap::new();
    for f in facts {
        ensure!(
            f.day >= start && f.day < start + Duration::days(7) && universe.contains(&f.user),
            "copilot_report_fact_scope"
        );
        ensure!(
            f.metrics.keys().all(|k| COUNTERS.contains(&k.as_str()))
                && f.metrics.values().flatten().all(|n| *n >= 0),
            "copilot_report_counter_invalid"
        );
        ensure!(
            index
                .insert((f.user, f.day, &f.feature), &f.identity)
                .is_none(),
            "copilot_duplicate_provider_dimension"
        );
    }
    let features: BTreeSet<String> = facts.iter().map(|f| f.feature.clone()).collect();
    ensure!(
        !features.contains("all_features") && features.len() <= 64,
        "copilot_feature_limit"
    );
    let mut scopes = vec![None];
    scopes.extend(teams.iter().copied().map(Some));
    ensure!(scopes.len() <= 101, "copilot_scope_limit");
    let coordinate_index: BTreeMap<_, _> = facts
        .iter()
        .map(|f| ((f.user, f.day, f.feature.as_str()), f))
        .collect();
    let coordinates: BTreeSet<_> = features.iter().map(String::as_str).collect();
    let mut partition = vec![universe.iter().copied().collect::<Vec<_>>()];
    let mut admitted = Vec::<Candidate>::new();
    let mut reports = Vec::new();
    for scope in scopes {
        let mut cells = Vec::new();
        // Ordering depends only on scope/feature/counter names, never sums or caller.
        for feature in std::iter::once("all_features".to_owned()).chain(features.iter().cloned()) {
            let mut feature_cells = Vec::new();
            for counter in COUNTERS {
                let mut c = Candidate {
                    scope,
                    feature: feature.clone(),
                    counter: (*counter).into(),
                    value: 0,
                };
                let mut measured = BTreeSet::new();
                for f in facts {
                    if !applies(f, &c) {
                        continue;
                    }
                    if let Some(n) = f.metrics.get(*counter).copied().flatten() {
                        c.value = c
                            .value
                            .checked_add(n)
                            .ok_or_else(|| anyhow::anyhow!("copilot_counter_overflow"))?;
                        measured.insert(f.user);
                    }
                }
                let refined = if measured.len() >= 5 {
                    refine(&partition, &c, &coordinate_index, &coordinates, start)
                } else {
                    None
                };
                let allowed = refined.is_some();
                if let Some(next) = refined {
                    partition = next;
                    admitted.push(c.clone());
                }
                feature_cells.push(Cell {
                    feature: feature.clone(),
                    counter: (*counter).into(),
                    value: allowed.then_some(c.value),
                    status: if allowed { "partial" } else { "withheld" }.into(),
                    reason: Some(
                        if allowed {
                            "observed_only_capture_unconfirmed"
                        } else {
                            "privacy_or_evidence_unconfirmed"
                        }
                        .into(),
                    ),
                    coverage: None,
                });
            }
            // Do not leak the existence of a rare observed feature through null rows.
            if feature == "all_features" || feature_cells.iter().any(|c| c.value.is_some()) {
                cells.extend(feature_cells);
            }
        }
        reports.push(ScopeReport {
            team_id: scope,
            cells,
        });
    }
    let mut people = BTreeSet::new();
    let mut support = BTreeSet::new();
    for c in &admitted {
        for f in facts.iter().filter(|f| applies(f, c)) {
            if f.metrics.get(&c.counter).copied().flatten().is_some() {
                people.insert(f.user);
                support.insert(format!("{}:{}", f.identity, c.counter));
            }
        }
    }
    Ok(Bundle {
        scopes: reports,
        people,
        facts: support,
    })
}
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Report {
    pub organization_id: Uuid,
    pub team_id: Option<Uuid>,
    pub week_start: NaiveDate,
    pub window_start: DateTime<Utc>,
    pub window_end: DateTime<Utc>,
    pub timezone: String,
    pub organization_timezone: String,
    pub status: String,
    pub cells: Vec<Cell>,
    pub provenance: String,
    pub calculation_version: String,
    pub provider_definition_version: String,
    pub updated_at: Option<DateTime<Utc>>,
    pub ingestion_status: String,
    pub capture_status: String,
    pub generation: i64,
    pub source_revision: String,
    pub publication_id: Option<String>,
    #[serde(skip)]
    pub fence: String,
}
impl Report {
    pub fn hide(&mut self, status: &str) {
        self.status = status.into();
        self.cells.retain(|c| c.feature == "all_features");
        for cell in &mut self.cells {
            cell.value = None;
            cell.coverage = None;
            cell.status = status.into();
            cell.reason = Some("privacy_or_evidence_unconfirmed".into());
        }
        self.publication_id = None;
    }
}
pub fn csv(report: &Report) -> String {
    fn cell(s: &str) -> String {
        let safe = if s.starts_with(['=', '+', '-', '@', '\t', '\r', '\n']) {
            format!("'{s}")
        } else {
            s.to_owned()
        };
        format!("\"{}\"", safe.replace('"', "\"\""))
    }
    let mut out = "week_start,window_start,window_end,timezone,scope,feature,counter,value,status,reason,coverage,provenance,calculation_version,provider_definition_version,updated_at,source_revision,publication_id\r\n".to_owned();
    for c in &report.cells {
        let fields = [
            report.week_start.to_string(),
            report.window_start.to_rfc3339(),
            report.window_end.to_rfc3339(),
            report.timezone.clone(),
            report
                .team_id
                .map_or_else(|| "organization".into(), |t| t.to_string()),
            c.feature.clone(),
            c.counter.clone(),
            c.value.map_or(String::new(), |v| v.to_string()),
            c.status.clone(),
            c.reason.clone().unwrap_or_default(),
            String::new(),
            report.provenance.clone(),
            report.calculation_version.clone(),
            report.provider_definition_version.clone(),
            report
                .updated_at
                .map_or(String::new(), |at| at.to_rfc3339()),
            report.source_revision.clone(),
            report.publication_id.clone().unwrap_or_default(),
        ];
        out.push_str(&fields.iter().map(|f| cell(f)).collect::<Vec<_>>().join(","));
        out.push_str("\r\n");
    }
    out
}
#[cfg(test)]
mod tests {
    use super::*;
    fn fixture(n: usize) -> (Vec<Fact>, BTreeSet<Uuid>) {
        let start = NaiveDate::from_ymd_opt(2026, 9, 28).unwrap();
        let users = (1..=n)
            .map(|n| Uuid::from_u128(n as u128))
            .collect::<BTreeSet<_>>();
        let mut facts = Vec::new();
        for user in &users {
            for d in 0..7 {
                facts.push(Fact {
                    user: *user,
                    day: start + Duration::days(d),
                    feature: "completion".into(),
                    metrics: COUNTERS.iter().map(|c| ((*c).into(), Some(1))).collect(),
                    teams: BTreeSet::new(),
                    identity: format!("account:github:{user}:{d}:completion"),
                });
            }
        }
        (facts, users)
    }
    fn build(f: &[Fact], p: &BTreeSet<Uuid>, t: &BTreeSet<Uuid>) -> Bundle {
        project(f, p, t, NaiveDate::from_ymd_opt(2026, 9, 28).unwrap()).unwrap()
    }
    #[test]
    fn thresholds_zero_null_and_independent_ledger() {
        let (f, p) = fixture(4);
        assert!(build(&f, &p, &BTreeSet::new()).people.is_empty());
        let (mut f, p) = fixture(5);
        let b = build(&f, &p, &BTreeSet::new());
        assert_eq!(b.scopes[0].cells[0].value, Some(35));
        for x in &mut f {
            x.metrics.insert(COUNTERS[0].into(), Some(0));
            x.metrics.insert(COUNTERS[1].into(), None);
        }
        let b = build(&f, &p, &BTreeSet::new());
        assert_eq!(b.scopes[0].cells[0].value, Some(0));
        assert_eq!(b.scopes[0].cells[1].value, None);
    }
    #[test]
    fn zero_padding_and_rare_feature_never_publish() {
        let (mut f, p) = fixture(5);
        for x in &mut f {
            if x.user != Uuid::from_u128(1) {
                x.metrics.insert(COUNTERS[0].into(), Some(0));
            }
        }
        assert_eq!(
            build(&f, &p, &BTreeSet::new()).scopes[0].cells[0].value,
            None
        );
        f[0].feature = "rare_secret".into();
        assert!(build(&f, &p, &BTreeSet::new()).scopes[0]
            .cells
            .iter()
            .all(|c| c.feature != "rare_secret"));
    }
    #[test]
    fn overlapping_views_check_complement_and_daily_support() {
        let team = Uuid::from_u128(42);
        let (mut f, p) = fixture(6);
        for x in &mut f {
            if x.user.as_u128() <= 5 {
                x.teams.insert(team);
            }
        }
        let b = build(&f, &p, &[team].into());
        assert_eq!(b.scopes[0].cells[0].value, Some(42));
        assert_eq!(b.scopes[1].cells[0].value, None);
        let (mut f, p) = fixture(10);
        for x in &mut f {
            if x.user.as_u128() <= 5 {
                x.teams.insert(team);
            }
        }
        let b = build(&f, &p, &[team].into());
        assert_eq!(b.scopes[0].cells[0].value, Some(70));
        assert_eq!(b.scopes[1].cells[0].value, Some(35));
        f[0].teams.clear();
        assert_eq!(build(&f, &p, &[team].into()).scopes[1].cells[0].value, None);
    }
    #[test]
    fn duplicate_and_overflow_are_not_silently_added() {
        let (mut f, p) = fixture(5);
        f.push(f[0].clone());
        assert!(project(&f, &p, &BTreeSet::new(), f[0].day).is_err());
        f.pop();
        for x in &mut f {
            x.metrics.insert(COUNTERS[0].into(), Some(i64::MAX));
        }
        assert!(project(&f, &p, &BTreeSet::new(), f[0].day).is_err());
    }
    #[test]
    fn deterministic_hundred_member_bundle_and_metadata_only_csv() {
        let (mut facts, people) = fixture(100);
        let teams = (0..10)
            .map(|n| Uuid::from_u128(1000 + n))
            .collect::<BTreeSet<_>>();
        for f in &mut facts {
            f.teams
                .insert(Uuid::from_u128(1000 + (f.user.as_u128() - 1) / 10));
        }
        let at = std::time::Instant::now();
        let expected = build(&facts, &people, &teams);
        let elapsed = at.elapsed();
        assert_eq!(expected.scopes[0].cells[0].value, Some(700));
        assert!(expected
            .scopes
            .iter()
            .skip(1)
            .all(|scope| scope.cells[0].value == Some(70)));
        facts.reverse();
        assert_eq!(
            serde_json::to_value(&expected).unwrap(),
            serde_json::to_value(build(&facts, &people, &teams)).unwrap()
        );
        eprintln!(
            "copilot_local_projection_100_members_10_teams_ms={}",
            elapsed.as_millis()
        );
        let now = Utc::now();
        let report = Report {
            organization_id: Uuid::nil(),
            team_id: None,
            week_start: facts[0].day,
            window_start: now,
            window_end: now,
            timezone: "UTC".into(),
            organization_timezone: "Asia/Bangkok".into(),
            status: "partial".into(),
            cells: vec![Cell {
                feature: "=unsafe".into(),
                counter: "counter".into(),
                value: None,
                status: "withheld".into(),
                reason: None,
                coverage: None,
            }],
            provenance: "github".into(),
            calculation_version: VERSION.into(),
            provider_definition_version: "v1".into(),
            updated_at: None,
            ingestion_status: "unconfirmed".into(),
            capture_status: "unconfirmed".into(),
            generation: 1,
            source_revision: "revision".into(),
            publication_id: None,
            fence: "private-fence".into(),
        };
        let csv = csv(&report);
        assert!(csv.contains("'="));
        assert!(!csv.contains("private-fence"));
        assert!(!serde_json::to_string(&report)
            .unwrap()
            .contains("private-fence"));
    }
    #[test]
    fn utc_week_closed_boundary_and_calendar_retention() {
        let now = DateTime::parse_from_rfc3339("2026-10-12T00:00:00Z")
            .unwrap()
            .with_timezone(&Utc);
        let start = NaiveDate::from_ymd_opt(2026, 10, 5).unwrap();
        assert!(week(start, "UTC", now).is_ok());
        assert!(week(start, "Asia/Bangkok", now).is_err());
        assert!(week(start, "UTC", now - Duration::seconds(1)).is_err());
        assert!(week(start + Duration::days(1), "UTC", now).is_err());
    }
}
