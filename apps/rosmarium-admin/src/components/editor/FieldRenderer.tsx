import React from 'react';
import {
  TextField,
  MenuItem,
  FormControlLabel,
  Switch,
  Box,
  Typography,
  Paper,
  Button,
  Chip,
  IconButton,
  InputAdornment,
  Stack,
  Select,
  FormControl,
  InputLabel,
} from '@mui/material';
import {
  AutoFixHigh as GenerateIcon,
  Clear as ClearIcon,
  Image as ImageIcon,
} from '@mui/icons-material';
import type { FieldDefinition, ContentType } from '../content-type-builder/types';
import { BlocksEditor } from './BlocksEditor';
import { BlockEditor } from './BlockEditor';
import { ConditionalField } from './ConditionalField';

export interface FieldRendererProps {
  field: FieldDefinition;
  value: unknown;
  onChange: (fieldName: string, value: unknown) => void;
  contentTypes?: ContentType[];
  formData?: Record<string, unknown>;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export const FieldRenderer: React.FC<FieldRendererProps> = ({ field, value, onChange, contentTypes, formData }) => {
  const label = `${field.label}${field.required ? ' *' : ''}`;

  const renderField = () => {
    switch (field.type) {
    case 'text': {
      const helperParts: string[] = [];
      if (field.minLength !== undefined) helperParts.push(`Min: ${field.minLength}`);
      if (field.maxLength !== undefined) helperParts.push(`Max: ${field.maxLength}`);
      return (
        <TextField
          fullWidth
          label={label}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(field.name, e.target.value)}
          helperText={helperParts.length > 0 ? helperParts.join(' | ') : undefined}
          slotProps={{
            htmlInput: {
              minLength: field.minLength,
              maxLength: field.maxLength,
            },
          }}
        />
      );
    }

    case 'richText': {
      return (
        <BlockEditor
          label={label}
          value={value}
          onChange={(val) => onChange(field.name, val)}
        />
      );
    }

    case 'number': {
      return (
        <TextField
          fullWidth
          label={label}
          type="number"
          value={value ?? ''}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === '') {
              onChange(field.name, null);
            } else {
              onChange(field.name, field.integer ? parseInt(raw, 10) : parseFloat(raw));
            }
          }}
          helperText={
            field.min !== undefined || field.max !== undefined
              ? `${field.min !== undefined ? `Min: ${field.min}` : ''}${field.min !== undefined && field.max !== undefined ? ' | ' : ''}${field.max !== undefined ? `Max: ${field.max}` : ''}`
              : undefined
          }
          slotProps={{
            htmlInput: {
              min: field.min,
              max: field.max,
              step: field.integer ? 1 : 'any',
            },
          }}
        />
      );
    }

    case 'boolean': {
      return (
        <FormControlLabel
          control={
            <Switch
              checked={!!value}
              onChange={(e) => onChange(field.name, e.target.checked)}
            />
          }
          label={label}
        />
      );
    }

    case 'date': {
      return (
        <TextField
          fullWidth
          label={label}
          type="date"
          value={(value as string) ?? ''}
          onChange={(e) => onChange(field.name, e.target.value)}
          slotProps={{
            inputLabel: { shrink: true },
          }}
        />
      );
    }

    case 'datetime': {
      return (
        <TextField
          fullWidth
          label={label}
          type="datetime-local"
          value={(value as string) ?? ''}
          onChange={(e) => onChange(field.name, e.target.value)}
          slotProps={{
            inputLabel: { shrink: true },
          }}
        />
      );
    }

    case 'select': {
      return (
        <TextField
          fullWidth
          label={label}
          select
          value={(value as string) ?? ''}
          onChange={(e) => onChange(field.name, e.target.value)}
        >
          {(field.options ?? []).map((opt) => (
            <MenuItem key={opt.value} value={opt.value}>
              {opt.label}
            </MenuItem>
          ))}
        </TextField>
      );
    }

    case 'slug': {
      return (
        <TextField
          fullWidth
          label={label}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(field.name, e.target.value)}
          helperText={field.generatedFrom ? `Auto-generated from "${field.generatedFrom}"` : undefined}
          slotProps={{
            input: {
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    title="Generate slug"
                    onClick={() => {
                      // The parent form manages data – fire a special event
                      // For now just slugify the current value
                      if (typeof value === 'string' && value) {
                        onChange(field.name, slugify(value));
                      }
                    }}
                  >
                    <GenerateIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ),
            },
          }}
        />
      );
    }

    case 'media': {
      return (
        <Box>
          <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary' }}>
            {label}
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'row', gap: 1, alignItems: 'center' }}>
            <Button variant="outlined" startIcon={<ImageIcon />} size="small">
              Select Media
            </Button>
            {Boolean(value) && (
              <Chip
                label={String(value)}
                size="small"
                onDelete={() => onChange(field.name, null)}
              />
            )}
          </Box>
        </Box>
      );
    }

    case 'relation': {
      return (
        <TextField
          fullWidth
          label={label}
          value={
            Array.isArray(value) ? (value as string[]).join(', ') : ((value as string) ?? '')
          }
          onChange={(e) => {
            const raw = e.target.value;
            if (field.many) {
              onChange(
                field.name,
                raw
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean),
              );
            } else {
              onChange(field.name, raw);
            }
          }}
          placeholder="Enter ID(s)"
          helperText={
            field.targetContentType
              ? `Relation to "${field.targetContentType}"${field.many ? ' (comma-separated)' : ''}`
              : undefined
          }
        />
      );
    }

    case 'json': {
      const jsonStr =
        typeof value === 'string' ? value : value != null ? JSON.stringify(value, null, 2) : '';
      return (
        <TextField
          fullWidth
          label={label}
          value={jsonStr}
          onChange={(e) => {
            try {
              onChange(field.name, JSON.parse(e.target.value));
            } catch {
              // Keep raw string if invalid JSON, let user keep editing
              onChange(field.name, e.target.value);
            }
          }}
          multiline
          rows={6}
          sx={{ '& .MuiInputBase-root': { fontFamily: 'monospace', fontSize: '0.875rem' } }}
        />
      );
    }

    case 'group': {
      const groupValue = (value as Record<string, unknown>) ?? {};
      return (
        <Paper variant="outlined" sx={{ p: 2, mt: 1 }}>
          <Typography variant="h3" sx={{ mb: 2 }}>
            {field.label}
          </Typography>
          <Stack spacing={2.5}>
            {(field.fields ?? []).map((subField) => (
              <FieldRenderer
                key={subField.name}
                field={subField}
                value={groupValue[subField.name]}
                onChange={(subName, subVal) => {
                  onChange(field.name, { ...groupValue, [subName]: subVal });
                }}
                contentTypes={contentTypes}
                formData={formData}
              />
            ))}
          </Stack>
        </Paper>
      );
    }

    case 'component': {
      const compValue = value as Record<string, unknown> | null | undefined;
      const selectedComponent = compValue?._component as string | undefined;
      const allowedNames = field.allowedComponents ?? [];

      // Resolve the content type definition for the selected component
      const compType = selectedComponent
        ? contentTypes?.find((ct) => ct.name === selectedComponent)
        : undefined;

      if (!selectedComponent) {
        // Show picker
        return (
          <Box>
            <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary' }}>
              {label}
            </Typography>
            <FormControl fullWidth size="small">
              <InputLabel>Select component</InputLabel>
              <Select
                value=""
                label="Select component"
                onChange={(e) => {
                  const typeName = e.target.value as string;
                  if (typeName) {
                    onChange(field.name, { _component: typeName });
                  }
                }}
              >
                {allowedNames.map((name) => {
                  const ct = contentTypes?.find((ct) => ct.name === name);
                  return (
                    <MenuItem key={name} value={name}>
                      {ct?.displayName ?? name}
                    </MenuItem>
                  );
                })}
              </Select>
            </FormControl>
          </Box>
        );
      }

      // Render the component's fields
      return (
        <Paper variant="outlined" sx={{ p: 2, mt: 1 }}>
          <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 1, mb: 2 }}>
            <Chip label={compType?.displayName ?? selectedComponent} size="small" color="primary" />
            <IconButton
              size="small"
              onClick={() => onChange(field.name, null)}
              title="Remove component"
            >
              <ClearIcon fontSize="small" />
            </IconButton>
          </Box>
          <Stack spacing={2.5}>
            {(compType?.fields ?? []).map((subField) => (
              <FieldRenderer
                key={subField.name}
                field={subField}
                value={(compValue as Record<string, unknown>)?.[subField.name]}
                onChange={(subName, subVal) => {
                  onChange(field.name, { ...compValue, [subName]: subVal });
                }}
                contentTypes={contentTypes}
                formData={formData}
              />
            ))}
          </Stack>
        </Paper>
      );
    }

    case 'blocks': {
      return (
        <BlocksEditor
          field={field}
          value={Array.isArray(value) ? value : []}
          onChange={onChange}
          contentTypes={contentTypes}
        />
      );
    }

    default: {
      return (
        <TextField
          fullWidth
          label={`${label} (${field.type})`}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(field.name, e.target.value)}
          helperText={`Unsupported field type: ${field.type}`}
        />
      );
    }
    }
  };

  // The condition comes from field schema
  return (
    <ConditionalField conditions={field.conditions} formData={formData}>
      {renderField()}
    </ConditionalField>
  );
}
