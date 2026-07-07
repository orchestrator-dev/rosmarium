import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  MenuItem,
  Button,
  Stack,
  Alert,
  IconButton,
  Divider,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';

export interface DataBindingConfig {
  source: string;
  query: string;
  variableMapping: Record<string, string>;
}

export interface DataBinderProps {
  propName: string;
  initialBinding?: DataBindingConfig;
  onSave: (binding: DataBindingConfig | undefined) => void;
  onCancel: () => void;
}

export function DataBinder({ propName, initialBinding, onSave, onCancel }: DataBinderProps) {
  const [source, setSource] = useState<string>(initialBinding?.source || 'rosmarium');
  const [query, setQuery] = useState<string>(
    initialBinding?.query || `query GetData($slug: String!) {\n  item(slug: $slug) {\n    id\n    title\n  }\n}`
  );
  const [remoteSources, setRemoteSources] = useState<{ id: string; name: string; type: string }[]>([]);
  const [mappings, setMappings] = useState<{ key: string; val: string }[]>(
    initialBinding?.variableMapping
      ? Object.entries(initialBinding.variableMapping).map(([key, val]) => ({ key, val }))
      : [{ key: 'slug', val: 'page.slug' }]
  );

  useEffect(() => {
    fetch('/api/federation/sources')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (Array.isArray(data)) {
          setRemoteSources(data);
        }
      })
      .catch(() => {
        // Fallback or ignore
      });
  }, []);

  const handleAddMapping = () => {
    setMappings([...mappings, { key: '', val: '' }]);
  };

  const handleRemoveMapping = (index: number) => {
    setMappings(mappings.filter((_, i) => i !== index));
  };

  const handleMappingChange = (index: number, field: 'key' | 'val', value: string) => {
    const updated = [...mappings];
    const current = updated[index];
    if (current) {
      current[field] = value;
      setMappings(updated);
    }
  };

  const handleSaveBinding = () => {
    const variableMapping: Record<string, string> = {};
    mappings.forEach(({ key, val }) => {
      if (key.trim()) {
        variableMapping[key.trim()] = val.trim();
      }
    });

    onSave({
      source,
      query,
      variableMapping,
    });
  };

  return (
    <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
      <Typography variant="subtitle2" gutterBottom color="primary">
        Federated Data Binding for &ldquo;{propName}&rdquo;
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
        Bind this component property directly to a local or remote federated GraphQL query.
      </Typography>

      <Stack spacing={2}>
        <TextField
          select
          label="Data Source"
          value={source}
          onChange={(e) => setSource(e.target.value)}
          size="small"
          fullWidth
        >
          <MenuItem value="rosmarium">rosmarium (Local Database)</MenuItem>
          {remoteSources.map((s) => (
            <MenuItem key={s.id} value={s.name}>
              {s.name} ({s.type.toUpperCase()})
            </MenuItem>
          ))}
        </TextField>

        <TextField
          label="GraphQL Query Fragment"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          multiline
          rows={5}
          size="small"
          fullWidth
          slotProps={{
            input: { sx: { fontFamily: 'monospace', fontSize: '0.85rem' } }
          }}
          helperText="Write the GraphQL query to execute against the stitched schema."
        />

        <Divider />

        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="caption" sx={{ fontWeight: 'bold' }}>
              Variable Mappings (Query Var → Page Context)
            </Typography>
            <Button size="small" startIcon={<AddIcon />} onClick={handleAddMapping}>
              Add Var
            </Button>
          </Box>
          <Stack spacing={1}>
            {mappings.map((m, idx) => (
              <Box key={idx} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <TextField
                  size="small"
                  placeholder="Query Var (e.g., slug)"
                  value={m.key}
                  onChange={(e) => handleMappingChange(idx, 'key', e.target.value)}
                  sx={{ flex: 1 }}
                />
                <Typography variant="body2">→</Typography>
                <TextField
                  size="small"
                  placeholder="Context (e.g., page.slug)"
                  value={m.val}
                  onChange={(e) => handleMappingChange(idx, 'val', e.target.value)}
                  sx={{ flex: 1 }}
                />
                <IconButton size="small" color="error" onClick={() => handleRemoveMapping(idx)}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Box>
            ))}
          </Stack>
        </Box>

        <Alert severity="info" sx={{ py: 0.5 }}>
          When rendered, Rosmarium will execute this query and inject the result into <code>{propName}</code>.
        </Alert>

        <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end', mt: 1 }}>
          <Button size="small" color="error" onClick={() => onSave(undefined)}>
            Remove Binding
          </Button>
          <Button size="small" variant="outlined" onClick={onCancel}>
            Cancel
          </Button>
          <Button size="small" variant="contained" onClick={handleSaveBinding}>
            Save Binding
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
