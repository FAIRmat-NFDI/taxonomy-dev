import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authApi, type SessionInfo } from '@/api';
import type * as Api from '@/api';
import { makeStore } from './index';
import { completeLogin, passwordLogin, restoreSession, signInWithToken, signOut } from './authSlice';

vi.mock('@/api', async (importOriginal) => {
  const actual = await importOriginal<typeof Api>();
  return {
    ...actual,
    authApi: {
      restoreSession: vi.fn(),
      beginLogin: vi.fn(),
      completeLogin: vi.fn(),
      passwordLogin: vi.fn(),
      signInWithToken: vi.fn(),
      signOut: vi.fn(),
      getLoginOptions: vi.fn(),
      tokenCreationUrl: vi.fn(),
    },
  };
});

const github: SessionInfo = { mode: 'direct', provider: 'github', providerLabel: 'GitHub', user: { login: 'hari' } };
const helmholtz: SessionInfo = { mode: 'proxy', provider: 'helmholtz', providerLabel: 'Helmholtz ID', user: { login: 'jdoe' } };

describe('authSlice', () => {
  beforeEach(() => vi.clearAllMocks());

  it('restores a stored session', async () => {
    vi.mocked(authApi.restoreSession).mockResolvedValue(github);
    const store = makeStore();
    await store.dispatch(restoreSession());
    expect(store.getState().auth).toMatchObject({ status: 'authenticated', user: { login: 'hari' }, mode: 'direct' });
  });

  it('starts anonymous when nothing is stored', async () => {
    vi.mocked(authApi.restoreSession).mockResolvedValue(null);
    const store = makeStore();
    await store.dispatch(restoreSession());
    expect(store.getState().auth.status).toBe('anonymous');
  });

  it('completes a university login as a proxy session (no tokens in Redux)', async () => {
    vi.mocked(authApi.completeLogin).mockResolvedValue(helmholtz);
    const store = makeStore();
    await store.dispatch(completeLogin('#handoff=x'));
    const auth = store.getState().auth;
    expect(auth).toMatchObject({ status: 'authenticated', mode: 'proxy', providerLabel: 'Helmholtz ID' });
    expect(JSON.stringify(auth)).not.toMatch(/token/i);
  });

  it('runs the hand-off exchange only once (StrictMode double effects)', async () => {
    vi.mocked(authApi.completeLogin).mockResolvedValue(helmholtz);
    const store = makeStore();
    await Promise.all([store.dispatch(completeLogin('#handoff=x')), store.dispatch(completeLogin('#handoff=x'))]);
    expect(authApi.completeLogin).toHaveBeenCalledTimes(1);
  });

  it('keeps the error and stays anonymous when the password is wrong', async () => {
    vi.mocked(authApi.passwordLogin).mockRejectedValue(new Error('Wrong email or password.'));
    const store = makeStore();
    await store.dispatch(passwordLogin({ username: 'demo', password: 'x', remember: false }));
    expect(store.getState().auth).toMatchObject({ status: 'anonymous', user: null, error: 'Wrong email or password.' });
  });

  it('does not let a late restore overwrite a fresh sign-in', async () => {
    let resolveRestore: (v: null) => void = () => {};
    vi.mocked(authApi.restoreSession).mockReturnValue(new Promise((r) => (resolveRestore = r)));
    vi.mocked(authApi.signInWithToken).mockResolvedValue(github);
    const store = makeStore();
    const restoring = store.dispatch(restoreSession());
    await store.dispatch(signInWithToken({ token: 't', remember: false }));
    resolveRestore(null);
    await restoring;
    expect(store.getState().auth.status).toBe('authenticated');
  });

  it('signs out', async () => {
    vi.mocked(authApi.signInWithToken).mockResolvedValue(github);
    const store = makeStore();
    await store.dispatch(signInWithToken({ token: 't', remember: false }));
    await store.dispatch(signOut());
    expect(store.getState().auth).toMatchObject({ status: 'anonymous', user: null, mode: null });
  });
});
