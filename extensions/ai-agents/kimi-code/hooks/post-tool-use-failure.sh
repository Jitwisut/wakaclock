#!/usr/bin/env bash
# Failed/cancelled tools must never become verified edits. Release any shell
# snapshot and keep the agent workflow fail-open.
set -u
INPUT="$(cat)"
command -v jq >/dev/null 2>&1 || { printf '%s\n' 'AtoAxis: producer_capture_failure; jq required' >&2; exit 1; }
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
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PRODUCER="${WAKACLOCK_AGENT_COMMON_DIR:-${ROOT}/common}/tool-boundary-producer.py"
if ! command -v python3 >/dev/null 2>&1 || [ ! -r "$PRODUCER" ]; then
  printf '%s\n' 'AtoAxis: producer_capture_failure; durable boundary helper required' >&2
  exit 1
fi
jq -cn --arg tool_event_id "$TOOL_EVENT_ID" --arg agent "kimi-code-cli" \
  --arg session_id "$(jq -r '.session_id // .sessionId // empty' <<<"$INPUT")" \
  --arg cwd "$(jq -r '.cwd // .workdir // empty' <<<"$INPUT")" \
  '{tool_event_id:$tool_event_id,agent:$agent,session_id:(if $session_id=="" then null else $session_id end),cwd:(if $cwd=="" then null else $cwd end)}' \
  | python3 "$PRODUCER" --phase abort --cli "$CLI" --surface "${WAKACLOCK_PRODUCER_SURFACE:-cli}" || exit 1
exit 0
