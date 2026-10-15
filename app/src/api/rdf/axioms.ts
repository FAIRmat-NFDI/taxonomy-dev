import type { NodeStatement, NodeValue, OntologyModel } from '../types';
import { compactIri } from './materialize';
import { OWL, RDF, RDFS, XSD } from './vocab';

/**
 * Logical axioms around one node, as small ASTs that render either in Manchester-like text
 * or in Description Logic notation. Pure functions over the materialized model.
 *
 *  own axioms      statements of the node itself (sub class of, domain, characteristics, …)
 *  incoming        statements of other entities that point at it (sub classes, instances,
 *                  "domain of", restrictions that mention it, …) and standalone axioms
 */

// ── AST ─────────────────────────────────────────────────────────────────────
export type PropExpr = { t: 'prop'; iri: string } | { t: 'inv'; of: PropExpr };

export type Expr =
  | { t: 'named'; iri: string }
  | { t: 'top' }
  | { t: 'bottom' }
  | { t: 'literal'; value: string; language?: string; datatype?: string }
  | { t: 'some' | 'only'; p: PropExpr; f: Expr }
  | { t: 'value'; p: PropExpr; v: Expr }
  | { t: 'self'; p: PropExpr }
  | { t: 'card'; op: 'min' | 'max' | 'exactly'; n: string; p: PropExpr; f?: Expr }
  | { t: 'and' | 'or'; ops: Expr[] }
  | { t: 'not'; op: Expr }
  | { t: 'oneOf'; items: Expr[] }
  | { t: 'facets'; base: Expr; facets: Array<{ op: string; value: Expr }> }
  | { t: 'anon'; text: string };

export type Characteristic = 'Functional' | 'InverseFunctional' | 'Transitive' | 'Symmetric' | 'Asymmetric' | 'Reflexive' | 'Irreflexive';

export type Axiom =
  | { t: 'sub' | 'equiv'; lhs: Expr; rhs: Expr }
  | { t: 'subProp' | 'equivProp' | 'inverse'; lhs: PropExpr; rhs: PropExpr }
  | { t: 'disjoint' | 'same' | 'different'; items: Expr[] }
  | { t: 'disjointProps'; items: PropExpr[] }
  | { t: 'disjointUnion'; cls: Expr; parts: Expr[] }
  | { t: 'domain' | 'range'; p: PropExpr; c: Expr }
  | { t: 'characteristic'; p: PropExpr; c: Characteristic }
  | { t: 'chain'; chain: PropExpr[]; sup: PropExpr }
  | { t: 'key'; c: Expr; props: PropExpr[] }
  | { t: 'type'; i: Expr; c: Expr }
  | { t: 'assert'; p: PropExpr; s: Expr; o: Expr; negative?: boolean };

/** One axiom placed in a group of the detail view. `focus` = the node it is shown for. */
export interface NodeAxiom {
  group: string;
  axiom: Axiom;
  /** True when the axiom belongs to another entity (shown as a full sentence). */
  incoming: boolean;
  line?: number;
}

// ── Building ASTs from the model ────────────────────────────────────────────
const CHARACTERISTICS: Record<string, Characteristic> = {
  [OWL.FunctionalProperty]: 'Functional',
  [OWL.InverseFunctionalProperty]: 'InverseFunctional',
  [OWL.TransitiveProperty]: 'Transitive',
  [OWL.SymmetricProperty]: 'Symmetric',
  [OWL.AsymmetricProperty]: 'Asymmetric',
  [OWL.ReflexiveProperty]: 'Reflexive',
  [OWL.IrreflexiveProperty]: 'Irreflexive',
};
const DECLARATIONS = new Set<string>([OWL.Class, RDFS.Class, OWL.ObjectProperty, OWL.DatatypeProperty, OWL.AnnotationProperty, OWL.NamedIndividual, RDFS.Datatype, OWL.Ontology]);
const CARD: Array<[string, 'min' | 'max' | 'exactly']> = [
  [OWL.cardinality, 'exactly'],
  [OWL.qualifiedCardinality, 'exactly'],
  [OWL.minCardinality, 'min'],
  [OWL.minQualifiedCardinality, 'min'],
  [OWL.maxCardinality, 'max'],
  [OWL.maxQualifiedCardinality, 'max'],
];
const FACET_OP: Record<string, string> = { [XSD.minInclusive]: '≥', [XSD.maxInclusive]: '≤', [XSD.minExclusive]: '>', [XSD.maxExclusive]: '<' };

