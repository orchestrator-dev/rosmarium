import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Button, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, IconButton, Stack
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';

import { listApiKeys, createApiKey, revokeApiKey, ApiKey, CreateApiKeyInput } from '../../../api/api-keys';
import { CreateApiKeyDialog } from '../../../components/access/CreateApiKeyDialog';
import { RawKeyRevealDialog } from '../../../components/access/RawKeyRevealDialog';

export function ApiKeysTab() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [openDialog, setOpenDialog] = useState(false);
  const [newKeyDetails, setNewKeyDetails] = useState<{ name: string; rawKey: string } | null>(null);

  const fetchApiKeys = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listApiKeys();
      setApiKeys(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchApiKeys();
  }, [fetchApiKeys]);

  const handleCreate = async (input: CreateApiKeyInput) => {
    try {
      const { rawKey } = await createApiKey(input);
      setNewKeyDetails({ name: input.name, rawKey });
      setOpenDialog(false);
      void fetchApiKeys();
    } catch (e) {
      console.error(e);
      alert('Error creating API key');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Revoke this API key? This cannot be undone.')) return;
    try {
      await revokeApiKey(id);
      void fetchApiKeys();
    } catch (e) {
      console.error(e);
      alert('Error revoking API key');
    }
  };

  return (
    <Box>
      <Stack direction="row" sx={{justifyContent: "space-between", alignItems: "center", mb: 3}}>
        <Typography variant="h6">
          API Keys
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpenDialog(true)}>
          New API Key
        </Button>
      </Stack>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Manage your API keys for programmatic access to Rosmarium. Be sure to select the minimum required scopes.
      </Typography>

      <RawKeyRevealDialog 
        rawKey={newKeyDetails?.rawKey || null} 
        onDismiss={() => setNewKeyDetails(null)} 
      />

      <TableContainer component={Paper} variant="outlined">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Scopes</TableCell>
              <TableCell>Created</TableCell>
              <TableCell>Last Used</TableCell>
              <TableCell>Expires</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} align="center">Loading...</TableCell></TableRow>
            ) : apiKeys.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                  <Typography variant="body1" color="text.secondary" gutterBottom>
                    No API keys found.
                  </Typography>
                  <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setOpenDialog(true)}>
                    Create API Key
                  </Button>
                </TableCell>
              </TableRow>
            ) : (
              apiKeys.map(key => (
                <TableRow key={key.id}>
                  <TableCell sx={{ fontWeight: 'bold' }}>{key.name}</TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
                      {key.scopes.map(scope => (
                        <Chip key={scope} size="small" label={scope} sx={{ mb: 0.5 }} />
                      ))}
                    </Stack>
                  </TableCell>
                  <TableCell>{new Date(key.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell>{key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString() : 'Never'}</TableCell>
                  <TableCell>{key.expiresAt ? new Date(key.expiresAt).toLocaleDateString() : 'Never'}</TableCell>
                  <TableCell align="right">
                    <IconButton size="small" color="error" onClick={() => void handleDelete(key.id)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <CreateApiKeyDialog 
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        onSubmit={handleCreate}
      />
    </Box>
  );
}
