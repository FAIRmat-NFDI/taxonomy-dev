import type { ReactNode } from 'react';
import { Box, Tooltip, Typography } from '@mui/material';

interface PanelHeaderProps {
  /** Text, or a Skeleton while loading. */
  title: ReactNode;
  /** Smaller second line (e.g. the IRI); full text in a tooltip when truncated. */
  subtitle?: string;
  /** Controls on the right (search, source view, collapse, …). */
  actions?: ReactNode;
}

/** Pane heading (guideline "side-bar title"); stays put while PanelBody scrolls. */
export function PanelHeader({ title, subtitle, actions }: PanelHeaderProps) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0, minHeight: 56, pl: 2, pr: 1, pt: 1 }}>
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Typography variant="h5" component="h2" noWrap>
          {title}
        </Typography>
        {subtitle && (
          <Tooltip title={subtitle} placement="bottom-start" describeChild>
            <Typography variant="caption" color="text.secondary" component="p" noWrap>
              {subtitle}
            </Typography>
          </Tooltip>
        )}
      </Box>
      {actions}
    </Box>
  );
}
