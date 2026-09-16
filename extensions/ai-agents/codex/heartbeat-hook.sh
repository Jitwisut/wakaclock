#!/usr/bin/env bash
#
# AtoAxis heartbeat hook for OpenAI Codex CLI — registered as a PostToolUse hook on the
# "apply_patch" tool (Codex's file-edit tool) in ~/.codex/config.toml. See README.md in
# this directory for the exact config.toml entries.
#
# Unlike the Claude Code plugin (hooks/hooks.json in ../plugins/atoaxis-heartbeat),
# Codex has no plugin-marketplace equivalent as of this writing — hooks are behind a
# feature flag (`codex_hooks = true`) and registered by hand-editing config.toml. This
# script mirrors the same wakaclock broker call the Claude Code hook makes; the file-path
# extraction is the part most likely to need adjusting as Codex's hook payload schema
# stabilizes, since it isn't as fully documented yet as Claude Code's.
set -euo pipefail

INPUT="$(cat)"

if ! command -v jq >/dev/null 2>&1; then
  echo "atoaxis-heartbeat (codex): jq is required but not found on PATH — skipping" >&2
  exit 0
fi

WAKACLOCK_BIN="${WAKACLOCK_CLI_PATH:-}"
if [ -z "$WAKACLOCK_BIN" ] && [ -f "${HOME}/.wakaclock/cli-path" ]; then
  WAKACLOCK_BIN="$(tr -d '\r\n' < "${HOME}/.wakaclock/cli-path")"
fi
WAKACLOCK_BIN="${WAKACLOCK_BIN:-wakaclock}"
if ! command -v "$WAKACLOCK_BIN" >/dev/null 2>&1; then
  echo "atoaxis-heartbeat (codex): '$WAKACLOCK_BIN' not found on PATH — install the wakaclock binary or set WAKACLOCK_CLI_PATH" >&2
  exit 0
fi

# Keep the adapter-specific patch parser here, but send its allowlisted result
# through the shared producer boundary. The fallback preserves already-installed
# hooks until the next VS Code setup copies the common emitter.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd || true)"
COMMON_EMITTER="${WAKACLOCK_AGENT_COMMON_EMITTER:-${SCRIPT_DIR}/../common/emit-event.sh}"
emit_metadata() {
  if [ -x "$COMMON_EMITTER" ]; then
    "$COMMON_EMITTER"
  else
    # Older installed hooks may not include the shared emitter. Map its
    # allowlisted producer object to BrokerEventV1 instead of sending the
    # producer-only client_id/provider_id names that a strict CLI rejects.
    jq -c '{schema_version:1,producer_version:(.producer_version // 1),event_type:"file_change",event_id,occurred_at,entity,project_root:(.project_root // null),change_kind:(.change_kind // "modify"),previous_entity:(.previous_entity // null),agent:(.agent // .client_id),provider:(.provider // .provider_id // null),model:(.model // .model_id // null),session_id:(.session_id // null),source:(.source // "agent_hook"),confidence:(.confidence // "verified"),actor_type:(.actor_type // null),actor_confidence:(.actor_confidence // null),lines_added:(.lines_added // null),lines_deleted:(.lines_deleted // null),active_seconds:(.active_seconds // null),transport:(.transport // "native_plugin"),tool:(.tool // null),tool_event_id:(.tool_event_id // .tool_call_id // null)}' \
      | "$WAKACLOCK_BIN" ai emit --json >/dev/null 2>&1 || true
  fi
}

WORKING_DIR="$(jq -r '.cwd // .workdir // .working_dir // .tool_input.cwd // empty' <<<"$INPUT" 2>/dev/null || true)"
[ -n "$WORKING_DIR" ] && [ -d "$WORKING_DIR" ] || WORKING_DIR="$PWD"
SESSION_ID="$(jq -r '.session_id // .sessionId // empty' <<<"$INPUT" 2>/dev/null || true)"
CALL_ID="$(jq -r '.tool_use_id // .toolUseId // .call_id // .callId // .tool_call_id // .toolCallId // empty' <<<"$INPUT" 2>/dev/null || true)"

