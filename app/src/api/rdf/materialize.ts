import type {
  AxiomKind,
  AxiomNode,
  EntityKind,
  EntityNode,
  ExpressionKind,
  ExpressionNode,
  HierarchyKind,
  LineSpan,
  LocatedTriple,
  NodeStatement,
  NodeValue,
  ObjectTerm,
  OntologyHeader,
  OntologyModel,
  ParsedOntology,
  PrefixMap,
} from '../types';
import { BUILTIN_NAMESPACES, NS, OWL, RDF, RDFS, SKOS, XSD } from './vocab';

/**
 * Parsed triples → node model (OntologyModel).
 *
 *  entities     named classes / properties / individuals / datatypes, with hierarchy links
 *  expressions  anonymous class / property / data-range expressions (blank nodes), as text
 *  axioms       axioms that belong to no single entity (AllDisjointClasses, GCIs, …)
 *
 * Every node keeps the source lines it came from. Pure function: no I/O, no UI.
 */

// ── Vocabulary tables ───────────────────────────────────────────────────────
const TYPE_TO_KIND: Record<string, EntityKind> = {
  [OWL.Class]: 'class',
  [RDFS.Class]: 'class',
  [OWL.ObjectProperty]: 'objectProperty',
  [OWL.TransitiveProperty]: 'objectProperty',
  [OWL.SymmetricProperty]: 'objectProperty',
  [OWL.AsymmetricProperty]: 'objectProperty',
  [OWL.ReflexiveProperty]: 'objectProperty',
  [OWL.IrreflexiveProperty]: 'objectProperty',
  [OWL.InverseFunctionalProperty]: 'objectProperty',
  [OWL.DatatypeProperty]: 'datatypeProperty',
  [OWL.AnnotationProperty]: 'annotationProperty',
  [OWL.NamedIndividual]: 'individual',
  [RDFS.Datatype]: 'datatype',
};

const CLASS_LINKS = new Set<string>([RDFS.subClassOf, OWL.equivalentClass, OWL.disjointWith]);
const PROPERTY_LINKS = new Set<string>([RDFS.subPropertyOf, OWL.equivalentProperty, OWL.inverseOf, OWL.propertyDisjointWith]);
const INDIVIDUAL_LINKS = new Set<string>([OWL.sameAs, OWL.differentFrom]);
const HIERARCHY_KINDS: HierarchyKind[] = ['class', 'objectProperty', 'datatypeProperty', 'annotationProperty'];
const ALL_KINDS: EntityKind[] = [...HIERARCHY_KINDS, 'individual', 'datatype'];

const AXIOM_TYPES: Record<string, AxiomKind> = {
  [OWL.AllDisjointClasses]: 'AllDisjointClasses',
  [OWL.AllDisjointProperties]: 'AllDisjointProperties',
  [OWL.AllDifferent]: 'AllDifferent',
  [OWL.NegativePropertyAssertion]: 'NegativePropertyAssertion',
  [OWL.Axiom]: 'AnnotatedAxiom',
};

const CARDINALITY: Array<[string, string]> = [
  [OWL.cardinality, 'exactly'],
  [OWL.qualifiedCardinality, 'exactly'],
  [OWL.minCardinality, 'min'],
  [OWL.minQualifiedCardinality, 'min'],
  [OWL.maxCardinality, 'max'],
  [OWL.maxQualifiedCardinality, 'max'],
];

const FACETS: Record<string, string> = {
  [XSD.minInclusive]: '>=',
  [XSD.maxInclusive]: '<=',
  [XSD.minExclusive]: '>',
  [XSD.maxExclusive]: '<',
};

const PLAIN_LITERAL_TYPES = new Set<string>([XSD.integer, XSD.decimal, XSD.double, XSD.boolean, XSD.nonNegativeInteger]);

