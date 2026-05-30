import React from 'react';
import { Stack, TextField } from '@mui/material';

export interface StepBasicInfoProps {
  displayName: string;
  setDisplayName: (val: string) => void;
  name: string;
  setName: (val: string) => void;
  description: string;
  setDescription: (val: string) => void;
}

export function StepBasicInfo({
  displayName, setDisplayName, name, setName, description, setDescription
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
    </Stack>
  );
}
