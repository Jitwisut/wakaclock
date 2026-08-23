#!/usr/bin/env bash
#
# AtoAxis heartbeat hook for Gemini CLI — fires on AfterTool for write_file/replace (see
# hooks/hooks.json) and reports the edited file via `wakaclock heartbeat --ai-agent`.
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

if [ -z "$FILE_PATH" ]; then
  exit 0
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

NOW=$(date +%s%N 2>/dev/null || date +%s)
EVENT_TIME="$(date +%s)"
EVENT_ID="gemini-cli-${NOW}-$(printf '%s' "$FILE_PATH" | shasum | cut -c1-12)"

EVENT_LOG="${WAKACLOCK_AI_EVENT_LOG:-${HOME}/.wakaclock/ai-events.jsonl}"
mkdir -p "$(dirname "$EVENT_LOG")"
jq -cn \
  --arg event_id "$EVENT_ID" \
  --arg entity "$FILE_PATH" \
  --argjson time "$EVENT_TIME" \
  --argjson lines_added "$LINES_ADDED" \
  --argjson lines_deleted "$LINES_DELETED" \
  '{event_id: $event_id, entity: $entity, time: $time, lines_added: $lines_added, lines_deleted: $lines_deleted}' \
  >>"$EVENT_LOG" 2>/dev/null || true

CLI_ARGS=(
  heartbeat
  --entity "$FILE_PATH"
  --write
  --ai-agent gemini-cli
  --ai-provider google
  --ai-source agent_hook
  --ai-confidence verified
  --ai-event-id "$EVENT_ID"
  --ai-lines-added "$LINES_ADDED"
  --ai-lines-deleted "$LINES_DELETED"
)
if [ -n "$AI_MODEL" ]; then
  CLI_ARGS+=(--ai-model "$AI_MODEL")
fi

"$WAKACLOCK_BIN" "${CLI_ARGS[@]}" >/dev/null 2>&1 || true

exit 0
