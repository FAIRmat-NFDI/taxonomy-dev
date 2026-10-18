import { describe, expect, it } from 'vitest';
import { applyFormat } from './markdownFormat';

describe('applyFormat', () => {
  it('wraps the selection for inline styles and keeps it selected', () => {
    expect(applyFormat('a word b', 2, 6, 'bold')).toEqual({ text: 'a **word** b', start: 4, end: 8 });
    expect(applyFormat('a word b', 2, 6, 'code')).toEqual({ text: 'a `word` b', start: 3, end: 7 });
  });

  it('puts the cursor between the markers when nothing is selected', () => {
    expect(applyFormat('ab', 1, 1, 'italic')).toEqual({ text: 'a__b', start: 2, end: 2 });
  });

  it('selects the URL placeholder of a new link', () => {
    const edit = applyFormat('see docs', 4, 8, 'link');
    expect(edit.text).toBe('see [docs](url)');
    expect(edit.text.slice(edit.start, edit.end)).toBe('url');
  });

  it('prefixes every selected line for block styles', () => {
    expect(applyFormat('one\ntwo\nthree', 1, 6, 'numbered').text).toBe('1. one\n2. two\nthree');
    expect(applyFormat('one\ntwo', 5, 5, 'tasks')).toEqual({ text: 'one\n- [ ] two', start: 11, end: 11 });
  });

  it('fences multi-line code', () => {
    expect(applyFormat('x\ny', 0, 3, 'code').text).toBe('```\nx\ny\n```');
  });
});
