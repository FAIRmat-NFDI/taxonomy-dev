import { MenuItem, Select, Slider, Stack, Typography } from '@mui/material';
import type { Direction } from './neighbourhood';

interface GraphControlsProps {
  direction: Direction;
  onDirection: (d: Direction) => void;
  /** Continuous slider value; the graph uses Math.round(degree). */
  degree: number;
  maxDepth: number;
  onDegree: (d: number) => void;
}

/**
 * Degree slider (moves smoothly, snaps to whole steps on release; Shift/Page keys jump one step)
 * + direction select.
 */
export function GraphControls({ direction, onDirection, degree, maxDepth, onDegree }: GraphControlsProps) {
  const max = Math.max(maxDepth, 1);
  const marks = Array.from({ length: max }, (_, i) => ({ value: i + 1 }));
  return (
    <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center', width: { xs: 160, sm: 220 } }}>
        <Typography variant="subtitle2" component="label" id="graph-degree-label">
          Degree
        </Typography>
        <Slider
          size="small"
          color="secondary"
          aria-labelledby="graph-degree-label"
          value={Math.min(degree, max)}
          min={1}
          max={max}
          step={0.05}
          shiftStep={1}
          marks={marks}
          valueLabelDisplay="auto"
          valueLabelFormat={(v) => Math.round(v)}
          disabled={maxDepth <= 1}
          onChange={(_, value) => onDegree(value as number)}
          onChangeCommitted={(_, value) => onDegree(Math.round(value as number))}
        />
      </Stack>
      <Select size="small" value={direction} onChange={(e) => onDirection(e.target.value as Direction)} inputProps={{ 'aria-label': 'Direction' }}>
        <MenuItem value="all">All</MenuItem>
        <MenuItem value="in">Inward</MenuItem>
        <MenuItem value="out">Outward</MenuItem>
      </Select>
    </Stack>
  );
}
