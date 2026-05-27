import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
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
  Button,
  Chip,
  IconButton,
  Stack,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';

interface ContentEntry {
  id: string;
  contentType: string;
  status: 'draft' | 'published' | 'archived';
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export function ContentListPage() {
  const { type } = useParams<{ type: string }>();
  const [entries, setEntries] = useState<ContentEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Editor State
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ContentEntry | null>(null);
  const [editJsonStr, setEditJsonStr] = useState('{\n  \n}');
  const [editError, setEditError] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchEntries = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/content/${type}`);
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
    if (type) {
      void fetchEntries();
    }
  }, [type]);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this entry?')) return;
    try {
      const res = await fetch(`/api/content/${type}/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setEntries(prev => prev.filter(e => e.id !== id));
      }
    } catch (err) {
      console.error('Failed to delete entry', err);
    }
  };

  const handleOpenCreate = () => {
    setEditingEntry(null);
    setEditJsonStr('{\n  "title": "",\n  "slug": ""\n}');
    setEditError('');
    setEditDialogOpen(true);
  };

  const handleOpenEdit = (entry: ContentEntry) => {
    setEditingEntry(entry);
    setEditJsonStr(JSON.stringify(entry.data, null, 2));
    setEditError('');
    setEditDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const parsedData = JSON.parse(editJsonStr);
      setEditError('');
      
      const isEdit = !!editingEntry;
      const url = isEdit ? `/api/content/${type}/${editingEntry.id}` : `/api/content/${type}`;
      const method = isEdit ? 'PATCH' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: parsedData }),
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData?.error?.message || 'Failed to save');
      }
      
      setEditDialogOpen(false);
      void fetchEntries();
    } catch (e: unknown) {
      setEditError(e instanceof Error ? e.message : 'Invalid JSON or API Error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
      <Stack direction="row" sx={{justifyContent: "space-between", alignItems: "center", mb: 4}}>
        <Box>
          <Typography variant="h1" gutterBottom sx={{ textTransform: 'capitalize' }}>
            {type} Entries
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage your {type} content entries.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenCreate}>
          Create Entry
        </Button>
      </Stack>

      <TableContainer component={Paper} variant="outlined">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Title / ID</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Created</TableCell>
              <TableCell>Last Updated</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 3 }}>
                  <CircularProgress size={24} />
                </TableCell>
              </TableRow>
            ) : entries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                  No entries found.
                </TableCell>
              </TableRow>
            ) : (
              entries.map(entry => (
                <TableRow key={entry.id}>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: "bold" }}>
                      {String((entry.data as Record<string, unknown>)?.title || (entry.data as Record<string, unknown>)?.name || 'Untitled')}
                    </Typography>
                    <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                      {entry.id}
                    </Typography>
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
                    <IconButton size="small" color="primary" onClick={() => handleOpenEdit(entry)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" color="error" onClick={() => void handleDelete(entry.id)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Edit/Create Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editingEntry ? 'Edit Entry' : 'Create Entry'}</DialogTitle>
        <DialogContent dividers>
          {editError && (
            <Typography color="error" variant="body2" sx={{ mb: 2 }}>
              {editError}
            </Typography>
          )}
          <TextField
            fullWidth
            multiline
            rows={15}
            variant="outlined"
            label="Entry Data (JSON)"
            value={editJsonStr}
            onChange={(e) => setEditJsonStr(e.target.value)}
            sx={{ '& .MuiInputBase-root': { fontFamily: 'monospace', fontSize: '0.875rem' } }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)} disabled={saving}>Cancel</Button>
          <Button onClick={() => void handleSave()} variant="contained" disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
