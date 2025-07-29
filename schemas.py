from pydantic import BaseModel, Field, EmailStr, constr, field_validator, ConfigDict
from typing import List, Optional
from datetime import datetime
from enum import Enum

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

class UserOut(BaseModel):
    id: str
    username: str = Field(..., min_length=3, max_length=30)
    email: EmailStr
    full_name: str = Field(..., min_length=2, max_length=100)
    role: UserRole
    phone_number: str = Field(..., pattern=r'^\+?\d{10,15}$')
    location: str = Field(..., min_length=2, max_length=100)
    staff_id: Optional[str] = Field(None, description="Human-readable staff ID (e.g., C123ABC45, H456DEF78)")
    created_at: datetime
    is_active: bool
    model_config = ConfigDict(from_attributes=True)

class PregnantMotherOut(BaseModel):
    id: str
    user_id: str
    age: int = Field(..., ge=10, le=70)
    gestational_age: Optional[int] = Field(None, ge=1, le=42)
    previous_pregnancies: int = Field(..., ge=0, le=20)
    previous_complications: Optional[str]
    emergency_contact: Optional[str] = None  # Keep as string for consistency
    
    @field_validator('emergency_contact', mode='before')
    @classmethod
    def convert_emergency_contact_to_string(cls, v):
        """Convert emergency_contact to string if it's an integer"""
        if v is not None and isinstance(v, int):
            return str(v)
        return v
    assigned_chv_id: Optional[str]
    assigned_clinician_id: Optional[str]
    address: Optional[str] = None
    created_at: Optional[datetime] = None  # <-- Add this line
    # @field_validator('gestational_age')
    # @classmethod
    # def gestational_age_reasonable(cls, v, values):
    #     # Pydantic v2: use values.data to access other fields
    #     data = values.data if hasattr(values, 'data') else values
    #     if v is not None and 'age' in data and v > data['age']:
    #         raise ValueError('Gestational age cannot exceed mother\'s age')
    #     return v
    # @field_validator('previous_pregnancies')
    # @classmethod
    # def pregnancies_for_young_mothers(cls, v, values):
    #     # Pydantic v2: use values.data to access other fields
    #     data = values.data if hasattr(values, 'data') else values
    #     if 'age' in data and data['age'] < 13 and v != 0:
    #         raise ValueError('Previous pregnancies must be 0 for mothers under 13')
    #     return v
    model_config = ConfigDict(from_attributes=True)

class RiskAssessmentOut(BaseModel):
    id: str
    mother_id: str
    chv_id: Optional[str] = None
    assessment_date: datetime
    age: float = Field(..., ge=10, le=60)  # Allow for edge cases
    systolic_bp: float = Field(..., ge=70, le=200)
    diastolic_bp: float = Field(..., ge=40, le=130)
    blood_sugar: float = Field(..., ge=2.2, le=25.0)
    body_temp: float = Field(..., ge=95.0, le=105.0)
    heart_rate: int = Field(..., ge=30, le=200)
    gestational_age: int = Field(..., ge=1, le=45)
    weight: float = Field(..., ge=30, le=250)
    height: float = Field(..., ge=100, le=220)
    symptoms: Optional[str]
    notes: Optional[str]
    bmi: Optional[float]
    risk_level: Optional[RiskLevel]
    risk_score: Optional[float]
    confidence: Optional[float]
    recommendations: Optional[str]
    explanation: Optional[list] = Field(
        default=None,
        description="SHAP explanation for this assessment. Each item shows a feature and its SHAP value (contribution to the risk prediction).",
        examples=[
            [
                {"feature": "SystolicBP", "shap_value": 0.23},
                {"feature": "Age", "shap_value": -0.12},
                {"feature": "BodyTemp", "shap_value": 0.05}
            ]
        ]
    )
    @field_validator('notes', mode='before')
    @classmethod
    def notes_required_for_high_risk(cls, v, values):
        # Pydantic v2: use values.data to access other fields
        if hasattr(values, 'data'):
            risk_level = values.data.get('risk_level')
        else:
            risk_level = values.get('risk_level')
        if risk_level == RiskLevel.HIGH and not v:
            raise ValueError('Notes are required for high risk assessments')
        return v
    model_config = ConfigDict(from_attributes=True)

class AppointmentOut(BaseModel):
    id: str
    mother_id: str
    clinician_id: str
    chv_id: Optional[str]
    appointment_date: datetime
    status: AppointmentStatus
    reason: str
    notes: Optional[str]
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class MedicationOut(BaseModel):
    id: str
    mother_id: str
    clinician_id: str
    medication_name: str
    dosage: str
    frequency: str
    duration: str
    instructions: str
    prescribed_at: datetime
    model_config = ConfigDict(from_attributes=True)

