#!/usr/bin/env sh
# AtoAxis terminal bootstrap installer. Repeatable and consent-gated.
set -eu

VERSION=${WAKACLOCK_VERSION:-latest}
PREFIX=${WAKACLOCK_PREFIX:-${HOME}/.local/bin}
RELEASE_BASE=${WAKACLOCK_RELEASE_BASE_URL:-https://get.atoaxis.com/releases}
ARCHIVE_URL=${WAKACLOCK_ARCHIVE_URL:-${RELEASE_BASE}/wakaclock-${VERSION}-$(uname -s | tr '[:upper:]' '[:lower:]')-$(uname -m).tar.gz}
BINARY_OVERRIDE=${WAKACLOCK_BINARY:-}
SETUP_YES=${WAKACLOCK_SETUP_YES:-0}

case "$(uname -s)" in
  Darwin|Linux) ;;
  *) echo "wakaclock installer: unsupported operating system" >&2; exit 2 ;;
esac

TMP_DIR=$(mktemp -d "${TMPDIR:-/tmp}/wakaclock-install.XXXXXX")
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
  if [ ! -f "$TMP_DIR/wakaclock" ]; then
    FOUND=$(find "$TMP_DIR" -type f -name wakaclock -perm -111 -print -quit)
    [ -n "$FOUND" ] || { echo "release archive does not contain wakaclock" >&2; exit 1; }
    cp "$FOUND" "$TMP_DIR/wakaclock"
  fi
fi

chmod 0755 "$TMP_DIR/wakaclock"
install -m 0755 "$TMP_DIR/wakaclock" "$PREFIX/wakaclock"

# Only the AtoAxis-owned watcher service is reconciled. Adapter setup requires
# explicit consent via WAKACLOCK_SETUP_YES=1.
"$PREFIX/wakaclock" agent install --json >/dev/null
if [ "$SETUP_YES" = "1" ]; then
  "$PREFIX/wakaclock" ai setup --all --yes --json >/dev/null
else
  "$PREFIX/wakaclock" ai setup --all --json >/dev/null || true
fi

echo "wakaclock installed at $PREFIX/wakaclock"
echo "Run WAKACLOCK_SETUP_YES=1 sh install.sh to consent to local adapter setup."
