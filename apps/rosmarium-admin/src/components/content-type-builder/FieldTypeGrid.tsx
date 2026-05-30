import React from 'react';
import { Grid, Card, CardActionArea, Typography, Box } from '@mui/material';
import {
  TextFields as TextIcon,
  Article as RichTextIcon,
  Numbers as NumberIcon,
  ToggleOn as BooleanIcon,
  CalendarToday as DateIcon,
  AccessTime as DateTimeIcon,
  Image as MediaIcon,
  Link as RelationIcon,
  DataObject as JsonIcon,
  List as SelectIcon,
  LinkOff as SlugIcon,
  ViewModule as ViewModuleIcon,
  Widgets as WidgetsIcon,
  ViewStream as ViewStreamIcon,
} from '@mui/icons-material';

export const FIELD_TYPES = [
  { value: 'text', label: 'Text', icon: <TextIcon />, description: 'Short string of text' },
  { value: 'richText', label: 'Rich Text', icon: <RichTextIcon />, description: 'Formatted long-form text' },
  { value: 'number', label: 'Number', icon: <NumberIcon />, description: 'Integers or decimals' },
  { value: 'boolean', label: 'Boolean', icon: <BooleanIcon />, description: 'True or False toggle' },
  { value: 'date', label: 'Date', icon: <DateIcon />, description: 'Calendar date' },
  { value: 'datetime', label: 'Date & Time', icon: <DateTimeIcon />, description: 'Date with precise time' },
  { value: 'relation', label: 'Relation', icon: <RelationIcon />, description: 'Link to another entry' },
  { value: 'media', label: 'Media', icon: <MediaIcon />, description: 'Images, videos, files' },
  { value: 'json', label: 'JSON', icon: <JsonIcon />, description: 'Arbitrary JSON object' },
  { value: 'select', label: 'Select', icon: <SelectIcon />, description: 'Dropdown of values' },
  { value: 'slug', label: 'Slug', icon: <SlugIcon />, description: 'URL-friendly string' },
  { value: 'group', label: 'Group', icon: <ViewModuleIcon />, description: 'Group of sub-fields' },
  { value: 'component', label: 'Component', icon: <WidgetsIcon />, description: 'Reusable content component' },
  { value: 'blocks', label: 'Blocks', icon: <ViewStreamIcon />, description: 'Ordered content blocks' },
];

export interface FieldTypeGridProps {
  value: string;
  onChange: (type: string) => void;
}

export function FieldTypeGrid({ value, onChange }: FieldTypeGridProps) {
  return (
    <Grid container spacing={2}>
      {FIELD_TYPES.map(type => {
        const isSelected = value === type.value;
        return (
          <Grid size={{ xs: 6, sm: 4 }} key={type.value}>
            <Card 
              variant="outlined" 
              sx={{ 
                borderColor: isSelected ? 'primary.main' : 'divider',
                bgcolor: isSelected ? 'action.selected' : 'background.paper',
                borderWidth: isSelected ? 2 : 1,
              }}
            >
              <CardActionArea onClick={() => onChange(type.value)} sx={{ p: 2, height: '100%' }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                  <Box sx={{ color: isSelected ? 'primary.main' : 'text.secondary', mb: 1 }}>
                    {type.icon}
                  </Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: isSelected ? 'bold' : 'normal' }}>
                    {type.label}
                  </Typography>
                </Box>
              </CardActionArea>
            </Card>
          </Grid>
        );
      })}
    </Grid>
  );
}
