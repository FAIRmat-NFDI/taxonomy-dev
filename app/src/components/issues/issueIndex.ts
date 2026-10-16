import type { CommentThread, LineSpan, LoadedSource, OntologyModel } from '@/api';

/**
 * Issues → nodes (the reverse of `issueReference`): each issue's anchor is resolved against the
 * materialized model of the file version on screen.
 *
 *  1. by id — the anchored entity IRI / axiom / expression still exists in the model;
 *  2. by line — the id is gone (renamed, or an unstable blank-node id) but the issue was written
 *     against this very commit, so its line still points at the same statement block.
 *
 * Issues about other files, or whose node no longer exists in another version, are left out.
 */
export function indexIssues(threads: CommentThread[], model: OntologyModel, source: LoadedSource): Map<string, CommentThread[]> {
  const index = new Map<string, CommentThread[]>();
  for (const thread of threads) {
    const anchor = thread.anchor;
    if (!anchor || anchor.filePath !== source.path) continue;
    let nodeId = anchor.entityIri && hasNode(model, anchor.entityIri) ? anchor.entityIri : null;
    if (!nodeId && anchor.lineStart && source.commit && anchor.ref === source.commit) nodeId = nodeAtLine(model, anchor.lineStart);
    if (!nodeId) continue;
    const list = index.get(nodeId);
    if (list) list.push(thread);
    else index.set(nodeId, [thread]);
  }
  return index;
}

function hasNode(model: OntologyModel, id: string): boolean {
  return model.header?.iri === id || id in model.entities || id in model.axioms || id in model.expressions;
}

const contains = (span: LineSpan, line: number) => span.start <= line && line <= span.end;
const size = (span: LineSpan) => span.end - span.start;

/** The node whose statement block contains `line` — a named entity first, else the smallest axiom / expression. */
export function nodeAtLine(model: OntologyModel, line: number): string | null {
  for (const entity of Object.values(model.entities)) {
    if (entity.locations.some((span) => span.start === line)) return entity.iri;
  }
  let best: { id: string; span: LineSpan } | null = null;
  for (const node of [...Object.values(model.axioms), ...Object.values(model.expressions)]) {
    if (contains(node.location, line) && (!best || size(node.location) < size(best.span))) best = { id: node.id, span: node.location };
  }
  if (best) return best.id;
  for (const entity of Object.values(model.entities)) {
    if (entity.locations.some((span) => contains(span, line))) return entity.iri;
  }
  if (model.header?.location && contains(model.header.location, line)) return model.header.iri;
  return null;
}

/** The issue text without the "> **Reference:** …" line the form puts first (the panel already shows the node). */
export function stripReference(body: string): string {
  return body.replace(/^> \*\*Reference:\*\*[^\n]*\n*/, '').trim();
}
