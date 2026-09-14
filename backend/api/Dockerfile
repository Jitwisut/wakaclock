# Build the live AtoAxis Rust workspace. The build context is backend/api.
FROM rust:1.88-bookworm AS builder

WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends pkg-config libssl-dev ca-certificates cmake \
    && rm -rf /var/lib/apt/lists/*

COPY Cargo.toml Cargo.lock ./
COPY crates ./crates
COPY src ./src
COPY migrations ./migrations

# Build the server and workers with Kafka support.  Direct ingest remains the
# runtime default; enabling the feature only makes the explicitly configured
# verify/kafka modes available.
RUN cargo build -p wakaclock-server --bins --release --features kafka

FROM debian:bookworm-slim AS runtime

WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates libssl3 curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/wakaclock-server /usr/local/bin/wakaclock-server
COPY --from=builder /app/target/release/heartbeat-enrichment /usr/local/bin/heartbeat-enrichment
COPY --from=builder /app/target/release/heartbeat-verifier /usr/local/bin/heartbeat-verifier
COPY --from=builder /app/target/release/ai-usage-ingest /usr/local/bin/ai-usage-ingest
COPY --from=builder /app/target/release/ai-usage-verifier /usr/local/bin/ai-usage-verifier
COPY --from=builder /app/target/release/ai-session-worker /usr/local/bin/ai-session-worker
COPY --from=builder /app/target/release/outbox-relay /usr/local/bin/outbox-relay
COPY --from=builder /app/target/release/integration-sync /usr/local/bin/integration-sync
COPY --from=builder /app/target/release/export-worker /usr/local/bin/export-worker
COPY --from=builder /app/target/release/report-worker /usr/local/bin/report-worker
COPY --from=builder /app/target/release/billing-reconciliation /usr/local/bin/billing-reconciliation
COPY --from=builder /app/target/release/account-deletion /usr/local/bin/account-deletion
COPY --from=builder /app/target/release/job-worker /usr/local/bin/job-worker

ENV SERVER_HOST=0.0.0.0 \
    SERVER_PORT=8080

EXPOSE 8080
EXPOSE 8081
EXPOSE 8082
EXPOSE 8084
EXPOSE 8085
EXPOSE 8086

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD curl --fail http://127.0.0.1:8080/health || exit 1

ENTRYPOINT ["/usr/local/bin/wakaclock-server"]
