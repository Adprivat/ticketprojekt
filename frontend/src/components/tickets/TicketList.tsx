import React from 'react';
import { Box, IconButton, Tooltip } from '@mui/material';
import { DataGrid, GridColDef, GridPaginationModel, GridSortModel } from '@mui/x-data-grid';
import type { Ticket } from '../../types';
import { StatusBadge } from './StatusBadge';
import { Delete as DeleteIcon } from '@mui/icons-material';

export interface TicketListProps {
  rows: Ticket[];
  rowCount: number;
  loading?: boolean;
  page: number;
  pageSize: number;
  onPaginationChange: (model: GridPaginationModel) => void;
  onSortChange?: (model: GridSortModel) => void;
  onRowClick?: (id: string) => void;
  canDelete?: boolean;
  onDelete?: (id: string) => void;
}

export const TicketList: React.FC<TicketListProps> = ({ rows, rowCount, loading, page, pageSize, onPaginationChange, onSortChange, onRowClick, canDelete, onDelete }) => {
  const columns = React.useMemo<GridColDef[]>(() => {
    const base: GridColDef[] = [
  { field: 'title', headerName: 'Titel', flex: 1, minWidth: 200 },
  { field: 'priority', headerName: 'Priorität', width: 120 },
  { field: 'status', headerName: 'Status', width: 150, renderCell: (params) => <StatusBadge status={params.value} /> },
  { field: 'createdAt', headerName: 'Erstellt', width: 180, valueGetter: (p) => new Date(p.value).toLocaleString() },
  { field: 'updatedAt', headerName: 'Aktualisiert', width: 180, valueGetter: (p) => new Date(p.value).toLocaleString() },
    ];
    if (canDelete) {
      base.push({
        field: 'actions',
  headerName: 'Aktionen',
        width: 110,
        sortable: false,
        filterable: false,
        renderCell: (params) => (
          <Tooltip title="Ticket löschen">
            <IconButton
              size="small"
              color="error"
              onClick={(e) => {
                e.stopPropagation();
                onDelete?.(params.row.id as string);
              }}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        ),
      });
    }
    return base;
  }, [canDelete, onDelete]);

  return (
    <Box sx={{ height: 600, width: '100%' }}>
      <DataGrid
        rows={rows}
        getRowId={(r) => r.id}
        columns={columns}
        paginationMode="server"
        sortingMode="server"
        rowCount={rowCount}
        loading={loading}
        paginationModel={{ page: page - 1, pageSize }}
        onPaginationModelChange={(m) => onPaginationChange(m)}
        onSortModelChange={(m) => onSortChange?.(m)}
        onRowClick={(p) => onRowClick?.(p.id as string)}
      />
    </Box>
  );
};
