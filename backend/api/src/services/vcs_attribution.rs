//! Charging coding time to commits and pull requests.
//!
//! The rule, and the reason it is this rule: a commit is a *marker in time*, not a record
//! of work. Nothing in a git object says when its author started typing. What we do know
//! is when they stopped — `committed_at` — and when they last stopped, which is the
//! previous commit they made on the same branch. The span between those two is the only
//! interval a commit can honestly claim, so that is the window this module measures.
//!
//! Everything here is a pure function over an already-loaded timeline. Reading the
//! timeline is the caller's job (see `VcsService`), deliberately: `ActivityTimelineService
//! ::canonical` is one ClickHouse query per user per window, so attributing a page of
//! commits has to fetch **one** wide window per author and slice it in memory. A version
//! of this that queried per commit would put a hundred queries behind one page load, on
//! the same ClickHouse the whole dashboard reads from.

use std::cmp::Ordering;
use std::collections::HashMap;

use serde::Serialize;
use uuid::Uuid;
use wakaclock_core::heartbeat::ActorType;

use crate::services::activity_timeline::CanonicalInterval;

/// How far back the *first* commit on a branch may reach.
///
/// A first commit has no predecessor to bound it, and without a cap it would absorb every
/// second the author ever spent on that project — a branch cut from a month-old checkout
/// would report a month of coding. One working day is the longest span a single
/// unwitnessed stretch of work can plausibly be, and the result is reported as
/// `FirstCommitCapped` rather than `Attributed` so no caller mistakes it for a measured
/// figure.
pub const FIRST_COMMIT_LOOKBACK_SECONDS: f64 = 8.0 * 3600.0;

/// One commit, resolved far enough to be attributable: who wrote it in *our* terms, which
/// projects its repository maps to, and when it landed.
#[derive(Debug, Clone)]
pub struct CommitWindowInput {
    pub author_user_id: Option<Uuid>,
    pub branch: Option<String>,
    pub commit_id: Uuid,
    /// Unix seconds. Providers give this as a timestamp; the timeline is in the same unit.
    pub committed_at: Option<f64>,
    /// Every project the commit's repository is mapped to. `repository_projects` is
    /// many-to-many, so this really can hold more than one.
    pub project_ids: Vec<Uuid>,
}

/// Why a commit's number is (or is not) worth showing. Kept as an explicit outcome rather
/// than folding everything into `coding_seconds == 0`, because "nobody was coding" and
/// "we could not tell who the author is" are different answers and a dashboard that
/// renders them identically is lying about one of them.
#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum CommitCoverage {
    /// Bounded by a real previous commit — the only fully defensible case.
    Attributed,
    /// First commit on the branch: bounded by `FIRST_COMMIT_LOOKBACK_SECONDS`, not by
    /// evidence.
    FirstCommitCapped,
    /// The commit author matches no local user, so there is no timeline to read.
    NoAuthorLink,
    /// The repository is not mapped to any project, so no interval can belong to it.
    NoProjectMapping,
    /// The window is sound and simply contains no recorded activity.
    NoActivity,
    /// `committed_at` is missing, so there is no window at all.
    NoCommitTime,
}

impl CommitCoverage {
    /// True when `coding_seconds` carries a measurement rather than a placeholder zero.
    pub fn is_measured(self) -> bool {
        matches!(self, Self::Attributed | Self::FirstCommitCapped)
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Attributed => "attributed",
            Self::FirstCommitCapped => "first_commit_capped",
            Self::NoAuthorLink => "no_author_link",
            Self::NoProjectMapping => "no_project_mapping",
            Self::NoActivity => "no_activity",
            Self::NoCommitTime => "no_commit_time",
        }
    }
}

#[derive(Clone, Debug, Serialize)]
pub struct CommitAttribution {
    /// Seconds inside the window whose actor is `ai_verified`. A subset of
    /// `coding_seconds`, never an addition to it.
    pub ai_seconds: f64,
    pub coding_seconds: f64,
    pub commit_id: Uuid,
    pub coverage: CommitCoverage,
    /// The measured window, so a caller can show *what* was counted rather than only the
    /// total. `None` whenever no window could be formed.
    pub window_end: Option<f64>,
    pub window_start: Option<f64>,
}

impl CommitAttribution {
    fn empty(commit_id: Uuid, coverage: CommitCoverage) -> Self {
        Self {
            ai_seconds: 0.0,
            coding_seconds: 0.0,
            commit_id,
            coverage,
            window_end: None,
            window_start: None,
        }
    }
}

