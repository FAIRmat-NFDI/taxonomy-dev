import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { FRONTEND, ISSUER, fakeUpstreams, loginViaRedirect, startApp, testConfig } from './helpers.js';

describe('auth', () => {
  const upstream = fakeUpstreams();
  let app;
  before(async () => (app = await startApp(testConfig(), upstream.fetchImpl)));
  after(() => app.close());

  const post = (path, body, headers = {}) =>
    fetch(`${app.base}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });

  it('lists providers for the frontend to render', async () => {
    const data = await (await fetch(`${app.base}/auth/providers`)).json();
    assert.deepEqual(
      data.providers.map((p) => [p.id, p.mode, p.showButton]),
      [
        ['github', 'direct', true],
        ['helmholtz', 'proxy', true],
        ['keycloak', 'proxy', false],
      ],
    );
    assert.deepEqual(data.password, { provider: 'keycloak', label: 'Email & password' });
    assert.equal(data.proxy.enabled, true);
  });

  it('GitHub login: PKCE redirect, secret-side exchange, GitHub token handed to the frontend', async () => {
    const { authorize, landing, fragment } = await loginViaRedirect(app.base, 'github', upstream);

    assert.equal(authorize.origin + authorize.pathname, 'https://github.com/login/oauth/authorize');
    assert.equal(authorize.searchParams.get('redirect_uri'), 'http://localhost:4000/auth/github/callback');
    assert.equal(authorize.searchParams.get('code_challenge_method'), 'S256');
    assert.equal(landing.origin + landing.pathname + landing.search, `${FRONTEND}/auth/callback?next=%2Fdoc`);
    assert.ok(!landing.hash.includes('ghu_'), 'token must not appear in the URL');

    const tokenCall = upstream.calls.find((c) => c.path === '/login/oauth/access_token');
    assert.equal(tokenCall.body.client_secret, 'gh-secret');
    assert.ok(tokenCall.body.code_verifier);

    const session = await (await post('/auth/session', { handoff: fragment.get('handoff') })).json();
    assert.equal(session.mode, 'direct');
    assert.equal(session.accessToken, 'ghu_user');
    assert.equal(session.refreshToken, 'ghr_1');
    assert.equal(session.user.login, 'hari');
  });

  it('university login (OIDC): returns a proxy session for the same flow', async () => {
    const { authorize, fragment } = await loginViaRedirect(app.base, 'helmholtz', upstream);
    assert.equal(authorize.origin + authorize.pathname, `${ISSUER}/auth`);
    assert.equal(authorize.searchParams.get('scope'), 'openid profile email');

    const session = await (await post('/auth/session', { handoff: fragment.get('handoff') })).json();
    assert.equal(session.mode, 'proxy');
    assert.equal(session.user.login, 'jdoe');
    assert.equal(session.user.providerLabel, 'Helmholtz ID');

    const me = await (await fetch(`${app.base}/auth/me`, { headers: { authorization: `Bearer ${session.accessToken}` } })).json();
    assert.equal(me.user.name, 'Jane Doe');
  });

  it('email + password via the password provider', async () => {
    const ok = await post('/auth/password', { username: 'demo@example.org', password: 'demo' });
    assert.equal(ok.status, 200);
    assert.equal((await ok.json()).mode, 'proxy');

    upstream.state.passwordOk = false;
    const bad = await post('/auth/password', { username: 'demo@example.org', password: 'nope' });
    upstream.state.passwordOk = true;
    assert.equal(bad.status, 401);
    assert.equal((await bad.json()).error, 'invalid_credentials');
  });

  it('refreshes an expiring GitHub token', async () => {
    const data = await (await post('/auth/github/refresh', { refreshToken: 'ghr_1' })).json();
    assert.equal(data.accessToken, 'ghu_refreshed');
  });

  it('rejects foreign returnTo (no open redirect) and forged state', async () => {
    const evil = await fetch(`${app.base}/auth/github/login?returnTo=${encodeURIComponent('https://evil.example/cb')}`, { redirect: 'manual' });
    assert.equal(evil.status, 400);

    const start = await fetch(`${app.base}/auth/github/login?returnTo=${encodeURIComponent(`${FRONTEND}/auth/callback`)}`, { redirect: 'manual' });
    const cookie = start.headers.get('set-cookie').split(';')[0];
    const cb = await fetch(`${app.base}/auth/github/callback?code=x&state=forged`, { redirect: 'manual', headers: { cookie } });
    assert.equal(new URLSearchParams(new URL(cb.headers.get('location')).hash.slice(1)).get('error'), 'state_mismatch');
  });

  it('sends the user back to the app with an error when a provider is down', async () => {
    const down = fakeUpstreams();
    const broken = await startApp(testConfig({ OIDC_HELMHOLTZ_ISSUER: 'https://down.test/oauth2' }), down.fetchImpl);
    const res = await fetch(`${broken.base}/auth/helmholtz/login?returnTo=${encodeURIComponent(`${FRONTEND}/auth/callback`)}`, { redirect: 'manual' });
    await broken.close();
    const landing = new URL(res.headers.get('location'));
    assert.equal(landing.origin, FRONTEND);
    assert.equal(new URLSearchParams(landing.hash.slice(1)).get('error'), 'oidc_discovery_failed');
  });

  it('answers CORS preflights only for allowed origins', async () => {
    const ok = await fetch(`${app.base}/auth/password`, { method: 'OPTIONS', headers: { origin: FRONTEND } });
    assert.equal(ok.headers.get('access-control-allow-origin'), FRONTEND);
    const other = await fetch(`${app.base}/auth/password`, { method: 'OPTIONS', headers: { origin: 'https://evil.example' } });
    assert.equal(other.headers.get('access-control-allow-origin'), null);
  });
});
