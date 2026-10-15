import { QueryClient } from '@tanstack/react-query';
import { isAppError } from '@/api';

const NON_RETRYABLE = new Set(['UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND', 'PARSE_ERROR', 'NOT_IMPLEMENTED']);

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // GitHub rate limits are tight for anonymous users — avoid refetch storms.
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: (count, error) => !(isAppError(error) && NON_RETRYABLE.has(error.code)) && count < 2,
    },
  },
});
