#!/usr/bin/env bash
# Kimi Code PostToolUse adapter. Successful file tools emit allowlisted metadata;
# successful Shell tools close the matching before/after snapshot.
set -u

INPUT="$(cat)"
command -v jq >/dev/null 2>&1 || exit 0
TOOL_NAME="$(jq -r '.tool_name // empty' <<<"$INPUT" 2>/dev/null || true)"
TOOL_EVENT_ID="$(jq -r '.tool_call_id // .toolCallId // .call_id // empty' <<<"$INPUT" 2>/dev/null || true)"

CLI="${WAKACLOCK_CLI_PATH:-}"
if [ -z "$CLI" ] && [ -f "${HOME}/.wakaclock/cli-path" ]; then
  CLI="$(tr -d '\r\n' < "${HOME}/.wakaclock/cli-path")"
fi
CLI="${CLI:-wakaclock}"
command -v "$CLI" >/dev/null 2>&1 || exit 0

case "$TOOL_NAME" in
  Shell|shell|Bash|bash)
    if [ -z "$TOOL_EVENT_ID" ]; then
      printf '%s\n' 'atoaxis-kimi: missing_tool_call_id (post-tool); skipped' >&2
      exit 0
    fi
    jq -cn \
      --arg tool_event_id "$TOOL_EVENT_ID" \
      --arg agent "kimi-code-cli" \
      --arg session_id "$(jq -r '.session_id // .sessionId // empty' <<<"$INPUT" 2>/dev/null || true)" \
      --arg tool "$TOOL_NAME" \
      --arg transport "tool_snapshot" \
      --arg workspace_root "$(jq -r '.cwd // .workdir // empty' <<<"$INPUT" 2>/dev/null || true)" \
      '{tool_event_id:$tool_event_id,agent:$agent,session_id:(if $session_id=="" then null else $session_id end),tool:$tool,transport:$transport,workspace_root:(if $workspace_root=="" then null else $workspace_root end)}' \
      | "$CLI" ai tool-after --json >/dev/null 2>&1 || true
    exit 0
    ;;
  WriteFile|StrReplaceFile|write_file|str_replace_file|replace)
    ;;
  *) printf '%s\n' 'atoaxis-kimi: unsupported_tool (post-tool); skipped' >&2; exit 0 ;;
esac

FILE_PATH="$(jq -r '.tool_input.file_path // .tool_input.filePath // .tool_input.path // empty' <<<"$INPUT" 2>/dev/null || true)"
if [ -z "$FILE_PATH" ]; then
  printf '%s\n' 'atoaxis-kimi: missing_file_path (post-tool); skipped' >&2
  exit 0
fi
CWD="$(jq -r '.cwd // .workdir // empty' <<<"$INPUT" 2>/dev/null || true)"
[ -n "$CWD" ] || CWD="$PWD"
if [[ "$FILE_PATH" != /* ]]; then
  FILE_PATH="${CWD%/}/$FILE_PATH"
fi
SESSION_ID="$(jq -r '.session_id // .sessionId // empty' <<<"$INPUT" 2>/dev/null || true)"
PROVIDER="$(jq -r '.provider_id // .provider // empty' <<<"$INPUT" 2>/dev/null || true)"
MODEL="$(jq -r '.model_id // .model // empty' <<<"$INPUT" 2>/dev/null || true)"
EVENT_MATERIAL="${SESSION_ID}|${TOOL_EVENT_ID}|${FILE_PATH}|${TOOL_NAME}"
if command -v shasum >/dev/null 2>&1; then
  EVENT_HASH="$(printf '%s' "$EVENT_MATERIAL" | shasum -a 256 | cut -c1-40)"
elif command -v cksum >/dev/null 2>&1; then
  EVENT_HASH="$(printf '%s' "$EVENT_MATERIAL" | cksum | awk '{print $1":"$2}')"
else
  EVENT_HASH="unhashed-$$"
fi
EVENT_ID="kimi-code-cli-${EVENT_HASH}"

count_lines() {
  [ -n "$1" ] || { printf '0\n'; return; }
  printf '%s' "$1" | awk 'END { print NR }'
}
LINES_ADDED=0
LINES_DELETED=0
case "$TOOL_NAME" in
  WriteFile|write_file)
    CONTENT="$(jq -r '.tool_input.content // empty' <<<"$INPUT" 2>/dev/null || true)"
    LINES_ADDED="$(count_lines "$CONTENT")"
    ;;
  StrReplaceFile|str_replace_file|replace)
    OLD="$(jq -r '.tool_input.old_string // .tool_input.oldString // empty' <<<"$INPUT" 2>/dev/null || true)"
    NEW="$(jq -r '.tool_input.new_string // .tool_input.newString // empty' <<<"$INPUT" 2>/dev/null || true)"
    LINES_ADDED="$(count_lines "$NEW")"
    LINES_DELETED="$(count_lines "$OLD")"
    ;;
esac

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." 2>/dev/null && pwd || true)"
COMMON="${WAKACLOCK_AGENT_COMMON_DIR:-${ROOT}/common}/emit-event.sh"
emit_metadata() {
  if [ -x "$COMMON" ]; then
    "$COMMON"
  else
    # Keep manually installed/older bundles working for one upgrade cycle. Map
    # the allowlisted producer object to the strict broker envelope; passing the
    # producer-only client_id/provider_id keys verbatim would be rejected by the
    # CLI before it could enqueue the event.
    jq -c '{schema_version:1,producer_version:(.producer_version // 1),event_type:"file_change",event_id,occurred_at,entity,project_root:(.project_root // null),change_kind:(.change_kind // "modify"),previous_entity:(.previous_entity // null),agent:(.agent // .client_id),provider:(.provider // .provider_id // null),model:(.model // .model_id // null),session_id:(.session_id // null),source:(.source // "agent_hook"),confidence:(.confidence // "verified"),actor_type:(.actor_type // null),actor_confidence:(.actor_confidence // null),lines_added:(.lines_added // null),lines_deleted:(.lines_deleted // null),active_seconds:(.active_seconds // null),transport:(.transport // "native_plugin"),tool:(.tool // null),tool_event_id:(.tool_event_id // .tool_call_id // null)}' \
      | "$CLI" ai emit --json >/dev/null 2>&1 || true
  fi
}
jq -cn \
  --arg client_id "kimi-code-cli" \
  --arg event_id "$EVENT_ID" \
  --arg provider_id "$PROVIDER" \
  --arg model_id "$MODEL" \
  --arg session_id "$SESSION_ID" \
  --arg tool_call_id "$TOOL_EVENT_ID" \
  --arg entity "$FILE_PATH" \
  --arg project_root "$CWD" \
  --arg tool "$TOOL_NAME" \
  --argjson lines_added "$LINES_ADDED" \
  --argjson lines_deleted "$LINES_DELETED" \
  '{client_id:$client_id,producer_version:1,event_id:$event_id,provider_id:(if $provider_id=="" then null else $provider_id end),model_id:(if $model_id=="" then null else $model_id end),session_id:(if $session_id=="" then null else $session_id end),tool_call_id:(if $tool_call_id=="" then null else $tool_call_id end),entity:$entity,project_root:(if $project_root=="" then null else $project_root end),tool:$tool,change_kind:"modify",lines_added:$lines_added,lines_deleted:$lines_deleted,source:"agent_hook",confidence:"verified",transport:"native_plugin"}' \
  | emit_metadata
exit 0
