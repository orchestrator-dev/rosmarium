import React, { useEffect, useRef, useState } from 'react';
import { Box, Paper, Typography, CircularProgress, IconButton, ToggleButtonGroup, ToggleButton } from '@mui/material';
import { DesktopMac, TabletMac, PhoneIphone, Refresh } from '@mui/icons-material';

interface PreviewPanelProps {
  previewUrlTemplate: string;
  entryId: string;
  contentTypeId: string;
  formData: Record<string, unknown>;
}

export const PreviewPanel: React.FC<PreviewPanelProps> = ({
  previewUrlTemplate,
  entryId,
  contentTypeId,
  formData,
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [device, setDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');

  const fetchToken = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/preview/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryId, contentTypeId }),
      });
      if (!res.ok) throw new Error('Failed to fetch preview token');
      const json = await res.json() as { data: { token: string } };
      setToken(json.data.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (entryId && contentTypeId) {
      fetchToken();
    }
  }, [entryId, contentTypeId]);

  // Handle postMessage updates
  useEffect(() => {
    if (!iframeRef.current || !token) return;

    // We can't know precisely which field changed without deep diffing,
    // so we just send the whole formData under the 'update' event.
    // The SDK supports `path` and `value` but it's simpler to send the full data for now.
    iframeRef.current.contentWindow?.postMessage(
      {
        type: 'update',
        path: '',
        value: formData,
      },
      '*'
    );
  }, [formData, token]);

  // Initial load message
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === 'ready' && iframeRef.current && token) {
        // Send initial data
        iframeRef.current.contentWindow?.postMessage(
          {
            type: 'preview',
            token,
            entryId,
            data: formData,
          },
          '*'
        );
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [token, entryId, formData]);

  if (!previewUrlTemplate) return null;

  const previewUrl = previewUrlTemplate
    .replace('{{id}}', entryId)
    .replace('{{token}}', token || '');

  const getWidth = () => {
    switch (device) {
      case 'mobile': return '375px';
      case 'tablet': return '768px';
      default: return '100%';
    }
  };

  return (
    <Paper sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="subtitle2" sx={{ px: 1 }}>Live Preview</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <ToggleButtonGroup
            size="small"
            value={device}
            exclusive
            onChange={(_, newDevice) => newDevice && setDevice(newDevice)}
          >
            <ToggleButton value="desktop"><DesktopMac fontSize="small" /></ToggleButton>
            <ToggleButton value="tablet"><TabletMac fontSize="small" /></ToggleButton>
            <ToggleButton value="mobile"><PhoneIphone fontSize="small" /></ToggleButton>
          </ToggleButtonGroup>
          <IconButton size="small" onClick={fetchToken} title="Refresh Preview">
            <Refresh fontSize="small" />
          </IconButton>
        </Box>
      </Box>
      
      <Box sx={{ flexGrow: 1, backgroundColor: '#f0f2f5', display: 'flex', justifyContent: 'center', overflow: 'auto', p: device === 'desktop' ? 0 : 2 }}>
        {loading ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Box sx={{ p: 3, color: 'error.main' }}>{error}</Box>
        ) : token ? (
          <Box sx={{ 
            width: getWidth(), 
            height: '100%', 
            transition: 'width 0.3s', 
            backgroundColor: '#fff',
            boxShadow: device !== 'desktop' ? 3 : 0,
            borderRadius: device !== 'desktop' ? 2 : 0,
            overflow: 'hidden'
          }}>
            <iframe
              ref={iframeRef}
              src={previewUrl}
              style={{ width: '100%', height: '100%', border: 'none' }}
              title="Live Preview"
            />
          </Box>
        ) : null}
      </Box>
    </Paper>
  );
};