export function toExpr(model: OntologyModel, value: NodeValue, seen = new Set<string>()): Expr {
  switch (value.type) {
    case 'iri':
      if (value.iri === OWL.Thing) return { t: 'top' };
      if (value.iri === OWL.Nothing) return { t: 'bottom' };
      return { t: 'named', iri: value.iri };
    case 'literal':
      return { t: 'literal', value: value.value, language: value.language, datatype: value.datatype };
    case 'list':
      return { t: 'oneOf', items: value.items.map((v) => toExpr(model, v, seen)) };
    case 'expression': {
      if (seen.has(value.id)) return { t: 'anon', text: '…' };
      const next = new Set(seen).add(value.id);
      const st = model.blankNodes[value.id] ?? [];
      const get = (p: string) => st.find((s) => s.predicate === p)?.value;
      const items = (p: string) => {
        const v = get(p);
        return v?.type === 'list' ? v.items.map((i) => toExpr(model, i, next)) : v ? [toExpr(model, v, next)] : [];
      };
      const onProperty = get(OWL.onProperty);
      if (onProperty) {
        const p = toProp(model, onProperty, next);
        const filler = get(OWL.onClass) ?? get(OWL.onDataRange);
        const card = CARD.find(([pred]) => get(pred));
        if (get(OWL.someValuesFrom)) return { t: 'some', p, f: toExpr(model, get(OWL.someValuesFrom)!, next) };
        if (get(OWL.allValuesFrom)) return { t: 'only', p, f: toExpr(model, get(OWL.allValuesFrom)!, next) };
        if (get(OWL.hasValue)) return { t: 'value', p, v: toExpr(model, get(OWL.hasValue)!, next) };
        if (get(OWL.hasSelf)) return { t: 'self', p };
        if (card) {
          const n = get(card[0]);
          return { t: 'card', op: card[1], n: n?.type === 'literal' ? n.value : '?', p, f: filler ? toExpr(model, filler, next) : undefined };
        }
      }
      if (get(OWL.unionOf)) return { t: 'or', ops: items(OWL.unionOf) };
      if (get(OWL.intersectionOf)) return { t: 'and', ops: items(OWL.intersectionOf) };
      const complement = get(OWL.complementOf) ?? get(OWL.datatypeComplementOf);
      if (complement) return { t: 'not', op: toExpr(model, complement, next) };
      if (get(OWL.oneOf)) return { t: 'oneOf', items: items(OWL.oneOf) };
      const base = get(OWL.onDatatype);
      if (base) {
        const restrictions = get(OWL.withRestrictions);
        const facets =
          restrictions?.type === 'list'
            ? restrictions.items.flatMap((f) =>
                f.type === 'expression'
                  ? (model.blankNodes[f.id] ?? []).map((s) => ({ op: FACET_OP[s.predicate] ?? compactIri(s.predicate, model.prefixes), value: toExpr(model, s.value, next) }))
                  : [],
              )
            : [];
        return { t: 'facets', base: toExpr(model, base, next), facets };
      }
      return { t: 'anon', text: model.expressions[value.id]?.text ?? '[ ]' };
    }
  }
}

export function toProp(model: OntologyModel, value: NodeValue, seen = new Set<string>()): PropExpr {
  if (value.type === 'iri') return { t: 'prop', iri: value.iri };
  if (value.type === 'expression' && !seen.has(value.id)) {
    const inverse = (model.blankNodes[value.id] ?? []).find((s) => s.predicate === OWL.inverseOf);
    if (inverse) return { t: 'inv', of: toProp(model, inverse.value, new Set(seen).add(value.id)) };
  }
  return { t: 'prop', iri: '?' };
}

