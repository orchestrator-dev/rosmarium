import React from 'react';
import { Box, Typography, Paper, IconButton, Stack, Chip } from '@mui/material';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import DeleteIcon from '@mui/icons-material/Delete';
import CodeIcon from '@mui/icons-material/Code';
import type { PageSection, ComponentDefinition } from '@orchestrator.dev/types';

export interface CanvasSection extends PageSection {
  component?: ComponentDefinition;
}

export interface CanvasProps {
  sections: CanvasSection[];
  selectedSectionId: string | null;
  onSelectSection: (sectionId: string) => void;
  onRemoveSection: (sectionId: string) => void;
  onMoveSection: (index: number, direction: 'up' | 'down') => void;
}

export function Canvas({
  sections,
  selectedSectionId,
  onSelectSection,
  onRemoveSection,
  onMoveSection,
}: CanvasProps) {
  if (sections.length === 0) {
    return (
      <Box sx={{ m: 'auto', p: 4, textAlign: 'center', color: 'text.secondary' }}>
        <Typography variant="h6" gutterBottom>
          Empty Page Canvas
        </Typography>
        <Typography variant="body2">
          Click or drag a component from the left palette to begin composing this page.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
      {sections.map((section, index) => {
        const isSelected = section.id === selectedSectionId;
        const compName = section.component?.name || section.componentId;
        const compCategory = section.component?.category || 'Custom';
        const hasFederatedBinding = Object.values(section.props || {}).some(
          (val) => val && typeof val === 'object' && 'dataBinding' in (val as Record<string, unknown>)
        );

        return (
          <Paper
            key={section.id}
            variant="outlined"
            onClick={() => onSelectSection(section.id)}
            sx={{
              p: 2,
              position: 'relative',
              cursor: 'pointer',
              border: isSelected ? '2px solid' : '1px solid',
              borderColor: isSelected ? 'primary.main' : 'divider',
              bgcolor: isSelected ? 'primary.50' : 'background.paper',
              transition: 'all 0.2s ease',
              '&:hover': {
                borderColor: isSelected ? 'primary.main' : 'text.disabled',
                boxShadow: 1,
              },
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }} color="primary">
                  {compName}
                </Typography>
                <Chip label={compCategory} size="small" variant="outlined" />
                {hasFederatedBinding && (
                  <Chip
                    icon={<CodeIcon fontSize="small" />}
                    label="Federated Data"
                    size="small"
                    color="secondary"
                  />
                )}
              </Stack>

              <Stack direction="row" spacing={0.5} onClick={(e) => e.stopPropagation()}>
                <IconButton
                  size="small"
                  disabled={index === 0}
                  onClick={() => onMoveSection(index, 'up')}
                  title="Move Up"
                >
                  <ArrowUpwardIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  disabled={index === sections.length - 1}
                  onClick={() => onMoveSection(index, 'down')}
                  title="Move Down"
                >
                  <ArrowDownwardIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => onRemoveSection(section.id)}
                  title="Remove Section"
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Stack>
            </Box>

            <Box
              sx={{
                p: 1.5,
                bgcolor: 'background.default',
                borderRadius: 1,
                border: '1px dashed',
                borderColor: 'divider',
                fontFamily: 'monospace',
                fontSize: '0.8rem',
                overflowX: 'auto',
              }}
            >
              <pre style={{ margin: 0 }}>{JSON.stringify(section.props, null, 2)}</pre>
            </Box>
          </Paper>
        );
      })}
    </Box>
  );
}
