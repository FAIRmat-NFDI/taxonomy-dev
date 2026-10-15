import { fairmatColors, neutralColors, nomadColors, nomadGuiTints } from './colors';
import { fontFamily } from './typography';

export interface ColorTokens {
  main: string;
  /** Omit to let MUI derive it from `main`. */
  light?: string;
  dark?: string;
  /** Background tint for selected items and panels. */
  veryLight?: string;
}

/** Everything that differs between brands; passed to createAppTheme({ brand }). */
export interface BrandTokens {
  name: 'NOMAD' | 'FAIRmat';
  primary: ColorTokens;
  secondary: ColorTokens;
  background: { default: string; paper: string };
  fontFamily: string;
}

/** NOMAD brand (guideline §3.2). Used by the app shell / AppBar. */
export const nomadBrand: BrandTokens = {
  name: 'NOMAD',
  primary: {
    main: nomadColors.primary,
    light: nomadGuiTints.primaryLight,
    dark: nomadColors.complementary,
    veryLight: nomadColors.backgroundPrimary,
  },
  secondary: {
    main: nomadColors.oasis,
    light: nomadGuiTints.oasisLight,
    dark: nomadGuiTints.oasisDark,
    veryLight: nomadColors.backgroundOasis,
  },
  background: { default: neutralColors.pageBackground, paper: neutralColors.surface },
  fontFamily,
};

/**
 * FAIRmat brand (guideline §3.1): FAIRmat red with Area D as secondary.
 * Note: #FF0000 on white has a 4.0:1 contrast ratio — fine for large text and
 * graphics, below WCAG AA for body-size text. Prefer NOMAD for UI chrome.
 */
export const fairmatBrand: BrandTokens = {
  name: 'FAIRmat',
  primary: { main: fairmatColors.areaG },
  secondary: { main: fairmatColors.areaD },
  background: { default: neutralColors.pageBackground, paper: neutralColors.surface },
  fontFamily,
};
