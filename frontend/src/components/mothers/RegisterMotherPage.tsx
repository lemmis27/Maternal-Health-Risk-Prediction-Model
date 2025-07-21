import React, { useState } from 'react';
import { Card, CardContent, Typography, Box, Alert, IconButton, InputAdornment, TextField } from '@mui/material';
import MotherRegistrationForm from './MotherRegistrationForm';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

const RegisterMotherPage: React.FC = () => {
  const [success, setSuccess] = useState(false);
  const [motherId, setMotherId] = useState<string | null>(null);

  const handleSuccess = (response: any) => {
    setSuccess(true);
    if (response && response.mother_id) {
      setMotherId(response.mother_id);
    }
  };

  const handleCopy = () => {
    if (motherId) {
      navigator.clipboard.writeText(motherId);
    }
  };

  return (
    <Box sx={{ mt: 2, maxWidth: 600, mx: 'auto' }}>
      <Card>
        <CardContent>
          <Typography variant="h5" gutterBottom>
            Register New Mother
          </Typography>
          {success && motherId && (
            <Alert severity="success" sx={{ mb: 2 }}>
              Mother registered successfully!<br />
              <Box display="flex" alignItems="center" mt={1}>
                <TextField
                  id="mother_id_display"
                  label="Mother ID"
                  value={motherId}
                  InputProps={{
                    readOnly: true,
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={handleCopy} size="small">
                          <ContentCopyIcon fontSize="small" />
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                  size="small"
                  sx={{ width: 220 }}
                  autoComplete="off"
                />
              </Box>
            </Alert>
          )}
          <MotherRegistrationForm onSuccess={handleSuccess} />
        </CardContent>
      </Card>
    </Box>
  );
};

export default RegisterMotherPage; 