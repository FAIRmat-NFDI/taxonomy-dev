import { useMatches } from 'react-router';
import type { RouteHandle } from '@/routes/paths';

/** Deepest matched route's header data. */
export function useRouteHandle(): RouteHandle | undefined {
  const matches = useMatches();
  for (let i = matches.length - 1; i >= 0; i--) {
    const handle = matches[i]?.handle as RouteHandle | undefined;
    if (handle?.title) return handle;
  }
  return undefined;
}
