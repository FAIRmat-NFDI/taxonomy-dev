import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { materialize, parseTurtle, type OntologyModel } from '@/api';
import { entityGroups, filterGroups, groupSize } from './entityGroups';

let model: OntologyModel;
beforeAll(async () => {
  model = materialize(await parseTurtle(readFileSync(new URL('../../../../samples/example-main.ttl', import.meta.url), 'utf8')));
});

describe('entityGroups', () => {
  it('lists classes and object / data properties (as counted for /doc), sorted by label', () => {
    const g = entityGroups(model);
    expect(g.classes.length).toBe(model.stats.entities.class);
    expect(g.objectProperties.length).toBe(model.stats.entities.objectProperty);
    expect(g.dataProperties.length).toBe(model.stats.entities.datatypeProperty);
    expect(g.classes.length).toBeGreaterThan(15);
    expect(g.objectProperties.length).toBeGreaterThan(0);
    expect(g.dataProperties.length).toBeGreaterThan(0);
    const labels = g.classes.map((c) => c.label.toLowerCase());
    expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b)));
  });

  it('filters all groups with one query (label, CURIE or IRI)', () => {
    const g = entityGroups(model);
    const f = filterGroups(g, 'SAMPLE');
    expect(f.classes.some((c) => c.label === 'sample')).toBe(true);
    expect(groupSize(f)).toBeLessThan(groupSize(g));
    expect(filterGroups(g, '  ')).toBe(g);
    expect(groupSize(filterGroups(g, 'zzz-no-match'))).toBe(0);
  });
});
