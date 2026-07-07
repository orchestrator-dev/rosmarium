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
  AccountTree as AccountTreeIcon,
  CallSplit as CallSplitIcon,
  Download as DownloadIcon,
  SmartToy as SmartToyIcon,
} from '@mui/icons-material';
import { Outlet, useNavigate, useLocation, Link as RouterLink } from 'react-router-dom';
import { BranchSwitcher } from './branches/BranchSwitcher';

const drawerWidth = 240;

const menuItems = [
  { text: 'Import', icon: <DownloadIcon />, path: '/ingestor' },
  { text: 'Media', icon: <MediaIcon />, path: '/media' },
  { text: 'Search', icon: <SearchIcon />, path: '/search' },
  { text: 'AI Dashboard', icon: <AIIcon />, path: '/intelligence' },
  { text: 'Knowledge Graph', icon: <GraphIcon />, path: '/graph' },
  { text: 'Page Builder', icon: <DashboardIcon />, path: '/pages' },
  { text: 'Personalization', icon: <CallSplitIcon />, path: '/personalization' },
  { text: 'Agents', icon: <SmartToyIcon />, path: '/agents' },
];


const settingsItems = [
  { text: 'Content Types', icon: <SchemaIcon />, path: '/settings/content-types' },
  { text: 'Webhooks', icon: <WebhookIcon />, path: '/settings/webhooks' },
  { text: 'Access Control', icon: <SecurityIcon />, path: '/settings/access' },
  { text: 'Workflows', icon: <AccountTreeIcon />, path: '/settings/workflows' },
  { text: 'Branches', icon: <CallSplitIcon />, path: '/settings/branches' },
  { text: 'Federation', icon: <GraphIcon />, path: '/federation' },
];

export function AppShell() {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [contentTypes, setContentTypes] = React.useState<any[]>([]);
  const navigate = useNavigate();
  const location = useLocation();

  React.useEffect(() => {
    fetch('/api/auth/me').then(res => {
      if (!res.ok) navigate('/login');
    }).catch(() => navigate('/login'));

    fetch('/api/content-types')
      .then(res => res.json())
      .then(data => {
        if (data && Array.isArray(data.data)) {
          setContentTypes(data.data);
        }
      })
      .catch(console.error);
  }, [navigate]);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const drawer = (
    <div>
      <Toolbar>
        <Typography variant="h1" sx={{ fontSize: '1.25rem', color: '#f1f5f9' }}>
          ⬡ Rosmarium
        </Typography>
      </Toolbar>
      <Divider sx={{ borderColor: 'rgba(255,255,255,0.05)' }} />
      <List>
        {/* Dynamic Content section */}
        {contentTypes.length === 0 ? (
          <ListItem disablePadding>
            <ListItemButton
              component={RouterLink}
              to="/content"
              selected={location.pathname === '/content'}
              onClick={(e) => { e.preventDefault(); navigate('/content'); }}
              sx={{
                '&.Mui-selected': {
                  backgroundColor: 'rgba(99, 102, 241, 0.15)',
                  borderRight: '3px solid #6366F1',
                },
              }}
            >
              <ListItemIcon sx={{ color: location.pathname === '/content' ? '#6366F1' : '#94a3b8' }}>
                <DashboardIcon />
              </ListItemIcon>
              <ListItemText
                primary="Content"
                sx={{
                  '& .MuiListItemText-primary': {
                    fontWeight: location.pathname === '/content' ? 600 : 400,
                    color: location.pathname === '/content' ? '#f1f5f9' : '#94a3b8',
                  },
                }}
              />
            </ListItemButton>
          </ListItem>
        ) : (
          contentTypes.map((ct) => (
            <ListItem key={ct.name} disablePadding>
              <ListItemButton
                component={RouterLink}
                to={`/content/${ct.name}`}
                selected={location.pathname.startsWith(`/content/${ct.name}`)}
                onClick={(e) => { e.preventDefault(); navigate(`/content/${ct.name}`); }}
                sx={{
                  '&.Mui-selected': {
                    backgroundColor: 'rgba(99, 102, 241, 0.15)',
                    borderRight: '3px solid #6366F1',
                  },
                }}
              >
                <ListItemIcon sx={{ color: location.pathname.startsWith(`/content/${ct.name}`) ? '#6366F1' : '#94a3b8' }}>
                  <DashboardIcon />
                </ListItemIcon>
                <ListItemText
                  primary={ct.displayName || ct.name}
                  sx={{
                    '& .MuiListItemText-primary': {
                      fontWeight: location.pathname.startsWith(`/content/${ct.name}`) ? 600 : 400,
                      color: location.pathname.startsWith(`/content/${ct.name}`) ? '#f1f5f9' : '#94a3b8',
                    },
                  }}
                />
              </ListItemButton>
            </ListItem>
          ))
        )}

        {/* Other menu items */}
        {menuItems.map((item) => (
          <ListItem key={item.text} disablePadding>
            <ListItemButton
              component={RouterLink}
              to={item.path}
              selected={location.pathname.startsWith(item.path)}
              onClick={(e) => { e.preventDefault(); navigate(item.path); }}
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
                  },
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
              component={RouterLink}
              to={item.path}
              selected={location.pathname.startsWith(item.path)}
              onClick={(e) => { e.preventDefault(); navigate(item.path); }}
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
          <BranchSwitcher />
          <Box sx={{ flexGrow: 1 }} />
          <IconButton color="inherit" onClick={() => {
            fetch('/api/auth/logout', { method: 'POST' }).finally(() => navigate('/login'));
          }} sx={{ fontSize: '0.875rem', color: '#94a3b8' }}>
            Logout
          </IconButton>
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
