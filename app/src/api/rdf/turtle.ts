import { Lexer } from 'n3';
import type { LineSpan, NodeStatement, NodeValue, OntologyModel, PrefixMap } from '../types';
import { RDF, XSD } from './vocab';

/**
 * Turtle for display: a pretty-printer for one node of the model, the file blocks a node
 * comes from, and a tokenizer for syntax highlighting. Read-only; nothing is written back.
 */

// ── Pretty-printing ─────────────────────────────────────────────────────────
const INDENT = '    ';
const pad = (level: number) => INDENT.repeat(level);
const INLINE_MAX = 72;
const XSD_STRING = 'http://www.w3.org/2001/XMLSchema#string';
const BARE_LITERALS: Record<string, RegExp> = {
  [XSD.integer]: /^[+-]?\d+$/,
  [XSD.decimal]: /^[+-]?\d*\.\d+$/,
  [XSD.boolean]: /^(true|false)$/,
};

class TurtlePrinter {
  private readonly used = new Map<string, string>();
  private readonly visiting = new Set<string>();

  constructor(
    private readonly model: OntologyModel,
    private readonly prefixes: PrefixMap,
  ) {}

  iri(iri: string): string {
    let best: [string, string] | null = null;
    for (const [prefix, ns] of Object.entries(this.prefixes)) {
      const local = iri.slice(ns.length);
      if (ns && iri.startsWith(ns) && /^([A-Za-z_][\w-]*([.\w-]*[\w-])?)?$/.test(local) && (!best || ns.length > best[1].length)) best = [prefix, ns];
    }
    if (!best) return `<${iri}>`;
    this.used.set(best[0], best[1]);
    return `${best[0]}:${iri.slice(best[1].length)}`;
  }

