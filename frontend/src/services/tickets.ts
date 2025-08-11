import apiClient from './api';
import type { Ticket, TicketFilters, PaginatedResponse, User } from '../types';

export interface FetchTicketsParams extends TicketFilters {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export const TicketApi = {
  async list(params: FetchTicketsParams = {}): Promise<{ data: Ticket[]; pagination: PaginatedResponse<Ticket>['pagination'] }> {
    const res = await apiClient.get('/tickets', { params });
    return { data: res.data.data as Ticket[], pagination: res.data.pagination };
  },

  async get(id: string): Promise<Ticket> {
    const res = await apiClient.get(`/tickets/${id}`);
    return res.data.data as Ticket;
  },

  async create(payload: { title: string; description: string; priority: Ticket['priority'] }): Promise<Ticket> {
    const res = await apiClient.post('/tickets', payload);
    return res.data.data as Ticket;
  },

  async updateStatus(id: string, status: Ticket['status']): Promise<Ticket> {
    const res = await apiClient.patch(`/tickets/${id}/status`, { status });
    return res.data.data as Ticket;
  },

  async update(id: string, payload: Partial<{ title: string; description: string; priority: Ticket['priority']; assignedTo: string | null }>): Promise<Ticket> {
    const res = await apiClient.put(`/tickets/${id}`, payload);
    return res.data.data as Ticket;
  },

  async listAssignees(): Promise<User[]> {
    const res = await apiClient.get('/assignments/assignees');
    return res.data.data as User[];
  },

  async assign(id: string, assigneeId: string): Promise<Ticket> {
    const res = await apiClient.post(`/assignments/tickets/${id}/assign`, { assigneeId });
    return res.data.data as Ticket;
  },

  async unassign(id: string): Promise<Ticket> {
    const res = await apiClient.post(`/assignments/tickets/${id}/unassign`, { reason: 'Unassigned from UI' });
    return res.data.data as Ticket;
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/tickets/${id}`);
  },

  // Dashboard helpers
  async statistics(): Promise<{ total: number; open: number; inProgress: number; closed: number; unassigned: number }> {
    const res = await apiClient.get('/tickets/statistics');
    return res.data.data as any;
  },

  async stale(days: number = 7) {
    const res = await apiClient.get('/tickets/stale', { params: { days } });
    return res.data.data as Ticket[];
  },

  async listMyCreated(params: { page?: number; limit?: number; status?: Ticket['status'] } = {}) {
    const res = await apiClient.get('/tickets/created/me', { params });
    return { data: res.data.data as Ticket[], pagination: res.data.pagination as PaginatedResponse<Ticket>['pagination'] };
  },

  async listMyAssigned(params: { page?: number; limit?: number; status?: Ticket['status'] } = {}) {
    const res = await apiClient.get('/tickets/assigned/me', { params });
    return { data: res.data.data as Ticket[], pagination: res.data.pagination as PaginatedResponse<Ticket>['pagination'] };
  },
};
