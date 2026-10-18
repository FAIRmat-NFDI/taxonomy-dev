import { useState, type FormEvent } from 'react';
import {
  Button,
  Checkbox,
  FormControlLabel,
  Link,
  Stack,
  Step,
  StepContent,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from '@mui/material';
import { ExternalLinkIcon, GitHubIcon } from '@/assets';
import { authApi } from '@/api';
import { config } from '@/config';
import { useAuth } from '@/hooks/useAuth';
import { GITHUB_SIGNUP_URL } from './signInConfig';

/**
 * GitHub sign-in without a backend: the user creates a fine-grained access
 * token on a pre-filled GitHub page, pastes it here, and the app verifies it.
 */
export function GitHubTokenForm({ actionLabel, onSuccess }: { actionLabel: string; onSuccess: () => void }) {
  const { signInWithToken, signingIn } = useAuth();
  const [activeStep, setActiveStep] = useState(0);
  const [token, setToken] = useState('');
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const repoLabel = config.source.repo ? `${config.source.owner}/${config.source.repo}` : 'the ontology repository';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await signInWithToken(token, remember);
      setToken('');
      onSuccess();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <Stepper activeStep={activeStep} orientation="vertical">
      <Step>
        <StepLabel>Create a GitHub access token</StepLabel>
        <StepContent>
          <Stack spacing={1.5}>
            <Typography variant="body2" color="text.secondary">
              GitHub opens with everything pre-filled. Under <b>Repository access</b>, select {repoLabel}, then click{' '}
              <b>Generate token</b> and copy it.
            </Typography>
            <Button
              variant="outlined"
              color="inherit"
              size="large"
              fullWidth
              startIcon={<GitHubIcon />}
              endIcon={<ExternalLinkIcon fontSize="small" />}
              href={authApi.tokenCreationUrl()}
              target="_blank"
              rel="noreferrer"
              onClick={() => setActiveStep(1)}
            >
              {actionLabel}
            </Button>
            <Typography variant="caption" color="text.secondary">
              No GitHub account?{' '}
              <Link href={GITHUB_SIGNUP_URL} target="_blank" rel="noreferrer">
                Create one first
              </Link>
              . Already have a token?{' '}
              <Link component="button" type="button" variant="caption" onClick={() => setActiveStep(1)}>
                Paste it
              </Link>
              .
            </Typography>
          </Stack>
        </StepContent>
      </Step>

      <Step>
        <StepLabel>Paste the token</StepLabel>
        <StepContent>
          <Stack component="form" spacing={1.5} onSubmit={submit}>
            <TextField
              type="password"
              name="token"
              label="GitHub access token"
              placeholder="github_pat_…"
              autoComplete="off"
              fullWidth
              autoFocus
              value={token}
              onChange={(e) => setToken(e.target.value)}
              error={!!error}
              helperText={error ?? 'Checked with GitHub, then kept only in this browser.'}
            />
            <FormControlLabel
              control={<Checkbox checked={remember} onChange={(e) => setRemember(e.target.checked)} />}
              label={<Typography variant="body2">Remember me on this device</Typography>}
            />
            <Stack direction="row" spacing={1}>
              <Button onClick={() => setActiveStep(0)}>Back</Button>
              <Button type="submit" variant="contained" fullWidth disabled={!token.trim()} loading={signingIn}>
                Sign in
              </Button>
            </Stack>
          </Stack>
        </StepContent>
      </Step>
    </Stepper>
  );
}
