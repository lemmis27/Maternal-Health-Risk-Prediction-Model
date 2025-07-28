# 🏥 Maternal Health System - Docker Setup Guide

This guide will help you containerize and run the Maternal Health Risk Prediction System using Docker.

## 📋 Prerequisites

- Docker Desktop (Windows/Mac) or Docker Engine (Linux)
- Docker Compose v2.0+
- At least 4GB RAM available for containers
- 10GB free disk space

## 🚀 Quick Start

### 1. Initial Setup

**Windows:**
```cmd
scripts\docker-setup.bat
```

**Linux/Mac:**
```bash
chmod +x scripts/*.sh
./scripts/docker-setup.sh
```

### 2. Development Mode

**Start development environment:**
```bash
# Linux/Mac
./scripts/start-dev.sh

# Windows
docker-compose -f docker-compose.dev.yml up --build
```

**Access the application:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Documentation: http://localhost:8000/docs

### 3. Production Mode

**Start production environment:**
```bash
# Linux/Mac
./scripts/start-prod.sh

# Windows
docker-compose up -d --build
```

**Access the application:**
- Application: http://localhost:8000
- API Documentation: http://localhost:8000/docs

## 🏗️ Architecture

The Docker setup includes:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend      │    │   Database      │
│   (React)       │◄──►│   (FastAPI)     │◄──►│  (PostgreSQL)   │
│   Port: 3000    │    │   Port: 8000    │    │   Port: 5432    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │     Redis       │
                       │   (Caching)     │
                       │   Port: 6379    │
                       └─────────────────┘
```

## 📁 Project Structure

```
maternal_health_project/
├── Dockerfile                 # Production container
├── Dockerfile.dev            # Development container
├── docker-compose.yml        # Production setup
├── docker-compose.dev.yml    # Development setup
├── .dockerignore             # Docker ignore rules
├── .env.docker              # Environment template
├── nginx.conf               # Nginx configuration
├── init.sql                 # Database initialization
├── scripts/
│   ├── docker-setup.sh      # Setup script (Linux/Mac)
│   ├── docker-setup.bat     # Setup script (Windows)
│   ├── start-dev.sh         # Start development
│   └── start-prod.sh        # Start production
└── frontend/
    └── Dockerfile.dev       # Frontend development container
```

## ⚙️ Configuration

### Environment Variables

Edit `.env` file after running setup:

```env
# Database
DATABASE_URL=postgresql://postgres:postgres@db:5432/maternal_health

# Security
SECRET_KEY=your-super-secret-key-change-this-in-production

# Redis
REDIS_URL=redis://redis:6379

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8000

# Application
DEBUG=false
LOG_LEVEL=INFO
```

### Database Configuration

The system uses PostgreSQL in production and development. SQLite is used for local development without Docker.

**Connection Details:**
- Host: localhost (from host machine) or db (from containers)
- Port: 5432
- Database: maternal_health (prod) / maternal_health_dev (dev)
- Username: postgres
- Password: postgres

## 🔧 Development Workflow

### Hot Reload Development

Development mode provides:
- **Backend**: Hot reload with uvicorn
- **Frontend**: Hot reload with React dev server
- **Database**: Persistent PostgreSQL
- **Caching**: Redis for session management

### Making Changes

1. **Backend changes**: Modify Python files - auto-reload enabled
2. **Frontend changes**: Modify React files - auto-reload enabled
3. **Database changes**: Use Alembic migrations
4. **Dependencies**: Rebuild containers after adding new packages

### Database Migrations

```bash
# Create migration
docker-compose exec app alembic revision --autogenerate -m "description"

# Apply migrations
docker-compose exec app alembic upgrade head
```

## 🚀 Production Deployment

### Security Considerations

1. **Change default passwords** in `.env`
2. **Use strong SECRET_KEY**
3. **Configure HTTPS** with SSL certificates
4. **Set up proper CORS origins**
5. **Use environment-specific secrets**

### With Nginx (Recommended)

```bash
# Start with Nginx reverse proxy
docker-compose --profile production up -d
```

### SSL/HTTPS Setup

1. Place SSL certificates in `./ssl/` directory
2. Uncomment HTTPS configuration in `nginx.conf`
3. Update `ALLOWED_ORIGINS` for HTTPS URLs

## 📊 Monitoring & Logs

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f app
docker-compose logs -f db
docker-compose logs -f redis
```

### Health Checks

- Application: http://localhost:8000/health
- Database: Built-in PostgreSQL health check
- Redis: Built-in Redis health check

### Performance Monitoring

The application includes:
- Request rate limiting
- Database connection pooling
- Redis caching
- SHAP model explanations
- Audit logging

## 🛠️ Troubleshooting

### Common Issues

**Port conflicts:**
```bash
# Check what's using the port
netstat -tulpn | grep :8000

# Stop conflicting services
docker-compose down
```

**Database connection issues:**
```bash
# Check database status
docker-compose exec db pg_isready -U postgres

# Reset database
docker-compose down -v
docker-compose up -d db
```

**Permission issues (Linux/Mac):**
```bash
# Fix file permissions
sudo chown -R $USER:$USER .
chmod +x scripts/*.sh
```

**Out of disk space:**
```bash
# Clean up Docker
docker system prune -a
docker volume prune
```

### Reset Everything

```bash
# Stop and remove all containers, networks, and volumes
docker-compose down -v --remove-orphans

# Remove all images
docker-compose down --rmi all

# Start fresh
./scripts/docker-setup.sh
```

## 📈 Scaling

### Horizontal Scaling

```yaml
# In docker-compose.yml
services:
  app:
    deploy:
      replicas: 3
    # ... other config
```

### Load Balancing

Use Nginx upstream configuration for multiple backend instances.

### Database Scaling

Consider:
- Read replicas for PostgreSQL
- Connection pooling (PgBouncer)
- Database sharding for large datasets

## 🔐 Security Best Practices

1. **Never commit `.env` files**
2. **Use Docker secrets in production**
3. **Regular security updates**
4. **Network isolation**
5. **Principle of least privilege**
6. **Regular backups**

## 📚 Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Redis Documentation](https://redis.io/documentation)

## 🆘 Support

If you encounter issues:

1. Check the logs: `docker-compose logs -f`
2. Verify environment configuration
3. Ensure all required ports are available
4. Check Docker and Docker Compose versions
5. Review this documentation

For development questions, refer to the main project README.md.