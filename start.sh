#!/bin/bash

# =============================================================================
# PlayField - Sport Complex Booking Platform
# Local Development Start Script (No Docker)
# =============================================================================
# Usage: ./start.sh [options]
# 
# Options:
#   --admin              Start admin dashboard only
#   --customer           Start customer app only
#   --owner              Start owner portal only
#   --portal             Start customer portal only
#   --frontend-only      Start all frontend apps only
#   --backend-only       Start backend API only
#   --with-docker        Also start Docker infrastructure
#   --help, -h           Show this help message
#
# Examples:
#   ./start.sh                    Start all apps + backend
#   ./start.sh --admin            Start admin + backend
#   ./start.sh --portal           Start portal + backend
#   ./start.sh --frontend-only    Start all frontends only
#   ./start.sh --backend-only     Start backend only
#
# For Docker infrastructure, use: ./start-docker.sh
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Configuration
BACKEND_DIR="backend/api"
FRONTEND_DIR="frontend"
ADMIN_DIR="$FRONTEND_DIR/admin"
CUSTOMER_DIR="$FRONTEND_DIR/customer"
OWNER_DIR="$FRONTEND_DIR/owner"
PORTAL_DIR="$FRONTEND_DIR/portal"
PORTAL2_DIR="$FRONTEND_DIR/portal2"

# Default ports
ADMIN_PORT=3000
CUSTOMER_PORT=3001
OWNER_PORT=3002
PORTAL_PORT=3003
PORTAL2_PORT=3004
BACKEND_PORT=8080

# Track PIDs for cleanup
PIDS=()

# =============================================================================
# Helper Functions
# =============================================================================

print_banner() {
    echo -e "${BLUE}"
    echo "╔═══════════════════════════════════════════════════════════════╗"
    echo "║                                                               ║"
    echo "║                    🏟️  PLAYFIELD PLATFORM                     ║"
    echo "║          Local Development - No Docker Mode                   ║"
    echo "║                                                               ║"
    echo "╚═══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_header() {
    echo -e "${BOLD}${BLUE}▶ $1${NC}"
}

# Cleanup function
cleanup() {
    echo ""
    print_warning "Shutting down services..."
    
    for pid in "${PIDS[@]}"; do
        if kill -0 "$pid" 2>/dev/null; then
            kill -TERM "$pid" 2>/dev/null || true
        fi
    done
    
    # Give processes time to terminate gracefully
    sleep 2
    
    # Force kill if still running
    for pid in "${PIDS[@]}"; do
        if kill -0 "$pid" 2>/dev/null; then
            kill -KILL "$pid" 2>/dev/null || true
        fi
    done
    
    print_success "Cleanup complete"
    exit 0
}

