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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  OutlinedInput,
  SelectChangeEvent,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  
  Edit as EditIcon,
} from '@mui/icons-material';

interface Webhook {
  id: string;
  name: string;
  url: string;
  events: string[];
  contentTypes: string[];
  isActive: boolean;
  createdAt: string;
}

const AVAILABLE_EVENTS = [
  'entry.created',
  'entry.updated',
  'entry.deleted',
  'entry.published',
  'entry.unpublished',
];

export function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [openDialog, setOpenDialog] = useState(false);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [contentTypes, setContentTypes] = useState<string>('');

  const fetchWebhooks = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/webhooks');
      if (res.ok) {
        const json = await res.json() as { data: Webhook[] };
        setWebhooks(json.data || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchWebhooks();
  }, []);

  const handleCreate = async () => {
    try {
      const ctArray = contentTypes.split(',').map(s => s.trim()).filter(Boolean);
      const res = await fetch('/api/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          url,
          events: selectedEvents,
          contentTypes: ctArray,
        }),
      });
      if (res.ok) {
        setOpenDialog(false);
        setName('');
        setUrl('');
        setSelectedEvents([]);
        setContentTypes('');
        void fetchWebhooks();
      } else {
        alert('Failed to create webhook');
      }
    } catch (e) {
      console.error(e);
      alert('Error creating webhook');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this webhook?')) return;
    await fetch(`/api/webhooks/${id}`, { method: 'DELETE' });
    void fetchWebhooks();
  };

  const handleEventChange = (event: SelectChangeEvent<typeof selectedEvents>) => {
    const {
      target: { value },
    } = event;
    setSelectedEvents(
      typeof value === 'string' ? value.split(',') : value,
    );
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
      <Stack direction="row" sx={{justifyContent: "space-between", alignItems: "center", mb: 4}}>
        <Box>
          <Typography variant="h1" gutterBottom>
            Webhooks
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage outgoing webhooks for content events.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpenDialog(true)}>
          New Webhook
        </Button>
      </Stack>

      <TableContainer component={Paper} variant="outlined">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>URL</TableCell>
              <TableCell>Events</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} align="center">Loading...</TableCell></TableRow>
            ) : webhooks.length === 0 ? (
              <TableRow><TableCell colSpan={5} align="center">No webhooks found.</TableCell></TableRow>
            ) : (
              webhooks.map(wh => (
                <TableRow key={wh.id}>
                  <TableCell sx={{ fontWeight: 'bold' }}>{wh.name}</TableCell>
                  <TableCell sx={{ fontFamily: 'monospace' }}>{wh.url}</TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
                      {wh.events.map(ev => (
                        <Chip key={ev} size="small" label={ev} sx={{ mb: 0.5 }} />
                      ))}
                    </Stack>
                  </TableCell>
                  <TableCell>
                    {wh.isActive ? <Chip size="small" label="Active" color="success" /> : <Chip size="small" label="Inactive" color="default" />}
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" color="primary">
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" color="error" onClick={() => void handleDelete(wh.id)}>
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
        <DialogTitle>Create Webhook</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <TextField
              label="Name"
              value={name}
              onChange={e => setName(e.target.value)}
              fullWidth
              required
            />
            <TextField
              label="Payload URL"
              value={url}
              onChange={e => setUrl(e.target.value)}
              fullWidth
              required
              placeholder="https://example.com/webhook"
            />
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
              label="Filter Content Types (optional)"
              value={contentTypes}
              onChange={e => setContentTypes(e.target.value)}
              fullWidth
              helperText="Comma separated list of content types (e.g., article, post). Leave empty for all."
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => void handleCreate()}>Create Webhook</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
