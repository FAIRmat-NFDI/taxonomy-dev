/**
 * Typography tokens — FAIRmat Visual Style Guidelines §4.
 *  - One font only: Titillium Web (§4.1, §2.8 "Do NOT: Font").
 *  - Two weights only: Regular and SemiBold (§4.1).
 *  - Line height ≥ font size × 1.25 (§4.2).
 *  - Size ratios follow the presentation scale (§4.3).
 */
export const fontFamily = ['"Titillium Web"', 'sans-serif'].join(',');

/** Description-logic formulas: system math / serif fonts with the logic symbols (⊑ ⊓ ∃ …). */
export const mathFontFamily = ['"STIX Two Math"', '"Cambria Math"', '"Latin Modern Math"', '"DejaVu Serif"', 'serif'].join(',');

/** Code (Turtle source); system monospace fonts, nothing extra to load. */
export const monoFontFamily = ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', '"Liberation Mono"', 'monospace'].join(',');

/** Keep in sync with the faces imported in theme/fonts.ts. */
export const fontWeights = {
  regular: 400,
  semibold: 600,
} as const;

export const lineHeights = {
  /** §4.2: font size × 1.25. */
  heading: 1.25,
  /** Running text on screen gets more (WCAG 1.4.12 recommends 1.5); never below 1.25. */
  body: 1.5,
} as const;

/** Letter-spacing scale (em). Slightly wider than MUI defaults. */
export const tracking = {
  tighter: '0em',
  tight: '0.005em',
  normal: '0.015em',
  relaxed: '0.02em',
  wide: '0.04em',
  wider: '0.06em',
  widest: '0.1em',
} as const;

/** §4.2 and §4.3 sizes in points, as published. */
export const guidelineScalePt = {
  title: 72, // Title — SemiBold
  header1: 60, // Poster header 1 — SemiBold
  header2: 48, // Poster header 2 / section title — SemiBold
  slideTitle: 44, // Slide title — SemiBold
  sideBarTitle: 36, // Side-bar title / poster main text — Regular
  content: 32, // Content text / poster absolute minimum — Regular
} as const;

/**
 * Converts guideline points to screen pixels. 0.5 maps content text (32pt)
 * to the 16px body size, so every ratio from the guideline is preserved.
 */
export const SCREEN_SCALE = 0.5;
