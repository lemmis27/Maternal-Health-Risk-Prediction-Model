import React, { useEffect, useState } from 'react';
import { Card, CardContent, Typography, Box, CircularProgress, IconButton, Tooltip, Button, Switch, FormControlLabel, TextField, MenuItem, Select, InputLabel, Chip } from '@mui/material';
import { DataGrid, GridToolbar, GridColDef } from '@mui/x-data-grid';
import { useClinicianDashboard } from './ClinicianDashboardContext';
import { useNavigate, useLocation } from 'react-router-dom';
import AssessmentIcon from '@mui/icons-material/Assessment';
import PushPinIcon from '@mui/icons-material/PushPin';

const ClinicianPatientList: React.FC = () => {
  const { patients, loading, columns, fetchPatients } = useClinicianDashboard();
  const navigate = useNavigate();
  const location = useLocation();
  const [showRecentOnly, setShowRecentOnly] = useState(true);
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState('');
  const [pinned, setPinned] = useState<string[]>(() => {
    const saved = localStorage.getItem('pinnedPatients');
    return saved ? JSON.parse(saved) : [];
  });

  const handlePin = (id: string) => {
    let updated;
    if (pinned.includes(id)) {
      updated = pinned.filter((pid) => pid !== id);
    } else {
      updated = [...pinned, id];
    }
    setPinned(updated);
    localStorage.setItem('pinnedPatients', JSON.stringify(updated));
  };

  useEffect(() => {
    fetchPatients(showRecentOnly ? 90 : null);
    // eslint-disable-next-line
  }, [location.pathname, showRecentOnly]);

  // Filter patients client-side
  const filteredPatients = patients.filter((p) => {
    const idMatch = p.patient.id.toLowerCase().includes(search.toLowerCase());
    const nameMatch = (p.patient.user_id || '').toLowerCase().includes(search.toLowerCase());
    const riskMatch = riskFilter ? (p.latest_assessment?.risk_level === riskFilter) : true;
    return (idMatch || nameMatch) && riskMatch;
  });

  const getActivityBadge = (patient: any) => {
    const createdAt = patient.patient.created_at ? new Date(patient.patient.created_at) : null;
    const now = new Date();
    const latestAssessmentDate = patient.latest_assessment?.assessment_date ? new Date(patient.latest_assessment.assessment_date) : null;
    const daysSinceRegistration = createdAt ? (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24) : null;
    const daysSinceAssessment = latestAssessmentDate ? (now.getTime() - latestAssessmentDate.getTime()) / (1000 * 60 * 60 * 24) : null;
    if (!patient.latest_assessment && daysSinceRegistration !== null && daysSinceRegistration <= 7) {
      return <Chip label="New" color="primary" size="small" sx={{ mr: 0.5 }} />;
    }
    if (daysSinceAssessment !== null && daysSinceAssessment <= 90) {
      return <Chip label="Recently Assessed" color="success" size="small" sx={{ mr: 0.5 }} />;
    }
    if (!patient.latest_assessment || (daysSinceAssessment !== null && daysSinceAssessment > 90)) {
      return <Chip label="Inactive" color="warning" size="small" sx={{ mr: 0.5 }} />;
    }
    return null;
  };

  // Extend columns to add Predict button and Create Assessment CTA
  const actionColumn: GridColDef = {
    field: 'actions',
    headerName: 'Actions',
    width: 220,
    sortable: false,
    renderCell: (params: any) => (
      <Box display="flex" gap={1} alignItems="center">
        <Tooltip title={pinned.includes(params.row.patient.id) ? 'Unpin' : 'Pin'}>
          <IconButton
            color={pinned.includes(params.row.patient.id) ? 'secondary' : 'default'}
            onClick={() => handlePin(params.row.patient.id)}
          >
            <PushPinIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Predict Risk">
          <IconButton
            color="primary"
            onClick={() => navigate(`/assessment?motherId=${params.row.patient.id}`)}
          >
            <AssessmentIcon />
          </IconButton>
        </Tooltip>
        {!params.row.latest_assessment && (
          <Tooltip title="Create Assessment">
            <Button
              variant="outlined"
              color="secondary"
              size="small"
              onClick={() => navigate(`/assessment?motherId=${params.row.patient.id}`)}
            >
              Create Assessment
            </Button>
          </Tooltip>
        )}
      </Box>
    ),
  };

  const activityColumn: GridColDef = {
    field: 'activity',
    headerName: 'Activity',
    width: 150,
    sortable: false,
    renderCell: (params: any) => getActivityBadge(params.row),
  };

  const allColumns = [activityColumn, ...columns, actionColumn];

  // Helper to get risk priority
  const getRiskPriority = (risk: string | undefined) => {
    if (risk === 'high') return 3;
    if (risk === 'medium') return 2;
    if (risk === 'low') return 1;
    return 0;
  };
  // Helper to get appointment urgency
  const getAppointmentUrgency = (appointment: any) => {
    if (!appointment) return 0;
    const now = new Date();
    const apptDate = new Date(appointment.appointment_date);
    if (apptDate < now) return 2; // Overdue
    if ((apptDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24) <= 7) return 1; // Within 7 days
    return 0;
  };
  // Sort patients by risk and appointment urgency
  const sortedPatients = [...filteredPatients].sort((a, b) => {
    const riskA = getRiskPriority(a.latest_assessment?.risk_level);
    const riskB = getRiskPriority(b.latest_assessment?.risk_level);
    if (riskA !== riskB) return riskB - riskA;
    const apptA = getAppointmentUrgency(a.next_appointment);
    const apptB = getAppointmentUrgency(b.next_appointment);
    if (apptA !== apptB) return apptB - apptA;
    return 0;
  });
  // Row class for highlighting
  const getRowClassName = (params: any) => {
    const risk = params.row.latest_assessment?.risk_level;
    if (risk === 'high') return 'row-high-risk';
    if (risk === 'medium') return 'row-medium-risk';
    return '';
  };

  return (
    <Box sx={{ mt: 2 }}>
      <Card>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h5" gutterBottom>
              Patient List
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={showRecentOnly}
                  onChange={e => setShowRecentOnly(e.target.checked)}
                  color="primary"
                />
              }
              label="Recent Only (90 days)"
            />
          </Box>
          <Box display="flex" gap={2} alignItems="center" mb={2}>
            <TextField
              label="Search by Patient ID or Name"
              value={search}
              onChange={e => setSearch(e.target.value)}
              size="small"
              sx={{ minWidth: 220 }}
            />
            <FormControlLabel
              control={
                <Select
                  value={riskFilter}
                  onChange={e => setRiskFilter(e.target.value)}
                  displayEmpty
                  size="small"
                  sx={{ minWidth: 140 }}
                >
                  <MenuItem value="">All Risks</MenuItem>
                  <MenuItem value="high">High Risk</MenuItem>
                  <MenuItem value="medium">Medium Risk</MenuItem>
                  <MenuItem value="low">Low Risk</MenuItem>
                </Select>
              }
              label="Risk Level"
              labelPlacement="start"
              sx={{ ml: 2 }}
            />
          </Box>
          {loading ? (
            <Box display="flex" justifyContent="center" alignItems="center" height={200}>
              <CircularProgress />
            </Box>
          ) : filteredPatients.length > 0 ? (
            <Box sx={{ height: 500 }}>
              <DataGrid
                rows={sortedPatients}
                columns={allColumns}
                getRowId={(row) => row.patient.id}
                initialState={{
                  pagination: { paginationModel: { pageSize: 10 } }
                }}
                pageSizeOptions={[10, 25, 50]}
                disableRowSelectionOnClick
                slots={{ toolbar: GridToolbar }}
                slotProps={{
                  toolbar: {
                    showQuickFilter: true,
                    quickFilterProps: { debounceMs: 500 },
                  },
                }}
                getRowClassName={getRowClassName}
                sx={{
                  '& .MuiDataGrid-cell:focus': {
                    outline: 'none',
                  },
                  '& .row-high-risk': {
                    backgroundColor: '#ffebee', // light red
                  },
                  '& .row-medium-risk': {
                    backgroundColor: '#fffde7', // light yellow
                  },
                }}
              />
            </Box>
          ) : (
            <Box display="flex" justifyContent="center" alignItems="center" height={200}>
              <Typography color="textSecondary">No patients found</Typography>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default ClinicianPatientList; 