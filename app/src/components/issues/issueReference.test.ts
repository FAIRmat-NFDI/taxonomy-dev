import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { materialize, parseTurtle, type LoadedSource, type OntologyModel } from '@/api';

vi.mock('@/config', () => ({ config: { githubWebUrl: 'https://github.com' } }));
const { issueReference } = await import('./issueReference');

const NS = 'https://example.org/fairmat/playground#';
const source: LoadedSource = { owner: 'FAIRmat-NFDI', repo: 'fairmat-taxonomy-v2', branch: 'main', path: 'main.ttl', commit: 'abc1234def' };
let model: OntologyModel;

beforeAll(async () => {
  model = materialize(await parseTurtle(readFileSync(new URL('../../../../samples/example-main.ttl', import.meta.url), 'utf8')));
});

describe('issueReference', () => {
  it('anchors a class at its first statement block, pinned to the commit', () => {
    const ref = issueReference(model, source, `${NS}Sample`)!;
    expect(ref.anchor).toEqual({ filePath: 'main.ttl', entityIri: `${NS}Sample`, lineStart: 103, lineEnd: 108, ref: 'abc1234def' });
    expect(ref.markdown).toContain('[`main.ttl` L103–L108](https://github.com/FAIRmat-NFDI/fairmat-taxonomy-v2/blob/abc1234def/main.ttl#L103-L108)');
    expect(ref.markdown).toContain(`class [sample](${NS}Sample)`);
    expect(ref.markdown).toContain(`(+${ref.spans.length - 1} more)`);
    expect(ref.spans.length).toBeGreaterThan(1);
  });

  it('falls back to the ontology header when nothing is selected', () => {
    expect(issueReference(model, source, null)).toMatchObject({ kind: 'Ontology', label: 'Taxonomy Playground showcase' });
  });

  it('references anonymous axioms by their text and lines', () => {
    const gci = Object.values(model.axioms).find((a) => a.kind === 'GeneralClassInclusion')!;
    const ref = issueReference(model, source, gci.id)!;
    expect(ref.iri).toBeUndefined();
    expect(ref.anchor).toMatchObject({ lineStart: 227, lineEnd: 229 });
  });
});
