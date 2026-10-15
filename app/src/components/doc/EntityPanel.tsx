import { lazy, Suspense, useState } from 'react';
import { Alert, LinearProgress, Skeleton, Stack } from '@mui/material';
import type { Notation } from '@/api';
import { LoadingBackdrop } from '@/components/common';
import { useOntology, useSelectedNode } from '@/hooks/useOntology';
import { AxiomSection } from './AxiomSection';
import { describeNode, describeOntology } from './nodeView';
import { OverviewSection } from './OverviewSection';
import { PanelBody } from './PanelBody';
import { PanelHeader } from './PanelHeader';
import { PropertySection, type PropertyRow } from './PropertySection';

/** Cytoscape is large: loaded only when a graph is first shown. */
const NeighbourhoodGraph = lazy(() => import('./graph/NeighbourhoodGraph'));

/** Placeholder sections while loading. */
const SKELETON_SECTIONS: Array<{ title?: string; rows: PropertyRow[] }> = [
  { rows: [{ label: 'IRI' }, { label: 'Description' }, { label: 'Sub Class Of' }, { label: 'Super Class Of' }] },
  { title: 'Other Axioms', rows: [{ label: 'Disjoint Classes' }, { label: 'Disjoint Union' }, { label: 'Equivalent Classes' }] },
];

/**
 * Column 2 for the selected node (`?node=`):
 *   1 Overview             identity + annotations      (`<>` → Turtle source)
 *   2 Axioms & relations   logical axioms, both ways   (Σ → Description Logic, experimental)
 *   3 Graph                neighbourhood
 * With nothing selected: an ontology summary. View toggles persist while browsing.
 */
export function EntityPanel() {
  const { status, model, text, source, access, error } = useOntology();
  const [selected, select] = useSelectedNode();
  const [showCode, setShowCode] = useState(false);
  const [notation, setNotation] = useState<Notation>('manchester');

  const ready = status === 'ready' && model && source;
  const view = ready ? (selected ? describeNode(model, source, selected) : describeOntology(model, source, !access?.canComment)) : null;
  const isHeader = !!selected && model?.header?.iri === selected;

  return (
    <>
      <PanelHeader title={view?.title ?? (status === 'loading' || status === 'idle' ? <Skeleton width="40%" /> : 'FAIRTaxonomy')} />
      {status === 'loading' && <LinearProgress />}
      <PanelBody>
        <Stack spacing={2}>
          {status === 'login-required' && (
            <Alert severity="info">
              {access?.reason === 'protected-branch'
                ? `Branch ${source?.branch} is protected — only signed-in users can view it.`
                : `${source?.owner}/${source?.repo} is not publicly readable.`}{' '}
              Use Login in the top bar.
            </Alert>
          )}
          {status === 'error' && <Alert severity="error">{error?.message}</Alert>}
          {ready && selected && !view && <Alert severity="warning">Nothing called “{selected}” in this version of the ontology.</Alert>}

          {ready && view && (
            <OverviewSection
              model={model}
              text={text}
              source={source}
              nodeId={selected}
              view={view}
              showCode={showCode}
              onToggleCode={() => setShowCode((v) => !v)}
            />
          )}
          {ready && view && selected && !isHeader && (
            <AxiomSection
              model={model}
              source={source}
              nodeId={selected}
              notation={notation}
              onToggleNotation={() => setNotation((n) => (n === 'dl' ? 'manchester' : 'dl'))}
            />
          )}
          {ready && view && selected && (
            <Suspense fallback={<LoadingBackdrop label="Loading graph view…" />}>
              <NeighbourhoodGraph model={model} nodeId={selected} onSelect={select} />
            </Suspense>
          )}

          {(status === 'loading' || status === 'idle') &&
            SKELETON_SECTIONS.map((section, i) => <PropertySection key={i} title={section.title} rows={section.rows} />)}
        </Stack>
      </PanelBody>
    </>
  );
}
