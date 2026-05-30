import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Stack, TextField,
  FormGroup, FormControlLabel, Checkbox, Grid, Typography
} from '@mui/material';
import { FieldDefinition } from './types';
import { FieldTypeGrid } from './FieldTypeGrid';

export interface AddFieldDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (field: FieldDefinition) => void;
  initialField?: Partial<FieldDefinition>;
  isEditMode?: boolean;
}

export function AddFieldDialog({ open, onClose, onSave, initialField, isEditMode }: AddFieldDialogProps) {
  const [step, setStep] = useState(1);
  const [field, setField] = useState<Partial<FieldDefinition>>({ type: 'text', required: false, unique: false, localised: false });

  useEffect(() => {
    if (open) {
      if (initialField && isEditMode) {
        setField(initialField);
        setStep(2); // Skip type selection when editing
      } else {
        setField({ type: 'text', name: '', label: '', required: false, unique: false, localised: false });
        setStep(1);
      }
    }
  }, [open, initialField, isEditMode]);

  const handleNext = () => setStep(2);
  const handleBack = () => setStep(1);

  const handleSave = () => {
    if (!field.name || !field.label || !field.type) return;
    onSave(field as FieldDefinition);
  };

  const handleLabelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newLabel = e.target.value;
    const updates: Partial<FieldDefinition> = { label: newLabel };
    
    // Auto-generate camelCase name if not explicitly set yet (or if it matches old label)
    if (!isEditMode) {
      const camel = newLabel.replace(/(?:^\w|[A-Z]|\b\w|\s+)/g, (match, index) => {
        if (+match === 0) return "";
        return index === 0 ? match.toLowerCase() : match.toUpperCase();
      }).replace(/\s+/g, '');
      updates.name = camel;
    }
    
    setField(prev => ({ ...prev, ...updates }));
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{isEditMode ? 'Edit Field' : (step === 1 ? 'Choose Field Type' : 'Configure Field')}</DialogTitle>
      <DialogContent dividers>
        {step === 1 ? (
          <FieldTypeGrid value={field.type || 'text'} onChange={type => setField(prev => ({ ...prev, type }))} />
        ) : (
          <Stack spacing={3}>
            <Grid container spacing={2}>
              <Grid size={{ xs: 6 }}>
                <TextField fullWidth label="Label" value={field.label || ''} onChange={handleLabelChange} required />
              </Grid>
              <Grid size={{ xs: 6 }}>
                <TextField fullWidth label="API Name" value={field.name || ''} onChange={e => setField(prev => ({ ...prev, name: e.target.value }))} required />
              </Grid>
            </Grid>

            {/* Type Specific Options */}
            {field.type === 'text' && (
              <Grid container spacing={2}>
                <Grid size={{ xs: 6 }}><TextField fullWidth type="number" label="Min Length" value={field.minLength || ''} onChange={e => setField(prev => ({ ...prev, minLength: parseInt(e.target.value) || undefined }))} /></Grid>
                <Grid size={{ xs: 6 }}><TextField fullWidth type="number" label="Max Length" value={field.maxLength || ''} onChange={e => setField(prev => ({ ...prev, maxLength: parseInt(e.target.value) || undefined }))} /></Grid>
              </Grid>
            )}
            {field.type === 'number' && (
              <Grid container spacing={2}>
                <Grid size={{ xs: 4 }}><TextField fullWidth type="number" label="Min" value={field.min || ''} onChange={e => setField(prev => ({ ...prev, min: parseFloat(e.target.value) || undefined }))} /></Grid>
                <Grid size={{ xs: 4 }}><TextField fullWidth type="number" label="Max" value={field.max || ''} onChange={e => setField(prev => ({ ...prev, max: parseFloat(e.target.value) || undefined }))} /></Grid>
                <Grid size={{ xs: 4 }}><FormControlLabel control={<Checkbox checked={field.integer || false} onChange={e => setField(prev => ({ ...prev, integer: e.target.checked }))} />} label="Integer Only" /></Grid>
              </Grid>
            )}
            {field.type === 'relation' && (
              <Grid container spacing={2}>
                <Grid size={{ xs: 8 }}><TextField fullWidth label="Target Content Type API Name" value={field.targetContentType || ''} onChange={e => setField(prev => ({ ...prev, targetContentType: e.target.value }))} /></Grid>
                <Grid size={{ xs: 4 }}><FormControlLabel control={<Checkbox checked={field.many || false} onChange={e => setField(prev => ({ ...prev, many: e.target.checked }))} />} label="Has Many" /></Grid>
              </Grid>
            )}
            {field.type === 'slug' && (
              <TextField fullWidth label="Generate From Field" value={field.generatedFrom || ''} onChange={e => setField(prev => ({ ...prev, generatedFrom: e.target.value }))} helperText="API Name of the field to generate slug from (e.g. 'title')" />
            )}
            {field.type === 'select' && (
              <Typography variant="body2" color="warning.main">Options configuration is supported via API. Visual editor for options coming soon.</Typography>
            )}

            <FormGroup row>
              <FormControlLabel control={<Checkbox checked={field.required || false} onChange={e => setField(prev => ({ ...prev, required: e.target.checked }))} />} label="Required" />
              <FormControlLabel control={<Checkbox checked={field.unique || false} onChange={e => setField(prev => ({ ...prev, unique: e.target.checked }))} />} label="Unique" />
              <FormControlLabel control={<Checkbox checked={field.localised || false} onChange={e => setField(prev => ({ ...prev, localised: e.target.checked }))} />} label="Localised" />
            </FormGroup>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        {!isEditMode && step === 2 && <Button onClick={handleBack}>Back</Button>}
        {step === 1 ? (
          <Button variant="contained" onClick={handleNext}>Next</Button>
        ) : (
          <Button variant="contained" onClick={handleSave} disabled={!field.name || !field.label}>
            {isEditMode ? 'Update Field' : 'Add Field'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
