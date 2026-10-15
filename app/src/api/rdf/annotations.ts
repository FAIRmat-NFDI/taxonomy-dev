import type { NodeValue, OntologyModel } from '../types';
import { compactIri } from './materialize';
import { OWL, RDF, RDFS, SKOS } from './vocab';

/** Predicates with logical meaning — shown as axioms, not as annotations. */
const LOGICAL = new Set<string>([
  RDF.type,
  RDFS.subClassOf,
  RDFS.subPropertyOf,
  RDFS.domain,
  RDFS.range,
  OWL.equivalentClass,
  OWL.equivalentProperty,
  OWL.disjointWith,
  OWL.disjointUnionOf,
  OWL.propertyDisjointWith,
  OWL.inverseOf,
  OWL.propertyChainAxiom,
  OWL.hasKey,
  OWL.sameAs,
  OWL.differentFrom,
]);

/** Shown first, in this order. */
const FIRST = [RDFS.label, SKOS.prefLabel, SKOS.definition, RDFS.comment, 'http://purl.org/dc/terms/description', 'http://purl.org/dc/terms/title'];

export interface AnnotationGroup {
  predicate: string;
  /** Annotation property label, or its CURIE. */
  label: string;
  values: NodeValue[];
  line: number;
}

/**
 * Annotations of a node (labels, definitions, comments, provenance, …): every statement whose
 * predicate is neither a logical OWL / RDFS predicate nor an object / data property.
 */
export function annotationsOf(model: OntologyModel, id: string): AnnotationGroup[] {
  const statements = model.header?.iri === id ? model.header.statements : (model.entities[id]?.statements ?? []);
  const groups = new Map<string, AnnotationGroup>();
  for (const s of statements) {
    if (LOGICAL.has(s.predicate)) continue;
    const kinds = model.entities[s.predicate]?.kinds ?? [];
    if (kinds.includes('objectProperty') || kinds.includes('datatypeProperty')) continue;
    const group = groups.get(s.predicate);
    if (group) group.values.push(s.value);
    else
      groups.set(s.predicate, {
        predicate: s.predicate,
        // The property's own rdfs:label when it has one (e.g. "editorial note"), else its CURIE.
        label: model.entities[s.predicate]?.statements.some((x) => x.predicate === RDFS.label)
          ? model.entities[s.predicate]!.label
          : compactIri(s.predicate, model.prefixes),
        values: [s.value],
        line: s.line,
      });
  }
  const rank = (p: string) => {
    const i = FIRST.indexOf(p);
    return i === -1 ? FIRST.length : i;
  };
  return [...groups.values()].sort((a, b) => rank(a.predicate) - rank(b.predicate));
}
