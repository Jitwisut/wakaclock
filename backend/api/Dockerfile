# Multi-stage build for Rust backend
# Stage 1: Build stage
FROM rust:1.81-slim-bookworm AS builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy manifest files
COPY Cargo.toml Cargo.lock ./

# Copy source code
COPY src ./src
COPY migrations ./migrations

# Build the application in release mode
RUN cargo build --release

# Build worker binaries if needed
# RUN cargo build --release --bin product_consumer
# RUN cargo build --release --bin product_sync

# Stage 2: Runtime stage
FROM debian:bookworm-slim

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy the built binary from builder stage
COPY --from=builder /app/target/release/ecommerce-connect /app/ecommerce-connect

# Copy worker binaries if they exist
# COPY --from=builder /app/target/release/product_consumer /app/product_consumer
# COPY --from=builder /app/target/release/product_sync /app/product_sync

# Create necessary directories
RUN mkdir -p /app/logs /app/data

# Set permissions
RUN chmod +x /app/ecommerce-connect

# Default runtime configuration (override with environment variables)
ENV RUN_MODE=webservice \
    WEB_PORT=8080 \
    GATEWAY_PORT=8081 \
    CONSUMER_TASKS=product-sync-to-ch-list

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Run the binary
CMD ["/app/ecommerce-connect"]