// ── Helpers ─────────────────────────────────────────────────────────────────
const isBuiltin = (iri: string) => BUILTIN_NAMESPACES.some((ns) => iri.startsWith(ns));
const key = (t: ObjectTerm) => (t.termType === 'BlankNode' ? `_:${t.value}` : t.value);
const isBlank = (k: string) => k.startsWith('_:');
const blankId = (k: string) => k.slice(2);

function localName(iri: string): string {
  const cut = Math.max(iri.lastIndexOf('#'), iri.lastIndexOf('/'));
  return cut >= 0 && cut < iri.length - 1 ? iri.slice(cut + 1) : iri;
}

/** Shortest "prefix:local" form for an IRI, or the IRI itself. */
export function compactIri(iri: string, prefixes: PrefixMap): string {
  let best: string | null = null;
  let bestLength = 0;
  for (const [prefix, ns] of Object.entries(prefixes)) {
    if (ns && iri.startsWith(ns) && ns.length > bestLength && /^[\w.-]*$/.test(iri.slice(ns.length))) {
      best = `${prefix}:${iri.slice(ns.length)}`;
      bestLength = ns.length;
    }
  }
  return best ?? iri;
}

const spanOf = (lines: number[]): LineSpan => ({ start: Math.min(...lines), end: Math.max(...lines) });
const sortByLabel = (ids: string[], label: (id: string) => string) =>
  [...ids].sort((a, b) => label(a).localeCompare(label(b), undefined, { sensitivity: 'base' }));

