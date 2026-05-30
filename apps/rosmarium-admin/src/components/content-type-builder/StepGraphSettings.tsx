import React from 'react';
import { Stack, Paper, Typography, FormControlLabel, Checkbox, TextField, IconButton, Button, Box, Slider } from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';

export interface EdgeType {
  name: string;
  label: string;
  bidirectional: boolean;
}

export interface StepGraphSettingsProps {
  graphEnabled: boolean;
  setGraphEnabled: (val: boolean) => void;
  edgeTypes: EdgeType[];
  setEdgeTypes: (val: EdgeType[]) => void;
  autoInferNer: boolean;
  setAutoInferNer: (val: boolean) => void;
  autoInferSimilarity: boolean;
  setAutoInferSimilarity: (val: boolean) => void;
  similarityThreshold: number;
  setSimilarityThreshold: (val: number) => void;
}

export function StepGraphSettings({
  graphEnabled, setGraphEnabled, edgeTypes, setEdgeTypes,
  autoInferNer, setAutoInferNer, autoInferSimilarity, setAutoInferSimilarity,
  similarityThreshold, setSimilarityThreshold
}: StepGraphSettingsProps) {

  return (
    <Stack spacing={3}>
      <FormControlLabel 
        control={<Checkbox checked={graphEnabled} onChange={e => setGraphEnabled(e.target.checked)} />} 
        label={<b>Enable Knowledge Graph features</b>} 
      />
      
      {graphEnabled && (
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Typography variant="subtitle1" gutterBottom>Allowed Edge Types</Typography>
          {edgeTypes.map((edge, idx) => (
            <Stack direction="row" spacing={2} key={idx} sx={{ mb: 2, alignItems: 'center' }}>
              <TextField 
                size="small" 
                label="Name (e.g. relates_to)" 
                value={edge.name} 
                onChange={e => {
                  const updated = [...edgeTypes]; 
                  if(updated[idx]) updated[idx].name = e.target.value; 
                  setEdgeTypes(updated);
                }} 
              />
              <TextField 
                size="small" 
                label="Label" 
                value={edge.label} 
                onChange={e => {
                  const updated = [...edgeTypes]; 
                  if(updated[idx]) updated[idx].label = e.target.value; 
                  setEdgeTypes(updated);
                }} 
              />
              <FormControlLabel 
                control={
                  <Checkbox 
                    checked={edge.bidirectional} 
                    onChange={e => {
                      const updated = [...edgeTypes]; 
                      if(updated[idx]) updated[idx].bidirectional = e.target.checked; 
                      setEdgeTypes(updated);
                    }} 
                  />
                } 
                label="Bidirectional" 
              />
              <IconButton color="error" onClick={() => setEdgeTypes(edgeTypes.filter((_, i) => i !== idx))}>
                <DeleteIcon />
              </IconButton>
            </Stack>
          ))}
          <Button 
            variant="outlined" 
            size="small" 
            startIcon={<AddIcon />} 
            onClick={() => setEdgeTypes([...edgeTypes, {name: '', label: '', bidirectional: false}])}
          >
            Add Edge Type
          </Button>

          <Typography variant="subtitle1" sx={{ mt: 4 }} gutterBottom>Automation</Typography>
          <FormControlLabel 
            control={<Checkbox checked={autoInferNer} onChange={e => setAutoInferNer(e.target.checked)} />} 
            label="Auto-infer Named Entity edges (NER)" 
          />
          <FormControlLabel 
            control={<Checkbox checked={autoInferSimilarity} onChange={e => setAutoInferSimilarity(e.target.checked)} />} 
            label="Auto-infer Semantic Similarity edges" 
          />
          
          {autoInferSimilarity && (
            <Box sx={{ mt: 2, pl: 4 }}>
              <Typography variant="body2" gutterBottom>Similarity Threshold ({similarityThreshold})</Typography>
              <Slider 
                value={similarityThreshold} 
                min={0.5} 
                max={0.99} 
                step={0.01} 
                onChange={(_, val) => setSimilarityThreshold(val as number)} 
                valueLabelDisplay="auto" 
              />
            </Box>
          )}
        </Paper>
      )}
    </Stack>
  );
}
