#!/bin/bash

# ClickHouse Migration Runner Script
# Usage: ./run_migration.sh [up|down] [migration_number]

set -e

# Resolve ClickHouse CLI command (supports both `clickhouse-client` and `clickhouse client`)
if [ -n "$CLICKHOUSE_CMD" ]; then
    CLICKHOUSE_COMMAND=($CLICKHOUSE_CMD)
elif command -v clickhouse-client >/dev/null 2>&1; then
    CLICKHOUSE_COMMAND=("clickhouse-client")
elif command -v clickhouse >/dev/null 2>&1; then
    CLICKHOUSE_COMMAND=("clickhouse" "client")
else
    echo "[ERROR] clickhouse-client not found. Install ClickHouse or set CLICKHOUSE_CMD pointing to the client binary." >&2
    exit 1
fi

# Configuration
CLICKHOUSE_HOST="${CLICKHOUSE_HOST:-localhost}"
CLICKHOUSE_PORT="${CLICKHOUSE_PORT:-9000}"
CLICKHOUSE_USER="${CLICKHOUSE_USER:-default}"
CLICKHOUSE_PASSWORD="${CLICKHOUSE_PASSWORD:-default}"
CLICKHOUSE_DATABASE="${CLICKHOUSE_DATABASE:-ecommerce}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Function to execute SQL file
execute_sql_file() {
    local file=$1
    print_info "Executing migration: $file"

    cat "$file" | "${CLICKHOUSE_COMMAND[@]}" \
        --host="$CLICKHOUSE_HOST" \
        --port="$CLICKHOUSE_PORT" \
        --user="$CLICKHOUSE_USER" \
        --password="$CLICKHOUSE_PASSWORD" \
        --database="$CLICKHOUSE_DATABASE" \
        --multiquery

    if [ $? -eq 0 ]; then
        print_info "Migration executed successfully: $file"
        return 0
    else
        print_error "Failed to execute migration: $file"
        return 1
    fi
}

# Function to create migrations tracking table
create_migrations_table() {
    print_info "Creating migrations tracking table if not exists..."

    "${CLICKHOUSE_COMMAND[@]}" \
        --host="$CLICKHOUSE_HOST" \
        --port="$CLICKHOUSE_PORT" \
        --user="$CLICKHOUSE_USER" \
        --password="$CLICKHOUSE_PASSWORD" \
        --database="$CLICKHOUSE_DATABASE" \
        --query="
        CREATE TABLE IF NOT EXISTS schema_migrations (
            migration_id String,
            migration_name String,
            applied_at DateTime DEFAULT now(),
            rollback_at Nullable(DateTime),
            status String DEFAULT 'applied'
        ) ENGINE = MergeTree()
        ORDER BY applied_at
        SETTINGS index_granularity = 8192"

    print_info "Migrations tracking table ready"
}

# Function to check if migration was already applied
is_migration_applied() {
    local migration_id=$1

    local count=$("${CLICKHOUSE_COMMAND[@]}" \
        --host="$CLICKHOUSE_HOST" \
        --port="$CLICKHOUSE_PORT" \
        --user="$CLICKHOUSE_USER" \
        --password="$CLICKHOUSE_PASSWORD" \
        --database="$CLICKHOUSE_DATABASE" \
        --query="SELECT count() FROM schema_migrations WHERE migration_id = '$migration_id' AND status = 'applied'" \
        2>/dev/null)

    if [ "$count" -gt 0 ]; then
        return 0
    else
        return 1
    fi
}

# Function to record migration
record_migration() {
    local migration_id=$1
    local migration_name=$2
    local status=$3

    if [ "$status" = "applied" ]; then
        "${CLICKHOUSE_COMMAND[@]}" \
            --host="$CLICKHOUSE_HOST" \
            --port="$CLICKHOUSE_PORT" \
            --user="$CLICKHOUSE_USER" \
            --password="$CLICKHOUSE_PASSWORD" \
            --database="$CLICKHOUSE_DATABASE" \
            --query="INSERT INTO schema_migrations (migration_id, migration_name, status) VALUES ('$migration_id', '$migration_name', 'applied')"
    else
        "${CLICKHOUSE_COMMAND[@]}" \
            --host="$CLICKHOUSE_HOST" \
            --port="$CLICKHOUSE_PORT" \
            --user="$CLICKHOUSE_USER" \
            --password="$CLICKHOUSE_PASSWORD" \
            --database="$CLICKHOUSE_DATABASE" \
            --query="UPDATE schema_migrations SET status = 'rolled_back', rollback_at = now() WHERE migration_id = '$migration_id'"
    fi
}

