import { Chip, Stack, SvgIcon, Typography } from '@mui/material';
import type { ElementDefinition } from 'cytoscape';
import type { EdgeRelation, GraphNodeKind } from '@/api';
import { EDGE_STYLES, NODE_STYLES, type EdgeStyle, type NodeShape } from './graphStyle';

/** Legend glyphs drawn with MUI SvgIcon, matching the Cytoscape node shapes. */
const SHAPE_PATH: Record<NodeShape, string> = {
  ellipse: 'M12 4a8 8 0 1 0 0 16a8 8 0 1 0 0-16z',
  diamond: 'M12 3l9 9-9 9-9-9z',
  'round-diamond': 'M12 3.5l8.5 8.5-8.5 8.5L3.5 12z',
  tag: 'M3 6h12l6 6-6 6H3z',
  'round-triangle': 'M12 4l9 16H3z',
  hexagon: 'M7 4h10l5 8-5 8H7l-5-8z',
  'round-hexagon': 'M7.5 4.5h9l4.5 7.5-4.5 7.5h-9L3 12z',
  'round-rectangle': 'M5 7h14a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z',
  barrel: 'M5 6h14c2 3 2 9 0 12H5c-2-3-2-9 0-12z',
  'round-octagon': 'M8 3h8l5 5v8l-5 5H8l-5-5V8z',
  vee: 'M3 5l9 4 9-4-9 14z',
};

const DASH: Record<EdgeStyle['line'], string | undefined> = { solid: undefined, dashed: '4 2.5', dotted: '1.5 2' };

function NodeGlyph({ kind }: { kind: GraphNodeKind }) {
  const style = NODE_STYLES[kind];
  return (
    <SvgIcon fontSize="small" sx={{ color: style.color, opacity: style.opacity ?? 1 }}>
      <path d={SHAPE_PATH[style.shape]} />
    </SvgIcon>
  );
}

function LinkGlyph({ relation }: { relation: EdgeRelation }) {
  const style = EDGE_STYLES[relation];
  return (
    <SvgIcon fontSize="small" sx={{ color: style.color }}>
      <line x1="2" y1="12" x2="22" y2="12" stroke="currentColor" strokeWidth={2.5} strokeDasharray={DASH[style.line]} fill="none" />
    </SvgIcon>
  );
}

/** One legend for the current view: the OWL 2 node kinds and link kinds it contains. */
export function GraphLegend({ elements }: { elements: ElementDefinition[] }) {
  const kinds = new Set<GraphNodeKind>();
  const relations = new Set<EdgeRelation>();
  let external = false;
  for (const el of elements) {
    if (el.group === 'nodes') {
      kinds.add(el.data.kind as GraphNodeKind);
      external ||= !!el.data.external;
    } else relations.add(el.data.relation as EdgeRelation);
  }

  return (
    <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', gap: 0.75, alignItems: 'center', px: 2, py: 1.5, borderTop: 1, borderColor: 'divider' }}>
      <Typography variant="subtitle2" sx={{ mr: 1 }}>
        Legend
      </Typography>
      {(Object.keys(NODE_STYLES) as GraphNodeKind[])
        .filter((k) => kinds.has(k))
        .map((k) => (
          <Chip key={k} size="small" variant="outlined" icon={<NodeGlyph kind={k} />} label={NODE_STYLES[k].label} />
        ))}
      {external && <Chip size="small" variant="outlined" label="Dashed outline: not defined in this file" />}
      {(Object.keys(EDGE_STYLES) as EdgeRelation[])
        .filter((r) => relations.has(r))
        .map((r) => (
          <Chip key={r} size="small" variant="outlined" icon={<LinkGlyph relation={r} />} label={EDGE_STYLES[r].label} />
        ))}
      <Typography variant="caption" color="text.secondary">
        Click a link to see its exact name.
      </Typography>
    </Stack>
  );
}
