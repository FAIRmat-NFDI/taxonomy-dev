import { describe, expect, it } from 'vitest';
import type { ElementDefinition } from 'cytoscape';
import type { EdgeRelation, GraphNodeKind } from '@/api';
import { countKinds, filterElements } from './graphFilter';

const node = (id: string, kind: GraphNodeKind): ElementDefinition => ({ group: 'nodes', data: { id, kind } });
const edge = (source: string, target: string, relation: EdgeRelation): ElementDefinition => ({ group: 'edges', data: { id: `${source}-${target}`, source, target, relation } });

const elements = [
  node('A', 'class'),
  node('B', 'class'),
  node('p', 'objectProperty'),
  node('i', 'individual'),
  edge('A', 'B', 'subClassOf'),
  edge('p', 'A', 'domain'),
  edge('i', 'A', 'type'),
];
const ids = (els: ElementDefinition[]) => els.map((e) => e.data.id);

describe('graph legend filter', () => {
  it('classes only: class nodes and the links between them', () => {
    expect(ids(filterElements(elements, { kinds: new Set(['class']), hiddenRelations: new Set() }))).toEqual(['A', 'B', 'A-B']);
  });

  it('classes + object properties: adds those nodes and their links to classes', () => {
    expect(ids(filterElements(elements, { kinds: new Set(['class', 'objectProperty']), hiddenRelations: new Set() }))).toEqual(['A', 'B', 'p', 'A-B', 'p-A']);
  });

  it('hidden link kinds are dropped; forced nodes stay', () => {
    const f = { kinds: new Set<GraphNodeKind>(['class']), hiddenRelations: new Set<EdgeRelation>(['subClassOf']) };
    expect(ids(filterElements(elements, f, ['i']))).toEqual(['A', 'B', 'i', 'i-A']);
  });

  it('counts kinds and links', () => {
    const c = countKinds(elements);
    expect(c.kinds.get('class')).toBe(2);
    expect(c.relations.get('domain')).toBe(1);
  });
});
