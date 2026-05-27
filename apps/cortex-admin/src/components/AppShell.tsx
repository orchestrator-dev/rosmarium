import React from 'react';
import {
  AppBar,
  Box,
  CssBaseline,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Search as SearchIcon,
  AutoAwesome as AIIcon,
  Hub as GraphIcon,
  
  Dashboard as DashboardIcon,
  PhotoLibrary as MediaIcon,
  Webhook as WebhookIcon,
  Security as SecurityIcon,
  Schema as SchemaIcon,
} from '@mui/icons-material';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';

const drawerWidth = 240;

const menuItems = [
  { text: 'Content', icon: <DashboardIcon />, path: '/content/article' },
  { text: 'Media', icon: <MediaIcon />, path: '/media' },
  { text: 'Search', icon: <SearchIcon />, path: '/search' },
  { text: 'AI Dashboard', icon: <AIIcon />, path: '/ai-dashboard' },
  { text: 'Knowledge Graph', icon: <GraphIcon />, path: '/graph' },
];

const settingsItems = [
  { text: 'Content Types', icon: <SchemaIcon />, path: '/settings/content-types' },
  { text: 'Webhooks', icon: <WebhookIcon />, path: '/settings/webhooks' },
  { text: 'Access Control', icon: <SecurityIcon />, path: '/settings/access' },
];

export function AppShell() {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const drawer = (
    <div>
      <Toolbar>
        <Typography variant="h1" sx={{ fontSize: '1.25rem', color: '#f1f5f9' }}>
          ⬡ Cortex
        </Typography>
      </Toolbar>
      <Divider sx={{ borderColor: 'rgba(255,255,255,0.05)' }} />
      <List>
        {menuItems.map((item) => (
          <ListItem key={item.text} disablePadding>
            <ListItemButton
              selected={location.pathname.startsWith(item.path)}
              onClick={() => navigate(item.path)}
              sx={{
                '&.Mui-selected': {
                  backgroundColor: 'rgba(99, 102, 241, 0.15)',
                  borderRight: '3px solid #6366F1',
                },
              }}
            >
              <ListItemIcon sx={{ color: location.pathname.startsWith(item.path) ? '#6366F1' : '#94a3b8' }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText 
                primary={item.text} 
                sx={{ 
                  '& .MuiListItemText-primary': {
                    fontWeight: location.pathname.startsWith(item.path) ? 600 : 400,
                    color: location.pathname.startsWith(item.path) ? '#f1f5f9' : '#94a3b8',
                  }
                }} 
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      <Divider sx={{ borderColor: 'rgba(255,255,255,0.05)' }} />
      <List subheader={<Typography sx={{ px: 3, py: 1, fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Settings</Typography>}>
        {settingsItems.map((item) => (
          <ListItem key={item.text} disablePadding>
            <ListItemButton
              selected={location.pathname.startsWith(item.path)}
              onClick={() => navigate(item.path)}
              sx={{
                '&.Mui-selected': {
                  backgroundColor: 'rgba(99, 102, 241, 0.15)',
                  borderRight: '3px solid #6366F1',
                },
              }}
            >
              <ListItemIcon sx={{ color: location.pathname.startsWith(item.path) ? '#6366F1' : '#94a3b8' }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText 
                primary={item.text} 
                sx={{ 
                  '& .MuiListItemText-primary': {
                    fontWeight: location.pathname.startsWith(item.path) ? 600 : 400,
                    color: location.pathname.startsWith(item.path) ? '#f1f5f9' : '#94a3b8',
                  }
                }} 
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </div>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <CssBaseline />
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
          bgcolor: 'background.paper',
          borderBottom: '1px solid #334155',
          boxShadow: 'none',
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' }, color: '#94a3b8' }}
          >
            <MenuIcon />
          </IconButton>
          <Box sx={{ flexGrow: 1 }} />
          {/* Add user profile / logout here if needed */}
        </Toolbar>
      </AppBar>
      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
        aria-label="mailbox folders"
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true, // Better open performance on mobile.
          }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth, bgcolor: 'background.paper', borderRight: '1px solid #334155' },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth, bgcolor: 'background.paper', borderRight: '1px solid #334155' },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>
      <Box
        component="main"
        sx={{ flexGrow: 1, p: 3, width: { sm: `calc(100% - ${drawerWidth}px)` }, mt: 8 }}
      >
        <Outlet />
      </Box>
    </Box>
  );
}
