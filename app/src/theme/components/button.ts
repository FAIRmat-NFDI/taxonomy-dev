import type { Components, Theme } from '@mui/material/styles';

export const MuiButton: Components<Theme>['MuiButton'] = {
  variants: [
    {
      // Top-level navigation (NOMAD style): typography comes from the `nav` variant.
      props: { variant: 'nav' },
      style: ({ theme }) => ({
        ...theme.typography.nav,
        color: (theme.vars ?? theme).palette.primary.main,
      }),
    },
  ],
};
