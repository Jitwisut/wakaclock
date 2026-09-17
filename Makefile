# AtoAxis developer and production workflow.
# The repository has one live Rust API workspace and one Next.js application;
# targets intentionally do not reference the old e-commerce template modules.

BACKEND_DIR ?= backend/api
FRONTEND_DIR ?= frontend/app
CARGO ?= cargo
NPM ?= npm
COMPOSE ?= docker compose
K0_COMPOSE_PROJECT ?= wakaclock-k0
K0_COMPOSE_FILE ?= docker-compose.kafka-spike.yml
K5_COMPOSE_PROJECT ?= wakaclock-k5
K5_COMPOSE_FILE ?= docker-compose.kafka-spike.yml

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
infra-up: ## Start PostgreSQL, ClickHouse, Redis and RabbitMQ
	@$(COMPOSE) -f docker-compose.yml up -d --wait postgres clickhouse redis rabbitmq

.PHONY: infra-kafka-up
infra-kafka-up: ## Start optional Redpanda (Kafka-compatible event bus)
	@$(COMPOSE) -f docker-compose.yml up -d --wait redpanda

.PHONY: kafka-topics
kafka-topics: ## Create local Kafka topics with K0/K1 retention defaults
	@$(COMPOSE) -f docker-compose.yml exec -T redpanda rpk topic create wakaclock.heartbeat.v1 --partitions 3 --replicas 1 --config retention.ms=604800000 || true
	@$(COMPOSE) -f docker-compose.yml exec -T redpanda rpk topic create wakaclock.ai-usage.v1 --partitions 3 --replicas 1 --config retention.ms=2592000000 || true
	@$(COMPOSE) -f docker-compose.yml exec -T redpanda rpk topic create wakaclock.ai-edit.v1 --partitions 3 --replicas 1 --config retention.ms=2592000000 || true
	@$(COMPOSE) -f docker-compose.yml exec -T redpanda rpk topic create wakaclock.identity-change.v1 --partitions 3 --replicas 1 --config retention.ms=2592000000 || true
	@$(COMPOSE) -f docker-compose.yml exec -T redpanda rpk topic create wakaclock.ingest.dlq.v1 --partitions 3 --replicas 1 --config retention.ms=2592000000 || true

.PHONY: kafka-spike-infra-up
kafka-spike-infra-up: ## Start isolated Redpanda + ClickHouse 24.10 for the K0 spike
	@$(COMPOSE) -p $(K0_COMPOSE_PROJECT) -f $(K0_COMPOSE_FILE) up -d

.PHONY: kafka-spike-infra-down
kafka-spike-infra-down: ## Stop K0 and remove only its test volumes
	@$(COMPOSE) -p $(K0_COMPOSE_PROJECT) -f $(K0_COMPOSE_FILE) down -v --remove-orphans

.PHONY: kafka-spike
kafka-spike: ## Run the feature-gated K0 harness against the isolated stack
	@cd $(BACKEND_DIR) && KAFKA_TEST_URL="$${KAFKA_TEST_URL:-localhost:19092}" CLICKHOUSE_TEST_URL="$${CLICKHOUSE_TEST_URL:-http://default:default@localhost:18123/wakaclock}" POSTGRES_TEST_URL="$${POSTGRES_TEST_URL:-postgres://atoaxis:atoaxis-test@localhost:15432/atoaxis_k0}" $(CARGO) run --bin kafka-spike --features kafka-spike

.PHONY: k5-ai-usage-infra-up
k5-ai-usage-infra-up: ## Start the isolated Kafka/ClickHouse/PostgreSQL/RabbitMQ K5 stack
	@$(COMPOSE) -p $(K5_COMPOSE_PROJECT) -f $(K5_COMPOSE_FILE) up -d --wait

.PHONY: k5-ai-usage-infra-down
k5-ai-usage-infra-down: ## Stop K5 infrastructure and remove only its test volumes
	@$(COMPOSE) -p $(K5_COMPOSE_PROJECT) -f $(K5_COMPOSE_FILE) down -v --remove-orphans

.PHONY: k5-ai-usage-spike
k5-ai-usage-spike: ## Run the feature-gated K5 full-stack harness against explicit isolated endpoints
	@cd $(BACKEND_DIR) && KAFKA_TEST_URL="$${KAFKA_TEST_URL:-localhost:19092}" CLICKHOUSE_TEST_URL="$${CLICKHOUSE_TEST_URL:-http://default:default@localhost:18123/wakaclock}" POSTGRES_TEST_URL="$${POSTGRES_TEST_URL:-postgres://atoaxis:atoaxis-test@localhost:15432/atoaxis_k0}" RABBITMQ_TEST_URL="$${RABBITMQ_TEST_URL:-amqp://atoaxis:atoaxis-test@localhost:15673/%2f}" $(CARGO) run --bin ai-usage-spike --features ai-usage-spike

