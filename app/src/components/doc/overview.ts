import { compactIri, type AxiomKind, type EntityKind, type ExpressionKind, type HierarchyKind, type OntologyModel } from '@/api';

/**
 * View model of the Overview tree (pure; built from the materialized model).
 *
 *  Metadata             ontology header, namespaces, imports
 *  <root classes>       class hierarchy, one top-level item per root (cycles marked, not repeated)
 *  Individuals
 *  Axioms               by kind (disjointness, GCIs, negative assertions, …)
 *  Properties           object / data / annotation property hierarchies
 *  Datatypes
 *  Expressions          anonymous class expressions, by kind
 *
 * A class with several parents appears under each of them (WebProtégé style), so item
 * ids are paths; `target` is the node id that goes into the URL (`?node=`).
 */
export type OverviewKind = 'group' | 'ontology' | 'namespace' | 'import' | EntityKind | 'expression' | 'axiom' | 'more';

export interface OverviewItem {
  id: string;
  label: string;
  kind: OverviewKind;
  /** Selectable node: entity IRI, expression id, or axiom id. */
  target?: string;
  /** Number of leaves below a group. */
  count?: number;
  /** cycle: this class is its own ancestor here (children not repeated). */
  flags?: Array<'cycle' | 'external' | 'deprecated'>;
  children?: OverviewItem[];
}

export interface Overview {
  items: OverviewItem[];
  /** First tree item showing each target, with its ancestors (for reveal + selection). */
  locate: Map<string, { itemId: string; ancestors: string[] }>;
  /** Tree item id → selectable target. */
  targetOf: Map<string, string>;
  defaultExpanded: string[];
}

/** Upper bound on tree items (multiple inheritance can multiply paths). */
const MAX_ITEMS = 20_000;

const AXIOM_GROUPS: Array<[AxiomKind, string]> = [
  ['AllDisjointClasses', 'Disjoint classes'],
  ['GeneralClassInclusion', 'General class axioms'],
  ['AllDisjointProperties', 'Disjoint properties'],
  ['AllDifferent', 'Different individuals'],
  ['NegativePropertyAssertion', 'Negative assertions'],
  ['AnnotatedAxiom', 'Annotated axioms'],
];

const EXPRESSION_GROUPS: Array<[ExpressionKind, string]> = [
  ['restriction', 'Restrictions'],
  ['intersection', 'Intersections'],
  ['union', 'Unions'],
  ['complement', 'Complements'],
  ['oneOf', 'Enumerations'],
  ['dataRange', 'Data ranges'],
  ['inverse', 'Inverse properties'],
  ['anonymousIndividual', 'Anonymous individuals'],
  ['other', 'Other'],
];

const PROPERTY_GROUPS: Array<[HierarchyKind, string]> = [
  ['objectProperty', 'Object properties'],
  ['datatypeProperty', 'Data properties'],
  ['annotationProperty', 'Annotation properties'],
];

const byLabel = (a: { label: string }, b: { label: string }) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' });

