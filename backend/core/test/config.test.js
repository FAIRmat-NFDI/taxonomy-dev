import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadConfig } from '../src/config.js';

test('production refuses to start without a strong SESSION_SECRET', () => {
  assert.throws(() => loadConfig({ NODE_ENV: 'production' }), /SESSION_SECRET/);
  assert.throws(() => loadConfig({ NODE_ENV: 'production', SESSION_SECRET: 'short' }), /SESSION_SECRET/);
  assert.doesNotThrow(() => loadConfig({ NODE_ENV: 'production', SESSION_SECRET: 'x'.repeat(64), GITHUB_PROXY_REPOS: 'a/b' }));
});

test('frontend origins are compared case-insensitively', () => {
  const config = loadConfig({ FRONTEND_ORIGINS: 'https://FAIRmat-NFDI.github.io/', GITHUB_PROXY_REPOS: 'a/b' });
  assert.deepEqual(config.frontendOrigins, ['https://fairmat-nfdi.github.io']);
});

test('"off" switches logins off (CI sets it when nothing is configured)', () => {
  const config = loadConfig({ OIDC_PROVIDERS: 'off', PASSWORD_PROVIDER: 'off', REGISTRATION_PROVIDER: 'off', GITHUB_PROXY_REPOS: 'a/b' });
  assert.deepEqual(config.oidc, []);
  assert.equal(config.passwordProvider, null);
  assert.equal(config.registrationProvider, null);
  assert.deepEqual(
    loadConfig({ OIDC_PROVIDERS: 'helmholtz, Keycloak', GITHUB_PROXY_REPOS: 'a/b' }).oidc.map((p) => p.id),
    ['helmholtz', 'keycloak'],
  );
});
