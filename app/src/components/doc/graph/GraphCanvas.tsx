import { useEffect, useEffectEvent, useRef } from 'react';
import { Box, Divider, IconButton, Paper, Tooltip, useTheme, type Theme } from '@mui/material';
import cytoscape, { type ElementDefinition, type StylesheetJson } from 'cytoscape';
import fcose from 'cytoscape-fcose';
import type { EdgeRelation, GraphNodeKind } from '@/api';
import { FitViewIcon, ZoomInIcon, ZoomOutIcon } from '@/assets';
import { useBusyTask } from '@/hooks/useBusy';
import { fontFamily } from '@/theme';
import { EDGE_STYLES, NODE_STYLES } from './graphStyle';

cytoscape.use(fcose);

/** Above this many elements the layout takes long enough to show the busy overlay. */
const BUSY_THRESHOLD = 150;

const LAYOUT = { name: 'fcose', animate: false, randomize: true, nodeDimensionsIncludeLabels: true, idealEdgeLength: () => 90, padding: 24, fit: false };
/** Zoom factor per button press. */
const ZOOM_STEP = 1.3;
/** Small graphs are not blown up beyond this zoom when fitted. */
const FIT_MAX_ZOOM = 1.4;

/** Zoom level used when centring on one node. */
const FOCUS_ZOOM = 1.2;

/** Highlights the focused node (if it is in the graph) and returns it. */
function markFocus(cy: cytoscape.Core, id: string | null): cytoscape.CollectionReturnValue | null {
  cy.nodes('.focus').removeClass('focus');
  const node = id ? cy.getElementById(id) : null;
  if (!node || node.empty()) return null;
  node.addClass('focus');
  return node;
}

/** Marks `id` as focused and centres / zooms on it; false when it is not in the graph. */
function focusOn(cy: cytoscape.Core, id: string | null, animate: boolean): boolean {
  const node = markFocus(cy, id);
  if (!node) return false;
  const zoom = Math.max(cy.zoom(), FOCUS_ZOOM);
  if (animate) cy.animate({ center: { eles: node }, zoom }, { duration: 400 });
  else {
    cy.zoom(zoom);
    cy.center(node);
  }
  return true;
}

function fitView(cy: cytoscape.Core) {
  cy.fit(undefined, 24);
  if (cy.zoom() > FIT_MAX_ZOOM) {
    cy.zoom(FIT_MAX_ZOOM);
    cy.center();
  }
}

