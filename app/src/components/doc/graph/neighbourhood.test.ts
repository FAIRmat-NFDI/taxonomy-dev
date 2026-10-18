import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildOntologyGraph, graphRootFor, materialize, parseTurtle, type OntologyGraph, type OntologyModel } from '@/api';
import { createGraphIndex, fullGraph, neighbourhood, subgraphOf } from './neighbourhood';

const NS = 'https://example.org/fairmat/playground#';
let model: OntologyModel;
let graph: OntologyGraph;

beforeAll(async () => {
  const text = readFileSync(new URL('../../../../../samples/example-main.ttl', import.meta.url), 'utf8');
  model = materialize(await parseTurtle(text));
  graph = buildOntologyGraph(model);
});

const ids = (elements: Array<{ group?: string; data: { id?: string } }>) => elements.filter((e) => e.group === 'nodes').map((e) => e.data.id);

describe('buildOntologyGraph', () => {
  it('flattens simple restrictions into one labelled edge', () => {
    expect(graph.edges).toContainEqual(expect.objectContaining({ source: `${NS}CoatedSubstrate`, target: `${NS}Layer`, label: 'has component some' }));
    expect(graph.edges).toContainEqual(expect.objectContaining({ source: `${NS}Bilayer` }));
  });

  it('centres a flattened restriction on its owner', () => {
    const restriction = Object.values(model.expressions).find((x) => x.text === 'has component some layer')!;
    expect(graphRootFor(model, graph, restriction.id)).toBe(`${NS}CoatedSubstrate`);
  });
});

describe('neighbourhood', () => {
  it('follows outgoing edges only for "out", incoming only for "in"', () => {
    const index = createGraphIndex(graph);
    const out = ids(neighbourhood(index, `${NS}SingleCrystal`, 'out', 1).elements);
    expect(out).toContain(`${NS}CrystallineSample`); // its superclass
    expect(out).not.toContain(`${NS}sample_001`); // an instance points *in*

    const inward = ids(neighbourhood(index, `${NS}SingleCrystal`, 'in', 1).elements);
    expect(inward).toContain(`${NS}sample_001`);
    expect(inward).not.toContain(`${NS}CrystallineSample`);
  });

  it('grows with the degree and reports how far the graph reaches', () => {
    const index = createGraphIndex(graph);
    const one = neighbourhood(index, `${NS}SingleCrystal`, 'out', 1);
    const all = neighbourhood(index, `${NS}SingleCrystal`, 'out', 99);
    expect(one.nodeCount).toBeLessThan(all.nodeCount);
    expect(all.maxDepth).toBeGreaterThanOrEqual(4); // → crystalline → solid → sample → material entity → BFO
    expect(ids(all.elements)).toContain('http://purl.obolibrary.org/obo/BFO_0000040');
  });
});

describe('fullGraph / subgraphOf', () => {
  it('full graph = every node and link', () => {
    const view = fullGraph(createGraphIndex(graph));
    expect(view.nodeCount).toBe(graph.nodes.length);
    expect(view.edgeCount).toBe(graph.edges.length);
  });

  it('induced subgraph: the given nodes and only the links between them', () => {
    const view = subgraphOf(createGraphIndex(graph), [`${NS}CoatedSubstrate`, `${NS}Layer`, 'https://nowhere.org/x']);
    expect(ids(view.elements).sort()).toEqual([`${NS}CoatedSubstrate`, `${NS}Layer`]);
    expect(view.missing).toBe(1);
    expect(view.edgeCount).toBeGreaterThan(0);
    expect(view.elements.filter((e) => e.group === 'edges').every((e) => [`${NS}CoatedSubstrate`, `${NS}Layer`].includes(e.data.source as string))).toBe(true);
  });
});
