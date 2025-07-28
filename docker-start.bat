@echo off
REM Quick Docker Start Script for Maternal Health System (Windows)
REM This script provides a simple way to get the system running

echo 🏥 Maternal Health System - Quick Start
echo ======================================

REM Check prerequisites
echo 🔍 Checking prerequisites...

docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker is not installed. Please install Docker Desktop first.
    echo    Visit: https://docs.docker.com/desktop/windows/install/
    pause
    exit /b 1
)

docker-compose --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker Compose is not installed. Please install Docker Compose first.
    echo    Visit: https://docs.docker.com/compose/install/
    pause
    exit /b 1
)

echo ✅ Docker and Docker Compose are installed

REM Create directories
echo 📁 Creating necessary directories...
if not exist logs mkdir logs
if not exist models mkdir models
if not exist data mkdir data
if not exist ssl mkdir ssl
if not exist scripts mkdir scripts

REM Setup environment file
if not exist .env (
    echo 📝 Creating .env file...
    copy .env.docker .env
    echo ⚠️  Please manually update SECRET_KEY in .env file for production
)

REM Ask user for mode
echo.
echo Choose deployment mode:
echo 1^) Development ^(with hot reload, separate frontend/backend^)
echo 2^) Production ^(optimized, single container^)
echo 3^) Production with Nginx ^(recommended for production^)
echo.

set /p choice="Enter choice (1-3): "

if "%choice%"=="1" (
    echo 🚀 Starting in development mode...
    docker-compose -f docker-compose.dev.yml down >nul 2>&1
    docker-compose -f docker-compose.dev.yml up --build
) else if "%choice%"=="2" (
    echo 🚀 Starting in production mode...
    docker-compose down >nul 2>&1
    docker-compose up -d --build
    echo.
    echo ✅ Application started successfully!
    echo 🌐 Access at: http://localhost:8000
    echo 📚 API docs: http://localhost:8000/docs
    echo 📊 View logs: docker-compose logs -f
    echo 🛑 Stop: docker-compose down
) else if "%choice%"=="3" (
    echo 🚀 Starting in production mode with Nginx...
    docker-compose down >nul 2>&1
    docker-compose --profile production up -d --build
    echo.
    echo ✅ Application started successfully!
    echo 🌐 Access at: http://localhost ^(port 80^)
    echo 🔒 HTTPS: http://localhost:443 ^(configure SSL first^)
    echo 📚 API docs: http://localhost/docs
    echo 📊 View logs: docker-compose logs -f
    echo 🛑 Stop: docker-compose --profile production down
) else (
    echo ❌ Invalid choice. Exiting.
    pause
    exit /b 1
)

echo.
echo 🎉 Setup complete! Check the logs above for any issues.
echo 📖 For more details, see DOCKER_README.md

pause