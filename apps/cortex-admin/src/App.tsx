import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { rosmariumTheme } from './theme';
import { AppShell } from './components/AppShell';

// Placeholder imports
import { SearchPage } from './pages/Search';
import { AIDashboardPage } from './pages/AIDashboard';
import { GraphPage } from './pages/Graph';
import { ContentListPage } from './pages/ContentList';
import { MediaLibraryPage } from './pages/MediaLibrary';
import { ContentTypesPage } from './pages/settings/ContentTypes';
import { WebhooksPage } from './pages/settings/Webhooks';
import { AccessControlPage } from './pages/settings/AccessControl';

import { LoginPage } from './pages/Login';

export function App() {
  return (
    <ThemeProvider theme={rosmariumTheme}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<AppShell />}>
            <Route index element={<Navigate to="/search" replace />} />
            <Route path="search" element={<SearchPage />} />
            <Route path="ai-dashboard" element={<AIDashboardPage />} />
            <Route path="graph" element={<GraphPage />} />
            <Route path="content/:type" element={<ContentListPage />} />
            <Route path="media" element={<MediaLibraryPage />} />
            
            <Route path="settings/content-types" element={<ContentTypesPage />} />
            <Route path="settings/webhooks" element={<WebhooksPage />} />
            <Route path="settings/access" element={<AccessControlPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}
