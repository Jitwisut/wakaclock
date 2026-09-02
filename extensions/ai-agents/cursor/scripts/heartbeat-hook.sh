#!/usr/bin/env bash
# SCAFFOLD — see ../README.md before trusting this against a real Cursor install.
#
# AtoAxis heartbeat hook for Cursor's `afterFileEdit` event. Unlike every other
# agent's hook in this directory, Cursor's documented payload hands the edit's own
# before/after text directly (`edits[].old_string`/`new_string`) rather than requiring
# a filesystem snapshot diff — so this script does NOT call `wakaclock ai tool-before`/
# `tool-after`; it emits straight to `wakaclock ai emit`, mirroring how the Claude Code
# plugin's heartbeat.sh handles Edit/MultiEdit.
#
# `old_string`/`new_string` are read only to count lines in memory (`count_lines`
# below) and are never written to disk, logged, or included in the emitted event —
# same metadata-only contract as every other adapter here.
set -euo pipefail

INPUT="$(cat)"

if ! command -v jq >/dev/null 2>&1; then
  echo "atoaxis-heartbeat (cursor): jq is required but not found on PATH — skipping" >&2
  exit 0
fi

WAKACLOCK_BIN="${WAKACLOCK_CLI_PATH:-}"
if [ -z "$WAKACLOCK_BIN" ] && [ -f "${HOME}/.wakaclock/cli-path" ]; then
  WAKACLOCK_BIN="$(tr -d '\r\n' < "${HOME}/.wakaclock/cli-path")"
fi
WAKACLOCK_BIN="${WAKACLOCK_BIN:-wakaclock}"
if ! command -v "$WAKACLOCK_BIN" >/dev/null 2>&1; then
  echo "atoaxis-heartbeat (cursor): '$WAKACLOCK_BIN' not found on PATH — install the wakaclock binary or set WAKACLOCK_CLI_PATH" >&2
  exit 0
fi

# Keep even the scaffold adapter behind the same metadata allowlist as the native
# integrations. Marketplace/stable bundles may be upgraded one directory at a time,
# so retain a strict envelope fallback when the sibling common emitter is absent.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd || true)"
COMMON_EMITTER="${WAKACLOCK_AGENT_COMMON_EMITTER:-${SCRIPT_DIR}/../../common/emit-event.sh}"
emit_metadata() {
  if [ -x "$COMMON_EMITTER" ]; then
    "$COMMON_EMITTER"
  else
    jq -c '{schema_version:1,producer_version:(.producer_version // 1),event_type:"file_change",event_id,occurred_at,entity,project_root:(.project_root // null),change_kind:(.change_kind // "modify"),previous_entity:(.previous_entity // null),agent:(.agent // .client_id),provider:(.provider // .provider_id // null),model:(.model // .model_id // null),session_id:(.session_id // null),source:(.source // "agent_hook"),confidence:(.confidence // "verified"),lines_added:(.lines_added // null),lines_deleted:(.lines_deleted // null),transport:(.transport // "native_plugin"),tool:(.tool // null),tool_event_id:(.tool_event_id // .tool_call_id // null)}' \
      | "$WAKACLOCK_BIN" ai emit --json >/dev/null 2>&1 || true
  fi
}

FILE_PATH="$(jq -r '.file_path // empty' <<<"$INPUT")"
WORKSPACE_ROOT="$(jq -r '.workspace_roots[0] // empty' <<<"$INPUT" 2>/dev/null || true)"
SESSION_ID="$(jq -r '.conversation_id // empty' <<<"$INPUT" 2>/dev/null || true)"
CALL_ID="$(jq -r '.generation_id // empty' <<<"$INPUT" 2>/dev/null || true)"

if [ -z "$FILE_PATH" ]; then
  exit 0
fi
if [[ "$FILE_PATH" != /* ]]; then
  FILE_PATH="${WORKSPACE_ROOT:-$PWD}/${FILE_PATH}"
fi

# Same "rough line count, not a real diff" rule as every other adapter's count_lines —
# see ../../plugins/atoaxis-heartbeat/scripts/heartbeat.sh's own comment on this.
count_lines() {
  if [ -z "$1" ]; then
    printf '0\n'
    return
  fi
  printf '%s' "$1" | awk 'END { print NR }'
}

LINES_ADDED=0
LINES_DELETED=0
while IFS= read -r edit; do
  OLD="$(jq -r '.old_string // empty' <<<"$edit")"
  NEW="$(jq -r '.new_string // empty' <<<"$edit")"
  LINES_ADDED=$((LINES_ADDED + $(count_lines "$NEW")))
  LINES_DELETED=$((LINES_DELETED + $(count_lines "$OLD")))
done < <(jq -c '.edits[]? // empty' <<<"$INPUT")

# No edits[] parsed at all (either the field name is wrong or this call touched
# nothing) — nothing to report rather than guessing.
if [ "$LINES_ADDED" -eq 0 ] && [ "$LINES_DELETED" -eq 0 ]; then
  exit 0
fi

EVENT_MATERIAL="${SESSION_ID}|${CALL_ID:-afterFileEdit}|${FILE_PATH}"
if command -v shasum >/dev/null 2>&1; then
  EVENT_HASH="$(printf '%s' "$EVENT_MATERIAL" | shasum -a 256 | cut -c1-40)"
elif command -v sha256sum >/dev/null 2>&1; then
  EVENT_HASH="$(printf '%s' "$EVENT_MATERIAL" | sha256sum | cut -c1-40)"
elif command -v cksum >/dev/null 2>&1; then
  EVENT_HASH="$(printf '%s' "$EVENT_MATERIAL" | cksum | awk '{print $1":"$2}')"
else
  EVENT_HASH="unhashed-$$"
fi
EVENT_ID="cursor-${EVENT_HASH}"
OCCURRED_AT="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"

jq -cn \
  --arg event_id "$EVENT_ID" \
  --arg occurred_at "$OCCURRED_AT" \
  --arg entity "$FILE_PATH" \
  --arg session_id "$SESSION_ID" \
  --arg project_root "$WORKSPACE_ROOT" \
  --arg agent "cursor" \
  --arg provider "anysphere" \
  --argjson lines_added "$LINES_ADDED" \
  --argjson lines_deleted "$LINES_DELETED" \
  '{client_id:$agent,producer_version:1,event_id:$event_id,occurred_at:$occurred_at,entity:$entity,project_root:(if $project_root=="" then null else $project_root end),change_kind:"modify",agent:$agent,provider_id:$provider,model_id:null,session_id:(if $session_id=="" then null else $session_id end),source:"agent_hook",confidence:"verified",lines_added:$lines_added,lines_deleted:$lines_deleted,transport:"native_plugin",tool:"afterFileEdit",tool_event_id:$event_id}' \
  | emit_metadata

exit 0
