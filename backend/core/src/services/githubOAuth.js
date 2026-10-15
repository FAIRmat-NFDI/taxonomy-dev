import { HttpError } from '../lib/httpError.js';

/**
 * "Sign in with GitHub" — the GitHub wrapper.
 * GitHub's token endpoint needs the client secret and has no CORS, so this
 * server performs the code → token exchange (and refresh). The resulting
 * GitHub token is handed to the frontend, which then calls api.github.com
 * directly ("direct" mode). This server stores nothing.
 */
export function createGitHubOAuthProvider({ clientId, clientSecret, webUrl, apiUrl }, fetchImpl = fetch) {
  async function tokenRequest(params) {
    const res = await fetchImpl(`${webUrl}/login/oauth/access_token`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, ...params }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error || !data.access_token) {
      const status = data.error === 'bad_refresh_token' ? 401 : 502;
      throw new HttpError(status, data.error ?? 'github_token_error', data.error_description ?? `GitHub token request failed (${res.status}).`);
    }
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
    };
  }

  async function fetchUser(accessToken) {
    const res = await fetchImpl(`${apiUrl}/user`, {
      headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${accessToken}`, 'User-Agent': 'fairtaxonomy-backend' },
    });
    if (!res.ok) throw new HttpError(502, 'github_user_error', `Could not read the GitHub user (${res.status}).`);
    const u = await res.json();
    return { id: String(u.id), login: u.login, name: u.name ?? undefined, email: u.email ?? undefined, avatarUrl: u.avatar_url };
  }

  return {
    id: 'github',
    type: 'github',
    label: 'GitHub',
    mode: 'direct',
    showButton: true,
    supportsPassword: false,

    async authorizeUrl({ redirectUri, state, codeChallenge }) {
      const url = new URL(`${webUrl}/login/oauth/authorize`);
      url.search = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        state,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        allow_signup: 'true',
      }).toString();
      return url.toString();
    },

    /** → { mode: 'direct', user, accessToken (GitHub), refreshToken, expiresAt } */
    async completeLogin({ code, redirectUri, codeVerifier }) {
      const tokens = await tokenRequest({ code, redirect_uri: redirectUri, code_verifier: codeVerifier });
      return { mode: 'direct', user: await fetchUser(tokens.accessToken), ...tokens };
    },

    /** GitHub App user tokens expire (8h by default); refreshing needs the secret too. */
    refresh: (refreshToken) => tokenRequest({ grant_type: 'refresh_token', refresh_token: refreshToken }),
  };
}
