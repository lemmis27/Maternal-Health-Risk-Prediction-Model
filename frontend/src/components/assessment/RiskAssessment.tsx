import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Alert,
  CircularProgress,
  Chip,
  List,
  ListItem,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Autocomplete,
} from '@mui/material';
import { Assessment, Warning, CheckCircle, Event } from '@mui/icons-material';
import { assessmentAPI } from '../../services/api';
import { appointmentAPI } from '../../services/api';
import { mothersAPI } from '../../services/api';
import { usersAPI } from '../../services/api';
import { RiskAssessmentForm, RiskLevel, UserRole, PregnantMother } from '../../types';
import { useAuth } from '../../contexts/AuthContext';

const RiskAssessment: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [motherId, setMotherId] = useState<string | undefined>(undefined);
  const [formData, setFormData] = useState<RiskAssessmentForm>({
    mother_id: '',
    age: 0,
    systolic_bp: 0,
    diastolic_bp: 0,
    blood_sugar: 0,
    body_temp: 0,
    heart_rate: 0,
    gestational_age: 0,
    weight: 0,
    height: 0,
    symptoms: [],
    notes: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [result, setResult] = useState<any>(null);
  const [showAppointmentDialog, setShowAppointmentDialog] = useState(false);
  const [appointmentData, setAppointmentData] = useState({
    appointment_date: '',
    reason: '',
    notes: '',
  });
  const [mothers, setMothers] = useState<PregnantMother[]>([]);
  const [loadingMothers, setLoadingMothers] = useState(false);
  const [clinicians, setClinicians] = useState<any[]>([]);
  const [selectedClinicianId, setSelectedClinicianId] = useState<string>('');

  // Fetch mothers when component loads
  useEffect(() => {
    const fetchMothers = async () => {
      if (user && (user.role === UserRole.CHV || user.role === UserRole.CLINICIAN)) {
        setLoadingMothers(true);
        try {
          const response = await mothersAPI.list(0, 100); // Get all mothers
          setMothers(response.data);
        } catch (error) {
          console.error('Error fetching mothers:', error);
        } finally {
          setLoadingMothers(false);
        }
      }
    };

    fetchMothers();
  }, [user]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const id = params.get('motherId');
    if (id) setMotherId(id);
  }, [location.search]);

  // Auto-fill mother_id in formData if motherId is present and mothers are loaded
  useEffect(() => {
    if (motherId && mothers.length > 0 && !formData.mother_id) {
      const found = mothers.find(m => m.id === motherId);
      if (found) {
        setFormData(prev => ({ ...prev, mother_id: motherId }));
      }
    }
  }, [motherId, mothers, formData.mother_id]);

  // Fetch clinicians for CHV appointment creation
  useEffect(() => {
    if (user && user.role === UserRole.CHV) {
      usersAPI.getClinicians().then((res: any) => {
        setClinicians(res.data);
        if (res.data.length > 0) setSelectedClinicianId(res.data[0].id);
      });
    }
  }, [user && user.role]);

  // Check if user has permission to access risk assessment
  if (!user || (user.role !== UserRole.CHV && user.role !== UserRole.CLINICIAN)) {
    return (
      <Container maxWidth="lg">
        <Alert severity="error" sx={{ mt: 2 }}>
          You do not have permission to access risk assessment. Only CHV and Clinician roles can perform assessments.
        </Alert>
      </Container>
    );
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'symptoms' ? value.split(',').map(s => s.trim()) : value,
    }));
  };

  const handleAppointmentChange = (e: React.ChangeEvent<HTMLInputElement> | any) => {
    const { name, value } = e.target;
    setAppointmentData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const scheduleAppointment = async () => {
    if (!result || !appointmentData.appointment_date || !appointmentData.reason) {
      setError('Please fill in all required appointment fields');
      return;
    }

    try {
      const appointmentPayload = {
        mother_id: formData.mother_id,
        clinician_id: user && user.role === UserRole.CLINICIAN ? user.id : selectedClinicianId,
        chv_id: user && user.role === UserRole.CHV ? user.id : undefined,
        appointment_date: appointmentData.appointment_date,
        reason: appointmentData.reason,
        notes: appointmentData.notes,
      };

      await appointmentAPI.create(appointmentPayload);
      setShowAppointmentDialog(false);
      setAppointmentData({ appointment_date: '', reason: '', notes: '' });
      setError('');
      setSuccess('Appointment scheduled successfully!');
      handleSuccess(); // Redirect after successful appointment
    } catch (error: any) {
      console.error('Appointment scheduling error:', error);
      if (typeof error === 'string') {
        setError(error);
      } else if (error?.response?.data?.detail) {
        setError(String(error.response.data.detail));
      } else if (error?.message) {
        setError(String(error.message));
      } else {
        setError('Failed to schedule appointment');
      }
    }
  };

  const getRecommendedAppointmentDate = (riskLevel: RiskLevel) => {
    const today = new Date();
    switch (riskLevel) {
      case RiskLevel.HIGH:
        return new Date(today.getTime() + 24 * 60 * 60 * 1000); // Tomorrow
      case RiskLevel.MEDIUM:
        return new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000); // Next week
      case RiskLevel.LOW:
        return new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000); // Two weeks
      default:
        return new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    }
  };

  const getAppointmentReason = (riskLevel: RiskLevel) => {
    switch (riskLevel) {
      case RiskLevel.HIGH:
        return 'High Risk Assessment - Immediate Follow-up Required';
      case RiskLevel.MEDIUM:
        return 'Medium Risk Assessment - Follow-up Appointment';
      case RiskLevel.LOW:
        return 'Low Risk Assessment - Routine Check-up';
      default:
        return 'Risk Assessment Follow-up';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);
    setResult(null);

    // Find the selected mother
    const selectedMother = mothers.find(m => m.id === formData.mother_id);

    // Determine chv_id
    let chv_id = null;
    if (user.role === UserRole.CHV) {
      chv_id = user.id;
    } else if (user.role === UserRole.CLINICIAN && selectedMother && selectedMother.assigned_chv_id) {
      chv_id = selectedMother.assigned_chv_id;
    }

    try {
      const payload = {
        ...formData,
        symptoms: Array.isArray(formData.symptoms) ? formData.symptoms.join(', ') : formData.symptoms,
        clinician_id: user.role === UserRole.CLINICIAN ? user.id : undefined,
        chv_id: user.role === UserRole.CHV ? user.id : undefined,
      };
      const response = await assessmentAPI.create(payload);
      setResult(response.data);
      
      // Auto-populate appointment data based on risk level
      const recommendedDate = getRecommendedAppointmentDate(response.data.risk_level);
      setAppointmentData({
        appointment_date: recommendedDate.toISOString().slice(0, 16), // Format for datetime-local input
        reason: getAppointmentReason(response.data.risk_level),
        notes: `Risk Level: ${response.data.risk_level}. ${response.data.recommendations?.join(', ') || ''}`,
      });
    } catch (error: any) {
      console.error('Assessment error:', error);
      // Enhanced error handling for FastAPI validation errors
      if (error?.response?.data?.detail && Array.isArray(error.response.data.detail)) {
        const messages = error.response.data.detail.map((d: any) =>
          d.msg ? `${d.loc?.[1] || 'Field'}: ${d.msg}` : JSON.stringify(d)
        );
        setError(messages.join('\n'));
      } else if (typeof error === 'string') {
        setError(error);
      } else if (error?.response?.data?.detail) {
        setError(typeof error.response.data.detail === 'string'
          ? error.response.data.detail
          : JSON.stringify(error.response.data.detail));
      } else if (error?.message) {
        setError(String(error.message));
      } else {
        setError('Failed to create assessment');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const getRiskColor = (riskLevel: RiskLevel) => {
    switch (riskLevel) {
      case RiskLevel.HIGH:
        return 'error';
      case RiskLevel.MEDIUM:
        return 'warning';
      case RiskLevel.LOW:
        return 'success';
      default:
        return 'default';
    }
  };

  const getRiskIcon = (riskLevel: RiskLevel) => {
    switch (riskLevel) {
      case RiskLevel.HIGH:
        return <Warning color="error" />;
      case RiskLevel.MEDIUM:
        return <Warning color="warning" />;
      case RiskLevel.LOW:
        return <CheckCircle color="success" />;
      default:
        return <Assessment />;
    }
  };

  const handleSuccess = () => {
    navigate('/patients', { replace: true });
    // Optionally, trigger a refresh in the patient list context if needed
  };

  // Define a type for SHAP features
  interface FeatureType {
    feature: string;
    feature_description: string;
    value: number;
    shap_value: number;
    abs_shap_value: number;
    impact: string;
    importance_rank: number;
  }

  return (
    <Container maxWidth="lg">
      <Typography variant="h4" gutterBottom>
        Risk Assessment
      </Typography>

      <Box display="flex" gap={3} flexWrap="wrap">
        <Box flex="1" minWidth="300px">
          <Paper elevation={3} sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Assessment Form
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
            {success && (
              <Alert severity="success" sx={{ mb: 2 }}>
                {success}
              </Alert>
            )}

            <Box component="form" onSubmit={handleSubmit}>
              <Box display="flex" gap={2} flexWrap="wrap">
                <Box flex="1" minWidth="200px">
                  <Autocomplete
                    options={mothers}
                    getOptionLabel={(option) => `${option.id} - ${option.user_id}`}
                    value={mothers.find(m => m.id === formData.mother_id) || null}
                    onChange={(event, newValue) => {
                      setFormData(prev => ({
                        ...prev,
                        mother_id: newValue ? newValue.id : ''
                      }));
                    }}
                    loading={loadingMothers}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        id="mother_select"
                        label="Select Mother"
                        required
                        disabled={isLoading}
                        InputProps={{
                          ...params.InputProps,
                          endAdornment: (
                            <>
                              {loadingMothers ? <CircularProgress color="inherit" size={20} /> : null}
                              {params.InputProps.endAdornment}
                            </>
                          ),
                        }}
                      />
                    )}
                    renderOption={(props, option) => (
                      <Box component="li" {...props}>
                        <Box>
                          <Typography variant="body1">
                            <strong>ID:</strong> {option.id}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            User ID: {option.user_id}
                          </Typography>
                        </Box>
                      </Box>
                    )}
                  />
                </Box>
                <Box flex="1" minWidth="200px">
                  <TextField
                    fullWidth
                    id="age"
                    label="Age"
                    name="age"
                    type="number"
                    value={formData.age}
                    onChange={handleChange}
                    required
                    disabled={isLoading}
                    autoComplete="off"
                  />
                </Box>
                <Box flex="1" minWidth="200px">
                  <TextField
                    fullWidth
                    id="systolic_bp"
                    label="Systolic BP (mmHg)"
                    name="systolic_bp"
                    type="number"
                    value={formData.systolic_bp}
                    onChange={handleChange}
                    required
                    disabled={isLoading}
                    autoComplete="off"
                  />
                </Box>
                <Box flex="1" minWidth="200px">
                  <TextField
                    fullWidth
                    id="diastolic_bp"
                    label="Diastolic BP (mmHg)"
                    name="diastolic_bp"
                    type="number"
                    value={formData.diastolic_bp}
                    onChange={handleChange}
                    required
                    disabled={isLoading}
                    autoComplete="off"
                  />
                </Box>
                <Box flex="1" minWidth="200px">
                  <TextField
                    fullWidth
                    id="blood_sugar"
                    label="Blood Sugar (mmol/L)"
                    name="blood_sugar"
                    type="number"
                    value={formData.blood_sugar}
                    onChange={handleChange}
                    required
                    disabled={isLoading}
                    autoComplete="off"
                  />
                </Box>
                <Box flex="1" minWidth="200px">
                  <TextField
                    fullWidth
                    id="body_temp"
                    label="Body Temperature (°F)"
                    name="body_temp"
                    type="number"
                    value={formData.body_temp}
                    onChange={handleChange}
                    required
                    disabled={isLoading}
                    autoComplete="off"
                  />
                </Box>
                <Box flex="1" minWidth="200px">
                  <TextField
                    fullWidth
                    id="heart_rate"
                    label="Heart Rate (bpm)"
                    name="heart_rate"
                    type="number"
                    value={formData.heart_rate}
                    onChange={handleChange}
                    required
                    disabled={isLoading}
                    autoComplete="off"
                  />
                </Box>
                <Box flex="1" minWidth="200px">
                  <TextField
                    fullWidth
                    id="gestational_age"
                    label="Gestational Age (weeks)"
                    name="gestational_age"
                    type="number"
                    value={formData.gestational_age}
                    onChange={handleChange}
                    required
                    disabled={isLoading}
                    autoComplete="off"
                  />
                </Box>
                <Box flex="1" minWidth="200px">
                  <TextField
                    fullWidth
                    id="weight"
                    label="Weight (kg)"
                    name="weight"
                    type="number"
                    value={formData.weight}
                    onChange={handleChange}
                    required
                    disabled={isLoading}
                    autoComplete="off"
                  />
                </Box>
                <Box flex="1" minWidth="200px">
                  <TextField
                    fullWidth
                    id="height"
                    label="Height (cm)"
                    name="height"
                    type="number"
                    value={formData.height}
                    onChange={handleChange}
                    required
                    disabled={isLoading}
                    autoComplete="off"
                  />
                </Box>
                <Box flex="1" minWidth="200px">
                  <TextField
                    fullWidth
                    id="symptoms"
                    label="Symptoms (comma-separated)"
                    name="symptoms"
                    value={formData.symptoms.join(', ')}
                    onChange={handleChange}
                    disabled={isLoading}
                    autoComplete="off"
                  />
                </Box>
                <Box flex="1" minWidth="200px">
                  <TextField
                    fullWidth
                    id="notes"
                    label="Notes"
                    name="notes"
                    multiline
                    rows={3}
                    value={formData.notes}
                    onChange={handleChange}
                    disabled={isLoading}
                    autoComplete="off"
                  />
                </Box>
                <Box flex="1" minWidth="200px">
                  <Button
                    type="submit"
                    variant="contained"
                    color="primary"
                    fullWidth
                    disabled={isLoading}
                    startIcon={isLoading ? <CircularProgress size={20} /> : <Assessment />}
                  >
                    {isLoading ? 'Assessing...' : 'Assess Risk'}
                  </Button>
                </Box>
              </Box>
            </Box>
          </Paper>
        </Box>

        <Box flex="1" minWidth="300px">
          {result && (
            <Paper elevation={3} sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Assessment Result
              </Typography>
              {(() => {
                // Robustly extract risk level and confidence
                const riskLevel = result.risk_level?.value || result.risk_level || result.prediction?.risk_level || 'N/A';
                const confidenceRaw =
                  typeof result.confidence === 'number' ? result.confidence :
                  typeof result.prediction?.confidence === 'number' ? result.prediction.confidence :
                  (typeof result.confidence === 'string' && !isNaN(Number(result.confidence))) ? Number(result.confidence) :
                  (typeof result.prediction?.confidence === 'string' && !isNaN(Number(result.prediction.confidence))) ? Number(result.prediction.confidence) :
                  undefined;
                const confidence = confidenceRaw !== undefined ? `${(confidenceRaw * 100).toFixed(1)}%` : 'N/A';
                return (
                  <>
                    <Box display="flex" alignItems="center" gap={1} mb={2}>
                      {getRiskIcon(riskLevel)}
                      <Typography variant="h5" color={getRiskColor(riskLevel)}>
                        {riskLevel !== 'N/A' ? `${riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1).toLowerCase()} Risk` : 'Risk'}
                      </Typography>
                    </Box>
                    <Typography variant="body1" paragraph>
                      Confidence: {confidence}
                    </Typography>
                  </>
                );
              })()}
              {Array.isArray(result.recommendations) && result.recommendations.length > 0 && (
                <Box mt={2}>
                  <Typography variant="h6" gutterBottom>
                    Recommendations
                  </Typography>
                  <List dense>
                    {result.recommendations.map((rec: string, idx: number) => (
                      <ListItem key={idx}>
                        <ListItemText primary={rec} />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}
              {result.shap_explanation && Array.isArray(result.shap_explanation.features) && result.shap_explanation.features.length > 0 && (
                <Box mt={2}>
                  <Typography variant="h6" gutterBottom>
                    Key Factors (SHAP Explanation)
                  </Typography>
                  <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                    The following are the top 3 factors that most influenced this risk prediction. Positive impact (▲) increases risk, negative impact (▼) decreases risk. SHAP values show the strength of each factor's contribution.
                  </Typography>
                  <List dense>
                    {(result.shap_explanation.features as FeatureType[])
                      .sort((a: FeatureType, b: FeatureType) => a.importance_rank - b.importance_rank)
                      .slice(0, 3)
                      .map((feature: FeatureType, idx: number) => (
                        <ListItem key={idx}>
                          <ListItemText
                            primary={
                              <Box display="flex" alignItems="center" gap={1}>
                                <strong>{feature.importance_rank}.</strong>
                                <span>{feature.feature}</span>
                                <span style={{ color: feature.impact === 'positive' ? 'green' : 'red', fontWeight: 600 }}>
                                  {feature.impact === 'positive' ? '▲' : '▼'}
                                </span>
                                <span style={{ fontSize: 13, color: '#888' }}>({feature.feature_description})</span>
                              </Box>
                            }
                            secondary={
                              <span>
                                Value: <strong>{feature.value}</strong> &nbsp;|&nbsp; 
                                SHAP: <strong>{feature.shap_value.toFixed(3)}</strong> &nbsp;|&nbsp; 
                                Impact: <span style={{ color: feature.impact === 'positive' ? 'green' : 'red' }}>{feature.impact}</span>
                              </span>
                            }
                          />
                        </ListItem>
                      ))}
                  </List>
                </Box>
              )}
              {user.role === UserRole.CHV && (
                <Box mt={3}>
                  <Typography variant="h6" gutterBottom>
                    Recommended Appointment
                  </Typography>
                  <FormControl fullWidth variant="outlined" margin="normal">
                    <InputLabel id="appointment-date-label">Appointment Date</InputLabel>
                    <Select
                      labelId="appointment-date-label"
                      id="appointment_date"
                      label="Appointment Date"
                      value={appointmentData.appointment_date}
                      onChange={handleAppointmentChange}
                      required
                      disabled={isLoading}
                    >
                      <MenuItem value="">
                        <em>Select a date</em>
                      </MenuItem>
                      <MenuItem value={new Date().toISOString().slice(0, 16)}>Today</MenuItem>
                      <MenuItem value={new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16)}>Tomorrow</MenuItem>
                      <MenuItem value={new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16)}>Next Week</MenuItem>
                      <MenuItem value={new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16)}>Two Weeks</MenuItem>
                    </Select>
                  </FormControl>
                  <TextField
                    fullWidth
                    id="appointment_reason"
                    label="Reason"
                    name="reason"
                    value={appointmentData.reason}
                    onChange={handleAppointmentChange}
                    required
                    disabled={isLoading}
                    margin="normal"
                    autoComplete="off"
                  />
                  <TextField
                    fullWidth
                    id="appointment_notes"
                    label="Notes"
                    name="notes"
                    multiline
                    rows={2}
                    value={appointmentData.notes}
                    onChange={handleAppointmentChange}
                    disabled={isLoading}
                    margin="normal"
                    autoComplete="off"
                  />
                  <Button
                    variant="contained"
                    color="primary"
                    fullWidth
                    disabled={isLoading}
                    startIcon={<Event />}
                    onClick={() => setShowAppointmentDialog(true)}
                  >
                    Schedule Appointment
                  </Button>
                </Box>
              )}
            </Paper>
          )}
        </Box>
      </Box>

      <Dialog open={showAppointmentDialog} onClose={() => setShowAppointmentDialog(false)}>
        <DialogTitle>Schedule Appointment</DialogTitle>
        <DialogContent>
          <Box component="form" onSubmit={(e) => { e.preventDefault(); scheduleAppointment(); }}>
            <FormControl fullWidth variant="outlined" margin="normal">
              <InputLabel id="dialog-appointment-date-label">Appointment Date</InputLabel>
              <Select
                labelId="dialog-appointment-date-label"
                id="dialog_appointment_date"
                label="Appointment Date"
                value={appointmentData.appointment_date}
                onChange={handleAppointmentChange}
                required
                disabled={isLoading}
              >
                <MenuItem value="">
                  <em>Select a date</em>
                </MenuItem>
                <MenuItem value={new Date().toISOString().slice(0, 16)}>Today</MenuItem>
                <MenuItem value={new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16)}>Tomorrow</MenuItem>
                <MenuItem value={new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16)}>Next Week</MenuItem>
                <MenuItem value={new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16)}>Two Weeks</MenuItem>
              </Select>
            </FormControl>
            <TextField
              fullWidth
              id="dialog_reason"
              label="Reason"
              name="reason"
              value={appointmentData.reason}
              onChange={handleAppointmentChange}
              required
              disabled={isLoading}
              margin="normal"
              autoComplete="off"
            />
            <TextField
              fullWidth
              id="dialog_notes"
              label="Notes"
              name="notes"
              multiline
              rows={2}
              value={appointmentData.notes}
              onChange={handleAppointmentChange}
              disabled={isLoading}
              margin="normal"
              autoComplete="off"
            />
            {user.role === UserRole.CHV && (
              <FormControl fullWidth variant="outlined" margin="normal">
                <InputLabel id="clinician-select-label">Assign Clinician</InputLabel>
                <Select
                  labelId="clinician-select-label"
                  id="clinician_select"
                  label="Assign Clinician"
                  value={selectedClinicianId}
                  onChange={e => setSelectedClinicianId(e.target.value)}
                  required
                  disabled={isLoading}
                >
                  {clinicians.map((clinician: any) => (
                    <MenuItem key={clinician.id} value={clinician.id}>
                      {clinician.full_name || clinician.username}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
            <DialogActions>
              <Button onClick={() => setShowAppointmentDialog(false)} disabled={isLoading}>Cancel</Button>
              <Button type="submit" variant="contained" color="primary" disabled={isLoading}>
                {isLoading ? 'Scheduling...' : 'Schedule'}
              </Button>
            </DialogActions>
          </Box>
        </DialogContent>
      </Dialog>
    </Container>
  );
};

export default RiskAssessment; 