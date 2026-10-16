/**
 * Toolbar actions of the issue editor (GitHub-flavoured Markdown), as a pure text transform:
 * (text, selection) → (new text, new selection). Inline styles wrap the selection; block styles
 * prefix every selected line. With nothing selected, the cursor lands where you type next.
 */
export type FormatKind = 'heading' | 'bold' | 'italic' | 'quote' | 'code' | 'link' | 'bulleted' | 'numbered' | 'tasks';

export interface Edit {
  text: string;
  start: number;
  end: number;
}

const WRAP: Partial<Record<FormatKind, [string, string]>> = {
  bold: ['**', '**'],
  italic: ['_', '_'],
};

const PREFIX: Partial<Record<FormatKind, (index: number) => string>> = {
  heading: () => '### ',
  quote: () => '> ',
  bulleted: () => '- ',
  numbered: (i) => `${i + 1}. `,
  tasks: () => '- [ ] ',
};

export function applyFormat(text: string, start: number, end: number, kind: FormatKind): Edit {
  const selected = text.slice(start, end);
  const before = text.slice(0, start);
  const after = text.slice(end);

  if (kind === 'link') {
    const label = selected || 'text';
    const inserted = `[${label}](url)`;
    const urlStart = start + label.length + 3;
    return { text: before + inserted + after, start: urlStart, end: urlStart + 3 };
  }

  if (kind === 'code' && selected.includes('\n')) {
    const inserted = `\`\`\`\n${selected}\n\`\`\``;
    return { text: before + inserted + after, start: start + 4, end: start + 4 + selected.length };
  }

  const wrap = kind === 'code' ? (['`', '`'] as [string, string]) : WRAP[kind];
  if (wrap) {
    const [open, close] = wrap;
    return { text: before + open + selected + close + after, start: start + open.length, end: end + open.length };
  }

  // Block styles: extend the selection to whole lines, prefix each line.
  const prefix = PREFIX[kind]!;
  const lineStart = text.lastIndexOf('\n', start - 1) + 1;
  const nextBreak = text.indexOf('\n', end);
  const lineEnd = nextBreak === -1 ? text.length : nextBreak;
  const lines = text.slice(lineStart, lineEnd).split('\n');
  const block = lines.map((line, i) => prefix(i) + line).join('\n');
  const result = text.slice(0, lineStart) + block + text.slice(lineEnd);
  return selected
    ? { text: result, start: lineStart, end: lineStart + block.length }
    : { text: result, start: start + prefix(0).length, end: start + prefix(0).length };
}
