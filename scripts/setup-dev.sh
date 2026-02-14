#!/bin/bash
# Development environment setup script

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Setting up SS MD Hack development environment...${NC}"

# Check if docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed${NC}"
    echo "Please install Docker first: https://docs.docker.com/get-docker/"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}Error: docker-compose is not installed${NC}"
    echo "Please install docker-compose first"
    exit 1
fi

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo -e "${YELLOW}Creating .env file...${NC}"
    cat > .env <<EOF
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
ADMIN_PASSWORD_HASH=\$2b\$12\$LRqQQr4r4mQP9vQYdFLovemX9jL8P4F5E6Z5Q7Z8Z9Z0Z1Z2Z3Z4Z

# App
LOG_LEVEL=INFO
METRICS_ENABLED=true
EOF
fi

# Start dependencies
echo -e "${YELLOW}Starting PostgreSQL and Redis...${NC}"
docker-compose -f docker-compose.deps.yml up -d

# Wait for services to be ready
echo -e "${YELLOW}Waiting for services to be ready...${NC}"
sleep 5

# Check PostgreSQL
until docker-compose -f docker-compose.deps.yml exec -T postgres pg_isready -U postgres > /dev/null 2>&1; do
    echo -e "${YELLOW}Waiting for PostgreSQL...${NC}"
    sleep 2
done
echo -e "${GREEN}PostgreSQL is ready!${NC}"

# Check Redis
until docker-compose -f docker-compose.deps.yml exec -T redis redis-cli ping > /dev/null 2>&1; do
    echo -e "${YELLOW}Waiting for Redis...${NC}"
    sleep 2
done
echo -e "${GREEN}Redis is ready!${NC}"

# Create data directory
mkdir -p data/roms

echo -e "${GREEN}Development environment is ready!${NC}"
echo ""
echo "Next steps:"
echo "1. Create virtual environment: python3 -m venv .venv"
echo "2. Activate it: source .venv/bin/activate"
echo "3. Install dependencies: pip install -r backend/requirements.txt"
echo "4. Run migrations: alembic -c backend/alembic.ini upgrade head"
echo "5. Start the app: cd backend && python main.py"
echo ""
echo "To stop dependencies: docker-compose -f docker-compose.deps.yml down"
