import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import Dashboard from './components/dashboard/Dashboard';
import AdminDashboard from './components/dashboard/AdminDashboard';
import RiskAssessment from './components/assessment/RiskAssessment';
import MothersList from './components/mothers/MothersList';
import Appointments from './components/appointments/Appointments';
import Medications from './components/medications/Medications';
import SHAPAnalysis from './components/shap/SHAPAnalysis';
import Layout from './components/layout/Layout';
import { ClinicianDashboardProvider } from './components/dashboard/ClinicianDashboardContext';
import ClinicianPatientList from './components/dashboard/ClinicianPatientList';
import ClinicianRiskSummary from './components/dashboard/ClinicianRiskSummary';
import RegisterMotherPage from './components/mothers/RegisterMotherPage';
import { UserRole } from './types';
import './App.css';

// Create a custom theme
const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
      light: '#42a5f5',
      dark: '#1565c0',
    },
    secondary: {
      main: '#dc004e',
      light: '#ff5983',
      dark: '#9a0036',
    },
    background: {
      default: '#f5f5f5',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      fontWeight: 600,
    },
    h5: {
      fontWeight: 600,
    },
    h6: {
      fontWeight: 600,
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 8,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        },
      },
    },
  },
});

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
};

// Public Route Component (redirects to dashboard if already authenticated)
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <>{children}</>;
};

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <Router>
          <div className="App">
            <Routes>
              {/* Public Routes */}
              <Route 
                path="/login" 
                element={
                  <PublicRoute>
                    <Login />
                  </PublicRoute>
                } 
              />
              <Route 
                path="/register" 
                element={
                  <PublicRoute>
                    <Register />
                  </PublicRoute>
                } 
              />
              
              {/* Protected Routes */}
              <Route 
                path="/" 
                element={
                  <ProtectedRoute>
                    <Navigate to="/dashboard" replace />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/dashboard" 
                element={
                  <ProtectedRoute>
                    <ClinicianDashboardProvider>
                      <Layout>
                        <Dashboard />
                      </Layout>
                    </ClinicianDashboardProvider>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/assessment" 
                element={
                  <ProtectedRoute>
                    <Layout>
                      <RiskAssessment />
                    </Layout>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/risk-assessment" 
                element={
                  <ProtectedRoute>
                    <Layout>
                      <RiskAssessment />
                    </Layout>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/mothers" 
                element={
                  <ProtectedRoute>
                    <Layout>
                      <MothersList />
                    </Layout>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/appointments" 
                element={
                  <ProtectedRoute>
                    <Layout>
                      <Appointments />
                    </Layout>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/medications" 
                element={
                  <ProtectedRoute>
                    <Layout>
                      <Medications />
                    </Layout>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/shap" 
                element={
                  <ProtectedRoute>
                    <Layout>
                      <SHAPAnalysis />
                    </Layout>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/patients" 
                element={
                  <ProtectedRoute>
                    <ClinicianDashboardProvider>
                      <Layout>
                        <ClinicianPatientList />
                      </Layout>
                    </ClinicianDashboardProvider>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/risk-summary" 
                element={
                  <ProtectedRoute>
                    <ClinicianDashboardProvider>
                      <Layout>
                        <ClinicianRiskSummary />
                      </Layout>
                    </ClinicianDashboardProvider>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/register-mother" 
                element={
                  <ProtectedRoute>
                    <Layout>
                      <RegisterMotherPage />
                    </Layout>
                  </ProtectedRoute>
                } 
              />
            </Routes>
          </div>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
