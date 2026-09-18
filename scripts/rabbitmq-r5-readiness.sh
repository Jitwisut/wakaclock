#!/usr/bin/env bash
#
# Start the real API and R5 worker binaries long enough to verify /live and /ready.
# The domain acceptance runner is intentionally separate: this script proves
# process/readiness wiring without allowing production-topology workers to consume
# the UUID-namespaced acceptance jobs.

set -Eeuo pipefail

worktree_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
backend_dir="$worktree_dir/backend/api"
log_dir="$(mktemp -d "${TMPDIR:-/tmp}/wakaclock-r5-readiness.XXXXXX")"
worker_pids=()

cleanup() {
    local exit_code=$?
    trap - EXIT INT TERM
    if ((${#worker_pids[@]} > 0)); then
        for pid in "${worker_pids[@]}"; do
            kill "$pid" 2>/dev/null || true
        done
        for pid in "${worker_pids[@]}"; do
            wait "$pid" 2>/dev/null || true
        done
    fi
    if [[ "$exit_code" -ne 0 ]]; then
        for log_file in "$log_dir"/*.log; do
            [[ -f "$log_file" ]] || continue
            tail -80 "$log_file" >&2 || true
        done
    fi
    exit "$exit_code"
}
trap cleanup EXIT INT TERM

export ALLOW_INSECURE_JWT_SECRET=1
export JWT_SECRET="${R5_READINESS_JWT_SECRET:-r5-readiness-only-secret}"
export CORS_ORIGINS="${R5_READINESS_CORS_ORIGINS:-http://localhost:3000}"
export POSTGRES_URL="${R5_READINESS_POSTGRES_URL:-postgres://atoaxis:atoaxis-test@localhost:25432/atoaxis_k0}"
export CLICKHOUSE_URL="${R5_READINESS_CLICKHOUSE_URL:-http://localhost:28123}"
export CLICKHOUSE_DB=wakaclock
export CLICKHOUSE_USER=default
export CLICKHOUSE_PASSWORD=default
export REDIS_URL="${R5_READINESS_REDIS_URL:-redis://127.0.0.1:26379}"
export ATOAXIS_JOB_QUEUE_URL="${R5_READINESS_RABBITMQ_URL:-amqp://atoaxis:atoaxis-test@localhost:25673/%2f}"
export ATOAXIS_PROJECTION_REBUILD_MODE=job
export ATOAXIS_EXPORT_MODE=job
export ATOAXIS_ACCOUNT_DELETION_MODE=job
export ATOAXIS_INGEST_MODE=direct
export ATOAXIS_AI_USAGE_INGEST_MODE=direct
export ATOAXIS_REPROCESS_MODE=sync
export PRESENCE_V2_ENABLED=true
export ATOAXIS_OBJECT_STORE_S3_ENDPOINT="${R5_READINESS_OBJECT_STORE_ENDPOINT:-http://127.0.0.1:29000}"
export ATOAXIS_OBJECT_STORE_S3_BUCKET="${R5_READINESS_OBJECT_STORE_BUCKET:-wakaclock-r5-acceptance}"
export ATOAXIS_OBJECT_STORE_S3_REGION=us-east-1
export ATOAXIS_OBJECT_STORE_S3_ACCESS_KEY=atoaxis
export ATOAXIS_OBJECT_STORE_S3_SECRET_KEY=atoaxis-test
export ATOAXIS_OBJECT_STORE_S3_PATH_STYLE=true
export ATOAXIS_OBJECT_STORE_ALLOW_HTTP=true

export SERVER_HOST=127.0.0.1
export SERVER_PORT="${R5_READINESS_API_PORT:-28080}"
export ATOAXIS_METRICS_HOST=127.0.0.1
export ATOAXIS_METRICS_PORT="${R5_READINESS_METRICS_PORT:-28090}"
export PROJECTION_WORKER_HEALTH_HOST=127.0.0.1
export PROJECTION_WORKER_HEALTH_PORT="${R5_READINESS_PROJECTION_PORT:-28086}"
export EXPORT_WORKER_HEALTH_HOST=127.0.0.1
export EXPORT_WORKER_HEALTH_PORT="${R5_READINESS_EXPORT_PORT:-28082}"
export ACCOUNT_DELETION_WORKER_HEALTH_HOST=127.0.0.1
export ACCOUNT_DELETION_WORKER_HEALTH_PORT="${R5_READINESS_DELETION_PORT:-28087}"

wait_tcp() {
    local name="$1"
    local port="$2"
    for _ in $(seq 1 60); do
        if (exec 3<>"/dev/tcp/127.0.0.1/$port") 2>/dev/null; then
            exec 3>&-
            exec 3<&-
            echo "r5_dependency=$name port=$port"
            return 0
        fi
        sleep 1
    done
    echo "r5_dependency_timeout=$name port=$port" >&2
    return 1
}

wait_tcp postgres "${R5_READINESS_POSTGRES_PORT:-25432}"
wait_tcp clickhouse "${R5_READINESS_CLICKHOUSE_PORT:-28123}"
wait_tcp redis "${R5_READINESS_REDIS_PORT:-26379}"
wait_tcp rabbitmq "${R5_READINESS_RABBITMQ_PORT:-25673}"
wait_tcp minio "${R5_READINESS_MINIO_PORT:-29000}"

cargo build -p wakaclock-server --bins --features kafka --manifest-path "$backend_dir/Cargo.toml"

start_process() {
    local name="$1"
    "$backend_dir/target/debug/$name" >"$log_dir/$name.log" 2>&1 &
    worker_pids+=("$!")
    case "$name" in
        projection-worker) projection_pid="$!" ;;
        export-worker) export_pid="$!" ;;
        account-deletion) deletion_pid="$!" ;;
        wakaclock-server) api_pid="$!" ;;
    esac
}

wait_ready() {
    local name="$1"
    local port="$2"
    local pid="$3"
    local attempts="${4:-60}"
    local log_name="${5:-$name}"
    for _ in $(seq 1 "$attempts"); do
        if ! kill -0 "$pid" 2>/dev/null; then
            echo "r5_process_exited=$name pid=$pid logs=$log_dir" >&2
            tail -80 "$log_dir/$log_name.log" >&2 || true
            return 1
        fi
        if curl --fail --silent "http://127.0.0.1:$port/live" >/dev/null \
            && curl --fail --silent "http://127.0.0.1:$port/ready" >/dev/null; then
            echo "r5_ready=$name port=$port"
            return 0
        fi
        sleep 1
    done
    echo "r5_readiness_timeout=$name port=$port logs=$log_dir" >&2
    return 1
}

start_process projection-worker
wait_ready projection-worker "$PROJECTION_WORKER_HEALTH_PORT" "$projection_pid"

start_process export-worker
wait_ready export-worker "$EXPORT_WORKER_HEALTH_PORT" "$export_pid"

start_process account-deletion
wait_ready account-deletion-worker "$ACCOUNT_DELETION_WORKER_HEALTH_PORT" "$deletion_pid" 180 account-deletion

start_process wakaclock-server
wait_ready api "$SERVER_PORT" "$api_pid" 120
echo "r5_readiness_status=passed"
