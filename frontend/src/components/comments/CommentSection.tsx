import React from 'react';
import { Box, Divider, Typography } from '@mui/material';
import type { Comment } from '../../types';
import { CommentsApi } from '../../services/comments';
import { CommentForm } from './CommentForm';
import { CommentItem } from './CommentItem';

export interface CommentSectionProps {
  ticketId: string;
}

export const CommentSection: React.FC<CommentSectionProps> = ({ ticketId }) => {
  const [comments, setComments] = React.useState<Comment[]>([]);
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await CommentsApi.list(ticketId);
      // sort chronologically by createdAt ascending
      data.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      setComments(data);
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  React.useEffect(() => { load(); }, [load]);

  const handleCreate = async ({ content }: { content: string }) => {
    const newComment = await CommentsApi.create(ticketId, { content });
    setComments((prev) => [...prev, newComment].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
  };

  const handleUpdate = async (id: string, content: string) => {
    const updated = await CommentsApi.update(id, { content });
    setComments((prev) => prev.map((c) => (c.id === id ? updated : c)));
  };

  const handleDelete = async (id: string) => {
    await CommentsApi.remove(id);
    setComments((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <Box sx={{ mt: 4 }}>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
        Comments
      </Typography>

      <CommentForm onSubmit={handleCreate} submitLabel="Comment" />

      <Divider sx={{ my: 2 }} />

      {comments.length === 0 && !loading && (
        <Typography variant="body2" color="text.secondary">No comments yet.</Typography>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {comments.map((comment) => (
          <CommentItem key={comment.id} comment={comment} onUpdate={handleUpdate} onDelete={handleDelete} />)
        )}
      </Box>
    </Box>
  );
};
