import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import type { OntologyModel } from '../types';
import { annotationsOf } from './annotations';
import { axiomsFor, renderAxiom, type NodeAxiom } from './axioms';
import { materialize } from './materialize';
import { parseTurtle } from './parser';

const NS = 'https://example.org/fairmat/playground#';
let model: OntologyModel;

beforeAll(async () => {
  const text = readFileSync(new URL('../../../../samples/example-main.ttl', import.meta.url), 'utf8');
  model = materialize(await parseTurtle(text));
});

const text = (item: NodeAxiom, notation: 'manchester' | 'dl') => renderAxiom(model, item, notation).map((t) => t.text).join('');
const lines = (id: string, notation: 'manchester' | 'dl') => axiomsFor(model, `${NS}${id}`).map((a) => `${a.group}: ${text(a, notation)}`);

describe('axiomsFor + renderAxiom', () => {
  it('lists own axioms of a class in both notations', () => {
    expect(lines('Sample', 'manchester')).toContain('Sub class of: measured by only instrument');
    expect(lines('Sample', 'dl')).toContain('Sub class of: Sample ⊑ ∀measuredBy.Instrument');
    expect(lines('Sample', 'dl')).toContain('Keys: HasKey(Sample, hasSampleId)');
    expect(lines('Sample', 'dl')).toContain('Disjoint union of: Sample ≡ SolidSample ⊔ LiquidSample ⊔ GaseousSample   (pairwise disjoint)');
  });

  it('includes what points at the node: sub classes, domains, restrictions elsewhere, standalone axioms', () => {
    const dl = lines('Sample', 'dl');
    expect(dl).toContain('Super class of: SolidSample ⊑ Sample');
    expect(dl).toContain('Domain of: ∃preparedFrom.⊤ ⊑ Sample');
    expect(dl).toContain('Range of: ⊤ ⊑ ∀preparedFrom.Sample');
    expect(dl).toContain('Axioms: Disjoint(Sample, Instrument, Person, Measurement)');
    expect(dl).toContain('Axioms: Sample ⊓ ∃hasComponent.Metal ⊑ ConductiveSample');
    expect(lines('Layer', 'dl')).toContain('Used in: CoatedSubstrate ⊑ ∃hasComponent.Layer');
  });

  it('renders property characteristics, inverses and chains', () => {
    expect(lines('hasPart', 'dl')).toContain('Characteristics: hasPart ∘ hasPart ⊑ hasPart');
    expect(lines('hasPart', 'dl')).toContain('Inverse of: partOf ≡ hasPart⁻');
    expect(lines('derivedFrom', 'dl')).toContain('Property chain: preparedFrom ∘ preparedFrom ⊑ derivedFrom');
    expect(lines('hasPrimaryInstrument', 'dl')).toContain('Characteristics: ⊤ ⊑ ≤1 hasPrimaryInstrument');
  });

  it('renders individuals: types, assertions, negative assertions', () => {
    const dl = lines('sample_002', 'dl');
    expect(dl).toContain('Types: CoatedSubstrate(sample_002)');
    expect(dl).toContain('Property assertions: hasOperator(sample_002, bob)');
    expect(dl).toContain('Axioms: ¬measuredBy(sample_002, instrument_SEM1)');
  });

  it('links named entities in the tokens', () => {
    const [first] = axiomsFor(model, `${NS}SingleCrystal`);
    expect(renderAxiom(model, first!, 'manchester')).toContainEqual({ text: 'crystalline sample', iri: `${NS}CrystallineSample` });
  });
});

describe('annotationsOf', () => {
  it('collects labels, definitions and other annotations, labels first', () => {
    const groups = annotationsOf(model, `${NS}Sample`);
    expect(groups[0]!.label).toBe('rdfs:label');
    expect(groups.map((g) => g.label)).toEqual(expect.arrayContaining(['skos:altLabel', 'skos:definition', 'rdfs:comment']));
    expect(groups.some((g) => g.predicate.endsWith('subClassOf'))).toBe(false);
  });
});
