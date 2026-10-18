/**
 * Official colours — FAIRmat Visual Style Guidelines v1.0 (Sept 2023), RGB values for screen.
 * Use these values only; never apply transparency to them (§3.3).
 */

/** §3.1 FAIRmat colours — one per FAIRmat Area (also the logo-variation colours, §2.2). */
export const fairmatColors = {
  areaA: '#FFCC07',
  areaB: '#669933',
  areaC: '#009999',
  areaD: '#333399',
  areaE: '#663399',
  areaF: '#FF0066',
  areaG: '#FF0000',
} as const;

/** §3.2 NOMAD colours. */
export const nomadColors = {
  primary: '#2A4CDF',
  complementary: '#192E87',
  oasis: '#008A68',
  camels: '#BF8A36',
  backgroundPrimary: '#EAEDFC',
  backgroundOasis: '#CCE8E1',
  backgroundCamels: '#F3E9D9',
} as const;

/**
 * Light tints used by the NOMAD GUI (nomad-coe/nomad gui/src/config.js).
 * Not part of the guideline. Only used as MUI `light` variants for hover/focus states.
 */
export const nomadGuiTints = {
  primaryLight: '#7F94EC',
  oasisLight: '#80C583',
  oasisDark: '#00533E',
} as const;

/** Neutral surfaces (not brand colours). */
export const neutralColors = {
  pageBackground: '#F7F8FC',
  surface: '#FFFFFF',
} as const;

export type FairmatColors = { [K in keyof typeof fairmatColors]: string };
export type NomadColors = { [K in keyof typeof nomadColors]: string };
