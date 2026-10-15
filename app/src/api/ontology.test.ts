import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/config', () => ({
  config: {
    source: { owner: 'FAIRmat-NFDI', repo: 'onto', branch: 'main', path: 'main.ttl' },
    access: { protectedBranchesRequireLogin: true },
    apiBaseUrl: 'https://api.example.org',
    githubApiUrl: 'https://api.github.com',
    githubRawUrl: 'https://raw.githubusercontent.com',
  },
}));

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);
vi.stubGlobal('sessionStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} });
vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} });
const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }));
const TTL = '@prefix : <https://example.org/o#> .\n:A a <http://www.w3.org/2002/07/owl#Class> .\n';

const { loadOntology } = await import('./ontology');
const urls = () => fetchMock.mock.calls.map(([u, init]) => ({ url: String(u), auth: init?.headers?.Authorization as string | undefined }));

describe('loadOntology', () => {
  beforeEach(() => fetchMock.mockReset());

  it('public, unprotected branch: no token, raw file pinned to the head commit', async () => {
    fetchMock
      .mockReturnValueOnce(json({ name: 'main', protected: false, commit: { sha: 'abc' } }))
      .mockReturnValueOnce(Promise.resolve(new Response(TTL)));
    const result = await loadOntology({ branch: 'main', signedIn: false });

    expect(result.status).toBe('ready');
    expect(result.access).toEqual({ read: 'anonymous', canComment: false, reason: 'public-branch' });
    expect(urls()).toEqual([
      { url: 'https://api.github.com/repos/FAIRmat-NFDI/onto/branches/main', auth: undefined },
      { url: 'https://raw.githubusercontent.com/FAIRmat-NFDI/onto/abc/main.ttl', auth: undefined },
    ]);
    expect(result.status === 'ready' && result.model.entities['https://example.org/o#A']?.locations).toEqual([{ start: 2, end: 2 }]);
  });

  it('protected branch, signed out: stops before reading the file', async () => {
    fetchMock.mockReturnValueOnce(json({ name: 'main', protected: true, commit: { sha: 'abc' } }));
    const result = await loadOntology({ branch: 'main', signedIn: false });
    expect(result).toMatchObject({ status: 'login-required', access: { reason: 'protected-branch' } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('private repository: anonymous probe 404 → login required', async () => {
    fetchMock.mockReturnValueOnce(json({ message: 'Not Found' }, 404));
    const result = await loadOntology({ branch: 'main', signedIn: false });
    expect(result).toMatchObject({ status: 'login-required', access: { reason: 'restricted-repository' } });
  });
});
