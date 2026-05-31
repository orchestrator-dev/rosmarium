import React from 'react';
import { Stack, TextField, FormControlLabel, Switch, Typography } from '@mui/material';

import { PreviewSettings } from '../preview/PreviewSettings';

export interface StepBasicInfoProps {
  displayName: string;
  setDisplayName: (val: string) => void;
  name: string;
  setName: (val: string) => void;
  description: string;
  setDescription: (val: string) => void;
  isComponent?: boolean;
  onIsComponentChange?: (val: boolean) => void;
  previewUrl?: string;
  setPreviewUrl?: (val: string) => void;
}

export function StepBasicInfo({
  displayName, setDisplayName, name, setName, description, setDescription,
  isComponent, onIsComponentChange, previewUrl, setPreviewUrl,
}: StepBasicInfoProps) {
  
  const handleDisplayNameChange = (val: string) => {
    setDisplayName(val);
    const camel = val.replace(/(?:^\w|[A-Z]|\b\w|\s+)/g, (match, index) => {
      if (+match === 0) return "";
      return index === 0 ? match.toLowerCase() : match.toUpperCase();
    }).replace(/\s+/g, '');
    setName(camel);
  };

  return (
    <Stack spacing={3}>
      <TextField 
        label="Display Name" 
        value={displayName} 
        onChange={e => handleDisplayNameChange(e.target.value)} 
        required 
        fullWidth 
      />
      <TextField 
        label="API Name" 
        value={name} 
        onChange={e => setName(e.target.value)} 
        required 
        fullWidth 
        helperText="Must be camelCase (e.g., 'articlePost')" 
      />
      <TextField 
        label="Description" 
        value={description} 
        onChange={e => setDescription(e.target.value)} 
        fullWidth 
        multiline 
        rows={2} 
      />
      {onIsComponentChange && (
        <div>
          <FormControlLabel
            control={
              <Switch
                checked={isComponent || false}
                onChange={e => onIsComponentChange(e.target.checked)}
              />
            }
            label="Use as Component"
          />
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', ml: 4.5 }}>
            Component types can be embedded inside other content types via Component or Blocks fields.
          </Typography>
        </div>
      )}
      {setPreviewUrl && (
        <PreviewSettings
          settings={{ previewUrl }}
          onChange={(settings) => setPreviewUrl(settings.previewUrl || '')}
        />
      )}
    </Stack>
  );
}

