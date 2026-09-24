//! Phase 9 project list/detail orchestration and opaque pagination.

use anyhow::{bail, Result};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use chrono::{DateTime, Duration, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::{HashMap, HashSet};
use std::{cmp::Ordering, sync::Arc};
use uuid::Uuid;

use crate::model::date_range::ResolvedRange;
use crate::model::project_analytics::{
    AttributionTotals, EstimatedSpend, ProjectAiSummary, ProjectAnalyticsCard,
    ProjectAnalyticsDetailResponse, ProjectAnalyticsListResponse, ProjectAnalyticsTotals,
    ProjectBranchItem, ProjectBranchesResponse, ProjectBreakdownItem, ProjectDailyItem,
    ProjectDailyResponse, ProjectFileItem, ProjectFilesResponse, ProjectIdentity, ProjectRangeInfo,
    ProjectSort, ProjectSummary, SortOrder, TokenTotals, UnattributedTotals,
    PROJECT_ANALYTICS_SCHEMA_VERSION,
};
use crate::repository::project_analytics::{
    ProjectAggregateRow, ProjectAnalyticsRepository, ProjectBreakdownRow, ProjectBreakdownTable,
};
use crate::services::activity_timeline::{
    total_seconds, totals_by, union_ranges, ActivityTimelineService, BridgeConfig, Dimension,
};
use crate::services::project_identity::ProjectIdentityService;

const RAW_DATA_VERSION: u64 = 0;
const DEFAULT_PAGE_SIZE: usize = 30;
const MAX_PAGE_SIZE: usize = 100;

pub struct ProjectAnalyticsService {
    cursor_secret: String,
    identity_service: Arc<ProjectIdentityService>,
    repo: Arc<ProjectAnalyticsRepository>,
    /// Seconds come from here, not from the repository's `sum(active_seconds)`.
    ///
    /// The repository still answers everything else — line counts, token spend, last
    /// activity — because those genuinely are per-heartbeat sums. Duration is not: summing
    /// `active_seconds` counts a second twice when the editor and an agent hook both
    /// report it, and it credits none of the idle bridging the dashboard's own total is
    /// built from. That is why this page and the front page disagreed. See
    /// docs/duration-accuracy-audit.md, Finding 4.
    timeline: ActivityTimelineService,
}

#[derive(Debug, Clone)]
pub struct ProjectMeasurementDay {
    pub date: String,
    pub total_seconds: f64,
    pub proven_seconds: f64,
    pub inferred_seconds: f64,
    pub active_seconds: Option<f64>,
    pub active_coverage: &'static str,
    pub heartbeat_count: u64,
}

#[derive(Debug, Clone)]
pub struct ProjectMeasurementTimeline {
    pub calculation_version: &'static str,
    pub timeout_seconds: f64,
    pub days: Vec<ProjectMeasurementDay>,
}

impl ProjectAnalyticsService {
    pub fn new(
        repo: Arc<ProjectAnalyticsRepository>,
        identity_service: Arc<ProjectIdentityService>,
        cursor_secret: String,
        clickhouse: Arc<crate::infrastructure::database::ClickHouseClient>,
        bridge: impl Into<BridgeConfig>,
    ) -> Self {
        Self {
            cursor_secret,
            identity_service,
            repo,
            timeline: ActivityTimelineService::new(clickhouse, bridge),
        }
    }

    /// Trust Center view of a project, derived from the same canonical timeline and
    /// ownership sweep used by dashboard analytics. Project filtering happens after the
    /// sweep so it cannot create a new idle bridge across activity in another project.
    pub async fn measurement_timeline(
        &self,
        user_id: Uuid,
        project_id: Uuid,
        range: &ResolvedRange,
    ) -> Result<ProjectMeasurementTimeline> {
        let identity = self
            .identity_service
            .owned_identity(user_id, project_id)
            .await?
            .ok_or_else(|| anyhow::anyhow!("project not found"))?;
        let (start_epoch, end_epoch) = range.unix_bounds();
        let timeline = self
            .timeline
            .build_timeline(user_id, start_epoch, end_epoch)
            .await?;
        let mut days = Vec::with_capacity(range.days_included() as usize);
        for offset in 0..range.days_included() {
            let day = range.start + Duration::days(offset);
            let day_range = ResolvedRange {
                start: day,
                end: day,
                timezone: range.timezone,
            };
            let (day_start, day_end) = day_range.unix_bounds();
            let matches = |interval: &&crate::services::activity_timeline::CanonicalInterval| {
                interval_matches_project(interval, project_id, Some(&identity.display_name), None)
            };
            let bridged = timeline
                .bridged
                .iter()
                .filter(|interval| matches(interval))
                .filter_map(|interval| {
                    let start = interval.start.max(day_start);
                    let end = interval.end.min(day_end);
                    (end > start).then_some((start, end))
                })
                .collect::<Vec<_>>();
            let measured = timeline
                .measured
                .iter()
                .filter(|interval| matches(interval))
                .filter_map(|interval| {
                    let start = interval.start.max(day_start);
                    let end = interval.end.min(day_end);
                    (end > start).then_some((interval.heartbeat_id.clone(), start, end))
                })
                .collect::<Vec<_>>();
            let total = bridged
                .iter()
                .map(|(start, end)| (end - start).max(0.0))
                .sum::<f64>();
            let proven = union_ranges(
                &measured
                    .iter()
                    .map(|(_, start, end)| (*start, *end))
                    .collect::<Vec<_>>(),
            );
            let (active, _, _, _, active_coverage) = timeline.active_metrics_for_project_in_range(
                day_start,
                day_end,
                project_id,
                &identity.display_name,
            );
            let heartbeat_count = measured
                .into_iter()
                .map(|(heartbeat_id, _, _)| heartbeat_id)
                .collect::<HashSet<_>>()
                .len() as u64;
            days.push(ProjectMeasurementDay {
                date: day.to_string(),
                total_seconds: total,
                proven_seconds: proven,
                inferred_seconds: (total - proven).max(0.0),
                active_seconds: (active_coverage != "unavailable").then_some(active),
                active_coverage,
                heartbeat_count,
            });
        }
        Ok(ProjectMeasurementTimeline {
            calculation_version: timeline.calculation_version,
            timeout_seconds: self.timeline.bridge_config().idle_timeout_seconds,
            days,
        })
    }

    /// Canonical seconds for a range, keyed by project id *and* by display name.
    ///
    /// Keying on the id alone loses almost everything on real data: `project_id` was added
    /// to `activity_intervals` long after the table existed, so every historical interval
    /// carries NULL, and 303 of this repository's own 992 heartbeats have no id either. A
    /// display name is present on 97% of them. Each interval is therefore counted exactly
    /// once — under its id when it has one, under its name when it does not — and a caller
    /// adds the two buckets for the project it is asking about.
    async fn canonical_project_seconds(
        &self,
        user_id: Uuid,
        start_epoch: f64,
        end_epoch: f64,
    ) -> Result<ProjectSeconds> {
        let timeline = self
            .timeline
            .build_timeline(user_id, start_epoch, end_epoch)
            .await?;
        let mut by_id: HashMap<String, f64> = HashMap::new();
        let mut by_name: HashMap<String, f64> = HashMap::new();
        for interval in &timeline.bridged {
            let seconds = interval.end - interval.start;
            match interval.project_id {
                Some(id) => *by_id.entry(id.to_string()).or_default() += seconds,
                None => {
                    let name = interval.project.as_deref().unwrap_or("Unknown");
                    *by_name.entry(name.to_string()).or_default() += seconds;
                }
            }
        }
        Ok(ProjectSeconds {
            by_id,
            by_name,
            comparable_seconds: timeline.comparable_seconds,
            ai_measured_seconds: timeline.ai_measured_seconds,
            ai_additional_seconds: timeline.ai_additional_seconds,
            calculation_version: timeline.calculation_version,
        })
    }

    pub async fn list(
        &self,
        user_id: Uuid,
        range: &ResolvedRange,
        sort: ProjectSort,
        order: SortOrder,
        limit: Option<u16>,
        cursor: Option<&str>,
    ) -> Result<ProjectAnalyticsListResponse> {
        let (start_epoch, end_epoch) = range.unix_bounds();
        let canonical_seconds = self
            .canonical_project_seconds(user_id, start_epoch, end_epoch)
            .await?;
        let mut cards: Vec<_> = self
            .repo
            .project_aggregates(user_id, start_epoch, end_epoch, None)
            .await?
            .into_iter()
            .map(|row| {
                let mut card = card_from_row(row);
                // A project the timeline has no seconds for reports zero rather than the
                // aggregate's figure: mixing the two algorithms in one list is exactly the
                // disagreement this replaces.
                card.total_seconds =
                    rounded_seconds(canonical_seconds.get(card.project_id, &card.name));
                card
            })
            .collect();
        cards.sort_by(|left, right| compare_cards(left, right, sort, order));
        let cursor_scope = project_list_cursor_scope(user_id, range);

        let start_index = match cursor {
            Some(cursor) => {
                let payload = self.decode_cursor(cursor, sort, order, &cursor_scope)?;
                cards
                    .iter()
                    .position(|card| cursor_is_after(card, &payload, sort, order))
                    .or_else(|| {
                        cards
                            .iter()
                            .position(|card| card.project_id == payload.project_id)
                            .map(|index| index + 1)
                    })
                    .ok_or_else(|| anyhow::anyhow!("cursor no longer points to this result set"))?
            }
            None => 0,
        };
        let page_size =
            usize::from(limit.unwrap_or(DEFAULT_PAGE_SIZE as u16)).clamp(1, MAX_PAGE_SIZE);
        let total_seconds = rounded_seconds(canonical_seconds.total());
        let project_count = cards.len() as u64;
        let items: Vec<_> = cards
            .iter()
            .skip(start_index)
            .take(page_size)
            .cloned()
            .collect();
        let next_cursor = if start_index + items.len() < cards.len() {
            items
                .last()
                .map(|card| self.encode_cursor(card, sort, order, &cursor_scope))
                .transpose()?
        } else {
            None
        };

        Ok(ProjectAnalyticsListResponse {
            data_version: RAW_DATA_VERSION,
            generated_at: Utc::now().to_rfc3339(),
            items,
            next_cursor,
            range: range.info(),
            schema_version: PROJECT_ANALYTICS_SCHEMA_VERSION,
            totals: ProjectAnalyticsTotals {
                project_count,
                total_seconds,
                comparable_seconds: Some(canonical_seconds.comparable_seconds),
                ai_measured_seconds: Some(canonical_seconds.ai_measured_seconds),
                ai_additional_seconds: Some(canonical_seconds.ai_additional_seconds),
                calculation_version: Some(canonical_seconds.calculation_version),
            },
        })
    }

    pub async fn detail(
        &self,
        user_id: Uuid,
        project_id: Uuid,
        range: &ResolvedRange,
        branch: Option<&str>,
    ) -> Result<ProjectAnalyticsDetailResponse> {
        let identity = self
            .identity_service
            .owned_identity(user_id, project_id)
            .await?
            .ok_or_else(|| anyhow::anyhow!("project not found"))?;
        let (start_epoch, end_epoch) = range.unix_bounds();
        let timezone = range.timezone.to_string();
        let (daily, languages, editors, mut branches, mut files, aggregates) = tokio::try_join!(
            self.repo.project_daily(
                user_id,
                project_id,
                &timezone,
                start_epoch,
                end_epoch,
                branch
            ),
            self.repo.project_breakdowns(
                ProjectBreakdownTable::Language,
                user_id,
                project_id,
                start_epoch,
                end_epoch,
                branch
            ),
            self.repo.project_breakdowns(
                ProjectBreakdownTable::Editor,
                user_id,
                project_id,
                start_epoch,
                end_epoch,
                branch
            ),
            self.repo
                .project_branches(user_id, project_id, start_epoch, end_epoch),
            self.repo
                .project_files(user_id, project_id, start_epoch, end_epoch, branch),
            self.repo
                .project_aggregates(user_id, start_epoch, end_epoch, branch),
        )?;
        let aggregate = aggregates
            .into_iter()
            .find(|row| row.project_id == project_id);

        // Seconds come from the canonical timeline so this page agrees with the dashboard
        // total. Branch is carried on the heartbeat/interval evidence, so a branch filter
        // can use the same overlap and idle rules instead of falling back to a raw
        // `sum(active_seconds)` aggregate.
        let timeline = Some(
            self.timeline
                .build_timeline(user_id, start_epoch, end_epoch)
                .await?,
        );
        let canonical = timeline.as_ref().map(|timeline| timeline.bridged.clone());
        // Deliberately unscoped: this is the denominator for "how much of your time went
        // to this project", so a branch filter must not shrink it too.
        let all_projects_canonical = self
            .canonical_project_seconds(user_id, start_epoch, end_epoch)
            .await?
            .total();
        // Same identity rule as the list: an interval that carries an id must match it,
        // and one that does not falls back to the display name. Matching on the id alone
        // would report zero for every project whose intervals predate that column.
        let project_name = aggregate
            .as_ref()
            .map(|row| row.name.clone())
            .or_else(|| Some(identity.display_name.clone()));
        let project_canonical: Option<Vec<_>> = canonical.as_ref().map(|intervals| {
            intervals
                .iter()
                .filter(|interval| {
                    interval_matches_project(interval, project_id, project_name.as_deref(), branch)
                })
                .cloned()
                .collect()
        });

        // File and branch rows retain their line-count and heartbeat columns from the
        // repository, but replace their duration with the same canonical ownership sweep
        // used by the summary. This keeps the detail cards, top-file list and branch table
        // from reintroducing raw heartbeat overlap after the headline has been corrected.
        if let Some(project_intervals) = project_canonical.as_deref() {
            let mut duration_by_entity = HashMap::<String, f64>::new();
            for interval in project_intervals {
                *duration_by_entity
                    .entry(entity_key_for(&interval.entity))
                    .or_default() += interval.end - interval.start;
            }
            for row in &mut files {
                row.total_seconds = duration_by_entity
                    .get(&row.entity_key)
                    .copied()
                    .unwrap_or(0.0);
            }
            files.sort_by(|left, right| {
                right
                    .total_seconds
                    .total_cmp(&left.total_seconds)
                    .then_with(|| left.path.cmp(&right.path))
            });
        }
        if let Some(intervals) = canonical.as_deref() {
            let mut duration_by_branch = HashMap::<String, f64>::new();
            for interval in intervals.iter().filter(|interval| {
                interval_matches_project(interval, project_id, project_name.as_deref(), None)
            }) {
                *duration_by_branch
                    .entry(interval.branch.as_deref().unwrap_or("Unknown").to_string())
                    .or_default() += interval.end - interval.start;
            }
            for row in &mut branches {
                row.total_seconds = duration_by_branch.get(&row.branch).copied().unwrap_or(0.0);
            }
            branches.sort_by(|left, right| {
                right
                    .total_seconds
                    .total_cmp(&left.total_seconds)
                    .then_with(|| left.branch.cmp(&right.branch))
            });
        }

        // The repository still supplies the per-day line attribution fields, but its
        // duration column is a raw heartbeat sum. Keep the canonical per-day totals
        // separately so zero-filled days that have timeline evidence (for example a
        // pre-identity heartbeat) receive their duration too.
        let daily_seconds = project_canonical
            .as_deref()
            .map(|intervals| canonical_daily_seconds(intervals, range));

        // Project totals use the full canonical stream so a timeout between two projects
        // remains attributed to the earlier project. The independent AI metric cannot be
        // recovered from that ownership sweep when a human interval overlaps it, so union
        // the raw AI ranges retained by the same timeline and subtract the project's
        // comparable editor ranges only after both have been resolved.
        let detail_metrics = timeline.as_ref().map(|timeline| {
            let project_intervals = project_canonical.as_deref().unwrap_or(&[]);
            let comparable_ranges: Vec<_> = project_intervals
                .iter()
                .filter(|interval| {
                    is_comparable_editor_interval(interval) && interval.end > interval.start
                })
                .map(|interval| (interval.start, interval.end))
                .collect();
            let comparable_seconds = union_ranges(&comparable_ranges);
            let ai_ranges = timeline.ai_ranges_for_project_on_branch(
                project_id,
                project_name.as_deref(),
                branch,
            );
            let ai_measured_seconds = union_ranges(&ai_ranges);
            let mut combined_ranges = comparable_ranges;
            combined_ranges.extend(ai_ranges);
            let ai_additional_seconds =
                (union_ranges(&combined_ranges) - comparable_seconds).max(0.0);
            (
                comparable_seconds,
                ai_measured_seconds,
                ai_additional_seconds,
                timeline.calculation_version,
            )
        });

        let total_seconds = match project_canonical.as_ref() {
            Some(intervals) => {
                rounded_seconds(crate::services::activity_timeline::total_seconds(intervals))
            }
            None => aggregate
                .as_ref()
                .map(|row| rounded_seconds(row.total_seconds))
                .unwrap_or(0),
        };
        let ai_lines = aggregate
            .as_ref()
            .map(|row| row.ai_added + row.ai_deleted)
            .unwrap_or(0);
        let ai_verified_lines = aggregate
            .as_ref()
            .map(|row| row.ai_verified_added + row.ai_verified_deleted)
            .unwrap_or(0);
        let ai_inferred_lines = aggregate
            .as_ref()
            .map(|row| row.ai_inferred_added + row.ai_inferred_deleted)
            .unwrap_or(0);
        let human_lines = aggregate
            .as_ref()
            .map(|row| row.human_added + row.human_deleted)
            .unwrap_or(0);
        let unattributed_lines = aggregate
            .as_ref()
            .map(|row| row.unattributed_added + row.unattributed_deleted)
            .unwrap_or(0);
        let observed_lines = ai_lines + human_lines + unattributed_lines;
        let attribution_known = aggregate
            .as_ref()
            .is_some_and(|row| row.unattributed_unknown == 0);
        let ai_percentage = attribution_known
            .then(|| percentage(ai_lines, observed_lines))
            .flatten();
        let active_days = daily_seconds
            .as_ref()
            .map(|totals| totals.values().filter(|seconds| **seconds > 0.0).count() as u32)
            .unwrap_or_else(|| daily.iter().filter(|item| item.total_seconds > 0.0).count() as u32);
        // Usage events do not carry branch provenance. Once a branch filter is active,
        // returning project-wide prompts/tokens/cost would falsely attribute them to the
        // selected branch, so keep those metrics explicitly unavailable instead of
        // manufacturing a branch allocation.
        let usage = if branch.is_some() {
            None
        } else {
            aggregate.as_ref().filter(|row| row.usage_events > 0)
        };
        let reported_tokens = usage.map_or(0, |row| row.reported_tokens);
        let total_tokens = usage.map(|row| {
            row.input_tokens
                .saturating_add(row.output_tokens)
                .saturating_add(row.cache_read_tokens)
                .saturating_add(row.cache_write_tokens)
        });
        let usage_spend = usage.and_then(|row| {
            (row.priced_events > 0).then_some(EstimatedSpend {
                amount_microusd: Some(row.estimated_cost_microusd),
                coverage_percent: (row.usage_events > 0)
                    .then(|| row.priced_events as f64 * 100.0 / row.usage_events as f64),
                currency: "USD",
            })
        });

        Ok(ProjectAnalyticsDetailResponse {
            ai: ProjectAiSummary {
                ai_lines,
                ai_inferred_lines,
                ai_percentage,
                attribution_coverage_percent: attribution_known
                    .then(|| coverage_for(ai_lines + human_lines, observed_lines))
                    .flatten(),
                estimated_spend: usage_spend.unwrap_or_else(unknown_spend),
                human_lines,
                ai_verified_lines,
                prompts: usage.map(|row| row.prompts),
                prompts_per_session: usage.and_then(|row| {
                    (row.sessions > 0).then(|| row.prompts as f64 / row.sessions as f64)
                }),
                sessions: usage.map(|row| row.sessions),
                tokens: if reported_tokens > 0 {
                    TokenTotals {
                        cache_read: usage.map(|row| row.cache_read_tokens),
                        cache_write: usage.map(|row| row.cache_write_tokens),
                        coverage_percent: usage.and_then(|row| {
                            (row.reported_tokens > 0).then(|| {
                                row.priced_tokens as f64 * 100.0 / row.reported_tokens as f64
                            })
                        }),
                        input: usage.map(|row| row.input_tokens),
                        output: usage.map(|row| row.output_tokens),
                        total: total_tokens,
                    }
                } else {
                    unknown_tokens()
                },
                unknown_lines: attribution_known.then_some(unattributed_lines),
                unattributed_lines: attribution_known.then_some(unattributed_lines),
            },
            branches: branches
                .into_iter()
                .map(|row| ProjectBranchItem {
                    ai_changes: row.ai_changes,
                    ai_inferred_changes: row.ai_inferred_changes,
                    ai_verified_changes: row.ai_verified_changes,
                    branch: row.branch,
                    heartbeat_count: row.heartbeat_count,
                    human_changes: row.human_changes,
                    total_seconds: rounded_seconds(row.total_seconds),
                    unknown_changes: (row.unattributed_unknown == 0)
                        .then_some(row.unattributed_changes),
                    unattributed_changes: (row.unattributed_unknown == 0)
                        .then_some(row.unattributed_changes),
                })
                .collect(),
            daily_activity: zero_fill_daily(daily, range)
                .into_iter()
                .map(|row| {
                    let date = row.date.clone();
                    let total_seconds = daily_seconds
                        .as_ref()
                        .and_then(|totals| totals.get(&date).copied())
                        .unwrap_or(row.total_seconds);
                    ProjectDailyItem {
                        ai_added: row.ai_added,
                        ai_deleted: row.ai_deleted,
                        ai_inferred_added: row.ai_inferred_added,
                        ai_inferred_deleted: row.ai_inferred_deleted,
                        ai_verified_added: row.ai_verified_added,
                        ai_verified_deleted: row.ai_verified_deleted,
                        date,
                        human_added: row.human_added,
                        human_deleted: row.human_deleted,
                        total_seconds: rounded_seconds(total_seconds),
                        unknown_added: (row.unattributed_unknown == 0)
                            .then_some(row.unattributed_added),
                        unknown_deleted: (row.unattributed_unknown == 0)
                            .then_some(row.unattributed_deleted),
                        unattributed_added: (row.unattributed_unknown == 0)
                            .then_some(row.unattributed_added),
                        unattributed_deleted: (row.unattributed_unknown == 0)
                            .then_some(row.unattributed_deleted),
                    }
                })
                .collect(),
            data_version: RAW_DATA_VERSION,
            editors: breakdown_items(
                canonical_breakdown(project_canonical.as_deref(), Dimension::Editor)
                    .unwrap_or(editors),
                total_seconds,
            ),
            generated_at: Utc::now().to_rfc3339(),
            languages: breakdown_items(
                canonical_breakdown(project_canonical.as_deref(), Dimension::Language)
                    .unwrap_or(languages),
                total_seconds,
            ),
            project: ProjectIdentity {
                name: identity.display_name,
                project_id,
                repository: empty_to_none(identity.repository),
            },
            range: ProjectRangeInfo {
                range: range.info(),
                branch: branch.unwrap_or("all").to_string(),
            },
            schema_version: PROJECT_ANALYTICS_SCHEMA_VERSION,
            summary: ProjectSummary {
                active_days,
                all_projects_seconds: rounded_seconds(all_projects_canonical),
                last_activity_at: aggregate
                    .as_ref()
                    .and_then(|row| format_timestamp(row.last_activity)),
                project_seconds: total_seconds,
                comparable_seconds: detail_metrics.map(|metrics| metrics.0),
                ai_measured_seconds: detail_metrics.map(|metrics| metrics.1),
                ai_additional_seconds: detail_metrics.map(|metrics| metrics.2),
                calculation_version: detail_metrics.map(|metrics| metrics.3),
            },
            top_files: file_items(files, total_seconds, 20),
        })
    }

    pub async fn files(
        &self,
        user_id: Uuid,
        project_id: Uuid,
        range: &ResolvedRange,
        branch: Option<&str>,
        limit: Option<u16>,
        cursor: Option<&str>,
        min_seconds: Option<f64>,
    ) -> Result<ProjectFilesResponse> {
        let identity = self
            .identity_service
            .owned_identity(user_id, project_id)
            .await?
            .ok_or_else(|| anyhow::anyhow!("project not found"))?;
        let (start_epoch, end_epoch) = range.unix_bounds();
        let timeline = self
            .timeline
            .build_timeline(user_id, start_epoch, end_epoch)
            .await?;
        let project_intervals: Vec<_> = timeline
            .bridged
            .iter()
            .filter(|interval| {
                interval_matches_project(interval, project_id, Some(&identity.display_name), branch)
            })
            .collect();
        let mut duration_by_entity = HashMap::<String, f64>::new();
        for interval in &project_intervals {
            *duration_by_entity
                .entry(entity_key_for(&interval.entity))
                .or_default() += interval.end - interval.start;
        }
        let mut files = self
            .repo
            .project_files(user_id, project_id, start_epoch, end_epoch, branch)
            .await?;
        for row in &mut files {
            row.total_seconds = duration_by_entity
                .get(&row.entity_key)
                .copied()
                .unwrap_or(0.0);
        }
        files.sort_by(|left, right| {
            right
                .total_seconds
                .total_cmp(&left.total_seconds)
                .then_with(|| left.path.cmp(&right.path))
        });
        let project_total_seconds = rounded_seconds(total_seconds(
            &project_intervals
                .iter()
                .map(|interval| (*interval).clone())
                .collect::<Vec<_>>(),
        ));
        let min_seconds = min_seconds.filter(|value| value.is_finite() && *value > 0.0);
        if let Some(min_seconds) = min_seconds {
            files.retain(|row| row.total_seconds >= min_seconds);
        }
        let cursor_scope =
            project_files_cursor_scope(user_id, project_id, range, branch, min_seconds);
        let attribution_coverage_percent = file_attribution_coverage(&files);
        let page_size =
            usize::from(limit.unwrap_or(DEFAULT_PAGE_SIZE as u16)).clamp(1, MAX_PAGE_SIZE);
        let start_index = match cursor {
            Some(cursor) => {
                let payload = self.decode_file_cursor(cursor, &cursor_scope)?;
                files
                    .iter()
                    .position(|file| file.entity_key == payload.entity_key)
                    .map(|index| index + 1)
                    .ok_or_else(|| anyhow::anyhow!("cursor no longer points to this result set"))?
            }
            None => 0,
        };
        let page: Vec<_> = files.iter().skip(start_index).cloned().collect();
        let visible_page_seconds: f64 = files
            .iter()
            .skip(start_index)
            .take(page_size)
            .map(|row| row.total_seconds)
            .sum();
        let other_seconds =
            rounded_seconds((project_total_seconds as f64 - visible_page_seconds).max(0.0));
        let next_cursor = if page.len() > page_size {
            page.get(page_size - 1)
                .map(|row| self.encode_file_cursor(&row.entity_key, &cursor_scope))
                .transpose()?
        } else {
            None
        };
        Ok(ProjectFilesResponse {
            attribution_coverage_percent,
            data_version: RAW_DATA_VERSION,
            generated_at: Utc::now().to_rfc3339(),
            items: file_items(page, project_total_seconds, page_size),
            metric: "active_duration",
            next_cursor,
            other_seconds,
            project_total_seconds,
            range: project_range_info(range, branch),
            schema_version: PROJECT_ANALYTICS_SCHEMA_VERSION,
            unit: "seconds",
        })
    }

    pub async fn branches(
        &self,
        user_id: Uuid,
        project_id: Uuid,
        range: &ResolvedRange,
        limit: Option<u16>,
        cursor: Option<&str>,
    ) -> Result<ProjectBranchesResponse> {
        let identity = self
            .identity_service
            .owned_identity(user_id, project_id)
            .await?
            .ok_or_else(|| anyhow::anyhow!("project not found"))?;
        let (start_epoch, end_epoch) = range.unix_bounds();
        let cursor_scope = project_branches_cursor_scope(user_id, project_id, range);
        let timeline = self
            .timeline
            .build_timeline(user_id, start_epoch, end_epoch)
            .await?;
        let project_intervals: Vec<_> = timeline
            .bridged
            .iter()
            .filter(|interval| {
                interval_matches_project(interval, project_id, Some(&identity.display_name), None)
            })
            .collect();
        let mut duration_by_branch = HashMap::<String, f64>::new();
        for interval in &project_intervals {
            *duration_by_branch
                .entry(interval.branch.as_deref().unwrap_or("Unknown").to_string())
                .or_default() += interval.end - interval.start;
        }
        let mut rows = self
            .repo
            .project_branches(user_id, project_id, start_epoch, end_epoch)
            .await?;
        for row in &mut rows {
            row.total_seconds = duration_by_branch.get(&row.branch).copied().unwrap_or(0.0);
        }
        rows.sort_by(|left, right| {
            right
                .total_seconds
                .total_cmp(&left.total_seconds)
                .then_with(|| left.branch.cmp(&right.branch))
        });
        let attribution_coverage_percent = branch_attribution_coverage(&rows);
        let page_size =
            usize::from(limit.unwrap_or(DEFAULT_PAGE_SIZE as u16)).clamp(1, MAX_PAGE_SIZE);
        let start_index = match cursor {
            Some(cursor) => {
                let payload = self.decode_branch_cursor(cursor, &cursor_scope)?;
                rows.iter()
                    .position(|row| row.branch == payload.branch)
                    .map(|index| index + 1)
                    .ok_or_else(|| anyhow::anyhow!("cursor no longer points to this result set"))?
            }
            None => 0,
        };
        let remaining = rows.iter().skip(start_index).cloned().collect::<Vec<_>>();
        let project_total_seconds: f64 = duration_by_branch.values().sum();
        let visible_page_seconds: f64 = rows
            .iter()
            .skip(start_index)
            .take(page_size)
            .map(|row| row.total_seconds)
            .sum();
        let other_seconds =
            rounded_seconds((project_total_seconds - visible_page_seconds).max(0.0));
        let next_cursor = if remaining.len() > page_size {
            remaining
                .get(page_size - 1)
                .map(|row| self.encode_branch_cursor(&row.branch, &cursor_scope))
                .transpose()?
        } else {
            None
        };
        Ok(ProjectBranchesResponse {
            attribution_coverage_percent,
            data_version: RAW_DATA_VERSION,
            generated_at: Utc::now().to_rfc3339(),
            items: remaining
                .into_iter()
                .take(page_size)
                .map(|row| ProjectBranchItem {
                    ai_changes: row.ai_changes,
                    ai_inferred_changes: row.ai_inferred_changes,
                    ai_verified_changes: row.ai_verified_changes,
                    branch: row.branch,
                    heartbeat_count: row.heartbeat_count,
                    human_changes: row.human_changes,
                    total_seconds: rounded_seconds(row.total_seconds),
                    unknown_changes: (row.unattributed_unknown == 0)
                        .then_some(row.unattributed_changes),
                    unattributed_changes: (row.unattributed_unknown == 0)
                        .then_some(row.unattributed_changes),
                })
                .collect(),
            next_cursor,
            other_seconds,
            range: project_range_info(range, None),
            schema_version: PROJECT_ANALYTICS_SCHEMA_VERSION,
        })
    }

    pub async fn daily(
        &self,
        user_id: Uuid,
        project_id: Uuid,
        range: &ResolvedRange,
        branch: Option<&str>,
    ) -> Result<ProjectDailyResponse> {
        let identity = self
            .identity_service
            .owned_identity(user_id, project_id)
            .await?
            .ok_or_else(|| anyhow::anyhow!("project not found"))?;
        let (start_epoch, end_epoch) = range.unix_bounds();
        let timezone = range.timezone.to_string();
        let timeline = self
            .timeline
            .build_timeline(user_id, start_epoch, end_epoch)
            .await?;
        let project_intervals: Vec<_> = timeline
            .bridged
            .iter()
            .filter(|interval| {
                interval_matches_project(interval, project_id, Some(&identity.display_name), branch)
            })
            .cloned()
            .collect();
        let daily_seconds = canonical_daily_seconds(&project_intervals, range);
        let rows = self
            .repo
            .project_daily(
                user_id,
                project_id,
                &timezone,
                start_epoch,
                end_epoch,
                branch,
            )
            .await?;
        let attribution_coverage_percent = daily_attribution_coverage(&rows);
        Ok(ProjectDailyResponse {
            attribution_coverage_percent,
            data_version: RAW_DATA_VERSION,
            generated_at: Utc::now().to_rfc3339(),
            items: zero_fill_daily(rows, range)
                .into_iter()
                .map(|row| {
                    let date = row.date.clone();
                    let total_seconds = daily_seconds
                        .get(&date)
                        .copied()
                        .unwrap_or(row.total_seconds);
                    ProjectDailyItem {
                        ai_added: row.ai_added,
                        ai_deleted: row.ai_deleted,
                        ai_inferred_added: row.ai_inferred_added,
                        ai_inferred_deleted: row.ai_inferred_deleted,
                        ai_verified_added: row.ai_verified_added,
                        ai_verified_deleted: row.ai_verified_deleted,
                        date,
                        human_added: row.human_added,
                        human_deleted: row.human_deleted,
                        total_seconds: rounded_seconds(total_seconds),
                        unknown_added: (row.unattributed_unknown == 0)
                            .then_some(row.unattributed_added),
                        unknown_deleted: (row.unattributed_unknown == 0)
                            .then_some(row.unattributed_deleted),
                        unattributed_added: (row.unattributed_unknown == 0)
                            .then_some(row.unattributed_added),
                        unattributed_deleted: (row.unattributed_unknown == 0)
                            .then_some(row.unattributed_deleted),
                    }
                })
                .collect(),
            range: project_range_info(range, branch),
            schema_version: PROJECT_ANALYTICS_SCHEMA_VERSION,
        })
    }

    fn encode_cursor(
        &self,
        card: &ProjectAnalyticsCard,
        sort: ProjectSort,
        order: SortOrder,
        scope: &str,
    ) -> Result<String> {
        let payload = CursorPayload {
            order: order.as_str().to_string(),
            project_id: card.project_id,
            sort: sort.as_str().to_string(),
            sort_value: sort_value(card, sort),
            scope: scope.to_string(),
        };
        let payload = serde_json::to_vec(&payload)?;
        let signature = cursor_signature(&payload, &self.cursor_secret);
        Ok(URL_SAFE_NO_PAD.encode(format!("{}.{}", URL_SAFE_NO_PAD.encode(payload), signature)))
    }

    fn decode_cursor(
        &self,
        cursor: &str,
        sort: ProjectSort,
        order: SortOrder,
        scope: &str,
    ) -> Result<CursorPayload> {
        let raw = URL_SAFE_NO_PAD
            .decode(cursor)
            .map_err(|_| anyhow::anyhow!("invalid cursor"))?;
        let raw = String::from_utf8(raw).map_err(|_| anyhow::anyhow!("invalid cursor"))?;
        let (payload, signature) = raw
            .rsplit_once('.')
            .ok_or_else(|| anyhow::anyhow!("invalid cursor"))?;
        let payload = URL_SAFE_NO_PAD
            .decode(payload)
            .map_err(|_| anyhow::anyhow!("invalid cursor"))?;
        if cursor_signature(&payload, &self.cursor_secret) != signature {
            bail!("invalid cursor");
        }
        let parsed: CursorPayload = serde_json::from_slice(&payload)?;
        if parsed.sort != sort.as_str() || parsed.order != order.as_str() {
            bail!("cursor does not match the selected sort or order");
        }
        if parsed.scope != scope {
            bail!("cursor does not match the selected range");
        }
        Ok(parsed)
    }

    fn encode_file_cursor(&self, entity_key: &str, scope: &str) -> Result<String> {
        let payload = serde_json::to_vec(&FileCursorPayload {
            entity_key: entity_key.to_string(),
            scope: scope.to_string(),
        })?;
        let signature = cursor_signature(&payload, &self.cursor_secret);
        Ok(URL_SAFE_NO_PAD.encode(format!("{}.{}", URL_SAFE_NO_PAD.encode(payload), signature)))
    }

    fn decode_file_cursor(&self, cursor: &str, scope: &str) -> Result<FileCursorPayload> {
        let raw = URL_SAFE_NO_PAD
            .decode(cursor)
            .map_err(|_| anyhow::anyhow!("invalid cursor"))?;
        let raw = String::from_utf8(raw).map_err(|_| anyhow::anyhow!("invalid cursor"))?;
        let (payload, signature) = raw
            .rsplit_once('.')
            .ok_or_else(|| anyhow::anyhow!("invalid cursor"))?;
        let payload = URL_SAFE_NO_PAD
            .decode(payload)
            .map_err(|_| anyhow::anyhow!("invalid cursor"))?;
        if cursor_signature(&payload, &self.cursor_secret) != signature {
            bail!("invalid cursor");
        }
        let parsed: FileCursorPayload = serde_json::from_slice(&payload)?;
        if parsed.scope != scope {
            bail!("cursor does not match the selected range");
        }
        Ok(parsed)
    }

    fn encode_branch_cursor(&self, branch: &str, scope: &str) -> Result<String> {
        let payload = serde_json::to_vec(&BranchCursorPayload {
            branch: branch.to_string(),
            scope: scope.to_string(),
        })?;
        let signature = cursor_signature(&payload, &self.cursor_secret);
        Ok(URL_SAFE_NO_PAD.encode(format!("{}.{}", URL_SAFE_NO_PAD.encode(payload), signature)))
    }

    fn decode_branch_cursor(&self, cursor: &str, scope: &str) -> Result<BranchCursorPayload> {
        let raw = URL_SAFE_NO_PAD
            .decode(cursor)
            .map_err(|_| anyhow::anyhow!("invalid cursor"))?;
        let raw = String::from_utf8(raw).map_err(|_| anyhow::anyhow!("invalid cursor"))?;
        let (payload, signature) = raw
            .rsplit_once('.')
            .ok_or_else(|| anyhow::anyhow!("invalid cursor"))?;
        let payload = URL_SAFE_NO_PAD
            .decode(payload)
            .map_err(|_| anyhow::anyhow!("invalid cursor"))?;
        if cursor_signature(&payload, &self.cursor_secret) != signature {
            bail!("invalid cursor");
        }
        let parsed: BranchCursorPayload = serde_json::from_slice(&payload)?;
        if parsed.scope != scope {
            bail!("cursor does not match the selected range");
        }
        Ok(parsed)
    }
}

#[derive(Debug, Deserialize, Serialize)]
struct CursorPayload {
    order: String,
    project_id: Uuid,
    sort: String,
    sort_value: f64,
    scope: String,
}

#[derive(Debug, Deserialize, Serialize)]
struct FileCursorPayload {
    entity_key: String,
    scope: String,
}

#[derive(Debug, Deserialize, Serialize)]
struct BranchCursorPayload {
    branch: String,
    scope: String,
}

fn project_list_cursor_scope(user_id: Uuid, range: &ResolvedRange) -> String {
    let (start_epoch, end_epoch) = range.unix_bounds();
    format!(
        "list:{user_id}:{start_epoch:.0}:{end_epoch:.0}:{}",
        range.timezone
    )
}

fn project_files_cursor_scope(
    user_id: Uuid,
    project_id: Uuid,
    range: &ResolvedRange,
    branch: Option<&str>,
    min_seconds: Option<f64>,
) -> String {
    let (start_epoch, end_epoch) = range.unix_bounds();
    let branch = branch.unwrap_or("all");
    let min_seconds = min_seconds
        .map(|value| value.to_bits().to_string())
        .unwrap_or_else(|| "none".to_string());
    format!(
        "files:{user_id}:{project_id}:{start_epoch:.0}:{end_epoch:.0}:{}:{branch}:{min_seconds}",
        range.timezone
    )
}

fn project_branches_cursor_scope(user_id: Uuid, project_id: Uuid, range: &ResolvedRange) -> String {
    let (start_epoch, end_epoch) = range.unix_bounds();
    format!(
        "branches:{user_id}:{project_id}:{start_epoch:.0}:{end_epoch:.0}:{}",
        range.timezone
    )
}

fn cursor_signature(payload: &[u8], secret: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(secret.as_bytes());
    hasher.update([0]);
    hasher.update(payload);
    format!("{:x}", hasher.finalize())
}

fn cursor_is_after(
    card: &ProjectAnalyticsCard,
    payload: &CursorPayload,
    sort: ProjectSort,
    order: SortOrder,
) -> bool {
    let value = sort_value(card, sort);
    match order {
        SortOrder::Asc if value > payload.sort_value => true,
        SortOrder::Desc if value < payload.sort_value => true,
        _ if value == payload.sort_value => card.project_id > payload.project_id,
        _ => false,
    }
}

/// Canonical seconds split by how each interval could be identified. See
/// `canonical_project_seconds` for why both halves are needed.
struct ProjectSeconds {
    by_id: HashMap<String, f64>,
    by_name: HashMap<String, f64>,
    comparable_seconds: f64,
    ai_measured_seconds: f64,
    ai_additional_seconds: f64,
    calculation_version: &'static str,
}

impl ProjectSeconds {
    /// Every canonical second in the range, including activity whose project could not be
    /// resolved at all. The per-project rows cannot cover that remainder — the aggregate
    /// query only returns projects with a resolved id — so the page's headline total is
    /// taken from here rather than by summing the rows. That is what makes it equal the
    /// dashboard's figure instead of falling short by whatever was unattributed.
    fn total(&self) -> f64 {
        self.by_id.values().sum::<f64>() + self.by_name.values().sum::<f64>()
    }

    fn get(&self, project_id: Uuid, name: &str) -> f64 {
        self.by_id
            .get(&project_id.to_string())
            .copied()
            .unwrap_or(0.0)
            + self.by_name.get(name).copied().unwrap_or(0.0)
    }
}

/// One breakdown of a project's canonical intervals, shaped like the repository rows it
/// replaces so the caller can fall back without branching twice.
///
/// Returning `None` when a caller does not request timeline-backed data keeps the old
/// aggregate path reachable rather than silently reporting zeros.
fn canonical_breakdown(
    intervals: Option<&[crate::services::activity_timeline::CanonicalInterval]>,
    dimension: Dimension,
) -> Option<Vec<ProjectBreakdownRow>> {
    let intervals = intervals?;
    Some(
        totals_by(intervals, dimension)
            .into_iter()
            .map(|(name, seconds, _)| ProjectBreakdownRow {
                name,
                total_seconds: seconds,
            })
            .collect(),
    )
}

fn card_from_row(row: ProjectAggregateRow) -> ProjectAnalyticsCard {
    let ai_changes = row.ai_added + row.ai_deleted;
    let ai_verified_changes = row.ai_verified_added + row.ai_verified_deleted;
    let ai_inferred_changes = row.ai_inferred_added + row.ai_inferred_deleted;
    let human_changes = row.human_added + row.human_deleted;
    let unattributed_changes = row.unattributed_added + row.unattributed_deleted;
    let observed = ai_changes + human_changes + unattributed_changes;
    let total_tokens = row
        .input_tokens
        .saturating_add(row.output_tokens)
        .saturating_add(row.cache_read_tokens)
        .saturating_add(row.cache_write_tokens);
    let token_coverage = (row.reported_tokens > 0)
        .then(|| row.priced_tokens as f64 * 100.0 / row.reported_tokens as f64);
    let estimated_spend = if row.priced_events > 0 {
        EstimatedSpend {
            amount_microusd: Some(row.estimated_cost_microusd),
            coverage_percent: (row.usage_events > 0)
                .then(|| row.priced_events as f64 * 100.0 / row.usage_events as f64),
            currency: "USD",
        }
    } else {
        unknown_spend()
    };
    let unknown = UnattributedTotals {
        changes: unattributed_changes,
        lines_added: row.unattributed_added,
        lines_deleted: row.unattributed_deleted,
        percentage_of_observed: (row.unattributed_unknown == 0)
            .then(|| percentage(unattributed_changes, observed))
            .flatten(),
    };
    ProjectAnalyticsCard {
        ai: AttributionTotals {
            changes: ai_changes,
            lines_added: row.ai_added,
            lines_deleted: row.ai_deleted,
            percentage: (row.unattributed_unknown == 0)
                .then(|| percentage(ai_changes, observed))
                .flatten(),
        },
        ai_inferred: AttributionTotals {
            changes: ai_inferred_changes,
            lines_added: row.ai_inferred_added,
            lines_deleted: row.ai_inferred_deleted,
            percentage: (row.unattributed_unknown == 0)
                .then(|| percentage(ai_inferred_changes, observed))
                .flatten(),
        },
        ai_verified: AttributionTotals {
            changes: ai_verified_changes,
            lines_added: row.ai_verified_added,
            lines_deleted: row.ai_verified_deleted,
            percentage: (row.unattributed_unknown == 0)
                .then(|| percentage(ai_verified_changes, observed))
                .flatten(),
        },
        attribution_coverage_percent: (row.unattributed_unknown == 0)
            .then(|| coverage_for(ai_changes + human_changes, observed))
            .flatten(),
        estimated_spend,
        human: AttributionTotals {
            changes: human_changes,
            lines_added: row.human_added,
            lines_deleted: row.human_deleted,
            percentage: (row.unattributed_unknown == 0)
                .then(|| percentage(human_changes, observed))
                .flatten(),
        },
        last_activity_at: format_timestamp(row.last_activity),
        name: row.name,
        project_id: row.project_id,
        prompts: (row.usage_events > 0).then_some(row.prompts),
        repository: empty_to_none(row.repository),
        sessions: (row.usage_events > 0).then_some(row.sessions),
        tokens: if row.reported_tokens > 0 {
            TokenTotals {
                cache_read: Some(row.cache_read_tokens),
                cache_write: Some(row.cache_write_tokens),
                coverage_percent: token_coverage,
                input: Some(row.input_tokens),
                output: Some(row.output_tokens),
                total: Some(total_tokens),
            }
        } else {
            unknown_tokens()
        },
        total_seconds: rounded_seconds(row.total_seconds),
        unknown: unknown.clone(),
        unattributed: unknown,
    }
}

fn compare_cards(
    left: &ProjectAnalyticsCard,
    right: &ProjectAnalyticsCard,
    sort: ProjectSort,
    order: SortOrder,
) -> Ordering {
    let left_value = sort_value(left, sort);
    let right_value = sort_value(right, sort);
    let value_order = left_value
        .partial_cmp(&right_value)
        .unwrap_or(Ordering::Equal);
    let value_order = match order {
        SortOrder::Asc => value_order,
        SortOrder::Desc => value_order.reverse(),
    };
    value_order.then_with(|| left.project_id.cmp(&right.project_id))
}

fn sort_value(card: &ProjectAnalyticsCard, sort: ProjectSort) -> f64 {
    match sort {
        ProjectSort::AiChanges => card.ai.changes as f64,
        ProjectSort::Duration => card.total_seconds as f64,
        ProjectSort::EstimatedCost => card.estimated_spend.amount_microusd.unwrap_or(0) as f64,
        ProjectSort::Prompts => card.prompts.unwrap_or(0) as f64,
        ProjectSort::Recent => card
            .last_activity_at
            .as_deref()
            .and_then(|value| DateTime::parse_from_rfc3339(value).ok())
            .map_or(0.0, |value| value.timestamp() as f64),
        ProjectSort::Sessions => card.sessions.unwrap_or(0) as f64,
        ProjectSort::Tokens => card.tokens.total.unwrap_or(0) as f64,
    }
}

fn breakdown_items(
    rows: Vec<crate::repository::project_analytics::ProjectBreakdownRow>,
    total_seconds: i64,
) -> Vec<ProjectBreakdownItem> {
    rows.into_iter()
        .map(|row| ProjectBreakdownItem {
            name: row.name,
            percentage: percentage(
                rounded_seconds(row.total_seconds) as u64,
                total_seconds.max(0) as u64,
            )
            .unwrap_or(0.0),
            total_seconds: rounded_seconds(row.total_seconds),
        })
        .collect()
}

fn file_items(
    rows: Vec<crate::repository::project_analytics::ProjectFileRow>,
    total_seconds: i64,
    limit: usize,
) -> Vec<ProjectFileItem> {
    rows.into_iter()
        .take(limit)
        .map(|row| {
            let path = sanitize_path(&row.path);
            let display_name = path.rsplit('/').next().unwrap_or(&path).to_string();
            ProjectFileItem {
                ai_changes: row.ai_changes,
                ai_inferred_changes: row.ai_inferred_changes,
                ai_verified_changes: row.ai_verified_changes,
                display_name,
                entity_key: row.entity_key,
                human_changes: row.human_changes,
                language: row.language,
                path,
                percentage_of_project: percentage(
                    rounded_seconds(row.total_seconds) as u64,
                    total_seconds.max(0) as u64,
                )
                .unwrap_or(0.0),
                total_seconds: rounded_seconds(row.total_seconds),
                unknown_changes: (row.unattributed_unknown == 0)
                    .then_some(row.unattributed_changes),
                unattributed_changes: (row.unattributed_unknown == 0)
                    .then_some(row.unattributed_changes),
            }
        })
        .collect()
}

fn project_range_info(range: &ResolvedRange, branch: Option<&str>) -> ProjectRangeInfo {
    ProjectRangeInfo {
        range: range.info(),
        branch: branch.unwrap_or("all").to_string(),
    }
}

fn file_attribution_coverage(
    rows: &[crate::repository::project_analytics::ProjectFileRow],
) -> Option<f64> {
    if rows.iter().any(|row| row.unattributed_unknown > 0) {
        return None;
    }
    let ai: u64 = rows.iter().map(|row| row.ai_changes).sum();
    let human: u64 = rows.iter().map(|row| row.human_changes).sum();
    let unattributed: u64 = rows.iter().map(|row| row.unattributed_changes).sum();
    coverage_for(ai + human, ai + human + unattributed)
}

fn branch_attribution_coverage(
    rows: &[crate::repository::project_analytics::ProjectBranchRow],
) -> Option<f64> {
    if rows.iter().any(|row| row.unattributed_unknown > 0) {
        return None;
    }
    let ai: u64 = rows.iter().map(|row| row.ai_changes).sum();
    let human: u64 = rows.iter().map(|row| row.human_changes).sum();
    let unattributed: u64 = rows.iter().map(|row| row.unattributed_changes).sum();
    coverage_for(ai + human, ai + human + unattributed)
}

fn daily_attribution_coverage(
    rows: &[crate::repository::project_analytics::ProjectDailyRow],
) -> Option<f64> {
    if rows.iter().any(|row| row.unattributed_unknown > 0) {
        return None;
    }
    let ai: u64 = rows
        .iter()
        .map(|row| row.ai_added.saturating_add(row.ai_deleted))
        .sum();
    let human: u64 = rows
        .iter()
        .map(|row| row.human_added.saturating_add(row.human_deleted))
        .sum();
    let unattributed: u64 = rows
        .iter()
        .map(|row| {
            row.unattributed_added
                .saturating_add(row.unattributed_deleted)
        })
        .sum();
    coverage_for(ai + human, ai + human + unattributed)
}

/// Keep project file responses useful without exposing a machine's absolute layout.
/// ClickHouse performs the first redaction, but the API repeats it here so legacy rows,
/// Windows drive paths, UNC paths and a future query change cannot bypass the privacy
/// boundary at serialization time.
fn sanitize_path(path: &str) -> String {
    let normalized = path.replace('\\', "/");
    let is_drive_path = normalized.as_bytes().get(1) == Some(&b':');
    let is_absolute = normalized.starts_with('/');
    let has_traversal = normalized.split('/').any(|segment| segment == "..");
    if is_drive_path || is_absolute || has_traversal {
        return normalized
            .rsplit('/')
            .find(|segment| !segment.is_empty() && *segment != "." && *segment != "..")
            .unwrap_or("Unknown")
            .chars()
            .filter(|character| !character.is_control())
            .collect();
    }

    let sanitized: String = normalized
        .chars()
        .filter(|character| !character.is_control())
        .collect();
    if sanitized.is_empty() {
        "Unknown".to_string()
    } else {
        sanitized
    }
}

fn unknown_tokens() -> TokenTotals {
    TokenTotals {
        cache_read: None,
        cache_write: None,
        coverage_percent: None,
        input: None,
        output: None,
        total: None,
    }
}

fn unknown_spend() -> EstimatedSpend {
    EstimatedSpend {
        amount_microusd: None,
        coverage_percent: None,
        currency: "USD",
    }
}

fn rounded_seconds(value: f64) -> i64 {
    value.round().max(0.0) as i64
}

fn entity_key_for(entity: &str) -> String {
    format!("{:x}", Sha256::digest(entity.as_bytes()))
}

fn is_comparable_editor_interval(
    interval: &crate::services::activity_timeline::CanonicalInterval,
) -> bool {
    interval.source == "editor"
        || interval.source == "editor_active_v1"
        || interval.actor_type == wakaclock_core::heartbeat::ActorType::Human
        || (interval.actor_type == wakaclock_core::heartbeat::ActorType::Unknown
            && interval
                .editor
                .trim()
                .eq_ignore_ascii_case("atoaxis desktop"))
}

fn interval_matches_project(
    interval: &crate::services::activity_timeline::CanonicalInterval,
    project_id: Uuid,
    project_name: Option<&str>,
    branch: Option<&str>,
) -> bool {
    let project_matches = match interval.project_id {
        Some(id) => id == project_id,
        None => project_name
            .is_some_and(|name| interval.project.as_deref().unwrap_or("Unknown") == name),
    };
    let branch_matches =
        branch.is_none_or(|name| interval.branch.as_deref().unwrap_or("Unknown") == name);
    project_matches && branch_matches
}

fn canonical_daily_seconds(
    intervals: &[crate::services::activity_timeline::CanonicalInterval],
    range: &ResolvedRange,
) -> HashMap<String, f64> {
    let mut totals = HashMap::new();
    for offset in 0..range.days_included() {
        let day = range.start + Duration::days(offset);
        let day_range = ResolvedRange {
            start: day,
            end: day,
            timezone: range.timezone,
        };
        let (day_start, day_end) = day_range.unix_bounds();
        let seconds = intervals
            .iter()
            .filter_map(|interval| {
                let start = interval.start.max(day_start);
                let end = interval.end.min(day_end);
                (end > start).then_some(end - start)
            })
            .sum();
        totals.insert(day.to_string(), seconds);
    }
    totals
}

fn percentage(numerator: u64, denominator: u64) -> Option<f64> {
    (denominator > 0).then(|| (numerator as f64 * 100.0) / denominator as f64)
}

fn coverage_for(known_lines: u64, observed_lines: u64) -> Option<f64> {
    (observed_lines > 0).then(|| known_lines as f64 * 100.0 / observed_lines as f64)
}

fn zero_fill_daily(
    mut rows: Vec<crate::repository::project_analytics::ProjectDailyRow>,
    range: &ResolvedRange,
) -> Vec<crate::repository::project_analytics::ProjectDailyRow> {
    let values: HashMap<NaiveDate, crate::repository::project_analytics::ProjectDailyRow> = rows
        .drain(..)
        .filter_map(|row| {
            NaiveDate::parse_from_str(&row.date, "%Y-%m-%d")
                .ok()
                .map(|date| (date, row))
        })
        .collect();
    (0..range.days_included())
        .map(|offset| {
            let date = range.start + Duration::days(offset);
            values.get(&date).cloned().unwrap_or(
                crate::repository::project_analytics::ProjectDailyRow {
                    date: date.to_string(),
                    total_seconds: 0.0,
                    ai_verified_added: 0,
                    ai_verified_deleted: 0,
                    ai_inferred_added: 0,
                    ai_inferred_deleted: 0,
                    ai_added: 0,
                    ai_deleted: 0,
                    human_added: 0,
                    human_deleted: 0,
                    unattributed_added: 0,
                    unattributed_deleted: 0,
                    unattributed_unknown: 0,
                },
            )
        })
        .collect()
}

fn empty_to_none(value: String) -> Option<String> {
    (!value.trim().is_empty()).then_some(value)
}

fn format_timestamp(value: f64) -> Option<String> {
    (value > 0.0).then(|| {
        DateTime::<Utc>::from_timestamp(value as i64, 0).map(|timestamp| timestamp.to_rfc3339())
    })?
}

#[cfg(test)]
mod tests {
    use super::{cursor_signature, percentage, sanitize_path};

    #[test]
    fn percentages_do_not_invent_a_value_for_an_empty_denominator() {
        assert_eq!(percentage(0, 0), None);
        assert_eq!(percentage(3, 4), Some(75.0));
    }

    #[test]
    fn cursor_signature_changes_when_payload_changes() {
        assert_ne!(
            cursor_signature(b"a", "secret"),
            cursor_signature(b"b", "secret")
        );
    }

    #[test]
    fn file_paths_redact_unix_windows_and_traversal_prefixes() {
        assert_eq!(sanitize_path("/Users/alice/project/src/main.rs"), "main.rs");
        assert_eq!(sanitize_path(r"C:\Users\alice\project\main.rs"), "main.rs");
        assert_eq!(sanitize_path("../../secret.env"), "secret.env");
        assert_eq!(sanitize_path("src/main.rs"), "src/main.rs");
    }
}
