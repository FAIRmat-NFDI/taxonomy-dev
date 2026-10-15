import { useEffect } from 'react';
import { Alert, AlertTitle, Button, CircularProgress, Stack, Typography } from '@mui/material';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router';
import { PageContainer } from '@/components/common';
import { completeLogin, selectAuth, useAppDispatch, useAppSelector } from '@/store';

const safeNext = (value: string | null) => (value && value.startsWith('/') && !value.startsWith('//') ? value : '/');

/** /auth/callback — the backend redirects here with `#handoff=…` (or `#error=…`) after any provider login. */
export default function AuthCallbackPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { hash, search } = useLocation();
  const { error } = useAppSelector(selectAuth);

  useEffect(() => {
    // Remove the hand-off from the address bar and history right away.
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    dispatch(completeLogin(hash))
      .unwrap()
      .then(() => navigate(safeNext(new URLSearchParams(search).get('next')), { replace: true }))
      .catch(() => {
        /* error is shown from Redux; duplicate StrictMode runs are skipped by the thunk's condition */
      });
    // Run once per callback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <PageContainer>
      <Stack spacing={3} sx={{ alignItems: 'center', py: 8 }}>
        {error ? (
          <>
            <Alert severity="error" sx={{ maxWidth: 640 }}>
              <AlertTitle>Sign-in failed</AlertTitle>
              {error}
            </Alert>
            <Button component={RouterLink} to="/" variant="contained">
              Back to the app
            </Button>
          </>
        ) : (
          <>
            <CircularProgress />
            <Typography variant="body1" color="text.secondary">
              Signing you in…
            </Typography>
          </>
        )}
      </Stack>
    </PageContainer>
  );
}
