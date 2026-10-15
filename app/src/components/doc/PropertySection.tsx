import type { ReactNode } from 'react';
import { Box, Skeleton, Stack, Typography } from '@mui/material';

export interface PropertyRow {
  label: string;
  /** Omit while loading: a skeleton line is shown. */
  value?: ReactNode;
}

interface PropertySectionProps {
  title?: string;
  rows: PropertyRow[];
}

/**
 * pyLODE-style block: optional heading, then label/value rows on a tinted card.
 * md+: two columns; xs: label above value.
 */
export function PropertySection({ title, rows }: PropertySectionProps) {
  return (
    <Stack component="section" spacing={1}>
      {title && (
        <Typography variant="h6" component="h3">
          {title}
        </Typography>
      )}
      <Box
        component="dl"
        sx={{
          m: 0,
          p: 2,
          borderRadius: 2,
          bgcolor: 'nomad.backgroundPrimary',
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'minmax(120px, 30%) minmax(0, 1fr)' },
          columnGap: 3,
          rowGap: { xs: 0.5, sm: 1.5 },
        }}
      >
        {rows.map((row, i) => (
          <Box key={`${row.label}-${i}`} sx={{ display: 'contents' }}>
            <Typography component="dt" variant="subtitle2" sx={{ pt: { xs: i ? 1 : 0, sm: 0 } }}>
              {row.label}
            </Typography>
            <Typography component="dd" variant="body2" sx={{ m: 0, overflowWrap: 'anywhere' }}>
              {row.value ?? <Skeleton width={`${50 + ((i * 37) % 45)}%`} />}
            </Typography>
          </Box>
        ))}
      </Box>
    </Stack>
  );
}
