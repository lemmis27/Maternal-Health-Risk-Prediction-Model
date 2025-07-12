from pydantic import BaseModel, Field, EmailStr, constr, field_validator, ConfigDict
from typing import List, Optional
from datetime import datetime
from enum import Enum

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

class UserOut(BaseModel):
    id: str
    username: str = Field(..., min_length=3, max_length=30)
    email: EmailStr
    full_name: str = Field(..., min_length=2, max_length=100)
    role: UserRole
    phone_number: str = Field(..., pattern=r'^\+?\d{10,15}$')
    location: str = Field(..., min_length=2, max_length=100)
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
    emergency_contact: str = Field(..., pattern=r'^\+?\d{10,15}$')
    assigned_chv_id: Optional[str]
    assigned_clinician_id: Optional[str]
    @field_validator('gestational_age')
    @classmethod
    def gestational_age_reasonable(cls, v, values):
        if v is not None and 'age' in values and v > values['age']:
            raise ValueError('Gestational age cannot exceed mother\'s age')
        return v
    @field_validator('previous_pregnancies')
    @classmethod
    def pregnancies_for_young_mothers(cls, v, values):
        if 'age' in values and values['age'] < 13 and v != 0:
            raise ValueError('Previous pregnancies must be 0 for mothers under 13')
        return v
    model_config = ConfigDict(from_attributes=True)

class RiskAssessmentOut(BaseModel):
    id: str
    mother_id: str
    chv_id: str
    assessment_date: datetime
    age: float = Field(..., ge=10, le=70)
    systolic_bp: float = Field(..., ge=70, le=200)
    diastolic_bp: float = Field(..., ge=49, le=120)
    blood_sugar: float = Field(..., ge=6.0, le=19.0)
    body_temp: float = Field(..., ge=98.0, le=103.0)
    heart_rate: int = Field(..., ge=7, le=90)
    gestational_age: int = Field(..., ge=1, le=42)
    weight: float = Field(..., ge=30, le=200)
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

class PregnantMotherIn(BaseModel):
    user_id: str
    age: int = Field(..., ge=10, le=70)
    gestational_age: Optional[int] = Field(None, ge=1, le=42)
    previous_pregnancies: int = Field(..., ge=0, le=20)
    previous_complications: Optional[str]
    emergency_contact: str = Field(..., pattern=r'^\+?\d{10,15}$')
    assigned_chv_id: Optional[str]
    assigned_clinician_id: Optional[str]
    @field_validator('gestational_age', mode='before')
    @classmethod
    def gestational_age_reasonable(cls, v, values):
        # Pydantic v2: use values.data to access other fields
        if v is not None and 'age' in values.data and v > values.data['age']:
            raise ValueError('Gestational age cannot exceed age')
        return v
    @field_validator('previous_pregnancies')
    @classmethod
    def previous_pregnancies_reasonable(cls, v, values):
        # Pydantic v2: use values.data to access other fields
        if 'age' in values.data and values.data['age'] < 13 and v != 0:
            raise ValueError('Previous pregnancies should be 0 for age < 13')
        return v

class RiskAssessmentIn(BaseModel):
    mother_id: str
    chv_id: str
    age: float = Field(..., ge=10, le=70)
    systolic_bp: float = Field(..., ge=70, le=200)
    diastolic_bp: float = Field(..., ge=49, le=120)
    blood_sugar: float = Field(..., ge=6.0, le=19.0)
    body_temp: float = Field(..., ge=98.0, le=103.0)
    body_temp_unit: str = Field('F', description="Unit for body temperature: 'F' or 'C'")
    heart_rate: int = Field(..., ge=7, le=90)
    gestational_age: int = Field(..., ge=1, le=42)
    weight: float = Field(..., ge=30, le=200)
    height: float = Field(..., ge=100, le=220)
    symptoms: Optional[str]
    notes: Optional[str]
    @field_validator('notes', mode='before')
    @classmethod
    def notes_required_for_high_risk(cls, v, values):
        # Pydantic v2: use values.data.get('risk_level')
        if values.data.get('risk_level') == RiskLevel.HIGH and not v:
            raise ValueError('Notes are required for high risk assessments')
        return v

class AppointmentIn(BaseModel):
    mother_id: str
    clinician_id: str
    chv_id: Optional[str]
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