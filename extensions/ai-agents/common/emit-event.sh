#!/usr/bin/env bash
# Universal metadata-only producer boundary.
#
# stdin is an allowlisted JSON object containing file-change metadata.  This script
# deliberately extracts individual fields instead of forwarding the native hook
# payload, because native payloads may contain prompts, responses, source content,
# patch bodies, command arguments or terminal output.  The Rust broker performs a
# second strict validation before accepting the event.
set -u

INPUT="$(cat)"
if ! command -v jq >/dev/null 2>&1; then
  exit 0
fi

WAKACLOCK_BIN="${WAKACLOCK_CLI_PATH:-}"
if [ -z "$WAKACLOCK_BIN" ] && [ -f "${HOME}/.wakaclock/cli-path" ]; then
  WAKACLOCK_BIN="$(tr -d '\r\n' < "${HOME}/.wakaclock/cli-path")"
fi
WAKACLOCK_BIN="${WAKACLOCK_BIN:-wakaclock}"
if ! command -v "$WAKACLOCK_BIN" >/dev/null 2>&1; then
  exit 0
fi

read_field() {
  local expression="$1"
  # Never stringify an object/array from the native payload. A provider/model/path
  # object can contain arbitrary prompt or tool data; only scalar strings/numbers
  # are allowed to cross this boundary. Numeric fields are converted to text here
  # and validated again below by number_or_null.
  jq -r "(${expression}) | if type == \"string\" or type == \"number\" then tostring else empty end" \
    <<<"$INPUT" 2>/dev/null || true
}

CLIENT_INPUT="$(read_field '.client_id // .agent')"
CLIENT_ID="${CLIENT_INPUT:-${ATOAXIS_CLIENT_ID:-unknown-agent}}"
PROVIDER_ID="$(read_field '.provider_id // .provider')"
PROVIDER_ID="${PROVIDER_ID:-${ATOAXIS_PROVIDER_ID:-}}"
MODEL_ID="$(read_field '.model_id // .model')"
SESSION_ID="$(read_field '.session_id // .sessionId')"
TOOL_CALL_ID="$(read_field '.tool_call_id // .tool_event_id // .call_id // .tool_use_id')"
TOOL_NAME="$(read_field '.tool // .tool_name')"
ENTITY="$(read_field '.entity // .file_path // .path')"
PROJECT_ROOT="$(read_field '.project_root // .workspace_root // .cwd')"
PREVIOUS_ENTITY="$(read_field '.previous_entity // .old_path')"
# Self-declaration, not detection: whichever editor spawned *this* hook's parent
# process said so via its own env var (the VS Code extension sets WAKACLOCK_EDITOR;
# an editor's integrated terminal sets TERM_PROGRAM). Captured here, at hook-fire
# time, because it is gone by the time the daemon dequeues this event later.
EDITOR_ID="${WAKACLOCK_EDITOR:-${TERM_PROGRAM:-}}"
OCCURRED_AT="$(read_field '.occurred_at // .timestamp')"
OCCURRED_AT="${OCCURRED_AT:-$(date -u '+%Y-%m-%dT%H:%M:%SZ')}"
SOURCE="$(read_field '.source')"
if [ -z "$SOURCE" ] && [ -z "$CLIENT_INPUT" ] && [ -z "${ATOAXIS_CLIENT_ID:-}" ]; then
  SOURCE="ide_telemetry"
else
  SOURCE="${SOURCE:-agent_hook}"
fi
CONFIDENCE="$(read_field '.confidence')"
if [ -z "$CONFIDENCE" ] && [ -z "$CLIENT_INPUT" ] && [ -z "${ATOAXIS_CLIENT_ID:-}" ]; then
  # An adapter that cannot identify its client is still accepted as metadata, but
  # its name must not be treated as proof of an AI edit.
  CONFIDENCE="unknown"
else
  CONFIDENCE="${CONFIDENCE:-verified}"
