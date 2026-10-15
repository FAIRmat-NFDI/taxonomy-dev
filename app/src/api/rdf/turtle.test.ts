import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import type { OntologyModel } from '../types';
import { materialize } from './materialize';
import { parseTurtle } from './parser';
import { formatNodeTurtle, highlightTurtle, sourceSpans } from './turtle';

const NS = 'https://example.org/fairmat/playground#';
let model: OntologyModel;
let source: string;

beforeAll(async () => {
  source = readFileSync(new URL('../../../../samples/example-main.ttl', import.meta.url), 'utf8');
  model = materialize(await parseTurtle(source));
});

/** Triples reachable from a subject through blank nodes and lists (= what a node's snippet must contain). */
async function closureSize(text: string, subject: string) {
  const { triples } = await parseTurtle(text);
  const seen = new Set<string>([subject]);
  let size = 0;
  for (let changed = true; changed; ) {
    changed = false;
    for (const t of triples) {
      const s = t.subject.value;
      if (seen.has(s) && t.object.termType === 'BlankNode' && !seen.has(t.object.value)) {
        seen.add(t.object.value);
        changed = true;
      }
    }
  }
  for (const t of triples) if (seen.has(t.subject.value)) size++;
  return size;
}

describe('formatNodeTurtle', () => {
  it('produces valid Turtle with exactly the statements of the node', async () => {
    for (const name of ['Sample', 'NegativeTemperatureCelsius', 'derivedFrom', 'sample_001']) {
      const formatted = formatNodeTurtle(model, `${NS}${name}`)!;
      expect(await closureSize(formatted, `${NS}${name}`)).toBe(await closureSize(source, `${NS}${name}`));
    }
  });

  it('shows an expression inside the statement of its owner', () => {
    const restriction = Object.values(model.expressions).find((x) => x.text === 'has component some layer')!;
    const formatted = formatNodeTurtle(model, restriction.id)!;
    expect(formatted).toContain(':CoatedSubstrate\n    rdfs:subClassOf [');
    expect(formatted).not.toContain(':SolidSample'); // only the statement that holds the expression
  });

  it('writes standalone axioms with an anonymous subject', () => {
    const disjoint = Object.values(model.axioms).find((a) => a.kind === 'AllDisjointClasses')!;
    expect(formatNodeTurtle(model, disjoint.id)).toMatch(/\[\] a owl:AllDisjointClasses ;\n {4}owl:members \( :Sample :Instrument :Person :Measurement \) \.$/);
  });
});

describe('sourceSpans', () => {
  it('points an expression at its statement block and focuses its own line', () => {
    const restriction = Object.values(model.expressions).find((x) => x.text === 'has component some layer')!;
    expect(sourceSpans(model, restriction.id)).toEqual({ blocks: [{ start: 193, end: 194 }], focus: { start: 194, end: 194 } });
  });
});

describe('highlightTurtle', () => {
  it('keeps the text intact and classifies tokens, across multi-line literals', () => {
    const text = ':A a owl:Class ; # note\n  rdfs:label """two\nlines"""@en .';
    const lines = highlightTurtle(text);
    expect(lines.map((l) => l.map((s) => s.text).join(''))).toEqual(text.split('\n'));
    expect(lines[0]!.find((s) => s.text === 'a')!.type).toBe('keyword');
    expect(lines[0]!.find((s) => s.text === '# note')!.type).toBe('comment');
    expect(lines[2]![0]).toEqual({ text: 'lines"""', type: 'literal' });
  });
});
