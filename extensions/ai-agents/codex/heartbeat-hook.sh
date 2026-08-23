#!/usr/bin/env bash
#
# AtoAxis heartbeat hook for OpenAI Codex CLI — registered as a PostToolUse hook on the
# "apply_patch" tool (Codex's file-edit tool) in ~/.codex/config.toml. See README.md in
# this directory for the exact config.toml entries.
#
# Unlike the Claude Code plugin (hooks/hooks.json in ../plugins/atoaxis-heartbeat),
# Codex has no plugin-marketplace equivalent as of this writing — hooks are behind a
# feature flag (`codex_hooks = true`) and registered by hand-editing config.toml. This
# script mirrors the same wakaclock-cli call the Claude Code hook makes; the file-path
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
  echo "atoaxis-heartbeat (codex): '$WAKACLOCK_BIN' not found on PATH — install wakaclock-cli or set WAKACLOCK_CLI_PATH" >&2
  exit 0
fi

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

EVENT_LOG="${WAKACLOCK_AI_EVENT_LOG:-${HOME}/.wakaclock/ai-events.jsonl}"
mkdir -p "$(dirname "$EVENT_LOG")"

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

  EVENT_TIME="$(date +%s)"
  EVENT_NONCE="${EVENT_TIME}-${PPID}-${RANDOM}"
  EVENT_ID="codex-${EVENT_NONCE}-$(printf '%s' "$FILE_PATH" | shasum | cut -c1-12)"

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
    --ai-agent codex
    --ai-provider openai
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
done

exit 0
