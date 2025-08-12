import React from 'react';
import { Chip } from '@mui/material';
import type { Ticket } from '../../types';

const statusColor: Record<Ticket['status'], 'default' | 'warning' | 'success'> = {
  OPEN: 'default',
  IN_PROGRESS: 'warning',
  CLOSED: 'success',
};

const statusTranslation: Record<Ticket['status'], string> = {
  OPEN: 'OFFEN',
  IN_PROGRESS: 'IN BEARBEITUNG',
  CLOSED: 'GESCHLOSSEN',
};

export const StatusBadge: React.FC<{ status: Ticket['status'] }> = ({ status }) => {
  const color = statusColor[status] || 'default';
  const label = statusTranslation[status] || status;
  return <Chip size="small" color={color as any} label={label} sx={{}} />;
};
