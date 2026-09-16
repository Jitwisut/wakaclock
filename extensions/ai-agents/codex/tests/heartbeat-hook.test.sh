#!/usr/bin/env bash
# Fixture smoke test for the Codex PostToolUse adapter. The fixture is deliberately
# synthetic and keeps the adapter scaffold until a real Codex hook run is inspected.
set -eu

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP="$(mktemp -d "${TMPDIR:-/tmp}/atoaxis-codex.XXXXXX")"
trap 'rm -rf "$TMP"' EXIT
MOCK="$TMP/wakaclock"
CAPTURE="$TMP/capture.log"
cat >"$MOCK" <<'MOCK'
#!/usr/bin/env bash
printf 'ARGS:' >>"$ATOAXIS_CAPTURE"
printf ' %s' "$@" >>"$ATOAXIS_CAPTURE"
printf '\n' >>"$ATOAXIS_CAPTURE"
cat >>"$ATOAXIS_CAPTURE"
printf '\n' >>"$ATOAXIS_CAPTURE"
MOCK
chmod +x "$MOCK"

PAYLOAD='{"cwd":"/repo","session_id":"s1","tool_use_id":"call1","tool_input":{"input":"*** Begin Patch\n*** Update File: src/a file.ts\n@@\n-old\n+new\n*** Add File: src/new.ts\n+one\n+two\n*** End Patch"}}'
PAYLOAD="$(jq '.prompt="secret prompt should not be forwarded" | .tool_response="Success. Updated the following files:\nM src/a file.ts\nA src/new.ts\n"' <<<"$PAYLOAD")"
printf '%s' "$PAYLOAD" | ATOAXIS_CAPTURE="$CAPTURE" WAKACLOCK_CLI_PATH="$MOCK" "$ROOT/heartbeat-hook.sh"

[ "$(grep -c "\\\"entity\\\":\\\"$PWD/src/a file.ts\\\"" "$CAPTURE")" -eq 1 ]
[ "$(grep -c "\\\"entity\\\":\\\"$PWD/src/new.ts\\\"" "$CAPTURE")" -eq 1 ]
[ "$(grep -c '"tool_event_id":"call1"' "$CAPTURE")" -eq 2 ]
grep -q '"lines_added":1' "$CAPTURE"
grep -q '"lines_deleted":1' "$CAPTURE"
grep -q '"lines_added":2' "$CAPTURE"
if grep -q 'secret prompt' "$CAPTURE"; then
  echo "privacy failure: raw hook payload reached broker" >&2
  exit 1
fi

# Current Codex PostToolUse payloads carry the apply_patch DSL in
# tool_input.command. Keep a regression case for that shape so a future
# payload-field refactor cannot silently turn live edits into no-ops.
COMMAND_PAYLOAD='{"cwd":"'"$PWD"'","session_id":"s-command","tool_use_id":"call-command","tool_input":{"command":"*** Begin Patch\n*** Add File: src/command.ts\n+new\n*** End Patch"}}'
COMMAND_PAYLOAD="$(jq '.tool_response="Success. Updated the following files:\nA src/command.ts\n"' <<<"$COMMAND_PAYLOAD")"
printf '%s' "$COMMAND_PAYLOAD" | ATOAXIS_CAPTURE="$CAPTURE" WAKACLOCK_CLI_PATH="$MOCK" "$ROOT/heartbeat-hook.sh"
grep -q '\"entity\":\"'$PWD'/src/command.ts\"' "$CAPTURE"
grep -q '\"lines_added\":1' "$CAPTURE"

# Provider routing must not rewrite the client identity. Codex using a DeepSeek
# endpoint is still a Codex event, with the provider retained as metadata.
DEEPSEEK_PAYLOAD='{"cwd":"/repo","session_id":"s1","tool_use_id":"call-deepseek","provider":"DeepSeek API","model":"deepseek-v4-pro","tool_input":{"input":"*** Begin Patch\n*** Update File: src/provider.ts\n+new\n*** End Patch"}}'
DEEPSEEK_PAYLOAD="$(jq '.tool_response="Success. Updated the following files:\nM src/provider.ts\n"' <<<"$DEEPSEEK_PAYLOAD")"
printf '%s' "$DEEPSEEK_PAYLOAD" | ATOAXIS_CAPTURE="$CAPTURE" WAKACLOCK_CLI_PATH="$MOCK" "$ROOT/heartbeat-hook.sh"
grep -q '"agent":"codex"' "$CAPTURE"
grep -q '"provider":"DeepSeek API"' "$CAPTURE"
grep -q '"model":"deepseek-v4-pro"' "$CAPTURE"

MOVE_PAYLOAD='{"cwd":"/repo","session_id":"s1","tool_use_id":"call2","tool_input":{"input":"*** Begin Patch\n*** Update File: src/old.ts\n*** Move to: src/new-name.ts\n*** End Patch"}}'
MOVE_PAYLOAD="$(jq '.tool_response="Success. Updated the following files:\nM src/new-name.ts\n"' <<<"$MOVE_PAYLOAD")"
printf '%s' "$MOVE_PAYLOAD" | ATOAXIS_CAPTURE="$CAPTURE" WAKACLOCK_CLI_PATH="$MOCK" "$ROOT/heartbeat-hook.sh"
grep -q '"change_kind":"rename"' "$CAPTURE"
grep -q '"previous_entity":"'$PWD'/src/old.ts"' "$CAPTURE"
printf '%s' '{"session_id":"s1","tool_use_id":"failed-shell","tool_input":{"command":"secret command"}}' \
  | ATOAXIS_CAPTURE="$CAPTURE" WAKACLOCK_CLI_PATH="$MOCK" "$ROOT/tool-abort.sh"
