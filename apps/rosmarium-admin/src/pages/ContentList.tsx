import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  FilterList as FilterIcon,
} from '@mui/icons-material';
import { TooltipButton, TooltipIconButton } from '../components/common/TooltipButton';

interface ContentEntry {
  id: string;
  contentTypeId: string;
  contentTypeName: string;
  status: 'draft' | 'published' | 'archived';
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

interface ContentType {
  id: string;
  name: string;
  displayName: string;
}

export function ContentListPage() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<ContentEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [contentTypes, setContentTypes] = useState<ContentType[]>([]);
  
  // Filters state
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('createdAt:desc');
  
  const [anchorElNew, setAnchorElNew] = useState<null | HTMLElement>(null);

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
    void fetchEntries();
  }, [selectedTypes, selectedStatus, sortBy]);

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
        <Box>
          <TooltipButton 
            actionKey="createEntry"
            variant="contained" 
            startIcon={<AddIcon />} 
            onClick={(e) => setAnchorElNew(e.currentTarget)}
            disabled={contentTypes.length === 0}
          >
            Create Entry
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
        </Box>
      </Stack>

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
                <TableRow key={entry.id}>
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
    </Box>
  );
}
