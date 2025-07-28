# 🔧 Technical Specification Document
## Maternal Health Risk Prediction System

---

## 📋 **Document Information**

**Document Type:** Technical Specification  
**Version:** 1.0.0  
**Date:** July 28, 2025  
**Author:** Development Team  
**Status:** Final  

---

## 🎯 **System Requirements**

### **Functional Requirements**

#### **FR-001: User Authentication & Authorization**
- **Description:** Multi-role user management system
- **Roles:** Pregnant Mother, CHV, Clinician, Admin
- **Authentication:** JWT-based token authentication
- **Authorization:** Role-based access control (RBAC)
- **Security:** bcrypt password hashing, session management

#### **FR-002: Risk Assessment Engine**
- **Description:** ML-powered maternal health risk prediction
- **Input:** Vital signs (BP, heart rate, temperature, blood sugar, age)
- **Output:** Risk level (Low/Medium/High) with confidence score
- **Explainability:** SHAP-based feature importance analysis
- **Validation:** Clinical range validation for all inputs

#### **FR-003: Patient Management**
- **Description:** Comprehensive patient data management
- **Features:** Registration, profile management, medical history
- **Data:** Demographics, pregnancy history, emergency contacts
- **Assignment:** Automatic CHV and clinician assignment

#### **FR-004: Healthcare Provider Tools**
- **Description:** Tools for CHVs and clinicians
- **Features:** Patient lists, appointment scheduling, medication management
- **Dashboard:** Risk distribution, patient status, alerts
- **Communication:** Integrated messaging and notifications

#### **FR-005: Analytics & Reporting**
- **Description:** Data analytics and reporting capabilities
- **Features:** Risk distribution analysis, regional statistics
- **Visualization:** Charts, graphs, trend analysis
- **Export:** Data export for external analysis

### **Non-Functional Requirements**

#### **NFR-001: Performance**
- **Response Time:** < 2 seconds for API calls
- **Throughput:** 100 concurrent users
- **Database:** Connection pooling, query optimization
- **Caching:** Redis-based caching for frequent queries

#### **NFR-002: Security**
- **Authentication:** JWT tokens with 30-minute expiration
- **Encryption:** AES-256 for sensitive data at rest
- **Transport:** HTTPS/TLS 1.3 for data in transit
- **Headers:** Security headers (HSTS, CSP, X-Frame-Options)

#### **NFR-003: Scalability**
- **Horizontal Scaling:** Docker container replication
- **Database:** PostgreSQL with read replicas support
- **Load Balancing:** Nginx upstream configuration
- **Caching:** Multi-level caching strategy

#### **NFR-004: Availability**
- **Uptime:** 99.9% availability target
- **Health Checks:** Container health monitoring
- **Failover:** Database failover capabilities
- **Backup:** Automated daily backups

#### **NFR-005: Usability**
- **Interface:** Responsive Material-UI design
- **Accessibility:** WCAG 2.1 AA compliance
- **Browser Support:** Chrome, Firefox, Safari, Edge
- **Mobile:** Mobile-responsive design

---

## 🏗️ **System Architecture**

### **Architecture Pattern**
- **Pattern:** Microservices-oriented monolith
- **Frontend:** Single Page Application (SPA)
- **Backend:** RESTful API with FastAPI
- **Database:** Relational database with PostgreSQL
- **Caching:** Redis for session and data caching

### **Component Diagram**
```
┌─────────────────────────────────────────────────────────────┐
│                    Presentation Layer                       │
├─────────────────────────────────────────────────────────────┤
│  React Frontend (TypeScript)                               │
│  - Material-UI Components                                  │
│  - React Router for Navigation                             │
│  - Axios for HTTP Requests                                 │
│  - State Management with React Hooks                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Application Layer                         │
├─────────────────────────────────────────────────────────────┤
│  FastAPI Backend (Python)                                  │
│  - RESTful API Endpoints                                   │
│  - JWT Authentication Middleware                           │
│  - Input Validation with Pydantic                          │
│  - Rate Limiting with SlowAPI                              │
│  - CORS and Security Headers                               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Business Layer                           │
├─────────────────────────────────────────────────────────────┤
│  Core Business Logic                                       │
│  - User Management Service                                 │
│  - Risk Assessment Service                                 │
│  - Patient Management Service                              │
│  - ML Model Integration                                    │
│  - SHAP Explainability Service                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     Data Layer                              │
├─────────────────────────────────────────────────────────────┤
│  SQLAlchemy ORM                                            │
│  - Database Models                                         │
│  - Migration Management (Alembic)                          │
│  - Connection Pooling                                      │
│  - Query Optimization                                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  Infrastructure Layer                       │
├─────────────────────────────────────────────────────────────┤
│  PostgreSQL Database    │    Redis Cache    │    Nginx      │
│  - Primary Data Store   │    - Sessions     │    - Reverse  │
│  - ACID Compliance      │    - API Cache    │      Proxy    │
│  - Backup & Recovery    │    - Rate Limit   │    - SSL Term │
└─────────────────────────────────────────────────────────────┘
```

