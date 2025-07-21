import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  Alert,
  MenuItem,
  Divider,
} from '@mui/material';
import { useAuth } from '../../contexts/AuthContext';
import { mothersAPI } from '../../services/api';
import { usersAPI } from '../../services/api';

const maritalStatusOptions = ['Single', 'Married', 'Divorced', 'Widowed'];
const educationOptions = ['None', 'Primary', 'Secondary', 'Tertiary', 'Other'];
const bloodGroupOptions = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const initialState = {
  // Personal
  full_name: '',
  date_of_birth: '',
  national_id: '',
  phone_number: '',
  address: '',
  next_of_kin_name: '',
  next_of_kin_relationship: '',
  next_of_kin_phone: '',
  marital_status: '',
  education_level: '',
  occupation: '',
  age: '', // Add age to state
  // Obstetric
  gravida: '',
  parity: '',
  living_children: '',
  lmp: '',
  edd: '',
  gestational_age: '',
  previous_complications: '',
  stillbirths: '',
  miscarriages: '',
  // Medical
  chronic_illnesses: '',
  allergies: '',
  current_medications: '',
  blood_group: '',
  // Social
  substance_use: '',
  domestic_violence: '',
  mother_id: '', // Added for existing mother registration
};

type FormState = typeof initialState;

// Update prop type
type MotherRegistrationFormProps = { onSuccess?: (response?: any) => void };

