import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { materialize, parseTurtle, type OntologyModel } from '@/api';
import { buildOverview, filterOverview, type OverviewItem } from './overview';

const NS = 'https://example.org/fairmat/playground#';
let model: OntologyModel;

beforeAll(async () => {
  const text = readFileSync(new URL('../../../../samples/example-main.ttl', import.meta.url), 'utf8');
  model = materialize(await parseTurtle(text));
});

const flatten = (items: OverviewItem[]): OverviewItem[] => items.flatMap((i) => [i, ...flatten(i.children ?? [])]);

describe('buildOverview', () => {
  it('groups like the design: Metadata, class roots, Individuals, Axioms, Properties, …', () => {
    const { items } = buildOverview(model);
    expect(items[0]!.label).toBe('Metadata');
    expect(items.map((i) => i.label).slice(-5)).toEqual(['Individuals', 'Axioms', 'Properties', 'Datatypes', 'Expressions']);
    expect(items.some((i) => i.target === `${NS}Orphan`)).toBe(true); // root class at top level
  });

  it('gives every tree item a unique id, even for classes with several parents', () => {
    const all = flatten(buildOverview(model).items);
    expect(new Set(all.map((i) => i.id)).size).toBe(all.length);
    expect(all.filter((i) => i.target === `${NS}CoatedSubstrate`)).toHaveLength(2);
  });

  it('stops at a cycle and marks it instead of recursing', () => {
    const all = flatten(buildOverview(model).items);
    const marked = all.filter((i) => i.flags?.includes('cycle'));
    expect(marked.map((i) => i.target)).toContain(`${NS}Specimen`);
    expect(marked.every((i) => !i.children)).toBe(true);
  });

  it('locates the first occurrence of a node with its ancestors', () => {
    const { locate } = buildOverview(model);
    const hit = locate.get(`${NS}SingleCrystal`)!;
    expect(hit.itemId.endsWith(`>${NS}SingleCrystal`)).toBe(true);
    expect(hit.ancestors.length).toBeGreaterThan(3);
  });
});

describe('filterOverview', () => {
  it('keeps matches and the paths to them, opened', () => {
    const { items } = buildOverview(model);
    const result = filterOverview(items, 'single crys')!;
    const all = flatten(result.items);
    expect(result.matches).toBeGreaterThanOrEqual(1);
    expect(all.some((i) => i.target === `${NS}SingleCrystal`)).toBe(true);
    expect(all.some((i) => i.target === `${NS}Orphan`)).toBe(false);
    expect(result.expanded.length).toBeGreaterThan(2); // the class path down to it
  });

  it('matches IRIs too, and returns null for an empty query', () => {
    const { items } = buildOverview(model);
    expect(filterOverview(items, 'playground#Coupon')!.matches).toBeGreaterThanOrEqual(1);
    expect(filterOverview(items, '  ')).toBeNull();
  });
});
