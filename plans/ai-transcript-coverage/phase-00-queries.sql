-- Phase 00 — read-only ClickHouse queries (owner runs these and pastes the results)
-- Every query only SELECTs and returns counts; none returns entity paths or content.
--
-- Run with clickhouse-client, passing your own user UUID as a parameter, e.g.:
--   clickhouse-client --param_owner='<your-user-uuid>' --queries-file phase-00-queries.sql
-- (Your UUID is user_id in wakaclock.heartbeats, or users.id in Postgres.)

-- Q0 (run first) Which agent/source labels does the server actually store for AI rows?
-- Q2 relies on 'agent_hook' / 'transcript' surviving server-side attribution policy; if Q0 shows
-- other labels (e.g. 'observer', empty agent), a zero from Q2 does not mean "no duplicates".
SELECT
    ai_agent,
    ai_source,
    actor_type,
    ai_confidence,
    count() AS rows
FROM wakaclock.heartbeats
WHERE user_id = {owner:UUID}
  AND date >= today() - 30
  AND actor_type != 'human'
GROUP BY ai_agent, ai_source, actor_type, ai_confidence
ORDER BY rows DESC
LIMIT 50;

-- Q1 (A4) Does the server store usage tokens/prompt counts? Last 7 days.
SELECT
    ai_agent,
    count()                                     AS rows,
    countIf(input_tokens IS NOT NULL)           AS with_tokens,
    countIf(prompt_character_count IS NOT NULL) AS with_prompt_chars,
    countIf(prompt_count > 0)                   AS with_prompt_count
FROM wakaclock.ai_usage_events
WHERE user_id = {owner:UUID}
  AND date >= today() - 7
GROUP BY ai_agent
ORDER BY rows DESC;

-- Q2 (A5) hook vs transcript rows for the same agent + file within N seconds. Last 30 days.
-- Pairs are many-to-many, so treat these as an upper bound.
SELECT
    h.ai_agent                                                      AS agent,
    countIf(abs(t.time - h.time) <= 5)                              AS pairs_5s,
    countIf(abs(t.time - h.time) <= 10)                             AS pairs_10s,
    count()                                                         AS pairs_30s,
    sumIf(coalesce(t.ai_lines_added, 0), abs(t.time - h.time) <= 5) AS extra_lines_added_5s,
    uniqExactIf(toDate(toDateTime(h.time)), abs(t.time - h.time) <= 5) AS days_with_dupes
FROM
(
    SELECT ai_agent, entity, time
    FROM wakaclock.heartbeats
    WHERE user_id = {owner:UUID} AND date >= today() - 30 AND ai_source = 'agent_hook'
) AS h
INNER JOIN
(
    SELECT ai_agent, entity, time, ai_lines_added
    FROM wakaclock.heartbeats
    WHERE user_id = {owner:UUID} AND date >= today() - 30 AND ai_source = 'transcript'
) AS t
ON h.ai_agent = t.ai_agent AND h.entity = t.entity
WHERE abs(t.time - h.time) <= 30
GROUP BY agent
ORDER BY pairs_5s DESC;

-- Q3 (A5) Do transcript rows lack ai_change_id? Last 30 days.
SELECT
    ai_agent,
    ai_source,
    count()                         AS rows,
    countIf(ai_change_id IS NULL)   AS null_change_id,
    sum(coalesce(ai_lines_added, 0)) AS lines_added
FROM wakaclock.heartbeats
WHERE user_id = {owner:UUID}
  AND date >= today() - 30
  AND ai_agent IN ('claude-code', 'codex')
GROUP BY ai_agent, ai_source
ORDER BY ai_agent, rows DESC;

-- Q4 (0.7) Rows with ai_confidence = 'explicit' and how they were stored. Last 30 days.
SELECT
    ai_agent,
    ai_source,
    ai_confidence,
    actor_type,
    count() AS rows
FROM wakaclock.heartbeats
WHERE user_id = {owner:UUID}
  AND date >= today() - 30
  AND lower(ifNull(ai_confidence, '')) = 'explicit'
GROUP BY ai_agent, ai_source, ai_confidence, actor_type
ORDER BY rows DESC;
