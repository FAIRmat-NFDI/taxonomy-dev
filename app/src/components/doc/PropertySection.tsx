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
 * Wide enough (own width ≥ 480px, a container query): two columns; narrower: label above value —
 * so it also fits narrow panes (e.g. the /graph details block), not just small screens.
 */
/** Section width from which labels and values sit side by side. */
const WIDE_PX = 480;

export function PropertySection({ title, rows }: PropertySectionProps) {
  return (
    <Stack component="section" spacing={1} sx={{ containerType: 'inline-size' }}>
      {title && (
        <Typography variant="h6" component="h3">
          {title}
        </Typography>
      )}
      <Box
        component="dl"
        sx={(theme) => ({
          m: 0,
          p: 2,
          borderRadius: 2,
          bgcolor: 'nomad.backgroundPrimary',
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr)',
          columnGap: 3,
          rowGap: 0.5,
          [theme.containerQueries.up(WIDE_PX)]: { gridTemplateColumns: 'minmax(120px, 30%) minmax(0, 1fr)', rowGap: 1.5 },
        })}
      >
        {rows.map((row, i) => (
          <Box key={`${row.label}-${i}`} sx={{ display: 'contents' }}>
            <Typography component="dt" variant="subtitle2" sx={i ? (theme) => ({ pt: 1, [theme.containerQueries.up(WIDE_PX)]: { pt: 0 } }) : undefined}>
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
