import React from 'react';
import { Box, Paper, Typography, Stack, TextField, Button } from '@mui/material';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { apiClient } from '../services/api';
import { enqueueSnackbar } from 'notistack';

const emailSchema = yup.object({
  email: yup.string().email('Invalid email').required('Email is required'),
});

const passwordSchema = yup.object({
  currentPassword: yup.string().required('Current password is required'),
  newPassword: yup
    .string()
    .min(8, 'Password must be at least 8 characters')
    .required('New password is required'),
});

export const SettingsPage: React.FC = () => {
  const {
    register: registerEmail,
    handleSubmit: handleSubmitEmail,
    reset: resetEmail,
    formState: { errors: emailErrors, isSubmitting: isSubmittingEmail },
  } = useForm<{ email: string }>({ resolver: yupResolver(emailSchema) });

  const {
    register: registerPwd,
    handleSubmit: handleSubmitPwd,
    reset: resetPwd,
    formState: { errors: pwdErrors, isSubmitting: isSubmittingPwd },
  } = useForm<{ currentPassword: string; newPassword: string }>({ resolver: yupResolver(passwordSchema) });

  const onEmailSubmit = async (data: { email: string }) => {
    try {
      await apiClient.put('/auth/profile', { email: data.email });
      enqueueSnackbar('Email updated', { variant: 'success' });
      resetEmail();
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message || 'Failed to update email';
      enqueueSnackbar(msg, { variant: 'error' });
    }
  };

  const onPasswordSubmit = async (data: { currentPassword: string; newPassword: string }) => {
    try {
      await apiClient.post('/auth/change-password', data);
      enqueueSnackbar('Password updated', { variant: 'success' });
      resetPwd();
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message || 'Failed to update password';
      enqueueSnackbar(msg, { variant: 'error' });
    }
  };

  return (
    <Box>
      <Typography variant="h4" component="h1" sx={{ fontWeight: 700, mb: 3 }}>
        Settings
      </Typography>

      <Stack spacing={3}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>Update Email</Typography>
          <Box component="form" onSubmit={handleSubmitEmail(onEmailSubmit)} noValidate>
            <Stack spacing={2}>
              <TextField
                label="New Email"
                type="email"
                fullWidth
                {...registerEmail('email')}
                error={!!emailErrors.email}
                helperText={emailErrors.email?.message}
              />
              <Box>
                <Button type="submit" variant="contained" disabled={isSubmittingEmail}>Save</Button>
              </Box>
            </Stack>
          </Box>
        </Paper>

        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>Change Password</Typography>
          <Box component="form" onSubmit={handleSubmitPwd(onPasswordSubmit)} noValidate>
            <Stack spacing={2}>
              <TextField
                label="Current Password"
                type="password"
                fullWidth
                {...registerPwd('currentPassword')}
                error={!!pwdErrors.currentPassword}
                helperText={pwdErrors.currentPassword?.message}
              />
              <TextField
                label="New Password"
                type="password"
                fullWidth
                {...registerPwd('newPassword')}
                error={!!pwdErrors.newPassword}
                helperText={pwdErrors.newPassword?.message}
              />
              <Box>
                <Button type="submit" variant="contained" disabled={isSubmittingPwd}>Save</Button>
              </Box>
            </Stack>
          </Box>
        </Paper>
      </Stack>
    </Box>
  );
};

export default SettingsPage;
