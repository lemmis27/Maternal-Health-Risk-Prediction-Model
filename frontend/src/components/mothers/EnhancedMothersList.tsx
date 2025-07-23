import React, { useEffect, useState } from 'react';
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
  Avatar,
  Fab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  ToggleButton,
  ToggleButtonGroup,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
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
  Add as AddIcon,
  Visibility as ViewIcon,
  Person as PregnantIcon,
  Assignment as AssignmentIcon,
  ViewList as ViewListIcon,
  ViewModule as ViewModuleIcon,
  Download as DownloadIcon,
  Print as PrintIcon,
} from '@mui/icons-material';
import { mothersAPI, assessmentAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { UserRole } from '../../types';
import MotherRegistrationForm from './MotherRegistrationForm';
import MothersCardView from './MothersCardView';

export interface MotherData {
  id: string;
  full_name: string;
  age: number;
  gestational_age?: number;
  phone_number: string;
  location: string;
  emergency_contact: string;
  assigned_chv?: string;
  assigned_clinician?: string;
  current_risk_level: 'high' | 'medium' | 'low';
  last_assessment_date?: string;
  total_assessments: number;
  created_at?: string;
  user_id: string;
  needs_assessment?: boolean;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`mothers-tabpanel-${index}`}
      aria-labelledby={`mothers-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const EnhancedMothersList: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [mothers, setMothers] = useState<MotherData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [riskFilter, setRiskFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showRegistrationDialog, setShowRegistrationDialog] = useState(false);
  const [selectedMother, setSelectedMother] = useState<MotherData | null>(null);
  const [showMotherDetails, setShowMotherDetails] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [isExporting, setIsExporting] = useState(false);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Auto-switch to card view on mobile
  useEffect(() => {
    if (isMobile && viewMode === 'table') {
      setViewMode('cards');
    }
  }, [isMobile, viewMode]);

  const fetchMothers = async () => {
    try {
      setLoading(true);
      const response = await mothersAPI.listEnhanced({
        search: searchTerm || undefined,
        risk_filter: riskFilter !== 'all' ? riskFilter : undefined,
        status_filter: statusFilter !== 'all' ? statusFilter : undefined,
        limit: 1000
      });

      // Use the enhanced API response directly
      const mothersData: MotherData[] = response.data.mothers.map((mother: any) => ({
        id: mother.id,
        full_name: mother.full_name,
        age: mother.age,
        gestational_age: mother.gestational_age,
        phone_number: mother.phone_number,
        location: mother.location,
        emergency_contact: mother.emergency_contact,
        assigned_chv: mother.assigned_chv,
        assigned_clinician: mother.assigned_clinician,
        current_risk_level: mother.current_risk_level,
        last_assessment_date: mother.last_assessment_date,
        total_assessments: mother.total_assessments,
        created_at: mother.created_at,
        user_id: mother.user_id,
      }));

      setMothers(mothersData);
      setLastUpdated(new Date());
      setError('');
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to load mothers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMothers();
    // Auto-refresh every 5 minutes
    const interval = setInterval(fetchMothers, 5 * 60 * 1000);
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

  const getFilteredMothers = () => {
    let filtered = mothers;

    // Role-based filtering
    if (user?.role === UserRole.CHV) {
      filtered = filtered.filter(m => m.assigned_chv === user.full_name);
    } else if (user?.role === UserRole.CLINICIAN) {
      filtered = filtered.filter(m => m.assigned_clinician === user.full_name);
    }

    // Search filtering
    if (searchTerm) {
      filtered = filtered.filter(mother =>
        mother.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        mother.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        mother.phone_number.includes(searchTerm)
      );
    }

    // Risk level filtering
    if (riskFilter !== 'all') {
      filtered = filtered.filter(mother => mother.current_risk_level === riskFilter);
    }

    // Status filtering
    if (statusFilter === 'needs_assessment') {
      filtered = filtered.filter(mother =>
        !mother.last_assessment_date ||
        (new Date().getTime() - new Date(mother.last_assessment_date).getTime()) > (30 * 24 * 60 * 60 * 1000)
      );
    } else if (statusFilter === 'high_risk') {
      filtered = filtered.filter(mother => mother.current_risk_level === 'high');
    } else if (statusFilter === 'recent') {
      filtered = filtered.filter(mother =>
        mother.created_at &&
        (new Date().getTime() - new Date(mother.created_at).getTime()) < (7 * 24 * 60 * 60 * 1000)
      );
    }

    return filtered;
  };

  const filteredMothers = getFilteredMothers();

  const getStatistics = () => {
    const total = filteredMothers.length;
    const highRisk = filteredMothers.filter(m => m.current_risk_level === 'high').length;
    const mediumRisk = filteredMothers.filter(m => m.current_risk_level === 'medium').length;
    const lowRisk = filteredMothers.filter(m => m.current_risk_level === 'low').length;
    const needsAssessment = filteredMothers.filter(m =>
      !m.last_assessment_date ||
      (new Date().getTime() - new Date(m.last_assessment_date).getTime()) > (30 * 24 * 60 * 60 * 1000)
    ).length;

    return { total, highRisk, mediumRisk, lowRisk, needsAssessment };
  };

  const stats = getStatistics();

  const handleViewMother = (mother: MotherData) => {
    setSelectedMother(mother);
    setShowMotherDetails(true);
  };

  const handleRegistrationSuccess = () => {
    setShowRegistrationDialog(false);
    fetchMothers(); // Refresh the list
  };

  const handleExportCSV = async () => {
    try {
      setIsExporting(true);
      const response = await mothersAPI.exportToCsv({
        search: searchTerm || undefined,
        risk_filter: riskFilter !== 'all' ? riskFilter : undefined,
        status_filter: statusFilter !== 'all' ? statusFilter : undefined,
      });

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      
      // Generate filename with timestamp
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      link.setAttribute('download', `mothers_export_${timestamp}.csv`);
      
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setError('Failed to export data: ' + (err?.response?.data?.detail || err.message));
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading && mothers.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" gutterBottom>
          Mothers Dashboard
        </Typography>
        <Box display="flex" alignItems="center" gap={2}>
          <Typography variant="body2" color="text.secondary">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </Typography>
          
          {/* Action Buttons */}
          <Tooltip title="Export to CSV">
            <IconButton onClick={handleExportCSV} disabled={isExporting}>
              {isExporting ? <CircularProgress size={20} /> : <DownloadIcon />}
            </IconButton>
          </Tooltip>
          
          <Tooltip title="Print">
            <IconButton onClick={handlePrint}>
              <PrintIcon />
            </IconButton>
          </Tooltip>
          
          <Tooltip title="Refresh Data">
            <IconButton onClick={fetchMothers} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          
          {(user?.role === UserRole.CLINICIAN || user?.role === UserRole.CHV) && (
            <Fab
              color="primary"
              aria-label="add"
              size="medium"
              onClick={() => setShowRegistrationDialog(true)}
            >
              <AddIcon />
            </Fab>
          )}
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} action={
          <Button onClick={fetchMothers}>Retry</Button>
        }>
          {error}
        </Alert>
      )}

      {/* Statistics Cards */}
      <Box display="flex" flexWrap="wrap" gap={2} sx={{ mb: 4 }}>
        <Box flex="1 1 200px">
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="text.secondary" gutterBottom>
                    Total Mothers
                  </Typography>
                  <Typography variant="h4">
                    {stats.total}
                  </Typography>
                </Box>
                <PersonIcon color="primary" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Box>

        <Box flex="1 1 200px">
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="text.secondary" gutterBottom>
                    High Risk
                  </Typography>
                  <Typography variant="h4" color="error.main">
                    {stats.highRisk}
                  </Typography>
                </Box>
                <WarningIcon color="error" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Box>

        <Box flex="1 1 200px">
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="text.secondary" gutterBottom>
                    Need Assessment
                  </Typography>
                  <Typography variant="h4" color="warning.main">
                    {stats.needsAssessment}
                  </Typography>
                </Box>
                <AssessmentIcon color="warning" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Box>

        <Box flex="1 1 200px">
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="text.secondary" gutterBottom>
                    Low Risk
                  </Typography>
                  <Typography variant="h4" color="success.main">
                    {stats.lowRisk}
                  </Typography>
                </Box>
                <CheckCircleIcon color="success" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Box>
      </Box>

      {/* Filters and Search */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" flexWrap="wrap" gap={2} alignItems="center" mb={2}>
            <Box flex="1 1 300px">
              <TextField
                fullWidth
                placeholder="Search by name, ID, or phone..."
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
                <InputLabel>Status</InputLabel>
                <Select
                  value={statusFilter}
                  label="Status"
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <MenuItem value="all">All Mothers</MenuItem>
                  <MenuItem value="high_risk">High Risk Only</MenuItem>
                  <MenuItem value="needs_assessment">Needs Assessment</MenuItem>
                  <MenuItem value="recent">Recently Registered</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </Box>

          {/* View Toggle and Results Count */}
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="body2" color="text.secondary">
              Showing {filteredMothers.length} mothers
            </Typography>

            {!isMobile && (
              <ToggleButtonGroup
                value={viewMode}
                exclusive
                onChange={(_, newView) => newView && setViewMode(newView)}
                size="small"
              >
                <ToggleButton value="table">
                  <ViewListIcon />
                  <Typography variant="body2" sx={{ ml: 1 }}>Table</Typography>
                </ToggleButton>
                <ToggleButton value="cards">
                  <ViewModuleIcon />
                  <Typography variant="body2" sx={{ ml: 1 }}>Cards</Typography>
                </ToggleButton>
              </ToggleButtonGroup>
            )}
          </Box>
        </CardContent>
      </Card>

      {/* Mothers List - Table or Card View */}
      {viewMode === 'table' && !isMobile ? (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Mothers List
            </Typography>
            <TableContainer component={Paper} sx={{ maxHeight: 600 }}>
              <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Mother</TableCell>
                    <TableCell>Contact</TableCell>
                    <TableCell>Pregnancy Info</TableCell>
                    <TableCell>Risk Status</TableCell>
                    <TableCell>Last Assessment</TableCell>
                    <TableCell>Assigned Staff</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredMothers.map((mother) => (
                    <TableRow key={mother.id} hover>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={2}>
                          <Avatar sx={{ bgcolor: getRiskColor(mother.current_risk_level) + '.main' }}>
                            <PregnantIcon />
                          </Avatar>
                          <Box>
                            <Typography variant="body1" fontWeight="bold">
                              {mother.full_name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              ID: {mother.id}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" display="block">
                              Age: {mother.age} years
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box>
                          <Box display="flex" alignItems="center" gap={1} mb={1}>
                            <PhoneIcon fontSize="small" color="action" />
                            <Typography variant="body2">{mother.phone_number}</Typography>
                          </Box>
                          <Box display="flex" alignItems="center" gap={1}>
                            <LocationIcon fontSize="small" color="action" />
                            <Typography variant="body2">{mother.location}</Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box>
                          {mother.gestational_age && (
                            <Typography variant="body2" mb={1}>
                              <strong>{mother.gestational_age}</strong> weeks pregnant
                            </Typography>
                          )}
                          <Typography variant="caption" color="text.secondary">
                            Emergency: {mother.emergency_contact}
                          </Typography>
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
                          <Box>
                            <Typography variant="body2">
                              {new Date(mother.last_assessment_date).toLocaleDateString()}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Total: {mother.total_assessments}
                            </Typography>
                          </Box>
                        ) : (
                          <Typography variant="body2" color="warning.main">
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
                        <Box display="flex" gap={1}>
                          <Tooltip title="View Details">
                            <IconButton
                              size="small"
                              onClick={() => handleViewMother(mother)}
                            >
                              <ViewIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="New Assessment">
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => {
                                // Navigate to risk assessment with pre-filled data
                                navigate(`/risk-assessment?motherId=${mother.id}&age=${mother.age}&gestationalAge=${mother.gestational_age || 20}`);
                              }}
                            >
                              <AssignmentIcon />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      ) : (
        <Box>
          <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
            Mothers List
          </Typography>
          <MothersCardView
            mothers={filteredMothers}
            onViewMother={handleViewMother}
            onNewAssessment={(motherId) => {
              const mother = filteredMothers.find(m => m.id === motherId);
              if (mother) {
                navigate(`/risk-assessment?motherId=${mother.id}&age=${mother.age}&gestationalAge=${mother.gestational_age || 20}`);
              }
            }}
          />
        </Box>
      )}

      {/* Empty State */}
      {filteredMothers.length === 0 && !loading && (
        <Card>
          <CardContent>
            <Box
              display="flex"
              flexDirection="column"
              alignItems="center"
              justifyContent="center"
              py={8}
            >
              <PregnantIcon sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No mothers found
              </Typography>
              <Typography variant="body2" color="text.secondary" textAlign="center" mb={3}>
                {searchTerm || riskFilter !== 'all' || statusFilter !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'No mothers have been registered yet'
                }
              </Typography>
              {(user?.role === UserRole.CLINICIAN || user?.role === UserRole.CHV) && (
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => setShowRegistrationDialog(true)}
                >
                  Register First Mother
                </Button>
              )}
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Registration Dialog */}
      <Dialog
        open={showRegistrationDialog}
        onClose={() => setShowRegistrationDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Register New Mother</DialogTitle>
        <DialogContent>
          <MotherRegistrationForm onSuccess={handleRegistrationSuccess} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowRegistrationDialog(false)}>
            Cancel
          </Button>
        </DialogActions>
      </Dialog>

      {/* Mother Details Dialog */}
      <Dialog
        open={showMotherDetails}
        onClose={() => setShowMotherDetails(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Mother Details - {selectedMother?.full_name}
        </DialogTitle>
        <DialogContent>
          {selectedMother && (
            <Box>
              <Box display="flex" flexWrap="wrap" gap={4}>
                <Box flex="1 1 300px">
                  <Typography variant="h6" gutterBottom>Personal Information</Typography>
                  <Typography><strong>Name:</strong> {selectedMother.full_name}</Typography>
                  <Typography><strong>Age:</strong> {selectedMother.age} years</Typography>
                  <Typography><strong>Phone:</strong> {selectedMother.phone_number}</Typography>
                  <Typography><strong>Location:</strong> {selectedMother.location}</Typography>
                  <Typography><strong>Emergency Contact:</strong> {selectedMother.emergency_contact}</Typography>
                </Box>
                <Box flex="1 1 300px">
                  <Typography variant="h6" gutterBottom>Pregnancy Information</Typography>
                  <Typography><strong>Gestational Age:</strong> {selectedMother.gestational_age || 'Not specified'} weeks</Typography>
                  <Typography><strong>Risk Level:</strong>
                    <Chip
                      label={selectedMother.current_risk_level.toUpperCase()}
                      color={getRiskColor(selectedMother.current_risk_level) as any}
                      size="small"
                      sx={{ ml: 1 }}
                    />
                  </Typography>
                  <Typography><strong>Total Assessments:</strong> {selectedMother.total_assessments}</Typography>
                  <Typography><strong>Last Assessment:</strong> {
                    selectedMother.last_assessment_date
                      ? new Date(selectedMother.last_assessment_date).toLocaleDateString()
                      : 'No assessment yet'
                  }</Typography>
                </Box>
              </Box>
              <Box mt={3}>
                <Typography variant="h6" gutterBottom>Assigned Staff</Typography>
                <Typography><strong>CHV:</strong> {selectedMother.assigned_chv || 'Not assigned'}</Typography>
                <Typography><strong>Clinician:</strong> {selectedMother.assigned_clinician || 'Not assigned'}</Typography>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowMotherDetails(false)}>
            Close
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              if (selectedMother) {
                navigate(`/risk-assessment?motherId=${selectedMother.id}&age=${selectedMother.age}&gestationalAge=${selectedMother.gestational_age || 20}`);
                setShowMotherDetails(false);
              }
            }}
          >
            New Assessment
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default EnhancedMothersList;