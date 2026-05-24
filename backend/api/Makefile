.PHONY: super
super: check lint test build

.PHONY: check
check:
	cargo check --all-features

.PHONY: lint
lint:
	cargo clippy -- -D warnings

.PHONY: test
test:
	cargo test

.PHONY: build
build:
	cargo build --release

.PHONY: fix
fix:
	cargo fix --allow-dirty --allow-staged
	cargo fmt

.PHONY: clean
clean:
	cargo clean

.PHONY: help
help:
	@echo "Available commands:"
	@echo "  make super  - Run check, lint, test, and build"
	@echo "  make check  - Check compilation"
	@echo "  make lint   - Run clippy linter"
	@echo "  make test   - Run tests"
	@echo "  make build  - Build release version"
	@echo "  make fix    - Auto-fix issues and format code"
	@echo "  make clean  - Clean build artifacts"
	@echo ""
	@echo "Docker commands:"
	@echo "  make docker-build     - Build Docker image"
	@echo "  make docker-run       - Run Docker container"
	@echo "  make docker-stop      - Stop Docker container"
	@echo "  make docker-logs      - View Docker logs"
	@echo "  make docker-shell     - Shell into Docker container"
	@echo "  make docker-clean     - Remove Docker containers and images"
	@echo ""
	@echo "Docker Compose commands:"
	@echo "  make docker-dev       - Start services in development mode"
	@echo "  make docker-dev-logs  - Show development logs"
	@echo "  make docker-prod      - Start services in production mode"
	@echo "  make docker-prod-logs - Show production logs"
	@echo "  make docker-compose   - Start with default configuration"
	@echo "  make docker-down      - Stop all services"
	@echo "  make docker-down-all  - Stop and remove everything"
	@echo "  make docker-ps        - Show running containers"
	@echo "  make docker-build-all - Build all images"
	@echo "  make docker-pull      - Pull latest base images"

# Docker commands
.PHONY: docker-build
docker-build:
	@echo "Building Docker image for Rust backend..."
	docker build -t ecommerce-rust-backend:latest ./

.PHONY: docker-run
docker-run:
	@echo "Running Docker container..."
	docker run -d \
		--name ecommerce-rust-backend \
		-p 8081:8081 \
		--env-file .env \
		-e RUST_LOG=debug \
		ecommerce-rust-backend:latest

.PHONY: docker-stop
docker-stop:
	@echo "Stopping Docker container..."
	docker stop ecommerce-rust-backend || true
	docker rm ecommerce-rust-backend || true

.PHONY: docker-logs
docker-logs:
	docker logs -f ecommerce-rust-backend

.PHONY: docker-shell
docker-shell:
	docker exec -it ecommerce-rust-backend /bin/bash

.PHONY: docker-clean
docker-clean: docker-stop
	@echo "Cleaning Docker images..."
	docker rmi ecommerce-rust-backend:latest || true

# Docker Compose Mode Commands
.PHONY: docker-dev
docker-dev:
	@echo "Starting services in DEVELOPMENT mode..."
	cd ../.. && docker-compose -f docker-compose.yaml -f docker-compose.dev.yaml up -d

.PHONY: docker-dev-logs
docker-dev-logs:
	@echo "Showing logs for development services..."
	cd ../.. && docker-compose -f docker-compose.yaml -f docker-compose.dev.yaml logs -f

.PHONY: docker-prod
docker-prod:
	@echo "Starting services in PRODUCTION mode..."
	cd ../.. && docker-compose -f docker-compose.yaml -f docker-compose.prod.yaml up -d

.PHONY: docker-prod-logs
docker-prod-logs:
	@echo "Showing logs for production services..."
	cd ../.. && docker-compose -f docker-compose.yaml -f docker-compose.prod.yaml logs -f

.PHONY: docker-compose
docker-compose:
	@echo "Starting all services with default docker-compose..."
	cd ../.. && docker-compose up -d

.PHONY: docker-down
docker-down:
	@echo "Stopping all docker-compose services..."
	cd ../.. && docker-compose down

.PHONY: docker-down-all
docker-down-all:
	@echo "Stopping and removing all containers, networks, and volumes..."
	cd ../.. && docker-compose down -v --remove-orphans

.PHONY: docker-ps
docker-ps:
	@echo "Showing running containers..."
	cd ../.. && docker-compose ps

.PHONY: docker-build-all
docker-build-all:
	@echo "Building all Docker images..."
	cd ../.. && docker-compose build --no-cache

.PHONY: docker-pull
docker-pull:
	@echo "Pulling latest base images..."
	cd ../.. && docker-compose pull

.PHONY: docker-rebuild
docker-rebuild: docker-clean docker-build

.PHONY: docker-restart
docker-restart: docker-stop docker-run
