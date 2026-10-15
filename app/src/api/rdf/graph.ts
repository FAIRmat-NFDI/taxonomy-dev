import type { ExpressionKind, NodeStatement, NodeValue, OntologyModel } from '../types';
import { compactIri } from './materialize';
import { OWL, RDF, RDFS } from './vocab';

/**
 * The model as a directed graph (plain data, for any graph library), typed by OWL 2 construct:
 *
 *  entity ──relation──▶ entity             subClassOf, type, domain, range, inverse, assertions, …
 *  class ──"p some"───▶ filler             simple restrictions become one labelled link
 *  entity ──relation──▶ (expression) ──▶   other anonymous expressions are nodes of their own
 *
 * Every node and link carries its OWL 2 kind; the view gives each kind its own colour / shape.
 * Literals and vocabulary IRIs (owl:, rdfs:, xsd:) are not nodes.
 */
export type GraphNodeKind =
  | 'class'
  | 'objectProperty'
  | 'datatypeProperty'
  | 'annotationProperty'
  | 'individual'
  | 'datatype'
  | 'restriction'
  | 'booleanExpression'
  | 'enumeration'
  | 'dataRange'
  | 'inverseProperty'
  | 'anonymousIndividual'
  | 'expression';

export interface GraphNode {
  id: string;
  label: string;
  kind: GraphNodeKind;
  /** Referenced, but not declared in this file. */
  external: boolean;
}

/** OWL 2 kind of a link; its label (the exact predicate / restriction) shows on demand. */
export type EdgeRelation =
  | 'subClassOf'
  | 'subPropertyOf'
  | 'type'
  | 'equivalent'
  | 'disjoint'
  | 'inverse'
  | 'sameAs'
  | 'differentFrom'
  | 'domain'
  | 'range'
  | 'some'
  | 'only'
  | 'value'
  | 'cardinality'
  | 'assertion'
  | 'annotation'
  | 'operand'
  | 'other';

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  relation: EdgeRelation;
  line: number;
}

export interface OntologyGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

const QUANTIFIERS: Array<[string, string, EdgeRelation]> = [
  [OWL.someValuesFrom, 'some', 'some'],
  [OWL.allValuesFrom, 'only', 'only'],
  [OWL.hasValue, 'value', 'value'],
  [OWL.qualifiedCardinality, 'exactly', 'cardinality'],
  [OWL.minQualifiedCardinality, 'min', 'cardinality'],
  [OWL.maxQualifiedCardinality, 'max', 'cardinality'],
];

const RELATION: Record<string, EdgeRelation> = {
  [RDFS.subClassOf]: 'subClassOf',
  [RDFS.subPropertyOf]: 'subPropertyOf',
  [RDF.type]: 'type',
  [OWL.equivalentClass]: 'equivalent',
  [OWL.equivalentProperty]: 'equivalent',
  [OWL.disjointWith]: 'disjoint',
  [OWL.propertyDisjointWith]: 'disjoint',
  [OWL.disjointUnionOf]: 'disjoint',
  [OWL.inverseOf]: 'inverse',
  [OWL.sameAs]: 'sameAs',
  [OWL.differentFrom]: 'differentFrom',
  [RDFS.domain]: 'domain',
  [RDFS.range]: 'range',
  // Inside anonymous expressions
  [OWL.someValuesFrom]: 'some',
  [OWL.allValuesFrom]: 'only',
  [OWL.hasValue]: 'value',
  [OWL.onClass]: 'cardinality',
  [OWL.onDataRange]: 'cardinality',
  [OWL.onProperty]: 'operand',
  [OWL.unionOf]: 'operand',
  [OWL.intersectionOf]: 'operand',
  [OWL.complementOf]: 'operand',
  [OWL.datatypeComplementOf]: 'operand',
  [OWL.oneOf]: 'operand',
  [OWL.onDatatype]: 'operand',
};

const EXPRESSION_NODE: Record<ExpressionKind, GraphNodeKind> = {
  restriction: 'restriction',
  union: 'booleanExpression',
  intersection: 'booleanExpression',
  complement: 'booleanExpression',
  oneOf: 'enumeration',
  dataRange: 'dataRange',
  inverse: 'inverseProperty',
  anonymousIndividual: 'anonymousIndividual',
  other: 'expression',
};

const MAX_LABEL = 40;

