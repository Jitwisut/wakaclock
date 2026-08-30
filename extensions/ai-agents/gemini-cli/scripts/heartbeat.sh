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

EVENT_ID="gemini-cli-$(printf '%s|%s|%s' "$SESSION_ID" "${CALL_ID:-$TOOL_NAME}" "$FILE_PATH" | shasum -a 256 | cut -c1-40)"
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
  '{schema_version:1,event_type:"file_change",event_id:$event_id,occurred_at:$occurred_at,entity:$entity,change_kind:"modify",agent:$agent,provider:$provider,model:(if $model=="" then null else $model end),session_id:(if $session_id=="" then null else $session_id end),source:"agent_hook",confidence:"verified",lines_added:$lines_added,lines_deleted:$lines_deleted,transport:"shell_hook",tool:$tool,tool_event_id:$event_id}' \
  | "$WAKACLOCK_BIN" ai emit --json >/dev/null 2>&1 || true

exit 0
