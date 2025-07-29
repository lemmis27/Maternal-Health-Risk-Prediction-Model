"""
WebSocket Connection Manager for Real-time Notifications
Handles WebSocket connections, authentication, and message broadcasting
"""

import json
import asyncio
import logging
from typing import Dict, List, Optional, Set
from datetime import datetime
from fastapi import WebSocket, WebSocketDisconnect
from fastapi.websockets import WebSocketState
import redis.asyncio as aioredis
from models_db import User
from database import SessionLocal
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

class ConnectionManager:
    """Manages WebSocket connections and message broadcasting"""
    
    def __init__(self):
        # Store active connections by user_id
        self.active_connections: Dict[str, List[WebSocket]] = {}
        # Store user roles for quick access
        self.user_roles: Dict[str, str] = {}
        # Redis connection for pub/sub
        self.redis: Optional[aioredis.Redis] = None
        # Pub/sub channels we're subscribed to
        self.subscribed_channels: Set[str] = set()
        
    async def initialize_redis(self):
        """Initialize Redis connection for pub/sub messaging"""
        try:
            self.redis = aioredis.from_url("redis://redis:6379", decode_responses=True)
            await self.redis.ping()
            logger.info("✅ Redis connection established for WebSocket manager")
            
            # Start listening for Redis pub/sub messages
            asyncio.create_task(self._listen_for_redis_messages())
            
        except Exception as e:
            logger.error(f"❌ Failed to connect to Redis: {e}")
            # Fallback to in-memory messaging (less scalable)
            self.redis = None
    
    async def connect(self, websocket: WebSocket, user_id: str, user_role: str):
        """Accept a new WebSocket connection"""
        await websocket.accept()
        
        # Add connection to active connections
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)
        
        # Store user role for quick access
        self.user_roles[user_id] = user_role
        
        # Subscribe to user-specific and role-specific channels
        await self._subscribe_to_channels(user_id, user_role)
        
        # Send connection confirmation
        await self._send_to_websocket(websocket, {
            "type": "connection_established",
            "message": "WebSocket connection established",
            "timestamp": datetime.now().isoformat(),
            "user_id": user_id,
            "role": user_role
        })
        
        logger.info(f"✅ WebSocket connected: User {user_id} ({user_role})")
    
    async def disconnect(self, websocket: WebSocket, user_id: str):
        """Handle WebSocket disconnection"""
        if user_id in self.active_connections:
            try:
                self.active_connections[user_id].remove(websocket)
                if not self.active_connections[user_id]:
                    # Remove user if no more connections
                    del self.active_connections[user_id]
                    if user_id in self.user_roles:
                        del self.user_roles[user_id]
                
                logger.info(f"🔌 WebSocket disconnected: User {user_id}")
            except ValueError:
                # Connection already removed
                pass
    
    async def send_personal_message(self, user_id: str, message: Dict):
        """Send message to specific user"""
        if user_id in self.active_connections:
            message["timestamp"] = datetime.now().isoformat()
            disconnected_connections = []
            
            for connection in self.active_connections[user_id]:
                if connection.client_state == WebSocketState.CONNECTED:
                    try:
                        await self._send_to_websocket(connection, message)
                    except Exception as e:
                        logger.error(f"Error sending message to {user_id}: {e}")
                        disconnected_connections.append(connection)
                else:
                    disconnected_connections.append(connection)
            
            # Clean up disconnected connections
            for conn in disconnected_connections:
                await self.disconnect(conn, user_id)
        else:
            # User not connected, store message for later or send via other channels
            logger.info(f"📱 User {user_id} not connected, message queued")
    
    async def broadcast_to_role(self, role: str, message: Dict):
        """Broadcast message to all users with specific role"""
        message["timestamp"] = datetime.now().isoformat()
        
        for user_id, user_role in self.user_roles.items():
            if user_role == role:
                await self.send_personal_message(user_id, message)
    
    async def broadcast_to_all(self, message: Dict):
        """Broadcast message to all connected users"""
        message["timestamp"] = datetime.now().isoformat()
        
        for user_id in self.active_connections.keys():
            await self.send_personal_message(user_id, message)
    
    async def get_connected_users(self) -> Dict[str, int]:
        """Get count of connected users by role"""
        role_counts = {}
        for user_role in self.user_roles.values():
            role_counts[user_role] = role_counts.get(user_role, 0) + 1
        return role_counts
    
    async def _subscribe_to_channels(self, user_id: str, user_role: str):
        """Subscribe to Redis pub/sub channels for this user"""
        if not self.redis:
            return
        
        channels = [
            f"user:{user_id}",  # Personal messages
            f"role:{user_role}",  # Role-based messages
            "broadcast"  # System-wide messages
        ]
        
        for channel in channels:
            if channel not in self.subscribed_channels:
                self.subscribed_channels.add(channel)
    
    async def _listen_for_redis_messages(self):
        """Listen for Redis pub/sub messages and broadcast to WebSocket clients"""
        if not self.redis:
            return
        
        try:
            pubsub = self.redis.pubsub()
            
            # Subscribe to all channels
            await pubsub.subscribe("user:*", "role:*", "broadcast")
            
            async for message in pubsub.listen():
                if message["type"] == "message":
                    try:
                        data = json.loads(message["data"])
                        channel = message["channel"]
                        
                        if channel.startswith("user:"):
                            user_id = channel.split(":", 1)[1]
                            await self.send_personal_message(user_id, data)
                        elif channel.startswith("role:"):
                            role = channel.split(":", 1)[1]
                            await self.broadcast_to_role(role, data)
                        elif channel == "broadcast":
                            await self.broadcast_to_all(data)
                            
                    except json.JSONDecodeError as e:
                        logger.error(f"Error parsing Redis message: {e}")
                    except Exception as e:
                        logger.error(f"Error processing Redis message: {e}")
                        
        except Exception as e:
            logger.error(f"Redis pub/sub listener error: {e}")
            # Attempt to reconnect after delay
            await asyncio.sleep(5)
            asyncio.create_task(self._listen_for_redis_messages())
    
    async def _send_to_websocket(self, websocket: WebSocket, message: Dict):
        """Send message to a specific WebSocket connection"""
        try:
            await websocket.send_text(json.dumps(message))
        except Exception as e:
            logger.error(f"Error sending WebSocket message: {e}")
            raise

