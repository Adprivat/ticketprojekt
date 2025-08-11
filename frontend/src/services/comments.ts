import apiClient from './api';
import type { Comment, CommentForm } from '../types';

export const CommentsApi = {
  async list(ticketId: string): Promise<Comment[]> {
  const res = await apiClient.get(`/comments/ticket/${ticketId}`);
    return res.data.data as Comment[];
  },

  async create(ticketId: string, payload: CommentForm): Promise<Comment> {
  const res = await apiClient.post(`/comments/ticket/${ticketId}`, payload);
    return res.data.data as Comment;
  },

  async update(commentId: string, payload: CommentForm): Promise<Comment> {
    const res = await apiClient.put(`/comments/${commentId}`, payload);
    return res.data.data as Comment;
  },

  async remove(commentId: string): Promise<{ id: string }> {
    const res = await apiClient.delete(`/comments/${commentId}`);
    return res.data.data as { id: string };
  },
};
