import React, { useEffect, useState } from 'react';
import { Container, Typography, Paper, Box, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Select, MenuItem, Button, CircularProgress, Alert } from '@mui/material';
import { mothersAPI, usersAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

const MothersList: React.FC = () => {
  const { user } = useAuth();
  const [mothers, setMothers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const mothersRes = await mothersAPI.list(0, 100);
        setMothers(mothersRes.data);
        console.log('Fetched mothers:', mothersRes.data);
      } catch (err: any) {
        setError('Failed to load mothers');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px"><CircularProgress /></Box>;
  }

  // Filter mothers for CHV users
  const filteredMothers = user?.role === 'chv'
    ? mothers.filter((m) => m.assigned_chv_id === user.id)
    : mothers;

  return (
    <Container maxWidth="lg">
      <Typography variant="h4" gutterBottom>
        Mothers Management
      </Typography>
      <Paper elevation={3} sx={{ p: 3 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Mother ID</TableCell>
                <TableCell>Age</TableCell>
                <TableCell>Gestational Age</TableCell>
                <TableCell>Emergency Contact</TableCell>
                <TableCell>Address</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredMothers.map((mother) => (
                <TableRow key={mother.id}>
                  <TableCell>{mother.full_name || mother.user_id}</TableCell>
                  <TableCell>{mother.id}</TableCell>
                  <TableCell>{mother.age}</TableCell>
                  <TableCell>{mother.gestational_age ?? ''}</TableCell>
                  <TableCell>{mother.emergency_contact ?? ''}</TableCell>
                  <TableCell>{mother.address ?? ''}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Container>
  );
};

export default MothersList; 