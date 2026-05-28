import React, { useState } from 'react';
import {
  Box,
  Typography,
  Tabs,
  Tab,
} from '@mui/material';

import { UsersTab } from './components/UsersTab';
import { RolesTab } from './components/RolesTab';
import { ApiKeysTab } from './components/ApiKeysTab';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function CustomTabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`access-tabpanel-${index}`}
      aria-labelledby={`access-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ py: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `access-tab-${index}`,
    'aria-controls': `access-tabpanel-${index}`,
  };
}

export function AccessControlPage() {
  const [tabValue, setTabValue] = useState(0);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
      <Typography variant="h1" gutterBottom>
        Access Control
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
        Manage users, roles, and programmatic access to Rosmarium.
      </Typography>

      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tabValue} onChange={handleTabChange} aria-label="access control tabs">
          <Tab label="Users" {...a11yProps(0)} />
          <Tab label="Roles" {...a11yProps(1)} />
          <Tab label="API Keys" {...a11yProps(2)} />
        </Tabs>
      </Box>

      <CustomTabPanel value={tabValue} index={0}>
        <UsersTab />
      </CustomTabPanel>
      <CustomTabPanel value={tabValue} index={1}>
        <RolesTab />
      </CustomTabPanel>
      <CustomTabPanel value={tabValue} index={2}>
        <ApiKeysTab />
      </CustomTabPanel>
    </Box>
  );
}