/// Attribute a batch of commits against per-author timelines.
///
/// `timelines` is keyed by our `user_id`; an author with no entry is treated as having an
/// empty timeline rather than as an error, because a linked user who simply was not
/// tracking yet is a normal state, not a failure.
pub fn attribute_commits(
    commits: &[CommitWindowInput],
    timelines: &HashMap<Uuid, Vec<CanonicalInterval>>,
) -> Vec<CommitAttribution> {
    let previous = previous_commit_times(commits);
    commits
        .iter()
        .map(|commit| attribute_commit(commit, previous.get(&commit.commit_id).copied(), timelines))
        .collect()
}

/// For each commit, when the same author last committed on the same branch.
///
/// Lanes are keyed by author *and* branch: two people working the same branch each bound
/// their own commits, otherwise one person's commit would silently truncate the other's
/// window and both totals would be wrong.
fn previous_commit_times(commits: &[CommitWindowInput]) -> HashMap<Uuid, f64> {
    let mut lanes: HashMap<(Uuid, &str), Vec<(f64, Uuid)>> = HashMap::new();
    for commit in commits {
        let (Some(author), Some(committed_at)) = (commit.author_user_id, commit.committed_at)
        else {
            continue;
        };
        lanes
            .entry((author, commit.branch.as_deref().unwrap_or_default()))
            .or_default()
            .push((committed_at, commit.commit_id));
    }

    let mut previous = HashMap::new();
    for lane in lanes.values_mut() {
        // Commit ids break ties so two commits sharing a second still order deterministically.
        lane.sort_by(|left, right| {
            left.0
                .partial_cmp(&right.0)
                .unwrap_or(Ordering::Equal)
                .then_with(|| left.1.cmp(&right.1))
        });
        for pair in lane.windows(2) {
            previous.insert(pair[1].1, pair[0].0);
        }
    }
    previous
}

fn attribute_commit(
    commit: &CommitWindowInput,
    previous_at: Option<f64>,
    timelines: &HashMap<Uuid, Vec<CanonicalInterval>>,
) -> CommitAttribution {
    let Some(author) = commit.author_user_id else {
        return CommitAttribution::empty(commit.commit_id, CommitCoverage::NoAuthorLink);
    };
    let Some(committed_at) = commit.committed_at.filter(|value| value.is_finite()) else {
        return CommitAttribution::empty(commit.commit_id, CommitCoverage::NoCommitTime);
    };
    if commit.project_ids.is_empty() {
        return CommitAttribution::empty(commit.commit_id, CommitCoverage::NoProjectMapping);
    }

    let capped = previous_at.is_none();
    let start = previous_at.unwrap_or(committed_at - FIRST_COMMIT_LOOKBACK_SECONDS);
    // Both ends are finite here — `committed_at` is filtered above and `start` is derived
    // from it or from a stored commit time — so a plain comparison is sound.
    if committed_at <= start {
        return CommitAttribution::empty(commit.commit_id, CommitCoverage::NoActivity);
    }

    let empty: Vec<CanonicalInterval> = Vec::new();
    let intervals = timelines.get(&author).unwrap_or(&empty);
    let mut coding_seconds = 0.0;
    let mut ai_seconds = 0.0;
    for interval in intervals {
        if !belongs_to(commit, interval) {
            continue;
        }
        let overlap = interval.end.min(committed_at) - interval.start.max(start);
        if overlap <= 0.0 {
            continue;
        }
        coding_seconds += overlap;
        if interval.actor_type == ActorType::AiVerified {
            ai_seconds += overlap;
        }
    }

    let coverage = if coding_seconds <= 0.0 {
        CommitCoverage::NoActivity
    } else if capped {
        CommitCoverage::FirstCommitCapped
    } else {
        CommitCoverage::Attributed
    };
    CommitAttribution {
        ai_seconds,
        coding_seconds,
        commit_id: commit.commit_id,
        coverage,
        window_end: Some(committed_at),
        window_start: Some(start),
    }
}

/// Whether an interval is work on this commit's repository.
///
/// Project is matched on `project_id`, never the display name: a renamed or merged project
/// keeps its id, and `repository_projects` stores ids too, so names would drift apart.
///
/// Branch is only required when the commit names one. A commit with no branch (some
/// provider payloads omit it) falls back to project-only rather than matching nothing —
/// a looser answer, but a real one, where the strict reading would report zero for work
/// that plainly happened.
fn belongs_to(commit: &CommitWindowInput, interval: &CanonicalInterval) -> bool {
    let Some(project_id) = interval.project_id else {
        return false;
    };
    if !commit.project_ids.contains(&project_id) {
        return false;
    }
    match commit.branch.as_deref() {
        None => true,
        Some(branch) => interval.branch.as_deref() == Some(branch),
    }
}

