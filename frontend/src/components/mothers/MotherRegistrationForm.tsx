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
import { useNavigate } from 'react-router-dom';

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
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(initialState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [motherIdError, setMotherIdError] = useState('');
  const [allMotherIds, setAllMotherIds] = useState<string[]>([]);
  const [existingMotherId, setExistingMotherId] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    // Fetch all mothers for advanced ID validation
    mothersAPI.list(0, 1000).then(res => {
      setAllMotherIds(res.data.map((m: any) => m.id));
    });
  }, []);

  // Validation functions
  const validatePhoneNumber = (phone: string): string => {
    if (!phone) return '';
    // Remove all non-digit characters for validation
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) return 'Phone number must be at least 10 digits';
    if (cleanPhone.length > 15) return 'Phone number must be at most 15 digits';
    if (!/^\+?[\d\s\-()]+$/.test(phone)) return 'Invalid phone number format';
    return '';
  };

  const validateNationalId = (id: string): string => {
    if (!id) return '';
    if (id.length < 5) return 'National ID must be at least 5 characters';
    if (id.length > 20) return 'National ID must be at most 20 characters';
    if (!/^[A-Za-z0-9]+$/.test(id)) return 'National ID must be alphanumeric';
    return '';
  };

  const validateDateOfBirth = (date: string): string => {
    if (!date) return '';
    const dob = new Date(date);
    const today = new Date();
    const minDate = new Date(today.getFullYear() - 60, today.getMonth(), today.getDate());
    const maxDate = new Date(today.getFullYear() - 12, today.getMonth(), today.getDate());

    if (dob > today) return 'Date of birth cannot be in the future';
    if (dob < minDate) return 'Age cannot exceed 60 years';
    if (dob > maxDate) return 'Age must be at least 12 years';
    return '';
  };

  const validateNumericField = (value: string, fieldName: string, min: number = 0, max?: number): string => {
    if (!value) return '';
    const num = parseInt(value);
    if (isNaN(num)) return `${fieldName} must be a number`;
    if (num < min) return `${fieldName} must be at least ${min}`;
    if (max !== undefined && num > max) return `${fieldName} must be at most ${max}`;
    return '';
  };

  const validateGestationalAge = (gestationalAge: string, lmp: string): string => {
    if (!gestationalAge) return '';
    const weeks = parseInt(gestationalAge);
    if (isNaN(weeks)) return 'Gestational age must be a number';
    if (weeks < 1 || weeks > 42) return 'Gestational age must be between 1 and 42 weeks';

    // Cross-validate with LMP if provided
    if (lmp) {
      const lmpDate = new Date(lmp);
      const today = new Date();
      const daysDiff = Math.floor((today.getTime() - lmpDate.getTime()) / (1000 * 60 * 60 * 24));
      const calculatedWeeks = Math.floor(daysDiff / 7);

      if (Math.abs(weeks - calculatedWeeks) > 2) {
        return `Gestational age (${weeks} weeks) doesn't match LMP calculation (${calculatedWeeks} weeks)`;
      }
    }
    return '';
  };

  const validateField = (name: string, value: string): string => {
    switch (name) {
      case 'phone_number':
      case 'next_of_kin_phone':
        return validatePhoneNumber(value);
      case 'national_id':
        return validateNationalId(value);
      case 'date_of_birth':
        return validateDateOfBirth(value);
      case 'gravida':
        return validateNumericField(value, 'Gravida', 0, 20);
      case 'parity':
        return validateNumericField(value, 'Parity', 0, 20);
      case 'living_children':
        return validateNumericField(value, 'Living children', 0, 20);
      case 'gestational_age':
        return validateGestationalAge(value, form.lmp);
      case 'stillbirths':
        return validateNumericField(value, 'Stillbirths', 0, 10);
      case 'miscarriages':
        return validateNumericField(value, 'Miscarriages', 0, 10);
      default:
        return '';
    }
  };

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

      // Validate date of birth
      const dobError = validateDateOfBirth(value);
      setFieldErrors(prev => ({ ...prev, [name]: dobError }));
      return;
    }

    // Auto-calculate EDD from LMP if LMP changes
    if (name === 'lmp' && value) {
      const lmpDate = new Date(value);
      const eddDate = new Date(lmpDate.getTime() + (280 * 24 * 60 * 60 * 1000)); // Add 280 days
      const eddString = eddDate.toISOString().split('T')[0];
      setForm((prev) => ({ ...prev, [name]: value, edd: eddString }));
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }

    // Mother ID validation
    if (name === 'mother_id') {
      if (value && !/^M[a-zA-Z0-9]+$/.test(value)) {
        setMotherIdError('Mother ID must start with "M" and be alphanumeric.');
      } else if (value && allMotherIds.length > 0 && !allMotherIds.includes(value)) {
        setMotherIdError('Mother ID does not exist in the system.');
      } else {
        setMotherIdError('');
      }
    }

    // Real-time field validation
    const fieldError = validateField(name, value);
    setFieldErrors(prev => ({ ...prev, [name]: fieldError }));

    // Cross-validation for gestational age when LMP changes
    if (name === 'lmp' && form.gestational_age) {
      const gestationalError = validateGestationalAge(form.gestational_age, value);
      setFieldErrors(prev => ({ ...prev, gestational_age: gestationalError }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    // Validate all fields before submission
    const newFieldErrors: Record<string, string> = {};

    // Validate required fields
    const requiredFields = [
      'full_name', 'date_of_birth', 'national_id', 'phone_number', 'address',
      'next_of_kin_name', 'next_of_kin_relationship', 'next_of_kin_phone',
      'marital_status', 'education_level', 'occupation',
      'gravida', 'parity', 'living_children',
    ];

    for (const field of requiredFields) {
      if (!form[field as keyof FormState]) {
        newFieldErrors[field] = 'This field is required';
      } else {
        // Validate the field content
        const fieldError = validateField(field, form[field as keyof FormState]);
        if (fieldError) {
          newFieldErrors[field] = fieldError;
        }
      }
    }

    // Validate optional fields that have content
    Object.keys(form).forEach(field => {
      if (!requiredFields.includes(field) && form[field as keyof FormState]) {
        const fieldError = validateField(field, form[field as keyof FormState]);
        if (fieldError) {
          newFieldErrors[field] = fieldError;
        }
      }
    });

    // Validate Mother ID format if provided
    if (form.mother_id && !/^M[a-zA-Z0-9]+$/.test(form.mother_id)) {
      newFieldErrors.mother_id = 'Mother ID must start with "M" and be alphanumeric.';
    }

    // Advanced validation: check if Mother ID exists if provided
    if (form.mother_id && allMotherIds.length > 0 && !allMotherIds.includes(form.mother_id)) {
      newFieldErrors.mother_id = 'Mother ID does not exist in the system.';
    }

    // Check for any validation errors
    if (Object.keys(newFieldErrors).length > 0) {
      setFieldErrors(newFieldErrors);
      setError('Please fix the validation errors before submitting.');
      setLoading(false);
      return;
    }

    try {
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
      };
      const res = await mothersAPI.register(payload);
      if (res.data && res.data.success === false && res.data.error) {
        setError(res.data.error + (res.data.mother_id ? ` (Mother ID: ${res.data.mother_id})` : ''));
        setExistingMotherId(res.data.mother_id || null);
        setLoading(false);
        return;
      }
      setSuccess(`Mother registered successfully! Mother ID: ${res.data.mother_id}. Please proceed to perform the first assessment.`);
      setExistingMotherId(null);
      setForm(initialState);
      setFieldErrors({});
      
      // Navigate to risk assessment with pre-filled data after successful registration
      setTimeout(() => {
        navigate(`/assessment?motherId=${res.data.mother_id}&age=${form.age}&gestationalAge=${form.gestational_age}`);
      }, 2000);
      
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
            <TextField
              id="full_name"
              label="Full Name *"
              name="full_name"
              value={form.full_name}
              onChange={handleChange}
              required
              fullWidth
              autoComplete="name"
              error={!!fieldErrors.full_name}
              helperText={fieldErrors.full_name}
            />
          </Box>
          <Box sx={{ flex: '1 1 300px' }}>
            <TextField
              id="date_of_birth"
              label="Date of Birth *"
              name="date_of_birth"
              type="date"
              value={form.date_of_birth}
              onChange={handleChange}
              required
              fullWidth
              InputLabelProps={{ shrink: true }}
              autoComplete="bday"
              error={!!fieldErrors.date_of_birth}
              helperText={fieldErrors.date_of_birth || (form.age && `Age: ${form.age} years`)}
            />
          </Box>
          <Box sx={{ flex: '1 1 300px' }}>
            <TextField
              id="national_id"
              label="National ID *"
              name="national_id"
              value={form.national_id}
              onChange={handleChange}
              required
              fullWidth
              autoComplete="off"
              error={!!fieldErrors.national_id}
              helperText={fieldErrors.national_id || 'Must be 5-20 alphanumeric characters'}
            />
          </Box>
          <Box sx={{ flex: '1 1 300px' }}>
            <TextField
              id="phone_number"
              label="Phone Number *"
              name="phone_number"
              value={form.phone_number}
              onChange={handleChange}
              required
              fullWidth
              autoComplete="tel"
              error={!!fieldErrors.phone_number}
              helperText={fieldErrors.phone_number || 'Format: +1234567890 or 1234567890'}
              placeholder="+1234567890"
            />
          </Box>
          <Box sx={{ flex: '1 1 100%' }}>
            <TextField
              id="address"
              label="Address *"
              name="address"
              value={form.address}
              onChange={handleChange}
              required
              fullWidth
              autoComplete="street-address"
              error={!!fieldErrors.address}
              helperText={fieldErrors.address}
              multiline
              rows={2}
            />
          </Box>
          <Box sx={{ flex: '1 1 300px' }}>
            <TextField
              id="next_of_kin_name"
              label="Next of Kin Name *"
              name="next_of_kin_name"
              value={form.next_of_kin_name}
              onChange={handleChange}
              required
              fullWidth
              autoComplete="name"
              error={!!fieldErrors.next_of_kin_name}
              helperText={fieldErrors.next_of_kin_name}
            />
          </Box>
          <Box sx={{ flex: '1 1 150px' }}>
            <TextField
              id="next_of_kin_relationship"
              label="Relationship *"
              name="next_of_kin_relationship"
              value={form.next_of_kin_relationship}
              onChange={handleChange}
              required
              fullWidth
              autoComplete="off"
              error={!!fieldErrors.next_of_kin_relationship}
              helperText={fieldErrors.next_of_kin_relationship}
              placeholder="e.g., Spouse, Parent, Sibling"
            />
          </Box>
          <Box sx={{ flex: '1 1 150px' }}>
            <TextField
              id="next_of_kin_phone"
              label="Next of Kin Phone *"
              name="next_of_kin_phone"
              value={form.next_of_kin_phone}
              onChange={handleChange}
              required
              fullWidth
              autoComplete="tel"
              error={!!fieldErrors.next_of_kin_phone}
              helperText={fieldErrors.next_of_kin_phone || 'Emergency contact number'}
              placeholder="+1234567890"
            />
          </Box>
          <Box sx={{ flex: '1 1 300px' }}>
            <TextField
              id="marital_status"
              select
              label="Marital Status *"
              name="marital_status"
              value={form.marital_status}
              onChange={handleChange}
              required
              fullWidth
              autoComplete="off"
              error={!!fieldErrors.marital_status}
              helperText={fieldErrors.marital_status}
            >
              {maritalStatusOptions.map((opt) => <MenuItem key={opt} value={opt}>{opt}</MenuItem>)}
            </TextField>
          </Box>
          <Box sx={{ flex: '1 1 300px' }}>
            <TextField
              id="education_level"
              select
              label="Education Level *"
              name="education_level"
              value={form.education_level}
              onChange={handleChange}
              required
              fullWidth
              autoComplete="off"
              error={!!fieldErrors.education_level}
              helperText={fieldErrors.education_level}
            >
              {educationOptions.map((opt) => <MenuItem key={opt} value={opt}>{opt}</MenuItem>)}
            </TextField>
          </Box>
          <Box sx={{ flex: '1 1 300px' }}>
            <TextField
              id="occupation"
              label="Occupation *"
              name="occupation"
              value={form.occupation}
              onChange={handleChange}
              required
              fullWidth
              autoComplete="organization-title"
              error={!!fieldErrors.occupation}
              helperText={fieldErrors.occupation}
              placeholder="e.g., Teacher, Farmer, Student"
            />
          </Box>
        </Box>

        {/* Obstetric Section */}
        <Typography variant="h6" sx={{ mt: 4 }}>Obstetric History</Typography>
        <Divider sx={{ mb: 2 }} />
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ flex: '1 1 200px' }}>
            <TextField
              id="gravida"
              label="Gravida *"
              name="gravida"
              type="number"
              value={form.gravida}
              onChange={handleChange}
              required
              fullWidth
              autoComplete="off"
              error={!!fieldErrors.gravida}
              helperText={fieldErrors.gravida || 'Total number of pregnancies'}
              inputProps={{ min: 0, max: 20 }}
            />
          </Box>
          <Box sx={{ flex: '1 1 200px' }}>
            <TextField
              id="parity"
              label="Parity *"
              name="parity"
              type="number"
              value={form.parity}
              onChange={handleChange}
              required
              fullWidth
              autoComplete="off"
              error={!!fieldErrors.parity}
              helperText={fieldErrors.parity || 'Number of births ≥20 weeks'}
              inputProps={{ min: 0, max: 20 }}
            />
          </Box>
          <Box sx={{ flex: '1 1 200px' }}>
            <TextField
              id="living_children"
              label="Living Children *"
              name="living_children"
              type="number"
              value={form.living_children}
              onChange={handleChange}
              required
              fullWidth
              autoComplete="off"
              error={!!fieldErrors.living_children}
              helperText={fieldErrors.living_children || 'Number of living children'}
              inputProps={{ min: 0, max: 20 }}
            />
          </Box>
          <Box sx={{ flex: '1 1 300px' }}>
            <TextField
              id="lmp"
              label="Last Menstrual Period (LMP)"
              name="lmp"
              type="date"
              value={form.lmp}
              onChange={handleChange}
              fullWidth
              InputLabelProps={{ shrink: true }}
              autoComplete="off"
              error={!!fieldErrors.lmp}
              helperText={fieldErrors.lmp || 'Used to calculate EDD and gestational age'}
            />
          </Box>
          <Box sx={{ flex: '1 1 300px' }}>
            <TextField
              id="edd"
              label="Expected Date of Delivery (EDD)"
              name="edd"
              type="date"
              value={form.edd}
              onChange={handleChange}
              fullWidth
              InputLabelProps={{ shrink: true }}
              autoComplete="off"
              error={!!fieldErrors.edd}
              helperText={fieldErrors.edd || (form.lmp ? 'Auto-calculated from LMP' : 'Expected delivery date')}
              InputProps={{ readOnly: !!form.lmp }}
            />
          </Box>
          <Box sx={{ flex: '1 1 300px' }}>
            <TextField
              id="gestational_age"
              label="Gestational Age (weeks)"
              name="gestational_age"
              type="number"
              value={form.gestational_age}
              onChange={handleChange}
              fullWidth
              autoComplete="off"
              error={!!fieldErrors.gestational_age}
              helperText={fieldErrors.gestational_age || 'Current pregnancy week (1-42)'}
              inputProps={{ min: 1, max: 42 }}
            />
          </Box>
          <Box sx={{ flex: '1 1 100%' }}>
            <TextField
              id="previous_complications"
              label="Previous Complications"
              name="previous_complications"
              value={form.previous_complications}
              onChange={handleChange}
              fullWidth
              autoComplete="off"
              error={!!fieldErrors.previous_complications}
              helperText={fieldErrors.previous_complications || 'Any complications in previous pregnancies'}
              multiline
              rows={2}
              placeholder="e.g., Pre-eclampsia, Gestational diabetes, C-section"
            />
          </Box>
          <Box sx={{ flex: '1 1 300px' }}>
            <TextField
              id="stillbirths"
              label="Stillbirths"
              name="stillbirths"
              type="number"
              value={form.stillbirths}
              onChange={handleChange}
              fullWidth
              autoComplete="off"
              error={!!fieldErrors.stillbirths}
              helperText={fieldErrors.stillbirths || 'Number of stillbirths'}
              inputProps={{ min: 0, max: 10 }}
            />
          </Box>
          <Box sx={{ flex: '1 1 300px' }}>
            <TextField
              id="miscarriages"
              label="Miscarriages"
              name="miscarriages"
              type="number"
              value={form.miscarriages}
              onChange={handleChange}
              fullWidth
              autoComplete="off"
              error={!!fieldErrors.miscarriages}
              helperText={fieldErrors.miscarriages || 'Number of miscarriages'}
              inputProps={{ min: 0, max: 10 }}
            />
          </Box>
        </Box>

        {/* Medical Section */}
        <Typography variant="h6" sx={{ mt: 4 }}>Medical History</Typography>
        <Divider sx={{ mb: 2 }} />
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ flex: '1 1 100%' }}>
            <TextField
              id="chronic_illnesses"
              label="Chronic Illnesses"
              name="chronic_illnesses"
              value={form.chronic_illnesses}
              onChange={handleChange}
              fullWidth
              autoComplete="off"
              error={!!fieldErrors.chronic_illnesses}
              helperText={fieldErrors.chronic_illnesses || 'e.g., Diabetes, Hypertension, Heart disease'}
              multiline
              rows={2}
              placeholder="List any chronic medical conditions"
            />
          </Box>
          <Box sx={{ flex: '1 1 100%' }}>
            <TextField
              id="allergies"
              label="Allergies"
              name="allergies"
              value={form.allergies}
              onChange={handleChange}
              fullWidth
              autoComplete="off"
              error={!!fieldErrors.allergies}
              helperText={fieldErrors.allergies || 'e.g., Penicillin, Peanuts, Latex'}
              multiline
              rows={2}
              placeholder="List any known allergies"
            />
          </Box>
          <Box sx={{ flex: '1 1 100%' }}>
            <TextField
              id="current_medications"
              label="Current Medications"
              name="current_medications"
              value={form.current_medications}
              onChange={handleChange}
              fullWidth
              autoComplete="off"
              error={!!fieldErrors.current_medications}
              helperText={fieldErrors.current_medications || 'Include dosage and frequency'}
              multiline
              rows={2}
              placeholder="List all current medications and supplements"
            />
          </Box>
          <Box sx={{ flex: '1 1 300px' }}>
            <TextField
              id="blood_group"
              select
              label="Blood Group"
              name="blood_group"
              value={form.blood_group}
              onChange={handleChange}
              fullWidth
              autoComplete="off"
              error={!!fieldErrors.blood_group}
              helperText={fieldErrors.blood_group || 'Important for emergency situations'}
            >
              <MenuItem value="">Select Blood Group</MenuItem>
              {bloodGroupOptions.map((opt) => <MenuItem key={opt} value={opt}>{opt}</MenuItem>)}
            </TextField>
          </Box>
        </Box>

        {/* Social Section */}
        <Typography variant="h6" sx={{ mt: 4 }}>Social History</Typography>
        <Divider sx={{ mb: 2 }} />
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ flex: '1 1 100%' }}>
            <TextField
              id="substance_use"
              label="Substance Use"
              name="substance_use"
              value={form.substance_use}
              onChange={handleChange}
              fullWidth
              autoComplete="off"
              error={!!fieldErrors.substance_use}
              helperText={fieldErrors.substance_use || 'Include smoking, alcohol, drugs - important for pregnancy care'}
              multiline
              rows={2}
              placeholder="e.g., Smoking 5 cigarettes/day, Occasional alcohol"
            />
          </Box>
          <Box sx={{ flex: '1 1 300px' }}>
            <TextField
              id="domestic_violence"
              select
              label="Domestic Violence"
              name="domestic_violence"
              value={form.domestic_violence}
              onChange={handleChange}
              fullWidth
              autoComplete="off"
              error={!!fieldErrors.domestic_violence}
              helperText={fieldErrors.domestic_violence || 'Confidential information for safety planning'}
            >
              <MenuItem value="">Prefer not to answer</MenuItem>
              <MenuItem value="no">No</MenuItem>
              <MenuItem value="yes">Yes</MenuItem>
            </TextField>
          </Box>
        </Box>

        {/* Error message with link to view existing mother if duplicate */}
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
            {existingMotherId && (
              <>
                {' '}
                <a href={`/mothers/${existingMotherId}`} style={{ textDecoration: 'underline', color: '#1976d2' }}>
                  View Existing Mother
                </a>
              </>
            )}
          </Alert>
        )}
        {success && <Alert severity="success" sx={{ mt: 2 }}>{success}</Alert>}

        <Box sx={{ mt: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            * Required fields
          </Typography>
          <Button
            type="submit"
            variant="contained"
            color="primary"
            disabled={loading || Object.keys(fieldErrors).some(key => fieldErrors[key])}
            size="large"
          >
            {loading ? 'Registering...' : 'Register Mother'}
          </Button>
        </Box>
      </form>
    </Paper>
  );
};

export default MotherRegistrationForm;