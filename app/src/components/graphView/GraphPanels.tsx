import { useDeferredValue, useMemo, useState } from 'react';
import { Alert, Box, IconButton, Skeleton, Stack, Tooltip, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router';
import { OpenInViewIcon, PaneCollapseIcon } from '@/assets';
import { CommentsPanel, OverviewSection, PanelBody, PanelHeader, SearchPanelHeader, describeNode, describeOntology } from '@/components/doc';
import { paths } from '@/routes/paths';
import { useOntology, useSelectedNode } from '@/hooks/useOntology';
import { ChipGroup } from './ChipGroup';
import { GraphExplorer } from './GraphExplorer';
import { entityGroups, filterGroups, groupSize } from './entityGroups';

/* /graph panes. Each pane = PanelHeader (stays) + PanelBody (scrolls), exactly like /doc. */

/** Placeholder chips while the ontology loads. */
function ChipsSkeleton() {
  return (
    <Stack spacing={1}>
      <Skeleton variant="text" width="40%" />
      <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', gap: 0.75 }}>
        {Array.from({ length: 12 }, (_, i) => (
          <Skeleton key={i} variant="rounded" width={48 + ((i * 23) % 50)} height={24} sx={{ borderRadius: 4 }} />
        ))}
      </Stack>
    </Stack>
  );
}

/**
 * Column 1 (div_1): classes and properties (object / data) of the loaded ontology as chips,
 * with one search that filters all groups. In the nav drawer on small screens.
 */
export function GraphSidebarPanel() {
  const { status, model, source, access, error } = useOntology();
  // One selected entity at a time, in the URL like /doc (?node=…); shared with the issues block.
  const [selected, select] = useSelectedNode();
  const toggle = (id: string) => select(id === selected ? null : id);
  const groups = useMemo(() => (model ? entityGroups(model) : null), [model]);
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const filtered = useMemo(() => (groups ? filterGroups(groups, deferredQuery) : null), [groups, deferredQuery]);
  const searching = !!deferredQuery.trim();

  return (
    <>
      <SearchPanelHeader
        title="Entities"
        query={query}
        onQueryChange={setQuery}
        disabled={status !== 'ready'}
        placeholder="Search classes, properties, …"
        searchLabel="Search entities"
      />
      <PanelBody>
        {(status === 'idle' || status === 'loading') && (
          <Stack spacing={3}>
            <ChipsSkeleton />
            <ChipsSkeleton />
          </Stack>
        )}
        {status === 'login-required' && (
          <Alert severity="info">
            {access?.reason === 'protected-branch' ? `Branch ${source?.branch} is protected.` : 'This repository is not public.'} Sign in to load it.
          </Alert>
        )}
        {status === 'error' && <Alert severity="error">{error?.message}</Alert>}
        {status === 'ready' && filtered && (
          // Keyed by the query: a new search starts again at 15 chips per group.
          <Stack key={deferredQuery} spacing={3}>
            {searching && (
              <Typography variant="caption" color="text.secondary" role="status">
                {groupSize(filtered) === 0 ? 'No matches' : `${groupSize(filtered)} match${groupSize(filtered) === 1 ? '' : 'es'}`}
              </Typography>
            )}
            <ChipGroup title="Classes" items={filtered.classes} selected={selected} onToggle={toggle} />
            <Stack spacing={2}>
              <Typography variant="subtitle1" component="h3">
                Properties ({filtered.objectProperties.length + filtered.dataProperties.length})
              </Typography>
              <ChipGroup title="Object properties" level="subheader" items={filtered.objectProperties} selected={selected} onToggle={toggle} />
              <ChipGroup title="Data properties" level="subheader" items={filtered.dataProperties} selected={selected} onToggle={toggle} />
            </Stack>
          </Stack>
        )}
      </PanelBody>
    </>
  );
}

/** Column 2 (div_2): the whole ontology graph with SPARQL (see GraphExplorer). */
export function GraphCanvasPanel() {
  const { status, model, source, text, access, error } = useOntology();
  const ready = status === 'ready' && model && source;
  return (
    <>
      <PanelHeader title="Graph" />
      {ready ? (
        <Box sx={{ flexGrow: 1, minHeight: 0 }}>
          <GraphExplorer key={`${source.branch}@${source.commit}`} model={model} source={source} text={text} />
        </Box>
      ) : (
        <PanelBody>
          {(status === 'idle' || status === 'loading') && <Skeleton variant="rounded" height={320} />}
          {status === 'login-required' && (
            <Alert severity="info">
              {access?.reason === 'protected-branch' ? `Branch ${source?.branch} is protected.` : 'This repository is not public.'} Sign in to load it.
            </Alert>
          )}
          {status === 'error' && <Alert severity="error">{error?.message}</Alert>}
        </PanelBody>
      )}
    </>
  );
}

/**
 * Column 3, first block (div_3_1): the selected entity — name, IRI and its /doc overview — or, with no
 * chip selected, the ontology itself. The link icon opens the same thing in /doc; the chevron collapses
 * the column (desktop).
 */
export function GraphDetailsPanel({ onCollapse }: { onCollapse?: () => void }) {
  const { status, model, source, text, access } = useOntology();
  const [selected] = useSelectedNode();
  const [showCode, setShowCode] = useState(false);

  const ready = status === 'ready' && model && source;
  const view = ready ? (selected ? describeNode(model, source, selected) : describeOntology(model, source, !access?.canComment)) : null;
  const iri = selected ? (model?.entities[selected]?.iri ?? (model?.header?.iri === selected ? selected : undefined)) : model?.header?.iri;
  const docLink = selected ? `${paths.doc}?${new URLSearchParams({ node: selected })}` : paths.doc;
  const loading = status === 'idle' || status === 'loading';

  return (
    <>
      <PanelHeader
        title={view?.title ?? (loading ? <Skeleton width="60%" /> : 'Overview')}
        subtitle={iri}
        actions={
          <>
            <Tooltip title="Open in Doc view">
              <span>
                <IconButton aria-label="Open in Doc view" component={RouterLink} to={docLink} disabled={!ready}>
                  <OpenInViewIcon />
                </IconButton>
              </span>
            </Tooltip>
            {onCollapse && (
              <Tooltip title="Hide panel">
                <IconButton aria-label="Hide panel" onClick={onCollapse}>
                  <PaneCollapseIcon />
                </IconButton>
              </Tooltip>
            )}
          </>
        }
      />
      <PanelBody>
        {loading && <Skeleton variant="rounded" height={120} />}
        {ready && selected && !view && <Alert severity="warning">Nothing called “{selected}” in this version of the ontology.</Alert>}
        {ready && view && (
          <OverviewSection
            model={model}
            text={text}
            source={source}
            nodeId={selected}
            view={view}
            showCode={showCode}
            onToggleCode={() => setShowCode((v) => !v)}
          />
        )}
      </PanelBody>
    </>
  );
}

/**
 * Column 3, second block (div_3_2): issues, exactly as on /doc. With no chip selected it lists every
 * open issue about the file (newest first, each labelled with its node); with a chip selected, that
 * entity's issues — and "Create issue" refers to it.
 */
export function GraphInfoPanel() {
  return <CommentsPanel showAllWhenNoSelection />;
}
