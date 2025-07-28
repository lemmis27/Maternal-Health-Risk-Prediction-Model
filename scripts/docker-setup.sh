#!/bin/bash

# Docker Setup Script for Maternal Health System
# This script helps set up the Docker environment

set -e

echo "🏥 Maternal Health System - Docker Setup"
echo "========================================"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Create necessary directories
echo "📁 Creating necessary directories..."
mkdir -p logs models data ssl

# Copy environment file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.docker .env
    echo "⚠️  Please edit .env file with your configuration before running the application"
fi

# Generate a random secret key if needed
if grep -q "your-super-secret-key" .env; then
    echo "🔐 Generating random secret key..."
    SECRET_KEY=$(openssl rand -base64 32)
    sed -i "s/your-super-secret-key-change-this-in-production-make-it-long-and-random/$SECRET_KEY/g" .env
fi

# Build images
echo "🔨 Building Docker images..."
docker-compose build

echo "✅ Docker setup completed!"
echo ""
echo "Next steps:"
echo "1. Review and edit .env file if needed"
echo "2. Run 'docker-compose up -d' to start the application"
echo "3. Run 'docker-compose logs -f' to view logs"
echo "4. Access the application at http://localhost:8000"
echo ""
echo "For development:"
echo "- Use 'docker-compose -f docker-compose.dev.yml up' for development mode"
echo "- Frontend will be available at http://localhost:3000"
echo "- Backend will be available at http://localhost:8000"