const MotherRegistrationForm: React.FC<MotherRegistrationFormProps> = ({ onSuccess }) => {
  const { user } = useAuth();
  const [form, setForm] = useState<FormState>(initialState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [motherIdError, setMotherIdError] = useState('');
  const [allMotherIds, setAllMotherIds] = useState<string[]>([]);

  useEffect(() => {
    // Fetch all mothers for advanced ID validation
    mothersAPI.list(0, 1000).then(res => {
      setAllMotherIds(res.data.map((m: any) => m.id));
    });
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    // Auto-calculate age if date_of_birth changes
    if (name === 'date_of_birth' && value) {
      const dob = new Date(value);
      const today = new Date();
      let age = today.getFullYear() - dob.getFullYear();
      const m = today.getMonth() - dob.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
        age--;
      }
      setForm((prev) => ({ ...prev, [name]: value, age: age.toString() }));
      return;
    }
    if (name === 'mother_id') {
      // Validate format: starts with 'M' and is alphanumeric, min length 2
      if (value && !/^M[a-zA-Z0-9]+$/.test(value)) {
        setMotherIdError('Mother ID must start with "M" and be alphanumeric.');
      } else if (value && allMotherIds.length > 0 && !allMotherIds.includes(value)) {
        setMotherIdError('Mother ID does not exist in the system.');
      } else {
        setMotherIdError('');
      }
    }
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    // Validate Mother ID format if provided
    if (form.mother_id && !/^M[a-zA-Z0-9]+$/.test(form.mother_id)) {
      setError('Mother ID must start with "M" and be alphanumeric.');
      setLoading(false);
      return;
    }
    // Advanced validation: check if Mother ID exists if provided
    if (form.mother_id && allMotherIds.length > 0 && !allMotherIds.includes(form.mother_id)) {
      setError('Mother ID does not exist in the system.');
      setLoading(false);
      return;
    }
    try {
      // Validate required fields
      const requiredFields = [
        'full_name', 'date_of_birth', 'national_id', 'phone_number', 'address',
        'next_of_kin_name', 'next_of_kin_relationship', 'next_of_kin_phone',
        'marital_status', 'education_level', 'occupation',
        'gravida', 'parity', 'living_children',
      ];
      for (const field of requiredFields) {
        if (!form[field as keyof FormState]) {
          setError('Please fill all required fields.');
          setLoading(false);
          return;
        }
      }
      // Prepare payload
      const payload = {
        ...form,
        mother_id: form.mother_id || undefined,
        age: form.age ? Number(form.age) : undefined,
        gravida: Number(form.gravida),
        parity: Number(form.parity),
        living_children: Number(form.living_children),
        gestational_age: form.gestational_age ? Number(form.gestational_age) : undefined,
        stillbirths: form.stillbirths ? Number(form.stillbirths) : undefined,
        miscarriages: form.miscarriages ? Number(form.miscarriages) : undefined,
        domestic_violence: form.domestic_violence === 'yes' ? true : form.domestic_violence === 'no' ? false : undefined,
        lmp: form.lmp || undefined,
        edd: form.edd || undefined,
        previous_complications: form.previous_complications || undefined,
        chronic_illnesses: form.chronic_illnesses || undefined,
        allergies: form.allergies || undefined,
        current_medications: form.current_medications || undefined,
        blood_group: form.blood_group || undefined,
        substance_use: form.substance_use || undefined,
        // assigned_chv_id removed
      };
      const res = await mothersAPI.register(payload);
      setSuccess('Mother registered successfully!');
      setForm(initialState);
      if (onSuccess) onSuccess(res.data);
    } catch (err: any) {
      // Enhanced error handling for FastAPI validation errors
      if (err?.response?.data?.detail && Array.isArray(err.response.data.detail)) {
        const messages = err.response.data.detail.map((d: any) =>
          d.msg ? `${d.loc?.[1] || 'Field'}: ${d.msg}` : JSON.stringify(d)
        );
        setError(messages.join('\n'));
      } else if (err?.response?.data?.detail) {
        setError(typeof err.response.data.detail === 'string'
          ? err.response.data.detail
          : JSON.stringify(err.response.data.detail));
      } else {
        setError(err?.message || 'Registration failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper sx={{ p: 3, maxWidth: 700, mx: 'auto', mt: 4 }}>
      <Typography variant="h5" gutterBottom>
        Register New Mother
      </Typography>
      <form onSubmit={handleSubmit}>
        {/* Personal Section */}
        <Typography variant="h6" sx={{ mt: 2 }}>Personal Information</Typography>
        <Divider sx={{ mb: 2 }} />
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
          {/* Mother ID field for CHV/Clinician */}
          <Box sx={{ flex: '1 1 300px' }}>
            <TextField
              id="mother_id"
              label="Mother ID (if already registered)"
              name="mother_id"
              value={form.mother_id || ''}
              onChange={handleChange}
              fullWidth
              autoComplete="off"
              error={!!motherIdError}
              FormHelperTextProps={{ style: motherIdError ? { color: 'red' } : {} }}
              helperText={motherIdError || 'Leave blank to auto-generate.'}
            />
          </Box>
          <Box sx={{ flex: '1 1 300px' }}>
            <TextField id="full_name" label="Full Name" name="full_name" value={form.full_name} onChange={handleChange} required fullWidth autoComplete="name" />
          </Box>
          <Box sx={{ flex: '1 1 300px' }}>
            <TextField id="date_of_birth" label="Date of Birth" name="date_of_birth" type="date" value={form.date_of_birth} onChange={handleChange} required fullWidth InputLabelProps={{ shrink: true }} autoComplete="bday" />
          </Box>
          <Box sx={{ flex: '1 1 300px' }}>
            <TextField id="national_id" label="National ID" name="national_id" value={form.national_id} onChange={handleChange} required fullWidth autoComplete="off" />
          </Box>
          <Box sx={{ flex: '1 1 300px' }}>
            <TextField id="phone_number" label="Phone Number" name="phone_number" value={form.phone_number} onChange={handleChange} required fullWidth autoComplete="tel" />
          </Box>
          <Box sx={{ flex: '1 1 100%' }}>
            <TextField id="address" label="Address" name="address" value={form.address} onChange={handleChange} required fullWidth autoComplete="street-address" />
          </Box>
          <Box sx={{ flex: '1 1 300px' }}>
            <TextField id="next_of_kin_name" label="Next of Kin Name" name="next_of_kin_name" value={form.next_of_kin_name} onChange={handleChange} required fullWidth autoComplete="name" />
          </Box>
          <Box sx={{ flex: '1 1 150px' }}>
            <TextField id="next_of_kin_relationship" label="Relationship" name="next_of_kin_relationship" value={form.next_of_kin_relationship} onChange={handleChange} required fullWidth autoComplete="off" />
          </Box>
          <Box sx={{ flex: '1 1 150px' }}>
            <TextField id="next_of_kin_phone" label="Next of Kin Phone" name="next_of_kin_phone" value={form.next_of_kin_phone} onChange={handleChange} required fullWidth autoComplete="tel" />
          </Box>
          <Box sx={{ flex: '1 1 300px' }}>
            <TextField id="marital_status" select label="Marital Status" name="marital_status" value={form.marital_status} onChange={handleChange} required fullWidth autoComplete="off">
              {maritalStatusOptions.map((opt) => <MenuItem key={opt} value={opt}>{opt}</MenuItem>)}
            </TextField>
          </Box>
          <Box sx={{ flex: '1 1 300px' }}>
            <TextField id="education_level" select label="Education Level" name="education_level" value={form.education_level} onChange={handleChange} required fullWidth autoComplete="off">
              {educationOptions.map((opt) => <MenuItem key={opt} value={opt}>{opt}</MenuItem>)}
            </TextField>
          </Box>
          <Box sx={{ flex: '1 1 300px' }}>
            <TextField id="occupation" label="Occupation" name="occupation" value={form.occupation} onChange={handleChange} required fullWidth autoComplete="organization-title" />
          </Box>
        </Box>

        {/* CHV Selection */}
        {/* Removed CHV selection section */}

        {/* Obstetric Section */}
        <Typography variant="h6" sx={{ mt: 4 }}>Obstetric History</Typography>
        <Divider sx={{ mb: 2 }} />
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ flex: '1 1 200px' }}>
            <TextField id="gravida" label="Gravida" name="gravida" type="number" value={form.gravida} onChange={handleChange} required fullWidth autoComplete="off" />
          </Box>
          <Box sx={{ flex: '1 1 200px' }}>
            <TextField id="parity" label="Parity" name="parity" type="number" value={form.parity} onChange={handleChange} required fullWidth autoComplete="off" />
          </Box>
          <Box sx={{ flex: '1 1 200px' }}>
            <TextField id="living_children" label="Living Children" name="living_children" type="number" value={form.living_children} onChange={handleChange} required fullWidth autoComplete="off" />
          </Box>
          <Box sx={{ flex: '1 1 300px' }}>
            <TextField id="lmp" label="Last Menstrual Period (LMP)" name="lmp" type="date" value={form.lmp} onChange={handleChange} fullWidth InputLabelProps={{ shrink: true }} autoComplete="off" />
          </Box>
          <Box sx={{ flex: '1 1 300px' }}>
            <TextField id="edd" label="Expected Date of Delivery (EDD)" name="edd" type="date" value={form.edd} onChange={handleChange} fullWidth InputLabelProps={{ shrink: true }} autoComplete="off" />
          </Box>
          <Box sx={{ flex: '1 1 300px' }}>
            <TextField id="gestational_age" label="Gestational Age (weeks)" name="gestational_age" type="number" value={form.gestational_age} onChange={handleChange} fullWidth autoComplete="off" />
          </Box>
          <Box sx={{ flex: '1 1 300px' }}>
            <TextField id="previous_complications" label="Previous Complications" name="previous_complications" value={form.previous_complications} onChange={handleChange} fullWidth autoComplete="off" />
          </Box>
          <Box sx={{ flex: '1 1 300px' }}>
            <TextField id="stillbirths" label="Stillbirths" name="stillbirths" type="number" value={form.stillbirths} onChange={handleChange} fullWidth autoComplete="off" />
          </Box>
          <Box sx={{ flex: '1 1 300px' }}>
            <TextField id="miscarriages" label="Miscarriages" name="miscarriages" type="number" value={form.miscarriages} onChange={handleChange} fullWidth autoComplete="off" />
          </Box>
        </Box>

        {/* Medical Section */}
        <Typography variant="h6" sx={{ mt: 4 }}>Medical History</Typography>
        <Divider sx={{ mb: 2 }} />
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ flex: '1 1 300px' }}>
            <TextField id="chronic_illnesses" label="Chronic Illnesses" name="chronic_illnesses" value={form.chronic_illnesses} onChange={handleChange} fullWidth autoComplete="off" />
          </Box>
          <Box sx={{ flex: '1 1 300px' }}>
            <TextField id="allergies" label="Allergies" name="allergies" value={form.allergies} onChange={handleChange} fullWidth autoComplete="off" />
          </Box>
          <Box sx={{ flex: '1 1 300px' }}>
            <TextField id="current_medications" label="Current Medications" name="current_medications" value={form.current_medications} onChange={handleChange} fullWidth autoComplete="off" />
          </Box>
          <Box sx={{ flex: '1 1 300px' }}>
            <TextField id="blood_group" select label="Blood Group" name="blood_group" value={form.blood_group} onChange={handleChange} fullWidth autoComplete="off">
              {bloodGroupOptions.map((opt) => <MenuItem key={opt} value={opt}>{opt}</MenuItem>)}
            </TextField>
          </Box>
        </Box>

        {/* Social Section */}
        <Typography variant="h6" sx={{ mt: 4 }}>Social History</Typography>
        <Divider sx={{ mb: 2 }} />
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ flex: '1 1 300px' }}>
            <TextField id="substance_use" label="Substance Use (smoking, alcohol, etc.)" name="substance_use" value={form.substance_use} onChange={handleChange} fullWidth autoComplete="off" />
          </Box>
          <Box sx={{ flex: '1 1 300px' }}>
            <TextField id="domestic_violence" select label="Domestic Violence" name="domestic_violence" value={form.domestic_violence} onChange={handleChange} fullWidth autoComplete="off">
              <MenuItem value="">Unknown</MenuItem>
              <MenuItem value="yes">Yes</MenuItem>
              <MenuItem value="no">No</MenuItem>
            </TextField>
          </Box>
        </Box>

        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mt: 2 }}>{success}</Alert>}

        <Box sx={{ mt: 4, display: 'flex', justifyContent: 'flex-end' }}>
          <Button type="submit" variant="contained" color="primary" disabled={loading}>
            {loading ? 'Registering...' : 'Register Mother'}
          </Button>
        </Box>
      </form>
    </Paper>
  );
};

export default MotherRegistrationForm; 