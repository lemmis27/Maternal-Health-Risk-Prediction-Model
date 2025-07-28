#!/bin/bash

# Quick Docker Start Script for Maternal Health System
# This script provides a simple way to get the system running

set -e

echo "🏥 Maternal Health System - Quick Start"
echo "======================================"

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
echo "🔍 Checking prerequisites..."

if ! command_exists docker; then
    echo "❌ Docker is not installed. Please install Docker first."
    echo "   Visit: https://docs.docker.com/get-docker/"
    exit 1
fi

if ! command_exists docker-compose; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    echo "   Visit: https://docs.docker.com/compose/install/"
    exit 1
fi

echo "✅ Docker and Docker Compose are installed"

# Create directories
echo "📁 Creating necessary directories..."
mkdir -p logs models data ssl scripts

# Setup environment file
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cp .env.docker .env
    
    # Generate random secret key
    if command_exists openssl; then
        SECRET_KEY=$(openssl rand -base64 32)
        sed -i.bak "s/your-super-secret-key-change-this-in-production-make-it-long-and-random/$SECRET_KEY/g" .env
        rm .env.bak 2>/dev/null || true
        echo "🔐 Generated random secret key"
    else
        echo "⚠️  Please manually update SECRET_KEY in .env file"
    fi
fi

# Ask user for mode
echo ""
echo "Choose deployment mode:"
echo "1) Development (with hot reload, separate frontend/backend)"
echo "2) Production (optimized, single container)"
echo "3) Production with Nginx (recommended for production)"

read -p "Enter choice (1-3): " choice

case $choice in
    1)
        echo "🚀 Starting in development mode..."
        docker-compose -f docker-compose.dev.yml down 2>/dev/null || true
        docker-compose -f docker-compose.dev.yml up --build
        ;;
    2)
        echo "🚀 Starting in production mode..."
        docker-compose down 2>/dev/null || true
        docker-compose up -d --build
        echo ""
        echo "✅ Application started successfully!"
        echo "🌐 Access at: http://localhost:8000"
        echo "📚 API docs: http://localhost:8000/docs"
        echo "📊 View logs: docker-compose logs -f"
        echo "🛑 Stop: docker-compose down"
        ;;
    3)
        echo "🚀 Starting in production mode with Nginx..."
        docker-compose down 2>/dev/null || true
        docker-compose --profile production up -d --build
        echo ""
        echo "✅ Application started successfully!"
        echo "🌐 Access at: http://localhost (port 80)"
        echo "🔒 HTTPS: http://localhost:443 (configure SSL first)"
        echo "📚 API docs: http://localhost/docs"
        echo "📊 View logs: docker-compose logs -f"
        echo "🛑 Stop: docker-compose --profile production down"
        ;;
    *)
        echo "❌ Invalid choice. Exiting."
        exit 1
        ;;
esac

echo ""
echo "🎉 Setup complete! Check the logs above for any issues."
echo "📖 For more details, see DOCKER_README.md"