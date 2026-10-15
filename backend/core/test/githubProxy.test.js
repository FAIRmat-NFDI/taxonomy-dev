import assert from 'node:assert/strict';
import http from 'node:http';
import { after, before, describe, it } from 'node:test';
import { fakeUpstreams, startApp, testConfig } from './helpers.js';

describe('GitHub on-behalf-of proxy', () => {
  const upstream = fakeUpstreams();
  let app;
  let token;

  before(async () => {
    app = await startApp(testConfig(), upstream.fetchImpl);
    const res = await fetch(`${app.base}/auth/password`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'demo@example.org', password: 'demo' }),
    });
    token = (await res.json()).accessToken;
  });
  after(() => app.close());

  const gh = (method, path, body) =>
    fetch(`${app.base}/github${path}`, {
      method,
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: body && JSON.stringify(body),
    });

  it('mirrors GitHub paths and uses an installation token', async () => {
    const res = await gh('GET', '/repos/FAIRmat-NFDI/ontology/contents/ontology/main.ttl?ref=dev&evil=1');
    assert.equal(res.status, 200);
    const forwarded = upstream.calls.at(-1);
    assert.equal(forwarded.url, 'https://api.github.com/repos/FAIRmat-NFDI/ontology/contents/ontology/main.ttl?ref=dev');
    assert.equal(forwarded.headers.Authorization, 'Bearer ghs_installation');
  });

  it('creates issues with the same payload as GitHub, adding attribution and dropping extra fields', async () => {
    const res = await gh('POST', '/repos/FAIRmat-NFDI/ontology/issues', { title: 'Typo', body: 'Fix label', assignees: ['someone'] });
    assert.equal(res.status, 201);
    const sent = upstream.calls.at(-1).body;
    assert.deepEqual(Object.keys(sent).sort(), ['body', 'title']);
    assert.equal(sent.title, 'Typo');
    assert.equal(
      sent.body,
      'Fix label\n\n---\n<sub>Submitted via FAIRTaxonomy by **Jane Doe** (jdoe), signed in with Email & password.</sub>',
    );
  });

  it('caches the installation token', async () => {
    const before = upstream.calls.filter((c) => c.path.endsWith('/access_tokens')).length;
    await gh('GET', '/repos/FAIRmat-NFDI/ontology/branches');
    assert.equal(upstream.calls.filter((c) => c.path.endsWith('/access_tokens')).length, before);
  });

  it('blocks other repositories, other routes and anonymous calls', async () => {
    assert.equal((await gh('GET', '/repos/someone/else/issues')).status, 403);
    assert.equal((await gh('DELETE', '/repos/FAIRmat-NFDI/ontology')).status, 403);
    assert.equal((await gh('GET', '/user')).status, 403);
    const anon = await fetch(`${app.base}/github/repos/FAIRmat-NFDI/ontology/issues`);
    assert.equal(anon.status, 401);
  });

  it('blocks encoded dot-segments sent raw (no client-side normalization)', async () => {
    const forwardedBefore = upstream.calls.length;
    for (const raw of [
      '/github/repos/FAIRmat-NFDI/ontology/contents/%2E%2E/%2E%2E/someone/else/issues',
      '/github/repos/FAIRmat-NFDI/ontology/contents/%2e%2e/x',
      '/github/repos/FAIRmat-NFDI/ontology/contents/./x',
    ]) {
      const status = await rawGet(raw);
      assert.equal(status, 403, raw);
    }
    assert.equal(upstream.calls.length, forwardedBefore, 'nothing may be forwarded');
  });

  function rawGet(path) {
    const { hostname, port } = new URL(app.base);
    return new Promise((resolve, reject) => {
      const req = http.request({ hostname, port, path, method: 'GET', headers: { authorization: `Bearer ${token}` } }, (res) => {
        res.resume();
        resolve(res.statusCode);
      });
      req.on('error', reject);
      req.end();
    });
  }
});
