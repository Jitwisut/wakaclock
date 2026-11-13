//! Agent Universe: which agent worked on which project, from usage events alone.
//!
//! Session spans are deliberately not used as time. Sessions here stay open and get resumed
//! days later, so the only proven moments are the hours that actually hold events.

use anyhow::Result;
use std::collections::{BTreeMap, BTreeSet, HashMap};
use std::sync::Arc;
use uuid::Uuid;

use crate::infrastructure::database::ClickHouseClient;
use crate::model::agent_universe::{
    AgentLiveResponse, AgentUniverseResponse, CostStatus, LiveAgentActivity, LiveCoverage,
    UniverseActivity, UniverseAgent, UniverseCoverage, UniverseProject,
    AGENT_LIVE_FUTURE_SLACK_SECONDS, AGENT_LIVE_MAX_ROWS, AGENT_LIVE_SCHEMA_VERSION,
    AGENT_LIVE_WINDOW_SECONDS, AGENT_UNIVERSE_MAX_PROJECTS, AGENT_UNIVERSE_MAX_ROWS,
    AGENT_UNIVERSE_SCHEMA_VERSION,
};
use crate::model::date_range::ResolvedRange;
use crate::repository::agent_universe::{
    AgentHourRow, AgentLiveRow, AgentUniverseRepository, ProjectNameRow,
};

const OTHER_KEY: &str = "other";
const UNASSIGNED_KEY: &str = "unassigned";

#[derive(Debug)]
pub struct TooManyRows;

impl std::fmt::Display for TooManyRows {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "this range has too many sessions to draw")
    }
}

impl std::error::Error for TooManyRows {}

pub struct AgentUniverseService {
    repository: AgentUniverseRepository,
}

impl AgentUniverseService {
    pub fn new(clickhouse: Arc<ClickHouseClient>) -> Self {
        Self {
            repository: AgentUniverseRepository::new(clickhouse),
        }
    }

    pub async fn universe(
        &self,
        user_id: Uuid,
        range: &ResolvedRange,
    ) -> Result<AgentUniverseResponse> {
        let (start, end) = range.unix_bounds();
        let rows = self.repository.hours(user_id, start, end).await?;
        if rows.len() > AGENT_UNIVERSE_MAX_ROWS {
            return Err(TooManyRows.into());
        }
        let project_ids = rows
            .iter()
            .filter_map(|row| row.project_id)
            .collect::<BTreeSet<_>>()
            .into_iter()
            .collect::<Vec<_>>();
        let names = self.repository.project_names(user_id, &project_ids).await?;
        Ok(build_agent_universe(&rows, &names, range))
    }

    /// Which agents sent heartbeats in the last few minutes, by the server's clock.
    pub async fn live(&self, user_id: Uuid, now: u32) -> Result<AgentLiveResponse> {
        let rows = self
            .repository
            .live(
                user_id,
                f64::from(now.saturating_sub(AGENT_LIVE_WINDOW_SECONDS)),
                f64::from(now),
                f64::from(now + AGENT_LIVE_FUTURE_SLACK_SECONDS),
            )
            .await?;
        let project_ids = rows
            .iter()
            .filter_map(|row| row.project_id)
            .collect::<BTreeSet<_>>()
            .into_iter()
            .collect::<Vec<_>>();
        let names = self.repository.project_names(user_id, &project_ids).await?;
        Ok(build_agent_live(&rows, &names, now))
    }
}

/// Pure so the window, the clock clamp and privacy can be tested without a database.
pub fn build_agent_live(
    rows: &[AgentLiveRow],
    names: &[ProjectNameRow],
    now: u32,
) -> AgentLiveResponse {
    let label = names
        .iter()
        .map(|row| (row.id.as_str(), row.name.as_str()))
        .collect::<HashMap<_, _>>();
    let mut coverage = LiveCoverage {
        truncated: rows.len() > AGENT_LIVE_MAX_ROWS,
        ..LiveCoverage::default()
    };
    let activity = rows
        .iter()
        .take(AGENT_LIVE_MAX_ROWS)
        .filter(|row| {
            if !row.verified {
                coverage.unverified_heartbeats += row.heartbeats;
            }
            row.verified
        })
        .map(|row| {
            coverage.heartbeats += row.heartbeats;
            coverage.future_heartbeats += row.future_heartbeats;
            let (project_key, project_name) = match row.project_id {
                Some(id) => {
                    let key = id.to_string();
                    let name = label
                        .get(key.as_str())
                        .map_or_else(|| "Unknown project".to_string(), |name| (*name).to_string());
                    (key, name)
                }
                None => {
                    coverage.heartbeats_without_project += row.heartbeats;
                    (UNASSIGNED_KEY.to_string(), "No project".to_string())
                }
            };
            LiveAgentActivity {
                agent: row.agent.clone(),
                heartbeats: row.heartbeats,
                last_seen_at: (row.last_time.max(0.0) as u32).min(now),
                model: (!row.model.is_empty()).then(|| row.model.clone()),
                project_key,
                project_name,
            }
        })
        .collect();
    AgentLiveResponse {
        activity,
        coverage,
        schema_version: AGENT_LIVE_SCHEMA_VERSION,
        server_time: now,
        window_seconds: AGENT_LIVE_WINDOW_SECONDS,
    }
}

