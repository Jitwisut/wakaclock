use anyhow::{Context, Result};
use std::sync::Arc;
use uuid::Uuid;

use crate::infrastructure::database::ClickHouseClient;
use crate::model::keystroke_stats::{
    ClipboardCoverage, KeystrokeDailyItem, KeystrokeDailyRow, KeystrokeProjectItem,
    KeystrokeProjectRow, KeystrokeStatsData, KeystrokeStatsResponse, KeystrokeTotalsRow,
};

pub struct KeystrokeStatsService {
    clickhouse: Arc<ClickHouseClient>,
}

// Read from raw heartbeats with the canonical actor filter. The legacy keystroke
// aggregate has no actor dimension and must not turn Unknown into Human.

impl KeystrokeStatsService {
    pub fn new(clickhouse: Arc<ClickHouseClient>) -> Self {
        Self { clickhouse }
    }

    pub async fn get_range(
        &self,
        user_id: Uuid,
        start: &str,
        end: &str,
    ) -> Result<KeystrokeStatsResponse> {
        validate_date(start)?;
        validate_date(end)?;

        let totals = self.fetch_totals(user_id, start, end).await?;
        let projects = self.fetch_projects(user_id, start, end).await?;
        let daily = self.fetch_daily(user_id, start, end).await?;

        Ok(KeystrokeStatsResponse {
            start: start.to_string(),
            end: end.to_string(),
            data: KeystrokeStatsData {
                total_keystrokes: totals.total_keystrokes,
                total_chars_added: totals.total_chars_added,
                total_chars_deleted: totals.total_chars_deleted,
                total_copy_actions: totals.total_copy_actions,
                total_paste_actions: totals.total_paste_actions,
                total_copied_chars: totals.total_copied_chars,
                total_copied_lines: totals.total_copied_lines,
                total_pasted_chars: totals.total_pasted_chars,
                total_pasted_lines: totals.total_pasted_lines,
                total_paste_same_file_actions: totals.total_paste_same_file_actions,
                total_paste_same_workspace_actions: totals.total_paste_same_workspace_actions,
                total_paste_external_or_unknown_actions: totals
                    .total_paste_external_or_unknown_actions,
                days_with_activity: totals.days_with_activity,
                clipboard_coverage: ClipboardCoverage {
                    supported_vscode_heartbeats: totals.supported_vscode_heartbeats,
                    total_vscode_heartbeats: totals.total_vscode_heartbeats,
                    percent: if totals.total_vscode_heartbeats == 0 {
                        0.0
                    } else {
                        totals.supported_vscode_heartbeats as f64 * 100.0
                            / totals.total_vscode_heartbeats as f64
                    },
                },
                projects: projects
                    .into_iter()
                    .map(|row| KeystrokeProjectItem {
                        name: row.name,
                        keystrokes: row.keystrokes,
                        chars_added: row.chars_added,
                        chars_deleted: row.chars_deleted,
                        copy_actions: row.copy_actions,
                        paste_actions: row.paste_actions,
                        copied_chars: row.copied_chars,
                        copied_lines: row.copied_lines,
                        pasted_chars: row.pasted_chars,
                        pasted_lines: row.pasted_lines,
                        paste_same_file_actions: row.paste_same_file_actions,
                        paste_same_workspace_actions: row.paste_same_workspace_actions,
                        paste_external_or_unknown_actions: row.paste_external_or_unknown_actions,
                    })
                    .collect(),
                daily: daily
                    .into_iter()
                    .map(|row| KeystrokeDailyItem {
                        date: row.date,
                        keystrokes: row.keystrokes,
                        chars_added: row.chars_added,
                        chars_deleted: row.chars_deleted,
                        copy_actions: row.copy_actions,
                        paste_actions: row.paste_actions,
                        copied_chars: row.copied_chars,
                        copied_lines: row.copied_lines,
                        pasted_chars: row.pasted_chars,
                        pasted_lines: row.pasted_lines,
                        paste_same_file_actions: row.paste_same_file_actions,
                        paste_same_workspace_actions: row.paste_same_workspace_actions,
                        paste_external_or_unknown_actions: row.paste_external_or_unknown_actions,
                    })
                    .collect(),
            },
        })
    }

