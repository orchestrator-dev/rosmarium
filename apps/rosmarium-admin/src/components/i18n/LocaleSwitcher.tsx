import React from 'react';
import { Select, MenuItem, FormControl, InputLabel, SelectChangeEvent } from '@mui/material';
import { useTranslation } from 'react-i18next';

interface LocaleSwitcherProps {
  currentLocale: string;
  availableLocales: string[];
  onChange: (locale: string) => void;
}

export function LocaleSwitcher({ currentLocale, availableLocales, onChange }: LocaleSwitcherProps) {
  const { t } = useTranslation();

  const handleChange = (e: SelectChangeEvent) => {
    onChange(e.target.value as string);
  };

  return (
    <FormControl size="small" variant="outlined" sx={{ minWidth: 120 }}>
      <InputLabel id="locale-switcher-label">{t('editor.locale')}</InputLabel>
      <Select
        labelId="locale-switcher-label"
        value={currentLocale}
        label={t('editor.locale')}
        onChange={handleChange}
      >
        {availableLocales.map((loc) => (
          <MenuItem key={loc} value={loc}>
            {loc.toUpperCase()}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