### **Data Flow Architecture**
```
User Request → Nginx → FastAPI → Business Logic → Database
     ↑                                    ↓
     └── Response ← JSON ← Processing ← Redis Cache
```

---

## 💾 **Database Design**

### **Entity Relationship Diagram**
```
┌─────────────┐    ┌──────────────────┐    ┌─────────────────┐
│    Users    │    │ Pregnant Mothers │    │ Risk Assessments│
├─────────────┤    ├──────────────────┤    ├─────────────────┤
│ id (PK)     │◄──►│ id (PK)          │◄──►│ id (PK)         │
│ username    │    │ user_id (FK)     │    │ mother_id (FK)  │
│ email       │    │ age              │    │ chv_id (FK)     │
│ role        │    │ gestational_age  │    │ assessment_date │
│ ...         │    │ ...              │    │ vital_signs     │
└─────────────┘    └──────────────────┘    │ risk_level      │
                                           │ shap_explanation│
                                           └─────────────────┘
       │                                           │
       ▼                                           ▼
┌─────────────┐                           ┌─────────────────┐
│Appointments │                           │   Medications   │
├─────────────┤                           ├─────────────────┤
│ id (PK)     │                           │ id (PK)         │
│ mother_id   │                           │ mother_id (FK)  │
│ clinician_id│                           │ clinician_id    │
│ date        │                           │ medication_name │
│ status      │                           │ dosage          │
└─────────────┘                           └─────────────────┘
```

### **Database Schema Details**

