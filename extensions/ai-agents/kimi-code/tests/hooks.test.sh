#!/usr/bin/env bash
set -eu

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP="$(mktemp -d "${TMPDIR:-/tmp}/atoaxis-kimi.XXXXXX")"
trap 'rm -rf "$TMP"' EXIT
export ATOAXIS_PRODUCER_HOME="$TMP/producer-home"
mkdir -p "$ATOAXIS_PRODUCER_HOME"
MOCK="$TMP/wakaclock"
CAPTURE="$TMP/capture.json"
cat >"$MOCK" <<'MOCK'
#!/usr/bin/env bash
if [ "${1:-}" = journal-scope ]; then
  printf '%s\n' '{"schema_version":1,"owner_confirmed":true,"capabilities":["tool_boundary_durable_v1"],"scope_id":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}'
  exit 0
fi
cat >"$ATOAXIS_CAPTURE"
MOCK
chmod +x "$MOCK"

PAYLOAD='{"session_id":"s1","cwd":"/repo","tool_name":"WriteFile","tool_call_id":"call1","tool_input":{"file_path":"src/main.ts","content":"one\ntwo\nsecret source must not be forwarded"}}'
printf '%s' "$PAYLOAD" | ATOAXIS_CAPTURE="$CAPTURE" WAKACLOCK_CLI_PATH="$MOCK" "$ROOT/hooks/post-tool-use.sh"
grep -q '"agent":"kimi-code-cli"' "$CAPTURE"
grep -q '"lines_added":3' "$CAPTURE"
grep -q '"producer_version":1' "$CAPTURE"
if grep -q 'secret source' "$CAPTURE"; then
  echo "privacy failure: WriteFile content reached broker" >&2
  exit 1
fi

printf '%s' '{"session_id":"s1","cwd":"/repo","tool_name":"Shell","tool_call_id":"call2","tool_input":{"command":"sed -i secret src/main.ts"}}' \
  | ATOAXIS_CAPTURE="$CAPTURE" WAKACLOCK_CLI_PATH="$MOCK" "$ROOT/hooks/pre-tool-use.sh"
grep -q '"tool_event_id":"call2"' "$CAPTURE"
if grep -q 'sed -i secret' "$CAPTURE"; then
  echo "privacy failure: shell command reached snapshot payload" >&2
  exit 1
fi

printf '%s' '{"session_id":"s1","agent":"kimi-code-cli","provider":"Moonshot AI","model":"kimi-k2","cwd":"/repo","prompt":"do not forward"}' \
  | ATOAXIS_CAPTURE="$CAPTURE" WAKACLOCK_CLI_PATH="$MOCK" "$ROOT/hooks/session-start.sh"
grep -q '"session_id":"s1"' "$CAPTURE"
grep -q '"agent":"kimi-code-cli"' "$CAPTURE"
if grep -q 'do not forward' "$CAPTURE"; then
  echo "privacy failure: session payload reached CLI" >&2
  exit 1
fi
printf '%s' '{"session_id":"s1","agent":"kimi-code-cli","cwd":"/repo"}' \
  | ATOAXIS_CAPTURE="$CAPTURE" WAKACLOCK_CLI_PATH="$MOCK" "$ROOT/hooks/session-end.sh"
grep -q '"session_id":"s1"' "$CAPTURE"
printf '%s' '{"session_id":"s1","agent":"kimi-code-cli","cwd":"/repo","prompt":"do not forward"}' \
  | ATOAXIS_CAPTURE="$CAPTURE" WAKACLOCK_CLI_PATH="$MOCK" "$ROOT/hooks/stop.sh"
grep -q '"session_id":"s1"' "$CAPTURE"
printf '%s' '{"session_id":"s1","agent":"kimi-code-cli","cwd":"/repo"}' \
  | ATOAXIS_CAPTURE="$CAPTURE" WAKACLOCK_CLI_PATH="$MOCK" "$ROOT/hooks/stop-failure.sh"
grep -q '"session_id":"s1"' "$CAPTURE"

CONFIG="$TMP/.kimi/config.toml"
mkdir -p "$(dirname "$CONFIG")"
printf '%s\n' '# user hook' '[[hooks]]' 'event = "UserEvent"' 'command = "/tmp/user-hook.sh"' >"$CONFIG"
KIMI_CONFIG_PATH="$CONFIG" "$ROOT/installer/install.sh"
KIMI_CONFIG_PATH="$CONFIG" "$ROOT/installer/install.sh"
[ "$(grep -c '# AtoAxis managed Kimi Code hooks' "$CONFIG")" -eq 1 ]
grep -q 'event = "UserEvent"' "$CONFIG"
grep -q '/tmp/user-hook.sh' "$CONFIG"
grep -q 'event = "Stop"' "$CONFIG"
grep -q 'event = "StopFailure"' "$CONFIG"
KIMI_CONFIG_PATH="$CONFIG" "$ROOT/installer/install.sh" --uninstall
! grep -q 'AtoAxis managed Kimi Code hooks' "$CONFIG"
grep -q '/tmp/user-hook.sh' "$CONFIG"

# Current Kimi releases honor KIMI_CODE_HOME; the installer must place the
# managed block there without falling back to the legacy ~/.kimi path.
MODERN_HOME="$TMP/kimi-code-home"
KIMI_CODE_HOME="$MODERN_HOME" HOME="$TMP/unused-home" "$ROOT/installer/install.sh"
[ -f "$MODERN_HOME/config.toml" ]
grep -q '# AtoAxis managed Kimi Code hooks' "$MODERN_HOME/config.toml"
KIMI_CODE_HOME="$MODERN_HOME" HOME="$TMP/unused-home" "$ROOT/installer/install.sh" --uninstall
! grep -q '# AtoAxis managed Kimi Code hooks' "$MODERN_HOME/config.toml"
echo "kimi hooks ok"
