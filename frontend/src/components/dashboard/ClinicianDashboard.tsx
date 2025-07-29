import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  CircularProgress,
  IconButton,
  Tooltip,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  DataGrid,
  GridColDef,
  GridActionsCellItem,
  GridToolbar,
} from '@mui/x-data-grid';
import {
  Visibility,
  Schedule,
  AssignmentTurnedIn,
  Warning,
  CheckCircle,
  Error,
  People,
  Assessment,
  Error as ErrorIcon,
  AssignmentLate,
  PushPin,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { Dialog as MuiDialog, DialogTitle as MuiDialogTitle, DialogContent as MuiDialogContent, DialogActions as MuiDialogActions, FormGroup, Checkbox } from '@mui/material';
import { dashboardAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { RiskLevel, UserRole } from '../../types';
import MotherRegistrationForm from '../mothers/MotherRegistrationForm';
import ClinicianSidebarPanels from './ClinicianSidebarPanels';
import { useClinicianDashboard } from './ClinicianDashboardContext';
import { ThemeProvider, createTheme, useTheme } from '@mui/material/styles';

interface PatientData {
  patient: {
    id: string;
    user_id: string;
    age: number;
    gestational_age?: number;
    previous_pregnancies: number;
    previous_complications?: string;
    emergency_contact: string;
    assigned_chv_id?: string;
    assigned_clinician_id?: string;
    created_at?: string; // Added for activity log
  };
  latest_assessment?: {
    id: string;
    assessment_date: string;
    risk_level?: RiskLevel;
    risk_score?: number;
    confidence?: number;
    systolic_bp: number;
    diastolic_bp: number;
    blood_sugar: number;
    heart_rate: number;
    notes?: string;
  };
  next_appointment?: {
    id: string;
    appointment_date: string;
    status: string;
    reason: string;
    notes?: string;
  };
  all_assessments?: { // Added for activity log
    id: string;
    assessment_date: string;
    risk_level?: RiskLevel;
    risk_score?: number;
    confidence?: number;
    systolic_bp: number;
    diastolic_bp: number;
    blood_sugar: number;
    heart_rate: number;
    notes?: string;
  }[];
  all_appointments?: { // Added for activity log
    id: string;
    appointment_date: string;
    status: string;
    reason: string;
    notes?: string;
  }[];
  all_medications?: { // Added for activity log
    id: string;
    medication_name: string;
    prescribed_at: string;
  }[];
}

const ClinicianDashboard: React.FC = () => {
  // All hooks must be at the top, before any logic or return
  const { user } = useAuth();
  const {
    patients,
    loading,
    error,
    summaryStats,
    columns,
    getRiskColor,
    fetchPatients
  } = useClinicianDashboard();

  // Action column for the simplified patient list
  const actionColumn: GridColDef = {
    field: 'actions',
    headerName: 'Actions',
    width: 200,
    sortable: false,
    renderCell: (params: any) => (
      <Box display="flex" gap={1} alignItems="center">
        <Tooltip title="View Details">
          <IconButton
            size="small"
            onClick={() => {
              setSelectedPatient(params.row);
              setDetailDialogOpen(true);
            }}
          >
            <Visibility />
          </IconButton>
        </Tooltip>
        <Tooltip title="New Assessment">
          <IconButton
            size="small"
            color="primary"
            onClick={() => {
              // Navigate to assessment with pre-filled data
              window.location.href = `/assessment?motherId=${params.row.patient.id}&age=${params.row.patient.age}&gestationalAge=${params.row.patient.gestational_age || 20}`;
            }}
          >
            <Assessment />
          </IconButton>
        </Tooltip>
        <Tooltip title={pinned.includes(params.row.patient.id) ? 'Unpin' : 'Pin'}>
          <IconButton
            size="small"
            color={pinned.includes(params.row.patient.id) ? 'secondary' : 'default'}
            onClick={() => handlePin(params.row.patient.id)}
          >
            <PushPin />
          </IconButton>
        </Tooltip>
      </Box>
    ),
  };

  // Simplified columns array with only essential information
  const simplifiedColumns = [
    columns[0], // Patient ID
    columns[1], // Age  
    columns[2], // Gestational Age
    columns[3], // Risk Level
    columns[4], // Last Assessment
    columns[5], // Next Appointment
    columns[6], // Confidence
    actionColumn
  ];
  const [selectedPatient, setSelectedPatient] = useState<PatientData | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [showRegistrationForm, setShowRegistrationForm] = useState(false);
  const [pinned, setPinned] = useState<string[]>(() => {
    const saved = localStorage.getItem('pinnedPatients');
    return saved ? JSON.parse(saved) : [];
  });
  const pinnedPatients = patients.filter((p) => pinned.includes(p.patient.id));
  
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
  const [cardPrefs, setCardPrefs] = useState(() => {
    const saved = localStorage.getItem('dashboardCardPrefs');
    return saved ? JSON.parse(saved) : {
      totalPatients: true,
      highRisk: true,
      mediumRisk: true,
      lowRisk: true,
      upcomingAppointments: true,
      recentAssessments: true,
    };
  });
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [highContrast, setHighContrast] = useState(() => {
    const saved = localStorage.getItem('highContrastMode');
    return saved ? JSON.parse(saved) : false;
  });
  useEffect(() => {
    if (user?.role === UserRole.CLINICIAN) {
      fetchPatients();
    }
  }, [user]);

  // Debug: Log patients data
  console.log("Patients data:", patients);

  const getRiskIcon = (riskLevel?: RiskLevel) => {
    switch (riskLevel) {
      case RiskLevel.HIGH:
        return <Warning />;
      case RiskLevel.MEDIUM:
        return <Warning />;
      case RiskLevel.LOW:
        return <CheckCircle />;
      default:
        return <Error />;
    }
  };

  const handleViewDetails = (patient: PatientData) => {
    setSelectedPatient(patient);
    setDetailDialogOpen(true);
  };

  const handleFollowUp = (patient: PatientData) => {
    // TODO: Implement follow-up action
    console.log('Follow up for patient:', patient.patient.id);
  };

  const handleSchedule = (patient: PatientData) => {
    // TODO: Implement scheduling action
    console.log('Schedule for patient:', patient.patient.id);
  };

  // Notification logic
  const now = new Date();
  const notifications: { type: string; message: string; icon: React.ReactNode }[] = [];
  patients.forEach((p) => {
    // Overdue assessment
    const lastAssessment = p.latest_assessment?.assessment_date ? new Date(p.latest_assessment.assessment_date) : null;
    if (!lastAssessment || (now.getTime() - lastAssessment.getTime()) / (1000 * 60 * 60 * 24) > 90) {
      notifications.push({
        type: 'overdue',
        message: `Patient ${p.patient.id} is overdue for assessment`,
        icon: <AssignmentLate color="warning" />,
      });
    }
    // High risk
    if (p.latest_assessment?.risk_level === RiskLevel.HIGH) {
      notifications.push({
        type: 'highrisk',
        message: `Patient ${p.patient.id} is HIGH RISK`,
        icon: <Warning color="error" />,
      });
    }
    // Missed appointment
    if (p.next_appointment) {
      const apptDate = new Date(p.next_appointment.appointment_date);
      if (apptDate < now && p.next_appointment.status !== 'completed') {
        notifications.push({
          type: 'missed',
          message: `Patient ${p.patient.id} missed appointment on ${apptDate.toLocaleDateString()}`,
          icon: <Schedule color="error" />,
        });
      }
    }
  });

  if (user?.role !== UserRole.CLINICIAN) {
    return (
      <Container maxWidth="lg">
        <Alert severity="error" sx={{ mt: 2 }}>
          You do not have permission to access the Clinician Dashboard.
        </Alert>
      </Container>
    );
  }

  const handleCardPrefChange = (key: string) => {
    const updated = { ...cardPrefs, [key]: !cardPrefs[key] };
    setCardPrefs(updated);
    localStorage.setItem('dashboardCardPrefs', JSON.stringify(updated));
  };

  const handleContrastToggle = () => {
    setHighContrast((prev: boolean) => {
      localStorage.setItem('highContrastMode', JSON.stringify(!prev));
      return !prev;
    });
  };
  const theme = createTheme({
    palette: highContrast
      ? {
          mode: 'dark',
          primary: { main: '#fff' },
          secondary: { main: '#ffeb3b' },
          background: { default: '#000', paper: '#222' },
          text: { primary: '#fff', secondary: '#ffeb3b' },
          error: { main: '#ff1744' },
          warning: { main: '#ffea00' },
          success: { main: '#00e676' },
          info: { main: '#00b0ff' },
        }
      : {},
  });

  return (
    <ThemeProvider theme={theme}>
      <Container maxWidth="xl">
        {/* Notification Panel */}
        {notifications.length > 0 && (
          <Card sx={{ mb: 3, borderLeft: '6px solid #1976d2', background: '#f5faff' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Notifications & Reminders</Typography>
              <List dense>
                {notifications.map((n, idx) => (
                  <ListItem key={idx}>
                    <ListItemIcon>{n.icon}</ListItemIcon>
                    <ListItemText primary={n.message} />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        )}
        {pinnedPatients.length > 0 && (
          <Card sx={{ mb: 3, borderLeft: '6px solid #ff9800', background: '#fff8e1' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Pinned Patients</Typography>
              <Box display="flex" gap={2} flexWrap="wrap">
                {pinnedPatients.map((p) => (
                  <Box key={p.patient.id} sx={{ p: 1, border: '1px solid #eee', borderRadius: 2, minWidth: 180, background: '#fff' }}>
                    <Box display="flex" alignItems="center" gap={1}>
                      <PushPin color="secondary" fontSize="small" />
                      <Typography variant="subtitle2">{p.patient.id}</Typography>
                    </Box>
                    <Typography variant="body2">Age: {p.patient.age}</Typography>
                    <Typography variant="body2">Risk: {p.latest_assessment?.risk_level?.toUpperCase() || 'N/A'}</Typography>
                    <Button size="small" variant="outlined" sx={{ mt: 1 }} onClick={() => handleViewDetails(p)}>
                      View Details
                    </Button>
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        )}
        <Box sx={{ mt: 2, mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              Clinician Dashboard
            </Typography>
            <Typography variant="body1" color="text.secondary" gutterBottom>
              Manage your assigned patients and their risk assessments
            </Typography>
            {user?.staff_id && (
              <Box display="flex" alignItems="center" gap={1} mt={1}>
                <Typography variant="body2" color="text.secondary">
                  Staff ID:
                </Typography>
                <Typography variant="body2" sx={{ 
                  fontWeight: 'bold', 
                  fontFamily: 'monospace',
                  bgcolor: 'primary.main',
                  color: 'white',
                  px: 1,
                  py: 0.5,
                  borderRadius: 1,
                  fontSize: '0.875rem'
                }}>
                  {user.staff_id}
                </Typography>
              </Box>
            )}
          </Box>
          <Box display="flex" alignItems="center" gap={2}>
            <Box display="flex" alignItems="center" gap={1}>
              <Switch checked={highContrast} onChange={handleContrastToggle} color="secondary" inputProps={{ 'aria-label': 'Toggle high contrast mode' }} />
              <Typography variant="body2">High Contrast</Typography>
            </Box>
            <Tooltip title="Customize Dashboard" aria-label="Customize Dashboard">
              <IconButton onClick={() => setCustomizeOpen(true)}>
                <SettingsIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
        {/* Customize Dialog */}
        <MuiDialog open={customizeOpen} onClose={() => setCustomizeOpen(false)}>
          <MuiDialogTitle>Customize Dashboard</MuiDialogTitle>
          <MuiDialogContent>
            <FormGroup>
              <Box display="flex" alignItems="center" gap={1}>
                <Checkbox checked={cardPrefs.totalPatients} onChange={() => handleCardPrefChange('totalPatients')} />
                <Typography variant="body2">Total Patients</Typography>
              </Box>
              <Box display="flex" alignItems="center" gap={1}>
                <Checkbox checked={cardPrefs.highRisk} onChange={() => handleCardPrefChange('highRisk')} />
                <Typography variant="body2">High Risk</Typography>
              </Box>
              <Box display="flex" alignItems="center" gap={1}>
                <Checkbox checked={cardPrefs.mediumRisk} onChange={() => handleCardPrefChange('mediumRisk')} />
                <Typography variant="body2">Medium Risk</Typography>
              </Box>
              <Box display="flex" alignItems="center" gap={1}>
                <Checkbox checked={cardPrefs.lowRisk} onChange={() => handleCardPrefChange('lowRisk')} />
                <Typography variant="body2">Low Risk</Typography>
              </Box>
              <Box display="flex" alignItems="center" gap={1}>
                <Checkbox checked={cardPrefs.upcomingAppointments} onChange={() => handleCardPrefChange('upcomingAppointments')} />
                <Typography variant="body2">Upcoming Appointments</Typography>
              </Box>
              <Box display="flex" alignItems="center" gap={1}>
                <Checkbox checked={cardPrefs.recentAssessments} onChange={() => handleCardPrefChange('recentAssessments')} />
                <Typography variant="body2">Recent Assessments</Typography>
              </Box>
            </FormGroup>
          </MuiDialogContent>
          <MuiDialogActions>
            <Button onClick={() => setCustomizeOpen(false)}>Close</Button>
          </MuiDialogActions>
        </MuiDialog>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {showRegistrationForm ? (
          <Box>
            <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
              Register New Mother
            </Typography>
            <MotherRegistrationForm onSuccess={() => { setShowRegistrationForm(false); fetchPatients(); }} />
          </Box>
        ) : (
          <Box>
            {/* Summary Statistics Cards */}
            <Box sx={{ display: 'flex', gap: 2, mb: 4, flexWrap: 'wrap', flexDirection: { xs: 'column', sm: 'row' } }}>
              {cardPrefs.totalPatients && (
                <Card sx={{ flex: '1 1 200px', minWidth: 200 }}>
                  <CardContent>
                    <Box display="flex" alignItems="center" justifyContent="space-between">
                      <Box>
                        <Typography color="textSecondary" gutterBottom>
                          Total Patients
                        </Typography>
                        <Typography variant="h4">
                          {summaryStats.totalPatients}
                        </Typography>
                      </Box>
                      <People color="primary" sx={{ fontSize: 40 }} />
                    </Box>
                  </CardContent>
                </Card>
              )}
              {cardPrefs.highRisk && (
                <Card sx={{ flex: '1 1 200px', minWidth: 200 }}>
                  <CardContent>
                    <Box display="flex" alignItems="center" justifyContent="space-between">
                      <Box>
                        <Typography color="textSecondary" gutterBottom>
                          High Risk
                        </Typography>
                        <Typography variant="h4" color="error">
                          {summaryStats.highRiskCount}
                        </Typography>
                      </Box>
                      <Warning color="error" sx={{ fontSize: 40 }} />
                    </Box>
                  </CardContent>
                </Card>
              )}
              {cardPrefs.mediumRisk && (
                <Card sx={{ flex: '1 1 200px', minWidth: 200 }}>
                  <CardContent>
                    <Box display="flex" alignItems="center" justifyContent="space-between">
                      <Box>
                        <Typography color="textSecondary" gutterBottom>
                          Medium Risk
                        </Typography>
                        <Typography variant="h4" color="warning.main">
                          {summaryStats.mediumRiskCount}
                        </Typography>
                      </Box>
                      <Warning color="warning" sx={{ fontSize: 40 }} />
                    </Box>
                  </CardContent>
                </Card>
              )}
              {cardPrefs.lowRisk && (
                <Card sx={{ flex: '1 1 200px', minWidth: 200 }}>
                  <CardContent>
                    <Box display="flex" alignItems="center" justifyContent="space-between">
                      <Box>
                        <Typography color="textSecondary" gutterBottom>
                          Low Risk
                        </Typography>
                        <Typography variant="h4" color="success.main">
                          {summaryStats.lowRiskCount}
                        </Typography>
                      </Box>
                      <CheckCircle color="success" sx={{ fontSize: 40 }} />
                    </Box>
                  </CardContent>
                </Card>
              )}
              {cardPrefs.upcomingAppointments && (
                <Card sx={{ flex: '1 1 200px', minWidth: 200 }}>
                  <CardContent>
                    <Box display="flex" alignItems="center" justifyContent="space-between">
                      <Box>
                        <Typography color="textSecondary" gutterBottom>
                          Upcoming Appointments
                        </Typography>
                        <Typography variant="h4" color="primary">
                          {summaryStats.upcomingAppointments}
                        </Typography>
                      </Box>
                      <Schedule color="primary" sx={{ fontSize: 40 }} />
                    </Box>
                  </CardContent>
                </Card>
              )}
              {cardPrefs.recentAssessments && (
                <Card sx={{ flex: '1 1 200px', minWidth: 200 }}>
                  <CardContent>
                    <Box display="flex" alignItems="center" justifyContent="space-between">
                      <Box>
                        <Typography color="textSecondary" gutterBottom>
                          Recent Assessments
                        </Typography>
                        <Typography variant="h4" color="info.main">
                          {summaryStats.recentAssessments}
                        </Typography>
                      </Box>
                      <Assessment color="info" sx={{ fontSize: 40 }} />
                    </Box>
                  </CardContent>
                </Card>
              )}
            </Box>
            
            {/* Patient List */}
            <Box sx={{ mt: 4 }}>
              <Typography variant="h5" gutterBottom>
                Patient List
              </Typography>
              {loading ? (
                <Box display="flex" justifyContent="center" p={3}>
                  <CircularProgress />
                </Box>
              ) : patients.length === 0 ? (
                <Alert severity="info">
                  No patients assigned to you yet.
                </Alert>
              ) : (
                <Box sx={{ height: { xs: 400, sm: 500 }, width: '100%' }}>
                  <DataGrid
                    rows={patients}
                    columns={simplifiedColumns}
                    getRowId={(row) => row.patient.id}
                    initialState={{
                      pagination: {
                        paginationModel: { page: 0, pageSize: 5 },
                      },
                    }}
                    pageSizeOptions={[5, 10, 25]}
                    disableRowSelectionOnClick
                    slots={{
                      toolbar: GridToolbar,
                    }}
                    slotProps={{
                      toolbar: {
                        showQuickFilter: true,
                        quickFilterProps: { debounceMs: 500 },
                      },
                    }}
                  />
                </Box>
              )}
            </Box>
          </Box>
        )}

        {/* Patient Detail Dialog */}
        <Dialog
          open={detailDialogOpen}
          onClose={() => setDetailDialogOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            Patient Details - {selectedPatient?.patient.id}
          </DialogTitle>
          <DialogContent>
            {selectedPatient && (
              <Box>
                <Typography variant="h6" gutterBottom>
                  Patient Information
                </Typography>
                <Box sx={{ mb: 2 }}>
                  <Typography><strong>Age:</strong> {selectedPatient.patient.age}</Typography>
                  <Typography><strong>Gestational Age:</strong> {selectedPatient.patient.gestational_age || 'N/A'} weeks</Typography>
                  <Typography><strong>Previous Pregnancies:</strong> {selectedPatient.patient.previous_pregnancies}</Typography>
                  <Typography><strong>Emergency Contact:</strong> {selectedPatient.patient.emergency_contact}</Typography>
                </Box>

                {selectedPatient.latest_assessment && (
                  <>
                    <Typography variant="h6" gutterBottom>
                      Latest Assessment
                    </Typography>
                    <Box sx={{ mb: 2 }}>
                      <Typography><strong>Date:</strong> {new Date(selectedPatient.latest_assessment.assessment_date).toLocaleDateString()}</Typography>
                      <Typography><strong>Risk Level:</strong> 
                        <Chip
                          label={selectedPatient.latest_assessment.risk_level?.toUpperCase()}
                          color={getRiskColor(selectedPatient.latest_assessment.risk_level) as "error" | "warning" | "success" | "default" | "info" | "primary" | "secondary"}
                          size="small"
                          sx={{ ml: 1 }}
                        />
                      </Typography>
                      <Typography><strong>Confidence:</strong> {selectedPatient.latest_assessment.confidence ? `${(selectedPatient.latest_assessment.confidence * 100).toFixed(1)}%` : 'N/A'}</Typography>
                      <Typography><strong>Blood Pressure:</strong> {selectedPatient.latest_assessment.systolic_bp}/{selectedPatient.latest_assessment.diastolic_bp} mmHg</Typography>
                      <Typography><strong>Blood Sugar:</strong> {selectedPatient.latest_assessment.blood_sugar} mmol/L</Typography>
                      <Typography><strong>Heart Rate:</strong> {selectedPatient.latest_assessment.heart_rate} bpm</Typography>
                      {selectedPatient.latest_assessment.notes && (
                        <Typography><strong>Notes:</strong> {selectedPatient.latest_assessment.notes}</Typography>
                      )}
                    </Box>
                  </>
                )}

                {selectedPatient.next_appointment && (
                  <>
                    <Typography variant="h6" gutterBottom>
                      Next Appointment
                    </Typography>
                    <Box>
                      <Typography><strong>Date:</strong> {new Date(selectedPatient.next_appointment.appointment_date).toLocaleDateString()}</Typography>
                      <Typography><strong>Status:</strong> {selectedPatient.next_appointment.status}</Typography>
                      <Typography><strong>Reason:</strong> {selectedPatient.next_appointment.reason}</Typography>
                      {selectedPatient.next_appointment.notes && (
                        <Typography><strong>Notes:</strong> {selectedPatient.next_appointment.notes}</Typography>
                      )}
                    </Box>
                  </>
                )}
                {/* Activity Log */}
                <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
                  Activity Log
                </Typography>
                <List dense sx={{ mb: 2 }}>
                  {/* Registration */}
                  {selectedPatient.patient.created_at && (
                    <ListItem>
                      <ListItemIcon>
                        <People color="primary" />
                      </ListItemIcon>
                      <ListItemText
                        primary="Patient Registered"
                        secondary={new Date(selectedPatient.patient.created_at).toLocaleDateString()}
                      />
                    </ListItem>
                  )}
                  
                  {/* Assessments */}
                  {selectedPatient.all_assessments && selectedPatient.all_assessments.length > 0 && selectedPatient.all_assessments
                    .sort((a, b) => new Date(a.assessment_date).getTime() - new Date(b.assessment_date).getTime())
                    .map((a: any) => (
                      <ListItem key={a.id}>
                        <ListItemIcon>
                          <Assessment color={a.risk_level === 'high' ? 'error' : a.risk_level === 'medium' ? 'warning' : 'success'} />
                        </ListItemIcon>
                        <ListItemText
                          primary={`Risk Assessment - ${a.risk_level?.toUpperCase()} Risk`}
                          secondary={new Date(a.assessment_date).toLocaleDateString()}
                        />
                      </ListItem>
                    ))}
                  
                  {/* Appointments */}
                  {selectedPatient.all_appointments && selectedPatient.all_appointments.length > 0 && selectedPatient.all_appointments
                    .sort((a, b) => new Date(a.appointment_date).getTime() - new Date(b.appointment_date).getTime())
                    .map((appt: any) => (
                      <ListItem key={appt.id}>
                        <ListItemIcon>
                          <Schedule color="info" />
                        </ListItemIcon>
                        <ListItemText
                          primary={`Appointment - ${appt.status}`}
                          secondary={new Date(appt.appointment_date).toLocaleDateString()}
                        />
                      </ListItem>
                    ))}
                  
                  {/* Medications */}
                  {selectedPatient.all_medications && selectedPatient.all_medications.length > 0 && selectedPatient.all_medications
                    .sort((a, b) => new Date(a.prescribed_at).getTime() - new Date(b.prescribed_at).getTime())
                    .map((med: any) => (
                      <ListItem key={med.id}>
                        <ListItemIcon>
                          <AssignmentTurnedIn color="secondary" />
                        </ListItemIcon>
                        <ListItemText
                          primary={`Medication: ${med.medication_name}`}
                          secondary={new Date(med.prescribed_at).toLocaleDateString()}
                        />
                      </ListItem>
                    ))}
                </List>
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDetailDialogOpen(false)}>Close</Button>
          </DialogActions>
        </Dialog>
      </Container>
    </ThemeProvider>
  );
};

export default ClinicianDashboard; 