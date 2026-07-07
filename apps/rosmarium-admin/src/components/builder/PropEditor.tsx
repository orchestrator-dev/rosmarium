import React, { useState } from 'react';
import {
  Box,
  Typography,
  Divider,
  TextField,
  Switch,
  FormControlLabel,
  Stack,
  Button,
  Chip,
  Paper,
} from '@mui/material';
import CodeIcon from '@mui/icons-material/Code';
import SettingsEthernetIcon from '@mui/icons-material/SettingsEthernet';
import type { ComponentProp } from '@orchestrator.dev/types';
import { DataBinder, type DataBindingConfig } from './DataBinder';
import type { CanvasSection } from './Canvas';

export interface PropEditorProps {
  section: CanvasSection | null;
  onUpdateProps: (sectionId: string, newProps: Record<string, unknown>) => void;
  onClose: () => void;
}

export function PropEditor({ section, onUpdateProps, onClose }: PropEditorProps) {
  const [activeBindingProp, setActiveBindingProp] = useState<string | null>(null);

  if (!section) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          Properties
        </Typography>
        <Divider sx={{ mb: 2 }} />
        <Typography variant="body2" color="text.secondary">
          Select a component section on the canvas to edit its properties and data bindings.
        </Typography>
      </Box>
    );
  }

  const propsDef = section.component?.props || [];
  const currentProps = section.props || {};

  const handlePropChange = (propName: string, value: unknown) => {
    onUpdateProps(section.id, {
      ...currentProps,
      [propName]: value,
    });
  };

  const handleSaveBinding = (propName: string, binding: DataBindingConfig | undefined) => {
    const updatedProps = { ...currentProps };
    if (binding) {
      updatedProps[propName] = { dataBinding: binding };
    } else {
      // Revert to default or remove binding
      const def = propsDef.find((p) => p.name === propName);
      updatedProps[propName] = def?.defaultValue || '';
    }
    onUpdateProps(section.id, updatedProps);
    setActiveBindingProp(null);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <Box sx={{ p: 2, pb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h6">{section.component?.name || 'Section Props'}</Typography>
          <Typography variant="caption" color="text.secondary">
            ID: {section.id}
          </Typography>
        </Box>
        <Button size="small" onClick={onClose}>
          Close
        </Button>
      </Box>
      <Divider />

      <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 2 }}>
        {activeBindingProp ? (
          <DataBinder
            propName={activeBindingProp}
            initialBinding={
              currentProps[activeBindingProp] && typeof currentProps[activeBindingProp] === 'object'
                ? (currentProps[activeBindingProp] as { dataBinding?: DataBindingConfig }).dataBinding
                : undefined
            }
            onSave={(binding) => handleSaveBinding(activeBindingProp, binding)}
            onCancel={() => setActiveBindingProp(null)}
          />
        ) : (
          <Stack spacing={2.5}>
            {propsDef.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                This component has no configurable properties.
              </Typography>
            ) : (
              propsDef.map((prop: ComponentProp) => {
                const val = currentProps[prop.name] ?? prop.defaultValue ?? '';
                const isBound =
                  val && typeof val === 'object' && 'dataBinding' in (val as Record<string, unknown>);

                return (
                  <Paper key={prop.name} variant="outlined" sx={{ p: 1.5, bgcolor: 'background.default' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                        {prop.label || prop.name}
                      </Typography>
                      <Button
                        size="small"
                        startIcon={isBound ? <SettingsEthernetIcon /> : <CodeIcon />}
                        color={isBound ? 'secondary' : 'primary'}
                        onClick={() => setActiveBindingProp(prop.name)}
                        sx={{ textTransform: 'none', fontSize: '0.75rem' }}
                      >
                        {isBound ? 'Bound' : 'Bind Data'}
                      </Button>
                    </Box>

                    {isBound ? (
                      <Chip
                        icon={<SettingsEthernetIcon fontSize="small" />}
                        label={`Federated Query (${(val as any).dataBinding.source})`}
                        color="secondary"
                        size="small"
                        sx={{ width: '100%', justifyContent: 'flex-start' }}
                        onClick={() => setActiveBindingProp(prop.name)}
                      />
                    ) : prop.type === 'boolean' ? (
                      <FormControlLabel
                        control={
                          <Switch
                            checked={Boolean(val)}
                            onChange={(e) => handlePropChange(prop.name, e.target.checked)}
                            size="small"
                          />
                        }
                        label={prop.label}
                      />
                    ) : prop.type === 'number' ? (
                      <TextField
                        type="number"
                        size="small"
                        fullWidth
                        value={val}
                        onChange={(e) => handlePropChange(prop.name, Number(e.target.value))}
                      />
                    ) : prop.type === 'richText' ? (
                      <TextField
                        multiline
                        rows={3}
                        size="small"
                        fullWidth
                        value={String(val)}
                        onChange={(e) => handlePropChange(prop.name, e.target.value)}
                        placeholder="HTML or Markdown content..."
                      />
                    ) : (
                      <TextField
                        size="small"
                        fullWidth
                        value={String(val)}
                        onChange={(e) => handlePropChange(prop.name, e.target.value)}
                      />
                    )}
                  </Paper>
                );
              })
            )}
          </Stack>
        )}
      </Box>
    </Box>
  );
}
