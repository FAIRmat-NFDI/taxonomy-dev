import { InputAdornment, TextField } from '@mui/material';
import { SearchIcon } from '@/assets';

interface OverviewSearchProps {
  value: string;
  onChange: (value: string) => void;
  /** Escape closes the search. */
  onClose: () => void;
  fullWidth?: boolean;
}

/** Search field of the Overview pane (filters the tree as you type). */
export function OverviewSearch({ value, onChange, onClose, fullWidth = false }: OverviewSearchProps) {
  return (
    <TextField
      size="small"
      autoFocus
      fullWidth={fullWidth}
      placeholder="Search classes, properties, …"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
      sx={fullWidth ? undefined : { width: 200 }}
      slotProps={{
        htmlInput: { 'aria-label': 'Search the overview' },
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" />
            </InputAdornment>
          ),
        },
      }}
    />
  );
}
