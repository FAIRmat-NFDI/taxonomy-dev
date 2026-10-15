import { HttpError } from '../lib/httpError.js';

/**
 * Generic OpenID Connect provider (Helmholtz ID, Keycloak, a NOMAD Keycloak, …).
 * Everything is read from the issuer's discovery document, so a new provider
 * is configuration only. Users of these providers have no GitHub token, so
 * they get a session token from this server and use the GitHub proxy
 * ("proxy" / on-behalf-of mode).
 */
export function createOidcProvider(cfg, fetchImpl = fetch) {
  const { id, label, issuer, clientId, clientSecret, scopes, showButton } = cfg;
  let discovery = null;

  async function meta() {
    if (!discovery) {
      discovery = (async () => {
        const res = await fetchImpl(`${issuer}/.well-known/openid-configuration`);
        if (!res.ok) throw new HttpError(502, 'oidc_discovery_failed', `${label}: discovery failed (${res.status}).`);
        const doc = await res.json();
        if (doc.issuer?.replace(/\/+$/, '') !== issuer) {
          throw new HttpError(502, 'oidc_issuer_mismatch', `${label}: issuer mismatch (${doc.issuer}).`);
        }
        return doc;
      })().catch((e) => {
        discovery = null; // retry on next call
        throw e;
      });
    }
    return discovery;
  }

  /** client_secret_basic when supported (RFC 6749 §2.3.1), otherwise client_secret_post. */
  function clientAuth(doc, params) {
    const methods = doc.token_endpoint_auth_methods_supported ?? ['client_secret_basic'];
    if (methods.includes('client_secret_basic')) {
      const basic = Buffer.from(`${encodeURIComponent(clientId)}:${encodeURIComponent(clientSecret)}`).toString('base64');
      return { headers: { Authorization: `Basic ${basic}` }, params };
    }
    return { headers: {}, params: { ...params, client_id: clientId, client_secret: clientSecret } };
  }

  async function tokenRequest(params) {
    const doc = await meta();
    const auth = clientAuth(doc, params);
    const res = await fetchImpl(doc.token_endpoint, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded', ...auth.headers },
      body: new URLSearchParams(auth.params),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.access_token) {
      const status = data.error === 'invalid_grant' ? 401 : 502;
      throw new HttpError(status, data.error ?? 'oidc_token_error', data.error_description ?? `${label}: token request failed (${res.status}).`);
    }
    return data;
  }

  /**
   * The ID token comes straight from the token endpoint over TLS, so its
   * signature check may be skipped (OIDC Core §3.1.3.7); issuer, audience,
   * expiry and nonce are still verified.
   */
  function checkIdToken(idToken, nonce) {
    if (!idToken) return;
    const claims = JSON.parse(Buffer.from(idToken.split('.')[1] ?? '', 'base64url').toString('utf8'));
    const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    const ok =
      claims.iss?.replace(/\/+$/, '') === issuer &&
      aud.includes(clientId) &&
      typeof claims.exp === 'number' &&
      claims.exp * 1000 > Date.now() &&
      (nonce === undefined || claims.nonce === nonce);
    if (!ok) throw new HttpError(401, 'invalid_id_token', `${label}: ID token validation failed.`);
  }

  async function fetchUser(accessToken) {
    const doc = await meta();
    const res = await fetchImpl(doc.userinfo_endpoint, { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' } });
    if (!res.ok) throw new HttpError(502, 'oidc_userinfo_failed', `${label}: userinfo failed (${res.status}).`);
    const c = await res.json();
    const name = c.name ?? ([c.given_name, c.family_name].filter(Boolean).join(' ') || undefined);
    return { id: c.sub, login: c.preferred_username ?? c.email ?? c.sub, name, email: c.email };
  }

  return {
    id,
    type: 'oidc',
    label,
    mode: 'proxy',
    showButton,

    async authorizeUrl({ redirectUri, state, nonce, codeChallenge }) {
      const doc = await meta();
      const url = new URL(doc.authorization_endpoint);
      url.search = new URLSearchParams({
        response_type: 'code',
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: scopes,
        state,
        nonce,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
      }).toString();
      return url.toString();
    },

    /** → { mode: 'proxy', user } — the controller turns this into a session token. */
    async completeLogin({ code, redirectUri, codeVerifier, nonce }) {
      const tokens = await tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: redirectUri, code_verifier: codeVerifier });
      checkIdToken(tokens.id_token, nonce);
      return { mode: 'proxy', user: await fetchUser(tokens.access_token) };
    },

    /** Email + password form (Resource Owner Password grant; Keycloak "Direct access grants"). */
    async passwordLogin(username, password) {
      const tokens = await tokenRequest({ grant_type: 'password', username, password, scope: scopes });
      checkIdToken(tokens.id_token);
      return { mode: 'proxy', user: await fetchUser(tokens.access_token) };
    },

    issuer,

    /** This backend's own token (client credentials grant), e.g. for Keycloak's Admin API. */
    async clientCredentialsToken() {
      return (await tokenRequest({ grant_type: 'client_credentials' })).access_token;
    },
  };
}
