import { CssBaseline, ThemeProvider } from '@mui/material';
import { QueryClientProvider } from '@tanstack/react-query';
import { Provider as ReduxProvider } from 'react-redux';
import { RouterProvider } from 'react-router/dom';
import { queryClient } from '@/lib/queryClient';
import { router } from '@/routes/router';
import { store } from '@/store';
import { theme } from '@/theme';

/**
 *  Redux        → client state (auth, selected branch)
 *  React Query  → data fetched from GitHub (files, branches, issues)
 *  Theme        → FAIRmat / NOMAD design tokens
 */
export function App() {
  return (
    <ReduxProvider store={store}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </ThemeProvider>
    </ReduxProvider>
  );
}
