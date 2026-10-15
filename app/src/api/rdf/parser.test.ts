import { describe, expect, it } from 'vitest';
import { parseTurtle } from './parser';
import { OWL, RDF, RDFS } from './vocab';

const TTL = `
@prefix : <https://example.org/onto#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

:Sample a owl:Class ; rdfs:label "Sample"@en .
:Specimen a owl:Class ; rdfs:subClassOf :Sample .
`;

describe('parseTurtle', () => {
  it('parses turtle into plain triples with prefixes', async () => {
    const result = await parseTurtle(TTL);

    expect(result.prefixes.owl).toBe('http://www.w3.org/2002/07/owl#');
    expect(result.triples).toHaveLength(4);
    expect(result.triples).toContainEqual(
      expect.objectContaining({
        subject: { termType: 'NamedNode', value: 'https://example.org/onto#Specimen' },
        predicate: { termType: 'NamedNode', value: RDFS.subClassOf },
      }),
    );
    expect(result.triples.filter((t) => t.predicate.value === RDF.type && t.object.value === OWL.Class)).toHaveLength(2);
  });

  it('records the line of every triple and the span of every statement', async () => {
    const ttl = [
      '@prefix : <https://example.org/onto#> .', // 1
      ':A a :C ;', // 2
      '   :p [ a :R ;', // 3
      '        :q :B ] ,', // 4
      '      :D .', // 5
      '', // 6
      ':E :p ( :x', // 7
      '  :y ) .', // 8
    ].join('\n');
    const { triples, statements } = await parseTurtle(ttl);
    const at = (s: string, p: string) => triples.find((t) => t.subject.value.endsWith(s) && t.predicate.value.endsWith(p));

    expect(statements).toEqual([
      { start: 2, end: 5 },
      { start: 7, end: 8 },
    ]);
    expect(at('#A', 'type')).toMatchObject({ line: 2, statement: 0 });
    expect(at('#A', '#p')?.line).toBe(4); // completed at the closing "]"
    expect(triples.find((t) => t.object.value.endsWith('#D'))).toMatchObject({ line: 5, statement: 0 });
    expect(at('#E', '#p')).toMatchObject({ line: 8, statement: 1 });
  });

  it('numbers blank nodes per parse, so ids are stable for the same text', async () => {
    const ttl = '[] a <https://example.org/onto#Z> .';
    const [a, b] = await Promise.all([parseTurtle(ttl), parseTurtle(ttl)]);
    expect(a.triples[0]!.subject.value).toBe(b.triples[0]!.subject.value);
  });

  it('wraps syntax errors in AppError', async () => {
    await expect(parseTurtle(':a :b')).rejects.toMatchObject({ code: 'PARSE_ERROR' });
  });
});