// ── Materialize ─────────────────────────────────────────────────────────────
export function materialize(parsed: ParsedOntology): OntologyModel {
  const { triples, prefixes, statements } = parsed;

  // Indexes
  const bySubject = new Map<string, LocatedTriple[]>();
  const incoming = new Map<string, LocatedTriple[]>();
  for (const t of triples) {
    const s = key(t.subject);
    (bySubject.get(s) ?? bySubject.set(s, []).get(s)!).push(t);
    if (t.object.termType === 'BlankNode') {
      const o = key(t.object);
      (incoming.get(o) ?? incoming.set(o, []).get(o)!).push(t);
    }
  }
  const objectsOf = (s: string, p: string) => (bySubject.get(s) ?? []).filter((t) => t.predicate.value === p).map((t) => t.object);
  const firstObject = (s: string, p: string) => objectsOf(s, p)[0];

  // RDF lists (rdf:first / rdf:rest chains)
  const listNodes = new Set<string>();
  for (const [s, ts] of bySubject) if (isBlank(s) && ts.some((t) => t.predicate.value === RDF.first)) listNodes.add(s);
  function listItems(head: string): ObjectTerm[] {
    const items: ObjectTerm[] = [];
    const seen = new Set<string>();
    let node: string | undefined = head;
    while (node && listNodes.has(node) && !seen.has(node)) {
      seen.add(node);
      const first = firstObject(node, RDF.first);
      if (first) items.push(first);
      const rest = firstObject(node, RDF.rest);
      node = rest && rest.value !== RDF.nil ? key(rest) : undefined;
    }
    return items;
  }

  // ── Entities: kinds, declarations ──
  const kinds = new Map<string, Set<EntityKind>>();
  const declared = new Set<string>();
  const explicitClasses = new Set<string>();
  const addKind = (iri: string, kind: EntityKind) => {
    if (isBuiltin(iri)) return;
    (kinds.get(iri) ?? kinds.set(iri, new Set()).get(iri)!).add(kind);
  };
  let headerIri: string | null = null;

  for (const t of triples) {
    if (t.subject.termType !== 'NamedNode') continue;
    const s = t.subject.value;
    const p = t.predicate.value;
    const o = t.object;
    if (p === RDF.type && o.termType === 'NamedNode') {
      if (o.value === OWL.Ontology) {
        headerIri ??= s;
        continue;
      }
      const kind = TYPE_TO_KIND[o.value];
      if (kind) {
        addKind(s, kind);
        declared.add(s);
        if (kind === 'class') explicitClasses.add(s);
      } else if (!isBuiltin(o.value) && o.value !== OWL.FunctionalProperty) {
        addKind(s, 'individual'); // ClassAssertion
        addKind(o.value, 'class');
        declared.add(s);
      }
    } else if (CLASS_LINKS.has(p)) {
      addKind(s, 'class');
      if (o.termType === 'NamedNode') addKind(o.value, 'class');
    } else if (INDIVIDUAL_LINKS.has(p)) {
      addKind(s, 'individual');
      if (o.termType === 'NamedNode') addKind(o.value, 'individual');
    }
  }
  // Property kinds propagate along property links (e.g. an undeclared super-property).
  for (let pass = 0; pass < 3; pass++) {
    for (const t of triples) {
      if (!PROPERTY_LINKS.has(t.predicate.value) || t.subject.termType !== 'NamedNode' || t.object.termType !== 'NamedNode') continue;
      const [a, b] = [t.subject.value, t.object.value];
      const propertyKind = (iri: string) => [...(kinds.get(iri) ?? [])].find((k) => k.endsWith('Property'));
      const known = propertyKind(a) ?? propertyKind(b);
      if (known) [a, b].forEach((iri) => addKind(iri, known));
    }
  }

  // A datatype defined via owl:equivalentClass is still a datatype, not a class.
  for (const [iri, ks] of kinds) if (ks.has('datatype') && !explicitClasses.has(iri)) ks.delete('class');

  // ── Labels ──
  const literalOf = (s: string, predicates: string[]) => {
    for (const p of predicates) {
      const values = objectsOf(s, p).filter((o) => o.termType === 'Literal');
      const preferred = values.find((o) => o.termType === 'Literal' && (!o.language || o.language.startsWith('en')));
      if (preferred ?? values[0]) return (preferred ?? values[0])!.value;
    }
    return undefined;
  };
  const curieOf = (iri: string) => compactIri(iri, prefixes);
  const labelCache = new Map<string, string>();
  const labelOf = (iri: string) => {
    let label = labelCache.get(iri);
    if (label === undefined) {
      label = literalOf(iri, [RDFS.label, SKOS.prefLabel]) ?? (compactIri(iri, prefixes) !== iri ? localName(iri) : iri);
      labelCache.set(iri, label);
    }
    return label;
  };

  // ── Expressions (blank nodes) ──
  const expressionText = new Map<string, string>();

  function valueOf(term: ObjectTerm): NodeValue {
    if (term.termType === 'Literal') return { type: 'literal', value: term.value, language: term.language, datatype: term.datatype };
    if (term.termType === 'NamedNode') return { type: 'iri', iri: term.value };
    const k = key(term);
    if (listNodes.has(k)) return { type: 'list', items: listItems(k).map(valueOf) };
    return { type: 'expression', id: term.value };
  }

  function renderTerm(term: ObjectTerm | undefined, stack: Set<string>, nested = true): string {
    if (!term) return '?';
    if (term.termType === 'NamedNode') return kinds.has(term.value) ? labelOf(term.value) : curieOf(term.value);
    if (term.termType === 'Literal') {
      if (term.datatype && PLAIN_LITERAL_TYPES.has(term.datatype)) return term.value;
      return `"${term.value}"${term.language ? `@${term.language}` : ''}`;
    }
    const text = renderBlank(key(term), stack);
    return nested && /\s/.test(text) && !text.startsWith('(') && !text.startsWith('{') ? `(${text})` : text;
  }

  function kindOfBlank(k: string): ExpressionKind {
    const ps = new Set((bySubject.get(k) ?? []).map((t) => t.predicate.value));
    if (ps.has(OWL.onProperty) || ps.has(OWL.onProperties)) return 'restriction';
    if (ps.has(OWL.unionOf)) return 'union';
    if (ps.has(OWL.intersectionOf)) return 'intersection';
    if (ps.has(OWL.complementOf) || ps.has(OWL.datatypeComplementOf)) return 'complement';
    if (ps.has(OWL.oneOf)) return 'oneOf';
    if (ps.has(OWL.onDatatype)) return 'dataRange';
    if (ps.has(OWL.inverseOf) && ps.size === 1) return 'inverse';
    const types = objectsOf(k, RDF.type).filter((o) => o.termType === 'NamedNode' && !isBuiltin(o.value));
    if (types.length) return 'anonymousIndividual';
    return 'other';
  }

  function renderBlank(k: string, stack: Set<string>): string {
    const cached = expressionText.get(k);
    if (cached) return cached;
    if (stack.has(k)) return '…';
    stack.add(k);
    const r = (p: string) => renderTerm(firstObject(k, p), stack);
    const list = (p: string) => {
      const head = firstObject(k, p);
      return head ? listItems(key(head)).map((i) => renderTerm(i, stack)) : [];
    };
    let text: string;
    if (listNodes.has(k)) text = `(${listItems(k).map((i) => renderTerm(i, stack)).join(', ')})`;
    else
      switch (kindOfBlank(k)) {
        case 'restriction': {
          const property = firstObject(k, OWL.onProperty) ? r(OWL.onProperty) : `(${list(OWL.onProperties).join(', ')})`;
          const filler = firstObject(k, OWL.onClass) ? r(OWL.onClass) : firstObject(k, OWL.onDataRange) ? r(OWL.onDataRange) : '';
          const card = CARDINALITY.find(([p]) => firstObject(k, p));
          if (firstObject(k, OWL.someValuesFrom)) text = `${property} some ${r(OWL.someValuesFrom)}`;
          else if (firstObject(k, OWL.allValuesFrom)) text = `${property} only ${r(OWL.allValuesFrom)}`;
          else if (firstObject(k, OWL.hasValue)) text = `${property} value ${r(OWL.hasValue)}`;
          else if (firstObject(k, OWL.hasSelf)) text = `${property} Self`;
          else if (card) text = `${property} ${card[1]} ${firstObject(k, card[0])!.value}${filler ? ` ${filler}` : ''}`;
          else text = `${property} …`;
          break;
        }
        case 'union':
          text = list(OWL.unionOf).join(' or ');
          break;
        case 'intersection':
          text = list(OWL.intersectionOf).join(' and ');
          break;
        case 'complement':
          text = `not ${firstObject(k, OWL.complementOf) ? r(OWL.complementOf) : r(OWL.datatypeComplementOf)}`;
          break;
        case 'oneOf':
          text = `{${list(OWL.oneOf).join(', ')}}`;
          break;
        case 'inverse':
          text = `inverse ${r(OWL.inverseOf)}`;
          break;
        case 'dataRange': {
          const head = firstObject(k, OWL.withRestrictions);
          const facets = head
            ? listItems(key(head)).flatMap((facet) =>
                (bySubject.get(key(facet)) ?? []).map((t) => `${FACETS[t.predicate.value] ?? curieOf(t.predicate.value)} ${t.object.value}`),
              )
            : [];
          text = `${r(OWL.onDatatype)}[${facets.join(', ')}]`;
          break;
        }
        case 'anonymousIndividual': {
          const types = objectsOf(k, RDF.type).filter((o) => o.termType === 'NamedNode' && !isBuiltin(o.value));
          const label = literalOf(k, [RDFS.label]);
          text = `[${types.map((t) => renderTerm(t, stack)).join(', ')}${label ? `: ${label}` : ''}]`;
          break;
        }
        default:
          text = `[${(bySubject.get(k) ?? []).map((t) => curieOf(t.predicate.value)).join(', ')}]`;
      }
    stack.delete(k);
    expressionText.set(k, text);
    return text;
  }

  const statementsOf = (s: string): NodeStatement[] =>
    (bySubject.get(s) ?? []).map((t) => ({ predicate: t.predicate.value, value: valueOf(t.object), line: t.line }));

  /** All lines a blank node and its nested blank nodes / lists occupy. */
  function blankLines(k: string, seen = new Set<string>()): number[] {
    if (seen.has(k)) return [];
    seen.add(k);
    return (bySubject.get(k) ?? []).flatMap((t) => [t.line, ...(t.object.termType === 'BlankNode' ? blankLines(key(t.object), seen) : [])]);
  }

  /**
   * Named subjects (or axiom ids) that use this blank node, following lists and enclosing expressions.
   * nested = its direct container (through a list, if any) is another blank node.
   */
  function ownersOf(k: string): { owners: string[]; nested: boolean } {
    const owners = new Set<string>();
    const seen = new Set<string>();
    const containers = (node: string): string[] =>
      (incoming.get(node) ?? []).flatMap((t) => {
        const s = key(t.subject);
        return listNodes.has(s) && !seen.has(s) ? (seen.add(s), containers(s)) : [s];
      });
    const direct = containers(k);
    const walk = (node: string) => {
      if (seen.has(node)) return;
      seen.add(node);
      if (!isBlank(node)) owners.add(node);
      else if (axiomKinds.has(node)) owners.add(blankId(node));
      else containers(node).forEach(walk);
    };
    direct.forEach(walk);
    return { owners: [...owners], nested: direct.some(isBlank) };
  }

  // ── Axioms ──
  const axiomKinds = new Map<string, AxiomKind>();
  for (const [s] of bySubject) {
    if (!isBlank(s) || listNodes.has(s)) continue;
    const type = objectsOf(s, RDF.type).find((o) => o.termType === 'NamedNode' && AXIOM_TYPES[o.value]);
    if (type) axiomKinds.set(s, AXIOM_TYPES[type.value]!);
    else if (!incoming.has(s) && (bySubject.get(s) ?? []).some((t) => CLASS_LINKS.has(t.predicate.value))) {
      axiomKinds.set(s, 'GeneralClassInclusion');
    }
  }

  const axioms: Record<string, AxiomNode> = {};
  for (const [k, kind] of axiomKinds) {
    const stack = new Set<string>();
    const members = (p: string) => {
      const head = firstObject(k, p);
      return head ? listItems(key(head)) : [];
    };
    let memberTerms: ObjectTerm[] = [];
    let text: string;
    switch (kind) {
      case 'AllDisjointClasses':
      case 'AllDisjointProperties':
      case 'AllDifferent': {
        memberTerms = [...members(OWL.members), ...members(OWL.distinctMembers)];
        const name = { AllDisjointClasses: 'DisjointClasses', AllDisjointProperties: 'DisjointProperties', AllDifferent: 'DifferentIndividuals' }[kind];
        text = `${name}(${memberTerms.map((m) => renderTerm(m, stack)).join(', ')})`;
        break;
      }
      case 'NegativePropertyAssertion': {
        const target = firstObject(k, OWL.targetIndividual) ?? firstObject(k, OWL.targetValue);
        memberTerms = [firstObject(k, OWL.sourceIndividual), firstObject(k, OWL.assertionProperty), target].filter(Boolean) as ObjectTerm[];
        text = `not (${memberTerms.map((m) => renderTerm(m, stack)).join(' ')})`;
        break;
      }
      case 'AnnotatedAxiom': {
        memberTerms = [OWL.annotatedSource, OWL.annotatedProperty, OWL.annotatedTarget].map((p) => firstObject(k, p)).filter(Boolean) as ObjectTerm[];
        const [source, property, target] = [OWL.annotatedSource, OWL.annotatedProperty, OWL.annotatedTarget].map((p) => firstObject(k, p));
        const propertyText = property?.termType === 'NamedNode' && isBuiltin(property.value) ? curieOf(property.value) : renderTerm(property, stack);
        text = `${renderTerm(source, stack)} ${propertyText} ${renderTerm(target, stack)}`;
        break;
      }
      case 'GeneralClassInclusion': {
        const link = (bySubject.get(k) ?? []).find((t) => CLASS_LINKS.has(t.predicate.value))!;
        const name = { [RDFS.subClassOf]: 'SubClassOf', [OWL.equivalentClass]: 'EquivalentTo', [OWL.disjointWith]: 'DisjointWith' }[link.predicate.value];
        text = `${renderBlank(k, stack)} ${name} ${renderTerm(link.object, stack)}`;
        memberTerms = [link.object];
        break;
      }
    }
    const id = blankId(k);
    axioms[id] = {
      id,
      kind,
      text,
      location: spanOf(blankLines(k)),
      members: memberTerms.filter((m) => m.termType === 'NamedNode').map((m) => m.value),
      statements: statementsOf(k),
    };
  }

  const expressions: Record<string, ExpressionNode> = {};
  for (const [k] of bySubject) {
    if (!isBlank(k) || listNodes.has(k)) continue;
    // Axiom blank nodes are axioms, not expressions — except a GCI's left-hand side, which is both.
    if (axiomKinds.has(k) && axiomKinds.get(k) !== 'GeneralClassInclusion') continue;
    const kind = kindOfBlank(k);
    // Facet blank nodes ([ xsd:minInclusive 0 ]) are part of their data range's text.
    if (kind === 'other' && (bySubject.get(k) ?? []).every((t) => t.predicate.value.startsWith(NS.xsd))) continue;
    const { owners, nested } = axiomKinds.has(k) ? { owners: [blankId(k)], nested: true } : ownersOf(k);
    expressions[blankId(k)] = {
      id: blankId(k),
      kind,
      text: renderBlank(k, new Set()),
      location: spanOf(blankLines(k)),
      owners,
      nested,
      statements: statementsOf(k),
    };
  }

  const blankNodes: Record<string, NodeStatement[]> = {};
  for (const [k] of bySubject) if (isBlank(k) && !listNodes.has(k)) blankNodes[blankId(k)] = statementsOf(k);

  // ── Entity nodes ──
  const entities: Record<string, EntityNode> = {};
  for (const [iri, ks] of kinds) {
    const locations = [...new Set((bySubject.get(iri) ?? []).map((t) => t.statement))]
      .map((i) => statements[i])
      .filter((span): span is LineSpan => !!span);
    entities[iri] = {
      iri,
      curie: curieOf(iri),
      label: labelOf(iri),
      kinds: ALL_KINDS.filter((k) => ks.has(k)),
      declared: declared.has(iri) || bySubject.has(iri),
      deprecated: objectsOf(iri, OWL.deprecated).some((o) => o.value === 'true'),
      locations,
      parents: [],
      children: [],
      types: objectsOf(iri, RDF.type)
        .filter((o) => o.termType === 'NamedNode' && !isBuiltin(o.value))
        .map((o) => o.value),
      statements: statementsOf(iri),
    };
  }

  // Hierarchy links (named only; owl:Thing / top properties / builtins are implicit roots)
  const selfLoops: string[] = [];
  for (const t of triples) {
    const p = t.predicate.value;
    if ((p !== RDFS.subClassOf && p !== RDFS.subPropertyOf) || t.subject.termType !== 'NamedNode' || t.object.termType !== 'NamedNode') continue;
    const child = entities[t.subject.value];
    const parent = entities[t.object.value];
    if (!child || !parent) continue;
    if (child === parent) {
      selfLoops.push(child.iri);
      continue;
    }
    if (!child.parents.includes(parent.iri)) child.parents.push(parent.iri);
    if (!parent.children.includes(child.iri)) parent.children.push(child.iri);
  }
  const byLabel = (id: string) => entities[id]?.label ?? id;
  for (const e of Object.values(entities)) {
    e.parents = sortByLabel(e.parents, byLabel);
    e.children = sortByLabel(e.children, byLabel);
  }

  // ── Roots and cycles per hierarchy ──
  const roots = {} as Record<HierarchyKind, string[]>;
  const cycles: string[][] = selfLoops.map((iri) => [iri]);
  for (const kind of HIERARCHY_KINDS) {
    const members = Object.values(entities).filter((e) => e.kinds.includes(kind));
    const inKind = new Set(members.map((e) => e.iri));
    const parentsOf = (iri: string) => entities[iri]!.parents.filter((p) => inKind.has(p));
    const components = stronglyConnected([...inKind], parentsOf);
    const rootSet = new Set(members.filter((e) => parentsOf(e.iri).length === 0).map((e) => e.iri));
    for (const component of components) {
      if (component.length < 2) continue;
      cycles.push(sortByLabel(component, byLabel));
      const inside = new Set(component);
      // A cycle nobody points into would be unreachable from the roots — show one member at the top.
      if (component.every((iri) => parentsOf(iri).every((p) => inside.has(p)))) rootSet.add(sortByLabel(component, byLabel)[0]!);
    }
    roots[kind] = sortByLabel([...rootSet], byLabel);
  }

  // ── Header ──
  let header: OntologyHeader | null = null;
  if (headerIri) {
    const locations = [...new Set((bySubject.get(headerIri) ?? []).map((t) => t.statement))].map((i) => statements[i]).filter(Boolean) as LineSpan[];
    header = {
      iri: headerIri,
      label: literalOf(headerIri, [RDFS.label, `http://purl.org/dc/terms/title`, `http://purl.org/dc/elements/1.1/title`]) ?? localName(headerIri),
      versionIri: firstObject(headerIri, OWL.versionIRI)?.value,
      versionInfo: firstObject(headerIri, OWL.versionInfo)?.value,
      imports: objectsOf(headerIri, OWL.imports).map((o) => o.value),
      location: locations[0],
      statements: statementsOf(headerIri),
    };
  }

  const count = (kind: EntityKind) => Object.values(entities).filter((e) => e.kinds.includes(kind) && e.declared).length;
  return {
    header,
    prefixes,
    entities,
    expressions,
    axioms,
    blankNodes,
    blocks: statements,
    roots,
    cycles,
    stats: {
      triples: triples.length,
      lines: parsed.lineCount,
      entities: Object.fromEntries(ALL_KINDS.map((k) => [k, count(k)])) as Record<EntityKind, number>,
      expressions: Object.values(expressions).filter((x) => !x.nested).length,
      axioms: Object.keys(axioms).length,
    },
  };
}

