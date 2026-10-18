import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { materialize, parseTurtle, type CommentThread, type LoadedSource, type OntologyModel } from '@/api';

vi.mock('@/config', () => ({ config: { githubWebUrl: 'https://github.com' } }));
const { issueReference } = await import('./issueReference');
const { indexIssues, nodeAtLine, stripReference } = await import('./issueIndex');

const NS = 'https://example.org/fairmat/playground#';
const source: LoadedSource = { owner: 'FAIRmat-NFDI', repo: 'taxonomy-dev', branch: 'main', path: 'main.ttl', commit: 'abc1234def' };
let model: OntologyModel;

const thread = (id: number, anchor: CommentThread['anchor']): CommentThread => ({
  id,
  title: `#${id}`,
  body: '',
  author: 'hari',
  state: 'open',
  url: `https://github.com/x/y/issues/${id}`,
  createdAt: '2026-10-16T09:00:00Z',
  comments: 0,
  anchor,
});

beforeAll(async () => {
  model = materialize(await parseTurtle(readFileSync(new URL('../../../../samples/example-main.ttl', import.meta.url), 'utf8')));
});

describe('indexIssues', () => {
  it('maps an issue back to the node it was created for (round trip)', () => {
    const anchor = issueReference(model, source, `${NS}Sample`)!.anchor;
    const index = indexIssues([thread(1, anchor)], model, source);
    expect(index.get(`${NS}Sample`)?.map((t) => t.id)).toEqual([1]);
  });

  it('falls back to the line when the id is gone, but only for the same commit', () => {
    const anchor = { filePath: 'main.ttl', entityIri: `${NS}RenamedSample`, lineStart: 103, lineEnd: 108, ref: 'abc1234def' };
    expect(indexIssues([thread(2, anchor)], model, source).get(`${NS}Sample`)?.length).toBe(1);
    expect(indexIssues([thread(3, { ...anchor, ref: 'other' })], model, source).size).toBe(0);
  });

  it('ignores issues about other files or without an anchor', () => {
    const index = indexIssues([thread(4, { filePath: 'other.ttl', entityIri: `${NS}Sample` }), thread(5, null)], model, source);
    expect(index.size).toBe(0);
  });

  it('finds the node at a line', () => {
    expect(nodeAtLine(model, 103)).toBe(`${NS}Sample`);
  });

  it('strips the reference line from the body', () => {
    expect(stripReference('> **Reference:** class [s](x) · `main`\n\nThe definition is vague')).toBe('The definition is vague');
    expect(stripReference('> **Reference:** class [s](x)\n\n')).toBe('');
  });
});
