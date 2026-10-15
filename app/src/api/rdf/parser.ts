import { DataFactory, Parser, type Quad, type Term } from 'n3';
import { AppError } from '../errors';
import type { LineSpan, LocatedTriple, ObjectTerm, ParsedOntology, PrefixMap, Subject } from '../types';

function toObjectTerm(term: Term): ObjectTerm {
  switch (term.termType) {
    case 'NamedNode':
      return { termType: 'NamedNode', value: term.value };
    case 'BlankNode':
      return { termType: 'BlankNode', value: term.value };
    case 'Literal':
      return {
        termType: 'Literal',
        value: term.value,
        language: term.language || undefined,
        datatype: term.datatype?.value,
      };
    default:
      throw new AppError('PARSE_ERROR', `Unsupported term type in object position: ${term.termType}`);
  }
}

/**
 * Blank nodes get ids from a per-parse counter (b0, b1, …), so the same file
 * always yields the same ids — they can be used in URLs (`?node=b12`).
 */
function stableFactory() {
  let next = 0;
  return { ...DataFactory, blankNode: (name?: string) => DataFactory.blankNode(name ?? `b${next++}`) };
}

/** N3.js ≥ 2.13 token observers (not yet in @types/n3). */
interface LexToken {
  type: string;
  line: number;
}
type ParseWithTokens = (
  input: string,
  callbacks: {
    onQuad: (error: Error | null, quad: Quad | null) => void;
    onPrefix: (prefix: string, iri: Term | string) => void;
    onToken: (token: LexToken) => void;
    onTokenEnd: (token: LexToken) => void;
  },
) => void;

const OPEN = new Set(['[', '(']);
const CLOSE = new Set([']', ')']);

/**
 * Turtle → plain triples + prefixes, with source positions (N3.js).
 *
 * Positions come from the token stream: every triple gets the line of the token
 * that completed it, and the index of the top-level statement (`subject … .`)
 * it belongs to. Runs in a Web Worker in the app (see engine.ts).
 */
export function parseTurtle(source: string, baseIRI?: string): Promise<ParsedOntology> {
  const parser = new Parser({ format: 'text/turtle', baseIRI, factory: stableFactory(), blankNodePrefix: '_:l' });
  const prefixes: PrefixMap = {};
  const triples: LocatedTriple[] = [];
  const statements: LineSpan[] = [];

  let line = 1;
  let depth = 0;
  let statementStart: number | null = null;
  /** Inside @prefix/@base (ends with ".") or SPARQL-style PREFIX/BASE (ends after its IRI). */
  let directive: 'turtle' | 'sparql' | null = null;

  return new Promise((resolve, reject) => {
    try {
      (parser.parse as unknown as ParseWithTokens).call(parser, source, {
        onPrefix: (prefix, iri) => {
          prefixes[prefix] = typeof iri === 'string' ? iri : iri.value;
        },
        onToken: (token) => {
          line = token.line;
          if (token.type === 'eof') return;
          if (statementStart === null && depth === 0) {
            statementStart = token.line;
            directive = /^@(prefix|base)$/.test(token.type) ? 'turtle' : /^(PREFIX|BASE)$/.test(token.type) ? 'sparql' : null;
          }
          if (OPEN.has(token.type)) depth++;
          if (CLOSE.has(token.type)) depth--;
        },
        onTokenEnd: (token) => {
          // A statement ends at "." on the top level; SPARQL-style PREFIX/BASE end after their IRI.
          const sparqlDirectiveEnd = directive === 'sparql' && token.type === 'IRI';
          if (depth === 0 && statementStart !== null && (token.type === '.' || sparqlDirectiveEnd)) {
            if (!directive) statements.push({ start: statementStart, end: token.line });
            statementStart = null;
            directive = null;
          }
        },
        onQuad: (error, quad) => {
          if (error) return reject(new AppError('PARSE_ERROR', error.message, error));
          if (!quad) return resolve({ triples, prefixes, statements, lineCount: source.split('\n').length });
          triples.push({
            subject: toObjectTerm(quad.subject) as Subject,
            predicate: { termType: 'NamedNode', value: quad.predicate.value },
            object: toObjectTerm(quad.object),
            graph: quad.graph.termType === 'DefaultGraph' ? undefined : quad.graph.value,
            line,
            statement: statements.length,
          });
        },
      });
    } catch (e) {
      reject(e instanceof AppError ? e : new AppError('PARSE_ERROR', (e as Error).message, e));
    }
  });
}
