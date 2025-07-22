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
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { dashboardAPI, mothersAPI, assessmentAPI } from '../../services/api';
import { DashboardStats, UserRole } from '../../types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useNavigate } from 'react-router-dom';
import ClinicianDashboard from './ClinicianDashboard';
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
          case UserRole.POLICYMAKER:
            response = await dashboardAPI.getPolicymakerDashboard();
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
        
        {user?.role === UserRole.CLINICIAN ? (
          // Render ClinicianDashboard for CLINICIAN users
          <ClinicianDashboard />
        ) : user?.role === UserRole.PREGNANT_MOTHER ? (
          // Pregnant Mother Dashboard
          <Box>
            <Box display="flex" alignItems="center" gap={2} mb={2}>
              <Typography variant="h6">Your User ID:</Typography>
              <Typography variant="body1" sx={{ fontWeight: 'bold', letterSpacing: 1 }}>{user?.id}</Typography>
              <Button
                size="small"
                variant="outlined"
                startIcon={<ContentCopy />}
                onClick={() => {
                  if (user?.id) {
                    navigator.clipboard.writeText(user.id);
                    setCopySuccess(true);
                    setTimeout(() => setCopySuccess(false), 1500);
                  }
                }}
              >
                Copy
              </Button>
              {copySuccess && <Typography variant="caption" color="success.main">Copied!</Typography>}
              {/* Always show mother ID if available */}
              {motherId && (
                <>
                  <Typography variant="h6" sx={{ ml: 3 }}>Your Mother ID:</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 'bold', letterSpacing: 1 }}>{motherId}</Typography>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<ContentCopy />}
                    onClick={() => {
                      navigator.clipboard.writeText(motherId);
                      setCopySuccess(true);
                      setTimeout(() => setCopySuccess(false), 1500);
                    }}
                  >
                    Copy
                  </Button>
                </>
              )}
            </Box>
            <Alert severity="info" sx={{ mb: 3 }}>
              Welcome, {user.full_name}! This is your maternal health dashboard.
            </Alert>
            
            {/* Show latest risk assessment if available */}
            {latestAssessment && (
              <Box mb={3}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Latest Risk Assessment
                    </Typography>
                    <Box display="flex" alignItems="center" gap={2}>
                      <Chip
                        label={latestAssessment.risk_level?.toUpperCase() || 'N/A'}
                        color={getRiskColor(latestAssessment.risk_level)}
                        size="medium"
                      />
                      <Typography variant="body2" color="textSecondary">
                        {latestAssessment.assessment_date ? new Date(latestAssessment.assessment_date).toLocaleString() : ''}
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Box>
            )}

            {/* Assessment History Chart */}
            {assessmentHistoryData.length > 0 && (
              <Box mb={3}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Assessment History
                    </Typography>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={assessmentHistoryData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis domain={[0, 3]} ticks={[1, 2, 3]} />
                        <Tooltip 
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
                          stroke="#8884d8" 
                          strokeWidth={2}
                          dot={{ fill: '#8884d8', strokeWidth: 2, r: 4 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </Box>
            )}
            
            <Box display="flex" gap={3} flexWrap="wrap">
              <Box flex="1" minWidth="250px">
                <Card>
                  <CardContent>
                    <Box display="flex" alignItems="center" justifyContent="space-between">
                      <Box>
                        <Typography color="textSecondary" gutterBottom>
                          Your Health Status
                        </Typography>
                        <Typography variant="h4" color="success.main">
                          Good
                        </Typography>
                      </Box>
                      <CheckCircle color="success" sx={{ fontSize: 40 }} />
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
                          Next Appointment
                        </Typography>
                        <Typography variant="h4">
                          None Scheduled
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
                          Your CHV
                        </Typography>
                        <Typography variant="h4">
                          Not Assigned
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
                          Your Clinician
                        </Typography>
                        <Typography variant="h4">
                          Not Assigned
                        </Typography>
                      </Box>
                      <People color="primary" sx={{ fontSize: 40 }} />
                    </Box>
                  </CardContent>
                </Card>
              </Box>
            </Box>

            {/* Assessment History Panel */}
            {allAssessments.length > 0 && (
              <Box mt={3}>
                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Timeline />
                      <Typography variant="h6">
                        Assessment History ({allAssessments.length} assessments)
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
                            <TableCell>Systolic BP</TableCell>
                            <TableCell>Diastolic BP</TableCell>
                            <TableCell>Blood Sugar</TableCell>
                            <TableCell>Heart Rate</TableCell>
                            <TableCell>Notes</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {allAssessments.map((assessment) => (
                            <TableRow key={assessment.id}>
                              <TableCell>
                                {new Date(assessment.assessment_date).toLocaleDateString()}
                              </TableCell>
                              <TableCell>
                                <Chip
                                  label={assessment.risk_level?.toUpperCase() || 'N/A'}
                                  color={getRiskColor(assessment.risk_level)}
                                  size="small"
                                />
                              </TableCell>
                              <TableCell>
                                {assessment.confidence ? `${(assessment.confidence * 100).toFixed(1)}%` : 'N/A'}
                              </TableCell>
                              <TableCell>{assessment.systolic_bp} mmHg</TableCell>
                              <TableCell>{assessment.diastolic_bp} mmHg</TableCell>
                              <TableCell>{assessment.blood_sugar} mmol/L</TableCell>
                              <TableCell>{assessment.heart_rate} bpm</TableCell>
                              <TableCell>
                                {assessment.notes ? (
                                  <Typography variant="body2" noWrap sx={{ maxWidth: 150 }}>
                                    {assessment.notes}
                                  </Typography>
                                ) : (
                                  'No notes'
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
            <Box mt={3}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Health Tips for You
                  </Typography>
                  <Box display="flex" gap={2} flexWrap="wrap">
                    <Box flex="1" minWidth="300px">
                      <Typography variant="subtitle1" color="primary" gutterBottom>
                        Nutrition
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        • Eat a balanced diet rich in fruits, vegetables, and whole grains
                        • Take prenatal vitamins as prescribed
                        • Stay hydrated by drinking plenty of water
                      </Typography>
                    </Box>
                    <Box flex="1" minWidth="300px">
                      <Typography variant="subtitle1" color="primary" gutterBottom>
                        Exercise
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        • Engage in moderate exercise like walking or swimming
                        • Avoid high-impact activities
                        • Listen to your body and rest when needed
                      </Typography>
                    </Box>
                    <Box flex="1" minWidth="300px">
                      <Typography variant="subtitle1" color="primary" gutterBottom>
                        Self-Care
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        • Get adequate sleep (7-9 hours per night)
                        • Practice stress-reduction techniques
                        • Attend all scheduled prenatal appointments
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Box>

            {/* Emergency Contact */}
            <Box mt={3}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Emergency Information
                  </Typography>
                  <Alert severity="warning" sx={{ mb: 2 }}>
                    If you experience any of the following, contact your healthcare provider immediately:
                  </Alert>
                  <Box display="flex" gap={2} flexWrap="wrap">
                    <Box flex="1" minWidth="250px">
                      <Typography variant="subtitle2" color="error" gutterBottom>
                        Warning Signs
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        • Severe abdominal pain
                        • Vaginal bleeding
                        • Severe headaches
                        • Swelling in face/hands
                        • Decreased fetal movement
                      </Typography>
                    </Box>
                    <Box flex="1" minWidth="250px">
                      <Typography variant="subtitle2" color="primary" gutterBottom>
                        Emergency Contacts
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        • Your CHV: Not assigned yet
                        • Your Clinician: Not assigned yet
                        • Emergency: 911
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
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