export function buildOverview(model: OntologyModel): Overview {
  let budget = MAX_ITEMS;
  const entity = (iri: string) => model.entities[iri]!;

  const flagsOf = (iri: string): OverviewItem['flags'] => {
    const e = entity(iri);
    const flags: NonNullable<OverviewItem['flags']> = [];
    if (!e.declared) flags.push('external');
    if (e.deprecated) flags.push('deprecated');
    return flags.length ? flags : undefined;
  };

  /** Hierarchy below `iris`; `path` holds the ancestors on this branch (cycle guard). */
  function hierarchy(iris: string[], kind: HierarchyKind, parentId: string, path: Set<string>): OverviewItem[] {
    const items: OverviewItem[] = [];
    for (const iri of iris) {
      if (budget-- <= 0) {
        items.push({ id: `${parentId}>…`, label: 'Too many items to show', kind: 'more' });
        break;
      }
      const e = entity(iri);
      const id = `${parentId}>${iri}`;
      if (path.has(iri)) {
        items.push({ id, label: e.label, kind, target: iri, flags: ['cycle'] });
        continue;
      }
      const childIris = e.children.filter((c) => model.entities[c]?.kinds.includes(kind));
      path.add(iri);
      const children = hierarchy(childIris, kind, id, path);
      path.delete(iri);
      items.push({ id, label: e.label, kind, target: iri, flags: flagsOf(iri), children: children.length ? children : undefined });
    }
    return items;
  }

  const group = (id: string, label: string, children: OverviewItem[]): OverviewItem => ({
    id,
    label,
    kind: 'group',
    count: countLeaves(children),
    children,
  });

  // Metadata
  const metadata: OverviewItem[] = [];
  if (model.header) metadata.push({ id: 'meta>ontology', label: model.header.label, kind: 'ontology', target: model.header.iri });
  const prefixes = Object.entries(model.prefixes).sort(([a], [b]) => a.localeCompare(b));
  if (prefixes.length) {
    metadata.push(
      group(
        'meta>namespaces',
        'Namespaces',
        prefixes.map(([prefix, iri]) => ({ id: `meta>ns>${prefix}`, label: `${prefix || '(default)'}: ${iri}`, kind: 'namespace' })),
      ),
    );
  }
  if (model.header?.imports.length) {
    metadata.push(
      group(
        'meta>imports',
        'Imports',
        model.header.imports.map((iri) => ({ id: `meta>import>${iri}`, label: compactIri(iri, model.prefixes), kind: 'import' })),
      ),
    );
  }

  const top: OverviewItem[] = [];
  if (metadata.length) top.push(group('metadata', 'Metadata', metadata));

  // Class hierarchy roots, directly at the top level
  const classRoots = hierarchy(model.roots.class, 'class', 'classes', new Set());
  top.push(...classRoots);

  // Individuals
  const individuals = Object.values(model.entities)
    .filter((e) => e.kinds.includes('individual'))
    .map((e) => ({ id: `individuals>${e.iri}`, label: e.label, kind: 'individual' as const, target: e.iri, flags: flagsOf(e.iri) }))
    .sort(byLabel);
  if (individuals.length) top.push(group('individuals', 'Individuals', individuals));

  // Axioms
  const axiomGroups = AXIOM_GROUPS.map(([kind, label]) => {
    const items = Object.values(model.axioms)
      .filter((a) => a.kind === kind)
      .map((a) => ({ id: `axioms>${a.id}`, label: a.text, kind: 'axiom' as const, target: a.id }));
    return items.length ? group(`axioms>${kind}`, label, items) : null;
  }).filter((g): g is OverviewItem => !!g);
  if (axiomGroups.length) top.push(group('axioms', 'Axioms', axiomGroups));

  // Properties
  const propertyGroups = PROPERTY_GROUPS.map(([kind, label]) => {
    const items = hierarchy(model.roots[kind], kind, `properties>${kind}`, new Set());
    return items.length ? group(`properties>${kind}`, label, items) : null;
  }).filter((g): g is OverviewItem => !!g);
  if (propertyGroups.length) top.push(group('properties', 'Properties', propertyGroups));

  // Datatypes
  const datatypes = Object.values(model.entities)
    .filter((e) => e.kinds.includes('datatype'))
    .map((e) => ({ id: `datatypes>${e.iri}`, label: e.label, kind: 'datatype' as const, target: e.iri, flags: flagsOf(e.iri) }))
    .sort(byLabel);
  if (datatypes.length) top.push(group('datatypes', 'Datatypes', datatypes));

  // Expressions (top-level only; nested ones are part of their parent's text)
  const expressionGroups = EXPRESSION_GROUPS.map(([kind, label]) => {
    const items = Object.values(model.expressions)
      .filter((x) => x.kind === kind && !x.nested)
      .map((x) => ({ id: `expressions>${x.id}`, label: x.text, kind: 'expression' as const, target: x.id }))
      .sort(byLabel);
    return items.length ? group(`expressions>${kind}`, label, items) : null;
  }).filter((g): g is OverviewItem => !!g);
  if (expressionGroups.length) top.push(group('expressions', 'Expressions', expressionGroups));

  // Index: first occurrence of every target (depth-first, top to bottom)
  const locate: Overview['locate'] = new Map();
  const targetOf: Overview['targetOf'] = new Map();
  const walk = (items: OverviewItem[], ancestors: string[]) => {
    for (const item of items) {
      if (item.target) targetOf.set(item.id, item.target);
      if (item.target && !locate.has(item.target)) locate.set(item.target, { itemId: item.id, ancestors });
      if (item.children) walk(item.children, [...ancestors, item.id]);
    }
  };
  walk(top, []);

  return { items: top, locate, targetOf, defaultExpanded: ['metadata', ...classRoots.map((i) => i.id)] };
}

function countLeaves(items: OverviewItem[]): number {
  return items.reduce((n, item) => n + (item.kind === 'group' ? (item.count ?? 0) : 1), 0);
}

/**
 * Overview filtered by a search text (label, CURIE-ish IRI tail or full IRI; case-insensitive).
 * Keeps every match (with its own subtree, collapsed) and the path to it; `expanded` opens
 * those paths. Returns null for an empty query.
 */
export interface OverviewFilter {
  items: OverviewItem[];
  expanded: string[];
  matches: number;
}

export function filterOverview(items: OverviewItem[], query: string): OverviewFilter | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  const expanded: string[] = [];
  let matches = 0;
  const hit = (item: OverviewItem) => item.label.toLowerCase().includes(q) || (item.target?.toLowerCase().includes(q) ?? false);

  const visit = (list: OverviewItem[]): OverviewItem[] =>
    list.flatMap((item) => {
      const children = item.children ? visit(item.children) : [];
      if (item.kind !== 'group' && hit(item)) {
        matches++;
        // A match keeps its whole subtree (collapsed) — unless more matches are inside it: then it
        // opens and shows just the branches leading to those.
        if (!children.length) return [item];
        expanded.push(item.id);
        return [{ ...item, children }];
      }
      if (!children.length) return item.kind === 'group' && hit(item) ? [item] : [];
      expanded.push(item.id);
      return [{ ...item, children, count: item.kind === 'group' ? countLeaves(children) : item.count }];
    });

  return { items: visit(items), expanded, matches };
}
