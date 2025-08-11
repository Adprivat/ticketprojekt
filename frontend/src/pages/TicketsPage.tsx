import React from 'react';
import { Box, Typography, Paper, Stack, TextField, MenuItem, Button, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { TicketList } from '../components/tickets/TicketList';
import { TicketApi } from '../services/tickets';
import type { Ticket } from '../types';
import { useAuth } from '../hooks/useAuth';
import { useSnackbar } from 'notistack';

export const TicketsPage: React.FC = () => {
  const navigate = useNavigate();
  const [rows, setRows] = React.useState<Ticket[]>([]);
  const [rowCount, setRowCount] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const [search, setSearch] = React.useState('');
  const [status, setStatus] = React.useState<'' | Ticket['status']>('');
  const [priority, setPriority] = React.useState<'' | Ticket['priority']>('');
  const { user } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const [deleteId, setDeleteId] = React.useState<string | null>(null);

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    try {
      const { data, pagination } = await TicketApi.list({
        page,
        limit: pageSize,
        search: search || undefined,
        status: status || undefined,
        priority: priority || undefined,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });
      setRows(data);
      setRowCount(pagination.total);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, status, priority]);

  React.useEffect(() => { fetchData(); }, [fetchData]);

  const requestDelete = (id: string) => {
    setDeleteId(id);
  };

  const handleConfirmDelete = async () => {
    if (!deleteId) return;
    try {
      await TicketApi.delete(deleteId);
      enqueueSnackbar('Ticket deleted', { variant: 'success' });
      setDeleteId(null);
      fetchData();
    } catch (e: any) {
      enqueueSnackbar(e?.response?.data?.error?.message || 'Delete failed', { variant: 'error' });
    }
  };

  const handleCancelDelete = () => setDeleteId(null);

  return (
    <Box>
      <Typography variant="h4" component="h1" sx={{ fontWeight: 700, mb: 3 }}>
        Tickets
      </Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'center' }} sx={{ mb: 2 }}>
        <TextField label="Search" value={search} onChange={(e) => setSearch(e.target.value)} size="small" sx={{ minWidth: 220 }} />
        <TextField label="Status" value={status} onChange={(e) => setStatus(e.target.value as any)} size="small" select sx={{ minWidth: 180 }}>
          <MenuItem value="">All</MenuItem>
          <MenuItem value="OPEN">OPEN</MenuItem>
          <MenuItem value="IN_PROGRESS">IN_PROGRESS</MenuItem>
          <MenuItem value="CLOSED">CLOSED</MenuItem>
        </TextField>
        <TextField label="Priority" value={priority} onChange={(e) => setPriority(e.target.value as any)} size="small" select sx={{ minWidth: 180 }}>
          <MenuItem value="">All</MenuItem>
          <MenuItem value="LOW">LOW</MenuItem>
          <MenuItem value="MEDIUM">MEDIUM</MenuItem>
          <MenuItem value="HIGH">HIGH</MenuItem>
          <MenuItem value="URGENT">URGENT</MenuItem>
        </TextField>
        <Box sx={{ flex: 1 }} />
        <Button variant="contained" onClick={() => navigate('/tickets/new')}>New Ticket</Button>
      </Stack>
      <Paper sx={{ p: 0 }}>
        <TicketList
          rows={rows}
          rowCount={rowCount}
          loading={loading}
          page={page}
          pageSize={pageSize}
          onPaginationChange={(m) => { setPage(m.page + 1); setPageSize(m.pageSize); }}
          onRowClick={(id) => navigate(`/tickets/${id}`)}
          canDelete={user?.role === 'ADMIN'}
          onDelete={requestDelete}
        />
      </Paper>

      <Dialog open={!!deleteId} onClose={handleCancelDelete} maxWidth="xs" fullWidth>
        <DialogTitle>Delete ticket?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            This action cannot be undone. Are you sure you want to permanently delete this ticket?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelDelete}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleConfirmDelete}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};