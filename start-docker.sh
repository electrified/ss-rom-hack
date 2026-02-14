#!/bin/bash
# Quick start script for Docker-based development

set -e

echo "🚀 Starting SS MD Hack with Docker..."
echo ""

# Build and start all services
echo "📦 Building and starting services..."
docker-compose up --build -d

echo ""
echo "⏳ Waiting for services to be ready..."
sleep 10

# Check status
echo ""
echo "📊 Service Status:"
docker-compose ps

echo ""
echo "✅ SS MD Hack is starting up!"
echo ""
echo "Services:"
echo "  - App: http://localhost:8000"
echo "  - API Docs: http://localhost:8000/docs"
echo "  - Admin: http://localhost:8000/#/admin"
echo ""
echo "Default admin credentials:"
echo "  Username: admin"
echo "  Password: (see docker-compose.yml)"
echo ""
echo "View logs: docker-compose logs -f"
echo "Stop: docker-compose down"
echo ""
