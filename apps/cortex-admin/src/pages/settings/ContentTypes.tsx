import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Stack,
  Stepper,
  Step,
  StepLabel,
  TextField,
  FormControlLabel,
  Checkbox,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Grid,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';

interface FieldDefinition {
  name: string;
  type: string;
  label: string;
  required: boolean;
}

interface ContentType {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  fields: FieldDefinition[];
  isSystem: boolean;
  createdAt: string;
}

export function ContentTypesPage() {
  const [contentTypes, setContentTypes] = useState<ContentType[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Builder state
  const [isBuilding, setIsBuilding] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  
  // New content type form
  const [newName, setNewName] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newFields, setNewFields] = useState<FieldDefinition[]>([]);
  
  // New field form
  const [fieldName, setFieldName] = useState('');
  const [fieldType, setFieldType] = useState('text');
  const [fieldLabel, setFieldLabel] = useState('');
  const [fieldRequired, setFieldRequired] = useState(false);

  const fetchContentTypes = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/content-types');
      if (res.ok) {
        const json = await res.json();
        setContentTypes(json.data || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchContentTypes();
  }, []);

  const handleNext = () => setActiveStep(prev => prev + 1);
  const handleBack = () => setActiveStep(prev => prev - 1);

  const handleAddField = () => {
    if (fieldName && fieldType && fieldLabel) {
      setNewFields([...newFields, {
        name: fieldName,
        type: fieldType,
        label: fieldLabel,
        required: fieldRequired,
      }]);
      setFieldName('');
      setFieldType('text');
      setFieldLabel('');
      setFieldRequired(false);
    }
  };

  const handleRemoveField = (idx: number) => {
    setNewFields(newFields.filter((_, i) => i !== idx));
  };

  const handleSaveContentType = async () => {
    try {
      const res = await fetch('/api/content-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          displayName: newDisplayName,
          description: newDescription,
          fields: newFields,
        }),
      });
      if (res.ok) {
        setIsBuilding(false);
        setActiveStep(0);
        setNewName('');
        setNewDisplayName('');
        setNewDescription('');
        setNewFields([]);
        void fetchContentTypes();
      } else {
        alert('Failed to save content type');
      }
    } catch (e) {
      console.error(e);
      alert('Error saving content type');
    }
  };

  const handleDelete = async (name: string) => {
    if (!window.confirm(`Delete content type "${name}"?`)) return;
    await fetch(`/api/content-types/${name}`, { method: 'DELETE' });
    void fetchContentTypes();
  };

  if (isBuilding) {
    return (
      <Box sx={{ maxWidth: 900, mx: 'auto' }}>
        <Stack direction="row" sx={{ alignItems: "center", mb: 4 }} spacing={2}>
          <IconButton onClick={() => setIsBuilding(false)}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h1">Content Type Builder</Typography>
        </Stack>

        <Paper sx={{ p: 4, mb: 4 }}>
          <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
            <Step><StepLabel>Basic Details</StepLabel></Step>
            <Step><StepLabel>Fields</StepLabel></Step>
            <Step><StepLabel>Review</StepLabel></Step>
          </Stepper>

          {activeStep === 0 && (
            <Stack spacing={3}>
              <TextField
                label="Display Name"
                value={newDisplayName}
                onChange={e => setNewDisplayName(e.target.value)}
                required
                fullWidth
              />
              <TextField
                label="API Name"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                required
                fullWidth
                helperText="Must be lowercase and alphanumeric (e.g., 'article')"
              />
              <TextField
                label="Description"
                value={newDescription}
                onChange={e => setNewDescription(e.target.value)}
                fullWidth
                multiline
                rows={2}
              />
            </Stack>
          )}

          {activeStep === 1 && (
            <Box>
              {newFields.length > 0 && (
                <TableContainer component={Paper} variant="outlined" sx={{ mb: 4 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Label</TableCell>
                        <TableCell>API Name</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell>Required</TableCell>
                        <TableCell align="right">Action</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {newFields.map((f, i) => (
                        <TableRow key={i}>
                          <TableCell>{f.label}</TableCell>
                          <TableCell sx={{ fontFamily: 'monospace' }}>{f.name}</TableCell>
                          <TableCell>
                            <Chip size="small" label={f.type} />
                          </TableCell>
                          <TableCell>{f.required ? 'Yes' : 'No'}</TableCell>
                          <TableCell align="right">
                            <IconButton size="small" color="error" onClick={() => handleRemoveField(i)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}

              <Typography variant="subtitle1" sx={{ fontWeight: "bold" }} gutterBottom>Add Field</Typography>
              <Grid container spacing={2} sx={{ alignItems: "center" }}>
                <Grid size={{xs: 12, sm: 3}}  >
                  <TextField fullWidth size="small" label="Label" value={fieldLabel} onChange={e => setFieldLabel(e.target.value)} />
                </Grid>
                <Grid size={{xs: 12, sm: 3}}  >
                  <TextField fullWidth size="small" label="API Name" value={fieldName} onChange={e => setFieldName(e.target.value)} />
                </Grid>
                <Grid size={{xs: 12, sm: 3}}  >
                  <FormControl fullWidth size="small">
                    <InputLabel>Type</InputLabel>
                    <Select value={fieldType} label="Type" onChange={e => setFieldType(e.target.value as string)}>
                      <MenuItem value="text">Text (Short)</MenuItem>
                      <MenuItem value="richtext">Rich Text</MenuItem>
                      <MenuItem value="number">Number</MenuItem>
                      <MenuItem value="boolean">Boolean</MenuItem>
                      <MenuItem value="date">Date</MenuItem>
                      <MenuItem value="reference">Reference</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{xs: 12, sm: 2}}  >
                  <FormControlLabel
                    control={<Checkbox checked={fieldRequired} onChange={e => setFieldRequired(e.target.checked)} />}
                    label="Required"
                  />
                </Grid>
                <Grid size={{xs: 12, sm: 1}}  >
                  <Button variant="outlined" onClick={handleAddField}>Add</Button>
                </Grid>
              </Grid>
            </Box>
          )}

          {activeStep === 2 && (
            <Stack spacing={2}>
              <Typography variant="h6">Review Content Type</Typography>
              <Box>
                <Typography variant="body2" color="text.secondary">Name: {newName}</Typography>
                <Typography variant="body2" color="text.secondary">Display Name: {newDisplayName}</Typography>
                <Typography variant="body2" color="text.secondary">Fields: {newFields.length}</Typography>
              </Box>
            </Stack>
          )}

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 4, gap: 2 }}>
            <Button disabled={activeStep === 0} onClick={handleBack}>
              Back
            </Button>
            {activeStep === 2 ? (
              <Button variant="contained" onClick={() => void handleSaveContentType()}>
                Create Content Type
              </Button>
            ) : (
              <Button variant="contained" onClick={handleNext}>
                Next
              </Button>
            )}
          </Box>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
      <Stack direction="row" sx={{justifyContent: "space-between", alignItems: "center", mb: 4}}>
        <Box>
          <Typography variant="h1" gutterBottom>
            Content Types
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage schemas for your content entries.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setIsBuilding(true)}>
          New Content Type
        </Button>
      </Stack>

      <TableContainer component={Paper} variant="outlined">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Display Name</TableCell>
              <TableCell>API Name</TableCell>
              <TableCell>Fields</TableCell>
              <TableCell>System</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} align="center">Loading...</TableCell></TableRow>
            ) : contentTypes.length === 0 ? (
              <TableRow><TableCell colSpan={5} align="center">No content types found.</TableCell></TableRow>
            ) : (
              contentTypes.map(ct => (
                <TableRow key={ct.id}>
                  <TableCell sx={{ fontWeight: 'bold' }}>{ct.displayName}</TableCell>
                  <TableCell sx={{ fontFamily: 'monospace' }}>{ct.name}</TableCell>
                  <TableCell>{ct.fields.length} fields</TableCell>
                  <TableCell>
                    {ct.isSystem ? <Chip size="small" label="System" color="info" /> : <Chip size="small" label="Custom" />}
                  </TableCell>
                  <TableCell align="right">
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
