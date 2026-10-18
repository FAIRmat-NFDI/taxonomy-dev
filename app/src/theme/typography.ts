import type { TypographyVariantsOptions } from '@mui/material/styles';
import { fontWeights, guidelineScalePt, lineHeights, SCREEN_SCALE, tracking } from './tokens';

const HTML_FONT_SIZE = 16;
const pxToRem = (px: number) => `${px / HTML_FONT_SIZE}rem`;
/** Guideline points → rem on screen. */
const fromPt = (pt: number) => pxToRem(Math.round(pt * SCREEN_SCALE));

/**
 * Complete MUI type scale mapped onto the FAIRmat guideline (§4):
 *
 *   variant   guideline role            pt → px   weight
 *   h1        Title                     72 → 36   SemiBold
 *   h2        Poster header 1           60 → 30   SemiBold
 *   h3        Header 2 / Section title  48 → 24   SemiBold
 *   h4        Slide title               44 → 22   SemiBold
 *   h5        Side-bar title            36 → 18   Regular
 *   h6        Content, emphasised       32 → 16   SemiBold
 *   body1     Content text              32 → 16   Regular
 *   body2     Compact text (minimum)         14   Regular
 *
 * Only Regular and SemiBold exist (§4.1); "bold" maps to SemiBold.
 * Components never set font sizes themselves — they pick a variant.
 * Custom variant `nav` (AppBar navigation) is registered in augmentation.d.ts.
 */
export function createTypography(fontFamily: string): TypographyVariantsOptions {
  const heading = (pt: number, weight: number = fontWeights.semibold, letterSpacing: string = tracking.normal) => ({
    fontWeight: weight,
    fontSize: fromPt(pt),
    lineHeight: lineHeights.heading,
    letterSpacing,
  });

  return {
    fontFamily,
    htmlFontSize: HTML_FONT_SIZE,
    fontSize: 14,
    fontWeightLight: fontWeights.regular,
    fontWeightRegular: fontWeights.regular,
    fontWeightMedium: fontWeights.semibold,
    fontWeightBold: fontWeights.semibold,

    h1: heading(guidelineScalePt.title, fontWeights.semibold, tracking.tighter),
    h2: heading(guidelineScalePt.header1, fontWeights.semibold, tracking.tight),
    h3: heading(guidelineScalePt.header2),
    h4: heading(guidelineScalePt.slideTitle),
    h5: heading(guidelineScalePt.sideBarTitle, fontWeights.regular),
    h6: heading(guidelineScalePt.content, fontWeights.semibold, tracking.relaxed),

    subtitle1: { fontWeight: fontWeights.regular, fontSize: pxToRem(16), lineHeight: lineHeights.body, letterSpacing: tracking.relaxed },
    subtitle2: { fontWeight: fontWeights.semibold, fontSize: pxToRem(14), lineHeight: lineHeights.body, letterSpacing: tracking.relaxed },

    body1: { fontWeight: fontWeights.regular, fontSize: fromPt(guidelineScalePt.content), lineHeight: lineHeights.body, letterSpacing: tracking.relaxed },
    body2: { fontWeight: fontWeights.regular, fontSize: pxToRem(14), lineHeight: lineHeights.body, letterSpacing: tracking.relaxed },

    button: {
      fontWeight: fontWeights.semibold,
      fontSize: pxToRem(14),
      lineHeight: lineHeights.body,
      letterSpacing: tracking.wide,
      textTransform: 'none',
    },
    // Small print: use sparingly (metadata, hints) — not for content.
    caption: { fontWeight: fontWeights.regular, fontSize: pxToRem(12), lineHeight: lineHeights.body, letterSpacing: tracking.wide },
    overline: {
      fontWeight: fontWeights.semibold,
      fontSize: pxToRem(12),
      lineHeight: 2,
      letterSpacing: tracking.widest,
      textTransform: 'uppercase',
    },

    nav: {
      fontFamily,
      fontWeight: fontWeights.semibold,
      fontSize: pxToRem(17),
      lineHeight: lineHeights.body,
      letterSpacing: tracking.wider,
      textTransform: 'uppercase',
    },
  };
}
