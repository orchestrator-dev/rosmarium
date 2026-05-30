import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Button, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, IconButton, Stack
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon, Edit as EditIcon } from '@mui/icons-material';

import { listContentTypes, createContentType, updateContentType, archiveContentType } from '../../api/content-types';
import { ContentType, ContentTypeInput } from '../../components/content-type-builder/types';
import { ContentTypeWizard } from '../../components/content-type-builder/ContentTypeWizard';

export function ContentTypesPage() {
  const [contentTypes, setContentTypes] = useState<ContentType[]>([]);
  const [loading, setLoading] = useState(true);

  // Builder state
  const [isBuilding, setIsBuilding] = useState(false);
  const [editingType, setEditingType] = useState<ContentType | undefined>(undefined);

  const fetchContentTypes = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listContentTypes();
      setContentTypes(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchContentTypes();
  }, [fetchContentTypes]);

  const handleCreateNew = () => {
    setEditingType(undefined);
    setIsBuilding(true);
  };

  const handleEditCT = (ct: ContentType) => {
    setEditingType(ct);
    setIsBuilding(true);
  };

  const handleSaveContentType = async (payload: ContentTypeInput, isEdit: boolean) => {
    try {
      if (isEdit && editingType) {
        await updateContentType(editingType.name, payload);
      } else {
        await createContentType(payload);
      }
      setIsBuilding(false);
      void fetchContentTypes();
    } catch (e) {
      console.error(e);
      alert('Error saving content type');
    }
  };

  const handleDelete = async (name: string) => {
    if (!window.confirm(`Archive content type "${name}"?`)) return;
    try {
      await archiveContentType(name);
      void fetchContentTypes();
    } catch (e) {
      console.error(e);
      alert('Error archiving content type');
    }
  };

  if (isBuilding) {
    return (
      <ContentTypeWizard 
        existingType={editingType}
        onClose={() => setIsBuilding(false)}
        onSave={handleSaveContentType}
      />
    );
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
      <Stack direction="row" sx={{justifyContent: "space-between", alignItems: "center", mb: 4}}>
        <Box>
          <Typography variant="h4" gutterBottom>Content Types</Typography>
          <Typography variant="body2" color="text.secondary">Define the structure of your content.</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreateNew}>New Content Type</Button>
      </Stack>

      <TableContainer component={Paper} variant="outlined">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Display Name</TableCell>
              <TableCell>API Name</TableCell>
              <TableCell>Fields</TableCell>
              <TableCell>Intelligence</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} align="center">Loading...</TableCell></TableRow>
            ) : contentTypes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                  <Typography variant="body1" color="text.secondary" gutterBottom>
                    No content types yet. Create your first to start adding entries.
                  </Typography>
                  <Button variant="outlined" startIcon={<AddIcon />} onClick={handleCreateNew} sx={{ mt: 2 }}>
                    Create your first content type
                  </Button>
                </TableCell>
              </TableRow>
            ) : (
              contentTypes.map(ct => (
                <TableRow key={ct.id}>
                  <TableCell sx={{ fontWeight: 'bold' }}>
                    {ct.displayName}
                    {ct.isSystem && <Chip size="small" label="System" color="info" sx={{ ml: 1, height: 20 }} />}
                  </TableCell>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{ct.name}</TableCell>
                  <TableCell>{ct.fields.length} fields</TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1}>
                      {ct.settings?.ai?.enabled && <Chip size="small" label="AI" color="secondary" variant="outlined" />}
                      {ct.settings?.graph?.enabled && <Chip size="small" label="Graph" color="success" variant="outlined" />}
                    </Stack>
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" color="primary" disabled={ct.isSystem} onClick={() => handleEditCT(ct)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" color="error" disabled={ct.isSystem} onClick={() => void handleDelete(ct.name)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
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
