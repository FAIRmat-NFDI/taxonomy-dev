import { config } from '@/config';
import { isAppError } from '../errors';
import type { CommentAnchor, CommentThread, IssueComment } from '../types';
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
  comments?: number;
  user: { login: string; avatar_url?: string; html_url?: string } | null;
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
  authorAvatarUrl: i.user?.avatar_url,
  authorUrl: i.user?.html_url,
  state: i.state,
  url: i.html_url,
  createdAt: i.created_at,
  comments: i.comments ?? 0,
  anchor: parseAnchor(i.body ?? ''),
});

const PAGE_SIZE = 100;
/** Upper bound on pages read per load (anonymous visitors have 60 GitHub requests per hour). */
const MAX_PAGES = 10;

/**
 * Issues of the issue repository that carry a FAIRTaxonomy anchor (newest first).
 * Pull requests are skipped; `filePath` keeps only issues about that ontology file.
 */
export async function listThreads(filter: { filePath?: string; state?: 'open' | 'closed' | 'all' } = {}): Promise<CommentThread[]> {
  const issues: GitHubIssue[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const batch = await gh.get<GitHubIssue[]>(`${repo()}/issues`, { state: filter.state ?? 'open', per_page: PAGE_SIZE, page });
    issues.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return issues
    .filter((i) => !i.pull_request)
    .map(toThread)
    .filter((t) => t.anchor && (!filter.filePath || t.anchor.filePath === filter.filePath));
}

export async function createThread(input: { title: string; body: string; anchor: CommentAnchor }): Promise<CommentThread> {
  const body = `${input.body.trimEnd()}\n\n<!-- fairtaxonomy:anchor ${JSON.stringify(input.anchor)} -->`;
  return toThread(await gh.post<GitHubIssue>(`${repo()}/issues`, { title: input.title, body }));
}

interface GitHubComment {
  id: number;
  body: string | null;
  html_url: string;
  created_at: string;
  user: { login: string; avatar_url?: string; html_url?: string } | null;
}

const toComment = (c: GitHubComment): IssueComment => ({
  id: c.id,
  author: c.user?.login ?? 'unknown',
  authorAvatarUrl: c.user?.avatar_url,
  authorUrl: c.user?.html_url,
  body: c.body ?? '',
  createdAt: c.created_at,
  url: c.html_url,
});

/** Comments of an issue, oldest first (like the GitHub timeline). */
export async function listComments(threadId: number): Promise<IssueComment[]> {
  const comments: GitHubComment[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const batch = await gh.get<GitHubComment[]>(`${repo()}/issues/${threadId}/comments`, { per_page: PAGE_SIZE, page });
    comments.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return comments.map(toComment);
}

export async function addComment(threadId: number, body: string): Promise<IssueComment> {
  return toComment(await gh.post<GitHubComment>(`${repo()}/issues/${threadId}/comments`, { body }));
}

/** Closes an issue as completed (GitHub's "Close issue"). */
export async function closeThread(threadId: number): Promise<CommentThread> {
  return toThread(await gh.patch<GitHubIssue>(`${repo()}/issues/${threadId}`, { state: 'closed', state_reason: 'completed' }));
}

/**
 * A readable reason for a failed issue request. GitHub's own messages are terse
 * ("Resource not accessible by integration"); these say what to do instead.
 */
export function issueErrorMessage(error: unknown): string {
  const target = `${config.issues.owner}/${config.issues.repo}`;
  if (!isAppError(error)) return error instanceof Error ? error.message : 'The issue request failed.';
  const detail = (error.cause as { message?: string } | undefined)?.message ?? '';
  switch (error.code) {
    case 'UNAUTHENTICATED':
      return 'Your GitHub sign-in has expired. Please sign in again.';
    case 'FORBIDDEN':
      return /integration/i.test(detail)
        ? `The FAIRTaxonomy GitHub App is not installed on ${target} (or lacks “Issues: write”). Ask a repository admin to install it.`
        : `GitHub did not allow this action on ${target}. (Closing an issue needs its author or a repository collaborator.)`;
    case 'NOT_FOUND':
      return `Repository ${target} was not found, or you have no access to it.`;
    case 'RATE_LIMITED':
      return 'GitHub rate limit reached. Please try again in a few minutes.';
    case 'NETWORK':
      return 'Could not reach GitHub. Check your connection and try again.';
    default:
      return /issues are disabled/i.test(detail) || /disabled/i.test(error.message)
        ? `Issues are disabled for ${target}.`
        : error.message;
  }
}
