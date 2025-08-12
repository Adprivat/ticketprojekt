import React from 'react';
import { Stack, Typography, Chip, Button, Divider } from '@mui/material';
import type { Ticket, User } from '../../types';
import { StatusBadge } from './StatusBadge';
import { AssigneeSelector } from './AssigneeSelector';
import { TicketForm } from './TicketForm';

export interface TicketDetailProps {
  ticket: Ticket;
  assignees?: User[];
  onChangeStatus?: (status: Ticket['status']) => void;
  onAssign?: (user: User | null) => void;
  onUpdate?: (payload: Partial<{ title: string; description: string; priority: Ticket['priority'] }>) => void;
  // Optional: enable/disable status controls and show loading
  canChangeStatus?: boolean;
  statusChanging?: boolean;
}

export const TicketDetail: React.FC<TicketDetailProps> = ({ ticket, assignees, onChangeStatus, onAssign, onUpdate, canChangeStatus = true, statusChanging = false }) => {
  const [editMode, setEditMode] = React.useState(false);

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={2} alignItems="center">
        <Typography variant="h5" sx={{ fontWeight: 700 }}>{ticket.title}</Typography>
        <StatusBadge status={ticket.status} />
  <Chip size="small" label={`Priorität: ${ticket.priority}`} />
      </Stack>
      <Typography color="text.secondary">{ticket.description}</Typography>
  <Typography variant="body2">Erstellt: {new Date(ticket.createdAt).toLocaleString()}</Typography>
  <Typography variant="body2">Aktualisiert: {new Date(ticket.updatedAt).toLocaleString()}</Typography>
      <Stack direction="row" spacing={1}>
        {onChangeStatus && canChangeStatus && (
          <>
            <Button size="small" disabled={statusChanging} onClick={() => onChangeStatus('OPEN')}>Auf OPEN setzen</Button>
            <Button size="small" disabled={statusChanging} onClick={() => onChangeStatus('IN_PROGRESS')}>Auf IN_PROGRESS setzen</Button>
            <Button size="small" disabled={statusChanging} onClick={() => onChangeStatus('CLOSED')}>Auf CLOSED setzen</Button>
          </>
        )}
      </Stack>

      {assignees && onAssign && (
        <Stack direction="row" spacing={2} alignItems="center">
          <Typography variant="body2" sx={{ minWidth: 100 }}>Zugewiesen an</Typography>
          <AssigneeSelector
            users={assignees}
            value={(ticket.assignee as any) || null}
            onChange={onAssign}
          />
          {ticket.assignee && (
            <Button size="small" onClick={() => onAssign(null)}>Zuweisung entfernen</Button>
          )}
        </Stack>
      )}

      {onUpdate && (
        <>
          <Divider />
          <Stack direction="row" spacing={2}>
            <Button variant="outlined" size="small" onClick={() => setEditMode(!editMode)}>
              {editMode ? 'Abbrechen' : 'Bearbeiten'}
            </Button>
          </Stack>
          {editMode && (
            <TicketForm
              defaultValues={{ title: ticket.title, description: ticket.description, priority: ticket.priority }}
              onSubmit={(data) => onUpdate(data)}
            />
          )}
        </>
      )}
    </Stack>
  );
};
