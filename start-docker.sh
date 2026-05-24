#!/bin/bash

# =============================================================================
# PlayField - Sport Complex Booking Platform
# Docker Infrastructure Management Script
# =============================================================================
# Usage: ./start-docker.sh [options]
# 
# Options:
#   start, up          Start infrastructure services (default)
#   stop, down         Stop infrastructure services
#   restart            Restart infrastructure services
#   status             Check service status
#   logs               View service logs
#   --help, -h         Show this help message
#
# Examples:
#   ./start-docker.sh              Start all infrastructure services
#   ./start-docker.sh stop         Stop all infrastructure services
#   ./start-docker.sh restart      Restart all services
#   ./start-docker.sh status       Check service status
#   ./start-docker.sh logs         View logs
#
# Services started:
#   - ClickHouse (Analytics DB)    Port: 8123, 9000
#   - ClickHouse UI                Port: 5521
#   - Qdrant (Vector Search)       Port: 6333
#   - Redis (Cache)                Port: 6379
#   - RabbitMQ (Message Queue)     Port: 5672, 15672
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
DOCKER_COMPOSE_FILE="docker-compose.dev.yaml"

# =============================================================================
# Helper Functions
# =============================================================================

print_banner() {
    echo -e "${BLUE}"
    echo "╔═══════════════════════════════════════════════════════════════╗"
    echo "║                                                               ║"
    echo "║                    🏟️  PLAYFIELD PLATFORM                     ║"
    echo "║          Docker Infrastructure Management                     ║"
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

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
check_prerequisites() {
    print_header "Checking Prerequisites"
    
    local missing=()
    
    if ! command_exists docker; then
        missing+=("docker")
    fi
    
    if ! command_exists docker-compose; then
        missing+=("docker-compose")
    fi
    
    if [ ${#missing[@]} -ne 0 ]; then
        print_error "Missing prerequisites: ${missing[*]}"
        echo ""
        echo "Please install the following:"
        echo "  - Docker: https://docs.docker.com/get-docker/"
        exit 1
    fi
    
    print_success "All prerequisites found"
}

# Start Docker infrastructure
start_services() {
    print_header "Starting Infrastructure Services"
    
    if [ ! -f "$DOCKER_COMPOSE_FILE" ]; then
        print_error "Docker compose file not found: $DOCKER_COMPOSE_FILE"
        exit 1
    fi
    
    print_info "Starting ClickHouse, Qdrant, Redis, RabbitMQ..."
    docker-compose -f "$DOCKER_COMPOSE_FILE" up -d
    
    # Wait for services to be ready
    print_info "Waiting for services to be ready..."
    sleep 5
    
    # Check if services are healthy
    local retries=30
    local count=0
    
    while [ $count -lt $retries ]; do
        if docker-compose -f "$DOCKER_COMPOSE_FILE" ps | grep -q "healthy\|Up"; then
            break
        fi
        count=$((count + 1))
        sleep 1
    done
    
    if [ $count -eq $retries ]; then
        print_warning "Some services may not be ready yet"
    else
        print_success "Infrastructure services started"
    fi
    
    echo ""
    print_header "Service URLs"
    echo ""
    echo -e "${GREEN}Analytics & Database:${NC}"
    echo "  - ClickHouse:       http://localhost:8123"
    echo "  - ClickHouse UI:    http://localhost:5521"
    echo ""
    echo -e "${GREEN}Search & Cache:${NC}"
    echo "  - Qdrant:           http://localhost:6333"
    echo "  - Redis:            localhost:6379"
    echo ""
    echo -e "${GREEN}Messaging:${NC}"
    echo "  - RabbitMQ Mgmt:    http://localhost:15672"
    echo "    User: guest / Pass: guest"
    echo ""
}

# Stop Docker infrastructure
stop_services() {
    print_header "Stopping Infrastructure Services"
    
    if [ ! -f "$DOCKER_COMPOSE_FILE" ]; then
        print_error "Docker compose file not found: $DOCKER_COMPOSE_FILE"
        exit 1
    fi
    
    docker-compose -f "$DOCKER_COMPOSE_FILE" down
    print_success "Infrastructure services stopped"
}

# Restart services
restart_services() {
    print_header "Restarting Infrastructure Services"
    stop_services
    echo ""
    start_services
}

# Check service status
check_status() {
    print_header "Service Status"
    
    if [ ! -f "$DOCKER_COMPOSE_FILE" ]; then
        print_error "Docker compose file not found: $DOCKER_COMPOSE_FILE"
        exit 1
    fi
    
    docker-compose -f "$DOCKER_COMPOSE_FILE" ps
    
    echo ""
    print_header "Port Status"
    echo ""
    
    local services=(
        "8123:ClickHouse HTTP"
        "9000:ClickHouse Native"
        "5521:ClickHouse UI"
        "6333:Qdrant"
        "6379:Redis"
        "5672:RabbitMQ"
        "15672:RabbitMQ Management"
    )
    
    for service in "${services[@]}"; do
        IFS=':' read -r port name <<< "$service"
        if lsof -Pi :"$port" -sTCP:LISTEN -t >/dev/null 2>&1; then
            echo -e "${GREEN}●${NC} Port $port - $name: Running"
        else
            echo -e "${RED}●${NC} Port $port - $name: Not running"
        fi
    done
    echo ""
}

# View logs
view_logs() {
    print_header "Service Logs"
    
    if [ ! -f "$DOCKER_COMPOSE_FILE" ]; then
        print_error "Docker compose file not found: $DOCKER_COMPOSE_FILE"
        exit 1
    fi
    
    docker-compose -f "$DOCKER_COMPOSE_FILE" logs -f
}

# Show help
show_help() {
    echo "PlayField - Sport Complex Booking Platform"
    echo "Docker Infrastructure Management"
    echo ""
    echo "Usage: ./start-docker.sh [command]"
    echo ""
    echo "Commands:"
    echo "  start, up          Start infrastructure services (default)"
    echo "  stop, down         Stop infrastructure services"
    echo "  restart            Restart infrastructure services"
    echo "  status             Check service status"
    echo "  logs               View service logs"
    echo "  --help, -h         Show this help message"
    echo ""
    echo "Examples:"
    echo "  ./start-docker.sh              Start all infrastructure services"
    echo "  ./start-docker.sh stop         Stop all infrastructure services"
    echo "  ./start-docker.sh restart      Restart all services"
    echo "  ./start-docker.sh status       Check service status"
    echo "  ./start-docker.sh logs         View logs"
    echo ""
    echo "Services:"
    echo "  - ClickHouse (Analytics DB)    Port: 8123, 9000"
    echo "  - ClickHouse UI                Port: 5521"
    echo "  - Qdrant (Vector Search)       Port: 6333"
    echo "  - Redis (Cache)                Port: 6379"
    echo "  - RabbitMQ (Message Queue)     Port: 5672, 15672"
    echo ""
    echo "For application development:"
    echo "  ./start.sh                     Start apps (no Docker)"
    echo "  ./start.sh --with-docker       Start apps + Docker"
}

# =============================================================================
# Main Script
# =============================================================================

main() {
    print_banner
    
    # Parse arguments
    local command="${1:-start}"
    
    case "$command" in
        --help|-h)
            show_help
            exit 0
            ;;
        start|up)
            check_prerequisites
            start_services
            ;;
        stop|down)
            check_prerequisites
            stop_services
            ;;
        restart)
            check_prerequisites
            restart_services
            ;;
        status)
            check_prerequisites
            check_status
            ;;
        logs)
            check_prerequisites
            view_logs
            ;;
        *)
            print_error "Unknown command: $command"
            show_help
            exit 1
            ;;
    esac
}

# Run main function
main "$@"
