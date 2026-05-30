import React from 'react';
import { Box, Typography, Stack, Chip } from '@mui/material';
import { Check as CheckIcon, Close as CloseIcon } from '@mui/icons-material';

export interface PermissionsListProps {
  permissions: Record<string, string[]>;
}

export function PermissionsList({ permissions }: PermissionsListProps) {
  return (
    <Box>
      {Object.entries(permissions).map(([group, perms]) => (
        <Box key={group} sx={{ mb: 2 }}>
          <Typography variant="caption" sx={{ fontWeight: 'bold', textTransform: 'uppercase', color: '#94a3b8', display: 'block', mb: 1 }}>
            {group}
          </Typography>
          {perms.length === 0 ? (
            <Chip 
              icon={<CloseIcon sx={{ fontSize: '1rem' }} />} 
              label="None" 
              size="small" 
              variant="outlined" 
              color="error"
              sx={{ bgcolor: 'rgba(255,0,0,0.05)' }} 
            />
          ) : (
            <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
              {perms.map(p => (
                <Chip 
                  key={p} 
                  icon={<CheckIcon sx={{ fontSize: '1rem' }} />} 
                  label={p} 
                  size="small" 
                  variant="outlined" 
                  color="success"
                  sx={{ mb: 0.5, bgcolor: 'rgba(0,255,0,0.05)' }} 
                />
              ))}
            </Stack>
          )}
        </Box>
      ))}
    </Box>
  );
}
