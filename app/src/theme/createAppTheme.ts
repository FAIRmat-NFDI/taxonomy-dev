import { createTheme, responsiveFontSizes, type Theme } from '@mui/material/styles';
import { components } from './components';
import { createLightPalette } from './palette';
import { nomadBrand, type BrandTokens } from './tokens';
import { createTypography } from './typography';

export interface AppThemeOptions {
  /** Brand preset: `nomadBrand` (default, app shell) or `fairmatBrand`. */
  brand?: BrandTokens;
  /** Scale headings down on small screens (MUI responsiveFontSizes). */
  responsiveText?: boolean;
}

/**
 * Composes tokens → palette + typography + component overrides into one MUI theme.
 * CSS variables are on, so a dark scheme can be added later in palette.ts
 * without touching any component.
 */
export function createAppTheme({ brand = nomadBrand, responsiveText = true }: AppThemeOptions = {}): Theme {
  const theme = createTheme({
    cssVariables: true,
    colorSchemes: { light: { palette: createLightPalette(brand) } },
    typography: createTypography(brand.fontFamily),
    shape: { borderRadius: 4 },
    spacing: 8,
    components,
  });

  return responsiveText ? responsiveFontSizes(theme) : theme;
}
