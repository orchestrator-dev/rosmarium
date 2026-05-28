import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Button, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, IconButton, Stack, Stepper, Step, StepLabel, TextField, FormControlLabel, Checkbox, Select, MenuItem,
  FormControl, InputLabel, Grid, Dialog, DialogTitle, DialogContent, DialogActions, Slider, FormGroup
} from '@mui/material';
import {
  Add as AddIcon, Delete as DeleteIcon, ArrowBack as ArrowBackIcon, Edit as EditIcon,
  DragIndicator as DragIndicatorIcon
} from '@mui/icons-material';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface FieldDefinition {
  name: string;
  type: string;
  label: string;
  required: boolean;
  unique?: boolean;
  localised?: boolean;
  // Type specific
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  integer?: boolean;
  options?: {label: string, value: string}[];
  targetContentType?: string;
  many?: boolean;
  generatedFrom?: string;
}

interface ContentType {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  fields: FieldDefinition[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  settings: any;
  isSystem: boolean;
  createdAt: string;
  entriesCount?: number;
}

// ------------------------------------------------------------
// Sortable Field Item Component
// ------------------------------------------------------------
function SortableFieldRow({ field, onRemove, onEdit }: { field: FieldDefinition, onRemove: () => void, onEdit: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: field.name });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <TableRow ref={setNodeRef} style={style} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
      <TableCell sx={{ width: 40, cursor: 'grab' }} {...attributes} {...listeners}>
        <DragIndicatorIcon color="action" />
      </TableCell>
      <TableCell>{field.label}</TableCell>
      <TableCell sx={{ fontFamily: 'monospace' }}>{field.name}</TableCell>
      <TableCell><Chip size="small" label={field.type} /></TableCell>
      <TableCell>{field.required ? 'Yes' : 'No'}</TableCell>
      <TableCell align="right">
        <IconButton size="small" color="primary" onClick={onEdit}>
          <EditIcon fontSize="small" />
        </IconButton>
        <IconButton size="small" color="error" onClick={onRemove}>
          <DeleteIcon fontSize="small" />
        </IconButton>
      </TableCell>
    </TableRow>
  );
}

