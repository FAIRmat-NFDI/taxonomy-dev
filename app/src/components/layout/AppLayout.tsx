import { Suspense } from 'react';
import { Box } from '@mui/material';
import { Outlet } from 'react-router';
import { BusyBackdrop, LoadingBackdrop } from '@/components/common';
import { useAuthBootstrap } from '@/hooks/useAuth';
import { useOntologyLoader } from '@/hooks/useOntology';
import { AppHeader } from './AppHeader';

/**
 * Full-viewport shell: the AppBar never scrolls; each view manages its own scrolling.
 * Restores the session, then loads the ontology for the selected branch (shared by all views).
 * One busy overlay for the whole app (see BusyBackdrop).
 */
export function AppLayout() {
  useAuthBootstrap();
  useOntologyLoader();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: 'background.default' }}>
      <AppHeader />
      <Box component="main" sx={{ flexGrow: 1, minHeight: 0, overflow: 'auto' }}>
        <Suspense fallback={<LoadingBackdrop />}>
          <Outlet />
        </Suspense>
      </Box>
      <BusyBackdrop />
    </Box>
  );
}
