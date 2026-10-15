import type { Components, Theme } from '@mui/material/styles';

export const MuiAppBar: Components<Theme>['MuiAppBar'] = {
  defaultProps: { elevation: 2, variant: 'elevation', color: 'inherit' },
  styleOverrides: {
    root: ({ theme }) => ({
      backgroundColor: (theme.vars ?? theme).palette.background.paper,
      color: (theme.vars ?? theme).palette.text.primary,
    }),
  },
};
