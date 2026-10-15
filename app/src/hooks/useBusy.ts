import { useCallback, useId } from 'react';
import { useIsFetching, useIsMutating } from '@tanstack/react-query';
import { busyEnded, busyStarted, selectAuth, selectBusyTasks, selectOntology, useAppDispatch, useAppSelector } from '@/store';

/** Marks a non-network task (e.g. a graph layout) as running, so the busy overlay shows. */
export function useBusyTask() {
  const dispatch = useAppDispatch();
  const id = useId();
  const start = useCallback((label: string) => dispatch(busyStarted({ id, label })), [dispatch, id]);
  const end = useCallback(() => dispatch(busyEnded(id)), [dispatch, id]);
  return { start, end };
}

/**
 * Everything the app may be waiting for, in one place:
 * ontology loading (GitHub + parsing in the worker), sign-in, other GitHub requests
 * (React Query) and local tasks. `label` is null when idle; `local` = only local tasks.
 */
export function useBusy(): { label: string | null; local: boolean } {
  const ontology = useAppSelector(selectOntology);
  const auth = useAppSelector(selectAuth);
  const tasks = useAppSelector(selectBusyTasks);
  const fetching = useIsFetching();
  const mutating = useIsMutating();

  const local = Object.values(tasks)[0];
  if (ontology.status === 'loading') return { label: 'Loading ontology…', local: false };
  if (auth.status === 'exchanging' || auth.status === 'signingIn') return { label: 'Signing in…', local: false };
  if (mutating) return { label: 'Saving…', local: false };
  if (local) return { label: local, local: true };
  if (fetching) return { label: 'Loading…', local: false };
  return { label: null, local: false };
}
