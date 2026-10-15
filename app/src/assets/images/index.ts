/**
 * Image registry (multi-colour artwork rendered as <img>, not recoloured by the theme).
 * Values are URLs resolved by Vite, so they respect the deploy base path.
 */
import logo from './logo.svg';

export const images = {
  logo,
} as const;

export type ImageKey = keyof typeof images;
