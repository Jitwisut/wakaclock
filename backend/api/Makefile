# Compatibility wrapper for contributors who run make from backend/api.
ROOT_DIR := ../..

.PHONY: help check lint test build format clean

help:
	@$(MAKE) -C $(ROOT_DIR) help

check:
	@$(MAKE) -C $(ROOT_DIR) check

lint:
	@$(MAKE) -C $(ROOT_DIR) lint-backend

test:
	@$(MAKE) -C $(ROOT_DIR) test-backend

build:
	@$(MAKE) -C $(ROOT_DIR) build-backend

format:
	@$(MAKE) -C $(ROOT_DIR) format-backend

clean:
	@cd $(ROOT_DIR)/backend/api && cargo clean
