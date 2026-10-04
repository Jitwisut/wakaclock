#!/usr/bin/env sh
# AtoAxis terminal-only bootstrap installer.
#
# The release host can be overridden for self-hosted deployments. The script is
# intentionally idempotent: it installs one binary, snapshots the existing local
# SQLite state, removes any legacy per-user broker registration, and records explicit
# hook consent before any agent configuration can be touched. No prompts, source
# code, or tool arguments are collected by this installer.
set -eu

VERSION="${WAKACLOCK_VERSION:-latest}"
PREFIX="${WAKACLOCK_PREFIX:-${HOME}/.local/bin}"
RELEASE_BASE="${WAKACLOCK_RELEASE_BASE_URL:-https://get.atoaxis.com/releases}"
case "$(uname -s)" in
  Darwin) OS_TAG="darwin" ;;
  Linux) OS_TAG="linux" ;;
  *) echo "wakaclock installer: unsupported operating system" >&2; exit 2 ;;
esac
case "$(uname -m)" in
  x86_64|amd64) ARCH_TAG="x86_64" ;;
  arm64|aarch64) ARCH_TAG="arm64" ;;
  *) echo "wakaclock installer: unsupported architecture $(uname -m)" >&2; exit 2 ;;
esac
ARCHIVE_URL="${WAKACLOCK_ARCHIVE_URL:-${RELEASE_BASE}/wakaclock-${VERSION}-${OS_TAG}-${ARCH_TAG}.tar.gz}"
BINARY_OVERRIDE="${WAKACLOCK_BINARY:-}"
SETUP_YES="${WAKACLOCK_SETUP_YES:-0}"

TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/wakaclock-install.XXXXXX")"
trap 'rm -rf "$TMP_DIR"' EXIT HUP INT TERM
mkdir -p "$PREFIX"

if [ -n "$BINARY_OVERRIDE" ]; then
  [ -f "$BINARY_OVERRIDE" ] || { echo "WAKACLOCK_BINARY is not a file" >&2; exit 2; }
  cp "$BINARY_OVERRIDE" "$TMP_DIR/wakaclock"
else
  ARCHIVE="$TMP_DIR/wakaclock.tar.gz"
  curl --fail --silent --show-error --location "$ARCHIVE_URL" --output "$ARCHIVE"
  if [ -n "${WAKACLOCK_SHA256:-}" ]; then
    if command -v shasum >/dev/null 2>&1; then
      printf '%s  %s\n' "$WAKACLOCK_SHA256" "$ARCHIVE" | shasum -a 256 -c -
    elif command -v sha256sum >/dev/null 2>&1; then
      printf '%s  %s\n' "$WAKACLOCK_SHA256" "$ARCHIVE" | sha256sum -c -
    else
      echo "WAKACLOCK_SHA256 was supplied but no SHA-256 verifier is installed" >&2
      exit 2
    fi
  fi
  tar -xzf "$ARCHIVE" -C "$TMP_DIR"
  if [ -f "$TMP_DIR/wakaclock" ]; then
    :
  else
    FOUND="$(find "$TMP_DIR" -type f -name wakaclock -perm -111 -print -quit)"
    [ -n "$FOUND" ] || { echo "release archive does not contain wakaclock" >&2; exit 1; }
    cp "$FOUND" "$TMP_DIR/wakaclock"
  fi
  if [ -d "$TMP_DIR/resources/ai-agents" ]; then
    :
  else
    echo "release archive does not contain resources/ai-agents" >&2
    exit 1
  fi
fi

chmod 0755 "$TMP_DIR/wakaclock"