    async fn fetch_totals(
        &self,
        user_id: Uuid,
        start: &str,
        end: &str,
    ) -> Result<KeystrokeTotalsRow> {
        self.clickhouse
            .get_client()
            .query(
                "
                SELECT
                    coalesce(sumIf(keystrokes, actor_type = 'human'), 0) AS total_keystrokes,
                    coalesce(sumIf(chars_added, actor_type = 'human'), 0) AS total_chars_added,
                    coalesce(sumIf(chars_deleted, actor_type = 'human'), 0) AS total_chars_deleted,
                    coalesce(sum(copy_actions), 0) AS total_copy_actions,
                    coalesce(sum(paste_actions), 0) AS total_paste_actions,
                    coalesce(sum(copied_chars), 0) AS total_copied_chars,
                    coalesce(sum(copied_lines), 0) AS total_copied_lines,
                    coalesce(sum(pasted_chars), 0) AS total_pasted_chars,
                    coalesce(sum(pasted_lines), 0) AS total_pasted_lines,
                    coalesce(sum(paste_same_file_actions), 0) AS total_paste_same_file_actions,
                    coalesce(sum(paste_same_workspace_actions), 0) AS total_paste_same_workspace_actions,
                    coalesce(sum(paste_external_or_unknown_actions), 0) AS total_paste_external_or_unknown_actions,
                    uniqExactIf(date, actor_type = 'human' OR coalesce(copy_actions, 0) > 0 OR coalesce(paste_actions, 0) > 0) AS days_with_activity,
                    countIf(position(user_agent, 'wakaclock-vscode/') > 0 AND clipboard_tracking_version = 1) AS supported_vscode_heartbeats,
                    countIf(position(user_agent, 'wakaclock-vscode/') > 0) AS total_vscode_heartbeats
                FROM wakaclock.heartbeats
                WHERE user_id = ? AND date BETWEEN toDate(?) AND toDate(?)
                ",
            )
            .bind(user_id)
            .bind(start)
            .bind(end)
            .fetch_one::<KeystrokeTotalsRow>()
            .await
            .map_err(|error| {
                anyhow::anyhow!("ClickHouse keystroke_stats totals query error: {error}")
            })
    }

    async fn fetch_projects(
        &self,
        user_id: Uuid,
        start: &str,
        end: &str,
    ) -> Result<Vec<KeystrokeProjectRow>> {
        self.clickhouse
            .get_client()
            .query(
                "
                SELECT
                    coalesce(nullIf(project, ''), 'Unknown') AS name,
                    coalesce(sumIf(keystrokes, actor_type = 'human'), 0) AS keystrokes,
                    coalesce(sumIf(chars_added, actor_type = 'human'), 0) AS chars_added,
                    coalesce(sumIf(chars_deleted, actor_type = 'human'), 0) AS chars_deleted,
                    coalesce(sum(copy_actions), 0) AS copy_actions,
                    coalesce(sum(paste_actions), 0) AS paste_actions,
                    coalesce(sum(copied_chars), 0) AS copied_chars,
                    coalesce(sum(copied_lines), 0) AS copied_lines,
                    coalesce(sum(pasted_chars), 0) AS pasted_chars,
                    coalesce(sum(pasted_lines), 0) AS pasted_lines,
                    coalesce(sum(paste_same_file_actions), 0) AS paste_same_file_actions,
                    coalesce(sum(paste_same_workspace_actions), 0) AS paste_same_workspace_actions,
                    coalesce(sum(paste_external_or_unknown_actions), 0) AS paste_external_or_unknown_actions
                FROM wakaclock.heartbeats
                WHERE user_id = ? AND date BETWEEN toDate(?) AND toDate(?)
                  AND (actor_type = 'human' OR coalesce(copy_actions, 0) > 0 OR coalesce(paste_actions, 0) > 0)
                GROUP BY name
                ORDER BY keystrokes DESC, name ASC
                ",
            )
            .bind(user_id)
            .bind(start)
            .bind(end)
            .fetch_all::<KeystrokeProjectRow>()
            .await
            .map_err(|error| {
                anyhow::anyhow!("ClickHouse keystroke_stats projects query error: {error}")
            })
    }

