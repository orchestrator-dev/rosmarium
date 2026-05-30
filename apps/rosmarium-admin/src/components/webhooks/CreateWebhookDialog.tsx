import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Stack,
  TextField, Box, Typography, Button, FormControl, InputLabel,
  Select, MenuItem, OutlinedInput, Chip, SelectChangeEvent
} from '@mui/material';
import type { CreateWebhookInput } from '../../api/webhooks';

export const AVAILABLE_EVENTS = [
  'entry.created',
  'entry.updated',
  'entry.deleted',
  'entry.published',
  'entry.unpublished',
  'asset.uploaded'
];

export interface CreateWebhookDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CreateWebhookInput) => void;
}

export function CreateWebhookDialog({ open, onClose, onSubmit }: CreateWebhookDialogProps) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [contentTypes, setContentTypes] = useState('');

  useEffect(() => {
    if (open) {
      setSecret(crypto.randomUUID());
      setName('');
      setUrl('');
      setSelectedEvents([]);
      setContentTypes('');
    }
  }, [open]);

  const handleEventChange = (event: SelectChangeEvent<typeof selectedEvents>) => {
    const { target: { value } } = event;
    setSelectedEvents(typeof value === 'string' ? value.split(',') : value);
  };

  const handleSubmit = () => {
    const ctArray = contentTypes.split(',').map(s => s.trim()).filter(Boolean);
    onSubmit({
      name,
      url,
      secret: secret || undefined,
      events: selectedEvents,
      contentTypes: ctArray,
    });
  };

  const isValid = name.trim() !== '' && url.trim() !== '' && selectedEvents.length > 0;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add Webhook</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3} sx={{ mt: 1 }}>
          <TextField 
            label="Name" 
            value={name} 
            onChange={e => setName(e.target.value)} 
            fullWidth 
            required 
            placeholder="e.g. Production Vercel Deploy" 
          />
          <TextField 
            label="URL" 
            value={url} 
            onChange={e => setUrl(e.target.value)} 
            fullWidth 
            required 
            placeholder="https://example.com/webhook" 
            type="url" 
          />
          
          <Box>
            <Typography variant="caption" color="text.secondary" gutterBottom>Secret</Typography>
            <Stack direction="row" spacing={1}>
              <TextField value={secret} fullWidth disabled size="small" sx={{ fontFamily: 'monospace' }} />
              <Button variant="outlined" onClick={() => setSecret(crypto.randomUUID())}>Regenerate</Button>
            </Stack>
          </Box>

          <FormControl fullWidth required>
            <InputLabel>Events</InputLabel>
            <Select
              multiple
              value={selectedEvents}
              onChange={handleEventChange}
              input={<OutlinedInput label="Events" />}
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {selected.map((value) => (
                    <Chip key={value} label={value} size="small" />
                  ))}
                </Box>
              )}
            >
              {AVAILABLE_EVENTS.map((name) => (
                <MenuItem key={name} value={name}>
                  {name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="Content Types"
            value={contentTypes}
            onChange={e => setContentTypes(e.target.value)}
            fullWidth
            helperText="Comma separated list of content types. Leave empty for all."
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={!isValid}>Submit</Button>
      </DialogActions>
    </Dialog>
  );
}