# Codex's apply_patch payload is a patch-text blob using "*** Update File: <path>" /
# "*** Add File: <path>" markers (its own patch format, not unified diff), not a single
# `file_path` field the way Claude Code's Write/Edit tools have — so this tries the
# couple of JSON shapes that have been observed for the tool input, then falls back to
# scanning the raw patch text for those marker lines.
# Current Codex PostToolUse payloads expose the apply_patch DSL as
# tool_input.command; older hook builds used input or patch. Keep the
# allowlisted extraction explicit and never forward the containing object, which
# could include arbitrary tool metadata.
PATCH_TEXT="$(jq -r '.tool_input.command // .tool_input.input // .tool_input.patch // empty' <<<"$INPUT" 2>/dev/null || true)"
# Codex may route through a non-OpenAI provider. Read provider only when the
# hook payload (or an explicit environment override) identifies it; never infer
# a vendor from an opaque model display name. This keeps client_id=codex while
# preserving DeepSeek/other provider metadata when Codex exposes it.
AI_PROVIDER="$(jq -r '.provider_id // .provider // .context.provider // .session.provider // empty' <<<"$INPUT" 2>/dev/null || true)"
AI_PROVIDER="${AI_PROVIDER:-${ATOAXIS_PROVIDER_ID:-}}"
AI_MODEL="$(jq -r '.model // .model_name // .model_id // .context.model // .session.model // empty' <<<"$INPUT" 2>/dev/null || true)"
if [ -z "$PATCH_TEXT" ] || [ "$PATCH_TEXT" = "null" ]; then
  exit 0
fi

# PostToolUse/outer completion alone does not prove apply_patch succeeded. Read
# only recognized result envelopes locally; unknown shapes fail closed. Native
# summaries name each confirmed file operation, so a partial result cannot verify
# the remainder of the requested patch. Keep this normalization aligned with
# wakaclock-core/src/ai/codex.rs; these schemas require live certification per client.
CONFIRMED_FILES="$(jq -r '
  def outcome($depth):
    if $depth > 8 then empty
    elif type == "string" then
      . as $text | (try fromjson catch null) as $decoded |
      if $decoded != null then $decoded | outcome($depth + 1)
      else
        ($text | gsub("\r\n"; "\n") | sub("\n+$"; "") | split("\n")) as $lines |
        if $lines[0] == "Success. Updated the following files:" and ($lines | length) > 1
          and all($lines[1:][]; test("^[AMD] .+"))
        then $lines[1:][] else empty end
      end
    elif type == "array" then
      if length == 1 then .[0] | outcome($depth + 1) else empty end
    elif type == "object" then
      if .isError == true or .success == false or .error != null
    or (.tool_name != null and .tool_name != "apply_patch")
    or (has("exit_code") and .exit_code != 0)
        or (.metadata.exit_code? != null and .metadata.exit_code != 0)
        or (has("status") and .status != "success" and .status != "completed")
      then empty
      elif .type == "text" then
        if has("output") or has("result") or has("content") then empty
        else .text | outcome($depth + 1) end
      else [.output?, .result?, .content?] | map(select(. != null)) |
        if length == 1 then .[0] | outcome($depth + 1) else empty end
      end
    else empty end;
  if .isError == true or .success == false or .error != null
    or (.tool_name != null and .tool_name != "apply_patch")
    or (has("exit_code") and .exit_code != 0)
    or (.status != null and .status != "success" and .status != "completed")
  then empty
  else [.tool_response?, .tool_output?, .output?] | map(select(. != null)) |
    if length == 1 then .[0] | outcome(0) else empty end
  end
' <<<"$INPUT" 2>/dev/null || true)"
[ -n "$CONFIRMED_FILES" ] || exit 0

# Buffer metadata until the final patch marker has been seen. A truncated patch,
# malformed extra data, or repeated path with incomplete result evidence emits no
# verified edits. The separator preserves spaces in file paths.
printf '%s\n' "$PATCH_TEXT" | CODEX_CONFIRMED="$CONFIRMED_FILES" awk '
  BEGIN {
    count = split(ENVIRON["CODEX_CONFIRMED"], confirmations, "\n")
    for (i = 1; i <= count; i++) successes[confirmations[i]]++
  }
  function collect() {
    if (file != "") {
      n++
      files[n] = file; additions[n] = added; deletions[n] = deleted
      kinds[n] = kind; previous_paths[n] = previous
      keys[n] = (kind == "create" ? "A" : (kind == "delete" ? "D" : "M")) " " file
      expected[keys[n]]++
      occurrences[n] = seen[file]++
      file = ""
    }
  }
  { sub(/\r$/, "") }
  NR == 1 { if ($0 != "*** Begin Patch") invalid = 1; next }
  ended { if ($0 != "") invalid = 1; next }
  /^\*\*\* (Update|Add|Delete) File: / {
    collect()
    file = $0
    if ($0 ~ /^\*\*\* Add File:/) kind = "create"
    else if ($0 ~ /^\*\*\* Delete File:/) kind = "delete"
    else kind = "modify"
    previous = ""
    sub(/^\*\*\* (Update|Add|Delete) File: /, "", file)
    added = 0; deleted = 0
    next
  }
  /^\*\*\* Move to: / {
    if (file == "" || kind != "modify") invalid = 1
    previous = file; file = $0
    sub(/^\*\*\* Move to: /, "", file)
    kind = "rename"
    next
  }
  /^\*\*\* End Patch$/ { collect(); ended = 1; next }
  /^\*\*\* Begin Patch$/ { invalid = 1; next }
  file != "" && /^\+/ { added++; next }
  file != "" && /^-/ { deleted++; next }
  END {
    if (invalid || !ended) exit
    for (i = 1; i <= n; i++) {
      if (successes[keys[i]] != expected[keys[i]]) continue
      if (kinds[i] == "modify" && additions[i] == 0 && deletions[i] == 0) continue
      deleted_value = (kinds[i] == "delete" && deletions[i] == 0) ? "null" : deletions[i]
      printf "%s\034%d\034%s\034%s\034%s\034%d\n", files[i], additions[i], deleted_value, kinds[i], previous_paths[i], occurrences[i]
    }
  }
