#!/usr/bin/env bash
# SCAFFOLD — see ../README.md before trusting this against a real Cursor install.
#
# Metadata-only BeforeTool adapter for Cursor's `beforeShellExecution` hook.
# Heavy lifting lives in `wakaclock ai tool-before`: workspace discovery, SHA-256
# fingerprints, Git/non-Git enumeration and crash-safe SQLite persistence. This is a
# near-verbatim copy of the same script in ../../codex/ and ../../gemini-cli/ — the
# snapshot engine is agent-agnostic; only the `agent`/`provider` arguments differ.
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

jq -cn \
  --arg tool_event_id "$TOOL_EVENT_ID" \
  --arg agent "$AGENT" \
  --arg provider "$PROVIDER" \
  --arg session_id "$SESSION_ID" \
  --arg tool "$TOOL_NAME" \
  --arg cwd "$CWD" \
  '{tool_event_id:$tool_event_id,agent:$agent,provider:(if $provider=="" then null else $provider end),model:null,session_id:(if $session_id=="" then null else $session_id end),tool:(if $tool=="" then null else $tool end),transport:"shell_hook",cwd:$cwd}' \
  | "$WAKACLOCK_BIN" ai tool-before --json >/dev/null 2>&1 || true

exit 0
