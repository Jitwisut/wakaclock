#!/usr/bin/env bash
set -eu

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP="$(mktemp -d "${TMPDIR:-/tmp}/atoaxis-claude.XXXXXX")"
trap 'rm -rf "$TMP"' EXIT
export ATOAXIS_PRODUCER_HOME="$TMP/producer-home"
mkdir -p "$ATOAXIS_PRODUCER_HOME"
MOCK="$TMP/wakaclock"
CAPTURE="$TMP/capture.log"
cat >"$MOCK" <<'MOCK'
#!/usr/bin/env bash
if [ "${1:-}" = journal-scope ]; then
  printf '%s\n' '{"schema_version":1,"owner_confirmed":true,"capabilities":["tool_boundary_durable_v1"],"scope_id":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}'
  exit 0
fi
printf 'ARGS:%s\n' "$*" >>"$ATOAXIS_CAPTURE"
cat >>"$ATOAXIS_CAPTURE"
MOCK
chmod +x "$MOCK"

PAYLOAD='{"session_id":"s1","tool_use_id":"toolu1","cwd":"/repo","tool_name":"Write","tool_input":{"file_path":"src/app.ts","content":"one\ntwo\nprivate source must not leave hook"}}'
printf '%s' "$PAYLOAD" | ATOAXIS_CAPTURE="$CAPTURE" WAKACLOCK_CLI_PATH="$MOCK" "$ROOT/scripts/heartbeat.sh"

grep -q '"agent":"claude-code"' "$CAPTURE"
grep -q '"lines_added":3' "$CAPTURE"
grep -q '"lines_deleted":0' "$CAPTURE"
grep -q '"producer_version":1' "$CAPTURE"
if grep -q 'private source' "$CAPTURE"; then
  echo "privacy failure: Claude content reached broker" >&2
  exit 1
fi
printf '%s' '{"session_id":"s1","tool_use_id":"failed-shell","tool_name":"Bash","tool_input":{"command":"secret command"}}' \
  | ATOAXIS_CAPTURE="$CAPTURE" WAKACLOCK_CLI_PATH="$MOCK" "$ROOT/scripts/tool-abort.sh"
grep -q 'ai producer-batch --json' "$CAPTURE"
grep -q '"phase":"abort"' "$CAPTURE"
if grep -q '"tool_event_id":"failed-shell"' "$CAPTURE"; then
  echo "cleanup failure: raw Claude call ID was sent instead of the snapshot identity" >&2
  exit 1
fi
grep -q '"tool_event_id":"claude-code-tool-' "$CAPTURE"
if grep -q 'secret command' "$CAPTURE"; then
  echo "privacy failure: failed Claude tool payload reached CLI" >&2
  exit 1
fi
printf '%s' '{"session_id":"s1","agent":"claude-code","provider":"Anthropic","model":"claude-sonnet","cwd":"/repo","prompt":"do not forward"}' \
  | ATOAXIS_CAPTURE="$CAPTURE" WAKACLOCK_CLI_PATH="$MOCK" "$ROOT/scripts/session-start.sh"
grep -q '"session_id":"s1"' "$CAPTURE"
grep -q '"agent":"claude-code"' "$CAPTURE"
if grep -q 'do not forward' "$CAPTURE"; then
  echo "privacy failure: session payload reached CLI" >&2
  exit 1
fi
printf '%s' '{"session_id":"s1","agent":"claude-code","cwd":"/repo"}' \
  | ATOAXIS_CAPTURE="$CAPTURE" WAKACLOCK_CLI_PATH="$MOCK" "$ROOT/scripts/session-end.sh"
grep -q '"session_id":"s1"' "$CAPTURE"
echo "claude heartbeat ok"
