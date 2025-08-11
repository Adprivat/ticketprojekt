import React from 'react';
import { Autocomplete, TextField } from '@mui/material';
import type { User } from '../../types';

export interface AssigneeSelectorProps {
  users: User[];
  value: User | null;
  onChange: (user: User | null) => void;
  disabled?: boolean;
}

export const AssigneeSelector: React.FC<AssigneeSelectorProps> = ({ users, value, onChange, disabled }) => {
  return (
    <Autocomplete
      value={value}
      onChange={(_, v) => onChange(v)}
      options={users}
      getOptionLabel={(u) => u ? `${u.firstName} ${u.lastName}` : ''}
      isOptionEqualToValue={(a, b) => a.id === b.id}
      disabled={disabled}
      renderInput={(params) => <TextField {...params} label="Assignee" />}
      sx={{ minWidth: 240 }}
    />
  );
};
