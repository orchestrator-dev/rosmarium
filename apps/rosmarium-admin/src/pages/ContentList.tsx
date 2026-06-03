import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Stack,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  OutlinedInput,
  SelectChangeEvent,
  Menu,
  TableSortLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItemButton,
  ListItemText,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  FilterList as FilterIcon,
  Bookmark as BookmarkIcon,
} from '@mui/icons-material';
import { TooltipButton, TooltipIconButton } from '../components/common/TooltipButton';
import { BulkActionBar } from '../components/content/BulkActionBar';
import { ContentTreePage } from './ContentTree';
import { ToggleButtonGroup, ToggleButton, Checkbox } from '@mui/material';
import { ViewList as ViewListIcon, AccountTree as TreeIcon } from '@mui/icons-material';

import type { ContentType, ContentEntry as BaseContentEntry } from '@orchestrator.dev/types';

interface ContentEntry extends BaseContentEntry {
  contentTypeName: string;
}

interface Template {
  id: string;
  name: string;
  description: string | null;
  contentTypeId: string | null;
  isGlobal: boolean;
}

export function ContentListPage() {
  const navigate = useNavigate();
  const { type } = useParams<{ type: string }>();
  const [entries, setEntries] = useState<ContentEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [contentTypes, setContentTypes] = useState<ContentType[]>([]);
  
  // Filters state
  const [selectedTypes, setSelectedTypes] = useState<string[]>(type ? [type] : []);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('createdAt:desc');
  
  const [viewMode, setViewMode] = useState<'list' | 'tree'>('list');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  const [anchorElNew, setAnchorElNew] = useState<null | HTMLElement>(null);
  
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [selectedContentTypeForGlobal, setSelectedContentTypeForGlobal] = useState<string>('');

  useEffect(() => {
    // Fetch available content types for filter dropdown
    fetch('/api/content-types')
      .then(r => r.json())
      .then(json => {
        const types = ((json as { data: (ContentType & { settings?: { isComponent?: boolean } })[] }).data || []).filter(t => !t.settings?.isComponent);
        setContentTypes(types);
      })
      .catch(e => console.error(e));
  }, []);

  const fetchEntries = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedTypes.length > 0) {
        params.append('contentTypes', selectedTypes.join(','));
      }
      if (selectedStatus !== 'all') {
        params.append('status', selectedStatus);
      }
      if (sortBy) {
        params.append('sort', sortBy);
      }

      const res = await fetch(`/api/content?${params.toString()}`);
      if (res.ok) {
        const json = await res.json() as { data: ContentEntry[] };
        setEntries(json.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch entries', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (type && !selectedTypes.includes(type)) {
      setSelectedTypes([type]);
    } else if (!type && selectedTypes.length > 0) {
      setSelectedTypes([]);
    }
  }, [type]);

  useEffect(() => {
    if (viewMode === 'list') {
      void fetchEntries();
    }
  }, [selectedTypes, selectedStatus, sortBy, viewMode]);

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    if (selectedIds.length === entries.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(entries.map(e => e.id));
    }
  };

  const handleDelete = async (id: string, typeName: string) => {
    if (!window.confirm('Are you sure you want to delete this entry?')) return;
    try {
      const res = await fetch(`/api/content/${typeName}/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setEntries(prev => prev.filter(e => e.id !== id));
      }
    } catch (err) {
      console.error('Failed to delete entry', err);
    }
  };

  const handleOpenTemplatePicker = async () => {
    try {
      const res = await fetch('/api/templates');
      if (res.ok) {
        const json = await res.json() as { data: Template[] };
        setTemplates(json.data || []);
        setTemplatePickerOpen(true);
        setSelectedTemplate(null);
        setSelectedContentTypeForGlobal('');
      }
    } catch (err) {
      console.error('Failed to load templates', err);
    }
  };

  const handleCreateFromTemplate = async () => {
    if (!selectedTemplate) return;
    
    let ctName = '';
    if (selectedTemplate.isGlobal) {
      const ct = contentTypes.find(c => c.id === selectedContentTypeForGlobal);
      if (!ct) return;
      ctName = ct.name;
    } else {
      const ct = contentTypes.find(c => c.id === selectedTemplate.contentTypeId);
      if (!ct) return;
      ctName = ct.name;
    }

    try {
      const res = await fetch(`/api/content/${ctName}/from-template/${selectedTemplate.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const json = await res.json() as { data: { id: string } };
        setTemplatePickerOpen(false);
        navigate(`/content/${ctName}/${json.data.id}/edit`);
      } else {
        console.error('Failed to create from template');
      }
    } catch (err) {
      console.error('Failed to create from template', err);
    }
  };

  const handleTypeChange = (event: SelectChangeEvent<typeof selectedTypes>) => {
    const {
      target: { value },
    } = event;
    setSelectedTypes(
      typeof value === 'string' ? value.split(',') : value,
    );
  };

  const handleSort = (field: string) => {
    const isAsc = sortBy === `${field}:asc`;
    setSortBy(`${field}:${isAsc ? 'desc' : 'asc'}`);
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
      <Stack direction="row" sx={{justifyContent: "space-between", alignItems: "center", mb: 4}}>
        <Box>
          <Typography variant="h1" gutterBottom sx={{ textTransform: 'capitalize' }}>
            Content Dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage your content entries across all types.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(e, newMode) => { if (newMode) setViewMode(newMode as 'list' | 'tree'); }}
            size="small"
            color="primary"
          >
            <ToggleButton value="list">
              <ViewListIcon fontSize="small" sx={{ mr: 1 }} /> List
            </ToggleButton>
            <ToggleButton value="tree">
              <TreeIcon fontSize="small" sx={{ mr: 1 }} /> Tree
            </ToggleButton>
          </ToggleButtonGroup>
          <Box>
            <TooltipButton 
            actionKey="createEntry"
            variant="contained" 
            startIcon={<AddIcon />} 
            onClick={(e) => {
              if (type) {
                navigate(`/content/${type}/new`);
              } else {
                setAnchorElNew(e.currentTarget);
              }
            }}
          >
            {type ? `New ${contentTypes.find(c => c.name === type)?.displayName || type}` : 'Create Entry'}
          </TooltipButton>
          <Menu
            anchorEl={anchorElNew}
            open={Boolean(anchorElNew)}
            onClose={() => setAnchorElNew(null)}
          >
            {contentTypes.map((ct) => (
              <MenuItem key={ct.id} onClick={() => {
                setAnchorElNew(null);
                navigate(`/content/${ct.name}/new`);
              }}>
                {ct.displayName}
              </MenuItem>
            ))}
          </Menu>
          <TooltipButton
            tooltipTitle="Create an entry from a saved template"
            variant="outlined"
            startIcon={<BookmarkIcon />}
            onClick={() => void handleOpenTemplatePicker()}
            disabled={contentTypes.length === 0}
            sx={{ ml: 2 }}
          >
            Create from Template
          </TooltipButton>
          </Box>
        </Box>
      </Stack>

      {viewMode === 'tree' ? (
        <ContentTreePage />
      ) : (
        <>
          {/* Expandable Filter Bar */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', color: 'text.secondary', mr: 2 }}>
          <FilterIcon sx={{ mr: 1 }} />
          <Typography variant="subtitle2">Filters</Typography>
        </Box>

        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel id="filter-type-label">Content Type</InputLabel>
          <Select
            labelId="filter-type-label"
            multiple
            value={selectedTypes}
            onChange={handleTypeChange}
            input={<OutlinedInput label="Content Type" />}
            renderValue={(selected) => (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {selected.map((value) => (
                  <Chip key={value} label={contentTypes.find(c => c.name === value)?.displayName || value} size="small" />
                ))}
              </Box>
            )}
          >
            {contentTypes.map((ct) => (
              <MenuItem key={ct.name} value={ct.name}>
                {ct.displayName}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel id="filter-status-label">Status</InputLabel>
          <Select
            labelId="filter-status-label"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            input={<OutlinedInput label="Status" />}
          >
            <MenuItem value="all">All Statuses</MenuItem>
            <MenuItem value="draft">Draft</MenuItem>
            <MenuItem value="published">Published</MenuItem>
            <MenuItem value="archived">Archived</MenuItem>
          </Select>
        </FormControl>

      </Paper>

      <TableContainer component={Paper} variant="outlined">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  indeterminate={selectedIds.length > 0 && selectedIds.length < entries.length}
                  checked={entries.length > 0 && selectedIds.length === entries.length}
                  onChange={toggleAll}
                />
              </TableCell>
              <TableCell>Title / ID</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortBy.startsWith('createdAt')}
                  direction={sortBy === 'createdAt:asc' ? 'asc' : 'desc'}
                  onClick={() => handleSort('createdAt')}
                >
                  Created
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortBy.startsWith('updatedAt')}
                  direction={sortBy === 'updatedAt:asc' ? 'asc' : 'desc'}
                  onClick={() => handleSort('updatedAt')}
                >
                  Last Updated
                </TableSortLabel>
              </TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                  <CircularProgress size={24} />
                </TableCell>
              </TableRow>
            ) : entries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                  No entries found matching filters.
                </TableCell>
              </TableRow>
            ) : (
              entries.map(entry => (
                <TableRow key={entry.id} selected={selectedIds.includes(entry.id)}>
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selectedIds.includes(entry.id)}
                      onChange={() => toggleSelection(entry.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: "bold" }}>
                      {String(entry.data?.title || entry.data?.name || 'Untitled')}
                    </Typography>
                    <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                      {entry.id}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={contentTypes.find(c => c.name === entry.contentTypeName)?.displayName || entry.contentTypeName} 
                      size="small" 
                      variant="outlined" 
                    />
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={entry.status} 
                      size="small" 
                      color={entry.status === 'published' ? 'success' : entry.status === 'draft' ? 'warning' : 'default'}
                    />
                  </TableCell>
                  <TableCell>{new Date(entry.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell>{new Date(entry.updatedAt).toLocaleDateString()}</TableCell>
                  <TableCell align="right">
                    <TooltipIconButton actionKey="editEntry" size="small" color="primary" onClick={() => navigate(`/content/${entry.contentTypeName}/${entry.id}/edit`)}>
                      <EditIcon fontSize="small" />
                    </TooltipIconButton>
                    <TooltipIconButton actionKey="deleteEntry" size="small" color="error" onClick={() => void handleDelete(entry.id, entry.contentTypeName)}>
                      <DeleteIcon fontSize="small" />
                    </TooltipIconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <BulkActionBar 
        selectedIds={selectedIds} 
        onClearSelection={() => setSelectedIds([])} 
        onActionComplete={() => { setSelectedIds([]); void fetchEntries(); }} 
      />
        </>
      )}

      <Dialog open={templatePickerOpen} onClose={() => setTemplatePickerOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create from Template</DialogTitle>
        <DialogContent dividers>
          {templates.length === 0 ? (
            <Typography color="text.secondary">No templates available. You can save an entry as a template from the content editor.</Typography>
          ) : (
            <Stack spacing={3}>
              <Typography variant="subtitle2" color="text.secondary">Select a Template</Typography>
              <Paper variant="outlined" sx={{ maxHeight: 300, overflow: 'auto' }}>
                <List disablePadding>
                  {templates.map(t => (
                    <ListItemButton 
                      key={t.id} 
                      selected={selectedTemplate?.id === t.id}
                      onClick={() => setSelectedTemplate(t)}
                    >
                      <ListItemText 
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {t.name}
                            {t.isGlobal && <Chip label="Global" size="small" color="primary" variant="outlined" />}
                          </Box>
                        }
                        secondary={t.description || (t.isGlobal ? 'Available for all content types' : `For: ${contentTypes.find(ct => ct.id === t.contentTypeId)?.displayName}`)} 
                      />
                    </ListItemButton>
                  ))}
                </List>
              </Paper>

              {selectedTemplate?.isGlobal && (
                <FormControl fullWidth required>
                  <InputLabel id="global-ct-label">Target Content Type</InputLabel>
                  <Select
                    labelId="global-ct-label"
                    value={selectedContentTypeForGlobal}
                    label="Target Content Type"
                    onChange={(e) => setSelectedContentTypeForGlobal(e.target.value)}
                  >
                    {contentTypes.map((ct) => (
                      <MenuItem key={ct.id} value={ct.id}>{ct.displayName}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTemplatePickerOpen(false)}>Cancel</Button>
          <Button 
            onClick={() => void handleCreateFromTemplate()} 
            variant="contained" 
            disabled={!selectedTemplate || (selectedTemplate.isGlobal && !selectedContentTypeForGlobal)}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
