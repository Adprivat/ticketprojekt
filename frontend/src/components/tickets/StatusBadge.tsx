import React from 'react';
import { Chip } from '@mui/material';
import type { Ticket } from '../../types';

const statusColor: Record<Ticket['status'], 'default' | 'warning' | 'success'> = {
  OPEN: 'default',
  IN_PROGRESS: 'warning',
  CLOSED: 'success',
};

export const StatusBadge: React.FC<{ status: Ticket['status'] }> = ({ status }) => {
  const color = statusColor[status] || 'default';
  const label = status.replace('_', ' ');
  return <Chip size="small" color={color as any} label={label} sx={{ textTransform: 'capitalize' }} />;
};
