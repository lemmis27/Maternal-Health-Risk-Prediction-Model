from fastapi import FastAPI, HTTPException, Depends, status, BackgroundTasks
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.middleware.httpsredirect import HTTPSRedirectMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any, ClassVar
from datetime import datetime, timedelta, timezone
from enum import Enum
import pandas as pd
import numpy as np
import joblib
import uuid
import json
from passlib.context import CryptContext
import jwt
import os
import sys
from sqlalchemy.orm import Session, joinedload
from database import SessionLocal, Base, engine
from models_db import User as DBUser
from models_db import PregnantMother as DBMother
from models_db import RiskAssessment as DBRiskAssessment
from models_db import Appointment as DBAppointment
from models_db import Medication as DBMedication
from schemas import UserOut, PregnantMotherOut, RiskAssessmentOut, AppointmentOut, MedicationOut, ErrorResponse, UserIn, PregnantMotherIn, RiskAssessmentIn, AppointmentIn, MedicationIn
from fastapi.responses import JSONResponse
from config import SECRET_KEY
from pipeline import MaternalRiskPipeline  # Ensure this is imported before model loading
from logger import log_audit, log_failed_login, log_suspicious_activity
from fastapi import Request
from encryption import encrypt_sensitive_data, decrypt_sensitive_data
from cache import get_cache_manager
from background_tasks import get_background_task_manager
from performance import get_performance_monitor
from shap_utils import get_shap_explainer

# Initialize rate limiter
limiter = Limiter(key_func=get_remote_address)

# Initialize FastAPI app
app = FastAPI(
    title="Maternal Health Risk Prediction System",
    description="""
Multi-user system for predicting maternal health risks with advanced explainability features.

## SHAP Explainability

This API provides comprehensive [SHAP](https://shap.readthedocs.io/en/latest/) explanations for model predictions with enhanced features:

### Individual Prediction Explanations
- **Detailed Feature Analysis**: See how each health metric affects specific predictions
- **Impact Ranking**: Features ranked by their contribution to the prediction
- **Positive/Negative Contributions**: Understand which features increase or decrease risk
- **Explanation Quality**: Assessment of explanation reliability

### Global Model Insights
- **Feature Importance**: Overall importance of each health metric across all predictions
- **Summary Plots**: Visual representation of feature importance distributions
- **Statistical Analysis**: Mean absolute SHAP values for feature ranking

### Enhanced SHAP Endpoints
- **`/shap/global`**: Get global feature importance ranking
- **`/shap/summary-plot`**: Generate SHAP summary plot as base64 image
- **`/shap/force-plot`**: Create individual prediction force plot
- **`/shap/explanation`**: Get detailed feature-by-feature analysis
- **`/shap/explanation-summary`**: High-level impact analysis

### Example Enhanced SHAP Response
```json
{
  "explanation": [
    {
      "feature": "SystolicBP",
      "feature_description": "Systolic blood pressure (mmHg)",
      "value": 140,
      "shap_value": 0.25,
      "abs_shap_value": 0.25,
      "impact": "positive",
      "importance_rank": 1
    }
  ],
  "summary": {
    "top_contributing_features": [...],
    "positive_contributors": [...],
    "negative_contributors": [...],
    "total_positive_impact": 0.35,
    "total_negative_impact": -0.15,
    "most_important_feature": {...},
    "explanation_quality": "high"
  }
}
```

### Basic SHAP Explanations
- **Where do I see SHAP explanations?**
  - The `explanation` field is included in the response for endpoints like `/assessments/create`, `/assessments/{mother_id}`, and `/model/test`.
- **What does a basic SHAP explanation look like?**

```json
[
  {"feature": "SystolicBP", "shap_value": 0.23},
  {"feature": "Age", "shap_value": -0.12},
  {"feature": "BodyTemp", "shap_value": 0.05}
]
```

- **How to interpret?**
  - Positive `shap_value` means the feature increases the predicted risk; negative means it decreases risk.
  - The magnitude shows the strength of the contribution for this specific prediction.

For more, see the [SHAP documentation](https://shap.readthedocs.io/en/latest/).
""",
    version="1.0.0"
)

# Add rate limiter to app
app.state.limiter = limiter

# Create all tables
Base.metadata.create_all(bind=engine)

# CORS middleware - Production-ready configuration
# Get allowed origins from environment variable, fallback to development defaults
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:8000,http://127.0.0.1:3000,http://127.0.0.1:8000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    max_age=3600,  # Cache preflight requests for 1 hour
)

# Security headers middleware
@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

# Input validation middleware
@app.middleware("http")
async def validate_input(request, call_next):
    """Validate and sanitize input data"""
    import re
    
    # Check for suspicious patterns in query parameters
    query_params = dict(request.query_params)
    for key, value in query_params.items():
        # Check for SQL injection patterns
        sql_patterns = [
            r"(\b(union|select|insert|update|delete|drop|create|alter)\b)",
            r"(--|/\*|\*/)",
            r"(\b(exec|execute|script)\b)",
        ]
        for pattern in sql_patterns:
            if re.search(pattern, value, re.IGNORECASE):
                return JSONResponse(
                    status_code=400,
                    content={"detail": "Invalid input detected"}
                )
    
    # Check for suspicious patterns in path parameters
    path_params = request.path_params
    for key, value in path_params.items():
        # Check for path traversal attempts
        if ".." in str(value) or "//" in str(value):
            return JSONResponse(
                status_code=400,
                content={"detail": "Invalid path parameter"}
            )
    
    response = await call_next(request)
    return response

# Security
security = HTTPBearer()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
# Use SECRET_KEY from config.py for JWT and password hashing
ALGORITHM = "HS256"

# Enums
class UserRole(str, Enum):
    PREGNANT_MOTHER = "pregnant_mother"
    CHV = "chv"
    CLINICIAN = "clinician"
    POLICYMAKER = "policymaker"

class RiskLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"

class AppointmentStatus(str, Enum):
    SCHEDULED = "scheduled"
    CONFIRMED = "confirmed"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

# Data Models
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    email: str
    full_name: str
    role: UserRole
    phone_number: str
    location: str
    created_at: datetime = Field(default_factory=datetime.now)
    is_active: bool = True

