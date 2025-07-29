import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Avatar,
  IconButton,
  Tooltip,
  Grid,
  Divider,
} from '@mui/material';
import {
  Phone as PhoneIcon,
  LocationOn as LocationIcon,
  Visibility as ViewIcon,
  Assignment as AssignmentIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  Person as PregnantIcon,
  Assessment as AssessmentIcon,
} from '@mui/icons-material';

interface MotherData {
  id: string;
  full_name: string;
  age: number;
  gestational_age?: number;
  phone_number: string;
  location: string;
  emergency_contact: string;
  assigned_chv?: string;
  assigned_chv_staff_id?: string;
  assigned_clinician?: string;
  assigned_clinician_staff_id?: string;
  current_risk_level: 'high' | 'medium' | 'low';
  last_assessment_date?: string;
  total_assessments: number;
  created_at?: string;
  user_id: string;
}

interface MothersCardViewProps {
  mothers: MotherData[];
  onViewMother: (mother: MotherData) => void;
  onNewAssessment: (motherId: string) => void;
}

const MothersCardView: React.FC<MothersCardViewProps> = ({
  mothers,
  onViewMother,
  onNewAssessment,
}) => {
  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'success';
      default: return 'default';
    }
  };

  const getRiskIcon = (riskLevel: string) => {
    switch (riskLevel) {
      case 'high': return <WarningIcon />;
      case 'medium': return <ScheduleIcon />;
      case 'low': return <CheckCircleIcon />;
      default: return <AssessmentIcon />;
    }
  };

  const isRecentlyRegistered = (createdAt?: string) => {
    if (!createdAt) return false;
    const daysDiff = (new Date().getTime() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24);
    return daysDiff <= 7;
  };

  const needsAssessment = (lastAssessmentDate?: string) => {
    if (!lastAssessmentDate) return true;
    const daysDiff = (new Date().getTime() - new Date(lastAssessmentDate).getTime()) / (1000 * 60 * 60 * 24);
    return daysDiff > 30;
  };

  return (
    <Box display="flex" flexWrap="wrap" gap={2}>
      {mothers.map((mother) => (
        <Box key={mother.id} flex="1 1 300px" minWidth="300px" maxWidth="400px">
          <Card 
            sx={{ 
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
              '&:hover': {
                boxShadow: 4,
                transform: 'translateY(-2px)',
                transition: 'all 0.2s ease-in-out',
              },
            }}
          >
            {/* Risk Level Indicator */}
            <Box
              sx={{
                position: 'absolute',
                top: 8,
                right: 8,
                zIndex: 1,
              }}
            >
              <Chip
                icon={getRiskIcon(mother.current_risk_level)}
                label={mother.current_risk_level.toUpperCase()}
                color={getRiskColor(mother.current_risk_level) as any}
                size="small"
              />
            </Box>

            {/* New/Needs Assessment Badges */}
            <Box
              sx={{
                position: 'absolute',
                top: 8,
                left: 8,
                zIndex: 1,
                display: 'flex',
                flexDirection: 'column',
                gap: 0.5,
              }}
            >
              {isRecentlyRegistered(mother.created_at) && (
                <Chip
                  label="NEW"
                  color="info"
                  size="small"
                  sx={{ fontSize: '0.7rem', height: 20 }}
                />
              )}
              {needsAssessment(mother.last_assessment_date) && (
                <Chip
                  label="ASSESS"
                  color="warning"
                  size="small"
                  sx={{ fontSize: '0.7rem', height: 20 }}
                />
              )}
            </Box>

            <CardContent sx={{ flexGrow: 1, pt: 5 }}>
              {/* Mother Info */}
              <Box display="flex" alignItems="center" gap={2} mb={2}>
                <Avatar 
                  sx={{ 
                    bgcolor: getRiskColor(mother.current_risk_level) + '.main',
                    width: 50,
                    height: 50,
                  }}
                >
                  <PregnantIcon />
                </Avatar>
                <Box flex={1}>
                  <Typography variant="h6" noWrap>
                    {mother.full_name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    ID: {mother.id}
                  </Typography>
                </Box>
              </Box>

              {/* Basic Info */}
              <Box mb={2}>
                <Typography variant="body2" color="text.secondary">
                  <strong>Age:</strong> {mother.age} years
                </Typography>
                {mother.gestational_age && (
                  <Typography variant="body2" color="text.secondary">
                    <strong>Pregnancy:</strong> {mother.gestational_age} weeks
                  </Typography>
                )}
              </Box>

              {/* Contact Info */}
              <Box mb={2}>
                <Box display="flex" alignItems="center" gap={1} mb={1}>
                  <PhoneIcon fontSize="small" color="action" />
                  <Typography variant="body2" noWrap>
                    {mother.phone_number}
                  </Typography>
                </Box>
                <Box display="flex" alignItems="center" gap={1}>
                  <LocationIcon fontSize="small" color="action" />
                  <Typography variant="body2" noWrap>
                    {mother.location}
                  </Typography>
                </Box>
              </Box>

              <Divider sx={{ my: 2 }} />

              {/* Assessment Info */}
              <Box mb={2}>
                <Typography variant="body2" color="text.secondary">
                  <strong>Assessments:</strong> {mother.total_assessments}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  <strong>Last:</strong> {
                    mother.last_assessment_date
                      ? new Date(mother.last_assessment_date).toLocaleDateString()
                      : 'Never'
                  }
                </Typography>
              </Box>

              {/* Assigned Staff */}
              <Box mb={2}>
                <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                  <Typography variant="caption" color="text.secondary">
                    <strong>CHV:</strong> {mother.assigned_chv || 'Not assigned'}
                  </Typography>
                  {mother.assigned_chv_staff_id && (
                    <Typography 
                      variant="caption" 
                      sx={{ 
                        fontFamily: 'monospace',
                        backgroundColor: 'primary.main',
                        color: 'primary.contrastText',
                        px: 0.5,
                        py: 0.25,
                        borderRadius: 0.5,
                        fontSize: '0.7rem'
                      }}
                    >
                      {mother.assigned_chv_staff_id}
                    </Typography>
                  )}
                </Box>
                <Box display="flex" alignItems="center" gap={1}>
                  <Typography variant="caption" color="text.secondary">
                    <strong>Clinician:</strong> {mother.assigned_clinician || 'Not assigned'}
                  </Typography>
                  {mother.assigned_clinician_staff_id && (
                    <Typography 
                      variant="caption" 
                      sx={{ 
                        fontFamily: 'monospace',
                        backgroundColor: 'secondary.main',
                        color: 'secondary.contrastText',
                        px: 0.5,
                        py: 0.25,
                        borderRadius: 0.5,
                        fontSize: '0.7rem'
                      }}
                    >
                      {mother.assigned_clinician_staff_id}
                    </Typography>
                  )}
                </Box>
              </Box>

              {/* Actions */}
              <Box display="flex" justifyContent="space-between" alignItems="center" mt="auto">
                <Box display="flex" gap={1}>
                  <Tooltip title="View Details">
                    <IconButton
                      size="small"
                      onClick={() => onViewMother(mother)}
                      color="primary"
                    >
                      <ViewIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="New Assessment">
                    <IconButton
                      size="small"
                      onClick={() => onNewAssessment(mother.id)}
                      color="secondary"
                    >
                      <AssignmentIcon />
                    </IconButton>
                  </Tooltip>
                </Box>
                
                {/* Emergency Contact */}
                <Tooltip title={`Emergency: ${mother.emergency_contact}`}>
                  <Typography variant="caption" color="text.secondary">
                    Emergency: {mother.emergency_contact.slice(0, 8)}...
                  </Typography>
                </Tooltip>
              </Box>
            </CardContent>
          </Card>
        </Box>
      ))}
    </Box>
  );
};

export default MothersCardView;