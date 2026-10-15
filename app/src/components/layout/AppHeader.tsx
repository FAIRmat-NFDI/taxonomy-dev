import { AppBar, Box, Button, Stack, Toolbar, Typography, useMediaQuery, useTheme } from '@mui/material';
import { Link as RouterLink } from 'react-router';
import { images } from '@/assets';
import { AuthButton } from '@/components/auth/AuthButton';
import { BranchSwitcher } from '@/components/BranchSwitcher';
import { logoRules } from '@/theme';
import { navMenus } from './navMenus';
import { paths } from '@/routes/paths';
import { MobileNavDrawer } from './MobileNavDrawer';
import { sidebarPanels } from './sidebarPanels';
import { NavMenuButton } from './NavMenuButton';
import { useRouteHandle } from './useRouteHandle';

/**
 * Layout:  LOGO | DIV1 (nav row / title) | spacer | DIV2 (account / branch)
 *  - md+   : full layout as designed
 *  - sm–md : nav row → hamburger Drawer
 *  - xs    : + DIV2 becomes a single compact row (icon-only branch, avatar-only user)
 */
export function AppHeader() {
  const handle = useRouteHandle();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'), { noSsr: true });
  const isPhone = useMediaQuery(theme.breakpoints.down('sm'), { noSsr: true });

  return (
    <AppBar position="relative">
      <Toolbar sx={{ py: { xs: 0.5, md: 1 }, gap: { xs: 1, md: 3 } }}>
        {!isDesktop && (
          <MobileNavDrawer switchTo={handle?.switchTo} sidebar={handle?.sidebar && sidebarPanels[handle.sidebar]} />
        )}

        {/* LOGO — ≥ 36px tall online (§2.3), clear space around it (§2.4) */}
        <Box
          component={RouterLink}
          to={paths.doc}
          aria-label="Home"
          sx={{ display: 'flex', flexShrink: 0, p: { md: logoRules.clearSpace } }}
        >
          <Box
            component="img"
            src={images.logo}
            alt=""
            sx={{ height: { xs: logoRules.minHeightPx, md: logoRules.appBarHeightPx }, width: 'auto' }}
          />
        </Box>

        {/* DIV1 */}
        <Stack spacing={0.5} sx={{ minWidth: 0 }}>
          {isDesktop && (
            <Stack direction="row" spacing={1}>
              {handle?.switchTo && (
                <Button component={RouterLink} to={handle.switchTo.to} variant="nav">
                  {handle.switchTo.label}
                </Button>
              )}
              {navMenus.map((menu) => (
                <NavMenuButton key={menu.label} menu={menu} />
              ))}
            </Stack>
          )}
          {/* Guideline "Title" role; titles stay on one line (§5.2) */}
          <Typography variant="h1" noWrap sx={{ px: { md: 1 } }}>
            {handle?.title ?? 'FAIRTaxonomy'}
          </Typography>
        </Stack>

        {/* SPACER */}
        <Box sx={{ flexGrow: 1 }} />

        {/* DIV2 */}
        <Stack
          direction={{ xs: 'row', sm: 'column' }}
          spacing={{ xs: 0.5, sm: 1 }}
          sx={{ alignItems: { xs: 'center', sm: 'flex-end' }, flexShrink: 0 }}
        >
          <AuthButton compact={isPhone} />
          <BranchSwitcher compact={isPhone} />
        </Stack>
      </Toolbar>
    </AppBar>
  );
}
