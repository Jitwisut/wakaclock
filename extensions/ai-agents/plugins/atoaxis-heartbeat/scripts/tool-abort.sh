#!/usr/bin/env bash
# Discard a pending Claude shell snapshot after a failed/cancelled tool call.
set -u
INPUT="$(cat)"
command -v jq >/dev/null 2>&1 || exit 0
CALL_ID="$(jq -r '.tool_use_id // .toolUseId // .call_id // .callId // .tool_call_id // .toolCallId // empty' <<<"$INPUT" 2>/dev/null || true)"
EXPLICIT_TOOL_EVENT_ID="$(jq -r '.tool_event_id // empty' <<<"$INPUT" 2>/dev/null || true)"
[ -n "$CALL_ID" ] || [ -n "$EXPLICIT_TOOL_EVENT_ID" ] || exit 0
SESSION_ID="$(jq -r '.session_id // .sessionId // empty' <<<"$INPUT" 2>/dev/null || true)"
TOOL_NAME="$(jq -r '.tool_name // .toolName // empty' <<<"$INPUT" 2>/dev/null || true)"
CWD="$(jq -r '.cwd // .tool_input.dir_path // .tool_input.cwd // empty' <<<"$INPUT" 2>/dev/null || true)"
[ -n "$CWD" ] && [ -d "$CWD" ] || CWD="$PWD"
TOOL_EVENT_ID="$EXPLICIT_TOOL_EVENT_ID"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd || true)"
COMMON_ID="${WAKACLOCK_AGENT_COMMON_TOOL_ID:-${SCRIPT_DIR}/../../../common/tool-event-id.sh}"
if [ -r "$COMMON_ID" ]; then
  # shellcheck source=/dev/null
  . "$COMMON_ID"
fi
if [ -z "$TOOL_EVENT_ID" ]; then
  if command -v atoaxis_tool_event_id >/dev/null 2>&1; then
    TOOL_EVENT_ID="$(atoaxis_tool_event_id claude-code "$CWD" "$SESSION_ID" "$CALL_ID" "$TOOL_NAME")"
  elif command -v shasum >/dev/null 2>&1; then
    TOOL_EVENT_ID="claude-code-tool-$(printf '%s' "claude-code|${CWD}|${SESSION_ID}|${CALL_ID:-${TOOL_NAME}}" | shasum -a 256 | cut -c1-40)"
  elif command -v sha256sum >/dev/null 2>&1; then
    TOOL_EVENT_ID="claude-code-tool-$(printf '%s' "claude-code|${CWD}|${SESSION_ID}|${CALL_ID:-${TOOL_NAME}}" | sha256sum | cut -c1-40)"
  elif command -v cksum >/dev/null 2>&1; then
    TOOL_EVENT_ID="claude-code-tool-$(printf '%s' "claude-code|${CWD}|${SESSION_ID}|${CALL_ID:-${TOOL_NAME}}" | cksum | awk '{print $1":"$2}')"
  else
    exit 0
  fi
fi
CLI="${WAKACLOCK_CLI_PATH:-}"
if [ -z "$CLI" ] && [ -f "${HOME}/.wakaclock/cli-path" ]; then CLI="$(tr -d '\r\n' < "${HOME}/.wakaclock/cli-path")"; fi
CLI="${CLI:-wakaclock}"
command -v "$CLI" >/dev/null 2>&1 || exit 0
jq -cn --arg tool_event_id "$TOOL_EVENT_ID" --arg agent claude-code \
  '{tool_event_id:$tool_event_id,agent:$agent}' \
  | "$CLI" ai tool-abort --json >/dev/null 2>&1 || true
exit 0