#### **Users Table**
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('pregnant_mother', 'chv', 'clinician', 'admin')),
    phone_number TEXT NOT NULL, -- Encrypted
    location VARCHAR(100),
    hashed_password TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Indexes
    INDEX idx_users_username (username),
    INDEX idx_users_email (email),
    INDEX idx_users_role (role)
);
```

#### **Pregnant Mothers Table**
```sql
CREATE TABLE pregnant_mothers (
    id VARCHAR(50) PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    age INTEGER NOT NULL CHECK (age >= 15 AND age <= 50),
    gestational_age INTEGER CHECK (gestational_age >= 0 AND gestational_age <= 42),
    previous_pregnancies INTEGER DEFAULT 0,
    previous_complications TEXT,
    emergency_contact TEXT NOT NULL, -- Encrypted
    assigned_chv_id VARCHAR(50),
    assigned_clinician_id VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_mothers_user_id (user_id),
    INDEX idx_mothers_chv_id (assigned_chv_id),
    INDEX idx_mothers_clinician_id (assigned_clinician_id)
);
```

#### **Risk Assessments Table**
```sql
CREATE TABLE risk_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mother_id VARCHAR(50) REFERENCES pregnant_mothers(id) ON DELETE CASCADE,
    chv_id VARCHAR(50) NOT NULL,
    assessment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Vital Signs
    age DECIMAL(5,2) NOT NULL CHECK (age >= 15 AND age <= 50),
    systolic_bp DECIMAL(5,2) NOT NULL CHECK (systolic_bp >= 70 AND systolic_bp <= 200),
    diastolic_bp DECIMAL(5,2) NOT NULL CHECK (diastolic_bp >= 40 AND diastolic_bp <= 120),
    blood_sugar DECIMAL(5,2) NOT NULL CHECK (blood_sugar >= 2.2 AND blood_sugar <= 25.0),
    body_temp DECIMAL(5,2) NOT NULL CHECK (body_temp >= 95.0 AND body_temp <= 106.0),
    heart_rate INTEGER NOT NULL CHECK (heart_rate >= 40 AND heart_rate <= 150),
    
    -- Additional Data
    gestational_age INTEGER NOT NULL,
    weight DECIMAL(5,2),
    height DECIMAL(5,2),
    symptoms JSONB,
    notes TEXT,
    
    -- Calculated Fields
    bmi DECIMAL(5,2),
    risk_level VARCHAR(10) CHECK (risk_level IN ('low', 'medium', 'high')),
    risk_score DECIMAL(5,4),
    confidence DECIMAL(5,4),
    recommendations JSONB,
    shap_explanation JSONB,
    
    -- Indexes
    INDEX idx_assessments_mother_id (mother_id),
    INDEX idx_assessments_chv_id (chv_id),
    INDEX idx_assessments_date (assessment_date),
    INDEX idx_assessments_risk_level (risk_level)
);
```

### **Data Validation Rules**
```python
# Clinical Range Validation
CLINICAL_RANGES = {
    "age": {"min": 15, "max": 50, "unit": "years"},
    "systolic_bp": {"min": 70, "max": 200, "unit": "mmHg"},
    "diastolic_bp": {"min": 40, "max": 120, "unit": "mmHg"},
    "blood_sugar": {"min": 2.2, "max": 25.0, "unit": "mmol/L"},
    "body_temp": {"min": 95.0, "max": 106.0, "unit": "°F"},
    "heart_rate": {"min": 40, "max": 150, "unit": "bpm"},
    "gestational_age": {"min": 0, "max": 42, "unit": "weeks"},
    "weight": {"min": 30, "max": 200, "unit": "kg"},
    "height": {"min": 120, "max": 220, "unit": "cm"}
}
```

---

## 🔌 **API Specification**

### **API Design Principles**
- **RESTful:** Standard HTTP methods and status codes
- **Stateless:** No server-side session state
- **Versioned:** API versioning for backward compatibility
- **Documented:** OpenAPI/Swagger documentation
- **Secure:** Authentication required for all endpoints

### **Authentication Flow**
```
1. POST /auth/register → User Registration
2. POST /auth/login → JWT Token Generation
3. Include "Authorization: Bearer <token>" in headers
4. POST /auth/refresh → Token Renewal
```

### **Core API Endpoints**

#### **Authentication Endpoints**
```http
POST /auth/register
Content-Type: application/json
{
    "username": "string",
    "email": "string",
    "password": "string",
    "full_name": "string",
    "role": "pregnant_mother|chv|clinician|admin",
    "phone_number": "string",
    "location": "string"
}

Response: 201 Created
{
    "message": "User registered successfully",
    "user_id": "uuid",
    "mother_id": "string" // if role is pregnant_mother
}
```

```http
POST /auth/login
Content-Type: application/x-www-form-urlencoded
username=string&password=string

Response: 200 OK
{
    "access_token": "jwt_token",
    "refresh_token": "jwt_token",
    "token_type": "bearer",
    "user": {
        "id": "uuid",
        "username": "string",
        "role": "string",
        // ... other user fields
    }
}
```

#### **Risk Assessment Endpoints**
```http
POST /assessments/create
Authorization: Bearer <token>
Content-Type: application/json
{
    "mother_id": "string",
    "age": 25.0,
    "systolic_bp": 120.0,
    "diastolic_bp": 80.0,
    "blood_sugar": 8.0,
    "body_temp": 98.6,
    "heart_rate": 72,
    "gestational_age": 28,
    "weight": 65.0,
    "height": 165.0,
    "symptoms": ["fatigue", "mild headache"],
    "notes": "Patient feeling well overall"
}

Response: 201 Created
{
    "id": "uuid",
    "risk_level": "low|medium|high",
    "risk_score": 0.25,
    "confidence": 0.85,
    "recommendations": ["Continue regular prenatal care"],
    "shap_explanation": [
        {
            "feature": "SystolicBP",
            "shap_value": 0.23,
            "feature_value": 120.0
        }
    ]
}
```

#### **Patient Management Endpoints**
```http
GET /mothers
Authorization: Bearer <token>
Query Parameters:
  - page: integer (default: 1)
  - limit: integer (default: 10)
  - risk_level: string (optional)
  - assigned_chv_id: string (optional)

