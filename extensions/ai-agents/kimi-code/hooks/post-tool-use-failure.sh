#!/usr/bin/env bash
# Failed/cancelled tools must never become verified edits. Release any shell
# snapshot and keep the agent workflow fail-open.
set -u
INPUT="$(cat)"
command -v jq >/dev/null 2>&1 || exit 0
TOOL_NAME="$(jq -r '.tool_name // empty' <<<"$INPUT" 2>/dev/null || true)"
case "$TOOL_NAME" in
  Shell|shell|Bash|bash) ;;
  *) printf '%s\n' 'atoaxis-kimi: unsupported_tool (failure); skipped' >&2; exit 0 ;;
esac
TOOL_EVENT_ID="$(jq -r '.tool_call_id // .toolCallId // .call_id // empty' <<<"$INPUT" 2>/dev/null || true)"
if [ -z "$TOOL_EVENT_ID" ]; then
  printf '%s\n' 'atoaxis-kimi: missing_tool_call_id (failure); skipped' >&2
  exit 0
fi
CLI="${WAKACLOCK_CLI_PATH:-}"
if [ -z "$CLI" ] && [ -f "${HOME}/.wakaclock/cli-path" ]; then
  CLI="$(tr -d '\r\n' < "${HOME}/.wakaclock/cli-path")"
fi
CLI="${CLI:-wakaclock}"
command -v "$CLI" >/dev/null 2>&1 || exit 0
jq -cn --arg tool_event_id "$TOOL_EVENT_ID" --arg agent "kimi-code-cli" \
  '{tool_event_id:$tool_event_id,agent:$agent}' \
  | "$CLI" ai tool-abort --json >/dev/null 2>&1 || true
exit 0