class PregnantMother(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    age: int
    gestational_age: Optional[int] = None
    previous_pregnancies: int = 0
    previous_complications: List[str] = []
    emergency_contact: str
    assigned_chv_id: Optional[str] = None
    assigned_clinician_id: Optional[str] = None

class RiskAssessment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    mother_id: str
    chv_id: str
    assessment_date: datetime = Field(default_factory=datetime.now)
    
    # Vital signs matching your model's expected features
    age: float = Field(..., description="Age of the patient", ge=10, le=70)
    systolic_bp: float = Field(..., description="Systolic Blood Pressure (mmHg)", ge=70, le=200)
    diastolic_bp: float = Field(..., description="Diastolic Blood Pressure (mmHg)", ge=49, le=120)
    blood_sugar: float = Field(..., description="Blood Sugar level (mmol/L)", ge=6.0, le=19.0)
    body_temp: float = Field(..., description="Body Temperature (°F)", ge=98.0, le=103.0)
    heart_rate: int = Field(..., description="Heart Rate (bpm)", ge=7, le=90)
    
    # Additional assessment fields
    gestational_age: int
    weight: float
    height: float
    
    # Symptoms and notes
    symptoms: List[str] = []
    notes: Optional[str] = None
    
    # Calculated fields
    bmi: Optional[float] = None
    risk_level: Optional[RiskLevel] = None
    risk_score: Optional[float] = None
    confidence: Optional[float] = None
    recommendations: List[str] = []
    model_config = ConfigDict(from_attributes=True)
    json_schema_extra: ClassVar[dict] = {
        "example": {
            "mother_id": "mother_123",
            "chv_id": "chv_456",
            "age": 25.0,
            "systolic_bp": 120.0,
            "diastolic_bp": 80.0,
            "blood_sugar": 8.0,
            "body_temp": 98.6,
            "heart_rate": 72,
            "gestational_age": 28,
            "weight": 65.0,
            "height": 165.0,
            "symptoms": ["fatigue", "mild headache"]
        }
    }

class Appointment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    mother_id: str
    clinician_id: str
    chv_id: Optional[str] = None
    appointment_date: datetime
    status: AppointmentStatus = AppointmentStatus.SCHEDULED
    reason: str
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.now)

class Medication(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    mother_id: str
    clinician_id: str
    medication_name: str
    dosage: str
    frequency: str
    duration: str
    instructions: str
    prescribed_at: datetime = Field(default_factory=datetime.now)

class RegionalData(BaseModel):
    region: str
    high_risk_count: int
    medium_risk_count: int
    low_risk_count: int
    total_assessments: int
    poverty_level: float
    literacy_rate: float
    health_facilities_count: int
    infrastructure_score: float

# In-memory storage (replace with database in production)
users_db = {}
mothers_db = {}
assessments_db = {}
appointments_db = {}
medications_db = {}
regional_data_db = {}

# Load your trained model
model = None

def load_model_once():
    global model
    import os
    model_path = "models/maternal_risk_pipeline.joblib"
    if model is not None:
        return model
    try:
        if os.path.exists(model_path):
            model = joblib.load(model_path)
            print("✅ Model loaded successfully!")
            if hasattr(model, 'model'):
            if hasattr(model, 'label_encoder') and hasattr(model.label_encoder, 'classes_'):
        else:
            print("❌ Model file not found at models/maternal_risk_pipeline.joblib")
            model = None
    except Exception as e:
        import traceback
        traceback.print_exc()
        model = None
    return model

# Call model loader after all imports
model = load_model_once()

# ML Model wrapper for your trained model
class MaternalHealthModel:
    def __init__(self, loaded_model=None):
        self.model = loaded_model
        self.feature_names = ['Age', 'SystolicBP', 'DiastolicBP', 'BS', 'BodyTemp', 'HeartRate']
        self.risk_mapping = {
            'low risk': RiskLevel.LOW,
            'mid risk': RiskLevel.MEDIUM,
            'high risk': RiskLevel.HIGH
        }
    
    def predict_risk(self, features: Dict[str, float]) -> tuple:
        """Predict risk level using your trained model"""
        if self.model is None:
            # Fallback to dummy prediction if model not loaded
            return RiskLevel.LOW, 0.5
        
        try:
            # Prepare input data with correct column names for your model
            input_data = pd.DataFrame([{
                'Age': features.get('age', 25),
                'SystolicBP': features.get('systolic_bp', 120),
                'DiastolicBP': features.get('diastolic_bp', 80),
                'BS': features.get('blood_sugar', 8.0),
                'BodyTemp': features.get('body_temp', 98.6),
                'HeartRate': features.get('heart_rate', 72)
            }])
            
            # Make prediction
            prediction = self.model.predict(input_data)
            
            # Get probabilities
            confidence = 0.5
            try:
                proba = self.model.predict_proba(input_data)
                if proba is not None:
                    confidence = float(np.max(proba[0]))
            except:
                pass
            
            # Process prediction result
            if isinstance(prediction, np.ndarray):
                pred_value = prediction[0]
            else:
                pred_value = prediction
            
            # Convert prediction to risk level
            prediction_str = str(pred_value).lower()
            risk_level = self.risk_mapping.get(prediction_str, RiskLevel.LOW)
            
            return risk_level, confidence
            
        except Exception as e:
            return RiskLevel.LOW, 0.5
    
    def get_recommendations(self, risk_level: RiskLevel, features: Dict[str, float]) -> List[str]:
        """Generate recommendations based on risk level and features"""
        recommendations = []
        
        if risk_level == RiskLevel.HIGH:
            recommendations.extend([
                "🚨 Immediate medical attention required",
                "📅 Schedule urgent appointment with clinician",
                "🩺 Monitor blood pressure daily",
                "⚠️ Reduce physical activity",
                "💊 Increase prenatal vitamin intake",
                "🏥 Consider hospitalization for monitoring"
            ])
        elif risk_level == RiskLevel.MEDIUM:
            recommendations.extend([
                "📅 Schedule follow-up appointment within 1 week",
                "👀 Monitor symptoms closely",
                "🩺 Maintain regular prenatal visits",
                "🥗 Follow healthy pregnancy diet",
                "💧 Stay well hydrated"
            ])
        else:
            recommendations.extend([
                "✅ Continue regular prenatal care",
                "🏃‍♀️ Maintain healthy lifestyle",
                "📅 Schedule next routine check-up",
                "🥗 Continue balanced nutrition"
            ])
        
        # Add specific recommendations based on vital signs
        systolic_bp = features.get('systolic_bp', 0)
        diastolic_bp = features.get('diastolic_bp', 0)
        
        if systolic_bp > 140 or diastolic_bp > 90:
            recommendations.append("🩺 Monitor blood pressure regularly - possible hypertension")
        
        if systolic_bp < 90 or diastolic_bp < 60:
            recommendations.append("⚠️ Monitor for hypotension symptoms")
        
        blood_sugar = features.get('blood_sugar', 0)
        if blood_sugar > 11.0:
            recommendations.append("🍯 Monitor blood sugar levels - possible gestational diabetes")
        
        body_temp = features.get('body_temp', 0)
        if body_temp > 100.4:
            recommendations.append("🌡️ Monitor temperature - possible infection")
        
        heart_rate = features.get('heart_rate', 0)
        if heart_rate > 100:
            recommendations.append("💓 Monitor heart rate - possible tachycardia")
        elif heart_rate < 60:
            recommendations.append("💓 Monitor heart rate - possible bradycardia")
        
        return recommendations

# Initialize ML model with your trained model
ml_model = MaternalHealthModel(model)

# Initialize SHAP explainer
from shap_utils import set_shap_model
set_shap_model(model)

# Authentication functions
def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Create JWT access token with improved security"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        # Shorter default expiration for better security
        expire = datetime.now(timezone.utc) + timedelta(minutes=30)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def create_refresh_token(data: dict):
    """Create refresh token for session management"""
    to_encode = data.copy()
    # Refresh tokens last longer but are used only for getting new access tokens
    expire = datetime.now(timezone.utc) + timedelta(days=7)
    to_encode.update({"exp": expire, "type": "refresh"})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Verify JWT token with improved error handling"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        return username
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

# Move get_db here so it's defined before get_current_user
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_current_user(username: str = Depends(verify_token), db: Session = Depends(get_db)) -> DBUser:
    user = db.query(DBUser).filter(DBUser.username == username).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return user

# Advanced Authorization Functions
def check_user_permission(user: DBUser, required_role: UserRole) -> bool:
    """Check if user has the required role."""
    return user.role == required_role

def check_resource_access(user: DBUser, resource_owner_id: str, allowed_roles: List[UserRole]) -> bool:
    """Check if user can access a specific resource."""
    # Users can always access their own resources
    if user.id == resource_owner_id:
        return True
    
    # Check if user has one of the allowed roles
    if user.role in allowed_roles:
        return True
    
    return False

def require_role(required_role: UserRole):
    """Dependency to require a specific role."""
    def role_checker(current_user: User = Depends(get_current_user)):
        if current_user.role != required_role:
            raise HTTPException(
                status_code=403, 
                detail=f"Access denied. Required role: {required_role.value}"
            )
        return current_user
    return role_checker

def require_any_role(allowed_roles: List[UserRole]):
    """Dependency to require any of the specified roles."""
    def role_checker(current_user: User = Depends(get_current_user)):
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=403, 
                detail=f"Access denied. Required roles: {[role.value for role in allowed_roles]}"
            )
        return current_user
    return role_checker

