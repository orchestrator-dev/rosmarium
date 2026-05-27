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
  IconButton,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  AlertTitle,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  ContentCopy as ContentCopyIcon,
} from '@mui/icons-material';

interface ApiKey {
  id: string;
  name: string;
  scopes: string[];
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}

export function AccessControlPage() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [openDialog, setOpenDialog] = useState(false);
  const [name, setName] = useState('');
  const [scopesStr, setScopesStr] = useState('read:content,write:content');
  const [expiresAtStr, setExpiresAtStr] = useState('');
  
  const [newKeyDetails, setNewKeyDetails] = useState<{ name: string; rawKey: string } | null>(null);

  const fetchApiKeys = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/api-keys');
      if (res.ok) {
        const json = await res.json();
        setApiKeys(json.data || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchApiKeys();
  }, []);

  const handleCreate = async () => {
    try {
      const scopesArray = scopesStr.split(',').map(s => s.trim()).filter(Boolean);
      let expiresAt: string | undefined = undefined;
      if (expiresAtStr) {
        expiresAt = new Date(expiresAtStr).toISOString();
      }

      const res = await fetch('/api/auth/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          scopes: scopesArray,
          expiresAt,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        setNewKeyDetails({ name: name, rawKey: json.data.rawKey });
        setOpenDialog(false);
        setName('');
        setScopesStr('read:content,write:content');
        setExpiresAtStr('');
        void fetchApiKeys();
      } else {
        alert('Failed to create API key');
      }
    } catch (e) {
      console.error(e);
      alert('Error creating API key');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Revoke this API key? This cannot be undone.')) return;
    await fetch(`/api/auth/api-keys/${id}`, { method: 'DELETE' });
    void fetchApiKeys();
  };

  const handleCopy = async () => {
    if (newKeyDetails) {
      await navigator.clipboard.writeText(newKeyDetails.rawKey);
      alert('Copied to clipboard');
    }
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
      <Stack direction="row" sx={{justifyContent: "space-between", alignItems: "center", mb: 4}}>
        <Box>
          <Typography variant="h1" gutterBottom>
            Access Control
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage your API keys for programmatic access to Cortex.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpenDialog(true)}>
          New API Key
        </Button>
      </Stack>

      {newKeyDetails && (
        <Alert severity="success" sx={{ mb: 4 }}>
          <AlertTitle>API Key Created</AlertTitle>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Please copy your new API key now. You won't be able to see it again!
          </Typography>
          <Paper 
            variant="outlined" 
            sx={{ 
              p: 2, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              bgcolor: 'rgba(255,255,255,0.05)'
            }}
          >
            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
              {newKeyDetails.rawKey}
            </Typography>
            <Button size="small" variant="outlined" color="inherit" onClick={handleCopy} startIcon={<ContentCopyIcon />}>
              Copy
            </Button>
          </Paper>
          <Button size="small" onClick={() => setNewKeyDetails(null)} sx={{ mt: 1 }}>
            Dismiss
          </Button>
        </Alert>
      )}

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
              <TableRow><TableCell colSpan={6} align="center">No API keys found.</TableCell></TableRow>
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

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create API Key</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <TextField
              label="Name"
              value={name}
              onChange={e => setName(e.target.value)}
              fullWidth
              required
              helperText="A descriptive name for this key"
            />
            <TextField
              label="Scopes (comma separated)"
              value={scopesStr}
              onChange={e => setScopesStr(e.target.value)}
              fullWidth
              required
              helperText="e.g. read:content, write:content, delete:content"
            />
            <TextField
              label="Expiration Date"
              type="datetime-local"
              value={expiresAtStr}
              onChange={e => setExpiresAtStr(e.target.value)}
              fullWidth
              slotProps={{
                inputLabel: { shrink: true }
              }}
              helperText="Leave empty for never expiring"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => void handleCreate()}>Create Key</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