class ErrorResponse(BaseModel):
    detail: str 

# Input/request models for creation endpoints
class UserIn(BaseModel):
    username: str = Field(..., min_length=3, max_length=30)
    email: EmailStr
    full_name: str = Field(..., min_length=2, max_length=100)
    role: UserRole
    phone_number: str = Field(..., pattern=r'^\+?\d{10,15}$')
    location: str = Field(..., min_length=2, max_length=100)
    password: str = Field(..., min_length=6)
    mother_id: Optional[str] = Field(None, description="Optional mother ID for pregnant mothers")

class PregnantMotherIn(BaseModel):
    user_id: str
    age: int = Field(..., ge=10, le=70)
    gestational_age: Optional[int] = Field(None, ge=1, le=42)
    previous_pregnancies: int = Field(..., ge=0, le=20)
    previous_complications: Optional[str]
    emergency_contact: int  # Now integer
    assigned_chv_id: Optional[str]
    assigned_clinician_id: Optional[str]
    @field_validator('gestational_age', mode='before')
    @classmethod
    def gestational_age_reasonable(cls, v, values):
        data = values.data if hasattr(values, 'data') else values
        if v is not None and 'age' in data and v > data['age']:
            raise ValueError('Gestational age cannot exceed age')
        return v
    @field_validator('previous_pregnancies')
    @classmethod
    def previous_pregnancies_reasonable(cls, v, values):
        data = values.data if hasattr(values, 'data') else values
        if 'age' in data and data['age'] < 13 and v != 0:
            raise ValueError('Previous pregnancies should be 0 for age < 13')
        return v

class RiskAssessmentIn(BaseModel):
    mother_id: str
    chv_id: Optional[str] = None  # Make chv_id optional since clinicians can also create assessments
    age: float = Field(..., ge=10, le=70)
    systolic_bp: float = Field(..., ge=70, le=200)
    diastolic_bp: float = Field(..., ge=49, le=120)
    blood_sugar: float = Field(..., ge=2.2, le=25.0)
    body_temp: float = Field(..., ge=95.0, le=103.0)  # Lower minimum to 95.0 to accommodate lower temperatures
    body_temp_unit: str = Field('F', description="Unit for body temperature: 'F' or 'C'")
    heart_rate: int = Field(..., ge=7, le=90)
    gestational_age: int = Field(..., ge=1, le=42)
    weight: float = Field(..., ge=30, le=200)
    height: float = Field(..., ge=100, le=220)
    symptoms: Optional[str]  # Keep as string, frontend should convert array to comma-separated string
    notes: Optional[str]
    @field_validator('notes', mode='before')
    @classmethod
    def notes_required_for_high_risk(cls, v, values):
        data = values.data if hasattr(values, 'data') else values
        if data.get('risk_level') == RiskLevel.HIGH and not v:
            raise ValueError('Notes are required for high risk assessments')
        return v

class AppointmentIn(BaseModel):
    mother_id: str
    clinician_id: str
    chv_id: Optional[str] = None
    appointment_date: datetime
    status: AppointmentStatus = AppointmentStatus.SCHEDULED
    reason: str
    notes: Optional[str]

class MedicationIn(BaseModel):
    mother_id: str
    clinician_id: str
    medication_name: str
    dosage: str
    frequency: str
    duration: str
    instructions: str 

class MotherRegistrationIn(BaseModel):
    # Personal Information
    full_name: str
    date_of_birth: str  # ISO date string
    national_id: str
    phone_number: str
    address: str
    next_of_kin_name: str
    next_of_kin_relationship: str
    next_of_kin_phone: str  # Keep as string for validation
    marital_status: str
    education_level: str
    occupation: str
    # Obstetric History
    gravida: int
    parity: int
    living_children: int
    lmp: Optional[str] = None  # Last Menstrual Period
    edd: Optional[str] = None  # Expected Date of Delivery
    gestational_age: Optional[int] = None
    previous_complications: Optional[str] = None
    stillbirths: Optional[int] = 0
    miscarriages: Optional[int] = 0
    # Medical History
    chronic_illnesses: Optional[str] = None
    allergies: Optional[str] = None
    current_medications: Optional[str] = None
    blood_group: Optional[str] = None
    # Social History
    substance_use: Optional[str] = None
    domestic_violence: Optional[bool] = None
    # CHV Assignment
    assigned_chv_id: Optional[str] = None
    # Mother ID (optional)
    mother_id: Optional[str] = None 