/** Does a value (deeply) mention this IRI or expression id? */
function mentions(model: OntologyModel, value: NodeValue, id: string, seen = new Set<string>()): boolean {
  if (value.type === 'iri') return value.iri === id;
  if (value.type === 'list') return value.items.some((v) => mentions(model, v, id, seen));
  if (value.type !== 'expression') return false;
  if (value.id === id) return true;
  if (seen.has(value.id)) return false;
  seen.add(value.id);
  return (model.blankNodes[value.id] ?? []).some((s) => s.predicate === id || mentions(model, s.value, id, seen));
}

const isProperty = (model: OntologyModel, iri: string) =>
  model.entities[iri]?.kinds.some((k) => k === 'objectProperty' || k === 'datatypeProperty') ?? false;

/** The axiom a statement of `subject` expresses, with the group it belongs to (own view). */
function axiomOf(model: OntologyModel, subject: string, s: NodeStatement): { group: string; axiom: Axiom } | null {
  const S: Expr = { t: 'named', iri: subject };
  const P: PropExpr = { t: 'prop', iri: subject };
  const x = () => toExpr(model, s.value);
  const px = () => toProp(model, s.value);
  const list = () => (s.value.type === 'list' ? s.value.items : [s.value]);

  switch (s.predicate) {
    case RDFS.subClassOf:
      return { group: 'Sub class of', axiom: { t: 'sub', lhs: S, rhs: x() } };
    case OWL.equivalentClass:
      return { group: 'Equivalent to', axiom: { t: 'equiv', lhs: S, rhs: x() } };
    case OWL.disjointWith:
      return { group: 'Disjoint with', axiom: { t: 'disjoint', items: [S, x()] } };
    case OWL.disjointUnionOf:
      return { group: 'Disjoint union of', axiom: { t: 'disjointUnion', cls: S, parts: list().map((v) => toExpr(model, v)) } };
    case OWL.hasKey:
      return { group: 'Keys', axiom: { t: 'key', c: S, props: list().map((v) => toProp(model, v)) } };
    case RDFS.subPropertyOf:
      return { group: 'Sub property of', axiom: { t: 'subProp', lhs: P, rhs: px() } };
    case OWL.equivalentProperty:
      return { group: 'Equivalent to', axiom: { t: 'equivProp', lhs: P, rhs: px() } };
    case OWL.propertyDisjointWith:
      return { group: 'Disjoint with', axiom: { t: 'disjointProps', items: [P, px()] } };
    case OWL.inverseOf:
      return { group: 'Inverse of', axiom: { t: 'inverse', lhs: P, rhs: px() } };
    case RDFS.domain:
      return { group: 'Domain', axiom: { t: 'domain', p: P, c: x() } };
    case RDFS.range:
      return { group: 'Range', axiom: { t: 'range', p: P, c: x() } };
    case OWL.propertyChainAxiom:
      return { group: 'Property chain', axiom: { t: 'chain', chain: list().map((v) => toProp(model, v)), sup: P } };
    case OWL.sameAs:
      return { group: 'Same as', axiom: { t: 'same', items: [S, x()] } };
    case OWL.differentFrom:
      return { group: 'Different from', axiom: { t: 'different', items: [S, x()] } };
    case RDF.type: {
      if (s.value.type === 'iri') {
        const c = CHARACTERISTICS[s.value.iri];
        if (c) return { group: 'Characteristics', axiom: { t: 'characteristic', p: P, c } };
        if (DECLARATIONS.has(s.value.iri) || s.value.iri.startsWith('http://www.w3.org/2002/07/owl#')) return null;
      }
      return { group: 'Types', axiom: { t: 'type', i: S, c: x() } };
    }
    default:
      if (isProperty(model, s.predicate)) return { group: 'Property assertions', axiom: { t: 'assert', p: { t: 'prop', iri: s.predicate }, s: S, o: x() } };
      return null;
  }
}

