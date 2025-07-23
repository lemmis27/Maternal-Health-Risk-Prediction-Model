from sqlalchemy import Column, String, Integer, Float, DateTime, Boolean, Enum, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import enum
from database import Base  # Use the shared Base
# Add JSON import for modern DBs
try:
    from sqlalchemy import JSON
except ImportError:
    JSON = None  # Fallback for legacy DBs

class UserRoleEnum(str, enum.Enum):
    PREGNANT_MOTHER = "pregnant_mother"
    CHV = "chv"
    CLINICIAN = "clinician"
    ADMIN = "admin"

class RiskLevelEnum(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"

class AppointmentStatusEnum(str, enum.Enum):
    SCHEDULED = "scheduled"
    CONFIRMED = "confirmed"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=False)
    role = Column(Enum(UserRoleEnum), nullable=False)
    phone_number = Column(String, nullable=False)
    location = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.now(timezone.utc))
    is_active = Column(Boolean, default=True)
    hashed_password = Column(String, nullable=False)
    mothers = relationship("PregnantMother", back_populates="user", foreign_keys="PregnantMother.user_id")
    chv_mothers = relationship("PregnantMother", back_populates="assigned_chv", foreign_keys="PregnantMother.assigned_chv_id")
    clinician_mothers = relationship("PregnantMother", back_populates="assigned_clinician", foreign_keys="PregnantMother.assigned_clinician_id")
    assessments = relationship("RiskAssessment", back_populates="chv", foreign_keys="RiskAssessment.chv_id")
    clinician_appointments = relationship("Appointment", back_populates="clinician", foreign_keys="Appointment.clinician_id")
    chv_appointments = relationship("Appointment", back_populates="chv", foreign_keys="Appointment.chv_id")
    clinician_medications = relationship("Medication", back_populates="clinician", foreign_keys="Medication.clinician_id")

class PregnantMother(Base):
    __tablename__ = "pregnant_mothers"
    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    age = Column(Integer, nullable=False)
    gestational_age = Column(Integer)
    previous_pregnancies = Column(Integer, default=0)
    previous_complications = Column(Text)  # Store as comma-separated string
    emergency_contact = Column(String, nullable=False)
    assigned_chv_id = Column(String, ForeignKey("users.id"))
    assigned_clinician_id = Column(String, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.now(timezone.utc))
    user = relationship("User", back_populates="mothers", foreign_keys=[user_id])
    assigned_chv = relationship("User", back_populates="chv_mothers", foreign_keys=[assigned_chv_id])
    assigned_clinician = relationship("User", back_populates="clinician_mothers", foreign_keys=[assigned_clinician_id])
    assessments = relationship("RiskAssessment", back_populates="mother")
    appointments = relationship("Appointment", back_populates="mother")
    medications = relationship("Medication", back_populates="mother")

class RiskAssessment(Base):
    __tablename__ = "risk_assessments"
    id = Column(String, primary_key=True, index=True)
    mother_id = Column(String, ForeignKey("pregnant_mothers.id"), nullable=False)
    chv_id = Column(String, ForeignKey("users.id"), nullable=True)  # Allow null for clinician assessments
    assessment_date = Column(DateTime, default=datetime.now(timezone.utc))
    age = Column(Float, nullable=False)
    systolic_bp = Column(Float, nullable=False)
    diastolic_bp = Column(Float, nullable=False)
    blood_sugar = Column(Float, nullable=False)
    body_temp = Column(Float, nullable=False)
    heart_rate = Column(Integer, nullable=False)
    gestational_age = Column(Integer, nullable=False)
    weight = Column(Float, nullable=False)
    height = Column(Float, nullable=False)
    symptoms = Column(Text)  # Store as comma-separated string
    notes = Column(Text)
    bmi = Column(Float)
    risk_level = Column(Enum(RiskLevelEnum))
    risk_score = Column(Float)
    confidence = Column(Float)
    recommendations = Column(Text)  # Store as comma-separated string
    # New columns for SHAP and prediction storage
    shap_explanation = Column(JSON if JSON else Text, nullable=True)  # Store as JSON if possible, else as text
    prediction_json = Column(JSON if JSON else Text, nullable=True)   # Store as JSON if possible, else as text
    mother = relationship("PregnantMother", back_populates="assessments")
    chv = relationship("User", back_populates="assessments", foreign_keys=[chv_id])

class Appointment(Base):
    __tablename__ = "appointments"
    id = Column(String, primary_key=True, index=True)
    mother_id = Column(String, ForeignKey("pregnant_mothers.id"), nullable=False)
    clinician_id = Column(String, ForeignKey("users.id"), nullable=True)  # Allow null for CHV appointments
    chv_id = Column(String, ForeignKey("users.id"), nullable=True)  # Allow null for clinician appointments
    appointment_date = Column(DateTime, nullable=False)
    status = Column(Enum(AppointmentStatusEnum), default=AppointmentStatusEnum.SCHEDULED)
    reason = Column(String, nullable=False)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.now(timezone.utc))
    mother = relationship("PregnantMother", back_populates="appointments")
    clinician = relationship("User", back_populates="clinician_appointments", foreign_keys=[clinician_id])
    chv = relationship("User", back_populates="chv_appointments", foreign_keys=[chv_id])

class Medication(Base):
    __tablename__ = "medications"
    id = Column(String, primary_key=True, index=True)
    mother_id = Column(String, ForeignKey("pregnant_mothers.id"), nullable=False)
    clinician_id = Column(String, ForeignKey("users.id"), nullable=False)
    medication_name = Column(String, nullable=False)
    dosage = Column(String, nullable=False)
    frequency = Column(String, nullable=False)
    duration = Column(String, nullable=False)
    instructions = Column(Text, nullable=False)
    prescribed_at = Column(DateTime, default=datetime.now(timezone.utc))
    mother = relationship("PregnantMother", back_populates="medications")
    clinician = relationship("User", back_populates="clinician_medications", foreign_keys=[clinician_id]) 