/** Cytoscape cannot read CSS variables, so the stylesheet takes concrete values from the MUI theme. */
function stylesheet(theme: Theme): StylesheetJson {
  const { palette } = theme;
  return [
    {
      selector: 'node',
      style: {
        label: 'data(label)',
        'font-family': fontFamily,
        'font-size': 10,
        color: palette.text.primary,
        'text-valign': 'bottom',
        'text-margin-y': 4,
        'text-wrap': 'ellipsis',
        'text-max-width': '120px',
        width: 18,
        height: 18,
        shape: (el: cytoscape.NodeSingular) => NODE_STYLES[el.data('kind') as GraphNodeKind].shape,
        'background-color': (el: cytoscape.NodeSingular) => NODE_STYLES[el.data('kind') as GraphNodeKind].color,
        'background-opacity': (el: cytoscape.NodeSingular) => NODE_STYLES[el.data('kind') as GraphNodeKind].opacity ?? 1,
        'border-width': 1,
        'border-color': palette.background.paper,
      },
    },
    // Anonymous expressions: smaller, secondary text.
    {
      selector: 'node[kind = "restriction"], node[kind = "booleanExpression"], node[kind = "enumeration"], node[kind = "dataRange"], node[kind = "inverseProperty"], node[kind = "expression"]',
      style: { width: 16, height: 12, color: palette.text.secondary, 'font-size': 9 },
    },
    { selector: 'node[?external]', style: { 'background-opacity': 0.3, 'border-width': 1.5, 'border-style': 'dashed', 'border-color': palette.text.secondary } },
    {
      selector: 'node.root',
      style: { width: 30, height: 30, 'border-width': 3, 'border-color': palette.text.primary, 'font-size': 12, 'font-weight': 600 },
    },
    // Focused node (selected elsewhere, e.g. a chip): primary ring, label on top.
    {
      selector: 'node.focus',
      style: { width: 30, height: 30, 'border-width': 4, 'border-color': palette.primary.main, 'font-size': 13, 'font-weight': 600, 'z-index': 20 },
    },
    { selector: 'node:active', style: { 'overlay-opacity': 0.08, 'overlay-color': palette.primary.main } },
    {
      selector: 'edge',
      style: {
        width: (el: cytoscape.EdgeSingular) => edgeStyle(el).width ?? 1.4,
        'curve-style': 'bezier',
        'line-color': (el: cytoscape.EdgeSingular) => edgeStyle(el).color,
        'line-style': (el: cytoscape.EdgeSingular) => edgeStyle(el).line,
        'target-arrow-shape': (el: cytoscape.EdgeSingular) => edgeStyle(el).arrow,
        'target-arrow-fill': (el: cytoscape.EdgeSingular) => (edgeStyle(el).hollow ? 'hollow' : 'filled'),
        'target-arrow-color': (el: cytoscape.EdgeSingular) => edgeStyle(el).color,
        'source-arrow-shape': (el: cytoscape.EdgeSingular) => (edgeStyle(el).both ? edgeStyle(el).arrow : 'none'),
        'source-arrow-color': (el: cytoscape.EdgeSingular) => edgeStyle(el).color,
        'arrow-scale': 0.9,
        opacity: 0.85,
        'font-family': fontFamily,
        'font-size': 10,
        color: palette.text.primary,
        'text-rotation': 'autorotate',
        'text-background-color': palette.background.paper,
        'text-background-opacity': 0.9,
        'text-background-padding': '2px',
      },
    },
    // The relation name is shown only for the selected edge.
    { selector: 'edge:selected', style: { label: 'data(label)', width: 3.5, opacity: 1, 'z-index': 10 } },
  ] as StylesheetJson;
}

const edgeStyle = (el: cytoscape.EdgeSingular) => EDGE_STYLES[el.data('relation') as EdgeRelation];

interface GraphCanvasProps {
  elements: ElementDefinition[];
  /** Node drawn as the centre of a neighbourhood; none for a whole graph. */
  rootId: string | null;
  /** Node to centre and zoom to (animated, no new layout); clearing it fits the whole view again. */
  focusId?: string | null;
  /** Tapping a node selects it (centres the view on it). */
  onSelect: (id: string) => void;
  /** After a new layout: also centre and zoom on `focusId` (otherwise the focus is only marked and the view fitted). */
  zoomToFocusOnLayout?: boolean;
  /** Double-click / double-tap on a node. */
  onExpand?: (id: string) => void;
  /** Accessible name of the canvas. */
  label?: string;
  /** Selected edge as text ("a — label → b"), or null. */
  onEdge?: (description: string | null) => void;
  height: number | string;
}

/**
 * Cytoscape canvas (fcose force layout). Rebuilt when the elements change; pan / zoom / drag built in.
 * The layout runs after the container has been painted at its final size (dialogs, panes), and
 * the canvas stays hidden until it is done — no half-laid-out frame.
 */
