#!/usr/bin/env bash
# Kimi Code PreToolUse adapter. Shell commands get a metadata-only workspace
# snapshot; file tools are handled after successful execution. Never forward the
# command string or any tool input to the broker.
set -u

INPUT="$(cat)"
command -v jq >/dev/null 2>&1 || exit 0

TOOL_NAME="$(jq -r '.tool_name // empty' <<<"$INPUT" 2>/dev/null || true)"
case "$TOOL_NAME" in
  Shell|shell|Bash|bash) ;;
  *) printf '%s\n' 'atoaxis-kimi: unsupported_tool (pre-tool); skipped' >&2; exit 0 ;;
esac

TOOL_EVENT_ID="$(jq -r '.tool_call_id // .toolCallId // .call_id // empty' <<<"$INPUT" 2>/dev/null || true)"
if [ -z "$TOOL_EVENT_ID" ]; then
  printf '%s\n' 'atoaxis-kimi: missing_tool_call_id (pre-tool); skipped' >&2
  exit 0
fi
CWD="$(jq -r '.cwd // .workdir // empty' <<<"$INPUT" 2>/dev/null || true)"
[ -n "$CWD" ] || CWD="$PWD"
SESSION_ID="$(jq -r '.session_id // .sessionId // empty' <<<"$INPUT" 2>/dev/null || true)"
PROVIDER="$(jq -r '.provider_id // .provider // empty' <<<"$INPUT" 2>/dev/null || true)"
MODEL="$(jq -r '.model_id // .model // empty' <<<"$INPUT" 2>/dev/null || true)"

CLI="${WAKACLOCK_CLI_PATH:-}"
if [ -z "$CLI" ] && [ -f "${HOME}/.wakaclock/cli-path" ]; then
  CLI="$(tr -d '\r\n' < "${HOME}/.wakaclock/cli-path")"
fi
CLI="${CLI:-wakaclock}"
command -v "$CLI" >/dev/null 2>&1 || exit 0

jq -cn \
  --arg tool_event_id "$TOOL_EVENT_ID" \
  --arg agent "kimi-code-cli" \
  --arg provider "$PROVIDER" \
  --arg model "$MODEL" \
  --arg session_id "$SESSION_ID" \
  --arg tool "$TOOL_NAME" \
  --arg transport "tool_snapshot" \
  --arg workspace_root "$CWD" \
  '{tool_event_id:$tool_event_id,agent:$agent,provider:(if $provider=="" then null else $provider end),model:(if $model=="" then null else $model end),session_id:(if $session_id=="" then null else $session_id end),tool:$tool,transport:$transport,workspace_root:$workspace_root}' \
  | "$CLI" ai tool-before --json >/dev/null 2>&1 || true
exit 0
