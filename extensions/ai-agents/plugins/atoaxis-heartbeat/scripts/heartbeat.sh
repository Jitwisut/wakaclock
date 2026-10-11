#!/usr/bin/env bash
#
# AtoAxis heartbeat hook for Claude Code — fires on PostToolUse for Write/Edit/MultiEdit
# and reports the edited file as a real coding-time heartbeat attributed to the AI agent
# via `wakaclock ai emit` to the local broker. This mirrors the mechanism WakaTime's own Claude
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


# All native adapters share one metadata allowlist. Installed Claude plugin
# copies may not include the sibling common directory yet, so retain a direct
# BrokerEvent fallback for one upgrade cycle.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd || true)"
COMMON_EMITTER="${WAKACLOCK_AGENT_COMMON_EMITTER:-${SCRIPT_DIR}/../../../common/emit-event.sh}"
emit_metadata() {
  if [ -x "$COMMON_EMITTER" ]; then
    "$COMMON_EMITTER"
  else
    printf '%s\n' 'AtoAxis: producer_capture_failure; shared durable producer required' >&2
    return 1
  fi
}

TOOL_NAME="$(jq -r '.tool_name // empty' <<<"$INPUT")"
# NotebookEdit names its target `notebook_path`, every other file tool uses `file_path`.
FILE_PATH="$(jq -r '.tool_input.file_path // .tool_input.notebook_path // empty' <<<"$INPUT")"
AI_MODEL="$(jq -r '.model // .model_name // .model_id // .session.model // empty' <<<"$INPUT")"
TRANSCRIPT_PATH="$(jq -r '.transcript_path // empty' <<<"$INPUT" 2>/dev/null || true)"
SESSION_CWD="$(jq -r '.cwd // empty' <<<"$INPUT" 2>/dev/null || true)"
SESSION_ID="$(jq -r '.session_id // .sessionId // empty' <<<"$INPUT" 2>/dev/null || true)"
CALL_ID="$(jq -r '.tool_use_id // .toolUseId // .call_id // .callId // .tool_call_id // .toolCallId // empty' <<<"$INPUT" 2>/dev/null || true)"

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
if [[ "$FILE_PATH" != /* ]]; then
  FILE_PATH="${SESSION_CWD:-$PWD}/${FILE_PATH}"
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
EVENT_ID="claude-code-${EVENT_HASH}"
OCCURRED_AT="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"

# BrokerProcessor owns the metadata-only sidecar and writes it once after durable
# acceptance. Prompt/response/tool arguments are used only in-memory for counters and
# are never included in the broker envelope.
jq -cn \
  --arg event_id "$EVENT_ID" \
  --arg occurred_at "$OCCURRED_AT" \
  --arg entity "$FILE_PATH" \
  --arg session_id "$SESSION_ID" \
  --arg project_root "$PROJECT_ROOT" \
  --arg agent "claude-code" \
  --arg provider "anthropic" \
  --arg model "$AI_MODEL" \
  --arg tool "$TOOL_NAME" \
  --argjson lines_added "$LINES_ADDED" \
  --argjson lines_deleted "$LINES_DELETED" \
  '{client_id:$agent,producer_version:1,provider_id:$provider,model_id:(if $model=="" then null else $model end),event_id:$event_id,occurred_at:$occurred_at,entity:$entity,project_root:(if $project_root=="" then null else $project_root end),change_kind:"modify",session_id:(if $session_id=="" then null else $session_id end),source:"agent_hook",confidence:"verified",lines_added:$lines_added,lines_deleted:$lines_deleted,transport:"native_plugin",tool:$tool,tool_call_id:$event_id}' \
  | emit_metadata

exit 0
