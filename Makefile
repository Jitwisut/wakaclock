# Multi-Shop eCommerce Connector - Makefile
# Comprehensive build, test, and deployment automation

# Variables
DOCKER_COMPOSE = docker-compose
CARGO = cargo
NPM = npm
PNPM = pnpm
BACKEND_DIR = backend/api
FRONTEND_DIR = frontend
MIGRATION_DIR = $(BACKEND_DIR)/migrations
REDIS_CLI = redis-cli
CLICKHOUSE_CLIENT = clickhouse-client
CADDY_FILE = Caddyfile

# Colors for output
RED = \033[0;31m
GREEN = \033[0;32m
YELLOW = \033[0;33m
BLUE = \033[0;34m
NC = \033[0m # No Color

# Default target
.DEFAULT_GOAL := help

#=============================================================================
# Help
#=============================================================================

.PHONY: help
help: ## Show this help message
	@echo "$(BLUE)Multi-Shop eCommerce Connector - Make Commands$(NC)"
	@echo ""
	@echo "$(GREEN)Available targets:$(NC)"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(YELLOW)%-25s$(NC) %s\n", $$1, $$2}'
	@echo ""
	@echo "$(BLUE)Quick Start:$(NC)"
	@echo "  make setup        # Initial project setup"
	@echo "  make dev          # Start development environment"
	@echo "  make test         # Run all tests"
	@echo "  make build        # Build for production"

#=============================================================================
# Setup & Installation
#=============================================================================

.PHONY: setup
setup: ## Initial project setup (install deps, create .env, init DB)
	@echo "$(GREEN)Setting up Multi-Shop eCommerce Connector...$(NC)"
	@$(MAKE) install
	@$(MAKE) env-setup
	@$(MAKE) docker-up
	@sleep 5
	@$(MAKE) db-migrate
	@echo "$(GREEN)✅ Setup complete! Run 'make dev' to start developing$(NC)"

.PHONY: install
install: ## Install all dependencies (Rust + Frontend)
	@echo "$(BLUE)Installing dependencies...$(NC)"
	@cd $(BACKEND_DIR) && $(CARGO) fetch
	@cd $(FRONTEND_DIR) && $(PNPM) install
	@echo "$(GREEN)✅ Dependencies installed$(NC)"

.PHONY: env-setup
env-setup: ## Create .env files from examples
	@echo "$(BLUE)Setting up environment files...$(NC)"
	@test -f $(BACKEND_DIR)/.env || cp $(BACKEND_DIR)/.env.example $(BACKEND_DIR)/.env
	@test -f $(FRONTEND_DIR)/.env.local || cp $(FRONTEND_DIR)/.env.example $(FRONTEND_DIR)/.env.local
	@echo "$(GREEN)✅ Environment files created$(NC)"
	@echo "$(YELLOW)⚠️  Please update .env files with your credentials$(NC)"

#=============================================================================
# Docker Services
#=============================================================================

.PHONY: docker-up
docker-up: ## Start all Docker services (Redis, ClickHouse, Qdrant, NATS)
	@echo "$(BLUE)Starting Docker services...$(NC)"
	@$(DOCKER_COMPOSE) up -d redis clickhouse qdrant nats
	@echo "$(GREEN)✅ Docker services started$(NC)"

.PHONY: docker-down
docker-down: ## Stop all Docker services
	@echo "$(BLUE)Stopping Docker services...$(NC)"
	@$(DOCKER_COMPOSE) down
	@echo "$(GREEN)✅ Docker services stopped$(NC)"

.PHONY: docker-clean
docker-clean: ## Stop and remove all Docker containers, volumes
	@echo "$(RED)Cleaning Docker environment...$(NC)"
	@$(DOCKER_COMPOSE) down -v --remove-orphans
	@echo "$(GREEN)✅ Docker environment cleaned$(NC)"

.PHONY: docker-logs
docker-logs: ## Show Docker service logs
	@$(DOCKER_COMPOSE) logs -f

.PHONY: docker-status
docker-status: ## Check Docker service status
	@echo "$(BLUE)Docker Service Status:$(NC)"
	@$(DOCKER_COMPOSE) ps

#=============================================================================
# Database
#=============================================================================

.PHONY: db-migrate
db-migrate: ## Run database migrations
	@echo "$(BLUE)Running ClickHouse migrations...$(NC)"
	@$(CLICKHOUSE_CLIENT) --multiquery < $(MIGRATION_DIR)/001_initial_schema.sql
	@$(CLICKHOUSE_CLIENT) --multiquery < $(MIGRATION_DIR)/002_auth_tables.sql
	@echo "$(GREEN)✅ Migrations completed$(NC)"

.PHONY: db-reset
db-reset: ## Reset database (drop and recreate)
	@echo "$(RED)Resetting database...$(NC)"
	@echo "DROP DATABASE IF EXISTS syncdb" | $(CLICKHOUSE_CLIENT)
	@$(MAKE) db-migrate
	@echo "$(GREEN)✅ Database reset complete$(NC)"

.PHONY: db-seed
db-seed: ## Seed database with test data
	@echo "$(BLUE)Seeding database...$(NC)"
	@cd $(BACKEND_DIR) && $(CARGO) run --bin seed
	@echo "$(GREEN)✅ Database seeded$(NC)"

.PHONY: redis-cli
redis-cli: ## Open Redis CLI
	@$(REDIS_CLI)

.PHONY: clickhouse-cli
clickhouse-cli: ## Open ClickHouse CLI
	@$(CLICKHOUSE_CLIENT) -d syncdb

.PHONY: redis-flush
redis-flush: ## Flush all Redis data
	@echo "$(RED)Flushing Redis...$(NC)"
	@$(REDIS_CLI) FLUSHALL
	@echo "$(GREEN)✅ Redis flushed$(NC)"


#=============================================================================
# Development
#=============================================================================

.PHONY: dev
dev: ## Start full development environment
	@echo "$(GREEN)Starting development environment...$(NC)"
	@$(MAKE) docker-up
	@$(MAKE) -j2 dev-backend dev-frontend

.PHONY: dev-backend
dev-backend: ## Start backend in development mode
	@echo "$(BLUE)Starting backend...$(NC)"
	@cd $(BACKEND_DIR) && $(CARGO) watch -x run

.PHONY: dev-frontend
dev-frontend: ## Start frontend in development mode
	@echo "$(BLUE)Starting frontend...$(NC)"
	@cd $(FRONTEND_DIR) && $(PNPM) dev

.PHONY: dev-worker
dev-worker: ## Start worker in development mode
	@echo "$(BLUE)Starting worker...$(NC)"
	@cd $(BACKEND_DIR) && $(CARGO) watch -x "run --bin worker"

.PHONY: watch
watch: ## Watch backend for changes and recompile (no run)
	@echo "$(BLUE)Watching backend for changes (compile only)...$(NC)"
	@cd $(BACKEND_DIR) && $(CARGO) watch -x check

.PHONY: watch-test
watch-test: ## Watch backend and run tests on changes
	@echo "$(BLUE)Watching backend and running tests...$(NC)"
	@cd $(BACKEND_DIR) && $(CARGO) watch -x test

.PHONY: watch-clippy
watch-clippy: ## Watch backend and run clippy on changes
	@echo "$(BLUE)Watching backend with clippy...$(NC)"
	@cd $(BACKEND_DIR) && $(CARGO) watch -x "clippy -- -D warnings"

.PHONY: watch-build
watch-build: ## Watch backend and build release on changes
	@echo "$(BLUE)Watching backend for release builds...$(NC)"
	@cd $(BACKEND_DIR) && $(CARGO) watch -x "build --release"

#=============================================================================
# Building
#=============================================================================

.PHONY: build
build: ## Build all components for production
	@echo "$(BLUE)Building for production...$(NC)"
	@$(MAKE) build-backend
	@$(MAKE) build-frontend
	@echo "$(GREEN)✅ Production build complete$(NC)"

.PHONY: build-backend
build-backend: ## Build backend for production
	@echo "$(BLUE)Building backend...$(NC)"
	@cd $(BACKEND_DIR) && $(CARGO) build --release
	@echo "$(GREEN)✅ Backend built$(NC)"

.PHONY: build-frontend
build-frontend: ## Build frontend for production
	@echo "$(BLUE)Building frontend...$(NC)"
	@cd $(FRONTEND_DIR) && $(PNPM) build
	@echo "$(GREEN)✅ Frontend built$(NC)"

.PHONY: build-docker
build-docker: ## Build Docker images
	@echo "$(BLUE)Building Docker images...$(NC)"
	@$(DOCKER_COMPOSE) build
	@echo "$(GREEN)✅ Docker images built$(NC)"

#=============================================================================
# Testing
#=============================================================================

.PHONY: test
test: ## Run all tests
	@echo "$(BLUE)Running all tests...$(NC)"
	@$(MAKE) test-backend
	@$(MAKE) test-frontend
	@echo "$(GREEN)✅ All tests passed$(NC)"

.PHONY: test-backend
test-backend: ## Run backend tests
	@echo "$(BLUE)Running backend tests...$(NC)"
	@cd $(BACKEND_DIR) && $(CARGO) test

.PHONY: test-frontend
test-frontend: ## Run frontend tests
	@echo "$(BLUE)Running frontend tests...$(NC)"
	@cd $(FRONTEND_DIR) && $(PNPM) test

.PHONY: test-integration
test-integration: ## Run integration tests
	@echo "$(BLUE)Running integration tests...$(NC)"
	@$(MAKE) docker-up
	@cd $(BACKEND_DIR) && $(CARGO) test --features integration
	@echo "$(GREEN)✅ Integration tests passed$(NC)"

.PHONY: test-e2e
test-e2e: ## Run end-to-end tests
	@echo "$(BLUE)Running E2E tests...$(NC)"
	@cd $(FRONTEND_DIR) && $(PNPM) test:e2e

.PHONY: test-coverage
test-coverage: ## Generate test coverage report
	@echo "$(BLUE)Generating coverage report...$(NC)"
	@cd $(BACKEND_DIR) && $(CARGO) tarpaulin --out Html
	@echo "$(GREEN)✅ Coverage report generated$(NC)"

#=============================================================================
# Code Quality
#=============================================================================

.PHONY: lint
lint: ## Run linters
	@echo "$(BLUE)Running linters...$(NC)"
	@$(MAKE) lint-backend
	@$(MAKE) lint-frontend
	@echo "$(GREEN)✅ Linting complete$(NC)"

.PHONY: lint-backend
lint-backend: ## Lint backend code
	@cd $(BACKEND_DIR) && $(CARGO) clippy -- -D warnings

.PHONY: lint-frontend
lint-frontend: ## Lint frontend code
	@cd $(FRONTEND_DIR) && $(PNPM) lint

.PHONY: format
format: ## Format all code
	@echo "$(BLUE)Formatting code...$(NC)"
	@$(MAKE) format-backend
	@$(MAKE) format-frontend
	@echo "$(GREEN)✅ Code formatted$(NC)"

.PHONY: format-backend
format-backend: ## Format backend code
	@cd $(BACKEND_DIR) && $(CARGO) fmt

.PHONY: format-frontend
format-frontend: ## Format frontend code
	@cd $(FRONTEND_DIR) && $(PNPM) format

.PHONY: check
check: ## Run all checks (compile, lint, test)
	@echo "$(BLUE)Running all checks...$(NC)"
	@cd $(BACKEND_DIR) && $(CARGO) check
	@$(MAKE) lint
	@$(MAKE) test
	@echo "$(GREEN)✅ All checks passed$(NC)"

#=============================================================================
# Production
#=============================================================================

.PHONY: prod-up
prod-up: ## Start production environment
	@echo "$(BLUE)Starting production environment...$(NC)"
	@$(DOCKER_COMPOSE) -f docker-compose.yml -f docker-compose.prod.yml up -d
	@echo "$(GREEN)✅ Production environment started$(NC)"

.PHONY: prod-down
prod-down: ## Stop production environment
	@echo "$(BLUE)Stopping production environment...$(NC)"
	@$(DOCKER_COMPOSE) -f docker-compose.yml -f docker-compose.prod.yml down
	@echo "$(GREEN)✅ Production environment stopped$(NC)"

.PHONY: deploy
deploy: ## Deploy to production
	@echo "$(BLUE)Deploying to production...$(NC)"
	@$(MAKE) build
	@$(MAKE) build-docker
	@echo "$(YELLOW)⚠️  Manual deployment steps required$(NC)"
	@echo "1. Push Docker images to registry"
	@echo "2. Update Kubernetes manifests"
	@echo "3. Apply migrations"
	@echo "4. Roll out new version"

#=============================================================================
# Monitoring & Debugging
#=============================================================================

.PHONY: logs
logs: ## Show all logs
	@$(MAKE) logs-backend

.PHONY: logs-backend
logs-backend: ## Show backend logs
	@tail -f $(BACKEND_DIR)/logs/*.log

.PHONY: logs-worker
logs-worker: ## Show worker logs
	@tail -f $(BACKEND_DIR)/logs/worker.log

.PHONY: monitor
monitor: ## Open monitoring dashboard
	@echo "$(BLUE)Opening monitoring dashboards...$(NC)"
	@open http://localhost:3000      # Frontend
	@open http://localhost:8080      # Backend API
	@open http://localhost:6333      # Qdrant UI
	@open http://localhost:8123      # ClickHouse UI
	@open http://localhost:8222      # NATS monitoring

.PHONY: debug-backend
debug-backend: ## Run backend with debug logging
	@cd $(BACKEND_DIR) && RUST_LOG=debug $(CARGO) run

.PHONY: bench
bench: ## Run benchmarks
	@echo "$(BLUE)Running benchmarks...$(NC)"
	@cd $(BACKEND_DIR) && $(CARGO) bench

#=============================================================================
# Platform-specific Commands
#=============================================================================

.PHONY: sync-products
sync-products: ## Sync products for a platform (PLATFORM=tiktok SHOP_ID=xxx)
	@echo "$(BLUE)Syncing products for $(PLATFORM) shop $(SHOP_ID)...$(NC)"
	@cd $(BACKEND_DIR) && $(CARGO) run --bin sync -- --platform $(PLATFORM) --shop-id $(SHOP_ID)

.PHONY: test-oauth
test-oauth: ## Test OAuth flow for a platform (PLATFORM=tiktok)
	@echo "$(BLUE)Testing OAuth for $(PLATFORM)...$(NC)"
	@cd $(BACKEND_DIR) && $(CARGO) run --bin test-oauth -- --platform $(PLATFORM)

.PHONY: vector-rebuild
vector-rebuild: ## Rebuild vector index for a platform (PLATFORM=tiktok)
	@echo "$(BLUE)Rebuilding vector index for $(PLATFORM)...$(NC)"
	@cd $(BACKEND_DIR) && $(CARGO) run --bin vector-rebuild -- --platform $(PLATFORM)

#=============================================================================
# Maintenance
#=============================================================================

.PHONY: clean
clean: ## Clean build artifacts
	@echo "$(RED)Cleaning build artifacts...$(NC)"
	@cd $(BACKEND_DIR) && $(CARGO) clean
	@cd $(FRONTEND_DIR) && rm -rf node_modules .next out dist
	@echo "$(GREEN)✅ Build artifacts cleaned$(NC)"

.PHONY: reset
reset: ## Full reset (clean + remove Docker volumes)
	@echo "$(RED)Performing full reset...$(NC)"
	@$(MAKE) clean
	@$(MAKE) docker-clean
	@echo "$(GREEN)✅ Full reset complete$(NC)"

.PHONY: backup
backup: ## Backup database and Redis
	@echo "$(BLUE)Creating backup...$(NC)"
	@mkdir -p backups
	@$(CLICKHOUSE_CLIENT) --query "SELECT * FROM syncdb.* FORMAT Native" > backups/clickhouse-$(shell date +%Y%m%d-%H%M%S).native
	@$(REDIS_CLI) --rdb backups/redis-$(shell date +%Y%m%d-%H%M%S).rdb
	@echo "$(GREEN)✅ Backup created in backups/$(NC)"

.PHONY: restore
restore: ## Restore from backup (BACKUP_FILE=xxx)
	@echo "$(BLUE)Restoring from backup...$(NC)"
	@echo "$(YELLOW)⚠️  Manual restore required - see backups/$(BACKUP_FILE)$(NC)"

#=============================================================================
# Documentation
#=============================================================================

.PHONY: docs
docs: ## Generate documentation
	@echo "$(BLUE)Generating documentation...$(NC)"
	@cd $(BACKEND_DIR) && $(CARGO) doc --no-deps --open

.PHONY: api-docs
api-docs: ## Generate API documentation
	@echo "$(BLUE)Generating API docs...$(NC)"
	@cd $(BACKEND_DIR) && $(CARGO) run --bin generate-openapi

#=============================================================================
# CI/CD Targets
#=============================================================================

.PHONY: ci
ci: ## Run CI pipeline
	@echo "$(BLUE)Running CI pipeline...$(NC)"
	@$(MAKE) check
	@$(MAKE) test
	@$(MAKE) build
	@echo "$(GREEN)✅ CI pipeline passed$(NC)"

.PHONY: release
release: ## Create a new release (VERSION=x.y.z)
	@echo "$(BLUE)Creating release $(VERSION)...$(NC)"
	@git tag -a v$(VERSION) -m "Release v$(VERSION)"
	@git push origin v$(VERSION)
	@echo "$(GREEN)✅ Release v$(VERSION) created$(NC)"

#=============================================================================
# Shortcuts
#=============================================================================

.PHONY: up
up: docker-up ## Shortcut for docker-up

.PHONY: down
down: docker-down ## Shortcut for docker-down

.PHONY: b
b: build ## Shortcut for build

.PHONY: t
t: test ## Shortcut for test

.PHONY: r
r: dev-backend ## Shortcut for run backend

.PHONY: f
f: format ## Shortcut for format

.PHONY: l
l: lint ## Shortcut for lint


hosts:
	sudo -- sh -c "echo 127.0.0.1  auth.lodashventure.local >> /etc/hosts"
	sudo -- sh -c "echo 127.0.0.1  app.lodashventure.local >> /etc/hosts"
	sudo -- sh -c "echo 127.0.0.1  hydra.lodashventure.local >> /etc/hosts"
	sudo -- sh -c "echo 127.0.0.1  mysql.lodashventure.local >> /etc/hosts"
	sudo -- sh -c "echo 127.0.0.1  mailslurper.lodashventure.local >> /etc/hosts"
	sudo -- sh -c "echo 127.0.0.1  smtp.lodashventure.local >> /etc/hosts"
	sudo -- sh -c "echo 127.0.0.1  postgres-ory.lodashventure.local >> /etc/hosts"
	sudo -- sh -c "echo 127.0.0.1  keto-read.lodashventure.local >> /etc/hosts"
	sudo -- sh -c "echo 127.0.0.1  keto-write.lodashventure.local >> /etc/hosts"
	sudo -- sh -c "echo 127.0.0.1  keto-read.lodashventure.local >> /etc/hosts"
	sudo -- sh -c "echo 127.0.0.1  keto-write.lodashventure.local >> /etc/hosts"
	sudo -- sh -c "echo 127.0.0.1  keto-read.lodashventure.local >> /etc/hosts"
	sudo -- sh -c "echo 127.0.0.1  keto-write.lodashventure.local >> /etc/hosts"
	sudo -- sh -c "echo 127.0.0.1  api.lodashventure.local >> /etc/hosts"
	sudo -- sh -c "echo 127.0.0.1  clickhouse.lodashventure.local >> /etc/hosts"
	sudo -- sh -c "echo 127.0.0.1  chui.lodashventure.local >> /etc/hosts"
	sudo -- sh -c "echo 127.0.0.1  qdrant.lodashventure.local >> /etc/hosts"
	sudo -- sh -c "echo 127.0.0.1  nats.lodashventure.local >> /etc/hosts"
	sudo -- sh -c "echo 127.0.0.1  redis.lodashventure.local >> /etc/hosts"
	sudo -- sh -c "echo 127.0.0.1  kratos.lodashventure.local >> /etc/hosts"

rm-hosts:
	sudo -- sh -c "sed -i '' '/127.0.0.1 auth.lodashventure.local/d' /etc/hosts"
	sudo -- sh -c "sed -i '' '/127.0.0.1 app.lodashventure.local/d' /etc/hosts"
	sudo -- sh -c "sed -i '' '/127.0.0.1 hydra.lodashventure.local/d' /etc/hosts"
	sudo -- sh -c "sed -i '' '/127.0.0.1 mysql.lodashventure.local/d' /etc/hosts"
	sudo -- sh -c "sed -i '' '/127.0.0.1 mailslurper.lodashventure.local/d' /etc/hosts"
	sudo -- sh -c "sed -i '' '/127.0.0.1 smtp.lodashventure.local/d' /etc/hosts"
	sudo -- sh -c "sed -i '' '/127.0.0.1 postgres-ory.lodashventure.local/d' /etc/hosts"
	sudo -- sh -c "sed -i '' '/127.0.0.1 keto-read.lodashventure.local/d' /etc/hosts"
	sudo -- sh -c "sed -i '' '/127.0.0.1 keto-write.lodashventure.local/d' /etc/hosts"
	sudo -- sh -c "sed -i '' '/127.0.0.1 api.lodashventure.local/d' /etc/hosts"
	sudo -- sh -c "sed -i '' '/127.0.0.1 clickhouse.lodashventure.local/d' /etc/hosts"
	sudo -- sh -c "sed -i '' '/127.0.0.1 chui.lodashventure.local/d' /etc/hosts"
	sudo -- sh -c "sed -i '' '/127.0.0.1 qdrant.lodashventure.local/d' /etc/hosts"
	sudo -- sh -c "sed -i '' '/127.0.0.1 nats.lodashventure.local/d' /etc/hosts"
	sudo -- sh -c "sed -i '' '/127.0.0.1 redis.lodashventure.local/d' /etc/hosts"
	sudo -- sh -c "sed -i '' '/127.0.0.1 kratos.lodashventure.local/d' /etc/hosts"
