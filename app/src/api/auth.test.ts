import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/config', () => ({
  config: {
    source: { owner: 'FAIRmat-NFDI', repo: 'ontology', branch: 'main', path: 'main.ttl' },
    issues: { owner: 'FAIRmat-NFDI', repo: 'ontology' },
    apiBaseUrl: 'https://api.example.org',
    githubApiUrl: 'https://api.github.com',
    tokenPermissions: { contents: 'read', issues: 'write' },
  },
  authCallbackUrl: (next: string) => `http://localhost:5173/auth/callback?next=${encodeURIComponent(next)}`,
  AUTH_CALLBACK_PATH: '/auth/callback',
}));

function memoryStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    map: m,
  };
}
const session = memoryStorage();
const local = memoryStorage();
vi.stubGlobal('sessionStorage', session);
vi.stubGlobal('localStorage', local);

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);
const reply = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }));

const auth = await import('./auth');
const issues = await import('./github/issues');
const { clearSession, getSession } = await import('./session');

const calls = () => fetchMock.mock.calls.map(([url, init]) => ({ url: String(url), method: init?.method, auth: init?.headers?.Authorization }));

describe('auth + GitHub routing', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    session.map.clear();
    local.map.clear();
    clearSession();
  });
  afterEach(() => clearSession());

  it('reports a down backend instead of throwing', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(auth.getLoginOptions()).resolves.toMatchObject({ available: false, providers: [] });
  });

  it('completes a redirect login from the URL fragment', async () => {
    fetchMock.mockReturnValueOnce(
      reply({ mode: 'proxy', provider: 'helmholtz', providerLabel: 'Helmholtz ID', user: { login: 'jdoe' }, accessToken: 'sess', expiresAt: Date.now() + 3600e3 }),
    );
    const info = await auth.completeLogin('#handoff=abc');
    expect(info).toEqual({ mode: 'proxy', provider: 'helmholtz', providerLabel: 'Helmholtz ID', user: { login: 'jdoe' } });
    expect(calls()[0]).toMatchObject({ url: 'https://api.example.org/auth/session', method: 'POST' });
    expect(session.map.get('tp.session')).toContain('"accessToken":"sess"');
  });

  it('turns a provider error in the fragment into a readable error', async () => {
    await expect(auth.completeLogin('#error=access_denied&error_description=User%20cancelled')).rejects.toThrow('User cancelled');
  });

  it('creates an issue with the SAME path and payload in direct and proxy mode', async () => {
    const issue = { number: 1, title: 'T', body: 'B', state: 'open', html_url: 'u', created_at: 'now', user: { login: 'x' } };
    const anchor = { filePath: 'main.ttl', entityIri: 'https://ex.org#Sample' };

    // 1) Direct: own GitHub token → api.github.com
    fetchMock.mockReturnValueOnce(reply({ id: 7, login: 'hari', name: 'Hari', avatar_url: 'a' }));
    await auth.signInWithToken('ghp_x', false);
    fetchMock.mockReturnValueOnce(reply(issue, 201));
    await issues.createThread({ title: 'T', body: 'B', anchor });

    // 2) Proxy: university login → backend /github (on behalf of)
    fetchMock.mockReturnValueOnce(
      reply({ mode: 'proxy', provider: 'keycloak', providerLabel: 'Email & password', user: { login: 'demo' }, accessToken: 'sess' }),
    );
    await auth.passwordLogin('demo', 'demo', false);
    fetchMock.mockReturnValueOnce(reply(issue, 201));
    await issues.createThread({ title: 'T', body: 'B', anchor });

    const [, direct, , proxy] = fetchMock.mock.calls;
    expect(String(direct![0])).toBe('https://api.github.com/repos/FAIRmat-NFDI/ontology/issues');
    expect(String(proxy![0])).toBe('https://api.example.org/github/repos/FAIRmat-NFDI/ontology/issues');
    expect(direct![1].headers.Authorization).toBe('Bearer ghp_x');
    expect(proxy![1].headers.Authorization).toBe('Bearer sess');
    expect(direct![1].body).toBe(proxy![1].body); // identical JSON payload
  });

  it('refreshes an expired GitHub session on restore', async () => {
    local.setItem(
      'tp.session',
      JSON.stringify({ mode: 'direct', provider: 'github', providerLabel: 'GitHub', user: { login: 'hari' }, accessToken: 'old', refreshToken: 'ghr_1', expiresAt: Date.now() - 1 }),
    );
    fetchMock
      .mockReturnValueOnce(reply({ accessToken: 'new', refreshToken: 'ghr_2', expiresAt: Date.now() + 3600e3 }))
      .mockReturnValueOnce(reply({ id: 7, login: 'hari', name: 'Hari', avatar_url: 'a' }));

    await expect(auth.restoreSession()).resolves.toMatchObject({ provider: 'github' });
    expect(calls()[0]).toMatchObject({ url: 'https://api.example.org/auth/github/refresh', method: 'POST' });
    expect(calls()[1]).toMatchObject({ url: 'https://api.github.com/user', auth: 'Bearer new' });
    expect(getSession()?.accessToken).toBe('new');
    expect(local.map.get('tp.session')).toContain('"accessToken":"new"'); // stays in "remembered" storage
  });

  it('drops a stored session the backend no longer accepts', async () => {
    session.setItem('tp.session', JSON.stringify({ mode: 'proxy', provider: 'helmholtz', providerLabel: 'H', user: { login: 'j' }, accessToken: 'bad' }));
    fetchMock.mockReturnValueOnce(reply({ error: 'invalid_token' }, 401));
    await expect(auth.restoreSession()).resolves.toBeNull();
    expect(session.map.has('tp.session')).toBe(false);
  });

  it('creates an account and signs in (proxy session)', async () => {
    fetchMock.mockReturnValueOnce(
      reply({ mode: 'proxy', provider: 'keycloak', providerLabel: 'Email & password', user: { login: 'new@hzb.de' }, accessToken: 'sess' }, 201),
    );
    const account = { email: 'new@hzb.de', password: 'longenough', firstName: 'New', lastName: 'User' };
    await expect(auth.register(account, false)).resolves.toMatchObject({ mode: 'proxy', user: { login: 'new@hzb.de' } });
    expect(calls()[0]).toMatchObject({ url: 'https://api.example.org/auth/register', method: 'POST' });
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toEqual(account);
    expect(getSession()?.accessToken).toBe('sess');
  });

  it('surfaces "account exists" from the backend', async () => {
    fetchMock.mockReturnValueOnce(reply({ error: 'account_exists', message: 'An account with this email already exists. Sign in instead.' }, 409));
    await expect(auth.register({ email: 'demo@example.org', password: 'longenough', firstName: 'D', lastName: 'U' }, false)).rejects.toThrow(
      /already exists/,
    );
  });

  it('starts a redirect login at the backend with an allowed returnTo', () => {
    const assign = vi.fn();
    vi.stubGlobal('window', { location: { assign } });
    auth.beginLogin('helmholtz', '/graph', true);
    const url = new URL(assign.mock.calls[0]![0]);
    expect(url.origin + url.pathname).toBe('https://api.example.org/auth/helmholtz/login');
    expect(url.searchParams.get('returnTo')).toBe('http://localhost:5173/auth/callback?next=%2Fgraph');
    expect(session.map.get('tp.auth.remember')).toBe('1');
  });
  it('GitHub sign-in: refreshes an expiring token before creating an issue, and stores the anchor', async () => {
    const { setSession } = await import('./session');
    setSession(
      { mode: 'direct', provider: 'github', providerLabel: 'GitHub', user: { id: '7', login: 'hari', providerLabel: 'GitHub' }, accessToken: 'old', refreshToken: 'ghr_1', expiresAt: Date.now() + 1000 },
      false,
    );
    fetchMock
      .mockReturnValueOnce(reply({ accessToken: 'new', refreshToken: 'ghr_2', expiresAt: Date.now() + 8 * 3600e3 }))
      .mockReturnValueOnce(
        reply({ number: 42, title: 'Typo', body: 'x', state: 'open', html_url: 'https://github.com/FAIRmat-NFDI/ontology/issues/42', created_at: 'now', user: { login: 'hari' } }, 201),
      );

    await auth.ensureFreshSession();
    const anchor = { filePath: 'main.ttl', entityIri: 'https://ex.org#Sample', lineStart: 10, lineEnd: 14, ref: 'abc1234' };
    const thread = await issues.createThread({ title: 'Typo', body: '> **Reference:** …\n\nFix it', anchor });

    expect(calls()).toEqual([
      { url: 'https://api.example.org/auth/github/refresh', method: 'POST', auth: undefined },
      { url: 'https://api.github.com/repos/FAIRmat-NFDI/ontology/issues', method: 'POST', auth: 'Bearer new' },
    ]);
    const sent = JSON.parse(fetchMock.mock.calls[1]![1].body);
    expect(sent.title).toBe('Typo');
    expect(sent.body).toContain('Fix it');
    expect(sent.body).toContain(`<!-- fairtaxonomy:anchor ${JSON.stringify(anchor)} -->`);
    expect(thread).toMatchObject({ id: 42, url: 'https://github.com/FAIRmat-NFDI/ontology/issues/42' });
  });

  it('explains GitHub errors when creating an issue', async () => {
    const { AppError } = await import('./errors');
    expect(issues.issueErrorMessage(new AppError('FORBIDDEN', 'x', { message: 'Resource not accessible by integration' }))).toMatch(/GitHub App is not installed/);
    expect(issues.issueErrorMessage(new AppError('UNKNOWN', 'Issues are disabled for this repo'))).toMatch(/Issues are disabled/);
    expect(issues.issueErrorMessage(new AppError('UNAUTHENTICATED', 'Bad credentials'))).toMatch(/sign in again/);
    expect(issues.issueErrorMessage(new AppError('NOT_FOUND', 'Not Found'))).toMatch(/not found/);
  });
  it('GitHub sign-in: lists and adds comments, closes an issue', async () => {
    fetchMock.mockReturnValueOnce(reply({ id: 7, login: 'hari', name: 'Hari', avatar_url: 'a' }));
    await auth.signInWithToken('ghu_x', false);
    const c = (id: number) => ({ id, body: `c${id}`, html_url: `u${id}`, created_at: 'now', user: { login: 'hari', avatar_url: 'a', html_url: 'p' } });
    fetchMock
      .mockReturnValueOnce(reply([c(1), c(2)]))
      .mockReturnValueOnce(reply(c(3), 201))
      .mockReturnValueOnce(reply({ number: 5, title: 'T', body: '', state: 'closed', html_url: 'u', created_at: 'now', user: { login: 'hari' } }));

    expect((await issues.listComments(5)).map((x) => x.body)).toEqual(['c1', 'c2']);
    expect(await issues.addComment(5, 'hello')).toMatchObject({ id: 3, author: 'hari' });
    expect(await issues.closeThread(5)).toMatchObject({ id: 5, state: 'closed' });

    const [, list, post, patch] = calls();
    expect(list!.url).toBe('https://api.github.com/repos/FAIRmat-NFDI/ontology/issues/5/comments?per_page=100&page=1');
    expect(post).toMatchObject({ url: 'https://api.github.com/repos/FAIRmat-NFDI/ontology/issues/5/comments', method: 'POST', auth: 'Bearer ghu_x' });
    expect(patch).toMatchObject({ url: 'https://api.github.com/repos/FAIRmat-NFDI/ontology/issues/5', method: 'PATCH' });
    expect(JSON.parse(fetchMock.mock.calls[3]![1].body)).toEqual({ state: 'closed', state_reason: 'completed' });
  });
});
