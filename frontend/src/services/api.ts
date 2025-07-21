import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (username: string, password: string) => {
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);
    return api.post('/auth/login', formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
  },
  
  register: (userData: any) =>
    api.post('/auth/register', userData),
  
  refresh: (refreshToken: string) => {
    const formData = new URLSearchParams();
    formData.append('refresh_token', refreshToken);
    return api.post('/auth/refresh', formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
  },
  
  getCurrentUser: () =>
    api.get('/users/me'),
};

// Mothers API
export const mothersAPI = {
  register: (motherData: any) =>
    api.post('/mothers/register', motherData),
  
  list: (skip: number = 0, limit: number = 10) =>
    api.get(`/mothers/?skip=${skip}&limit=${limit}`),

  update: (motherId: string, motherData: any) =>
    api.put(`/mothers/${motherId}`, motherData),
};

// Risk Assessment API
export const assessmentAPI = {
  create: (assessmentData: any) =>
    api.post('/assessments/create', assessmentData),
  
  getByMotherId: (motherId: string) =>
    api.get(`/assessments/${motherId}`),
  
  createBulk: (assessments: any[]) =>
    api.post('/assessments/bulk', assessments),
};

// Appointments API
export const appointmentAPI = {
  create: (appointmentData: any) =>
    api.post('/appointments/create', appointmentData),
  
  getByClinician: (clinicianId: string) =>
    api.get(`/appointments/clinician/${clinicianId}`),
};

// Medications API
export const medicationAPI = {
  prescribe: (medicationData: any) =>
    api.post('/medications/prescribe', medicationData),
};

// Dashboard API
export const dashboardAPI = {
  getCHVDashboard: (chvId: string) =>
    api.get(`/dashboard/chv/${chvId}`),
  
  getClinicianDashboard: (clinicianId: string) =>
    api.get(`/dashboard/clinician/${clinicianId}`),
  
  getPolicymakerDashboard: () =>
    api.get('/dashboard/policymaker'),
  
  getClinicianPatients: (clinicianId: string, recentDays?: number) =>
    api.get(`/clinician/${clinicianId}/patients${recentDays ? `?recent_days=${recentDays}` : ''}`),
};

// Model API
export const modelAPI = {
  getStatus: () =>
    api.get('/model/status'),
  
  testPrediction: (features: any) =>
    api.post('/model/test', features),
};

// SHAP API
export const shapAPI = {
  getGlobalImportance: (sampleSize: number = 50) =>
    api.get(`/shap/global?sample_size=${sampleSize}`),
  
  getSummaryPlot: (sampleSize: number = 30) =>
    api.get(`/shap/summary-plot?sample_size=${sampleSize}`),
  
  getForcePlot: (features: any) =>
    api.post('/shap/force-plot', features),
  
  getExplanation: (features: any) =>
    api.post('/shap/explanation', features),
  
  getExplanationSummary: (features: any) =>
    api.post('/shap/explanation-summary', features),
  
  getComprehensiveAnalysis: (features: any) =>
    api.post('/shap/comprehensive', features),
  
  getModelInfo: () =>
    api.get('/shap/model-info'),
  
  getPerformanceStats: () =>
    api.get('/shap/performance'),
};

// Performance API
export const performanceAPI = {
  getStats: () =>
    api.get('/performance/stats'),
  
  getEndpointPerformance: () =>
    api.get('/performance/endpoints'),
  
  getCachePerformance: () =>
    api.get('/performance/cache'),
};

// Cache API
export const cacheAPI = {
  getHealth: () =>
    api.get('/cache/health'),
  
  getStats: () =>
    api.get('/cache/stats'),
};

// Users API
export const usersAPI = {
  getCHVs: () => api.get('/users/chvs'),
  getClinicians: () => api.get('/users/clinicians'),
};

export default api; 