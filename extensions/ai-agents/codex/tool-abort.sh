#!/usr/bin/env bash
# Discard a pending Codex shell snapshot after a failed/cancelled tool call.
set -u
INPUT="$(cat)"
command -v jq >/dev/null 2>&1 || { printf '%s\n' 'AtoAxis: producer_capture_failure; jq required' >&2; exit 1; }
CALL_ID="$(jq -r '.tool_use_id // .toolUseId // .call_id // .callId // .tool_call_id // .toolCallId // empty' <<<"$INPUT" 2>/dev/null || true)"
EXPLICIT_TOOL_EVENT_ID="$(jq -r '.tool_event_id // empty' <<<"$INPUT" 2>/dev/null || true)"
[ -n "$CALL_ID" ] || [ -n "$EXPLICIT_TOOL_EVENT_ID" ] || exit 0
SESSION_ID="$(jq -r '.session_id // .sessionId // empty' <<<"$INPUT" 2>/dev/null || true)"
TOOL_NAME="$(jq -r '.tool_name // .toolName // empty' <<<"$INPUT" 2>/dev/null || true)"
CWD="$(jq -r '.cwd // .tool_input.dir_path // .tool_input.cwd // empty' <<<"$INPUT" 2>/dev/null || true)"
[ -n "$CWD" ] && [ -d "$CWD" ] || CWD="$PWD"
TOOL_EVENT_ID="$EXPLICIT_TOOL_EVENT_ID"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd || true)"
COMMON_ID="${WAKACLOCK_AGENT_COMMON_TOOL_ID:-${SCRIPT_DIR}/../common/tool-event-id.sh}"
if [ -r "$COMMON_ID" ]; then
  # shellcheck source=/dev/null
  . "$COMMON_ID"
fi
if [ -z "$TOOL_EVENT_ID" ]; then
  if command -v atoaxis_tool_event_id >/dev/null 2>&1; then
    TOOL_EVENT_ID="$(atoaxis_tool_event_id codex "$CWD" "$SESSION_ID" "$CALL_ID" "$TOOL_NAME")"
  elif command -v shasum >/dev/null 2>&1; then
    TOOL_EVENT_ID="codex-tool-$(printf '%s' "codex|${CWD}|${SESSION_ID}|${CALL_ID:-${TOOL_NAME}}" | shasum -a 256 | cut -c1-40)"
  elif command -v sha256sum >/dev/null 2>&1; then
    TOOL_EVENT_ID="codex-tool-$(printf '%s' "codex|${CWD}|${SESSION_ID}|${CALL_ID:-${TOOL_NAME}}" | sha256sum | cut -c1-40)"
  elif command -v cksum >/dev/null 2>&1; then
    TOOL_EVENT_ID="codex-tool-$(printf '%s' "codex|${CWD}|${SESSION_ID}|${CALL_ID:-${TOOL_NAME}}" | cksum | awk '{print $1":"$2}')"
  else
    exit 0
  fi
fi
CLI="${WAKACLOCK_CLI_PATH:-}"
if [ -z "$CLI" ] && [ -f "${HOME}/.wakaclock/cli-path" ]; then CLI="$(tr -d '\r\n' < "${HOME}/.wakaclock/cli-path")"; fi
CLI="${CLI:-wakaclock}"
COMMON_DIR="${WAKACLOCK_AGENT_COMMON_DIR:-${SCRIPT_DIR}/../common}"
PRODUCER="${COMMON_DIR}/tool-boundary-producer.py"
if ! command -v python3 >/dev/null 2>&1 || [ ! -r "$PRODUCER" ]; then
  printf '%s\n' 'AtoAxis: producer_capture_failure; durable boundary helper required' >&2
  exit 1
fi
jq -cn --arg tool_event_id "$TOOL_EVENT_ID" --arg agent codex \
  --arg session_id "$SESSION_ID" --arg cwd "$CWD" --arg tool "$TOOL_NAME" \
  '{tool_event_id:$tool_event_id,agent:$agent,session_id:(if $session_id=="" then null else $session_id end),cwd:$cwd,tool:(if $tool=="" then null else $tool end)}' \
  | python3 "$PRODUCER" --phase abort --cli "$CLI" --surface "${WAKACLOCK_PRODUCER_SURFACE:-cli}" || exit 1
exit 0
