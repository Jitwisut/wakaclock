#!/usr/bin/env bash
# Metadata-only BeforeTool adapter for shell/MCP mutations.
# Heavy lifting lives in `wakaclock ai tool-before`: workspace discovery, SHA-256
# fingerprints, Git/non-Git enumeration and crash-safe SQLite persistence.
set -euo pipefail

AGENT="${1:-unknown-agent}"
PROVIDER="${2:-}"
INPUT="$(cat)"
command -v jq >/dev/null 2>&1 || exit 0

WAKACLOCK_BIN="${WAKACLOCK_CLI_PATH:-}"
if [ -z "$WAKACLOCK_BIN" ] && [ -f "${HOME}/.wakaclock/cli-path" ]; then
  WAKACLOCK_BIN="$(tr -d '\r\n' < "${HOME}/.wakaclock/cli-path")"
fi
WAKACLOCK_BIN="${WAKACLOCK_BIN:-wakaclock}"
command -v "$WAKACLOCK_BIN" >/dev/null 2>&1 || exit 0

CWD="$(jq -r '.cwd // .workdir // .working_dir // .tool_input.dir_path // .tool_input.cwd // empty' <<<"$INPUT" 2>/dev/null || true)"
[ -n "$CWD" ] && [ -d "$CWD" ] || CWD="$PWD"
SESSION_ID="$(jq -r '.session_id // .sessionId // empty' <<<"$INPUT" 2>/dev/null || true)"
CALL_ID="$(jq -r '.tool_use_id // .toolUseId // .call_id // .callId // .tool_call_id // empty' <<<"$INPUT" 2>/dev/null || true)"
TOOL_NAME="$(jq -r '.tool_name // .toolName // empty' <<<"$INPUT" 2>/dev/null || true)"
AI_MODEL="$(jq -r '.model // .model_name // .model_id // .context.model // empty' <<<"$INPUT" 2>/dev/null || true)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd || true)"
COMMON_ID="${WAKACLOCK_AGENT_COMMON_TOOL_ID:-${SCRIPT_DIR}/tool-event-id.sh}"
if [ -r "$COMMON_ID" ]; then
  # shellcheck source=/dev/null
  . "$COMMON_ID"
fi
if command -v atoaxis_tool_event_id >/dev/null 2>&1; then
  TOOL_EVENT_ID="$(atoaxis_tool_event_id "$AGENT" "$CWD" "$SESSION_ID" "$CALL_ID" "$TOOL_NAME")"
else
  # An old installed bundle may not contain the helper yet. Keep the same key
  # material and digest algorithm for one upgrade cycle.
  KEY_MATERIAL="${AGENT}|${CWD}|${SESSION_ID}|${CALL_ID:-${TOOL_NAME}}"
  if command -v shasum >/dev/null 2>&1; then
    TOOL_EVENT_ID="${AGENT}-tool-$(printf '%s' "$KEY_MATERIAL" | shasum -a 256 | cut -c1-40)"
  elif command -v sha256sum >/dev/null 2>&1; then
    TOOL_EVENT_ID="${AGENT}-tool-$(printf '%s' "$KEY_MATERIAL" | sha256sum | cut -c1-40)"
  elif command -v cksum >/dev/null 2>&1; then
    TOOL_EVENT_ID="${AGENT}-tool-$(printf '%s' "$KEY_MATERIAL" | cksum | awk '{print $1":"$2}')"
  else
    TOOL_EVENT_ID="${AGENT}-tool-unhashed-$$"
  fi
fi

jq -cn \
  --arg tool_event_id "$TOOL_EVENT_ID" \
  --arg agent "$AGENT" \
  --arg provider "$PROVIDER" \
  --arg model "$AI_MODEL" \
  --arg session_id "$SESSION_ID" \
  --arg tool "$TOOL_NAME" \
  --arg cwd "$CWD" \
  '{tool_event_id:$tool_event_id,agent:$agent,provider:(if $provider=="" then null else $provider end),model:(if $model=="" then null else $model end),session_id:(if $session_id=="" then null else $session_id end),tool:(if $tool=="" then null else $tool end),transport:"shell_hook",cwd:$cwd}' \
  | "$WAKACLOCK_BIN" ai tool-before --json >/dev/null 2>&1 || true

exit 0
