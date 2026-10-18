import { useState, type ReactNode } from 'react';
import { Box, Collapse, IconButton, Tooltip, useMediaQuery, useTheme } from '@mui/material';
import { CloseIcon, SearchIcon } from '@/assets';
import { OverviewSearch } from './OverviewSearch';
import { PanelHeader } from './PanelHeader';

interface SearchPanelHeaderProps {
  title: ReactNode;
  query: string;
  onQueryChange: (query: string) => void;
  /** Search is only possible once there is something to search. */
  disabled?: boolean;
  placeholder?: string;
  /** Accessible name of the field. */
  searchLabel?: string;
}

/**
 * Pane header with an expanding search: inline in the header on desktop, a full-width row
 * under the title on small screens (and in the mobile drawer). Closing clears the query.
 */
export function SearchPanelHeader({ title, query, onQueryChange, disabled = false, placeholder, searchLabel }: SearchPanelHeaderProps) {
  const theme = useTheme();
  const stacked = useMediaQuery(theme.breakpoints.down('md'), { noSsr: true });
  const [open, setOpen] = useState(false);
  const close = () => {
    setOpen(false);
    onQueryChange('');
  };
  const field = (
    <OverviewSearch value={query} onChange={onQueryChange} onClose={close} fullWidth={stacked} placeholder={placeholder} label={searchLabel} />
  );

  return (
    <>
      <PanelHeader
        title={title}
        actions={
          <>
            {!stacked && (
              <Collapse in={open} orientation="horizontal" unmountOnExit>
                {field}
              </Collapse>
            )}
            <Tooltip title={open ? 'Close search' : 'Search'}>
              <span>
                <IconButton
                  aria-label={open ? 'Close search' : (searchLabel ?? 'Search')}
                  aria-expanded={open}
                  disabled={disabled}
                  onClick={() => (open ? close() : setOpen(true))}
                >
                  {open ? <CloseIcon /> : <SearchIcon />}
                </IconButton>
              </span>
            </Tooltip>
          </>
        }
      />
      {stacked && (
        <Collapse in={open} unmountOnExit>
          <Box sx={{ px: 2, pb: 1 }}>{field}</Box>
        </Collapse>
      )}
    </>
  );
}