/** Groups for statements of other entities that point at the node. */
const INCOMING_GROUP: Record<string, string> = {
  [RDFS.subClassOf]: 'Super class of',
  [RDFS.subPropertyOf]: 'Super property of',
  [RDF.type]: 'Instances',
  [RDFS.domain]: 'Domain of',
  [RDFS.range]: 'Range of',
  [OWL.equivalentClass]: 'Equivalent to',
  [OWL.equivalentProperty]: 'Equivalent to',
  [OWL.disjointWith]: 'Disjoint with',
  [OWL.propertyDisjointWith]: 'Disjoint with',
  [OWL.inverseOf]: 'Inverse of',
  [OWL.sameAs]: 'Same as',
  [OWL.differentFrom]: 'Different from',
};

/** Most incoming items listed per group (the rest is summarised). */
export const INCOMING_LIMIT = 50;

/** Every axiom the detail view shows for a node (entity, expression or standalone axiom). */
export function axiomsFor(model: OntologyModel, id: string): NodeAxiom[] {
  const out: NodeAxiom[] = [];

  // A standalone axiom (AllDisjointClasses, GCI, …) or an anonymous expression
  const standalone = standaloneAxiom(model, id);
  if (standalone) return [{ group: 'Axiom', axiom: standalone, incoming: true, line: model.axioms[id]?.location.start }];
  const expression = model.expressions[id];
  if (expression) {
    for (const owner of expression.owners) {
      for (const s of model.entities[owner]?.statements ?? []) {
        if (!mentions(model, s.value, id)) continue;
        const a = axiomOf(model, owner, s);
        if (a) out.push({ group: 'Used in', axiom: a.axiom, incoming: true, line: s.line });
      }
      const ax = standaloneAxiom(model, owner);
      if (ax) out.push({ group: 'Used in', axiom: ax, incoming: true, line: model.axioms[owner]?.location.start });
    }
    return out;
  }

  const entity = model.entities[id];
  if (!entity) return out;

  // Own statements
  for (const s of entity.statements) {
    const a = axiomOf(model, id, s);
    if (a) out.push({ ...a, incoming: false, line: s.line });
  }

  // Statements of other entities that point here
  const counts = new Map<string, number>();
  const push = (item: NodeAxiom) => {
    const n = (counts.get(item.group) ?? 0) + 1;
    counts.set(item.group, n);
    if (n <= INCOMING_LIMIT) out.push(item);
  };
  for (const other of Object.values(model.entities)) {
    if (other.iri === id) continue;
    for (const s of other.statements) {
      const direct = s.value.type === 'iri' && s.value.iri === id;
      const asPredicate = s.predicate === id;
      const deep = !direct && !asPredicate && mentions(model, s.value, id);
      if (!direct && !asPredicate && !deep) continue;
      const a = axiomOf(model, other.iri, s);
      if (!a) continue;
      const group = asPredicate ? 'Used in assertions' : direct ? (INCOMING_GROUP[s.predicate] ?? (isProperty(model, s.predicate) ? 'Referenced by' : 'Used in')) : 'Used in';
      push({ group, axiom: a.axiom, incoming: true, line: s.line });
    }
  }
  // Standalone axioms that mention it
  for (const ax of Object.values(model.axioms)) {
    if (ax.kind === 'AnnotatedAxiom') continue;
    if (!ax.members.includes(id) && !ax.statements.some((s) => mentions(model, s.value, id))) continue;
    const a = standaloneAxiom(model, ax.id);
    if (a) push({ group: 'Axioms', axiom: a, incoming: true, line: ax.location.start });
  }
  for (const [group, n] of counts) if (n > INCOMING_LIMIT) out.push({ group, axiom: { t: 'same', items: [{ t: 'anon', text: `… and ${n - INCOMING_LIMIT} more` }] }, incoming: true });
  return out;
}

