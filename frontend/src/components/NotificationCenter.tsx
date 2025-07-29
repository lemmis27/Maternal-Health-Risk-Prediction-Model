/**
 * Notification Center Component
 * Displays real-time notifications with priority-based styling and actions
 */

import React, { useState } from 'react';
import {
  Badge,
  IconButton,
  Popover,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Typography,
  Box,
  Chip,
  Button,
  Divider,
  Avatar,
  Tooltip,
  Alert
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Error as ErrorIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  LocalHospital as HospitalIcon,
  Person as PersonIcon,
  Assignment as AssignmentIcon,
  Medication as MedicationIcon,
  Settings as SettingsIcon,
  Circle as CircleIcon
} from '@mui/icons-material';
import { useWebSocket } from '../hooks/useWebSocket';
// import { formatDistanceToNow } from 'date-fns';

const NotificationCenter: React.FC = () => {
  const { notifications, markAsRead, connectionStatus, unreadCount } = useWebSocket();
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleNotificationClick = (notificationId: string) => {
    markAsRead(notificationId);
    // You can add navigation logic here based on notification type
  };

  const handleMarkAllRead = () => {
    notifications.filter(n => !n.read).forEach(n => markAsRead(n.id));
  };

  const getNotificationIcon = (type: string, priority: string) => {
    const iconProps = { 
      fontSize: 'small' as const,
      color: getPriorityColor(priority) as any
    };

    switch (type) {
      case 'high_risk_alert':
      case 'emergency_alert':
        return <ErrorIcon {...iconProps} />;
      case 'appointment_reminder':
        return <ScheduleIcon {...iconProps} />;
      case 'medication_reminder':
        return <MedicationIcon {...iconProps} />;
      case 'assessment_completed':
        return <AssignmentIcon {...iconProps} />;
      case 'new_assignment':
        return <PersonIcon {...iconProps} />;
      case 'patient_registered':
        return <HospitalIcon {...iconProps} />;
      case 'system_update':
        return <SettingsIcon {...iconProps} />;
      case 'user_login':
        return <PersonIcon {...iconProps} />;
      default:
        return <InfoIcon {...iconProps} />;
    }
  };

  const getPriorityColor = (priority: string): 'error' | 'warning' | 'info' | 'success' => {
    switch (priority) {
      case 'critical':
        return 'error';
      case 'high':
        return 'warning';
      case 'medium':
        return 'info';
      default:
        return 'success';
    }
  };

  const getPriorityChipColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return { backgroundColor: '#ffebee', color: '#c62828' };
      case 'high':
        return { backgroundColor: '#fff3e0', color: '#ef6c00' };
      case 'medium':
        return { backgroundColor: '#e3f2fd', color: '#1976d2' };
      default:
        return { backgroundColor: '#e8f5e8', color: '#2e7d32' };
    }
  };

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'success';
      case 'connecting':
        return 'warning';
      default:
        return 'error';
    }
  };

  const getConnectionStatusText = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'Connected';
      case 'connecting':
        return 'Connecting...';
      default:
        return 'Disconnected';
    }
  };

  const formatNotificationTime = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);
      
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString();
    } catch {
      return 'Just now';
    }
  };

  const open = Boolean(anchorEl);

  return (
    <>
      <Tooltip title="Notifications">
        <IconButton
          color="inherit"
          onClick={handleClick}
          sx={{ 
            position: 'relative',
            '&::after': connectionStatus === 'connected' ? {
              content: '""',
              position: 'absolute',
              top: 6,
              right: 6,
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: 'success.main',
              border: '1px solid white'
            } : {}
          }}
        >
          <Badge badgeContent={unreadCount} color="error" max={99}>
            <NotificationsIcon />
          </Badge>
        </IconButton>
      </Tooltip>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        PaperProps={{
          sx: { 
            width: 420, 
            maxHeight: 600,
            boxShadow: 3
          }
        }}
      >
        <Box>
          {/* Header */}
          <Box p={2} pb={1}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
              <Typography variant="h6">
                Notifications
              </Typography>
              <Box display="flex" alignItems="center" gap={1}>
                <Chip 
                  label={getConnectionStatusText()}
                  size="small" 
                  color={getConnectionStatusColor()}
                  icon={<CircleIcon sx={{ fontSize: '12px !important' }} />}
                />
                {unreadCount > 0 && (
                  <Button 
                    size="small" 
                    onClick={handleMarkAllRead}
                    variant="text"
                  >
                    Mark all read
                  </Button>
                )}
              </Box>
            </Box>
            
            {connectionStatus !== 'connected' && (
              <Alert severity="warning" sx={{ mb: 1 }}>
                Real-time notifications are {connectionStatus}. Some notifications may be delayed.
              </Alert>
            )}
          </Box>

          <Divider />
          
          {/* Notifications List */}
          <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
            {notifications.length === 0 ? (
              <Box p={3} textAlign="center">
                <NotificationsIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  No notifications yet
                </Typography>
              </Box>
            ) : (
              <List dense sx={{ p: 0 }}>
                {notifications.slice(0, 20).map((notification, index) => (
                  <React.Fragment key={notification.id}>
                    <ListItem
                      component="div"
                      onClick={() => handleNotificationClick(notification.id)}
                      style={{ cursor: 'pointer' }}
                      sx={{
                        backgroundColor: notification.read ? 'transparent' : 'action.hover',
                        borderLeft: notification.read ? 'none' : `4px solid ${
                          notification.priority === 'critical' ? 'error.main' :
                          notification.priority === 'high' ? 'warning.main' :
                          notification.priority === 'medium' ? 'info.main' : 'success.main'
                        }`,
                        py: 1.5,
                        px: 2,
                        '&:hover': {
                          backgroundColor: 'action.selected'
                        }
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 40 }}>
                        {getNotificationIcon(notification.type, notification.priority)}
                      </ListItemIcon>
                      
                      <ListItemText
                        primary={
                          <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                            <Typography 
                              variant="subtitle2" 
                              sx={{ 
                                fontWeight: notification.read ? 'normal' : 'bold',
                                flex: 1,
                                mr: 1
                              }}
                            >
                              {notification.title}
                            </Typography>
                            <Chip
                              label={notification.priority}
                              size="small"
                              sx={{
                                ...getPriorityChipColor(notification.priority),
                                fontSize: '0.7rem',
                                height: 20,
                                minWidth: 50
                              }}
                            />
                          </Box>
                        }
                        secondary={
                          <Box>
                            <Typography 
                              variant="body2" 
                              color="text.secondary"
                              sx={{ 
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                                mb: 0.5
                              }}
                            >
                              {notification.message}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {formatNotificationTime(notification.timestamp)}
                            </Typography>
                          </Box>
                        }
                      />
                      
                      {!notification.read && (
                        <Box
                          sx={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            backgroundColor: 'primary.main',
                            ml: 1
                          }}
                        />
                      )}
                    </ListItem>
                    {index < notifications.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            )}
          </Box>
          
          {/* Footer */}
          {notifications.length > 20 && (
            <>
              <Divider />
              <Box p={2}>
                <Button 
                  fullWidth 
                  variant="text" 
                  onClick={handleClose}
                  size="small"
                >
                  View All Notifications
                </Button>
              </Box>
            </>
          )}
        </Box>
      </Popover>
    </>
  );
};

export default NotificationCenter;

export {};