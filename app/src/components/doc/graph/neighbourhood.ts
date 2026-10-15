import cytoscape, { type Collection, type CollectionReturnValue, type Core, type ElementDefinition, type NodeCollection } from 'cytoscape';
import type { OntologyGraph } from '@/api';

export type Direction = 'all' | 'in' | 'out';

export const DEFAULT_DEPTH = 5;
/** Rendering more than this gets unreadable (and slow to lay out). */
export const MAX_NODES = 250;

/** Headless Cytoscape graph of the whole ontology, built once per model; only used for traversal. */
export function createGraphIndex(graph: OntologyGraph): Core {
  return cytoscape({
    headless: true,
    styleEnabled: false,
    elements: [
      ...graph.nodes.map((n) => ({ group: 'nodes' as const, data: { ...n } })),
      ...graph.edges.map((e) => ({ group: 'edges' as const, data: { ...e } })),
    ],
  });
}

export interface Neighbourhood {
  elements: ElementDefinition[];
  /** How far the graph reaches from the root in this direction (the slider's maximum). */
  maxDepth: number;
  nodeCount: number;
  edgeCount: number;
  /** Levels were cut to stay under MAX_NODES. */
  truncated: boolean;
}

/**
 * Nodes within `depth` steps of the root, following edges into the root (in), out of it (out),
 * or both (all). Uses Cytoscape's incomers / outgoers / neighborhood level by level.
 */
export function neighbourhood(cy: Core, rootId: string, direction: Direction, depth: number): Neighbourhood {
  const root = cy.getElementById(rootId).nodes();
  if (root.empty()) return { elements: [], maxDepth: 0, nodeCount: 0, edgeCount: 0, truncated: false };

  const step = (nodes: NodeCollection): Collection => (direction === 'in' ? nodes.incomers() : direction === 'out' ? nodes.outgoers() : nodes.neighborhood());

  // All levels (BFS rings) reachable in this direction.
  const levels: Collection[] = [];
  let visited: CollectionReturnValue = cy.collection().union(root);
  let frontier: NodeCollection = root;
  for (;;) {
    const ring = step(frontier).difference(visited);
    if (ring.nodes().empty()) break;
    levels.push(ring);
    visited = visited.union(ring);
    frontier = ring.nodes();
  }

  let shown: CollectionReturnValue = cy.collection().union(root);
  let truncated = false;
  for (const ring of levels.slice(0, depth)) {
    if (shown.nodes().length + ring.nodes().length > MAX_NODES) {
      truncated = true;
      break;
    }
    shown = shown.union(ring);
  }
  // "All": also draw links between nodes already shown.
  if (direction === 'all') shown = shown.union(shown.nodes().edgesWith(shown.nodes()));

  return {
    elements: shown.map((el) => ({ group: el.isNode() ? 'nodes' : 'edges', data: { ...el.data() } })),
    maxDepth: levels.length,
    nodeCount: shown.nodes().length,
    edgeCount: shown.edges().length,
    truncated,
  };
}
