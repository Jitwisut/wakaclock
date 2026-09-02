#!/usr/bin/env bash
# Metadata-only SessionStart/SessionEnd bridge shared by Claude Code and Kimi.
# It intentionally extracts a fixed allowlist; prompts, responses and tool payloads
# are never forwarded to the CLI or written to the local session state.
set -u

PHASE="${1:-}"
case "$PHASE" in
  start|end) ;;
  *) exit 0 ;;
esac

INPUT="$(cat)"
command -v jq >/dev/null 2>&1 || exit 0

CLI="${WAKACLOCK_CLI_PATH:-}"
if [ -z "$CLI" ] && [ -f "${HOME}/.wakaclock/cli-path" ]; then
  CLI="$(tr -d '\r\n' < "${HOME}/.wakaclock/cli-path")"
fi
CLI="${CLI:-wakaclock}"
command -v "$CLI" >/dev/null 2>&1 || exit 0

SESSION_ID="$(jq -r '.session_id // .sessionId // .id // empty' <<<"$INPUT" 2>/dev/null || true)"
[ -n "$SESSION_ID" ] || exit 0
AGENT="$(jq -r '.agent // .client_id // .client // empty' <<<"$INPUT" 2>/dev/null || true)"
AGENT="${AGENT:-${ATOAXIS_CLIENT_ID:-unknown-agent}}"
PROVIDER="$(jq -r '.provider_id // .provider // .model_provider // empty' <<<"$INPUT" 2>/dev/null || true)"
MODEL="$(jq -r '.model_id // .model // .model_name // empty' <<<"$INPUT" 2>/dev/null || true)"
CWD="$(jq -r '.cwd // .workdir // .workspace_root // .directory // empty' <<<"$INPUT" 2>/dev/null || true)"
OCCURRED_AT="$(jq -r '.occurred_at // .timestamp // empty' <<<"$INPUT" 2>/dev/null || true)"

if [ "$PHASE" = "start" ]; then
  COMMAND=(ai session-start --json)
else
  COMMAND=(ai session-end --json)
fi
jq -cn \
  --arg session_id "$SESSION_ID" \
  --arg agent "$AGENT" \
  --arg provider "$PROVIDER" \
  --arg model "$MODEL" \
  --arg cwd "$CWD" \
  --arg occurred_at "$OCCURRED_AT" \
  '{session_id:$session_id,agent:$agent,provider:(if $provider=="" then null else $provider end),model:(if $model=="" then null else $model end),cwd:(if $cwd=="" then null else $cwd end),source:"agent_hook",occurred_at:(if $occurred_at=="" then null else $occurred_at end)}' \
  | "$CLI" "${COMMAND[@]}" >/dev/null 2>&1 || true
exit 0
