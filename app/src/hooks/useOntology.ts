import { useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { repositoryApi } from '@/api';
import { loadOntology, selectAuth, selectBranch, selectOntology, useAppDispatch, useAppSelector } from '@/store';

/** Query keys in one place, so cache invalidation stays consistent. */
export const ontologyKeys = {
  all: ['ontology'] as const,
  branches: () => [...ontologyKeys.all, 'branches'] as const,
};

export function useBranches() {
  return useQuery({ queryKey: ontologyKeys.branches(), queryFn: () => repositoryApi.listBranches() });
}

/**
 * Loads the ontology into Redux whenever the branch or the signed-in user changes.
 * Mounted once (AppLayout); every view reads the result with `useOntology()`.
 */
export function useOntologyLoader() {
  const dispatch = useAppDispatch();
  const branch = useAppSelector(selectBranch);
  const { status, user } = useAppSelector(selectAuth);
  const settled = status === 'anonymous' || status === 'authenticated';
  const signedIn = status === 'authenticated';
  const login = user?.login;

  useEffect(() => {
    if (!settled) return; // wait for the stored session to be restored
    const request = dispatch(loadOntology({ branch, signedIn }));
    return () => request.abort();
  }, [dispatch, branch, settled, signedIn, login]);
}

export const useOntology = () => useAppSelector(selectOntology);

/** Selected node (entity IRI, expression or axiom id) — kept in the URL: `?node=…`. */
export function useSelectedNode(): [string | null, (id: string | null) => void] {
  const [params, setParams] = useSearchParams();
  const select = useCallback(
    (id: string | null) =>
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        if (id) next.set('node', id);
        else next.delete('node');
        return next;
      }),
    [setParams],
  );
  return [params.get('node'), select];
}