# Take an SQLite-consistent snapshot when the system sqlite3 utility is present.
# The fallback copies WAL/SHM sidecars together for older hosts without sqlite3;
# either path is performed only after the legacy service cleanup boundary below.
snapshot_sqlite() {
  SOURCE_DB="$1"
  TARGET_DB="$2"
  if command -v sqlite3 >/dev/null 2>&1; then
    ESCAPED_TARGET="$(printf '%s' "$TARGET_DB" | sed "s/'/''/g")"
    sqlite3 "$SOURCE_DB" ".timeout 5000" ".backup '$ESCAPED_TARGET'"
  else
    cp "$SOURCE_DB" "$TARGET_DB"
    [ ! -f "${SOURCE_DB}-wal" ] || cp "${SOURCE_DB}-wal" "${TARGET_DB}-wal"
    [ ! -f "${SOURCE_DB}-shm" ] || cp "${SOURCE_DB}-shm" "${TARGET_DB}-shm"
  fi
}

# Migration boundary: stop/remove the old service before replacing its executable,
# then preserve every SQLite sidecar (including WAL/SHM files) in a timestamped,
# user-owned snapshot. A failed copy aborts the installation before the old binary
# is overwritten, so accepted local events remain recoverable.
MIGRATION_SNAPSHOT="${HOME}/.wakaclock/migrations/$(date -u '+%Y%m%dT%H%M%SZ')-pre-on-demand"
case "$(uname -s)" in
  Darwin) LEGACY_MANIFEST="$HOME/Library/LaunchAgents/com.atoaxis.wakaclock.agent.plist" ;;
  Linux) LEGACY_MANIFEST="$HOME/.config/systemd/user/atoaxis-wakaclock-agent.service" ;;
  *) LEGACY_MANIFEST="$HOME/.wakaclock/agent-task.txt" ;;
esac
if [ -x "$PREFIX/wakaclock" ] || [ -f "$HOME/.wakaclock/broker.json" ] || [ -f "$LEGACY_MANIFEST" ]; then
  if ! "$TMP_DIR/wakaclock" broker uninstall --json >/dev/null 2>&1; then
    echo "wakaclock installer: could not remove the legacy service; existing binary and queue were left untouched" >&2
    exit 1
  fi
  mkdir -p "$MIGRATION_SNAPSHOT"
  for DB in \
    "$HOME/.wakaclock/queue.db" \
    "$HOME/.wakaclock/broker.db" \
    "$HOME/.wakaclock/broker.sqlite" \
    "$HOME/.wakaclock/broker.sqlite3" \
    "$HOME/.wakaclock/ai-attribution.sqlite3"
  do
    if [ -f "$DB" ]; then
      snapshot_sqlite "$DB" "$MIGRATION_SNAPSHOT/$(basename "$DB")"
    fi
  done
  for STATE in \
    "$HOME/.wakaclock/ai-events.cursor.json" \
    "$HOME/.wakaclock/ai-pipeline.json" \
    "$HOME/.wakaclock/ai-sessions.json"
  do
    if [ -f "$STATE" ]; then
      cp "$STATE" "$MIGRATION_SNAPSHOT/$(basename "$STATE")"
    fi
  done
fi
install -m 0755 "$TMP_DIR/wakaclock" "$PREFIX/wakaclock"
if [ -d "$TMP_DIR/resources/ai-agents" ]; then
  mkdir -p "$PREFIX/resources"
  rm -rf "$PREFIX/resources/ai-agents.new"
  cp -R "$TMP_DIR/resources/ai-agents" "$PREFIX/resources/ai-agents.new"
  rm -rf "$PREFIX/resources/ai-agents"
  mv "$PREFIX/resources/ai-agents.new" "$PREFIX/resources/ai-agents"
fi

# Adapter hooks use bounded, on-demand CLI invocations.  Installation deliberately
# does not register a LaunchAgent, systemd unit, scheduled task, local HTTP broker,
# or any other long-lived collector.
if [ "$SETUP_YES" = "1" ]; then
  "$PREFIX/wakaclock" ai setup --all --yes --json >/dev/null
else
  "$PREFIX/wakaclock" ai setup --all --json >/dev/null || true
fi

echo "wakaclock installed at $PREFIX/wakaclock"
if [ -d "${MIGRATION_SNAPSHOT:-}" ]; then
  echo "SQLite migration snapshot: $MIGRATION_SNAPSHOT"
fi
echo "Run WAKACLOCK_SETUP_YES=1 sh install.sh to consent to local adapter setup."
