import type { ReactNode } from 'react';
import { Box, Typography } from '@mui/material';

interface PageContainerProps {
  title?: string;
  actions?: ReactNode;
  children: ReactNode;
  /** Full-bleed pages (graph canvas, split panes) skip padding/max-width. */
  fullBleed?: boolean;
}

export function PageContainer({ title, actions, children, fullBleed = false }: PageContainerProps) {
  return (
    <Box sx={fullBleed ? { height: '100%' } : { p: { xs: 2, md: 3 }, maxWidth: 1400, mx: 'auto' }}>
      {(title || actions) && (
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 2 }}>
          {title && (
            <Typography variant="h5" component="h1" sx={{ flexGrow: 1 }}>
              {title}
            </Typography>
          )}
          {actions}
        </Box>
      )}
      {children}
    </Box>
  );
}
