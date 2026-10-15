import { useState, type FormEvent } from 'react';
import { Button, Stack, TextField, Typography } from '@mui/material';
import type { NewAccount } from '@/api';
import { EmailIcon } from '@/assets';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

interface EmailPasswordFormProps {
  /** signIn: email/username + password · signUp: also first/last name, creates the account. */
  mode: 'signIn' | 'signUp';
  submitLabel: string;
  hint?: string;
  pending: boolean;
  /** False when the backend has no provider for this mode. */
  enabled: boolean;
  onSignIn: (username: string, password: string) => void;
  onSignUp: (account: NewAccount) => void;
}

/** Email + password form, checked (or created) by the backend's Keycloak provider. */
export function EmailPasswordForm({ mode, submitLabel, hint, pending, enabled, onSignIn, onSignUp }: EmailPasswordFormProps) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState(false);

  const signUp = mode === 'signUp';
  const emailInvalid = signUp && touched && !EMAIL_PATTERN.test(username.trim());
  const passwordInvalid = signUp && touched && password.length > 0 && password.length < MIN_PASSWORD;
  const complete = signUp
    ? firstName.trim() && lastName.trim() && EMAIL_PATTERN.test(username.trim()) && password.length >= MIN_PASSWORD
    : username.trim() && password;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!complete) return;
    if (signUp) onSignUp({ email: username.trim(), password, firstName: firstName.trim(), lastName: lastName.trim() });
    else onSignIn(username.trim(), password);
  };

  return (
    <Stack component="form" noValidate spacing={2} onSubmit={handleSubmit}>
      {signUp && (
        <Stack direction="row" spacing={2}>
          <TextField
            name="given-name"
            label="First name"
            autoComplete="given-name"
            required
            fullWidth
            disabled={!enabled}
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
          <TextField
            name="family-name"
            label="Last name"
            autoComplete="family-name"
            required
            fullWidth
            disabled={!enabled}
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
        </Stack>
      )}
      <TextField
        type={signUp ? 'email' : 'text'}
        name={signUp ? 'email' : 'username'}
        label={signUp ? 'Email' : 'Email or username'}
        autoComplete={signUp ? 'email' : 'username'}
        required
        fullWidth
        disabled={!enabled}
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        onBlur={() => setTouched(true)}
        error={emailInvalid}
        helperText={emailInvalid ? 'Enter a valid email address.' : undefined}
      />
      <TextField
        type="password"
        name="password"
        label="Password"
        autoComplete={signUp ? 'new-password' : 'current-password'}
        required
        fullWidth
        disabled={!enabled}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={passwordInvalid}
        helperText={passwordInvalid ? `At least ${MIN_PASSWORD} characters.` : undefined}
      />
      <Button
        type="submit"
        variant="contained"
        size="large"
        fullWidth
        startIcon={<EmailIcon />}
        loading={pending}
        loadingPosition="start"
        disabled={!enabled || !complete}
      >
        {submitLabel}
      </Button>
      {(hint || !enabled) && (
        <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
          {enabled ? hint : signUp ? 'Creating accounts is not enabled on the server.' : 'Email and password sign-in is not configured on the server.'}
        </Typography>
      )}
    </Stack>
  );
}
