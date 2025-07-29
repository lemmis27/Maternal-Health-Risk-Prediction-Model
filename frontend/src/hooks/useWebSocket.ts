/**
 * Custom React hook for WebSocket real-time notifications
 * Handles connection, authentication, and message processing
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  timestamp: string;
  data?: any;
  read?: boolean;
  acknowledged?: boolean;
}

interface BackendNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  priority: string;
  created_at: string;
  data?: any;
  is_read?: boolean;
  is_acknowledged?: boolean;
}

interface WebSocketHookReturn {
  notifications: Notification[];
  connectionStatus: 'connecting' | 'connected' | 'disconnected';
  sendMessage: (message: any) => void;
  markAsRead: (notificationId: string) => void;
  connect: () => void;
  disconnect: () => void;
  unreadCount: number;
  criticalAlerts: Notification[];
}

export const useWebSocket = (): WebSocketHookReturn => {
  const { user } = useAuth();
  const token = localStorage.getItem('access_token');
  const ws = useRef<WebSocket | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = useCallback(() => {
    if (!user || !token) {
      console.log('❌ Cannot connect WebSocket: No user or token', { user: !!user, token: !!token });
      return;
    }

    if (ws.current?.readyState === WebSocket.OPEN) {
      console.log('✅ WebSocket already connected');
      return;
    }

    setConnectionStatus('connecting');
    
    // Determine WebSocket URL based on environment
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = process.env.NODE_ENV === 'development' 
      ? 'localhost:8000' 
      : window.location.host;
    
    const wsUrl = `${protocol}//${host}/ws/${user.id}?token=${token}`;
    
    console.log(`🔌 Connecting to WebSocket: ${wsUrl.substring(0, 80)}...`);
    console.log('🔍 User details:', { id: user.id, role: user.role, username: user.username });
    console.log('🔍 Token preview:', token.substring(0, 20) + '...');
    
    try {
      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        setConnectionStatus('connected');
        reconnectAttempts.current = 0;
        console.log('✅ WebSocket connected successfully');
        
        // Don't send ping immediately - wait for connection to stabilize
        setTimeout(() => {
          if (ws.current?.readyState === WebSocket.OPEN) {
            try {
              ws.current.send(JSON.stringify({ type: 'ping' }));
              console.log('📤 Sent ping message');
            } catch (error) {
              console.error('❌ Error sending ping:', error);
            }
          }
        }, 1000); // Wait 1 second before sending ping
      };

      ws.current.onmessage = (event) => {
        try {
          const notification: Notification = JSON.parse(event.data);
          
          console.log('📨 Received notification:', notification);
          
          // Handle different message types
          if (notification.type === 'connection_established') {
            console.log('🎉 WebSocket connection established');
            return;
          }
          
          if (notification.type === 'pong') {
            console.log('🏓 Pong received - connection alive');
            return;
          }
          
          if (notification.type === 'error') {
            console.error('❌ WebSocket error:', notification.message);
            return;
          }
          
          // Add notification to state
          setNotifications(prev => {
            // Avoid duplicates
            const exists = prev.some(n => n.id === notification.id);
            if (exists) return prev;
            
            return [notification, ...prev].slice(0, 100); // Keep only last 100 notifications
          });
          
          // Show browser notification for high priority alerts
          if (notification.priority === 'high' || notification.priority === 'critical') {
            showBrowserNotification(notification);
          }
          
          // Play sound for critical alerts
          if (notification.priority === 'critical') {
            playNotificationSound();
          }
          
        } catch (error) {
          console.error('❌ Error parsing WebSocket message:', error);
        }
      };

      ws.current.onclose = (event) => {
        setConnectionStatus('disconnected');
        console.log(`🔌 WebSocket disconnected:`, {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean,
          url: ws.current?.url
        });
        
        // Log common close codes for debugging
        const closeReasons = {
          1000: 'Normal closure',
          1001: 'Going away',
          1002: 'Protocol error',
          1003: 'Unsupported data',
          1006: 'Abnormal closure',
          1011: 'Server error',
          4001: 'Unauthorized',
          4003: 'User ID mismatch'
        };
        
        const reasonText = closeReasons[event.code as keyof typeof closeReasons] || 'Unknown reason';
        console.log(`🔍 Close code ${event.code}: ${reasonText}`);
        
        // Clear any existing reconnect timeout
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        
        // Only reconnect for unexpected closures, not authentication errors
        if (event.code !== 1000 && event.code !== 4001 && event.code !== 4003 && reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000); // Exponential backoff
          console.log(`🔄 Attempting to reconnect in ${delay}ms (attempt ${reconnectAttempts.current + 1}/${maxReconnectAttempts})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current++;
            connect();
          }, delay);
        } else if (event.code === 4001 || event.code === 4003) {
          console.error('❌ Authentication error - not reconnecting');
        } else if (reconnectAttempts.current >= maxReconnectAttempts) {
          console.error('❌ Max reconnection attempts reached');
        }
      };

      ws.current.onerror = (error) => {
        console.error('❌ WebSocket error event:', error);
        console.error('❌ WebSocket error details:', {
          type: error.type,
          target: error.target,
          readyState: ws.current?.readyState,
          url: ws.current?.url
        });
        setConnectionStatus('disconnected');
      };

    } catch (error) {
      console.error('❌ Error creating WebSocket connection:', error);
      setConnectionStatus('disconnected');
    }
  }, [user, token]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (ws.current) {
      ws.current.close(1000, 'Intentional disconnect');
      ws.current = null;
    }
    
    setConnectionStatus('disconnected');
    console.log('🔌 WebSocket disconnected intentionally');
  }, []);

  const sendMessage = useCallback((message: any) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      try {
        ws.current.send(JSON.stringify(message));
        console.log('📤 Sent WebSocket message:', message);
      } catch (error) {
        console.error('❌ Error sending WebSocket message:', error);
      }
    } else {
      console.warn('⚠️ Cannot send message: WebSocket not connected');
    }
  }, []);

  const markAsRead = useCallback((notificationId: string) => {
    // Update local state
    setNotifications(prev => 
      prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
    );
    
    // Send to server
    sendMessage({
      type: 'mark_notification_read',
      notification_id: notificationId
    });
    
    // Also call API endpoint
    if (token) {
      const baseUrl = process.env.NODE_ENV === 'development' 
        ? 'http://localhost:8000' 
        : '';
      fetch(`${baseUrl}/notifications/${notificationId}/read`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }).catch(error => {
        console.error('Error marking notification as read:', error);
      });
    }
  }, [sendMessage, token]);

  // Load existing notifications from REST API
  const loadExistingNotifications = useCallback(async () => {
    if (!token) return;
    
    try {
      console.log('📥 Loading existing notifications from API...');
      const baseUrl = process.env.NODE_ENV === 'development' 
        ? 'http://localhost:8000' 
        : '';
      const response = await fetch(`${baseUrl}/notifications/`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Handle different response formats
        let existingNotifications: BackendNotification[] = [];
        if (Array.isArray(data)) {
          existingNotifications = data;
        } else if (data.notifications && Array.isArray(data.notifications)) {
          existingNotifications = data.notifications;
        }
        
        // Convert backend format to frontend format
        const formattedNotifications: Notification[] = existingNotifications.map(notif => ({
          id: notif.id,
          type: notif.type,
          title: notif.title,
          message: notif.message,
          priority: notif.priority as 'low' | 'medium' | 'high' | 'critical',
          timestamp: notif.created_at,
          data: notif.data,
          read: notif.is_read || false,
          acknowledged: notif.is_acknowledged || false
        }));
        
        setNotifications(formattedNotifications);
        console.log(`✅ Loaded ${formattedNotifications.length} existing notifications`);
      } else {
        console.error('❌ Failed to load existing notifications:', response.status);
      }
    } catch (error) {
      console.error('❌ Error loading existing notifications:', error);
    }
  }, [token]);

  // Auto-connect when user and token are available
  useEffect(() => {
    if (user && token) {
      loadExistingNotifications();
      connect();
    }

    return () => {
      disconnect();
    };
  }, [user, token, connect, disconnect, loadExistingNotifications]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      disconnect();
    };
  }, [disconnect]);

  // Request browser notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        console.log(`🔔 Notification permission: ${permission}`);
      });
    }
  }, []);

  // Calculate derived values
  const unreadCount = notifications.filter(n => !n.read).length;
  const criticalAlerts = notifications.filter(n => n.priority === 'critical' && !n.acknowledged);

  return {
    notifications,
    connectionStatus,
    sendMessage,
    markAsRead,
    connect,
    disconnect,
    unreadCount,
    criticalAlerts
  };
};

// Utility functions
const showBrowserNotification = (notification: Notification) => {
  if ('Notification' in window && Notification.permission === 'granted') {
    const browserNotification = new Notification(notification.title, {
      body: notification.message,
      icon: '/favicon.ico',
      tag: notification.id,
      requireInteraction: notification.priority === 'critical'
    });

    browserNotification.onclick = () => {
      window.focus();
      browserNotification.close();
    };

    // Auto-close after 5 seconds for non-critical notifications
    if (notification.priority !== 'critical') {
      setTimeout(() => {
        browserNotification.close();
      }, 5000);
    }
  }
};

const playNotificationSound = () => {
  try {
    // Create audio element for critical alert sound
    const audio = new Audio('/sounds/critical-alert.mp3');
    audio.volume = 0.5;
    audio.play().catch(error => {
      console.log('Could not play notification sound:', error);
    });
  } catch (error) {
    console.log('Audio not supported:', error);
  }
};

export {};