# Function to run migration up
run_migration_up() {
    local migration_number=$1
    local migration_file=""
    local migration_name=""

    if [ -z "$migration_number" ]; then
        # Run all pending migrations
        for file in $(ls -1 *.sql | grep -v rollback | sort); do
            migration_number=$(echo $file | cut -d'_' -f1)
            migration_name=$(basename $file .sql)

            if is_migration_applied "$migration_number"; then
                print_warning "Migration $migration_number already applied, skipping..."
                continue
            fi

            execute_sql_file "$file"
            if [ $? -eq 0 ]; then
                record_migration "$migration_number" "$migration_name" "applied"
            else
                print_error "Migration failed, stopping..."
                exit 1
            fi
        done
    else
        # Run specific migration
        migration_file=$(ls ${migration_number}_*.sql 2>/dev/null | grep -v rollback | head -n1)

        if [ -z "$migration_file" ] || [ ! -f "$migration_file" ]; then
            print_error "Migration file not found for id ${migration_number}"
            exit 1
        fi

        migration_name=$(basename $migration_file .sql)

        if is_migration_applied "$migration_number"; then
            print_warning "Migration $migration_number already applied"
            exit 0
        fi

        execute_sql_file "$migration_file"
        if [ $? -eq 0 ]; then
            record_migration "$migration_number" "$migration_name" "applied"
        else
            exit 1
        fi
    fi
}

# Function to run migration down (rollback)
run_migration_down() {
    local migration_number=$1

    if [ -z "$migration_number" ]; then
        print_error "Migration number required for rollback"
        exit 1
    fi

    local rollback_file=$(ls ${migration_number}_*_rollback.sql 2>/dev/null | head -n1)

    if [ -z "$rollback_file" ] || [ ! -f "$rollback_file" ]; then
        print_error "Rollback file not found for id ${migration_number}"
        exit 1
    fi

    if ! is_migration_applied "$migration_number"; then
        print_warning "Migration $migration_number not applied, nothing to rollback"
        exit 0
    fi

    execute_sql_file "$rollback_file"
    if [ $? -eq 0 ]; then
        record_migration "$migration_number" "" "rolled_back"
    else
        exit 1
    fi
}

# Function to show migration status
show_status() {
    print_info "Applied migrations:"

    "${CLICKHOUSE_COMMAND[@]}" \
        --host="$CLICKHOUSE_HOST" \
        --port="$CLICKHOUSE_PORT" \
        --user="$CLICKHOUSE_USER" \
        --password="$CLICKHOUSE_PASSWORD" \
        --database="$CLICKHOUSE_DATABASE" \
        --query="SELECT migration_id, migration_name, applied_at, status FROM schema_migrations ORDER BY applied_at FORMAT Pretty"
}

# Main script
main() {
    local command=$1
    local migration_number=$2

    # Change to migration directory
    cd "$(dirname "$0")"

    # Create migrations table if not exists
    create_migrations_table

    case "$command" in
        up)
            print_info "Running migration up..."
            run_migration_up "$migration_number"
            print_info "Migration up completed"
            ;;
        down)
            print_info "Running migration down..."
            run_migration_down "$migration_number"
            print_info "Migration down completed"
            ;;
        status)
            show_status
            ;;
        *)
            echo "Usage: $0 [up|down|status] [migration_number]"
            echo ""
            echo "Commands:"
            echo "  up [number]    - Run migration up (all pending or specific)"
            echo "  down number    - Rollback specific migration"
            echo "  status         - Show migration status"
            echo ""
            echo "Examples:"
            echo "  $0 up          - Run all pending migrations"
            echo "  $0 up 001      - Run specific migration 001"
            echo "  $0 down 001    - Rollback migration 001"
            echo "  $0 status      - Show applied migrations"
            exit 1
            ;;
    esac
}

# Run main function
main "$@"
