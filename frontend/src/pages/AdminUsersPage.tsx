import React from 'react';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material';
import { DataGrid, GridColDef, GridPaginationModel } from '@mui/x-data-grid';
import { Delete, Pause, PlayArrow, Edit as EditIcon } from '@mui/icons-material';
import { AdminApi } from '../services/admin';
import type { User } from '../types';
import { useSnackbar } from 'notistack';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';

const AdminUsersPageInner: React.FC = () => {
  const { enqueueSnackbar } = useSnackbar();
  const [rows, setRows] = React.useState<User[]>([]);
  const [rowCount, setRowCount] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const [search, setSearch] = React.useState('');
  const [role, setRole] = React.useState<User['role'] | ''>('');
  const [isActive, setIsActive] = React.useState<'' | 'true' | 'false'>('');
  const [createOpen, setCreateOpen] = React.useState(false);
  const [createForm, setCreateForm] = React.useState({
    email: '',
    firstName: '',
    lastName: '',
    password: '',
    role: 'USER' as User['role'],
  });

  const [editOpen, setEditOpen] = React.useState(false);
  const [editId, setEditId] = React.useState<string | null>(null);
  const [editForm, setEditForm] = React.useState({
    email: '',
    firstName: '',
    lastName: '',
    role: 'USER' as User['role'],
  });

  const fetchUsers = React.useCallback(async () => {
    setLoading(true);
    try {
      const { data, pagination } = await AdminApi.listUsers({
        page,
        limit: pageSize,
        role: (role || undefined) as any,
        isActive: isActive === '' ? undefined : isActive === 'true',
        search: search || undefined,
      });
      setRows(data);
      setRowCount(pagination.total);
    } catch (e: any) {
      enqueueSnackbar(e?.response?.data?.error?.message || 'Failed to load users', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, role, isActive, search]);

  React.useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleDeactivate = async (id: string, active: boolean) => {
    try {
      if (active) {
        await AdminApi.deactivateUser(id);
        enqueueSnackbar('User deactivated', { variant: 'success' });
      } else {
        await AdminApi.reactivateUser(id);
        enqueueSnackbar('User reactivated', { variant: 'success' });
      }
      fetchUsers();
    } catch (e: any) {
      enqueueSnackbar(e?.response?.data?.error?.message || 'Action failed', { variant: 'error' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await AdminApi.deleteUser(id);
      enqueueSnackbar('User deleted', { variant: 'success' });
      fetchUsers();
    } catch (e: any) {
      enqueueSnackbar(e?.response?.data?.error?.message || 'Delete failed', { variant: 'error' });
    }
  };

  const openEdit = (u: User) => {
    setEditId(u.id);
    setEditForm({ email: u.email, firstName: u.firstName, lastName: u.lastName, role: u.role });
    setEditOpen(true);
  };

  const handleUpdate = async () => {
    if (!editId) return;
    try {
      await AdminApi.updateUser(editId, {
        email: editForm.email,
        firstName: editForm.firstName,
        lastName: editForm.lastName,
        role: editForm.role,
      });
      enqueueSnackbar('User updated', { variant: 'success' });
      setEditOpen(false);
      setEditId(null);
      fetchUsers();
    } catch (e: any) {
      enqueueSnackbar(e?.response?.data?.error?.message || 'Update failed', { variant: 'error' });
    }
  };

  const handleCreate = async () => {
    try {
      if (!createForm.email || !createForm.firstName || !createForm.lastName || !createForm.password) {
        enqueueSnackbar('Please fill all required fields', { variant: 'warning' });
        return;
      }
      await AdminApi.createUser({
        email: createForm.email,
        firstName: createForm.firstName,
        lastName: createForm.lastName,
        password: createForm.password,
        role: createForm.role,
      });
      enqueueSnackbar('User created', { variant: 'success' });
      setCreateOpen(false);
      setCreateForm({ email: '', firstName: '', lastName: '', password: '', role: 'USER' });
      fetchUsers();
    } catch (e: any) {
      enqueueSnackbar(e?.response?.data?.error?.message || 'Create failed', { variant: 'error' });
    }
  };

  const columns = React.useMemo<GridColDef<User>[]>(() => [
    { field: 'email', headerName: 'Email', flex: 1, minWidth: 220 },
    { field: 'firstName', headerName: 'First name', width: 140 },
    { field: 'lastName', headerName: 'Last name', width: 140 },
    { field: 'role', headerName: 'Role', width: 120 },
    { field: 'isActive', headerName: 'Active', width: 100, valueGetter: (p: any) => (p.value ? 'Yes' : 'No') },
    { field: 'createdAt', headerName: 'Created', width: 180, valueGetter: (p: any) => new Date(p.value as any).toLocaleString() },
    {
      field: 'actions', headerName: 'Actions', width: 200, sortable: false, filterable: false, renderCell: (params: any) => (
        <Stack direction="row" spacing={1}>
          <IconButton size="small" onClick={() => openEdit(params.row as User)} title="Edit">
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={() => handleDeactivate(params.row.id, params.row.isActive)} title={params.row.isActive ? 'Deactivate' : 'Reactivate'}>
            {params.row.isActive ? <Pause fontSize="small" /> : <PlayArrow fontSize="small" />}
          </IconButton>
          <IconButton size="small" color="error" onClick={() => handleDelete(params.row.id)} title="Delete">
            <Delete fontSize="small" />
          </IconButton>
        </Stack>
      )
    },
  ], []);

  return (
    <>
      <Box>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 3 }}>Users</Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'center' }} sx={{ mb: 2 }}>
          <TextField label="Search" size="small" value={search} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)} sx={{ minWidth: 220 }} />
          <TextField select label="Role" size="small" value={role} onChange={(e: any) => setRole(e.target.value as any)} sx={{ minWidth: 160 }}>
            <MenuItem value="">All</MenuItem>
            <MenuItem value="USER">USER</MenuItem>
            <MenuItem value="AGENT">AGENT</MenuItem>
            <MenuItem value="ADMIN">ADMIN</MenuItem>
          </TextField>
          <TextField select label="Active" size="small" value={isActive} onChange={(e: any) => setIsActive(e.target.value as any)} sx={{ minWidth: 160 }}>
            <MenuItem value="">All</MenuItem>
            <MenuItem value="true">Active</MenuItem>
            <MenuItem value="false">Inactive</MenuItem>
          </TextField>
          <Box sx={{ flex: 1 }} />
          <Button variant="outlined" onClick={() => fetchUsers()}>Refresh</Button>
          <Button variant="contained" onClick={() => setCreateOpen(true)}>New User</Button>
        </Stack>
        <Paper>
          <div style={{ height: 600, width: '100%' }}>
            <DataGrid
              rows={rows}
              getRowId={(r: User) => r.id}
              columns={columns}
              rowCount={rowCount}
              loading={loading}
              paginationMode="server"
              paginationModel={{ page: page - 1, pageSize }}
              onPaginationModelChange={(m: GridPaginationModel) => { setPage(m.page + 1); setPageSize(m.pageSize); }}
            />
          </div>
        </Paper>
      </Box>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Create User</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Email" type="email" required value={createForm.email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCreateForm({ ...createForm, email: e.target.value })} />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField label="First name" required value={createForm.firstName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCreateForm({ ...createForm, firstName: e.target.value })} fullWidth />
              <TextField label="Last name" required value={createForm.lastName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCreateForm({ ...createForm, lastName: e.target.value })} fullWidth />
            </Stack>
            <TextField label="Password" type="password" required value={createForm.password} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCreateForm({ ...createForm, password: e.target.value })} />
            <TextField select label="Role" value={createForm.role} onChange={(e: any) => setCreateForm({ ...createForm, role: e.target.value as User['role'] })}>
              <MenuItem value="USER">USER</MenuItem>
              <MenuItem value="AGENT">AGENT</MenuItem>
              <MenuItem value="ADMIN">ADMIN</MenuItem>
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate}>Create</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={editOpen} onClose={() => setEditOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Edit User</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Email" type="email" required value={editForm.email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditForm({ ...editForm, email: e.target.value })} />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField label="First name" required value={editForm.firstName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditForm({ ...editForm, firstName: e.target.value })} fullWidth />
              <TextField label="Last name" required value={editForm.lastName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditForm({ ...editForm, lastName: e.target.value })} fullWidth />
            </Stack>
            <TextField select label="Role" value={editForm.role} onChange={(e: any) => setEditForm({ ...editForm, role: e.target.value as User['role'] })}>
              <MenuItem value="USER">USER</MenuItem>
              <MenuItem value="AGENT">AGENT</MenuItem>
              <MenuItem value="ADMIN">ADMIN</MenuItem>
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleUpdate} disabled={!editId}>Save</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

const AdminUsersPage: React.FC = () => (
  <ProtectedRoute roles={["ADMIN"]}>
    <AdminUsersPageInner />
  </ProtectedRoute>
);

export default AdminUsersPage;
