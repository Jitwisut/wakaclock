//! Prices only canonical, uniquely confirmed facts up to merge. Never copies a cost into PG.
use crate::model::{ai_usage::AiUsageEventRow, team_insights::Metric};
use anyhow::{Context, Result};
use chrono::{DateTime, Utc};
use std::collections::{BTreeMap, BTreeSet};
use uuid::Uuid;

#[derive(Debug, Clone, serde::Serialize)]
pub struct MergedLink {
    pub repository: Uuid,
    pub item: i64,
    pub merged_at: DateTime<Utc>,
    pub user: Option<Uuid>,
    pub session: Option<String>,
    pub projects: Vec<Uuid>,
    pub since: Option<DateTime<Utc>>,
    pub targets: i64,
    pub visible: bool,
}
pub use crate::model::team_insights::MergedCost;
pub fn session(f: &AiUsageEventRow) -> String {
    crate::services::team_github::hash(&format!(
        "{}:{}:{}:{}:{}",
        f.user_id,
        f.ai_agent.len(),
        f.ai_agent,
        f.collector_id.as_deref().unwrap_or(""),
        f.ai_session_id
    ))
}
fn metric(value: u64, coverage: f64, at: Option<DateTime<Utc>>) -> Metric<u64> {
    Metric {
        value: Some(value),
        status: "partial",
        reason: Some("known_linked_usage_only_capture_unconfirmed"),
        coverage: Some(coverage),
        provenance: "confirmed_links_canonical_usage_until_merge",
        updated_at: at,
        calculation_version: "confirmed_observed_usage_to_merge_v1",
    }
}
pub fn calculate(
    facts: &[AiUsageEventRow],
    links: &[MergedLink],
    cutoff: DateTime<Utc>,
) -> Result<MergedCost> {
    let mut latest = BTreeMap::new();
    for f in facts {
        let k = (f.user_id, f.usage_event_id.clone());
        if latest
            .get(&k)
            .is_none_or(|old: &&AiUsageEventRow| old.version < f.version)
        {
            latest.insert(k, f);
        }
    }
    let mut groups = BTreeMap::<(Uuid, i64), (u64, usize, usize, bool, BTreeSet<Uuid>)>::new();
    let mut people = BTreeSet::new();
    let mut admitted = BTreeSet::new();
    let mut prices = BTreeSet::new();
    let mut updated = None;
    for l in links {
        let g = groups
            .entry((l.repository, l.item))
            .or_insert((0, 0, 0, true, BTreeSet::new()));
        if !l.visible || l.targets != 1 || l.session.is_none() || l.since.is_none() {
            g.3 = false;
            continue;
        }
        let since = l.since.unwrap().max(cutoff);
        for (key, f) in &latest {
            if Some(f.user_id) != l.user
                || Some(session(f)) != l.session
                || !f.project_id.is_some_and(|p| l.projects.contains(&p))
                || f.project_attribution_method.as_deref() != Some("explicit_project_hint")
            {
                continue;
            }
            let at = DateTime::from_timestamp(f.event_time as i64, 0)
                .context("invalid canonical usage time")?;
            if at < since || at > l.merged_at {
                continue;
            }
            if !admitted.insert(key.clone()) {
                continue;
            }
            g.1 += 1;
            people.insert(f.user_id);
            g.4.insert(f.user_id);
            updated = updated.max(DateTime::from_timestamp(f.received_at as i64, 0));
            if let (Some(cost), Some(price), Some(_), Some(_)) = (
                f.estimated_cost_microusd,
                &f.pricing_version,
                &f.ai_provider,
                &f.ai_model,
            ) {
                g.0 = g.0.checked_add(cost).context("AI cost overflow")?;
                g.2 += 1;
                prices.insert(price.clone());
            } else {
                g.3 = false;
            }
        }
    }
    let known = groups.values().map(|g| g.2).sum::<usize>();
    let events = groups.values().map(|g| g.1).sum::<usize>();
    let priced_people = latest
        .iter()
        .filter(|(k, f)| {
            admitted.contains(*k)
                && f.estimated_cost_microusd.is_some()
                && f.pricing_version.is_some()
                && f.ai_provider.is_some()
                && f.ai_model.is_some()
        })
        .map(|(_, f)| f.user_id)
        .collect::<BTreeSet<_>>();
    if priced_people.len() < 5 {
        return Ok(MergedCost::withheld("privacy_suppressed"));
    }
    let missing_people = groups
        .values()
        .filter(|g| g.2 == 0 || !g.3)
        .flat_map(|g| g.4.iter().copied())
        .collect::<BTreeSet<_>>();
    let complete_people = groups
        .values()
        .filter(|g| g.3 && g.1 > 0 && g.1 == g.2)
        .flat_map(|g| g.4.iter().copied())
        .collect::<BTreeSet<_>>();
    if people.len() < 5
        || !super::team_insights::publishable_partition(&[
            priced_people,
            missing_people,
            complete_people,
        ])
    {
        return Ok(MergedCost::withheld("privacy_suppressed"));
    }
    if known == 0 {
        return Ok(MergedCost::withheld("usage_or_price_unavailable"));
    }
    let sum = groups
        .values()
        .try_fold(0u64, |n, g| n.checked_add(g.0).context("AI cost overflow"))?;
    // Completeness of received facts cannot prove complete capture. Publishing an
    // average (and its denominator) would claim a coverage guarantee we do not have.
    // It also creates a second cost equation that can reveal a small remainder.
    let average = Metric::unavailable("capture_completeness_unconfirmed");
    let with = groups.values().filter(|g| g.2 > 0).count() as u64;
    let without = if groups.values().any(|g| g.4.is_empty()) {
        Metric::unavailable("unlinked_or_nonsharing_cohort_unconfirmed")
    } else {
        metric(groups.len() as u64 - with, 1.0, updated)
    };
    Ok(MergedCost {
        cost_microusd: metric(sum, known as f64 / events as f64, updated),
        average_microusd: average,
        with_cost: metric(with, known as f64 / events as f64, updated),
        without_cost: without,
        complete_prs: Metric::unavailable("capture_completeness_unconfirmed"),
        pricing_versions: prices.into_iter().collect(),
        calculation_version: "confirmed_observed_usage_to_merge_v1",
        people,
        admitted,
    })
}
/// Compare equations by *fact membership*, not just whether the same five people appear.
/// A one-person remainder remains suppressed even if both totals have five people.
pub fn joint_partition(
    facts: &[AiUsageEventRow],
    week: (u32, u32),
    weekly_people: &BTreeSet<Uuid>,
    merged: &MergedCost,
) -> bool {
    let mut cells =
        BTreeMap::<(bool, bool, Option<String>, Option<String>, bool), BTreeSet<Uuid>>::new();
    for f in facts {
        let w =
            weekly_people.contains(&f.user_id) && f.event_time >= week.0 && f.event_time < week.1;
        let m = merged
            .admitted
            .contains(&(f.user_id, f.usage_event_id.clone()));
        if !w && !m {
            continue;
        }
        cells
            .entry((
                w,
                m,
                f.ai_provider.clone(),
                f.ai_model.clone(),
                f.estimated_cost_microusd.is_some() && f.pricing_version.is_some(),
            ))
            .or_default()
            .insert(f.user_id);
    }
    super::team_insights::publishable_partition(&cells.into_values().collect::<Vec<_>>())
}

