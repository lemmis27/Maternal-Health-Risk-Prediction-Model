@echo off
REM Docker Setup Script for Maternal Health System (Windows)
REM This script helps set up the Docker environment

echo 🏥 Maternal Health System - Docker Setup
echo ========================================

REM Check if Docker is installed
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker is not installed. Please install Docker Desktop first.
    pause
    exit /b 1
)

REM Check if Docker Compose is installed
docker-compose --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker Compose is not installed. Please install Docker Compose first.
    pause
    exit /b 1
)

REM Create necessary directories
echo 📁 Creating necessary directories...
if not exist logs mkdir logs
if not exist models mkdir models
if not exist data mkdir data
if not exist ssl mkdir ssl

REM Copy environment file if it doesn't exist
if not exist .env (
    echo 📝 Creating .env file from template...
    copy .env.docker .env
    echo ⚠️  Please edit .env file with your configuration before running the application
)

REM Build images
echo 🔨 Building Docker images...
docker-compose build

echo ✅ Docker setup completed!
echo.
echo Next steps:
echo 1. Review and edit .env file if needed
echo 2. Run 'docker-compose up -d' to start the application
echo 3. Run 'docker-compose logs -f' to view logs
echo 4. Access the application at http://localhost:8000
echo.
echo For development:
echo - Use 'docker-compose -f docker-compose.dev.yml up' for development mode
echo - Frontend will be available at http://localhost:3000
echo - Backend will be available at http://localhost:8000

pause