import React from 'react';
import { Stack, Typography, Paper } from '@mui/material';
import { ContentTypeInput } from './types';

export interface StepReviewProps {
  payload: ContentTypeInput;
}

export function StepReview({ payload }: StepReviewProps) {
  return (
    <Stack spacing={2}>
      <Typography variant="h6">Review Content Type</Typography>
      <Paper variant="outlined" sx={{ p: 2, bgcolor: '#0f172a', color: '#38bdf8', overflowX: 'auto' }}>
        <pre style={{ margin: 0, fontFamily: 'monospace', fontSize: '0.85rem' }}>
          {JSON.stringify(payload, null, 2)}
        </pre>
      </Paper>
    </Stack>
  );
}