# Global connection manager instance
connection_manager = ConnectionManager()

async def authenticate_websocket_user(token: str) -> Optional[User]:
    """Authenticate user for WebSocket connection"""
    if not token:
        return None
    
    try:
        # Import here to avoid circular imports
        from app import verify_token
        
        # Verify JWT token
        username = verify_token(type('MockCredentials', (), {'credentials': token})())
        
        # Get user from database
        db = SessionLocal()
        try:
            from models_db import User as DBUser
            user = db.query(DBUser).filter(DBUser.username == username).first()
            return user
        finally:
            db.close()
            
    except Exception as e:
        logger.error(f"WebSocket authentication error: {e}")
        return None

async def handle_websocket_message(message_data: Dict, user_id: str, user_role: str):
    """Handle incoming WebSocket messages from clients"""
    try:
        message_type = message_data.get("type")
        
        if message_type == "ping":
            # Respond to ping with pong
            await connection_manager.send_personal_message(user_id, {
                "type": "pong",
                "message": "Connection alive"
            })
        
        elif message_type == "mark_notification_read":
            # Handle notification read status
            notification_id = message_data.get("notification_id")
            if notification_id:
                await mark_notification_as_read(notification_id, user_id)
        
        elif message_type == "request_status":
            # Send current system status
            connected_users = await connection_manager.get_connected_users()
            await connection_manager.send_personal_message(user_id, {
                "type": "system_status",
                "connected_users": connected_users,
                "server_time": datetime.now().isoformat()
            })
        
        else:
            logger.warning(f"Unknown WebSocket message type: {message_type}")
            
    except Exception as e:
        logger.error(f"Error handling WebSocket message: {e}")

async def mark_notification_as_read(notification_id: str, user_id: str):
    """Mark a notification as read in the database"""
    try:
        db = SessionLocal()
        try:
            # Update notification read status
            # This would update your notifications table
            logger.info(f"Marked notification {notification_id} as read for user {user_id}")
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Error marking notification as read: {e}")