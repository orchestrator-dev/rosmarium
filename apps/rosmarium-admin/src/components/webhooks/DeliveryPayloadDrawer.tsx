import React from 'react';
import { Drawer, Box, Stack, Typography, Chip, Paper } from '@mui/material';
import type { WebhookDelivery } from '../../api/webhooks';

export interface DeliveryPayloadDrawerProps {
  delivery: WebhookDelivery | null;
  onClose: () => void;
}

export function DeliveryPayloadDrawer({ delivery, onClose }: DeliveryPayloadDrawerProps) {
  return (
    <Drawer
      anchor="right"
      open={Boolean(delivery)}
      onClose={onClose}
      sx={{ '& .MuiDrawer-paper': { width: 500, p: 3, bgcolor: 'background.default' } }}
    >
      {delivery && (
        <Box>
          <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 3 }}>
            <Typography variant="h6">Delivery Payload</Typography>
            <Chip label={delivery.event} size="small" color="primary" />
          </Stack>

          <Typography variant="subtitle2" gutterBottom color="text.secondary">Request Payload</Typography>
          <Paper variant="outlined" sx={{ p: 2, mb: 3, bgcolor: '#1e1e1e', overflowX: 'auto' }}>
            <pre style={{ margin: 0, color: '#d4d4d4', fontSize: '0.8rem', fontFamily: 'monospace' }}>
              {JSON.stringify(delivery.payload, null, 2)}
            </pre>
          </Paper>

          <Typography variant="subtitle2" gutterBottom color="text.secondary">Response Body (Code: {delivery.responseCode})</Typography>
          <Paper variant="outlined" sx={{ p: 2, bgcolor: '#1e1e1e', overflowX: 'auto' }}>
            <pre style={{ margin: 0, color: '#d4d4d4', fontSize: '0.8rem', fontFamily: 'monospace' }}>
              {delivery.responseBody || '(No response body)'}
            </pre>
          </Paper>
        </Box>
      )}
    </Drawer>
  );
}
