import { createSign } from 'node:crypto';
import { HttpError } from '../lib/httpError.js';

/**
 * GitHub App identity for on-behalf-of calls: signs an app JWT (RS256) and
 * trades it for short-lived installation tokens, cached until shortly before
 * they expire. Only repositories where the app is installed are reachable.
 */
export function createGitHubApp({ appId, privateKey, apiUrl }, fetchImpl = fetch) {
  const installations = new Map(); // "owner/repo" → installation id
  const tokens = new Map(); // installation id → { token, expiresAt }
  const configured = Boolean(appId && privateKey);

  function appJwt() {
    const now = Math.floor(Date.now() / 1000);
    const enc = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const data = `${enc({ alg: 'RS256', typ: 'JWT' })}.${enc({ iat: now - 60, exp: now + 540, iss: appId })}`;
    const signature = createSign('RSA-SHA256').update(data).sign(privateKey, 'base64url');
    return `${data}.${signature}`;
  }

  async function call(method, path) {
    const res = await fetchImpl(`${apiUrl}${path}`, {
      method,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${appJwt()}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'fairtaxonomy-backend',
      },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const code = res.status === 404 ? 'app_not_installed' : 'github_app_error';
      throw new HttpError(res.status === 404 ? 403 : 502, code, data.message ?? `GitHub App request failed (${res.status}).`);
    }
    return data;
  }

  return {
    configured,

    async installationToken(owner, repo) {
      if (!configured) throw new HttpError(501, 'proxy_not_configured', 'GITHUB_APP_ID / GITHUB_APP_PRIVATE_KEY are not set.');
      const key = `${owner}/${repo}`.toLowerCase();

      let installationId = installations.get(key);
      if (!installationId) {
        installationId = (await call('GET', `/repos/${owner}/${repo}/installation`)).id;
        installations.set(key, installationId);
      }

      const cached = tokens.get(installationId);
      if (cached && cached.expiresAt - 5 * 60_000 > Date.now()) return cached.token;

      const data = await call('POST', `/app/installations/${installationId}/access_tokens`);
      tokens.set(installationId, { token: data.token, expiresAt: Date.parse(data.expires_at) });
      return data.token;
    },
  };
}