export function buildOntologyGraph(model: OntologyModel): OntologyGraph {
  const nodes = new Map<string, GraphNode>();
  const edges = new Map<string, GraphEdge>();
  const isEntity = (iri: string) => !!model.entities[iri];
  const nameOf = (iri: string) => model.entities[iri]?.label ?? compactIri(iri, model.prefixes);
  const predicateLabel = (p: string) => (p === RDF.type ? 'type' : isEntity(p) ? nameOf(p) : compactIri(p, model.prefixes).replace(/^[^:]*:/, ''));

  const relationOf = (predicate: string): EdgeRelation => {
    const known = RELATION[predicate];
    if (known) return known;
    const kinds = model.entities[predicate]?.kinds ?? [];
    if (kinds.includes('annotationProperty')) return 'annotation';
    if (kinds.includes('objectProperty') || kinds.includes('datatypeProperty')) return 'assertion';
    return 'other';
  };

  const addEdge = (source: string, target: string, label: string, predicate: string, line: number, relation = relationOf(predicate)) => {
    const id = `${source}|${label}|${target}`;
    if (!edges.has(id)) edges.set(id, { id, source, target, label, relation, line });
  };

  for (const e of Object.values(model.entities)) {
    if (!e.kinds.length) continue;
    nodes.set(e.iri, { id: e.iri, label: e.label, kind: e.kinds[0]!, external: !e.declared });
  }

  /** "p some C" for a restriction with a named property and a named filler; null otherwise. */
  const flatRestriction = (statements: NodeStatement[]): { label: string; target: string; relation: EdgeRelation } | null => {
    const property = statements.find((s) => s.predicate === OWL.onProperty)?.value;
    if (property?.type !== 'iri') return null;
    for (const [p, word, relation] of QUANTIFIERS) {
      const filler = statements.find((s) => s.predicate === p)?.value;
      if (!filler) continue;
      // "some C" / "only C" / "value x" name the target directly; qualified cardinalities carry it in owl:onClass.
      const onClass = statements.find((s) => s.predicate === OWL.onClass)?.value;
      const target = filler.type === 'iri' ? filler.iri : filler.type === 'literal' && onClass?.type === 'iri' ? onClass.iri : null;
      const count = filler.type === 'literal' ? ` ${filler.value}` : '';
      return target && isEntity(target) ? { label: `${nameOf(property.iri)} ${word}${count}`, target, relation } : null;
    }
    return null;
  };

  /** Named entities mentioned anywhere inside an anonymous expression (nested blanks / lists flattened). */
  const mentions = (value: NodeValue, via: string, out: Array<{ iri: string; predicate: string }>, seen: Set<string>) => {
    if (value.type === 'iri' && isEntity(value.iri)) out.push({ iri: value.iri, predicate: via });
    else if (value.type === 'list') value.items.forEach((v) => mentions(v, via, out, seen));
    else if (value.type === 'expression' && !seen.has(value.id)) {
      seen.add(value.id);
      for (const s of model.blankNodes[value.id] ?? []) if (s.predicate !== RDF.type) mentions(s.value, s.predicate, out, seen);
    }
  };

  for (const e of Object.values(model.entities)) {
    if (!nodes.has(e.iri)) continue;
    for (const s of e.statements) {
      const v = s.value;
      if (v.type === 'iri' && isEntity(v.iri) && v.iri !== e.iri) addEdge(e.iri, v.iri, predicateLabel(s.predicate), s.predicate, s.line);
      else if (v.type === 'list') {
        for (const item of v.items) if (item.type === 'iri' && isEntity(item.iri)) addEdge(e.iri, item.iri, predicateLabel(s.predicate), s.predicate, s.line);
      } else if (v.type === 'expression') {
        const statements = model.blankNodes[v.id] ?? [];
        const flat = flatRestriction(statements);
        if (flat) {
          addEdge(e.iri, flat.target, flat.label, s.predicate, s.line, flat.relation);
          continue;
        }
        const expression = model.expressions[v.id];
        const text = expression?.text ?? '[ ]';
        nodes.set(v.id, {
          id: v.id,
          label: text.length > MAX_LABEL ? `${text.slice(0, MAX_LABEL - 1)}…` : text,
          kind: EXPRESSION_NODE[expression?.kind ?? 'other'],
          external: false,
        });
        addEdge(e.iri, v.id, predicateLabel(s.predicate), s.predicate, s.line);
        const found: Array<{ iri: string; predicate: string }> = [];
        mentions(v, s.predicate, found, new Set());
        for (const m of found) if (m.iri !== e.iri) addEdge(v.id, m.iri, predicateLabel(m.predicate), m.predicate, s.line);
      }
    }
  }

  return { nodes: [...nodes.values()], edges: [...edges.values()] };
}

/** Graph node to centre on for a selected node id (a flattened restriction centres on its owner). */
export function graphRootFor(model: OntologyModel, graph: OntologyGraph, id: string): string | null {
  if (graph.nodes.some((n) => n.id === id)) return id;
  const owner = model.expressions[id]?.owners.find((o) => !!model.entities[o]);
  return owner ?? null;
}