    async fn fetch_daily(
        &self,
        user_id: Uuid,
        start: &str,
        end: &str,
    ) -> Result<Vec<KeystrokeDailyRow>> {
        self.clickhouse
            .get_client()
            .query(
                "
                SELECT
                    toString(date) AS day,
                    coalesce(sumIf(keystrokes, actor_type = 'human'), 0) AS keystrokes,
                    coalesce(sumIf(chars_added, actor_type = 'human'), 0) AS chars_added,
                    coalesce(sumIf(chars_deleted, actor_type = 'human'), 0) AS chars_deleted,
                    coalesce(sum(copy_actions), 0) AS copy_actions,
                    coalesce(sum(paste_actions), 0) AS paste_actions,
                    coalesce(sum(copied_chars), 0) AS copied_chars,
                    coalesce(sum(copied_lines), 0) AS copied_lines,
                    coalesce(sum(pasted_chars), 0) AS pasted_chars,
                    coalesce(sum(pasted_lines), 0) AS pasted_lines,
                    coalesce(sum(paste_same_file_actions), 0) AS paste_same_file_actions,
                    coalesce(sum(paste_same_workspace_actions), 0) AS paste_same_workspace_actions,
                    coalesce(sum(paste_external_or_unknown_actions), 0) AS paste_external_or_unknown_actions
                FROM wakaclock.heartbeats
                WHERE user_id = ? AND date BETWEEN toDate(?) AND toDate(?)
                  AND (actor_type = 'human' OR coalesce(copy_actions, 0) > 0 OR coalesce(paste_actions, 0) > 0)
                GROUP BY day
                ORDER BY day ASC
                ",
            )
            .bind(user_id)
            .bind(start)
            .bind(end)
            .fetch_all::<KeystrokeDailyRow>()
            .await
            .map_err(|error| {
                anyhow::anyhow!("ClickHouse keystroke_stats daily query error: {error}")
            })
    }
}

