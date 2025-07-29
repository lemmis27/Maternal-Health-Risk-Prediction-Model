#!/bin/bash

# Docker setup script for maternal health system
# This script will properly rebuild the frontend and backend

echo "🚀 Setting up Maternal Health System with Frontend Rebuild"
echo "=========================================================="

# Stop any existing containers
echo "🛑 Stopping existing containers..."
docker-compose -f docker-compose.dev.yml down
docker-compose down

# Remove old images to force rebuild
echo "🗑️ Removing old images..."
docker rmi maternal_health_project-app 2>/dev/null || true
docker rmi maternal_health_project_app_dev 2>/dev/null || true

# Clean up unused Docker resources
echo "🧹 Cleaning up Docker resources..."
docker system prune -f

# Build with no cache to ensure fresh build
echo "🔨 Building containers with fresh frontend..."
docker-compose -f docker-compose.dev.yml build --no-cache

# Start the services
echo "🚀 Starting services..."
docker-compose -f docker-compose.dev.yml up -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 10

# Check service status
echo "📊 Checking service status..."
docker-compose -f docker-compose.dev.yml ps

# Test the API
echo "🧪 Testing API..."
sleep 5
curl -f http://localhost:8000/health && echo "✅ API is healthy!" || echo "❌ API health check failed"

# Show logs
echo "📋 Recent logs:"
docker-compose -f docker-compose.dev.yml logs --tail=20 app

echo ""
echo "✅ Setup complete!"
echo "🌐 Frontend: http://localhost:8000"
echo "🔧 API: http://localhost:8000/docs"
echo "📊 Health: http://localhost:8000/health"
echo ""
echo "To view logs: docker-compose -f docker-compose.dev.yml logs -f app"
echo "To stop: docker-compose -f docker-compose.dev.yml down"