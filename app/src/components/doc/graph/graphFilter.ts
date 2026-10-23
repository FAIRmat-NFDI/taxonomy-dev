import { useCallback, useState } from 'react';
import type { ElementDefinition } from 'cytoscape';
import type { EdgeRelation, GraphNodeKind } from '@/api';

/** Node kinds shown when a graph first loads. */
export const DEFAULT_KINDS: readonly GraphNodeKind[] = ['class'];

export interface GraphFilter {
  /** Node kinds shown (at least one). */
  kinds: ReadonlySet<GraphNodeKind>;
  /** Link kinds hidden (empty = all links shown). */
  hiddenRelations: ReadonlySet<EdgeRelation>;
}

/**
 * Keeps nodes of the shown kinds (plus `alwaysShow`, e.g. the centre or the selected node) and the
 * links of shown kinds whose both ends are kept.
 */
export function filterElements(elements: ElementDefinition[], filter: GraphFilter, alwaysShow: Array<string | null | undefined> = []): ElementDefinition[] {
  const forced = new Set(alwaysShow.filter((id): id is string => !!id));
  const kept = new Set<string>();
  for (const el of elements) {
    if (el.group === 'nodes' && (filter.kinds.has(el.data.kind as GraphNodeKind) || forced.has(el.data.id as string))) kept.add(el.data.id as string);
  }
  return elements.filter((el) =>
    el.group === 'nodes'
      ? kept.has(el.data.id as string)
      : !filter.hiddenRelations.has(el.data.relation as EdgeRelation) && kept.has(el.data.source as string) && kept.has(el.data.target as string),
  );
}

/** Counts per node kind and link kind (for the legend chips). */
export function countKinds(elements: ElementDefinition[]) {
  const kinds = new Map<GraphNodeKind, number>();
  const relations = new Map<EdgeRelation, number>();
  let external = false;
  for (const el of elements) {
    if (el.group === 'nodes') {
      const kind = el.data.kind as GraphNodeKind;
      kinds.set(kind, (kinds.get(kind) ?? 0) + 1);
      external ||= !!el.data.external;
    } else {
      const relation = el.data.relation as EdgeRelation;
      relations.set(relation, (relations.get(relation) ?? 0) + 1);
    }
  }
  return { kinds, relations, external };
}

/**
 * Legend filter state. Node kinds start as "classes only"; all links start shown. Toggling never
 * leaves nothing selected: the last shown node kind (or link kind, among `presentRelations`) stays on.
 */
export function useGraphFilter() {
  const [kinds, setKinds] = useState<ReadonlySet<GraphNodeKind>>(() => new Set(DEFAULT_KINDS));
  const [hiddenRelations, setHiddenRelations] = useState<ReadonlySet<EdgeRelation>>(() => new Set());

  const toggleKind = useCallback((kind: GraphNodeKind) => {
    setKinds((current) => {
      const next = new Set(current);
      if (next.has(kind)) {
        if (next.size === 1) return current;
        next.delete(kind);
      } else next.add(kind);
      return next;
    });
  }, []);

  const toggleRelation = useCallback((relation: EdgeRelation, presentRelations: Iterable<EdgeRelation>) => {
    setHiddenRelations((current) => {
      const next = new Set(current);
      if (next.has(relation)) next.delete(relation);
      else {
        const shown = [...presentRelations].filter((r) => !current.has(r));
        if (shown.length <= 1) return current;
        next.add(relation);
      }
      return next;
    });
  }, []);

  return { filter: { kinds, hiddenRelations } as GraphFilter, toggleKind, toggleRelation };
}

export type GraphFilterControls = ReturnType<typeof useGraphFilter>;