/** AST of a standalone axiom (by axiom id), or null. */
function standaloneAxiom(model: OntologyModel, id: string): Axiom | null {
  const ax = model.axioms[id];
  if (!ax) return null;
  const get = (p: string) => ax.statements.find((s) => s.predicate === p)?.value;
  const members = (...ps: string[]) => ps.flatMap((p) => {
    const v = get(p);
    return v?.type === 'list' ? v.items : [];
  });
  switch (ax.kind) {
    case 'AllDisjointClasses':
      return { t: 'disjoint', items: members(OWL.members).map((v) => toExpr(model, v)) };
    case 'AllDifferent':
      return { t: 'different', items: members(OWL.members, OWL.distinctMembers).map((v) => toExpr(model, v)) };
    case 'AllDisjointProperties':
      return { t: 'disjointProps', items: members(OWL.members).map((v) => toProp(model, v)) };
    case 'NegativePropertyAssertion': {
      const source = get(OWL.sourceIndividual);
      const property = get(OWL.assertionProperty);
      const target = get(OWL.targetIndividual) ?? get(OWL.targetValue);
      if (!source || !property || !target) return null;
      return { t: 'assert', p: toProp(model, property), s: toExpr(model, source), o: toExpr(model, target), negative: true };
    }
    case 'GeneralClassInclusion': {
      const lhs = toExpr(model, { type: 'expression', id });
      const link = ax.statements.find((s) => s.predicate === RDFS.subClassOf || s.predicate === OWL.equivalentClass || s.predicate === OWL.disjointWith);
      if (!link) return null;
      const rhs = toExpr(model, link.value);
      if (link.predicate === OWL.disjointWith) return { t: 'disjoint', items: [lhs, rhs] };
      return { t: link.predicate === OWL.equivalentClass ? 'equiv' : 'sub', lhs, rhs };
    }
    default:
      return null;
  }
}

// ── Rendering ───────────────────────────────────────────────────────────────
/** A piece of rendered text; `iri` makes it a link to that node. */
export interface Token {
  text: string;
  iri?: string;
}
export type Notation = 'manchester' | 'dl';

class Renderer {
  private readonly out: Token[] = [];
  constructor(
    private readonly model: OntologyModel,
    private readonly notation: Notation,
  ) {}

  private t(text: string) {
    this.out.push({ text });
  }

  private name(iri: string) {
    const label =
      this.notation === 'dl'
        ? compactIri(iri, this.model.prefixes).replace(/^:/, '')
        : (this.model.entities[iri]?.label ?? compactIri(iri, this.model.prefixes));
    this.out.push({ text: label, iri: this.model.entities[iri] ? iri : undefined });
  }

  prop(p: PropExpr) {
    if (p.t === 'prop') return this.name(p.iri);
    if (this.notation === 'dl') {
      this.prop(p.of);
      this.t('⁻');
    } else {
      this.t('inverse (');
      this.prop(p.of);
      this.t(')');
    }
  }

  private compound(e: Expr) {
    return e.t === 'and' || e.t === 'or' || e.t === 'not' || e.t === 'some' || e.t === 'only' || e.t === 'value' || e.t === 'card' || e.t === 'self';
  }

