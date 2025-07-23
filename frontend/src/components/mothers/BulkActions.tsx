import React, { useState } from 'react';
import {
  Box,
  Button,
  Menu,
  MenuItem,
  Checkbox,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  Alert,
  Chip,
} from '@mui/material';
import {
  MoreVert as MoreVertIcon,
  Assignment as AssignmentIcon,
  Person as PersonIcon,
  Download as DownloadIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { MotherData } from './EnhancedMothersList';
import { UserRole } from '../../types';

interface BulkActionsProps {
  selectedMothers: string[];
  allMothers: MotherData[];
  onSelectionChange: (selectedIds: string[]) => void;
  onBulkAction: (action: string, data?: any) => void;
  userRole: UserRole;
}

const BulkActions: React.FC<BulkActionsProps> = ({
  selectedMothers,
  allMothers,
  onSelectionChange,
  onBulkAction,
  userRole,
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState<string>('');
  const [assignmentData, setAssignmentData] = useState({
    chv_id: '',
    clinician_id: '',
  });

  const selectedMothersData = allMothers.filter(m => selectedMothers.includes(m.id));
  const isAllSelected = selectedMothers.length === allMothers.length;
  const isIndeterminate = selectedMothers.length > 0 && selectedMothers.length < allMothers.length;

  const handleSelectAll = () => {
    if (isAllSelected) {
      onSelectionChange([]);
    } else {
      onSelectionChange(allMothers.map(m => m.id));
    }
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleBulkAssign = () => {
    setShowAssignDialog(true);
    handleMenuClose();
  };

  const handleBulkExport = () => {
    onBulkAction('export', { motherIds: selectedMothers });
    handleMenuClose();
  };

  const handleBulkScheduleAssessment = () => {
    setPendingAction('schedule_assessment');
    setShowConfirmDialog(true);
    handleMenuClose();
  };

  const confirmBulkAction = () => {
    onBulkAction(pendingAction, { motherIds: selectedMothers });
    setShowConfirmDialog(false);
    setPendingAction('');
  };

  const handleAssignmentSubmit = () => {
    onBulkAction('assign', {
      motherIds: selectedMothers,
      ...assignmentData,
    });
    setShowAssignDialog(false);
    setAssignmentData({ chv_id: '', clinician_id: '' });
  };

  if (selectedMothers.length === 0) {
    return (
      <Box display="flex" alignItems="center" gap={2}>
        <Checkbox
          checked={isAllSelected}
          indeterminate={isIndeterminate}
          onChange={handleSelectAll}
        />
        <Typography variant="body2" color="text.secondary">
          Select mothers for bulk actions
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" alignItems="center" gap={2}>
        <Checkbox
          checked={isAllSelected}
          indeterminate={isIndeterminate}
          onChange={handleSelectAll}
        />
        <Typography variant="body2">
          {selectedMothers.length} selected
        </Typography>
        
        <Box display="flex" gap={1} flexWrap="wrap">
          {selectedMothersData.slice(0, 3).map(mother => (
            <Chip
              key={mother.id}
              label={mother.full_name}
              size="small"
              onDelete={() => onSelectionChange(selectedMothers.filter(id => id !== mother.id))}
            />
          ))}
          {selectedMothers.length > 3 && (
            <Chip
              label={`+${selectedMothers.length - 3} more`}
              size="small"
              variant="outlined"
            />
          )}
        </Box>

        <Button
          variant="contained"
          startIcon={<MoreVertIcon />}
          onClick={handleMenuOpen}
          size="small"
        >
          Actions
        </Button>
      </Box>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleBulkExport}>
          <DownloadIcon sx={{ mr: 1 }} />
          Export Selected
        </MenuItem>
        
        <MenuItem onClick={handleBulkScheduleAssessment}>
          <AssignmentIcon sx={{ mr: 1 }} />
          Schedule Assessments
        </MenuItem>
        
        {(userRole === UserRole.ADMIN || userRole === UserRole.CLINICIAN) && (
          <MenuItem onClick={handleBulkAssign}>
            <PersonIcon sx={{ mr: 1 }} />
            Assign Staff
          </MenuItem>
        )}
      </Menu>

      {/* Assignment Dialog */}
      <Dialog open={showAssignDialog} onClose={() => setShowAssignDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Bulk Assign Staff</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Assign CHV and/or Clinician to {selectedMothers.length} selected mothers
          </Typography>
          
          <Box display="flex" flexDirection="column" gap={2} mt={2}>
            <FormControl fullWidth>
              <InputLabel>CHV</InputLabel>
              <Select
                value={assignmentData.chv_id}
                label="CHV"
                onChange={(e) => setAssignmentData(prev => ({ ...prev, chv_id: e.target.value }))}
              >
                <MenuItem value="">No CHV</MenuItem>
                {/* CHV options would be loaded from API */}
                <MenuItem value="chv1">John Doe (CHV)</MenuItem>
                <MenuItem value="chv2">Jane Smith (CHV)</MenuItem>
              </Select>
            </FormControl>
            
            <FormControl fullWidth>
              <InputLabel>Clinician</InputLabel>
              <Select
                value={assignmentData.clinician_id}
                label="Clinician"
                onChange={(e) => setAssignmentData(prev => ({ ...prev, clinician_id: e.target.value }))}
              >
                <MenuItem value="">No Clinician</MenuItem>
                {/* Clinician options would be loaded from API */}
                <MenuItem value="doc1">Dr. Wilson</MenuItem>
                <MenuItem value="doc2">Dr. Johnson</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAssignDialog(false)}>Cancel</Button>
          <Button onClick={handleAssignmentSubmit} variant="contained">
            Assign
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onClose={() => setShowConfirmDialog(false)}>
        <DialogTitle>Confirm Bulk Action</DialogTitle>
        <DialogContent>
          <Alert severity="info">
            Are you sure you want to schedule assessments for {selectedMothers.length} selected mothers?
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowConfirmDialog(false)}>Cancel</Button>
          <Button onClick={confirmBulkAction} variant="contained" color="primary">
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default BulkActions;