import { config } from '@/config';
import { request, type ApiTarget, type Query } from '../http';
import { getSession } from '../session';
import type { Session } from '../types';

/**
 * Where GitHub REST calls go for the current user. Paths and JSON payloads are
 * identical in both cases — only base URL and token differ:
 *
 *   anonymous / direct  → https://api.github.com        (no token / user's GitHub token)
 *   proxy               → <API_BASE_URL>/github         (backend session token; backend acts on behalf)
 */
export function githubTarget(session: Session | null = getSession()): ApiTarget {
  const headers = { Accept: 'application/vnd.github+json' };
  if (session?.mode === 'proxy') return { baseUrl: `${config.apiBaseUrl}/github`, token: session.accessToken, headers };
  return { baseUrl: config.githubApiUrl, token: session?.accessToken ?? null, headers };
}

/** GitHub REST, routed by session mode. Repository/issue functions only ever use this. */
export const gh = {
  get: <T>(path: string, query?: Query) => request<T>(githubTarget(), 'GET', path, { query }),
  post: <T>(path: string, body: unknown) => request<T>(githubTarget(), 'POST', path, { body }),
};

/** "owner/repo" path prefix with each part URL-encoded. */
export const repoPath = (owner: string, repo: string) => `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;

/** Encodes a file path segment by segment (keeps the slashes). */
export const encodePath = (path: string) => path.split('/').map(encodeURIComponent).join('/');
