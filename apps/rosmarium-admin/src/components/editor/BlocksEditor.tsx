import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  IconButton,
  Chip,
  Paper,
  Stack,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Menu,
  MenuItem,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon,
  ArrowUpward as MoveUpIcon,
  ArrowDownward as MoveDownIcon,
} from '@mui/icons-material';
import type { FieldDefinition, ContentType } from '../content-type-builder/types';
import { FieldRenderer } from './FieldRenderer';

export interface BlocksEditorProps {
  field: FieldDefinition;
  value: unknown[];
  onChange: (fieldName: string, value: unknown[]) => void;
  contentTypes?: ContentType[];
}

export function BlocksEditor({ field, value, onChange, contentTypes }: BlocksEditorProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const blocks = Array.isArray(value) ? value : [];
  const allowedNames = field.allowedComponents ?? [];
  const minBlocks = field.minBlocks ?? 0;
  const maxBlocks = field.maxBlocks ?? Infinity;
  const canAdd = blocks.length < maxBlocks;
  const canDelete = blocks.length > minBlocks;

  const handleAddBlock = (componentName: string) => {
    setAnchorEl(null);
    const newBlock = { _component: componentName };
    onChange(field.name, [...blocks, newBlock]);
  };

  const handleDeleteBlock = (index: number) => {
    const next = blocks.filter((_, i) => i !== index);
    onChange(field.name, next);
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const next = [...blocks];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    onChange(field.name, next);
  };

  const handleMoveDown = (index: number) => {
    if (index >= blocks.length - 1) return;
    const next = [...blocks];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    onChange(field.name, next);
  };

  const handleBlockFieldChange = (index: number, subName: string, subVal: unknown) => {
    const next = [...blocks];
    next[index] = { ...(next[index] as Record<string, unknown>), [subName]: subVal };
    onChange(field.name, next);
  };

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {field.label}{field.required ? ' *' : ''} — {blocks.length} block{blocks.length !== 1 ? 's' : ''}
          {maxBlocks !== Infinity ? ` (max ${maxBlocks})` : ''}
        </Typography>
        <Button
          variant="outlined"
          size="small"
          startIcon={<AddIcon />}
          disabled={!canAdd}
          onClick={(e) => setAnchorEl(e.currentTarget)}
        >
          Add Block
        </Button>
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={() => setAnchorEl(null)}
        >
          {allowedNames.map((name) => {
            const ct = contentTypes?.find((c) => c.name === name);
            return (
              <MenuItem key={name} onClick={() => handleAddBlock(name)}>
                {ct?.displayName ?? name}
              </MenuItem>
            );
          })}
        </Menu>
      </Box>

      {blocks.length === 0 && (
        <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            No blocks added yet. Click "Add Block" to get started.
          </Typography>
        </Paper>
      )}

      {blocks.map((block, index) => {
        const blockData = block as Record<string, unknown>;
        const componentName = blockData._component as string;
        const compType = contentTypes?.find((ct) => ct.name === componentName);

        return (
          <Accordion
            key={index}
            defaultExpanded
            sx={{
              mb: 1,
              '&:before': { display: 'none' },
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: '8px !important',
              overflow: 'hidden',
            }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              sx={{ '& .MuiAccordionSummary-content': { alignItems: 'center', gap: 1 } }}
            >
              <Chip
                label={compType?.displayName ?? componentName}
                size="small"
                color="primary"
                variant="outlined"
              />
              <Typography variant="caption" sx={{ color: 'text.secondary', ml: 1 }}>
                #{index + 1}
              </Typography>
              <Box sx={{ flex: 1 }} />
              <IconButton
                size="small"
                disabled={index === 0}
                onClick={(e) => {
                  e.stopPropagation();
                  handleMoveUp(index);
                }}
                title="Move up"
              >
                <MoveUpIcon fontSize="small" />
              </IconButton>
              <IconButton
                size="small"
                disabled={index >= blocks.length - 1}
                onClick={(e) => {
                  e.stopPropagation();
                  handleMoveDown(index);
                }}
                title="Move down"
              >
                <MoveDownIcon fontSize="small" />
              </IconButton>
              <IconButton
                size="small"
                color="error"
                disabled={!canDelete}
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteBlock(index);
                }}
                title="Delete block"
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </AccordionSummary>
            <AccordionDetails>
              <Stack spacing={2.5}>
                {(compType?.fields ?? []).map((subField) => (
                  <FieldRenderer
                    key={subField.name}
                    field={subField}
                    value={blockData[subField.name]}
                    onChange={(subName, subVal) => handleBlockFieldChange(index, subName, subVal)}
                    contentTypes={contentTypes}
                  />
                ))}
                {!compType && (
                  <Typography variant="body2" color="warning.main">
                    Component type "{componentName}" not found in content types.
                  </Typography>
                )}
              </Stack>
            </AccordionDetails>
          </Accordion>
        );
      })}
    </Box>
  );
}
