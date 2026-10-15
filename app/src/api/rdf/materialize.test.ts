import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import type { OntologyModel } from '../types';
import { materialize } from './materialize';
import { parseTurtle } from './parser';

const NS = 'https://example.org/fairmat/playground#';
let model: OntologyModel;

beforeAll(async () => {
  const text = readFileSync(new URL('../../../../samples/example-main.ttl', import.meta.url), 'utf8');
  model = materialize(await parseTurtle(text));
});

describe('materialize (samples/example-main.ttl)', () => {
  it('classifies entities, including datatypes defined via owl:equivalentClass', () => {
    expect(model.entities[`${NS}Sample`]!.kinds).toEqual(['class']);
    expect(model.entities[`${NS}hasPart`]!.kinds).toEqual(['objectProperty']);
    expect(model.entities[`${NS}TemperatureKelvin`]!.kinds).toEqual(['datatype']);
    expect(model.entities[`${NS}XRD`]!.kinds).toEqual(['class', 'individual']); // punning
    expect(model.stats.triples).toBe(582);
  });

  it('keeps the source lines of every statement block of an entity', () => {
    const sample = model.entities[`${NS}Sample`]!;
    expect(sample.locations[0]).toEqual({ start: 103, end: 108 });
    expect(sample.locations.length).toBeGreaterThan(3); // also restricted, disjoint-union'd, keyed further down
  });

  it('builds the named hierarchy with multiple parents and external roots', () => {
    expect(model.entities[`${NS}CoatedSubstrate`]!.parents).toEqual([`${NS}SolidSample`, `${NS}Substrate`]);
    expect(model.entities[`${NS}UndeclaredThing`]!.declared).toBe(false);
    expect(model.roots.class).toContain(`${NS}UndeclaredThing`);
    expect(model.roots.class).toContain(`${NS}Orphan`);
    expect(model.roots.class).not.toContain(`${NS}Sample`);
  });

  it('detects the sub-class cycle and the self-loop without hanging', () => {
    expect(model.cycles).toContainEqual([`${NS}Specimen`]);
    expect(model.cycles).toContainEqual([`${NS}Coupon`, `${NS}Specimen`, `${NS}TestPiece`]);
    expect(model.entities[`${NS}Specimen`]!.parents).not.toContain(`${NS}Specimen`);
  });

  it('renders anonymous expressions in Manchester-like text with their lines and owners', () => {
    const texts = Object.values(model.expressions).filter((x) => !x.nested);
    const has = (text: string) => texts.find((x) => x.text === text);
    expect(has('has component some layer')).toMatchObject({ kind: 'restriction', owners: [`${NS}CoatedSubstrate`] });
    expect(has('thin film and (has component exactly 2 layer)')?.location).toEqual({ start: 175, end: 177 });
    expect(has('(inverse has component) some thin film')).toBeDefined();
    expect(has('xsd:decimal[>= 0, <= 14]')).toBeDefined();
  });

  it('collects axioms that belong to no single entity', () => {
    const kinds = Object.values(model.axioms).map((a) => a.kind);
    expect(kinds.filter((k) => k === 'AllDisjointProperties')).toHaveLength(2);
    const gci = Object.values(model.axioms).find((a) => a.kind === 'GeneralClassInclusion')!;
    expect(gci.text).toBe('sample and (has component some metal) SubClassOf conductive sample');
    expect(gci.location).toEqual({ start: 227, end: 229 });
  });

  it('reads the ontology header', () => {
    expect(model.header).toMatchObject({ label: 'Taxonomy Playground showcase', versionInfo: '0.2.0', imports: ['http://purl.obolibrary.org/obo/bfo.owl'] });
  });

  it('is plain JSON (safe for Redux and postMessage)', () => {
    expect(JSON.parse(JSON.stringify(model))).toEqual(model);
  });
});
