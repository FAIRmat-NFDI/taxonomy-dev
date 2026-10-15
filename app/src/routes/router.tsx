import { createBrowserRouter, Navigate } from 'react-router';
import { AppLayout } from '@/components/layout/AppLayout';
import { AUTH_CALLBACK_PATH } from '@/config';
import { AuthCallbackPage, DocPage, GraphPage, NotFoundPage, RouteErrorPage } from '@/pages';
import { paths, routeHandles } from './paths';

/**
 * Path routing (HOST/doc/, HOST/graph/). On GitHub Pages, deep links are served
 * through 404.html (a copy of index.html, created in the deploy workflow).
 */
export const router = createBrowserRouter(
  [
    {
      element: <AppLayout />,
      errorElement: <RouteErrorPage />,
      children: [
        { index: true, element: <Navigate to={paths.doc} replace /> },
        { path: paths.doc, element: <DocPage />, handle: routeHandles.doc },
        { path: paths.graph, element: <GraphPage />, handle: routeHandles.graph },
        { path: AUTH_CALLBACK_PATH, element: <AuthCallbackPage /> },
        { path: '*', element: <NotFoundPage /> },
      ],
    },
  ],
  { basename: import.meta.env.BASE_URL.replace(/\/$/, '') || '/' },
);
