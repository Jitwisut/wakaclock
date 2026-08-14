#!/usr/bin/env bash
#
# AtoAxis heartbeat hook for Claude Code — fires on PostToolUse for Write/Edit/MultiEdit
# and reports the edited file as a real coding-time heartbeat attributed to the AI agent
# via `wakaclock heartbeat --ai-agent`. This mirrors the mechanism WakaTime's own Claude
# Code plugin uses (hooks -> CLI directly), not an editor/VS Code integration — that's
# the whole reason it works identically whether Claude Code runs standalone in a
# terminal or inside an IDE with no file open: it never depends on an editor noticing
# the change, only on Claude Code's own tool-call lifecycle.
set -euo pipefail

INPUT="$(cat)"

if ! command -v jq >/dev/null 2>&1; then
  echo "atoaxis-heartbeat: jq is required but not found on PATH — skipping heartbeat" >&2
  exit 0
fi

WAKACLOCK_BIN="${WAKACLOCK_CLI_PATH:-}"
if [ -z "$WAKACLOCK_BIN" ] && [ -f "${HOME}/.wakaclock/cli-path" ]; then
  WAKACLOCK_BIN="$(tr -d '\r\n' < "${HOME}/.wakaclock/cli-path")"
fi
WAKACLOCK_BIN="${WAKACLOCK_BIN:-wakaclock}"
if ! command -v "$WAKACLOCK_BIN" >/dev/null 2>&1; then
  echo "atoaxis-heartbeat: '$WAKACLOCK_BIN' not found on PATH — install wakaclock-cli or set WAKACLOCK_CLI_PATH" >&2
  exit 0
fi

TOOL_NAME="$(jq -r '.tool_name // empty' <<<"$INPUT")"
FILE_PATH="$(jq -r '.tool_input.file_path // empty' <<<"$INPUT")"
AI_MODEL="$(jq -r '.model // .model_name // .model_id // .session.model // empty' <<<"$INPUT")"

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Rough line counts, not a real unified diff — good enough to answer "about how much did
# the AI touch here", not meant to be byte-exact. `wc -l` counts newlines, so Write (no
# prior content to diff against) treats every line of the new content as added.
count_lines() {
  if [ -z "$1" ]; then
    printf '0\n'
    return
  fi
  # Command substitution removes a trailing newline, so count records rather than
  # newline bytes; this keeps "one\ntwo\n" at two logical lines.
  printf '%s' "$1" | awk 'END { print NR }'
}

case "$TOOL_NAME" in
  Write)
    CONTENT="$(jq -r '.tool_input.content // empty' <<<"$INPUT")"
    LINES_ADDED="$(count_lines "$CONTENT")"
    LINES_DELETED=0
    ;;
  Edit)
    OLD="$(jq -r '.tool_input.old_string // empty' <<<"$INPUT")"
    NEW="$(jq -r '.tool_input.new_string // empty' <<<"$INPUT")"
    LINES_ADDED="$(count_lines "$NEW")"
    LINES_DELETED="$(count_lines "$OLD")"
    ;;
  MultiEdit)
    LINES_ADDED=0
    LINES_DELETED=0
    while IFS= read -r edit; do
      OLD="$(jq -r '.old_string // empty' <<<"$edit")"
      NEW="$(jq -r '.new_string // empty' <<<"$edit")"
      LINES_ADDED=$((LINES_ADDED + $(count_lines "$NEW")))
      LINES_DELETED=$((LINES_DELETED + $(count_lines "$OLD")))
    done < <(jq -c '.tool_input.edits[]? // empty' <<<"$INPUT")
    ;;
  *)
    exit 0
    ;;
esac

NOW=$(date +%s%N 2>/dev/null || date +%s)
EVENT_TIME="$(date +%s)"
EVENT_ID="claude-code-${NOW}-$(printf '%s' "$FILE_PATH" | shasum | cut -c1-12)"

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
  --ai-agent claude-code
  --ai-provider anthropic
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