#[cfg(test)]
mod tests {
    use super::*;
    fn fact(user: Uuid, project: Uuid, event: &str, at: u32, cost: Option<u64>) -> AiUsageEventRow {
        serde_json::from_str(&serde_json::json!({"user_id":user,"date":0,"usage_event_id":event,"event_payload_hash":null,"ai_session_id":"ws1_test","collector_id":Uuid::from_u128(90).to_string(),"event_time":at,"project_id":project,"project_attribution_method":"explicit_project_hint","ai_agent":"codex","ai_provider":"openai","ai_model":"test_model","prompt_count":1,"prompt_character_count":null,"input_tokens":1,"output_tokens":1,"cache_read_tokens":null,"cache_write_tokens":null,"estimated_cost_microusd":cost,"pricing_version":if cost.is_some(){Some("catalog_test_v1")}else{None},"token_source":"provider_reported","version":1,"received_at":at}).to_string()).unwrap()
    }
    fn fixture() -> (Vec<AiUsageEventRow>, Vec<MergedLink>) {
        let mut facts = vec![];
        let mut links = vec![];
        for n in 1..=5 {
            let user = Uuid::from_u128(n);
            let project = Uuid::from_u128(100 + n);
            let f = fact(user, project, &format!("u{n}"), 100, Some(n as u64 * 100));
            links.push(MergedLink {
                repository: Uuid::from_u128(99),
                item: 1,
                merged_at: DateTime::from_timestamp(200, 0).unwrap(),
                user: Some(user),
                session: Some(session(&f)),
                projects: vec![project],
                since: DateTime::from_timestamp(50, 0),
                targets: 1,
                visible: true,
            });
            facts.push(f);
        }
        (facts, links)
    }
    fn calculate_test(facts: &[AiUsageEventRow], links: &[MergedLink]) -> MergedCost {
        calculate(facts, links, DateTime::from_timestamp(0, 0).unwrap()).unwrap()
    }
    #[test]
    fn independent_ledger_uses_latest_revision_once_through_merge() {
        let (mut facts, mut links) = fixture();
        let mut correction = facts[0].clone();
        correction.version = 2;
        correction.estimated_cost_microusd = Some(900);
        facts.push(correction);
        let mut post = facts[1].clone();
        post.usage_event_id = "post_merge".into();
        post.event_time = 201;
        facts.push(post);
        let mut pre = facts[1].clone();
        pre.usage_event_id = "pre_consent".into();
        pre.event_time = 49;
        facts.push(pre);
        links.push(links[0].clone());
        let cost = calculate_test(&facts, &links);
        assert_eq!(cost.cost_microusd.value, Some(2300));
        assert_eq!(cost.admitted.len(), 5);
        assert_eq!(cost.average_microusd.value, None);
        assert_eq!(cost.complete_prs.value, None);
        assert_eq!(
            cost.average_microusd.reason,
            Some("capture_completeness_unconfirmed")
        );
    }
    #[test]
    fn corrected_project_is_not_replaced_by_old_revision() {
        let (mut facts, links) = fixture();
        let mut c = facts[0].clone();
        c.version = 2;
        c.project_id = Some(Uuid::from_u128(999));
        facts.push(c);
        assert_eq!(calculate_test(&facts, &links).cost_microusd.value, None);
    }
    #[test]
    fn unknown_price_never_becomes_zero_or_exposes_small_remainder() {
        let (mut facts, links) = fixture();
        facts[0].estimated_cost_microusd = None;
        facts[0].pricing_version = None;
        assert_eq!(calculate_test(&facts, &links).cost_microusd.value, None);
        let (mut facts, links) = fixture();
        for f in &mut facts {
            f.estimated_cost_microusd = None;
            f.pricing_version = None;
        }
        assert_eq!(calculate_test(&facts, &links).cost_microusd.value, None);
    }
    #[test]
    fn ambiguous_multi_work_sessions_remain_unallocated() {
        let (facts, mut links) = fixture();
        for l in &mut links {
            l.targets = 2;
        }
        let cost = calculate_test(&facts, &links);
        assert_eq!(cost.cost_microusd.value, None);
        assert!(cost.admitted.is_empty());
    }
    #[test]
    fn same_people_in_two_totals_cannot_expose_one_person_fact_difference() {
        let (mut facts, links) = fixture();
        let merged = calculate_test(&facts, &links);
        let mut extra = facts[0].clone();
        extra.usage_event_id = "weekly_only".into();
        extra.event_time = 150;
        facts.push(extra);
        let people = facts.iter().map(|f| f.user_id).collect();
        assert!(!joint_partition(&facts, (0, 200), &people, &merged));
    }
    #[test]
    fn five_person_shared_equations_and_calendar_cutoff() {
        let (facts, links) = fixture();
        let cost = calculate_test(&facts, &links);
        let people = facts.iter().map(|f| f.user_id).collect();
        assert!(joint_partition(&facts, (0, 200), &people, &cost));
        assert_eq!(
            calculate(&facts, &links, DateTime::from_timestamp(101, 0).unwrap())
                .unwrap()
                .cost_microusd
                .value,
            None
        );
    }
}
