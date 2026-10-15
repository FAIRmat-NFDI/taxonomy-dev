import { clearCookie, readCookie, setCookie } from '../lib/cookies.js';
import { HttpError } from '../lib/httpError.js';
import { codeChallengeS256, randomUrlSafe } from '../lib/pkce.js';

const STATE_COOKIE = 'tp_oauth';
const STATE_TTL_SECONDS = 10 * 60;
const HANDOFF_TTL_SECONDS = 2 * 60;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const str = (v) => (typeof v === 'string' ? v : Array.isArray(v) ? String(v[0]) : undefined);

/**
 * Login flows for all providers:
 *   GET  /auth/providers               which logins are available (frontend renders buttons from this)
 *   GET  /auth/:provider/login         → redirect to the provider (state + PKCE kept in a sealed cookie)
 *   GET  /auth/:provider/callback      ← provider; → redirect to frontend `returnTo#handoff=…`
 *   POST /auth/session                 hand-off → session JSON (keeps tokens out of URLs and logs)
 *   POST /auth/password                email + password (PASSWORD_PROVIDER, e.g. Keycloak)
 *   POST /auth/register                create an account (REGISTRATION_PROVIDER = Keycloak), then sign in
 *   POST /auth/github/refresh          refresh an expiring GitHub user token
 *   GET  /auth/me                      who owns this session token (proxy mode)
 *
 * Session JSON returned to the frontend:
 *   { mode: 'direct'|'proxy', provider, providerLabel, user, accessToken, refreshToken?, expiresAt? }
 *   direct → accessToken is a GitHub token (frontend calls api.github.com)
 *   proxy  → accessToken is this server's session token (frontend calls /github/*)
 */
