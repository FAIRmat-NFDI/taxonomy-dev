import { describe, expect, it } from 'vitest';
import { createAppTheme } from './createAppTheme';
import { fairmatBrand, fairmatColors, fontWeights, nomadBrand, nomadColors } from './tokens';

const VARIANTS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'subtitle1', 'subtitle2', 'body1', 'body2', 'button', 'caption', 'overline', 'nav'] as const;

describe('createAppTheme', () => {
  it('uses the NOMAD brand by default and exposes both official palettes', () => {
    const theme = createAppTheme();

    expect(theme.palette.primary.main).toBe(nomadColors.primary);
    expect(theme.palette.primary.dark).toBe(nomadColors.complementary);
    expect(theme.palette.secondary.main).toBe(nomadColors.oasis);
    expect(theme.palette.fairmat.areaG).toBe(fairmatColors.areaG);
    expect(theme.palette.nomad.camels).toBe(nomadColors.camels);
    expect(theme.vars).toBeDefined(); // CSS variables enabled
  });

  it('switches to the FAIRmat brand without touching components', () => {
    const theme = createAppTheme({ brand: fairmatBrand });
    expect(theme.palette.primary.main).toBe(fairmatColors.areaG);
    expect(theme.palette.nomad.primary).toBe(nomadBrand.primary.main);
  });

  it('only uses Regular and SemiBold weights (guideline §4.1)', () => {
    const theme = createAppTheme({ responsiveText: false });
    const allowed: number[] = Object.values(fontWeights);
    for (const v of VARIANTS) expect(allowed).toContain(theme.typography[v].fontWeight);
  });

  it('keeps line height at least font size × 1.25 (guideline §4.2)', () => {
    const theme = createAppTheme({ responsiveText: false });
    for (const v of VARIANTS) expect(Number(theme.typography[v].lineHeight)).toBeGreaterThanOrEqual(1.25);
  });

  it('maps the guideline presentation scale to screen sizes', () => {
    const theme = createAppTheme({ responsiveText: false });
    expect(theme.typography.h1.fontSize).toBe('2.25rem'); // Title 72pt → 36px
    expect(theme.typography.body1.fontSize).toBe('1rem'); // Content 32pt → 16px
  });
});
