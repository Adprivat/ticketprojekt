import apiClient from './api';
import type { User, PaginatedResponse } from '../types';

export const AdminApi = {
  async listUsers(params: { page?: number; limit?: number; role?: User['role']; isActive?: boolean; search?: string } = {}) {
    const res = await apiClient.get('/users', { params });
    return { data: res.data.data as User[], pagination: res.data.pagination as PaginatedResponse<User>['pagination'] };
  },
  async createUser(payload: { email: string; firstName: string; lastName: string; password: string; role: User['role'] }) {
    const res = await apiClient.post('/users', payload);
    return res.data.data as User;
  },
  async updateUser(id: string, payload: Partial<Pick<User, 'email' | 'firstName' | 'lastName' | 'role' | 'isActive'>>) {
    const res = await apiClient.put(`/users/${id}`, payload);
    return res.data.data as User;
  },
  async deactivateUser(id: string) {
    const res = await apiClient.post(`/users/${id}/deactivate`);
    return res.data.data as User;
  },
  async reactivateUser(id: string) {
    const res = await apiClient.post(`/users/${id}/reactivate`);
    return res.data.data as User;
  },
  async deleteUser(id: string) {
    await apiClient.delete(`/users/${id}`);
  },
};
