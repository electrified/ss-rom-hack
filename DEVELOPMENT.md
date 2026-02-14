# Development Setup Guide

This guide explains how to set up the development environment for SS MD Hack with all required dependencies (PostgreSQL, Redis).

## Quick Start

```bash
# 1. Run setup script
./scripts/setup-dev.sh

# 2. Create virtual environment and install dependencies
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt

# 3. Run migrations
make migrate

# 4. Start development server
make dev
```

## Prerequisites

- Docker and Docker Compose
- Python 3.11+ (Python 3.14 may have compatibility issues with some packages)
- Make (optional, for convenience commands)

## Architecture

```
┌─────────────────┐     ┌─────────────┐     ┌─────────────┐
│   Your Laptop   │     │   Docker    │     │   Docker    │
│                 │     │             │     │             │
│  ┌───────────┐  │     │  ┌───────┐  │     │  ┌───────┐  │
│  │  Backend  │──┼─────┼──│PostgreSQL│  │     │  │ Redis │  │
│  │   (App)   │  │     │  │  :5432  │  │     │  │ :6379 │  │
│  └───────────┘  │     │  └───────┘  │     │  └───────┘  │
│       │         │     │      │      │     │      │      │
│       ▼         │     │      ▼      │     │      ▼      │
│  ./data/roms    │     │  (Volume)   │     │ (Memory)    │
└─────────────────┘     └─────────────┘     └─────────────┘
```

## Using Make Commands

The easiest way to manage dependencies is using the Makefile:

```bash
# Start PostgreSQL and Redis
make deps-up

# Stop dependencies
make deps-down

# View logs
make deps-logs

# Run migrations
make migrate

# Start dev server
make dev

# Check health
make check

# Full setup
make setup
```

## Manual Setup

### 1. Start Dependencies

```bash
# Start PostgreSQL and Redis
docker-compose -f docker-compose.deps.yml up -d

# Check status
docker-compose -f docker-compose.deps.yml ps

# View logs
docker-compose -f docker-compose.deps.yml logs -f
```

### 2. Setup Python Environment

```bash
# Create virtual environment
python3 -m venv .venv

# Activate it
source .venv/bin/activate

# Install dependencies
pip install -r backend/requirements.txt
```

### 3. Environment Variables

Create a `.env` file in the project root:

```env
# Database
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/ssmdhack

# Redis
REDIS_URL=redis://localhost:6379/0
REDIS_SESSION_TTL=1800

# Storage
STORAGE_PATH=./data/roms
ROM_RETENTION_DAYS=30

# Admin
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=$2b$12$LRqQQr4r4mQP9vQYdFLovemX9jL8P4F5E6Z5Q7Z8Z9Z0Z1Z2Z3Z4Z

# App
LOG_LEVEL=INFO
METRICS_ENABLED=true
```

### 4. Run Database Migrations

```bash
alembic -c backend/alembic.ini upgrade head
```

### 5. Create ROM Storage Directory

```bash
mkdir -p data/roms
```

### 6. Start Development Server

```bash
cd backend
python main.py
```

The API will be available at `http://localhost:8000`

## Accessing Services

### PostgreSQL

```bash
# Connect using docker
make deps-up  # ensure it's running
docker-compose -f docker-compose.deps.yml exec postgres psql -U postgres -d ssmdhack

# Or use local psql if installed
psql -h localhost -U postgres -d ssmdhack
```

### Redis

```bash
# Connect using docker
docker-compose -f docker-compose.deps.yml exec redis redis-cli

# Or use local redis-cli if installed
redis-cli -h localhost -p 6379
```

## Common Operations

### Reset Database (⚠️ Deletes all data)

```bash
make reset-db
```

### Create New Migration

```bash
make migrate-create
# Enter migration message when prompted
```

### Check Service Health

```bash
make check
```

### View Logs

```bash
# Dependencies
make deps-logs

# App (in another terminal)
cd backend && python main.py 2>&1 | jq
```

## Troubleshooting

### Import Error: No module named 'backend'

Make sure you're running commands from the project root:
```bash
cd /home/ed/dev/ss-md-hack
alembic -c backend/alembic.ini upgrade head
```

### Connection Refused to PostgreSQL

1. Check if PostgreSQL is running:
   ```bash
   docker-compose -f docker-compose.deps.yml ps
   ```

2. Check logs:
   ```bash
   docker-compose -f docker-compose.deps.yml logs postgres
   ```

3. Restart if needed:
   ```bash
   docker-compose -f docker-compose.deps.yml restart postgres
   ```

### Redis Connection Error

1. Check Redis status:
   ```bash
   docker-compose -f docker-compose.deps.yml exec redis redis-cli ping
   ```

2. Should return `PONG`

### Python 3.14 Issues

If you encounter build errors with pydantic-core or asyncpg on Python 3.14, you have two options:

**Option 1: Use Python 3.11-3.13**
```bash
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
```

**Option 2: Use Docker for everything**
See `docker-compose.yml` for a full containerized setup.

## Full Docker Setup (Alternative)

If you prefer everything in Docker:

```bash
# Build and start all services
docker-compose up --build

# Or use the full docker-compose.yml
docker-compose -f docker-compose.full.yml up --build
```

## Production Considerations

When deploying to production:

1. **Change default passwords** in `.env`
2. **Generate a new admin password hash**:
   ```python
   import bcrypt
   password = "your-secure-password"
   hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt())
   print(hashed.decode())
   ```
3. **Use SSL/TLS** for database connections
4. **Enable persistent storage** for ROMs (already configured in PVC)
5. **Set up monitoring** with Prometheus/Grafana
6. **Configure backups** for PostgreSQL

## Kubernetes Deployment

For Kubernetes deployment, see the Helm chart:

```bash
cd helm/ss-md-hack
helm dependency update
helm install ssmdhack . -f values.yaml
```

## Useful Commands

```bash
# List running containers
docker-compose -f docker-compose.deps.yml ps

# Stop all dependencies
docker-compose -f docker-compose.deps.yml down

# Remove volumes (deletes all data)
docker-compose -f docker-compose.deps.yml down -v

# Rebuild everything
docker-compose -f docker-compose.deps.yml up -d --force-recreate

# View resource usage
docker stats
```

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review logs: `make deps-logs`
3. Check service health: `make check`
4. File an issue on GitHub
