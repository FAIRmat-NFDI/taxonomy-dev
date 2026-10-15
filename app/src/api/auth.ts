import { authCallbackUrl, config } from '@/config';
import { AppError } from './errors';
import { githubTarget } from './github/client';
import { request } from './http';
import { clearSession, getSession, loadStoredSession, setSession, toSessionInfo, updateSession } from './session';
import type { AuthUser, LoginOptions, NewAccount, Session, SessionInfo } from './types';

/**
 * Sign-in for all login types. The backend does the parts a browser can't
 * (secrets, code→token exchange); the result is always a `Session`:
 *   GitHub              → mode 'direct' (GitHub token; frontend calls api.github.com)
 *   University / email  → mode 'proxy'  (backend session token; GitHub via backend proxy)
 *   Personal token      → mode 'direct' (developer fallback, no backend needed)
 */
const backend = { baseUrl: config.apiBaseUrl };
const REMEMBER_KEY = 'tp.auth.remember';
/** Refresh GitHub tokens a minute early to avoid racing in-flight requests. */
const EXPIRY_SKEW_MS = 60_000;

const NO_BACKEND: LoginOptions = { available: false, providers: [], password: null, registration: null, proxy: { enabled: false } };

/** Which logins the backend offers. Never throws — a down backend just means "token login only". */
export async function getLoginOptions(): Promise<LoginOptions> {
  try {
    const data = await request<Omit<LoginOptions, 'available'>>(backend, 'GET', '/auth/providers');
    return { available: true, ...data };
  } catch {
    return NO_BACKEND;
  }
}

/** Redirect login (GitHub, Helmholtz ID, any OIDC provider). Leaves the app. */
export function beginLogin(providerId: string, next: string, remember: boolean): void {
  try {
    sessionStorage.setItem(REMEMBER_KEY, remember ? '1' : '0');
  } catch {
    /* ignore */
  }
  const returnTo = encodeURIComponent(authCallbackUrl(next));
  window.location.assign(`${config.apiBaseUrl}/auth/${encodeURIComponent(providerId)}/login?returnTo=${returnTo}`);
}

/** On /auth/callback: trade the one-time hand-off from the URL fragment for the session. */
export async function completeLogin(fragment: string): Promise<SessionInfo> {
  const params = new URLSearchParams(fragment.replace(/^#/, ''));
  const error = params.get('error');
  if (error) throw new AppError('UNAUTHENTICATED', params.get('error_description') ?? `Login failed (${error}).`);
  const handoff = params.get('handoff');
  if (!handoff) throw new AppError('UNAUTHENTICATED', 'No login result found. Please try again.');

  const session = await request<Session>(backend, 'POST', '/auth/session', { body: { handoff } });
  let remember = false;
  try {
    remember = sessionStorage.getItem(REMEMBER_KEY) === '1';
    sessionStorage.removeItem(REMEMBER_KEY);
  } catch {
    /* ignore */
  }
  setSession(session, remember);
  return toSessionInfo(session);
}

/** Email + password (handled by the backend's password provider, e.g. Keycloak). */
export async function passwordLogin(username: string, password: string, remember: boolean): Promise<SessionInfo> {
  const session = await request<Session>(backend, 'POST', '/auth/password', { body: { username, password } });
  setSession(session, remember);
  return toSessionInfo(session);
}

/** Creates an account (backend → Keycloak, no email verification) and signs the user in. */
export async function register(account: NewAccount, remember: boolean): Promise<SessionInfo> {
  const session = await request<Session>(backend, 'POST', '/auth/register', { body: account });
  setSession(session, remember);
  return toSessionInfo(session);
}

async function fetchGitHubUser(token: string): Promise<AuthUser> {
  const u = await request<{ id: number; login: string; name: string | null; avatar_url: string }>(
    githubTarget({ mode: 'direct', accessToken: token } as Session),
    'GET',
    '/user',
  );
  return { id: String(u.id), login: u.login, name: u.name ?? undefined, avatarUrl: u.avatar_url, providerLabel: 'GitHub' };
}

/** Developer fallback: a personal access token used directly against GitHub. */
export async function signInWithToken(token: string, remember: boolean): Promise<SessionInfo> {
  const accessToken = token.trim();
  const user = await fetchGitHubUser(accessToken);
  const session: Session = { mode: 'direct', provider: 'token', providerLabel: 'GitHub token', user, accessToken };
  setSession(session, remember);
  return toSessionInfo(session);
}

/** Refreshes an expiring GitHub user token through the backend (needs the app secret). */
async function refreshGitHubToken(session: Session): Promise<void> {
  const tokens = await request<Pick<Session, 'accessToken' | 'refreshToken' | 'expiresAt'>>(backend, 'POST', '/auth/github/refresh', {
    body: { refreshToken: session.refreshToken },
  });
  updateSession(tokens);
}

/** Resumes a stored session after a reload; validates (and refreshes) it, or clears it. */
export async function restoreSession(): Promise<SessionInfo | null> {
  const stored = loadStoredSession();
  if (!stored) return null;
  try {
    const expired = stored.expiresAt !== undefined && stored.expiresAt - EXPIRY_SKEW_MS < Date.now();
    if (stored.mode === 'proxy') {
      if (expired) throw new AppError('UNAUTHENTICATED', 'Session expired');
      const me = await request<Pick<Session, 'user'>>({ ...backend, token: stored.accessToken }, 'GET', '/auth/me');
      updateSession({ user: me.user });
    } else {
      if (expired) {
        if (!stored.refreshToken) throw new AppError('UNAUTHENTICATED', 'Session expired');
        await refreshGitHubToken(stored);
      }
      await fetchGitHubUser(getSession()!.accessToken);
    }
    return toSessionInfo(getSession()!);
  } catch {
    clearSession();
    return null;
  }
}

/** Ends the session in this browser. (Backend sessions are stateless and simply expire.) */
export async function signOut(): Promise<void> {
  clearSession();
}

/** Pre-filled GitHub "new fine-grained token" page (developer fallback). */
export function tokenCreationUrl(): string {
  const params = new URLSearchParams({
    name: 'FAIRTaxonomy',
    description: 'Sign-in token for FAIRTaxonomy (read ontology files, comment via issues).',
    expires_in: '30',
    ...config.tokenPermissions,
  });
  if (config.source.owner) params.set('target_name', config.source.owner);
  return `https://github.com/settings/personal-access-tokens/new?${params}`;
}
