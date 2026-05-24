# PlayField Backend Architecture

> **E-commerce Connect API** - Rust-based multi-tenant e-commerce gateway and platform  
> Version: 2.4.0 | Architecture: Clean Architecture / Layered Architecture

---

## Table of Contents

- [Overview](#overview)
- [Architecture Patterns](#architecture-patterns)
- [Project Structure](#project-structure)
- [Layer Details](#layer-details)
- [Data Flow](#data-flow)
- [Technology Stack](#technology-stack)
- [Runtime Modes](#runtime-modes)
- [Key Components](#key-components)

---

## Overview

The PlayField backend is built with **Rust** following **Clean Architecture** principles. It serves as a multi-tenant e-commerce gateway connecting various platforms (TikTok, Shopee, Lazada, Shopify, etc.) with unified APIs for product management, synchronization, and AI-powered vector search.

### Design Principles

1. **Separation of Concerns** - Clear boundaries between layers
2. **Dependency Rule** - Dependencies point inward (Domain → Application → Infrastructure)
3. **Interface Segregation** - Traits define contracts between layers
4. **Dependency Injection** - Go-style container for wiring dependencies

---

## Architecture Patterns

```
┌─────────────────────────────────────────────────────────────────────┐
│                         PRESENTATION LAYER                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │   HTTP      │  │  Middleware │  │   Router    │  │    DTOs     │ │
│  │  (Axum)     │  │ (Auth/CORS) │  │  (Routes)   │  │ (Models)    │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └─────────────┘ │
└─────────┼────────────────┼────────────────┼─────────────────────────┘
          │                │                │
          ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        APPLICATION LAYER                            │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                      Service Layer                            │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐  │  │
│  │  │ Product  │ │  Vector  │ │ Webhook  │ │  Product Sync    │  │  │
│  │  │ Service  │ │ Service  │ │ Service  │ │  Coordinator     │  │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         DOMAIN LAYER                                │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                    Repository Layer                           │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐  │  │
│  │  │ClickHouse│ │  Qdrant  │ │ Product  │ │    Webhook       │  │  │
│  │  │   Repo   │ │   Repo   │ │   Repo   │ │     Repo         │  │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      INFRASTRUCTURE LAYER                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │ Database │ │   Cache  │ │  Queue   │ │  Auth    │ │  OAuth   │   │
│  │ Clients  │ │ (Redis)  │ │(RabbitMQ)│ │ (Casbin) │ │  State   │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐               │
│  │ Platform │ │   HTTP   │ │  Logger  │ │ Metrics  │               │
│  │ Connectors│ │ Client   │ │(Tracing) │ │(Prometheus)              │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘               │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
backend/api/
├── src/
│   ├── main.rs                 # Application entry point (3 runtime modes)
│   ├── lib.rs                  # Library exports
│   │
│   ├── handlers/               # HTTP handlers (Controllers)
│   │   ├── v1/
│   │   │   ├── gateway/        # External-facing APIs
│   │   │   └── platform/       # Internal management APIs
│   │   └── mod.rs
│   │
│   ├── services/               # Business logic layer
│   │   ├── product.rs
│   │   ├── vector.rs
│   │   ├── webhook.rs
│   │   ├── product_sync/       # Sync coordination
│   │   └── mod.rs
│   │
│   ├── repository/             # Data access layer
│   │   ├── clickhouse.rs
│   │   ├── qdrant.rs
│   │   ├── unified_product.rs
│   │   ├── product_ingest.rs
│   │   └── mod.rs
│   │
│   ├── infrastructure/         # Infrastructure concerns
│   │   ├── app/                # DI container, initialization
│   │   ├── cache/              # Redis, in-memory cache
│   │   ├── database/           # DB connection management
│   │   ├── queue/              # RabbitMQ, memory queue
│   │   ├── auth/               # Authentication
│   │   ├── casbin/             # Authorization (RBAC)
│   │   ├── oauth/              # OAuth state management
│   │   ├── sync/               # Product sync infrastructure
│   │   ├── observability/      # Metrics, health, tracing
│   │   └── logger/             # Structured logging
│   │
│   ├── client/                 # External service clients
│   │   ├── ecommerce/          # Platform connectors (20+ platforms)
│   │   ├── database/           # ClickHouse, Qdrant clients
│   │   ├── cache/              # Redis client
│   │   ├── queue/              # RabbitMQ client
│   │   ├── ai/                 # AI/ML service clients
│   │   └── strapi/             # Strapi CMS integration
│   │
│   ├── worker/                 # Background job processors
│   │   ├── product_consumer.rs
│   │   ├── vector_sync_worker.rs
│   │   ├── product_ingest_worker.rs
│   │   ├── batch_processor.rs
│   │   └── mod.rs
│   │
│   ├── middleware/             # HTTP middleware
│   │   ├── auth_middleware.rs
│   │   ├── rate_limit.rs
│   │   ├── cors.rs
│   │   └── error_handler.rs
│   │
│   ├── model/                  # Domain models, DTOs
│   │   ├── v1/
│   │   │   ├── gateway/        # Gateway API models
│   │   │   └── platfrom/       # Platform API models
│   │   └── mod.rs
│   │
│   ├── interfaces/             # Trait definitions
│   │   ├── repository.rs
│   │   ├── service.rs
│   │   ├── platform_gateway.rs
│   │   └── mod.rs
│   │
│   ├── helpers/                # Utility functions
│   │   ├── auth/               # Crypto, JWT
│   │   └── mapping/            # Platform data mappers
│   │
│   ├── config/                 # Configuration management
│   │   └── config_loader.rs
│   │
│   └── docs/                   # API documentation
│       └── v1/
│
├── migrations/                 # Database migrations
│   ├── clickhouse/
│   └── postgres/
│
├── credentials/                # Platform credentials & policies
│
├── Cargo.toml
└── Dockerfile
```

---

## Layer Details

### 1. Presentation Layer (`handlers/`)

**Responsibility**: Handle HTTP requests/responses, input validation, routing

```rust
// Example: handlers/v1/gateway/products/handler.rs
pub async fn list_products(
    State(state): State<Arc<AppState>>,
    Query(params): Query<ListProductsQuery>,
) -> Result<Json<ProductListResponse>, ApiError> {
    let products = state.product_service.list_products(params).await?;
    Ok(Json(products))
}
```

**Key Components**:
- **Axum Router** - HTTP routing
- **Middleware Stack** - Auth, CORS, rate limiting, logging
- **Extractors** - Request parsing, validation
- **DTOs** - Request/response models

### 2. Application Layer (`services/`)

**Responsibility**: Business logic, orchestration, use cases

```rust
// Example: services/product.rs
pub trait ProductService: Send + Sync {
    async fn list_products(&self, query: ListProductsQuery) -> Result<ProductListResponse>;
    async fn sync_product(&self, product_id: Uuid) -> Result<()>;
}
```

**Key Services**:
| Service | Responsibility |
|---------|---------------|
| `ProductService` | Product CRUD, lifecycle management |
| `VectorService` | Semantic search, embeddings |
| `WebhookService` | Event notifications |
| `ProductSync` | Cross-platform synchronization |
| `BackpressureManager` | Flow control for sync operations |
| `DLQManager` | Dead letter queue handling |

### 3. Domain Layer (`repository/`, `model/`)

**Responsibility**: Domain entities, repository contracts, business rules

**Repositories**:
```rust
// Trait defined in interfaces/
pub trait ProductRepository: Send + Sync {
    async fn find_by_id(&self, id: Uuid) -> Result<Option<Product>>;
    async fn save(&self, product: &Product) -> Result<()>;
}

// Implementation in repository/
pub struct ClickHouseProductRepository { ... }
impl ProductRepository for ClickHouseProductRepository { ... }
```

**Models**:
- `Product` - Core product entity
- `Shop` - Tenant/shop entity
- `PlatformConfig` - Platform integration settings

### 4. Infrastructure Layer (`infrastructure/`, `client/`)

**Responsibility**: External concerns, I/O, third-party integrations

**Dependency Injection Container**:
```rust
// infrastructure/app/container.rs
pub struct App {
    pub product_service: Arc<dyn ProductService>,
    pub vector_service: Arc<dyn VectorService>,
    pub product_repo: Arc<dyn ProductRepository>,
    pub cache: Arc<dyn Cache>,
    pub queue: Arc<dyn Queue>,
    // ...
}
```

**Infrastructure Components**:

| Component | Technology | Purpose |
|-----------|------------|---------|
| Database | ClickHouse | Analytics, time-series data |
| Vector DB | Qdrant | Semantic search, embeddings |
| Cache | Redis | Session, rate limiting, caching |
| Queue | RabbitMQ | Async job processing |
| Auth | Casbin | RBAC authorization |
| Metrics | Prometheus | Observability |
| Logging | Tracing | Structured logging |

---

## Data Flow

### Request Lifecycle

```
┌─────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ Client  │────▶│   Router    │────▶│  Middleware │────▶│   Handler   │
└─────────┘     └─────────────┘     └─────────────┘     └──────┬──────┘
                                                               │
                                                               ▼
┌─────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ Client  │◀────│   Response  │◀────│   Handler   │◀────│   Service   │
└─────────┘     └─────────────┘     └─────────────┘     └──────┬──────┘
                                                               │
                                                               ▼
┌─────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Store  │◀────│    Repo     │◀────│    Client   │◀────│  Repository │
└─────────┘     └─────────────┘     └─────────────┘     └─────────────┘
```

### Product Sync Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Platform   │────▶│   Webhook    │────▶│   Product    │
│   Webhook    │     │   Handler    │     │   Ingest     │
└──────────────┘     └──────────────┘     └──────┬───────┘
                                                 │
                                                 ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Vector     │◀────│   Product    │◀────│   Queue      │
│   Database   │     │   Consumer   │     │ (RabbitMQ)   │
└──────────────┘     └──────────────┘     └──────────────┘
```

---

## Technology Stack

| Category | Technology | Version |
|----------|------------|---------|
| **Language** | Rust | 2021 Edition |
| **Web Framework** | Axum | 0.7 |
| **Async Runtime** | Tokio | 1.x |
| **HTTP Client** | Reqwest | 0.12 |
| **Serialization** | Serde | 1.0 |
| **Validation** | Validator | 0.18 |
| **Error Handling** | Anyhow, Thiserror | 1.0 |
| **Database** | ClickHouse | 24.x |
| **ORM** | Sea-ORM | 0.12 |
| **Vector DB** | Qdrant | 1.10 |
| **Cache** | Redis | 0.27 |
| **Message Queue** | Lapin (RabbitMQ) | 2.5 |
| **Authentication** | JWT (jsonwebtoken) | 9.3 |
| **Authorization** | Casbin | 2.3 |
| **API Docs** | Utoipa, Aide | 4.2, 0.13 |
| **Observability** | OpenTelemetry | 0.22 |
| **Metrics** | Prometheus | 0.13 |
| **Logging** | Tracing | 0.1 |
| **CLI** | Clap | 4.5 |

---

## Runtime Modes

The application supports 3 runtime modes via CLI arguments:

### 1. Web Service Mode (Full)

```bash
cargo run -- web-service --port 8080
```

Runs the complete API server with:
- Gateway APIs (external clients)
- Platform APIs (internal management)
- Background job dispatchers

### 2. Gateway Mode (Lightweight)

```bash
cargo run -- gateway --port 8081
```

Lightweight mode for:
- High-throughput gateway operations
- Stateless request handling
- No background processing

### 3. Consumer Mode (Workers)

```bash
cargo run -- consumer --tasks "product-sync-to-ch-list"
```

Background worker for:
- Queue consumption
- Product synchronization
- Vector embedding generation

---

## Key Components

### E-commerce Platform Connectors

The system integrates with 20+ e-commerce platforms:

| Platform | Module | Features |
|----------|--------|----------|
| TikTok Shop | `tiktok` | Products, orders, auth |
| Shopee | `shopee` | Products, orders, logistics |
| Lazada | `lazada` | Products, orders |
| Shopify | `shopify` | Products, webhooks |
| WooCommerce | `woocommerce` | REST API integration |
| Amazon | `amazon` | SP-API integration |
| eBay | `ebay` | Trading API |
| Etsy | `etsy` | Open API |
| BigCommerce | `bigcommerce` | V3 API |
| ... | ... | ... |

### Vector Search Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Product    │────▶│   Embedding  │────▶│    Qdrant    │
│   Update     │     │   Service    │     │   (Vector)   │
└──────────────┘     └──────────────┘     └──────────────┘
                                                 │
┌──────────────┐     ┌──────────────┐     ┌────┴─────────┐
│   Search     │◀────│    Vector    │◀────│   Similarity │
│   Results    │     │    Search    │     │    Search    │
└──────────────┘     └──────────────┘     └──────────────┘
```

### Authentication Flow

```
Client ──▶ Auth Middleware ──▶ Token Validation ──▶ Casbin Enforcer ──▶ Handler
              │                       │                      │
              ▼                       ▼                      ▼
         x-auth-token           JWT Verify           RBAC Check
```

---

## Configuration

Configuration is loaded from `config.yaml`:

```yaml
server:
  host: 0.0.0.0
  port: 8080
  workers: 4

database:
  clickhouse_url: http://localhost:8123
  clickhouse_user: default
  clickhouse_password: default
  
cache:
  redis_url: redis://localhost:6379
  ttl: 3600

queue:
  rabbitmq_url: amqp://guest:guest@localhost:5672
  prefetch_count: 10

platforms:
  tiktok:
    app_key: ${TIKTOK_APP_KEY}
    app_secret: ${TIKTOK_APP_SECRET}
    sandbox: false
```

---

## Testing Strategy

| Type | Framework | Location |
|------|-----------|----------|
| Unit Tests | Built-in + Mockall | `src/**/tests/` |
| Integration Tests | Cargo test | `tests/` |
| Load Tests | k6 / Locust | `benchmarks/` |

---

## Deployment

### Docker Build

```dockerfile
# Multi-stage build
FROM rust:1.75 as builder
WORKDIR /app
COPY . .
RUN cargo build --release

FROM debian:bookworm-slim
COPY --from=builder /app/target/release/ecommerce-connect /usr/local/bin/
CMD ["ecommerce-connect", "web-service"]
```

### Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ecommerce-api
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: api
        image: playfield/ecommerce-connect:latest
        command: ["ecommerce-connect", "web-service"]
        ports:
        - containerPort: 8080
```

---

## Contributing

1. Follow the existing module structure
2. Add traits to `interfaces/` before implementations
3. Update `infrastructure/app/container.rs` for new dependencies
4. Write tests for repositories and services
5. Update API docs in `docs/v1/`

---

## Resources

- [Axum Documentation](https://docs.rs/axum/latest/axum/)
- [Tokio](https://tokio.rs/)
- [Sea-ORM](https://www.sea-ql.org/SeaORM/)
- [Casbin RS](https://github.com/casbin/casbin-rs)
