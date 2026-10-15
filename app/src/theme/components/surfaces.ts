import type { Components, Theme } from '@mui/material/styles';

export const MuiPaper: Components<Theme>['MuiPaper'] = {
  defaultProps: { variant: 'outlined' },
};

export const MuiTooltip: Components<Theme>['MuiTooltip'] = {
  styleOverrides: {
    tooltip: ({ theme }) => ({ ...theme.typography.caption }),
  },
};

export const MuiTableRow: Components<Theme>['MuiTableRow'] = {
  styleOverrides: {
    root: { '&:last-child td': { borderBottom: 0 } },
  },
};