# API Routes

@app.post("/auth/register")
@limiter.limit("3/minute")
async def register_user(request: Request, user: UserIn, db: Session = Depends(get_db)):
    """Register a new user"""
    # Check if username already exists
    existing_user = db.query(DBUser).filter(DBUser.username == user.username).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    # Check if email already exists
    existing_email = db.query(DBUser).filter(DBUser.email == user.email).first()
    if existing_email:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Hash password
    hashed_password = get_password_hash(user.password)
    
    # Encrypt sensitive data
    encrypted_phone = encrypt_sensitive_data(user.phone_number)
    
    # Create new user
    db_user = DBUser(
        id=str(uuid.uuid4()),
        username=user.username,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        phone_number=encrypted_phone,
        location=user.location,
        hashed_password=hashed_password,
        created_at=datetime.now(),
        is_active=True
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return {"message": "User registered successfully", "user_id": db_user.id}

@app.post("/auth/login")
@limiter.limit("5/minute")
async def login(request: Request, username: str, password: str, db: Session = Depends(get_db)):
    """Login and get access token"""
    user = db.query(DBUser).filter(DBUser.username == username).first()
    if not user or not verify_password(password, str(user.hashed_password)):
        # Log failed login attempt
        ip = request.client.host if request and request.client else "-"
        log_failed_login(username, ip, "Invalid credentials")
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    access_token = create_access_token(data={"sub": user.username})
    refresh_token = create_refresh_token(data={"sub": user.username})
    return {"access_token": access_token, "refresh_token": refresh_token, "token_type": "bearer"}

@app.post("/auth/refresh")
@limiter.limit("10/minute")
async def refresh_token(request: Request, refresh_token: str, db: Session = Depends(get_db)):
    """Refresh access token using refresh token"""
    try:
        payload = jwt.decode(refresh_token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        token_type: str = payload.get("type")
        
        if username is None or token_type != "refresh":
            raise HTTPException(status_code=401, detail="Invalid refresh token")
        
        # Verify user still exists
        user = db.query(DBUser).filter(DBUser.username == username).first()
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        
        # Create new access token
        new_access_token = create_access_token(data={"sub": username})
        return {"access_token": new_access_token, "token_type": "bearer"}
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Refresh token has expired")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

@app.get("/users/me", response_model=UserOut, responses={404: {"model": ErrorResponse}})
async def get_current_user_info(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get current user information"""
    # Decrypt sensitive data before returning
    decrypted_phone = decrypt_sensitive_data(current_user.phone_number)
    
    # Create response with decrypted data
    user_response = {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "role": current_user.role,
        "phone_number": decrypted_phone,
        "location": current_user.location,
        "created_at": current_user.created_at,
        "is_active": current_user.is_active
    }
    return user_response

@app.post("/mothers/register", response_model=dict, responses={403: {"model": ErrorResponse}, 400: {"model": ErrorResponse}})
async def register_mother(mother: PregnantMotherIn, current_user: User = require_any_role([UserRole.CHV, UserRole.CLINICIAN]), db: Session = Depends(get_db)):
    """Register a new pregnant mother"""
    # Encrypt sensitive data
    encrypted_emergency_contact = encrypt_sensitive_data(mother.emergency_contact)
    
    db_mother = DBMother(
        id=str(uuid.uuid4()),
        user_id=mother.user_id,
        age=mother.age,
        gestational_age=mother.gestational_age,
        previous_pregnancies=mother.previous_pregnancies,
        previous_complications=','.join(mother.previous_complications) if mother.previous_complications else '',
        emergency_contact=encrypted_emergency_contact,
        assigned_chv_id=mother.assigned_chv_id,
        assigned_clinician_id=mother.assigned_clinician_id
    )
    db.add(db_mother)
    db.commit()
    db.refresh(db_mother)
    return {"message": "Mother registered successfully", "mother_id": db_mother.id}

@app.get("/mothers/", response_model=List[PregnantMotherOut])
async def list_mothers(skip: int = 0, limit: int = 10, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """List all mothers with pagination and eager load user and assessments, with caching."""
    cache_manager = get_cache_manager()
    cache_key = f"mothers:{current_user.id}:{skip}:{limit}"
    cached = cache_manager.get(cache_key)
    if cached:
        return cached
    mothers = db.query(DBMother).options(
        joinedload(DBMother.user),
        joinedload(DBMother.assessments)
    ).offset(skip).limit(limit).all()
    # Convert SQLAlchemy objects to dicts for caching
    mothers_out = [PregnantMotherOut.model_validate(mother.__dict__) for mother in mothers]
    cache_manager.set(cache_key, mothers_out, ttl=120)  # Cache for 2 minutes
    return mothers_out

@app.post("/assessments/create", response_model=dict)
@limiter.limit("10/minute")
async def create_assessment(request: Request, assessment: RiskAssessmentIn, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Create a new risk assessment with enhanced SHAP explanations"""
    try:
        # Prepare features for model prediction
        features = {
            'age': assessment.age,
            'systolic_bp': assessment.systolic_bp,
            'diastolic_bp': assessment.diastolic_bp,
            'blood_sugar': assessment.blood_sugar,
            'body_temp': assessment.body_temp,
            'heart_rate': assessment.heart_rate
        }
        
        # Get prediction with SHAP explanation
        risk_level, confidence = ml_model.predict_risk(features)
        
        # Get SHAP explanation
        shap_explainer = get_shap_explainer()
        shap_explanation = []
        shap_summary = {}
        
        if shap_explainer and shap_explainer.explainer is not None:
            try:
                # Get detailed SHAP explanation
                shap_explanation = shap_explainer.get_individual_explanation(features)
                shap_summary = shap_explainer.get_explanation_summary(features)
            except Exception as e:
                shap_explanation = []
                shap_summary = {"error": "Could not generate SHAP explanation"}
        
        # Calculate BMI
        bmi = assessment.weight / ((assessment.height / 100) ** 2)
        
        # Get recommendations
        recommendations = ml_model.get_recommendations(risk_level, features)
        
        # Create database record
        db_assessment = DBRiskAssessment(
            id=str(uuid.uuid4()),
            mother_id=assessment.mother_id,
            chv_id=current_user.id,
            assessment_date=datetime.now(),
            age=assessment.age,
            systolic_bp=assessment.systolic_bp,
            diastolic_bp=assessment.diastolic_bp,
            blood_sugar=assessment.blood_sugar,
            body_temp=assessment.body_temp,
            heart_rate=assessment.heart_rate,
            gestational_age=assessment.gestational_age,
            weight=assessment.weight,
            height=assessment.height,
            bmi=bmi,
            risk_level=risk_level.value,
            risk_score=confidence,
            symptoms=assessment.symptoms,
            notes=assessment.notes
        )
        
        db.add(db_assessment)
        db.commit()
        db.refresh(db_assessment)
        
        # Log the assessment
        log_audit(
            user_id=current_user.id,
            action="create_assessment",
            details=f"Assessment created for mother {assessment.mother_id} with risk level {risk_level.value}"
        )
        
        return {
            "success": True,
            "assessment_id": db_assessment.id,
            "prediction": {
                "risk_level": risk_level.value,
                "confidence": confidence,
                "bmi": round(bmi, 2)
            },
            "recommendations": recommendations,
            "shap_explanation": {
                "features": shap_explanation,
                "summary": shap_summary,
                "total_features": len(shap_explanation),
                "explanation_available": len(shap_explanation) > 0
            },
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        db.rollback()
        log_audit(
            user_id=current_user.id,
            action="create_assessment_failed",
            details=f"Failed to create assessment: {str(e)}"
        )
        raise HTTPException(status_code=500, detail=f"Failed to create assessment: {str(e)}")

@app.post("/assessments/bulk", response_model=dict)
@limiter.limit("5/minute")
async def create_bulk_assessments(request: Request, assessments: List[RiskAssessmentIn], current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Create multiple assessments with bulk processing and caching"""
    if current_user.role != UserRole.CHV:
        raise HTTPException(status_code=403, detail="Only CHVs can create assessments")
    
    # Audit log
    ip = request.client.host if request and request.client else "-"
    log_audit(
        user=current_user.username,
        role=current_user.role,
        ip=ip,
        endpoint="/assessments/bulk",
        action="create_bulk_assessments",
        resource_id=f"bulk_{len(assessments)}"
    )
    
    bg_task_manager = get_background_task_manager()
    cache_manager = get_cache_manager()
    
    # Process assessments asynchronously
    assessment_data = []
    for assessment in assessments:
        body_temp = assessment.body_temp
        if hasattr(assessment, "body_temp_unit") and assessment.body_temp_unit.upper() == "C":
            body_temp = body_temp * 9 / 5 + 32
        
        bmi = assessment.weight / ((assessment.height / 100) ** 2)
        features = {
            'age': assessment.age,
            'systolic_bp': assessment.systolic_bp,
            'diastolic_bp': assessment.diastolic_bp,
            'blood_sugar': assessment.blood_sugar,
            'body_temp': body_temp,
            'heart_rate': assessment.heart_rate,
            'gestational_age': assessment.gestational_age,
            'bmi': bmi
        }
        assessment_data.append(features)
    
    # Process predictions asynchronously
    results = await bg_task_manager.process_bulk_assessments_async(assessment_data, current_user.id)
    
    # Save to database and cache
    saved_assessments = []
    for i, (assessment, result) in enumerate(zip(assessments, results)):
        if isinstance(result, dict) and "error" not in result:
            db_assessment = DBRiskAssessment(
                id=str(uuid.uuid4()),
                mother_id=assessment.mother_id,
                chv_id=assessment.chv_id,
                assessment_date=datetime.now(),
                age=assessment.age,
                systolic_bp=assessment.systolic_bp,
                diastolic_bp=assessment.diastolic_bp,
                blood_sugar=assessment.blood_sugar,
                body_temp=body_temp,
                heart_rate=assessment.heart_rate,
                gestational_age=assessment.gestational_age,
                weight=assessment.weight,
                height=assessment.height,
                symptoms=assessment.symptoms or '',
                notes=assessment.notes,
                bmi=bmi,
                risk_level=result["risk_level"],
                risk_score=result["confidence"],
                confidence=result["confidence"],
                recommendations=','.join(result["recommendations"]) if result["recommendations"] else ''
            )
            db.add(db_assessment)
            saved_assessments.append({
                "assessment_id": db_assessment.id,
                "mother_id": assessment.mother_id,
                "risk_level": result["risk_level"],
                "confidence": result["confidence"],
                "cached": "cached_at" in result
            })
    
    db.commit()
    
    return {
        "message": f"Bulk assessment creation completed",
        "total_assessments": len(assessments),
        "successful_assessments": len(saved_assessments),
        "assessments": saved_assessments
    }

@app.get("/assessments/{mother_id}", response_model=List[RiskAssessmentOut])
@limiter.limit("20/minute")
async def get_mother_assessments(request: Request, mother_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get all assessments for a specific mother, with SHAP explanations."""
    # Audit log
    ip = request.client.host if request and request.client else "-"
    log_audit(
        user=current_user.username,
        role=current_user.role,
        ip=ip,
        endpoint=f"/assessments/{{mother_id}}",
        action="get_assessments",
        resource_id=mother_id
    )
    mother_assessments = db.query(DBRiskAssessment).filter(DBRiskAssessment.mother_id == mother_id).all()
    if not mother_assessments:
        raise HTTPException(status_code=404, detail="No assessments found")
    results = []
    for assessment in mother_assessments:
        # Reconstruct features for SHAP (use only model-required features)
        features_for_shap = {
            'Age': assessment.age,
            'SystolicBP': assessment.systolic_bp,
            'DiastolicBP': assessment.diastolic_bp,
            'BS': assessment.blood_sugar,
            'BodyTemp': assessment.body_temp,
            'HeartRate': assessment.heart_rate
        }
        # Enhanced SHAP explanation
        shap_explainer = get_shap_explainer()
        explanation = shap_explainer.get_individual_explanation(features_for_shap)
        # Convert to basic format for backward compatibility
        basic_explanation = []
        for exp in explanation:
            basic_explanation.append({
                "feature": exp["feature"],
                "shap_value": exp["shap_value"]
            })
        # Convert SQLAlchemy object to dict, add explanation
        assessment_dict = assessment.__dict__.copy()
        # Remove SQLAlchemy internal state if present
        assessment_dict.pop('_sa_instance_state', None)
        assessment_dict['explanation'] = basic_explanation
        results.append(assessment_dict)
    return results

@app.post("/appointments/create", response_model=dict)
async def create_appointment(appointment: AppointmentIn, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Create a new appointment"""
    if current_user.role not in [UserRole.CHV, UserRole.CLINICIAN]:
        raise HTTPException(status_code=403, detail="Not authorized")
    db_appointment = DBAppointment(
        id=str(uuid.uuid4()),
        mother_id=appointment.mother_id,
        clinician_id=appointment.clinician_id,
        chv_id=appointment.chv_id,
        appointment_date=appointment.appointment_date,
        status=appointment.status,
        reason=appointment.reason,
        notes=appointment.notes,
        created_at=datetime.now()
    )
    db.add(db_appointment)
    db.commit()
    db.refresh(db_appointment)
    return {"message": "Appointment created successfully", "appointment_id": db_appointment.id}

@app.get("/appointments/clinician/{clinician_id}", response_model=List[AppointmentOut])
async def get_clinician_appointments(clinician_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get all appointments for a clinician"""
    if current_user.role != UserRole.CLINICIAN:
        raise HTTPException(status_code=403, detail="Not authorized")
    clinician_appointments = db.query(DBAppointment).filter(DBAppointment.clinician_id == clinician_id).all()
    return clinician_appointments

@app.post("/medications/prescribe", response_model=dict)
async def prescribe_medication(medication: MedicationIn, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Prescribe medication to a mother"""
    if current_user.role != UserRole.CLINICIAN:
        raise HTTPException(status_code=403, detail="Only clinicians can prescribe medication")
    db_medication = DBMedication(
        id=str(uuid.uuid4()),
        mother_id=medication.mother_id,
        clinician_id=medication.clinician_id,
        medication_name=medication.medication_name,
        dosage=medication.dosage,
        frequency=medication.frequency,
        duration=medication.duration,
        instructions=medication.instructions,
        prescribed_at=datetime.now()
    )
    db.add(db_medication)
    db.commit()
    db.refresh(db_medication)
    return {"message": "Medication prescribed successfully", "medication_id": db_medication.id}

@app.get("/dashboard/chv/{chv_id}", response_model=dict)
async def get_chv_dashboard(chv_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get CHV dashboard data, with caching."""
    if current_user.role != UserRole.CHV:
        raise HTTPException(status_code=403, detail="Not authorized")
    cache_manager = get_cache_manager()
    cache_key = f"dashboard:chv:{chv_id}:{current_user.id}"
    cached = cache_manager.get(cache_key)
    if cached:
        return cached
    assigned_mothers = db.query(DBMother).filter(DBMother.assigned_chv_id == chv_id).all()
    recent_assessments = db.query(DBRiskAssessment).filter(DBRiskAssessment.chv_id == chv_id).all()
    high_risk_count = sum(1 for assessment in recent_assessments if assessment.risk_level is not None and assessment.risk_level.value == 'high')
    medium_risk_count = sum(1 for assessment in recent_assessments if assessment.risk_level is not None and assessment.risk_level.value == 'medium')
    low_risk_count = sum(1 for assessment in recent_assessments if assessment.risk_level is not None and assessment.risk_level.value == 'low')
    dashboard = {
        "assigned_mothers": len(assigned_mothers),
        "total_assessments": len(recent_assessments),
        "high_risk_count": high_risk_count,
        "medium_risk_count": medium_risk_count,
        "low_risk_count": low_risk_count,
        "recent_assessments": [a.__dict__ for a in recent_assessments[-10:]]
    }
    cache_manager.set(cache_key, dashboard, ttl=120)
    return dashboard

@app.get("/dashboard/clinician/{clinician_id}", response_model=dict)
async def get_clinician_dashboard(clinician_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get clinician dashboard data, with caching."""
    if current_user.role != UserRole.CLINICIAN:
        raise HTTPException(status_code=403, detail="Not authorized")
    cache_manager = get_cache_manager()
    cache_key = f"dashboard:clinician:{clinician_id}:{current_user.id}"
    cached = cache_manager.get(cache_key)
    if cached:
        return cached
    high_risk_cases = db.query(DBRiskAssessment).filter(DBRiskAssessment.risk_level == 'high').all()
    upcoming_appointments = db.query(DBAppointment).filter(
        DBAppointment.clinician_id == clinician_id,
        DBAppointment.status.in_(['scheduled', 'confirmed'])
    ).all()
    dashboard = {
        "high_risk_cases": len(high_risk_cases),
        "upcoming_appointments": len(upcoming_appointments),
        "high_risk_details": [a.__dict__ for a in high_risk_cases],
        "appointments": [a.__dict__ for a in upcoming_appointments]
    }
    cache_manager.set(cache_key, dashboard, ttl=120)
    return dashboard

@app.get("/dashboard/policymaker", response_model=dict)
async def get_policymaker_dashboard(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get policymaker dashboard data"""
    if current_user.role != UserRole.POLICYMAKER:
        raise HTTPException(status_code=403, detail="Not authorized")
    # Regional statistics
    regional_stats = {}
    all_assessments = db.query(DBRiskAssessment).all()
    all_mothers = db.query(DBMother).all()
    mother_dict = {m.id: m for m in all_mothers}
    for assessment in all_assessments:
        mother = mother_dict.get(assessment.mother_id)
        if mother is not None:
            location = mother.location if hasattr(mother, 'location') else 'Unknown'
            if location not in regional_stats:
                regional_stats[location] = {'high': 0, 'medium': 0, 'low': 0}
            if assessment.risk_level is not None:
                risk_val = assessment.risk_level.value
                if risk_val in regional_stats[location]:
                    regional_stats[location][risk_val] += 1
    # Overall statistics
    total_assessments = len(all_assessments)
    total_mothers = len(all_mothers)
    all_users = db.query(DBUser).all()
    total_appointments = db.query(DBAppointment).count()
    return {
        "total_mothers": total_mothers,
        "total_assessments": total_assessments,
        "regional_statistics": regional_stats,
        "system_overview": {
            "active_chvs": len([u for u in all_users if str(u.role) == 'chv' and bool(getattr(u, 'is_active', False))]),
            "active_clinicians": len([u for u in all_users if str(u.role) == 'clinician' and bool(getattr(u, 'is_active', False))]),
            "total_appointments": total_appointments
        }
    }

# Model status and testing endpoints
@app.get("/model/status")
async def get_model_status():
    """Get model loading status and information"""
    if model is None:
        return {
            "model_loaded": False,
            "status": "Model not loaded",
            "error": "Check server logs for model loading issues"
        }
    
    info = {
        "model_loaded": True,
        "model_type": str(type(model)),
        "has_predict": hasattr(model, 'predict'),
        "has_predict_proba": hasattr(model, 'predict_proba'),
        "pipeline_components": {},
        "feature_names": ml_model.feature_names,
        "risk_classes": []
    }
    
    # Get pipeline component information
    if hasattr(model, 'feature_engineer'):
        info["pipeline_components"]["feature_engineer"] = str(type(model.feature_engineer))
    if hasattr(model, 'scaler'):
        info["pipeline_components"]["scaler"] = str(type(model.scaler))
    if hasattr(model, 'model'):
        info["pipeline_components"]["model"] = str(type(model.model))
    if hasattr(model, 'label_encoder'):
        info["pipeline_components"]["label_encoder"] = str(type(model.label_encoder))
        if hasattr(model.label_encoder, 'classes_'):
            info["risk_classes"] = model.label_encoder.classes_.tolist()
    
    return info

@app.post("/model/test")
async def test_model_prediction():
    """Test the model with sample data"""
    if model is None:
        raise HTTPException(status_code=503, detail="Model not available")
    
    # Test with sample data
    test_features = {
        'age': 25.0,
        'systolic_bp': 120.0,
        'diastolic_bp': 80.0,
        'blood_sugar': 8.0,
        'body_temp': 98.6,
        'heart_rate': 72
    }
    risk_level, confidence = ml_model.predict_risk(test_features)
    recommendations = ml_model.get_recommendations(risk_level, test_features)
    # Enhanced SHAP explainability integration
    shap_explainer = get_shap_explainer()
    features_for_shap = {
        'Age': test_features['age'],
        'SystolicBP': test_features['systolic_bp'],
        'DiastolicBP': test_features['diastolic_bp'],
        'BS': test_features['blood_sugar'],
        'BodyTemp': test_features['body_temp'],
        'HeartRate': test_features['heart_rate']
    }
    
    explanation = shap_explainer.get_individual_explanation(features_for_shap)
    # Convert to basic format for backward compatibility
    basic_explanation = []
    for exp in explanation:
        basic_explanation.append({
            "feature": exp["feature"],
            "shap_value": exp["shap_value"]
        })
    return {
        "test_features": test_features,
        "prediction": {
            "risk_level": risk_level.value,
            "confidence": confidence,
            "recommendations": recommendations,
            "explanation": basic_explanation
        },
        "model_status": "working"
    }

@app.get("/cache/health")
async def get_cache_health():
    """Check cache health and statistics"""
    cache_manager = get_cache_manager()
    is_healthy = cache_manager.health_check()
    
    if is_healthy:
        try:
            # Get cache statistics
            info = cache_manager.redis_client.info()
            return {
                "status": "healthy",
                "redis_version": info.get("redis_version", "unknown"),
                "connected_clients": info.get("connected_clients", 0),
                "used_memory_human": info.get("used_memory_human", "unknown"),
                "total_commands_processed": info.get("total_commands_processed", 0)
            }
        except Exception as e:
            return {
                "status": "healthy",
                "error": f"Could not get detailed stats: {str(e)}"
            }
    else:
        return {
            "status": "unhealthy",
            "error": "Redis connection failed"
        }

@app.get("/cache/stats")
async def get_cache_stats():
    """Get detailed cache statistics"""
    cache_manager = get_cache_manager()
    
    try:
        # Get all keys with patterns
        model_keys = cache_manager.redis_client.keys("model_prediction:*")
        user_keys = cache_manager.redis_client.keys("user_session:*")
        assessment_keys = cache_manager.redis_client.keys("assessment:*")
        
        return {
            "model_predictions_cached": len(model_keys),
            "user_sessions_cached": len(user_keys),
            "assessments_cached": len(assessment_keys),
            "total_cached_items": len(model_keys) + len(user_keys) + len(assessment_keys)
        }
    except Exception as e:
        return {
            "error": f"Could not get cache stats: {str(e)}"
        }

@app.get("/performance/stats")
async def get_performance_stats():
    """Get overall performance statistics"""
    monitor = get_performance_monitor()
    return monitor.get_overall_stats()

@app.get("/performance/endpoints")
async def get_endpoint_performance():
    """Get performance statistics for all endpoints"""
    monitor = get_performance_monitor()
    return monitor.get_endpoints_summary()

@app.get("/performance/cache")
async def get_cache_performance():
    """Get cache performance statistics"""
    monitor = get_performance_monitor()
    return monitor.get_cache_summary()

@app.get("/shap/global")
@limiter.limit("20/minute")
async def get_global_feature_importance(request: Request, sample_size: int = 50):
    """Get global feature importance using SHAP values with optimized performance"""
    import asyncio
    import concurrent.futures
    
    # Limit sample size for performance - reduced from 100 to 50
    if sample_size > 100:
        sample_size = 100
    
    # Add caching for global feature importance
    cache_manager = get_cache_manager()
    cache_key = f"shap_global_importance_{sample_size}"
    
    # Check cache first
    cached_result = cache_manager.redis_client.get(cache_key)
    if cached_result:
        try:
            return json.loads(cached_result)
        except:
            pass  # Continue with computation if cache is invalid
    
    shap_explainer = get_shap_explainer()
    
    # Run SHAP computation with timeout - reduced timeout
    try:
        loop = asyncio.get_event_loop()
        with concurrent.futures.ThreadPoolExecutor() as executor:
            # Submit the SHAP computation to a thread pool with timeout
            future = loop.run_in_executor(
                executor, 
                lambda: shap_explainer.get_global_feature_importance(sample_size)
            )
            result = await asyncio.wait_for(future, timeout=20.0)  # Reduced from 30 to 20 seconds
            
            # Cache the result for 1 hour
            if 'error' not in result:
                cache_manager.redis_client.setex(cache_key, 3600, json.dumps(result))
            
    except asyncio.TimeoutError:
        return {"error": "SHAP computation timed out. Try with a smaller sample size (max 50)."}
    except Exception as e:
        return {"error": f"Could not compute global feature importance: {str(e)}"}
    
    return result

@app.get("/shap/summary-plot")
@limiter.limit("10/minute")
async def get_shap_summary_plot(request: Request, sample_size: int = 30):
    """Get SHAP summary plot as base64 image with optimized performance"""
    import asyncio
    import concurrent.futures
    
    # Limit sample size for performance - reduced from 50 to 30
    if sample_size > 50:
        sample_size = 50
    
    # Add caching for summary plots
    cache_manager = get_cache_manager()
    cache_key = f"shap_summary_plot_{sample_size}"
    
    # Check cache first
    cached_result = cache_manager.redis_client.get(cache_key)
    if cached_result:
        try:
            return json.loads(cached_result)
        except:
            pass  # Continue with computation if cache is invalid
    
    shap_explainer = get_shap_explainer()
    
    # Run SHAP computation with timeout - reduced timeout
    try:
        loop = asyncio.get_event_loop()
        with concurrent.futures.ThreadPoolExecutor() as executor:
            # Submit the SHAP computation to a thread pool with timeout
            future = loop.run_in_executor(
                executor, 
                lambda: shap_explainer.create_shap_summary_plot(sample_size)
            )
            plot_base64 = await asyncio.wait_for(future, timeout=15.0)  # Reduced from 30 to 15 seconds
    except asyncio.TimeoutError:
        return {"error": "SHAP computation timed out. Try with a smaller sample size (max 30)."}
    except Exception as e:
        return {"error": f"Could not generate SHAP summary plot: {str(e)}"}
    
    if plot_base64:
        result = {
            "plot_type": "summary_plot",
            "image_base64": plot_base64,
            "sample_size": sample_size,
            "description": "SHAP summary plot showing feature importance across multiple predictions"
        }
        
        # Cache the result for 30 minutes
        cache_manager.redis_client.setex(cache_key, 1800, json.dumps(result))
        
        return result
    else:
        return {"error": "Could not generate SHAP summary plot"}

@app.post("/shap/force-plot")
@limiter.limit("15/minute")
async def get_shap_force_plot(request: Request, features: Dict[str, float]):
    """Get SHAP force plot for individual prediction with optimized performance"""
    import asyncio
    import concurrent.futures
    
    # Add caching for force plots
    cache_manager = get_cache_manager()
    features_hash = hash(json.dumps(features, sort_keys=True))
    cache_key = f"shap_force_plot_{features_hash}"
    
    # Check cache first
    cached_result = cache_manager.redis_client.get(cache_key)
    if cached_result:
        try:
            return json.loads(cached_result)
        except:
            pass  # Continue with computation if cache is invalid
    
    shap_explainer = get_shap_explainer()
    
    # Run SHAP computation with timeout
    try:
        loop = asyncio.get_event_loop()
        with concurrent.futures.ThreadPoolExecutor() as executor:
            future = loop.run_in_executor(
                executor, 
                lambda: shap_explainer.create_shap_force_plot(features)
            )
            plot_base64 = await asyncio.wait_for(future, timeout=10.0)  # 10 second timeout
    except asyncio.TimeoutError:
        return {"error": "SHAP force plot generation timed out."}
    except Exception as e:
        return {"error": f"Could not generate SHAP force plot: {str(e)}"}
    
    if plot_base64:
        result = {
            "plot_type": "force_plot",
            "image_base64": plot_base64,
            "features": features,
            "description": "SHAP force plot showing how each feature contributes to this specific prediction"
        }
        
        # Cache the result for 15 minutes
        cache_manager.redis_client.setex(cache_key, 900, json.dumps(result))
        
        return result
    else:
        return {"error": "Could not generate SHAP force plot"}

@app.post("/shap/explanation")
@limiter.limit("20/minute")
async def get_enhanced_explanation(request: Request, features: Dict[str, float]):
    """Get enhanced SHAP explanation with detailed formatting and caching"""
    import asyncio
    import concurrent.futures
    
    # Add caching for explanations
    cache_manager = get_cache_manager()
    features_hash = hash(json.dumps(features, sort_keys=True))
    cache_key = f"shap_explanation_{features_hash}"
    
    # Check cache first
    cached_result = cache_manager.redis_client.get(cache_key)
    if cached_result:
        try:
            return json.loads(cached_result)
        except:
            pass  # Continue with computation if cache is invalid
    
    shap_explainer = get_shap_explainer()
    
    # Run SHAP computation with timeout
    try:
        loop = asyncio.get_event_loop()
        with concurrent.futures.ThreadPoolExecutor() as executor:
            future = loop.run_in_executor(
                executor, 
                lambda: (
                    shap_explainer.get_individual_explanation(features),
                    shap_explainer.get_explanation_summary(features)
                )
            )
            explanation, summary = await asyncio.wait_for(future, timeout=8.0)  # 8 second timeout
    except asyncio.TimeoutError:
        return {"error": "SHAP explanation generation timed out."}
    except Exception as e:
        return {"error": f"Could not generate SHAP explanation: {str(e)}"}
    
    result = {
        "features": features,
        "explanation": explanation,
        "summary": summary,
        "total_features": len(explanation),
        "explanation_available": len(explanation) > 0
    }
    
    # Cache the result for 10 minutes
    cache_manager.redis_client.setex(cache_key, 600, json.dumps(result))
    
    return result

@app.post("/shap/explanation-summary")
@limiter.limit("30/minute")
async def get_explanation_summary_only(request: Request, features: Dict[str, float]):
    """Get only the explanation summary (without detailed feature breakdown)"""
    shap_explainer = get_shap_explainer()
    summary = shap_explainer.get_explanation_summary(features)
    
    return {
        "features": features,
        "summary": summary,
        "explanation_available": "error" not in summary
    }

@app.post("/shap/comprehensive")
@limiter.limit("10/minute")
async def get_comprehensive_shap_analysis(request: Request, features: Dict[str, float]):
    """Get comprehensive SHAP analysis including all visualizations and explanations"""
    try:
        shap_explainer = get_shap_explainer()
        
        if not shap_explainer or shap_explainer.explainer is None:
            return {"error": "SHAP explainer not available"}
        
        # Get all SHAP analyses
        individual_explanation = shap_explainer.get_individual_explanation(features)
        explanation_summary = shap_explainer.get_explanation_summary(features)
        force_plot_b64 = shap_explainer.create_shap_force_plot(features)
        
        # Get global feature importance for context
        global_importance = shap_explainer.get_global_feature_importance(sample_size=50)
        
        return {
            "features": features,
            "individual_explanation": individual_explanation,
            "explanation_summary": explanation_summary,
            "force_plot": {
                "available": bool(force_plot_b64),
                "image_base64": force_plot_b64 if force_plot_b64 else None
            },
            "global_context": global_importance,
            "analysis_metadata": {
                "total_features_analyzed": len(individual_explanation),
                "explanation_quality": explanation_summary.get("explanation_quality", "unknown"),
                "positive_contributors": len([exp for exp in individual_explanation if exp.get("impact") == "positive"]),
                "negative_contributors": len([exp for exp in individual_explanation if exp.get("impact") == "negative"])
            }
        }
        
    except Exception as e:
        return {"error": f"Comprehensive SHAP analysis failed: {str(e)}"}

@app.get("/shap/model-info")
@limiter.limit("30/minute")
async def get_shap_model_info(request: Request):
    """Get information about the SHAP explainer and model compatibility"""
    try:
        shap_explainer = get_shap_explainer()
        
        if not shap_explainer:
            return {"error": "SHAP explainer not available"}
        
        info = {
            "explainer_available": shap_explainer.explainer is not None,
            "explainer_type": type(shap_explainer.explainer).__name__ if shap_explainer.explainer else None,
            "feature_names": shap_explainer.feature_names,
            "feature_descriptions": shap_explainer.feature_descriptions,
            "model_compatibility": "compatible" if shap_explainer.explainer else "incompatible",
            "supported_visualizations": [
                "individual_explanation",
                "force_plot",
                "summary_plot",
                "global_importance"
            ]
        }
        
        # Test basic functionality
        if shap_explainer.explainer:
            try:
                test_features = {
                    'Age': 30,
                    'SystolicBP': 120,
                    'DiastolicBP': 80,
                    'BS': 8.0,
                    'BodyTemp': 98.6,
                    'HeartRate': 75
                }
                test_explanation = shap_explainer.get_individual_explanation(test_features)
                info["test_successful"] = len(test_explanation) > 0
                info["test_features_analyzed"] = len(test_explanation)
            except Exception as e:
                info["test_successful"] = False
                info["test_error"] = str(e)
        else:
            info["test_successful"] = False
        
        return info
        
    except Exception as e:
        return {"error": f"Could not get SHAP model info: {str(e)}"}

@app.post("/shap/batch-explanation")
@limiter.limit("5/minute")
async def get_batch_shap_explanations(request: Request, features_list: List[Dict[str, float]]):
    """Get SHAP explanations for multiple predictions at once"""
    try:
        if len(features_list) > 10:
            return {"error": "Maximum 10 predictions allowed per batch"}
        
        shap_explainer = get_shap_explainer()
        
        if not shap_explainer or shap_explainer.explainer is None:
            return {"error": "SHAP explainer not available"}
        
        batch_results = []
        
        for i, features in enumerate(features_list):
            try:
                explanation = shap_explainer.get_individual_explanation(features)
                summary = shap_explainer.get_explanation_summary(features)
                
                batch_results.append({
                    "prediction_index": i,
                    "features": features,
                    "explanation": explanation,
                    "summary": summary,
                    "success": True
                })
            except Exception as e:
                batch_results.append({
                    "prediction_index": i,
                    "features": features,
                    "error": str(e),
                    "success": False
                })
        
        return {
            "batch_results": batch_results,
            "total_predictions": len(features_list),
            "successful_predictions": len([r for r in batch_results if r["success"]]),
            "failed_predictions": len([r for r in batch_results if not r["success"]])
        }
        
    except Exception as e:
        return {"error": f"Batch SHAP analysis failed: {str(e)}"}

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    return JSONResponse(
        status_code=500,
        content=ErrorResponse(detail="Internal server error").model_dump()
    )

@app.get("/shap/performance")
@limiter.limit("30/minute")
async def get_shap_performance_stats(request: Request):
    """Get SHAP performance statistics and cache information"""
    try:
        cache_manager = get_cache_manager()
        
        # Get SHAP-related cache keys
        shap_keys = cache_manager.redis_client.keys("shap_*")
        
        # Categorize cache keys
        cache_stats = {
            "global_importance_cache": len([k for k in shap_keys if b"global_importance" in k]),
            "summary_plot_cache": len([k for k in shap_keys if b"summary_plot" in k]),
            "force_plot_cache": len([k for k in shap_keys if b"force_plot" in k]),
            "explanation_cache": len([k for k in shap_keys if b"explanation" in k]),
            "total_shap_cache_entries": len(shap_keys)
        }
        
        # Get performance monitor stats
        monitor = get_performance_monitor()
        performance_stats = monitor.get_overall_stats()
        
        # SHAP-specific performance info
        shap_info = {
            "explainer_available": True,
            "explainer_type": "KernelExplainer",
            "recommended_sample_sizes": {
                "global_importance": "20-50 (cached for 1 hour)",
                "summary_plot": "20-30 (cached for 30 minutes)",
                "force_plot": "Individual (cached for 15 minutes)",
                "explanation": "Individual (cached for 10 minutes)"
            },
            "timeout_limits": {
                "global_importance": "20 seconds",
                "summary_plot": "15 seconds", 
                "force_plot": "10 seconds",
                "explanation": "8 seconds"
            },
            "performance_tips": [
                "Use smaller sample sizes for faster computation",
                "Cached results are served instantly",
                "Global importance is cached for 1 hour",
                "Individual explanations are cached for 10 minutes"
            ]
        }
        
        return {
            "cache_statistics": cache_stats,
            "performance_statistics": performance_stats,
            "shap_information": shap_info,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        return {"error": f"Could not get SHAP performance stats: {str(e)}"}

@app.get("/shap/clear-cache")
@limiter.limit("5/minute")
async def clear_shap_cache(request: Request):
    """Clear all SHAP-related cache entries"""
    try:
        cache_manager = get_cache_manager()
        
        # Get all SHAP cache keys
        shap_keys = cache_manager.redis_client.keys("shap_*")
        
        # Delete all SHAP cache entries
        if shap_keys:
            cache_manager.redis_client.delete(*shap_keys)
            deleted_count = len(shap_keys)
        else:
            deleted_count = 0
        
        return {
            "message": "SHAP cache cleared successfully",
            "deleted_entries": deleted_count,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        return {"error": f"Could not clear SHAP cache: {str(e)}"}

if __name__ == "__main__":
    import uvicorn
    print("🚀 Starting Maternal Health Multi-User System...")
    if model is not None:
        print("✅ Ready to serve predictions!")
    else:
        print("⚠️  Running without model - predictions will use fallback")
    uvicorn.run(app, host="0.0.0.0", port=8000)