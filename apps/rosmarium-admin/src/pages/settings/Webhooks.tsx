import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Button, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, IconButton, Stack, Switch, Grid
} from '@mui/material';
import {
  Add as AddIcon, Delete as DeleteIcon, Autorenew as AutorenewIcon
} from '@mui/icons-material';

import {
  listWebhooks, createWebhook, updateWebhook, deleteWebhook, getDeliveries, replayDelivery,
  Webhook, WebhookDelivery, CreateWebhookInput
} from '../../api/webhooks';

import { CreateWebhookDialog } from '../../components/webhooks/CreateWebhookDialog';
import { DeliveryHistoryTable } from '../../components/webhooks/DeliveryHistoryTable';
import { DeliveryPayloadDrawer } from '../../components/webhooks/DeliveryPayloadDrawer';

export function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [openDialog, setOpenDialog] = useState(false);

  const [selectedWebhookId, setSelectedWebhookId] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [deliveriesLoading, setDeliveriesLoading] = useState(false);
  
  const [selectedPayload, setSelectedPayload] = useState<WebhookDelivery | null>(null);

  const fetchWebhooks = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listWebhooks();
      setWebhooks(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDeliveries = useCallback(async (webhookId: string, showLoader = true) => {
    if (showLoader) setDeliveriesLoading(true);
    try {
      const data = await getDeliveries(webhookId);
      setDeliveries(data);
    } catch (e) {
      console.error(e);
    } finally {
      if (showLoader) setDeliveriesLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchWebhooks();
  }, [fetchWebhooks]);

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
  }, [selectedWebhookId, fetchDeliveries]);

  const handleCreate = async (input: CreateWebhookInput) => {
    try {
      await createWebhook(input);
      setOpenDialog(false);
      void fetchWebhooks();
    } catch (e) {
      console.error(e);
      alert('Error creating webhook');
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      await updateWebhook(id, { isActive: !currentStatus });
      void fetchWebhooks();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Delete this webhook?')) return;
    try {
      await deleteWebhook(id);
      if (selectedWebhookId === id) {
        setSelectedWebhookId(null);
      }
      void fetchWebhooks();
    } catch (e) {
      console.error(e);
    }
  };

  const handleReplay = async (dId: string) => {
    if (!selectedWebhookId) return;
    try {
      await replayDelivery(selectedWebhookId, dId);
      void fetchDeliveries(selectedWebhookId, true);
    } catch (e) {
      console.error(e);
      alert('Failed to replay delivery');
    }
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
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpenDialog(true)}>
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
                    <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setOpenDialog(true)} sx={{ mt: 1 }}>Add Webhook</Button>
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
              <DeliveryHistoryTable 
                deliveries={deliveries} 
                loading={deliveriesLoading} 
                onReplay={handleReplay} 
                onViewPayload={setSelectedPayload} 
              />
            </Paper>
          </Grid>
        )}
      </Grid>

      <CreateWebhookDialog 
        open={openDialog} 
        onClose={() => setOpenDialog(false)} 
        onSubmit={handleCreate} 
      />

      <DeliveryPayloadDrawer 
        delivery={selectedPayload} 
        onClose={() => setSelectedPayload(null)} 
      />
    </Box>
  );
}