fn validate_date(date: &str) -> Result<()> {
    chrono::NaiveDate::parse_from_str(date, "%Y-%m-%d")
        .context("Invalid date format, expected YYYY-MM-DD")?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::KeystrokeStatsService;
    use crate::repository::heartbeat::HeartbeatRepository;
    use uuid::Uuid;

    #[tokio::test]
    #[ignore = "requires an isolated ClickHouse 24.10 instance via CLICKHOUSE_TEST_URL"]
    async fn range_deserializes_nullable_aggregates_as_non_nullable_values() {
        let clickhouse = crate::test_support::clickhouse_client().await;
        HeartbeatRepository::new(clickhouse.clone())
            .migrate()
            .await
            .unwrap();

        let user_id = Uuid::new_v4();
        // The legacy AI boolean column is intentionally omitted here: it defaults false
        // in the schema, and scripts/duration-audit/verify_actor_migration.py forbids new
        // production/test references to it outside its allowlist. This fixture only needs
        // actor_type, which every query under test filters on.
        let insert = format!(
            r#"INSERT INTO wakaclock.heartbeats
                (user_id, entity, entity_type, time, date, project,
                 keystrokes, chars_added, chars_deleted, is_write, category,
                 editor, operating_system, machine, user_agent,
                 actor_type, created_at)
               VALUES
                ('{user_id}', 'null-only.rs', 'file', 1787952000, '2026-08-29', 'null-only',
                 NULL, NULL, NULL, 1, 'coding', 'test', 'test', 'test', 'test', 'human', 1),
                ('{user_id}', 'alpha.rs', 'file', 1788038400, '2026-08-30', 'alpha',
                 5, 4, 1, 1, 'coding', 'test', 'test', 'test', 'wakaclock-vscode/0.1', 'human', 2),
                ('{user_id}', 'unknown-null.rs', 'file', 1788038460, '2026-08-30', NULL,
                 2, NULL, 1, 1, 'coding', 'test', 'test', 'test', 'test', 'human', 3),
                ('{user_id}', 'unknown-empty.rs', 'file', 1788038520, '2026-08-30', '',
                 3, 2, NULL, 1, 'coding', 'test', 'test', 'test', 'test', 'human', 4),
                ('{user_id}', 'null-metrics.rs', 'file', 1788038580, '2026-08-30', 'null-metrics',
                 NULL, NULL, NULL, 1, 'coding', 'test', 'test', 'test', 'test', 'human', 5),
                ('{user_id}', 'beta.rs', 'file', 1788124800, '2026-08-31', 'beta',
                 4, 3, 0, 1, 'coding', 'test', 'test', 'test', 'test', 'human', 6),
                ('{user_id}', 'ai.rs', 'file', 1788038640, '2026-08-30', 'ai-only',
                 100, 100, 100, 1, 'coding', 'test', 'test', 'test', 'test', 'ai_inferred', 7)"#
        );
        clickhouse
            .get_client()
            .query(&insert)
            .execute()
            .await
            .unwrap();

        let clipboard_insert = format!(
            r#"INSERT INTO wakaclock.heartbeats
                (user_id, entity, entity_type, time, date, project,
                 is_write, category, editor, operating_system, machine, user_agent,
                 actor_type, created_at, clipboard_tracking_version,
                 copy_actions, paste_actions, copied_chars, copied_lines,
                 pasted_chars, pasted_lines, paste_same_file_actions,
                 paste_same_workspace_actions, paste_external_or_unknown_actions)
               VALUES
                ('{user_id}', 'pasted.rs', 'file', 1788038700, '2026-08-30', '',
                 1, 'coding', 'test', 'test', 'test', 'wakaclock-vscode/0.2',
                 'unknown', 8, 1, 1, 1, 20, 2, 200, 5, 0, 0, 1),
                ('{user_id}', 'ai-paste.rs', 'file', 1788124900, '2026-08-31', 'ai-only',
                 1, 'coding', 'test', 'test', 'test', 'wakaclock-vscode/0.2',
                 'ai_inferred', 9, 1, 0, 1, 0, 0, 40, 2, 0, 1, 0)"#
        );
        clickhouse
            .get_client()
            .query(&clipboard_insert)
            .execute()
            .await
            .unwrap();

        let response = KeystrokeStatsService::new(clickhouse)
            .get_range(user_id, "2026-08-29", "2026-08-31")
            .await
            .unwrap();
        let data = response.data;

        assert_eq!(data.total_keystrokes, 14);
        assert_eq!(data.total_chars_added, 9);
        assert_eq!(data.total_chars_deleted, 2);
        assert_eq!(data.total_copy_actions, 1);
        assert_eq!(data.total_paste_actions, 2);
        assert_eq!(data.total_copied_chars, 20);
        assert_eq!(data.total_pasted_chars, 240);
        assert_eq!(data.total_pasted_lines, 7);
        assert_eq!(data.total_paste_same_workspace_actions, 1);
        assert_eq!(data.total_paste_external_or_unknown_actions, 1);
        assert_eq!(data.days_with_activity, 3);
        assert_eq!(data.clipboard_coverage.supported_vscode_heartbeats, 2);
        assert_eq!(data.clipboard_coverage.total_vscode_heartbeats, 3);
        assert!((data.clipboard_coverage.percent - 66.666).abs() < 0.01);
        assert_eq!(data.projects.len(), 6);
        assert_eq!(data.daily.len(), 3);

        let project = |name: &str| {
            data.projects
                .iter()
                .find(|item| item.name == name)
                .unwrap_or_else(|| panic!("missing project {name:?}"))
        };
        let unknown = project("Unknown");
        assert_eq!(unknown.keystrokes, 5);
        assert_eq!(unknown.chars_added, 2);
        assert_eq!(unknown.chars_deleted, 1);
        assert_eq!(unknown.copy_actions, 1);
        assert_eq!(unknown.paste_actions, 1);
        assert_eq!(project("alpha").chars_added, 4);
        assert_eq!(project("beta").keystrokes, 4);
        assert_eq!(project("null-metrics").keystrokes, 0);
        assert_eq!(project("null-only").chars_deleted, 0);
        assert_eq!(project("ai-only").keystrokes, 0);
        assert_eq!(project("ai-only").paste_actions, 1);

        let daily = |date: &str| {
            data.daily
                .iter()
                .find(|item| item.date == date)
                .unwrap_or_else(|| panic!("missing day {date:?}"))
        };
        assert_eq!(daily("2026-08-29").keystrokes, 0);
        assert_eq!(daily("2026-08-30").keystrokes, 10);
        assert_eq!(daily("2026-08-30").chars_added, 6);
        assert_eq!(daily("2026-08-30").chars_deleted, 2);
        assert_eq!(daily("2026-08-30").paste_actions, 1);
        assert_eq!(daily("2026-08-31").keystrokes, 4);
        assert_eq!(daily("2026-08-31").paste_actions, 1);
    }
}
