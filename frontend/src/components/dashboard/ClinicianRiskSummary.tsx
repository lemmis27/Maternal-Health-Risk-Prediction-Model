import React from 'react';
import { Card, CardContent, Typography, Box, Chip } from '@mui/material';
import { useClinicianDashboard } from './ClinicianDashboardContext';

const ClinicianRiskSummary: React.FC = () => {
  const { patients, summaryStats, getRiskColor } = useClinicianDashboard();

  return (
    <Box sx={{ mt: 2 }}>
      <Card>
        <CardContent>
          <Typography variant="h5" gutterBottom>
            Risk Assessment Summary
          </Typography>
          {patients.length === 0 ? (
            <Typography color="textSecondary">No patients assigned yet</Typography>
          ) : (
            <Box>
              {/* Risk Level Distribution */}
              <Box sx={{ mb: 3, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Chip label={`High Risk: ${summaryStats.highRiskCount}`} color="error" variant="outlined" />
                <Chip label={`Medium Risk: ${summaryStats.mediumRiskCount}`} color="warning" variant="outlined" />
                <Chip label={`Low Risk: ${summaryStats.lowRiskCount}`} color="success" variant="outlined" />
              </Box>
              {/* Recent Assessments */}
              <Typography variant="subtitle1" gutterBottom>Recent Assessments</Typography>
              <Box sx={{ maxHeight: 200, overflow: 'auto', mb: 3 }}>
                {patients.filter(p => p.latest_assessment).slice(0, 5).map((patient) => (
                  <Box key={patient.patient.id} sx={{ mb: 1, p: 1, border: '1px solid #e0e0e0', borderRadius: 1 }}>
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                      <Typography variant="body2">Patient {patient.patient.id}</Typography>
                      <Chip
                        label={patient.latest_assessment?.risk_level?.toUpperCase() || 'N/A'}
                        color={getRiskColor(patient.latest_assessment?.risk_level) as "error" | "warning" | "success" | "default" | "info" | "primary" | "secondary"}
                        size="small"
                      />
                    </Box>
                    <Typography variant="caption" color="textSecondary">
                      {patient.latest_assessment?.assessment_date ? new Date(patient.latest_assessment.assessment_date).toLocaleDateString() : 'N/A'}
                    </Typography>
                  </Box>
                ))}
              </Box>
              {/* Upcoming Appointments */}
              <Typography variant="subtitle1" gutterBottom>Upcoming Appointments</Typography>
              <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
                {patients.filter(p => p.next_appointment).slice(0, 5).map((patient) => (
                  <Box key={patient.patient.id} sx={{ mb: 1, p: 1, border: '1px solid #e0e0e0', borderRadius: 1 }}>
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                      <Typography variant="body2">Patient {patient.patient.id}</Typography>
                      <Chip
                        label={patient.next_appointment?.status || 'N/A'}
                        color={patient.next_appointment?.status === 'confirmed' ? 'success' : 'primary'}
                        size="small"
                      />
                    </Box>
                    <Typography variant="caption" color="textSecondary">
                      {patient.next_appointment?.appointment_date ? new Date(patient.next_appointment.appointment_date).toLocaleDateString() : 'N/A'} - {patient.next_appointment?.reason}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default ClinicianRiskSummary; 