export enum UserRole {
  PREGNANT_MOTHER = 'pregnant_mother',
  CHV = 'chv',
  CLINICIAN = 'clinician',
  POLICYMAKER = 'policymaker',
}

export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

export enum AppointmentStatus {
  SCHEDULED = 'scheduled',
  CONFIRMED = 'confirmed',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export interface User {
  id: string;
  username: string;
  email: string;
  full_name: string;
  role: UserRole;
  phone_number: string;
  location: string;
  created_at: string;
  is_active: boolean;
}

export interface PregnantMother {
  id: string;
  user_id: string;
  age: number;
  gestational_age?: number;
  previous_pregnancies: number;
  previous_complications: string[];
  emergency_contact: string;
  assigned_chv_id?: string;
  assigned_clinician_id?: string;
  created_at: string;
  updated_at: string;
}

export interface RiskAssessment {
  id: string;
  mother_id: string;
  chv_id: string;
  assessment_date: string;
  age: number;
  systolic_bp: number;
  diastolic_bp: number;
  blood_sugar: number;
  body_temp: number;
  heart_rate: number;
  gestational_age: number;
  weight: number;
  height: number;
  symptoms: string[];
  notes?: string;
  bmi?: number;
  risk_level?: RiskLevel;
  risk_score?: number;
  confidence?: number;
  recommendations: string[];
  explanation?: SHAPExplanation[];
}

export interface SHAPExplanation {
  feature: string;
  feature_description?: string;
  value: number;
  shap_value: number;
  abs_shap_value: number;
  impact: 'positive' | 'negative';
  importance_rank: number;
}

export interface SHAPSummary {
  top_contributing_features: SHAPExplanation[];
  positive_contributors: SHAPExplanation[];
  negative_contributors: SHAPExplanation[];
  total_positive_impact: number;
  total_negative_impact: number;
  most_important_feature: SHAPExplanation;
  explanation_quality: 'high' | 'medium' | 'low';
}

export interface Appointment {
  id: string;
  mother_id: string;
  clinician_id: string;
  chv_id?: string;
  appointment_date: string;
  status: AppointmentStatus;
  reason: string;
  notes?: string;
  created_at: string;
}

export interface Medication {
  id: string;
  mother_id: string;
  clinician_id: string;
  medication_name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
  prescribed_at: string;
}

export interface DashboardStats {
  total_mothers: number;
  total_assessments: number;
  high_risk_count: number;
  medium_risk_count: number;
  low_risk_count: number;
  recent_assessments: RiskAssessment[];
  upcoming_appointments: Appointment[];
}

export interface ModelStatus {
  status: 'loaded' | 'loading' | 'error';
  model_version: string;
  last_updated: string;
  features: string[];
  performance_metrics: {
    accuracy: number;
    precision: number;
    recall: number;
    f1_score: number;
  };
}

export interface GlobalFeatureImportance {
  features: Array<{
    name: string;
    importance: number;
    description: string;
  }>;
  summary_stats: {
    total_features: number;
    mean_importance: number;
    std_importance: number;
  };
}

export interface PerformanceStats {
  total_requests: number;
  average_response_time: number;
  cache_hit_rate: number;
  error_rate: number;
  active_users: number;
}

export interface LoginForm {
  username: string;
  password: string;
}

export interface RegisterForm {
  username: string;
  email: string;
  password: string;
  full_name: string;
  role: UserRole;
  phone_number: string;
  location: string;
  mother_id?: string;
}

export interface RiskAssessmentForm {
  mother_id: string;
  age: number;
  systolic_bp: number;
  diastolic_bp: number;
  blood_sugar: number;
  body_temp: number;
  heart_rate: number;
  gestational_age: number;
  weight: number;
  height: number;
  symptoms: string[];
  notes?: string;
}

export interface AppointmentForm {
  mother_id: string;
  clinician_id: string;
  chv_id?: string;
  appointment_date: string;
  reason: string;
  notes?: string;
}

export interface MedicationForm {
  mother_id: string;
  clinician_id: string;
  medication_name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
} 