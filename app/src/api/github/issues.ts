import { config } from '@/config';
import type { CommentAnchor, CommentThread } from '../types';
import { gh, repoPath } from './client';

/**
 * Comments = GitHub Issues in config.issues. One code path for both login
 * types: the request is the same; githubTarget() decides whether it goes to
 * api.github.com (own token) or the backend proxy (on-behalf-of + attribution).
 *
 * The anchor (file, entity IRI, lines) is stored as a hidden marker in the body.
 */
const ANCHOR_RE = /<!-- fairtaxonomy:anchor (\{.*?\}) -->/;
const repo = () => repoPath(config.issues.owner, config.issues.repo);

interface GitHubIssue {
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  html_url: string;
  created_at: string;
  user: { login: string } | null;
  pull_request?: unknown;
}

function parseAnchor(body: string): CommentAnchor | null {
  const m = ANCHOR_RE.exec(body);
  if (!m) return null;
  try {
    return JSON.parse(m[1]!) as CommentAnchor;
  } catch {
    return null;
  }
}

const toThread = (i: GitHubIssue): CommentThread => ({
  id: i.number,
  title: i.title,
  body: (i.body ?? '').replace(ANCHOR_RE, '').trim(),
  author: i.user?.login ?? 'unknown',
  state: i.state,
  url: i.html_url,
  createdAt: i.created_at,
  anchor: parseAnchor(i.body ?? ''),
});

export async function listThreads(filter: { filePath?: string; state?: 'open' | 'closed' | 'all' } = {}): Promise<CommentThread[]> {
  const issues = await gh.get<GitHubIssue[]>(`${repo()}/issues`, { state: filter.state ?? 'open', per_page: 100 });
  return issues
    .filter((i) => !i.pull_request)
    .map(toThread)
    .filter((t) => !filter.filePath || t.anchor?.filePath === filter.filePath);
}

export async function createThread(input: { title: string; body: string; anchor: CommentAnchor }): Promise<CommentThread> {
  const body = `${input.body}\n\n<!-- fairtaxonomy:anchor ${JSON.stringify(input.anchor)} -->`;
  return toThread(await gh.post<GitHubIssue>(`${repo()}/issues`, { title: input.title, body }));
}

export async function addComment(threadId: number, body: string): Promise<void> {
  await gh.post(`${repo()}/issues/${threadId}/comments`, { body });
}
