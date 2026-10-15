import type { Components, Theme } from '@mui/material/styles';

export const MuiTypography: Components<Theme>['MuiTypography'] = {
  defaultProps: {
    // Semantic element per variant; custom variants must be mapped explicitly.
    variantMapping: {
      h1: 'h1',
      h2: 'h2',
      h3: 'h3',
      h4: 'h4',
      h5: 'h5',
      h6: 'h6',
      subtitle1: 'p',
      subtitle2: 'p',
      body1: 'p',
      body2: 'p',
      nav: 'span',
    },
  },
};
