import React from 'react';
import { Box, Paper, Typography, Stack, TextField, Button } from '@mui/material';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { apiClient } from '../services/api';
import { enqueueSnackbar } from 'notistack';

const emailSchema = yup.object({
  email: yup.string().email('Ungültige E-Mail').required('E-Mail ist erforderlich'),
});

const passwordSchema = yup.object({
  currentPassword: yup.string().required('Aktuelles Passwort ist erforderlich'),
  newPassword: yup
    .string()
    .min(8, 'Passwort muss mindestens 8 Zeichen haben')
    .required('Neues Passwort ist erforderlich'),
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
  enqueueSnackbar('E-Mail aktualisiert', { variant: 'success' });
      resetEmail();
    } catch (e: any) {
  const msg = e?.response?.data?.error?.message || 'Aktualisieren der E-Mail fehlgeschlagen';
      enqueueSnackbar(msg, { variant: 'error' });
    }
  };

  const onPasswordSubmit = async (data: { currentPassword: string; newPassword: string }) => {
    try {
      await apiClient.post('/auth/change-password', data);
  enqueueSnackbar('Passwort aktualisiert', { variant: 'success' });
      resetPwd();
    } catch (e: any) {
  const msg = e?.response?.data?.error?.message || 'Aktualisieren des Passworts fehlgeschlagen';
      enqueueSnackbar(msg, { variant: 'error' });
    }
  };

  return (
    <Box>
      <Typography variant="h4" component="h1" sx={{ fontWeight: 700, mb: 3 }}>
  Einstellungen
      </Typography>

      <Stack spacing={3}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>E-Mail aktualisieren</Typography>
          <Box component="form" onSubmit={handleSubmitEmail(onEmailSubmit)} noValidate>
            <Stack spacing={2}>
              <TextField
                label="Neue E-Mail"
                type="email"
                fullWidth
                {...registerEmail('email')}
                error={!!emailErrors.email}
                helperText={emailErrors.email?.message}
              />
              <Box>
                <Button type="submit" variant="contained" disabled={isSubmittingEmail}>Speichern</Button>
              </Box>
            </Stack>
          </Box>
        </Paper>

        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>Passwort ändern</Typography>
          <Box component="form" onSubmit={handleSubmitPwd(onPasswordSubmit)} noValidate>
            <Stack spacing={2}>
              <TextField
                label="Aktuelles Passwort"
                type="password"
                fullWidth
                {...registerPwd('currentPassword')}
                error={!!pwdErrors.currentPassword}
                helperText={pwdErrors.currentPassword?.message}
              />
              <TextField
                label="Neues Passwort"
                type="password"
                fullWidth
                {...registerPwd('newPassword')}
                error={!!pwdErrors.newPassword}
                helperText={pwdErrors.newPassword?.message}
              />
              <Box>
                <Button type="submit" variant="contained" disabled={isSubmittingPwd}>Speichern</Button>
              </Box>
            </Stack>
          </Box>
        </Paper>
      </Stack>
    </Box>
  );
};

export default SettingsPage;
