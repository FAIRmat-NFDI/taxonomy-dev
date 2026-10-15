import { useState } from 'react';
import { Button, CircularProgress, IconButton, ListItemIcon, ListItemText, Menu, MenuItem, Tooltip } from '@mui/material';
import { BranchIcon, CheckIcon, DropdownIcon } from '@/assets';
import { useBranches } from '@/hooks/useOntology';
import { branchSelected, selectBranch, useAppDispatch, useAppSelector } from '@/store';

/** `compact` (phones): icon-only trigger; the menu still marks the current branch. */
export function BranchSwitcher({ compact = false }: { compact?: boolean }) {
  const branch = useAppSelector(selectBranch);
  const dispatch = useAppDispatch();
  const { data: branches, isLoading, error } = useBranches();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  const select = (name: string) => {
    dispatch(branchSelected(name));
    setAnchor(null);
  };

  return (
    <>
      <Tooltip title={error ? 'Could not load branches' : `Branch: ${branch}`}>
        {compact ? (
          <IconButton
            color="inherit"
            onClick={(e) => setAnchor(e.currentTarget)}
            aria-haspopup="menu"
            aria-label={`Current branch: ${branch}`}
          >
            {isLoading ? <CircularProgress size={20} color="inherit" /> : <BranchIcon />}
          </IconButton>
        ) : (
          <Button
            color="inherit"
            startIcon={isLoading ? <CircularProgress size={18} color="inherit" /> : <BranchIcon />}
            endIcon={<DropdownIcon />}
            onClick={(e) => setAnchor(e.currentTarget)}
            aria-haspopup="menu"
            aria-label={`Current branch: ${branch}`}
          >
            {branch}
          </Button>
        )}
      </Tooltip>
      <Menu
        anchorEl={anchor}
        open={!!anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        {(branches ?? [branch]).map((name) => (
          <MenuItem key={name} selected={name === branch} onClick={() => select(name)}>
            <ListItemIcon>{name === branch && <CheckIcon fontSize="small" />}</ListItemIcon>
            <ListItemText>{name}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
