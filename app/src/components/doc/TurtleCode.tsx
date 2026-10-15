import { useMemo } from 'react';
import { Box } from '@mui/material';
import { highlightTurtle, type LineSpan, type TurtleTokenClass } from '@/api';
import { monoFontFamily } from '@/theme';

/** Token colours from the official palettes (theme paths, so they follow the theme). */
const TOKEN_SX: Record<TurtleTokenClass, object> = {
  iri: { color: 'primary.main' },
  keyword: { color: 'fairmat.areaE', fontWeight: 600 },
  literal: { color: 'nomad.oasis' },
  annotation: { color: 'nomad.camels' },
  comment: { color: 'text.secondary', fontStyle: 'italic' },
  punctuation: { color: 'text.secondary' },
  plain: {},
};

interface TurtleCodeProps {
  code: string;
  /** Show file line numbers, starting here. Omit for generated code. */
  firstLine?: number;
  /** File lines to emphasise (e.g. an expression inside its statement). */
  highlight?: LineSpan;
}

/** Read-only, syntax-highlighted Turtle. Horizontal scroll, no wrapping (keeps the structure readable). */
export function TurtleCode({ code, firstLine, highlight }: TurtleCodeProps) {
  const lines = useMemo(() => highlightTurtle(code), [code]);
  const numbered = firstLine !== undefined;
  const digits = String((firstLine ?? 1) + lines.length).length;

  return (
    <Box
      component="pre"
      sx={{ m: 0, py: 1.5, overflow: 'auto', fontFamily: monoFontFamily, fontSize: '0.8125rem', lineHeight: 1.7, color: 'text.primary' }}
    >
      {lines.map((segments, i) => {
        const line = (firstLine ?? 1) + i;
        const emphasised = numbered && highlight && line >= highlight.start && line <= highlight.end;
        return (
          <Box key={i} component="span" sx={{ display: 'flex', minWidth: 'fit-content', bgcolor: emphasised ? 'action.selected' : undefined }}>
            {numbered && (
              <Box component="span" aria-hidden sx={{ width: `${digits + 3}ch`, flexShrink: 0, pr: 2, textAlign: 'right', color: 'text.disabled', userSelect: 'none' }}>
                {line}
              </Box>
            )}
            <Box component="code" sx={{ font: 'inherit', whiteSpace: 'pre', pl: numbered ? 0 : 2, pr: 2 }}>
              {segments.length ? segments.map((s, j) => (
                <Box key={j} component="span" sx={TOKEN_SX[s.type]}>
                  {s.text}
                </Box>
              )) : ' '}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
