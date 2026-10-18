import { useId, useState } from 'react';
import { Button, ListItemText, Menu, MenuItem } from '@mui/material';
import { DropdownIcon } from '@/assets';
import type { NavMenu } from './navMenus';

export function NavMenuButton({ menu }: { menu: NavMenu }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const menuId = useId();

  return (
    <>
      <Button
        variant="nav"
        endIcon={<DropdownIcon />}
        onClick={(e) => setAnchor(e.currentTarget)}
        aria-controls={anchor ? menuId : undefined}
        aria-haspopup="menu"
        aria-expanded={!!anchor}
      >
        {menu.label}
      </Button>
      <Menu id={menuId} anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
        {menu.items.map((item) => (
          <MenuItem
            key={item.href}
            component="a"
            href={item.href}
            target="_blank"
            rel="noreferrer"
            onClick={() => setAnchor(null)}
          >
            <ListItemText>{item.label}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
