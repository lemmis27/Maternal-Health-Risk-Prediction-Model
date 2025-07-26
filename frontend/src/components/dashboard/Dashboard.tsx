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
import FloatingChatbot from '../chatbot/FloatingChatbot';
import HealthEducationBot from '../chatbot/HealthEducationBot';
import AppointmentSchedulingBot from '../chatbot/AppointmentSchedulingBot';
import MedicationManagementBot from '../chatbot/MedicationManagementBot';

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

  // Generate realistic assessment history data for demonstration
  const generateRealisticAssessmentHistory = () => {
    const data: any[] = [];
    const now = new Date();
    const startDate = new Date(now.getTime() - (6 * 30 * 24 * 60 * 60 * 1000)); // 6 months ago

    // Simulate pregnancy progression with realistic risk patterns
    for (let i = 0; i < 12; i++) {
      const assessmentDate = new Date(startDate.getTime() + (i * 15 * 24 * 60 * 60 * 1000)); // Every 2 weeks
      const gestationalWeek = 12 + (i * 2); // Starting from 12 weeks

      // Risk tends to be lower in second trimester, higher in third
      let baseRisk = 1; // Start with low risk
      if (gestationalWeek > 28) {
        // Third trimester - higher chance of complications
        const rand = Math.random();
        if (rand < 0.2) baseRisk = 3; // 20% high risk
        else if (rand < 0.5) baseRisk = 2; // 30% medium risk
        else baseRisk = 1; // 50% low risk
      } else if (gestationalWeek > 20) {
        // Second trimester - generally lower risk
        const rand = Math.random();
        if (rand < 0.1) baseRisk = 3; // 10% high risk
        else if (rand < 0.25) baseRisk = 2; // 15% medium risk
        else baseRisk = 1; // 75% low risk
      }

      // Generate realistic vital signs based on risk level and gestational age
      const generateVitals = (risk: number, gestationalAge: number) => {
        const baseValues = {
          1: { // Low risk
            systolic: 110 + Math.random() * 15,
            diastolic: 70 + Math.random() * 10,
            bloodSugar: 4.5 + Math.random() * 2,
            heartRate: 70 + Math.random() * 20,
            bodyTemp: 98.0 + Math.random() * 1.5
          },
          2: { // Medium risk
            systolic: 125 + Math.random() * 20,
            diastolic: 80 + Math.random() * 15,
            bloodSugar: 6.5 + Math.random() * 3,
            heartRate: 85 + Math.random() * 25,
            bodyTemp: 98.5 + Math.random() * 2
          },
          3: { // High risk
            systolic: 145 + Math.random() * 25,
            diastolic: 95 + Math.random() * 15,
            bloodSugar: 9.0 + Math.random() * 4,
            heartRate: 100 + Math.random() * 30,
            bodyTemp: 99.0 + Math.random() * 2.5
          }
        };

        // Adjust for gestational age (heart rate increases, BP can increase)
        const gestationalAdjustment = gestationalAge > 28 ? 1.1 : gestationalAge > 20 ? 1.05 : 1.0;
        const values = baseValues[risk as keyof typeof baseValues];

        return {
          systolicBP: Math.round(values.systolic * gestationalAdjustment),
          diastolicBP: Math.round(values.diastolic * gestationalAdjustment),
          bloodSugar: Number((values.bloodSugar).toFixed(1)),
          heartRate: Math.round(values.heartRate * gestationalAdjustment),
          bodyTemp: Number((values.bodyTemp).toFixed(1))
        };
      };

      const vitals = generateVitals(baseRisk, gestationalWeek);
      const riskLabels = { 1: 'low', 2: 'medium', 3: 'high' };
      const confidence = baseRisk === 3 ? 85 + Math.random() * 10 :
        baseRisk === 2 ? 75 + Math.random() * 15 :
          80 + Math.random() * 15;

      data.push({
        date: assessmentDate.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric'
        }),
        fullDate: assessmentDate.toISOString(),
        riskLevel: baseRisk,
        riskLabel: riskLabels[baseRisk as keyof typeof riskLabels],
        confidence: confidence,
        systolicBP: vitals.systolicBP,
        diastolicBP: vitals.diastolicBP,
        bloodSugar: vitals.bloodSugar,
        heartRate: vitals.heartRate,
        bodyTemp: vitals.bodyTemp,
        gestationalAge: gestationalWeek,
        bmi: (22 + Math.random() * 6).toFixed(1), // Realistic BMI range
        riskTrend: i > 0 ?
          (baseRisk > data[i - 1]?.riskLevel ? 'increasing' :
            baseRisk < data[i - 1]?.riskLevel ? 'decreasing' : 'stable') : 'stable'
      });
    }

    return data;
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
            try {
              // Use optimized dashboard API for pregnant mothers
              response = await dashboardAPI.getPregnantMotherDashboard(user.id);
              const dashboardData = response.data;

              if (dashboardData.mother) {
                setMotherId(dashboardData.mother.id);

                if (dashboardData.assessments && dashboardData.assessments.length > 0) {
                  const assessments = dashboardData.assessments;
                  // Sort by assessment_date descending
                  assessments.sort((a: any, b: any) => new Date(b.assessment_date).getTime() - new Date(a.assessment_date).getTime());
                  setLatestAssessment(assessments[0]);
                  setAllAssessments(assessments);

                  // Prepare realistic data for chart with proper trends
                  const chartData = assessments
                    .sort((a: any, b: any) => new Date(a.assessment_date).getTime() - new Date(b.assessment_date).getTime())
                    .map((assessment: any, index: number) => {
                      const riskNumeric = assessment.risk_level === 'high' ? 3 : assessment.risk_level === 'medium' ? 2 : 1;
                      const confidence = assessment.confidence || (0.7 + Math.random() * 0.25); // Realistic confidence range

                      return {
                        date: new Date(assessment.assessment_date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric'
                        }),
                        fullDate: assessment.assessment_date,
                        riskLevel: riskNumeric,
                        riskLabel: assessment.risk_level,
                        confidence: confidence * 100, // Convert to percentage
                        systolicBP: assessment.systolic_bp,
                        diastolicBP: assessment.diastolic_bp,
                        bloodSugar: assessment.blood_sugar,
                        heartRate: assessment.heart_rate,
                        bodyTemp: assessment.body_temp,
                        gestationalAge: assessment.gestational_age,
                        // Add BMI calculation if available
                        bmi: assessment.weight && assessment.height ?
                          (assessment.weight / Math.pow(assessment.height / 100, 2)).toFixed(1) : null,
                        // Risk trend indicator
                        riskTrend: index > 0 ?
                          (riskNumeric > (assessments[index - 1].risk_level === 'high' ? 3 : assessments[index - 1].risk_level === 'medium' ? 2 : 1) ? 'increasing' :
                            riskNumeric < (assessments[index - 1].risk_level === 'high' ? 3 : assessments[index - 1].risk_level === 'medium' ? 2 : 1) ? 'decreasing' : 'stable') : 'stable'
                      };
                    });

                  // If no real data, generate realistic sample data
                  if (chartData.length === 0) {
                    const sampleData = generateRealisticAssessmentHistory();
                    setAssessmentHistoryData(sampleData);
                  } else {
                    setAssessmentHistoryData(chartData);
                  }
                }
              }

              setStats({
                total_mothers: 1,
                total_assessments: dashboardData.assessments?.length || 0,
                high_risk_count: dashboardData.assessments?.filter((a: any) => a.risk_level === 'high').length || 0,
                medium_risk_count: dashboardData.assessments?.filter((a: any) => a.risk_level === 'medium').length || 0,
                low_risk_count: dashboardData.assessments?.filter((a: any) => a.risk_level === 'low').length || 0,
                recent_assessments: dashboardData.assessments || [],
                upcoming_appointments: dashboardData.appointments || []
              });
            } catch (error) {
              console.error('Pregnant mother dashboard error:', error);
              // Fallback to old method if new API not available
              const mothersRes = await mothersAPI.list(0, 100);
              const mother = mothersRes.data.find((m: any) => m.user_id === user.id);
              if (mother) {
                setMotherId(mother.id);
                const assessmentsRes = await assessmentAPI.getByMotherId(mother.id);
                const assessments = assessmentsRes.data;
                if (assessments && assessments.length > 0) {
                  assessments.sort((a: any, b: any) => new Date(b.assessment_date).getTime() - new Date(a.assessment_date).getTime());
                  setLatestAssessment(assessments[0]);
                  setAllAssessments(assessments);
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
            }
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
                      <ResponsiveContainer width="100%" height={400}>
                        <LineChart data={assessmentHistoryData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis
                            dataKey="date"
                            tick={{ fontSize: 12 }}
                            stroke="#666"
                          />
                          <YAxis
                            yAxisId="risk"
                            domain={[0.5, 3.5]}
                            ticks={[1, 2, 3]}
                            tickFormatter={(value) => {
                              const labels = { 1: 'Low', 2: 'Med', 3: 'High' };
                              return labels[value as keyof typeof labels] || value;
                            }}
                            stroke="#1976d2"
                            fontSize={12}
                          />
                          <YAxis
                            yAxisId="vitals"
                            orientation="right"
                            domain={[60, 160]}
                            stroke="#ff5722"
                            fontSize={12}
                          />
                          <RechartsTooltip
                            contentStyle={{
                              backgroundColor: '#fff',
                              border: '1px solid #ccc',
                              borderRadius: '8px',
                              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                            }}
                            formatter={(value: any, name: string) => {
                              if (name === 'riskLevel') {
                                const labels = { 1: 'Low Risk', 2: 'Medium Risk', 3: 'High Risk' };
                                return [labels[value as keyof typeof labels] || value, 'Risk Level'];
                              }
                              if (name === 'confidence') return [`${value.toFixed(1)}%`, 'Confidence'];
                              if (name === 'systolicBP') return [`${value} mmHg`, 'Systolic BP'];
                              if (name === 'diastolicBP') return [`${value} mmHg`, 'Diastolic BP'];
                              if (name === 'heartRate') return [`${value} bpm`, 'Heart Rate'];
                              if (name === 'bloodSugar') return [`${value} mmol/L`, 'Blood Sugar'];
                              if (name === 'bodyTemp') return [`${value}°F`, 'Body Temperature'];
                              if (name === 'gestationalAge') return [`${value} weeks`, 'Gestational Age'];
                              return [value, name];
                            }}
                            labelFormatter={(label) => `Assessment Date: ${label}`}
                          />
                          <Legend
                            wrapperStyle={{ paddingTop: '20px' }}
                            iconType="line"
                          />

                          {/* Primary Risk Level Line */}
                          <Line
                            yAxisId="risk"
                            type="monotone"
                            dataKey="riskLevel"
                            stroke="#1976d2"
                            strokeWidth={4}
                            dot={{
                              fill: '#1976d2',
                              strokeWidth: 2,
                              r: 8,
                              stroke: '#fff'
                            }}
                            activeDot={{
                              r: 10,
                              stroke: '#1976d2',
                              strokeWidth: 2,
                              fill: '#fff'
                            }}
                            name="Risk Level"
                          />

                          {/* Confidence Level */}
                          <Line
                            yAxisId="vitals"
                            type="monotone"
                            dataKey="confidence"
                            stroke="#4caf50"
                            strokeWidth={2}
                            strokeDasharray="8 4"
                            dot={{ fill: '#4caf50', strokeWidth: 1, r: 4 }}
                            name="Confidence %"
                          />

                          {/* Systolic Blood Pressure */}
                          <Line
                            yAxisId="vitals"
                            type="monotone"
                            dataKey="systolicBP"
                            stroke="#e91e63"
                            strokeWidth={2}
                            dot={{ fill: '#e91e63', strokeWidth: 1, r: 3 }}
                            name="Systolic BP"
                          />

                          {/* Heart Rate */}
                          <Line
                            yAxisId="vitals"
                            type="monotone"
                            dataKey="heartRate"
                            stroke="#ff5722"
                            strokeWidth={2}
                            dot={{ fill: '#ff5722', strokeWidth: 1, r: 3 }}
                            name="Heart Rate"
                          />
                        </LineChart>
                      </ResponsiveContainer>

                      {/* Chart Legend and Insights */}
                      <Box mt={2} p={2} bgcolor="#f8f9fa" borderRadius={1}>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          <strong>Chart Insights:</strong>
                        </Typography>
                        <Box display="flex" flexWrap="wrap" gap={2}>
                          <Typography variant="caption" color="text.secondary">
                            • Risk Level: Primary indicator (left axis)
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            • Vital Signs: Secondary indicators (right axis)
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            • Trends show pregnancy progression over time
                          </Typography>
                        </Box>

                        {assessmentHistoryData.length > 1 && (
                          <Box mt={1}>
                            <Typography variant="caption" color="text.secondary">
                              <strong>Latest Trend:</strong> {
                                assessmentHistoryData[assessmentHistoryData.length - 1].riskTrend === 'increasing' ?
                                  '📈 Risk increasing - closer monitoring recommended' :
                                  assessmentHistoryData[assessmentHistoryData.length - 1].riskTrend === 'decreasing' ?
                                    '📉 Risk decreasing - good progress' :
                                    '➡️ Risk stable - continue current care plan'
                              }
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    </CardContent>
                  </Card>
                </Box>
              )}

              {/* AI Health Assistants */}
              <Box>
                <Card sx={{ height: '100%' }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      AI Health Assistants
                    </Typography>
                    <Box display="flex" flexDirection="column" gap={2} mb={3}>
                      <HealthEducationBot 
                        gestationalAge={latestAssessment?.gestational_age || 20}
                        riskLevel={latestAssessment?.risk_level || 'low'}
                        userRole="pregnant_mother"
                      />
                      <AppointmentSchedulingBot
                        motherId={motherId || undefined}
                        riskLevel={latestAssessment?.risk_level || 'low'}
                        lastAssessmentDate={latestAssessment?.assessment_date}
                      />
                      <MedicationManagementBot
                        gestationalAge={latestAssessment?.gestational_age || 20}
                        riskLevel={latestAssessment?.risk_level || 'low'}
                      />
                    </Box>
                  </CardContent>
                </Card>
              </Box>

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
      
      {/* AI Chatbot - Context-aware based on user role */}
      <FloatingChatbot 
        context={user?.role === UserRole.PREGNANT_MOTHER ? 'dashboard' : 'dashboard'}
        contextData={{ userRole: user?.role, stats }}
      />
    </ClinicianDashboardProvider>
  );
};

export default Dashboard; 
