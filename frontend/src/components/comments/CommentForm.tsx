import React from 'react';
import { Box, Button, TextField } from '@mui/material';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import type { CommentForm as CommentFormType } from '../../types';

const schema = yup.object({
  content: yup.string().trim().min(1, 'Comment cannot be empty').max(2000, 'Comment is too long').required('Comment is required'),
});

export interface CommentFormProps {
  initial?: CommentFormType;
  onSubmit: (data: CommentFormType) => Promise<void> | void;
  submitLabel?: string;
  autoFocus?: boolean;
}

export const CommentForm: React.FC<CommentFormProps> = ({ initial, onSubmit, submitLabel = 'Add Comment', autoFocus }) => {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<CommentFormType>({
    resolver: yupResolver(schema),
    defaultValues: initial ?? { content: '' },
  });

  const handle = async (data: CommentFormType) => {
    await onSubmit(data);
    if (!initial) {
      reset({ content: '' });
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit(handle)} sx={{ display: 'flex', gap: 1 }}>
      <TextField
        {...register('content')}
        fullWidth
        placeholder="Write a comment..."
        multiline
        minRows={2}
        error={!!errors.content}
        helperText={errors.content?.message}
        autoFocus={autoFocus}
      />
      <Button type="submit" variant="contained" disabled={isSubmitting} sx={{ alignSelf: 'flex-start', whiteSpace: 'nowrap' }}>
        {submitLabel}
      </Button>
    </Box>
  );
};