' | while IFS=$'\034' read -r FILE_PATH LINES_ADDED LINES_DELETED CHANGE_KIND PREVIOUS_ENTITY OCCURRENCE; do
  if [ -z "$FILE_PATH" ]; then
    continue
  fi

  if [ "$CHANGE_KIND" = "rename" ] && [ -n "$PREVIOUS_ENTITY" ] && [[ "$PREVIOUS_ENTITY" != /* ]]; then
    PREVIOUS_ENTITY="${WORKING_DIR}/${PREVIOUS_ENTITY}"
  fi

  if [[ "$FILE_PATH" != /* ]]; then
    FILE_PATH="${WORKING_DIR}/${FILE_PATH}"
  fi

  EVENT_MATERIAL="${SESSION_ID}|${CALL_ID:-apply_patch}|${FILE_PATH}"
  if [ "$OCCURRENCE" -gt 0 ]; then
    EVENT_MATERIAL="${EVENT_MATERIAL}|${OCCURRENCE}"
  fi
  if command -v shasum >/dev/null 2>&1; then
    EVENT_HASH="$(printf '%s' "$EVENT_MATERIAL" | shasum -a 256 | cut -c1-40)"
  elif command -v sha256sum >/dev/null 2>&1; then
    EVENT_HASH="$(printf '%s' "$EVENT_MATERIAL" | sha256sum | cut -c1-40)"
  elif command -v cksum >/dev/null 2>&1; then
    EVENT_HASH="$(printf '%s' "$EVENT_MATERIAL" | cksum | awk '{print $1":"$2}')"
  else
    # POSIX systems normally provide cksum; if neither utility exists, fail
    # open rather than putting a path/session string into the event ID.
    EVENT_HASH="unhashed-$$"
  fi
  EVENT_ID="codex-${EVENT_HASH}"
  # Keep the native tool identity separate from the per-file producer event ID.
  # One apply_patch call can touch many files; the shared call ID is what lets the
  # broker/snapshot layer collapse that tool into one logical operation while each
  # file still receives its own event ID. Older payloads without a call ID fall
  # back to the per-file ID so the event remains retry-stable.
  TOOL_EVENT_ID="${CALL_ID:-$EVENT_ID}"
  OCCURRED_AT="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"

  # The CLI owns broker authentication, durable acceptance and offline fallback.
  # BrokerProcessor writes the metadata-only VS Code sidecar once after acceptance.
  jq -cn \
    --arg event_id "$EVENT_ID" \
    --arg occurred_at "$OCCURRED_AT" \
    --arg entity "$FILE_PATH" \
    --arg session_id "$SESSION_ID" \
    --arg agent "codex" \
    --arg provider "$AI_PROVIDER" \
    --arg model "$AI_MODEL" \
    --arg project_root "$WORKING_DIR" \
    --arg change_kind "$CHANGE_KIND" \
    --arg previous_entity "$PREVIOUS_ENTITY" \
    --argjson lines_added "$LINES_ADDED" \
    --argjson lines_deleted "$LINES_DELETED" \
    --arg tool_event_id "$TOOL_EVENT_ID" \
    '{client_id:$agent,producer_version:1,provider_id:(if $provider=="" then null else $provider end),model_id:(if $model=="" then null else $model end),event_id:$event_id,occurred_at:$occurred_at,entity:$entity,project_root:(if $project_root=="" then null else $project_root end),change_kind:(if $change_kind=="" then "modify" else $change_kind end),previous_entity:(if $previous_entity=="" then null else $previous_entity end),session_id:(if $session_id=="" then null else $session_id end),source:"agent_hook",confidence:"verified",lines_added:$lines_added,lines_deleted:$lines_deleted,transport:"native_plugin",tool:"apply_patch",tool_call_id:$tool_event_id}' \
    | emit_metadata
done

exit 0
