import React from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  Chip,
} from '@mui/material';
import {
  ConfirmationNumber as TicketIcon,
  TrendingUp as TrendingUpIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';

import { useAuth } from '../hooks/useAuth';
import { TicketApi } from '../services/tickets';
import { useSnackbar } from 'notistack';
import type { Ticket } from '../types';
import { useNavigate } from 'react-router-dom';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';
  subtitle?: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, color, subtitle }: StatCardProps) => (
  <Card sx={{ height: '100%' }}>
    <CardContent>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Box
          sx={{
            p: 1,
            borderRadius: 2,
            backgroundColor: `${color}.main`,
            color: `${color}.contrastText`,
            mr: 2,
          }}
        >
          {icon}
        </Box>
        <Box>
          <Typography variant="h4" component="div" sx={{ fontWeight: 700 }}>
            {value}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="caption" color="text.secondary">
              {subtitle}
            </Typography>
          )}
        </Box>
      </Box>
    </CardContent>
  </Card>
);

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const navigate = useNavigate();

  // Ladezustand entfernt (war ungenutzt)
  const [stats, setStats] = React.useState({ total: 0, open: 0, inProgress: 0, closed: 0, unassigned: 0 });
  const [recentTickets, setRecentTickets] = React.useState<Ticket[]>([]);

  React.useEffect(() => {
    const load = async () => {
      try {
        if (user?.role === 'ADMIN' || user?.role === 'AGENT') {
          const [s, myAssigned, myCreated] = await Promise.all([
            TicketApi.statistics(),
            TicketApi.listMyAssigned({ page: 1, limit: 5 }).then(r => r.data),
            TicketApi.listMyCreated({ page: 1, limit: 5 }).then(r => r.data),
          ]);
          setStats(s);
          // Kombiniere zugewiesene & erstellte Tickets und entferne Duplikate (gleiche ID)
          const combined = [...(myAssigned || []), ...(myCreated || [])];
          const uniqueMap = new Map<string, Ticket>();
          combined.forEach(t => {
            if (!uniqueMap.has(t.id)) uniqueMap.set(t.id, t);
          });
          const unique = Array.from(uniqueMap.values())
            .sort((a: Ticket, b: Ticket) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 8);
          setRecentTickets(unique);
        } else {
          const myCreated = await TicketApi.listMyCreated({ page: 1, limit: 8 });
          setRecentTickets(myCreated.data);
          // Basic counts for users from their tickets
          const counts = myCreated.data.reduce((acc: Record<string, number>) => acc, { total: 0 });
          myCreated.data.forEach((t) => {
            counts.total += 1;
            const key = t.status.toLowerCase();
            counts[key] = (counts[key] || 0) + 1;
          });
          setStats({ total: counts.total, open: counts.open || 0, inProgress: counts.in_progress || 0, closed: counts.closed || 0, unassigned: 0 });
        }
      } catch (e: any) {
        enqueueSnackbar(e?.response?.data?.error?.message || 'Failed to load dashboard', { variant: 'error' });
      } finally {
        // keine Ladezustandsverwaltung nötig
      }
    };
    load();
  }, [user?.role]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OPEN':
        return 'warning';
      case 'IN_PROGRESS':
        return 'info';
      case 'CLOSED':
        return 'success';
      default:
        return 'default';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'URGENT':
        return 'error';
      case 'HIGH':
        return 'warning';
      case 'MEDIUM':
        return 'info';
      case 'LOW':
        return 'success';
      default:
        return 'default';
    }
  };

  return (
    <Box>
      {/* Welcome Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 700, mb: 1 }}>
          Willkommen zurück, {user?.firstName}!
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Das passiert heute mit Ihren Tickets.
        </Typography>
      </Box>

      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard title="Alle Tickets" value={stats.total} icon={<TicketIcon />} color="primary" subtitle={user?.role === 'ADMIN' || user?.role === 'AGENT' ? 'Gesamt' : 'Ihre Tickets'} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard title="Offene Tickets" value={stats.open} icon={<ScheduleIcon />} color="warning" subtitle="Benötigt Aufmerksamkeit" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard title="In Bearbeitung" value={stats.inProgress} icon={<TrendingUpIcon />} color="info" subtitle="In Arbeit" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard title="Geschlossene Tickets" value={stats.closed} icon={<CheckCircleIcon />} color="success" subtitle="Abgeschlossen" />
        </Grid>
      </Grid>

      {/* Recent Tickets */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" component="h2" sx={{ fontWeight: 600, mb: 3 }}>
          Letzte Tickets
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {recentTickets.map((ticket: Ticket) => (
            <Paper
              key={ticket.id}
              variant="outlined"
              sx={{
                p: 2,
                '&:hover': {
                  backgroundColor: 'action.hover',
                  cursor: 'pointer',
                },
              }}
        onClick={() => navigate(`/tickets/${ticket.id}`)}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
                    {ticket.title}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Chip
                      label={ticket.status.replace('_', ' ')}
                      size="small"
                      color={getStatusColor(ticket.status) as any}
                      variant="outlined"
                    />
                    <Chip
                      label={ticket.priority}
                      size="small"
                      color={getPriorityColor(ticket.priority) as any}
                      variant="filled"
                    />
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    {ticket.assignee && (
                      <>Zugewiesen an {ticket.assignee.firstName ? `${ticket.assignee.firstName} ${ticket.assignee.lastName}` : ticket.assignee.email} • </>
                    )}
                    {ticket.creator && (
                      <>Erstellt von {ticket.creator.id === user?.id ? 'Ihnen' : `${ticket.creator.firstName} ${ticket.creator.lastName}`} • </>
                    )}
                    {new Date(ticket.createdAt).toLocaleDateString()}
                  </Typography>
                </Box>
              </Box>
            </Paper>
          ))}
        </Box>
        {recentTickets.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="body1" color="text.secondary">
              Keine aktuellen Tickets gefunden.
            </Typography>
          </Box>
        )}
      </Paper>
    </Box>
  );
};