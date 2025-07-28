#!/bin/bash

# Start production environment
echo "🚀 Starting Maternal Health System in production mode..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found. Please run docker-setup.sh first."
    exit 1
fi

# Stop any running containers
docker-compose down

# Start production environment
docker-compose up -d --build

echo "✅ Production environment started!"
echo "Application: http://localhost:8000"
echo "Database: localhost:5432"
echo "Redis: localhost:6379"
echo ""
echo "To view logs: docker-compose logs -f"
echo "To stop: docker-compose down"