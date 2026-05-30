import React from 'react';
import {
  TableContainer, Table, TableHead, TableBody, TableRow, TableCell,
  Chip, Stack, Tooltip, IconButton
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon, Cancel as CancelIcon,
  Replay as ReplayIcon, Visibility as VisibilityIcon
} from '@mui/icons-material';
import type { WebhookDelivery } from '../../api/webhooks';

export interface DeliveryHistoryTableProps {
  deliveries: WebhookDelivery[];
  loading: boolean;
  onReplay: (deliveryId: string) => void;
  onViewPayload: (delivery: WebhookDelivery) => void;
}

export function DeliveryHistoryTable({ deliveries, loading, onReplay, onViewPayload }: DeliveryHistoryTableProps) {
  return (
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
          {loading && deliveries.length === 0 ? (
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
                        <IconButton size="small" onClick={() => onReplay(d.id)} color="primary">
                          <ReplayIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    <Tooltip title="View Payload">
                      <IconButton size="small" onClick={() => onViewPayload(d)}>
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
  );
}
