import type { ReactNode } from 'react';
import { Box } from '@mui/material';

/** Scrolling area of a pane (desktop); on small screens the page scrolls instead. */
export function PanelBody({ children, dense = false }: { children: ReactNode; dense?: boolean }) {
  return (
    <Box sx={{ flexGrow: 1, minHeight: 0, overflow: { md: 'auto' }, px: dense ? 1 : 2, pb: 2 }}>
      {children}
    </Box>
  );
}