export function createAuthController({ config, services }) {
  const { providers, tokens, passwordProvider, registration, githubApp } = services;
  const secure = config.publicUrl.startsWith('https://');
  const cookieOpts = { path: '/auth', secure };
  const redirectUri = (id) => `${config.publicUrl}/auth/${id}/callback`;

  function getProvider(id) {
    const provider = providers.get(id);
    if (!provider) throw new HttpError(404, 'unknown_provider', `Login provider "${id}" is not configured.`);
    return provider;
  }

  /** Only frontend origins we know may receive a login result (no open redirects). */
  function checkReturnTo(value) {
    try {
      const url = new URL(value);
      if (config.frontendOrigins.includes(url.origin)) return `${url.origin}${url.pathname}${url.search}`;
    } catch {
      /* fall through */
    }
    throw new HttpError(400, 'invalid_return_to', 'returnTo must be a URL on an allowed frontend origin (FRONTEND_ORIGINS).');
  }

  function toClientSession(provider, result) {
    if (result.mode === 'direct') {
      const { user, accessToken, refreshToken, expiresAt } = result;
      return { mode: 'direct', provider: provider.id, providerLabel: provider.label, user, accessToken, refreshToken, expiresAt };
    }
    const user = { ...result.user, providerLabel: provider.label };
    const accessToken = tokens.signSession({
      sub: `${provider.id}:${user.id}`,
      provider: provider.id,
      providerLabel: provider.label,
      login: user.login,
      name: user.name,
      email: user.email,
    });
    const expiresAt = Date.now() + tokens.sessionTtlSeconds * 1000;
    return { mode: 'proxy', provider: provider.id, providerLabel: provider.label, user, accessToken, expiresAt };
  }

  const toFrontend = (res, returnTo, params) => res.redirect(302, `${returnTo}#${new URLSearchParams(params)}`);

  return {
    listProviders(_req, res) {
      res.json({
        providers: [...providers.values()].map(({ id, label, type, mode, showButton }) => ({ id, label, type, mode, showButton })),
        password: passwordProvider ? { provider: passwordProvider.id, label: passwordProvider.label } : null,
        registration: registration ? { provider: registration.provider.id, label: registration.provider.label } : null,
        proxy: { enabled: githubApp.configured },
      });
    },

    async startLogin(req, res) {
      const provider = getProvider(req.params.provider);
      const returnTo = checkReturnTo(str(req.query.returnTo));
      const pending = {
        provider: provider.id,
        state: randomUrlSafe(24),
        nonce: randomUrlSafe(24),
        verifier: randomUrlSafe(48),
        returnTo,
      };
      let authorizeUrl;
      try {
        authorizeUrl = await provider.authorizeUrl({
          redirectUri: redirectUri(provider.id),
          state: pending.state,
          nonce: pending.nonce,
          codeChallenge: codeChallengeS256(pending.verifier),
        });
      } catch (e) {
        // e.g. the identity provider is down — send the user back to the app with a readable error
        return toFrontend(res, returnTo, { error: e.code ?? 'provider_unavailable', error_description: e.message });
      }
      setCookie(res, STATE_COOKIE, tokens.seal(pending, STATE_TTL_SECONDS), { ...cookieOpts, maxAgeSeconds: STATE_TTL_SECONDS });
      res.redirect(302, authorizeUrl);
    },

    async callback(req, res) {
      const provider = getProvider(req.params.provider);
      const sealed = readCookie(req, STATE_COOKIE);
      clearCookie(res, STATE_COOKIE, cookieOpts);
      if (!sealed) throw new HttpError(400, 'no_login_in_progress', 'No login in progress (cookie missing or expired).');
      const pending = tokens.unseal(sealed);

      const fail = (code, description) => toFrontend(res, pending.returnTo, { error: code, error_description: description });
      if (pending.provider !== provider.id || str(req.query.state) !== pending.state) {
        return fail('state_mismatch', 'Login state did not match. Please try again.');
      }
      if (req.query.error) return fail(str(req.query.error), str(req.query.error_description) ?? 'Login was cancelled.');

      try {
        const result = await provider.completeLogin({
          code: str(req.query.code),
          redirectUri: redirectUri(provider.id),
          codeVerifier: pending.verifier,
          nonce: pending.nonce,
        });
        toFrontend(res, pending.returnTo, { handoff: tokens.seal(toClientSession(provider, result), HANDOFF_TTL_SECONDS) });
      } catch (e) {
        fail(e.code ?? 'login_failed', e.message);
      }
    },

    exchangeHandoff(req, res) {
      const handoff = str(req.body?.handoff);
      if (!handoff) throw new HttpError(400, 'missing_handoff', 'Body must contain { handoff }.');
      res.json(tokens.unseal(handoff));
    },

    async passwordLogin(req, res) {
      if (!passwordProvider) throw new HttpError(501, 'password_login_disabled', 'Email and password sign-in is not configured.');
      const username = str(req.body?.username)?.trim();
      const password = str(req.body?.password);
      if (!username || !password) throw new HttpError(400, 'missing_credentials', 'Email and password are required.');
      try {
        res.json(toClientSession(passwordProvider, await passwordProvider.passwordLogin(username, password)));
      } catch (e) {
        if (e.code === 'invalid_grant') throw new HttpError(401, 'invalid_credentials', 'Wrong email or password.');
        throw e;
      }
    },

    async register(req, res) {
      if (!registration) throw new HttpError(501, 'registration_disabled', 'Creating accounts is not enabled.');
      const email = str(req.body?.email)?.trim().toLowerCase();
      const password = str(req.body?.password);
      const firstName = str(req.body?.firstName)?.trim();
      const lastName = str(req.body?.lastName)?.trim();
      if (!email || !EMAIL_PATTERN.test(email)) throw new HttpError(400, 'invalid_email', 'Enter a valid email address.');
      if (!password || password.length < 8) throw new HttpError(400, 'weak_password', 'Password must be at least 8 characters.');
      if (!firstName || !lastName || firstName.length > 100 || lastName.length > 100) {
        throw new HttpError(400, 'invalid_name', 'First and last name are required.');
      }

      await registration.createUser({ email, password, firstName, lastName });
      // Sign the new user straight in (same session as a normal email + password login).
      res.status(201).json(toClientSession(registration.provider, await registration.provider.passwordLogin(email, password)));
    },

    async refreshGitHub(req, res) {
      const refreshToken = str(req.body?.refreshToken);
      if (!refreshToken) throw new HttpError(400, 'missing_refresh_token', 'Body must contain { refreshToken }.');
      res.json(await getProvider('github').refresh(refreshToken));
    },

    me(req, res) {
      const s = req.session;
      res.json({
        mode: 'proxy',
        provider: s.provider,
        providerLabel: s.providerLabel,
        user: { id: s.sub, login: s.login, name: s.name, email: s.email, providerLabel: s.providerLabel },
        expiresAt: s.exp * 1000,
      });
    },
  };
}
