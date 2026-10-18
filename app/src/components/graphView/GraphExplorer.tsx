import { useMemo, useState } from 'react';
import { Alert, Box, Chip, Dialog, DialogContent, DialogTitle, IconButton, Paper, Stack, Tooltip, Typography, useMediaQuery, useTheme } from '@mui/material';
import { buildOntologyGraph, graphRootFor, queryErrorMessage, runSparql, withPrefixes, type LoadedSource, type OntologyModel, type SparqlResult } from '@/api';
import { GraphCanvas } from '@/components/doc/graph/GraphCanvas';
import { GraphControls } from '@/components/doc/graph/GraphControls';
import { GraphLegend } from '@/components/doc/graph/GraphLegend';
import { createGraphIndex, fullGraph, MAX_NODES, neighbourhood, subgraphOf, type Direction } from '@/components/doc/graph/neighbourhood';
import { CloseIcon, FullscreenIcon } from '@/assets';
import { useSelectedNode } from '@/hooks/useOntology';
import { monoFontFamily } from '@/theme';
import { SparqlBar } from './SparqlBar';

/** Neighbourhood depth when a node is double-clicked. */
export const SUBGRAPH_DEPTH = 2;

interface GraphExplorerProps {
  model: OntologyModel;
  source: LoadedSource;
  text: string | null;
}


/**
 * /graph main view: the whole ontology graph (same canvas, styles and legend as /doc).
 *  - chip / node selected (?node=) → camera centres and zooms on it, no new layout;
 *  - double-click a node → its neighbourhood (degree 2 by default, adjustable, like /doc);
 *  - SPARQL → only the nodes the query returns (and the links between them).
 * A neighbourhood is shown on top of a SPARQL result; closing it returns to the result.
 */
