"""
Notification Service for Real-time Notifications
Handles creating, storing, and sending notifications through various channels
"""

import json
import uuid
import asyncio
import logging
from datetime import datetime
from typing import Dict, Any, List, Optional
from enum import Enum
import redis.asyncio as aioredis
from database import SessionLocal
from sqlalchemy.orm import Session
from sqlalchemy import Column, String, DateTime, Boolean, Text, Integer, create_engine
from sqlalchemy.ext.declarative import declarative_base
from database import Base

logger = logging.getLogger(__name__)

class NotificationType(str, Enum):
    """Types of notifications in the system"""
    HIGH_RISK_ALERT = "high_risk_alert"
    APPOINTMENT_REMINDER = "appointment_reminder"
    MEDICATION_REMINDER = "medication_reminder"
    SYSTEM_UPDATE = "system_update"
    NEW_ASSIGNMENT = "new_assignment"
    EMERGENCY_ALERT = "emergency_alert"
    ASSESSMENT_COMPLETED = "assessment_completed"
    USER_LOGIN = "user_login"
    PATIENT_REGISTERED = "patient_registered"

class NotificationPriority(str, Enum):
    """Priority levels for notifications"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class NotificationChannel(str, Enum):
    """Channels for delivering notifications"""
    WEBSOCKET = "websocket"
    EMAIL = "email"
    SMS = "sms"
    PUSH = "push"

# Database model for storing notifications
class Notification(Base):
    __tablename__ = "notifications"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, nullable=True)  # Null for broadcast notifications
    role = Column(String, nullable=True)  # For role-based notifications
    type = Column(String, nullable=False)
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    priority = Column(String, nullable=False, default=NotificationPriority.MEDIUM)
    data = Column(Text, nullable=True)  # JSON data
    channels = Column(Text, nullable=True)  # JSON array of channels
    created_at = Column(DateTime, default=datetime.now)
    read_at = Column(DateTime, nullable=True)
    acknowledged_at = Column(DateTime, nullable=True)
    is_read = Column(Boolean, default=False)
    is_acknowledged = Column(Boolean, default=False)
    expires_at = Column(DateTime, nullable=True)

class NotificationService:
    """Service for managing notifications"""
    
    def __init__(self):
        self.redis: Optional[aioredis.Redis] = None
        
    async def initialize(self):
        """Initialize the notification service"""
        try:
            self.redis = aioredis.from_url("redis://redis:6379", decode_responses=True)
            await self.redis.ping()
            logger.info("✅ Notification service Redis connection established")
        except Exception as e:
            logger.error(f"❌ Failed to connect to Redis for notifications: {e}")
            self.redis = None
    
    async def send_notification(
        self,
        user_id: str,
        notification_type: NotificationType,
        title: str,
        message: str,
        priority: NotificationPriority = NotificationPriority.MEDIUM,
        data: Optional[Dict[str, Any]] = None,
        channels: Optional[List[NotificationChannel]] = None
    ) -> str:
        """Send a notification to a specific user"""
        
        notification_id = str(uuid.uuid4())
        
        notification_data = {
            "id": notification_id,
            "user_id": user_id,
            "type": notification_type,
            "title": title,
            "message": message,
            "priority": priority,
            "data": data or {},
            "channels": channels or [NotificationChannel.WEBSOCKET],
            "timestamp": datetime.now().isoformat(),
            "read": False,
            "acknowledged": False
        }
        
        # Store notification in database
        await self._store_notification(notification_data)
        
        # Send via WebSocket (real-time)
        if NotificationChannel.WEBSOCKET in (channels or [NotificationChannel.WEBSOCKET]):
            await self._send_websocket_notification(f"user:{user_id}", notification_data)
        
        # Send via other channels if specified
        if channels:
            await self._send_via_other_channels(notification_data, channels)
        
        logger.info(f"📨 Notification sent to user {user_id}: {title}")
        return notification_id
    
    async def send_role_notification(
        self,
        role: str,
        notification_type: NotificationType,
        title: str,
        message: str,
        priority: NotificationPriority = NotificationPriority.MEDIUM,
        data: Optional[Dict[str, Any]] = None,
        channels: Optional[List[NotificationChannel]] = None
    ) -> str:
        """Send a notification to all users with a specific role"""
        
        notification_id = str(uuid.uuid4())
        
        notification_data = {
            "id": notification_id,
            "role": role,
            "type": notification_type,
            "title": title,
            "message": message,
            "priority": priority,
            "data": data or {},
            "channels": channels or [NotificationChannel.WEBSOCKET],
            "timestamp": datetime.now().isoformat()
        }
        
        # Store notification in database
        await self._store_notification(notification_data)
        
        # Send via WebSocket to role
        if NotificationChannel.WEBSOCKET in (channels or [NotificationChannel.WEBSOCKET]):
            await self._send_websocket_notification(f"role:{role}", notification_data)
        
        logger.info(f"📢 Role notification sent to {role}: {title}")
        return notification_id
    
    async def send_broadcast_notification(
        self,
        notification_type: NotificationType,
        title: str,
        message: str,
        priority: NotificationPriority = NotificationPriority.LOW,
        data: Optional[Dict[str, Any]] = None,
        channels: Optional[List[NotificationChannel]] = None
    ) -> str:
        """Send a broadcast notification to all users"""
        
        notification_id = str(uuid.uuid4())
        
        notification_data = {
            "id": notification_id,
            "type": notification_type,
            "title": title,
            "message": message,
            "priority": priority,
            "data": data or {},
            "channels": channels or [NotificationChannel.WEBSOCKET],
            "timestamp": datetime.now().isoformat()
        }
        
        # Store notification in database
        await self._store_notification(notification_data)
        
        # Send via WebSocket broadcast
        if NotificationChannel.WEBSOCKET in (channels or [NotificationChannel.WEBSOCKET]):
            await self._send_websocket_notification("broadcast", notification_data)
        
        logger.info(f"📡 Broadcast notification sent: {title}")
        return notification_id
    
    async def mark_as_read(self, notification_id: str, user_id: str) -> bool:
        """Mark a notification as read"""
        try:
            db = SessionLocal()
            try:
                notification = db.query(Notification).filter(
                    Notification.id == notification_id,
                    Notification.user_id == user_id
                ).first()
                
                if notification:
                    notification.is_read = True
                    notification.read_at = datetime.now()
                    db.commit()
                    logger.info(f"✅ Notification {notification_id} marked as read")
                    return True
                else:
                    logger.warning(f"⚠️ Notification {notification_id} not found for user {user_id}")
                    return False
            finally:
                db.close()
        except Exception as e:
            logger.error(f"❌ Error marking notification as read: {e}")
            return False
    
    async def mark_as_acknowledged(self, notification_id: str, user_id: str) -> bool:
        """Mark a notification as acknowledged (for critical alerts)"""
        try:
            db = SessionLocal()
            try:
                notification = db.query(Notification).filter(
                    Notification.id == notification_id,
                    Notification.user_id == user_id
                ).first()
                
                if notification:
                    notification.is_acknowledged = True
                    notification.acknowledged_at = datetime.now()
                    if not notification.is_read:
                        notification.is_read = True
                        notification.read_at = datetime.now()
                    db.commit()
                    logger.info(f"✅ Notification {notification_id} acknowledged")
                    return True
                else:
                    return False
            finally:
                db.close()
        except Exception as e:
            logger.error(f"❌ Error acknowledging notification: {e}")
            return False
    
    async def get_user_notifications(
        self, 
        user_id: str, 
        limit: int = 50, 
        unread_only: bool = False
    ) -> List[Dict]:
        """Get notifications for a specific user"""
        try:
            db = SessionLocal()
            try:
                query = db.query(Notification).filter(Notification.user_id == user_id)
                
                if unread_only:
                    query = query.filter(Notification.is_read == False)
                
                notifications = query.order_by(Notification.created_at.desc()).limit(limit).all()
                
                result = []
                for notif in notifications:
                    result.append({
                        "id": notif.id,
                        "type": notif.type,
                        "title": notif.title,
                        "message": notif.message,
                        "priority": notif.priority,
                        "data": json.loads(notif.data) if notif.data else {},
                        "created_at": notif.created_at.isoformat(),
                        "read_at": notif.read_at.isoformat() if notif.read_at else None,
                        "is_read": notif.is_read,
                        "is_acknowledged": notif.is_acknowledged
                    })
                
                return result
            finally:
                db.close()
        except Exception as e:
            logger.error(f"❌ Error getting user notifications: {e}")
            return []
    
    async def get_notification_stats(self, user_id: Optional[str] = None) -> Dict:
        """Get notification statistics"""
        try:
            db = SessionLocal()
            try:
                query = db.query(Notification)
                if user_id:
                    query = query.filter(Notification.user_id == user_id)
                
                total = query.count()
                unread = query.filter(Notification.is_read == False).count()
                critical = query.filter(Notification.priority == NotificationPriority.CRITICAL).count()
                unacknowledged_critical = query.filter(
                    Notification.priority == NotificationPriority.CRITICAL,
                    Notification.is_acknowledged == False
                ).count()
                
                return {
                    "total": total,
                    "unread": unread,
                    "critical": critical,
                    "unacknowledged_critical": unacknowledged_critical
                }
            finally:
                db.close()
        except Exception as e:
            logger.error(f"❌ Error getting notification stats: {e}")
            return {"total": 0, "unread": 0, "critical": 0, "unacknowledged_critical": 0}
    
    async def _store_notification(self, notification_data: Dict):
        """Store notification in database"""
        try:
            db = SessionLocal()
            try:
                notification = Notification(
                    id=notification_data["id"],
                    user_id=notification_data.get("user_id"),
                    role=notification_data.get("role"),
                    type=notification_data["type"],
                    title=notification_data["title"],
                    message=notification_data["message"],
                    priority=notification_data["priority"],
                    data=json.dumps(notification_data.get("data", {})),
                    channels=json.dumps([ch.value if hasattr(ch, 'value') else ch for ch in notification_data.get("channels", [])]),
                    created_at=datetime.now()
                )
                
                db.add(notification)
                db.commit()
            finally:
                db.close()
        except Exception as e:
            logger.error(f"❌ Error storing notification: {e}")
    
    async def _send_websocket_notification(self, channel: str, notification_data: Dict):
        """Send notification via WebSocket through Redis pub/sub"""
        if self.redis:
            try:
                await self.redis.publish(channel, json.dumps(notification_data))
            except Exception as e:
                logger.error(f"❌ Error publishing to Redis: {e}")
    
    async def _send_via_other_channels(self, notification_data: Dict, channels: List[NotificationChannel]):
        """Send notification via other channels (email, SMS, push)"""
        for channel in channels:
            if channel == NotificationChannel.EMAIL:
                await self._send_email_notification(notification_data)
            elif channel == NotificationChannel.SMS:
                await self._send_sms_notification(notification_data)
            elif channel == NotificationChannel.PUSH:
                await self._send_push_notification(notification_data)
    
    async def _send_email_notification(self, notification_data: Dict):
        """Send email notification (placeholder for future implementation)"""
        logger.info(f"📧 Email notification would be sent: {notification_data['title']}")
    
    async def _send_sms_notification(self, notification_data: Dict):
        """Send SMS notification (placeholder for future implementation)"""
        logger.info(f"📱 SMS notification would be sent: {notification_data['title']}")
    
    async def _send_push_notification(self, notification_data: Dict):
        """Send push notification (placeholder for future implementation)"""
        logger.info(f"🔔 Push notification would be sent: {notification_data['title']}")

# Global notification service instance
notification_service = NotificationService()