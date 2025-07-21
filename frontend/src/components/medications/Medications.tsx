import React from 'react';
import { Container, Typography, Paper, Box } from '@mui/material';

const Medications: React.FC = () => {
  return (
    <Container maxWidth="lg">
      <Typography variant="h4" gutterBottom>
        Medications Management
      </Typography>
      <Paper elevation={3} sx={{ p: 3 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <Typography variant="h6" color="textSecondary">
            Medications functionality coming soon...
          </Typography>
        </Box>
      </Paper>
    </Container>
  );
};

export default Medications; 