Response: 200 OK
{
    "mothers": [
        {
            "id": "string",
            "user_id": "uuid",
            "age": 25,
            "gestational_age": 28,
            "risk_level": "low",
            "last_assessment": "2025-07-28T10:00:00Z",
            "assigned_chv": "CHV Name",
            "assigned_clinician": "Dr. Name"
        }
    ],
    "total": 50,
    "page": 1,
    "pages": 5
}
```

### **Error Handling**
```http
HTTP Status Codes:
- 200: Success
- 201: Created
- 400: Bad Request (validation error)
- 401: Unauthorized (invalid token)
- 403: Forbidden (insufficient permissions)
- 404: Not Found
- 422: Unprocessable Entity (validation error)
- 429: Too Many Requests (rate limited)
- 500: Internal Server Error

Error Response Format:
{
    "detail": "Error message",
    "error_code": "VALIDATION_ERROR",
    "timestamp": "2025-07-28T10:00:00Z"
}
```

### **Rate Limiting**
```
Global API: 10 requests/second per IP
Authentication: 5 requests/minute per IP
Registration: 3 requests/minute per IP
```

---

## 🤖 **Machine Learning Specification**

### **Model Architecture**
```python
Model Type: XGBoost Classifier
Algorithm: Gradient Boosting Decision Trees
Objective: Multi-class classification
Classes: ['low risk', 'mid risk', 'high risk']

Hyperparameters:
- n_estimators: 100
- max_depth: 6
- learning_rate: 0.1
- subsample: 0.8
- colsample_bytree: 0.8
- random_state: 42
```

### **Feature Engineering**
```python
Input Features:
1. Age (float): Patient age in years
2. SystolicBP (float): Systolic blood pressure in mmHg
3. DiastolicBP (float): Diastolic blood pressure in mmHg
4. BS (float): Blood sugar level in mmol/L
5. BodyTemp (float): Body temperature in Fahrenheit
6. HeartRate (int): Heart rate in beats per minute

Derived Features:
- BMI: weight / (height/100)^2
- Pulse Pressure: SystolicBP - DiastolicBP
- Age Category: Categorical age groups
```

### **Model Pipeline**
```python
class MaternalRiskPipeline:
    def __init__(self):
        self.preprocessor = None
        self.model = None
        self.label_encoder = None
        self.feature_names = ['Age', 'SystolicBP', 'DiastolicBP', 'BS', 'BodyTemp', 'HeartRate']
    
    def predict(self, features):
        # Input validation
        # Feature preprocessing
        # Model prediction
        # Probability calculation
        # Risk level mapping
        # Confidence scoring
        return {
            'predicted_risk_level': 'low risk',
            'confidence_score': 0.85,
            'probability': {
                'low risk': 0.7,
                'mid risk': 0.2,
                'high risk': 0.1
            }
        }
```

### **SHAP Integration**
```python
class SHAPExplainer:
    def __init__(self, model):
        self.model = model
        self.explainer = shap.TreeExplainer(model)
    
    def explain_prediction(self, features):
        shap_values = self.explainer.shap_values(features)
        return {
            'feature_importance': [
                {
                    'feature': 'SystolicBP',
                    'shap_value': 0.23,
                    'feature_value': 120.0,
                    'impact': 'positive'
                }
            ],
            'base_value': 0.5,
            'prediction': 0.73
        }
```

### **Model Validation**
```python
Validation Metrics:
- Accuracy: Overall prediction accuracy
- Precision: True positives / (True positives + False positives)
- Recall: True positives / (True positives + False negatives)
- F1-Score: Harmonic mean of precision and recall
- AUC-ROC: Area under ROC curve
- Confusion Matrix: Classification matrix

Cross-Validation:
- Method: 5-fold cross-validation
- Stratification: Balanced class distribution
- Metrics: Average across folds
```

---

## 🐳 **Docker Configuration**

### **Container Architecture**
```yaml
version: '3.8'
services:
  # Application Container
  app:
    build: .
    ports: ["8000:8000"]
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/maternal_health
      - REDIS_URL=redis://redis:6379
    depends_on: [db, redis]
    
  # Database Container
  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=maternal_health
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
    volumes: ["postgres_data:/var/lib/postgresql/data"]
    
  # Cache Container
  redis:
    image: redis:7-alpine
    volumes: ["redis_data:/data"]
    
  # Reverse Proxy (Production)
  nginx:
    image: nginx:alpine
    ports: ["80:80", "443:443"]
    volumes: ["./nginx.conf:/etc/nginx/nginx.conf"]
    depends_on: [app]