#[derive(Default)]
struct AgentTotals {
    events: u64,
    priced_events: u64,
    cost_microusd: u64,
    prompts: u64,
    tokens: u64,
    sessions: BTreeSet<String>,
    /// Latest hour first wins, so the model shown is the one in use at the end of the range.
    model: Option<(u32, String)>,
}

#[derive(Default)]
struct ProjectTotals {
    tokens: u64,
    sessions: BTreeSet<(String, String)>,
}

fn cost_status(priced_events: u64, events: u64) -> CostStatus {
    if priced_events == 0 {
        CostStatus::Unavailable
    } else if priced_events < events {
        CostStatus::Partial
    } else {
        CostStatus::Complete
    }
}

/// Pure so totals, grouping and privacy can be tested without a database.
pub fn build_agent_universe(
    rows: &[AgentHourRow],
    names: &[ProjectNameRow],
    range: &ResolvedRange,
) -> AgentUniverseResponse {
    let mut agents: BTreeMap<&str, AgentTotals> = BTreeMap::new();
    let mut projects: BTreeMap<Option<Uuid>, ProjectTotals> = BTreeMap::new();
    let mut coverage = UniverseCoverage::default();
    for row in rows {
        let agent = agents.entry(row.agent.as_str()).or_default();
        agent.events += row.events;
        agent.priced_events += row.priced_events;
        agent.cost_microusd += row.cost_microusd;
        agent.prompts += row.prompts;
        agent.tokens += row.tokens;
        agent.sessions.insert(row.session.clone());
        if !row.model.is_empty()
            && agent
                .model
                .as_ref()
                .is_none_or(|(hour, _)| row.hour >= *hour)
        {
            agent.model = Some((row.hour, row.model.clone()));
        }
        let project = projects.entry(row.project_id).or_default();
        project.tokens += row.tokens;
        project
            .sessions
            .insert((row.agent.clone(), row.session.clone()));
        coverage.events += row.events;
        coverage.events_with_inferred_project += row.inferred_project_events;
        if row.project_id.is_none() {
            coverage.events_without_project += row.events;
        }
        coverage.last_event_at = coverage.last_event_at.max(Some(row.last_event_at));
    }
    coverage.projects_total = projects.keys().filter(|id| id.is_some()).count();

    let label = names
        .iter()
        .map(|row| (row.id.as_str(), row.name.as_str()))
        .collect::<HashMap<_, _>>();
    let mut named = projects.keys().filter_map(|id| *id).collect::<Vec<_>>();
    named.sort_by(|a, b| {
        projects[&Some(*b)]
            .tokens
            .cmp(&projects[&Some(*a)].tokens)
            .then_with(|| a.cmp(b))
    });
    let (kept, folded) = named.split_at(named.len().min(AGENT_UNIVERSE_MAX_PROJECTS));

    let mut project_index: HashMap<Option<Uuid>, usize> = HashMap::new();
    let mut project_list = Vec::new();
    for id in kept {
        let totals = &projects[&Some(*id)];
        let key = id.to_string();
        project_index.insert(Some(*id), project_list.len());
        project_list.push(UniverseProject {
            folded_keys: Vec::new(),
            name: label
                .get(key.as_str())
                .map_or_else(|| "Unknown project".to_string(), |name| (*name).to_string()),
            key,
            sessions: totals.sessions.len() as u32,
            tokens: totals.tokens,
        });
    }
    if !folded.is_empty() {
        let mut sessions = BTreeSet::new();
        let mut tokens = 0;
        for id in folded {
            let totals = &projects[&Some(*id)];
            sessions.extend(totals.sessions.iter().cloned());
            tokens += totals.tokens;
            project_index.insert(Some(*id), project_list.len());
        }
        project_list.push(UniverseProject {
            folded_keys: folded.iter().map(Uuid::to_string).collect(),
            key: OTHER_KEY.to_string(),
            name: format!("{} other projects", folded.len()),
            sessions: sessions.len() as u32,
            tokens,
        });
    }
    if let Some(totals) = projects.get(&None) {
        project_index.insert(None, project_list.len());
        project_list.push(UniverseProject {
            folded_keys: Vec::new(),
            key: UNASSIGNED_KEY.to_string(),
            name: "No project".to_string(),
            sessions: totals.sessions.len() as u32,
            tokens: totals.tokens,
        });
    }

    let mut ordered = agents.into_iter().collect::<Vec<_>>();
    ordered.sort_by(|a, b| b.1.tokens.cmp(&a.1.tokens).then_with(|| a.0.cmp(b.0)));
    let agent_index = ordered
        .iter()
        .enumerate()
        .map(|(index, (name, _))| (*name, index))
        .collect::<HashMap<_, _>>();

    let mut session_numbers: HashMap<(&str, &str), u32> = HashMap::new();
    let activity = rows
        .iter()
        .map(|row| {
            let next = session_numbers.len() as u32;
            let session = *session_numbers
                .entry((row.agent.as_str(), row.session.as_str()))
                .or_insert(next);
            UniverseActivity {
                agent: agent_index[row.agent.as_str()],
                hour: row.hour,
                project: project_index[&row.project_id],
                session,
                tokens: row.tokens,
            }
        })
        .collect();

    let agents = ordered
        .into_iter()
        .map(|(name, totals)| {
            let status = cost_status(totals.priced_events, totals.events);
            UniverseAgent {
                cost_microusd: (status != CostStatus::Unavailable).then_some(totals.cost_microusd),
                cost_status: status,
                events: totals.events,
                model: totals.model.map(|(_, model)| model),
                name: name.to_string(),
                prompts: (totals.prompts > 0).then_some(totals.prompts),
                sessions: totals.sessions.len() as u32,
                tokens: totals.tokens,
            }
        })
        .collect();

    AgentUniverseResponse {
        activity,
        agents,
        coverage,
        projects: project_list,
        range: range.info(),
        schema_version: AGENT_UNIVERSE_SCHEMA_VERSION,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const HOUR: u32 = 1_793_232_000;

    fn project(number: u128) -> Uuid {
        Uuid::from_u128(number)
    }

    fn row(agent: &str, session: &str, id: Option<Uuid>, hour: u32, tokens: u64) -> AgentHourRow {
        AgentHourRow {
            agent: agent.to_string(),
            session: session.to_string(),
            project_id: id,
            hour,
            events: 2,
            tokens,
            priced_events: 2,
            cost_microusd: 500,
            prompts: 1,
            inferred_project_events: 0,
            model: "model-a".to_string(),
            last_event_at: hour + 60,
        }
    }

    fn range() -> ResolvedRange {
        ResolvedRange::parse("2026-10-01", "2026-10-31", Some("UTC")).unwrap()
    }

    fn name(id: Uuid, value: &str) -> ProjectNameRow {
        ProjectNameRow {
            id: id.to_string(),
            name: value.to_string(),
        }
    }

    fn build(rows: &[AgentHourRow], names: &[ProjectNameRow]) -> AgentUniverseResponse {
        build_agent_universe(rows, names, &range())
    }

    #[test]
    fn totals_add_up_across_agents_projects_and_activity() {
        let (a, b) = (project(1), project(2));
        let rows = [
            row("codex", "s1", Some(a), HOUR, 100),
            row("codex", "s1", Some(b), HOUR, 50),
            row("codex", "s2", Some(a), HOUR + 3600, 25),
            row("claude-code", "s1", Some(a), HOUR, 1000),
        ];
        let built = build(&rows, &[name(a, "Shop"), name(b, "Blog")]);
        assert_eq!(built.agents[0].name, "claude-code", "largest first");
        assert_eq!(built.agents[1].tokens, 175);
        assert_eq!(built.agents[1].sessions, 2);
        assert_eq!(built.projects[0].name, "Shop");
        assert_eq!(built.projects[0].tokens, 1125);
        assert_eq!(
            built.projects[0].sessions, 3,
            "same id on two agents is two sessions"
        );
        let tokens = built.activity.iter().map(|item| item.tokens).sum::<u64>();
        assert_eq!(tokens, 1175);
        assert_eq!(built.agents.iter().map(|a| a.tokens).sum::<u64>(), 1175);
        assert_eq!(built.projects.iter().map(|p| p.tokens).sum::<u64>(), 1175);
    }

    #[test]
    fn a_session_on_two_projects_counts_once_for_its_agent() {
        let (a, b) = (project(1), project(2));
        let rows = [
            row("codex", "s1", Some(a), HOUR, 10),
            row("codex", "s1", Some(b), HOUR, 10),
        ];
        let built = build(&rows, &[]);
        assert_eq!(built.agents[0].sessions, 1);
        assert_eq!(built.activity[0].session, built.activity[1].session);
        assert_ne!(built.activity[0].project, built.activity[1].project);
    }

    #[test]
    fn folds_small_projects_and_keeps_every_token() {
        let rows = (0..20u128)
            .map(|index| {
                row(
                    "codex",
                    "s",
                    Some(project(index + 1)),
                    HOUR,
                    100 + index as u64,
                )
            })
            .collect::<Vec<_>>();
        let built = build(&rows, &[]);
        assert_eq!(built.projects.len(), AGENT_UNIVERSE_MAX_PROJECTS + 1);
        assert_eq!(built.projects[0].tokens, 119, "largest stays");
        let other = built.projects.last().unwrap();
        assert_eq!(other.key, OTHER_KEY);
        assert_eq!(other.name, "8 other projects");
        assert_eq!(other.folded_keys.len(), 8);
        assert!(
            other.folded_keys.contains(&project(1).to_string()),
            "smallest is folded"
        );
        assert!(!other.folded_keys.contains(&project(20).to_string()));
        let json = serde_json::to_value(&built.projects).unwrap();
        assert!(
            json[0].get("folded_keys").is_none(),
            "only the other planet carries keys"
        );
        assert_eq!(built.coverage.projects_total, 20);
        assert_eq!(
            built.projects.iter().map(|p| p.tokens).sum::<u64>(),
            rows.iter().map(|r| r.tokens).sum::<u64>()
        );
    }

    #[test]
    fn events_without_a_project_get_their_own_body_and_are_counted() {
        let built = build(&[row("codex", "s", None, HOUR, 10)], &[]);
        assert_eq!(built.projects[0].key, UNASSIGNED_KEY);
        assert_eq!(built.coverage.events_without_project, 2);
        assert_eq!(built.coverage.projects_total, 0);
    }

    #[test]
    fn a_project_with_no_name_is_labelled_not_exposed_by_id() {
        let built = build(&[row("codex", "s", Some(project(1)), HOUR, 10)], &[]);
        assert_eq!(built.projects[0].name, "Unknown project");
    }

    #[test]
    fn cost_is_never_a_silent_zero() {
        let mut unpriced = row("codex", "a", None, HOUR, 10);
        unpriced.priced_events = 0;
        unpriced.cost_microusd = 0;
        let mut partial = row("claude-code", "b", None, HOUR, 20);
        partial.priced_events = 1;
        let built = build(
            &[unpriced, partial, row("gemini", "c", None, HOUR, 30)],
            &[],
        );
        let agent = |value: &str| built.agents.iter().find(|a| a.name == value).unwrap();
        assert_eq!(agent("codex").cost_status, CostStatus::Unavailable);
        assert_eq!(agent("codex").cost_microusd, None);
        assert_eq!(agent("claude-code").cost_status, CostStatus::Partial);
        assert_eq!(agent("claude-code").cost_microusd, Some(500));
        assert_eq!(agent("gemini").cost_status, CostStatus::Complete);
    }

    #[test]
    fn an_agent_with_no_prompts_reports_none_not_zero() {
        let mut silent = row("codex", "a", None, HOUR, 10);
        silent.prompts = 0;
        let built = build(&[silent, row("claude-code", "b", None, HOUR, 5)], &[]);
        assert_eq!(built.agents[0].prompts, None);
        assert_eq!(built.agents[1].prompts, Some(1));
    }

    #[test]
    fn reports_the_latest_model_and_event() {
        let mut early = row("codex", "a", None, HOUR, 10);
        early.model = "old".to_string();
        let late = row("codex", "a", None, HOUR + 3600, 10);
        let mut blank = row("codex", "a", None, HOUR + 7200, 10);
        blank.model = String::new();
        let built = build(&[early, late, blank], &[]);
        assert_eq!(built.agents[0].model.as_deref(), Some("model-a"));
        assert_eq!(built.coverage.last_event_at, Some(HOUR + 7200 + 60));
    }

    #[test]
    fn counts_events_whose_project_was_not_explicitly_attributed() {
        let mut inferred = row("codex", "a", Some(project(1)), HOUR, 10);
        inferred.inferred_project_events = 2;
        assert_eq!(
            build(&[inferred], &[])
                .coverage
                .events_with_inferred_project,
            2
        );
    }

    #[test]
    fn wire_format_hides_raw_session_ids_and_has_no_duration_fields() {
        let built = build(
            &[row(
                "codex",
                "secret-session-id",
                Some(project(1)),
                HOUR,
                10,
            )],
            &[],
        );
        let json = serde_json::to_string(&built).unwrap();
        assert!(!json.contains("secret-session-id"));
        for field in ["seconds", "duration", "prompt_character", "span"] {
            assert!(!json.contains(field), "{field}");
        }
    }

    const NOW: u32 = 1_793_300_000;

    fn live_row(agent: &str, id: Option<Uuid>, last_time: f64, future: u64) -> AgentLiveRow {
        AgentLiveRow {
            agent: agent.to_string(),
            project_id: id,
            heartbeats: 3,
            last_time,
            future_heartbeats: future,
            model: String::new(),
            verified: true,
        }
    }

    #[test]
    fn live_hides_agents_whose_identity_is_not_confirmed() {
        let mut row = live_row("codex", Some(project(1)), f64::from(NOW), 0);
        row.verified = false;
        let built = build_agent_live(&[row], &[], NOW);
        assert!(built.activity.is_empty());
        assert_eq!(built.coverage.unverified_heartbeats, 3);
        assert_eq!(built.coverage.heartbeats, 0);
    }

    #[test]
    fn live_names_projects_with_the_universe_key() {
        let a = project(1);
        let built = build_agent_live(
            &[live_row("codex", Some(a), f64::from(NOW - 120), 0)],
            &[name(a, "Shop")],
            NOW,
        );
        let item = &built.activity[0];
        assert_eq!(
            item.project_key,
            a.to_string(),
            "matches UniverseProject::key"
        );
        assert_eq!(item.project_name, "Shop");
        assert_eq!(item.last_seen_at, NOW - 120);
        assert_eq!(item.model, None, "an unreported model is none, not empty");
        assert_eq!(built.server_time, NOW);
        assert_eq!(built.window_seconds, AGENT_LIVE_WINDOW_SECONDS);
        assert_eq!(built.coverage.heartbeats, 3);
    }

    #[test]
    fn live_pins_a_fast_client_clock_to_now_and_counts_it() {
        let built = build_agent_live(
            &[live_row(
                "claude-code",
                Some(project(1)),
                f64::from(NOW + 90),
                2,
            )],
            &[],
            NOW,
        );
        assert_eq!(built.activity[0].last_seen_at, NOW);
        assert_eq!(built.activity[0].project_name, "Unknown project");
        assert_eq!(built.coverage.future_heartbeats, 2);
    }

    #[test]
    fn live_without_a_project_is_unassigned_and_counted() {
        let built = build_agent_live(&[live_row("codex", None, f64::from(NOW), 0)], &[], NOW);
        assert_eq!(built.activity[0].project_key, "unassigned");
        assert_eq!(built.activity[0].project_name, "No project");
        assert_eq!(built.coverage.heartbeats_without_project, 3);
    }

    #[test]
    fn live_marks_truncation_instead_of_hiding_it() {
        let rows = (0..=AGENT_LIVE_MAX_ROWS as u128)
            .map(|index| live_row("codex", Some(project(index)), f64::from(NOW), 0))
            .collect::<Vec<_>>();
        let built = build_agent_live(&rows, &[], NOW);
        assert_eq!(built.activity.len(), AGENT_LIVE_MAX_ROWS);
        assert!(built.coverage.truncated);
    }

    #[test]
    fn live_wire_format_has_no_path_session_or_duration() {
        let mut row = live_row("codex", Some(project(1)), f64::from(NOW), 0);
        row.model = "gpt-5".to_string();
        let json = serde_json::to_value(build_agent_live(&[row], &[], NOW)).unwrap();
        let text = json.to_string();
        for field in [
            "entity",
            "session",
            "duration",
            "active_seconds",
            "path",
            "user_id",
        ] {
            assert!(
                !text.contains(field),
                "live response must not carry {field}: {text}"
            );
        }
        assert_eq!(json["activity"][0]["model"], "gpt-5");
    }

    #[test]
    fn an_empty_range_is_an_empty_universe() {
        let built = build(&[], &[]);
        assert!(built.agents.is_empty());
        assert!(built.projects.is_empty());
        assert_eq!(built.coverage.last_event_at, None);
    }

    #[tokio::test]
    #[ignore = "requires isolated CLICKHOUSE_TEST_URL"]
    async fn agrees_with_a_direct_sum_of_usage_events() {
        #[derive(clickhouse::Row, serde::Deserialize, Debug)]
        struct Sum {
            agent: String,
            #[serde(with = "clickhouse::serde::uuid")]
            user_id: Uuid,
            tokens: u64,
        }
        let client = crate::test_support::clickhouse_client().await;
        crate::repository::ai_usage::AiUsageRepository::new(client.clone())
            .migrate()
            .await
            .unwrap();
        let (start, end) = (1_791_000_000u32, 1_794_000_000u32);
        // Seed a fresh user so the comparison never depends on rows other tests left behind.
        // Events straddle hours and sessions, with some outside the range on each side. No
        // project is attached: project names come from a table whose migration also alters
        // heartbeats, which this test must not touch.
        let user = Uuid::new_v4();
        let seeded = [
            ("codex", "s1", start - 1, 10, 5),
            ("codex", "s1", start, 120, 30),
            ("codex", "s1", start + 59, 7, 3),
            ("codex", "s2", start + 7_200, 40, 0),
            ("claude-code", "s3", start + 3_600, 500, 250),
            ("claude-code", "s3", end - 1, 1, 1),
            ("claude-code", "s3", end, 9_000, 9_000),
        ];
        for (index, (agent, session, time, input, output)) in seeded.into_iter().enumerate() {
            client
                .get_client()
                .query(
                    "INSERT INTO wakaclock.ai_usage_events (user_id, date, usage_event_id, ai_session_id,
                        event_time, ai_agent, prompt_count, input_tokens, output_tokens, token_source,
                        version, received_at)
                     VALUES (?, toDate(toDateTime(?)), ?, ?, ?, ?, 1, ?, ?, 'provider', 1, ?)",
                )
                .bind(user)
                .bind(time)
                .bind(format!("universe-{index}"))
                .bind(session)
                .bind(time)
                .bind(agent)
                .bind(input)
                .bind(output)
                .bind(time)
                .execute()
                .await
                .unwrap();
        }
        let direct = client
            .get_client()
            .query(
                "SELECT ai_agent AS agent, user_id,
                        sum(toUInt64(ifNull(input_tokens, 0)) + toUInt64(ifNull(output_tokens, 0))) AS tokens
                 FROM wakaclock.ai_usage_events FINAL
                 WHERE user_id = ? AND event_time >= ? AND event_time < ?
                 GROUP BY agent, user_id ORDER BY tokens DESC",
            )
            .bind(user)
            .bind(start)
            .bind(end)
            .fetch_all::<Sum>()
            .await
            .unwrap();
        assert_eq!(
            direct
                .iter()
                .map(|row| (row.agent.as_str(), row.tokens))
                .collect::<Vec<_>>(),
            [("claude-code", 752), ("codex", 200)]
        );
        let repository = AgentUniverseRepository::new(client);
        let started = std::time::Instant::now();
        let rows = repository
            .hours(user, f64::from(start), f64::from(end))
            .await
            .unwrap();
        let ids = rows
            .iter()
            .filter_map(|r| r.project_id)
            .collect::<BTreeSet<_>>();
        let names = repository
            .project_names(user, &ids.into_iter().collect::<Vec<_>>())
            .await
            .unwrap();
        let built = build_agent_universe(&rows, &names, &range());
        println!(
            "rows={} agents={} projects={} json={}KB {}ms coverage={:?}",
            rows.len(),
            built.agents.len(),
            built.projects.len(),
            serde_json::to_string(&built).unwrap().len() / 1024,
            started.elapsed().as_millis(),
            built.coverage
        );
        for expected in direct.iter().filter(|row| row.user_id == user) {
            let agent = built
                .agents
                .iter()
                .find(|a| a.name == expected.agent)
                .unwrap();
            println!(
                "  {} direct={} universe={} sessions={} cost={:?} {:?} prompts={:?}",
                agent.name,
                expected.tokens,
                agent.tokens,
                agent.sessions,
                agent.cost_microusd,
                agent.cost_status,
                agent.prompts
            );
            assert_eq!(agent.tokens, expected.tokens);
        }
        for project in built.projects.iter().take(6) {
            println!(
                "  {} tokens={} sessions={}",
                project.name, project.tokens, project.sessions
            );
        }
    }
}
