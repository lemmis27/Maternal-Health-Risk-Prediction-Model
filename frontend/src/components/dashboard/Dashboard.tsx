import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  Alert,
  CircularProgress,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  LinearProgress,
  Divider,
  IconButton,
  Tooltip,
  Badge,
  Avatar,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  useTheme,
} from '@mui/material';
import {
  People,
  Assessment,
  Warning,
  CheckCircle,
  ExpandMore,
  Timeline,
  Logout,
  ContentCopy,
  Refresh,
  CalendarToday,
  Phone,
  LocalHospital,
  TrendingUp,
  TrendingDown,
  Notifications,
  HealthAndSafety,
  PregnantWoman,
  MonitorHeart,
  BloodtypeOutlined,
  FavoriteOutlined,
  Schedule,
  Info,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { dashboardAPI, mothersAPI, assessmentAPI } from '../../services/api';
import { DashboardStats, UserRole } from '../../types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';
import { useNavigate } from 'react-router-dom';
import ClinicianDashboard from './ClinicianDashboard';
import AdminDashboard from './AdminDashboard';
import MotherRegistrationForm from '../mothers/MotherRegistrationForm';
import { ClinicianDashboardProvider } from './ClinicianDashboardContext';

const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [latestAssessment, setLatestAssessment] = useState<any>(null);
  const [allAssessments, setAllAssessments] = useState<any[]>([]);
  const [assessmentHistoryData, setAssessmentHistoryData] = useState<any[]>([]);
  const [showRegistrationForm, setShowRegistrationForm] = useState(false);
  const [motherId, setMotherId] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        let response;
        switch (user?.role) {
          case UserRole.CHV:
            response = await dashboardAPI.getCHVDashboard(user.id);
            break;
          case UserRole.CLINICIAN:
            response = await dashboardAPI.getClinicianDashboard(user.id);
            break;
          case UserRole.ADMIN:
            response = await dashboardAPI.getAdminDashboard();
            break;
          case UserRole.PREGNANT_MOTHER:
            // Fetch mother id by user_id
            const mothersRes = await mothersAPI.list(0, 100); // get all mothers
            const mother = mothersRes.data.find((m: any) => m.user_id === user.id);
            if (mother) {
              setMotherId(mother.id);
              // Fetch assessments for this mother
              const assessmentsRes = await assessmentAPI.getByMotherId(mother.id);
              const assessments = assessmentsRes.data;
              if (assessments && assessments.length > 0) {
                // Sort by assessment_date descending
                assessments.sort((a: any, b: any) => new Date(b.assessment_date).getTime() - new Date(a.assessment_date).getTime());
                setLatestAssessment(assessments[0]);
                setAllAssessments(assessments);

                // Prepare data for chart
                const chartData = assessments
                  .sort((a: any, b: any) => new Date(a.assessment_date).getTime() - new Date(b.assessment_date).getTime())
                  .map((assessment: any, index: number) => ({
                    date: new Date(assessment.assessment_date).toLocaleDateString(),
                    riskLevel: assessment.risk_level === 'high' ? 3 : assessment.risk_level === 'medium' ? 2 : 1,
                    riskLabel: assessment.risk_level,
                    confidence: assessment.confidence || 0,
                    systolicBP: assessment.systolic_bp,
                    diastolicBP: assessment.diastolic_bp,
                    bloodSugar: assessment.blood_sugar,
                    heartRate: assessment.heart_rate,
                  }));
                setAssessmentHistoryData(chartData);
              }
            }
            setStats({
              total_mothers: 1,
              total_assessments: 0,
              high_risk_count: 0,
              medium_risk_count: 0,
              low_risk_count: 0,
              recent_assessments: [],
              upcoming_appointments: []
            });
            setLoading(false);
            return;
          default:
            response = await dashboardAPI.getCHVDashboard(user?.id || '');
        }
        setStats(response.data);
      } catch (error: any) {
        console.error('Dashboard error:', error);
        if (typeof error === 'string') {
          setError(error);
        } else if (error?.message) {
          setError(String(error.message));
        } else if (error?.response?.data?.detail) {
          setError(String(error.response.data.detail));
        } else {
          setError('Failed to load dashboard data');
        }
      } finally {
        setLoading(false);
      }
    };
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'high':
        return 'error';
      case 'medium':
        return 'warning';
      case 'low':
        return 'success';
      default:
        return 'default';
    }
  };

  const getRiskIcon = (riskLevel: string) => {
    switch (riskLevel) {
      case 'high':
        return <Warning color="error" />;
      case 'medium':
        return <Warning color="warning" />;
      case 'low':
        return <CheckCircle color="success" />;
      default:
        return <Assessment />;
    }
  };

  return (
    <ClinicianDashboardProvider>
      <Box>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h4" gutterBottom>
            Dashboard
          </Typography>
          <Button
            variant="outlined"
            startIcon={<Logout />}
            onClick={handleLogout}
            color="primary"
          >
            Logout
          </Button>
        </Box>

        {user?.role === UserRole.ADMIN ? (
          // Render AdminDashboard for ADMIN users
          <AdminDashboard />
        ) : user?.role === UserRole.CLINICIAN ? (
          // Render ClinicianDashboard for CLINICIAN users
          <ClinicianDashboard />
        ) : user?.role === UserRole.PREGNANT_MOTHER ? (
          // Enhanced Pregnant Mother Dashboard
          <Box>
            {loading && (
              <Box sx={{ width: '100%', mb: 2 }}>
                <LinearProgress />
              </Box>
            )}

            {error && (
              <Alert severity="error" sx={{ mb: 3 }} action={
                <Button color="inherit" size="small" onClick={() => window.location.reload()}>
                  Retry
                </Button>
              }>
                {error}
              </Alert>
            )}

            {/* Header Section with User Info */}
            <Card sx={{ mb: 3, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={2}>
                  <Box display="flex" alignItems="center" gap={2}>
                    <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', width: 56, height: 56 }}>
                      <PregnantWoman sx={{ fontSize: 32 }} />
                    </Avatar>
                    <Box>
                      <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 1 }}>
                        Welcome, {user.full_name}!
                      </Typography>
                      <Typography variant="body2" sx={{ opacity: 0.9 }}>
                        Your maternal health dashboard
                      </Typography>
                    </Box>
                  </Box>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Tooltip title="Refresh Dashboard">
                      <IconButton
                        sx={{ color: 'white' }}
                        onClick={() => window.location.reload()}
                      >
                        <Refresh />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Notifications">
                      <IconButton sx={{ color: 'white' }}>
                        <Badge badgeContent={0} color="error">
                          <Notifications />
                        </Badge>
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>

                {/* ID Information */}
                <Divider sx={{ my: 2, bgcolor: 'rgba(255,255,255,0.2)' }} />
                <Box display="flex" alignItems="center" gap={3} flexWrap="wrap">
                  <Box display="flex" alignItems="center" gap={1}>
                    <Typography variant="body2">User ID:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 'bold', fontFamily: 'monospace' }}>
                      {user?.id}
                    </Typography>
                    <IconButton
                      size="small"
                      sx={{ color: 'white' }}
                      onClick={() => {
                        if (user?.id) {
                          navigator.clipboard.writeText(user.id);
                          setCopySuccess(true);
                          setTimeout(() => setCopySuccess(false), 1500);
                        }
                      }}
                    >
                      <ContentCopy fontSize="small" />
                    </IconButton>
                  </Box>
                  {motherId && (
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography variant="body2">Mother ID:</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'bold', fontFamily: 'monospace' }}>
                        {motherId}
                      </Typography>
                      <IconButton
                        size="small"
                        sx={{ color: 'white' }}
                        onClick={() => {
                          navigator.clipboard.writeText(motherId);
                          setCopySuccess(true);
                          setTimeout(() => setCopySuccess(false), 1500);
                        }}
                      >
                        <ContentCopy fontSize="small" />
                      </IconButton>
                    </Box>
                  )}
                  {copySuccess && (
                    <Typography variant="caption" sx={{ color: '#4caf50' }}>
                      ✓ Copied to clipboard!
                    </Typography>
                  )}
                </Box>
              </CardContent>
            </Card>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {/* Latest Risk Assessment */}
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Latest Risk Assessment</Typography>
                  {latestAssessment ? (
                    <Chip
                      icon={getRiskIcon(latestAssessment.risk_level)}
                      label={latestAssessment.risk_level?.toUpperCase() || 'N/A'}
                      color={getRiskColor(latestAssessment.risk_level)}
                    />
                  ) : (
                    <Alert severity="info">No assessment available</Alert>
                  )}
                </CardContent>
              </Card>

              {/* Status Cards */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Card>
                  <CardContent>
                    <Typography variant="h6">Health Status</Typography>
                    <Typography variant="body1">
                      {latestAssessment?.risk_level === 'low' ? 'Good' :
                        latestAssessment?.risk_level === 'medium' ? 'Monitor' :
                          latestAssessment?.risk_level === 'high' ? 'Attention' : 'Unknown'}
                    </Typography>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent>
                    <Typography variant="h6">Next Appointment</Typography>
                    <Typography variant="body1">None Scheduled</Typography>
                  </CardContent>
                </Card>
              </Box>

              {/* Assessment History Chart */}
              {assessmentHistoryData.length > 0 && (
                <Box>
                  <Card>
                    <CardContent>
                      <Box display="flex" alignItems="center" justifyContent="between" mb={2}>
                        <Box display="flex" alignItems="center" gap={2}>
                          <Timeline color="primary" />
                          <Typography variant="h6">Assessment History</Typography>
                        </Box>
                        <Box display="flex" alignItems="center" gap={1}>
                          {assessmentHistoryData.length > 1 && (
                            <Box display="flex" alignItems="center" gap={0.5}>
                              {assessmentHistoryData[assessmentHistoryData.length - 1].riskLevel >
                                assessmentHistoryData[assessmentHistoryData.length - 2].riskLevel ? (
                                <TrendingUp color="error" fontSize="small" />
                              ) : assessmentHistoryData[assessmentHistoryData.length - 1].riskLevel <
                                assessmentHistoryData[assessmentHistoryData.length - 2].riskLevel ? (
                                <TrendingDown color="success" fontSize="small" />
                              ) : null}
                              <Typography variant="caption" color="text.secondary">
                                {assessmentHistoryData.length} assessments
                              </Typography>
                            </Box>
                          )}
                        </Box>
                      </Box>
                      <ResponsiveContainer width="100%" height={350}>
                        <LineChart data={assessmentHistoryData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" />
                          <YAxis domain={[0, 3]} ticks={[1, 2, 3]} />
                          <RechartsTooltip
                            formatter={(value: any, name: string) => {
                              if (name === 'riskLevel') {
                                const labels = { 1: 'Low', 2: 'Medium', 3: 'High' };
                                return [labels[value as keyof typeof labels] || value, 'Risk Level'];
                              }
                              return [value, name];
                            }}
                          />
                          <Legend />
                          <Line
                            type="monotone"
                            dataKey="riskLevel"
                            stroke="#1976d2"
                            strokeWidth={3}
                            dot={{ fill: '#1976d2', strokeWidth: 2, r: 6 }}
                            activeDot={{ r: 8 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </Box>
              )}

              {/* Quick Actions & Tips */}
              <Box>
                <Card sx={{ height: '100%' }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Quick Actions
                    </Typography>
                    <List dense>
                      <ListItem>
                        <ListItemIcon>
                          <Assessment color="primary" />
                        </ListItemIcon>
                        <ListItemText
                          primary="Request Assessment"
                          secondary="Contact your CHV for health check"
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemIcon>
                          <CalendarToday color="primary" />
                        </ListItemIcon>
                        <ListItemText
                          primary="Schedule Appointment"
                          secondary="Book with your clinician"
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemIcon>
                          <Phone color="primary" />
                        </ListItemIcon>
                        <ListItemText
                          primary="Emergency Contact"
                          secondary="Call 911 for emergencies"
                        />
                      </ListItem>
                    </List>
                  </CardContent>
                </Card>
              </Box>

              {/* Assessment History Table */}
              {allAssessments.length > 0 && (
                <Box>
                  <Accordion>
                    <AccordionSummary expandIcon={<ExpandMore />}>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Timeline />
                        <Typography variant="h6">
                          Detailed Assessment History ({allAssessments.length} assessments)
                        </Typography>
                      </Box>
                    </AccordionSummary>
                    <AccordionDetails>
                      <TableContainer component={Paper}>
                        <Table>
                          <TableHead>
                            <TableRow>
                              <TableCell>Date</TableCell>
                              <TableCell>Risk Level</TableCell>
                              <TableCell>Confidence</TableCell>
                              <TableCell>Blood Pressure</TableCell>
                              <TableCell>Blood Sugar</TableCell>
                              <TableCell>Heart Rate</TableCell>
                              <TableCell>Notes</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {allAssessments.map((assessment) => (
                              <TableRow key={assessment.id} hover>
                                <TableCell>
                                  <Typography variant="body2">
                                    {new Date(assessment.assessment_date).toLocaleDateString()}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    {new Date(assessment.assessment_date).toLocaleTimeString()}
                                  </Typography>
                                </TableCell>
                                <TableCell>
                                  <Chip
                                    icon={getRiskIcon(assessment.risk_level)}
                                    label={assessment.risk_level?.toUpperCase() || 'N/A'}
                                    color={getRiskColor(assessment.risk_level)}
                                    size="small"
                                  />
                                </TableCell>
                                <TableCell>
                                  {assessment.confidence ? (
                                    <Box>
                                      <Typography variant="body2">
                                        {(assessment.confidence * 100).toFixed(1)}%
                                      </Typography>
                                      <LinearProgress
                                        variant="determinate"
                                        value={assessment.confidence * 100}
                                        sx={{ mt: 0.5 }}
                                      />
                                    </Box>
                                  ) : 'N/A'}
                                </TableCell>
                                <TableCell>
                                  <Typography variant="body2">
                                    {assessment.systolic_bp}/{assessment.diastolic_bp} mmHg
                                  </Typography>
                                </TableCell>
                                <TableCell>
                                  <Typography variant="body2">
                                    {assessment.blood_sugar} mmol/L
                                  </Typography>
                                </TableCell>
                                <TableCell>
                                  <Typography variant="body2">
                                    {assessment.heart_rate} bpm
                                  </Typography>
                                </TableCell>
                                <TableCell>
                                  {assessment.notes ? (
                                    <Tooltip title={assessment.notes}>
                                      <Typography variant="body2" noWrap sx={{ maxWidth: 150 }}>
                                        {assessment.notes}
                                      </Typography>
                                    </Tooltip>
                                  ) : (
                                    <Typography variant="body2" color="text.secondary">
                                      No notes
                                    </Typography>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </AccordionDetails>
                  </Accordion>
                </Box>
              )}

              {/* Health Tips Section */}
              <Box>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Personalized Health Tips
                    </Typography>
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
                      <Box>
                        <Box>
                          <Typography variant="subtitle1" color="primary" gutterBottom>
                            🥗 Nutrition
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            • Eat folate-rich foods (leafy greens, citrus)
                            • Take prenatal vitamins daily
                            • Stay hydrated (8-10 glasses water)
                            • Limit caffeine intake
                          </Typography>
                        </Box>
                      </Box>

                      <Box>
                        <Typography variant="subtitle1" color="primary" gutterBottom>
                          🏃‍♀️ Exercise
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          • 30 minutes moderate exercise daily
                          • Walking, swimming, prenatal yoga
                          • Avoid contact sports
                          • Listen to your body
                        </Typography>
                      </Box>

                      <Box>
                        <Typography variant="subtitle1" color="primary" gutterBottom>
                          😴 Self-Care
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          • Get 7-9 hours of sleep
                          • Practice relaxation techniques
                          • Attend all prenatal appointments
                          • Monitor fetal movements
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>

                {/* Emergency Information */}
                <Card sx={{ border: '2px solid #f44336' }}>
                  <CardContent>
                    <Typography variant="h6" color="error" gutterBottom>
                      Emergency Information
                    </Typography>
                    <Alert severity="error">
                      Call 911 immediately if you experience severe symptoms
                    </Alert>
                  </CardContent>
                </Card>
              </Box>
            </Box>
          </Box>
        ) : (
          // Regular Dashboard for other roles
          <Box>
            {/* Header with registration button for CHV */}
            {user?.role === UserRole.CHV && (
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <Typography variant="h5" gutterBottom>
                  CHV Dashboard
                </Typography>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={() => setShowRegistrationForm(!showRegistrationForm)}
                >
                  {showRegistrationForm ? 'Back to Dashboard' : 'Register New Mother'}
                </Button>
              </Box>
            )}

            {showRegistrationForm && user?.role === UserRole.CHV ? (
              <Box>
                <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
                  Register New Mother
                </Typography>
                <MotherRegistrationForm onSuccess={() => { setShowRegistrationForm(false); }} />
              </Box>
            ) : (
              <Box display="flex" gap={3} flexWrap="wrap">
                {/* Statistics Cards */}
                <Box flex="1" minWidth="250px">
                  <Card>
                    <CardContent>
                      <Box display="flex" alignItems="center" justifyContent="space-between">
                        <Box>
                          <Typography color="textSecondary" gutterBottom>
                            Total Mothers
                          </Typography>
                          <Typography variant="h4">
                            {stats?.total_mothers}
                          </Typography>
                        </Box>
                        <People color="primary" sx={{ fontSize: 40 }} />
                      </Box>
                    </CardContent>
                  </Card>
                </Box>

                <Box flex="1" minWidth="250px">
                  <Card>
                    <CardContent>
                      <Box display="flex" alignItems="center" justifyContent="space-between">
                        <Box>
                          <Typography color="textSecondary" gutterBottom>
                            Total Assessments
                          </Typography>
                          <Typography variant="h4">
                            {stats?.total_assessments}
                          </Typography>
                        </Box>
                        <Assessment color="primary" sx={{ fontSize: 40 }} />
                      </Box>
                    </CardContent>
                  </Card>
                </Box>

                <Box flex="1" minWidth="250px">
                  <Card>
                    <CardContent>
                      <Box display="flex" alignItems="center" justifyContent="space-between">
                        <Box>
                          <Typography color="textSecondary" gutterBottom>
                            High Risk
                          </Typography>
                          <Typography variant="h4" color="error">
                            {stats?.high_risk_count}
                          </Typography>
                        </Box>
                        <Warning color="error" sx={{ fontSize: 40 }} />
                      </Box>
                    </CardContent>
                  </Card>
                </Box>

                <Box flex="1" minWidth="250px">
                  <Card>
                    <CardContent>
                      <Box display="flex" alignItems="center" justifyContent="space-between">
                        <Box>
                          <Typography color="textSecondary" gutterBottom>
                            Low Risk
                          </Typography>
                          <Typography variant="h4" color="success.main">
                            {stats?.low_risk_count}
                          </Typography>
                        </Box>
                        <CheckCircle color="success" sx={{ fontSize: 40 }} />
                      </Box>
                    </CardContent>
                  </Card>
                </Box>

                {/* Recent Assessments */}
                <Box flex="1" minWidth="400px">
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Recent Assessments
                      </Typography>
                      <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
                        {stats && Array.isArray(stats.recent_assessments)
                          ? stats.recent_assessments.slice(0, 5).map((assessment) => (
                            <Box key={assessment.id} sx={{ mb: 2, p: 2, border: '1px solid #e0e0e0', borderRadius: 1 }}>
                              <Box display="flex" justifyContent="space-between" alignItems="center">
                                <Typography variant="body2">
                                  Mother ID: {assessment.mother_id}
                                </Typography>
                                <Chip
                                  label={assessment.risk_level}
                                  color={
                                    assessment.risk_level === 'high' ? 'error' :
                                      assessment.risk_level === 'medium' ? 'warning' : 'success'
                                  }
                                  size="small"
                                />
                              </Box>
                              <Typography variant="caption" color="textSecondary">
                                {new Date(assessment.assessment_date).toLocaleDateString()}
                              </Typography>
                            </Box>
                          ))
                          : null}
                      </Box>
                    </CardContent>
                  </Card>
                </Box>

                {/* Upcoming Appointments */}
                <Box flex="1" minWidth="400px">
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Upcoming Appointments
                      </Typography>
                      <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
                        {stats && Array.isArray(stats.upcoming_appointments)
                          ? stats.upcoming_appointments.slice(0, 5).map((appointment) => (
                            <Box key={appointment.id} sx={{ mb: 2, p: 2, border: '1px solid #e0e0e0', borderRadius: 1 }}>
                              <Box display="flex" justifyContent="space-between" alignItems="center">
                                <Typography variant="body2">
                                  {appointment.reason}
                                </Typography>
                                <Chip
                                  label={appointment.status}
                                  color={
                                    appointment.status === 'confirmed' ? 'success' :
                                      appointment.status === 'scheduled' ? 'primary' : 'default'
                                  }
                                  size="small"
                                />
                              </Box>
                              <Typography variant="caption" color="textSecondary">
                                {new Date(appointment.appointment_date).toLocaleDateString()}
                              </Typography>
                            </Box>
                          ))
                          : null}
                      </Box>
                    </CardContent>
                  </Card>
                </Box>
              </Box>
            )}
          </Box>
        )}
      </Box>
    </ClinicianDashboardProvider>
  );
};

export default Dashboard; 
