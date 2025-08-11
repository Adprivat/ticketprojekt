import React from 'react';
import { Box, Button, Stack, TextField, MenuItem } from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import type { CreateTicketForm, Ticket } from '../../types';

export interface TicketFormProps {
  defaultValues?: Partial<CreateTicketForm>;
  onSubmit: (data: CreateTicketForm) => Promise<void> | void;
  submitting?: boolean;
}

const priorities: Ticket['priority'][] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

export const TicketForm: React.FC<TicketFormProps> = ({ defaultValues, onSubmit, submitting }) => {
  const { control, handleSubmit, formState: { errors } } = useForm<CreateTicketForm>({
    defaultValues: {
      title: '',
      description: '',
      priority: 'MEDIUM',
      ...defaultValues,
    },
  });

  return (
    <Box component="form" onSubmit={handleSubmit((d) => onSubmit(d))} noValidate>
      <Stack spacing={2}>
        <Controller
          name="title"
          control={control}
          rules={{ required: 'Title is required', minLength: { value: 3, message: 'Min 3 chars' } }}
          render={({ field }) => (
            <TextField {...field} label="Title" required error={!!errors.title} helperText={errors.title?.message} fullWidth />
          )}
        />

        <Controller
          name="description"
          control={control}
          rules={{ required: 'Description is required', minLength: { value: 5, message: 'Min 5 chars' } }}
          render={({ field }) => (
            <TextField {...field} label="Description" required error={!!errors.description} helperText={errors.description?.message} fullWidth multiline minRows={4} />
          )}
        />

        <Controller
          name="priority"
          control={control}
          rules={{ required: 'Priority is required' }}
          render={({ field }) => (
            <TextField select {...field} label="Priority" required fullWidth>
              {priorities.map(p => (
                <MenuItem key={p} value={p}>{p}</MenuItem>
              ))}
            </TextField>
          )}
        />

        <Stack direction="row" spacing={2} justifyContent="flex-end">
          <Button type="submit" variant="contained" disabled={submitting}>Save</Button>
        </Stack>
      </Stack>
    </Box>
  );
};
