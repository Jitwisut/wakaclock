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
MOCK
chmod +x "$MOCK"

PAYLOAD='{"cwd":"/repo","session_id":"s1","tool_use_id":"call1","tool_input":{"input":"*** Begin Patch\n*** Update File: src/a file.ts\n@@\n-old\n+new\n*** Add File: src/new.ts\n+one\n+two\n*** End Patch\nsecret prompt should not be forwarded"}}'
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
printf '%s' "$COMMAND_PAYLOAD" | ATOAXIS_CAPTURE="$CAPTURE" WAKACLOCK_CLI_PATH="$MOCK" "$ROOT/heartbeat-hook.sh"
grep -q '\"entity\":\"'$PWD'/src/command.ts\"' "$CAPTURE"
grep -q '\"lines_added\":1' "$CAPTURE"

# Provider routing must not rewrite the client identity. Codex using a DeepSeek
# endpoint is still a Codex event, with the provider retained as metadata.
DEEPSEEK_PAYLOAD='{"cwd":"/repo","session_id":"s1","tool_use_id":"call-deepseek","provider":"DeepSeek API","model":"deepseek-v4-pro","tool_input":{"input":"*** Begin Patch\n*** Update File: src/provider.ts\n+new\n*** End Patch"}}'
printf '%s' "$DEEPSEEK_PAYLOAD" | ATOAXIS_CAPTURE="$CAPTURE" WAKACLOCK_CLI_PATH="$MOCK" "$ROOT/heartbeat-hook.sh"
grep -q '"agent":"codex"' "$CAPTURE"
grep -q '"provider":"DeepSeek API"' "$CAPTURE"
grep -q '"model":"deepseek-v4-pro"' "$CAPTURE"

MOVE_PAYLOAD='{"cwd":"/repo","session_id":"s1","tool_use_id":"call2","tool_input":{"input":"*** Begin Patch\n*** Update File: src/old.ts\n*** Move to: src/new-name.ts\n*** End Patch"}}'
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
echo "codex hook ok"
