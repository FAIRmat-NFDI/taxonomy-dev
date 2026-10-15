import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { authApi, type AuthUser, type NewAccount, type SessionInfo, type SessionMode } from '@/api';

/**
 *  unknown ──restore──▶ anonymous
 *  anonymous ──provider button──▶ redirecting ──(provider)──▶ exchanging ──▶ authenticated
 *  anonymous ──password / token──▶ signingIn ─────────────────────────────▶ authenticated
 *  authenticated ──signOut──▶ anonymous
 */
export type AuthStatus = 'unknown' | 'anonymous' | 'redirecting' | 'exchanging' | 'signingIn' | 'authenticated';

/** No tokens in Redux — only who is signed in and how. */
export interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
  provider: string | null;
  providerLabel: string | null;
  mode: SessionMode | null;
  error: string | null;
}

const initialState: AuthState = { status: 'unknown', user: null, provider: null, providerLabel: null, mode: null, error: null };

export const restoreSession = createAsyncThunk('auth/restoreSession', () => authApi.restoreSession());

/** Redirect login via the backend (GitHub, Helmholtz ID, …). */
export const beginLogin = createAsyncThunk(
  'auth/beginLogin',
  async ({ provider, next, remember }: { provider: string; next: string; remember: boolean }) =>
    authApi.beginLogin(provider, next, remember),
);

/** On /auth/callback. The hand-off is single-use: duplicate runs (StrictMode) are skipped. */
export const completeLogin = createAsyncThunk('auth/completeLogin', (fragment: string) => authApi.completeLogin(fragment), {
  condition: (_, { getState }) => (getState() as { auth: AuthState }).auth.status !== 'exchanging',
});

export const passwordLogin = createAsyncThunk(
  'auth/passwordLogin',
  ({ username, password, remember }: { username: string; password: string; remember: boolean }) =>
    authApi.passwordLogin(username, password, remember),
);

/** Create an account from the web app's form, then sign in. */
export const register = createAsyncThunk('auth/register', ({ account, remember }: { account: NewAccount; remember: boolean }) =>
  authApi.register(account, remember),
);

/** Developer fallback: personal access token. */
export const signInWithToken = createAsyncThunk(
  'auth/signInWithToken',
  ({ token, remember }: { token: string; remember: boolean }) => authApi.signInWithToken(token, remember),
);

export const signOut = createAsyncThunk('auth/signOut', () => authApi.signOut());

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearAuthError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    const signedIn = (state: AuthState, s: SessionInfo) => {
      Object.assign(state, { status: 'authenticated', user: s.user, provider: s.provider, providerLabel: s.providerLabel, mode: s.mode, error: null });
    };
    const failed = (state: AuthState, message: string) => {
      state.status = state.user ? 'authenticated' : 'anonymous';
      state.error = message;
    };

    builder
      .addCase(restoreSession.fulfilled, (state, { payload }) => {
        if (state.status !== 'unknown') return; // another sign-in finished first — keep it
        if (payload) signedIn(state, payload);
        else state.status = 'anonymous';
      })
      .addCase(restoreSession.rejected, (state) => {
        if (state.status === 'unknown') state.status = 'anonymous';
      })

      .addCase(beginLogin.pending, (state) => {
        state.status = 'redirecting';
        state.error = null;
      })
      .addCase(beginLogin.rejected, (state, { error }) => failed(state, error.message ?? 'Could not start the login.'))

      .addCase(completeLogin.pending, (state) => {
        state.status = 'exchanging';
        state.error = null;
      })
      .addCase(completeLogin.fulfilled, (state, { payload }) => signedIn(state, payload))
      .addCase(completeLogin.rejected, (state, { error }) => failed(state, error.message ?? 'Login failed.'))

      .addCase(passwordLogin.pending, (state) => {
        state.status = 'signingIn';
        state.error = null;
      })
      .addCase(passwordLogin.fulfilled, (state, { payload }) => signedIn(state, payload))
      .addCase(passwordLogin.rejected, (state, { error }) => failed(state, error.message ?? 'Sign-in failed.'))

      .addCase(register.pending, (state) => {
        state.status = 'signingIn';
        state.error = null;
      })
      .addCase(register.fulfilled, (state, { payload }) => signedIn(state, payload))
      .addCase(register.rejected, (state, { error }) => failed(state, error.message ?? 'Could not create the account.'))

      .addCase(signInWithToken.pending, (state) => {
        state.status = 'signingIn';
        state.error = null;
      })
      .addCase(signInWithToken.fulfilled, (state, { payload }) => signedIn(state, payload))
      .addCase(signInWithToken.rejected, (state, { error }) => failed(state, error.message ?? 'Sign-in failed.'))

      .addCase(signOut.fulfilled, () => ({ ...initialState, status: 'anonymous' }));
  },
});

export const { clearAuthError } = authSlice.actions;
export const authReducer = authSlice.reducer;
