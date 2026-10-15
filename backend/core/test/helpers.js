import { generateKeyPairSync } from 'node:crypto';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';

export const FRONTEND = 'http://localhost:5173';
export const ISSUER = 'https://idp.test/realms/demo';

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');

/**
 * In-memory stand-ins for github.com, api.github.com and an OIDC provider.
 * Every upstream request is recorded in `calls` so tests can assert on it.
 */
export function fakeUpstreams() {
  const calls = [];
  const state = { lastNonce: undefined, passwordOk: true, users: new Set(['demo@example.org']), canManageUsers: true };

  async function fetchImpl(input, init = {}) {
    const url = new URL(String(input));
    const body = init.body instanceof URLSearchParams ? Object.fromEntries(init.body) : init.body ? JSON.parse(init.body) : undefined;
    const call = { method: init.method ?? 'GET', url: url.toString(), path: url.pathname, headers: init.headers ?? {}, body };
    calls.push(call);

    // ── GitHub OAuth + REST ──
    if (url.origin === 'https://github.com' && url.pathname === '/login/oauth/access_token') {
      if (body.grant_type === 'refresh_token') return json({ access_token: 'ghu_refreshed', refresh_token: 'ghr_2', expires_in: 28800 });
      if (!body.client_secret || !body.code_verifier) return json({ error: 'incorrect_client_credentials' });
      return json({ access_token: 'ghu_user', refresh_token: 'ghr_1', expires_in: 28800 });
    }
    if (url.origin === 'https://api.github.com') {
      if (url.pathname === '/user') return json({ id: 7, login: 'hari', name: 'Hari', avatar_url: 'https://avatars/x' });
      if (url.pathname === '/repos/FAIRmat-NFDI/ontology/installation') return json({ id: 99 });
      if (url.pathname === '/app/installations/99/access_tokens') {
        return json({ token: 'ghs_installation', expires_at: new Date(Date.now() + 3600_000).toISOString() }, 201);
      }
      if (url.pathname === '/repos/FAIRmat-NFDI/ontology/issues' && call.method === 'POST') return json({ number: 1, ...body }, 201);
      if (url.pathname.startsWith('/repos/FAIRmat-NFDI/ontology/')) return json({ ok: true, path: url.pathname, query: url.search });
      return json({ message: 'Not Found' }, 404);
    }

    // ── OIDC provider ──
    if (url.origin === 'https://idp.test') {
      if (url.pathname === '/realms/demo/.well-known/openid-configuration') {
        return json({
          issuer: ISSUER,
          authorization_endpoint: `${ISSUER}/auth`,
          token_endpoint: `${ISSUER}/token`,
          userinfo_endpoint: `${ISSUER}/userinfo`,
          token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post'],
        });
      }
      if (url.pathname === '/realms/demo/token') {
        if (!String(call.headers.Authorization ?? '').startsWith('Basic ')) return json({ error: 'invalid_client' }, 401);
        if (body.grant_type === 'client_credentials') return json({ access_token: 'svc_token', token_type: 'Bearer' });
        if (body.grant_type === 'password' && (!state.passwordOk || !state.users.has(body.username))) return json({ error: 'invalid_grant' }, 401);
        const idToken = `${b64({ alg: 'none' })}.${b64({
          iss: ISSUER,
          aud: 'client-1',
          exp: Math.floor(Date.now() / 1000) + 300,
          nonce: body.grant_type === 'password' ? undefined : state.lastNonce,
        })}.sig`;
        return json({ access_token: 'oidc_at', id_token: idToken, token_type: 'Bearer' });
      }
      if (url.pathname === '/admin/realms/demo/users' && call.method === 'POST') {
        if (call.headers.Authorization !== 'Bearer svc_token' || !state.canManageUsers) return json({ error: 'forbidden' }, 403);
        if (state.users.has(body.email)) return json({ errorMessage: 'User exists with same username' }, 409);
        state.users.add(body.email);
        return new Response(null, { status: 201 });
      }
      if (url.pathname === '/realms/demo/userinfo') {
        return json({ sub: 'u-123', preferred_username: 'jdoe', name: 'Jane Doe', email: 'jane@hzb.de' });
      }
    }
    return json({ message: `unexpected ${url}` }, 599);
  }

  return { fetchImpl, calls, state };
}

export function testConfig(overrides = {}) {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs1', format: 'pem' } });
  return loadConfig({
    PORT: '0',
    PUBLIC_URL: 'http://localhost:4000',
    FRONTEND_ORIGINS: FRONTEND,
    SESSION_SECRET: 'test-secret',
    GITHUB_CLIENT_ID: 'Iv23test',
    GITHUB_CLIENT_SECRET: 'gh-secret',
    GITHUB_APP_ID: '12345',
    GITHUB_APP_PRIVATE_KEY: privateKey,
    GITHUB_PROXY_REPOS: 'FAIRmat-NFDI/ontology',
    OIDC_PROVIDERS: 'helmholtz,keycloak',
    OIDC_HELMHOLTZ_LABEL: 'Helmholtz ID',
    OIDC_HELMHOLTZ_ISSUER: ISSUER,
    OIDC_HELMHOLTZ_CLIENT_ID: 'client-1',
    OIDC_HELMHOLTZ_CLIENT_SECRET: 'oidc-secret',
    OIDC_KEYCLOAK_LABEL: 'Email & password',
    OIDC_KEYCLOAK_ISSUER: ISSUER,
    OIDC_KEYCLOAK_CLIENT_ID: 'client-1',
    OIDC_KEYCLOAK_CLIENT_SECRET: 'oidc-secret',
    OIDC_KEYCLOAK_BUTTON: 'false',
    PASSWORD_PROVIDER: 'keycloak',
    REGISTRATION_PROVIDER: 'keycloak',
    REGISTRATION_RATE_LIMIT: '50',
    ...overrides,
  });
}

/** Starts the real app on a random port. */
export async function startApp(config, fetchImpl) {
  const server = createApp(config, { fetchImpl }).listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  return { base, close: () => new Promise((r) => server.close(r)) };
}

/** Browser-like login: /login → provider → /callback → frontend#handoff → POST /auth/session. */
export async function loginViaRedirect(base, providerId, upstream) {
  const returnTo = `${FRONTEND}/auth/callback?next=%2Fdoc`;
  const start = await fetch(`${base}/auth/${providerId}/login?returnTo=${encodeURIComponent(returnTo)}`, { redirect: 'manual' });
  const authorize = new URL(start.headers.get('location'));
  const cookie = start.headers.get('set-cookie').split(';')[0];
  upstream.state.lastNonce = authorize.searchParams.get('nonce');

  const cb = await fetch(`${base}/auth/${providerId}/callback?code=abc&state=${authorize.searchParams.get('state')}`, {
    redirect: 'manual',
    headers: { cookie },
  });
  const landing = new URL(cb.headers.get('location'));
  return { authorize, landing, fragment: new URLSearchParams(landing.hash.slice(1)) };
}
