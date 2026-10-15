import { HttpError } from '../lib/httpError.js';

/**
 * On-behalf-of GitHub proxy for users without a GitHub account (Helmholtz ID,
 * Keycloak, …). Paths mirror the GitHub REST API exactly, so the frontend
 * builds the same request for both flows and only swaps the base URL + token:
 *
 *   direct:  https://api.github.com/repos/{o}/{r}/issues     (user's GitHub token)
 *   proxy:   https://<backend>/github/repos/{o}/{r}/issues    (session token → app token)
 *
 * Safety: only the routes below, only repositories in GITHUB_PROXY_REPOS,
 * only whitelisted body fields, and every write carries an attribution line.
 */
const REPO = String.raw`/repos/(?<owner>[^/]+)/(?<repo>[^/]+)`;

const ROUTES = [
  { method: 'GET', pattern: new RegExp(`^${REPO}$`) },
  { method: 'GET', pattern: new RegExp(`^${REPO}/branches$`) },
  { method: 'GET', pattern: new RegExp(`^${REPO}/contents(?:/.*)?$`) },
  { method: 'GET', pattern: new RegExp(`^${REPO}/git/blobs/[0-9a-f]{40}$`) },
  { method: 'GET', pattern: new RegExp(`^${REPO}/issues$`) },
  { method: 'GET', pattern: new RegExp(`^${REPO}/issues/\\d+$`) },
  { method: 'GET', pattern: new RegExp(`^${REPO}/issues/\\d+/comments$`) },
  { method: 'POST', pattern: new RegExp(`^${REPO}/issues$`), fields: ['title', 'body'], attribute: 'body' },
  { method: 'POST', pattern: new RegExp(`^${REPO}/issues/\\d+/comments$`), fields: ['body'], attribute: 'body' },
];

const QUERY_PARAMS = ['ref', 'per_page', 'page', 'state', 'sort', 'direction', 'since'];

export function attribution(user) {
  const who = user.name ? `**${user.name}** (${user.login})` : `**${user.login}**`;
  return `\n\n---\n<sub>Submitted via FAIRTaxonomy by ${who}, signed in with ${user.providerLabel}.</sub>`;
}

export function createGitHubProxy({ apiUrl, proxyRepos }, githubApp, fetchImpl = fetch) {
  /** True for ".", "..", and encoded forms like "%2e%2E" (URL parsers treat those as dot segments). */
  const isDotSegment = (seg) => {
    try {
      return /^\.{1,2}$/.test(decodeURIComponent(seg));
    } catch {
      return true; // malformed escape — reject
    }
  };

  function match(method, path) {
    if (path.split('/').some(isDotSegment)) return null;
    for (const route of ROUTES) {
      if (route.method !== method) continue;
      const m = route.pattern.exec(path);
      if (m) return { route, owner: m.groups.owner, repo: m.groups.repo };
    }
    return null;
  }

  return {
    match,

    /** → { status, contentType, body } — GitHub's response, passed through unchanged. */
    async forward({ method, path, query = {}, body, user }) {
      const hit = match(method, path);
      if (!hit) throw new HttpError(403, 'route_not_allowed', `${method} ${path} is not available through the proxy.`);
      if (!proxyRepos.includes(`${hit.owner}/${hit.repo}`.toLowerCase())) {
        throw new HttpError(403, 'repo_not_allowed', `${hit.owner}/${hit.repo} is not enabled for the proxy.`);
      }

      const params = new URLSearchParams();
      for (const key of QUERY_PARAMS) if (query[key] !== undefined) params.set(key, String(query[key]));

      let payload;
      if (hit.route.fields) {
        payload = Object.fromEntries(hit.route.fields.filter((f) => body?.[f] !== undefined).map((f) => [f, body[f]]));
        payload[hit.route.attribute] = `${payload[hit.route.attribute] ?? ''}${attribution(user)}`;
      }

      // Defense in depth: the URL we call must be exactly the path we checked (no normalization surprises).
      const target = new URL(`${apiUrl}${path}`);
      if (target.pathname !== path) throw new HttpError(403, 'route_not_allowed', 'Path is not allowed.');
      target.search = params.toString();

      const token = await githubApp.installationToken(hit.owner, hit.repo);
      const res = await fetchImpl(target.toString(), {
        method,
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'fairtaxonomy-backend',
          ...(payload && { 'Content-Type': 'application/json' }),
        },
        body: payload ? JSON.stringify(payload) : undefined,
      });

      return {
        status: res.status,
        contentType: res.headers.get('content-type') ?? 'application/json',
        body: Buffer.from(await res.arrayBuffer()),
      };
    },
  };
}