export function GraphExplorer({ model, source, text }: GraphExplorerProps) {
  const graph = useMemo(() => buildOntologyGraph(model), [model]);
  const index = useMemo(() => createGraphIndex(graph), [graph]);
  const [selected, select] = useSelectedNode();
  const focusId = selected ? graphRootFor(model, graph, selected) : null;

  const [subRoot, setSubRoot] = useState<string | null>(null);
  const [direction, setDirection] = useState<Direction>('all');
  const [degree, setDegree] = useState(SUBGRAPH_DEPTH);
  /** Last successful SPARQL result (kept when a later query fails). */
  const [result, setResult] = useState<SparqlResult | null>(null);
  const [running, setRunning] = useState(false);
  const [query, setQuery] = useState('');
  const [queryError, setQueryError] = useState<string | null>(null);
  const clearSparql = () => {
    setResult(null);
    setQueryError(null);
  };
  const [edge, setEdge] = useState<string | null>(null);

  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'), { noSsr: true });
  const isPhone = useMediaQuery(theme.breakpoints.down('sm'), { noSsr: true });
  const [fullScreen, setFullScreen] = useState(false);
  /** The dialog's canvas mounts once the open transition has finished (final size known), as on /doc. */
  const [dialogReady, setDialogReady] = useState(false);

  const full = useMemo(() => fullGraph(index), [index]);
  const sparqlView = useMemo(() => (result && result.kind !== 'ask' ? subgraphOf(index, result.iris) : null), [index, result]);
  const subView = useMemo(() => (subRoot ? neighbourhood(index, subRoot, direction, Math.round(degree)) : null), [index, subRoot, direction, degree]);
  const view = subView ?? sparqlView ?? full;

  const runQuery = async (query: string) => {
    if (!text) return;
    setRunning(true);
    setQueryError(null);
    try {
      const next = await runSparql(text, `${source.branch}@${source.commit ?? ''}`, withPrefixes(query, model.prefixes));
      setSubRoot(null);
      setResult(next);
    } catch (e) {
      setQueryError(queryErrorMessage((e as Error).message, Object.keys(model.prefixes).length > 0));
    } finally {
      setRunning(false);
    }
  };

  const label = (id: string) => graph.nodes.find((n) => n.id === id)?.label ?? id;
  const summary = edge ?? `${view.nodeCount} nodes · ${view.edgeCount} links${subView?.truncated ? ` · limited to ${MAX_NODES} nodes` : ''}`;

  const status = (
    <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 1 }}>
      <Typography variant="caption" color="text.secondary" sx={{ flexGrow: 1 }} role="status">
        {summary}
      </Typography>
      {sparqlView && result && result.kind !== 'ask' && (
        <Chip
          size="small"
          color="secondary"
          variant="outlined"
          label={`SPARQL · ${result.rows} ${result.rows === 1 ? 'result' : 'results'} · ${sparqlView.nodeCount} in graph`}
          onDelete={() => setResult(null)}
        />
      )}
      {subRoot && <Chip size="small" color="primary" variant="outlined" label={`Neighbourhood of ${label(subRoot)}`} onDelete={() => setSubRoot(null)} />}
      {subView && <GraphControls direction={direction} onDirection={setDirection} degree={degree} maxDepth={subView.maxDepth} onDegree={setDegree} />}
    </Stack>
  );

  const canvas = (height: number | string) =>
    view.nodeCount === 0 ? (
      <Typography variant="body2" color="text.secondary" sx={{ p: 3, textAlign: 'center' }}>
        {sparqlView ? 'The query returned no nodes of this graph.' : 'Nothing to draw.'}
      </Typography>
    ) : (
      <GraphCanvas
        elements={view.elements}
        rootId={subRoot}
        focusId={focusId}
        zoomToFocusOnLayout={view === full}
        onSelect={select}
        onExpand={(id) => {
          setDegree(SUBGRAPH_DEPTH);
          setSubRoot(id);
        }}
        onEdge={setEdge}
        height={height}
        label="Ontology graph"
      />
    );

  // Query feedback + the SPARQL line, under the graph (also in full screen).
  const sparqlBlock = (
    <Stack spacing={1}>
      {queryError && (
        <Alert severity="error" onClose={() => setQueryError(null)}>
          <Typography variant="body2" component="pre" sx={{ m: 0, fontFamily: monoFontFamily, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
            {queryError}
          </Typography>
        </Alert>
      )}
      {result?.kind === 'ask' && (
        <Alert severity="info" onClose={() => setResult(null)}>
          ASK → <strong>{String(result.value)}</strong>
        </Alert>
      )}
      <SparqlBar query={query} onQueryChange={setQuery} onRun={(q) => void runQuery(q)} onClear={clearSparql} running={running} active={!!result || !!queryError} disabled={!text} />
    </Stack>
  );

  return (
    <Stack spacing={1} sx={{ height: isDesktop ? '100%' : 'auto', minHeight: 0, px: 2, pb: 2 }}>
      {status}
      {/* The graph card: canvas (+ full-screen button) and legend */}
      <Paper variant="outlined" sx={{ flexGrow: 1, minHeight: isDesktop ? 0 : 480, display: 'flex', flexDirection: 'column', borderRadius: 2, overflow: 'hidden' }}>
        <Box sx={{ position: 'relative', flexGrow: 1, minHeight: 0 }}>
          {!fullScreen && canvas(isDesktop ? '100%' : 480)}
          <Tooltip title="Full screen" placement="left">
            <IconButton aria-label="Open graph full screen" onClick={() => setFullScreen(true)} sx={{ position: 'absolute', right: 8, bottom: 8 }}>
              <FullscreenIcon />
            </IconButton>
          </Tooltip>
        </Box>
        <Box sx={{ flexShrink: 0, maxHeight: isDesktop ? 140 : undefined, overflowY: 'auto' }}>
          <GraphLegend elements={view.elements} />
        </Box>
      </Paper>
      <Box sx={{ flexShrink: 0 }}>{sparqlBlock}</Box>

      <Dialog
        open={fullScreen}
        onClose={() => setFullScreen(false)}
        fullWidth
        maxWidth="xl"
        fullScreen={isPhone}
        slotProps={{
          paper: { sx: { height: { sm: '90vh' } } },
          transition: { onEntered: () => setDialogReady(true), onExited: () => setDialogReady(false) },
        }}
      >
        <DialogTitle component="div" sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="h6" component="h2" noWrap>
              Graph
            </Typography>
            {status}
          </Box>
          <IconButton aria-label="Close" onClick={() => setFullScreen(false)}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <Box sx={{ flexGrow: 1, minHeight: 0 }}>{dialogReady && canvas('100%')}</Box>
          <GraphLegend elements={view.elements} />
          <Box sx={{ p: 2, pt: 1 }}>{sparqlBlock}</Box>
        </DialogContent>
      </Dialog>
    </Stack>
  );
}
