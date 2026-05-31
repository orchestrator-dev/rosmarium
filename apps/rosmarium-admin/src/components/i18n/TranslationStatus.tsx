import React from 'react';
import { Box, Chip, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import TranslateIcon from '@mui/icons-material/Translate';

interface TranslationStatusProps {
  existingLocales: string[];
  missingLocales: string[];
}

export function TranslationStatus({ existingLocales, missingLocales }: TranslationStatusProps) {
  const { t } = useTranslation();

  return (
    <Box sx={{ mb: 2, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
      <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        <TranslateIcon sx={{ mr: 1, fontSize: 20 }} />
        {t('editor.translationStatus')}
      </Typography>
      
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        {existingLocales.map(loc => (
          <Chip key={loc} label={loc.toUpperCase()} color="success" size="small" />
        ))}
        {missingLocales.map(loc => (
          <Chip key={loc} label={loc.toUpperCase()} color="default" variant="outlined" size="small" />
        ))}
      </Box>
    </Box>
  );
}
