#!/usr/bin/env bash
# Export one user's raw heartbeat stream from ClickHouse so the duration audit can
# replay it. Reads CLICKHOUSE_* from backend/api/.env unless already exported.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${HERE}/../../backend/api/.env"

USER_ID="${1:-}"
if [ -z "$USER_ID" ]; then
  echo "usage: $0 <user-uuid>" >&2
  exit 2
fi

CH_URL="${CLICKHOUSE_URL:-$(grep -m1 '^CLICKHOUSE_URL=' "$ENV_FILE" | cut -d= -f2-)}"
CH_USER="${CLICKHOUSE_USER:-$(grep -m1 '^CLICKHOUSE_USER=' "$ENV_FILE" | cut -d= -f2-)}"
CH_PASS="${CLICKHOUSE_PASSWORD:-$(grep -m1 '^CLICKHOUSE_PASSWORD=' "$ENV_FILE" | cut -d= -f2-)}"

run() { printf '%s' "$1" | curl -sS --fail --user "${CH_USER}:${CH_PASS}" "${CH_URL}/" --data-binary @-; }

run "SELECT entity, time, project, language, category, is_ai_generated, heartbeat_id,
            active_seconds, activity_segments, editor, ai_agent
     FROM wakaclock.heartbeats WHERE user_id='${USER_ID}' ORDER BY time
     FORMAT JSONEachRow" > "${HERE}/hb.jsonl"

run "SELECT segment_id, heartbeat_id, \`start\`, \`end\`, source, entity, project, language, category
     FROM wakaclock.activity_intervals FINAL WHERE user_id='${USER_ID}' ORDER BY \`start\`
     FORMAT JSONEachRow" > "${HERE}/ai.jsonl"

wc -l "${HERE}/hb.jsonl" "${HERE}/ai.jsonl"
