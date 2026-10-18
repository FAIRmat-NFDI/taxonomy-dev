import { useDeferredValue, useMemo, useState } from 'react';
import { Alert, Box, List, ListItem, Skeleton, Typography } from '@mui/material';
import { FolderIcon, TreeCollapsedIcon, TreeExpandedIcon } from '@/assets';
import { useOntology, useSelectedNode } from '@/hooks/useOntology';
import { buildOverview, filterOverview } from './overview';
import { OverviewTree } from './OverviewTree';
import { PanelBody } from './PanelBody';
import { SearchPanelHeader } from './SearchPanelHeader';

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

  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const filtered = useMemo(() => (overview ? filterOverview(overview.items, deferredQuery) : null), [overview, deferredQuery]);

  return (
    <>
      <SearchPanelHeader
        title="Overview"
        query={query}
        onQueryChange={setQuery}
        disabled={status !== 'ready'}
        searchLabel="Search the overview"
      />
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
