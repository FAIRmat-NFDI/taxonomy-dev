import type { CommentAnchor, LineSpan, LoadedSource, OntologyModel } from '@/api';
import { config } from '@/config';

/**
 * What an issue is about: the selected node (or, with nothing selected, the ontology header)
 * materialized to its place in the file — lines, branch and commit — so the issue links back
 * to exactly the Turtle it discusses.
 */
export interface IssueReference {
  /** Node id (entity IRI, expression / axiom id). */
  nodeId: string;
  label: string;
  kind: string;
  /** IRI, for named nodes. */
  iri?: string;
  /** All statement blocks of the node in the file (first one is the anchor). */
  spans: LineSpan[];
  /** Commit if known (stable links), else the branch name. */
  ref: string;
  /** Hidden machine-readable anchor stored with the issue. */
  anchor: CommentAnchor;
  /** Markdown line placed at the top of the description. */
  markdown: string;
}

const KIND_LABEL: Record<string, string> = {
  class: 'Class',
  objectProperty: 'Object property',
  datatypeProperty: 'Data property',
  annotationProperty: 'Annotation property',
  individual: 'Individual',
  datatype: 'Datatype',
};

/** GitHub link to a line range of the ontology file. */
export function sourceUrl(source: LoadedSource, span: LineSpan): string {
  const lines = span.start === span.end ? `L${span.start}` : `L${span.start}-L${span.end}`;
  return `${config.githubWebUrl}/${source.owner}/${source.repo}/blob/${source.commit ?? source.branch}/${source.path}#${lines}`;
}

const linesText = (span: LineSpan) => (span.start === span.end ? `L${span.start}` : `L${span.start}–L${span.end}`);

export function issueReference(model: OntologyModel, source: LoadedSource, nodeId: string | null): IssueReference | null {
  const id = nodeId ?? model.header?.iri ?? null;
  if (!id) return null;

  let label: string;
  let kind: string;
  let iri: string | undefined;
  let spans: LineSpan[];
  const entity = model.entities[id];
  if (model.header?.iri === id) {
    label = model.header.label;
    kind = 'Ontology';
    iri = id;
    spans = model.header.location ? [model.header.location] : [];
  } else if (entity) {
    label = entity.label;
    kind = entity.kinds.map((k) => KIND_LABEL[k] ?? k).join(', ') || 'Entity';
    iri = entity.iri;
    spans = entity.locations;
  } else if (model.axioms[id]) {
    label = model.axioms[id]!.text;
    kind = 'Axiom';
    spans = [model.axioms[id]!.location];
  } else if (model.expressions[id]) {
    label = model.expressions[id]!.text;
    kind = 'Class expression';
    spans = [model.expressions[id]!.location];
  } else return null;

  const ref = source.commit ?? source.branch;
  const first = spans[0];
  // The first block is the anchor; further blocks are only counted (the reference card lists them all).
  const more = spans.length > 1 ? ` (+${spans.length - 1} more)` : '';
  const where = first ? `[\`${source.path}\` ${linesText(first)}](${sourceUrl(source, first)})${more}` : `\`${source.path}\``;
  const name = iri ? `[${label}](${iri})` : `\`${label}\``;
  const commit = source.commit ? ` @ \`${source.commit.slice(0, 7)}\`` : '';

  return {
    nodeId: id,
    label,
    kind,
    iri,
    spans,
    ref,
    anchor: { filePath: source.path, entityIri: id, lineStart: first?.start, lineEnd: first?.end, ref },
    markdown: `> **Reference:** ${kind.toLowerCase()} ${name} · ${where} · \`${source.branch}\`${commit}`,
  };
}
