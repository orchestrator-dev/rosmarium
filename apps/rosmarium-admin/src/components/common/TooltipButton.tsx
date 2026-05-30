import React from 'react';
import { Button, ButtonProps, IconButton, IconButtonProps, Tooltip } from '@mui/material';
import { ACTION_TOOLTIPS } from '../../config/tooltips';

interface TooltipButtonProps extends ButtonProps {
  actionKey?: keyof typeof ACTION_TOOLTIPS;
  tooltipTitle?: string;
}

export function TooltipButton({ actionKey, tooltipTitle, ...props }: TooltipButtonProps) {
  const title = tooltipTitle || (actionKey ? ACTION_TOOLTIPS[actionKey] : '');

  if (!title) {
    return <Button {...props} />;
  }

  return (
    <Tooltip title={title} arrow placement="top">
      {/* Tooltip requires a forwardRef DOM node, so spanning a button is safe. If Button is disabled, span wrapper helps but MUI handles disabled tooltips via wrapping automatically if configured, or we can just render normally. */}
      <span>
        <Button {...props} disabled={props.disabled} />
      </span>
    </Tooltip>
  );
}

interface TooltipIconButtonProps extends IconButtonProps {
  actionKey?: keyof typeof ACTION_TOOLTIPS;
  tooltipTitle?: string;
}

export function TooltipIconButton({ actionKey, tooltipTitle, ...props }: TooltipIconButtonProps) {
  const title = tooltipTitle || (actionKey ? ACTION_TOOLTIPS[actionKey] : '');

  if (!title) {
    return <IconButton {...props} />;
  }

  return (
    <Tooltip title={title} arrow placement="top">
      <span>
        <IconButton {...props} disabled={props.disabled} />
      </span>
    </Tooltip>
  );
}
