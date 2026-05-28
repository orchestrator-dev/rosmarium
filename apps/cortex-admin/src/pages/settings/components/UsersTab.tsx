import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Avatar,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Switch,
  SelectChangeEvent,
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';

interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  role: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export function UsersTab() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const [openDialog, setOpenDialog] = useState(false);
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState('viewer');

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const json = await res.json();
        setUsers(json.data || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchUsers();
  }, []);

  const handleInvite = async () => {
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          firstName: firstName || undefined,
          lastName: lastName || undefined,
          role,
        }),
      });
      if (res.ok) {
        setOpenDialog(false);
        setEmail('');
        setFirstName('');
        setLastName('');
        setRole('viewer');
        void fetchUsers();
      } else {
        const err = await res.json();
        alert('Failed to invite user: ' + (err.error?.message || 'Unknown error'));
      }
    } catch (e) {
      console.error(e);
      alert('Error inviting user');
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
    try {
      await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
    } catch (e) {
      console.error(e);
      alert('Failed to update role');
      void fetchUsers(); // Revert on failure
    }
  };

  const handleToggleActive = async (userId: string, currentActive: boolean) => {
    const newActive = !currentActive;
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, isActive: newActive } : u));
    try {
      await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: newActive }),
      });
    } catch (e) {
      console.error(e);
      alert('Failed to update status');
      void fetchUsers(); // Revert on failure
    }
  };

  const getInitials = (user: User) => {
    if (user.firstName && user.lastName) return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    if (user.email) return user.email.substring(0, 2).toUpperCase();
    return 'U';
  };

  const roleOptions = ['super_admin', 'admin', 'editor', 'author', 'viewer'];

  return (
    <Box>
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Typography variant="h6">System Users</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpenDialog(true)}>
          Invite User
        </Button>
      </Stack>

      <TableContainer component={Paper} variant="outlined">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>User</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Last Login</TableCell>
              <TableCell align="right">Active</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} align="center">Loading...</TableCell></TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                  <Typography variant="body1" color="text.secondary" gutterBottom>
                    No users yet.
                  </Typography>
                  <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setOpenDialog(true)}>
                    Invite your first user
                  </Button>
                </TableCell>
              </TableRow>
            ) : (
              users.map(user => (
                <TableRow key={user.id}>
                  <TableCell>
                    <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
                      <Avatar src={user.avatarUrl || undefined} sx={{ width: 32, height: 32, bgcolor: '#6366F1' }}>
                        {getInitials(user)}
                      </Avatar>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                          {user.firstName || user.lastName ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : 'Unknown'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {user.email}
                        </Typography>
                      </Box>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Select
                      size="small"
                      value={user.role}
                      onChange={(e: SelectChangeEvent) => void handleRoleChange(user.id, e.target.value)}
                      sx={{ minWidth: 120, '.MuiOutlinedInput-notchedOutline': { border: 'none' }, bgcolor: 'rgba(255,255,255,0.05)' }}
                    >
                      {roleOptions.map(r => (
                        <MenuItem key={r} value={r}>{r}</MenuItem>
                      ))}
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={user.isActive ? "Active" : "Inactive"} 
                      size="small" 
                      color={user.isActive ? "success" : "default"} 
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : 'Never'}
                  </TableCell>
                  <TableCell align="right">
                    <Switch 
                      checked={user.isActive} 
                      onChange={() => void handleToggleActive(user.id, user.isActive)} 
                      color="primary"
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
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
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => void handleInvite()} disabled={!email}>Send Invite</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
