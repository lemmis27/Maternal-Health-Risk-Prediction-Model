import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  InputAdornment,
  IconButton,
  Tooltip,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
} from '@mui/material';
import {
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Phone as PhoneIcon,
  LocationOn as LocationIcon,
  Person as PersonIcon,
  Assessment as AssessmentIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import { dashboardAPI } from '../../services/api';
import { AdminDashboardData } from '../../types';

const AdminDashboard: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [riskFilter, setRiskFilter] = useState<string>('all');
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await dashboardAPI.getAdminDashboard();
      setDashboardData(response.data);
      setLastUpdated(new Date());
      setError('');
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    // Auto-refresh every 5 minutes
    const interval = setInterval(fetchDashboardData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

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

  const filteredMothers = dashboardData?.mothers.filter(mother => {
    const matchesSearch = mother.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      mother.phone_number.includes(searchTerm) ||
      mother.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRisk = riskFilter === 'all' || mother.current_risk_level === riskFilter;
    const matchesLocation = locationFilter === 'all' || mother.location === locationFilter;
    return matchesSearch && matchesRisk && matchesLocation;
  }) || [];

  const uniqueLocations = Array.from(new Set(dashboardData?.mothers.map(m => m.location) || []));

  if (loading && !dashboardData) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" action={
        <Button onClick={fetchDashboardData}>Retry</Button>
      }>
        {error}
      </Alert>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" gutterBottom>
          Admin Dashboard
        </Typography>
        <Box display="flex" alignItems="center" gap={2}>
          <Typography variant="body2" color="text.secondary">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </Typography>
          <Tooltip title="Refresh Data">
            <IconButton onClick={fetchDashboardData} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Summary Cards */}
      <Box display="flex" flexWrap="wrap" gap={3} sx={{ mb: 4 }}>
        <Box flex="1 1 250px">
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="text.secondary" gutterBottom>
                    Total Mothers
                  </Typography>
                  <Typography variant="h4">
                    {dashboardData?.total_mothers || 0}
                  </Typography>
                </Box>
                <PersonIcon color="primary" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Box>

        <Box flex="1 1 250px">
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="text.secondary" gutterBottom>
                    High Risk Cases
                  </Typography>
                  <Typography variant="h4" color="error.main">
                    {dashboardData?.risk_distribution.high || 0}
                  </Typography>
                </Box>
                <WarningIcon color="error" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Box>

        <Box flex="1 1 250px">
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="text.secondary" gutterBottom>
                    Total Assessments
                  </Typography>
                  <Typography variant="h4">
                    {dashboardData?.total_assessments || 0}
                  </Typography>
                </Box>
                <AssessmentIcon color="primary" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Box>

        <Box flex="1 1 250px">
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="text.secondary" gutterBottom>
                    Recent Registrations
                  </Typography>
                  <Typography variant="h4" color="success.main">
                    {dashboardData?.system_overview.recent_registrations || 0}
                  </Typography>
                </Box>
                <CheckCircleIcon color="success" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Box>
      </Box>

      {/* System Overview */}
      <Box display="flex" flexWrap="wrap" gap={3} sx={{ mb: 4 }}>
        <Box flex="1 1 400px">
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Risk Distribution
              </Typography>
              <Box display="flex" gap={2} flexWrap="wrap">
                <Chip
                  label={`High: ${dashboardData?.risk_distribution.high || 0}`}
                  color="error"
                  variant="outlined"
                />
                <Chip
                  label={`Medium: ${dashboardData?.risk_distribution.medium || 0}`}
                  color="warning"
                  variant="outlined"
                />
                <Chip
                  label={`Low: ${dashboardData?.risk_distribution.low || 0}`}
                  color="success"
                  variant="outlined"
                />
              </Box>
            </CardContent>
          </Card>
        </Box>

        <Box flex="1 1 400px">
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                System Overview
              </Typography>
              <Box display="flex" gap={2} flexWrap="wrap">
                <Chip
                  label={`CHVs: ${dashboardData?.system_overview.active_chvs || 0}`}
                  color="primary"
                  variant="outlined"
                />
                <Chip
                  label={`Clinicians: ${dashboardData?.system_overview.active_clinicians || 0}`}
                  color="primary"
                  variant="outlined"
                />
                <Chip
                  label={`Appointments: ${dashboardData?.system_overview.total_appointments || 0}`}
                  color="secondary"
                  variant="outlined"
                />
              </Box>
            </CardContent>
          </Card>
        </Box>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" flexWrap="wrap" gap={2} alignItems="center">
            <Box flex="1 1 300px">
              <TextField
                fullWidth
                placeholder="Search by name, phone, or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
              />
            </Box>
            <Box flex="1 1 200px">
              <FormControl fullWidth>
                <InputLabel>Risk Level</InputLabel>
                <Select
                  value={riskFilter}
                  label="Risk Level"
                  onChange={(e) => setRiskFilter(e.target.value)}
                >
                  <MenuItem value="all">All Risk Levels</MenuItem>
                  <MenuItem value="high">High Risk</MenuItem>
                  <MenuItem value="medium">Medium Risk</MenuItem>
                  <MenuItem value="low">Low Risk</MenuItem>
                </Select>
              </FormControl>
            </Box>
            <Box flex="1 1 200px">
              <FormControl fullWidth>
                <InputLabel>Location</InputLabel>
                <Select
                  value={locationFilter}
                  label="Location"
                  onChange={(e) => setLocationFilter(e.target.value)}
                >
                  <MenuItem value="all">All Locations</MenuItem>
                  {uniqueLocations.map(location => (
                    <MenuItem key={location} value={location}>{location}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
            <Box flex="1 1 200px">
              <Typography variant="body2" color="text.secondary">
                Showing {filteredMothers.length} of {dashboardData?.total_mothers || 0} mothers
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Mothers Table */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            All Registered Mothers
          </Typography>
          <TableContainer component={Paper} sx={{ maxHeight: 600 }}>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Mother ID</TableCell>
                  <TableCell>Full Name</TableCell>
                  <TableCell>Age</TableCell>
                  <TableCell>Location</TableCell>
                  <TableCell>Phone</TableCell>
                  <TableCell>Risk Level</TableCell>
                  <TableCell>Last Assessment</TableCell>
                  <TableCell>Assigned Staff</TableCell>
                  <TableCell>Registered By</TableCell>
                  <TableCell>Assessments</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredMothers.map((mother) => (
                  <TableRow key={mother.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight="bold">
                        {mother.id}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {mother.full_name}
                      </Typography>
                      {mother.gestational_age && (
                        <Typography variant="caption" color="text.secondary" display="block">
                          {mother.gestational_age} weeks pregnant
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>{mother.age}</TableCell>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1}>
                        <LocationIcon fontSize="small" color="action" />
                        <Typography variant="body2">{mother.location}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1}>
                        <PhoneIcon fontSize="small" color="action" />
                        <Typography variant="body2">{mother.phone_number}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        icon={getRiskIcon(mother.current_risk_level)}
                        label={mother.current_risk_level.toUpperCase()}
                        color={getRiskColor(mother.current_risk_level) as any}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {mother.last_assessment_date ? (
                        <Typography variant="body2">
                          {new Date(mother.last_assessment_date).toLocaleDateString()}
                        </Typography>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          No assessment
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Box>
                        {mother.assigned_chv && (
                          <Typography variant="caption" display="block">
                            CHV: {mother.assigned_chv}
                          </Typography>
                        )}
                        {mother.assigned_clinician && (
                          <Typography variant="caption" display="block">
                            Clinician: {mother.assigned_clinician}
                          </Typography>
                        )}
                        {!mother.assigned_chv && !mother.assigned_clinician && (
                          <Typography variant="caption" color="text.secondary">
                            Not assigned
                          </Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={mother.registered_by}
                        size="small"
                        variant="outlined"
                        color={mother.registered_by === 'CHV' ? 'primary' : 'secondary'}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {mother.total_assessments}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  );
};

export default AdminDashboard;