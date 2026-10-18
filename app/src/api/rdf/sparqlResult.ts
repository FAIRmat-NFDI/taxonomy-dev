/** What a SPARQL query returned, reduced to what the graph needs. Plain data (crosses the worker boundary). */
export type SparqlResult =
  | { kind: 'select'; rows: number; variables: string[]; iris: string[] }
  | { kind: 'construct'; rows: number; iris: string[] }
  | { kind: 'ask'; value: boolean };

/** Minimal RDF/JS term shape (Oxigraph terms implement it). */
interface Term {
  termType: string;
  value: string;
}
interface QuadLike {
  subject: Term;
  predicate: Term;
  object: Term;
}

/**
 * Oxigraph's `query()` output → SparqlResult. SELECT rows are Maps (variable → term), CONSTRUCT /
 * DESCRIBE return quads, ASK a boolean. Only IRIs are collected: blank-node labels are local to the store.
 */
export function toSparqlResult(output: unknown): SparqlResult {
  if (typeof output === 'boolean') return { kind: 'ask', value: output };
  if (!Array.isArray(output)) throw new Error('Unsupported SPARQL result.');
  const iris = new Set<string>();
  const add = (t: Term | undefined) => {
    if (t?.termType === 'NamedNode') iris.add(t.value);
  };
  if (output.length && !(output[0] instanceof Map)) {
    for (const q of output as QuadLike[]) {
      add(q.subject);
      add(q.object);
    }
    return { kind: 'construct', rows: output.length, iris: [...iris] };
  }
  const variables = new Set<string>();
  for (const row of output as Map<string, Term>[]) {
    for (const [name, term] of row) {
      variables.add(name);
      add(term);
    }
  }
  return { kind: 'select', rows: output.length, variables: [...variables], iris: [...iris] };
}

/**
 * Prepends the ontology's prefixes on one line, so queries can use them without declaring them
 * (declarations in the query win). One line keeps error positions easy to map back (see `queryErrorMessage`).
 */
export function withPrefixes(query: string, prefixes: Record<string, string>): string {
  const head = Object.entries(prefixes)
    .map(([p, iri]) => `PREFIX ${p}: <${iri}>`)
    .join(' ');
  return head ? `${head}\n${query}` : query;
}

/** Engine error with "at line:column" pointing into the user's query (the prefix line is not counted). */
export function queryErrorMessage(message: string, prefixed: boolean): string {
  if (!prefixed) return message;
  return message.replace(/(\d+):(\d+)/, (match, line: string, col: string) => (Number(line) > 1 ? `${Number(line) - 1}:${col}` : match));
}
