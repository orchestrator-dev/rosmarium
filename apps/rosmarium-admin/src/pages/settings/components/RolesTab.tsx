import React from 'react';
import {
  Box, Typography, Card, CardContent, Grid, Divider
} from '@mui/material';

import { RoleChip } from '../../../components/access/RoleChip';
import { PermissionsList } from '../../../components/access/PermissionsList';

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
                  <RoleChip role={role.name} sx={{ fontSize: '0.9rem', fontWeight: 'bold' }} />
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {role.description}
                </Typography>
                
                <Divider sx={{ my: 2 }} />
                
                <PermissionsList permissions={role.permissions} />
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
