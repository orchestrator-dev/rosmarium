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
import { ContentEditorPage } from './pages/ContentEditor';
import { MediaLibraryPage } from './pages/MediaLibrary';
import { ContentTypesPage } from './pages/settings/ContentTypes';
import { WebhooksPage } from './pages/settings/Webhooks';
import { AccessControlPage } from './pages/settings/AccessControl';
import { WorkflowsPage } from './pages/settings/Workflows';
import BranchesPage from './pages/Branches';
import MergePage from './pages/MergePage';
import { GovernancePage } from './pages/Governance';
import { AuditLogPage } from './pages/AuditLog';
import { IngestorPage } from './pages/Ingestor';

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
            <Route path="intelligence" element={<AIDashboardPage />} />
            <Route path="graph" element={<GraphPage />} />
            <Route path="content" element={<ContentListPage />} />
            <Route path="content/:type" element={<ContentListPage />} />
            <Route path="content/:type/new" element={<ContentEditorPage />} />
            <Route path="content/:type/:id/edit" element={<ContentEditorPage />} />
            <Route path="media" element={<MediaLibraryPage />} />
            <Route path="governance" element={<GovernancePage />} />
            <Route path="audit-log" element={<AuditLogPage />} />
            <Route path="ingestor" element={<IngestorPage />} />
            
            <Route path="settings/content-types" element={<ContentTypesPage />} />
            <Route path="settings/webhooks" element={<WebhooksPage />} />
            <Route path="settings/access" element={<AccessControlPage />} />
            <Route path="settings/workflows" element={<WorkflowsPage />} />
            <Route path="settings/branches" element={<BranchesPage />} />
            <Route path="settings/branches/:id/merge" element={<MergePage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}
