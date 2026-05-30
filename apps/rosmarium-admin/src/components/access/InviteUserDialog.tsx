import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Stack,
  TextField, Button, FormControl, InputLabel, Select, MenuItem
} from '@mui/material';
import type { InviteUserInput } from '../../api/users';

export interface InviteUserDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: InviteUserInput) => void;
}

const roleOptions = ['super_admin', 'admin', 'editor', 'author', 'viewer'];

export function InviteUserDialog({ open, onClose, onSubmit }: InviteUserDialogProps) {
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState('viewer');

  useEffect(() => {
    if (open) {
      setEmail('');
      setFirstName('');
      setLastName('');
      setRole('viewer');
    }
  }, [open]);

  const handleSubmit = () => {
    onSubmit({
      email,
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      role,
    });
  };

  const isValid = email.trim() !== '';

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Invite User</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3} sx={{ mt: 1 }}>
          <TextField
            label="Email Address"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            fullWidth
            required
          />
          <Stack direction="row" spacing={2}>
            <TextField
              label="First Name"
              value={firstName}
              onChange={e => setFirstName(e.target.value)}
              fullWidth
            />
            <TextField
              label="Last Name"
              value={lastName}
              onChange={e => setLastName(e.target.value)}
              fullWidth
            />
          </Stack>
          <FormControl fullWidth>
            <InputLabel>Role</InputLabel>
            <Select
              value={role}
              label="Role"
              onChange={(e) => setRole(e.target.value)}
            >
              {roleOptions.map(r => (
                <MenuItem key={r} value={r}>{r}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={!isValid}>Send Invite</Button>
      </DialogActions>
    </Dialog>
  );
}
