import React from 'react';
import { TableRow, TableCell, Chip, IconButton } from '@mui/material';
import { DragIndicator as DragIndicatorIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FieldDefinition } from './types';

export interface FieldCardProps {
  field: FieldDefinition;
  onEdit: () => void;
  onRemove: () => void;
}

export function FieldCard({ field, onEdit, onRemove }: FieldCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: field.name });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <TableRow ref={setNodeRef} style={style} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
      <TableCell sx={{ width: 40, cursor: 'grab' }} {...attributes} {...listeners}>
        <DragIndicatorIcon color="action" />
      </TableCell>
      <TableCell>{field.label}</TableCell>
      <TableCell sx={{ fontFamily: 'monospace' }}>{field.name}</TableCell>
      <TableCell><Chip size="small" label={field.type} /></TableCell>
      <TableCell>{field.required ? 'Yes' : 'No'}</TableCell>
      <TableCell align="right">
        <IconButton size="small" color="primary" onClick={onEdit} aria-label="Edit field" title="Edit field">
          <EditIcon fontSize="small" />
        </IconButton>
        <IconButton size="small" color="error" onClick={onRemove} aria-label="Remove field" title="Remove field">
          <DeleteIcon fontSize="small" />
        </IconButton>
      </TableCell>
    </TableRow>
  );
}