```

### **Multi-Stage Dockerfile**
```dockerfile
# Stage 1: Frontend Build
FROM node:18-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci --only=production
COPY frontend/ ./
RUN npm run build

# Stage 2: Backend Application
FROM python:3.11-slim
RUN apt-get update && apt-get install -y gcc g++
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
COPY --from=frontend-builder /app/frontend/build ./frontend/build
RUN mkdir -p logs models data
RUN adduser --disabled-password appuser && chown -R appuser:appuser /app
USER appuser
EXPOSE 8000
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
```

### **Environment Configuration**
```bash
# Production Environment Variables
DATABASE_URL=postgresql://postgres:password@db:5432/maternal_health
SECRET_KEY=your-super-secret-key-256-bits-long
REDIS_URL=redis://redis:6379
ALLOWED_ORIGINS=https://yourdomain.com
DEBUG=false
LOG_LEVEL=INFO

# Development Environment Variables
DATABASE_URL=postgresql://postgres:postgres@db:5432/maternal_health_dev
SECRET_KEY=dev-secret-key
REDIS_URL=redis://redis:6379
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8000
DEBUG=true
LOG_LEVEL=DEBUG
```

---

## 🔒 **Security Specification**

### **Authentication Security**
```python
# JWT Configuration
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
REFRESH_TOKEN_EXPIRE_DAYS = 7

# Password Security
PASSWORD_MIN_LENGTH = 8
PASSWORD_HASH_ROUNDS = 12  # bcrypt rounds
PASSWORD_REQUIREMENTS = {
    "min_length": 8,
    "require_uppercase": True,
    "require_lowercase": True,
    "require_numbers": True,
    "require_special": False
}
```

### **Data Encryption**
```python
# Encryption Configuration
ENCRYPTION_ALGORITHM = "AES-256-GCM"
KEY_DERIVATION = "PBKDF2-SHA256"
SALT_LENGTH = 32
IV_LENGTH = 16

# Encrypted Fields
ENCRYPTED_FIELDS = [
    "phone_number",
    "emergency_contact",
    "medical_notes"
]
```

### **Security Headers**
```nginx
# Nginx Security Headers
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';" always;
```

### **Input Validation**
```python
# Pydantic Validation Models
class RiskAssessmentIn(BaseModel):
    age: float = Field(..., ge=15, le=50, description="Age in years")
    systolic_bp: float = Field(..., ge=70, le=200, description="Systolic BP in mmHg")
    diastolic_bp: float = Field(..., ge=40, le=120, description="Diastolic BP in mmHg")
    blood_sugar: float = Field(..., ge=2.2, le=25.0, description="Blood sugar in mmol/L")
    body_temp: float = Field(..., ge=95.0, le=106.0, description="Body temperature in °F")
    heart_rate: int = Field(..., ge=40, le=150, description="Heart rate in BPM")
    
    @validator('systolic_bp')
    def validate_bp_relationship(cls, v, values):
        if 'diastolic_bp' in values and v <= values['diastolic_bp']:
            raise ValueError('Systolic BP must be greater than diastolic BP')
        return v
```

---

## 📊 **Performance Specification**

### **Performance Requirements**
```
Response Time Targets:
- API Endpoints: < 200ms (95th percentile)
- Database Queries: < 100ms (95th percentile)
- ML Predictions: < 500ms (95th percentile)
- Page Load Time: < 3 seconds (95th percentile)

Throughput Targets:
- Concurrent Users: 100
- Requests per Second: 1000
- Database Connections: 20 (pool size)
- Cache Hit Ratio: > 80%
```

### **Database Performance**
```sql
-- Index Strategy
CREATE INDEX CONCURRENTLY idx_assessments_mother_date 
ON risk_assessments(mother_id, assessment_date DESC);

CREATE INDEX CONCURRENTLY idx_users_role_active 
ON users(role, is_active) WHERE is_active = true;

-- Query Optimization
EXPLAIN ANALYZE SELECT * FROM risk_assessments 
WHERE mother_id = $1 
ORDER BY assessment_date DESC 
LIMIT 10;
```

### **Caching Strategy**
```python
# Redis Caching Configuration
CACHE_CONFIG = {
    "user_sessions": {"ttl": 1800},  # 30 minutes
    "api_responses": {"ttl": 300},   # 5 minutes
    "ml_predictions": {"ttl": 3600}, # 1 hour
    "static_data": {"ttl": 86400}    # 24 hours
}

