import { useState } from 'react';
import { Avatar, Button, IconButton, Link, ListItemIcon, ListItemText, Menu, MenuItem, Skeleton, Stack, Typography } from '@mui/material';
import { LogoutIcon } from '@/assets';
import { useAuth } from '@/hooks/useAuth';
import { SignInDialog } from './SignInDialog';
import type { SignInMode } from './signInConfig';

/**
 * "Login / Register" when anonymous (both open the sign-in dialog in the matching mode);
 * avatar + username with a sign-out menu when signed in.
 * `compact` (phones): smaller text, avatar only.
 */
export function AuthButton({ compact = false }: { compact?: boolean }) {
  const { user, providerLabel, resolving, signOut } = useAuth();
  const [dialogMode, setDialogMode] = useState<SignInMode | null>(null);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const textVariant = compact ? 'body2' : 'h6';

  if (resolving) return <Skeleton variant="text" width={compact ? 40 : 120} />;

  if (!user) {
    return (
      <>
        <Stack direction="row" spacing={0.75} sx={{ alignItems: 'baseline' }}>
          <Link component="button" variant={textVariant} color="text.primary" underline="hover" onClick={() => setDialogMode('signIn')}>
            Login
          </Link>
          <Typography variant={textVariant} color="text.disabled">
            /
          </Typography>
          <Link component="button" variant={textVariant} underline="hover" onClick={() => setDialogMode('signUp')}>
            Register
          </Link>
        </Stack>
        <SignInDialog mode={dialogMode} onModeChange={setDialogMode} onClose={() => setDialogMode(null)} />
      </>
    );
  }

  return (
    <>
      {compact ? (
        <IconButton onClick={(e) => setAnchor(e.currentTarget)} aria-haspopup="menu" aria-label={`Account: ${user.login}`}>
          <Avatar src={user.avatarUrl} alt={user.login} sx={{ width: 28, height: 28 }} />
        </IconButton>
      ) : (
        <Button
          color="inherit"
          onClick={(e) => setAnchor(e.currentTarget)}
          startIcon={<Avatar src={user.avatarUrl} alt={user.login} sx={{ width: 28, height: 28 }} />}
          aria-haspopup="menu"
        >
          {user.name ?? user.login}
        </Button>
      )}
      <Menu
        anchorEl={anchor}
        open={!!anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem disabled>
          <ListItemText primary={`@${user.login}`} secondary={providerLabel ? `via ${providerLabel}` : undefined} />
        </MenuItem>
        <MenuItem
          onClick={() => {
            setAnchor(null);
            void signOut();
          }}
        >
          <ListItemIcon>
            <LogoutIcon fontSize="small" />
          </ListItemIcon>
          Sign out
        </MenuItem>
      </Menu>
    </>
  );
}
