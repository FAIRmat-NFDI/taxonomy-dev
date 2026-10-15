import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { fakeUpstreams, startApp, testConfig } from './helpers.js';

describe('registration (web app form → Keycloak Admin API)', () => {
  const upstream = fakeUpstreams();
  let app;
  before(async () => (app = await startApp(testConfig(), upstream.fetchImpl)));
  after(() => app.close());

  const register = (body) =>
    fetch(`${app.base}/auth/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const valid = { email: 'New.User@HZB.de', password: 'longenough', firstName: 'New', lastName: 'User' };

  it('is advertised to the frontend', async () => {
    const data = await (await fetch(`${app.base}/auth/providers`)).json();
    assert.deepEqual(data.registration, { provider: 'keycloak', label: 'Email & password' });
  });

  it('creates a verified user with the service account and signs them in', async () => {
    const res = await register(valid);
    assert.equal(res.status, 201);
    const session = await res.json();
    assert.equal(session.mode, 'proxy');
    assert.ok(session.accessToken);

    const created = upstream.calls.find((c) => c.path === '/admin/realms/demo/users');
    assert.equal(created.headers.Authorization, 'Bearer svc_token');
    assert.equal(created.body.email, 'new.user@hzb.de'); // normalized
    assert.equal(created.body.emailVerified, true);
    assert.deepEqual(created.body.credentials, [{ type: 'password', value: 'longenough', temporary: false }]);
  });

  it('reports an existing account clearly', async () => {
    const res = await register({ ...valid, email: 'demo@example.org' });
    assert.equal(res.status, 409);
    assert.equal((await res.json()).error, 'account_exists');
  });

  it('validates input before calling Keycloak', async () => {
    const before = upstream.calls.length;
    assert.equal((await register({ ...valid, email: 'not-an-email' })).status, 400);
    assert.equal((await register({ ...valid, password: 'short' })).status, 400);
    assert.equal((await register({ ...valid, lastName: '' })).status, 400);
    assert.equal(upstream.calls.length, before);
  });

  it('explains a missing manage-users role', async () => {
    upstream.state.canManageUsers = false;
    const res = await register({ ...valid, email: 'other@hzb.de' });
    upstream.state.canManageUsers = true;
    assert.equal((await res.json()).error, 'registration_misconfigured');
  });

  it('rate-limits sign-up attempts per IP', async () => {
    const limited = await startApp(testConfig({ REGISTRATION_RATE_LIMIT: '2' }), fakeUpstreams().fetchImpl);
    const statuses = [];
    for (let i = 0; i < 3; i++) {
      const res = await fetch(`${limited.base}/auth/register`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...valid, email: `bulk${i}@hzb.de` }),
      });
      statuses.push(res.status);
    }
    await limited.close();
    assert.deepEqual(statuses, [201, 201, 429]);
  });
});
