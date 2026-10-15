import { Alert, AlertTitle } from '@mui/material';
import { isAppError } from '@/api';

export function ErrorAlert({ error, title = 'Something went wrong' }: { error: unknown; title?: string }) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    <Alert severity="error" variant="outlined">
      <AlertTitle>
        {title}
        {isAppError(error) ? ` (${error.code})` : ''}
      </AlertTitle>
      {message}
    </Alert>
  );
}
