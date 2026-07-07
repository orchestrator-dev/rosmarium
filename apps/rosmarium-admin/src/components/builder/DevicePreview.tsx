import React from 'react';
import { Box, ButtonGroup, Button, Tooltip } from '@mui/material';
import DesktopMacIcon from '@mui/icons-material/DesktopMac';
import TabletMacIcon from '@mui/icons-material/TabletMac';
import SmartphoneIcon from '@mui/icons-material/Smartphone';

export type ViewportMode = 'desktop' | 'tablet' | 'mobile';

export interface DevicePreviewProps {
  mode: ViewportMode;
  onChangeMode: (mode: ViewportMode) => void;
  children: React.ReactNode;
}

const VIEWPORT_WIDTHS: Record<ViewportMode, string> = {
  desktop: '100%',
  tablet: '768px',
  mobile: '375px',
};

export function DevicePreview({ mode, onChangeMode, children }: DevicePreviewProps) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', overflow: 'hidden' }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          py: 1,
          px: 2,
          bgcolor: 'background.default',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <ButtonGroup size="small" variant="outlined">
          <Tooltip title="Desktop view (100%)">
            <Button
              variant={mode === 'desktop' ? 'contained' : 'outlined'}
              onClick={() => onChangeMode('desktop')}
              startIcon={<DesktopMacIcon />}
            >
              Desktop
            </Button>
          </Tooltip>
          <Tooltip title="Tablet view (768px)">
            <Button
              variant={mode === 'tablet' ? 'contained' : 'outlined'}
              onClick={() => onChangeMode('tablet')}
              startIcon={<TabletMacIcon />}
            >
              Tablet
            </Button>
          </Tooltip>
          <Tooltip title="Mobile view (375px)">
            <Button
              variant={mode === 'mobile' ? 'contained' : 'outlined'}
              onClick={() => onChangeMode('mobile')}
              startIcon={<SmartphoneIcon />}
            >
              Mobile
            </Button>
          </Tooltip>
        </ButtonGroup>
      </Box>
      <Box
        sx={{
          flexGrow: 1,
          overflowY: 'auto',
          display: 'flex',
          justifyContent: 'center',
          bgcolor: '#eaf0f6',
          p: mode === 'desktop' ? 0 : 3,
        }}
      >
        <Box
          sx={{
            width: VIEWPORT_WIDTHS[mode],
            maxWidth: '100%',
            height: 'fit-content',
            minHeight: mode === 'desktop' ? '100%' : '800px',
            bgcolor: 'background.paper',
            boxShadow: mode === 'desktop' ? 'none' : 4,
            borderRadius: mode === 'desktop' ? 0 : 2,
            transition: 'width 0.3s ease, border-radius 0.3s ease',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
}
