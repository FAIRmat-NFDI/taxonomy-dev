import { Fragment, useMemo, useState } from 'react';
import { Box, Divider, IconButton, Stack, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from '@mui/material';
import { formatNodeTurtle, sourceSpans, type LoadedSource, type OntologyModel } from '@/api';
import { CopyIcon } from '@/assets';
import { LineLink } from './LineLink';
import { TurtleCode } from './TurtleCode';

type Mode = 'formatted' | 'file';

interface SourceViewProps {
  model: OntologyModel;
  text: string;
  source: LoadedSource;
  /** Entity IRI, expression id, axiom id, or the ontology IRI. */
  nodeId: string;
}

/**
 * Read-only Turtle of one node:
 *  Formatted   — re-serialized from the model, prettily indented, with the prefixes it uses
 *  File lines  — the exact statement blocks from the file, with line numbers and GitHub links
 */
export function SourceView({ model, text, source, nodeId }: SourceViewProps) {
  const [mode, setMode] = useState<Mode>('formatted');
  const [copied, setCopied] = useState(false);

  const formatted = useMemo(() => formatNodeTurtle(model, nodeId), [model, nodeId]);
  const { blocks, focus } = useMemo(() => sourceSpans(model, nodeId), [model, nodeId]);
  const fileLines = useMemo(() => text.split('\n'), [text]);
  const blockText = (start: number, end: number) => fileLines.slice(start - 1, end).join('\n');

  const copyText = mode === 'formatted' ? (formatted ?? '') : blocks.map((b) => blockText(b.start, b.end)).join('\n\n');
  const copy = () =>
    navigator.clipboard?.writeText(copyText).then(
      () => setCopied(true),
      () => setCopied(false),
    );

  const empty = mode === 'formatted' ? !formatted : blocks.length === 0;

  return (
    <Box>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', px: 1.5, py: 1, borderBottom: 1, borderColor: 'divider' }}>
        <ToggleButtonGroup size="small" exclusive value={mode} onChange={(_, value: Mode | null) => value && setMode(value)} aria-label="Source view">
          <ToggleButton value="formatted">Formatted</ToggleButton>
          <ToggleButton value="file">File lines</ToggleButton>
        </ToggleButtonGroup>
        <Box sx={{ flexGrow: 1 }} />
        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: { xs: 'none', sm: 'block' } }}>
          {source.path} · read-only
        </Typography>
        <Tooltip title={copied ? 'Copied' : 'Copy'} onClose={() => setCopied(false)}>
          <span>
            <IconButton size="small" aria-label="Copy Turtle" onClick={copy} disabled={empty}>
              <CopyIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>

      {empty && (
        <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
          No Turtle statements for this node.
        </Typography>
      )}

      {mode === 'formatted' && formatted && <TurtleCode code={formatted} />}

      {mode === 'file' &&
        blocks.map((block, i) => (
          <Fragment key={block.start}>
            {i > 0 && <Divider />}
            <Box sx={{ px: 2, pt: 1 }}>
              <Typography variant="caption" color="text.secondary">
                <LineLink source={source} span={block} />
              </Typography>
            </Box>
            <TurtleCode code={blockText(block.start, block.end)} firstLine={block.start} highlight={focus} />
          </Fragment>
        ))}
    </Box>
  );
}