fi
TRANSPORT="$(read_field '.transport')"
TRANSPORT="${TRANSPORT:-native_plugin}"
CHANGE_KIND="$(read_field '.change_kind // .operation // .kind')"
CHANGE_KIND="${CHANGE_KIND:-modify}"
TOOL_EVENT_ID="$(read_field '.tool_event_id // .tool_call_id // .call_id')"
TOOL_EVENT_ID="${TOOL_EVENT_ID:-$TOOL_CALL_ID}"

# Adapters should pass scalar strings directly, but an older wrapper can still
# stringify a nested JSON object before invoking this script. Reject control bytes
# and JSON-looking values here so a future hook payload cannot smuggle arbitrary
# nested content through an otherwise allowlisted field.
safe_metadata_value() {
  local value="$1"
  [ "${#value}" -le 512 ] || return 1
  case "$value" in
    *$'\n'*|*$'\r'*|*$'\t'*|*$'\001'*|*$'\002'*|*$'\003'*|*$'\004'*|*$'\005'*|*$'\006'*|*$'\007'*) return 1 ;;
    \{*|\[* ) return 1 ;;
  esac
  return 0
}
for metadata_value in "$CLIENT_ID" "$PROVIDER_ID" "$MODEL_ID" "$SESSION_ID" \
  "$TOOL_CALL_ID" "$TOOL_NAME" "$ENTITY" "$PROJECT_ROOT" "$PREVIOUS_ENTITY" \
  "$OCCURRED_AT" "$SOURCE" "$CONFIDENCE" "$TRANSPORT" "$CHANGE_KIND" "$EDITOR_ID"; do
  safe_metadata_value "$metadata_value" || exit 0
done

