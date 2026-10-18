import { useMemo } from 'react';
import { Box, Chip, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import { axiomsFor, renderAxiom, type LoadedSource, type NodeAxiom, type Notation, type OntologyModel } from '@/api';
import { FormulaIcon } from '@/assets';
import { mathFontFamily } from '@/theme';
import { LineLink } from './LineLink';
import { NodeLink } from './NodeLink';
import { PropertySection, type PropertyRow } from './PropertySection';
import { SectionCard } from './SectionCard';

/** Group order: the node's own axioms first, then what points at it. */
const GROUP_ORDER = [
  'Axiom',
  'Characteristics',
  'Types',
  'Sub class of',
  'Sub property of',
  'Equivalent to',
  'Disjoint with',
  'Disjoint union of',
  'Inverse of',
  'Domain',
  'Range',
  'Property chain',
  'Keys',
  'Property assertions',
  'Same as',
  'Different from',
  'Super class of',
  'Super property of',
  'Instances',
  'Domain of',
  'Range of',
  'Used in',
  'Used in assertions',
  'Referenced by',
  'Axioms',
];

function AxiomLine({ model, source, item, notation }: { model: OntologyModel; source: LoadedSource; item: NodeAxiom; notation: Notation }) {
  const tokens = renderAxiom(model, item, notation);
  return (
    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
      <Box component="span" sx={notation === 'dl' ? { fontFamily: mathFontFamily, fontSize: '1.02em' } : undefined}>
        {tokens.map((token, i) =>
          token.iri ? (
            <NodeLink key={i} id={token.iri}>
              {token.text}
            </NodeLink>
          ) : (
            <span key={i}>{token.text}</span>
          ),
        )}
      </Box>
      {item.line !== undefined && (
        <Typography variant="caption" color="text.secondary">
          <LineLink source={source} span={{ start: item.line, end: item.line }} />
        </Typography>
      )}
    </Box>
  );
}

interface AxiomSectionProps {
  model: OntologyModel;
  source: LoadedSource;
  nodeId: string;
  notation: Notation;
  onToggleNotation: () => void;
}

/**
 * Section 2 — everything logical about the node: its own axioms (super classes, restrictions,
 * equivalences, characteristics, domain / range, assertions, …) and what refers to it (sub
 * classes, instances, "domain of", restrictions elsewhere, standalone axioms).
 * The formula button switches to Description Logic notation (experimental).
 */
export function AxiomSection({ model, source, nodeId, notation, onToggleNotation }: AxiomSectionProps) {
  const items = useMemo(() => axiomsFor(model, nodeId), [model, nodeId]);
  const dl = notation === 'dl';

  const rows: PropertyRow[] = useMemo(() => {
    const groups = new Map<string, NodeAxiom[]>();
    for (const item of items) (groups.get(item.group) ?? groups.set(item.group, []).get(item.group)!).push(item);
    return [...groups]
      .sort(([a], [b]) => GROUP_ORDER.indexOf(a) - GROUP_ORDER.indexOf(b))
      .map(([group, list]) => ({
        label: group,
        value: (
          <Stack spacing={0.75}>
            {list.map((item, i) => (
              <AxiomLine key={i} model={model} source={source} item={item} notation={notation} />
            ))}
          </Stack>
        ),
      }));
  }, [items, model, source, notation]);

  return (
    <SectionCard
      title={dl ? 'Description logic' : 'Axioms & relations'}
      badge={dl && <Chip label="experimental" size="small" color="warning" variant="outlined" sx={{ ml: 1, height: 20 }} />}
      actions={
        <Tooltip title={dl ? 'Show as text (Manchester style)' : 'Show in Description Logic notation (experimental)'}>
          <IconButton size="small" aria-label="Description Logic notation" aria-pressed={dl} color={dl ? 'primary' : 'default'} onClick={onToggleNotation}>
            <FormulaIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      }
    >
      {rows.length ? (
        <PropertySection rows={rows} />
      ) : (
        <Typography variant="body2" color="text.secondary">
          No logical axioms or relations for this node.
        </Typography>
      )}
    </SectionCard>
  );
}
