import { Fragment } from 'react';
import { Box, Fade, IconButton, Stack, Tooltip } from '@mui/material';
import { annotationsOf, type LoadedSource, type OntologyModel } from '@/api';
import { SourceViewIcon } from '@/assets';
import type { NodeView } from './nodeView';
import { PropertySection, type PropertyRow } from './PropertySection';
import { SectionCard } from './SectionCard';
import { SourceView } from './SourceView';
import { ValueView } from './ValueView';

interface OverviewSectionProps {
  model: OntologyModel;
  text: string | null;
  source: LoadedSource;
  /** Selected node, or null for the ontology summary. */
  nodeId: string | null;
  view: NodeView;
  showCode: boolean;
  onToggleCode: () => void;
}

/**
 * Section 1 — identity and annotations of the node (IRI, kind, lines, labels, definitions, …).
 * The `<>` button swaps it for the node's Turtle (read-only).
 */
export function OverviewSection({ model, text, source, nodeId, view, showCode, onToggleCode }: OverviewSectionProps) {
  const codeNode = nodeId ?? model.header?.iri ?? null;
  const canShowCode = !!(text && codeNode);
  const codeOpen = showCode && canShowCode;

  const annotations = nodeId ? annotationsOf(model, nodeId) : [];
  const annotationRows: PropertyRow[] = annotations.map((group) => ({
    label: group.label,
    value: (
      <Stack spacing={0.5}>
        {group.values.map((value, i) => (
          <Box key={i}>
            <ValueView model={model} value={value} />
          </Box>
        ))}
      </Stack>
    ),
  }));

  return (
    <SectionCard
      title="Overview"
      flush={codeOpen}
      actions={
        <Tooltip title={codeOpen ? 'Show details' : 'Show Turtle source'}>
          <span>
            <IconButton
              size="small"
              aria-label="Show Turtle source"
              aria-pressed={codeOpen}
              color={codeOpen ? 'primary' : 'default'}
              disabled={!canShowCode}
              onClick={onToggleCode}
            >
              <SourceViewIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      }
    >
      <Fade key={codeOpen ? 'code' : 'details'} in appear timeout={200}>
        <Box>
          {codeOpen && text && codeNode ? (
            <SourceView model={model} text={text} source={source} nodeId={codeNode} />
          ) : (
            <Stack spacing={2}>
              {view.sections.map((section, i) => (
                <Fragment key={i}>
                  <PropertySection title={section.title} rows={i === 0 ? [...section.rows, ...annotationRows] : section.rows} />
                </Fragment>
              ))}
            </Stack>
          )}
        </Box>
      </Fade>
    </SectionCard>
  );
}
