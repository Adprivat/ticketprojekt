import React from 'react';
import { Box, Typography, Paper, Divider } from '@mui/material';
import { useParams } from 'react-router-dom';
import { TicketDetail } from '../components/tickets/TicketDetail';
import { CommentSection } from '../components/comments/CommentSection';
import { TicketApi } from '../services/tickets';
import type { Ticket, User } from '../types';
import { useAuth } from '../hooks/useAuth';
import { enqueueSnackbar } from 'notistack';

export const TicketDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [ticket, setTicket] = React.useState<Ticket | null>(null);
  const [assignees, setAssignees] = React.useState<User[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [statusChanging, setStatusChanging] = React.useState(false);
  const { user } = useAuth();

  React.useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const t = await TicketApi.get(id);
        const a = await TicketApi.listAssignees();
        if (mounted) {
          setTicket(t);
          setAssignees(a);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [id]);

  return (
    <Box>
      <Typography variant="h4" component="h1" sx={{ fontWeight: 700, mb: 3 }}>
        Ticket Details
      </Typography>
      <Paper sx={{ p: 3 }}>
        {ticket && (
          <TicketDetail
            ticket={ticket}
            assignees={assignees}
            canChangeStatus={user?.role === 'AGENT' || user?.role === 'ADMIN'}
            statusChanging={statusChanging}
            onChangeStatus={async (status) => {
              if (!id) return;
              try {
                setStatusChanging(true);
                const updated = await TicketApi.updateStatus(id, status);
                setTicket(updated);
                enqueueSnackbar(`Status changed to ${status}`, { variant: 'success' });
              } catch (e: any) {
                const msg = e?.response?.data?.error?.message || 'Failed to change status';
                enqueueSnackbar(msg, { variant: 'error' });
              } finally {
                setStatusChanging(false);
              }
            }}
            onAssign={async (user) => {
              if (!id) return;
              try {
                const updated = user ? await TicketApi.assign(id, user.id) : await TicketApi.unassign(id);
                setTicket(updated);
                enqueueSnackbar(user ? 'Assignee updated' : 'Unassigned', { variant: 'success' });
              } catch (e: any) {
                const msg = e?.response?.data?.error?.message || 'Failed to update assignee';
                enqueueSnackbar(msg, { variant: 'error' });
              } finally {
              }
            }}
            onUpdate={async (payload) => {
              if (!id) return;
              try {
                const updated = await TicketApi.update(id, payload);
                setTicket(updated);
                enqueueSnackbar('Ticket updated', { variant: 'success' });
              } catch (e: any) {
                const msg = e?.response?.data?.error?.message || 'Failed to update ticket';
                enqueueSnackbar(msg, { variant: 'error' });
              } finally {
              }
            }}
          />
        )}
        {!ticket && !loading && (
          <Typography color="text.secondary">Ticket not found.</Typography>
        )}
        {ticket && (
          <>
            <Divider sx={{ my: 3 }} />
            <CommentSection ticketId={ticket.id} />
          </>
        )}
      </Paper>
    </Box>
  );
};