# Set trap for cleanup
trap cleanup SIGINT SIGTERM EXIT

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites (local dev only - no Docker required)
check_prerequisites() {
    print_header "Checking Prerequisites"
    
    local missing=()
    
    if ! command_exists cargo; then
        missing+=("cargo (Rust)")
    fi
    
    if ! command_exists pnpm; then
        missing+=("pnpm")
    fi
    
    if [ ${#missing[@]} -ne 0 ]; then
        print_error "Missing prerequisites: ${missing[*]}"
        echo ""
        echo "Please install the following:"
        echo "  - Rust: https://rustup.rs/"
        echo "  - pnpm: npm install -g pnpm"
        echo ""
        echo "For Docker infrastructure, use: ./start-docker.sh"
        exit 1
    fi
    
    print_success "All prerequisites found"
}

# Check if port is available
check_port() {
    local port=$1
    local name=$2
    
    if lsof -Pi :"$port" -sTCP:LISTEN -t >/dev/null 2>&1; then
        print_warning "Port $port is already in use ($name)"
        return 1
    fi
    return 0
}

# Start backend
start_backend() {
    print_header "Starting Backend API"
    
    if [ ! -d "$BACKEND_DIR" ]; then
        print_error "Backend directory not found: $BACKEND_DIR"
        exit 1
    fi
    
    check_port $BACKEND_PORT "Backend API" || true
    
    print_info "Building and starting Rust backend..."
    cd "$BACKEND_DIR"
    
    # Check if config exists
    if [ ! -f "config.yaml" ] && [ ! -f "config.yml" ]; then
        print_warning "No config.yaml found. Using default configuration."
        print_info "Create backend/api/config.yaml for custom settings"
    fi
    
    # Start backend in background
    cargo run -- web-service --port $BACKEND_PORT &
    local pid=$!
    PIDS+=($pid)
    cd - > /dev/null
    
    print_success "Backend starting on http://localhost:$BACKEND_PORT"
    print_info "API Documentation: http://localhost:$BACKEND_PORT/scalar"
}

# Start frontend app
start_frontend() {
    local dir=$1
    local name=$2
    local port=$3
    
    if [ ! -d "$dir" ]; then
        print_error "Directory not found: $dir"
        return 1
    fi
    
    if [ ! -f "$dir/package.json" ]; then
        print_error "No package.json found in $dir"
        return 1
    fi
    
    check_port "$port" "$name" || {
        print_warning "Using different port for $name"
    }
    
    print_info "Starting $name on port $port..."
    cd "$dir"
    
    # Check if node_modules exists
    if [ ! -d "node_modules" ]; then
        print_info "Installing dependencies for $name..."
        pnpm install
    fi
    
    # Start dev server
    pnpm dev --port "$port" &
    local pid=$!
    PIDS+=($pid)
    cd - > /dev/null
    
    print_success "$name starting on http://localhost:$port"
}

# Start admin dashboard
start_admin() {
    start_frontend "$ADMIN_DIR" "Admin Dashboard" "$ADMIN_PORT"
}

# Start customer app
start_customer() {
    start_frontend "$CUSTOMER_DIR" "Customer App" "$CUSTOMER_PORT"
}

# Start owner portal
start_owner() {
    start_frontend "$OWNER_DIR" "Owner Portal" "$OWNER_PORT"
}

# Start customer portal
start_portal() {
    start_frontend "$PORTAL_DIR" "Customer Portal" "$PORTAL_PORT"
}

# Start customer portal v2 (shadcn)
start_portal2() {
    start_frontend "$PORTAL2_DIR" "Customer Portal v2 (shadcn)" "$PORTAL2_PORT"
}

# Show help
show_help() {
    echo "PlayField - Sport Complex Booking Platform"
    echo "Local Development Script (No Docker)"
    echo ""
    echo "Usage: ./start.sh [options]"
    echo ""
    echo "Options:"
    echo "  --admin              Start admin dashboard + backend"
    echo "  --customer           Start customer app + backend"
    echo "  --owner              Start owner portal + backend"
    echo "  --portal             Start customer portal + backend"
    echo "  --portal2            Start customer portal v2 only (frontend only)"
    echo "  --frontend-only      Start all frontend apps only (no backend)"
    echo "  --backend-only       Start backend API only"
    echo "  --with-docker        Also start Docker infrastructure"
    echo "  --help, -h           Show this help message"
    echo ""
    echo "Examples:"
    echo "  ./start.sh                    Start all apps + backend"
    echo "  ./start.sh --admin            Start admin + backend"
    echo "  ./start.sh --portal           Start portal + backend"
    echo "  ./start.sh --frontend-only    Start all frontends only"
    echo "  ./start.sh --backend-only     Start backend only"
    echo ""
    echo "For Docker infrastructure:"
    echo "  ./start-docker.sh             Start infrastructure services"
    echo "  ./start-docker.sh --stop      Stop infrastructure services"
    echo ""
    echo "Default URLs when all services are running:"
    echo "  Admin Dashboard:  http://localhost:3000"
    echo "  Customer App:     http://localhost:3001"
    echo "  Owner Portal:     http://localhost:3002"
    echo "  Customer Portal:  http://localhost:3003"
    echo "  Customer Portal2: http://localhost:3004 (frontend only)"
    echo "  Backend API:      http://localhost:8080"
}

# Print service status
print_status() {
    sleep 3
    echo ""
    print_header "Service Status"
    echo ""
    
    if lsof -Pi :$ADMIN_PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${GREEN}●${NC} Admin Dashboard: http://localhost:$ADMIN_PORT"
    fi
    
    if lsof -Pi :$CUSTOMER_PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${GREEN}●${NC} Customer App:    http://localhost:$CUSTOMER_PORT"
    fi
    
    if lsof -Pi :$OWNER_PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${GREEN}●${NC} Owner Portal:    http://localhost:$OWNER_PORT"
    fi
    
    if lsof -Pi :$PORTAL_PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${GREEN}●${NC} Customer Portal: http://localhost:$PORTAL_PORT"
    fi
    
    if lsof -Pi :$PORTAL2_PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${GREEN}●${NC} Customer Portal2: http://localhost:$PORTAL2_PORT"
    fi
    
    if lsof -Pi :$BACKEND_PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${GREEN}●${NC} Backend API:     http://localhost:$BACKEND_PORT"
        echo -e "${GREEN}●${NC} API Docs:        http://localhost:$BACKEND_PORT/scalar"
    fi
    
    echo ""
    print_info "Press Ctrl+C to stop all services"
    echo ""
}

# =============================================================================
# Main Script
# =============================================================================

main() {
    print_banner
    
    # Parse arguments
    local start_backend=false
    local start_admin=false
    local start_customer=false
    local start_owner=false
    local start_portal=false
    local start_portal2=false
    local with_docker=false
    
    if [ $# -eq 0 ]; then
        # No arguments - start everything
        start_backend=true
        start_admin=true
        start_customer=true
        start_owner=true
        start_portal=true
        start_portal2=true
    else
        case "$1" in
            --help|-h)
                show_help
                exit 0
                ;;
            --admin)
                start_backend=true
                start_admin=true
                ;;
            --customer)
                start_backend=true
                start_customer=true
                ;;
            --owner)
                start_backend=true
                start_owner=true
                ;;
            --portal)
                start_backend=true
                start_portal=true
                ;;
            --portal2)
                # Portal2 starts without backend for faster development
                start_portal2=true
                ;;
            --frontend-only)
                start_admin=true
                start_customer=true
                start_owner=true
                start_portal=true
                start_portal2=true
                ;;
            --backend-only)
                start_backend=true
                ;;
            --with-docker)
                with_docker=true
                start_backend=true
                start_admin=true
                start_customer=true
                start_owner=true
                start_portal=true
                start_portal2=true
                ;;
            *)
                print_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    fi
    
    # Check prerequisites
    check_prerequisites
    
    # Check if Docker infrastructure is needed
    if [ "$with_docker" = true ]; then
        if command_exists docker-compose; then
            print_header "Starting Docker Infrastructure"
            print_info "Run './start-docker.sh' for more infrastructure options"
            docker-compose -f docker-compose.dev.yaml up -d
            print_info "Waiting for services to be ready..."
            sleep 5
        else
            print_warning "Docker not found. Skipping infrastructure services."
            print_info "Install Docker or use './start-docker.sh' separately"
        fi
    fi
    
    # Start services
    if [ "$start_backend" = true ]; then
        start_backend
    fi
    
    if [ "$start_admin" = true ]; then
        start_admin
    fi
    
    if [ "$start_customer" = true ]; then
        start_customer
    fi
    
    if [ "$start_owner" = true ]; then
        start_owner
    fi
    
    if [ "$start_portal" = true ]; then
        start_portal
    fi
    
    if [ "$start_portal2" = true ]; then
        start_portal2
    fi
    
    # Print status
    print_status
    
    # Keep script running
    wait
}

# Run main function
main "$@"
