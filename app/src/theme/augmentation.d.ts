import type { CSSProperties } from 'react';
import '@mui/material/styles';
import '@mui/material/Typography';
import '@mui/material/Button';
import type { FairmatColors, NomadColors } from './tokens/colors';

/** Registers custom theme extensions so they are type-checked everywhere. */
declare module '@mui/material/styles' {
  interface Palette {
    fairmat: FairmatColors;
    nomad: NomadColors;
  }
  interface PaletteOptions {
    fairmat?: FairmatColors;
    nomad?: NomadColors;
  }
  interface TypographyVariants {
    nav: CSSProperties;
  }
  interface TypographyVariantsOptions {
    nav?: CSSProperties;
  }
}

declare module '@mui/material/Typography' {
  interface TypographyPropsVariantOverrides {
    nav: true;
  }
}

declare module '@mui/material/Button' {
  interface ButtonPropsVariantOverrides {
    nav: true;
  }
}