# A hook may report a path relative to its working directory.  Resolve it against
# the explicitly reported workspace, never against an arbitrary home directory.
if [ -n "$ENTITY" ] && [[ "$ENTITY" != /* ]] && [ -n "$PROJECT_ROOT" ]; then
  ENTITY="${PROJECT_ROOT%/}/$ENTITY"
fi
if [ -n "$PREVIOUS_ENTITY" ] && [[ "$PREVIOUS_ENTITY" != /* ]] && [ -n "$PROJECT_ROOT" ]; then
  PREVIOUS_ENTITY="${PROJECT_ROOT%/}/$PREVIOUS_ENTITY"
fi
[ -n "$ENTITY" ] || exit 0

CHANGE_KIND_LOWER="$(printf '%s' "$CHANGE_KIND" | tr '[:upper:]' '[:lower:]')"
case "$CHANGE_KIND_LOWER" in
  create|created|add|added|new|new_file) CHANGE_KIND="create" ;;
  delete|deleted|remove|removed|rm|unlink) CHANGE_KIND="delete" ;;
  rename|renamed|move|moved|mv) CHANGE_KIND="rename" ;;
  *) CHANGE_KIND="modify" ;;
esac

SOURCE_LOWER="$(printf '%s' "$SOURCE" | tr '[:upper:]' '[:lower:]')"
case "$SOURCE_LOWER" in
  agent_hook|mcp|ide_telemetry|transcript) ;;
  *) SOURCE="agent_hook" ;;
esac
CONFIDENCE_LOWER="$(printf '%s' "$CONFIDENCE" | tr '[:upper:]' '[:lower:]')"
case "$CONFIDENCE_LOWER" in
  verified|correlated|inferred|unknown) ;;
  *) CONFIDENCE="inferred" ;;
esac

number_or_null() {
  local value="$1"
  if [[ "$value" =~ ^[0-9]+$ ]]; then
    printf '%s\n' "$value"
  else
    printf 'null\n'
  fi
}

# Hash identity material before it leaves the adapter.  A native hook may provide
# an event_id of its own; if an older integration accidentally embeds a path in that
# ID, retain retry stability without forwarding the path as plain text.
opaque_hash() {
  local material="$1"
  if command -v shasum >/dev/null 2>&1; then
    printf '%s' "$material" | shasum -a 256 | cut -c1-40
  elif command -v sha256sum >/dev/null 2>&1; then
    printf '%s' "$material" | sha256sum | cut -c1-40
  elif command -v cksum >/dev/null 2>&1; then
    printf '%s' "$material" | cksum | awk '{print $1":"$2}'
  else
    printf 'unhashed-%s\n' "$$"
  fi
}

LINES_ADDED="$(number_or_null "$(read_field '.lines_added // .added')")"
LINES_DELETED="$(number_or_null "$(read_field '.lines_deleted // .deleted')")"
ACTIVE_SECONDS="$(read_field '.active_seconds')"
if ! [[ "$ACTIVE_SECONDS" =~ ^[0-9]+([.][0-9]+)?$ ]]; then
  ACTIVE_SECONDS="null"
fi

PROVIDED_EVENT_ID="$(read_field '.event_id')"
if [ -z "$PROVIDED_EVENT_ID" ]; then
  EVENT_MATERIAL="${CLIENT_ID}|${PROVIDER_ID}|${SESSION_ID}|${TOOL_CALL_ID}|${ENTITY}|${CHANGE_KIND}|${OCCURRED_AT}"
  EVENT_ID="ape1:$(opaque_hash "$EVENT_MATERIAL")"
else
  EVENT_ID="$PROVIDED_EVENT_ID"
  # Event IDs are identities, never a free-form transport for prompts or command
  # text. Keep the narrow broker alphabet; path-bearing and otherwise arbitrary
  # values remain retry-stable after hashing.
  if ! [[ "$EVENT_ID" =~ ^[A-Za-z0-9._:-]+$ ]] || [ "${#EVENT_ID}" -gt 128 ]; then
    # Include the target entity/change kind so a malformed shared tool ID still
    # yields one opaque identity per file in a multi-file operation.
    EVENT_ID="ape1:$(opaque_hash "${CLIENT_ID}|${SESSION_ID}|${TOOL_CALL_ID}|${ENTITY}|${CHANGE_KIND}|${EVENT_ID}")"
  fi
fi

# `agent`/`provider`/`model` are the existing Broker Event v1 wire names.  The
# producer contract calls the same values client/provider/model to make the
# distinction explicit at adapter boundaries.
jq -cn \
  --argjson producer_version 1 \
  --arg event_id "$EVENT_ID" \
  --arg occurred_at "$OCCURRED_AT" \
  --arg entity "$ENTITY" \
  --arg project_root "$PROJECT_ROOT" \
  --arg previous_entity "$PREVIOUS_ENTITY" \
  --arg change_kind "$CHANGE_KIND" \
  --arg agent "$CLIENT_ID" \
  --arg provider "$PROVIDER_ID" \
  --arg model "$MODEL_ID" \
  --arg session_id "$SESSION_ID" \
  --arg source "$SOURCE" \
  --arg confidence "$CONFIDENCE" \
  --arg transport "$TRANSPORT" \
  --arg tool "$TOOL_NAME" \
  --arg tool_event_id "$TOOL_EVENT_ID" \
  --arg editor "$EDITOR_ID" \
  --argjson lines_added "$LINES_ADDED" \
  --argjson lines_deleted "$LINES_DELETED" \
  --argjson active_seconds "$ACTIVE_SECONDS" \
  '{schema_version:1,producer_version:$producer_version,event_type:"file_change",event_id:$event_id,occurred_at:$occurred_at,entity:$entity,project_root:(if $project_root=="" then null else $project_root end),change_kind:$change_kind,previous_entity:(if $previous_entity=="" then null else $previous_entity end),agent:$agent,provider:(if $provider=="" then null else $provider end),model:(if $model=="" then null else $model end),session_id:(if $session_id=="" then null else $session_id end),source:$source,confidence:$confidence,lines_added:$lines_added,lines_deleted:$lines_deleted,active_seconds:$active_seconds,transport:$transport,tool:(if $tool=="" then null else $tool end),tool_event_id:(if $tool_event_id=="" then null else $tool_event_id end),editor:(if $editor=="" then null else $editor end)}' \
  | "$WAKACLOCK_BIN" ai emit --json >/dev/null 2>&1 || true

# Hooks must always fail open so telemetry cannot block an agent's edit.
exit 0