.PHONY: k5-integration
k5-integration: ## Run K0 and K5 isolated broker acceptance harnesses
	@$(MAKE) k5-ai-usage-infra-up
	@$(MAKE) kafka-spike K0_COMPOSE_PROJECT=$(K5_COMPOSE_PROJECT)
	@$(MAKE) k5-ai-usage-spike K5_COMPOSE_PROJECT=$(K5_COMPOSE_PROJECT)

.PHONY: infra-down
infra-down: ## Stop local infrastructure containers, including Redpanda
	@$(COMPOSE) -f docker-compose.yml down

.PHONY: dev
dev: ## Start infrastructure and both local applications
	@$(MAKE) infra-up
	@$(MAKE) -j2 dev-backend dev-frontend

.PHONY: dev-backend
dev-backend: ## Run the Rust API in development mode
	@cd $(BACKEND_DIR) && $(CARGO) run --bin wakaclock-server

.PHONY: dev-job-worker
dev-job-worker: ## Run the RabbitMQ outbox relay and job worker
	@cd $(BACKEND_DIR) && $(CARGO) run --bin job-worker

.PHONY: dev-heartbeat-enrichment
dev-heartbeat-enrichment: ## Run the Kafka heartbeat fact-sink consumer
	@cd $(BACKEND_DIR) && $(CARGO) run --bin heartbeat-enrichment --features kafka

.PHONY: dev-heartbeat-verifier
dev-heartbeat-verifier: ## Run the K3 verify-mode Kafka shadow consumer
	@cd $(BACKEND_DIR) && $(CARGO) run --bin heartbeat-verifier --features kafka

.PHONY: dev-ai-usage-ingest
dev-ai-usage-ingest: ## Run the K5 AI usage Kafka fact-sink
	@cd $(BACKEND_DIR) && $(CARGO) run --bin ai-usage-ingest --features kafka

.PHONY: dev-ai-usage-verifier
dev-ai-usage-verifier: ## Run the K5 AI usage verify consumer
	@cd $(BACKEND_DIR) && $(CARGO) run --bin ai-usage-verifier --features kafka

.PHONY: dev-ai-session-worker
dev-ai-session-worker: ## Run the K5 AI session reconcile worker
	@cd $(BACKEND_DIR) && $(CARGO) run --bin ai-session-worker

.PHONY: dev-projection-worker
dev-projection-worker: ## Run the account projection rebuild worker
	@cd $(BACKEND_DIR) && $(CARGO) run --bin projection-worker

.PHONY: dev-export-worker
dev-export-worker: ## Run the S3-backed export artifact worker
	@cd $(BACKEND_DIR) && $(CARGO) run --bin export-worker

.PHONY: dev-account-deletion
dev-account-deletion: ## Run the cross-store account deletion worker
	@cd $(BACKEND_DIR) && $(CARGO) run --bin account-deletion

.PHONY: dev-frontend
dev-frontend: ## Run the Next.js application in development mode
	@cd $(FRONTEND_DIR) && $(NPM) run dev

.PHONY: build
build: build-backend build-frontend ## Build backend and frontend for production

.PHONY: build-backend
build-backend: ## Build all Rust workspace binaries
	@cd $(BACKEND_DIR) && $(CARGO) build -p wakaclock-server --bins --release --features kafka

.PHONY: build-frontend
build-frontend: ## Build the Next.js application
	@cd $(FRONTEND_DIR) && NEXT_PUBLIC_APP_URL="$${NEXT_PUBLIC_APP_URL:-https://atoaxis.com}" $(NPM) run build

.PHONY: test
test: test-backend test-frontend ## Run backend and frontend tests

.PHONY: test-backend
test-backend: ## Run Rust workspace tests
	@cd $(BACKEND_DIR) && $(CARGO) test --workspace

.PHONY: test-backend-kafka
test-backend-kafka: ## Run Rust workspace tests with the Kafka adapter and K5 workers
	@cd $(BACKEND_DIR) && $(CARGO) test --workspace --features kafka

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

.PHONY: lint-backend-kafka
lint-backend-kafka: ## Run strict Clippy with Kafka/K5 targets enabled
	@cd $(BACKEND_DIR) && $(CARGO) clippy --workspace --all-targets --features kafka -- -D warnings

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