# Cache Keys
CACHE_KEYS = {
    "user_profile": "user:{user_id}:profile",
    "mother_assessments": "mother:{mother_id}:assessments",
    "risk_distribution": "analytics:risk_distribution",
    "ml_model": "ml:model:latest"
}
```

---

## 🧪 **Testing Specification**

### **Test Strategy**
```python
# Test Pyramid
Unit Tests (70%):
- Individual function testing
- Model validation testing
- Utility function testing

Integration Tests (20%):
- API endpoint testing
- Database integration testing
- External service integration

End-to-End Tests (10%):
- User workflow testing
- Cross-browser testing
- Performance testing
```

### **Test Coverage Requirements**
```
Minimum Coverage: 80%
Critical Path Coverage: 95%
Security Function Coverage: 100%
API Endpoint Coverage: 90%
```

### **Test Data Management**
```python
# Test Database Setup
TEST_DATABASE_URL = "postgresql://test_user:test_pass@localhost:5433/test_maternal_health"

# Test Data Fixtures
@pytest.fixture
def sample_user():
    return {
        "username": "test_chv",
        "email": "test@example.com",
        "role": "chv",
        "full_name": "Test CHV"
    }

@pytest.fixture
def sample_assessment():
    return {
        "age": 25.0,
        "systolic_bp": 120.0,
        "diastolic_bp": 80.0,
        "blood_sugar": 8.0,
        "body_temp": 98.6,
        "heart_rate": 72
    }
```

---

## 🚀 **Deployment Specification**

### **Environment Requirements**
```
Production Environment:
- CPU: 4 cores minimum
- RAM: 8GB minimum
- Storage: 100GB SSD
- Network: 1Gbps connection
- OS: Ubuntu 20.04 LTS or CentOS 8

Development Environment:
- CPU: 2 cores minimum
- RAM: 4GB minimum
- Storage: 20GB available
- Docker: 20.10+
- Docker Compose: 2.0+
```

### **Deployment Pipeline**
```yaml
# CI/CD Pipeline (GitHub Actions)
name: Deploy Maternal Health System
on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run Tests
        run: |
          docker-compose -f docker-compose.test.yml up --abort-on-container-exit
  
  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - name: Build Docker Images
        run: docker-compose build
      - name: Push to Registry
        run: docker-compose push
  
  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Production
        run: |
          ssh production-server "cd /app && docker-compose pull && docker-compose up -d"
```

### **Monitoring & Logging**
```python
# Logging Configuration
LOGGING_CONFIG = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "detailed": {
            "format": "%(asctime)s [%(levelname)s] %(name)s: %(message)s"
        }
    },
    "handlers": {
        "file": {
            "class": "logging.handlers.RotatingFileHandler",
            "filename": "logs/maternal_health.log",
            "maxBytes": 10485760,  # 10MB
            "backupCount": 5,
            "formatter": "detailed"
        }
    },
    "root": {
        "level": "INFO",
        "handlers": ["file"]
    }
}
```

---

## 📋 **Maintenance Specification**

### **Backup Strategy**
```bash
# Database Backup
pg_dump -h localhost -U postgres maternal_health > backup_$(date +%Y%m%d_%H%M%S).sql

# Automated Backup Script
#!/bin/bash
BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)
docker exec maternal_health_db pg_dump -U postgres maternal_health > $BACKUP_DIR/db_backup_$DATE.sql
find $BACKUP_DIR -name "db_backup_*.sql" -mtime +7 -delete
```

### **Update Procedures**
```bash
# Application Update Process
1. Backup current database
2. Pull latest code changes
3. Build new Docker images
4. Run database migrations
5. Deploy with zero-downtime strategy
6. Verify deployment health
7. Monitor for issues
```

### **Health Monitoring**
```python
# Health Check Endpoints
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "version": "1.0.0",
        "database": await check_database_health(),
        "redis": await check_redis_health(),
        "ml_model": await check_model_health()
    }
```

---

**Document Version:** 1.0.0  
**Last Updated:** July 28, 2025  
**Next Review:** August 28, 2025