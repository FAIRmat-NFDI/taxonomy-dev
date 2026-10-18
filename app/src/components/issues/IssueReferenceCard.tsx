import { useMemo, useState } from 'react';
import { Box, Button, Chip, Collapse, Link, Paper, Stack, Typography } from '@mui/material';
import type { LoadedSource } from '@/api';
import { TurtleCode } from '@/components/doc/TurtleCode';
import { sourceUrl, type IssueReference } from './issueReference';

interface IssueReferenceCardProps {
  reference: IssueReference;
  source: LoadedSource;
  /** Ontology file text, for the Turtle preview of the referenced lines. */
  text: string | null;
}

/** "What this issue is about": the node, its kind, and the file lines it lives on (with the Turtle). */
export function IssueReferenceCard({ reference, source, text }: IssueReferenceCardProps) {
  const [showTurtle, setShowTurtle] = useState(false);
  const first = reference.spans[0];
  const snippet = useMemo(() => (text && first ? text.split('\n').slice(first.start - 1, first.end).join('\n') : null), [text, first]);

  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, bgcolor: 'nomad.backgroundPrimary' }}>
      <Stack spacing={1} sx={{ p: 2 }}>
        <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1.5 }}>
          Reference
        </Typography>
        <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
          <Typography variant="subtitle2" sx={{ wordBreak: 'break-word' }}>
            {reference.label}
          </Typography>
          <Chip size="small" variant="outlined" label={reference.kind} />
        </Stack>
        {reference.iri && (
          <Typography variant="caption" color="text.secondary" sx={{ wordBreak: 'break-all' }}>
            {reference.iri}
          </Typography>
        )}
        <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
          <Typography variant="body2">
            {source.path}{' '}
            {reference.spans.map((span, i) => (
              <Box component="span" key={span.start}>
                {i > 0 && ', '}
                <Link href={sourceUrl(source, span)} target="_blank" rel="noreferrer">
                  {span.start === span.end ? `line ${span.start}` : `lines ${span.start}–${span.end}`}
                </Link>
              </Box>
            ))}
          </Typography>
          <Chip size="small" label={`${source.branch}${source.commit ? ` @ ${source.commit.slice(0, 7)}` : ''}`} />
          {snippet && (
            <Button size="small" onClick={() => setShowTurtle((v) => !v)} sx={{ ml: 'auto' }}>
              {showTurtle ? 'Hide Turtle' : 'Show Turtle'}
            </Button>
          )}
        </Stack>
      </Stack>
      {snippet && first && (
        <Collapse in={showTurtle} unmountOnExit>
          <Box sx={{ bgcolor: 'background.paper', borderTop: 1, borderColor: 'divider', maxHeight: 240, overflow: 'auto' }}>
            <TurtleCode code={snippet} firstLine={first.start} />
          </Box>
        </Collapse>
      )}
    </Paper>
  );
}
