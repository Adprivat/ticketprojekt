import React from 'react';
import { Box, Typography, Paper } from '@mui/material';

export const ProfilePage: React.FC = () => {
  return (
    <Box>
      <Typography variant="h4" component="h1" sx={{ fontWeight: 700, mb: 3 }}>
        Profile
      </Typography>
      
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="h6" color="text.secondary">
          Profile component will be implemented in Task 7.2
        </Typography>
      </Paper>
    </Box>
  );
};