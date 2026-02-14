.PHONY: help deps-up deps-down deps-logs setup dev migrate test clean

# Default target
help:
	@echo "SS MD Hack Development Commands"
	@echo "================================"
	@echo ""
	@echo "Setup:"
	@echo "  make setup          - Run full development setup"
	@echo "  make deps-up        - Start PostgreSQL and Redis"
	@echo "  make deps-down      - Stop PostgreSQL and Redis"
	@echo "  make deps-logs      - View dependency logs"
	@echo ""
	@echo "Development:"
	@echo "  make migrate        - Run database migrations"
	@echo "  make dev            - Start development server"
	@echo "  make test           - Run tests"
	@echo ""
	@echo "Cleanup:"
	@echo "  make clean          - Stop deps and clean up"
	@echo "  make clean-all      - Stop deps and remove volumes"

# Setup development environment
setup:
	./scripts/setup-dev.sh

# Start dependencies
deps-up:
	docker-compose -f docker-compose.deps.yml up -d
	@echo "Waiting for services..."
	@sleep 3
	@docker-compose -f docker-compose.deps.yml ps

# Stop dependencies
deps-down:
	docker-compose -f docker-compose.deps.yml down

# View dependency logs
deps-logs:
	docker-compose -f docker-compose.deps.yml logs -f

# Run database migrations
migrate:
	alembic -c backend/alembic.ini upgrade head

# Create new migration
migrate-create:
	@read -p "Migration message: " msg; \
	alembic -c backend/alembic.ini revision -m "$$msg"

# Start development server
dev:
	cd backend && python main.py

# Run tests
test:
	pytest tests/ -v

# Clean up (stop deps)
clean: deps-down

# Clean everything including volumes
clean-all:
	docker-compose -f docker-compose.deps.yml down -v
	rm -rf data/roms

# Check service health
check:
	@echo "Checking PostgreSQL..."
	@docker-compose -f docker-compose.deps.yml exec postgres pg_isready -U postgres || echo "PostgreSQL is not running"
	@echo "Checking Redis..."
	@docker-compose -f docker-compose.deps.yml exec redis redis-cli ping || echo "Redis is not running"

# Reset database (DANGER: deletes all data)
reset-db:
	@echo "WARNING: This will delete all data!"
	@read -p "Are you sure? [y/N] " confirm && [ $$confirm = y ] || exit 1
	docker-compose -f docker-compose.deps.yml down -v
	docker-compose -f docker-compose.deps.yml up -d
	@sleep 5
	make migrate