grep -q 'ai tool-abort --json' "$CAPTURE"
if grep -q '"tool_event_id":"failed-shell"' "$CAPTURE"; then
  echo "cleanup failure: raw Codex call ID was sent instead of the snapshot identity" >&2
  exit 1
fi
grep -q '"tool_event_id":"codex-tool-' "$CAPTURE"
if grep -q 'secret command' "$CAPTURE"; then
  echo "privacy failure: failed tool payload reached CLI" >&2
  exit 1
fi
# Every unsupported/failed envelope must produce zero additional broker calls,
# even when the outer wrapper reports completion.
BEFORE="$(wc -l < "$CAPTURE")"
for RESULT in \
  'null' \
  '"Error: Failed to find expected lines. No files were modified."' \
  '"No files were modified."' \
  '{"status":"completed","output":"Error: inner tool failed"}' \
  '{"exit_code":0,"output":"Script completed"}' \
  '{"isError":true,"output":"Success. Updated the following files:\nA src/command.ts\n"}' \
  '{"success":false,"output":"Success. Updated the following files:\nA src/command.ts\n"}' \
  '{"exit_code":1,"output":"Success. Updated the following files:\nA src/command.ts\n"}' \
  '[{"type":"text","text":"Success. Updated the following files:\nA src/command.ts\n"},{"type":"text","text":"Error"}]' \
  '"Success. Updated the following files:\nA src/unrelated.ts\n"'; do
  jq --argjson result "$RESULT" '.status="completed" | .tool_response=$result' <<<"$COMMAND_PAYLOAD" \
    | ATOAXIS_CAPTURE="$CAPTURE" WAKACLOCK_CLI_PATH="$MOCK" "$ROOT/heartbeat-hook.sh"
done
jq '.status="cancelled"' <<<"$COMMAND_PAYLOAD" \
  | ATOAXIS_CAPTURE="$CAPTURE" WAKACLOCK_CLI_PATH="$MOCK" "$ROOT/heartbeat-hook.sh"
jq '.tool_input.command |= sub("\\n\\*\\*\\* End Patch$"; "")' <<<"$COMMAND_PAYLOAD" \
  | ATOAXIS_CAPTURE="$CAPTURE" WAKACLOCK_CLI_PATH="$MOCK" "$ROOT/heartbeat-hook.sh"
[ "$(wc -l < "$CAPTURE")" -eq "$BEFORE" ]

# Content blocks with positive native evidence remain supported. A partial
# summary proves only its listed operation, including paths containing spaces.
jq '.tool_use_id="content-block" | .tool_response={content:[{type:"text",text:.tool_response}],isError:false}' <<<"$COMMAND_PAYLOAD" \
  | ATOAXIS_CAPTURE="$CAPTURE" WAKACLOCK_CLI_PATH="$MOCK" "$ROOT/heartbeat-hook.sh"
grep -q '"tool_event_id":"content-block"' "$CAPTURE"
jq '.tool_use_id="partial-call" | .tool_response="Success. Updated the following files:\nA src/new.ts\n"' <<<"$PAYLOAD" \
  | ATOAXIS_CAPTURE="$CAPTURE" WAKACLOCK_CLI_PATH="$MOCK" "$ROOT/heartbeat-hook.sh"
[ "$(grep -c '"tool_event_id":"partial-call"' "$CAPTURE")" -eq 1 ]

# A bodyless delete has unknown line count; delete+add on the same path keeps
# two distinct retry-stable operation IDs. Triple signs are hunk content.
jq '.tool_use_id="replacement" | .tool_input.command="*** Begin Patch\n*** Delete File: src/replace.ts\n*** Add File: src/replace.ts\n+++counter\n*** End Patch" | .tool_response="Success. Updated the following files:\nD src/replace.ts\nA src/replace.ts\n"' <<<"$COMMAND_PAYLOAD" \
  | ATOAXIS_CAPTURE="$CAPTURE" WAKACLOCK_CLI_PATH="$MOCK" "$ROOT/heartbeat-hook.sh"
REPLACEMENT="$(grep '"tool_event_id":"replacement"' "$CAPTURE")"
[ "$(jq -s '[.[].event_id] | unique | length' <<<"$REPLACEMENT")" -eq 2 ]
jq -se 'any(.[]; .change_kind=="delete" and .lines_deleted==null)' <<<"$REPLACEMENT" >/dev/null
jq -se 'any(.[]; .change_kind=="create" and .lines_added==1)' <<<"$REPLACEMENT" >/dev/null

# Repeated same-kind paths require evidence for both occurrences; one success
# cannot identify which proposed mutation actually ran.
BEFORE="$(wc -l < "$CAPTURE")"
jq '.tool_input.command="*** Begin Patch\n*** Update File: src/repeat.ts\n+one\n*** Update File: src/repeat.ts\n+two\n*** End Patch" | .tool_response="Success. Updated the following files:\nM src/repeat.ts\n"' <<<"$COMMAND_PAYLOAD" \
  | ATOAXIS_CAPTURE="$CAPTURE" WAKACLOCK_CLI_PATH="$MOCK" "$ROOT/heartbeat-hook.sh"
[ "$(wc -l < "$CAPTURE")" -eq "$BEFORE" ]
echo "codex hook ok"
