#!/usr/bin/env bash
# SCAFFOLD — see ../README.md before trusting this against a real Cursor install.
#
# Metadata-only BeforeTool adapter for Cursor's `beforeShellExecution` hook.
# Freeze metadata-only workspace evidence before any CLI invocation.
# The shared helper fsyncs it; the idle collector retries without rereading files. This is a
# near-verbatim copy of the same script in ../../codex/ and ../../gemini-cli/ — the
# snapshot engine is agent-agnostic; only the `agent`/`provider` arguments differ.
set -euo pipefail

AGENT="${1:-cursor}"
PROVIDER="${2:-anysphere}"
INPUT="$(cat)"
command -v jq >/dev/null 2>&1 || { printf '%s\n' 'AtoAxis: producer_capture_failure; jq required' >&2; exit 1; }

WAKACLOCK_BIN="${WAKACLOCK_CLI_PATH:-}"
if [ -z "$WAKACLOCK_BIN" ] && [ -f "${HOME}/.wakaclock/cli-path" ]; then
  WAKACLOCK_BIN="$(tr -d '\r\n' < "${HOME}/.wakaclock/cli-path")"
fi
WAKACLOCK_BIN="${WAKACLOCK_BIN:-wakaclock}"

# `.workspace_roots[0]` is Cursor's documented field for this hook; `.cwd` and the
# other fallbacks are kept in case the real payload differs from what was documented.
CWD="$(jq -r '.cwd // .workspace_roots[0] // .tool_input.dir_path // .tool_input.cwd // empty' <<<"$INPUT" 2>/dev/null || true)"
[ -n "$CWD" ] && [ -d "$CWD" ] || CWD="$PWD"
SESSION_ID="$(jq -r '.conversation_id // .session_id // .sessionId // empty' <<<"$INPUT" 2>/dev/null || true)"
CALL_ID="$(jq -r '.generation_id // .tool_use_id // .toolUseId // .call_id // .callId // .tool_call_id // empty' <<<"$INPUT" 2>/dev/null || true)"
TOOL_NAME="$(jq -r '.hook_event_name // .tool_name // .toolName // empty' <<<"$INPUT" 2>/dev/null || true)"
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

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMMON_DIR="${WAKACLOCK_AGENT_COMMON_DIR:-${SCRIPT_DIR}/../../common}"
PRODUCER="${COMMON_DIR}/tool-boundary-producer.py"
if ! command -v python3 >/dev/null 2>&1 || [ ! -r "$PRODUCER" ]; then
  printf '%s\n' 'AtoAxis: producer_capture_failure; durable boundary helper required' >&2
  exit 1
fi

jq -cn \
  --arg tool_event_id "$TOOL_EVENT_ID" \
  --arg agent "$AGENT" \
  --arg provider "$PROVIDER" \
  --arg session_id "$SESSION_ID" \
  --arg tool "$TOOL_NAME" \
  --arg cwd "$CWD" \
  '{tool_event_id:$tool_event_id,agent:$agent,provider:(if $provider=="" then null else $provider end),model:null,session_id:(if $session_id=="" then null else $session_id end),tool:(if $tool=="" then null else $tool end),transport:"shell_hook",cwd:$cwd}' \
  | python3 "$PRODUCER" --phase before --cli "$WAKACLOCK_BIN" --surface "${WAKACLOCK_PRODUCER_SURFACE:-cli}" || exit 1

exit 0