/// Totals for a set of already-attributed commits — what a pull request reports.
///
/// Only measured commits contribute, so a PR whose commits are all unlinked reports zero
/// with `attributed_commits == 0` rather than a confident-looking zero.
#[derive(Clone, Debug, Default, Serialize)]
pub struct AttributionTotals {
    pub ai_seconds: f64,
    pub attributed_commits: usize,
    pub coding_seconds: f64,
    pub total_commits: usize,
}

pub fn total_attribution(attributions: &[CommitAttribution]) -> AttributionTotals {
    let mut totals = AttributionTotals {
        total_commits: attributions.len(),
        ..AttributionTotals::default()
    };
    for attribution in attributions {
        if !attribution.coverage.is_measured() {
            continue;
        }
        totals.ai_seconds += attribution.ai_seconds;
        totals.attributed_commits += 1;
        totals.coding_seconds += attribution.coding_seconds;
    }
    totals
}

/// The widest window the batch needs, so the caller makes one timeline query per author
/// instead of one per commit.
pub fn timeline_window(commits: &[CommitWindowInput]) -> Option<(f64, f64)> {
    let mut start = f64::INFINITY;
    let mut end = f64::NEG_INFINITY;
    for commit in commits {
        let Some(committed_at) = commit.committed_at.filter(|value| value.is_finite()) else {
            continue;
        };
        start = start.min(committed_at - FIRST_COMMIT_LOOKBACK_SECONDS);
        end = end.max(committed_at);
    }
    (start.is_finite() && end.is_finite()).then_some((start, end))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn project() -> Uuid {
        Uuid::from_u128(1)
    }

    fn author() -> Uuid {
        Uuid::from_u128(2)
    }

    fn interval(start: f64, end: f64, branch: &str, actor: ActorType) -> CanonicalInterval {
        CanonicalInterval {
            actor_confidence: 1.0,
            actor_type: actor,
            branch: Some(branch.to_string()),
            category: "coding".to_string(),
            editor: "vscode".to_string(),
            end,
            entity: "src/main.rs".to_string(),
            heartbeat_id: format!("hb-{start}"),
            language: Some("Rust".to_string()),
            operating_system: "macos".to_string(),
            project: Some("wakaclock".to_string()),
            project_id: Some(project()),
            segment_id: format!("seg-{start}"),
            source: "editor".to_string(),
            start,
        }
    }

    fn commit(id: u128, committed_at: f64, branch: Option<&str>) -> CommitWindowInput {
        CommitWindowInput {
            author_user_id: Some(author()),
            branch: branch.map(str::to_string),
            commit_id: Uuid::from_u128(id),
            committed_at: Some(committed_at),
            project_ids: vec![project()],
        }
    }

    fn timelines(intervals: Vec<CanonicalInterval>) -> HashMap<Uuid, Vec<CanonicalInterval>> {
        HashMap::from([(author(), intervals)])
    }

    #[test]
    fn charges_a_commit_the_time_since_that_author_last_committed_on_the_branch() {
        let commits = vec![
            commit(10, 1_000.0, Some("main")),
            commit(11, 4_000.0, Some("main")),
        ];
        let timeline = timelines(vec![
            interval(500.0, 1_000.0, "main", ActorType::Human),
            interval(2_000.0, 3_800.0, "main", ActorType::Human),
        ]);

        let attributed = attribute_commits(&commits, &timeline);

        // The first commit has no predecessor, so it reaches back the capped lookback and
        // picks up the 500s before it; the second is bounded by the first.
        assert_eq!(attributed[0].coverage, CommitCoverage::FirstCommitCapped);
        assert_eq!(attributed[0].coding_seconds, 500.0);
        assert_eq!(attributed[1].coverage, CommitCoverage::Attributed);
        assert_eq!(attributed[1].coding_seconds, 1_800.0);
        assert_eq!(attributed[1].window_start, Some(1_000.0));
    }

    #[test]
    fn clips_an_interval_that_straddles_the_commit_rather_than_counting_all_of_it() {
        let commits = vec![
            commit(10, 1_000.0, Some("main")),
            commit(11, 2_000.0, Some("main")),
        ];
        let timeline = timelines(vec![interval(1_500.0, 5_000.0, "main", ActorType::Human)]);

        let attributed = attribute_commits(&commits, &timeline);

        assert_eq!(attributed[1].coding_seconds, 500.0);
    }

    #[test]
    fn keeps_two_authors_on_one_branch_from_bounding_each_other() {
        let other = Uuid::from_u128(99);
        let mut theirs = commit(20, 2_000.0, Some("main"));
        theirs.author_user_id = Some(other);
        let commits = vec![
            commit(10, 1_000.0, Some("main")),
            theirs,
            commit(11, 3_000.0, Some("main")),
        ];
        let timeline = timelines(vec![interval(1_000.0, 3_000.0, "main", ActorType::Human)]);

        let attributed = attribute_commits(&commits, &timeline);

        // Ours is bounded by *our* previous commit at 1000, not by the other author's at 2000.
        assert_eq!(attributed[2].window_start, Some(1_000.0));
        assert_eq!(attributed[2].coding_seconds, 2_000.0);
    }

    #[test]
    fn counts_only_the_branch_and_project_the_commit_belongs_to() {
        let commits = vec![
            commit(10, 1_000.0, Some("main")),
            commit(11, 3_000.0, Some("main")),
        ];
        let mut elsewhere = interval(1_000.0, 2_000.0, "feature/x", ActorType::Human);
        elsewhere.project_id = Some(project());
        let mut other_project = interval(1_000.0, 2_000.0, "main", ActorType::Human);
        other_project.project_id = Some(Uuid::from_u128(77));
        let timeline = timelines(vec![
            elsewhere,
            other_project,
            interval(2_000.0, 2_400.0, "main", ActorType::Human),
        ]);

        let attributed = attribute_commits(&commits, &timeline);

        assert_eq!(attributed[1].coding_seconds, 400.0);
    }

    #[test]
    fn reports_ai_seconds_as_a_subset_of_coding_seconds() {
        let commits = vec![
            commit(10, 1_000.0, Some("main")),
            commit(11, 3_000.0, Some("main")),
        ];
        let timeline = timelines(vec![
            interval(1_000.0, 1_600.0, "main", ActorType::Human),
            interval(1_600.0, 2_000.0, "main", ActorType::AiVerified),
            // Inferred AI is not verified identity, so it counts as coding but not as AI.
            interval(2_000.0, 2_500.0, "main", ActorType::AiInferred),
        ]);

        let attributed = attribute_commits(&commits, &timeline);

        assert_eq!(attributed[1].coding_seconds, 1_500.0);
        assert_eq!(attributed[1].ai_seconds, 400.0);
    }

    #[test]
    fn distinguishes_every_reason_a_commit_has_no_number() {
        let unlinked = CommitWindowInput {
            author_user_id: None,
            ..commit(10, 1_000.0, Some("main"))
        };
        let unmapped = CommitWindowInput {
            project_ids: Vec::new(),
            ..commit(11, 1_000.0, Some("main"))
        };
        let undated = CommitWindowInput {
            committed_at: None,
            ..commit(12, 1_000.0, Some("main"))
        };
        let quiet = commit(13, 1_000.0, Some("main"));
        let attributed =
            attribute_commits(&[unlinked, unmapped, undated, quiet], &timelines(vec![]));

        assert_eq!(attributed[0].coverage, CommitCoverage::NoAuthorLink);
        assert_eq!(attributed[1].coverage, CommitCoverage::NoProjectMapping);
        assert_eq!(attributed[2].coverage, CommitCoverage::NoCommitTime);
        assert_eq!(attributed[3].coverage, CommitCoverage::NoActivity);
        assert!(attributed.iter().all(|one| one.coding_seconds == 0.0));
        assert!(attributed.iter().all(|one| !one.coverage.is_measured()));
    }

    #[test]
    fn falls_back_to_project_only_when_the_commit_names_no_branch() {
        let commits = vec![commit(10, 1_000.0, None), commit(11, 3_000.0, None)];
        let timeline = timelines(vec![interval(
            1_000.0,
            2_000.0,
            "anything",
            ActorType::Human,
        )]);

        let attributed = attribute_commits(&commits, &timeline);

        assert_eq!(attributed[1].coding_seconds, 1_000.0);
    }

    #[test]
    fn totals_skip_commits_that_were_never_measured() {
        let commits = vec![
            commit(10, 1_000.0, Some("main")),
            commit(11, 3_000.0, Some("main")),
            CommitWindowInput {
                author_user_id: None,
                ..commit(12, 4_000.0, Some("main"))
            },
        ];
        let timeline = timelines(vec![interval(1_000.0, 2_000.0, "main", ActorType::Human)]);

        let totals = total_attribution(&attribute_commits(&commits, &timeline));

        assert_eq!(totals.total_commits, 3);
        assert_eq!(totals.attributed_commits, 1);
        assert_eq!(totals.coding_seconds, 1_000.0);
    }

    #[test]
    fn window_spans_the_whole_batch_so_one_query_covers_every_commit() {
        let commits = vec![
            commit(10, 1_000.0, Some("main")),
            commit(11, 9_000.0, Some("main")),
        ];

        let (start, end) = timeline_window(&commits).expect("a dated batch has a window");

        assert_eq!(start, 1_000.0 - FIRST_COMMIT_LOOKBACK_SECONDS);
        assert_eq!(end, 9_000.0);
        assert!(timeline_window(&[]).is_none());
    }
}
