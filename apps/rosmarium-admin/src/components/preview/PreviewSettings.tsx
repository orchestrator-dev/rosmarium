import React from 'react';
import { Box, Typography, TextField } from '@mui/material';
import type { ContentTypeSettings } from '../content-type-builder/types';

interface PreviewSettingsProps {
  settings: ContentTypeSettings;
  onChange: (settings: ContentTypeSettings) => void;
}

export const PreviewSettings: React.FC<PreviewSettingsProps> = ({ settings, onChange }) => {
  return (
    <Box sx={{ mt: 3 }}>
      <Typography variant="h6" gutterBottom>
        Live Preview Settings
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Configure the frontend URL for live preview. Use `{"{{id}}"}` and `{"{{token}}"}` as placeholders.
        For example: `http://localhost:3000/api/preview?type=article&id={"{{id}}"}&token={"{{token}}"}`
      </Typography>
      <TextField
        fullWidth
        label="Preview URL Template"
        value={settings.previewUrl || ''}
        onChange={(e) => onChange({ ...settings, previewUrl: e.target.value })}
        placeholder="https://your-frontend.com/preview?id={{id}}&token={{token}}"
      />
    </Box>
  );
};
