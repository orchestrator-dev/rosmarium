import React from 'react';
import { Stack, Paper, Typography, FormGroup, FormControlLabel, Checkbox, Box } from '@mui/material';
import { TagTaxonomyInput } from './TagTaxonomyInput';

export interface StepAISettingsProps {
  aiEnabled: boolean;
  setAiEnabled: (val: boolean) => void;
  aiOperations: string[];
  setAiOperations: (val: string[]) => void;
  taxonomyTags: string[];
  setTaxonomyTags: (val: string[]) => void;
}

export function StepAISettings({
  aiEnabled, setAiEnabled, aiOperations, setAiOperations, taxonomyTags, setTaxonomyTags
}: StepAISettingsProps) {
  
  return (
    <Stack spacing={3}>
      <FormControlLabel 
        control={<Checkbox checked={aiEnabled} onChange={e => setAiEnabled(e.target.checked)} />} 
        label={<b>Enable AI Intelligence for this content type</b>} 
      />
      
      {aiEnabled && (
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Typography variant="subtitle1" gutterBottom>Automated Operations</Typography>
          <FormGroup row>
            {['tag', 'ner', 'deduplicate', 'summarize'].map(op => (
              <FormControlLabel 
                key={op} 
                control={
                  <Checkbox 
                    checked={aiOperations.includes(op)} 
                    onChange={e => {
                      if (e.target.checked) setAiOperations([...aiOperations, op]);
                      else setAiOperations(aiOperations.filter(o => o !== op));
                    }} 
                  />
                } 
                label={op.charAt(0).toUpperCase() + op.slice(1)} 
              />
            ))}
          </FormGroup>
          
          <Box sx={{ mt: 3 }}>
            <Typography variant="subtitle2" gutterBottom>Taxonomy Tags</Typography>
            <TagTaxonomyInput tags={taxonomyTags} onChange={setTaxonomyTags} />
          </Box>
        </Paper>
      )}
    </Stack>
  );
}
