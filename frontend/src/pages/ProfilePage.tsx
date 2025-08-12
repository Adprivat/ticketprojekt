import React from 'react';
import { Box, Typography, Paper } from '@mui/material';

export const ProfilePage: React.FC = () => {
  return (
    <Box>
      <Typography variant="h4" component="h1" sx={{ fontWeight: 700, mb: 3 }}>
        Profil
      </Typography>
      
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="h6" color="text.secondary">
          Profil-Komponente wird in Aufgabe 7.2 implementiert
        </Typography>
      </Paper>
    </Box>
  );
};