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

mkdir -p "$TMP/repo/src"
FILE="$TMP/repo/src/app.ts"
printf 'one\r\ntwo\r\nprivate source must not leave hook — ไทย\r\n' > "$FILE"
PAYLOAD="$(jq -cn --arg cwd "$TMP/repo" --rawfile content "$FILE" \
  '{session_id:"s1",tool_use_id:"toolu1",cwd:$cwd,tool_name:"Write",tool_input:{file_path:"src/app.ts",content:$content}}')"
printf '%s' "$PAYLOAD" | ATOAXIS_CAPTURE="$CAPTURE" WAKACLOCK_CLI_PATH="$MOCK" "$ROOT/scripts/heartbeat.sh"

grep -q '"agent":"claude-code"' "$CAPTURE"
grep -q '"lines_added":3' "$CAPTURE"
grep -q '"lines_deleted":0' "$CAPTURE"
grep -q '"producer_version":1' "$CAPTURE"
# The raw tool-use ID is the dedup key shared with the transcript; the event ID keeps
# its digest form so retries of hooks from older installs stay idempotent.
EXPECTED_HASH="$(printf '%s' "s1|toolu1|$FILE" | shasum -a 256 | cut -c1-40)"
grep -q "\"event_id\":\"claude-code-${EXPECTED_HASH}\"" "$CAPTURE"
grep -E -q '"tool_(call|event)_id":"toolu1"' "$CAPTURE"
EXPECTED_FINGERPRINT="sha256:$(shasum -a 256 "$FILE" | cut -d' ' -f1)"
grep -Fq "\"authorship_fingerprint\":\"$EXPECTED_FINGERPRINT\"" "$CAPTURE"
grep -Fq '"authorship_proof_version":1' "$CAPTURE"
if grep -q '"content_fingerprint"' "$CAPTURE"; then
  echo 'display evidence reached the timing matcher' >&2
  exit 1
fi
if grep -q 'private source' "$CAPTURE"; then
  echo "privacy failure: Claude content reached broker" >&2
  exit 1
fi
printf '\377' > "$TMP/not-utf8"
truncate -s 524289 "$TMP/too-large"
ln -s "$FILE" "$TMP/symlink"
for ignored in "$TMP/not-utf8" "$TMP/too-large" "$TMP/symlink" "$TMP/missing"; do
  test -z "$(printf '%s' "$PAYLOAD" | python3 "$ROOT/scripts/authorship-fingerprint.py" "$ignored")"
done
printf '%s' "$PAYLOAD" | jq '.tool_input.content = "another edit"' |
  python3 "$ROOT/scripts/authorship-fingerprint.py" "$FILE" > "$TMP/changed-hash"
test ! -s "$TMP/changed-hash"
EDIT="$TMP/edit.ts"
printf 'new\r\n' > "$EDIT"
EDIT_PAYLOAD="$(jq -cn '{tool_name:"Edit",tool_input:{old_string:"old",new_string:"new"},tool_response:{originalFile:"old\r\n"}}')"
expected="sha256:$(shasum -a 256 "$EDIT" | cut -d' ' -f1)"
test "$(printf '%s' "$EDIT_PAYLOAD" | python3 "$ROOT/scripts/authorship-fingerprint.py" "$EDIT")" = "$expected"
for change in 'del(.tool_response)' '.tool_response.originalFile = "old old"' '.tool_response.userModified = true' '.tool_name = "MultiEdit"'; do
  test -z "$(printf '%s' "$EDIT_PAYLOAD" | jq "$change" | python3 "$ROOT/scripts/authorship-fingerprint.py" "$EDIT")"
done
test -z "$(python3 "$ROOT/scripts/authorship-fingerprint.py" "$EDIT" </dev/null)"
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
