import { readFileSync } from 'node:fs';
import { Store } from 'oxigraph';
import { beforeAll, describe, expect, it } from 'vitest';
import { queryErrorMessage, toSparqlResult, withPrefixes } from './sparqlResult';

const NS = 'https://example.org/fairmat/playground#';
const prefixes = { owl: 'http://www.w3.org/2002/07/owl#', rdfs: 'http://www.w3.org/2000/01/rdf-schema#', '': NS };
let store: Store;

beforeAll(() => {
  store = new Store();
  store.load(readFileSync(new URL('../../../../samples/example-main.ttl', import.meta.url), 'utf8'), { format: 'text/turtle', lenient: true });
});

const run = (q: string) => toSparqlResult(store.query(withPrefixes(q, prefixes)));

describe('SPARQL (Oxigraph) → graph result', () => {
  it('SELECT: collects the IRIs bound in any variable', () => {
    const r = run('SELECT ?c WHERE { ?c rdfs:subClassOf :MaterialEntity }');
    expect(r.kind).toBe('select');
    if (r.kind !== 'select') return;
    expect(r.variables).toEqual(['c']);
    expect(r.iris).toContain(`${NS}Layer`);
    expect(r.rows).toBe(r.iris.length);
  });

  it('CONSTRUCT: subjects and objects of the quads', () => {
    const r = run('CONSTRUCT { ?c rdfs:subClassOf ?p } WHERE { ?c rdfs:subClassOf ?p . FILTER(isIRI(?p)) } LIMIT 5');
    expect(r.kind).toBe('construct');
    if (r.kind === 'construct') expect(r.iris.length).toBeGreaterThan(1);
  });

  it('ASK: a boolean', () => {
    expect(run(`ASK { :Sample a owl:Class }`)).toEqual({ kind: 'ask', value: true });
  });

  it('query declarations override the prepended prefixes; syntax errors throw', () => {
    expect(run('PREFIX : <http://other.org/> ASK { :Sample a owl:Class }')).toEqual({ kind: 'ask', value: false });
    let message = '';
    try {
      run('ASK {}\nSELEC ?x');
    } catch (e) {
      message = queryErrorMessage((e as Error).message, true);
    }
    expect(message).toMatch(/at 2:\d+/);
  });
});
