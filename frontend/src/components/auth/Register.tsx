import React, { useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Link,
  Alert,
  CircularProgress,
  InputAdornment,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { Visibility, VisibilityOff, ArrowBack } from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { RegisterForm, UserRole } from '../../types';

const Register: React.FC = () => {
  const navigate = useNavigate();
  const { registerWithoutLogin } = useAuth();
  const [formData, setFormData] = useState<RegisterForm>({
    username: '',
    email: '',
    password: '',
    full_name: '',
    role: UserRole.PREGNANT_MOTHER,
    phone_number: '',
    location: '',
    mother_id: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | { name?: string; value: unknown }>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name as string]: value,
    }));
  };

  const handleSelectChange = (e: any) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Basic validation
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long');
      setIsLoading(false);
      return;
    }

    // Phone number validation
    const phoneRegex = /^\+?\d{10,15}$/;
    if (!phoneRegex.test(formData.phone_number)) {
      setError('Please enter a valid phone number (10-15 digits, can start with +)');
      setIsLoading(false);
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address');
      setIsLoading(false);
      return;
    }

    // Username validation
    if (formData.username.length < 3) {
      setError('Username must be at least 3 characters long');
      setIsLoading(false);
      return;
    }

    // Full name validation
    if (formData.full_name.length < 2) {
      setError('Full name must be at least 2 characters long');
      setIsLoading(false);
      return;
    }

    // Location validation
    if (formData.location.length < 2) {
      setError('Location must be at least 2 characters long');
      setIsLoading(false);
      return;
    }

    try {
      await registerWithoutLogin(formData);
      // Redirect to login page with success message
      navigate('/login', { 
        state: { 
          message: 'Account created successfully! Please sign in with your credentials.' 
        } 
      });
    } catch (error: any) {
      // Enhanced error handling for FastAPI validation errors
      if (error?.response?.data?.detail && Array.isArray(error.response.data.detail)) {
        const messages = error.response.data.detail.map((d: any) =>
          d.msg ? `${d.loc?.[1] || 'Field'}: ${d.msg}` : JSON.stringify(d)
        );
        setError(messages.join('\n'));
      } else if (error?.response?.data?.detail) {
        setError(typeof error.response.data.detail === 'string'
          ? error.response.data.detail
          : JSON.stringify(error.response.data.detail));
      } else {
        setError(error.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container component="main" maxWidth="xs">
      <Box
        sx={{
          marginTop: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        {/* Back Button */}
        <Box sx={{ width: '100%', mb: 2 }}>
          <Button
            startIcon={<ArrowBack />}
            onClick={() => navigate('/login')}
            sx={{ color: 'text.secondary' }}
          >
            Back to Login
          </Button>
        </Box>
        
        <Paper
          elevation={3}
          sx={{
            padding: 4,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: '100%',
          }}
        >
          <Typography component="h1" variant="h4" gutterBottom>
            Maternal Health Risk Prediction
          </Typography>
          <Typography component="h2" variant="h6" color="textSecondary" gutterBottom>
            Create Account
          </Typography>

          {error && (
            <Alert severity="error" sx={{ width: '100%', mb: 2 }}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1, width: '100%' }}>
            <TextField
              margin="normal"
              required
              fullWidth
              id="username"
              label="Username"
              name="username"
              autoComplete="username"
              value={formData.username}
              onChange={handleChange}
              disabled={isLoading}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              id="email"
              label="Email Address"
              name="email"
              autoComplete="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              disabled={isLoading}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              name="password"
              label="Password"
              type={showPassword ? 'text' : 'password'}
              id="password"
              autoComplete="new-password"
              value={formData.password}
              onChange={handleChange}
              disabled={isLoading}
              helperText="Password must be at least 6 characters long"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="toggle password visibility"
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              id="full_name"
              label="Full Name"
              name="full_name"
              autoComplete="name"
              value={formData.full_name}
              onChange={handleChange}
              disabled={isLoading}
            />
            <FormControl fullWidth margin="normal" required>
              <InputLabel id="role-label">Role</InputLabel>
              <Select
                labelId="role-label"
                id="role"
                name="role"
                value={formData.role}
                label="Role"
                onChange={handleSelectChange}
                disabled={isLoading}
                autoComplete="off"
              >
                <MenuItem value={UserRole.PREGNANT_MOTHER}>Pregnant Mother</MenuItem>
                <MenuItem value={UserRole.CHV}>Community Health Volunteer</MenuItem>
                <MenuItem value={UserRole.CLINICIAN}>Clinician</MenuItem>
                <MenuItem value={UserRole.ADMIN}>Admin</MenuItem>
              </Select>
            </FormControl>
            <TextField
              margin="normal"
              required
              fullWidth
              id="phone_number"
              label="Phone Number"
              name="phone_number"
              autoComplete="tel"
              value={formData.phone_number}
              onChange={handleChange}
              disabled={isLoading}
              helperText="Enter 10-15 digits (e.g., 1234567890 or +1234567890)"
              inputProps={{
                pattern: "^\\+?\\d{10,15}$"
              }}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              id="location"
              label="Location"
              name="location"
              autoComplete="address"
              value={formData.location}
              onChange={handleChange}
              disabled={isLoading}
            />
            {formData.role === UserRole.PREGNANT_MOTHER && (
              <TextField
                margin="normal"
                fullWidth
                id="mother_id"
                label="Mother ID (Optional)"
                name="mother_id"
                value={formData.mother_id}
                onChange={handleChange}
                disabled={isLoading}
                helperText="Enter a custom mother ID or leave blank to auto-generate"
                autoComplete="off"
              />
            )}
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2 }}
              disabled={isLoading}
            >
              {isLoading ? <CircularProgress size={24} /> : 'Create Account'}
            </Button>
            <Box sx={{ textAlign: 'center' }}>
              <Link component={RouterLink} to="/login" variant="body2">
                {"Already have an account? Sign In"}
              </Link>
            </Box>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
};

export default Register; 