# Build the live AtoAxis Rust workspace. The build context is backend/api.
FROM rust:1.88-bookworm AS builder

WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends pkg-config libssl-dev ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY Cargo.toml Cargo.lock ./
COPY crates ./crates
COPY src ./src
COPY migrations ./migrations

RUN cargo build --workspace --release

FROM debian:bookworm-slim AS runtime

WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates libssl3 curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/wakaclock-server /usr/local/bin/wakaclock-server
COPY --from=builder /app/target/release/heartbeat-enrichment /usr/local/bin/heartbeat-enrichment
COPY --from=builder /app/target/release/outbox-relay /usr/local/bin/outbox-relay
COPY --from=builder /app/target/release/integration-sync /usr/local/bin/integration-sync
COPY --from=builder /app/target/release/export-worker /usr/local/bin/export-worker
COPY --from=builder /app/target/release/report-worker /usr/local/bin/report-worker
COPY --from=builder /app/target/release/billing-reconciliation /usr/local/bin/billing-reconciliation
COPY --from=builder /app/target/release/account-deletion /usr/local/bin/account-deletion

ENV SERVER_HOST=0.0.0.0 \
    SERVER_PORT=8080

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD curl --fail http://127.0.0.1:8080/health || exit 1

ENTRYPOINT ["/usr/local/bin/wakaclock-server"]
