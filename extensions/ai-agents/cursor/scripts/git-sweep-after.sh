#!/usr/bin/env bash
# SCAFFOLD — see ../README.md before trusting this against a real Cursor install.
#
# Metadata-only AfterTool adapter for Cursor's `afterShellExecution` hook.
# `wakaclock ai tool-after` loads the matching SQLite BeforeTool snapshot, computes
# create/modify/delete/rename evidence and emits one duration interval per tool call.
# Near-verbatim copy of ../../codex/git-sweep-after.sh and
# ../../gemini-cli/scripts/git-sweep-after.sh; the diff engine is agent-agnostic.
set -euo pipefail

AGENT="${1:-cursor}"
PROVIDER="${2:-anysphere}"
INPUT="$(cat)"
command -v jq >/dev/null 2>&1 || exit 0

WAKACLOCK_BIN="${WAKACLOCK_CLI_PATH:-}"
if [ -z "$WAKACLOCK_BIN" ] && [ -f "${HOME}/.wakaclock/cli-path" ]; then
  WAKACLOCK_BIN="$(tr -d '\r\n' < "${HOME}/.wakaclock/cli-path")"
fi
WAKACLOCK_BIN="${WAKACLOCK_BIN:-wakaclock}"
command -v "$WAKACLOCK_BIN" >/dev/null 2>&1 || exit 0

CWD="$(jq -r '.cwd // .workspace_roots[0] // .tool_input.dir_path // .tool_input.cwd // empty' <<<"$INPUT" 2>/dev/null || true)"
[ -n "$CWD" ] && [ -d "$CWD" ] || CWD="$PWD"
SESSION_ID="$(jq -r '.conversation_id // .session_id // .sessionId // empty' <<<"$INPUT" 2>/dev/null || true)"
CALL_ID="$(jq -r '.generation_id // .tool_use_id // .toolUseId // .call_id // .callId // .tool_call_id // empty' <<<"$INPUT" 2>/dev/null || true)"
TOOL_NAME="$(jq -r '.hook_event_name // .tool_name // .toolName // empty' <<<"$INPUT" 2>/dev/null || true)"
KEY_MATERIAL="${AGENT}|${CWD}|${SESSION_ID}|${CALL_ID:-${TOOL_NAME}}"
TOOL_EVENT_ID="${AGENT}-tool-$(printf '%s' "$KEY_MATERIAL" | shasum -a 256 | cut -c1-40)"

jq -cn \
  --arg tool_event_id "$TOOL_EVENT_ID" \
  --arg agent "$AGENT" \
  --arg provider "$PROVIDER" \
  --arg session_id "$SESSION_ID" \
  --arg tool "$TOOL_NAME" \
  --arg cwd "$CWD" \
  '{tool_event_id:$tool_event_id,agent:$agent,provider:(if $provider=="" then null else $provider end),model:null,session_id:(if $session_id=="" then null else $session_id end),tool:(if $tool=="" then null else $tool end),transport:"shell_hook",cwd:$cwd}' \
  | "$WAKACLOCK_BIN" ai tool-after --json >/dev/null 2>&1 || true

exit 0
