//! Phase 9 project list/detail orchestration and opaque pagination.

use anyhow::{bail, Result};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use chrono::{DateTime, Duration, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
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
    ProjectAggregateRow, ProjectAnalyticsRepository, ProjectBreakdownTable,
};
use crate::services::project_identity::ProjectIdentityService;

const RAW_DATA_VERSION: u64 = 0;
const DEFAULT_PAGE_SIZE: usize = 30;
const MAX_PAGE_SIZE: usize = 100;

pub struct ProjectAnalyticsService {
    cursor_secret: String,
    identity_service: Arc<ProjectIdentityService>,
    repo: Arc<ProjectAnalyticsRepository>,
}

impl ProjectAnalyticsService {
    pub fn new(
        repo: Arc<ProjectAnalyticsRepository>,
        identity_service: Arc<ProjectIdentityService>,
        cursor_secret: String,
    ) -> Self {
        Self {
            cursor_secret,
            identity_service,
            repo,
        }
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
        let mut cards: Vec<_> = self
            .repo
            .project_aggregates(user_id, start_epoch, end_epoch, None)
            .await?
            .into_iter()
            .map(card_from_row)
            .collect();
        cards.sort_by(|left, right| compare_cards(left, right, sort, order));
        let cursor_scope = project_list_cursor_scope(user_id, range);

        let start_index = match cursor {
            Some(cursor) => {
                let payload = self.decode_cursor(cursor, sort, order, &cursor_scope)?;
                cards
                    .iter()
                    .position(|card| cursor_is_after(card, &payload, sort, order))
                    .map(|index| index)
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
        let total_seconds = cards.iter().map(|card| card.total_seconds).sum();
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
        let (daily, languages, editors, branches, files, all_projects, aggregates) = tokio::try_join!(
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
                .all_projects_seconds(user_id, start_epoch, end_epoch),
            self.repo
                .project_aggregates(user_id, start_epoch, end_epoch, branch),
        )?;
        let aggregate = aggregates
            .into_iter()
            .find(|row| row.project_id == project_id);
        let total_seconds = aggregate
            .as_ref()
            .map(|row| rounded_seconds(row.total_seconds))
            .unwrap_or(0);
        let ai_lines = aggregate
            .as_ref()
            .map(|row| row.ai_added + row.ai_deleted)
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
        let active_days = daily.iter().filter(|item| item.total_seconds > 0.0).count() as u32;
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
                ai_percentage,
                attribution_coverage_percent: attribution_known
                    .then(|| coverage_for(ai_lines + human_lines, observed_lines))
                    .flatten(),
                estimated_spend: usage_spend.unwrap_or_else(unknown_spend),
                human_lines,
                prompts: usage.map(|row| row.prompts),
                prompts_per_session: usage.and_then(|row| {
                    (row.sessions > 0).then(|| row.prompts as f64 / row.sessions as f64)
                }),
                sessions: usage.map(|row| row.sessions),
                tokens: if reported_tokens > 0 {
                    TokenTotals {
                        cache_read: usage.map(|row| row.cache_read_tokens),
                        cache_write: usage.map(|row| row.cache_write_tokens),
                        coverage_percent: usage
                            .map(|row| {
                                (row.reported_tokens > 0).then(|| {
                                    row.priced_tokens as f64 * 100.0 / row.reported_tokens as f64
                                })
                            })
                            .flatten(),
                        input: usage.map(|row| row.input_tokens),
                        output: usage.map(|row| row.output_tokens),
                        total: total_tokens,
                    }
                } else {
                    unknown_tokens()
                },
                unattributed_lines: attribution_known.then_some(unattributed_lines),
            },
            branches: branches
                .into_iter()
                .map(|row| ProjectBranchItem {
                    ai_changes: row.ai_changes,
                    branch: row.branch,
                    heartbeat_count: row.heartbeat_count,
                    human_changes: row.human_changes,
                    total_seconds: rounded_seconds(row.total_seconds),
                    unattributed_changes: (row.unattributed_unknown == 0)
                        .then_some(row.unattributed_changes),
                })
                .collect(),
            daily_activity: zero_fill_daily(daily, range)
                .into_iter()
                .map(|row| ProjectDailyItem {
                    ai_added: row.ai_added,
                    ai_deleted: row.ai_deleted,
                    date: row.date,
                    human_added: row.human_added,
                    human_deleted: row.human_deleted,
                    total_seconds: rounded_seconds(row.total_seconds),
                    unattributed_added: (row.unattributed_unknown == 0)
                        .then_some(row.unattributed_added),
                    unattributed_deleted: (row.unattributed_unknown == 0)
                        .then_some(row.unattributed_deleted),
                })
                .collect(),
            data_version: RAW_DATA_VERSION,
            editors: breakdown_items(editors, total_seconds),
            generated_at: Utc::now().to_rfc3339(),
            languages: breakdown_items(languages, total_seconds),
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
                all_projects_seconds: rounded_seconds(all_projects),
                last_activity_at: aggregate
                    .as_ref()
                    .and_then(|row| format_timestamp(row.last_activity)),
                project_seconds: total_seconds,
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
        if self
            .identity_service
            .owned_identity(user_id, project_id)
            .await?
            .is_none()
        {
            bail!("project not found");
        }
        let (start_epoch, end_epoch) = range.unix_bounds();
        let mut files = self
            .repo
            .project_files(user_id, project_id, start_epoch, end_epoch, branch)
            .await?;
        let project_total_seconds =
            rounded_seconds(files.iter().map(|row| row.total_seconds).sum());
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
        let other_seconds = rounded_seconds(
            files
                .iter()
                .take(start_index)
                .chain(files.iter().skip(start_index + page_size))
                .map(|row| row.total_seconds)
                .sum(),
        );
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
        self.require_owned(user_id, project_id).await?;
        let (start_epoch, end_epoch) = range.unix_bounds();
        let cursor_scope = project_branches_cursor_scope(user_id, project_id, range);
        let rows = self
            .repo
            .project_branches(user_id, project_id, start_epoch, end_epoch)
            .await?;
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
        let other_seconds = rounded_seconds(
            rows.iter()
                .take(start_index)
                .chain(rows.iter().skip(start_index + page_size))
                .map(|row| row.total_seconds)
                .sum(),
        );
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
                    branch: row.branch,
                    heartbeat_count: row.heartbeat_count,
                    human_changes: row.human_changes,
                    total_seconds: rounded_seconds(row.total_seconds),
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
        self.require_owned(user_id, project_id).await?;
        let (start_epoch, end_epoch) = range.unix_bounds();
        let timezone = range.timezone.to_string();
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
                .map(|row| ProjectDailyItem {
                    ai_added: row.ai_added,
                    ai_deleted: row.ai_deleted,
                    date: row.date,
                    human_added: row.human_added,
                    human_deleted: row.human_deleted,
                    total_seconds: rounded_seconds(row.total_seconds),
                    unattributed_added: (row.unattributed_unknown == 0)
                        .then_some(row.unattributed_added),
                    unattributed_deleted: (row.unattributed_unknown == 0)
                        .then_some(row.unattributed_deleted),
                })
                .collect(),
            range: project_range_info(range, branch),
            schema_version: PROJECT_ANALYTICS_SCHEMA_VERSION,
        })
    }

    async fn require_owned(&self, user_id: Uuid, project_id: Uuid) -> Result<()> {
        if self
            .identity_service
            .owned_identity(user_id, project_id)
            .await?
            .is_none()
        {
            bail!("project not found");
        }
        Ok(())
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

fn card_from_row(row: ProjectAggregateRow) -> ProjectAnalyticsCard {
    let ai_changes = row.ai_added + row.ai_deleted;
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
    let estimated_spend = (row.priced_events > 0)
        .then_some(EstimatedSpend {
            amount_microusd: Some(row.estimated_cost_microusd),
            coverage_percent: (row.usage_events > 0)
                .then(|| row.priced_events as f64 * 100.0 / row.usage_events as f64),
            currency: "USD",
        })
        .unwrap_or_else(unknown_spend);
    ProjectAnalyticsCard {
        ai: AttributionTotals {
            changes: ai_changes,
            lines_added: row.ai_added,
            lines_deleted: row.ai_deleted,
            percentage: (row.unattributed_unknown == 0)
                .then(|| percentage(ai_changes, observed))
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
        unattributed: UnattributedTotals {
            changes: unattributed_changes,
            lines_added: row.unattributed_added,
            lines_deleted: row.unattributed_deleted,
            percentage_of_observed: (row.unattributed_unknown == 0)
                .then(|| percentage(unattributed_changes, observed))
                .flatten(),
        },
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
