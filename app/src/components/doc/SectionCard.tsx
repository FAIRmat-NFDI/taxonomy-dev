import type { ReactNode } from 'react';
import { Box, Paper, Stack, Typography } from '@mui/material';

interface SectionCardProps {
  title: ReactNode;
  /** Small text after the title (e.g. "experimental"). */
  badge?: ReactNode;
  /** Controls on the right (view toggles). */
  actions?: ReactNode;
  children: ReactNode;
  /** Body without padding (code, graph). */
  flush?: boolean;
}

/** A titled block of the entity column (Overview · Axioms · Graph). */
export function SectionCard({ title, badge, actions, children, flush = false }: SectionCardProps) {
  return (
    <Paper component="section" sx={{ borderRadius: 2, overflow: 'hidden' }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minHeight: 48, px: 2, py: 0.5, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="subtitle2" component="h3" sx={{ flexGrow: 1 }}>
          {title}
          {badge}
        </Typography>
        {actions}
      </Stack>
      <Box sx={flush ? undefined : { p: 2 }}>{children}</Box>
    </Paper>
  );
}
