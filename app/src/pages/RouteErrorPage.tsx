import { Box } from '@mui/material';
import { isRouteErrorResponse, useRouteError } from 'react-router';
import { ErrorAlert } from '@/components/common';

/** Catches render/loader errors anywhere in the route tree. */
export function RouteErrorPage() {
  const error = useRouteError();
  const shown = isRouteErrorResponse(error) ? new Error(`${error.status} ${error.statusText}`) : error;
  return (
    <Box sx={{ p: 4 }}>
      <ErrorAlert error={shown} />
    </Box>
  );
}
