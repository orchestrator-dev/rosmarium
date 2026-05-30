import React from 'react';
import {
  Alert, AlertTitle, Typography, Paper, Button, Box
} from '@mui/material';
import { ContentCopy as ContentCopyIcon } from '@mui/icons-material';

export interface RawKeyRevealDialogProps {
  rawKey: string | null;
  onDismiss: () => void;
}

export function RawKeyRevealDialog({ rawKey, onDismiss }: RawKeyRevealDialogProps) {
  if (!rawKey) return null;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(rawKey);
    alert('Copied to clipboard');
  };

  return (
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
          {rawKey}
        </Typography>
        <Button size="small" variant="outlined" color="inherit" onClick={() => void handleCopy()} startIcon={<ContentCopyIcon />}>
          Copy
        </Button>
      </Paper>
      <Box sx={{ mt: 1, display: 'flex', justifyContent: 'flex-end' }}>
        <Button size="small" onClick={onDismiss}>
          Dismiss
        </Button>
      </Box>
    </Alert>
  );
}
