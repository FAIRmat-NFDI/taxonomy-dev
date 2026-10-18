import { useState } from 'react';
import { Chip, Stack, Tooltip, Typography } from '@mui/material';
import type { EntityChip } from './entityGroups';

/** Chips shown at first, and how many more each "+N" chip adds. */
export const CHIPS_INITIAL = 15;
export const CHIPS_STEP = 10;

interface ChipGroupProps {
  title: string;
  /** `header` for a section, `subheader` for a part of one. */
  level?: 'header' | 'subheader';
  items: EntityChip[];
  /** Selected entity (one at a time); its chip is filled. */
  selected: string | null;
  /** Clicking a chip selects it; clicking the selected chip again clears the selection. */
  onToggle: (id: string) => void;
}

/**
 * A titled set of entity chips: the first 15, then a "+10" chip that reveals ten more each time.
 * Chips toggle the selection (filled primary = selected).
 */
export function ChipGroup({ title, level = 'header', items, selected, onToggle }: ChipGroupProps) {
  const [visible, setVisible] = useState(CHIPS_INITIAL);
  const shown = items.slice(0, visible);
  // A selection made elsewhere (e.g. from an issue) stays visible even when it is further down.
  const hiddenSelected = selected ? items.slice(visible).find((i) => i.id === selected) : undefined;
  if (hiddenSelected) shown.push(hiddenSelected);
  const more = Math.min(CHIPS_STEP, items.length - visible);
  const id = `chips-${title.replace(/\W+/g, '-').toLowerCase()}`;

  return (
    <Stack component="section" spacing={1} aria-labelledby={id}>
      <Typography
        id={id}
        variant={level === 'header' ? 'subtitle1' : 'subtitle2'}
        component={level === 'header' ? 'h3' : 'h4'}
        color={level === 'header' ? 'text.primary' : 'text.secondary'}
      >
        {title} ({items.length})
      </Typography>
      {items.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          None
        </Typography>
      ) : (
        <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', gap: 0.75 }}>
          {shown.map((item) => (
            <Tooltip key={item.id} title={item.curie} placement="top" describeChild>
              <Chip
                label={item.label}
                size="small"
                color={item.id === selected ? 'primary' : 'default'}
                variant={item.id === selected ? 'filled' : 'outlined'}
                onClick={() => onToggle(item.id)}
                aria-pressed={item.id === selected}
              />
            </Tooltip>
          ))}
          {more > 0 && (
            <Chip
              label={`+${more}`}
              size="small"
              color="primary"
              variant="outlined"
              onClick={() => setVisible((v) => v + CHIPS_STEP)}
              aria-label={`Show ${more} more ${title.toLowerCase()} (${items.length - visible} hidden)`}
            />
          )}
        </Stack>
      )}
    </Stack>
  );
}
