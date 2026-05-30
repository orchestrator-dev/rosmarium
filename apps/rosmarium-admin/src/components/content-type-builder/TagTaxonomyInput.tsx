import React, { useState } from 'react';
import { Box, TextField, Chip } from '@mui/material';

export interface TagTaxonomyInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
}

export function TagTaxonomyInput({ tags, onChange }: TagTaxonomyInputProps) {
  const [input, setInput] = useState('');

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && input.trim() !== '') {
      e.preventDefault();
      const newTag = input.trim();
      if (!tags.includes(newTag)) {
        onChange([...tags, newTag]);
      }
      setInput('');
    }
  };

  const handleDelete = (tagToRemove: string) => {
    onChange(tags.filter(t => t !== tagToRemove));
  };

  return (
    <Box>
      <TextField 
        fullWidth 
        size="small" 
        placeholder="Type a tag and press Enter" 
        value={input} 
        onChange={e => setInput(e.target.value)} 
        onKeyDown={handleKeyDown} 
      />
      <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        {tags.map(tag => (
          <Chip 
            key={tag} 
            label={tag} 
            onDelete={() => handleDelete(tag)} 
            size="small" 
          />
        ))}
      </Box>
    </Box>
  );
}
