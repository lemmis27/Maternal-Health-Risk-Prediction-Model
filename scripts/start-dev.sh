#!/bin/bash

# Start development environment
echo "🚀 Starting Maternal Health System in development mode..."

# Stop any running containers
docker-compose -f docker-compose.dev.yml down

# Start development environment
docker-compose -f docker-compose.dev.yml up --build

echo "🏥 Development environment started!"
echo "Frontend: http://localhost:3000"
echo "Backend: http://localhost:8000"
echo "Database: localhost:5432"
echo "Redis: localhost:6379"