#!/bin/bash
# Quick rebuild and restart script

echo "🔄 Rebuilding and restarting the app container..."
docker-compose build app
docker-compose up -d app

echo ""
echo "✅ App restarted! View logs with:"
echo "docker-compose logs -f app"
