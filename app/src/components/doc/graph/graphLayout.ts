import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY, type SimulationLinkDatum, type SimulationNodeDatum } from 'd3-force';
import type { ElementDefinition, LayoutOptions } from 'cytoscape';
import type { EdgeRelation } from '@/api';

/**
 * WebVOWL-style layout: the same d3-force model WebVOWL uses, run to rest once (static, no floating),
 * then handed to Cytoscape as fixed positions.
 *  - every class is the hub of its sub-classes; leaves sit on a short, stiff link, so they form a ring
 *    around their parent;
 *  - links between hubs are longer, growing with both hubs' size, so the rings don't overlap;
 *  - non-taxonomy links are weaker, so they don't drag groups together;
 *  - nodes repel each other (siblings spread evenly round their parent) and a weak pull to the centre
 *    ("circular gravity") keeps separate groups and lone nodes close by.
 */
const TAXONOMY: ReadonlySet<EdgeRelation> = new Set(['subClassOf', 'subPropertyOf']);
const isTaxonomy = (relation: unknown) => TAXONOMY.has(relation as EdgeRelation);

// Node size matches the canvas (labels inside the node, ~38 px).
const LEAF_DISTANCE = 52;
const HUB_DISTANCE = 60;
const PER_SQRT_DEGREE = 20;
const CHARGE = -260;
const CENTRE_PULL = 0.04;
const NODE_RADIUS = 21;

interface Node extends SimulationNodeDatum {
  id: string;
}
interface Link extends SimulationLinkDatum<Node> {
  taxonomy: boolean;
  distance: number;
}

/** Positions for the nodes of `elements` (deterministic: d3 places nodes on a phyllotaxis spiral, no randomness). */
export function forcePositions(elements: ElementDefinition[]): Record<string, { x: number; y: number }> {
  const nodes: Node[] = elements.filter((e) => e.group === 'nodes').map((e) => ({ id: e.data.id as string }));
  const ids = new Set(nodes.map((n) => n.id));
  const edges = elements.filter((e) => e.group === 'edges' && ids.has(e.data.source as string) && ids.has(e.data.target as string) && e.data.source !== e.data.target);

  const degree = new Map<string, number>();
  for (const e of edges) for (const end of [e.data.source as string, e.data.target as string]) degree.set(end, (degree.get(end) ?? 0) + 1);
  const links: Link[] = edges.map((e) => {
    const a = degree.get(e.data.source as string) ?? 1;
    const b = degree.get(e.data.target as string) ?? 1;
    const taxonomy = isTaxonomy(e.data.relation);
    const distance = Math.min(a, b) <= 1 ? LEAF_DISTANCE : (HUB_DISTANCE + PER_SQRT_DEGREE * (Math.sqrt(a) + Math.sqrt(b))) * (taxonomy ? 1 : 1.4);
    return { source: e.data.source as string, target: e.data.target as string, taxonomy, distance };
  });

  const simulation = forceSimulation(nodes)
    .force(
      'link',
      forceLink<Node, Link>(links)
        .id((n) => n.id)
        .distance((l) => l.distance)
        .strength((l) => (l.taxonomy ? 0.9 : 0.25)),
    )
    .force('charge', forceManyBody<Node>().strength(CHARGE).distanceMax(600))
    .force('collide', forceCollide<Node>(NODE_RADIUS))
    .force('x', forceX<Node>(0).strength(CENTRE_PULL))
    .force('y', forceY<Node>(0).strength(CENTRE_PULL))
    .stop();
  // Run to rest (same number of steps d3 would animate).
  const steps = Math.ceil(Math.log(simulation.alphaMin()) / Math.log(1 - simulation.alphaDecay()));
  simulation.tick(steps);

  return Object.fromEntries(nodes.map((n) => [n.id, { x: n.x ?? 0, y: n.y ?? 0 }]));
}

/** Cytoscape layout: the precomputed positions (fitting is done by the canvas). */
export function layoutOptions(elements: ElementDefinition[]): LayoutOptions {
  const positions = forcePositions(elements);
  return { name: 'preset', positions: (node: cytoscape.NodeSingular) => positions[node.id()], fit: false, animate: false } as LayoutOptions;
}
