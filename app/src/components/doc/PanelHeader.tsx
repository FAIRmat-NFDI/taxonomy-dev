import type { ReactNode } from 'react';
import { Box, Typography } from '@mui/material';

interface PanelHeaderProps {
  /** Text, or a Skeleton while loading. */
  title: ReactNode;
  /** Controls on the right (search, source view, collapse, …). */
  actions?: ReactNode;
}

/** Pane heading (guideline "side-bar title"); stays put while PanelBody scrolls. */
export function PanelHeader({ title, actions }: PanelHeaderProps) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0, minHeight: 56, pl: 2, pr: 1, pt: 1 }}>
      <Typography variant="h5" component="h2" noWrap sx={{ flexGrow: 1, minWidth: 0 }}>
        {title}
      </Typography>
      {actions}
    </Box>
  );
}
