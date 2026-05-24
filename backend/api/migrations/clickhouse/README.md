# ClickHouse Migrations

This directory contains database migrations for the ClickHouse database used by the e-commerce connector platform.

## Migration Files

### 001_country_support.sql

**Purpose**: Adds comprehensive country support and custom platform functionality.

**Key Changes**:
1. **Country Lookup Table**: Contains 58 countries with their codes, names, regions, currencies, languages, and timezones
2. **Platform Country Support Table**: Maps each platform to its supported countries with specific API endpoints
3. **Custom Platform Configuration**: Supports user-defined platform integrations with flexible authentication
4. **Enhanced Product/Shop Tables**: Adds country_code, currency_code, and sales_regions columns
5. **Platform Country Metrics**: Tracks platform performance by country
6. **Materialized Views**: Optimized country-based statistics
7. **Indexes**: Improved query performance for country-based searches

**New Platform Support**:
- Added support for platform ID 23 (Custom) for user-defined integrations

### 001_country_support_rollback.sql

**Purpose**: Rollback script to undo all changes from 001_country_support.sql

## Running Migrations

### Prerequisites

1. Ensure ClickHouse client is installed:
```bash
# macOS
brew install clickhouse

# Linux
sudo apt-get install clickhouse-client
```

2. Set environment variables:
```bash
export CLICKHOUSE_HOST=localhost
export CLICKHOUSE_PORT=9000
export CLICKHOUSE_USER=default
export CLICKHOUSE_PASSWORD=default
export CLICKHOUSE_DATABASE=ecommerce
```

### Running Migrations

**Run all pending migrations:**
```bash
./run_migration.sh up
```

**Run specific migration:**
```bash
./run_migration.sh up 001
```

**Rollback specific migration:**
```bash
./run_migration.sh down 001
```

**Check migration status:**
```bash
./run_migration.sh status
```

## Manual Execution

If you prefer to run migrations manually:

**Apply migration:**
```bash
clickhouse-client \
    --host=localhost \
    --user=default \
    --password=default \
    --database=ecommerce \
    --multiquery \
    --queries-file=001_country_support.sql
```

**Rollback migration:**
```bash
clickhouse-client \
    --host=localhost \
    --user=default \
    --password=default \
    --database=ecommerce \
    --multiquery \
    --queries-file=001_country_support_rollback.sql
```

## Country Support Details

The migration adds support for 58 countries across different regions:

### Asia Pacific (17 countries)
- Singapore, Malaysia, Thailand, Indonesia, Philippines, Vietnam
- China, Japan, South Korea, India
- Pakistan, Bangladesh, Sri Lanka, Nepal, Myanmar
- Hong Kong, Taiwan

### Americas (7 countries)
- United States, Canada, Mexico
- Brazil, Argentina, Chile, Colombia

### Europe (22 countries)
- United Kingdom, Germany, France, Italy, Spain
- Netherlands, Poland, Sweden, Ireland, Belgium
- Austria, Switzerland, Portugal, Denmark, Norway
- Finland, Greece, Czech Republic, Romania, Hungary
- Russia, Turkey

### Middle East & Africa (7 countries)
- United Arab Emirates, Saudi Arabia, Egypt
- South Africa, Nigeria, Kenya, Israel

### Oceania (2 countries)
- Australia, New Zealand

### Global
- Support for worldwide/global operations

## Platform-Specific Country Support

Each platform has specific country support configured:

- **Lazada**: 6 Southeast Asian countries with regional API endpoints
- **Shopee**: 11 countries including Southeast Asia and Latin America
- **TikTok Shop**: 8+ countries across US, UK, and Southeast Asia
- **Amazon**: 20 countries with regional API endpoints
- **Alibaba**: China and South Asian countries via Daraz
- **AliExpress**: Global platform with 13+ specific countries
- **eBay**: 15+ countries with global support
- **Custom Platform**: Fully configurable for any country

## Custom Platform Configuration

The custom platform (ID: 23) supports flexible configuration:

- **Authentication Types**: OAuth2, API Key, Bearer Token, Basic Auth, Custom
- **Configurable Endpoints**: Products, Categories, Orders, Inventory
- **Country-Specific Settings**: Different API URLs and settings per country
- **Custom Headers**: Support for platform-specific headers
- **Stored in**: `custom_platform_config` table

## Performance Optimizations

The migration includes several performance optimizations:

1. **Indexes**: Added bloom filter and set indexes for country-based queries
2. **Materialized Views**: Pre-aggregated country statistics
3. **Partitioning**: Tables partitioned by month for better query performance
4. **SummingMergeTree**: Used for metrics tables to optimize aggregations

## Troubleshooting

**Connection Issues:**
- Verify ClickHouse is running: `clickhouse-client --query="SELECT 1"`
- Check connection parameters in environment variables
- Ensure database exists: `clickhouse-client --query="SHOW DATABASES"`

**Migration Failures:**
- Check ClickHouse logs: `/var/log/clickhouse-server/clickhouse-server.log`
- Verify table structures before running migrations
- Use rollback script if migration partially fails

**Performance Issues:**
- Monitor query performance: `SHOW PROCESSLIST`
- Check table sizes: `SELECT table, formatReadableSize(sum(bytes)) FROM system.parts GROUP BY table`
- Optimize tables if needed: `OPTIMIZE TABLE table_name FINAL`

## Best Practices

1. **Always backup before migrations**: `clickhouse-client --query="CREATE DATABASE ecommerce_backup AS ecommerce"`
2. **Test in development first**: Run migrations on a test database
3. **Monitor after deployment**: Check query performance and table sizes
4. **Document changes**: Update this README when adding new migrations