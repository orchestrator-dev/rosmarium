import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  Stack,
  Divider,
} from '@mui/material';

const ROLES = [
  {
    name: 'super_admin',
    description: 'Unrestricted access to all system features, including tenant provisioning.',
    permissions: {
      Content: ['All Content Permissions'],
      Assets: ['All Asset Permissions'],
      System: ['All System Permissions'],
    }
  },
  {
    name: 'admin',
    description: 'Full access to content, assets, users, and webhooks within the tenant.',
    permissions: {
      Content: ['Create', 'Read Any', 'Update Any', 'Delete Any', 'Publish', 'Manage Types'],
      Assets: ['Upload', 'Delete Any'],
      System: ['Manage Users', 'Manage Webhooks'],
    }
  },
  {
    name: 'editor',
    description: 'Can manage all content and assets, but cannot manage users or settings.',
    permissions: {
      Content: ['Create', 'Read Any', 'Update Any', 'Delete Own', 'Publish'],
      Assets: ['Upload', 'Delete Own'],
      System: [],
    }
  },
  {
    name: 'author',
    description: 'Can create and edit their own content and assets.',
    permissions: {
      Content: ['Create', 'Read Any', 'Update Own', 'Delete Own'],
      Assets: ['Upload', 'Delete Own'],
      System: [],
    }
  },
  {
    name: 'viewer',
    description: 'Can only view published and draft content. Cannot make changes.',
    permissions: {
      Content: ['Read Any'],
      Assets: [],
      System: [],
    }
  }
];

export function RolesTab() {
  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Role Definitions
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Rosmarium uses a fixed set of roles with predefined permissions to ensure security and predictability.
      </Typography>
      
      <Grid container spacing={3}>
        {ROLES.map((role) => (
          <Grid size={{ xs: 12, md: 6, lg: 4 }} key={role.name}>
            <Card variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <CardContent sx={{ flexGrow: 1 }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1, color: '#6366F1' }}>
                  {role.name}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {role.description}
                </Typography>
                
                <Divider sx={{ my: 2 }} />
                
                {Object.entries(role.permissions).map(([group, perms]) => (
                  <Box key={group} sx={{ mb: 2 }}>
                    <Typography variant="caption" sx={{ fontWeight: 'bold', textTransform: 'uppercase', color: '#94a3b8', display: 'block', mb: 1 }}>
                      {group}
                    </Typography>
                    {perms.length === 0 ? (
                      <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                        None
                      </Typography>
                    ) : (
                      <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
                        {perms.map(p => (
                          <Chip key={p} label={p} size="small" variant="outlined" sx={{ mb: 0.5, bgcolor: 'rgba(255,255,255,0.02)' }} />
                        ))}
                      </Stack>
                    )}
                  </Box>
                ))}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
