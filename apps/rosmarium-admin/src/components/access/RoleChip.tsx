import React from 'react';
import { Chip, ChipProps } from '@mui/material';

export interface RoleChipProps extends Omit<ChipProps, 'color'> {
  role: string;
}

export function RoleChip({ role, ...props }: RoleChipProps) {
  let color: ChipProps['color'] = 'default';
  
  switch (role) {
    case 'super_admin':
      color = 'error';
      break;
    case 'admin':
      color = 'warning';
      break;
    case 'editor':
      color = 'primary';
      break;
    case 'author':
      color = 'info';
      break;
    case 'viewer':
    default:
      color = 'default';
      break;
  }

  return (
    <Chip
      label={role}
      color={color}
      size="small"
      variant="outlined"
      {...props}
    />
  );
}
