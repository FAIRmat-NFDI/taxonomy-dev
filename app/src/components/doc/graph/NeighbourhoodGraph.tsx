import { useMemo, useState } from 'react';
import { Box, Dialog, DialogContent, DialogTitle, IconButton, Paper, Stack, Tooltip, Typography, useMediaQuery, useTheme } from '@mui/material';
import { buildOntologyGraph, graphRootFor, type OntologyModel } from '@/api';
import { CloseIcon, FullscreenIcon } from '@/assets';
import { GraphCanvas } from './GraphCanvas';
import { GraphControls } from './GraphControls';
import { GraphLegend } from './GraphLegend';
import { createGraphIndex, DEFAULT_DEPTH, MAX_NODES, neighbourhood, type Direction } from './neighbourhood';

interface NeighbourhoodGraphProps {
  model: OntologyModel;
  /** Selected node (entity IRI or expression id). */
  nodeId: string;
  onSelect: (id: string) => void;
}

/**
 * Graph block under the details / code view: the selected node and its neighbours up to N steps,
 * following inward, outward, or all edges. Opens in a large dialog for exploring.
 */
export default function NeighbourhoodGraph({ model, nodeId, onSelect }: NeighbourhoodGraphProps) {
  const graph = useMemo(() => buildOntologyGraph(model), [model]);
  const index = useMemo(() => createGraphIndex(graph), [graph]);
  const rootId = graphRootFor(model, graph, nodeId);

  const [direction, setDirection] = useState<Direction>('all');
  const [degree, setDegree] = useState(DEFAULT_DEPTH);
  const depth = Math.round(degree);
  const [fullScreen, setFullScreen] = useState(false);
  /** The dialog's canvas mounts only once the open transition has finished (final size known). */
  const [dialogReady, setDialogReady] = useState(false);
  const [edge, setEdge] = useState<string | null>(null);
  const theme = useTheme();
  const isPhone = useMediaQuery(theme.breakpoints.down('sm'), { noSsr: true });

  const view = useMemo(() => (rootId ? neighbourhood(index, rootId, direction, depth) : null), [index, rootId, direction, depth]);
  if (!rootId || !view) return null;

  const title = graph.nodes.find((n) => n.id === rootId)?.label ?? rootId;
  const controls = <GraphControls direction={direction} onDirection={setDirection} degree={degree} maxDepth={view.maxDepth} onDegree={setDegree} />;
  const summary = edge ?? `${view.nodeCount} nodes · ${view.edgeCount} links${view.truncated ? ` · limited to ${MAX_NODES} nodes` : ''}`;
  const empty = view.nodeCount <= 1;

  return (
    <Paper sx={{ borderRadius: 2, overflow: 'hidden' }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 1, px: 2, py: 1, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ flexGrow: 1, minWidth: 120 }}>
          <Typography variant="subtitle2">Graph</Typography>
          <Typography variant="caption" color="text.secondary">
            {summary}
          </Typography>
        </Box>
        {controls}
        <Tooltip title="Full screen">
          <IconButton aria-label="Open graph full screen" onClick={() => setFullScreen(true)}>
            <FullscreenIcon />
          </IconButton>
        </Tooltip>
      </Stack>

      {empty ? (
        <Typography variant="body2" color="text.secondary" sx={{ p: 3, textAlign: 'center' }}>
          No {direction === 'in' ? 'inward' : direction === 'out' ? 'outward' : ''} links from this node.
        </Typography>
      ) : (
        <>
          {!fullScreen && <GraphCanvas elements={view.elements} rootId={rootId} onSelect={onSelect} onEdge={setEdge} height={360} />}
          <GraphLegend elements={view.elements} />
        </>
      )}

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
        <DialogTitle component="div" sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="h6" component="h2" noWrap>
              {title}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {summary}
            </Typography>
          </Box>
          {controls}
          <IconButton aria-label="Close" onClick={() => setFullScreen(false)}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <Box sx={{ flexGrow: 1, minHeight: 0 }}>
            {dialogReady && !empty && <GraphCanvas elements={view.elements} rootId={rootId} onSelect={onSelect} onEdge={setEdge} height="100%" />}
          </Box>
          {!empty && <GraphLegend elements={view.elements} />}
        </DialogContent>
      </Dialog>
    </Paper>
  );
}
