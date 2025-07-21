import React from 'react';
import { Box, Card, CardContent, Typography, CircularProgress, Chip } from '@mui/material';
import { DataGrid, GridColDef, GridToolbar } from '@mui/x-data-grid';
import { PatientData, RiskLevel } from './ClinicianDashboardContext';

interface ClinicianSidebarPanelsProps {
  patients: PatientData[];
  loading: boolean;
  summaryStats: {
    highRiskCount: number;
    mediumRiskCount: number;
    lowRiskCount: number;
  };
  columns: GridColDef[];
  getRiskColor: (riskLevel?: RiskLevel) => string;
}

const ClinicianSidebarPanels: React.FC<ClinicianSidebarPanelsProps> = ({
  patients,
  loading,
  summaryStats,
  columns,
  getRiskColor,
}) => (
  <Box sx={{ p: 1 }}>
    {/* Patient List */}
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Typography variant="subtitle1" gutterBottom>
          Patient List
        </Typography>
        {loading ? (
          <Box display="flex" justifyContent="center" alignItems="center" height={120}>
            <CircularProgress size={24} />
          </Box>
        ) : patients.length > 0 ? (
          <Box sx={{ height: 200 }}>
            <DataGrid
              rows={patients}
              columns={columns}
              getRowId={(row) => row.patient.id}
              initialState={{
                pagination: { paginationModel: { pageSize: 5 } }
              }}
              pageSizeOptions={[5]}
              disableRowSelectionOnClick
              slots={{ toolbar: GridToolbar }}
              slotProps={{
                toolbar: {
                  showQuickFilter: true,
                  quickFilterProps: { debounceMs: 500 },
                },
              }}
              sx={{
                '& .MuiDataGrid-cell:focus': {
                  outline: 'none',
                },
              }}
            />
          </Box>
        ) : (
          <Box display="flex" justifyContent="center" alignItems="center" height={120}>
            <Typography color="textSecondary">No patients found</Typography>
          </Box>
        )}
      </CardContent>
    </Card>

    {/* Risk Assessment Summary */}
    <Card>
      <CardContent>
        <Typography variant="subtitle1" gutterBottom>
          Risk Assessment Summary
        </Typography>
        {patients.length === 0 ? (
          <Typography color="textSecondary">No patients assigned yet</Typography>
        ) : (
          <Box>
            {/* Risk Level Distribution */}
            <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Chip label={`High Risk: ${summaryStats.highRiskCount}`} color="error" variant="outlined" />
              <Chip label={`Medium Risk: ${summaryStats.mediumRiskCount}`} color="warning" variant="outlined" />
              <Chip label={`Low Risk: ${summaryStats.lowRiskCount}`} color="success" variant="outlined" />
            </Box>
            {/* Recent Assessments */}
            <Typography variant="body2" gutterBottom>Recent Assessments</Typography>
            <Box sx={{ maxHeight: 80, overflow: 'auto', mb: 1 }}>
              {patients.filter(p => p.latest_assessment).slice(0, 3).map((patient) => (
                <Box key={patient.patient.id} sx={{ mb: 1, p: 1, border: '1px solid #e0e0e0', borderRadius: 1 }}>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="caption">Patient {patient.patient.id}</Typography>
                    <Chip
                      label={patient.latest_assessment?.risk_level?.toUpperCase() || 'N/A'}
                      color={getRiskColor(patient.latest_assessment?.risk_level) as any}
                      size="small"
                    />
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>
        )}
      </CardContent>
    </Card>
  </Box>
);

export default ClinicianSidebarPanels; 