  expr(e: Expr, nested = false) {
    const dl = this.notation === 'dl';
    const wrap = nested && this.compound(e) && !(dl && (e.t === 'not' || e.t === 'some' || e.t === 'only' || e.t === 'self' || e.t === 'value'));
    if (wrap) this.t('(');
    switch (e.t) {
      case 'named':
        this.name(e.iri);
        break;
      case 'top':
        this.t(dl ? '⊤' : 'Thing');
        break;
      case 'bottom':
        this.t(dl ? '⊥' : 'Nothing');
        break;
      case 'literal':
        this.t(e.datatype && /#(integer|decimal|double|boolean|nonNegativeInteger)$/.test(e.datatype) ? e.value : `"${e.value}"${e.language ? `@${e.language}` : ''}`);
        break;
      case 'anon':
        this.t(e.text);
        break;
      case 'some':
      case 'only':
        if (dl) {
          this.t(e.t === 'some' ? '∃' : '∀');
          this.prop(e.p);
          this.t('.');
          this.expr(e.f, true);
        } else {
          this.prop(e.p);
          this.t(e.t === 'some' ? ' some ' : ' only ');
          this.expr(e.f, true);
        }
        break;
      case 'value':
        if (dl) {
          this.t('∃');
          this.prop(e.p);
          this.t('.{');
          this.expr(e.v);
          this.t('}');
        } else {
          this.prop(e.p);
          this.t(' value ');
          this.expr(e.v);
        }
        break;
      case 'self':
        if (dl) {
          this.t('∃');
          this.prop(e.p);
          this.t('.Self');
        } else {
          this.prop(e.p);
          this.t(' Self');
        }
        break;
      case 'card':
        if (dl) {
          this.t(`${{ min: '≥', max: '≤', exactly: '=' }[e.op]}${e.n} `);
          this.prop(e.p);
          if (e.f) {
            this.t('.');
            this.expr(e.f, true);
          }
        } else {
          this.prop(e.p);
          this.t(` ${e.op} ${e.n}`);
          if (e.f) {
            this.t(' ');
            this.expr(e.f, true);
          }
        }
        break;
      case 'and':
      case 'or':
        e.ops.forEach((op, i) => {
          if (i) this.t(dl ? (e.t === 'and' ? ' ⊓ ' : ' ⊔ ') : ` ${e.t} `);
          this.expr(op, true);
        });
        break;
      case 'not':
        this.t(dl ? '¬' : 'not ');
        this.expr(e.op, true);
        break;
      case 'oneOf':
        this.t('{');
        e.items.forEach((item, i) => {
          if (i) this.t(', ');
          this.expr(item);
        });
        this.t('}');
        break;
      case 'facets':
        this.expr(e.base);
        this.t('[');
        e.facets.forEach((f, i) => {
          if (i) this.t(', ');
          this.t(`${f.op} `);
          this.expr(f.value);
        });
        this.t(']');
        break;
    }
    if (wrap) this.t(')');
  }

  private join<T>(items: T[], sep: string, each: (item: T) => void) {
    items.forEach((item, i) => {
      if (i) this.t(sep);
      each(item);
    });
  }

  /** Full axiom. */
  axiom(a: Axiom) {
    const dl = this.notation === 'dl';
    switch (a.t) {
      case 'sub':
      case 'equiv':
        // Axiom level: no brackets around either side.
        this.expr(a.lhs);
        this.t(dl ? (a.t === 'sub' ? ' ⊑ ' : ' ≡ ') : a.t === 'sub' ? ' SubClassOf ' : ' EquivalentTo ');
        this.expr(a.rhs);
        break;
      case 'subProp':
      case 'equivProp':
        this.prop(a.lhs);
        this.t(dl ? (a.t === 'subProp' ? ' ⊑ ' : ' ≡ ') : a.t === 'subProp' ? ' SubPropertyOf ' : ' EquivalentTo ');
        this.prop(a.rhs);
        break;
      case 'inverse':
        this.prop(a.lhs);
        if (dl) {
          this.t(' ≡ ');
          this.prop(a.rhs);
          this.t('⁻');
        } else {
          this.t(' InverseOf ');
          this.prop(a.rhs);
        }
        break;
      case 'disjoint':
        if (dl && a.items.length === 2) {
          this.join(a.items, ' ⊓ ', (e) => this.expr(e, true));
          this.t(' ⊑ ⊥');
        } else {
          this.t(dl ? 'Disjoint(' : 'DisjointClasses: ');
          this.join(a.items, ', ', (e) => this.expr(e));
          if (dl) this.t(')');
        }
        break;
      case 'disjointProps':
        this.t(dl ? 'Dis(' : 'DisjointProperties: ');
        this.join(a.items, ', ', (p) => this.prop(p));
        if (dl) this.t(')');
        break;
      case 'same':
      case 'different':
        if (dl) this.join(a.items, a.t === 'same' ? ' = ' : ' ≠ ', (e) => this.expr(e));
        else {
          this.t(a.t === 'same' ? 'SameIndividual: ' : 'DifferentIndividuals: ');
          this.join(a.items, ', ', (e) => this.expr(e));
        }
        break;
      case 'disjointUnion':
        this.expr(a.cls);
        this.t(dl ? ' ≡ ' : ' DisjointUnionOf ');
        this.join(a.parts, dl ? ' ⊔ ' : ', ', (e) => this.expr(e, true));
        if (dl) this.t('   (pairwise disjoint)');
        break;
      case 'domain':
        if (dl) {
          this.t('∃');
          this.prop(a.p);
          this.t('.⊤ ⊑ ');
          this.expr(a.c);
        } else {
          this.prop(a.p);
          this.t(' Domain ');
          this.expr(a.c);
        }
        break;
      case 'range':
        if (dl) {
          this.t('⊤ ⊑ ∀');
          this.prop(a.p);
          this.t('.');
          this.expr(a.c, true);
        } else {
          this.prop(a.p);
          this.t(' Range ');
          this.expr(a.c);
        }
        break;
      case 'characteristic':
        if (!dl) {
          this.t(`${a.c}: `);
          this.prop(a.p);
        } else if (a.c === 'Functional' || a.c === 'InverseFunctional') {
          this.t('⊤ ⊑ ≤1 ');
          this.prop(a.c === 'Functional' ? a.p : { t: 'inv', of: a.p });
        } else if (a.c === 'Transitive') {
          this.prop(a.p);
          this.t(' ∘ ');
          this.prop(a.p);
          this.t(' ⊑ ');
          this.prop(a.p);
        } else if (a.c === 'Symmetric') {
          this.prop(a.p);
          this.t(' ≡ ');
          this.prop({ t: 'inv', of: a.p });
        } else {
          this.t(`${{ Asymmetric: 'Asy', Reflexive: 'Ref', Irreflexive: 'Irr' }[a.c]}(`);
          this.prop(a.p);
          this.t(')');
        }
        break;
      case 'chain':
        this.join(a.chain, dl ? ' ∘ ' : ' o ', (p) => this.prop(p));
        this.t(dl ? ' ⊑ ' : ' SubPropertyOf ');
        this.prop(a.sup);
        break;
      case 'key':
        this.t('HasKey(');
        this.expr(a.c);
        this.t(', ');
        this.join(a.props, ', ', (p) => this.prop(p));
        this.t(')');
        break;
      case 'type':
        if (dl) {
          this.expr(a.c, true);
          this.t('(');
          this.expr(a.i);
          this.t(')');
        } else {
          this.expr(a.i);
          this.t(' Type ');
          this.expr(a.c);
        }
        break;
      case 'assert':
        if (dl) {
          if (a.negative) this.t('¬');
          this.prop(a.p);
          this.t('(');
          this.expr(a.s);
          this.t(', ');
          this.expr(a.o);
          this.t(')');
        } else {
          if (a.negative) this.t('not (');
          this.expr(a.s);
          this.t(' ');
          this.prop(a.p);
          this.t(' ');
          this.expr(a.o);
          if (a.negative) this.t(')');
        }
        break;
    }
    return this.out;
  }

  /** Only the part after the node itself (Manchester, for the node's own axioms). */
  focus(a: Axiom) {
    switch (a.t) {
      case 'sub':
      case 'equiv':
        this.expr(a.rhs);
        break;
      case 'subProp':
      case 'equivProp':
      case 'inverse':
        this.prop(a.rhs);
        break;
      case 'disjoint':
      case 'same':
      case 'different':
        this.join(a.items.slice(1), ', ', (e) => this.expr(e));
        break;
      case 'disjointProps':
        this.join(a.items.slice(1), ', ', (p) => this.prop(p));
        break;
      case 'disjointUnion':
        this.join(a.parts, ', ', (e) => this.expr(e));
        break;
      case 'domain':
      case 'range':
        this.expr(a.c);
        break;
      case 'characteristic':
        this.t(a.c);
        break;
      case 'chain':
        this.join(a.chain, ' o ', (p) => this.prop(p));
        break;
      case 'key':
        this.join(a.props, ', ', (p) => this.prop(p));
        break;
      case 'type':
        this.expr(a.c);
        break;
      case 'assert':
        this.prop(a.p);
        this.t(' ');
        this.expr(a.o);
        break;
    }
    return this.out;
  }
}

/** Tokens for one axiom: DL always as a full axiom; Manchester as a full sentence or, for own axioms, the other side only. */
export function renderAxiom(model: OntologyModel, item: NodeAxiom, notation: Notation): Token[] {
  const r = new Renderer(model, notation);
  return notation === 'manchester' && !item.incoming ? r.focus(item.axiom) : r.axiom(item.axiom);
}
