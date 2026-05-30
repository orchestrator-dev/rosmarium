import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Button, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, Stack, Avatar, Select, MenuItem, Switch, SelectChangeEvent,
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';

import { listUsers, updateUser, inviteUser, User, InviteUserInput } from '../../../api/users';
import { InviteUserDialog } from '../../../components/access/InviteUserDialog';
import { RoleChip } from '../../../components/access/RoleChip';

export function UsersTab() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listUsers();
      setUsers(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  const handleInvite = async (input: InviteUserInput) => {
    try {
      await inviteUser(input);
      setOpenDialog(false);
      void fetchUsers();
    } catch (e) {
      console.error(e);
      alert('Failed to invite user: ' + (e instanceof Error ? e.message : String(e)));
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
    try {
      await updateUser(userId, { role: newRole });
    } catch (e) {
      console.error(e);
      alert('Failed to update role');
      void fetchUsers();
    }
  };

  const handleToggleActive = async (userId: string, currentActive: boolean) => {
    const newActive = !currentActive;
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, isActive: newActive } : u));
    try {
      await updateUser(userId, { isActive: newActive });
    } catch (e) {
      console.error(e);
      alert('Failed to update status');
      void fetchUsers();
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
                      renderValue={(selected) => <RoleChip role={selected} />}
                    >
                      {roleOptions.map(r => (
                        <MenuItem key={r} value={r}><RoleChip role={r} /></MenuItem>
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

      <InviteUserDialog 
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        onSubmit={handleInvite}
      />
    </Box>
  );
}
