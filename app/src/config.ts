/**
 * Build-time configuration — the only module that reads `import.meta.env`.
 * All values are public (they end up in the bundle). Never put secrets here.
 */
const env = import.meta.env;

const owner = env.VITE_GH_OWNER ?? '';
const repo = env.VITE_GH_REPO ?? '';
const stripSlash = (url: string) => url.replace(/\/+$/, '');

/** In-app route the backend redirects to after a provider login. */
export const AUTH_CALLBACK_PATH = '/auth/callback';

export const config = Object.freeze({
  /** Repository that holds the ontology. */
  source: {
    owner,
    repo,
    branch: env.VITE_GH_BRANCH || 'main',
    /** File at the repository root by default. */
    path: env.VITE_ONTOLOGY_PATH || 'main.ttl',
  },
  /**
   * Signed-out visitors can read unprotected branches of a public repository.
   * Protected branches need sign-in unless VITE_PROTECTED_BRANCHES_PUBLIC=true.
   */
  access: {
    protectedBranchesRequireLogin: env.VITE_PROTECTED_BRANCHES_PUBLIC !== 'true',
  },
  /** Repository where comment issues are created (defaults to the source repo). */
  issues: {
    owner: env.VITE_GH_ISSUES_OWNER || owner,
    repo: env.VITE_GH_ISSUES_REPO || repo,
  },
  /**
   * Backend (auth + GitHub proxy). Any URL: another domain (Render), or a path
   * like "/api" if frontend and backend are ever served from the same origin.
   */
  apiBaseUrl: stripSlash(env.VITE_API_BASE_URL || 'http://localhost:4000'),
  /** GitHub REST API for direct (own GitHub token) and anonymous calls. */
  githubApiUrl: stripSlash(env.VITE_GITHUB_API_URL || 'https://api.github.com'),
  /** Raw file host, used for anonymous reads of public repositories. */
  githubRawUrl: stripSlash(env.VITE_GITHUB_RAW_URL || 'https://raw.githubusercontent.com'),
  /** Web UI, used for "view on GitHub" line links. */
  githubWebUrl: stripSlash(env.VITE_GITHUB_WEB_URL || 'https://github.com'),
  /** Permissions requested when a user creates a personal access token (developer fallback). */
  tokenPermissions: { contents: 'read', issues: 'write' } as Record<string, 'read' | 'write'>,
});

/** Absolute URL of the login callback page (sent to the backend as `returnTo`). */
export function authCallbackUrl(next: string): string {
  const base = env.BASE_URL.replace(/\/$/, '');
  return `${window.location.origin}${base}${AUTH_CALLBACK_PATH}?next=${encodeURIComponent(next)}`;
}

export type AppConfig = typeof config;
