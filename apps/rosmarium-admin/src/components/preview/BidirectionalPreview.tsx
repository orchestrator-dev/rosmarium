import React, { useEffect, useRef, useState } from 'react';
import { Box, Typography, Button, Paper } from '@mui/material';
import { PreviewV2Client, PreviewMessage } from '@orchestrator.dev/rosmarium-sdk';

interface BidirectionalPreviewProps {
  previewUrl: string;
  initialData: any;
  onFieldFocus?: (fieldId: string) => void;
  onDataUpdate?: (newData: any) => void;
}

export function BidirectionalPreview({ previewUrl, initialData, onFieldFocus, onDataUpdate }: BidirectionalPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const clientRef = useRef<PreviewV2Client | null>(null);
  const [status, setStatus] = useState<'loading' | 'connected' | 'error'>('loading');

  useEffect(() => {
    clientRef.current = new PreviewV2Client(true);

    const unsubscribe = clientRef.current.subscribe((msg: PreviewMessage) => {
      switch (msg.type) {
        case 'ROSMARIUM_ELEMENT_CLICK':
          if (onFieldFocus) {
            onFieldFocus(msg.payload.fieldId);
          }
          break;
        case 'ROSMARIUM_FIELD_UPDATE':
          // In a real app, you would apply the diff
          console.log('Received reverse update from preview:', msg.payload);
          break;
        // Handle other messages...
      }
    });

    return () => {
      unsubscribe();
      clientRef.current?.cleanup();
    };
  }, [onFieldFocus]);

  const handleIframeLoad = () => {
    setStatus('connected');
    // Initialize the iframe with current data
    if (clientRef.current && iframeRef.current?.contentWindow) {
      clientRef.current.sendMessage({
        type: 'ROSMARIUM_INIT',
        payload: { initialData, locale: 'en' }
      }, iframeRef.current.contentWindow);
    }
  };

  // Whenever parent data changes, push to iframe
  useEffect(() => {
    if (status === 'connected' && clientRef.current && iframeRef.current?.contentWindow) {
      clientRef.current.sendMessage({
        type: 'ROSMARIUM_FIELD_UPDATE',
        payload: { field: '*', value: initialData }
      }, iframeRef.current.contentWindow);
    }
  }, [initialData, status]);

  return (
    <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 1, bgcolor: '#333', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="caption">Preview: {status}</Typography>
        <Button size="small" variant="outlined" color="inherit">Refresh</Button>
      </Box>
      <Box sx={{ flexGrow: 1, position: 'relative' }}>
        <iframe
          ref={iframeRef}
          src={previewUrl}
          onLoad={handleIframeLoad}
          style={{ width: '100%', height: '100%', border: 'none', backgroundColor: '#fff' }}
          title="Live Preview"
        />
        {status === 'loading' && (
          <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(255,255,255,0.8)' }}>
            <Typography>Loading Preview...</Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}
