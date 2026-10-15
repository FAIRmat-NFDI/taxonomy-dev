import { useCallback, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi, type NewAccount } from '@/api';
import {
  beginLogin as beginLoginThunk,
  clearAuthError,
  passwordLogin as passwordLoginThunk,
  register as registerThunk,
  restoreSession,
  selectAuth,
  signInWithToken as signInWithTokenThunk,
  signOut as signOutThunk,
  useAppDispatch,
  useAppSelector,
} from '@/store';

/**
 * Call once in the layout:
 *  - restores a stored session on start;
 *  - refetches GitHub data whenever the signed-in user changes.
 */
export function useAuthBootstrap() {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const auth = useAppSelector(selectAuth);
  const identity = auth.user ? `${auth.provider}:${auth.user.login}` : null;
  const previous = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    void dispatch(restoreSession());
  }, [dispatch]);

  useEffect(() => {
    if (previous.current !== undefined && previous.current !== identity) void queryClient.invalidateQueries();
    previous.current = identity;
  }, [identity, queryClient]);
}

/** Which logins the backend offers (cached; a down backend yields `available: false`). */
export function useLoginOptions() {
  return useQuery({ queryKey: ['auth', 'options'], queryFn: authApi.getLoginOptions, staleTime: 10 * 60_000 });
}

/** Session state and actions for components. */
export function useAuth() {
  const dispatch = useAppDispatch();
  const { user, status, error, provider, providerLabel, mode } = useAppSelector(selectAuth);

  /** Redirect login (GitHub, university, …). `next` = in-app path to return to. */
  const beginLogin = useCallback(
    (providerId: string, next: string, remember: boolean) => dispatch(beginLoginThunk({ provider: providerId, next, remember })).unwrap(),
    [dispatch],
  );
  const passwordLogin = useCallback(
    (username: string, password: string, remember: boolean) => dispatch(passwordLoginThunk({ username, password, remember })).unwrap(),
    [dispatch],
  );
  const register = useCallback(
    (account: NewAccount, remember: boolean) => dispatch(registerThunk({ account, remember })).unwrap(),
    [dispatch],
  );
  const signInWithToken = useCallback(
    (token: string, remember: boolean) => dispatch(signInWithTokenThunk({ token, remember })).unwrap(),
    [dispatch],
  );
  const signOut = useCallback(() => dispatch(signOutThunk()).unwrap(), [dispatch]);
  const clearError = useCallback(() => dispatch(clearAuthError()), [dispatch]);

  return {
    user,
    status,
    error,
    provider,
    providerLabel,
    mode,
    resolving: status === 'unknown' || status === 'exchanging',
    signingIn: status === 'signingIn',
    redirecting: status === 'redirecting',
    beginLogin,
    passwordLogin,
    register,
    signInWithToken,
    signOut,
    clearError,
  };
}
