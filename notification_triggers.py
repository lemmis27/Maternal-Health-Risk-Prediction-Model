"""
Notification Triggers for Automatic Real-time Notifications
Handles triggering notifications based on system events and data changes
"""

import asyncio
import logging
from typing import Dict, Any, Optional
from datetime import datetime, timedelta
from notification_service import notification_service, NotificationType, NotificationPriority
from models_db import RiskAssessment, User as DBUser, PregnantMother as DBMother, Appointment, Medication
from database import SessionLocal
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

class NotificationTriggers:
    """Handles automatic notification triggers based on system events"""
    
    @staticmethod
    async def on_high_risk_assessment(assessment: RiskAssessment):
        """Trigger notifications for high-risk assessments"""
        try:
            db = SessionLocal()
            try:
                # Get patient and assigned healthcare providers
                mother = db.query(DBMother).filter(DBMother.id == assessment.mother_id).first()
                if not mother:
                    logger.error(f"Mother not found for assessment {assessment.id}")
                    return
                
                patient_user = db.query(DBUser).filter(DBUser.id == mother.user_id).first()
                if not patient_user:
                    logger.error(f"Patient user not found for mother {mother.id}")
                    return
                
                # Notify assigned CHV
                if mother.assigned_chv_id:
                    await notification_service.send_notification(
                        user_id=mother.assigned_chv_id,
                        notification_type=NotificationType.HIGH_RISK_ALERT,
                        title="🚨 High Risk Assessment Alert",
                        message=f"Patient {patient_user.full_name} has been assessed as HIGH RISK. Immediate attention required.",
                        priority=NotificationPriority.CRITICAL,
                        data={
                            "assessment_id": assessment.id,
                            "mother_id": assessment.mother_id,
                            "risk_score": float(assessment.risk_score) if assessment.risk_score else 0.0,
                            "patient_name": patient_user.full_name,
                            "vital_signs": {
                                "systolic_bp": float(assessment.systolic_bp),
                                "diastolic_bp": float(assessment.diastolic_bp),
                                "heart_rate": assessment.heart_rate,
                                "body_temp": float(assessment.body_temp)
                            }
                        }
                    )
                
                # Notify assigned clinician
                if mother.assigned_clinician_id:
                    await notification_service.send_notification(
                        user_id=mother.assigned_clinician_id,
                        notification_type=NotificationType.HIGH_RISK_ALERT,
                        title="🚨 Critical Patient Alert",
                        message=f"HIGH RISK assessment for {patient_user.full_name}. Risk Score: {assessment.risk_score:.2f if assessment.risk_score else 0:.2f}",
                        priority=NotificationPriority.CRITICAL,
                        data={
                            "assessment_id": assessment.id,
                            "mother_id": assessment.mother_id,
                            "risk_score": float(assessment.risk_score) if assessment.risk_score else 0.0,
                            "recommendations": assessment.recommendations or [],
                            "patient_contact": patient_user.phone_number
                        }
                    )
                
                # Notify patient with gentler message
                await notification_service.send_notification(
                    user_id=patient_user.id,
                    notification_type=NotificationType.HIGH_RISK_ALERT,
                    title="Important Health Update",
                    message="Your recent health assessment requires follow-up. Please contact your healthcare provider as soon as possible.",
                    priority=NotificationPriority.HIGH,
                    data={
                        "assessment_id": assessment.id,
                        "recommendations": assessment.recommendations or [],
                        "next_steps": [
                            "Contact your assigned CHV immediately",
                            "Schedule urgent appointment with clinician",
                            "Monitor symptoms closely"
                        ]
                    }
                )
                
                logger.info(f"✅ High-risk notifications sent for assessment {assessment.id}")
                
            finally:
                db.close()
                
        except Exception as e:
            logger.error(f"❌ Error sending high-risk notifications: {e}")
    
    @staticmethod
    async def on_assessment_completed(assessment: RiskAssessment):
        """Trigger notifications when any assessment is completed"""
        try:
            db = SessionLocal()
            try:
                mother = db.query(DBMother).filter(DBMother.id == assessment.mother_id).first()
                patient_user = db.query(DBUser).filter(DBUser.id == mother.user_id).first()
                chv_user = db.query(DBUser).filter(DBUser.id == assessment.chv_id).first()
                
                if not all([mother, patient_user, chv_user]):
                    logger.error(f"Missing data for assessment notification {assessment.id}")
                    return
                
                # Notify patient about completed assessment
                risk_emoji = {"low": "✅", "medium": "⚠️", "high": "🚨"}.get(assessment.risk_level, "📊")
                
                await notification_service.send_notification(
                    user_id=patient_user.id,
                    notification_type=NotificationType.ASSESSMENT_COMPLETED,
                    title=f"{risk_emoji} Health Assessment Complete",
                    message=f"Your health assessment by {chv_user.full_name} is complete. Risk Level: {assessment.risk_level.upper()}",
                    priority=NotificationPriority.MEDIUM,
                    data={
                        "assessment_id": assessment.id,
                        "risk_level": assessment.risk_level,
                        "risk_score": float(assessment.risk_score) if assessment.risk_score else 0.0,
                        "chv_name": chv_user.full_name,
                        "assessment_date": assessment.assessment_date.isoformat()
                    }
                )
                
                # Notify assigned clinician if exists
                if mother.assigned_clinician_id:
                    await notification_service.send_notification(
                        user_id=mother.assigned_clinician_id,
                        notification_type=NotificationType.ASSESSMENT_COMPLETED,
                        title="📊 New Assessment Available",
                        message=f"New assessment for {patient_user.full_name} by CHV {chv_user.full_name}. Risk: {assessment.risk_level.upper()}",
                        priority=NotificationPriority.MEDIUM,
                        data={
                            "assessment_id": assessment.id,
                            "patient_name": patient_user.full_name,
                            "chv_name": chv_user.full_name,
                            "risk_level": assessment.risk_level
                        }
                    )
                
                logger.info(f"✅ Assessment completion notifications sent for {assessment.id}")
                
            finally:
                db.close()
                
        except Exception as e:
            logger.error(f"❌ Error sending assessment completion notifications: {e}")
    
    @staticmethod
    async def on_appointment_scheduled(appointment: Appointment):
        """Notify about new appointments"""
        try:
            db = SessionLocal()
            try:
                mother = db.query(DBMother).filter(DBMother.id == appointment.mother_id).first()
                patient_user = db.query(DBUser).filter(DBUser.id == mother.user_id).first()
                clinician = db.query(DBUser).filter(DBUser.id == appointment.clinician_id).first()
                
                if not all([mother, patient_user, clinician]):
                    logger.error(f"Missing data for appointment notification {appointment.id}")
                    return
                
                # Notify patient
                await notification_service.send_notification(
                    user_id=patient_user.id,
                    notification_type=NotificationType.APPOINTMENT_REMINDER,
                    title="📅 Appointment Scheduled",
                    message=f"Your appointment with Dr. {clinician.full_name} is scheduled for {appointment.appointment_date.strftime('%B %d, %Y at %I:%M %p')}",
                    priority=NotificationPriority.MEDIUM,
                    data={
                        "appointment_id": appointment.id,
                        "clinician_name": clinician.full_name,
                        "appointment_date": appointment.appointment_date.isoformat(),
                        "reason": appointment.reason
                    }
                )
                
                # Notify clinician
                await notification_service.send_notification(
                    user_id=appointment.clinician_id,
                    notification_type=NotificationType.NEW_ASSIGNMENT,
                    title="📅 New Appointment",
                    message=f"New appointment scheduled with {patient_user.full_name} on {appointment.appointment_date.strftime('%B %d, %Y at %I:%M %p')}",
                    priority=NotificationPriority.MEDIUM,
                    data={
                        "appointment_id": appointment.id,
                        "patient_name": patient_user.full_name,
                        "appointment_date": appointment.appointment_date.isoformat(),
                        "reason": appointment.reason
                    }
                )
                
                # Notify CHV if assigned
                if appointment.chv_id:
                    chv_user = db.query(DBUser).filter(DBUser.id == appointment.chv_id).first()
                    if chv_user:
                        await notification_service.send_notification(
                            user_id=appointment.chv_id,
                            notification_type=NotificationType.NEW_ASSIGNMENT,
                            title="📅 Patient Appointment Scheduled",
                            message=f"Your patient {patient_user.full_name} has an appointment with Dr. {clinician.full_name}",
                            priority=NotificationPriority.LOW,
                            data={
                                "appointment_id": appointment.id,
                                "patient_name": patient_user.full_name,
                                "clinician_name": clinician.full_name,
                                "appointment_date": appointment.appointment_date.isoformat()
                            }
                        )
                
                logger.info(f"✅ Appointment notifications sent for {appointment.id}")
                
            finally:
                db.close()
                
        except Exception as e:
            logger.error(f"❌ Error sending appointment notifications: {e}")
    
    @staticmethod
    async def on_medication_prescribed(medication: Medication):
        """Notify about new medication prescriptions"""
        try:
            db = SessionLocal()
            try:
                mother = db.query(DBMother).filter(DBMother.id == medication.mother_id).first()
                patient_user = db.query(DBUser).filter(DBUser.id == mother.user_id).first()
                clinician = db.query(DBUser).filter(DBUser.id == medication.clinician_id).first()
                
                if not all([mother, patient_user, clinician]):
                    logger.error(f"Missing data for medication notification {medication.id}")
                    return
                
                # Notify patient
                await notification_service.send_notification(
                    user_id=patient_user.id,
                    notification_type=NotificationType.MEDICATION_REMINDER,
                    title="💊 New Medication Prescribed",
                    message=f"Dr. {clinician.full_name} has prescribed {medication.medication_name} for you. Please follow the instructions carefully.",
                    priority=NotificationPriority.HIGH,
                    data={
                        "medication_id": medication.id,
                        "medication_name": medication.medication_name,
                        "dosage": medication.dosage,
                        "frequency": medication.frequency,
                        "duration": medication.duration,
                        "instructions": medication.instructions,
                        "clinician_name": clinician.full_name
                    }
                )
                
                # Notify CHV if assigned
                if mother.assigned_chv_id:
                    await notification_service.send_notification(
                        user_id=mother.assigned_chv_id,
                        notification_type=NotificationType.MEDICATION_REMINDER,
                        title="💊 Patient Medication Update",
                        message=f"New medication prescribed for {patient_user.full_name}: {medication.medication_name}",
                        priority=NotificationPriority.MEDIUM,
                        data={
                            "medication_id": medication.id,
                            "patient_name": patient_user.full_name,
                            "medication_name": medication.medication_name,
                            "clinician_name": clinician.full_name
                        }
                    )
                
                logger.info(f"✅ Medication notifications sent for {medication.id}")
                
            finally:
                db.close()
                
        except Exception as e:
            logger.error(f"❌ Error sending medication notifications: {e}")
    
    @staticmethod
    async def on_user_login(user: DBUser):
        """Notify administrators about user logins (for monitoring)"""
        try:
            # Only notify for first login of the day or suspicious activity
            if user.role in ["admin", "clinician"]:
                await notification_service.send_role_notification(
                    role="admin",
                    notification_type=NotificationType.USER_LOGIN,
                    title="👤 User Login",
                    message=f"{user.role.title()} {user.full_name} logged in",
                    priority=NotificationPriority.LOW,
                    data={
                        "user_id": user.id,
                        "username": user.username,
                        "role": user.role,
                        "login_time": datetime.now().isoformat()
                    }
                )
            
            logger.info(f"✅ Login notification sent for user {user.id}")
            
        except Exception as e:
            logger.error(f"❌ Error sending login notification: {e}")
    
    @staticmethod
    async def on_patient_registered(mother: DBMother, user: DBUser):
        """Notify about new patient registrations"""
        try:
            # Notify all CHVs about new patient in their area
            await notification_service.send_role_notification(
                role="chv",
                notification_type=NotificationType.PATIENT_REGISTERED,
                title="👶 New Patient Registered",
                message=f"New pregnant mother {user.full_name} registered in {user.location}",
                priority=NotificationPriority.MEDIUM,
                data={
                    "mother_id": mother.id,
                    "patient_name": user.full_name,
                    "location": user.location,
                    "age": mother.age,
                    "gestational_age": mother.gestational_age
                }
            )
            
            # Notify clinicians
            await notification_service.send_role_notification(
                role="clinician",
                notification_type=NotificationType.PATIENT_REGISTERED,
                title="👶 New Patient in System",
                message=f"New patient {user.full_name} registered and needs assignment",
                priority=NotificationPriority.LOW,
                data={
                    "mother_id": mother.id,
                    "patient_name": user.full_name,
                    "location": user.location
                }
            )
            
            logger.info(f"✅ Patient registration notifications sent for {mother.id}")
            
        except Exception as e:
            logger.error(f"❌ Error sending patient registration notifications: {e}")
    
    @staticmethod
    async def send_system_maintenance_alert(message: str, scheduled_time: datetime):
        """Send system maintenance notifications"""
        try:
            await notification_service.send_broadcast_notification(
                notification_type=NotificationType.SYSTEM_UPDATE,
                title="🔧 System Maintenance Scheduled",
                message=f"System maintenance scheduled for {scheduled_time.strftime('%B %d, %Y at %I:%M %p')}. {message}",
                priority=NotificationPriority.MEDIUM,
                data={
                    "maintenance_time": scheduled_time.isoformat(),
                    "estimated_duration": "30 minutes",
                    "affected_services": ["Web Application", "Mobile App"]
                }
            )
            
            logger.info("✅ System maintenance notifications sent")
            
        except Exception as e:
            logger.error(f"❌ Error sending maintenance notifications: {e}")

# Global instance
notification_triggers = NotificationTriggers()