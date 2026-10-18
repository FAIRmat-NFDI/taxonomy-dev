import { useId, useState } from 'react';
import {
  Alert,
  Checkbox,
  Collapse,
  Dialog,
  DialogContent,
  Divider,
  FormControlLabel,
  IconButton,
  Link,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useLocation } from 'react-router';
import { CloseIcon } from '@/assets';
import { config } from '@/config';
import { useAuth, useLoginOptions } from '@/hooks/useAuth';
import { EmailPasswordForm } from './EmailPasswordForm';
import { GitHubTokenForm } from './GitHubTokenForm';
import { ProviderButtons } from './ProviderButtons';
import { SignInHeader } from './SignInHeader';
import { signInCopy, type SignInMode } from './signInConfig';

interface SignInDialogProps {
  /** null = closed. */
  mode: SignInMode | null;
  onModeChange: (mode: SignInMode) => void;
  onClose: () => void;
}

/**
 * Sign-in / register modal (layout after Toolpad's SignInPage):
 * branding → provider buttons (GitHub, university — from the backend) → "or"
 * → email + password (sign in, or create account on the Register tab) → mode switch
 * → collapsed developer fallback (token).
 * Full-screen on phones.
 */
export function SignInDialog({ mode, onModeChange, onClose }: SignInDialogProps) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'), { noSsr: true });
  const titleId = useId();
  const location = useLocation();
  const { beginLogin, passwordLogin, register, signingIn } = useAuth();
  const { data: options, isLoading } = useLoginOptions();
  const [remember, setRemember] = useState(false);
  const [pendingProvider, setPendingProvider] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showTokenFallback, setShowTokenFallback] = useState(false);

  const activeMode = mode ?? 'signIn';
  const copy = signInCopy[activeMode];
  const buttons = options?.providers.filter((p) => p.showButton) ?? [];

  const loginWith = (providerId: string) => {
    setError(null);
    setPendingProvider(providerId);
    beginLogin(providerId, `${location.pathname}${location.search}`, remember).catch((e: Error) => {
      setPendingProvider(null);
      setError(e.message);
    });
  };

  const runAndClose = async (action: () => Promise<unknown>) => {
    setError(null);
    try {
      await action();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <Dialog
      open={mode !== null}
      onClose={onClose}
      fullWidth
      maxWidth="xs"
      fullScreen={fullScreen}
      aria-labelledby={titleId}
      slotProps={{
        transition: {
          onExited: () => {
            setError(null);
            setShowTokenFallback(false);
          },
        },
      }}
    >
      <IconButton aria-label="Close" onClick={onClose} sx={{ position: 'absolute', top: 8, right: 8 }}>
        <CloseIcon />
      </IconButton>

      <DialogContent sx={{ py: 5 }}>
        <Stack spacing={3}>
          <SignInHeader mode={activeMode} titleId={titleId} />

          {options && !options.available && (
            <Alert severity="warning">
              The sign-in service ({config.apiBaseUrl}) is not reachable. Developer access below still works.
            </Alert>
          )}

          <Stack spacing={1}>
            <ProviderButtons
              providers={buttons}
              prefix={copy.providerPrefix}
              loading={isLoading}
              pendingId={pendingProvider}
              onSelect={loginWith}
            />
            <FormControlLabel
              control={<Checkbox size="small" checked={remember} onChange={(e) => setRemember(e.target.checked)} />}
              label={<Typography variant="body2">Remember me on this device</Typography>}
            />
          </Stack>

          <Divider>
            <Typography variant="caption" color="text.secondary">
              or
            </Typography>
          </Divider>

          <EmailPasswordForm
            key={activeMode}
            mode={activeMode}
            submitLabel={copy.passwordSubmit}
            hint={copy.passwordHint}
            enabled={activeMode === 'signUp' ? !!options?.registration : !!options?.password}
            pending={signingIn}
            onSignIn={(u, p) => void runAndClose(() => passwordLogin(u, p, remember))}
            onSignUp={(account) => void runAndClose(() => register(account, remember))}
          />

          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          <Typography variant="body2" sx={{ textAlign: 'center' }}>
            {copy.switchPrompt}{' '}
            <Link
              component="button"
              type="button"
              variant="body2"
              onClick={() => onModeChange(activeMode === 'signIn' ? 'signUp' : 'signIn')}
            >
              {copy.switchAction}
            </Link>
          </Typography>

          <Stack sx={{ alignItems: 'center' }}>
            <Link
              component="button"
              type="button"
              variant="caption"
              color="text.secondary"
              onClick={() => setShowTokenFallback((v) => !v)}
            >
              {showTokenFallback ? 'Hide developer access' : 'Developer access: use a personal access token'}
            </Link>
          </Stack>
          <Collapse in={showTokenFallback} unmountOnExit>
            <GitHubTokenForm actionLabel="Create a token on GitHub" onSuccess={onClose} />
          </Collapse>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
