#!/usr/bin/env bash
# Run ignored wakaclock-server suites that refuse every PostgreSQL database except
# their own dedicated one (for example atoaxis_team_test).
#
# The database is dropped and recreated before each suite, so rows one suite leaves
# behind cannot change another suite's result. Background ticks such as Team cleanup
# scan every organization in the database. A prefix that matches no test is an error,
# so a renamed module cannot silently stop running.
#
# Run from backend/api (the Cargo workspace root):
#   POSTGRES_TEST_BASE_URL=postgres://user:password@127.0.0.1:5432 \
#   PGHOST=127.0.0.1 PGUSER=user PGPASSWORD=password \
#     ../../scripts/ci-dedicated-db-tests.sh <database> "<prefix> <prefix> ..." [libtest args...]
#
# Prefixes are test paths such as `repository::team_trial::`. Disposable test databases only.
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "usage: $0 <database> \"<test path prefix> ...\" [extra libtest args...]" >&2
  exit 2
fi
database=$1
prefixes=$2
shift 2
: "${POSTGRES_TEST_BASE_URL:?set to postgres://user:password@host:port, without a database}"

case "$database" in
  atoaxis_*_test) ;;
  *)
    echo "refusing to recreate '$database': only atoaxis_*_test databases are disposable" >&2
    exit 2
    ;;
esac

log=$(mktemp)
trap 'rm -f "$log"' EXIT
for prefix in $prefixes; do
  echo "::group::$prefix on fresh $database"
  dropdb --if-exists --force "$database"
  createdb "$database"
  POSTGRES_TEST_URL="$POSTGRES_TEST_BASE_URL/$database" \
    cargo test -p wakaclock-server --lib -- --ignored --test-threads=1 "$prefix" "$@" | tee "$log"
  echo "::endgroup::"
  if ! grep -Eq '^test result: ok\. [1-9][0-9]* passed' "$log"; then
    echo "::error::$prefix matched no ignored test; update the suite list in ci.yml" >&2
    exit 1
  fi
done
