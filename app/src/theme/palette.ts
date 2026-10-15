import type { PaletteOptions } from '@mui/material/styles';
import { fairmatColors, nomadColors, type BrandTokens } from './tokens';

/**
 * Light colour scheme for a brand. Both official palettes are always attached
 * (`palette.fairmat`, `palette.nomad`), whichever brand drives primary/secondary,
 * so any component can use e.g. `theme.palette.fairmat.areaC` or the
 * CSS variable `var(--mui-palette-nomad-camels)`.
 * Add `createDarkPalette` beside this to enable dark mode.
 */
export function createLightPalette(brand: BrandTokens): PaletteOptions {
  return {
    mode: 'light',
    primary: { main: brand.primary.main, light: brand.primary.light, dark: brand.primary.dark },
    secondary: { main: brand.secondary.main, light: brand.secondary.light, dark: brand.secondary.dark },
    background: brand.background,
    ...(brand.primary.veryLight && { action: { selected: brand.primary.veryLight } }),
    fairmat: { ...fairmatColors },
    nomad: { ...nomadColors },
  };
}
