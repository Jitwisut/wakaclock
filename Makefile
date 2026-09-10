# AtoAxis developer and production workflow.
# The repository has one live Rust API workspace and one Next.js application;
# targets intentionally do not reference the old e-commerce template modules.

BACKEND_DIR ?= backend/api
FRONTEND_DIR ?= frontend/app
CARGO ?= cargo
NPM ?= npm
COMPOSE ?= docker compose

.DEFAULT_GOAL := help

.PHONY: help
help: ## Show available commands
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-22s %s\n", $$1, $$2}'

.PHONY: install
install: ## Install locked Rust and npm dependencies
	@cd $(BACKEND_DIR) && $(CARGO) fetch --locked
	@cd $(FRONTEND_DIR) && $(NPM) ci

.PHONY: env-setup
env-setup: ## Create local environment files from checked-in examples
	@test -f $(FRONTEND_DIR)/.env.local || cp $(FRONTEND_DIR)/.env.example $(FRONTEND_DIR)/.env.local
	@test -f $(BACKEND_DIR)/.env || printf '%s\n' 'SERVER_HOST=127.0.0.1' 'SERVER_PORT=8000' 'CLICKHOUSE_URL=http://localhost:8123' > $(BACKEND_DIR)/.env

.PHONY: infra-up
infra-up: ## Start PostgreSQL, ClickHouse and Redis
	@$(COMPOSE) -f docker-compose.yml up -d postgres clickhouse redis

.PHONY: infra-brokers-up
infra-brokers-up: ## Start Redpanda and RabbitMQ (opt-in; no server adapter uses them yet)
	@$(COMPOSE) -f docker-compose.yml --profile brokers up -d redpanda rabbitmq

.PHONY: infra-down
infra-down: ## Stop local infrastructure containers, including opt-in brokers
	@$(COMPOSE) -f docker-compose.yml --profile brokers down

.PHONY: dev
dev: ## Start infrastructure and both local applications
	@$(MAKE) infra-up
	@$(MAKE) -j2 dev-backend dev-frontend

.PHONY: dev-backend
dev-backend: ## Run the Rust API in development mode
	@cd $(BACKEND_DIR) && $(CARGO) run --bin wakaclock-server

.PHONY: dev-frontend
dev-frontend: ## Run the Next.js application in development mode
	@cd $(FRONTEND_DIR) && $(NPM) run dev

.PHONY: build
build: build-backend build-frontend ## Build backend and frontend for production

.PHONY: build-backend
build-backend: ## Build all Rust workspace binaries
	@cd $(BACKEND_DIR) && $(CARGO) build --workspace --release

.PHONY: build-frontend
build-frontend: ## Build the Next.js application
	@cd $(FRONTEND_DIR) && NEXT_PUBLIC_APP_URL="$${NEXT_PUBLIC_APP_URL:-https://atoaxis.com}" $(NPM) run build

.PHONY: test
test: test-backend test-frontend ## Run backend and frontend tests

.PHONY: test-backend
test-backend: ## Run Rust workspace tests
	@cd $(BACKEND_DIR) && $(CARGO) test --workspace

.PHONY: test-frontend
test-frontend: ## Run frontend typecheck, lint and unit tests
	@cd $(FRONTEND_DIR) && $(NPM) run validate

.PHONY: test-e2e
test-e2e: ## Run browser end-to-end tests
	@cd $(FRONTEND_DIR) && $(NPM) run test:e2e

.PHONY: lint
lint: lint-backend lint-frontend ## Run strict linters

.PHONY: lint-backend
lint-backend: ## Run zero-warning Rust Clippy across every target
	@cd $(BACKEND_DIR) && $(CARGO) clippy --workspace --all-targets -- -D warnings

.PHONY: lint-frontend
lint-frontend: ## Run frontend ESLint with zero warnings
	@cd $(FRONTEND_DIR) && $(NPM) run lint:strict

.PHONY: format
format: format-backend format-frontend ## Format Rust and TypeScript

.PHONY: format-backend
format-backend: ## Format the Rust workspace
	@cd $(BACKEND_DIR) && $(CARGO) fmt --all

.PHONY: format-frontend
format-frontend: ## Check/write frontend formatting through Prettier
	@cd $(FRONTEND_DIR) && $(NPM) run format

.PHONY: check
check: lint test build ## Run all local quality gates

.PHONY: check-seo
check-seo: ## Validate deployed-route SEO/prerender contracts
	@cd $(FRONTEND_DIR) && $(NPM) run check:prerender

.PHONY: db-migrate
db-migrate: ## Explain migration ownership (API runs migrations at startup)
	@echo "PostgreSQL and ClickHouse migrations run by wakaclock-server at startup."
	@echo "Review backend/api/migrations before applying production changes."

.PHONY: logs
logs: ## Follow local infrastructure logs
	@$(COMPOSE) -f docker-compose.yml logs -f --tail=100

.PHONY: clean
clean: ## Remove generated backend/frontend build artifacts
	@cd $(BACKEND_DIR) && $(CARGO) clean
	@cd $(FRONTEND_DIR) && $(NPM) run clean

.PHONY: ci
ci: ## Run the same deterministic gates used by CI
	@$(MAKE) check
	@$(MAKE) check-seo

.PHONY: deploy
deploy: build ## Build artifacts; deployment is performed by Netlify/managed backend infrastructure
	@echo "Frontend deploys from main through Netlify; publish backend OCI images via the managed runtime."
