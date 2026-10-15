import { lazy } from 'react';

/** Routed views. Lazy so each view ships as its own chunk. */
export const DocPage = lazy(() => import('./DocPage'));
export const GraphPage = lazy(() => import('./GraphPage'));
export const AuthCallbackPage = lazy(() => import('./AuthCallbackPage'));
export { NotFoundPage } from './NotFoundPage';
export { RouteErrorPage } from './RouteErrorPage';
