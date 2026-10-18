import type { EntityKind, OntologyModel } from '@/api';

export interface EntityChip {
  /** Entity IRI. */
  id: string;
  label: string;
  curie: string;
}

export interface EntityGroups {
  classes: EntityChip[];
  objectProperties: EntityChip[];
  dataProperties: EntityChip[];
}

const byLabel = (a: EntityChip, b: EntityChip) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }) || a.id.localeCompare(b.id);

/**
 * Entities declared in the file, by kind, sorted by label — the same set /doc counts.
 * Punned entities appear in each of their kinds.
 */
export function entityGroups(model: OntologyModel): EntityGroups {
  const pick = (kind: EntityKind) =>
    Object.values(model.entities)
      .filter((e) => e.declared && e.kinds.includes(kind))
      .map((e) => ({ id: e.iri, label: e.label, curie: e.curie }))
      .sort(byLabel);
  return { classes: pick('class'), objectProperties: pick('objectProperty'), dataProperties: pick('datatypeProperty') };
}

/** Case-insensitive match on label, CURIE or IRI; an empty query keeps everything. */
export function filterGroups(groups: EntityGroups, query: string): EntityGroups {
  const q = query.trim().toLowerCase();
  if (!q) return groups;
  const hit = (c: EntityChip) => c.label.toLowerCase().includes(q) || c.curie.toLowerCase().includes(q) || c.id.toLowerCase().includes(q);
  return { classes: groups.classes.filter(hit), objectProperties: groups.objectProperties.filter(hit), dataProperties: groups.dataProperties.filter(hit) };
}

export const groupSize = (g: EntityGroups) => g.classes.length + g.objectProperties.length + g.dataProperties.length;
