import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  IconButton,
  Tooltip,
  Badge,
  Collapse,
  Alert,
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  Warning as WarningIcon,
  Schedule as ScheduleIcon,
  Assignment as AssignmentIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { MotherData } from './EnhancedMothersList';

interface NotificationSystemProps {
  mothers: MotherData[];
}

interface Notification {
  id: string;
  type: 'high_risk' | 'overdue_assessment' | 'new_registration';
  title: string;
  message: string;
  motherId: string;
  motherName: string;
  priority: 'high' | 'medium' | 'low';
  timestamp: Date;
}

const NotificationSystem: React.FC<NotificationSystemProps> = ({ mothers }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [dismissedNotifications, setDismissedNotifications] = useState<Set<string>>(new Set());

  useEffect(() => {
    generateNotifications();
  }, [mothers]);

  const generateNotifications = () => {
    const newNotifications: Notification[] = [];
    const now = new Date();

    mothers.forEach(mother => {
      // High risk notifications
      if (mother.current_risk_level === 'high') {
        newNotifications.push({
          id: `high_risk_${mother.id}`,
          type: 'high_risk',
          title: 'High Risk Mother',
          message: `${mother.full_name} is classified as high risk and needs immediate attention.`,
          motherId: mother.id,
          motherName: mother.full_name,
          priority: 'high',
          timestamp: new Date(),
        });
      }

      // Overdue assessment notifications
      const daysSinceAssessment = mother.last_assessment_date
        ? Math.floor((now.getTime() - new Date(mother.last_assessment_date).getTime()) / (1000 * 60 * 60 * 24))
        : 999;

      if (daysSinceAssessment > 30) {
        newNotifications.push({
          id: `overdue_${mother.id}`,
          type: 'overdue_assessment',
          title: 'Assessment Overdue',
          message: `${mother.full_name} hasn't been assessed in ${daysSinceAssessment} days.`,
          motherId: mother.id,
          motherName: mother.full_name,
          priority: daysSinceAssessment > 60 ? 'high' : 'medium',
          timestamp: new Date(),
        });
      }

      // New registration notifications (within 24 hours)
      if (mother.created_at) {
        const hoursSinceRegistration = Math.floor((now.getTime() - new Date(mother.created_at).getTime()) / (1000 * 60 * 60));
        if (hoursSinceRegistration <= 24) {
          newNotifications.push({
            id: `new_reg_${mother.id}`,
            type: 'new_registration',
            title: 'New Registration',
            message: `${mother.full_name} was recently registered and needs initial assessment.`,
            motherId: mother.id,
            motherName: mother.full_name,
            priority: 'medium',
            timestamp: new Date(mother.created_at),
          });
        }
      }
    });

    // Filter out dismissed notifications
    const activeNotifications = newNotifications.filter(n => !dismissedNotifications.has(n.id));
    
    // Sort by priority and timestamp
    activeNotifications.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      }
      return b.timestamp.getTime() - a.timestamp.getTime();
    });

    setNotifications(activeNotifications);
  };

  const dismissNotification = (notificationId: string) => {
    setDismissedNotifications(prev => new Set([...Array.from(prev), notificationId]));
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'high_risk': return <WarningIcon color="error" />;
      case 'overdue_assessment': return <ScheduleIcon color="warning" />;
      case 'new_registration': return <AssignmentIcon color="info" />;
      default: return <NotificationsIcon />;
    }
  };

  const getNotificationColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'info';
      default: return 'default';
    }
  };

  const highPriorityCount = notifications.filter(n => n.priority === 'high').length;

  return (
    <Box>
      <Tooltip title="Notifications">
        <IconButton onClick={() => setShowNotifications(!showNotifications)}>
          <Badge badgeContent={highPriorityCount} color="error">
            <Badge badgeContent={notifications.length} color="primary">
              <NotificationsIcon />
            </Badge>
          </Badge>
        </IconButton>
      </Tooltip>

      <Collapse in={showNotifications}>
        <Card sx={{ position: 'absolute', right: 0, top: '100%', zIndex: 1000, minWidth: 400, maxWidth: 500, mt: 1 }}>
          <CardContent>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">
                Notifications ({notifications.length})
              </Typography>
              <IconButton size="small" onClick={() => setShowNotifications(false)}>
                <CloseIcon />
              </IconButton>
            </Box>

            {notifications.length === 0 ? (
              <Alert severity="success">
                No active notifications. All mothers are up to date!
              </Alert>
            ) : (
              <List dense>
                {notifications.slice(0, 10).map((notification) => (
                  <ListItem
                    key={notification.id}
                    sx={{
                      border: 1,
                      borderColor: `${getNotificationColor(notification.priority)}.main`,
                      borderRadius: 1,
                      mb: 1,
                      bgcolor: `${getNotificationColor(notification.priority)}.light`,
                      opacity: 0.1,
                    }}
                  >
                    <ListItemIcon>
                      {getNotificationIcon(notification.type)}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography variant="subtitle2">
                            {notification.title}
                          </Typography>
                          <Chip
                            label={notification.priority.toUpperCase()}
                            size="small"
                            color={getNotificationColor(notification.priority) as any}
                          />
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography variant="body2">
                            {notification.message}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {notification.timestamp.toLocaleString()}
                          </Typography>
                        </Box>
                      }
                    />
                    <IconButton
                      size="small"
                      onClick={() => dismissNotification(notification.id)}
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </ListItem>
                ))}
              </List>
            )}

            {notifications.length > 10 && (
              <Typography variant="caption" color="text.secondary" textAlign="center" display="block" mt={1}>
                Showing 10 of {notifications.length} notifications
              </Typography>
            )}
          </CardContent>
        </Card>
      </Collapse>
    </Box>
  );
};

export default NotificationSystem;