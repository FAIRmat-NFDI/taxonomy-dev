import { useRef, useState, type ComponentType, type KeyboardEvent } from 'react';
import { Box, Divider, IconButton, Link, Paper, Stack, Tab, Tabs, TextField, Tooltip, Typography, type SvgIconProps } from '@mui/material';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  FormatBoldIcon,
  FormatBulletedIcon,
  FormatHeadingIcon,
  FormatItalicIcon,
  FormatLinkIcon,
  FormatNumberedIcon,
  FormatQuoteIcon,
  FormatTasksIcon,
  SourceViewIcon,
} from '@/assets';
import { monoFontFamily } from '@/theme';
import { applyFormat, type FormatKind } from './markdownFormat';

type ToolbarItem = { kind: FormatKind; label: string; Icon: ComponentType<SvgIconProps>; shortcut?: string } | 'divider';

const TOOLBAR: ToolbarItem[] = [
  { kind: 'heading', label: 'Heading', Icon: FormatHeadingIcon },
  { kind: 'bold', label: 'Bold', Icon: FormatBoldIcon, shortcut: 'b' },
  { kind: 'italic', label: 'Italic', Icon: FormatItalicIcon, shortcut: 'i' },
  { kind: 'quote', label: 'Quote', Icon: FormatQuoteIcon },
  { kind: 'code', label: 'Code', Icon: SourceViewIcon, shortcut: 'e' },
  { kind: 'link', label: 'Link', Icon: FormatLinkIcon, shortcut: 'k' },
  'divider',
  { kind: 'bulleted', label: 'Bulleted list', Icon: FormatBulletedIcon },
  { kind: 'numbered', label: 'Numbered list', Icon: FormatNumberedIcon },
  { kind: 'tasks', label: 'Task list', Icon: FormatTasksIcon },
];

const SHORTCUTS = Object.fromEntries(TOOLBAR.flatMap((t) => (t !== 'divider' && t.shortcut ? [[t.shortcut, t.kind]] : []))) as Record<string, FormatKind>;
const isMac = typeof navigator !== 'undefined' && /Mac|iP(hone|ad)/.test(navigator.platform);

/** Markdown with MUI typography (GitHub-flavoured: tables, task lists, strikethrough). Also used to show issues. */
export function MarkdownPreview({ text, empty = 'Nothing to preview' }: { text: string; empty?: string }) {
  if (!text.trim()) {
    return (
      <Typography variant="body2" color="text.secondary">
        {empty}
      </Typography>
    );
  }
  return (
    <Box sx={{ overflowWrap: 'anywhere', '& > :first-child': { mt: 0 }, '& > :last-child': { mb: 0 }, '& ul, & ol': { typography: 'body2', pl: 3, mt: 0, mb: 1.5 }, '& pre code': { bgcolor: 'transparent', p: 0 } }}>
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <Typography variant="h5" component="h1" gutterBottom>{children}</Typography>,
          h2: ({ children }) => <Typography variant="h6" component="h2" gutterBottom>{children}</Typography>,
          h3: ({ children }) => <Typography variant="subtitle1" component="h3" sx={{ fontWeight: 600 }} gutterBottom>{children}</Typography>,
          p: ({ children }) => <Typography variant="body2" component="p" sx={{ mb: 1.5 }}>{children}</Typography>,
          a: ({ href, children }) => <Link href={href} target="_blank" rel="noreferrer">{children}</Link>,
          code: ({ children }) => (
            <Box component="code" sx={{ fontFamily: monoFontFamily, fontSize: '0.85em', bgcolor: 'action.hover', px: 0.5, borderRadius: 0.5 }}>
              {children}
            </Box>
          ),
          pre: ({ children }) => (
            <Box component="pre" sx={{ fontFamily: monoFontFamily, fontSize: '0.8125rem', bgcolor: 'action.hover', p: 1.5, borderRadius: 1, overflow: 'auto' }}>
              {children}
            </Box>
          ),
          blockquote: ({ children }) => (
            <Box component="blockquote" sx={{ m: 0, mb: 2, pl: 2, borderLeft: 3, borderColor: 'divider', color: 'text.secondary' }}>
              {children}
            </Box>
          ),
        }}
      >
        {text}
      </Markdown>
    </Box>
  );
}

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minRows?: number;
  /** Accessible name of the text area. */
  label?: string;
}

/**
 * GitHub-like description editor: Write / Preview tabs, formatting toolbar (with ⌘/Ctrl + B, I, E, K),
 * plain Markdown underneath — exactly what GitHub stores and renders.
 */
export function MarkdownEditor({ value, onChange, placeholder = 'Type your description here…', minRows = 10, label = 'Description' }: MarkdownEditorProps) {
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  const input = useRef<HTMLTextAreaElement>(null);

  const format = (kind: FormatKind) => {
    const el = input.current;
    const edit = applyFormat(value, el?.selectionStart ?? value.length, el?.selectionEnd ?? value.length, kind);
    onChange(edit.text);
    // Restore focus and the new selection after React has written the value.
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(edit.start, edit.end);
    });
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const kind = (e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey ? SHORTCUTS[e.key.toLowerCase()] : undefined;
    if (kind) {
      e.preventDefault();
      format(kind);
    }
  };

  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
      <Stack direction="row" sx={{ alignItems: 'center', flexWrap: 'wrap', borderBottom: 1, borderColor: 'divider', bgcolor: 'background.default', pr: 1 }}>
        <Tabs value={tab} onChange={(_, t) => setTab(t)} sx={{ flexGrow: 1, minHeight: 44 }}>
          <Tab value="write" label="Write" sx={{ minHeight: 44 }} />
          <Tab value="preview" label="Preview" sx={{ minHeight: 44 }} />
        </Tabs>
        {tab === 'write' && (
          <Stack direction="row" role="toolbar" aria-label="Formatting" sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
            {TOOLBAR.map((item, i) =>
              item === 'divider' ? (
                <Divider key={i} orientation="vertical" flexItem sx={{ mx: 0.5, my: 1 }} />
              ) : (
                <Tooltip key={item.kind} title={item.shortcut ? `${item.label} (${isMac ? '⌘' : 'Ctrl+'}${item.shortcut.toUpperCase()})` : item.label}>
                  <IconButton size="small" aria-label={item.label} onClick={() => format(item.kind)}>
                    <item.Icon fontSize="small" />
                  </IconButton>
                </Tooltip>
              ),
            )}
          </Stack>
        )}
      </Stack>
      <Box sx={{ p: 1.5 }}>
        {tab === 'write' ? (
          <TextField
            multiline
            fullWidth
            minRows={minRows}
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            inputRef={input}
            slotProps={{ htmlInput: { 'aria-label': label } }}
          />
        ) : (
          <Box sx={{ minHeight: minRows * 24, px: 1 }}>
            <MarkdownPreview text={value} />
          </Box>
        )}
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', px: 2, pb: 1 }}>
        Markdown is supported.
      </Typography>
    </Paper>
  );
}
