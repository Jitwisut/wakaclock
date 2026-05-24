# E-Commerce Connect Backend

Multi-shop eCommerce connector backend built with Rust, Axum, and modern cloud-native technologies.

## Architecture

- **API Framework**: Axum (async Rust web framework)
- **Database**: ClickHouse (columnar database for analytics)
- **Cache/Session**: Redis (OAuth tokens and session management)
- **Vector Store**: Qdrant (semantic search and AI embeddings)
- **Message Queue**: RabbitMQ (async job processing)
- **Authentication**: JWT with x-auth-token, Ory Stack integration

## Features

- Multi-platform OAuth integration (TikTok Shop, Shopee, Lazada, Shopify, WooCommerce, and 21+ platforms)
- Product catalog synchronization across platforms
- AI-powered vector search using OpenAI embeddings
- Real-time sync progress tracking
- Platform-scoped multi-tenancy
- Enterprise-grade security with AES-GCM encryption

## Quick Start

### Prerequisites

- Rust 1.75+
- Docker & Docker Compose
- Redis, ClickHouse, Qdrant, RabbitMQ (or use Docker Compose)

### Development Setup

1. Clone and setup environment:
```bash
cd rust-backend
cp .env.example .env
# Edit .env with your configuration
```

2. Start infrastructure services:
```bash
docker-compose up -d
```

3. Run the backend:
```bash
cargo run
```

The API will be available at `http://localhost:8080`

### Building for Production

```bash
cargo build --release
# Or use Docker
docker build -t ecommerce-connect .
```

## API Endpoints

All endpoints require `x-auth-token` header and are platform-scoped.

### Shop OAuth
- `GET /api/platform/shop/{platform}/connect` - Get OAuth URL
- `POST /api/platform/shop/{platform}/callback` - OAuth callback
- `POST /api/platform/shop/{platform}/grant` - Grant shop access

### Products
- `GET /api/platform/product/list` - List products
- `POST /api/platform/product/sync_to_vector` - Sync to vector DB
- `POST /api/v1/platform/product/{app}/ingrest` - Batched inbound product ingestion (HMAC protected)

#### Product Ingestion (Inbound)

Partners push up to 100 SKU objects per request. This is distinct from the outbound webhook management APIs under `/api/v1/platform/webhooks/*`, which we use when notifying external systems. Tenant secrets (`whsec_xxx`) are cached in Redis under `webhook:tenant:{tenant_id}:whsec`.

```http
POST /api/v1/platform/product/{app}/ingrest HTTP/1.1
Content-Type: application/json
X-Tenant-Id: tenant_123
Idempotency-Key: 9d21f9ef-5f6f-4faf-9f7e-5a2f7844b5f3
X-Signature: sha256=<hmac(raw-body)>

[
  {
    "marketplace": "shopee",
    "sku": "SKU-123",
    "title": "Demo Product",
    "price_amount": 199.90,
    "price_currency": "THB",
    "images": ["https://cdn.example.com/demo.jpg"],
    "attributes": {"color": "blue"}
  }
]
```

The handler verifies the HMAC signature against every whsec-style secret registered for that tenant, enforces batch limits, stores an idempotency record, and enqueues a `product.batch.upsert` job for background processing.

### Vector Search
- `POST /api/platform/vector/search` - Semantic search
- `GET /api/platform/vector/sync_status` - Check sync progress

### AI
- `POST /api/platform/ai/embedding` - Get embeddings
- `POST /api/platform/ai/completion` - Chat completion
- `POST /api/platform/ai/completion/stream` - Streaming completion

## Project Structure

```
src/
├── domain/          # Core domain models and types
├── auth/            # Authentication and encryption
├── config/          # Configuration management
├── repository/      # Data access layer (ClickHouse, Redis, Qdrant)
├── gateway/         # External API integrations
├── routes/          # API route definitions
├── handlers/        # Request handlers
├── middleware/      # HTTP middleware
├── services/        # Business logic
├── worker/          # Async job processing
└── observability/   # Logging, tracing, metrics
```

## Security

- All OAuth tokens encrypted with AES-GCM before storage
- No tokens or secrets exposed in logs or responses
- Platform-scoped data isolation
- Comprehensive audit logging

## Testing

```bash
# Run all tests
cargo test

# Run with coverage
cargo tarpaulin

# Integration tests
cargo test --test '*' -- --test-threads=1
```

## Background Workers

Two asynchronous workers power the ingestion pipeline:

- **Webhook batch worker** (`product-ingest-worker`) consumes `product.batch.upsert` messages and writes to ClickHouse `product_events` and `product_current`.
- **Crawler consumer** (`crawler-consumer`) reads Google Merchant URL batches, normalizes metadata, and emits product snapshots.

Run them via the CLI:

```bash
cargo run -- product-ingest-worker -g ingest-worker-1
cargo run -- crawler-consumer -g crawler-worker-1
```

Both workers block until interrupted (Ctrl+C) and require RabbitMQ, Redis, and ClickHouse connections.

## Configuration

The ingestion stack is controlled via environment variables:

| Variable | Description | Default |
| --- | --- | --- |
| `WEBHOOK_SHARED_SECRETS` | JSON map of `{ "tenant": ["whsec_live", "whsec_rotated"] }` (string values still supported for legacy single-secret tenants) | `{ "default": ["dev-webhook-shared-secret-change"] }` |
| `WEBHOOK_MAX_BATCH_ITEMS` | Maximum products per webhook request | `100` |
| `WEBHOOK_MAX_BODY_BYTES` | Maximum payload size (bytes) | `5242880` |
| `WEBHOOK_IDEMPOTENCY_TTL_SECS` | TTL for webhook idempotency keys | `86400` |
| `WEBHOOK_QUEUE_ROUTING_KEY` | RabbitMQ routing key for webhook batches | `product.batch.upsert` |
| `CRAWLER_URL_QUEUE` | Queue for incoming URL batches | `merchant.crawl.urls` |
| `CRAWLER_RESULT_QUEUE` | Queue for crawl summaries | `merchant.crawl.results` |
| `CRAWLER_DLQ` | Dead-letter queue for crawl failures | `merchant.crawl.dlq` |
| `CRAWLER_PREFETCH` | Prefetch count for crawler worker | `10` |

Example secrets configuration:

```bash
export WEBHOOK_SHARED_SECRETS='{"tenant_123":["whsec_live","whsec_rotated"],"tenant_beta":"legacy-secret"}'
```

## Monitoring

- Metrics: Prometheus format on port 9090
- Tracing: OpenTelemetry/Jaeger integration
- Logs: Structured JSON logging

## License

Copyright 2025 - E-Commerce Connect
