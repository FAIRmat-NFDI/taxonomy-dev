import type { ReactNode } from 'react';
import type { LineSpan, LoadedSource, OntologyModel } from '@/api';
import { LineLink } from './LineLink';
import type { PropertyRow } from './PropertySection';

const KIND_LABEL: Record<string, string> = {
  class: 'Class',
  objectProperty: 'Object property',
  datatypeProperty: 'Data property',
  annotationProperty: 'Annotation property',
  individual: 'Individual',
  datatype: 'Datatype',
};

const joinNodes = (nodes: ReactNode[]) => nodes.flatMap((n, i) => (i ? [', ', n] : [n]));

export interface NodeView {
  title: string;
  sections: Array<{ title?: string; rows: PropertyRow[] }>;
}

/** Summary of whatever `?node=` points at (entity, expression, axiom, or the ontology header). */
export function describeNode(model: OntologyModel, source: LoadedSource, id: string): NodeView | null {
  const name = (iri: string) => model.entities[iri]?.label ?? model.axioms[iri]?.text ?? iri;
  const lines = (spans: LineSpan[]) => (spans.length ? joinNodes(spans.map((s) => <LineLink key={s.start} source={source} span={s} />)) : '—');

  if (model.header?.iri === id) {
    const h = model.header;
    return {
      title: h.label,
      sections: [
        {
          rows: [
            { label: 'IRI', value: h.iri },
            { label: 'Kind', value: 'Ontology' },
            { label: 'Defined at', value: lines(h.location ? [h.location] : []) },
          ],
        },
      ],
    };
  }

  const entity = model.entities[id];
  if (entity) {
    const rows: PropertyRow[] = [
      { label: 'IRI', value: entity.iri },
      { label: 'Kind', value: entity.kinds.map((k) => KIND_LABEL[k]).join(', ') + (entity.declared ? '' : ' (not declared in this file)') },
      { label: 'Defined at', value: lines(entity.locations) },
    ];
    if (entity.deprecated) rows.push({ label: 'Status', value: 'Deprecated' });
    return { title: entity.label, sections: [{ rows }] };
  }

  // A GCI's left-hand side is both an axiom and an expression; show it as the axiom.
  const axiom = model.axioms[id];
  if (axiom) {
    return {
      title: axiom.text,
      sections: [
        {
          rows: [
            { label: 'Axiom', value: axiom.text },
            { label: 'Kind', value: axiom.kind },
            { label: 'Defined at', value: lines([axiom.location]) },
            { label: 'Members', value: axiom.members.map(name).join(', ') || '—' },
          ],
        },
      ],
    };
  }
  const expression = model.expressions[id];
  if (expression) {
    return {
      title: expression.text,
      sections: [
        {
          rows: [
            { label: 'Expression', value: expression.text },
            { label: 'Kind', value: expression.kind },
            { label: 'Defined at', value: lines([expression.location]) },
            { label: 'Used by', value: expression.owners.map(name).join(', ') || '—' },
          ],
        },
      ],
    };
  }

  return null;
}

/** What /doc shows before anything is selected. */
export function describeOntology(model: OntologyModel, source: LoadedSource, readOnly: boolean): NodeView {
  const { stats } = model;
  return {
    title: model.header?.label ?? source.path,
    sections: [
      {
        rows: [
          { label: 'Source', value: `${source.owner}/${source.repo} · ${source.branch} · ${source.path}` },
          { label: 'Access', value: readOnly ? 'Public, read-only (sign in to comment)' : 'Signed in' },
          { label: 'Size', value: `${stats.lines.toLocaleString()} lines · ${stats.triples.toLocaleString()} triples` },
        ],
      },
      {
        title: 'Contents',
        rows: [
          { label: 'Classes', value: stats.entities.class },
          { label: 'Object properties', value: stats.entities.objectProperty },
          { label: 'Data properties', value: stats.entities.datatypeProperty },
          { label: 'Annotation properties', value: stats.entities.annotationProperty },
          { label: 'Individuals', value: stats.entities.individual },
          { label: 'Datatypes', value: stats.entities.datatype },
          { label: 'Class expressions', value: stats.expressions },
          { label: 'Axioms', value: stats.axioms },
          { label: 'Cycles', value: model.cycles.length },
        ],
      },
    ],
  };
}
