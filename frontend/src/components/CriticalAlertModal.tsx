/**
 * Critical Alert Modal Component
 * Displays critical notifications that require immediate attention and acknowledgment
 */

import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Alert,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  IconButton
} from '@mui/material';
import {
  Emergency as EmergencyIcon,
  Warning as WarningIcon,
  Close as CloseIcon,
  Person as PersonIcon,
  LocalHospital as HospitalIcon,
  Phone as PhoneIcon,
  Schedule as ScheduleIcon
} from '@mui/icons-material';
import { useWebSocket } from '../hooks/useWebSocket';
import { useAuth } from '../contexts/AuthContext';

interface CriticalAlert {
  id: string;
  type: string;
  title: string;
  message: string;
  priority: string;
  timestamp: string;
  data?: {
    assessment_id?: string;
    mother_id?: string;
    patient_name?: string;
    risk_score?: number;
    vital_signs?: {
      systolic_bp: number;
      diastolic_bp: number;
      heart_rate: number;
      body_temp: number;
    };
    recommendations?: string[];
    patient_contact?: string;
  };
  acknowledged?: boolean;
}

const CriticalAlertModal: React.FC = () => {
  const { criticalAlerts, markAsRead } = useWebSocket();
  const { user } = useAuth();
  const token = localStorage.getItem('access_token');
  const [currentAlert, setCurrentAlert] = useState<CriticalAlert | null>(null);
  const [isAcknowledging, setIsAcknowledging] = useState(false);

  useEffect(() => {
    // Show the most recent unacknowledged critical alert
    const unacknowledgedAlert = criticalAlerts.find(alert => !alert.acknowledged);
    setCurrentAlert(unacknowledgedAlert || null);
  }, [criticalAlerts]);

  const handleAcknowledge = async () => {
    if (!currentAlert || !token) return;

    setIsAcknowledging(true);
    
    try {
      // Call API to acknowledge the notification
      const response = await fetch(`/notifications/${currentAlert.id}/acknowledge`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        // Mark as read locally
        markAsRead(currentAlert.id);
        
        // Close modal
        setCurrentAlert(null);
        
        console.log('✅ Critical alert acknowledged');
      } else {
        console.error('❌ Failed to acknowledge alert');
      }
    } catch (error) {
      console.error('❌ Error acknowledging alert:', error);
    } finally {
      setIsAcknowledging(false);
    }
  };

  const handleViewDetails = () => {
    if (currentAlert?.data?.assessment_id) {
      // Navigate to assessment details
      window.location.href = `/assessments/${currentAlert.data.assessment_id}`;
    } else if (currentAlert?.data?.mother_id) {
      // Navigate to patient details
      window.location.href = `/patients/${currentAlert.data.mother_id}`;
    }
    
    handleAcknowledge();
  };

  const handleDismiss = () => {
    handleAcknowledge();
  };

  const handleAccept = async () => {
    if (!currentAlert || !token) return;

    setIsAcknowledging(true);
    
    try {
      // Call API to accept responsibility for the critical case
      const baseUrl = process.env.NODE_ENV === 'development' 
        ? 'http://localhost:8000' 
        : '';
      
      const response = await fetch(`${baseUrl}/notifications/${currentAlert.id}/accept`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'accept',
          user_id: user?.id,
          staff_id: user?.staff_id,
          notes: 'Healthcare provider accepted responsibility for critical case'
        })
      });

      if (response.ok) {
        // Mark as read locally
        markAsRead(currentAlert.id);
        
        // Show success message
        console.log('✅ Critical case accepted - responsibility assigned');
        
        // Navigate to patient details for immediate action
        if (currentAlert.data?.assessment_id) {
          window.location.href = `/assessments/${currentAlert.data.assessment_id}`;
        } else if (currentAlert.data?.mother_id) {
          window.location.href = `/patients/${currentAlert.data.mother_id}`;
        }
        
        // Close modal
        setCurrentAlert(null);
      } else {
        console.error('❌ Failed to accept critical case');
        // Fallback to regular acknowledge
        handleAcknowledge();
      }
    } catch (error) {
      console.error('❌ Error accepting critical case:', error);
      // Fallback to regular acknowledge
      handleAcknowledge();
    } finally {
      setIsAcknowledging(false);
    }
  };

  const handleRecommend = async () => {
    if (!currentAlert || !token) return;

    setIsAcknowledging(true);
    
    try {
      // Call API to recommend referral/escalation
      const baseUrl = process.env.NODE_ENV === 'development' 
        ? 'http://localhost:8000' 
        : '';
      
      const response = await fetch(`${baseUrl}/notifications/${currentAlert.id}/recommend`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'recommend_referral',
          user_id: user?.id,
          staff_id: user?.staff_id,
          recommendation_type: 'urgent_referral',
          notes: 'Healthcare provider recommends immediate referral to higher level of care',
          priority: 'critical'
        })
      });

      if (response.ok) {
        // Mark as read locally
        markAsRead(currentAlert.id);
        
        // Show success message
        console.log('✅ Referral recommendation submitted');
        
        // Navigate to patient details to add more details
        if (currentAlert.data?.assessment_id) {
          window.location.href = `/assessments/${currentAlert.data.assessment_id}`;
        } else if (currentAlert.data?.mother_id) {
          window.location.href = `/patients/${currentAlert.data.mother_id}`;
        }
        
        // Close modal
        setCurrentAlert(null);
      } else {
        console.error('❌ Failed to submit referral recommendation');
        // Fallback to regular acknowledge
        handleAcknowledge();
      }
    } catch (error) {
      console.error('❌ Error submitting referral recommendation:', error);
      // Fallback to regular acknowledge
      handleAcknowledge();
    } finally {
      setIsAcknowledging(false);
    }
  };

  const formatVitalSigns = (vitalSigns: any) => {
    if (!vitalSigns) return null;

    return [
      { label: 'Blood Pressure', value: `${vitalSigns.systolic_bp}/${vitalSigns.diastolic_bp} mmHg` },
      { label: 'Heart Rate', value: `${vitalSigns.heart_rate} BPM` },
      { label: 'Body Temperature', value: `${vitalSigns.body_temp}°F` }
    ];
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'high_risk_alert':
      case 'emergency_alert':
        return <EmergencyIcon sx={{ fontSize: 28 }} />;
      default:
        return <WarningIcon sx={{ fontSize: 28 }} />;
    }
  };

  const getAlertColor = (type: string) => {
    switch (type) {
      case 'emergency_alert':
        return 'error';
      case 'high_risk_alert':
        return 'warning';
      default:
        return 'error';
    }
  };

  if (!currentAlert) return null;

  const vitalSigns = formatVitalSigns(currentAlert.data?.vital_signs);

  return (
    <Dialog
      open={true}
      maxWidth="md"
      fullWidth
      disableEscapeKeyDown
      PaperProps={{
        sx: {
          border: '3px solid',
          borderColor: 'error.main',
          boxShadow: '0 0 30px rgba(244, 67, 54, 0.4)',
          animation: 'pulse 2s infinite'
        }
      }}
    >
      <DialogTitle 
        sx={{ 
          backgroundColor: 'error.main', 
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <Box display="flex" alignItems="center" gap={1}>
          {getAlertIcon(currentAlert.type)}
          <Typography variant="h5" component="div">
            CRITICAL ALERT
          </Typography>
          <Chip 
            label="URGENT" 
            sx={{ 
              backgroundColor: 'warning.main',
              color: 'warning.contrastText',
              fontWeight: 'bold'
            }}
            size="small" 
          />
        </Box>
        
        <Typography variant="caption" sx={{ opacity: 0.9 }}>
          {new Date(currentAlert.timestamp).toLocaleString()}
        </Typography>
      </DialogTitle>
      
      <DialogContent sx={{ pt: 3 }}>
        <Alert 
          severity={getAlertColor(currentAlert.type) as any}
          sx={{ mb: 3 }}
          icon={getAlertIcon(currentAlert.type)}
        >
          <Typography variant="h6" gutterBottom>
            {currentAlert.title}
          </Typography>
          <Typography variant="body1">
            {currentAlert.message}
          </Typography>
        </Alert>
        
        {currentAlert.data && (
          <Box>
            {/* Patient Information */}
            {currentAlert.data.patient_name && (
              <Box mb={2}>
                <Typography variant="h6" gutterBottom color="primary">
                  Patient Information
                </Typography>
                <List dense>
                  <ListItem>
                    <ListItemIcon>
                      <PersonIcon color="primary" />
                    </ListItemIcon>
                    <ListItemText 
                      primary="Patient Name" 
                      secondary={currentAlert.data.patient_name}
                    />
                  </ListItem>
                  
                  {currentAlert.data.mother_id && (
                    <ListItem>
                      <ListItemIcon>
                        <HospitalIcon color="primary" />
                      </ListItemIcon>
                      <ListItemText 
                        primary="Patient ID" 
                        secondary={currentAlert.data.mother_id}
                      />
                    </ListItem>
                  )}
                  
                  {currentAlert.data.patient_contact && (
                    <ListItem>
                      <ListItemIcon>
                        <PhoneIcon color="primary" />
                      </ListItemIcon>
                      <ListItemText 
                        primary="Contact" 
                        secondary={currentAlert.data.patient_contact}
                      />
                    </ListItem>
                  )}
                </List>
              </Box>
            )}

            {/* Risk Information */}
            {currentAlert.data.risk_score && (
              <Box mb={2}>
                <Typography variant="h6" gutterBottom color="error">
                  Risk Assessment
                </Typography>
                <Alert severity="error" sx={{ mb: 1 }}>
                  <Typography variant="body1">
                    <strong>Risk Score: {(currentAlert.data.risk_score * 100).toFixed(1)}%</strong>
                  </Typography>
                </Alert>
              </Box>
            )}

            {/* Vital Signs */}
            {vitalSigns && (
              <Box mb={2}>
                <Typography variant="h6" gutterBottom color="warning.main">
                  Vital Signs
                </Typography>
                <List dense>
                  {vitalSigns.map((vital, index) => (
                    <ListItem key={index}>
                      <ListItemText 
                        primary={vital.label}
                        secondary={vital.value}
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}

            {/* Recommendations */}
            {currentAlert.data.recommendations && currentAlert.data.recommendations.length > 0 && (
              <Box mb={2}>
                <Typography variant="h6" gutterBottom color="info.main">
                  Immediate Actions Required
                </Typography>
                <List dense>
                  {currentAlert.data.recommendations.map((recommendation, index) => (
                    <ListItem key={index}>
                      <ListItemText 
                        primary={`${index + 1}. ${recommendation}`}
                        sx={{ 
                          '& .MuiListItemText-primary': { 
                            fontWeight: 'medium' 
                          } 
                        }}
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}
          </Box>
        )}
        
        <Alert severity="info" sx={{ mt: 2 }}>
          <Typography variant="body2">
            <strong>Important:</strong> This alert requires immediate acknowledgment. 
            Please take appropriate action and acknowledge to confirm you have seen this alert.
          </Typography>
        </Alert>
      </DialogContent>
      
      <DialogActions sx={{ p: 2, gap: 1, flexDirection: 'column' }}>
        {/* Primary Action Buttons */}
        <Box display="flex" gap={1} width="100%" justifyContent="center">
          <Button 
            onClick={handleAccept} 
            variant="contained" 
            color="success"
            disabled={isAcknowledging}
            startIcon={<HospitalIcon />}
            size="large"
            sx={{ minWidth: 140 }}
          >
            Accept & Handle
          </Button>
          
          <Button 
            onClick={handleRecommend} 
            variant="contained" 
            color="warning"
            disabled={isAcknowledging}
            startIcon={<WarningIcon />}
            size="large"
            sx={{ minWidth: 140 }}
          >
            Recommend Referral
          </Button>
        </Box>
        
        {/* Secondary Action Buttons */}
        <Box display="flex" gap={1} width="100%" justifyContent="center">
          <Button 
            onClick={handleViewDetails} 
            variant="outlined" 
            color="primary"
            disabled={isAcknowledging}
            startIcon={<PersonIcon />}
            size="medium"
          >
            View Patient Details
          </Button>
          
          <Button 
            onClick={handleDismiss} 
            color="inherit"
            disabled={isAcknowledging}
            size="medium"
          >
            {isAcknowledging ? 'Processing...' : 'Acknowledge Only'}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
};

export default CriticalAlertModal;

export {};