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
  FormControlLabel,
  Checkbox,
  FormGroup,
  Grid,
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

const AVAILABLE_SCOPES = {
  Content: [
    { value: 'read:any', label: 'Read Any' },
    { value: 'create:any', label: 'Create Any' },
    { value: 'update:any', label: 'Update Any' },
    { value: 'delete:any', label: 'Delete Any' },
  ],
  Assets: [
    { value: 'upload', label: 'Upload' },
    { value: 'delete', label: 'Delete' },
  ],
};

export function ApiKeysTab() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [openDialog, setOpenDialog] = useState(false);
  const [name, setName] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<string[]>(['read:any']);
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
      let expiresAt: string | undefined = undefined;
      if (expiresAtStr) {
        expiresAt = new Date(expiresAtStr).toISOString();
      }

      const res = await fetch('/api/auth/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          scopes: selectedScopes,
          expiresAt,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        setNewKeyDetails({ name: name, rawKey: json.data.rawKey });
        setOpenDialog(false);
        setName('');
        setSelectedScopes(['read:any']);
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

  const handleScopeChange = (scope: string, checked: boolean) => {
    if (checked) {
      setSelectedScopes([...selectedScopes, scope]);
    } else {
      setSelectedScopes(selectedScopes.filter(s => s !== scope));
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
            <Button size="small" variant="outlined" color="inherit" onClick={() => void handleCopy()} startIcon={<ContentCopyIcon />}>
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
            
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>Scopes</Typography>
              <Grid container spacing={2}>
                {Object.entries(AVAILABLE_SCOPES).map(([group, scopes]) => (
                  <Grid size={{ xs: 12, sm: 6 }} key={group}>
                    <Typography variant="caption" sx={{ fontWeight: 'bold', textTransform: 'uppercase', mb: 1, display: 'block' }}>{group}</Typography>
                    <FormGroup>
                      {scopes.map(scope => (
                        <FormControlLabel
                          key={scope.value}
                          control={
                            <Checkbox 
                              size="small" 
                              checked={selectedScopes.includes(scope.value)} 
                              onChange={(e) => handleScopeChange(scope.value, e.target.checked)} 
                            />
                          }
                          label={<Typography variant="body2">{scope.label}</Typography>}
                        />
                      ))}
                    </FormGroup>
                  </Grid>
                ))}
              </Grid>
            </Box>

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
          <Button variant="contained" onClick={() => void handleCreate()} disabled={!name || selectedScopes.length === 0}>Create Key</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
