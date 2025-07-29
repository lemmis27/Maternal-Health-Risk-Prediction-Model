from fastapi import FastAPI, HTTPException, Depends, status, BackgroundTasks, Form, WebSocket, WebSocketDisconnect
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.middleware.httpsredirect import HTTPSRedirectMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any, ClassVar
from datetime import datetime, timedelta, timezone, date
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
from schemas import UserOut, PregnantMotherOut, RiskAssessmentOut, AppointmentOut, MedicationOut, ErrorResponse, UserIn, PregnantMotherIn, RiskAssessmentIn, AppointmentIn, MedicationIn, MotherRegistrationIn
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
from fastapi import APIRouter
from pydantic import EmailStr
import logging

# Import chatbot endpoints
try:
    from chatbot_endpoints import router as chatbot_router
    CHATBOT_AVAILABLE = True
except ImportError:
    CHATBOT_AVAILABLE = False
    print("Warning: Chatbot endpoints not available. Install openai package to enable.")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler("maternal_health_backend.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

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

# Include chatbot router if available
if CHATBOT_AVAILABLE:
    app.include_router(chatbot_router)
    print("✅ Chatbot endpoints enabled")
else:
    print("⚠️ Chatbot endpoints disabled - install openai package to enable")

# Create all tables
print(">>> Creating all tables...")
Base.metadata.create_all(bind=engine)
print(">>> Tables created (if not already present).")

# CORS middleware - Production-ready configuration
# Get allowed origins from environment variable, fallback to development defaults
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:3001,http://localhost:3002,http://localhost:3003,http://localhost:8000,http://127.0.0.1:3000,http://127.0.0.1:3001,http://127.0.0.1:3002,http://127.0.0.1:3003,http://127.0.0.1:8000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    max_age=3600,  # Cache preflight requests for 1 hour
    expose_headers=["*"]
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
    # Skip validation for OPTIONS requests (CORS preflight)
    if request.method == "OPTIONS":
        response = await call_next(request)
        return response
    
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
    ADMIN = "admin"

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
    
    # Vital signs with clinically appropriate ranges for maternal health
    age: float = Field(..., description="Age of the patient", ge=15, le=50)
    systolic_bp: float = Field(..., description="Systolic Blood Pressure (mmHg)", ge=70, le=200)
    diastolic_bp: float = Field(..., description="Diastolic Blood Pressure (mmHg)", ge=40, le=120)
    blood_sugar: float = Field(..., description="Blood Sugar level (mmol/L)", ge=2.2, le=25.0)
    body_temp: float = Field(..., description="Body Temperature (°F)", ge=95.0, le=106.0)
    heart_rate: int = Field(..., description="Heart Rate (bpm)", ge=40, le=150)
    
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
            # print("✅ Model loaded successfully!")
            if hasattr(model, 'model'):
                pass
            if hasattr(model, 'label_encoder') and hasattr(model.label_encoder, 'classes_'):
                pass
        else:
            # print("❌ Model file not found at models/maternal_risk_pipeline.joblib")
            model = None
    except Exception as e:
        import traceback
        # traceback.print_exc()
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
    
    def predict_risk(self, features: Dict[str, float]) -> dict:
        # print(f"[DEBUG] predict_risk called with features type: {type(features)}")
        if isinstance(features, dict):
            # print(f"[DEBUG] Single sample keys: {list(features.keys())}")
            pass
        elif isinstance(features, pd.DataFrame):
            # print(f"[DEBUG] DataFrame shape: {features.shape}")
            pass
        else:
            # print(f"[DEBUG] Features: {features}")
            pass
        if self.model is None:
            return {
                'risk_level': RiskLevel.LOW,
                'confidence': 0.5,
                'probabilities': {}
            }
        try:
            # Build features dict with capitalized keys as expected by the pipeline
            features_for_model = {
                'Age': features.get('age', 25),
                'SystolicBP': features.get('systolic_bp', 120),
                'DiastolicBP': features.get('diastolic_bp', 80),
                'BS': features.get('blood_sugar', 8.0),
                'BodyTemp': features.get('body_temp', 98.6),
                'HeartRate': features.get('heart_rate', 72)
            }
            # print(f"[DEBUG] features_for_model: {features_for_model}")
            results = self.model.predict([features_for_model])
            if not results or not isinstance(results, list):
                raise ValueError("Model prediction did not return a list of results.")
            result = results[0]
            prediction_str = str(result.get('predicted_risk_level', 'low risk')).lower()
            risk_level = self.risk_mapping.get(prediction_str, RiskLevel.LOW)
            confidence = float(result.get('confidence_score', 0.5))
            prob_dict = result.get('probability', {})
            return {
                'risk_level': risk_level,
                'confidence': confidence,
                'probabilities': prob_dict
            }
        except Exception as e:
            import traceback
            # print(f"[ERROR] Exception in predict_risk: {e}")
            # traceback.print_exc()
            return {
                'risk_level': RiskLevel.LOW,
                'confidence': 0.5,
                'probabilities': {}
            }
    
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
    if not SECRET_KEY:
        raise HTTPException(status_code=500, detail="Server configuration error")
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
    if not SECRET_KEY:
        raise HTTPException(status_code=500, detail="Server configuration error")
    to_encode = data.copy()
    # Refresh tokens last longer but are used only for getting new access tokens
    expire = datetime.now(timezone.utc) + timedelta(days=7)
    to_encode.update({"exp": expire, "type": "refresh"})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Verify JWT token with improved error handling"""
    if not SECRET_KEY:
        raise HTTPException(status_code=500, detail="Server configuration error")
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
    logger.info(f"Getting current user for username: {username}")
    user = db.query(DBUser).filter(DBUser.username == username).first()
    if user is None:
        logger.error(f"User not found for username: {username}")
        raise HTTPException(status_code=404, detail="User not found")
    logger.info(f"Found user: {user.id} with role: {user.role}")
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

# Import WebSocket components
from websocket_manager import connection_manager, authenticate_websocket_user, handle_websocket_message
from notification_service import notification_service, NotificationType, NotificationPriority
from notification_triggers import notification_triggers

# Initialize WebSocket and notification services
@app.on_event("startup")
async def startup_event():
    """Initialize services on startup"""
    await connection_manager.initialize_redis()
    await notification_service.initialize()
    print("✅ WebSocket and Notification services initialized")

# API Routes

@app.get("/health")
async def health_check():
    """Health check endpoint for Docker and load balancers"""
    connected_users = await connection_manager.get_connected_users()
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "version": "1.0.0",
        "websocket_connections": connected_users
    }

@app.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    """WebSocket endpoint for real-time notifications"""
    # Get token from query parameters
    token = websocket.query_params.get("token")
    
    # Authenticate user
    user = await authenticate_websocket_user(token)
    if not user:
        await websocket.close(code=4001, reason="Unauthorized")
        return
    
    # Verify user_id matches authenticated user
    if user.id != user_id:
        await websocket.close(code=4003, reason="User ID mismatch")
        return
    
    # Connect user
    await connection_manager.connect(websocket, user_id, user.role)
    
    try:
        while True:
            # Listen for incoming messages
            data = await websocket.receive_text()
            try:
                message_data = json.loads(data)
                await handle_websocket_message(message_data, user_id, user.role)
            except json.JSONDecodeError:
                await connection_manager.send_personal_message(user_id, {
                    "type": "error",
                    "message": "Invalid JSON format"
                })
    except WebSocketDisconnect:
        await connection_manager.disconnect(websocket, user_id)
    except Exception as e:
        logger.error(f"WebSocket error for user {user_id}: {e}")
        await connection_manager.disconnect(websocket, user_id)

# Notification API Endpoints
@app.get("/notifications")
async def get_user_notifications(
    limit: int = 50,
    unread_only: bool = False,
    current_user: DBUser = Depends(get_current_user)
):
    """Get notifications for the current user"""
    notifications = await notification_service.get_user_notifications(
        user_id=current_user.id,
        limit=limit,
        unread_only=unread_only
    )
    return {"notifications": notifications}

@app.post("/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    current_user: DBUser = Depends(get_current_user)
):
    """Mark a notification as read"""
    success = await notification_service.mark_as_read(notification_id, current_user.id)
    if success:
        return {"message": "Notification marked as read"}
    else:
        raise HTTPException(status_code=404, detail="Notification not found")

@app.post("/notifications/{notification_id}/acknowledge")
async def acknowledge_notification(
    notification_id: str,
    current_user: DBUser = Depends(get_current_user)
):
    """Acknowledge a critical notification"""
    success = await notification_service.mark_as_acknowledged(notification_id, current_user.id)
    if success:
        return {"message": "Notification acknowledged"}
    else:
        raise HTTPException(status_code=404, detail="Notification not found")

@app.post("/notifications/{notification_id}/accept")
async def accept_critical_notification(
    notification_id: str,
    request: Request,
    current_user: DBUser = Depends(get_current_user)
):
    """Accept responsibility for a critical notification"""
    try:
        # Parse request body
        body = await request.json()
        
        # Mark notification as acknowledged
        success = await notification_service.mark_as_acknowledged(notification_id, current_user.id)
        
        if success:
            # Log the acceptance action
            logger.info(f"Critical case ACCEPTED by {current_user.staff_id} ({current_user.full_name}) for notification {notification_id}")
            
            # Create an audit log entry
            log_audit(
                user=current_user.username,
                role=current_user.role,
                ip=request.client.host if request and request.client else "-",
                endpoint=f"/notifications/{notification_id}/accept",
                action="accept_critical_case",
                resource_id=f"{notification_id}:staff_{current_user.staff_id}"
            )
            
            # Send notification to supervisors about acceptance
            try:
                await notification_service.send_notification(
                    user_id="admin",  # Notify admin
                    notification_type="case_accepted",
                    title="🏥 Critical Case Accepted",
                    message=f"Staff {current_user.staff_id} ({current_user.full_name}) accepted responsibility for critical case",
                    priority="medium",
                    data={
                        "original_notification_id": notification_id,
                        "accepting_staff_id": current_user.staff_id,
                        "accepting_staff_name": current_user.full_name,
                        "action": "accept"
                    }
                )
            except Exception as e:
                logger.error(f"Failed to send acceptance notification: {e}")
            
            return {
                "message": "Critical case accepted - responsibility assigned",
                "staff_id": current_user.staff_id,
                "staff_name": current_user.full_name,
                "action": "accepted"
            }
        else:
            raise HTTPException(status_code=404, detail="Notification not found")
            
    except Exception as e:
        logger.error(f"Error accepting critical notification: {e}")
        raise HTTPException(status_code=500, detail="Failed to accept critical case")

@app.post("/notifications/{notification_id}/recommend")
async def recommend_referral_notification(
    notification_id: str,
    request: Request,
    current_user: DBUser = Depends(get_current_user)
):
    """Recommend referral for a critical notification"""
    try:
        # Parse request body
        body = await request.json()
        recommendation_type = body.get("recommendation_type", "urgent_referral")
        notes = body.get("notes", "")
        
        # Mark notification as acknowledged
        success = await notification_service.mark_as_acknowledged(notification_id, current_user.id)
        
        if success:
            # Log the recommendation action
            logger.info(f"Referral RECOMMENDED by {current_user.staff_id} ({current_user.full_name}) for notification {notification_id}")
            
            # Create an audit log entry
            log_audit(
                user=current_user.username,
                role=current_user.role,
                ip=request.client.host if request and request.client else "-",
                endpoint=f"/notifications/{notification_id}/recommend",
                action="recommend_referral",
                resource_id=f"{notification_id}:staff_{current_user.staff_id}:{recommendation_type}"
            )
            
            # Send notification to supervisors and relevant staff about referral recommendation
            try:
                await notification_service.send_notification(
                    user_id="admin",  # Notify admin
                    notification_type="referral_recommended",
                    title="🚨 Urgent Referral Recommended",
                    message=f"Staff {current_user.staff_id} ({current_user.full_name}) recommends urgent referral for critical case",
                    priority="high",
                    data={
                        "original_notification_id": notification_id,
                        "recommending_staff_id": current_user.staff_id,
                        "recommending_staff_name": current_user.full_name,
                        "recommendation_type": recommendation_type,
                        "notes": notes,
                        "action": "recommend_referral"
                    }
                )
                
                # Also notify clinicians if the recommendation is from a CHV
                if current_user.role == UserRole.CHV:
                    # Find clinicians to notify
                    clinicians = db.query(DBUser).filter(DBUser.role == UserRole.CLINICIAN).all()
                    for clinician in clinicians:
                        await notification_service.send_notification(
                            user_id=clinician.id,
                            notification_type="referral_recommended",
                            title="🚨 CHV Referral Request",
                            message=f"CHV {current_user.staff_id} requests urgent referral for critical case",
                            priority="high",
                            data={
                                "original_notification_id": notification_id,
                                "chv_staff_id": current_user.staff_id,
                                "chv_name": current_user.full_name,
                                "recommendation_type": recommendation_type,
                                "notes": notes
                            }
                        )
            except Exception as e:
                logger.error(f"Failed to send referral recommendation notification: {e}")
            
            return {
                "message": "Referral recommendation submitted successfully",
                "staff_id": current_user.staff_id,
                "staff_name": current_user.full_name,
                "recommendation_type": recommendation_type,
                "action": "recommend_referral"
            }
        else:
            raise HTTPException(status_code=404, detail="Notification not found")
            
    except Exception as e:
        logger.error(f"Error recommending referral: {e}")
        raise HTTPException(status_code=500, detail="Failed to submit referral recommendation")

@app.get("/notifications/stats")
async def get_notification_stats(current_user: DBUser = Depends(get_current_user)):
    """Get notification statistics for the current user"""
    stats = await notification_service.get_notification_stats(user_id=current_user.id)
    return stats

@app.post("/notifications/test")
async def send_test_notification(
    current_user: DBUser = Depends(require_any_role([UserRole.ADMIN, UserRole.CLINICIAN]))
):
    """Send a test notification (admin/clinician only)"""
    await notification_service.send_notification(
        user_id=current_user.id,
        notification_type=NotificationType.SYSTEM_UPDATE,
        title="🧪 Test Notification",
        message="This is a test notification to verify the WebSocket system is working correctly.",
        priority=NotificationPriority.MEDIUM,
        data={"test": True, "timestamp": datetime.now().isoformat()}
    )
    return {"message": "Test notification sent"}

@app.options("/auth/register")
async def options_register():
    """Handle CORS preflight for registration"""
    return {"message": "OK"}

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
    
    # Generate user ID
    user_uuid = str(uuid.uuid4())
    
    # Generate staff ID based on role
    def generate_staff_id(role: UserRole, uuid_str: str) -> Optional[str]:
        """Generate human-readable staff ID based on role"""
        if role == UserRole.CLINICIAN:
            return f"C{uuid_str[:8].upper()}"
        elif role == UserRole.CHV:
            return f"H{uuid_str[:8].upper()}"
        elif role == UserRole.ADMIN:
            return f"A{uuid_str[:8].upper()}"
        else:
            return None  # Pregnant mothers don't get staff IDs
    
    staff_id = generate_staff_id(user.role, user_uuid)
    
    # Create new user
    db_user = DBUser(
        id=user_uuid,
        username=user.username,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        phone_number=encrypted_phone,
        location=user.location,
        staff_id=staff_id,
        hashed_password=hashed_password,
        created_at=datetime.now(),
        is_active=True
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    # If user is a pregnant mother, automatically create or link mother record
    mother_id = None
    if user.role == UserRole.PREGNANT_MOTHER:
        # If mother_id is provided, link user to existing mother record
        provided_mother_id = getattr(user, 'mother_id', None)
        if provided_mother_id:
            mother_record = db.query(DBMother).filter(DBMother.id == provided_mother_id).first()
            if mother_record:
                mother_record.user_id = db_user.id
                db.commit()
                mother_id = provided_mother_id
            else:
                # If not found, create new mother record
                mother_id = provided_mother_id
                db_mother = DBMother(
                    id=mother_id,
                    user_id=db_user.id,
                    age=25,  # Default age, should be updated
                    gestational_age=None,
                    previous_pregnancies=0,
                    previous_complications='',
                    emergency_contact=encrypted_phone,  # Use phone as emergency contact initially
                    assigned_chv_id=None,
                    assigned_clinician_id=None
                )
                db.add(db_mother)
                db.commit()
        else:
            # Generate a unique mother ID if not provided
            mother_id = f"M{db_user.id[:8].upper()}"
            db_mother = DBMother(
                id=mother_id,
                user_id=db_user.id,
                age=25,  # Default age, should be updated
                gestational_age=None,
                previous_pregnancies=0,
                previous_complications='',
                emergency_contact=encrypted_phone,  # Use phone as emergency contact initially
                assigned_chv_id=None,
                assigned_clinician_id=None
            )
            db.add(db_mother)
            db.commit()
    
    return {
        "message": "User registered successfully", 
        "user_id": db_user.id,
        "mother_id": mother_id
    }

@app.post("/auth/login")
@limiter.limit("5/minute")
async def login(request: Request, username: str = Form(...), password: str = Form(...), db: Session = Depends(get_db)):
    """Login and get access token"""
    user = db.query(DBUser).filter(DBUser.username == username).first()
    if not user or not verify_password(password, str(user.hashed_password)):
        # Log failed login attempt
        ip = request.client.host if request and request.client else "-"
        log_failed_login(username, ip, "Invalid credentials")
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    access_token = create_access_token(data={"sub": user.username})
    refresh_token = create_refresh_token(data={"sub": user.username})
    
    # Trigger login notification
    try:
        await notification_triggers.on_user_login(user)
    except Exception as e:
        logger.error(f"Error sending login notification: {e}")
        # Don't fail login if notification fails
    
    # Return user data along with tokens
    return {
        "access_token": access_token, 
        "refresh_token": refresh_token, 
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
            "phone_number": decrypt_sensitive_data(user.phone_number),
            "location": user.location,
            "staff_id": user.staff_id,
            "created_at": user.created_at,
            "is_active": user.is_active
        }
    }

@app.post("/auth/refresh")
@limiter.limit("10/minute")
async def refresh_token(request: Request, refresh_token: str = Form(...), db: Session = Depends(get_db)):
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
    try:
        # Decrypt phone number before returning
        if hasattr(current_user, 'phone_number'):
            try:
                current_user.phone_number = decrypt_sensitive_data(current_user.phone_number)
            except Exception as e:
                current_user.phone_number = ''  # fallback to empty if decryption fails
        
        return UserOut.model_validate(current_user)
    except Exception as e:
        raise HTTPException(status_code=404, detail="User not found")

@app.get("/staff", response_model=List[UserOut])
@limiter.limit("10/minute")
async def get_all_staff(request: Request, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get all staff members (CHVs, Clinicians, Admins) with their staff IDs"""
    
    # Only admins and clinicians can view all staff
    if current_user.role not in [UserRole.ADMIN, UserRole.CLINICIAN]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    log_audit(
        user=current_user.id,
        role=current_user.role.value,
        ip="unknown",
        endpoint="/staff",
        action="view_staff_list",
        resource_id="all"
    )
    
    # Get all staff members
    staff_members = db.query(DBUser).filter(
        DBUser.role.in_([UserRole.CLINICIAN, UserRole.CHV, UserRole.ADMIN])
    ).order_by(DBUser.role, DBUser.staff_id).all()
    
    # Decrypt phone numbers for display
    for staff in staff_members:
        try:
            staff.phone_number = decrypt_sensitive_data(staff.phone_number)
        except:
            staff.phone_number = ''
    
    return staff_members

@app.put("/mothers/{mother_id}/assign-staff")
@limiter.limit("10/minute")
async def assign_staff_to_mother(
    request: Request,
    mother_id: str,
    chv_staff_id: Optional[str] = None,
    clinician_staff_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Assign CHV and/or Clinician to a mother using their staff IDs"""
    
    # Only admins and clinicians can assign staff
    if current_user.role not in [UserRole.ADMIN, UserRole.CLINICIAN]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    # Get the mother record
    mother = db.query(DBMother).filter(DBMother.id == mother_id).first()
    if not mother:
        raise HTTPException(status_code=404, detail="Mother not found")
    
    # Validate and assign CHV
    if chv_staff_id:
        chv = db.query(DBUser).filter(
            DBUser.staff_id == chv_staff_id,
            DBUser.role == UserRole.CHV
        ).first()
        if not chv:
            raise HTTPException(status_code=404, detail=f"CHV with staff ID {chv_staff_id} not found")
        mother.assigned_chv_id = chv.id
    
    # Validate and assign clinician
    if clinician_staff_id:
        clinician = db.query(DBUser).filter(
            DBUser.staff_id == clinician_staff_id,
            DBUser.role == UserRole.CLINICIAN
        ).first()
        if not clinician:
            raise HTTPException(status_code=404, detail=f"Clinician with staff ID {clinician_staff_id} not found")
        mother.assigned_clinician_id = clinician.id
    
    db.commit()
    
    log_audit(
        user=current_user.id,
        role=current_user.role.value,
        ip="unknown",
        endpoint="/mothers/assign-staff",
        action="assign_staff",
        resource_id=mother_id
    )
    
    # Send notification to assigned staff
    if chv_staff_id:
        await notification_service.send_notification(
            user_id=mother.assigned_chv_id,
            notification_type=NotificationType.ASSIGNMENT_UPDATE,
            title="👥 New Patient Assignment",
            message=f"You have been assigned to patient {mother_id}",
            priority=NotificationPriority.MEDIUM,
            data={"mother_id": mother_id, "assignment_type": "chv"}
        )
    
    if clinician_staff_id:
        await notification_service.send_notification(
            user_id=mother.assigned_clinician_id,
            notification_type=NotificationType.ASSIGNMENT_UPDATE,
            title="👥 New Patient Assignment",
            message=f"You have been assigned to patient {mother_id}",
            priority=NotificationPriority.MEDIUM,
            data={"mother_id": mother_id, "assignment_type": "clinician"}
        )
    
    return {
        "message": "Staff assigned successfully",
        "mother_id": mother_id,
        "assigned_chv": chv_staff_id,
        "assigned_clinician": clinician_staff_id
    }

@app.get("/staff/{staff_id}/patients")
@limiter.limit("20/minute")
async def get_staff_patients(
    request: Request,
    staff_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all patients assigned to a specific staff member by their staff ID"""
    
    # Find the staff member
    staff_member = db.query(DBUser).filter(DBUser.staff_id == staff_id).first()
    if not staff_member:
        raise HTTPException(status_code=404, detail=f"Staff member with ID {staff_id} not found")
    
    # Check permissions - users can only see their own patients, admins can see all
    if current_user.role != UserRole.ADMIN and current_user.id != staff_member.id:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    # Get patients based on staff role
    if staff_member.role == UserRole.CHV:
        patients = db.query(DBMother).filter(
            DBMother.assigned_chv_id == staff_member.id
        ).options(joinedload(DBMother.user)).all()
    elif staff_member.role == UserRole.CLINICIAN:
        patients = db.query(DBMother).filter(
            DBMother.assigned_clinician_id == staff_member.id
        ).options(joinedload(DBMother.user)).all()
    else:
        raise HTTPException(status_code=400, detail="Staff member is not a CHV or Clinician")
    
    log_audit(
        user=current_user.id,
        role=current_user.role.value,
        ip="unknown",
        endpoint="/staff/patients",
        action="view_staff_patients",
        resource_id=staff_id
    )
    
    # Format response
    patient_list = []
    for patient in patients:
        try:
            # Decrypt emergency contact for display
            emergency_contact = decrypt_sensitive_data(patient.emergency_contact) if patient.emergency_contact else ""
        except:
            emergency_contact = ""
        
        patient_list.append({
            "id": patient.id,
            "user_id": patient.user_id,
            "age": patient.age,
            "gestational_age": patient.gestational_age,
            "previous_pregnancies": patient.previous_pregnancies,
            "emergency_contact": emergency_contact,
            "user_info": {
                "full_name": patient.user.full_name if patient.user else "Unknown",
                "email": patient.user.email if patient.user else "Unknown",
                "phone_number": decrypt_sensitive_data(patient.user.phone_number) if patient.user and patient.user.phone_number else ""
            } if patient.user else None
        })
    
    return {
        "staff_id": staff_id,
        "staff_name": staff_member.full_name,
        "staff_role": staff_member.role.value,
        "patient_count": len(patient_list),
        "patients": patient_list
    }

@app.get("/mothers/", response_model=List[PregnantMotherOut])
async def list_mothers(skip: int = 0, limit: int = 10, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """List all mothers with pagination and eager load user and assessments, with caching."""
    try:
        cache_manager = get_cache_manager()
        cache_key = f"mothers:{current_user.id}:{skip}:{limit}"
        cached = cache_manager.get(cache_key)
        if cached:
            return cached
        
        mothers = db.query(DBMother).options(
            joinedload(DBMother.user),
            joinedload(DBMother.assessments)
        ).offset(skip).limit(limit).all()
        
        mothers_out = []
        for mother in mothers:
            # Defensive: skip if required fields are missing or invalid
            age = getattr(mother, 'age', None)
            previous_pregnancies = getattr(mother, 'previous_pregnancies', None)
            if age is None or previous_pregnancies is None:
                logger.error(f"Skipping mother {getattr(mother, 'id', 'unknown')} due to missing required fields: age={age}, previous_pregnancies={previous_pregnancies}")
                continue
            # Decrypt phone number before passing to UserOut
            user_obj = mother.user
            if user_obj and hasattr(user_obj, 'phone_number'):
                phone_value = getattr(user_obj, 'phone_number', None)
                try:
                    if isinstance(phone_value, str):
                        user_obj.phone_number = decrypt_sensitive_data(phone_value)
                    else:
                        user_obj.phone_number = ''
                except Exception as e:
                    user_obj.phone_number = ''  # fallback to empty if decryption fails
            # Handle emergency_contact as string now
            emergency_contact_raw = getattr(mother, 'emergency_contact', None)
            try:
                if emergency_contact_raw is not None:
                    emergency_contact = str(emergency_contact_raw)
                else:
                    emergency_contact = None
            except Exception as e:
                emergency_contact = None  # fallback to None if conversion fails
            # Create PregnantMotherOut with proper validation, using actual values not columns
            mother_out = PregnantMotherOut(
                id=str(getattr(mother, 'id', '')),
                user_id=str(getattr(mother, 'user_id', '')),
                age=int(age),
                gestational_age=int(getattr(mother, 'gestational_age', 0)) if getattr(mother, 'gestational_age', None) is not None else None,
                previous_pregnancies=int(previous_pregnancies),
                previous_complications=str(getattr(mother, 'previous_complications', '')) if getattr(mother, 'previous_complications', None) is not None else None,
                emergency_contact=emergency_contact,
                assigned_chv_id=str(getattr(mother, 'assigned_chv_id', '')) if getattr(mother, 'assigned_chv_id', None) is not None else None,
                assigned_clinician_id=str(getattr(mother, 'assigned_clinician_id', '')) if getattr(mother, 'assigned_clinician_id', None) is not None else None,
                address=getattr(mother.user, 'location', None) if mother.user else None,
                created_at=getattr(mother, 'created_at', None)
            )
            mothers_out.append(mother_out)
        
        cache_manager.set(cache_key, mothers_out, ttl=120)  # Cache for 2 minutes
        return mothers_out
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error in /mothers/: {str(e)}")

@app.get("/mothers/enhanced", response_model=dict)
async def get_enhanced_mothers_list(
    skip: int = 0, 
    limit: int = 1000, 
    search: Optional[str] = None,
    risk_filter: Optional[str] = None,
    status_filter: Optional[str] = None,
    current_user: User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    """Enhanced mothers list with filtering, search, and comprehensive data for dashboard."""
    try:
        cache_manager = get_cache_manager()
        cache_key = f"enhanced_mothers:{current_user.id}:{skip}:{limit}:{search}:{risk_filter}:{status_filter}"
        cached = cache_manager.get(cache_key)
        if cached:
            return cached
        
        # Get mothers with all related data
        query = db.query(DBMother).options(
            joinedload(DBMother.user),
            joinedload(DBMother.assigned_chv),
            joinedload(DBMother.assigned_clinician),
            joinedload(DBMother.assessments)
        )
        
        # Role-based filtering
        if current_user.role == UserRole.CHV:
            query = query.filter(DBMother.assigned_chv_id == current_user.id)
        elif current_user.role == UserRole.CLINICIAN:
            query = query.filter(DBMother.assigned_clinician_id == current_user.id)
        # Admin sees all mothers
        
        mothers = query.offset(skip).limit(limit).all()
        
        # Process mothers data
        mothers_data = []
        for mother in mothers:
            # Get latest assessment
            latest_assessment = None
            if mother.assessments:
                latest_assessment = max(mother.assessments, key=lambda a: a.assessment_date)
            
            current_risk = 'low'  # default
            if latest_assessment and latest_assessment.risk_level:
                current_risk = latest_assessment.risk_level.value
            
            # Decrypt sensitive data
            phone_number = ''
            if mother.user and mother.user.phone_number:
                try:
                    phone_number = decrypt_sensitive_data(mother.user.phone_number)
                except:
                    phone_number = ''
            
            mother_data = {
                'id': mother.id,
                'full_name': mother.user.full_name if mother.user else 'Unknown',
                'age': mother.age,
                'gestational_age': mother.gestational_age,
                'phone_number': phone_number,
                'location': mother.user.location if mother.user else '',
                'emergency_contact': str(mother.emergency_contact) if mother.emergency_contact else '',
                'assigned_chv': mother.assigned_chv.full_name if mother.assigned_chv else None,
                'assigned_clinician': mother.assigned_clinician.full_name if mother.assigned_clinician else None,
                'current_risk_level': current_risk,
                'last_assessment_date': latest_assessment.assessment_date.isoformat() if latest_assessment else None,
                'total_assessments': len(mother.assessments),
                'created_at': mother.created_at.isoformat() if hasattr(mother, 'created_at') and mother.created_at else None,
                'user_id': mother.user_id,
                'needs_assessment': not latest_assessment or (datetime.now() - latest_assessment.assessment_date).days > 30
            }
            
            # Apply search filter
            if search:
                search_lower = search.lower()
                if not (search_lower in mother_data['full_name'].lower() or 
                       search_lower in mother_data['id'].lower() or
                       search_lower in mother_data['phone_number']):
                    continue
            
            # Apply risk filter
            if risk_filter and risk_filter != 'all':
                if mother_data['current_risk_level'] != risk_filter:
                    continue
            
            # Apply status filter
            if status_filter and status_filter != 'all':
                if status_filter == 'high_risk' and mother_data['current_risk_level'] != 'high':
                    continue
                elif status_filter == 'needs_assessment' and not mother_data['needs_assessment']:
                    continue
                elif status_filter == 'recent':
                    if not mother_data['created_at']:
                        continue
                    days_since_created = (datetime.now() - datetime.fromisoformat(mother_data['created_at'].replace('Z', '+00:00'))).days
                    if days_since_created > 7:
                        continue
            
            mothers_data.append(mother_data)
        
        # Calculate statistics
        total = len(mothers_data)
        high_risk = len([m for m in mothers_data if m['current_risk_level'] == 'high'])
        medium_risk = len([m for m in mothers_data if m['current_risk_level'] == 'medium'])
        low_risk = len([m for m in mothers_data if m['current_risk_level'] == 'low'])
        needs_assessment = len([m for m in mothers_data if m['needs_assessment']])
        
        result = {
            'mothers': mothers_data,
            'statistics': {
                'total': total,
                'high_risk': high_risk,
                'medium_risk': medium_risk,
                'low_risk': low_risk,
                'needs_assessment': needs_assessment
            },
            'filters_applied': {
                'search': search,
                'risk_filter': risk_filter,
                'status_filter': status_filter,
                'user_role': current_user.role.value
            }
        }
        
        cache_manager.set(cache_key, result, ttl=60)  # Cache for 1 minute
        return result
        
    except Exception as e:
        logger.error(f"Error in enhanced mothers list: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching enhanced mothers list: {str(e)}")

@app.get("/mothers/export/csv")
async def export_mothers_csv(
    search: Optional[str] = None,
    risk_filter: Optional[str] = None,
    status_filter: Optional[str] = None,
    current_user: User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    """Export mothers list to CSV format."""
    try:
        # Get the enhanced mothers data using the same logic
        response_data = await get_enhanced_mothers_list(
            skip=0, 
            limit=10000,  # Get all mothers for export
            search=search,
            risk_filter=risk_filter,
            status_filter=status_filter,
            current_user=current_user,
            db=db
        )
        
        mothers_data = response_data['mothers']
        
        # Create CSV content
        import csv
        import io
        
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Write header
        writer.writerow([
            'Mother ID', 'Full Name', 'Age', 'Phone Number', 'Location',
            'Gestational Age', 'Emergency Contact', 'Risk Level',
            'Last Assessment Date', 'Total Assessments', 'Assigned CHV',
            'Assigned Clinician', 'Registration Date'
        ])
        
        # Write data rows
        for mother in mothers_data:
            writer.writerow([
                mother['id'],
                mother['full_name'],
                mother['age'],
                mother['phone_number'],
                mother['location'],
                mother['gestational_age'] or '',
                mother['emergency_contact'],
                mother['current_risk_level'].upper(),
                mother['last_assessment_date'] or 'Never',
                mother['total_assessments'],
                mother['assigned_chv'] or 'Not assigned',
                mother['assigned_clinician'] or 'Not assigned',
                mother['created_at'] or ''
            ])
        
        # Create response
        from fastapi.responses import StreamingResponse
        output.seek(0)
        
        # Generate filename with timestamp
        from datetime import datetime
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"mothers_export_{timestamp}.csv"
        
        return StreamingResponse(
            io.BytesIO(output.getvalue().encode('utf-8')),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
        
    except Exception as e:
        logger.error(f"Error exporting mothers CSV: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error exporting CSV: {str(e)}")

@app.post("/assessments/create", response_model=dict)
@limiter.limit("10/minute")
async def create_assessment(request: Request, assessment: RiskAssessmentIn, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # print("ENTERED /assessments/create endpoint")
    if current_user.role not in [UserRole.CHV, UserRole.CLINICIAN]:
        raise HTTPException(status_code=403, detail="Only CHVs and Clinicians can create assessments")
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
        # Prepare features for SHAP with correct names
        features_for_shap = {
            'Age': assessment.age,
            'SystolicBP': assessment.systolic_bp,
            'DiastolicBP': assessment.diastolic_bp,
            'BS': assessment.blood_sugar,
            'BodyTemp': assessment.body_temp,
            'HeartRate': assessment.heart_rate
        }
        # Get prediction with SHAP explanation
        prediction_result = ml_model.predict_risk(features)
        risk_level = prediction_result['risk_level']
        confidence = prediction_result['confidence']
        probabilities = prediction_result.get('probabilities', {})
        # Get SHAP explanation
        shap_explainer = get_shap_explainer()
        shap_explanation = []
        shap_summary = {}
        if shap_explainer and shap_explainer.explainer is not None:
            try:
                shap_explanation = shap_explainer.get_individual_explanation(features_for_shap)
                shap_summary = shap_explainer.get_explanation_summary(features_for_shap)
            except Exception as e:
                shap_explanation = []
                shap_summary = {"error": "Could not generate SHAP explanation"}
        # Calculate BMI
        bmi = assessment.weight / ((assessment.height / 100) ** 2)
        # Get recommendations
        recommendations = ml_model.get_recommendations(risk_level, features)
        # Determine chv_id based on user role and assessment data
        if current_user.role == UserRole.CHV:
            chv_id = current_user.id
            if not chv_id:
                raise HTTPException(status_code=400, detail="CHV ID is required for risk assessment")
        elif current_user.role == UserRole.CLINICIAN:
            chv_id = assessment.chv_id if assessment.chv_id else None
            # Optionally, try to assign from mother, but do NOT raise error if missing
            if not chv_id:
                mother = db.query(DBMother).filter(DBMother.id == assessment.mother_id).first()
                if mother is not None and getattr(mother, 'assigned_chv_id', None) is not None and str(getattr(mother, 'assigned_chv_id')) != "None":
                    chv_id = getattr(mother, 'assigned_chv_id')
            # Do NOT raise error if chv_id is still None
        else:
            chv_id = None
        # Remove unconditional error for missing chv_id
        # If chv_id is still None, try to get it from the mother record
        if not chv_id:
            mother = db.query(DBMother).filter(DBMother.id == assessment.mother_id).first()
            if mother is not None and getattr(mother, 'assigned_chv_id', None) is not None and str(getattr(mother, 'assigned_chv_id')) != "None":
                chv_id = getattr(mother, 'assigned_chv_id')
            else:
                chv_id = None
        # Handle symptoms - convert array to string if needed
        symptoms_str = assessment.symptoms
        if isinstance(symptoms_str, list):
            symptoms_str = ', '.join(symptoms_str)
        # Auto-assign staff to mother based on who performed the assessment
        mother = db.query(DBMother).filter(DBMother.id == assessment.mother_id).first()
        if mother:
            assignment_updated = False
            
            if current_user.role == UserRole.CHV:
                # If CHV is performing assessment and not already assigned, assign them
                if not mother.assigned_chv_id:
                    mother.assigned_chv_id = current_user.id
                    assignment_updated = True
                    logger.info(f"Auto-assigned CHV {current_user.staff_id} ({current_user.full_name}) to mother {mother.id}")
                    
            elif current_user.role == UserRole.CLINICIAN:
                # If Clinician is performing assessment and not already assigned, assign them
                if not mother.assigned_clinician_id:
                    mother.assigned_clinician_id = current_user.id
                    assignment_updated = True
                    logger.info(f"Auto-assigned Clinician {current_user.staff_id} ({current_user.full_name}) to mother {mother.id}")
            
            # Commit assignment changes if any were made
            if assignment_updated:
                db.commit()
                db.refresh(mother)

        # Create database record
        db_assessment = DBRiskAssessment(
            id=str(uuid.uuid4()),
            mother_id=assessment.mother_id,
            chv_id=chv_id,
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
            risk_level=risk_level.value if hasattr(risk_level, 'value') else str(risk_level),
            risk_score=confidence,
            symptoms=symptoms_str,
            notes=assessment.notes
        )
        db.add(db_assessment)
        db.commit()
        db.refresh(db_assessment)
        
        # Trigger notifications based on assessment results
        try:
            # Send notification for completed assessment
            await notification_triggers.on_assessment_completed(db_assessment)
            
            # Send critical alert if high risk
            if risk_level == RiskLevel.HIGH:
                await notification_triggers.on_high_risk_assessment(db_assessment)
                
        except Exception as e:
            logger.error(f"Error sending assessment notifications: {e}")
            # Don't fail the assessment creation if notifications fail
        
        # Invalidate cache for pregnant mother dashboard
        cache_manager = get_cache_manager()
        mother = db.query(DBMother).filter(DBMother.id == assessment.mother_id).first()
        if mother:
            cache_key = f"dashboard:pregnant_mother:{mother.user_id}"
            cache_manager.delete(cache_key)
            logger.info(f"[CACHE] Invalidated pregnant mother dashboard cache for user {mother.user_id}")
        
        # Log the assessment
        log_audit(
            user=current_user.id,
            role=str(current_user.role),
            ip=request.client.host if request and request.client else "-",
            endpoint="/assessments/create",
            action="create_assessment",
            resource_id=assessment.mother_id
        )
        print(f"Returning prediction: risk_level={risk_level}, confidence={confidence}, probabilities={probabilities}")
        return {
            "success": True,
            "assessment_id": db_assessment.id,
            "prediction": {
                "risk_level": risk_level.value if hasattr(risk_level, 'value') else str(risk_level),
                "confidence": confidence,
                "probabilities": probabilities,
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
        import traceback
        db.rollback()
        logger.error("EXCEPTION in /assessments/create: %s", e)
        logger.error(traceback.format_exc())
        log_audit(
            user_id=getattr(current_user, 'id', 'unknown'),
            action="create_assessment_failed",
            details=f"Failed to create assessment: {str(e)}"
        )
        raise HTTPException(status_code=500, detail=f"Failed to create assessment: {str(e)}")

@app.post("/assessments/bulk", response_model=dict)
@limiter.limit("5/minute")
async def create_bulk_assessments(request: Request, assessments: List[RiskAssessmentIn], current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Create multiple assessments with bulk processing and caching"""
    if current_user.role not in [UserRole.CHV, UserRole.CLINICIAN]:
        raise HTTPException(status_code=403, detail="Only CHVs and Clinicians can create assessments")
    
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
            # Determine chv_id based on user role and assessment data
            if current_user.role == UserRole.CHV:
                chv_id = current_user.id
                if not chv_id:
                    raise HTTPException(status_code=400, detail="CHV ID is required for risk assessment")
            elif current_user.role == UserRole.CLINICIAN:
                chv_id = assessment.chv_id if assessment.chv_id else None
                # Optionally, try to assign from mother, but do NOT raise error if missing
                if not chv_id:
                    mother = db.query(DBMother).filter(DBMother.id == assessment.mother_id).first()
                    if mother is not None and getattr(mother, 'assigned_chv_id', None) is not None and str(getattr(mother, 'assigned_chv_id')) != "None":
                        chv_id = getattr(mother, 'assigned_chv_id')
                # Do NOT raise error if chv_id is still None
            else:
                chv_id = None
            # Auto-assign staff to mother based on who performed the assessment
            mother = db.query(DBMother).filter(DBMother.id == assessment.mother_id).first()
            if mother:
                assignment_updated = False
                
                if current_user.role == UserRole.CHV:
                    # If CHV is performing assessment and not already assigned, assign them
                    if not mother.assigned_chv_id:
                        mother.assigned_chv_id = current_user.id
                        assignment_updated = True
                        logger.info(f"Auto-assigned CHV {current_user.staff_id} ({current_user.full_name}) to mother {mother.id}")
                        
                elif current_user.role == UserRole.CLINICIAN:
                    # If Clinician is performing assessment and not already assigned, assign them
                    if not mother.assigned_clinician_id:
                        mother.assigned_clinician_id = current_user.id
                        assignment_updated = True
                        logger.info(f"Auto-assigned Clinician {current_user.staff_id} ({current_user.full_name}) to mother {mother.id}")
                
                # Commit assignment changes if any were made
                if assignment_updated:
                    db.commit()
                    db.refresh(mother)

            # Remove unconditional error for missing chv_id
            # If chv_id is still None, try to get it from the mother record
            if not chv_id:
                mother = db.query(DBMother).filter(DBMother.id == assessment.mother_id).first()
                if mother is not None and getattr(mother, 'assigned_chv_id', None) is not None and str(getattr(mother, 'assigned_chv_id')) != "None":
                    chv_id = getattr(mother, 'assigned_chv_id')
                else:
                    chv_id = None
            
            # Handle symptoms - convert array to string if needed
            symptoms_str = assessment.symptoms or ''
            if isinstance(symptoms_str, list):
                symptoms_str = ', '.join(symptoms_str)
            
            db_assessment = DBRiskAssessment(
                id=str(uuid.uuid4()),
                mother_id=assessment.mother_id,
                chv_id=chv_id,
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
                symptoms=symptoms_str,
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
    
    # Handle CHV creating appointments (they may not have a clinician_id)
    if current_user.role == UserRole.CHV:
        # CHV can create appointments but need to assign a clinician
        clinician_id = appointment.clinician_id if appointment.clinician_id else None
        chv_id = current_user.id
    else:
        # Clinician creating appointment
        clinician_id = current_user.id
        chv_id = appointment.chv_id if hasattr(appointment, 'chv_id') else None
    
    if not clinician_id:
        raise HTTPException(status_code=400, detail="Clinician ID is required for appointment.")

    db_appointment = DBAppointment(
        id=str(uuid.uuid4()),
        mother_id=appointment.mother_id,
        clinician_id=clinician_id,
        chv_id=chv_id,
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
    """Get CHV dashboard data with assigned mothers, with caching."""
    if current_user.role != UserRole.CHV:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    cache_manager = get_cache_manager()
    cache_key = f"dashboard:chv:{chv_id}:{current_user.id}"
    cached = cache_manager.get(cache_key)
    if cached:
        return cached
    
    # Get mothers assigned to this CHV
    assigned_mothers = db.query(DBMother).options(
        joinedload(DBMother.user),
        joinedload(DBMother.assessments),
        joinedload(DBMother.assigned_clinician)
    ).filter(DBMother.assigned_chv_id == chv_id).all()
    
    # Get assessments done by this CHV
    my_assessments = db.query(DBRiskAssessment).filter(DBRiskAssessment.chv_id == chv_id).all()
    
    # Process mothers data
    mothers_data = []
    risk_distribution = {'high': 0, 'medium': 0, 'low': 0}
    high_risk_cases = []
    
    for mother in assigned_mothers:
        # Get latest assessment
        latest_assessment = None
        if mother.assessments:
            latest_assessment = max(mother.assessments, key=lambda a: a.assessment_date)
        
        current_risk = 'low'  # default
        if latest_assessment and latest_assessment.risk_level:
            current_risk = latest_assessment.risk_level.value
            if current_risk == 'high':
                high_risk_cases.append(latest_assessment)
        
        risk_distribution[current_risk] += 1
        
        # Prepare mother data
        mother_data = {
            'id': mother.id,
            'full_name': mother.user.full_name if mother.user else 'Unknown',
            'age': mother.age,
            'phone_number': decrypt_sensitive_data(mother.user.phone_number) if mother.user and mother.user.phone_number else '',
            'gestational_age': mother.gestational_age,
            'current_risk_level': current_risk,
            'last_assessment_date': latest_assessment.assessment_date.isoformat() if latest_assessment else None,
            'assigned_clinician': mother.assigned_clinician.full_name if mother.assigned_clinician else None,
            'total_assessments': len(mother.assessments),
            'needs_assessment': not latest_assessment or (datetime.now() - latest_assessment.assessment_date).days > 30
        }
        mothers_data.append(mother_data)
    
    # Sort mothers by risk level (high first) then by those needing assessment
    mothers_data.sort(key=lambda x: (
        0 if x['current_risk_level'] == 'high' else 1 if x['current_risk_level'] == 'medium' else 2,
        0 if x['needs_assessment'] else 1,
        x['last_assessment_date'] or ''
    ), reverse=True)
    
    # Recent assessments done by this CHV
    recent_assessments_data = []
    for assessment in sorted(my_assessments, key=lambda a: a.assessment_date, reverse=True)[:10]:
        mother = next((m for m in assigned_mothers if m.id == assessment.mother_id), None)
        recent_assessments_data.append({
            'id': assessment.id,
            'mother_name': mother.user.full_name if mother and mother.user else 'Unknown',
            'risk_level': assessment.risk_level.value if assessment.risk_level else 'low',
            'assessment_date': assessment.assessment_date.isoformat(),
            'confidence': assessment.confidence
        })
    
    dashboard = {
        "assigned_mothers": len(assigned_mothers),
        "total_assessments": len(my_assessments),
        "high_risk_count": risk_distribution['high'],
        "medium_risk_count": risk_distribution['medium'],
        "low_risk_count": risk_distribution['low'],
        "risk_distribution": risk_distribution,
        "mothers": mothers_data,
        "recent_assessments": recent_assessments_data,
        "mothers_needing_assessment": len([m for m in mothers_data if m['needs_assessment']]),
        "high_risk_cases": len(high_risk_cases)
    }
    
    cache_manager.set(cache_key, dashboard, ttl=120)
    return dashboard

@app.get("/dashboard/clinician/{clinician_id}", response_model=dict)
async def get_clinician_dashboard(clinician_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get clinician dashboard data with mothers they registered, with caching."""
    if current_user.role != UserRole.CLINICIAN:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    cache_manager = get_cache_manager()
    cache_key = f"dashboard:clinician:{clinician_id}:{current_user.id}"
    cached = cache_manager.get(cache_key)
    if cached:
        logger.info(f"[DASHBOARD] Returning cached dashboard for clinician {clinician_id}")
        return cached
    
    # Get mothers registered by this clinician
    my_mothers = db.query(DBMother).options(
        joinedload(DBMother.user),
        joinedload(DBMother.assessments),
        joinedload(DBMother.appointments)
    ).filter(DBMother.assigned_clinician_id == clinician_id).all()
    
    # Get high risk cases from my mothers
    high_risk_cases = []
    my_mothers_data = []
    risk_distribution = {'high': 0, 'medium': 0, 'low': 0}
    
    for mother in my_mothers:
        # Get latest assessment
        latest_assessment = None
        if mother.assessments:
            latest_assessment = max(mother.assessments, key=lambda a: a.assessment_date)
        
        current_risk = 'low'  # default
        if latest_assessment and latest_assessment.risk_level:
            current_risk = latest_assessment.risk_level.value
            if current_risk == 'high':
                high_risk_cases.append(latest_assessment)
        
        risk_distribution[current_risk] += 1
        
        # Prepare mother data
        mother_data = {
            'id': mother.id,
            'full_name': mother.user.full_name if mother.user else 'Unknown',
            'age': mother.age,
            'phone_number': decrypt_sensitive_data(mother.user.phone_number) if mother.user and mother.user.phone_number else '',
            'gestational_age': mother.gestational_age,
            'current_risk_level': current_risk,
            'last_assessment_date': latest_assessment.assessment_date.isoformat() if latest_assessment else None,
            'total_assessments': len(mother.assessments),
            'created_at': mother.created_at.isoformat() if hasattr(mother, 'created_at') and mother.created_at else None
        }
        my_mothers_data.append(mother_data)
    
    # Sort mothers by risk level (high first) then by last assessment date
    my_mothers_data.sort(key=lambda x: (
        0 if x['current_risk_level'] == 'high' else 1 if x['current_risk_level'] == 'medium' else 2,
        x['last_assessment_date'] or ''
    ), reverse=True)
    
    # Get upcoming appointments for this clinician
    upcoming_appointments = db.query(DBAppointment).options(
        joinedload(DBAppointment.mother).joinedload(DBMother.user)
    ).filter(
        DBAppointment.clinician_id == clinician_id,
        DBAppointment.status.in_(['scheduled', 'confirmed']),
        DBAppointment.appointment_date >= datetime.now()
    ).order_by(DBAppointment.appointment_date).all()
    
    appointments_data = []
    for appointment in upcoming_appointments:
        appointments_data.append({
            'id': appointment.id,
            'mother_name': appointment.mother.user.full_name if appointment.mother and appointment.mother.user else 'Unknown',
            'appointment_date': appointment.appointment_date.isoformat(),
            'reason': appointment.reason,
            'status': appointment.status.value if appointment.status else 'scheduled'
        })
    
    dashboard = {
        "total_mothers": len(my_mothers),
        "high_risk_cases": len(high_risk_cases),
        "upcoming_appointments": len(upcoming_appointments),
        "risk_distribution": risk_distribution,
        "mothers": my_mothers_data,
        "appointments": appointments_data,
        "recent_registrations": len([m for m in my_mothers_data if m['created_at'] and 
                                   (datetime.now() - datetime.fromisoformat(m['created_at'].replace('Z', '+00:00'))).days <= 7])
    }
    
    logger.info(f"[DASHBOARD] Dashboard for clinician {clinician_id}: {len(my_mothers)} mothers, {len(high_risk_cases)} high risk")
    cache_manager.set(cache_key, dashboard, ttl=120)
    return dashboard

@app.get("/dashboard/admin", response_model=dict)
async def get_admin_dashboard(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get admin dashboard data with all registered mothers"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get all mothers with their user info, assessments, and assigned staff
    all_mothers = db.query(DBMother).options(
        joinedload(DBMother.user),
        joinedload(DBMother.assigned_chv),
        joinedload(DBMother.assigned_clinician),
        joinedload(DBMother.assessments)
    ).all()
    
    # Get all assessments for statistics
    all_assessments = db.query(DBRiskAssessment).all()
    all_users = db.query(DBUser).all()
    total_appointments = db.query(DBAppointment).count()
    
    # Regional statistics
    regional_stats = {}
    risk_distribution = {'high': 0, 'medium': 0, 'low': 0}
    
    # Process mothers data
    mothers_data = []
    for mother in all_mothers:
        # Get latest assessment
        latest_assessment = None
        if mother.assessments:
            latest_assessment = max(mother.assessments, key=lambda a: a.assessment_date)
        
        # Update regional stats
        user_location = mother.user.location if mother.user else 'Unknown'
        if user_location not in regional_stats:
            regional_stats[user_location] = {'high': 0, 'medium': 0, 'low': 0, 'total': 0}
        regional_stats[user_location]['total'] += 1
        
        # Update risk distribution
        current_risk = 'low'  # default
        if latest_assessment and latest_assessment.risk_level:
            current_risk = latest_assessment.risk_level.value
            regional_stats[user_location][current_risk] += 1
            risk_distribution[current_risk] += 1
        else:
            regional_stats[user_location]['low'] += 1
            risk_distribution['low'] += 1
        
        # Prepare mother data with staff IDs
        mother_data = {
            'id': mother.id,
            'full_name': mother.user.full_name if mother.user else 'Unknown',
            'age': mother.age,
            'location': user_location,
            'phone_number': decrypt_sensitive_data(mother.user.phone_number) if mother.user and mother.user.phone_number else '',
            'gestational_age': mother.gestational_age,
            'current_risk_level': current_risk,
            'last_assessment_date': latest_assessment.assessment_date.isoformat() if latest_assessment else None,
            'assigned_chv': mother.assigned_chv.full_name if mother.assigned_chv else None,
            'assigned_chv_staff_id': mother.assigned_chv.staff_id if mother.assigned_chv else None,
            'assigned_clinician': mother.assigned_clinician.full_name if mother.assigned_clinician else None,
            'assigned_clinician_staff_id': mother.assigned_clinician.staff_id if mother.assigned_clinician else None,
            'registered_by': 'CHV' if mother.assigned_chv else 'Clinician' if mother.assigned_clinician else 'System',
            'total_assessments': len(mother.assessments),
            'created_at': mother.created_at.isoformat() if hasattr(mother, 'created_at') and mother.created_at else None
        }
        mothers_data.append(mother_data)
    
    # Sort mothers by registration date (newest first)
    mothers_data.sort(key=lambda x: x['created_at'] or '', reverse=True)
    
    return {
        "total_mothers": len(all_mothers),
        "total_assessments": len(all_assessments),
        "mothers": mothers_data,
        "risk_distribution": risk_distribution,
        "regional_statistics": regional_stats,
        "system_overview": {
            "active_chvs": len([u for u in all_users if str(u.role) == 'chv' and bool(getattr(u, 'is_active', False))]),
            "active_clinicians": len([u for u in all_users if str(u.role) == 'clinician' and bool(getattr(u, 'is_active', False))]),
            "total_appointments": total_appointments,
            "recent_registrations": len([m for m in mothers_data if m['created_at'] and 
                                       (datetime.now() - datetime.fromisoformat(m['created_at'].replace('Z', '+00:00'))).days <= 7])
        }
    }

@app.get("/dashboard/pregnant-mother/{user_id}")
@limiter.limit("60/minute")
async def get_pregnant_mother_dashboard(request: Request, user_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get optimized dashboard for pregnant mothers with caching."""
    # Verify user can access this dashboard
    if current_user.role != UserRole.PREGNANT_MOTHER or current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    cache_manager = get_cache_manager()
    cache_key = f"dashboard:pregnant_mother:{user_id}"
    cached = cache_manager.get(cache_key)
    if cached:
        logger.info(f"[DASHBOARD] Returning cached dashboard for pregnant mother {user_id}")
        return cached
    
    try:
        # Get mother record by user_id
        mother = db.query(DBMother).filter(DBMother.user_id == user_id).first()
        if not mother:
            raise HTTPException(status_code=404, detail="Mother record not found")
        
        # Get all assessments for this mother with eager loading
        assessments = db.query(DBRiskAssessment).filter(
            DBRiskAssessment.mother_id == mother.id
        ).order_by(DBRiskAssessment.assessment_date.desc()).all()
        
        # Get upcoming appointments
        appointments = db.query(DBAppointment).filter(
            DBAppointment.mother_id == mother.id,
            DBAppointment.appointment_date >= datetime.now()
        ).order_by(DBAppointment.appointment_date.asc()).limit(5).all()
        
        # Prepare assessment data
        assessment_data = []
        for assessment in assessments:
            assessment_dict = {
                "id": assessment.id,
                "assessment_date": assessment.assessment_date.isoformat(),
                "risk_level": assessment.risk_level,
                "confidence": assessment.confidence,
                "systolic_bp": assessment.systolic_bp,
                "diastolic_bp": assessment.diastolic_bp,
                "blood_sugar": assessment.blood_sugar,
                "heart_rate": assessment.heart_rate,
                "notes": assessment.notes,
                "shap_explanation": assessment.shap_explanation
            }
            assessment_data.append(assessment_dict)
        
        # Prepare appointment data
        appointment_data = []
        for appointment in appointments:
            appointment_dict = {
                "id": appointment.id,
                "appointment_date": appointment.appointment_date.isoformat(),
                "status": appointment.status,
                "reason": appointment.reason,
                "notes": appointment.notes
            }
            appointment_data.append(appointment_dict)
        
        # Prepare mother data
        mother_data = {
            "id": mother.id,
            "user_id": mother.user_id,
            "age": mother.age,
            "gestational_age": mother.gestational_age,
            "emergency_contact": mother.emergency_contact,
            "assigned_chv_id": mother.assigned_chv_id,
            "assigned_clinician_id": mother.assigned_clinician_id
        }
        
        dashboard = {
            "mother": mother_data,
            "assessments": assessment_data,
            "appointments": appointment_data,
            "stats": {
                "total_assessments": len(assessment_data),
                "high_risk_count": len([a for a in assessment_data if a["risk_level"] == "high"]),
                "medium_risk_count": len([a for a in assessment_data if a["risk_level"] == "medium"]),
                "low_risk_count": len([a for a in assessment_data if a["risk_level"] == "low"]),
                "upcoming_appointments": len(appointment_data)
            }
        }
        
        # Cache for 2 minutes (shorter TTL for pregnant mothers to ensure fresh data)
        cache_manager.set(cache_key, dashboard, ttl=120)
        
        logger.info(f"[DASHBOARD] Generated dashboard for pregnant mother {user_id}: {len(assessment_data)} assessments, {len(appointment_data)} appointments")
        return dashboard
        
    except Exception as e:
        logger.error(f"Error generating pregnant mother dashboard for {user_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate dashboard: {str(e)}")

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
async def get_global_feature_importance(request: Request, sample_size: int = 20):
    print(f"[LOG] /shap/global called with sample_size={sample_size}")
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
async def get_shap_summary_plot(request: Request, sample_size: int = 20):
    print(f"[LOG] /shap/summary-plot called with sample_size={sample_size}")
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
    # Add CORS headers to all error responses
    headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Methods": "*",
        "Access-Control-Allow-Headers": "*",
    }
    return JSONResponse(
        status_code=500,
        content=ErrorResponse(detail="Internal server error").model_dump(),
        headers=headers
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

@app.get("/clinician/{clinician_id}/patients", response_model=List[dict])
async def get_clinician_patients(clinician_id: str, recent_days: int = 90, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        # Check if current user is authorized to access this clinician's patients
        if current_user.role not in [UserRole.CLINICIAN, UserRole.CHV]:
            raise HTTPException(status_code=403, detail="Not authorized")
        if current_user.role == UserRole.CLINICIAN and current_user.id != clinician_id:
            raise HTTPException(status_code=403, detail="Can only access your own patients")

        recent_cutoff = datetime.now() - timedelta(days=recent_days)

        # For clinicians: patients assigned OR assessed by this clinician
        if current_user.role == UserRole.CLINICIAN:
            assigned_mothers = db.query(DBMother).options(
                joinedload(DBMother.user),
                joinedload(DBMother.assessments),
                joinedload(DBMother.appointments)
            ).filter(DBMother.assigned_clinician_id == clinician_id)
            assessed_mother_ids = db.query(DBRiskAssessment.mother_id).filter(
                DBRiskAssessment.chv_id == clinician_id,
                DBRiskAssessment.assessment_date >= recent_cutoff
            ).distinct()
            assessed_mothers = db.query(DBMother).options(
                joinedload(DBMother.user),
                joinedload(DBMother.assessments),
                joinedload(DBMother.appointments)
            ).filter(DBMother.id.in_(assessed_mother_ids))
            # Filter assigned_mothers to only those with recent assessment if recent_days is set
            assigned_mothers = [m for m in assigned_mothers if any(a.assessment_date >= recent_cutoff for a in m.assessments)]
            mothers = list({m.id: m for m in list(assigned_mothers) + list(assessed_mothers)}.values())
        # For CHVs: patients assigned OR assessed by this CHV
        elif current_user.role == UserRole.CHV:
            assigned_mothers = db.query(DBMother).options(
                joinedload(DBMother.user),
                joinedload(DBMother.assessments),
                joinedload(DBMother.appointments)
            ).filter(DBMother.assigned_chv_id == clinician_id)
            assessed_mother_ids = db.query(DBRiskAssessment.mother_id).filter(
                DBRiskAssessment.chv_id == clinician_id,
                DBRiskAssessment.assessment_date >= recent_cutoff
            ).distinct()
            assessed_mothers = db.query(DBMother).options(
                joinedload(DBMother.user),
                joinedload(DBMother.assessments),
                joinedload(DBMother.appointments)
            ).filter(DBMother.id.in_(assessed_mother_ids))
            assigned_mothers = [m for m in assigned_mothers if any(a.assessment_date >= recent_cutoff for a in m.assessments)]
            mothers = list({m.id: m for m in list(assigned_mothers) + list(assessed_mothers)}.values())
        else:
            mothers = []
        print(f"Found {len(mothers)} mothers for user {clinician_id}")
        results = []
        for mother in mothers:
            latest_assessment = None
            all_assessments = []
            if mother.assessments:
                latest_assessment_obj = max(mother.assessments, key=lambda a: a.assessment_date)
                latest_assessment = RiskAssessmentOut.model_validate(latest_assessment_obj).model_dump()
                all_assessments = [RiskAssessmentOut.model_validate(a).model_dump() for a in mother.assessments]
            next_appointment = None
            all_appointments = []
            if mother.appointments:
                future_appointments = [a for a in mother.appointments if a.appointment_date >= datetime.now()]
                if future_appointments:
                    next_appointment_obj = min(future_appointments, key=lambda a: a.appointment_date)
                    next_appointment = AppointmentOut.model_validate(next_appointment_obj).model_dump()
                all_appointments = [AppointmentOut.model_validate(a).model_dump() for a in mother.appointments]
            all_medications = []
            if hasattr(mother, 'medications') and mother.medications:
                all_medications = [MedicationOut.model_validate(m).model_dump() for m in mother.medications]
            emergency_contact_raw = getattr(mother, 'emergency_contact', None)
            try:
                if emergency_contact_raw is not None:
                    emergency_contact = int(emergency_contact_raw)
                else:
                    emergency_contact = None
            except Exception as e:
                emergency_contact = None  # fallback to None if conversion fails
            mother_dict = {
                'id': mother.id,
                'user_id': mother.user_id,
                'age': mother.age,
                'gestational_age': mother.gestational_age,
                'previous_pregnancies': mother.previous_pregnancies,
                'previous_complications': mother.previous_complications,
                'emergency_contact': emergency_contact,
                'assigned_chv_id': mother.assigned_chv_id,
                'assigned_clinician_id': mother.assigned_clinician_id,
                'address': mother.user.location if mother.user else None,
                'created_at': getattr(mother, 'created_at', None),
            }
            try:
                results.append({
                    'patient': PregnantMotherOut.model_validate(mother_dict).model_dump(),
                    'latest_assessment': latest_assessment,
                    'all_assessments': all_assessments,
                    'next_appointment': next_appointment,
                    'all_appointments': all_appointments,
                    'all_medications': all_medications
                })
            except Exception as e:
                logger.error(f"Error validating mother data for {mother.id}: {str(e)}")
                continue
        return results
    except Exception as e:
        import traceback
        logger.error(f"Error in /clinician/{{clinician_id}}/patients endpoint: {str(e)}\n{traceback.format_exc()}")
        print(f"Error in /clinician/{{clinician_id}}/patients endpoint: {str(e)}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.post("/mothers/register", response_model=dict)
async def register_mother(mother: MotherRegistrationIn, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    logger.info(f"Registration attempt by user {getattr(current_user, 'id', 'unknown')} ({getattr(current_user, 'role', 'unknown')}) for mother: {getattr(mother, 'national_id', 'unknown')}")
    logger.info(f"Received mother data: {mother.model_dump()}")
    try:
        if current_user.role not in [UserRole.CLINICIAN, UserRole.CHV]:
            logger.error(f"User {getattr(current_user, 'id', 'unknown')} with role {getattr(current_user, 'role', 'unknown')} not authorized to register mothers")
            raise HTTPException(status_code=403, detail="Not authorized")

        # Prevent duplicate mother registration by national_id
        existing_mother = db.query(DBMother).join(DBUser, DBMother.user_id == DBUser.id).filter(DBUser.username == mother.national_id).first()
        if existing_mother:
            logger.warning(f"Duplicate mother registration attempt for national_id: {mother.national_id}")
            return {"success": False, "error": "Mother with this National ID already exists.", "mother_id": existing_mother.id}

        # Check for existing user by username or email
        existing_user = db.query(DBUser).filter(
            (DBUser.username == mother.national_id) | (DBUser.email == f"{mother.national_id}@example.com")
        ).first()
        
        if existing_user:
            logger.info(f"Linking new mother record to existing user: {existing_user.id}")
            user_id = existing_user.id
        else:
            # Create User record for the mother
            user_id = str(uuid.uuid4())
            db_user = DBUser(
                id=user_id,
                username=mother.national_id,
                email=f"{mother.national_id}@example.com",
                full_name=mother.full_name,
                role=UserRole.PREGNANT_MOTHER,
                phone_number=encrypt_sensitive_data(mother.phone_number),
                location=mother.address,
                is_active=True,
                hashed_password=encrypt_sensitive_data(mother.national_id),  # temp password
            )
            logger.info(f"Created user record with ID: {user_id}")
            db.add(db_user)
            db.commit()
            db.refresh(db_user)

        # assigned_chv_id is now optional
        assigned_chv_id = getattr(mother, 'assigned_chv_id', None)
        
        logger.info(f"User authorized. Creating mother record...")
        
        # Use provided mother_id if present, else generate one
        mother_id = mother.mother_id if getattr(mother, 'mother_id', None) else f"M{user_id[:8].upper()}"
        
        # Convert previous_complications to string if it's a list
        prev_comp = mother.previous_complications
        if isinstance(prev_comp, list):
            prev_comp = ','.join(prev_comp)
        
        # Calculate age from date of birth
        calculated_age = calculate_age(mother.date_of_birth)
        
        db_mother = DBMother(
            id=str(mother_id),
            user_id=str(user_id),
            age=calculated_age,
            gestational_age=int(mother.gestational_age) if mother.gestational_age is not None else None,
            previous_pregnancies=int(mother.gravida),
            previous_complications=prev_comp,
            emergency_contact=mother.next_of_kin_phone.replace('+', '').replace('-', '').replace(' ', '').replace('(', '').replace(')', '') if mother.next_of_kin_phone else '',  # Store as clean string
            assigned_chv_id=str(assigned_chv_id) if assigned_chv_id else None,
            assigned_clinician_id=str(current_user.id) if current_user.role == UserRole.CLINICIAN else None,
        )
        logger.info(f"Created mother record with ID: {mother_id}")
        db.add(db_mother)
        db.commit()
        db.refresh(db_mother)

        # No automatic assessment creation - mother will show "Not assessed yet" status
        # Optionally, store extended info in a separate table or as JSON if needed
        logger.info(f"Mother registered successfully: {mother_id} by user {getattr(current_user, 'id', 'unknown')}")
        return {"success": True, "mother_id": mother_id, "user_id": user_id}
    except Exception as e:
        logger.error(f"Mother registration failed for {getattr(mother, 'national_id', 'unknown')}: {str(e)}", exc_info=True)
        raise

# Helper function to calculate age from date_of_birth
def calculate_age(date_of_birth_str: str) -> int:
    dob = date.fromisoformat(date_of_birth_str)
    today = date.today()
    return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))

@app.get("/users/chvs", response_model=List[UserOut])
async def list_chvs(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """List all users with the CHV role."""
    chvs = db.query(DBUser).filter(DBUser.role == UserRole.CHV).all()
    
    # Decrypt phone numbers before validation
    chvs_out = []
    for chv in chvs:
        try:
            chv.phone_number = decrypt_sensitive_data(chv.phone_number)
        except Exception:
            chv.phone_number = ''  # fallback to empty if decryption fails
        chvs_out.append(UserOut.model_validate(chv))
    
    return chvs_out

@app.put("/mothers/{mother_id}", response_model=PregnantMotherOut)
async def update_mother(mother_id: str, mother: MotherRegistrationIn, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Update a mother's details, including CHV assignment."""
    db_mother = db.query(DBMother).filter(DBMother.id == mother_id).first()
    if not db_mother:
        raise HTTPException(status_code=404, detail="Mother not found")
    # Only clinicians or CHVs can update
    if current_user.role not in [UserRole.CLINICIAN, UserRole.CHV]:
        raise HTTPException(status_code=403, detail="Not authorized")
    # Remove CHV assignment requirement
    # Update fields
    db_mother.gestational_age = mother.gestational_age
    db_mother.previous_pregnancies = mother.gravida
    db_mother.previous_complications = mother.previous_complications
    db_mother.emergency_contact = mother.next_of_kin_phone
    db_mother.assigned_chv_id = mother.assigned_chv_id if hasattr(mother, 'assigned_chv_id') else db_mother.assigned_chv_id
    db_mother.assigned_clinician_id = current_user.id if current_user.role == UserRole.CLINICIAN else db_mother.assigned_clinician_id
    db.commit()
    db.refresh(db_mother)
    # Return updated mother
    return PregnantMotherOut.model_validate(db_mother)

@app.get("/users/clinicians", response_model=List[UserOut])
async def list_clinicians(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """List all users with the CLINICIAN role."""
    clinicians = db.query(DBUser).filter(DBUser.role == UserRole.CLINICIAN).all()
    
    # Decrypt phone numbers before validation
    clinicians_out = []
    for clinician in clinicians:
        try:
            clinician.phone_number = decrypt_sensitive_data(clinician.phone_number)
        except Exception:
            clinician.phone_number = ''  # fallback to empty if decryption fails
        clinicians_out.append(UserOut.model_validate(clinician))
    
    return clinicians_out

if __name__ == "__main__":
    import uvicorn
    # print("🚀 Starting Maternal Health Multi-User System...")
    if model is not None:
        # print("✅ Ready to serve predictions!")
        pass
    else:
        # print("⚠️  Running without model - predictions will use fallback")
        pass
    uvicorn.run(app, host="0.0.0.0", port=8000)