export function GraphCanvas({
  elements,
  rootId,
  focusId = null,
  zoomToFocusOnLayout = false,
  onSelect,
  onExpand,
  onEdge,
  height,
  label = 'Neighbourhood graph',
}: GraphCanvasProps) {
  const container = useRef<HTMLDivElement>(null);
  /** Current Cytoscape instance, for the zoom buttons. */
  const instance = useRef<cytoscape.Core | null>(null);
  const theme = useTheme();
  const busy = useBusyTask();
  const select = useEffectEvent((id: string) => onSelect(id));
  const expand = useEffectEvent((id: string) => onExpand?.(id));
  /** Latest focus, read when a layout finishes (the focus may be set before the graph is ready). */
  const focusRef = useRef(focusId);
  const laidOut = useRef(false);
  const zoomOnLayout = useEffectEvent(() => zoomToFocusOnLayout);
  const describeEdge = useEffectEvent((text: string | null) => onEdge?.(text));
  const busyStart = useEffectEvent((label: string) => busy.start(label));
  const busyEnd = useEffectEvent(() => busy.end());

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    element.style.visibility = 'hidden';
    // Mouse wheel and trackpad (two-finger scroll / pinch) zoom, drag pans: Cytoscape's built-in user zooming / panning.
    const cy = cytoscape({
      container: element,
      elements,
      style: stylesheet(theme),
      layout: { name: 'preset' },
      minZoom: 0.15,
      maxZoom: 4,
      userZoomingEnabled: true,
      userPanningEnabled: true,
      boxSelectionEnabled: false,
    });
    instance.current = cy;
    laidOut.current = false;
    if (rootId) cy.getElementById(rootId).addClass('root');
    cy.on('tap', 'node', (event) => select(event.target.id()));
    cy.on('dbltap', 'node', (event) => expand(event.target.id()));
    cy.on('select', 'edge', (event) => {
      const edge = event.target;
      describeEdge(`${edge.source().data('label')} — ${edge.data('label')} → ${edge.target().data('label')}`);
    });
    cy.on('unselect', 'edge', () => describeEdge(null));

    const heavy = elements.length > BUSY_THRESHOLD;
    if (heavy) busyStart('Laying out graph…');
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        cy.resize();
        const layout = cy.layout(LAYOUT as cytoscape.LayoutOptions);
        layout.one('layoutstop', () => {
          laidOut.current = true;
          fitView(cy);
          if (zoomOnLayout()) focusOn(cy, focusRef.current, false);
          else markFocus(cy, focusRef.current);
          element.style.visibility = 'visible';
          if (heavy) busyEnd();
        });
        layout.run();
      });
    });

    // Keep it fitted when the container changes size (pane drag, window resize).
    const resize = new ResizeObserver(() => {
      cy.resize();
      if (!laidOut.current) return;
      // A zoomed-in focus stays centred; otherwise the whole graph is fitted again.
      const focused = cy.nodes('.focus');
      if (zoomOnLayout() && focused.nonempty()) cy.center(focused);
      else fitView(cy);
    });
    resize.observe(element);

    return () => {
      cancelAnimationFrame(frame);
      if (heavy) busyEnd();
      describeEdge(null);
      resize.disconnect();
      instance.current = null;
      cy.destroy();
    };
  }, [elements, rootId, theme]);

  // Focus changes move the camera only (no new layout).
  useEffect(() => {
    focusRef.current = focusId;
    const cy = instance.current;
    if (!cy || !laidOut.current) return;
    if (!focusOn(cy, focusId, true)) cy.animate({ fit: { eles: cy.elements(), padding: 24 } }, { duration: 300 });
  }, [focusId]);

  const zoomBy = (factor: number) => {
    const cy = instance.current;
    if (!cy) return;
    const level = Math.min(cy.maxZoom(), Math.max(cy.minZoom(), cy.zoom() * factor));
    cy.animate({ zoom: { level, renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } } }, { duration: 150 });
  };
  const fit = () => {
    const cy = instance.current;
    if (cy) cy.animate({ fit: { eles: cy.elements(), padding: 24 } }, { duration: 200 });
  };

  return (
    <Box sx={{ position: 'relative', width: '100%', height }}>
      <Box ref={container} role="img" aria-label={label} sx={{ width: '100%', height: '100%', overflow: 'hidden', cursor: 'grab' }} />
      {/* Zoom controls (wheel / trackpad / pinch work too) */}
      <Paper variant="elevation" elevation={2} sx={{ position: 'absolute', top: 8, right: 8, display: 'flex', flexDirection: 'column', borderRadius: 2 }}>
        <Tooltip title="Zoom in" placement="left">
          <IconButton size="small" aria-label="Zoom in" onClick={() => zoomBy(ZOOM_STEP)}>
            <ZoomInIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Divider />
        <Tooltip title="Zoom out" placement="left">
          <IconButton size="small" aria-label="Zoom out" onClick={() => zoomBy(1 / ZOOM_STEP)}>
            <ZoomOutIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Divider />
        <Tooltip title="Fit to view" placement="left">
          <IconButton size="small" aria-label="Fit to view" onClick={fit}>
            <FitViewIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Paper>
    </Box>
  );
}
