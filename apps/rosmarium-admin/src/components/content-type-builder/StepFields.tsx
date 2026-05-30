import React, { useState } from 'react';
import { Box, Typography, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { FieldDefinition } from './types';
import { FieldCard } from './FieldCard';
import { AddFieldDialog } from './AddFieldDialog';

export interface StepFieldsProps {
  fields: FieldDefinition[];
  setFields: (fields: FieldDefinition[] | ((prev: FieldDefinition[]) => FieldDefinition[])) => void;
}

export function StepFields({ fields, setFields }: StepFieldsProps) {
  const [isFieldDialogOpen, setIsFieldDialogOpen] = useState(false);
  const [editingFieldIndex, setEditingFieldIndex] = useState<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setFields((items) => {
        const oldIndex = items.findIndex(i => i.name === active.id);
        const newIndex = items.findIndex(i => i.name === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const openFieldDialog = (index: number | null = null) => {
    setEditingFieldIndex(index);
    setIsFieldDialogOpen(true);
  };

  const closeFieldDialog = () => {
    setIsFieldDialogOpen(false);
    setEditingFieldIndex(null);
  };

  const handleSaveField = (field: FieldDefinition) => {
    if (editingFieldIndex !== null) {
      setFields(prev => {
        const updated = [...prev];
        updated[editingFieldIndex] = field;
        return updated;
      });
    } else {
      setFields(prev => [...prev, field]);
    }
    closeFieldDialog();
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6">Fields</Typography>
        <Button variant="outlined" startIcon={<AddIcon />} onClick={() => openFieldDialog(null)}>Add Field</Button>
      </Box>

      {fields.length > 0 ? (
        <TableContainer component={Paper} variant="outlined" sx={{ mb: 4 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 40 }}></TableCell>
                <TableCell>Label</TableCell>
                <TableCell>API Name</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Required</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <TableBody>
                <SortableContext items={fields.map(f => f.name)} strategy={verticalListSortingStrategy}>
                  {fields.map((f, i) => (
                    <FieldCard 
                      key={f.name} 
                      field={f} 
                      onEdit={() => openFieldDialog(i)} 
                      onRemove={() => setFields(prev => prev.filter((_, idx) => idx !== i))} 
                    />
                  ))}
                </SortableContext>
              </TableBody>
            </DndContext>
          </Table>
        </TableContainer>
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 4, fontStyle: 'italic' }}>
          No fields added yet. Add at least one field.
        </Typography>
      )}

      {isFieldDialogOpen && (
        <AddFieldDialog
          open={isFieldDialogOpen}
          onClose={closeFieldDialog}
          onSave={handleSaveField}
          initialField={editingFieldIndex !== null ? fields[editingFieldIndex] : undefined}
          isEditMode={editingFieldIndex !== null}
        />
      )}
    </Box>
  );
}
