import React from 'react';
import { Box, IconButton, Typography } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CloseIcon from '@mui/icons-material/Close';
import type { Comment } from '../../types';
import { CommentForm } from './CommentForm';

export interface CommentItemProps {
  comment: Comment;
  onUpdate: (id: string, content: string) => Promise<void> | void;
  onDelete: (id: string) => Promise<void> | void;
}

export const CommentItem: React.FC<CommentItemProps> = ({ comment, onUpdate, onDelete }) => {
  const [isEditing, setIsEditing] = React.useState(false);

  const handleUpdate = async ({ content }: { content: string }) => {
    await onUpdate(comment.id, content);
    setIsEditing(false);
  };

  return (
    <Box sx={{ p: 1.5, borderRadius: 1, border: 1, borderColor: 'divider' }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            {comment.author ? `${comment.author.firstName} ${comment.author.lastName}` : 'Unknown'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {new Date(comment.createdAt).toLocaleString()}
            {comment.updatedAt !== comment.createdAt && ' · edited'}
          </Typography>
          <Box sx={{ mt: 1 }}>
            {isEditing ? (
              <CommentForm initial={{ content: comment.content }} onSubmit={handleUpdate} submitLabel="Save" />
            ) : (
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{comment.content}</Typography>
            )}
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {isEditing ? (
            <>
              <IconButton aria-label="cancel edit" size="small" onClick={() => setIsEditing(false)}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </>
          ) : (
            <>
              <IconButton aria-label="edit" size="small" onClick={() => setIsEditing(true)}>
                <EditIcon fontSize="small" />
              </IconButton>
              <IconButton aria-label="delete" size="small" color="error" onClick={() => onDelete(comment.id)}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </>
          )}
        </Box>
      </Box>
    </Box>
  );
};
