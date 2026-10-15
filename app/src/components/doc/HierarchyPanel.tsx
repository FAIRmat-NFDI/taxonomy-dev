import { useDeferredValue, useMemo, useState } from 'react';
import { Alert, Box, Collapse, IconButton, List, ListItem, Skeleton, Tooltip, Typography, useMediaQuery, useTheme } from '@mui/material';
import { CloseIcon, FolderIcon, SearchIcon, TreeCollapsedIcon, TreeExpandedIcon } from '@/assets';
import { useOntology, useSelectedNode } from '@/hooks/useOntology';
import { buildOverview, filterOverview } from './overview';
import { OverviewSearch } from './OverviewSearch';
import { OverviewTree } from './OverviewTree';
import { PanelBody } from './PanelBody';
import { PanelHeader } from './PanelHeader';

/** Placeholder tree shape while loading: [depth, expanded]. */
const SKELETON_TREE: Array<[number, boolean]> = [
  [0, true], [1, true], [1, true], [2, false],
  [0, true], [1, true], [2, false],
  [0, true], [1, false], [1, false],
  [0, false], [0, false], [0, false],
];

function TreeSkeleton() {
  return (
    <List dense disablePadding aria-busy>
      {SKELETON_TREE.map(([depth, expanded], i) => (
        <ListItem key={i} disableGutters sx={{ pl: 1 + depth * 2, gap: 0.5, color: 'text.secondary' }}>
          {expanded ? <TreeExpandedIcon fontSize="small" /> : <TreeCollapsedIcon fontSize="small" />}
          <FolderIcon fontSize="small" />
          <Box sx={{ flexGrow: 1, pl: 0.5 }}>
            <Skeleton width={`${40 + ((i * 29) % 40)}%`} />
          </Box>
        </ListItem>
      ))}
    </List>
  );
}

/**
 * Column 1: grouped hierarchy (pyLODE groups, WebProtégé-style tree).
 * Rendered in the desktop column and in the mobile nav drawer, so it depends on nothing
 * but Redux (the model) and the URL (the selection).
 */
export function HierarchyPanel() {
  const { status, model, source, access, error } = useOntology();
  const [selected, select] = useSelectedNode();
  const overview = useMemo(() => (model ? buildOverview(model) : null), [model]);

  // Search: inline in the header on desktop, a full-width row under the title on small screens
  // (and in the mobile drawer).
  const theme = useTheme();
  const stacked = useMediaQuery(theme.breakpoints.down('md'), { noSsr: true });
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const filtered = useMemo(() => (overview ? filterOverview(overview.items, deferredQuery) : null), [overview, deferredQuery]);
  const closeSearch = () => {
    setSearchOpen(false);
    setQuery('');
  };
  const field = <OverviewSearch value={query} onChange={setQuery} onClose={closeSearch} fullWidth={stacked} />;

  return (
    <>
      <PanelHeader
        title="Overview"
        actions={
          <>
            {!stacked && (
              <Collapse in={searchOpen} orientation="horizontal" unmountOnExit>
                {field}
              </Collapse>
            )}
            <Tooltip title={searchOpen ? 'Close search' : 'Search'}>
              <span>
                <IconButton
                  aria-label={searchOpen ? 'Close search' : 'Search the overview'}
                  aria-expanded={searchOpen}
                  disabled={status !== 'ready'}
                  onClick={() => (searchOpen ? closeSearch() : setSearchOpen(true))}
                >
                  {searchOpen ? <CloseIcon /> : <SearchIcon />}
                </IconButton>
              </span>
            </Tooltip>
          </>
        }
      />
      {stacked && (
        <Collapse in={searchOpen} unmountOnExit>
          <Box sx={{ px: 2, pb: 1 }}>{field}</Box>
        </Collapse>
      )}
      <PanelBody dense>
        {filtered && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', px: 1, pb: 1 }} role="status">
            {filtered.matches === 0 ? 'No matches' : `${filtered.matches} match${filtered.matches === 1 ? '' : 'es'}`}
          </Typography>
        )}
        {(status === 'idle' || status === 'loading') && <TreeSkeleton />}
        {status === 'login-required' && (
          <Alert severity="info" sx={{ mx: 1 }}>
            {access?.reason === 'protected-branch' ? `Branch ${source?.branch} is protected.` : 'This repository is not public.'} Sign in to load
            it.
          </Alert>
        )}
        {status === 'error' && (
          <Alert severity="error" sx={{ mx: 1 }}>
            {error?.message}
          </Alert>
        )}
        {status === 'ready' && overview && (
          <OverviewTree key={`${source?.branch}@${source?.commit}`} overview={overview} filtered={filtered} selected={selected} onSelect={select} />
        )}
      </PanelBody>
    </>
  );
}
