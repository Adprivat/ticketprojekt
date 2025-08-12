import React from 'react';
import { Box, Typography, Paper } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { TicketForm } from '../components/tickets/TicketForm';
import { TicketApi } from '../services/tickets';

export const CreateTicketPage: React.FC = () => {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = React.useState(false);

  const handleSubmit = async (data: { title: string; description: string; priority: any }) => {
    setSubmitting(true);
    try {
      const ticket = await TicketApi.create(data);
      navigate(`/tickets/${ticket.id}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box>
      <Typography variant="h4" component="h1" sx={{ fontWeight: 700, mb: 3 }}>
        Neues Ticket erstellen
      </Typography>
      <Paper sx={{ p: 3 }}>
        <TicketForm onSubmit={handleSubmit} submitting={submitting} />
      </Paper>
    </Box>
  );
};