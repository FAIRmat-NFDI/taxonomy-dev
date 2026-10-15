import { Button, Skeleton, Stack } from '@mui/material';
import type { LoginProvider } from '@/api';
import { GitHubIcon, InstitutionIcon } from '@/assets';

interface ProviderButtonsProps {
  providers: LoginProvider[];
  prefix: string;
  loading: boolean;
  /** Provider currently redirecting (spinner on that button, others disabled). */
  pendingId: string | null;
  onSelect: (providerId: string) => void;
}

/** One button per login provider offered by the backend (GitHub, Helmholtz ID, …). */
export function ProviderButtons({ providers, prefix, loading, pendingId, onSelect }: ProviderButtonsProps) {
  if (loading) return <Skeleton variant="rounded" height={44} />;

  return (
    <Stack spacing={1}>
      {providers.map((p) => (
        <Button
          key={p.id}
          variant="outlined"
          color="inherit"
          size="large"
          fullWidth
          startIcon={p.type === 'github' ? <GitHubIcon /> : <InstitutionIcon />}
          loading={pendingId === p.id}
          loadingPosition="start"
          disabled={pendingId !== null && pendingId !== p.id}
          onClick={() => onSelect(p.id)}
        >
          {prefix} {p.label}
        </Button>
      ))}
    </Stack>
  );
}
