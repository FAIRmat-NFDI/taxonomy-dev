import { Backdrop, CircularProgress, Stack, Typography } from '@mui/material';
import { useBusy } from '@/hooks/useBusy';

/**
 * App-wide loading overlay: dims the page and shows a spinner while anything loads.
 * Network work appears after a short delay (no flash for fast requests); local tasks
 * appear at once, because they block the main thread right after starting.
 */
export function BusyBackdrop() {
  const { label, local } = useBusy();
  const open = label !== null;

  return (
    <Backdrop
      open={open}
      aria-busy={open}
      sx={(theme) => ({ zIndex: theme.zIndex.tooltip + 1, color: theme.palette.common.white })}
      slotProps={{ transition: { style: { transitionDelay: open && !local ? '250ms' : '0ms' } } }}
    >
      <Stack spacing={2} sx={{ alignItems: 'center' }} role="status">
        <CircularProgress color="inherit" />
        {label && <Typography variant="body2">{label}</Typography>}
      </Stack>
    </Backdrop>
  );
}

/** Suspense fallback (lazy views / chunks): the same overlay, shown at once. */
export function LoadingBackdrop({ label = 'Loading…' }: { label?: string }) {
  return (
    <Backdrop open sx={(theme) => ({ zIndex: theme.zIndex.tooltip + 1, color: theme.palette.common.white })}>
      <Stack spacing={2} sx={{ alignItems: 'center' }} role="status">
        <CircularProgress color="inherit" />
        <Typography variant="body2">{label}</Typography>
      </Stack>
    </Backdrop>
  );
}
