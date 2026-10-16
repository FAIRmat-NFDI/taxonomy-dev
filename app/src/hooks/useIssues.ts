import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi, issuesApi, type CommentThread, type IssueComment } from '@/api';
import type { IssueDraft } from '@/components/issues/CreateIssueDialog';
import { indexIssues } from '@/components/issues/issueIndex';
import { config } from '@/config';
import { selectAuth, useAppSelector } from '@/store';
import { useOntology } from './useOntology';

/** React Query key root for everything issue-related. */
export const ISSUES_KEY = ['issues'] as const;
const listKey = (filePath: string) => [...ISSUES_KEY, config.issues.owner, config.issues.repo, filePath, 'open'] as const;
/** All open-issue lists (one per ontology file). */
const openLists = { queryKey: ISSUES_KEY, predicate: (q: { queryKey: readonly unknown[] }) => q.queryKey.at(-1) === 'open' };

/**
 * Who may create issues right now. For now only GitHub sign-ins (own token → api.github.com);
 * university / email sign-ins go through the backend on their behalf, which comes next.
 */
export function useIssuePermission(): { canCreate: boolean; reason: 'signed-out' | 'not-github' | null } {
  const { status, mode } = useAppSelector(selectAuth);
  if (status !== 'authenticated') return { canCreate: false, reason: 'signed-out' };
  if (mode !== 'direct') return { canCreate: false, reason: 'not-github' };
  return { canCreate: true, reason: null };
}

/**
 * Open issues about the loaded ontology file, resolved to the nodes of the model on screen
 * (see `indexIssues`). Loads once per file; reused for every selected node.
 */
export function useIssueIndex() {
  const { status, model, source } = useOntology();
  const filePath = source?.path ?? '';
  const query = useQuery({
    queryKey: listKey(filePath),
    queryFn: () => issuesApi.listThreads({ filePath, state: 'open' }),
    enabled: status === 'ready' && !!filePath,
  });
  const index = useMemo(
    () => (query.data && model && source ? indexIssues(query.data, model, source) : new Map<string, CommentThread[]>()),
    [query.data, model, source],
  );
  return {
    index,
    loading: query.isPending && query.fetchStatus !== 'idle',
    error: query.error ? issuesApi.issueErrorMessage(query.error) : null,
    refetch: query.refetch,
  };
}

/** Creates a GitHub issue for a node (title + Markdown body + hidden anchor). */
export function useCreateIssue() {
  const queryClient = useQueryClient();
  return useMutation<CommentThread, Error, IssueDraft>({
    mutationKey: [...ISSUES_KEY, 'create'],
    meta: { busyLabel: 'Creating issue…' },
    mutationFn: (draft) => write(() => issuesApi.createThread(draft)),
    // Show the new issue right away (newest first). No refetch: GitHub's list can lag a moment behind.
    onSuccess: (thread, draft) => {
      queryClient.setQueryData<CommentThread[]>(listKey(draft.anchor.filePath), (list) => (list ? [thread, ...list.filter((t) => t.id !== thread.id)] : list));
    },
  });
}

const commentsKey = (issueId: number) => [...ISSUES_KEY, config.issues.owner, config.issues.repo, 'comments', issueId] as const;

/** Runs a GitHub write with a fresh token and a readable error. */
async function write<T>(fn: () => Promise<T>): Promise<T> {
  try {
    await authApi.ensureFreshSession();
    return await fn();
  } catch (e) {
    throw new Error(issuesApi.issueErrorMessage(e), { cause: e });
  }
}

/** Comments of one issue — loaded only when the issue is expanded. */
export function useIssueComments(issue: CommentThread, enabled: boolean) {
  const query = useQuery({
    queryKey: commentsKey(issue.id),
    queryFn: () => issuesApi.listComments(issue.id),
    enabled: enabled && issue.comments > 0,
  });
  return {
    comments: issue.comments > 0 ? (query.data ?? []) : [],
    loading: query.isPending && query.fetchStatus !== 'idle',
    error: query.error ? issuesApi.issueErrorMessage(query.error) : null,
    refetch: query.refetch,
  };
}

/** Adds a comment; appends it to the timeline and bumps the issue's comment count. */
export function useAddComment(issue: CommentThread) {
  const queryClient = useQueryClient();
  return useMutation<IssueComment, Error, string>({
    mutationKey: [...ISSUES_KEY, 'comment', issue.id],
    meta: { busyLabel: 'Posting comment…' },
    mutationFn: (body) => write(() => issuesApi.addComment(issue.id, body)),
    onSuccess: (comment) => {
      queryClient.setQueryData<IssueComment[]>(commentsKey(issue.id), (list) => [...(list ?? []), comment]);
      queryClient.setQueriesData<CommentThread[]>(openLists, (list) => list?.map((t) => (t.id === issue.id ? { ...t, comments: t.comments + 1 } : t)));
    },
  });
}

/** Closes an issue (as completed); it then leaves the list of open issues. */
export function useCloseIssue() {
  const queryClient = useQueryClient();
  return useMutation<CommentThread, Error, CommentThread>({
    mutationKey: [...ISSUES_KEY, 'close'],
    meta: { busyLabel: 'Closing issue…' },
    mutationFn: (issue) => write(() => issuesApi.closeThread(issue.id)),
    onSuccess: (_, issue) => {
      queryClient.setQueriesData<CommentThread[]>(openLists, (list) => list?.filter((t) => t.id !== issue.id));
    },
  });
}
