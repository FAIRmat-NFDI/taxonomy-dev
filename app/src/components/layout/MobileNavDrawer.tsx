import { Fragment, useState, type ReactNode } from 'react';
import { Box, Divider, Drawer, IconButton, List, ListItemButton, ListItemText, ListSubheader } from '@mui/material';
import { Link as RouterLink, useLocation } from 'react-router';
import { ExternalLinkIcon, MenuIcon } from '@/assets';
import { navMenus } from './navMenus';
import type { RouteHandle } from '@/routes/paths';
import { layout } from '@/theme';

interface MobileNavDrawerProps {
  switchTo?: RouteHandle['switchTo'];
  /** Page panel shown first (e.g. the /doc hierarchy). */
  sidebar?: ReactNode;
}

/**
 * Below `md`: the nav-button row collapses into a temporary Drawer (MUI responsive-AppBar pattern).
 * Pages can put a panel at the top (route handle `sidebar`).
 */
export function MobileNavDrawer({ switchTo, sidebar }: MobileNavDrawerProps) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  // Picking a node in the sidebar panel changes the URL (?node=…): close the drawer to show it.
  const { search } = useLocation();
  const [lastSearch, setLastSearch] = useState(search);
  if (search !== lastSearch) {
    setLastSearch(search);
    setOpen(false);
  }

  return (
    <>
      <IconButton edge="start" color="primary" aria-label="Open navigation" onClick={() => setOpen(true)}>
        <MenuIcon />
      </IconButton>
      <Drawer anchor="left" open={open} onClose={close}>
        <Box component="nav" sx={{ width: `min(${layout.sidebarWidth}px, 85vw)` }}>
          {sidebar && (
            <>
              {sidebar}
              <Divider />
            </>
          )}
          {switchTo && (
            <List>
              <ListItemButton component={RouterLink} to={switchTo.to} onClick={close}>
                <ListItemText primary={`${switchTo.label} view`} />
              </ListItemButton>
            </List>
          )}
          {navMenus.map((menu) => (
            <Fragment key={menu.label}>
              <Divider />
              <List subheader={<ListSubheader>{menu.label}</ListSubheader>}>
                {menu.items.map((item) => (
                  <ListItemButton
                    key={item.href}
                    component="a"
                    href={item.href}
                    target="_blank"
                    rel="noreferrer"
                    onClick={close}
                  >
                    <ListItemText primary={item.label} />
                    <ExternalLinkIcon fontSize="small" color="action" />
                  </ListItemButton>
                ))}
              </List>
            </Fragment>
          ))}
        </Box>
      </Drawer>
    </>
  );
}