// ------------------------------------------------------------
// Main Page Component
// ------------------------------------------------------------
export function ContentTypesPage() {
  const [contentTypes, setContentTypes] = useState<ContentType[]>([]);
  const [loading, setLoading] = useState(true);

  // Builder state
  const [isBuilding, setIsBuilding] = useState(false);
  const [activeStep, setActiveStep] = useState(0);

  // Basic Info
  const [newName, setNewName] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newDescription, setNewDescription] = useState('');

  // Fields
  const [newFields, setNewFields] = useState<FieldDefinition[]>([]);
  
  // Field Dialog State
  const [isFieldDialogOpen, setIsFieldDialogOpen] = useState(false);
  const [editingFieldIndex, setEditingFieldIndex] = useState<number | null>(null);
  const [currentField, setCurrentField] = useState<Partial<FieldDefinition>>({ type: 'text', required: false, unique: false, localised: false });

  // AI Config
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiOperations, setAiOperations] = useState<string[]>([]);
  const [taxonomyInput, setTaxonomyInput] = useState('');
  const [taxonomyTags, setTaxonomyTags] = useState<string[]>([]);

  // Graph Config
  const [graphEnabled, setGraphEnabled] = useState(false);
  const [edgeTypes, setEdgeTypes] = useState<{name: string, label: string, bidirectional: boolean}[]>([]);
  const [autoInferNer, setAutoInferNer] = useState(false);
  const [autoInferSimilarity, setAutoInferSimilarity] = useState(false);
  const [similarityThreshold, setSimilarityThreshold] = useState(0.8);

  const fetchContentTypes = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/content-types');
      if (res.ok) {
        const json = await res.json();
        // Assume backend returns entries count or we mock it
        setContentTypes(json.data || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchContentTypes();
  }, []);

  const resetForm = () => {
    setNewName(''); setNewDisplayName(''); setNewDescription('');
    setNewFields([]);
    setAiEnabled(false); setAiOperations([]); setTaxonomyTags([]);
    setGraphEnabled(false); setEdgeTypes([]); setAutoInferNer(false); setAutoInferSimilarity(false); setSimilarityThreshold(0.8);
    setActiveStep(0);
  };

  const handleCreateNew = () => {
    resetForm();
    setIsBuilding(true);
  };

  const handleEditCT = (ct: ContentType) => {
    resetForm();
    setNewName(ct.name);
    setNewDisplayName(ct.displayName);
    setNewDescription(ct.description || '');
    setNewFields(ct.fields || []);
    
    if (ct.settings?.ai?.enabled) {
      setAiEnabled(true);
      setAiOperations(ct.settings.ai.operations || []);
      setTaxonomyTags(ct.settings.ai.taxonomy || []);
    }
    if (ct.settings?.graph?.enabled) {
      setGraphEnabled(true);
      setEdgeTypes(ct.settings.graph.edgeTypes || []);
      setAutoInferNer(ct.settings.graph.autoInferNer || false);
      setAutoInferSimilarity(ct.settings.graph.autoInferSimilarity || false);
      setSimilarityThreshold(ct.settings.graph.similarityThreshold || 0.8);
    }
    
    setIsBuilding(true);
  };

  const handleNext = () => setActiveStep(prev => prev + 1);
  const handleBack = () => setActiveStep(prev => prev - 1);

  // Field Management
  const openFieldDialog = (index: number | null = null) => {
    setEditingFieldIndex(index);
    if (index !== null) {
      setCurrentField({ ...newFields[index] });
    } else {
      setCurrentField({ type: 'text', name: '', label: '', required: false, unique: false, localised: false });
    }
    setIsFieldDialogOpen(true);
  };

  const closeFieldDialog = () => setIsFieldDialogOpen(false);

  const saveField = () => {
    if (!currentField.name || !currentField.label || !currentField.type) return;
    const f = currentField as FieldDefinition;
    if (editingFieldIndex !== null) {
      const updated = [...newFields];
      updated[editingFieldIndex] = f;
      setNewFields(updated);
    } else {
      setNewFields([...newFields, f]);
    }
    closeFieldDialog();
  };

  const handleDisplayNameChange = (val: string) => {
    setNewDisplayName(val);
    const camel = val.replace(/(?:^\w|[A-Z]|\b\w|\s+)/g, (match, index) => {
      if (+match === 0) return "";
      return index === 0 ? match.toLowerCase() : match.toUpperCase();
    }).replace(/\s+/g, '');
    setNewName(camel);
  };

  // DnD Sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setNewFields((items) => {
        const oldIndex = items.findIndex(i => i.name === active.id);
        const newIndex = items.findIndex(i => i.name === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleSaveContentType = async () => {
    try {
      const payload = {
        name: newName,
        displayName: newDisplayName,
        description: newDescription,
        fields: newFields,
        settings: {
          ai: { enabled: aiEnabled, operations: aiOperations, taxonomy: taxonomyTags },
          graph: { enabled: graphEnabled, edgeTypes, autoInferNer, autoInferSimilarity, similarityThreshold }
        }
      };

      // Depending on whether we are editing or creating, we should ideally check. But let's assume POST handles upsert or we just POST.
      // A proper implementation would PATCH if editing.
      const existing = contentTypes.find(c => c.name === newName);
      const url = existing ? `/api/content-types/${newName}` : '/api/content-types';
      const method = existing ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setIsBuilding(false);
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

  const handleAddTaxonomy = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && taxonomyInput.trim() !== '') {
      e.preventDefault();
      if (!taxonomyTags.includes(taxonomyInput.trim())) {
        setTaxonomyTags([...taxonomyTags, taxonomyInput.trim()]);
      }
      setTaxonomyInput('');
    }
  };

  if (isBuilding) {
    return (
      <Box sx={{ maxWidth: 900, mx: 'auto' }}>
        <Stack direction="row" sx={{ alignItems: "center", mb: 4 }} spacing={2}>
          <IconButton onClick={() => setIsBuilding(false)}><ArrowBackIcon /></IconButton>
          <Typography variant="h1">{contentTypes.find(c => c.name === newName) ? 'Edit Content Type' : 'New Content Type'}</Typography>
        </Stack>

        <Paper sx={{ p: 4, mb: 4 }}>
          <Stepper activeStep={activeStep} sx={{ mb: 4 }} alternativeLabel>
            <Step><StepLabel>Basic Details</StepLabel></Step>
            <Step><StepLabel>Fields</StepLabel></Step>
            <Step><StepLabel>AI Intelligence</StepLabel></Step>
            <Step><StepLabel>Knowledge Graph</StepLabel></Step>
            <Step><StepLabel>Review</StepLabel></Step>
          </Stepper>

          {activeStep === 0 && (
            <Stack spacing={3}>
              <TextField label="Display Name" value={newDisplayName} onChange={e => handleDisplayNameChange(e.target.value)} required fullWidth />
              <TextField label="API Name" value={newName} onChange={e => setNewName(e.target.value)} required fullWidth helperText="Must be camelCase (e.g., 'articlePost')" />
              <TextField label="Description" value={newDescription} onChange={e => setNewDescription(e.target.value)} fullWidth multiline rows={2} />
            </Stack>
          )}

          {activeStep === 1 && (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h6">Fields</Typography>
                <Button variant="outlined" startIcon={<AddIcon />} onClick={() => openFieldDialog(null)}>Add Field</Button>
              </Box>

              {newFields.length > 0 ? (
                <TableContainer component={Paper} variant="outlined" sx={{ mb: 4 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ width: 40 }}></TableCell>
                        <TableCell>Label</TableCell>
                        <TableCell>API Name</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell>Required</TableCell>
                        <TableCell align="right">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                      <TableBody>
                        <SortableContext items={newFields.map(f => f.name)} strategy={verticalListSortingStrategy}>
                          {newFields.map((f, i) => (
                            <SortableFieldRow key={f.name} field={f} onRemove={() => setNewFields(newFields.filter((_, idx) => idx !== i))} onEdit={() => openFieldDialog(i)} />
                          ))}
                        </SortableContext>
                      </TableBody>
                    </DndContext>
                  </Table>
                </TableContainer>
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 4, fontStyle: 'italic' }}>No fields added yet. Add at least one field.</Typography>
              )}
            </Box>
          )}

          {activeStep === 2 && (
            <Stack spacing={3}>
              <FormControlLabel control={<Checkbox checked={aiEnabled} onChange={e => setAiEnabled(e.target.checked)} />} label={<b>Enable AI Intelligence for this content type</b>} />
              {aiEnabled && (
                <Paper variant="outlined" sx={{ p: 3 }}>
                  <Typography variant="subtitle1" gutterBottom>Automated Operations</Typography>
                  <FormGroup row>
                    {['tag', 'ner', 'deduplicate', 'summarize'].map(op => (
                      <FormControlLabel key={op} control={<Checkbox checked={aiOperations.includes(op)} onChange={e => {
                        if (e.target.checked) setAiOperations([...aiOperations, op]);
                        else setAiOperations(aiOperations.filter(o => o !== op));
                      }} />} label={op.charAt(0).toUpperCase() + op.slice(1)} />
                    ))}
                  </FormGroup>
                  <Box sx={{ mt: 3 }}>
                    <Typography variant="subtitle2" gutterBottom>Taxonomy Tags</Typography>
                    <TextField fullWidth size="small" placeholder="Type a tag and press Enter" value={taxonomyInput} onChange={e => setTaxonomyInput(e.target.value)} onKeyDown={handleAddTaxonomy} />
                    <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      {taxonomyTags.map(tag => (
                        <Chip key={tag} label={tag} onDelete={() => setTaxonomyTags(taxonomyTags.filter(t => t !== tag))} size="small" />
                      ))}
                    </Box>
                  </Box>
                </Paper>
              )}
            </Stack>
          )}

          {activeStep === 3 && (
            <Stack spacing={3}>
              <FormControlLabel control={<Checkbox checked={graphEnabled} onChange={e => setGraphEnabled(e.target.checked)} />} label={<b>Enable Knowledge Graph features</b>} />
              {graphEnabled && (
                <Paper variant="outlined" sx={{ p: 3 }}>
                  <Typography variant="subtitle1" gutterBottom>Allowed Edge Types</Typography>
                  {edgeTypes.map((edge, idx) => (
                    <Stack direction="row" spacing={2} key={idx} sx={{ mb: 2, alignItems: 'center' }}>
                      <TextField size="small" label="Name (e.g. relates_to)" value={edge.name} onChange={e => {
                        const updated = [...edgeTypes]; if(updated[idx]) updated[idx].name = e.target.value; setEdgeTypes(updated);
                      }} />
                      <TextField size="small" label="Label" value={edge.label} onChange={e => {
                        const updated = [...edgeTypes]; if(updated[idx]) updated[idx].label = e.target.value; setEdgeTypes(updated);
                      }} />
                      <FormControlLabel control={<Checkbox checked={edge.bidirectional} onChange={e => {
                        const updated = [...edgeTypes]; if(updated[idx]) updated[idx].bidirectional = e.target.checked; setEdgeTypes(updated);
                      }} />} label="Bidirectional" />
                      <IconButton color="error" onClick={() => setEdgeTypes(edgeTypes.filter((_, i) => i !== idx))}><DeleteIcon /></IconButton>
                    </Stack>
                  ))}
                  <Button variant="outlined" size="small" startIcon={<AddIcon />} onClick={() => setEdgeTypes([...edgeTypes, {name: '', label: '', bidirectional: false}])}>Add Edge Type</Button>

                  <Typography variant="subtitle1" sx={{ mt: 4 }} gutterBottom>Automation</Typography>
                  <FormControlLabel control={<Checkbox checked={autoInferNer} onChange={e => setAutoInferNer(e.target.checked)} />} label="Auto-infer Named Entity edges (NER)" />
                  <FormControlLabel control={<Checkbox checked={autoInferSimilarity} onChange={e => setAutoInferSimilarity(e.target.checked)} />} label="Auto-infer Semantic Similarity edges" />
                  
                  {autoInferSimilarity && (
                    <Box sx={{ mt: 2, pl: 4 }}>
                      <Typography variant="body2" gutterBottom>Similarity Threshold ({similarityThreshold})</Typography>
                      <Slider value={similarityThreshold} min={0.5} max={0.99} step={0.01} onChange={(_, val) => setSimilarityThreshold(val as number)} valueLabelDisplay="auto" />
                    </Box>
                  )}
                </Paper>
              )}
            </Stack>
          )}

          {activeStep === 4 && (
            <Stack spacing={2}>
              <Typography variant="h6">Review Content Type</Typography>
              <Paper variant="outlined" sx={{ p: 2, bgcolor: '#0f172a', color: '#38bdf8', overflowX: 'auto' }}>
                <pre style={{ margin: 0, fontFamily: 'monospace', fontSize: '0.85rem' }}>
                  {JSON.stringify({
                    name: newName,
                    displayName: newDisplayName,
                    description: newDescription,
                    fields: newFields,
                    settings: {
                      ai: { enabled: aiEnabled, operations: aiOperations, taxonomy: taxonomyTags },
                      graph: { enabled: graphEnabled, edgeTypes, autoInferNer, autoInferSimilarity, similarityThreshold }
                    }
                  }, null, 2)}
                </pre>
              </Paper>
            </Stack>
          )}

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 4, gap: 2 }}>
            <Button disabled={activeStep === 0} onClick={handleBack}>Back</Button>
            {activeStep === 4 ? (
              <Button variant="contained" onClick={() => void handleSaveContentType()}>Save Content Type</Button>
            ) : (
              <Button variant="contained" onClick={handleNext}>Next</Button>
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
          <Typography variant="h1" gutterBottom>Content Types</Typography>
          <Typography variant="body2" color="text.secondary">Manage schemas for your content entries.</Typography>
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
              <TableRow><TableCell colSpan={5} align="center">No content types found.</TableCell></TableRow>
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
                    <IconButton size="small" color="primary" disabled={ct.isSystem} onClick={() => handleEditCT(ct)}><EditIcon fontSize="small" /></IconButton>
                    <IconButton size="small" color="error" disabled={ct.isSystem} onClick={() => void handleDelete(ct.name)}><DeleteIcon fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Field Dialog */}
      <Dialog open={isFieldDialogOpen} onClose={closeFieldDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingFieldIndex !== null ? 'Edit Field' : 'Add Field'}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={3}>
            <Grid container spacing={2}>
              <Grid size={{xs:6}}>
                <TextField fullWidth label="Label" value={currentField.label} onChange={e => {
                  setCurrentField({ ...currentField, label: e.target.value });
                  if (!currentField.name) {
                    const camel = e.target.value.replace(/(?:^\w|[A-Z]|\b\w|\s+)/g, (match, index) => {
                      if (+match === 0) return "";
                      return index === 0 ? match.toLowerCase() : match.toUpperCase();
                    }).replace(/\s+/g, '');
                    setCurrentField(prev => ({ ...prev, name: camel }));
                  }
                }} />
              </Grid>
              <Grid size={{xs:6}}>
                <TextField fullWidth label="API Name" value={currentField.name} onChange={e => setCurrentField({ ...currentField, name: e.target.value })} />
              </Grid>
            </Grid>
            <FormControl fullWidth>
              <InputLabel>Type</InputLabel>
              <Select value={currentField.type} label="Type" onChange={e => setCurrentField({ ...currentField, type: e.target.value as string })}>
                <MenuItem value="text">Text (Short)</MenuItem>
                <MenuItem value="richText">Rich Text</MenuItem>
                <MenuItem value="number">Number</MenuItem>
                <MenuItem value="boolean">Boolean</MenuItem>
                <MenuItem value="date">Date</MenuItem>
                <MenuItem value="datetime">Date & Time</MenuItem>
                <MenuItem value="media">Media</MenuItem>
                <MenuItem value="relation">Relation</MenuItem>
                <MenuItem value="json">JSON</MenuItem>
                <MenuItem value="select">Select (Dropdown)</MenuItem>
                <MenuItem value="slug">Slug</MenuItem>
              </Select>
            </FormControl>

            {/* Type Specific Options */}
            {currentField.type === 'text' && (
              <Grid container spacing={2}>
                <Grid size={{xs:6}}><TextField fullWidth type="number" label="Min Length" value={currentField.minLength || ''} onChange={e => setCurrentField({ ...currentField, minLength: parseInt(e.target.value) || undefined })} /></Grid>
                <Grid size={{xs:6}}><TextField fullWidth type="number" label="Max Length" value={currentField.maxLength || ''} onChange={e => setCurrentField({ ...currentField, maxLength: parseInt(e.target.value) || undefined })} /></Grid>
              </Grid>
            )}
            {currentField.type === 'number' && (
              <Grid container spacing={2}>
                <Grid size={{xs:4}}><TextField fullWidth type="number" label="Min" value={currentField.min || ''} onChange={e => setCurrentField({ ...currentField, min: parseFloat(e.target.value) || undefined })} /></Grid>
                <Grid size={{xs:4}}><TextField fullWidth type="number" label="Max" value={currentField.max || ''} onChange={e => setCurrentField({ ...currentField, max: parseFloat(e.target.value) || undefined })} /></Grid>
                <Grid size={{xs:4}}><FormControlLabel control={<Checkbox checked={currentField.integer || false} onChange={e => setCurrentField({ ...currentField, integer: e.target.checked })} />} label="Integer Only" /></Grid>
              </Grid>
            )}
            {currentField.type === 'relation' && (
              <Grid container spacing={2}>
                <Grid size={{xs: 8}}><TextField fullWidth label="Target Content Type API Name" value={currentField.targetContentType || ''} onChange={e => setCurrentField({ ...currentField, targetContentType: e.target.value })} /></Grid>
                <Grid size={{xs:4}}><FormControlLabel control={<Checkbox checked={currentField.many || false} onChange={e => setCurrentField({ ...currentField, many: e.target.checked })} />} label="Has Many" /></Grid>
              </Grid>
            )}
            {currentField.type === 'slug' && (
              <TextField fullWidth label="Generate From Field" value={currentField.generatedFrom || ''} onChange={e => setCurrentField({ ...currentField, generatedFrom: e.target.value })} helperText="API Name of the field to generate slug from (e.g. 'title')" />
            )}
            {currentField.type === 'select' && (
              <Typography variant="body2" color="warning.main">Options configuration is supported via API. Visual editor for options coming soon.</Typography>
            )}

            <FormGroup row>
              <FormControlLabel control={<Checkbox checked={currentField.required || false} onChange={e => setCurrentField({ ...currentField, required: e.target.checked })} />} label="Required" />
              <FormControlLabel control={<Checkbox checked={currentField.unique || false} onChange={e => setCurrentField({ ...currentField, unique: e.target.checked })} />} label="Unique" />
              <FormControlLabel control={<Checkbox checked={currentField.localised || false} onChange={e => setCurrentField({ ...currentField, localised: e.target.checked })} />} label="Localised" />
            </FormGroup>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeFieldDialog}>Cancel</Button>
          <Button variant="contained" onClick={saveField}>Save Field</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
