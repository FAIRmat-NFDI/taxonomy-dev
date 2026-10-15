import { existsSync, readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { repositoryFromGit } from './lib/gitRepo.js';

/**
 * All configuration comes from environment variables (Render env vars in production —
 * synced from GitHub by .github/workflows/core.yml —, `.env` locally).
 * Nothing else in the app reads process.env.
 */
const list = (value) =>
  (value ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

const stripSlash = (url) => url.replace(/\/+$/, '');
/** Provider id, or null for empty / "off" / "none" (lets CI switch a feature off explicitly). */
const providerId = (value) => {
  const id = (value ?? '').trim().toLowerCase();
  return id && id !== 'off' && id !== 'none' ? id : null;
};

function readPrivateKey(env) {
  if (env.GITHUB_APP_PRIVATE_KEY) return env.GITHUB_APP_PRIVATE_KEY.replace(/\\n/g, '\n');
  if (env.GITHUB_APP_PRIVATE_KEY_FILE && existsSync(env.GITHUB_APP_PRIVATE_KEY_FILE)) {
    return readFileSync(env.GITHUB_APP_PRIVATE_KEY_FILE, 'utf8');
  }
  return '';
}

/** One OIDC provider per id in OIDC_PROVIDERS, configured by OIDC_<ID>_* variables. */
function readOidcProvider(id, env) {
  const key = (name) => env[`OIDC_${id.toUpperCase()}_${name}`];
  return {
    id,
    type: 'oidc',
    label: key('LABEL') || id,
    issuer: stripSlash(key('ISSUER') ?? ''),
    clientId: key('CLIENT_ID') ?? '',
    clientSecret: key('CLIENT_SECRET') ?? '',
    scopes: key('SCOPES') || 'openid profile email',
    /** Show a "Sign in with …" button for this provider in the frontend. */
    showButton: key('BUTTON') !== 'false',
  };
}

export function loadConfig(env = process.env) {
  const port = Number(env.PORT ?? 4000);
  const production = env.NODE_ENV === 'production';
  let sessionSecret = env.SESSION_SECRET ?? '';
  // Secure by default: production never runs with generated or development secrets.
  if (production && sessionSecret.length < 32) {
    throw new Error('SESSION_SECRET (≥ 32 characters) is required when NODE_ENV=production.');
  }
  if (!sessionSecret) {
    sessionSecret = randomBytes(32).toString('hex');
    console.warn('[config] SESSION_SECRET not set — using a random one (all sessions end on restart).');
  }

  return Object.freeze({
    port,
    /** This server's public URL; OAuth redirect URIs are built from it. */
    publicUrl: stripSlash(env.PUBLIC_URL || `http://localhost:${port}`),
    /** Frontend origins allowed for CORS and as post-login redirect targets. */
    frontendOrigins: list(env.FRONTEND_ORIGINS || 'http://localhost:5173').map((o) => stripSlash(o).toLowerCase()),
    sessionSecret,
    sessionTtlSeconds: Number(env.SESSION_TTL_SECONDS ?? 8 * 3600),

    github: {
      apiUrl: stripSlash(env.GITHUB_API_URL || 'https://api.github.com'),
      webUrl: stripSlash(env.GITHUB_WEB_URL || 'https://github.com'),
      /** GitHub App OAuth credentials — "Sign in with GitHub" (direct mode). */
      clientId: env.GITHUB_CLIENT_ID ?? '',
      clientSecret: env.GITHUB_CLIENT_SECRET ?? '',
      /** GitHub App identity — installation tokens for the on-behalf-of proxy. */
      appId: env.GITHUB_APP_ID ?? '',
      privateKey: readPrivateKey(env),
      /**
       * Repositories the proxy may touch, "owner/repo" (case-insensitive).
       * Defaults to this repository (git remote "origin"), which also holds main.ttl.
       */
      proxyRepos: list(env.GITHUB_PROXY_REPOS || repositoryFromGit()).map((r) => r.toLowerCase()),
    },

    // "off" / "none" (set by CI when nothing is configured) means no OIDC providers.
    oidc: list(env.OIDC_PROVIDERS)
      .map(providerId)
      .filter((id) => id !== null)
      .map((id) => readOidcProvider(id, env)),
    /** Which OIDC provider handles the email + password form (Resource Owner Password grant). */
    passwordProvider: providerId(env.PASSWORD_PROVIDER),
    /** Keycloak provider that accepts sign-ups from the web app (Admin API). Empty = registration off. */
    registrationProvider: providerId(env.REGISTRATION_PROVIDER),
    /** Max sign-ups per IP per hour. */
    registrationRateLimit: Number(env.REGISTRATION_RATE_LIMIT ?? 10),
  });
}

/** Loads backend/core/.env for local development (Node ≥ 22, no dotenv needed). */
export function loadDotEnv(path = '.env') {
  if (existsSync(path)) process.loadEnvFile(path);
}
