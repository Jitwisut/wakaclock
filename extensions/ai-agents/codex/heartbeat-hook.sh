#!/usr/bin/env bash
#
# AtoAxis heartbeat hook for OpenAI Codex CLI — registered as a PostToolUse hook on the
# "apply_patch" tool (Codex's file-edit tool) in ~/.codex/config.toml. See README.md in
# this directory for the exact config.toml entries.
#
# Unlike the Claude Code plugin (hooks/hooks.json in ../plugins/atoaxis-heartbeat),
# Codex has no plugin-marketplace equivalent as of this writing — hooks are behind a
# feature flag (`codex_hooks = true`) and registered by hand-editing config.toml. This
# script mirrors the same wakaclock broker call the Claude Code hook makes; the file-path
# extraction is the part most likely to need adjusting as Codex's hook payload schema
# stabilizes, since it isn't as fully documented yet as Claude Code's.
set -euo pipefail

INPUT="$(cat)"

if ! command -v jq >/dev/null 2>&1; then
  echo "atoaxis-heartbeat (codex): jq is required but not found on PATH — skipping" >&2
  exit 0
fi

WAKACLOCK_BIN="${WAKACLOCK_CLI_PATH:-}"
if [ -z "$WAKACLOCK_BIN" ] && [ -f "${HOME}/.wakaclock/cli-path" ]; then
  WAKACLOCK_BIN="$(tr -d '\r\n' < "${HOME}/.wakaclock/cli-path")"
fi
WAKACLOCK_BIN="${WAKACLOCK_BIN:-wakaclock}"
if ! command -v "$WAKACLOCK_BIN" >/dev/null 2>&1; then
  echo "atoaxis-heartbeat (codex): '$WAKACLOCK_BIN' not found on PATH — install the wakaclock binary or set WAKACLOCK_CLI_PATH" >&2
  exit 0
fi

WORKING_DIR="$(jq -r '.cwd // .workdir // .working_dir // .tool_input.cwd // empty' <<<"$INPUT" 2>/dev/null || true)"
[ -n "$WORKING_DIR" ] && [ -d "$WORKING_DIR" ] || WORKING_DIR="$PWD"
SESSION_ID="$(jq -r '.session_id // .sessionId // empty' <<<"$INPUT" 2>/dev/null || true)"
CALL_ID="$(jq -r '.tool_use_id // .toolUseId // .call_id // .callId // .tool_call_id // .toolCallId // empty' <<<"$INPUT" 2>/dev/null || true)"

# Codex's apply_patch payload is a patch-text blob using "*** Update File: <path>" /
# "*** Add File: <path>" markers (its own patch format, not unified diff), not a single
# `file_path` field the way Claude Code's Write/Edit tools have — so this tries the
# couple of JSON shapes that have been observed for the tool input, then falls back to
# scanning the raw patch text for those marker lines.
PATCH_TEXT="$(jq -r '.tool_input.input // .tool_input.patch // .tool_input // empty' <<<"$INPUT" 2>/dev/null || true)"
AI_MODEL="$(jq -r '.model // .model_name // .model_id // .context.model // empty' <<<"$INPUT" 2>/dev/null || true)"
if [ -z "$PATCH_TEXT" ] || [ "$PATCH_TEXT" = "null" ]; then
  exit 0
fi

# Emit one record per file. The previous implementation used `head -n1`, assigned the
# whole patch's line totals to that first path and silently lost every other file. The
# unit separator keeps paths containing spaces intact while awk reports per-file deltas.
printf '%s\n' "$PATCH_TEXT" | awk '
  function emit() {
    if (file != "") {
      printf "%s\034%d\034%d\n", file, added, deleted
    }
  }
  /^\*\*\* (Update|Add|Delete) File: / {
    emit()
    file = $0
    sub(/^\*\*\* (Update|Add|Delete) File: /, "", file)
    added = 0
    deleted = 0
    next
  }
  /^\*\*\* Move to: / {
    file = $0
    sub(/^\*\*\* Move to: /, "", file)
    next
  }
  /^\*\*\* End Patch/ {
    emit()
    file = ""
    next
  }
  file != "" && /^\+/ { added += 1; next }
  file != "" && /^-/ { deleted += 1; next }
  END { emit() }
' | while IFS=$'\034' read -r FILE_PATH LINES_ADDED LINES_DELETED; do
  if [ -z "$FILE_PATH" ]; then
    continue
  fi

  if [[ "$FILE_PATH" != /* ]]; then
    FILE_PATH="${WORKING_DIR}/${FILE_PATH}"
  fi

  EVENT_ID="codex-$(printf '%s|%s|%s' "$SESSION_ID" "${CALL_ID:-apply_patch}" "$FILE_PATH" | shasum -a 256 | cut -c1-40)"
  OCCURRED_AT="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"

  # The CLI owns broker authentication, durable acceptance and offline fallback.
  # BrokerProcessor writes the metadata-only VS Code sidecar once after acceptance.
  jq -cn \
    --arg event_id "$EVENT_ID" \
    --arg occurred_at "$OCCURRED_AT" \
    --arg entity "$FILE_PATH" \
    --arg session_id "$SESSION_ID" \
    --arg agent "codex" \
    --arg provider "openai" \
    --arg model "$AI_MODEL" \
    --argjson lines_added "$LINES_ADDED" \
    --argjson lines_deleted "$LINES_DELETED" \
    '{schema_version:1,event_type:"file_change",event_id:$event_id,occurred_at:$occurred_at,entity:$entity,change_kind:"modify",agent:$agent,provider:$provider,model:(if $model=="" then null else $model end),session_id:(if $session_id=="" then null else $session_id end),source:"agent_hook",confidence:"verified",lines_added:$lines_added,lines_deleted:$lines_deleted,transport:"shell_hook",tool:"apply_patch",tool_event_id:$event_id}' \
    | "$WAKACLOCK_BIN" ai emit --json >/dev/null 2>&1 || true
done

exit 0
