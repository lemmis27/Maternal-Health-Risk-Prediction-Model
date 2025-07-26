import React, { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  CircularProgress,
  IconButton,
  Tooltip,
  Button,
  Switch,
  FormControlLabel,
  TextField,
  MenuItem,
  Select,
  InputLabel,
  Chip,
  Alert,
  Avatar,
  LinearProgress,
  Divider,
  Paper,
  Badge
} from '@mui/material';
import {
  DataGrid,
  GridToolbar,
  GridColDef,
  GridRenderCellParams
} from '@mui/x-data-grid';
import { useClinicianDashboard } from './ClinicianDashboardContext';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Assessment as AssessmentIcon,
  PushPin as PushPinIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  Phone as PhoneIcon,
  Event as EventIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  MonitorHeart as HeartIcon,
  Bloodtype as BloodIcon,
  Thermostat as TempIcon,
  Speed as BPIcon,
  Refresh as RefreshIcon,
  FilterList as FilterIcon,
  Visibility as ViewIcon,
  PersonAdd as PersonAddIcon
} from '@mui/icons-material';

const ClinicianPatientList: React.FC = () => {
  const { patients, loading, columns, fetchPatients, summaryStats } = useClinicianDashboard();
  const navigate = useNavigate();
  const location = useLocation();
  const [showRecentOnly, setShowRecentOnly] = useState(true);
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [pinned, setPinned] = useState<string[]>(() => {
    const saved = localStorage.getItem('pinnedPatients');
    return saved ? JSON.parse(saved) : [];
  });

  const handlePin = (id: string) => {
    let updated;
    if (pinned.includes(id)) {
      updated = pinned.filter((pid) => pid !== id);
    } else {
      updated = [...pinned, id];
    }
    setPinned(updated);
    localStorage.setItem('pinnedPatients', JSON.stringify(updated));
  };

  useEffect(() => {
    fetchPatients(showRecentOnly ? 90 : null);
    // eslint-disable-next-line
  }, [location.pathname, showRecentOnly]);

  // Enhanced filtering with status filter
  const filteredPatients = patients.filter((p) => {
    const idMatch = p.patient.id.toLowerCase().includes(search.toLowerCase());
    const nameMatch = (p.patient.user_id || '').toLowerCase().includes(search.toLowerCase());
    const riskMatch = riskFilter ? (p.latest_assessment?.risk_level === riskFilter) : true;

    let statusMatch = true;
    if (statusFilter === 'assessed') {
      statusMatch = Boolean(p.latest_assessment);
    } else if (statusFilter === 'not_assessed') {
      statusMatch = !Boolean(p.latest_assessment);
    } else if (statusFilter === 'has_appointment') {
      statusMatch = Boolean(p.next_appointment);
    } else if (statusFilter === 'overdue_appointment') {
      statusMatch = Boolean(p.next_appointment && new Date(p.next_appointment.appointment_date) < new Date());
    }

    return (idMatch || nameMatch) && riskMatch && statusMatch;
  });

  const getActivityBadge = (patient: any) => {
    const createdAt = patient.patient.created_at ? new Date(patient.patient.created_at) : null;
    const now = new Date();
    const latestAssessmentDate = patient.latest_assessment?.assessment_date ? new Date(patient.latest_assessment.assessment_date) : null;
    const daysSinceRegistration = createdAt ? (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24) : null;
    const daysSinceAssessment = latestAssessmentDate ? (now.getTime() - latestAssessmentDate.getTime()) / (1000 * 60 * 60 * 24) : null;
    if (!patient.latest_assessment && daysSinceRegistration !== null && daysSinceRegistration <= 7) {
      return <Chip label="New" color="primary" size="small" sx={{ mr: 0.5 }} />;
    }
    if (daysSinceAssessment !== null && daysSinceAssessment <= 90) {
      return <Chip label="Recently Assessed" color="success" size="small" sx={{ mr: 0.5 }} />;
    }
    if (!patient.latest_assessment || (daysSinceAssessment !== null && daysSinceAssessment > 90)) {
      return <Chip label="Inactive" color="warning" size="small" sx={{ mr: 0.5 }} />;
    }
    return null;
  };

  // SHAP Explanation column
  const shapExplanationColumn: GridColDef = {
    field: 'shap_explanation',
    headerName: 'Key Risk Factors (SHAP)',
    width: 280,
    sortable: false,
    renderCell: (params: any) => {
      const assessment = params.row.latest_assessment;
      if (!assessment || !assessment.shap_explanation) {
        return <Typography variant="caption" color="textSecondary">No SHAP data</Typography>;
      }

      try {
        // Parse SHAP explanation if it's a string
        const shapData = typeof assessment.shap_explanation === 'string'
          ? JSON.parse(assessment.shap_explanation)
          : assessment.shap_explanation;

        const features = shapData.features || [];
        if (!features || features.length === 0) {
          return <Typography variant="caption" color="textSecondary">No factors available</Typography>;
        }

        // Get top 3 most important factors
        const topFactors = features
          .sort((a: any, b: any) => (a.importance_rank || 999) - (b.importance_rank || 999))
          .slice(0, 3);

        return (
          <Box>
            {topFactors.map((factor: any, index: number) => (
              <Box key={index} display="flex" alignItems="center" gap={0.5} mb={0.5}>
                <Typography variant="caption" sx={{ fontWeight: 'bold', minWidth: '20px' }}>
                  {factor.importance_rank || index + 1}.
                </Typography>
                <Typography variant="caption" sx={{ fontWeight: 'medium' }}>
                  {factor.feature}
                </Typography>
                <Chip
                  label={factor.impact === 'positive' ? '↑' : '↓'}
                  size="small"
                  color={factor.impact === 'positive' ? 'error' : 'success'}
                  sx={{
                    minWidth: '24px',
                    height: '16px',
                    fontSize: '10px',
                    '& .MuiChip-label': { px: 0.5 }
                  }}
                />
                <Typography variant="caption" color="textSecondary">
                  {factor.value}
                </Typography>
              </Box>
            ))}
            {features.length > 3 && (
              <Typography variant="caption" color="textSecondary" sx={{ fontStyle: 'italic' }}>
                +{features.length - 3} more factors
              </Typography>
            )}
          </Box>
        );
      } catch (error) {
        return <Typography variant="caption" color="error">Invalid SHAP data</Typography>;
      }
    },
  };

  // Enhanced columns with vital signs and detailed information
  const vitalSignsColumn: GridColDef = {
    field: 'vital_signs',
    headerName: 'Vital Signs',
    width: 200,
    sortable: false,
    renderCell: (params: any) => {
      const assessment = params.row.latest_assessment;
      if (!assessment) return <Typography variant="caption" color="textSecondary">No data</Typography>;

      return (
        <Box>
          <Box display="flex" alignItems="center" gap={0.5}>
            <BPIcon fontSize="small" color="action" />
            <Typography variant="caption">
              {assessment.systolic_bp}/{assessment.diastolic_bp} mmHg
            </Typography>
          </Box>
          <Box display="flex" alignItems="center" gap={0.5}>
            <HeartIcon fontSize="small" color="action" />
            <Typography variant="caption">
              {assessment.heart_rate} bpm
            </Typography>
          </Box>
          <Box display="flex" alignItems="center" gap={0.5}>
            <BloodIcon fontSize="small" color="action" />
            <Typography variant="caption">
              {assessment.blood_sugar} mmol/L
            </Typography>
          </Box>
        </Box>
      );
    },
  };

  const riskDetailsColumn: GridColDef = {
    field: 'risk_details',
    headerName: 'Risk Details',
    width: 180,
    sortable: false,
    renderCell: (params: any) => {
      const assessment = params.row.latest_assessment;
      if (!assessment) {
        return (
          <Box>
            <Chip label="Not Assessed" color="warning" size="small" />
          </Box>
        );
      }

      const getRiskColor = (risk: string) => {
        switch (risk) {
          case 'high': return 'error';
          case 'medium': return 'warning';
          case 'low': return 'success';
          default: return 'default';
        }
      };

      const getRiskIcon = (risk: string) => {
        switch (risk) {
          case 'high': return <WarningIcon fontSize="small" />;
          case 'medium': return <ScheduleIcon fontSize="small" />;
          case 'low': return <CheckCircleIcon fontSize="small" />;
          default: return undefined;
        }
      };

      return (
        <Box>
          <Chip
            icon={getRiskIcon(assessment.risk_level)}
            label={assessment.risk_level?.toUpperCase()}
            color={getRiskColor(assessment.risk_level)}
            size="small"
            sx={{ mb: 0.5 }}
          />
          {assessment.confidence && (
            <Box>
              <Typography variant="caption" color="textSecondary">
                Confidence: {(assessment.confidence * 100).toFixed(1)}%
              </Typography>
              <LinearProgress
                variant="determinate"
                value={assessment.confidence * 100}
                sx={{ height: 4, mt: 0.5 }}
              />
            </Box>
          )}
        </Box>
      );
    },
  };

  const contactColumn: GridColDef = {
    field: 'contact',
    headerName: 'Contact',
    width: 150,
    sortable: false,
    renderCell: (params: any) => {
      const patient = params.row.patient;
      return (
        <Box>
          <Box display="flex" alignItems="center" gap={0.5}>
            <PhoneIcon fontSize="small" color="action" />
            <Typography variant="caption">
              {patient.emergency_contact || 'N/A'}
            </Typography>
          </Box>
          <Typography variant="caption" color="textSecondary">
            ID: {patient.user_id}
          </Typography>
        </Box>
      );
    },
  };

  const appointmentStatusColumn: GridColDef = {
    field: 'appointment_status',
    headerName: 'Appointment Status',
    width: 180,
    sortable: false,
    renderCell: (params: any) => {
      const appointment = params.row.next_appointment;
      if (!appointment) {
        return <Typography variant="caption" color="textSecondary">No appointment</Typography>;
      }

      const appointmentDate = new Date(appointment.appointment_date);
      const now = new Date();
      const isOverdue = appointmentDate < now;
      const daysUntil = Math.ceil((appointmentDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      return (
        <Box>
          <Box display="flex" alignItems="center" gap={0.5}>
            <EventIcon fontSize="small" color={isOverdue ? "error" : "action"} />
            <Typography variant="caption" color={isOverdue ? "error" : "textPrimary"}>
              {appointmentDate.toLocaleDateString()}
            </Typography>
          </Box>
          <Typography variant="caption" color="textSecondary">
            {isOverdue ? `Overdue by ${Math.abs(daysUntil)} days` : `In ${daysUntil} days`}
          </Typography>
          <Chip
            label={appointment.status}
            size="small"
            color={appointment.status === 'confirmed' ? 'success' : 'default'}
            sx={{ mt: 0.5 }}
          />
        </Box>
      );
    },
  };

  // Enhanced action column
  const actionColumn: GridColDef = {
    field: 'actions',
    headerName: 'Actions',
    width: 250,
    sortable: false,
    renderCell: (params: any) => (
      <Box display="flex" gap={1} alignItems="center" flexWrap="wrap">
        <Tooltip title={pinned.includes(params.row.patient.id) ? 'Unpin' : 'Pin'}>
          <IconButton
            color={pinned.includes(params.row.patient.id) ? 'secondary' : 'default'}
            onClick={() => handlePin(params.row.patient.id)}
            size="small"
          >
            <PushPinIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="View Details">
          <IconButton
            color="info"
            onClick={() => navigate(`/mothers`)}
            size="small"
          >
            <ViewIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="New Assessment">
          <IconButton
            color="primary"
            onClick={() => navigate(`/assessment?motherId=${params.row.patient.id}&age=${params.row.patient.age}&gestationalAge=${params.row.patient.gestational_age || 20}`)}
            size="small"
          >
            <AssessmentIcon />
          </IconButton>
        </Tooltip>
        {!params.row.latest_assessment && (
          <Tooltip title="First Assessment Required">
            <Button
              variant="outlined"
              color="warning"
              size="small"
              onClick={() => navigate(`/assessment?motherId=${params.row.patient.id}&age=${params.row.patient.age}&gestationalAge=${params.row.patient.gestational_age || 20}`)}
            >
              Assess
            </Button>
          </Tooltip>
        )}
      </Box>
    ),
  };

  const activityColumn: GridColDef = {
    field: 'activity',
    headerName: 'Activity',
    width: 150,
    sortable: false,
    renderCell: (params: any) => getActivityBadge(params.row),
  };

  // Simplified columns array with only essential information
  const enhancedColumns = [
    columns[0], // Patient ID
    columns[1], // Age  
    columns[2], // Gestational Age
    columns[3], // Risk Level
    columns[4], // Last Assessment
    columns[5], // Next Appointment
    columns[6], // Confidence
    actionColumn
  ];

  // Helper to get risk priority
  const getRiskPriority = (risk: string | undefined) => {
    if (risk === 'high') return 3;
    if (risk === 'medium') return 2;
    if (risk === 'low') return 1;
    return 0;
  };
  // Helper to get appointment urgency
  const getAppointmentUrgency = (appointment: any) => {
    if (!appointment) return 0;
    const now = new Date();
    const apptDate = new Date(appointment.appointment_date);
    if (apptDate < now) return 2; // Overdue
    if ((apptDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24) <= 7) return 1; // Within 7 days
    return 0;
  };
  // Sort patients by risk and appointment urgency
  const sortedPatients = [...filteredPatients].sort((a, b) => {
    const riskA = getRiskPriority(a.latest_assessment?.risk_level);
    const riskB = getRiskPriority(b.latest_assessment?.risk_level);
    if (riskA !== riskB) return riskB - riskA;
    const apptA = getAppointmentUrgency(a.next_appointment);
    const apptB = getAppointmentUrgency(b.next_appointment);
    if (apptA !== apptB) return apptB - apptA;
    return 0;
  });
  // Row class for highlighting
  const getRowClassName = (params: any) => {
    const risk = params.row.latest_assessment?.risk_level;
    if (risk === 'high') return 'row-high-risk';
    if (risk === 'medium') return 'row-medium-risk';
    return '';
  };

  return (
    <Box sx={{ mt: 2 }}>
      {/* Statistics Cards */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, 1fr)',
            md: 'repeat(4, 1fr)'
          },
          gap: 4,
          mb: 4
        }}
      >
        <Card sx={{ height: '100%', boxShadow: 3 }}>
          <CardContent sx={{ p: 3 }}>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Box>
                <Typography color="textSecondary" gutterBottom variant="body2">
                  Total Patients
                </Typography>
                <Typography variant="h3" sx={{ fontWeight: 'bold', mb: 1 }}>
                  {summaryStats.totalPatients}
                </Typography>
              </Box>
              <Avatar sx={{ bgcolor: 'primary.main', width: 56, height: 56 }}>
                <PersonAddIcon sx={{ fontSize: 28 }} />
              </Avatar>
            </Box>
          </CardContent>
        </Card>

        <Card sx={{ height: '100%', boxShadow: 3 }}>
          <CardContent sx={{ p: 3 }}>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Box>
                <Typography color="textSecondary" gutterBottom variant="body2">
                  High Risk
                </Typography>
                <Typography variant="h3" color="error" sx={{ fontWeight: 'bold', mb: 1 }}>
                  {summaryStats.highRiskCount}
                </Typography>
              </Box>
              <Avatar sx={{ bgcolor: 'error.main', width: 56, height: 56 }}>
                <WarningIcon sx={{ fontSize: 28 }} />
              </Avatar>
            </Box>
          </CardContent>
        </Card>

        <Card sx={{ height: '100%', boxShadow: 3 }}>
          <CardContent sx={{ p: 3 }}>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Box>
                <Typography color="textSecondary" gutterBottom variant="body2">
                  Recent Assessments
                </Typography>
                <Typography variant="h3" color="success.main" sx={{ fontWeight: 'bold', mb: 1 }}>
                  {summaryStats.recentAssessments}
                </Typography>
              </Box>
              <Avatar sx={{ bgcolor: 'success.main', width: 56, height: 56 }}>
                <AssessmentIcon sx={{ fontSize: 28 }} />
              </Avatar>
            </Box>
          </CardContent>
        </Card>

        <Card sx={{ height: '100%', boxShadow: 3 }}>
          <CardContent sx={{ p: 3 }}>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Box>
                <Typography color="textSecondary" gutterBottom variant="body2">
                  Upcoming Appointments
                </Typography>
                <Typography variant="h3" color="warning.main" sx={{ fontWeight: 'bold', mb: 1 }}>
                  {summaryStats.upcomingAppointments}
                </Typography>
              </Box>
              <Avatar sx={{ bgcolor: 'warning.main', width: 56, height: 56 }}>
                <EventIcon sx={{ fontSize: 28 }} />
              </Avatar>
            </Box>
          </CardContent>
        </Card>
      </Box>

      <Card>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h5" gutterBottom>
              Patient List ({filteredPatients.length} patients)
            </Typography>
            <Box display="flex" gap={2} alignItems="center">
              <Tooltip title="Refresh Data">
                <IconButton onClick={() => fetchPatients(showRecentOnly ? 90 : null)}>
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
              <FormControlLabel
                control={
                  <Switch
                    checked={showRecentOnly}
                    onChange={e => setShowRecentOnly(e.target.checked)}
                    color="primary"
                  />
                }
                label="Recent Only (90 days)"
              />
            </Box>
          </Box>

          {/* Enhanced Filters */}
          <Box display="flex" gap={2} alignItems="center" mb={2} flexWrap="wrap">
            <TextField
              label="Search by Patient ID or Name"
              value={search}
              onChange={e => setSearch(e.target.value)}
              size="small"
              sx={{ minWidth: 220 }}
            />
            <Select
              value={riskFilter}
              onChange={e => setRiskFilter(e.target.value)}
              displayEmpty
              size="small"
              sx={{ minWidth: 140 }}
            >
              <MenuItem value="">All Risk Levels</MenuItem>
              <MenuItem value="high">High Risk</MenuItem>
              <MenuItem value="medium">Medium Risk</MenuItem>
              <MenuItem value="low">Low Risk</MenuItem>
            </Select>
            <Select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              displayEmpty
              size="small"
              sx={{ minWidth: 160 }}
            >
              <MenuItem value="">All Status</MenuItem>
              <MenuItem value="assessed">Assessed</MenuItem>
              <MenuItem value="not_assessed">Not Assessed</MenuItem>
              <MenuItem value="has_appointment">Has Appointment</MenuItem>
              <MenuItem value="overdue_appointment">Overdue Appointment</MenuItem>
            </Select>
          </Box>
          {loading ? (
            <Box display="flex" justifyContent="center" alignItems="center" height={200}>
              <CircularProgress />
            </Box>
          ) : filteredPatients.length > 0 ? (
            <Box sx={{ height: 500 }}>
              <DataGrid
                rows={sortedPatients}
                columns={enhancedColumns}
                getRowId={(row) => row.patient.id}
                initialState={{
                  pagination: { paginationModel: { pageSize: 10 } }
                }}
                pageSizeOptions={[10, 25, 50]}
                disableRowSelectionOnClick
                slots={{ toolbar: GridToolbar }}
                slotProps={{
                  toolbar: {
                    showQuickFilter: true,
                    quickFilterProps: { debounceMs: 500 },
                  },
                }}
                getRowClassName={getRowClassName}
                sx={{
                  '& .MuiDataGrid-cell:focus': {
                    outline: 'none',
                  },
                  '& .row-high-risk': {
                    backgroundColor: '#ffebee', // light red
                  },
                  '& .row-medium-risk': {
                    backgroundColor: '#fffde7', // light yellow
                  },
                }}
              />
            </Box>
          ) : (
            <Box display="flex" justifyContent="center" alignItems="center" height={200}>
              <Typography color="textSecondary">No patients found</Typography>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default ClinicianPatientList; 