  literal(value: Extract<NodeValue, { type: 'literal' }>): string {
    if (value.datatype && BARE_LITERALS[value.datatype]?.test(value.value)) return value.value;
    const body = value.value.includes('\n')
      ? `"""${value.value.replace(/\\/g, '\\\\').replace(/"""/g, '\\"""')}"""`
      : `"${value.value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
    if (value.language) return `${body}@${value.language}`;
    if (value.datatype && value.datatype !== XSD_STRING) return `${body}^^${this.iri(value.datatype)}`;
    return body;
  }

  value(value: NodeValue, level: number): string {
    switch (value.type) {
      case 'iri':
        return this.iri(value.iri);
      case 'literal':
        return this.literal(value);
      case 'list': {
        const items = value.items.map((item) => this.value(item, level + 1));
        const inline = `( ${items.join(' ')} )`;
        if (inline.length <= INLINE_MAX && !inline.includes('\n')) return inline;
        return `(\n${items.map((i) => pad(level + 1) + i).join('\n')}\n${pad(level)})`;
      }
      case 'expression':
        return this.blank(value.id, level);
    }
  }

  blank(id: string, level: number): string {
    const statements = this.model.blankNodes[id];
    if (!statements || this.visiting.has(id)) return '[]';
    this.visiting.add(id);
    const groups = this.groups(statements, level + 1);
    this.visiting.delete(id);
    const inline = `[ ${groups.join(' ; ')} ]`;
    if (groups.length <= 2 && inline.length <= INLINE_MAX && !inline.includes('\n')) return inline;
    return `[\n${pad(level + 1)}${groups.join(` ;\n${pad(level + 1)}`)}\n${pad(level)}]`;
  }

  /** "predicate object , object" per predicate; rdf:type first, otherwise in file order. */
  groups(statements: NodeStatement[], level: number): string[] {
    const byPredicate = new Map<string, NodeValue[]>();
    const ordered = [...statements].sort((a, b) => Number(b.predicate === RDF.type) - Number(a.predicate === RDF.type));
    for (const s of ordered) (byPredicate.get(s.predicate) ?? byPredicate.set(s.predicate, []).get(s.predicate)!).push(s.value);
    return [...byPredicate].map(([predicate, values]) => {
      const p = predicate === RDF.type ? 'a' : this.iri(predicate);
      // One object: on the predicate line (a nested blank opens there and closes at this level).
      if (values.length === 1) return `${p} ${this.value(values[0]!, level)}`;
      const inline = values.map((v) => this.value(v, level)).join(' , ');
      if (inline.length <= INLINE_MAX && !inline.includes('\n')) return `${p} ${inline}`;
      // Several long objects: one per line, indented under the predicate.
      const objects = values.map((v) => this.value(v, level + 1));
      return `${p}\n${pad(level + 1)}${objects.join(` ,\n${pad(level + 1)}`)}`;
    });
  }

  statement(subject: string, statements: NodeStatement[]): string {
    const groups = this.groups(statements, 1);
    const body = groups.join(` ;\n${pad(1)}`);
    // Subject on its own line when the first predicate spans several lines.
    return groups[0]?.includes('\n') ? `${subject}\n${pad(1)}${body} .` : `${subject} ${body} .`;
  }

  prefixBlock(): string {
    return [...this.used]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([prefix, ns]) => `@prefix ${prefix}: <${ns}> .`)
      .join('\n');
  }
}

const mentions = (value: NodeValue, id: string, model: OntologyModel, seen = new Set<string>()): boolean => {
  if (value.type === 'list') return value.items.some((v) => mentions(v, id, model, seen));
  if (value.type !== 'expression') return false;
  if (value.id === id) return true;
  if (seen.has(value.id)) return false;
  seen.add(value.id);
  return (model.blankNodes[value.id] ?? []).some((s) => mentions(s.value, id, model, seen));
};

/**
 * Pretty Turtle for one node (with the prefixes it uses):
 *  entity / header → all its statements, nested expressions inline
 *  axiom           → `[] a owl:AllDisjointClasses ; …`
 *  expression      → the owning statement(s) it appears in, so it is shown in context
 */
export function formatNodeTurtle(model: OntologyModel, id: string): string | null {
  const printer = new TurtlePrinter(model, model.prefixes);
  let body: string | null = null;

  if (model.header?.iri === id) body = printer.statement(printer.iri(id), model.header.statements);
  else if (model.entities[id]?.statements.length) body = printer.statement(printer.iri(id), model.entities[id]!.statements);
  else if (model.axioms[id]) body = printer.statement('[]', model.axioms[id]!.statements);
  else if (model.expressions[id]) {
    const owner = model.expressions[id]!.owners[0];
    if (owner && model.entities[owner]) {
      body = printer.statement(printer.iri(owner), model.entities[owner]!.statements.filter((s) => mentions(s.value, id, model)));
    } else if (owner && model.axioms[owner]) body = printer.statement('[]', model.axioms[owner]!.statements);
    else body = printer.statement('[]', model.blankNodes[id] ?? []);
  }
  if (body === null) return null;
  const prefixes = printer.prefixBlock();
  return prefixes ? `${prefixes}\n\n${body}` : body;
}

/** File blocks a node is written in, and (for expressions / axioms) the exact lines inside them. */
export function sourceSpans(model: OntologyModel, id: string): { blocks: LineSpan[]; focus?: LineSpan } {
  const blockAt = (line: number) => model.blocks.find((b) => b.start <= line && line <= b.end);
  if (model.header?.iri === id) return { blocks: model.header.location ? [model.header.location] : [] };
  if (model.entities[id]) return { blocks: model.entities[id]!.locations };
  const span = model.axioms[id]?.location ?? model.expressions[id]?.location;
  if (!span) return { blocks: [] };
  const block = blockAt(span.start);
  return { blocks: block ? [block] : [span], focus: block && (block.start !== span.start || block.end !== span.end) ? span : undefined };
}

// ── Syntax highlighting ─────────────────────────────────────────────────────
export type TurtleTokenClass = 'iri' | 'keyword' | 'literal' | 'annotation' | 'comment' | 'punctuation' | 'plain';
export interface TurtleSegment {
  text: string;
  type: TurtleTokenClass;
}

const CLASS_OF: Record<string, TurtleTokenClass> = {
  IRI: 'iri',
  prefixed: 'iri',
  blank: 'iri',
  prefix: 'iri',
  abbreviation: 'keyword',
  '@prefix': 'keyword',
  '@base': 'keyword',
  PREFIX: 'keyword',
  BASE: 'keyword',
  literal: 'literal',
  langcode: 'annotation',
  type: 'annotation',
  typeIRI: 'annotation',
  comment: 'comment',
};

/** Splits Turtle text into highlighted segments, one array per line. Falls back to plain text if it does not lex. */
export function highlightTurtle(text: string): TurtleSegment[][] {
  const lines = text.split('\n');
  const out: TurtleSegment[][] = lines.map(() => []);
  const cursor = lines.map(() => 0);
  const push = (line: number, end: number, type: TurtleTokenClass) => {
    const source = lines[line] ?? '';
    const start = cursor[line]!;
    if (end > start) out[line]!.push({ text: source.slice(start, end), type });
    cursor[line] = Math.max(start, end);
  };
  try {
    for (const token of new Lexer({ comments: true }).tokenize(text) as Array<{ type: string; line: number; start: number; end: number; endLine?: number }>) {
      if (token.type === 'eof') break;
      const type = CLASS_OF[token.type] ?? 'punctuation';
      const first = token.line - 1;
      const last = (token.endLine ?? token.line) - 1;
      push(first, token.start, 'plain'); // whitespace / "^^" before the token
      for (let l = first; l <= last; l++) push(l, l === last ? token.end : (lines[l] ?? '').length, type);
    }
  } catch {
    return lines.map((line) => [{ text: line, type: 'plain' }]);
  }
  lines.forEach((line, i) => push(i, line.length, 'plain'));
  return out;
}
