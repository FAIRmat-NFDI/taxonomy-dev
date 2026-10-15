import { Button } from '@mui/material';
import { Link } from 'react-router';
import { EmptyState } from '@/components/common';

export function NotFoundPage() {
  return (
    <EmptyState
      title="Page not found"
      action={
        <Button component={Link} to="/" variant="contained">
          Back to docs
        </Button>
      }
    />
  );
}
