#!/usr/bin/env bash
# Portable smoke test for the shared shell producer. The mock CLI records only
# the envelope so this test can assert that a hook payload's content is absent.
set -eu

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP="$(mktemp -d "${TMPDIR:-/tmp}/atoaxis-emitter.XXXXXX")"
trap 'rm -rf "$TMP"' EXIT
MOCK="$TMP/wakaclock"
CAPTURE="$TMP/capture.json"
cat >"$MOCK" <<'MOCK'
#!/usr/bin/env bash
cat >"$ATOAXIS_CAPTURE"
MOCK
chmod +x "$MOCK"

INPUT='{"client_id":"kilo-code","provider_id":"DeepSeek API","model_id":"deepseek-v4","session_id":"s1","tool_call_id":"t1","entity":"src/main.rs","project_root":"/repo","change_kind":"modify","lines_added":3,"content":"do not transmit this"}'
printf '%s' "$INPUT" | ATOAXIS_CAPTURE="$CAPTURE" WAKACLOCK_CLI_PATH="$MOCK" "$ROOT/emit-event.sh"

grep -q '"agent":"kilo-code"' "$CAPTURE"
grep -q '"provider":"DeepSeek API"' "$CAPTURE"
if grep -q 'do not transmit' "$CAPTURE"; then
  echo "privacy failure: content reached broker envelope" >&2
  exit 1
fi
grep -q '"event_type":"file_change"' "$CAPTURE"
grep -q '"producer_version":1' "$CAPTURE"

printf '%s' '{"sessionId":"session-1","agent":"kilo-code","provider":"DeepSeek API","model":"deepseek-v4","cwd":"/repo","prompt":"never forward"}' \
  | HOME="$TMP/home" ATOAXIS_CAPTURE="$CAPTURE" WAKACLOCK_CLI_PATH="$MOCK" "$ROOT/session-event.sh" start
grep -q '"session_id":"session-1"' "$CAPTURE"
grep -q '"agent":"kilo-code"' "$CAPTURE"
if grep -q 'never forward' "$CAPTURE"; then
  echo "privacy failure: session payload content reached CLI" >&2
  exit 1
fi

# Object-valued metadata must not be stringified into the wire envelope. Native
# hook payloads are allowed to grow arbitrary nested fields, so a secret nested in
# a provider object is a regression even when the top-level key is allowlisted.
printf '%s' '{"client_id":{"name":"kilo-code","prompt":"must not leak"},"provider_id":{"id":"deepseek","secret":"must not leak"},"entity":{"path":"/repo/src/leak.ts","content":"must not leak"}}' \
  | ATOAXIS_CAPTURE="$CAPTURE" WAKACLOCK_CLI_PATH="$MOCK" "$ROOT/emit-event.sh"
if grep -q 'must not leak' "$CAPTURE"; then
  echo "privacy failure: object-valued metadata reached broker envelope" >&2
  exit 1
fi

printf '%s' '{"entity":"/repo/src/unknown.ts","project_root":"/repo"}' \
  | ATOAXIS_CAPTURE="$CAPTURE" WAKACLOCK_CLI_PATH="$MOCK" "$ROOT/emit-event.sh"
grep -q '"agent":"unknown-agent"' "$CAPTURE"
grep -q '"source":"ide_telemetry"' "$CAPTURE"
grep -q '"confidence":"unknown"' "$CAPTURE"

# A legacy adapter may provide an event ID that accidentally contains a path.  The
# shared boundary must keep the ID stable while removing that path from the wire value.
printf '%s' '{"client_id":"codex","event_id":"session:src/raw.ts:1","entity":"/repo/src/raw.ts","project_root":"/repo"}' \
  | ATOAXIS_CAPTURE="$CAPTURE" WAKACLOCK_CLI_PATH="$MOCK" "$ROOT/emit-event.sh"
if jq -e '.event_id | contains("src/raw.ts")' "$CAPTURE" >/dev/null; then
  echo "privacy failure: path-bearing event_id reached broker" >&2
  exit 1
fi
FIRST_OPAQUE_ID="$(jq -r '.event_id' "$CAPTURE")"
printf '%s' '{"client_id":"codex","event_id":"prompt:shared-call","entity":"/repo/src/other.ts","project_root":"/repo"}' \
  | ATOAXIS_CAPTURE="$CAPTURE" WAKACLOCK_CLI_PATH="$MOCK" "$ROOT/emit-event.sh"
SECOND_OPAQUE_ID="$(jq -r '.event_id' "$CAPTURE")"
if [ "$FIRST_OPAQUE_ID" = "$SECOND_OPAQUE_ID" ]; then
  echo "identity failure: malformed multi-file IDs collided" >&2
  exit 1
fi
echo "common emitter ok"
