#!/usr/bin/env bash
#
# AtoAxis heartbeat hook for Gemini CLI — fires on AfterTool for write_file/replace (see
# hooks/hooks.json) and reports the edited file via `wakaclock ai emit` to the local broker.
# Structurally the same approach as the Claude Code plugin's scripts/heartbeat.sh; only
# the tool names (write_file/replace vs Write/Edit) and the `${extensionPath}` variable
# (vs `${CLAUDE_PLUGIN_ROOT}`) differ, since both CLIs use the same `tool_input.file_path`
# / `.content` / `.old_string` / `.new_string` shape for their file-edit tools.
set -euo pipefail

INPUT="$(cat)"

if ! command -v jq >/dev/null 2>&1; then
  echo "atoaxis-heartbeat (gemini): jq is required but not found on PATH — skipping" >&2
  exit 0
fi

WAKACLOCK_BIN="${WAKACLOCK_CLI_PATH:-}"
if [ -z "$WAKACLOCK_BIN" ] && [ -f "${HOME}/.wakaclock/cli-path" ]; then
  WAKACLOCK_BIN="$(tr -d '\r\n' < "${HOME}/.wakaclock/cli-path")"
fi
WAKACLOCK_BIN="${WAKACLOCK_BIN:-wakaclock}"
if ! command -v "$WAKACLOCK_BIN" >/dev/null 2>&1; then
  echo "atoaxis-heartbeat (gemini): '$WAKACLOCK_BIN' not found on PATH — install the wakaclock binary or set WAKACLOCK_CLI_PATH" >&2
  exit 0
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd || true)"
COMMON_EMITTER="${WAKACLOCK_AGENT_COMMON_EMITTER:-${SCRIPT_DIR}/../../common/emit-event.sh}"
emit_metadata() {
  if [ -x "$COMMON_EMITTER" ]; then
    "$COMMON_EMITTER"
  else
    # Older bundles may not contain the shared emitter yet. Convert its
    # allowlisted producer object into the strict broker envelope so the legacy
    # CLI still accepts the event instead of silently dropping client_id fields.
    jq -c '{schema_version:1,producer_version:(.producer_version // 1),event_type:"file_change",event_id,occurred_at,entity,project_root:(.project_root // null),change_kind:(.change_kind // "modify"),previous_entity:(.previous_entity // null),agent:(.agent // .client_id),provider:(.provider // .provider_id // null),model:(.model // .model_id // null),session_id:(.session_id // null),source:(.source // "agent_hook"),confidence:(.confidence // "verified"),actor_type:(.actor_type // null),actor_confidence:(.actor_confidence // null),lines_added:(.lines_added // null),lines_deleted:(.lines_deleted // null),active_seconds:(.active_seconds // null),transport:(.transport // "native_plugin"),tool:(.tool // null),tool_event_id:(.tool_event_id // .tool_call_id // null)}' \
      | "$WAKACLOCK_BIN" ai emit --json >/dev/null 2>&1 || true
  fi
}

TOOL_NAME="$(jq -r '.tool_name // empty' <<<"$INPUT")"
FILE_PATH="$(jq -r '.tool_input.file_path // empty' <<<"$INPUT")"
AI_MODEL="$(jq -r '.model // .model_name // .model_id // .context.model // empty' <<<"$INPUT")"
SESSION_ID="$(jq -r '.session_id // .sessionId // empty' <<<"$INPUT" 2>/dev/null || true)"
CALL_ID="$(jq -r '.tool_use_id // .toolUseId // .call_id // .callId // .tool_call_id // .toolCallId // empty' <<<"$INPUT" 2>/dev/null || true)"
CWD="$(jq -r '.cwd // .workdir // .working_dir // .tool_input.cwd // empty' <<<"$INPUT" 2>/dev/null || true)"
[ -n "$CWD" ] && [ -d "$CWD" ] || CWD="$PWD"

if [ -z "$FILE_PATH" ]; then
  exit 0
fi
if [[ "$FILE_PATH" != /* ]]; then
  FILE_PATH="${CWD}/${FILE_PATH}"
fi

# Same rough "lines touched" heuristic as the Claude Code hook — see that script's
# comment for why this isn't meant to be a byte-exact diff.
count_lines() {
  if [ -z "$1" ]; then
    printf '0\n'
    return
  fi
  printf '%s' "$1" | awk 'END { print NR }'
}

case "$TOOL_NAME" in
  write_file)
    CONTENT="$(jq -r '.tool_input.content // empty' <<<"$INPUT")"
    LINES_ADDED="$(count_lines "$CONTENT")"
    LINES_DELETED=0
    ;;
  replace)
    OLD="$(jq -r '.tool_input.old_string // empty' <<<"$INPUT")"
    NEW="$(jq -r '.tool_input.new_string // empty' <<<"$INPUT")"
    LINES_ADDED="$(count_lines "$NEW")"
    LINES_DELETED="$(count_lines "$OLD")"
    ;;
  *)
    exit 0
    ;;
esac

EVENT_MATERIAL="${SESSION_ID}|${CALL_ID:-$TOOL_NAME}|${FILE_PATH}"
if command -v shasum >/dev/null 2>&1; then
  EVENT_HASH="$(printf '%s' "$EVENT_MATERIAL" | shasum -a 256 | cut -c1-40)"
elif command -v sha256sum >/dev/null 2>&1; then
  EVENT_HASH="$(printf '%s' "$EVENT_MATERIAL" | sha256sum | cut -c1-40)"
elif command -v cksum >/dev/null 2>&1; then
  EVENT_HASH="$(printf '%s' "$EVENT_MATERIAL" | cksum | awk '{print $1":"$2}')"
else
  EVENT_HASH="unhashed-$$"
fi
EVENT_ID="gemini-cli-${EVENT_HASH}"
OCCURRED_AT="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"

# BrokerProcessor owns the metadata-only sidecar and writes it once after durable
# acceptance. The hook only passes the strict event envelope to the CLI adapter.
jq -cn \
  --arg event_id "$EVENT_ID" \
  --arg occurred_at "$OCCURRED_AT" \
  --arg entity "$FILE_PATH" \
  --arg session_id "$SESSION_ID" \
  --arg agent "gemini-cli" \
  --arg provider "google" \
  --arg model "$AI_MODEL" \
  --arg tool "$TOOL_NAME" \
  --argjson lines_added "$LINES_ADDED" \
  --argjson lines_deleted "$LINES_DELETED" \
  '{client_id:$agent,producer_version:1,provider_id:$provider,model_id:(if $model=="" then null else $model end),event_id:$event_id,occurred_at:$occurred_at,entity:$entity,change_kind:"modify",session_id:(if $session_id=="" then null else $session_id end),source:"agent_hook",confidence:"verified",lines_added:$lines_added,lines_deleted:$lines_deleted,transport:"native_plugin",tool:$tool,tool_call_id:$event_id}' \
  | emit_metadata

exit 0
