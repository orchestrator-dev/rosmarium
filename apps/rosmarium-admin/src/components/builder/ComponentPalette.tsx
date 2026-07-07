import React, { useState, useMemo } from 'react';
import { Box, Typography, List, ListItem, ListItemButton, ListItemText, Divider, IconButton, TextField, Chip, Stack } from '@mui/material';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import SearchIcon from '@mui/icons-material/Search';
import type { ComponentDefinition } from '@orchestrator.dev/types';

export interface ComponentPaletteProps {
  components: ComponentDefinition[];
  onAddComponent: (component: ComponentDefinition) => void;
}

export function ComponentPalette({ components, onAddComponent }: ComponentPaletteProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const categories = useMemo(() => {
    const cats = new Set<string>(['All']);
    components.forEach((comp) => {
      if (comp.category) cats.add(comp.category);
    });
    return Array.from(cats);
  }, [components]);

  const filteredComponents = useMemo(() => {
    return components.filter((comp) => {
      const matchesCategory = selectedCategory === 'All' || comp.category === selectedCategory;
      const matchesSearch =
        comp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (comp.description && comp.description.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCategory && matchesSearch;
    });
  }, [components, selectedCategory, searchQuery]);

  return (
    <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.paper' }}>
      <Box sx={{ p: 2, pb: 1 }}>
        <Typography variant="h6" gutterBottom>
          Components
        </Typography>
        <TextField
          size="small"
          placeholder="Search components..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          fullWidth
          slotProps={{
            input: { startAdornment: <SearchIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} /> },
          }}
          sx={{ mb: 1.5 }}
        />
        <Stack direction="row" spacing={0.5} sx={{ overflowX: 'auto', pb: 0.5 }}>
          {categories.map((cat) => (
            <Chip
              key={cat}
              label={cat}
              size="small"
              onClick={() => setSelectedCategory(cat)}
              color={selectedCategory === cat ? 'primary' : 'default'}
              variant={selectedCategory === cat ? 'filled' : 'outlined'}
              sx={{ cursor: 'pointer' }}
            />
          ))}
        </Stack>
      </Box>
      <Divider />
      <List sx={{ flexGrow: 1, overflowY: 'auto', p: 0 }}>
        {filteredComponents.map((comp) => (
          <ListItemButton
            key={comp.id}
            onClick={() => onAddComponent(comp)}
            sx={{
              borderBottom: '1px solid #eee',
              display: 'flex',
              alignItems: 'flex-start',
              p: 1.5,
              '&:hover': { bgcolor: 'action.hover' },
            }}
          >
            <ListItemText
              primary={comp.name}
              secondary={
                <React.Fragment>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    {comp.category} • {comp.framework.toUpperCase()}
                  </Typography>
                  {comp.description}
                </React.Fragment>
              }
              slotProps={{
                primary: { sx: { fontWeight: 'medium' } },
                secondary: { sx: { mt: 0.5 } }
              }}
            />
            <IconButton size="small" sx={{ mt: 0.5, cursor: 'grab' }} title="Click to add to page">
              <DragIndicatorIcon fontSize="small" />
            </IconButton>
          </ListItemButton>
        ))}
        {filteredComponents.length === 0 && (
          <ListItem>
            <ListItemText
              secondary={
                components.length === 0
                  ? 'No components registered yet. Register components via the API.'
                  : 'No components match your filter criteria.'
              }
            />
          </ListItem>
        )}
      </List>
    </Box>
  );
}
