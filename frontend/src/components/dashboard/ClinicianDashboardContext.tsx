import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { dashboardAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { RiskLevel, UserRole } from '../../types';
import { GridColDef } from '@mui/x-data-grid';

export interface PatientData {
  patient: {
    id: string;
    user_id: string;
    age: number;
    gestational_age?: number;
    previous_pregnancies: number;
    previous_complications?: string;
    emergency_contact: string;
    assigned_chv_id?: string;
    assigned_clinician_id?: string;
  };
  latest_assessment?: {
    id: string;
    assessment_date: string;
    risk_level?: RiskLevel;
    risk_score?: number;
    confidence?: number;
    systolic_bp: number;
    diastolic_bp: number;
    blood_sugar: number;
    heart_rate: number;
    notes?: string;
  };
  next_appointment?: {
    id: string;
    appointment_date: string;
    status: string;
    reason: string;
    notes?: string;
  };
}

interface ClinicianDashboardContextType {
  patients: PatientData[];
  loading: boolean;
  error: string;
  summaryStats: {
    totalPatients: number;
    highRiskCount: number;
    mediumRiskCount: number;
    lowRiskCount: number;
    upcomingAppointments: number;
    recentAssessments: number;
  };
  columns: GridColDef[];
  getRiskColor: (riskLevel?: RiskLevel) => string;
  getRiskIcon: (riskLevel?: RiskLevel) => React.ReactNode;
  fetchPatients: (recentDays?: number | null) => Promise<void>;
}

const ClinicianDashboardContext = createContext<ClinicianDashboardContextType | undefined>(undefined);

export const useClinicianDashboard = () => {
  const ctx = useContext(ClinicianDashboardContext);
  if (!ctx) throw new Error('useClinicianDashboard must be used within ClinicianDashboardProvider');
  return ctx;
};

export { RiskLevel };

export const ClinicianDashboardProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [patients, setPatients] = useState<PatientData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [summaryStats, setSummaryStats] = useState({
    totalPatients: 0,
    highRiskCount: 0,
    mediumRiskCount: 0,
    lowRiskCount: 0,
    upcomingAppointments: 0,
    recentAssessments: 0
  });

  useEffect(() => {
    if (user?.role === UserRole.CLINICIAN) {
      fetchPatients();
    }
    // eslint-disable-next-line
  }, [user]);

  const fetchPatients = async (recentDays?: number | null) => {
    try {
      setLoading(true);
      const response = await dashboardAPI.getClinicianPatients(user!.id, recentDays ?? undefined);
      console.log('Fetched patients data:', response.data); // Debug log
      setPatients(response.data);
      const stats = {
        totalPatients: response.data.length,
        highRiskCount: response.data.filter((p: PatientData) => p.latest_assessment?.risk_level === RiskLevel.HIGH).length,
        mediumRiskCount: response.data.filter((p: PatientData) => p.latest_assessment?.risk_level === RiskLevel.MEDIUM).length,
        lowRiskCount: response.data.filter((p: PatientData) => p.latest_assessment?.risk_level === RiskLevel.LOW).length,
        upcomingAppointments: response.data.filter((p: PatientData) => p.next_appointment).length,
        recentAssessments: response.data.filter((p: PatientData) => p.latest_assessment).length
      };
      setSummaryStats(stats);
    } catch (error: any) {
      console.error('Error fetching patients:', error);
      setError('Failed to fetch patients');
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (riskLevel?: RiskLevel) => {
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

  const getRiskIcon = (riskLevel?: RiskLevel) => {
    switch (riskLevel) {
      case RiskLevel.HIGH:
        return <span style={{ color: 'red' }}>!</span>;
      case RiskLevel.MEDIUM:
        return <span style={{ color: 'orange' }}>!</span>;
      case RiskLevel.LOW:
        return <span style={{ color: 'green' }}>✔</span>;
      default:
        return <span>?</span>;
    }
  };

  const columns: GridColDef[] = [
    {
      field: 'id',
      headerName: 'Patient ID',
      width: 120,
      renderCell: (params: any) => {
        const id = params?.row?.patient?.id;
        const hasAssessment = !!params?.row?.latest_assessment;
        return (
          <span style={{
            fontWeight: hasAssessment ? 'normal' : 'bold',
            color: hasAssessment ? undefined : '#d32f2f', // warning/error color
            display: 'flex',
            alignItems: 'center',
          }}>
            {id}
            {!hasAssessment && (
              <span style={{ marginLeft: 4 }} title="No assessment">
                &#9888;
              </span>
            )}
          </span>
        );
      },
    },
    {
      field: 'age',
      headerName: 'Age',
      width: 80,
      valueGetter: (params: any) => {
        const age = params?.row?.patient?.age;
        return age !== null && age !== undefined ? age : '';
      },
    },
    {
      field: 'gestational_age',
      headerName: 'Gestational Age',
      width: 140,
      valueGetter: (params: any) => {
        const gestationalAge = params?.row?.patient?.gestational_age;
        return gestationalAge !== null && gestationalAge !== undefined ? `${gestationalAge} weeks` : '';
      },
    },
    {
      field: 'risk_level',
      headerName: 'Risk Level',
      width: 120,
      renderCell: (params: any) => {
        const riskLevel = params?.row?.latest_assessment?.risk_level;
        return (
          <span>{riskLevel ? riskLevel.toUpperCase() : ''}</span>
        );
      },
    },
    {
      field: 'assessment_date',
      headerName: 'Last Assessment',
      width: 150,
      valueGetter: (params: any) => {
        const date = params?.row?.latest_assessment?.assessment_date;
        return date ? new Date(date).toLocaleDateString() : '';
      },
    },
    {
      field: 'appointment_date',
      headerName: 'Next Appointment',
      width: 150,
      valueGetter: (params: any) => {
        const date = params?.row?.next_appointment?.appointment_date;
        return date ? new Date(date).toLocaleDateString() : '';
      },
    },
    {
      field: 'confidence',
      headerName: 'Confidence',
      width: 120,
      valueGetter: (params: any) => {
        const confidence = params?.row?.latest_assessment?.confidence;
        return confidence !== null && confidence !== undefined ? `${(confidence * 100).toFixed(1)}%` : '';
      },
    },
  ];

  return (
    <ClinicianDashboardContext.Provider
      value={{
        patients,
        loading,
        error,
        summaryStats,
        columns,
        getRiskColor,
        getRiskIcon,
        fetchPatients,
      }}
    >
      {children}
    </ClinicianDashboardContext.Provider>
  );
}; 