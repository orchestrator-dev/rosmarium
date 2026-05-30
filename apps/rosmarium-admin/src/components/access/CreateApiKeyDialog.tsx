import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Stack,
  TextField, Box, Typography, Button, Grid, FormGroup, FormControlLabel, Checkbox
} from '@mui/material';
import type { CreateApiKeyInput } from '../../api/api-keys';

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

export interface CreateApiKeyDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CreateApiKeyInput) => void;
}

export function CreateApiKeyDialog({ open, onClose, onSubmit }: CreateApiKeyDialogProps) {
  const [name, setName] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<string[]>(['read:any']);
  const [expiresAtStr, setExpiresAtStr] = useState('');

  useEffect(() => {
    if (open) {
      setName('');
      setSelectedScopes(['read:any']);
      setExpiresAtStr('');
    }
  }, [open]);

  const handleScopeChange = (scope: string, checked: boolean) => {
    if (checked) {
      setSelectedScopes([...selectedScopes, scope]);
    } else {
      setSelectedScopes(selectedScopes.filter(s => s !== scope));
    }
  };

  const handleSubmit = () => {
    let expiresAt: string | undefined = undefined;
    if (expiresAtStr) {
      expiresAt = new Date(expiresAtStr).toISOString();
    }
    onSubmit({ name, scopes: selectedScopes, expiresAt });
  };

  const isValid = name.trim() !== '' && selectedScopes.length > 0;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
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
            slotProps={{ inputLabel: { shrink: true } }}
            helperText="Leave empty for never expiring"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={!isValid}>Create Key</Button>
      </DialogActions>
    </Dialog>
  );
}
