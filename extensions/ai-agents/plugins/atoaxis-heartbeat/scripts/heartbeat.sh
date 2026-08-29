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
  echo "atoaxis-heartbeat: '$WAKACLOCK_BIN' not found on PATH — install the wakaclock binary or set WAKACLOCK_CLI_PATH" >&2
  exit 0
fi

TOOL_NAME="$(jq -r '.tool_name // empty' <<<"$INPUT")"
# NotebookEdit names its target `notebook_path`, every other file tool uses `file_path`.
FILE_PATH="$(jq -r '.tool_input.file_path // .tool_input.notebook_path // empty' <<<"$INPUT")"
AI_MODEL="$(jq -r '.model // .model_name // .model_id // .session.model // empty' <<<"$INPUT")"
TRANSCRIPT_PATH="$(jq -r '.transcript_path // empty' <<<"$INPUT" 2>/dev/null || true)"
SESSION_CWD="$(jq -r '.cwd // empty' <<<"$INPUT" 2>/dev/null || true)"

# Claude's native file hook runs outside the editor heartbeat path. In a non-Git
# workspace the CLI cannot infer a project from `.git`, so preserve the session root
# explicitly. Some hook payloads omit cwd; the transcript still carries it on nearby
# records, so use that as a metadata-only fallback.
if [ -z "$SESSION_CWD" ] && [ -n "$TRANSCRIPT_PATH" ] && [ -f "$TRANSCRIPT_PATH" ]; then
  SESSION_CWD="$(tail -n 1000 "$TRANSCRIPT_PATH" 2>/dev/null \
    | jq -r 'select((.cwd // "") != "") | .cwd' 2>/dev/null \
    | tail -n 1 || true)"
fi

resolve_workspace_root() {
  local candidate="$1"
  [ -n "$candidate" ] && [ -d "$candidate" ] || return 0

  local git_root
  git_root="$(git -C "$candidate" rev-parse --show-toplevel 2>/dev/null || true)"
  if [ -n "$git_root" ]; then
    printf '%s\n' "$git_root"
    return 0
  fi

  local current="$candidate"
  while [ -n "$current" ] && [ "$current" != "/" ]; do
    if [ -f "$current/pnpm-workspace.yaml" ] \
      || [ -f "$current/lerna.json" ] \
      || [ -f "$current/nx.json" ] \
      || [ -f "$current/rush.json" ]; then
      printf '%s\n' "$current"
      return 0
    fi
    current="$(dirname "$current")"
  done

  # For a plain non-Git project, Claude's session cwd is still a better identity than
  # the edited file's nested package directory.
  printf '%s\n' "$candidate"
}

PROJECT_ROOT="$(resolve_workspace_root "$SESSION_CWD")"
PROJECT_NAME=""
if [ -n "$PROJECT_ROOT" ]; then
  PROJECT_NAME="$(basename "$PROJECT_ROOT")"
fi

# The PostToolUse payload carries no model field, so the lookup above always came up
# empty and every AI heartbeat was recorded with an unknown model. The model does exist
# in the session transcript, on the assistant record that issued this tool call, and the
# payload tells us where that transcript lives — so fall back to reading it from there.
#
# Only the tail is scanned: these files reach tens of megabytes, and the assistant turn
# that triggered this hook is by definition at the end. Every step is failure-tolerant
# (`set -o pipefail` is active) because an unknown model must degrade to "unknown", never
# break the heartbeat this hook exists to send.
if [ -z "$AI_MODEL" ] || [ "$AI_MODEL" = "null" ]; then
  if [ -n "$TRANSCRIPT_PATH" ] && [ -f "$TRANSCRIPT_PATH" ]; then
    AI_MODEL="$(tail -n 400 "$TRANSCRIPT_PATH" 2>/dev/null \
      | jq -r 'select(.type == "assistant") | .message.model // empty' 2>/dev/null \
      | tail -n 1 || true)"
  fi
fi

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
  NotebookEdit)
    # A notebook cell edit is a real file edit. It was silently unreported before, so
    # every notebook-heavy session looked like the developer had stopped working.
    OLD="$(jq -r '.tool_input.old_source // empty' <<<"$INPUT")"
    NEW="$(jq -r '.tool_input.new_source // empty' <<<"$INPUT")"
    LINES_ADDED="$(count_lines "$NEW")"
    LINES_DELETED="$(count_lines "$OLD")"
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
if [ -n "$PROJECT_NAME" ]; then
  CLI_ARGS+=(--project "$PROJECT_NAME")
fi
if [ -n "$AI_MODEL" ]; then
  CLI_ARGS+=(--ai-model "$AI_MODEL")
fi

"$WAKACLOCK_BIN" "${CLI_ARGS[@]}" >/dev/null 2>&1 || true

exit 0
