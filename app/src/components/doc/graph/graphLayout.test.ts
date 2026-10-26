import { describe, expect, it } from 'vitest';
import type { ElementDefinition } from 'cytoscape';
import { forcePositions } from './graphLayout';

const node = (id: string): ElementDefinition => ({ group: 'nodes', data: { id, kind: 'class' } });
const sub = (child: string, parent: string): ElementDefinition => ({ group: 'edges', data: { id: `${child}>${parent}`, source: child, target: parent, relation: 'subClassOf' } });
const dist = (p: { x: number; y: number }, q: { x: number; y: number }) => Math.hypot(p.x - q.x, p.y - q.y);

describe('WebVOWL-style force positions', () => {
  // Two hubs (A, B) under a root R, each with six leaves.
  const leaves = (hub: string) => Array.from({ length: 6 }, (_, i) => `${hub}${i}`);
  const elements = [
    node('R'),
    node('A'),
    node('B'),
    sub('A', 'R'),
    sub('B', 'R'),
    ...['A', 'B'].flatMap((h) => leaves(h).flatMap((l) => [node(l), sub(l, h)])),
    node('lonely'),
  ];
  const p = forcePositions(elements);

  it('places every node, deterministically', () => {
    expect(Object.keys(p)).toHaveLength(16);
    expect(forcePositions(elements)).toEqual(p);
  });

  it('rings leaves closely around their own parent, away from the other group', () => {
    for (const hub of ['A', 'B']) {
      const other = hub === 'A' ? 'B' : 'A';
      for (const l of leaves(hub)) {
        expect(dist(p[l]!, p[hub]!)).toBeLessThan(90);
        expect(dist(p[l]!, p[hub]!)).toBeLessThan(dist(p[l]!, p[other]!));
      }
    }
  });

  it('keeps unlinked nodes near the rest (centre pull)', () => {
    expect(dist(p.lonely!, p.R!)).toBeLessThan(600);
  });
});
