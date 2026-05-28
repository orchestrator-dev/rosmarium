import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Button, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, IconButton, Stack, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, FormControl, InputLabel,
  Select, MenuItem, OutlinedInput, SelectChangeEvent, Switch, Drawer, Grid, Tooltip
} from '@mui/material';
import {
  Add as AddIcon, Delete as DeleteIcon, Autorenew as AutorenewIcon,
  Replay as ReplayIcon, Visibility as VisibilityIcon,
  CheckCircle as CheckCircleIcon, Cancel as CancelIcon
} from '@mui/icons-material';

interface Webhook {
  id: string;
  name: string;
  url: string;
  secret: string;
  events: string[];
  contentTypes: string[];
  isActive: boolean;
  createdAt: string;
}

interface WebhookDelivery {
  id: string;
  webhookId: string;
  event: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any;
  responseCode: number | null;
  responseBody: string | null;
  durationMs: number | null;
  success: boolean;
  attempt: number;
  createdAt: string;
}

const AVAILABLE_EVENTS = [
  'entry.created',
  'entry.updated',
  'entry.deleted',
  'entry.published',
  'entry.unpublished',
  'asset.uploaded'
];

export function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [openDialog, setOpenDialog] = useState(false);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [contentTypes, setContentTypes] = useState<string>('');

  const [selectedWebhookId, setSelectedWebhookId] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [deliveriesLoading, setDeliveriesLoading] = useState(false);
  
  const [selectedPayload, setSelectedPayload] = useState<WebhookDelivery | null>(null);

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

  const fetchDeliveries = async (webhookId: string, showLoader = true) => {
    if (showLoader) setDeliveriesLoading(true);
    try {
      const res = await fetch(`/api/webhooks/${webhookId}/deliveries?limit=20`);
      if (res.ok) {
        const json = await res.json() as { data: WebhookDelivery[] };
        setDeliveries(json.data || []);
      }
    } finally {
      if (showLoader) setDeliveriesLoading(false);
    }
  };

  useEffect(() => {
    void fetchWebhooks();
  }, []);

  useEffect(() => {
    if (!selectedWebhookId) {
      setDeliveries([]);
      return;
    }
    
    void fetchDeliveries(selectedWebhookId, true);
    
    const interval = setInterval(() => {
      void fetchDeliveries(selectedWebhookId, false);
    }, 10000);
    
    return () => clearInterval(interval);
  }, [selectedWebhookId]);

  const handleCreate = async () => {
    try {
      const ctArray = contentTypes.split(',').map(s => s.trim()).filter(Boolean);
      const payload = {
        name,
        url,
        secret: secret || undefined,
        events: selectedEvents,
        contentTypes: ctArray,
      };
      console.log('Submitting webhook payload:', payload);
      const res = await fetch('/api/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setOpenDialog(false);
        setName('');
        setUrl('');
        setSecret('');
        setSelectedEvents([]);
        setContentTypes('');
        void fetchWebhooks();
      } else {
        const errText = await res.text();
        console.error('Failed to create webhook', errText);
        alert('Failed to create webhook');
      }
    } catch (e) {
      console.error(e);
      alert('Error creating webhook');
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      const res = await fetch(`/api/webhooks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentStatus }),
      });
      if (res.ok) {
        void fetchWebhooks();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Delete this webhook?')) return;
    await fetch(`/api/webhooks/${id}`, { method: 'DELETE' });
    if (selectedWebhookId === id) {
      setSelectedWebhookId(null);
    }
    void fetchWebhooks();
  };

  const handleReplay = async (dId: string) => {
    if (!selectedWebhookId) return;
    try {
      const res = await fetch(`/api/webhooks/${selectedWebhookId}/deliveries/${dId}/replay`, {
        method: 'POST',
      });
      if (res.ok) {
        void fetchDeliveries(selectedWebhookId, true);
      } else {
        alert('Failed to replay delivery');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleEventChange = (event: SelectChangeEvent<typeof selectedEvents>) => {
    const { target: { value } } = event;
    setSelectedEvents(typeof value === 'string' ? value.split(',') : value);
  };

  const openCreateDialog = () => {
    setSecret(crypto.randomUUID());
    setName('');
    setUrl('');
    setSelectedEvents([]);
    setContentTypes('');
    setOpenDialog(true);
  };

  return (
    <Box sx={{ maxWidth: 1600, mx: 'auto', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 4 }}>
        <Box>
          <Typography variant="h1" gutterBottom sx={{ fontSize: '2rem' }}>
            Webhooks
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage outgoing webhooks for content events.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateDialog}>
          Add Webhook
        </Button>
      </Stack>

      <Grid container spacing={3} sx={{ flexGrow: 1, minHeight: 0 }}>
        {/* Panel 1: Webhook List */}
        <Grid size={{ xs: selectedWebhookId ? 6 : 12 }} sx={{ display: 'flex', flexDirection: 'column' }}>
          <TableContainer component={Paper} variant="outlined" sx={{ flexGrow: 1 }}>
            <Table stickyHeader>
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
                  <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4 }}>Loading...</TableCell></TableRow>
                ) : webhooks.length === 0 ? (
                  <TableRow><TableCell colSpan={5} align="center" sx={{ py: 8 }}>
                    <Typography color="text.secondary" gutterBottom>No webhooks configured yet</Typography>
                    <Button variant="outlined" startIcon={<AddIcon />} onClick={openCreateDialog} sx={{ mt: 1 }}>Add Webhook</Button>
                  </TableCell></TableRow>
                ) : (
                  webhooks.map(wh => (
                    <TableRow 
                      key={wh.id} 
                      hover 
                      onClick={() => setSelectedWebhookId(wh.id)}
                      sx={{ 
                        cursor: 'pointer',
                        backgroundColor: selectedWebhookId === wh.id ? 'action.selected' : 'inherit'
                      }}
                    >
                      <TableCell sx={{ fontWeight: 'bold' }}>{wh.name}</TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.85rem', color: 'text.secondary', whiteSpace: 'nowrap' }}>
                        {wh.url.length > 40 ? `${wh.url.substring(0, 40)}...` : wh.url}
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap", gap: 0.5 }}>
                          {wh.events.map(ev => (
                            <Chip key={ev} size="small" label={ev} variant="outlined" />
                          ))}
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Switch 
                          checked={wh.isActive} 
                          onClick={(e) => { e.stopPropagation(); handleToggleStatus(wh.id, wh.isActive); }} 
                          color="success"
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="right">
                        <IconButton size="small" color="error" onClick={(e) => handleDelete(wh.id, e)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Grid>

        {/* Panel 2: Delivery History */}
        {selectedWebhookId && (
          <Grid size={{ xs: 6 }} sx={{ display: 'flex', flexDirection: 'column' }}>
            <Paper variant="outlined" sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6" sx={{ fontSize: '1.1rem' }}>Delivery History</Typography>
                <IconButton size="small" onClick={() => fetchDeliveries(selectedWebhookId, true)}>
                  <AutorenewIcon fontSize="small" />
                </IconButton>
              </Box>
              <TableContainer sx={{ flexGrow: 1 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Event</TableCell>
                      <TableCell>Timestamp</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Code</TableCell>
                      <TableCell>Duration</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {deliveriesLoading && deliveries.length === 0 ? (
                      <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4 }}>Loading...</TableCell></TableRow>
                    ) : deliveries.length === 0 ? (
                      <TableRow><TableCell colSpan={6} align="center" sx={{ py: 8, color: 'text.secondary' }}>No deliveries yet — webhook will appear here after first trigger</TableCell></TableRow>
                    ) : (
                      deliveries.map(d => (
                        <TableRow key={d.id} hover>
                          <TableCell sx={{ fontSize: '0.85rem' }}>{d.event}</TableCell>
                          <TableCell sx={{ fontSize: '0.85rem', color: 'text.secondary', whiteSpace: 'nowrap' }}>
                            {new Date(d.createdAt).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            {d.success ? (
                              <Chip size="small" icon={<CheckCircleIcon />} label="Success" color="success" variant="outlined" sx={{ height: 24 }} />
                            ) : (
                              <Chip size="small" icon={<CancelIcon />} label="Failed" color="error" variant="outlined" sx={{ height: 24 }} />
                            )}
                          </TableCell>
                          <TableCell sx={{ fontSize: '0.85rem', fontFamily: 'monospace' }}>
                            {d.responseCode || '—'}
                          </TableCell>
                          <TableCell sx={{ fontSize: '0.85rem' }}>
                            {d.durationMs ? `${d.durationMs}ms` : '—'}
                          </TableCell>
                          <TableCell align="right">
                            <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
                              {!d.success && (
                                <Tooltip title="Replay">
                                  <IconButton size="small" onClick={() => handleReplay(d.id)} color="primary">
                                    <ReplayIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              )}
                              <Tooltip title="View Payload">
                                <IconButton size="small" onClick={() => setSelectedPayload(d)}>
                                  <VisibilityIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>
        )}
      </Grid>

      {/* Add Webhook Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Webhook</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <TextField label="Name" value={name} onChange={e => setName(e.target.value)} fullWidth required placeholder="e.g. Production Vercel Deploy" />
            <TextField label="URL" value={url} onChange={e => setUrl(e.target.value)} fullWidth required placeholder="https://example.com/webhook" type="url" />
            
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
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => void handleCreate()}>Submit</Button>
        </DialogActions>
      </Dialog>

      {/* Payload Drawer */}
      <Drawer
        anchor="right"
        open={Boolean(selectedPayload)}
        onClose={() => setSelectedPayload(null)}
        sx={{ '& .MuiDrawer-paper': { width: 500, p: 3, bgcolor: 'background.default' } }}
      >
        {selectedPayload && (
          <Box>
            <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 3 }}>
              <Typography variant="h6">Delivery Payload</Typography>
              <Chip label={selectedPayload.event} size="small" color="primary" />
            </Stack>

            <Typography variant="subtitle2" gutterBottom color="text.secondary">Request Payload</Typography>
            <Paper variant="outlined" sx={{ p: 2, mb: 3, bgcolor: '#1e1e1e', overflowX: 'auto' }}>
              <pre style={{ margin: 0, color: '#d4d4d4', fontSize: '0.8rem', fontFamily: 'monospace' }}>
                {JSON.stringify(selectedPayload.payload, null, 2)}
              </pre>
            </Paper>

            <Typography variant="subtitle2" gutterBottom color="text.secondary">Response Body (Code: {selectedPayload.responseCode})</Typography>
            <Paper variant="outlined" sx={{ p: 2, bgcolor: '#1e1e1e', overflowX: 'auto' }}>
              <pre style={{ margin: 0, color: '#d4d4d4', fontSize: '0.8rem', fontFamily: 'monospace' }}>
                {selectedPayload.responseBody || '(No response body)'}
              </pre>
            </Paper>
          </Box>
        )}
      </Drawer>
    </Box>
  );
}