/** Tarjan's algorithm (iterative), edges child → parent. */
function stronglyConnected(nodes: string[], edges: (n: string) => string[]): string[][] {
  let index = 0;
  const indices = new Map<string, number>();
  const low = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const result: string[][] = [];

  for (const start of nodes) {
    if (indices.has(start)) continue;
    const work: Array<{ node: string; next: number }> = [{ node: start, next: 0 }];
    indices.set(start, index);
    low.set(start, index++);
    stack.push(start);
    onStack.add(start);
    while (work.length) {
      const frame = work[work.length - 1]!;
      const targets = edges(frame.node);
      if (frame.next < targets.length) {
        const target = targets[frame.next++]!;
        if (!indices.has(target)) {
          indices.set(target, index);
          low.set(target, index++);
          stack.push(target);
          onStack.add(target);
          work.push({ node: target, next: 0 });
        } else if (onStack.has(target)) {
          low.set(frame.node, Math.min(low.get(frame.node)!, indices.get(target)!));
        }
        continue;
      }
      work.pop();
      if (work.length) {
        const parent = work[work.length - 1]!.node;
        low.set(parent, Math.min(low.get(parent)!, low.get(frame.node)!));
      }
      if (low.get(frame.node) === indices.get(frame.node)) {
        const component: string[] = [];
        let member: string;
        do {
          member = stack.pop()!;
          onStack.delete(member);
          component.push(member);
        } while (member !== frame.node);
        result.push(component);
      }
    }
  }
  return result;
}
