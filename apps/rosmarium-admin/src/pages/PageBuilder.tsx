import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Drawer,
  TextField,
  Stack,
  Snackbar,
  Alert,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import VisibilityIcon from '@mui/icons-material/Visibility';
import SaveIcon from '@mui/icons-material/Save';
import type { ComponentDefinition } from '@orchestrator.dev/types';
import { ComponentPalette } from '../components/builder/ComponentPalette';
import { Canvas, type CanvasSection } from '../components/builder/Canvas';
import { PropEditor } from '../components/builder/PropEditor';
import { DevicePreview, type ViewportMode } from '../components/builder/DevicePreview';
import { BidirectionalPreview } from '../components/preview/BidirectionalPreview';

export default function PageBuilder() {
  const [components, setComponents] = useState<ComponentDefinition[]>([]);
  const [pageSections, setPageSections] = useState<CanvasSection[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [viewportMode, setViewportMode] = useState<ViewportMode>('desktop');
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');
  const [pageTitle, setPageTitle] = useState<string>('Untitled Page');
  const [pageSlug, setPageSlug] = useState<string>('/untitled');
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  useEffect(() => {
    // Fetch components from registry
    fetch('/api/pages/components')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (Array.isArray(data)) {
          setComponents(data);
        }
      })
      .catch((err) => {
        console.error('Failed to load components:', err);
      });
  }, []);

  const handleAddComponent = (component: ComponentDefinition) => {
    const newSection: CanvasSection = {
      id: `section-${Date.now()}`,
      componentId: component.id,
      component,
      props: { ...component.defaultProps },
      order: pageSections.length,
    };
    setPageSections((prev) => [...prev, newSection]);
    setSelectedSectionId(newSection.id);
  };

  const handleRemoveSection = (sectionId: string) => {
    setPageSections((prev) => prev.filter((s) => s.id !== sectionId));
    if (selectedSectionId === sectionId) {
      setSelectedSectionId(null);
    }
  };

  const handleMoveSection = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= pageSections.length) return;

    const updated = [...pageSections];
    const item = updated[index];
    const target = updated[targetIndex];
    if (item && target) {
      updated[index] = target;
      updated[targetIndex] = item;
      setPageSections(updated);
    }
  };

  const handleUpdateProps = (sectionId: string, newProps: Record<string, unknown>) => {
    setPageSections((prev) =>
      prev.map((s) => (s.id === sectionId ? { ...s, props: newProps } : s))
    );
  };

  const handleSavePage = async () => {
    try {
      const payload = {
        slug: pageSlug,
        title: pageTitle,
        locale: 'en',
        sections: pageSections.map((s, idx) => ({
          componentId: s.componentId,
          props: s.props,
          order: idx,
        })),
        seo: { title: pageTitle, description: '' },
      };

      const res = await fetch('/api/pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setSnackbar({ open: true, message: 'Page saved successfully!', severity: 'success' });
      } else {
        setSnackbar({ open: true, message: 'Failed to save page.', severity: 'error' });
      }
    } catch {
      setSnackbar({ open: true, message: 'Network error saving page.', severity: 'error' });
    }
  };

  const selectedSection = pageSections.find((s) => s.id === selectedSectionId) || null;

  return (
    <Box sx={{ display: 'flex', height: '100vh', width: '100%', overflow: 'hidden', bgcolor: 'background.default' }}>
      {/* Component Palette Sidebar */}
      <Drawer
        variant="permanent"
        sx={{
          width: 280,
          flexShrink: 0,
          '& .MuiDrawer-paper': { width: 280, boxSizing: 'border-box', position: 'relative' },
        }}
      >
        <ComponentPalette components={components} onAddComponent={handleAddComponent} />
      </Drawer>

      {/* Main Builder Area */}
      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Top Navbar */}
        <Box
          sx={{
            px: 3,
            py: 1.5,
            bgcolor: 'background.paper',
            borderBottom: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
            <TextField
              size="small"
              label="Page Title"
              value={pageTitle}
              onChange={(e) => setPageTitle(e.target.value)}
              sx={{ width: 200 }}
            />
            <TextField
              size="small"
              label="Slug"
              value={pageSlug}
              onChange={(e) => setPageSlug(e.target.value)}
              sx={{ width: 160 }}
            />
          </Stack>

          <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
            <ToggleButtonGroup
              size="small"
              value={viewMode}
              exclusive
              onChange={(_, val) => val && setViewMode(val)}
            >
              <ToggleButton value="edit">
                <EditIcon fontSize="small" sx={{ mr: 0.5 }} /> Edit Canvas
              </ToggleButton>
              <ToggleButton value="preview">
                <VisibilityIcon fontSize="small" sx={{ mr: 0.5 }} /> Live Preview
              </ToggleButton>
            </ToggleButtonGroup>

            <Button variant="contained" color="primary" startIcon={<SaveIcon />} onClick={handleSavePage}>
              Save Page
            </Button>
          </Stack>
        </Box>

        {/* Canvas or Live Preview */}
        <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
          {viewMode === 'edit' ? (
            <DevicePreview mode={viewportMode} onChangeMode={setViewportMode}>
              <Canvas
                sections={pageSections}
                selectedSectionId={selectedSectionId}
                onSelectSection={setSelectedSectionId}
                onRemoveSection={handleRemoveSection}
                onMoveSection={handleMoveSection}
              />
            </DevicePreview>
          ) : (
            <BidirectionalPreview
              previewUrl="/preview"
              initialData={{ title: pageTitle, slug: pageSlug, sections: pageSections }}
              onFieldFocus={(fieldId) => setSelectedSectionId(fieldId)}
            />
          )}
        </Box>
      </Box>

      {/* Property Editor Drawer */}
      <Drawer
        variant="permanent"
        anchor="right"
        sx={{
          width: 320,
          flexShrink: 0,
          '& .MuiDrawer-paper': { width: 320, boxSizing: 'border-box', position: 'relative' },
        }}
      >
        <PropEditor
          section={selectedSection}
          onUpdateProps={handleUpdateProps}
          onClose={() => setSelectedSectionId(null)}
        />
      </Drawer>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
