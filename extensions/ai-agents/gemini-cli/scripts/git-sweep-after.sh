#!/usr/bin/env bash
# Metadata-only AfterTool adapter for shell/MCP mutations.
# `wakaclock ai tool-after` loads the matching SQLite BeforeTool snapshot, computes
# create/modify/delete/rename evidence and emits one duration interval per tool call.
set -euo pipefail

AGENT="${1:-gemini-cli}"
PROVIDER="${2:-google}"
INPUT="$(cat)"
command -v jq >/dev/null 2>&1 || exit 0

WAKACLOCK_BIN="${WAKACLOCK_CLI_PATH:-}"
if [ -z "$WAKACLOCK_BIN" ] && [ -f "${HOME}/.wakaclock/cli-path" ]; then
  WAKACLOCK_BIN="$(tr -d '\r\n' < "${HOME}/.wakaclock/cli-path")"
fi
WAKACLOCK_BIN="${WAKACLOCK_BIN:-wakaclock}"
command -v "$WAKACLOCK_BIN" >/dev/null 2>&1 || exit 0

CWD="$(jq -r '.cwd // .tool_input.dir_path // .tool_input.cwd // empty' <<<"$INPUT" 2>/dev/null || true)"
[ -n "$CWD" ] && [ -d "$CWD" ] || CWD="$PWD"
SESSION_ID="$(jq -r '.session_id // .sessionId // empty' <<<"$INPUT" 2>/dev/null || true)"
CALL_ID="$(jq -r '.tool_use_id // .toolUseId // .call_id // .callId // .tool_call_id // empty' <<<"$INPUT" 2>/dev/null || true)"
TOOL_NAME="$(jq -r '.tool_name // .toolName // empty' <<<"$INPUT" 2>/dev/null || true)"
AI_MODEL="$(jq -r '.model // .model_name // .model_id // .context.model // empty' <<<"$INPUT" 2>/dev/null || true)"
KEY_MATERIAL="${AGENT}|${CWD}|${SESSION_ID}|${CALL_ID:-${TOOL_NAME}}"
hash_material() {
  local material="$1"
  if command -v shasum >/dev/null 2>&1; then
    printf '%s' "$material" | shasum -a 256 | cut -c1-40
  elif command -v sha256sum >/dev/null 2>&1; then
    printf '%s' "$material" | sha256sum | cut -c1-40
  elif command -v cksum >/dev/null 2>&1; then
    printf '%s' "$material" | cksum | awk '{print $1":"$2}'
  else
    printf 'unhashed-%s' "$$"
  fi
}
TOOL_EVENT_ID="${AGENT}-tool-$(hash_material "$KEY_MATERIAL")"

jq -cn \
  --arg tool_event_id "$TOOL_EVENT_ID" \
  --arg agent "$AGENT" \
  --arg provider "$PROVIDER" \
  --arg model "$AI_MODEL" \
  --arg session_id "$SESSION_ID" \
  --arg tool "$TOOL_NAME" \
  --arg cwd "$CWD" \
  '{tool_event_id:$tool_event_id,agent:$agent,provider:(if $provider=="" then null else $provider end),model:(if $model=="" then null else $model end),session_id:(if $session_id=="" then null else $session_id end),tool:(if $tool=="" then null else $tool end),transport:"shell_hook",cwd:$cwd}' \
  | "$WAKACLOCK_BIN" ai tool-after --json >/dev/null 2>&1 || true

"$WAKACLOCK_BIN" sync --agent gemini-cli --automatic --json >/dev/null 2>&1 || true

exit 0
