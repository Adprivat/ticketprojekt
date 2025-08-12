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
          rules={{ required: 'Titel ist erforderlich', minLength: { value: 3, message: 'Mindestens 3 Zeichen' } }}
          render={({ field }) => (
            <TextField {...field} label="Titel" required error={!!errors.title} helperText={errors.title?.message} fullWidth />
          )}
        />

        <Controller
          name="description"
          control={control}
          rules={{ required: 'Beschreibung ist erforderlich', minLength: { value: 5, message: 'Mindestens 5 Zeichen' } }}
          render={({ field }) => (
            <TextField {...field} label="Beschreibung" required error={!!errors.description} helperText={errors.description?.message} fullWidth multiline minRows={4} />
          )}
        />

        <Controller
          name="priority"
          control={control}
          rules={{ required: 'Priorität ist erforderlich' }}
          render={({ field }) => (
            <TextField select {...field} label="Priorität" required fullWidth>
              {priorities.map(p => (
                <MenuItem key={p} value={p}>{p}</MenuItem>
              ))}
            </TextField>
          )}
        />

        <Stack direction="row" spacing={2} justifyContent="flex-end">
          <Button type="submit" variant="contained" disabled={submitting}>Speichern</Button>
        </Stack>
      </Stack>
    </Box>
  );
};
